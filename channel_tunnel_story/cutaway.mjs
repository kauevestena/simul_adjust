import * as THREE from '../camera_proj/vendor/three.module.min.js';
import {OrbitControls} from '../camera_proj/vendor/OrbitControls.js';
/** Genuine 3D geometry; all layer boundaries and tunnel curves are illustrative, not digitised geology. */
export class Cutaway {
  constructor(host) {
    this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#132638');
    this.camera=new THREE.PerspectiveCamera(42,1,0.1,200);
    this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    host.append(this.renderer.domElement);this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('role','img');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enablePan=false;this.controls.minDistance=13;this.controls.maxDistance=48;this.controls.maxPolarAngle=Math.PI*0.65;
    // One-finger vertical scrolling remains available on touch screens.
    this.controls.touches.ONE=THREE.TOUCH.PAN;this.controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
    this.renderer.domElement.style.touchAction='pan-y';
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x263443,2.4));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-4,10,8);this.scene.add(light);
    const base=(x)=>-1.5+0.6*Math.sin((x+10)*Math.PI/20)+0.25*Math.sin(x*0.7);
    // Far half of a geological block, with its near cut face exposed along the tunnel corridor.
    for(const [offset,color] of [[-1.4,0x617888],[0,0xb69c64],[1.4,0xe1d7bc]]) {
      const shape=new THREE.Shape();
      for(let i=0;i<=80;i++){const x=-10+i*.25,y=base(x)+offset-.7;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
      for(let i=80;i>=0;i--){const x=-10+i*.25;shape.lineTo(x,base(x)+offset+.7);}
      shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.7,bevelEnabled:false,steps:1}),new THREE.MeshStandardMaterial({color,roughness:1}));
      mesh.position.z=-1.35;this.scene.add(mesh);
    }
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(20,4.6),new THREE.MeshStandardMaterial({color:0x3589a2,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));sea.rotation.x=-Math.PI/2;sea.position.y=1.8;this.scene.add(sea);
    this.curves=[];
    for(const z of [-2.8,-1.95,-1.1]) {
      const points=Array.from({length:41},(_,i)=>{const x=-10+i*.5;return new THREE.Vector3(x,base(x),z);});
      const curve=new THREE.CatmullRomCurve3(points);this.curves.push(curve);
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,120,z===-1.95?.12:.19,12,false),new THREE.MeshStandardMaterial({color:0x728ba0,roughness:.6}));this.scene.add(tube);
    }
    this.tbms=[0xffb652,0x6ae3d7].map(color=>{
      const group=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.75,20),new THREE.MeshStandardMaterial({color}));body.rotation.z=Math.PI/2;group.add(body);
      const head=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.08,20),new THREE.MeshStandardMaterial({color:0xf2f6f7,wireframe:true}));head.rotation.z=Math.PI/2;head.position.x=.39;group.add(head);this.scene.add(group);return group;
    });
    this.renderer.domElement.addEventListener('keydown',event=>{
      const spherical=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      if(event.key==='Home'){event.preventDefault();this.reset();return;}
      if(event.key==='ArrowLeft')spherical.theta-=.15;
      else if(event.key==='ArrowRight')spherical.theta+=.15;
      else if(event.key==='ArrowUp')spherical.phi=Math.max(.2,spherical.phi-.1);
      else if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI*.65,spherical.phi+.1);
      else if(['+','='].includes(event.key))spherical.radius=Math.max(13,spherical.radius/1.1);
      else if(event.key==='-')spherical.radius=Math.min(48,spherical.radius*1.1);
      else return;
      event.preventDefault();this.camera.position.setFromSpherical(spherical).add(this.controls.target);this.controls.update();this.render();
    });
    this.progress=0;this.controls.addEventListener('change',()=>this.render());this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.reset();this.setProgress(0);
  }
  setProgress(p) {
    this.progress=Math.max(0,Math.min(1,p));const curve=this.curves[1];
    [this.progress*.48,1-this.progress*.48].forEach((t,i)=>{const mesh=this.tbms[i];mesh.position.copy(curve.getPoint(t));mesh.rotation.y=i?Math.PI:0;mesh.children[1].rotation.x=this.progress*70;});this.render();
  }
  reset(){this.camera.position.set(9,8,-25);this.controls.target.set(0,-.7,-.7);this.controls.update();this.render();}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.render();}
  render(){this.renderer.render(this.scene,this.camera);}
}
