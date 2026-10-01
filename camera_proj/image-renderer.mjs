import * as THREE from "./vendor/three.module.min.js";
import * as M from "./model.mjs";

// Inverse-map every image sample, then intersect the opaque cube. This preserves
// curved distorted edges and occlusion, unlike moving only the projected vertices.
const fragmentShader = `
precision highp float;
varying vec2 st;
uniform vec2 size, focal, principal;
uniform vec3 origin;
uniform mat3 directionMatrix;
uniform float halfSide, physical;
uniform vec3 radial;
uniform vec2 tangential;
uniform vec3 colors[6];
vec2 warp(vec2 p) {
  float r2=dot(p,p),a=1.0+r2*(radial.x+r2*(radial.y+r2*radial.z));
  return p*a+vec2(2.0*tangential.x*p.x*p.y+tangential.y*(r2+2.0*p.x*p.x),tangential.x*(r2+2.0*p.y*p.y)+2.0*tangential.y*p.x*p.y);
}
vec4 jac(vec2 p) {
  float r2=dot(p,p),a=1.0+r2*(radial.x+r2*(radial.y+r2*radial.z));
  float g=2.0*(radial.x+2.0*radial.y*r2+3.0*radial.z*r2*r2);
  float b=g*p.x*p.y+2.0*tangential.x*p.x+2.0*tangential.y*p.y;
  return vec4(a+g*p.x*p.x+2.0*tangential.x*p.y+6.0*tangential.y*p.x,b,b,a+g*p.y*p.y+6.0*tangential.x*p.y+2.0*tangential.y*p.x);
}
void main() {
  vec3 bg=vec3(0.047,0.071,0.086);
  vec2 uv=vec2(st.x,1.0-st.y)*size-0.5;
  if(physical>0.5)uv=size-1.0-uv;
  vec2 target=(uv-principal)/focal,p=target;
  bool valid=true;
  for(int i=0;i<20;i++) {
    vec2 e=warp(p)-target;vec4 j=jac(p);float det=j.x*j.w-j.y*j.z;
    if(det<=1.0e-10 || length(p)>1.0e4){valid=false;break;}
    if(length(e)<1.0e-7)break;
    p-=vec2(j.w*e.x-j.y*e.y,-j.z*e.x+j.x*e.y)/det;
  }
  if(!valid || length(warp(p)-target)>1.0e-5){gl_FragColor=vec4(bg,1.0);return;}
  vec3 d=directionMatrix*vec3(p,1.0);
  float lo=-1.0e20,hi=1.0e20;int enterFace=0,exitFace=0;
  bool hit=true;
  for(int a=0;a<3;a++) {
    if(abs(d[a])<1.0e-10){if(abs(origin[a])>halfSide)hit=false;}
    else {
      float t1=(-halfSide-origin[a])/d[a],t2=(halfSide-origin[a])/d[a];
      int f1=2*a+1,f2=2*a;
      if(t1>t2){float tt=t1;t1=t2;t2=tt;int ff=f1;f1=f2;f2=ff;}
      if(t1>lo){lo=t1;enterFace=f1;}if(t2<hi){hi=t2;exitFace=f2;}
    }
  }
  int face=lo>1.0e-8?enterFace:exitFace;
  if(!hit||lo>hi||hi<=1.0e-8)gl_FragColor=vec4(bg,1.0);
  else {vec3 color=colors[0];for(int a=0;a<6;a++)if(a==face)color=colors[a];gl_FragColor=vec4(color,1.0);}
}`;

export class ImageRenderer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(1);
    this.canvas = this.renderer.domElement;
    this.canvas.id = "formed-image";
    this.canvas.setAttribute("aria-hidden", "true");
    container.prepend(this.canvas);
    this.uniforms = {
      size: { value: new THREE.Vector2() },
      focal: { value: new THREE.Vector2() },
      principal: { value: new THREE.Vector2() },
      origin: { value: new THREE.Vector3() },
      directionMatrix: { value: new THREE.Matrix3() },
      halfSide: { value: 0.5 },
      physical: { value: 1 },
      radial: { value: new THREE.Vector3() },
      tangential: { value: new THREE.Vector2() },
      colors: {
        value: M.FACE_COLORS.map(
          (c) =>
            new THREE.Vector3(
              ...[1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255),
            ),
        ),
      },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      fragmentShader,
      vertexShader:
        "varying vec2 st; void main(){st=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(
      new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material),
    );
    this.camera = new THREE.Camera();
  }
  render(s) {
    const k = M.intrinsics(s),
      u = this.uniforms,
      d = M.coefficients(s),
      inv = M.transpose(M.quaternionMatrix(s.cubeQ));
    u.size.value.set(k.width, k.height);
    u.focal.value.set(k.fx, k.fy);
    u.principal.value.set(k.cx, k.cy);
    u.origin.value.fromArray(M.mv(inv, M.sub(s.center, s.cubeCenter)));
    u.directionMatrix.value.set(...M.mm(inv, M.quaternionMatrix(s.q)));
    u.halfSide.value = s.side / 2;
    u.physical.value = s.plane === "physical" ? 1 : 0;
    u.radial.value.set(d[0], d[1], d[4]);
    u.tangential.value.set(d[2], d[3]);
    const w =
      s.sampling === "pixels"
        ? k.width
        : Math.max(
            700,
            Math.min(
              1800,
              Math.round(
                this.container.clientWidth * (window.devicePixelRatio || 1) * 2,
              ),
            ),
          );
    this.renderer.setSize(
      w,
      Math.max(1, Math.round((w * k.height) / k.width)),
      false,
    );
    this.container.style.aspectRatio = `${k.width} / ${k.height}`;
    this.canvas.style.imageRendering =
      s.sampling === "pixels" ? "pixelated" : "auto";
    this.renderer.render(this.scene, this.camera);
  }
}
