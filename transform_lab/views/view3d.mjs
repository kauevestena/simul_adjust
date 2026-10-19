// 3D view in the total-station frame: right-handed, Z up (the same triad as three.js, so
// nothing is mirrored or swapped). Shows the instrument, the lines of sight, the sheet, the
// points by role and the covariance ellipsoids of the TS points (long axis = line of sight).
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { theme } from '../ui.mjs';
import { eigSym, rightHanded } from '../core/linalg.mjs';

export class StationView {
  constructor(container, onFail) {
    this.container = container; this.ok = false; this.opts = { ellipsoids: true, lines: false, scale: 20 };
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { onFail?.(e); return; }
    this.ok = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.001, 1000);
    this.camera.up.set(0, 0, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => this.render());
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(1, -2, 3); this.scene.add(sun);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    if (!this.ok) return;
    const w = Math.max(200, this.container.clientWidth), h = Math.max(240, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`; this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.render();
  }

  setOptions(o) { Object.assign(this.opts, o); if (this.data) this.rebuild(); }

  setData(dataset, result) { this.data = { dataset, result }; this.rebuild(true); }

  rebuild(refit = false) {
    if (!this.ok) return;
    const { dataset, result } = this.data, th = theme();
    this.group.clear();
    if (!result.ok) { this.render(); return; }
    const col = { control: th.control, check: th.check, uncollected: th.uncollected, tsOnly: th.tsOnly };
    const covByName = new Map(dataset.ts.map(q => [q.name, q.cov]));
    const pos = p => p.tsObs || p.tsPred;
    const P = result.points.filter(p => pos(p));
    const sheet = result.res.layout, X = result.res.X;
    const rx = dataset.ref.map(r => r.x), ry = dataset.ref.map(r => r.y);
    const corners = [[Math.min(...rx), Math.min(...ry)], [Math.max(...rx), Math.min(...ry)], [Math.max(...rx), Math.max(...ry)], [Math.min(...rx), Math.max(...ry)]]
      .map(([x, y]) => sheet.apply(X, [x * result.pre, y * result.pre, 0]));
    const centre = [0, 1, 2].map(i => corners.reduce((a, c) => a + c[i], 0) / 4);
    const extent = Math.max(...corners.map(c => Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]))) || 1;
    this.centre = new THREE.Vector3(...centre); this.extent = extent;
    const v = a => new THREE.Vector3(a[0], a[1], a[2]);
    const mat = c => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.55 });

    // sheet outline
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners.map(v)), new THREE.LineBasicMaterial({ color: new THREE.Color(th.muted) }));
    this.group.add(frame);

    // instrument at the origin and the axes of the frame
    const inst = new THREE.Mesh(new THREE.OctahedronGeometry(extent * 0.03), mat(th.ink)); this.group.add(inst);
    [[1, 0, 0, 0xd94a4a], [0, 1, 0, 0x2a9d5b], [0, 0, 1, 0x3b6fd6]].forEach(([x, y, z, c]) => this.group.add(new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0), extent * 0.25, c, extent * 0.05, extent * 0.025)));

    const r = extent * 0.018;
    P.forEach(p => {
      const c = pos(p);
      let mesh;
      if (p.role === 'control') mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat(col.control));
      else if (p.role === 'check') mesh = new THREE.Mesh(new THREE.OctahedronGeometry(r * 1.2), mat(col.check));
      else if (p.role === 'uncollected') mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col.uncollected), wireframe: true }));
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), mat(col.tsOnly));
      mesh.position.copy(v(c)); this.group.add(mesh);
      if (this.opts.lines && p.tsObs) this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), v(c)]), new THREE.LineBasicMaterial({ color: new THREE.Color(th.grid), transparent: true, opacity: 0.6 })));
      const cov = covByName.get(p.name);
      if (this.opts.ellipsoids && cov && p.tsObs) {
        const { values, vectors } = eigSym(cov), Rm = rightHanded(vectors);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(col[p.role]), transparent: true, opacity: 0.28, depthWrite: false }));
        const M = new THREE.Matrix4(); M.set(Rm[0][0], Rm[0][1], Rm[0][2], 0, Rm[1][0], Rm[1][1], Rm[1][2], 0, Rm[2][0], Rm[2][1], Rm[2][2], 0, 0, 0, 0, 1);
        m.quaternion.setFromRotationMatrix(M);
        m.scale.set(...values.map(x => Math.sqrt(Math.max(x, 0)) * this.opts.scale));
        m.position.copy(v(c)); this.group.add(m);
      }
    });
    if (refit) this.fit('sheet'); else this.render();
  }

  fit(mode = 'sheet') {
    if (!this.ok || !this.centre) return;
    const target = mode === 'scene' ? this.centre.clone().multiplyScalar(0.5) : this.centre.clone();
    const radius = mode === 'scene' ? this.centre.length() / 2 + this.extent : this.extent;
    const dist = radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.05;
    // look at the sheet from the instrument side, slightly above
    const dir = this.centre.clone().normalize().multiplyScalar(-1);
    const eye = target.clone().add(dir.multiplyScalar(-dist * 0.9)).add(new THREE.Vector3(0, 0, dist * 0.25));
    this.camera.position.copy(eye); this.controls.target.copy(target);
    this.camera.near = dist / 1000; this.camera.far = dist * 100; this.camera.updateProjectionMatrix();
    this.controls.update(); this.render();
  }

  render() { if (this.ok) this.renderer.render(this.scene, this.camera); }
}
