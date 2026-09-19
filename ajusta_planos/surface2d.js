// --- Modelo digital 2D dos resíduos ao plano ajustado ---
// Os pontos são projetados no referencial local do plano (u, v) e o resíduo ortogonal é
// interpolado por TIN, IDW ou Krigagem Ordinária, com saída em mapa de calor e/ou isolinhas.
(function (root) {
    'use strict';

    // Escalas contínuas: sequencial = uma matiz clara->escura; divergente = duas matizes
    // opostas com cinza neutro no meio. Rampas monotônicas em luminosidade (OKLab).
    const RAMP_BLUE = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
        '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
    const RAMP_RED = ['#fbd8d7', '#f7c3c2', '#f3aeac', '#ef9896', '#ea8280', '#e6696a',
        '#e34948', '#d63b3b', '#c23434', '#ad2d2d', '#982727', '#822121', '#6b1a1a'];
    const RAMP_ORANGE = ['#fde3d4', '#fbd2ba', '#f9c0a0', '#f7ad86', '#f4996c', '#f08253',
        '#eb6834', '#d95926', '#c24e21', '#aa441d', '#933a19', '#7b3015', '#652711'];
    const NEUTRAL = '#f0efec';

    const INK = {
        primary: '#0b0b0b', secondary: '#52514e', muted: '#898781',
        grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff'
    };

    const SCALES = {
        div_blue_red: {
            label: 'Divergente azul ↔ vermelho', type: 'diverging',
            stops: RAMP_BLUE.slice().reverse().concat([NEUTRAL], RAMP_RED)
        },
        div_blue_orange: {
            label: 'Divergente azul ↔ laranja', type: 'diverging',
            stops: RAMP_BLUE.slice().reverse().concat([NEUTRAL], RAMP_ORANGE)
        },
        seq_blue: { label: 'Sequencial azul', type: 'sequential', stops: RAMP_BLUE },
        seq_orange: { label: 'Sequencial laranja', type: 'sequential', stops: RAMP_ORANGE }
    };

    const METHODS = { tin: 'TIN (Delaunay)', idw: 'IDW', kriging: 'Krigagem Ordinária' };
    const VARIOGRAMS = { exponential: 'Exponencial', spherical: 'Esférico', gaussian: 'Gaussiano' };

    const DEFAULTS = {
        method: 'tin',
        mode: 'signed',            // 'signed' | 'abs'
        scale: 'div_blue_red',
        render: 'heatmap',         // 'heatmap' | 'contours' | 'both'
        resolution: 160,
        idwPower: 2,
        idwK: 0,                   // 0 = todos os pontos
        variogram: 'exponential',
        variogramAuto: true,
        nugget: 0, sill: 0, range: 0,
        contourLevels: 10,
        clipHull: true,
        showPoints: true,
        autoRange: true,
        rangeMin: null, rangeMax: null
    };

    // ---------------------------------------------------------------- cor
    function hexToRgb(hex) {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function sampleScale(stops, t) {
        const n = stops.length;
        if (!Number.isFinite(t)) return [255, 255, 255];
        t = Math.min(1, Math.max(0, t));
        const x = t * (n - 1);
        const i = Math.min(n - 2, Math.floor(x));
        const f = x - i;
        const a = hexToRgb(stops[i]), b = hexToRgb(stops[i + 1]);
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }

    function rgbCss(c) { return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`; }

    // ---------------------------------------------------------------- geometria auxiliar
    function convexHull(pts) {
        const p = pts.slice().sort((a, b) => a.u - b.u || a.v - b.v);
        if (p.length < 3) return p;
        const cross = (o, a, b) => (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);
        const lower = [];
        for (const q of p) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
            lower.push(q);
        }
        const upper = [];
        for (let i = p.length - 1; i >= 0; i--) {
            const q = p[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
            upper.push(q);
        }
        lower.pop(); upper.pop();
        return lower.concat(upper);
    }

    function expandHull(hull, factor) {
        const c = hull.reduce((a, p) => ({ u: a.u + p.u / hull.length, v: a.v + p.v / hull.length }), { u: 0, v: 0 });
        return hull.map(p => ({ u: c.u + (p.u - c.u) * factor, v: c.v + (p.v - c.v) * factor }));
    }

    function pointInPoly(u, v, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if (((a.v > v) !== (b.v > v)) && (u < (b.u - a.u) * (v - a.v) / (b.v - a.v) + a.u)) inside = !inside;
        }
        return inside;
    }

    // ---------------------------------------------------------------- interpoladores

    function interpIDW(samples, g, opts) {
        const out = new Float64Array(g.nx * g.ny).fill(NaN);
        const p = opts.idwPower;
        const k = opts.idwK > 0 ? Math.min(opts.idwK, samples.length) : 0;
        const buf = samples.map(() => ({ d2: 0, z: 0 }));
        for (let iy = 0; iy < g.ny; iy++) {
            const v = g.v0 + iy * g.dv;
            for (let ix = 0; ix < g.nx; ix++) {
                const u = g.u0 + ix * g.du;
                let num = 0, den = 0, exact = null;
                for (let s = 0; s < samples.length; s++) {
                    const du = u - samples[s].u, dv = v - samples[s].v;
                    const d2 = du * du + dv * dv;
                    if (d2 < 1e-16) { exact = samples[s].z; break; }
                    buf[s].d2 = d2; buf[s].z = samples[s].z;
                }
                if (exact !== null) { out[iy * g.nx + ix] = exact; continue; }
                let list = buf;
                if (k) {
                    list = buf.slice().sort((a, b) => a.d2 - b.d2).slice(0, k);
                }
                for (let s = 0; s < list.length; s++) {
                    const w = 1 / Math.pow(list[s].d2, p / 2);
                    num += w * list[s].z; den += w;
                }
                out[iy * g.nx + ix] = den > 0 ? num / den : NaN;
            }
        }
        return out;
    }

    function interpTIN(samples, g) {
        const out = new Float64Array(g.nx * g.ny).fill(NaN);
        if (typeof Delaunator === 'undefined' || samples.length < 3) return out;
        const del = Delaunator.from(samples, s => s.u, s => s.v);
        const tri = del.triangles;

        for (let t = 0; t < tri.length; t += 3) {
            const a = samples[tri[t]], b = samples[tri[t + 1]], c = samples[tri[t + 2]];
            const denom = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
            if (Math.abs(denom) < 1e-18) continue;

            const ixMin = Math.max(0, Math.floor((Math.min(a.u, b.u, c.u) - g.u0) / g.du));
            const ixMax = Math.min(g.nx - 1, Math.ceil((Math.max(a.u, b.u, c.u) - g.u0) / g.du));
            const iyMin = Math.max(0, Math.floor((Math.min(a.v, b.v, c.v) - g.v0) / g.dv));
            const iyMax = Math.min(g.ny - 1, Math.ceil((Math.max(a.v, b.v, c.v) - g.v0) / g.dv));

            for (let iy = iyMin; iy <= iyMax; iy++) {
                const v = g.v0 + iy * g.dv;
                for (let ix = ixMin; ix <= ixMax; ix++) {
                    const u = g.u0 + ix * g.du;
                    const l1 = ((b.v - c.v) * (u - c.u) + (c.u - b.u) * (v - c.v)) / denom;
                    const l2 = ((c.v - a.v) * (u - c.u) + (a.u - c.u) * (v - c.v)) / denom;
                    const l3 = 1 - l1 - l2;
                    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
                    out[iy * g.nx + ix] = l1 * a.z + l2 * b.z + l3 * c.z;
                }
            }
        }
        return out;
    }

    // --- Krigagem ordinária ---

    function variogramModel(type, h, nugget, psill, range) {
        if (h <= 0) return 0;
        const a = Math.max(range, 1e-9);
        if (type === 'spherical') {
            return h >= a ? nugget + psill
                : nugget + psill * (1.5 * (h / a) - 0.5 * Math.pow(h / a, 3));
        }
        if (type === 'gaussian') return nugget + psill * (1 - Math.exp(-(h * h) / (a * a)));
        return nugget + psill * (1 - Math.exp(-h / a)); // exponencial
    }

    // Variograma empírico em bins + busca do alcance com mínimos quadrados em (nugget, psill)
    function fitVariogram(samples, type) {
        const n = samples.length;
        const pairs = [];
        let maxH = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const h = Math.hypot(samples[i].u - samples[j].u, samples[i].v - samples[j].v);
                const g = 0.5 * Math.pow(samples[i].z - samples[j].z, 2);
                pairs.push({ h, g });
                if (h > maxH) maxH = h;
            }
        }
        const hMax = maxH * 0.6; // metade final é pouco confiável
        const nb = 15;
        const bins = Array.from({ length: nb }, () => ({ sum: 0, sumH: 0, n: 0 }));
        pairs.forEach(p => {
            if (p.h > hMax) return;
            const b = Math.min(nb - 1, Math.floor(p.h / hMax * nb));
            bins[b].sum += p.g; bins[b].sumH += p.h; bins[b].n++;
        });
        const emp = bins.filter(b => b.n > 0).map(b => ({ h: b.sumH / b.n, g: b.sum / b.n, w: b.n }));
        if (emp.length < 3) {
            const varz = pairs.reduce((s, p) => s + p.g, 0) / Math.max(pairs.length, 1);
            return { nugget: 0, psill: varz, range: Math.max(hMax / 3, 1e-6), empirical: emp };
        }

        let best = null;
        for (let s = 1; s <= 40; s++) {
            const range = hMax * (s / 40);
            // mínimos quadrados ponderados em [nugget, psill] para este alcance
            let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0;
            emp.forEach(e => {
                const f = variogramModel(type, e.h, 0, 1, range); // forma normalizada
                const w = e.w;
                s11 += w * 1; s12 += w * f; s22 += w * f * f;
                b1 += w * e.g; b2 += w * f * e.g;
            });
            const det = s11 * s22 - s12 * s12;
            let nugget, psill;
            if (Math.abs(det) < 1e-18) { nugget = 0; psill = b2 / (s22 || 1); }
            else { nugget = (b1 * s22 - b2 * s12) / det; psill = (s11 * b2 - s12 * b1) / det; }
            if (nugget < 0) { nugget = 0; psill = s22 > 0 ? b2 / s22 : 0; }
            if (psill < 0) { psill = 0; nugget = s11 > 0 ? b1 / s11 : 0; }
            let sse = 0;
            emp.forEach(e => {
                const d = e.g - variogramModel(type, e.h, nugget, psill, range);
                sse += e.w * d * d;
            });
            if (!best || sse < best.sse) best = { sse, nugget, psill, range };
        }
        return { nugget: best.nugget, psill: best.psill, range: best.range, empirical: emp };
    }

    function interpKriging(samples, g, opts) {
        const out = new Float64Array(g.nx * g.ny).fill(NaN);
        const n = samples.length;
        if (n < 3 || typeof PlaneAdjust === 'undefined') return out;
        const L = PlaneAdjust.linalg;

        let params;
        if (opts.variogramAuto || !(opts.range > 0)) {
            const fit = fitVariogram(samples, opts.variogram);
            params = { nugget: fit.nugget, psill: fit.psill, range: fit.range };
            opts._fitted = Object.assign({ empirical: fit.empirical }, params);
        } else {
            params = { nugget: opts.nugget, psill: Math.max(opts.sill - opts.nugget, 0), range: opts.range };
            opts._fitted = Object.assign({ empirical: null }, params);
        }

        // Sistema da krigagem ordinária: (n+1)x(n+1) com o multiplicador de Lagrange
        const K = L.zeros(n + 1, n + 1);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const h = Math.hypot(samples[i].u - samples[j].u, samples[i].v - samples[j].v);
                K[i][j] = variogramModel(opts.variogram, h, params.nugget, params.psill, params.range);
            }
            K[i][n] = 1; K[n][i] = 1;
        }
        for (let i = 0; i < n; i++) K[i][i] = 0; // gamma(0) = 0
        K[n][n] = 0;

        let Kinv;
        try { Kinv = L.inv(K); } catch (e) { return out; }

        const rhs = new Array(n + 1);
        for (let iy = 0; iy < g.ny; iy++) {
            const v = g.v0 + iy * g.dv;
            for (let ix = 0; ix < g.nx; ix++) {
                const u = g.u0 + ix * g.du;
                for (let i = 0; i < n; i++) {
                    const h = Math.hypot(u - samples[i].u, v - samples[i].v);
                    rhs[i] = variogramModel(opts.variogram, h, params.nugget, params.psill, params.range);
                }
                rhs[n] = 1;
                let z = 0;
                for (let i = 0; i < n; i++) {
                    let w = 0;
                    const row = Kinv[i];
                    for (let j = 0; j <= n; j++) w += row[j] * rhs[j];
                    z += w * samples[i].z;
                }
                out[iy * g.nx + ix] = z;
            }
        }
        return out;
    }

    // ---------------------------------------------------------------- marching squares
    function contourSegments(values, g, level) {
        const segs = [];
        const at = (ix, iy) => values[iy * g.nx + ix];
        const pos = (ix, iy) => [g.u0 + ix * g.du, g.v0 + iy * g.dv];
        for (let iy = 0; iy < g.ny - 1; iy++) {
            for (let ix = 0; ix < g.nx - 1; ix++) {
                const v00 = at(ix, iy), v10 = at(ix + 1, iy), v11 = at(ix + 1, iy + 1), v01 = at(ix, iy + 1);
                if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v11) || !Number.isFinite(v01)) continue;
                const idx = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
                if (idx === 0 || idx === 15) continue;

                const [x0, y0] = pos(ix, iy);
                const x1 = x0 + g.du, y1 = y0 + g.dv;
                const lerp = (a, b, va, vb) => a + (b - a) * (level - va) / (vb - va);
                const bottom = () => [lerp(x0, x1, v00, v10), y0];
                const right = () => [x1, lerp(y0, y1, v10, v11)];
                const top = () => [lerp(x0, x1, v01, v11), y1];
                const left = () => [x0, lerp(y0, y1, v00, v01)];

                const push = (a, b) => segs.push([a[0], a[1], b[0], b[1]]);
                switch (idx) {
                    case 1: case 14: push(left(), bottom()); break;
                    case 2: case 13: push(bottom(), right()); break;
                    case 3: case 12: push(left(), right()); break;
                    case 4: case 11: push(right(), top()); break;
                    case 5: push(left(), top()); push(bottom(), right()); break;
                    case 6: case 9: push(bottom(), top()); break;
                    case 7: case 8: push(left(), top()); break;
                    case 10: push(left(), bottom()); push(right(), top()); break;
                }
            }
        }
        return segs;
    }

    // ---------------------------------------------------------------- componente
    class ResidualSurface {
        constructor(canvasId, colorbarId, tooltipId) {
            this.canvas = document.getElementById(canvasId);
            this.colorbar = colorbarId ? document.getElementById(colorbarId) : null;
            this.tooltip = tooltipId ? document.getElementById(tooltipId) : null;
            this.opts = Object.assign({}, DEFAULTS);
            this.samples = [];
            this.grid = null;
            this.frame = null;
            this.stats = null;
            if (this.canvas) {
                this.canvas.addEventListener('mousemove', e => this._onHover(e));
                this.canvas.addEventListener('mouseleave', () => this._hideTip());
            }
        }

        setOptions(patch) { Object.assign(this.opts, patch); }

        // Projeta os pontos no referencial local do plano ajustado
        setResult(result) {
            this.result = result || null;
            this.samples = [];
            this.frame = null;
            if (!result) return;

            const L = PlaneAdjust.linalg;
            const X = result.normalized ? result.normalized.Xn : result.Xa;
            const len = L.norm([X[0], X[1], X[2]]);
            const n = [X[0] / len, X[1] / len, X[2] / len];
            const D = X[3] / len;

            const pts = result.Lb;
            const c = [0, 0, 0];
            pts.forEach(p => { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; });
            const dist = L.dot(n, c) + D;
            const origin = [c[0] - n[0] * dist, c[1] - n[1] * dist, c[2] - n[2] * dist];

            // e1 = direção de maior dispersão dentro do plano
            const S = L.zeros(3, 3);
            pts.forEach(p => {
                const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
                for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += d[i] * d[j];
            });
            const { vectors } = L.eigSym(S);
            let e1 = [vectors[0][2], vectors[1][2], vectors[2][2]]; // maior autovalor
            const proj = L.dot(e1, n);
            e1 = [e1[0] - proj * n[0], e1[1] - proj * n[1], e1[2] - proj * n[2]];
            const e1n = L.norm(e1);
            e1 = e1.map(v => v / e1n);
            const e2 = L.cross(n, e1);

            this.frame = { origin, e1, e2, n, D };
            this.samples = result.obsData.map(o => {
                const p = result.Lb[o.i];
                const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
                return {
                    u: L.dot(d, e1), v: L.dot(d, e2),
                    d: o.d, z: 0,
                    id: o.point.id, idx: o.point.idx, isOutlier: o.point.flagged || o.isOutlier
                };
            });
            this._applyMode();
        }

        _applyMode() {
            const signed = this.opts.mode === 'signed';
            this.samples.forEach(s => { s.z = (signed ? s.d : Math.abs(s.d)) * 1000; }); // mm
        }

        compute() {
            if (!this.samples.length) { this.grid = null; return; }
            this._applyMode();

            const us = this.samples.map(s => s.u), vs = this.samples.map(s => s.v);
            const uMin = Math.min(...us), uMax = Math.max(...us);
            const vMin = Math.min(...vs), vMax = Math.max(...vs);
            const padU = Math.max((uMax - uMin) * 0.04, 1e-3);
            const padV = Math.max((vMax - vMin) * 0.04, 1e-3);

            const spanU = (uMax - uMin) + 2 * padU;
            const spanV = (vMax - vMin) + 2 * padV;
            const res = this.opts.resolution;
            let nx, ny;
            if (spanU >= spanV) { nx = res; ny = Math.max(8, Math.round(res * spanV / spanU)); }
            else { ny = res; nx = Math.max(8, Math.round(res * spanU / spanV)); }

            const g = {
                nx, ny,
                u0: uMin - padU, v0: vMin - padV,
                du: spanU / (nx - 1), dv: spanV / (ny - 1),
                uMax: uMax + padU, vMax: vMax + padV
            };

            this.opts._fitted = null;
            let values;
            if (this.opts.method === 'idw') values = interpIDW(this.samples, g, this.opts);
            else if (this.opts.method === 'kriging') values = interpKriging(this.samples, g, this.opts);
            else values = interpTIN(this.samples, g);

            if (this.opts.clipHull) {
                const hull = expandHull(convexHull(this.samples), 1.02);
                for (let iy = 0; iy < g.ny; iy++) {
                    for (let ix = 0; ix < g.nx; ix++) {
                        if (!pointInPoly(g.u0 + ix * g.du, g.v0 + iy * g.dv, hull)) values[iy * g.nx + ix] = NaN;
                    }
                }
            }

            g.values = values;
            this.grid = g;

            const zs = this.samples.map(s => s.z);
            let lo, hi;
            if (this.opts.autoRange || this.opts.rangeMin === null || this.opts.rangeMax === null) {
                if (this.opts.mode === 'signed') {
                    const a = Math.max(Math.abs(Math.min(...zs)), Math.abs(Math.max(...zs)));
                    lo = -a; hi = a; // simétrico: o zero cai no ponto neutro da escala
                } else { lo = 0; hi = Math.max(...zs); }
            } else { lo = this.opts.rangeMin; hi = this.opts.rangeMax; }
            if (hi - lo < 1e-9) { hi = lo + 1; }
            this.stats = {
                lo, hi,
                min: Math.min(...zs), max: Math.max(...zs),
                rms: Math.sqrt(zs.reduce((s, z) => s + z * z, 0) / zs.length),
                variogram: this.opts._fitted || null
            };
        }

        render() {
            if (!this.canvas) return;
            const ctx = this.canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
            this.canvas.width = Math.round(W * dpr);
            this.canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = INK.surface;
            ctx.fillRect(0, 0, W, H);

            if (!this.grid) {
                ctx.fillStyle = INK.muted;
                ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Aguardando ajustamento...', W / 2, H / 2);
                this._renderColorbar(null);
                return;
            }

            const g = this.grid, st = this.stats;
            const pad = { l: 46, r: 14, t: 14, b: 34 };
            const plotW = Math.max(W - pad.l - pad.r, 10);
            const plotH = Math.max(H - pad.t - pad.b, 10);
            // Preserva a proporção real do plano
            const spanU = g.uMax - g.u0, spanV = g.vMax - g.v0;
            const k = Math.min(plotW / spanU, plotH / spanV);
            const drawW = spanU * k, drawH = spanV * k;
            const x0 = pad.l + (plotW - drawW) / 2;
            const y0 = pad.t + (plotH - drawH) / 2;
            this._plot = { x0, y0, drawW, drawH, k, g };

            const stops = SCALES[this.opts.scale].stops;
            const norm = z => (z - st.lo) / (st.hi - st.lo);

            if (this.opts.render !== 'contours') {
                const off = document.createElement('canvas');
                off.width = g.nx; off.height = g.ny;
                const octx = off.getContext('2d');
                const img = octx.createImageData(g.nx, g.ny);
                for (let iy = 0; iy < g.ny; iy++) {
                    for (let ix = 0; ix < g.nx; ix++) {
                        const z = g.values[iy * g.nx + ix];
                        // v cresce para cima; a imagem cresce para baixo
                        const o = ((g.ny - 1 - iy) * g.nx + ix) * 4;
                        if (!Number.isFinite(z)) { img.data[o + 3] = 0; continue; }
                        const c = sampleScale(stops, norm(z));
                        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
                    }
                }
                octx.putImageData(img, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(off, x0, y0, drawW, drawH);
            }

            const toPx = (u, v) => [x0 + (u - g.u0) * k, y0 + drawH - (v - g.v0) * k];

            if (this.opts.render !== 'heatmap') this._drawContours(ctx, toPx, stops, norm);

            // Moldura e eixos discretos
            ctx.strokeStyle = INK.axis;
            ctx.lineWidth = 1;
            ctx.strokeRect(x0, y0, drawW, drawH);
            this._drawAxes(ctx, x0, y0, drawW, drawH, g);

            if (this.opts.showPoints) this._drawPoints(ctx, toPx);
            this._renderColorbar(st);
        }

        _drawContours(ctx, toPx, stops, norm) {
            const g = this.grid, st = this.stats;
            const nLev = Math.max(2, this.opts.contourLevels);
            const heatBehind = this.opts.render === 'both';
            const placed = [];
            for (let i = 1; i <= nLev; i++) {
                const level = st.lo + (st.hi - st.lo) * i / (nLev + 1);
                const segs = contourSegments(g.values, g, level);
                if (!segs.length) continue;
                // Sobre o mapa de calor as linhas são neutras; sozinhas, carregam a escala
                ctx.strokeStyle = heatBehind ? 'rgba(11,11,11,0.45)' : rgbCss(sampleScale(stops, norm(level)));
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                segs.forEach(s => {
                    const a = toPx(s[0], s[1]), b = toPx(s[2], s[3]);
                    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
                });
                ctx.stroke();

                // Um rótulo por nível, evitando colisão com os já colocados
                let bestSeg = null, bestDist = -1;
                segs.forEach(s => {
                    const p = toPx((s[0] + s[2]) / 2, (s[1] + s[3]) / 2);
                    let d = Infinity;
                    placed.forEach(q => { d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1])); });
                    if (placed.length === 0) d = 1e9;
                    if (d > bestDist) { bestDist = d; bestSeg = p; }
                });
                if (bestSeg && bestDist > 26) {
                    placed.push(bestSeg);
                    const txt = level.toFixed(1);
                    ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
                    const w = ctx.measureText(txt).width;
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.fillRect(bestSeg[0] - w / 2 - 3, bestSeg[1] - 7, w + 6, 13);
                    ctx.fillStyle = INK.secondary;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(txt, bestSeg[0], bestSeg[1]);
                }
            }
        }

        _drawAxes(ctx, x0, y0, drawW, drawH, g) {
            ctx.font = '10px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.fillStyle = INK.muted;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let i = 0; i <= 4; i++) {
                const u = g.u0 + (g.uMax - g.u0) * i / 4;
                ctx.fillText(u.toFixed(1), x0 + drawW * i / 4, y0 + drawH + 6);
            }
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let i = 0; i <= 4; i++) {
                const v = g.v0 + (g.vMax - g.v0) * i / 4;
                ctx.fillText(v.toFixed(1), x0 - 6, y0 + drawH - drawH * i / 4);
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = INK.secondary;
            ctx.fillText('u (m) — eixo principal do plano', x0 + drawW / 2, y0 + drawH + 19);
        }

        _drawPoints(ctx, toPx) {
            this.samples.forEach(s => {
                const [x, y] = toPx(s.u, s.v);
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                ctx.fillStyle = s.isOutlier ? '#d03b3b' : INK.primary;
                ctx.fill();
                ctx.lineWidth = 2;           // anel da superfície: separa a marca do fundo
                ctx.strokeStyle = INK.surface;
                ctx.stroke();
            });
        }

        _renderColorbar(st) {
            if (!this.colorbar) return;
            const ctx = this.colorbar.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const W = this.colorbar.clientWidth, H = this.colorbar.clientHeight;
            this.colorbar.width = Math.round(W * dpr);
            this.colorbar.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            if (!st) return;

            const stops = SCALES[this.opts.scale].stops;
            const barH = 12, x0 = 8, x1 = W - 8;
            for (let x = x0; x <= x1; x++) {
                ctx.fillStyle = rgbCss(sampleScale(stops, (x - x0) / (x1 - x0)));
                ctx.fillRect(x, 4, 1, barH);
            }
            ctx.strokeStyle = 'rgba(11,11,11,0.10)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x0, 4, x1 - x0, barH);

            ctx.font = '10px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.fillStyle = INK.secondary;
            ctx.textBaseline = 'top';
            for (let i = 0; i <= 4; i++) {
                const t = i / 4;
                const val = st.lo + (st.hi - st.lo) * t;
                ctx.textAlign = i === 0 ? 'left' : (i === 4 ? 'right' : 'center');
                ctx.fillText(val.toFixed(1), x0 + (x1 - x0) * t, 4 + barH + 3);
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = INK.muted;
            ctx.fillText(this.opts.mode === 'signed' ? 'resíduo (mm)' : '|resíduo| (mm)', W / 2, 4 + barH + 15);
        }

        _onHover(e) {
            if (!this._plot || !this.tooltip) return;
            const rect = this.canvas.getBoundingClientRect();
            const px = e.clientX - rect.left, py = e.clientY - rect.top;
            const { x0, y0, drawW, drawH, k, g } = this._plot;
            if (px < x0 || px > x0 + drawW || py < y0 || py > y0 + drawH) return this._hideTip();

            const u = g.u0 + (px - x0) / k;
            const v = g.v0 + (y0 + drawH - py) / k;
            const ix = Math.round((u - g.u0) / g.du), iy = Math.round((v - g.v0) / g.dv);
            const z = (ix >= 0 && ix < g.nx && iy >= 0 && iy < g.ny) ? g.values[iy * g.nx + ix] : NaN;

            let near = null, nd = Infinity;
            this.samples.forEach(s => {
                const d = Math.hypot((s.u - u) * k, (s.v - v) * k);
                if (d < nd) { nd = d; near = s; }
            });

            const lines = [`u = ${u.toFixed(3)} m · v = ${v.toFixed(3)} m`];
            lines.push(Number.isFinite(z)
                ? `interpolado: <strong>${z.toFixed(2)} mm</strong>`
                : 'fora do domínio interpolado');
            if (near && nd < 14) lines.push(`${near.id}: <strong>${near.z.toFixed(2)} mm</strong>${near.isOutlier ? ' ⚠' : ''}`);

            this.tooltip.innerHTML = lines.join('<br>');
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = Math.min(px + 14, this.canvas.clientWidth - 150) + 'px';
            this.tooltip.style.top = Math.max(py - 10, 0) + 'px';
        }

        _hideTip() { if (this.tooltip) this.tooltip.style.display = 'none'; }

        // Grade interpolada como CSV (u, v, valor)
        exportCSV() {
            if (!this.grid) return '';
            const g = this.grid;
            const out = ['u_m,v_m,residuo_mm'];
            for (let iy = 0; iy < g.ny; iy++) {
                for (let ix = 0; ix < g.nx; ix++) {
                    const z = g.values[iy * g.nx + ix];
                    if (!Number.isFinite(z)) continue;
                    out.push(`${(g.u0 + ix * g.du).toFixed(6)},${(g.v0 + iy * g.dv).toFixed(6)},${z.toFixed(6)}`);
                }
            }
            return out.join('\n') + '\n';
        }
    }

    root.PlaneSurface2D = { ResidualSurface, SCALES, METHODS, VARIOGRAMS, DEFAULTS, fitVariogram, variogramModel };
})(typeof self !== 'undefined' ? self : this);
