// Split 3D view: one WebGL renderer, two scenes, one shared camera (so both halves orbit together).
// Left: ENU cloud (rigid transform of ECEF). Right: R(θ)·ENU + exaggeration · (UTM − R(θ)·ENU).
import * as THREE from '../camera_proj/vendor/three.module.min.js';
import { OrbitControls } from '../camera_proj/vendor/OrbitControls.js';

const VERT = (withDisp) => `
attribute vec3 aColor;
${withDisp ? 'attribute vec3 disp;\nuniform float uExag;' : ''}
uniform float uSize;
varying vec3 vColor;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  ${withDisp ? 'world.xyz += uExag * disp;' : ''}
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_PointSize = uSize;
  vColor = aColor;
}`;
const FRAG = `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vColor, 1.0);
}`;
const BG = new THREE.Color('#111517');

function pointsMaterial(withDisp) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT(withDisp), fragmentShader: FRAG,
    uniforms: { uSize: { value: 2 }, ...(withDisp ? { uExag: { value: 100 } } : {}) },
  });
}

export class SplitViewer {
  constructor(container, { onFail } = {}) {
    this.container = container;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    } catch (error) {
      onFail?.(error);
      return;
    }
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(BG);
    this.renderer.domElement.className = 'split-canvas';
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e6);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.requestDraw());
    this.scenes = [new THREE.Scene(), new THREE.Scene()];
    this.leftMat = pointsMaterial(false);
    this.rightMat = pointsMaterial(true);
    this.groups = this.scenes.map(s => { const g = new THREE.Group(); s.add(g); return g; });
    this.axes = this.scenes.map(s => { const a = new THREE.AxesHelper(1); s.add(a); return a; });
    this.outlineMat = new THREE.LineBasicMaterial({ color: '#f2eee3', transparent: true, opacity: 0.55 });
    this.state = { exaggeration: 100, size: 2, outline: true, theta: 0, span: 2000 };
    this.stacked = false;
    this.labels = [...container.querySelectorAll('[data-axis]')];
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  get ok() { return Boolean(this.renderer); }

  /** data: { enu Float32Array(3n), disp Float32Array(3n), leftColors/rightColors Uint8Array(3n), theta, span, outlines (Float32Array of segment endpoints, ENU) } */
  setData({ enu, disp, leftColors, rightColors, theta, spanWE, spanNS, outlines, frame = false }) {
    if (!this.ok) return;
    for (const g of this.groups) for (const child of [...g.children]) { child.geometry?.dispose(); g.remove(child); }
    const position = new THREE.BufferAttribute(enu, 3);
    const left = new THREE.BufferGeometry();
    left.setAttribute('position', position);
    left.setAttribute('aColor', new THREE.BufferAttribute(leftColors, 3, true));
    const right = new THREE.BufferGeometry();
    right.setAttribute('position', position);
    right.setAttribute('disp', new THREE.BufferAttribute(disp, 3));
    this.rightColor = new THREE.BufferAttribute(rightColors, 3, true);
    right.setAttribute('aColor', this.rightColor);
    const pl = new THREE.Points(left, this.leftMat), pr = new THREE.Points(right, this.rightMat);
    pl.frustumCulled = pr.frustumCulled = false;
    this.groups[0].add(pl);
    this.groups[1].add(pr);
    // true (undistorted) cube outlines in both views
    const ol = new THREE.BufferGeometry();
    ol.setAttribute('position', new THREE.BufferAttribute(outlines, 3));
    this.outlines = [new THREE.LineSegments(ol, this.outlineMat), new THREE.LineSegments(ol, this.outlineMat)];
    this.outlines.forEach((o, i) => { o.visible = this.state.outline; this.groups[i].add(o); });
    // right view: rigid rotation by θ (true east -> grid), so the rotation is not counted as distortion
    this.groups[1].rotation.set(0, 0, theta);
    this.state.theta = theta;
    const span = Math.max(spanWE, spanNS);
    this.axes.forEach(a => a.scale.setScalar(span * 0.12));
    if (frame || !this.framed || Math.abs(span / this.state.span - 1) > 0.01) this.frame(spanWE, spanNS);
    this.state.span = span;
    this.requestDraw();
  }

  updateRightColors(colors) {
    if (!this.rightColor) return;
    this.rightColor.array.set(colors);
    this.rightColor.needsUpdate = true;
    this.requestDraw();
  }
  setExaggeration(f) { this.state.exaggeration = f; this.rightMat.uniforms.uExag.value = f; this.requestDraw(); }
  setPointSize(px) { this.state.size = px; this.requestDraw(); }
  setOutline(on) { this.state.outline = on; (this.outlines || []).forEach(o => { o.visible = on; }); this.requestDraw(); }

  frame(spanWE = this.state.span, spanNS = this.state.span) {
    if (!this.ok) return;
    const span = Math.max(spanWE, spanNS);
    const d = span * 0.95 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (this.stacked ? 0.8 : 0.65);
    const az = THREE.MathUtils.degToRad(-28), el = THREE.MathUtils.degToRad(38);
    this.controls.target.set(0, 0, span * 0.01);
    this.camera.position.set(d * Math.cos(el) * Math.sin(az), -d * Math.cos(el) * Math.cos(az), d * Math.sin(el));
    this.controls.update();
    this.framed = true;
    this.requestDraw();
  }

  resize() {
    if (!this.ok) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    const stacked = w < 640;
    if (stacked !== this.stacked) { this.stacked = stacked; this.container.classList.toggle('stacked', stacked); }
    this.requestDraw();
  }

  /** Viewport rectangles in CSS pixels (top-left origin): [left/top view, right/bottom view]. */
  rects() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return this.stacked
      ? [{ x: 0, y: 0, w, h: Math.floor(h / 2) }, { x: 0, y: Math.floor(h / 2), w, h: h - Math.floor(h / 2) }]
      : [{ x: 0, y: 0, w: Math.floor(w / 2), h }, { x: Math.floor(w / 2), y: 0, w: w - Math.floor(w / 2), h }];
  }

  requestDraw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.draw(); });
  }

  draw() {
    if (!this.ok) return;
    const H = this.container.clientHeight;
    if (!H) return;
    const dpr = this.renderer.getPixelRatio();
    this.leftMat.uniforms.uSize.value = this.state.size * dpr;
    this.rightMat.uniforms.uSize.value = this.state.size * dpr;
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.camera.near = Math.max(0.05, dist / 2000);
    this.camera.far = dist * 20 + this.state.span * 10;
    const rects = this.rects();
    this.camera.aspect = rects[0].w / rects[0].h;
    this.camera.updateProjectionMatrix();
    this.renderer.setScissorTest(true);
    rects.forEach((r, i) => {
      const y = H - r.y - r.h;
      this.renderer.setViewport(r.x, y, r.w, r.h);
      this.renderer.setScissor(r.x, y, r.w, r.h);
      this.renderer.render(this.scenes[i], this.camera);
    });
    this.renderer.setScissorTest(false);
    this.placeLabels(rects);
    this.drawCount = (this.drawCount || 0) + 1;
  }

  placeLabels(rects) {
    const L = this.state.span * 0.12 * 1.12;
    for (const el of this.labels) {
      const view = Number(el.dataset.view), axis = el.dataset.axis;
      // right-view axes are the UTM grid axes (the cloud group carries the θ rotation)
      const v = new THREE.Vector3(axis === 'x' ? L : 0, axis === 'y' ? L : 0, axis === 'z' ? L : 0);
      v.project(this.camera);
      const r = rects[view];
      el.hidden = v.z > 1 || v.z < -1;
      el.style.left = `${r.x + (v.x + 1) / 2 * r.w}px`;
      el.style.top = `${r.y + (1 - v.y) / 2 * r.h}px`;
    }
  }

  cameraState() {
    return { position: this.camera?.position.toArray(), target: this.controls?.target.toArray() };
  }
}
