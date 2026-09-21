// --- Vista 1D: histograma dos resíduos ao plano ajustado ---
// As vistas 3D e 2D mostram ONDE os resíduos estão; esta mostra COMO se distribuem, que é a
// pergunta que o teste global responde num número só.
//
// Duas grandezas, com referências diferentes:
//   d (mm)  resíduo ortogonal ao plano — a normal de referência é a AJUSTADA aos dados
//   w       resíduo normalizado de Baarda — a referência é a N(0,1) TEÓRICA, que sob H0 é
//           exatamente o que se deveria ver; nas amostras o desvio vai a 5,5, e é por isso
//           que o teste global reprova
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PlanoHist = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const MIN_BINS = 4, MAX_BINS = 20;

    // Tinta recessiva para grade e eixos; o texto nunca usa a cor das séries
    const INK = {
        primary: '#0b0b0b', secondary: '#52514e', muted: '#898781',
        grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff'
    };

    // Duas séries: conferidas no validador de paleta (ΔE 22,5 em protanopia, 33,8 normal)
    const SERIE = {
        normal: '#2a78d6',                 // azul médio da rampa do simulador
        outlier: '#e11d48',                // o mesmo vermelho da vista 3D e da tabela
        curva: '#1c1917',
        corte: '#d97706'
    };

    const QUANTIDADES = {
        d: {
            key: 'd', label: 'Resíduo ortogonal d', unidade: 'mm', casas: 2,
            eixo: 'resíduo d (mm)',
            valor: o => o.d * 1000
        },
        w: {
            key: 'w', label: 'Resíduo normalizado w', unidade: '', casas: 2,
            eixo: 'resíduo normalizado w',
            valor: o => o.w
        }
    };

    const DEFAULTS = {
        quantidade: 'd',
        bins: 10,
        curvaNormal: true,
        destacarOutliers: true,
        linhasCorte: true
    };

    // --- matemática pura ---------------------------------------------------------------

    function clampBins(n) {
        if (!Number.isFinite(n)) return DEFAULTS.bins;
        return Math.min(MAX_BINS, Math.max(MIN_BINS, Math.round(n)));
    }

    // Divide `valores` em `nBins` classes de largura igual. `flags[i]` verdadeiro conta a
    // observação como marcada, para a barra empilhada.
    function binResiduals(valores, nBins, flags) {
        const k = clampBins(nBins);
        const vs = valores.filter(Number.isFinite);
        if (!vs.length) return { bins: [], largura: 0, min: 0, max: 0, n: 0, k };

        let min = Math.min(...vs), max = Math.max(...vs);
        if (max - min < 1e-12) { min -= 0.5; max += 0.5; }   // todos iguais: abre uma faixa
        const largura = (max - min) / k;

        const bins = [];
        for (let i = 0; i < k; i++) {
            bins.push({ lo: min + i * largura, hi: min + (i + 1) * largura, n: 0, nOut: 0, idx: [] });
        }
        valores.forEach((v, i) => {
            if (!Number.isFinite(v)) return;
            // O valor igual ao máximo cairia em k; prende no último bin
            const j = Math.min(k - 1, Math.max(0, Math.floor((v - min) / largura)));
            bins[j].n++;
            if (flags && flags[i]) bins[j].nOut++;
            bins[j].idx.push(i);
        });
        return { bins, largura, min, max, n: vs.length, k };
    }

    // Momentos amostrais. Assimetria e curtose são as de Fisher (curtose em excesso: 0 na normal).
    function describe(valores) {
        const vs = valores.filter(Number.isFinite);
        const n = vs.length;
        if (!n) return { n: 0, media: 0, dp: 0, min: 0, max: 0, assimetria: 0, curtose: 0, sturges: MIN_BINS };
        const media = vs.reduce((s, v) => s + v, 0) / n;
        const s2 = n > 1 ? vs.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1) : 0;
        const dp = Math.sqrt(s2);
        let g1 = 0, g2 = 0;
        if (dp > 0) {
            g1 = vs.reduce((s, v) => s + ((v - media) / dp) ** 3, 0) / n;
            g2 = vs.reduce((s, v) => s + ((v - media) / dp) ** 4, 0) / n - 3;
        }
        return {
            n, media, dp, min: Math.min(...vs), max: Math.max(...vs),
            assimetria: g1, curtose: g2,
            sturges: clampBins(Math.ceil(1 + Math.log2(n)))
        };
    }

    // Curva normal já escalada à ÁREA DAS BARRAS: o eixo Y é contagem, não densidade, então
    // multiplica-se a densidade por n·largura para a curva pousar sobre o histograma.
    function normalCurve(mu, sigma, n, largura, x0, x1, passos = 160) {
        if (!(sigma > 0) || !(n > 0) || !(largura > 0)) return [];
        const escala = n * largura / (sigma * Math.sqrt(2 * Math.PI));
        const pts = [];
        for (let i = 0; i <= passos; i++) {
            const x = x0 + (x1 - x0) * i / passos;
            pts.push({ x, y: escala * Math.exp(-0.5 * ((x - mu) / sigma) ** 2) });
        }
        return pts;
    }

    // --- desenho -------------------------------------------------------------------------

    function niceStep(maxVal, alvo) {
        const bruto = Math.max(1, maxVal / alvo);
        const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
        const norm = bruto / pot;
        const passo = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
        return Math.max(1, Math.round(passo * pot));
    }

    // Retângulo com o topo arredondado; a base fica reta, ancorada na linha de base
    function barPath(ctx, x, y, w, h, r) {
        const rr = Math.max(0, Math.min(r, w / 2, h));
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
    }

    class ResidualHistogram {
        constructor(canvasId, tooltipId) {
            this.canvas = document.getElementById(canvasId);
            this.tooltip = tooltipId ? document.getElementById(tooltipId) : null;
            this.opts = Object.assign({}, DEFAULTS);
            this.result = null;
            this.dados = null;
            this._plot = null;
            if (this.canvas) {
                this.canvas.addEventListener('mousemove', e => this._onHover(e));
                this.canvas.addEventListener('mouseleave', () => this._hideTip());
            }
        }

        // `settings` vem junto porque o limiar da regra kσ mora lá, não no resultado
        setResult(result, settings) {
            this.result = result || null;
            if (settings) this.settings = settings;
            this.compute();
        }

        setOptions(patch) {
            Object.assign(this.opts, patch);
            if ('bins' in patch) this.opts.bins = clampBins(this.opts.bins);
            this.compute();
        }

        // Prepara valores, binagem e estatística para a grandeza escolhida
        compute() {
            this.dados = null;
            if (!this.result || !this.result.obsData || !this.result.obsData.length) return;

            const q = QUANTIDADES[this.opts.quantidade] || QUANTIDADES.d;
            const obs = this.result.obsData;
            const valores = obs.map(q.valor);
            // Marcados pela detecção que o usuário rodou — o mesmo critério da tabela e da 3D
            const flags = obs.map(o => !!(o.point && o.point.flagged));
            const hist = binResiduals(valores, this.opts.bins, flags);
            const est = describe(valores);

            // Referência: normal ajustada para d, N(0,1) teórica para w
            const teorica = q.key === 'w';
            const mu = teorica ? 0 : est.media;
            const sigma = teorica ? 1 : est.dp;

            this.dados = {
                q, valores, flags, hist, est, mu, sigma, teorica,
                marcados: flags.filter(Boolean).length,
                cortes: this._cortes(q, obs)
            };
        }

        // Onde desenhar o corte. Em w é uma linha exata; em d é uma FAIXA, porque o limiar da
        // regra kσ é |d|/σ_d por observação e σ_d varia muito entre visadas — chega a 333% numa
        // mesma amostra. Uma linha única em milímetros seria mentira.
        _cortes(q, obs) {
            if (q.key === 'w') {
                const c = this.result.critW;
                return Number.isFinite(c) ? { tipo: 'linha', valor: c } : null;
            }
            const k = (this.settings && this.settings.sigmaRuleK) || 3;
            const sig = obs.map(o => o.sigmaD * 1000).filter(Number.isFinite);
            if (!sig.length) return null;
            return { tipo: 'faixa', k, lo: k * Math.min(...sig), hi: k * Math.max(...sig) };
        }

        render() {
            if (!this.canvas) return;
            const ctx = this.canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
            this.canvas.width = Math.round(W * dpr);
            this.canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = INK.surface;
            ctx.fillRect(0, 0, W, H);
            this._plot = null;

            if (!this.dados) {
                ctx.fillStyle = INK.muted;
                ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Aguardando ajustamento...', W / 2, H / 2);
                return;
            }

            const d = this.dados, hist = d.hist;
            const pad = { l: 50, r: 18, t: 22, b: 42 };
            const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
            if (pw < 40 || ph < 40) return;

            // Domínio em x: os bins, alargados para caber a curva e os cortes
            let x0 = hist.min, x1 = hist.max;
            if (this.opts.curvaNormal) {
                x0 = Math.min(x0, d.mu - 3.5 * d.sigma);
                x1 = Math.max(x1, d.mu + 3.5 * d.sigma);
            }
            if (this.opts.linhasCorte && d.cortes) {
                const ext = d.cortes.tipo === 'linha' ? d.cortes.valor : d.cortes.hi;
                x0 = Math.min(x0, -ext * 1.05); x1 = Math.max(x1, ext * 1.05);
            }
            if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1; }

            const curva = this.opts.curvaNormal
                ? normalCurve(d.mu, d.sigma, hist.n, hist.largura, x0, x1) : [];
            const maxBarra = Math.max(1, ...hist.bins.map(b => b.n));
            const maxCurva = curva.length ? Math.max(...curva.map(p => p.y)) : 0;
            const yMaxBruto = Math.max(maxBarra, maxCurva);
            const passo = niceStep(yMaxBruto, 5);
            const yMax = Math.max(passo, Math.ceil(yMaxBruto / passo) * passo);

            const X = v => pad.l + (v - x0) / (x1 - x0) * pw;
            const Y = v => pad.t + ph - (v / yMax) * ph;

            // --- grade recessiva e eixos
            ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.strokeStyle = INK.grid;
            ctx.lineWidth = 1;
            ctx.fillStyle = INK.muted;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let v = 0; v <= yMax; v += passo) {
                const y = Math.round(Y(v)) + 0.5;
                ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
                ctx.fillText(String(v), pad.l - 8, y);
            }
            ctx.strokeStyle = INK.axis;
            ctx.beginPath();
            ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph);
            ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();

            // --- faixa ou linhas de corte, atrás das barras
            if (this.opts.linhasCorte && d.cortes) {
                if (d.cortes.tipo === 'faixa') {
                    ctx.fillStyle = 'rgba(217,119,6,0.10)';
                    [[-d.cortes.hi, -d.cortes.lo], [d.cortes.lo, d.cortes.hi]].forEach(([a, b]) => {
                        const xa = X(Math.max(a, x0)), xb = X(Math.min(b, x1));
                        if (xb > xa) ctx.fillRect(xa, pad.t, xb - xa, ph);
                    });
                } else {
                    ctx.strokeStyle = SERIE.corte;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    [-d.cortes.valor, d.cortes.valor].forEach(v => {
                        if (v < x0 || v > x1) return;
                        const x = Math.round(X(v)) + 0.5;
                        ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
                    });
                    ctx.setLineDash([]);
                }
            }

            // --- barras, com 2 px de vão entre elas e entre os segmentos empilhados
            const GAP = 2, RAIO = 4;
            const barras = [];
            hist.bins.forEach(b => {
                const xa = X(b.lo), xb = X(b.hi);
                const larg = Math.max(1, xb - xa - GAP);
                const xi = xa + GAP / 2;
                const base = pad.t + ph;
                const hTotal = (b.n / yMax) * ph;
                const nOut = this.opts.destacarOutliers ? b.nOut : 0;
                const nNorm = b.n - nOut;
                const hNorm = (nNorm / yMax) * ph;
                const hOut = (nOut / yMax) * ph;
                barras.push({ bin: b, xi, larg, base, hTotal });
                if (b.n === 0) return;

                if (nOut > 0) {
                    // segmento marcado no topo, com o vão de 2 px separando do de baixo
                    ctx.fillStyle = SERIE.outlier;
                    barPath(ctx, xi, base - hTotal, larg, Math.max(1, hOut - (nNorm ? GAP : 0)), RAIO);
                    ctx.fill();
                }
                if (nNorm > 0) {
                    ctx.fillStyle = SERIE.normal;
                    barPath(ctx, xi, base - hNorm, larg, hNorm, nOut > 0 ? 0 : RAIO);
                    ctx.fill();
                }
            });
            this._plot = { barras, pad, pw, ph, X, Y, x0, x1, yMax };

            // --- curva normal por cima, 2 px
            if (curva.length) {
                ctx.strokeStyle = SERIE.curva;
                ctx.lineWidth = 2;
                ctx.beginPath();
                curva.forEach((p, i) => {
                    const x = X(p.x), y = Y(p.y);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();
            }

            // --- rótulos dos eixos
            ctx.fillStyle = INK.secondary;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
            const casas = Math.abs(x1 - x0) < 5 ? 1 : 0;
            const nRot = Math.min(9, hist.k + 1);
            for (let i = 0; i <= nRot; i++) {
                const v = x0 + (x1 - x0) * i / nRot;
                // Number() antes do toFixed mata o "-0" que aparece em valores quase nulos
                ctx.fillText(Number(v.toFixed(casas)).toFixed(casas), X(v), pad.t + ph + 16);
            }
            ctx.fillStyle = INK.muted;
            ctx.fillText(d.q.eixo, pad.l + pw / 2, H - 6);
            ctx.save();
            ctx.translate(13, pad.t + ph / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('observações', 0, 0);
            ctx.restore();

            this._legenda(ctx, pad, pw);
        }

        // Duas séries pedem legenda: a identidade nunca pode depender só da cor
        _legenda(ctx, pad, pw) {
            const d = this.dados;
            const itens = [{ cor: SERIE.normal, texto: 'observações' }];
            if (this.opts.destacarOutliers && d.marcados) {
                itens.push({ cor: SERIE.outlier, texto: `marcadas (${d.marcados})` });
            }
            if (this.opts.curvaNormal) {
                itens.push({
                    cor: SERIE.curva, linha: true,
                    texto: d.teorica ? 'N(0,1) teórica' : 'normal ajustada'
                });
            }
            ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const larguras = itens.map(it => ctx.measureText(it.texto).width + 22);
            let x = pad.l + pw - larguras.reduce((s, v) => s + v, 0);
            const y = 10;
            itens.forEach((it, i) => {
                if (it.linha) {
                    ctx.strokeStyle = it.cor; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y); ctx.stroke();
                } else {
                    ctx.fillStyle = it.cor;
                    ctx.fillRect(x, y - 5, 14, 10);
                }
                ctx.fillStyle = INK.secondary;          // o texto usa tinta, nunca a cor da série
                ctx.fillText(it.texto, x + 19, y);
                x += larguras[i];
            });
        }

        // --- interação -------------------------------------------------------------------

        _onHover(ev) {
            if (!this._plot || !this.tooltip || !this.dados) return;
            const r = this.canvas.getBoundingClientRect();
            const px = ev.clientX - r.left, py = ev.clientY - r.top;
            const p = this._plot;
            if (px < p.pad.l || px > p.pad.l + p.pw || py < p.pad.t || py > p.pad.t + p.ph) {
                return this._hideTip();
            }
            // Alvo maior que a marca: basta estar na coluna do bin
            const alvo = p.barras.find(b => px >= b.xi - 1 && px <= b.xi + b.larg + 1);
            if (!alvo) return this._hideTip();

            const q = this.dados.q;
            const b = alvo.bin;
            const ids = b.idx.map(i => this.dados.valores[i]);
            const linhas = [
                `<strong>${b.lo.toFixed(q.casas)} a ${b.hi.toFixed(q.casas)}${q.unidade ? ' ' + q.unidade : ''}</strong>`,
                `${b.n} observaç${b.n === 1 ? 'ão' : 'ões'}` +
                (b.nOut ? ` · <span style="color:${SERIE.outlier}">${b.nOut} marcada${b.nOut > 1 ? 's' : ''}</span>` : ''),
                b.n ? `${(100 * b.n / this.dados.hist.n).toFixed(1)}% do total` : ''
            ].filter(Boolean);
            if (b.n && b.n <= 4) {
                linhas.push(`<span style="color:${INK.muted}">${ids.map(v => v.toFixed(q.casas)).join(' · ')}</span>`);
            }
            this.tooltip.innerHTML = linhas.join('<br>');
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = Math.min(px + 14, this.canvas.clientWidth - 160) + 'px';
            this.tooltip.style.top = Math.max(py - 10, 0) + 'px';
        }

        _hideTip() { if (this.tooltip) this.tooltip.style.display = 'none'; }
    }

    return {
        MIN_BINS, MAX_BINS, DEFAULTS, INK, SERIE, QUANTIDADES,
        clampBins, binResiduals, describe, normalCurve, niceStep,
        ResidualHistogram
    };
});
