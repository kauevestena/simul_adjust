// --- Vistas 2D da rede: planta XY e cortes XZ e YZ, com as elipses de erro projetadas ---
// A elipse de cada ponto é a do bloco 2×2 marginal de Σ, com o mesmo k do elipsoide 3D:
// é exatamente o contorno da sombra do elipsoide no plano (ver NetAdjust.ellipse2D).
// Nos cortes, Z pode ser exagerado: redes de levantamento são achatadas, e em escala
// verdadeira os cortes viram uma linha. O exagero vale também para as elipses (D Σ D).
(function (root) {
    'use strict';
    const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);

    // h, v: índices de (X, Y, Z) nos eixos horizontal e vertical da tela.
    // Na planta, X (zero do círculo) aponta para cima e Y para a direita — sem espelhar.
    const PANELS = {
        xy: { h: 1, v: 0, get title() { return tr('Planta XY', 'XY plan'); }, hName: 'Y', vName: 'X' },
        xz: { h: 0, v: 2, get title() { return tr('Corte XZ', 'XZ section'); }, hName: 'X', vName: 'Z' },
        yz: { h: 1, v: 2, get title() { return tr('Corte YZ', 'YZ section'); }, hName: 'Y', vName: 'Z' }
    };

    const DEFAULTS = {
        colorStation: '#d97706',
        colorFixed: '#e11d48',
        colorFree: '#0f766e',
        colorEllipse: '#6366f1',
        colorLine: '#a8a29e',
        colorFlagged: '#e11d48',
        showEllipses: true,
        showLines: true,
        showLabels: true,
        ellipseScale: 300,
        vertExag: 1,
        confK: 1
    };

    function niceStep(raw) {
        const p = Math.pow(10, Math.floor(Math.log10(raw)));
        const m = raw / p;
        return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    }

    function fmtLen(m) {
        if (m >= 1) return `${+m.toPrecision(3)} m`;
        if (m >= 0.01) return `${+(m * 100).toPrecision(3)} cm`;
        return `${+(m * 1000).toPrecision(3)} mm`;
    }

    class Panel {
        constructor(canvas, key, owner) {
            this.canvas = canvas;
            this.key = key;
            this.def = PANELS[key];
            this.owner = owner;
            this.view = null; // { cx, cy, s } centro em unidades de mundo, s em px/m
            this._drag = null;
            canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
            canvas.addEventListener('mousedown', e => { this._drag = { x: e.clientX, y: e.clientY }; });
            window.addEventListener('mousemove', e => this._onMove(e));
            window.addEventListener('mouseup', () => { this._drag = null; });
            canvas.addEventListener('dblclick', () => { this.fit(); this.render(); });
        }

        _size() {
            const dpr = window.devicePixelRatio || 1;
            const w = this.canvas.clientWidth || 400, h = this.canvas.clientHeight || 300;
            if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
                this.canvas.width = Math.round(w * dpr);
                this.canvas.height = Math.round(h * dpr);
            }
            return { w, h, dpr };
        }

        fit(w, h) {
            const pts = this.owner.scene.points;
            // Painel oculto não tem tamanho: o enquadramento fica para quando aparecer
            if (!pts.length || (!(w && h) && this.canvas.offsetParent === null)) { this.view = null; return; }
            const sz = (w && h) ? { w, h } : this._size();
            const { h: ih, v: iv } = this.def;
            const ve = this.vex();
            let minH = Infinity, maxH = -Infinity, minV = Infinity, maxV = -Infinity;
            pts.forEach(p => {
                minH = Math.min(minH, p.xyz[ih]); maxH = Math.max(maxH, p.xyz[ih]);
                minV = Math.min(minV, p.xyz[iv] * ve); maxV = Math.max(maxV, p.xyz[iv] * ve);
            });
            const spanH = Math.max(maxH - minH, 0.5), spanV = Math.max(maxV - minV, 0.5);
            const s = Math.min((sz.w - 70) / spanH, (sz.h - 60) / spanV);
            this.view = { cx: (minH + maxH) / 2, cy: (minV + maxV) / 2, s: Math.max(s, 1e-6) };
        }

        // exagero vertical: só nos cortes (eixo vertical = Z)
        vex() { return this.def.v === 2 ? Math.max(1, this.owner.opts.vertExag || 1) : 1; }

        _onWheel(e) {
            if (!this.view) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const { w, h } = this._size();
            const wx = this.view.cx + (mx - w / 2) / this.view.s;
            const wy = this.view.cy - (my - h / 2) / this.view.s;
            const f = Math.exp(-e.deltaY * 0.0015);
            this.view.s *= f;
            this.view.cx = wx - (mx - w / 2) / this.view.s;
            this.view.cy = wy + (my - h / 2) / this.view.s;
            this.render();
        }

        _onMove(e) {
            if (!this._drag || !this.view) return;
            const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
            this._drag = { x: e.clientX, y: e.clientY };
            this.view.cx -= dx / this.view.s;
            this.view.cy += dy / this.view.s;
            this.render();
        }

        render() {
            if (!this.view) this.fit();
            const { w, h, dpr } = this._size();
            const ctx = this.canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.draw(ctx, w, h);
        }

        // Desenha em qualquer contexto (tela ou imagem do relatório)
        draw(ctx, w, h, view) {
            const o = this.owner.opts;
            const V = view || this.view;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            const pts = this.owner.scene.points;
            if (!pts.length || !V) {
                ctx.fillStyle = '#a8a29e';
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(tr('Carregue observações para ver a rede.', 'Load observations to see the network.'), w / 2, h / 2);
                return;
            }
            const { h: ih, v: iv } = this.def;
            const ve = this.vex();
            const X = p => w / 2 + (p[ih] - V.cx) * V.s;
            const Y = p => h / 2 - (p[iv] * ve - V.cy) * V.s;

            // grade (rótulos verticais em unidades verdadeiras)
            const step = niceStep(80 / V.s), stepV = niceStep(60 / (V.s * ve));
            ctx.strokeStyle = '#f0efee';
            ctx.lineWidth = 1;
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillStyle = '#a8a29e';
            const h0 = V.cx - w / 2 / V.s, h1 = V.cx + w / 2 / V.s;
            const v0 = (V.cy - h / 2 / V.s) / ve, v1 = (V.cy + h / 2 / V.s) / ve;
            ctx.textAlign = 'center';
            for (let g = Math.ceil(h0 / step) * step; g <= h1; g += step) {
                const x = w / 2 + (g - V.cx) * V.s;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                ctx.fillText(+g.toFixed(6) + '', x, h - 4);
            }
            ctx.textAlign = 'left';
            for (let g = Math.ceil(v0 / stepV) * stepV; g <= v1; g += stepV) {
                const y = h / 2 - (g * ve - V.cy) * V.s;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                ctx.fillText(+g.toFixed(6) + '', 3, y - 2);
            }

            // visadas
            if (o.showLines) {
                this.owner.scene.lines.forEach(l => {
                    ctx.beginPath();
                    ctx.setLineDash(l.state === 'inactive' ? [4, 4] : []);
                    ctx.strokeStyle = l.state === 'flagged' ? o.colorFlagged : o.colorLine;
                    ctx.globalAlpha = l.state === 'inactive' ? 0.6 : 0.9;
                    ctx.lineWidth = l.state === 'flagged' ? 1.6 : 1;
                    ctx.moveTo(X(l.a), Y(l.a)); ctx.lineTo(X(l.b), Y(l.b));
                    ctx.stroke();
                });
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }

            // elipses projetadas
            if (o.showEllipses && typeof NetAdjust !== 'undefined') {
                const k = o.confK * o.ellipseScale;
                ctx.strokeStyle = o.colorEllipse;
                ctx.fillStyle = o.colorEllipse + '33';
                ctx.lineWidth = 1.2;
                pts.forEach(p => {
                    if (!p.Sigma) return;
                    const S2 = [[p.Sigma[ih][ih], p.Sigma[ih][iv] * ve], [p.Sigma[iv][ih] * ve, p.Sigma[iv][iv] * ve * ve]];
                    const el = NetAdjust.ellipse2D(S2, k);
                    if (!(el.a > 0)) return;
                    ctx.beginPath();
                    // ângulo medido do eixo horizontal para o vertical; na tela o vertical desce
                    ctx.ellipse(X(p.xyz), Y(p.xyz), Math.max(el.a * V.s, 0.5), Math.max(el.b * V.s, 0.5), -el.theta, 0, 2 * Math.PI);
                    ctx.fill(); ctx.stroke();
                });
            }

            // pontos
            pts.forEach(p => {
                const x = X(p.xyz), y = Y(p.xyz);
                ctx.beginPath();
                if (p.kind === 'station') {
                    ctx.fillStyle = o.colorStation;
                    ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath();
                } else if (p.kind === 'fixed') {
                    ctx.fillStyle = o.colorFixed;
                    ctx.moveTo(x, y - 6); ctx.lineTo(x + 5.5, y + 4); ctx.lineTo(x - 5.5, y + 4); ctx.closePath();
                } else {
                    ctx.fillStyle = o.colorFree;
                    ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                }
                ctx.fill();
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
            });
            if (o.showLabels) {
                ctx.font = '600 11px Inter, sans-serif';
                ctx.textAlign = 'left';
                pts.forEach(p => {
                    const x = X(p.xyz) + 7, y = Y(p.xyz) - 6;
                    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.strokeText(p.name, x, y);
                    ctx.fillStyle = p.kind === 'station' ? '#92400e' : (p.kind === 'fixed' ? '#9f1239' : '#115e59');
                    ctx.fillText(p.name, x, y);
                });
            }

            // título, eixos e escalas
            ctx.fillStyle = '#292524';
            ctx.font = '700 12px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(this.def.title + (ve > 1 ? tr(`  (${this.def.vName} exagerado ${+ve.toFixed(1)}×)`, `  (${this.def.vName} exaggerated ${+ve.toFixed(1)}×)`) : ''), 10, 18);
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = '#78716c';
            ctx.fillText(`→ ${this.def.hName}   ↑ ${this.def.vName}`, 10, 32);

            // escala no canto superior direito, longe dos rótulos da grade
            const barM = niceStep(w * 0.18 / V.s);
            const barPx = barM * V.s;
            const bx = w - barPx - 14, by = 26;
            ctx.strokeStyle = '#292524'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillStyle = '#292524';
            ctx.fillText(fmtLen(barM), bx + barPx / 2, by - 5);
            if (o.showEllipses) {
                const eM = barM / o.ellipseScale;
                ctx.fillStyle = o.colorEllipse;
                ctx.fillText(tr(`elipses: barra = ${fmtLen(eM)}`, `ellipses: bar = ${fmtLen(eM)}`), bx + barPx / 2, by + 13);
            }
        }

        // Imagem enquadrada, independente do zoom do usuário
        image(w, h) {
            const c = document.createElement('canvas');
            const scale = 2;
            c.width = w * scale; c.height = h * scale;
            const ctx = c.getContext('2d');
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            const keep = this.view;
            this.fit(w, h);
            const v = this.view;
            this.view = keep;
            this.draw(ctx, w, h, v);
            return { dataURL: c.toDataURL('image/jpeg', 0.9), width: c.width, height: c.height };
        }
    }

    class NetworkViews2D {
        constructor(ids) {
            this.opts = Object.assign({}, DEFAULTS);
            this.scene = { points: [], lines: [] };
            this.panels = {};
            Object.entries(ids).forEach(([key, id]) => {
                const c = document.getElementById(id);
                if (c) this.panels[key] = new Panel(c, key, this);
            });
        }

        setOptions(patch) {
            const refitCuts = 'vertExag' in patch && patch.vertExag !== this.opts.vertExag;
            Object.assign(this.opts, patch);
            if (refitCuts) Object.values(this.panels).forEach(p => { if (p.def.v === 2) p.fit(); });
            this.render();
        }

        setScene(scene, refit) {
            this.scene = scene || { points: [], lines: [] };
            Object.values(this.panels).forEach(p => { if (refit || !p.view) p.fit(); });
            this.render();
        }

        // Exagero vertical que dá aos cortes ~1/4 da extensão horizontal (1× a 20×)
        static autoVertExag(points) {
            if (!points.length) return 1;
            const span = i => Math.max(...points.map(p => p.xyz[i])) - Math.min(...points.map(p => p.xyz[i]));
            const sh = Math.max(span(0), span(1)), sv = Math.max(span(2), 1e-3);
            return Math.max(1, Math.min(20, Math.round(0.25 * sh / sv)));
        }

        fitAll() {
            Object.values(this.panels).forEach(p => p.fit());
            this.render();
        }

        render() {
            Object.values(this.panels).forEach(p => {
                if (p.canvas.offsetParent !== null) p.render();
            });
        }
    }

    root.NetworkViews2D = NetworkViews2D;
    root.NetworkViews2D.PANELS = PANELS;
    root.NetworkViews2D.DEFAULTS = DEFAULTS;
})(typeof self !== 'undefined' ? self : this);
