import * as THREE from '../camera_proj/vendor/three.module.min.js';
import {OrbitControls} from '../camera_proj/vendor/OrbitControls.js';

// Schematic teaching scene. NO surveyed positions, as-built geometry, or observed TBM trajectory.
// The 1986 project grid / 1987 GPS campaign preceded optical/gyro control underground.
export class Cutaway {
  constructor(host) {
    this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#132638');
    this.camera=new THREE.PerspectiveCamera(42,1,0.1,220);
    this.renderer=new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    host.append(this.renderer.domElement);
    this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('role','img');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enablePan=false;this.controls.minDistance=6;this.controls.maxDistance=85;
    this.controls.maxPolarAngle=Math.PI*.77;
    this.controls.touches.ONE=THREE.TOUCH.PAN;this.controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
    this.renderer.domElement.style.touchAction='pan-y';
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x3b5066,2.4));
    const light=new THREE.DirectionalLight(0xfff4df,3.1);light.position.set(-5,9,10);this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xb3cddd,.45));
    this.base=x=>-1.45+.45*Math.sin((x+10)*Math.PI/20)+.22*Math.sin(x*.7);
    // Rock slice is pushed BEHIND the near-side shafts. This allows the excavation to remain visible.
    this.rockLayers=[];
    for(const [offset,color] of [[-1.4,0x667789],[0,0xb79d6f],[1.4,0xe0d4b5]]) {
      const shape=new THREE.Shape();
      for(let i=0;i<=80;i++){const x=-10+i*.25,y=this.base(x)+offset-.7;if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);}
      for(let i=80;i>=0;i--){const x=-10+i*.25;shape.lineTo(x,this.base(x)+offset+.7);}
      shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.1,bevelEnabled:false,steps:1}),new THREE.MeshStandardMaterial({color,roughness:1}));
      mesh.position.z=-3.4;this.scene.add(mesh);this.rockLayers.push(mesh);
    }
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(20,5.5),new THREE.MeshStandardMaterial({color:0x38a8ce,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}));
    sea.rotation.x=-Math.PI/2;sea.position.y=2.4;sea.position.z=-.3;this.scene.add(sea);
    // Three tunnels; service bore is the centre one. Their curves and spacing are schematic.
    this.curves=[-.35,.62,1.6].map(z=>new THREE.CatmullRomCurve3(
      Array.from({length:41},(_,i)=>{const x=-10+i*.5;return new THREE.Vector3(x,this.base(x),z);})
    ));
    this.tunnelGroup=new THREE.Group();this.scene.add(this.tunnelGroup);
    this.driveMeshes=[];this.liningRings=[];
    for(let bore=0;bore<3;bore++){
      const curve=this.curves[bore];
      // Faint dotted planned axis remains visible before excavation.
      const planned=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),new THREE.LineDashedMaterial({color:0x96b0b9,opacity:.42,transparent:true,dashSize:.25,gapSize:.20}));
      planned.computeLineDistances();this.tunnelGroup.add(planned);
      for(let side=0;side<2;side++){
        const holder=new THREE.Group();this.tunnelGroup.add(holder);
        this.driveMeshes.push({holder,bore,side,last:-1});
      }
    }
    // Optical / gyro survey stations advance behind the service tunnel excavation.
    this.surveyGroup=new THREE.Group();this.scene.add(this.surveyGroup);
    this.surveyMarkers=[];this.surveyLegs=[];
    const stations=Array.from({length:13},(_,i)=>this.curves[1].getPoint(i/12).add(new THREE.Vector3(0,0,.48)));
    stations.forEach((point,i)=>{
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.108,12,10),new THREE.MeshStandardMaterial({color:i<6?0xffc570:i>6?0x6ae3d7:0xffffff,emissive:0x142a30}));
      marker.position.copy(point);this.surveyMarkers.push(marker);this.surveyGroup.add(marker);
      if(i>0){
        const sight=new THREE.Line(new THREE.BufferGeometry().setFromPoints([stations[i-1],point]),new THREE.LineBasicMaterial({color:i<7?0xffc570:0x6ae3d7}));
        this.surveyLegs.push(sight);this.surveyGroup.add(sight);
      }
    });

    // Schematic instrument setups, not a reconstruction of the historical survey.
    // Place them against the service-bore traverse and scale them for teaching visibility.
    this.totalStations=[];
    for(const stationIndex of [1,2,3,4,8,9,10,11]){
      const instrument=new THREE.Group();
      const p=stations[stationIndex];instrument.position.copy(p);
      const dark=new THREE.MeshStandardMaterial({color:0x273b4a,metalness:.5,roughness:.4});
      const yellow=new THREE.MeshStandardMaterial({color:0xffd06d,metalness:.35,roughness:.4});
      const glass=new THREE.MeshStandardMaterial({color:0x84e9ee,metalness:.45,roughness:.22});
      const vertical=new THREE.Vector3(0,1,0);
      const makeLeg=(x,z)=>{
        const from=new THREE.Vector3(0,.41,0),to=new THREE.Vector3(x,.035,z);
        const direction=to.clone().sub(from);
        const rod=new THREE.Mesh(new THREE.CylinderGeometry(.021,.028,direction.length(),8),dark);
        rod.position.copy(from).add(to).multiplyScalar(.5);
        rod.quaternion.setFromUnitVectors(vertical,direction.normalize());
        instrument.add(rod);
      };
      for(let k=0;k<3;k++){const a=k*Math.PI*2/3;makeLeg(.24*Math.cos(a),.24*Math.sin(a));}
      const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.08,12),yellow);
      pedestal.position.y=.43;instrument.add(pedestal);
      const housing=new THREE.Mesh(new THREE.BoxGeometry(.22,.23,.16),yellow);
      housing.position.y=.60;instrument.add(housing);
      const telescope=new THREE.Mesh(new THREE.CylinderGeometry(.066,.066,.36,16),dark);
      telescope.rotation.z=Math.PI/2;telescope.position.set(.015,.66,0);
      instrument.add(telescope);
      for(const x of [-.18,.18]){
        const lens=new THREE.Mesh(new THREE.CircleGeometry(.051,16),glass);
        lens.rotation.y=x<0?-Math.PI/2:Math.PI/2;lens.position.set(x,.66,0);
        instrument.add(lens);
      }
      const display=new THREE.Mesh(new THREE.BoxGeometry(.16,.08,.025),dark);
      display.position.set(0,.52,.105);instrument.add(display);
      const reticle=new THREE.Mesh(new THREE.BoxGeometry(.06,.026,.027),glass);
      reticle.position.set(0,.52,.127);instrument.add(reticle);
      instrument.userData.stationIndex=stationIndex;
      instrument.userData.isTotalStation=true;
      this.surveyGroup.add(instrument);this.totalStations.push(instrument);
    }
    this.gyroStations=new THREE.Group();this.surveyGroup.add(this.gyroStations);
    for(const i of [2,4,8,10]){
      const p=stations[i];
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.48,10),new THREE.MeshStandardMaterial({color:0xf3d57d}));
      pole.position.copy(p).add(new THREE.Vector3(0,.25,0));
      this.gyroStations.add(pole);
      const cap=new THREE.Mesh(new THREE.TorusGeometry(.16,.032,8,20),new THREE.MeshStandardMaterial({color:0xffc569,emissive:0x47340b}));
      cap.rotation.x=Math.PI/2;cap.position.copy(p).add(new THREE.Vector3(0,.5,0));this.gyroStations.add(cap);
    }
    // One connected, illustrative 3D project control diagram spanning both shores.
    this.gnssGroup=new THREE.Group();this.scene.add(this.gnssGroup);
    this.gnssStations=[];
    const controls=[[-9,3.0,-.25],[-7.2,3.5,-.6],[-5.7,2.95,-.1],[5.7,2.95,-.1],[7.2,3.5,-.6],[9,3.0,-.25]];
    const pts=controls.map(p=>new THREE.Vector3(...p));
    pts.forEach((p,i)=>{
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.17,16,10),new THREE.MeshStandardMaterial({color:i<3?0xffc570:0x6ae3d7,emissive:i<3?0x3b2700:0x0b3836}));
      mesh.position.copy(p);this.gnssGroup.add(mesh);this.gnssStations.push(mesh);
    });
    for(const [i,j] of [[0,1],[1,2],[3,4],[4,5],[2,3],[1,4],[0,5]]){
      this.gnssGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[i],pts[j]]),new THREE.LineBasicMaterial({color:0x76e9e1,transparent:true,opacity:.70})));
    }
    this.satellites=[];this.signalLines=[];
    for(const [x,z] of [[-6.4,.4],[0,-.4],[6.4,.5]]){
      const s=new THREE.Mesh(new THREE.OctahedronGeometry(.28),new THREE.MeshStandardMaterial({color:0xbef4ff,emissive:0x164b5b}));
      s.position.set(x,6.2,z);this.gnssGroup.add(s);this.satellites.push(s);
      for(const idx of [1,2,3,4]){
        const geom=new THREE.BufferGeometry().setFromPoints([s.position,pts[idx]]);
        const link=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0x87dff1,transparent:true,opacity:.24}));
        this.gnssGroup.add(link);this.signalLines.push(link);
      }
    }
    // Illustrative vertical datum planes: height frame is a separate operation from GNSS.
    this.heightGroup=new THREE.Group();this.scene.add(this.heightGroup);
    this.heightPlanes=[];
    for(const [x,color] of [[-7.4,0xffc570],[7.4,0x6ae3d7]]){
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(4,.032),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.95}));
      plane.position.set(x,2.0,1.9);this.heightGroup.add(plane);this.heightPlanes.push(plane);
    }
    this.tbms=[0xffb652,0x6ae3d7].map((color,i)=>{
      const group=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.78,24),new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.32}));
      body.rotation.z=Math.PI/2;group.add(body);
      for(let k=0;k<3;k++){
        const band=new THREE.Mesh(new THREE.TorusGeometry(.29,.035,8,22),new THREE.MeshStandardMaterial({color:0xe8eeef,metalness:.7,roughness:.3}));
        band.rotation.y=Math.PI/2;band.position.x=-.23+k*.22;group.add(band);
      }
      const face=new THREE.Group();face.position.x=i===0?.42:-.42;
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.08,28),new THREE.MeshStandardMaterial({color:0xe6eef2,metalness:.6,roughness:.35}));
      disc.rotation.z=Math.PI/2;face.add(disc);
      for(let k=0;k<6;k++){
        const tooth=new THREE.Mesh(new THREE.BoxGeometry(.09,.48,.05),new THREE.MeshStandardMaterial({color:0x334a60,metalness:.7,roughness:.4}));
        tooth.rotation.x=k*Math.PI/3;tooth.position.x=i===0?.05:-.05;face.add(tooth);
      }
      group.add(face);group.userData.cutter=face;
      // Dust particles at excavation face (not historical or geophysical data).
      const dust=new THREE.Group();group.add(dust);
      for(let k=0;k<12;k++){
        const p=new THREE.Mesh(new THREE.IcosahedronGeometry(.025+(.01*(k%3)),0),new THREE.MeshBasicMaterial({color:0xe4cbaa,transparent:true,opacity:.6}));
        const theta=k*Math.PI*(2/(Math.sqrt(5)+1));p.position.set(i===0?.55:-.55,.1*Math.cos(theta),.16*Math.sin(theta));dust.add(p);
      }
      group.userData.dust=dust;
      this.scene.add(group);return group;
    });
    this.mode='overview';this.phase='digging';this.progress=0;this.elapsed=0;this.surveyRequested=true;this.gyroEnabled=true;this.geoidOffset=0;
    this.renderer.domElement.addEventListener('keydown',event=>{
      if(event.key==='Home'){event.preventDefault();this.setCameraMode('overview');this.reset();return;}
      if(this.mode==='follow')return;
      const sph=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      if(event.key==='ArrowLeft')sph.theta-=.15;
      else if(event.key==='ArrowRight')sph.theta+=.15;
      else if(event.key==='ArrowUp')sph.phi=Math.max(.2,sph.phi-.1);
      else if(event.key==='ArrowDown')sph.phi=Math.min(Math.PI*.74,sph.phi+.1);
      else if(['+','='].includes(event.key))sph.radius=Math.max(6,sph.radius/1.1);
      else if(event.key==='-')sph.radius=Math.min(85,sph.radius*1.1);
      else return;
      event.preventDefault();this.camera.position.setFromSpherical(sph).add(this.controls.target);this.controls.update();this.render();
    });
    this.controls.addEventListener('change',()=>this.render());
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    this.reset();this.setProgress(0);this.setPhase('digging');
  }
  // Growing lined galleries expose the construction progression in actual 3D, from both shores.
  rebuildDrives() {
    for(const drive of this.driveMeshes){
      const progress=this.progress;
      const effective=drive.bore===1?progress:Math.max(0,(progress-.16)/.84);
      const extent=effective*.48;
      if(Math.abs(extent-drive.last)<.005)continue; // do not churn GPU geometry per frame
      drive.last=extent;
      for(const child of [...drive.holder.children]){drive.holder.remove(child);child.geometry?.dispose();child.material?.dispose();}
      if(extent<.005)continue;
      const curve=this.curves[drive.bore], a=drive.side===0?0:1-extent,b=drive.side===0?extent:1;
      const points=Array.from({length:Math.max(8,Math.ceil(extent*120))},(_,i)=>curve.getPoint(a+(b-a)*i/(Math.max(8,Math.ceil(extent*120))-1)));
      const section=new THREE.CatmullRomCurve3(points);
      const tunnel=new THREE.Mesh(new THREE.TubeGeometry(section,Math.max(14,Math.round(extent*100)),drive.bore===1?.35:.42,12,false),
        new THREE.MeshStandardMaterial({color:drive.bore===1?0xa8bac6:0x819ca8,metalness:.2,roughness:.75,transparent:true,opacity:.77,side:THREE.DoubleSide}));
      drive.holder.add(tunnel);
      const dark=new THREE.Mesh(new THREE.TubeGeometry(section,Math.max(14,Math.round(extent*100)),drive.bore===1?.27:.34,10,false),
        new THREE.MeshStandardMaterial({color:0x162e3d,metalness:.05,roughness:.94,side:THREE.DoubleSide,transparent:true,opacity:.96}));
      drive.holder.add(dark);
      // Distinct segmented lining rings reveal what has been dug (illustrative scale).
      for(let k=0;k<Math.ceil(extent*25);k++){
        const t=a+(b-a)*k/Math.max(1,Math.ceil(extent*25));
        const p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
        const ring=new THREE.Mesh(new THREE.TorusGeometry(drive.bore===1?.36:.43,.024,8,22),
          new THREE.MeshStandardMaterial({color:0xc8d2d3,metalness:.23,roughness:.65}));
        ring.position.copy(p);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);
        drive.holder.add(ring);
      }
    }
  }
  setPhase(phase){
    this.phase=phase;
    const surface=phase==='control'||phase==='heights';
    this.gnssGroup.visible=surface;this.heightGroup.visible=phase==='heights'||phase==='control';
    // Never depict excavation during the earlier surface-control campaign.
    this.tunnelGroup.visible=!surface;
    this.surveyGroup.visible=this.surveyRequested && !surface;
    this.gyroStations.visible=this.gyroEnabled;
    this.tbms.forEach(m=>m.visible=!surface);
    if(this.mode==='overview')this.reset();
    if(this.mode==='survey')this.surveyCamera();
    this.render();
  }
  setGeoidOffset(value) {
    this.geoidOffset=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));
    this.heightPlanes[1].position.y=2+this.geoidOffset*.8;this.render();
  }
  setGyroEnabled(v){this.gyroEnabled=!!v;this.gyroStations.visible=this.gyroEnabled;this.render();}
  setSurveyVisible(show){this.surveyRequested=Boolean(show);this.setPhase(this.phase);}
  setProgress(p) {
    this.progress=Math.max(0,Math.min(1,Number.isFinite(p)?p:0));
    const curve=this.curves[1];
    [this.progress*.48,1-this.progress*.48].forEach((t,i)=>{
      const tbm=this.tbms[i];tbm.position.copy(curve.getPoint(t));tbm.rotation.y=i?Math.PI:0;
    });
    this.rebuildDrives();
    const reach=this.progress*.48;
    this.surveyMarkers.forEach((m,i)=>{const t=i/12;m.visible=this.progress>=1||t<=reach+1e-7||t>=1-reach-1e-7;});
    this.surveyLegs.forEach((l,i)=>{l.visible=this.surveyMarkers[i].visible&&this.surveyMarkers[i+1].visible;});
    this.totalStations.forEach(station=>{station.visible=this.surveyMarkers[station.userData.stationIndex].visible;});
    if(this.mode==='follow')this.followCamera();
    if(this.mode==='survey')this.surveyCamera();
    this.render();
  }
  tick(dt) {
    this.elapsed+=Math.min(dt,100);
    for(const [i,tbm] of this.tbms.entries()){
      tbm.userData.cutter.rotation.x+=(i?-.028:.028)*Math.min(dt,60);
      tbm.userData.dust.children.forEach((p,k)=>{p.position.y=Math.sin(this.elapsed*.004+k*1.2)*.10;p.position.z=Math.cos(this.elapsed*.006+k)*.18;});
    }
    for(const [i,s] of this.satellites.entries()){s.rotation.y+=dt*.0003;s.position.y=6.2+.12*Math.sin(this.elapsed*.001+i);}
    if(this.mode==='follow')this.followCamera();
    if(this.mode==='survey')this.surveyCamera();
    this.render();
  }
  setCameraMode(mode) {
    this.mode=['overview','follow','survey'].includes(mode)?mode:'overview';
    this.controls.enabled=this.mode==='overview';
    if(this.mode==='overview')this.reset();
    else if(this.mode==='survey')this.surveyCamera();
    else this.followCamera();
    this.render();
  }
  surveyCamera(){
    // Inside-gallery, third-person surveying perspective. Illustrative scale.
    const visible=this.totalStations.filter(station=>station.visible);
    const station=visible.find(s=>s.userData.stationIndex===2)||visible[0]||this.totalStations[0];
    const target=station.position.clone().add(new THREE.Vector3(0,.58,0));
    this.camera.position.copy(target).add(new THREE.Vector3(-1.30,.68,2.05));
    this.camera.lookAt(target.clone().add(new THREE.Vector3(.55,0,0)));
    this.camera.updateMatrixWorld();
  }
  followCamera(){
    // Third-person chase shot above / behind UK-side representative service-tunnel machine.
    const t=this.progress*.48,pt=this.curves[1].getPoint(t),look=this.curves[1].getPoint(Math.min(.98,t+.11));
    this.camera.position.set(pt.x-3.2,pt.y+2.25,pt.z+4.6);
    this.camera.lookAt(look);this.camera.updateMatrixWorld();
  }
  reset(){
    this.controls.target.set(0,-.65,0);
    const direction=new THREE.Vector3(.18,.18,1).normalize();
    // In underground scenes, hidden GNSS satellites must not force excessive zoom-out on phones.
    const isSurface=this.phase==='control'||this.phase==='heights';
    const upperY=isSurface?6.7:1.6,lowerY=isSurface?-4.2:-2.8;
    // Underground camera prioritises the bores and TBM rather than the entire cliff block.
    const bounds=[];for(const x of [-10.5,10.5])for(const y of [lowerY,upperY])for(const z of [-3.0,2.7])bounds.push(new THREE.Vector3(x,y,z));
    let lo=8,hi=92;
    this.camera.aspect=this.host.clientWidth&&this.host.clientHeight?this.host.clientWidth/this.host.clientHeight:1;
    this.camera.updateProjectionMatrix();
    for(let i=0;i<20;i++){const dist=(lo+hi)/2;this.camera.position.copy(this.controls.target).addScaledVector(direction,dist);this.camera.lookAt(this.controls.target);this.camera.updateMatrixWorld();
      if(bounds.every(p=>{const q=p.clone().project(this.camera);return Math.abs(q.x)<.91&&Math.abs(q.y)<.88&&q.z<1;}))hi=dist;else lo=dist;
    }
    this.camera.position.copy(this.controls.target).addScaledVector(direction,hi);this.controls.update();this.render();
  }
  resize(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const change=Math.abs(this.camera.aspect-w/h)>.12;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
    if(this.mode==='follow')this.followCamera();else if(this.mode==='survey')this.surveyCamera();else if(change||!this.sized){this.sized=true;this.reset();}
    this.render();
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
