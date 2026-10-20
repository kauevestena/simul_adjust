// 3D view in the total-station frame: right-handed, Z up (the same triad as three.js, so
// nothing is mirrored or swapped). Shows the instrument, the lines of sight, the sheet, the
// points by role and the covariance ellipsoids of the TS points (long axis = line of sight).
// After an adjustment it can also show the plane fitted to the sheet points and the deviation
// of every point from it (exaggerated, coloured by side); before one, only the observed points.
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { theme } from '../ui.mjs';
import { eigSym, rightHanded } from '../core/linalg.mjs';

export class StationView {
  constructor(container, onFail) {
    this.container = container; this.ok = false;
    this.opts = { ellipsoids: true, lines: false, scale: 20, plane: true, deviations: true, devScale: 40 };
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

  // extra: { flagged: Set of names, excluded: { name: true } }
  setData(dataset, result, extra = {}) {
    const refit = !this.data || this.data.dataset !== dataset || !!this.data.result?.ok !== !!result?.ok;
    this.data = { dataset, result, flagged: extra.flagged || new Set(), excluded: extra.excluded || {} };
    this.rebuild(refit);
  }

  rebuild(refit = false) {
    if (!this.ok) return;
    const { dataset, result, flagged, excluded } = this.data, th = theme();
    this.group.clear();
    const ok = !!result?.ok;
    const col = { control: th.control, check: th.check, uncollected: th.uncollected, tsOnly: th.tsOnly, excluded: th.excluded, observed: th.muted };
    const covByName = new Map(dataset.ts.map(q => [q.name, q.cov]));
    const pos = p => p.tsObs || p.tsPred;
    const P = ok ? result.points.filter(p => pos(p)) : dataset.ts.map(q => ({ name: q.name, role: excluded[q.name] ? 'excluded' : 'observed', tsObs: q.xyz }));
    if (!P.length) { this.render(); return; }
    const v = a => new THREE.Vector3(a[0], a[1], a[2]);
    const mat = c => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.55 });

    // extent: the adjusted sheet outline, or the observed points
    let centre, extent;
    if (ok) {
      const sheet = result.res.layout, X = result.res.X;
      const rx = dataset.ref.map(r => r.x), ry = dataset.ref.map(r => r.y);
      const corners = [[Math.min(...rx), Math.min(...ry)], [Math.max(...rx), Math.min(...ry)], [Math.max(...rx), Math.max(...ry)], [Math.min(...rx), Math.max(...ry)]]
        .map(([x, y]) => sheet.apply(X, [x * result.pre, y * result.pre, 0]));
      centre = [0, 1, 2].map(i => corners.reduce((a, c) => a + c[i], 0) / 4);
      extent = Math.max(...corners.map(c => Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]))) || 1;
      this.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners.map(v)), new THREE.LineBasicMaterial({ color: new THREE.Color(th.muted) })));
    } else {
      const xyz = P.map(pos);
      centre = [0, 1, 2].map(i => xyz.reduce((a, c) => a + c[i], 0) / xyz.length);
      extent = Math.max(...xyz.map(c => Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]))) || 1;
    }
    this.centre = new THREE.Vector3(...centre); this.extent = extent;

    // instrument at the origin and the axes of the frame
    this.group.add(new THREE.Mesh(new THREE.OctahedronGeometry(extent * 0.03), mat(th.ink)));
    [[1, 0, 0, 0xd94a4a], [0, 1, 0, 0x2a9d5b], [0, 0, 1, 0x3b6fd6]].forEach(([x, y, z, c]) => this.group.add(new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0), extent * 0.25, c, extent * 0.05, extent * 0.025)));

    // plane fitted to the sheet points, and the deviation of each point from it
    const plane = ok ? result.plane : null;
    if (plane?.ok) {
      const n = plane.n, { right, up } = plane.frame, c0 = plane.centroid;
      const uv = [...plane.points, ...(plane.others || [])].map(q => q.uv);
      const pad = 0.06 * extent;
      const u0 = Math.min(...uv.map(a => a[0])) - pad, u1 = Math.max(...uv.map(a => a[0])) + pad, v0 = Math.min(...uv.map(a => a[1])) - pad, v1 = Math.max(...uv.map(a => a[1])) + pad;
      const at = (a, b) => [0, 1, 2].map(i => c0[i] + a * right[i] + b * up[i]);
      if (this.opts.plane) {
        const quad = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)].map(v);
        const g = new THREE.BufferGeometry().setFromPoints([quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]]);
        g.computeVertexNormals();
        this.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(th.plane), transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })));
        this.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(quad), new THREE.LineBasicMaterial({ color: new THREE.Color(th.plane) })));
      }
      if (this.opts.deviations) {
        const k = this.opts.devScale;
        const segs = { pos: [], neg: [] };
        [...plane.points, ...(plane.others || [])].forEach(q => {
          const foot = q.xyz.map((x, i) => x - q.d * n[i]), tip = foot.map((x, i) => x + k * q.d * n[i]);
          (q.d >= 0 ? segs.pos : segs.neg).push(v(foot), v(tip));
        });
        for (const [key, pts] of Object.entries(segs)) if (pts.length) this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(th[key]) })));
      }
    }

    const r = extent * 0.018;
    P.forEach(p => {
      const c = pos(p);
      let mesh;
      if (p.role === 'control' || p.role === 'observed') mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat(col[p.role]));
      else if (p.role === 'check') mesh = new THREE.Mesh(new THREE.OctahedronGeometry(r * 1.2), mat(col.check));
      else if (p.role === 'excluded') mesh = new THREE.Mesh(new THREE.OctahedronGeometry(r * 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(col.excluded), wireframe: true }));
      else if (p.role === 'uncollected') mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col.uncollected), wireframe: true }));
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), mat(col.tsOnly));
      mesh.position.copy(v(c)); this.group.add(mesh);
      if (flagged.has(p.name)) {
        const ring = new THREE.Mesh(new THREE.SphereGeometry(r * 2.2, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.flag), wireframe: true }));
        ring.position.copy(v(c)); this.group.add(ring);
      }
      if (this.opts.lines && p.tsObs) this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), v(c)]), new THREE.LineBasicMaterial({ color: new THREE.Color(th.grid), transparent: true, opacity: 0.6 })));
      const cov = covByName.get(p.name);
      if (this.opts.ellipsoids && cov && p.tsObs) {
        const { values, vectors } = eigSym(cov), Rm = rightHanded(vectors);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.ellipsoid), transparent: true, opacity: 0.25, depthWrite: false }));
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
    // look at the sheet from the instrument side, obliquely and slightly above, so that both
    // the cigar-shaped ellipsoids and the deviations along the normal are seen at an angle
    const f = this.centre.clone().normalize().multiplyScalar(-1);          // sheet → instrument
    const side = new THREE.Vector3(0, 0, 1).cross(f);
    if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
    side.normalize();
    const eye = target.clone().add(f.multiplyScalar(0.75 * dist)).add(side.multiplyScalar(0.55 * dist)).add(new THREE.Vector3(0, 0, 0.3 * dist));
    this.camera.position.copy(eye); this.controls.target.copy(target);
    this.camera.near = dist / 1000; this.camera.far = dist * 100; this.camera.updateProjectionMatrix();
    this.controls.update(); this.render();
  }

  render() { if (this.ok) this.renderer.render(this.scene, this.camera); }
}
