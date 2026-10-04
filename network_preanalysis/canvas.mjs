import { errorEllipse } from './network/reliability.mjs';
import { t } from './i18n.mjs';

export class NetworkCanvas {
  constructor(canvas, getScene, onAction) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.getScene = getScene; this.onAction = onAction;
    this.center = [0, 0]; this.scale = 1; this.width = this.height = 1; this.drag = null; this.preview = null; this.terrain = null;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', () => { this.drag = this.preview = null; this.draw(); });
    canvas.addEventListener('wheel', e => {
      e.preventDefault(); const p = this.local(e), before = this.unproject(p);
      this.scale = Math.min(80, Math.max(.01, this.scale * Math.exp(-e.deltaY * .001)));
      const after = this.unproject(p); this.center[0] += before[0] - after[0]; this.center[1] += before[1] - after[1]; this.draw();
    }, { passive: false });
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.draw();
  }
  project(p) { return [this.width / 2 + (p.E - this.center[0]) * this.scale, this.height / 2 - (p.N - this.center[1]) * this.scale]; }
  unproject([x, y]) { return [this.center[0] + (x - this.width / 2) / this.scale, this.center[1] - (y - this.height / 2) / this.scale]; }
  local(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  fit() {
    const pts = this.getScene().network.points;
    if (!pts.length) { this.center = [0, 0]; this.scale = 1; this.draw(); return; }
    const es = pts.map(p => p.E), ns = pts.map(p => p.N), minE = Math.min(...es), maxE = Math.max(...es), minN = Math.min(...ns), maxN = Math.max(...ns);
    this.center = [(minE + maxE) / 2, (minN + maxN) / 2];
    this.scale = Math.max(.01, Math.min((this.width - 180) / Math.max(200, maxE - minE), (this.height - 190) / Math.max(150, maxN - minN)));
    this.draw();
  }
  pointAt(pos) {
    return this.getScene().network.points.find(p => { const q = this.project(p); return Math.hypot(q[0] - pos[0], q[1] - pos[1]) < 13; });
  }
  sightLine(s, pts) {
    const from = pts.find(p => p.id === s.from), to = pts.find(p => p.id === s.to);
    if (!from || !to) return null;
    const a = this.project(from), b = this.project(to), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1) return null;
    // Right-hand offset keeps reciprocal sights separately visible and selectable.
    return { a: [a[0] - dy / len * 4, a[1] + dx / len * 4], b: [b[0] - dy / len * 4, b[1] + dx / len * 4], dx: dx / len, dy: dy / len, len };
  }
  sightAt(pos) {
    const { network } = this.getScene(); let best = null, distance = 7;
    for (const s of network.sights) {
      const l = this.sightLine(s, network.points); if (!l) continue;
      const along = (pos[0] - l.a[0]) * l.dx + (pos[1] - l.a[1]) * l.dy;
      const d = Math.abs((pos[0] - l.a[0]) * l.dy - (pos[1] - l.a[1]) * l.dx);
      if (along > 12 && along < l.len - 12 && d < distance) { best = s; distance = d; }
    }
    return best;
  }
  down(e) {
    if (this.getScene().busy) return;
    this.canvas.focus(); this.canvas.setPointerCapture(e.pointerId);
    const pos = this.local(e), point = this.pointAt(pos), scene = this.getScene();
    this.drag = { start: pos, point, button: e.button, center: [...this.center], moved: false, tool: scene.tool };
    if (e.button === 0 && scene.tool === 'select' && point) this.onAction({ type: 'select', kind: 'point', id: point.id });
  }
  move(e) {
    const pos = this.local(e);
    if (!this.drag) { this.preview = { cursor: pos }; this.draw(); return; }
    const d = this.drag, dx = pos[0] - d.start[0], dy = pos[1] - d.start[1];
    d.moved ||= Math.hypot(dx, dy) > 3;
    if (d.button === 2) { this.center = [d.center[0] - dx / this.scale, d.center[1] + dy / this.scale]; }
    else if (d.tool === 'select' && d.point && d.moved) {
      const [E, N] = this.unproject(pos); this.preview = { point: { ...d.point, E, N }, cursor: pos };
    }
    this.draw();
  }
  up(e) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    const pos = this.local(e), point = this.pointAt(pos), sight = this.sightAt(pos), [E, N] = this.unproject(pos);
    if (d.button === 0) {
      if (d.tool === 'select' && d.point && d.moved) this.onAction({ type: 'move', id: d.point.id, E, N });
      else if (!d.moved) {
        if (d.tool === 'select') this.onAction({ type: 'select', kind: point ? 'point' : sight ? 'sight' : null, id: point?.id ?? sight?.id });
        else if (d.tool === 'delete') this.onAction({ type: 'delete', kind: point ? 'point' : 'sight', id: point?.id ?? sight?.id });
        else if (d.tool === 'sight') this.onAction({ type: 'sight', id: point?.id });
        else this.onAction({ type: 'add', pointType: d.tool, E, N });
      }
    }
    this.preview = null; this.draw();
  }
  arrow(a, b, color, width = 1.5, head = 7) {
    const c = this.ctx, angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
    c.beginPath(); c.moveTo(...b); c.lineTo(b[0] - head * Math.cos(angle - .5), b[1] - head * Math.sin(angle - .5));
    c.lineTo(b[0] - head * Math.cos(angle + .5), b[1] - head * Math.sin(angle + .5)); c.closePath(); c.fill();
  }
  draw() {
    const scene = this.getScene(); if (!scene) return;
    const { network, result, selected, view, source, effect, visibility } = scene, c = this.ctx;
    c.clearRect(0, 0, this.width, this.height); c.fillStyle = '#f0f5f5'; c.fillRect(0, 0, this.width, this.height);
    if (this.terrain && network.level === 1 && view.terrain) {
      const [e0, n0, e1, n1] = this.terrain.bounds, a = this.project({ E: e0, N: n1 }), b = this.project({ E: e1, N: n0 });
      c.globalAlpha = .8; c.drawImage(this.terrain.image, a[0], a[1], b[0] - a[0], b[1] - a[1]); c.globalAlpha = 1;
    }
    // Metric grid, independent of device pixels and geographic projection.
    const raw = 80 / this.scale, power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].find(x => x * power >= raw) * power;
    const lo = this.unproject([0, this.height]), hi = this.unproject([this.width, 0]);
    c.strokeStyle = '#cfdddf88'; c.lineWidth = 1;
    c.beginPath();
    for (let e = Math.ceil(lo[0] / step) * step; e < hi[0]; e += step) { const [x] = this.project({ E: e, N: 0 }); c.moveTo(x, 0); c.lineTo(x, this.height); }
    for (let n = Math.ceil(lo[1] / step) * step; n < hi[1]; n += step) { const [, y] = this.project({ E: 0, N: n }); c.moveTo(0, y); c.lineTo(this.width, y); }
    c.stroke();
    const pts = network.points.map(p => this.preview?.point?.id === p.id ? this.preview.point : p);
    const bad = new Set((result?.invalidSights ?? []).map(s => s.id));
    for (const s of network.sights) {
      const line = this.sightLine(s, pts); if (!line) continue;
      let color = s.active === false ? '#aebcc0' : bad.has(s.id) ? '#bd5c44' : '#669697';
      if (view.redundancy && !bad.has(s.id)) {
        const r = result?.rows.find(r => r.sightId === s.id && r.component === 'distance');
        if (r) color = `hsl(${30 + Math.max(0, Math.min(1, r.redundancy)) * 150},48%,43%)`;
      }
      const picked = selected?.kind === 'sight' && selected.id === s.id;
      if (picked) color = '#00666b';
      c.setLineDash(bad.has(s.id) || s.active === false ? [6, 5] : []);
      const start = [line.a[0] + line.dx * 13, line.a[1] + line.dy * 13];
      const end = [line.b[0] - line.dx * 14, line.b[1] - line.dy * 14];
      c.strokeStyle = color; c.lineWidth = picked ? 2.5 : 1.3;
      c.beginPath(); c.moveTo(...start); c.lineTo(...end); c.stroke(); c.setLineDash([]);
      const tip = [line.a[0] + line.dx * line.len * .64, line.a[1] + line.dy * line.len * .64];
      this.arrow([tip[0] - line.dx * 10, tip[1] - line.dy * 10], tip, color, picked ? 2.5 : 1.3, 7);
      const obstacle = visibility[s.id]?.obstruction;
      if (obstacle) { const [x, y] = this.project(obstacle); c.strokeStyle = '#b64b30'; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + 4, y + 4); c.moveTo(x - 4, y + 4); c.lineTo(x + 4, y - 4); c.stroke(); }
    }
    if (source && this.preview?.cursor) {
      const p = pts.find(p => p.id === source);
      if (p) { c.setLineDash([5, 4]); this.arrow(this.project(p), this.preview.cursor, '#087f80'); c.setLineDash([]); }
    }
    const affected = new Set(result?.diagnostics.filter(d => d.code === 'pointUndetermined').map(d => d.id));
    for (const p of pts) {
      const [x, y] = this.project(p), precision = result?.precision[p.id];
      if (view.ellipses && precision && !this.preview?.point && !scene.busy) {
        const ellipse = errorEllipse(precision.covariance, view.confidence);
        const a = ellipse.major * view.exaggeration * this.scale, b = ellipse.minor * view.exaggeration * this.scale;
        if (Number.isFinite(a + b)) {
          c.strokeStyle = '#098480'; c.fillStyle = '#15988b16'; c.lineWidth = 1.5;
          c.beginPath(); c.ellipse(x, y, Math.max(.2, Math.min(1e6, a)), Math.max(.2, Math.min(1e6, b)), -ellipse.theta, 0, 2 * Math.PI); c.fill(); c.stroke();
        }
      }
      const displacement = effect?.points[p.id];
      if (displacement && !scene.busy) this.arrow([x, y], [x + displacement[0] * view.exaggeration * this.scale, y - displacement[1] * view.exaggeration * this.scale], '#8b4ec2', 2, 8);
      const picked = selected?.kind === 'point' && selected.id === p.id;
      if (picked || source === p.id || affected.has(p.id)) {
        c.strokeStyle = affected.has(p.id) ? '#bd684aaa' : '#07a49c88'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, 15, 0, 2 * Math.PI); c.stroke();
      }
      c.strokeStyle = p.control === 'fixed' ? '#aa6634' : p.control === 'stochastic' ? '#9869ab' : '#146f78';
      c.fillStyle = p.active === false ? '#ccd6d7' : p.control === 'fixed' ? '#e6a45e' : p.control === 'stochastic' ? '#d2b8df' : '#e7f6f3';
      c.lineWidth = 2; c.beginPath();
      if (p.type === 'station') { c.moveTo(x, y - 8); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); }
      else c.arc(x, y, 6, 0, 2 * Math.PI);
      c.fill(); c.stroke();
      c.fillStyle = '#223d47'; c.font = '600 12px system-ui'; c.textAlign = 'left';
      if (view.labels) c.fillText(p.label || p.id, x + 13, y - 11);
      if (view.precisionLabels && precision && !scene.busy) { c.fillStyle = '#507982'; c.font = '10px system-ui'; c.fillText(`σU ${(precision.sigma[2] * 1000).toFixed(2)} mm`, x + 13, y + 5); }
    }
    // North/east cue and true-length scale bar.
    const ax = this.width - 48, ay = 67;
    this.arrow([ax, ay], [ax, ay - 24], '#526e76', 1, 5); this.arrow([ax, ay], [ax + 21, ay], '#526e76', 1, 5);
    c.fillStyle = '#526e76'; c.font = '11px system-ui'; c.fillText('N', ax - 4, ay - 32); c.fillText('E', ax + 26, ay + 4);
    const size = step * this.scale, sx = this.width - size - 24, sy = this.height - 25;
    c.strokeStyle = '#526e76'; c.beginPath(); c.moveTo(sx, sy - 4); c.lineTo(sx, sy); c.lineTo(sx + size, sy); c.lineTo(sx + size, sy - 4); c.stroke();
    c.textAlign = 'center'; c.fillText(`${step} m`, sx + size / 2, sy - 7); c.textAlign = 'left';
  }
  async terrainImage(terrain) {
    const width = 130, height = 100, [e0, n0, e1, n1] = terrain.bounds;
    const values = [];
    // Preview raster is only visual; LOS samples the original shared tile loader.
    for (let y = 0; y < height; y++) {
      values.push(...await Promise.all(Array.from({ length: width }, (_, x) =>
        terrain.sample(e0 + (x + .5) / width * (e1 - e0), n1 - (y + .5) / height * (n1 - n0)))));
    }
    const low = Math.min(...values), high = Math.max(...values), image = document.createElement('canvas');
    image.width = width; image.height = height;
    const context = image.getContext('2d'), pixels = context.createImageData(width, height);
    values.forEach((z, i) => {
      const v = (z - low) / Math.max(1, high - low), band = Math.floor(z / 5);
      const contour = i % width && Math.floor(values[i - 1] / 5) !== band ? 16 : 0;
      pixels.data.set([202 + v * 28 - contour, 218 + v * 5 - contour, 199 - v * 29 - contour, 255], i * 4);
    });
    context.putImageData(pixels, 0, 0);
    return { image, bounds: terrain.bounds, low, high };
  }
}
