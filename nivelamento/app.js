// --- Application Logic ---
const app = {
    canvas: null,
    ctx: null,
    points: [], // Points (fixed or calculated)
    observations: [],
    adjResults: null,
    insertMode: null,
    _mapTransform: null,
    _pendingPoint: null,
    _userZoom: 1,
    _userPan: { x: 0, y: 0 },
    _mcZoom: 1,
    _mcPan: { x: 0, y: 0 },
    mcPts: [],
    mcStats: [],

    // Constants
    SIGMA_DIST_MM: 5, // mm / sqrt(km)
    ALPHA_PCT: 5,
    CRIT_W_TEST: 2.5758, // Z for 1 - alpha/2
    NON_CENTRALITY: 3.4174, // Z(1-alpha/2) + Z(beta=0.8)

    init() {
        this.canvas = document.getElementById('networkCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('click', e => this.canvasClick(e));
        this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
        const mcCanvas = document.getElementById('mcCanvas');
        if (mcCanvas) mcCanvas.addEventListener('wheel', e => this.onMcWheel(e), { passive: false });

        // Reset range inputs to defaults to prevent browser form caching from restoring stale values
        const sigLin = document.getElementById('simSigLin');
        if (sigLin) {
            sigLin.value = 0;
            document.getElementById('simSigLinVal').textContent = '0.0';
        }

        const ellipseExag = document.getElementById('ellipseExag');
        if (ellipseExag) {
            ellipseExag.value = 10;
            document.getElementById('ellipseExagVal').textContent = '10.0\u00d7';
        }

        const blunderPct = document.getElementById('blunderPct');
        if (blunderPct) {
            blunderPct.value = 10;
            document.getElementById('blunderPctVal').textContent = '10\u03C3';
        }

        const aprioriDistMm = document.getElementById('aprioriDistMm');
        if (aprioriDistMm) {
            aprioriDistMm.value = 5;
            document.getElementById('aprioriDistMmVal').textContent = '5.0';
        }
        const aprioriAlpha = document.getElementById('aprioriAlpha');
        if (aprioriAlpha) {
            aprioriAlpha.value = 5;
            document.getElementById('aprioriAlphaVal').textContent = '5.0%';
        }

        this.updateApriori();
        this.generateNetwork();
    },

    updateApriori() {
        const distMmEl = document.getElementById('aprioriDistMm');
        const alphaEl = document.getElementById('aprioriAlpha');

        if (distMmEl) this.SIGMA_DIST_MM = parseFloat(distMmEl.value);
        if (alphaEl) {
            this.ALPHA_PCT = parseFloat(alphaEl.value);
            const alpha = this.ALPHA_PCT / 100;
            this.CRIT_W_TEST = this.normInv(1 - alpha / 2);
            this.NON_CENTRALITY = this.CRIT_W_TEST + 0.8416212335; // Power 80% (Z_0.8)
            const wDisp = document.getElementById('wTestLimitDisplay');
            if (wDisp) wDisp.textContent = `(Limite Crítico |w| > ${this.CRIT_W_TEST.toFixed(2)})`;
        }

        if (!this.observations) return;

        this.observations.forEach(obs => {
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (!pFrom || !pTo) return;
            const dx = pTo.x - pFrom.x;
            const dy = pTo.y - pFrom.y;
            const dist = Math.sqrt(dx*dx + dy*dy); // 2D distance for weight

            obs.std = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(dist / 1000);
        });

        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
    },

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height || 500;
        if(this.points.length > 0) this.drawNetwork();
    },

    // Generates a random realistic network geometry
    generateNetwork() {
        this.adjResults = null;
        // Generate a sample leveling network with some fixed and some unknown points
        this.points = [
            { id: 'RN1', x: 800, y: 800, fixed: true, H: 100.000, true_H: 100.000, _H0: 100.000 },
            { id: 'P1', x: 1000, y: 900, fixed: false, H: 101.5, true_H: 101.500, _H0: 101.500 },
            { id: 'P2', x: 1100, y: 1100, fixed: false, H: 103.2, true_H: 103.200, _H0: 103.200 },
            { id: 'RN2', x: 900, y: 1200, fixed: true, H: 105.000, true_H: 105.000, _H0: 105.000 },
            { id: 'P3', x: 1200, y: 950, fixed: false, H: 102.8, true_H: 102.800, _H0: 102.800 }
        ];

        // Define observation lines (from -> to)
        const lines = [
            ['RN1', 'P1'],
            ['P1', 'P2'],
            ['P2', 'RN2'],
            ['P1', 'P3'],
            ['P3', 'P2'],
            ['RN1', 'P3']
        ];

        this.generateObservations(lines);
        this.updateUI_Clear();
        this.setInsertMode(null);
        this._userZoom = 1;
        this._userPan = { x: 0, y: 0 };
        this.drawNetwork();
    },

    generateObservations(lines = null) {
        this.observations = [];
        let autoLines = lines;

        // If no lines provided, connect everything to everything for manual points (naive graph)
        if (!autoLines) {
            autoLines = [];
            for (let i = 0; i < this.points.length; i++) {
                for (let j = i + 1; j < this.points.length; j++) {
                    const p1 = this.points[i];
                    const p2 = this.points[j];
                    // Only connect if explicitly specified in connections array of either point
                    if ((p1.connections && p1.connections.includes(p2.id)) ||
                        (p2.connections && p2.connections.includes(p1.id))) {
                        autoLines.push([p1.id, p2.id]);
                    }
                }
            }
        }

        autoLines.forEach(line => {
            const pFrom = this.points.find(p => p.id === line[0]);
            const pTo = this.points.find(p => p.id === line[1]);
            if (!pFrom || !pTo) return;

            const dx = pTo.x - pFrom.x;
            const dy = pTo.y - pFrom.y;
            const trueDist = Math.sqrt(dx*dx + dy*dy);

            const trueH_from = (pFrom.true_H != null) ? pFrom.true_H : pFrom.H;
            const trueH_to = (pTo.true_H != null) ? pTo.true_H : pTo.H;

            const trueDH = trueH_to - trueH_from;

            const stdDist = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(trueDist / 1000);

            const n1 = this.randn_bm();

            const obsDH = trueDH + n1 * stdDist;

            this.observations.push({
                id: `\u0394H_${pFrom.id}-${pTo.id}`, type: 'dh',
                from: pFrom.id, to: pTo.id,
                val: obsDH, std: stdDist, hasError: false,
                _baseVal: obsDH, _blunderOffset: 0, _simNoise: 0,
                idx: this.observations.length,
                distance: trueDist
            });
        });
    },

    randn_bm() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },

    normInv(p) {
        const a1 = -39.69683028665376, a2 = 220.9460984245205, a3 = -275.9285104469687, a4 = 138.3577518672690, a5 = -30.66479806614716, a6 = 2.506628277459239;
        const b1 = -54.47609879822406, b2 = 161.5858368580409, b3 = -155.6989798598866, b4 = 66.80131188771972, b5 = -13.28068155288572;
        const c1 = -0.007784894002430293, c2 = -0.3223964580411365, c3 = -2.400758277161838, c4 = -2.549732539343734, c5 = 4.374664141464968, c6 = 2.938163982698783;
        const d1 = 0.007784695709041462, d2 = 0.3224671290700398, d3 = 2.445134137142996, d4 = 3.754408661907416;
        const p_low = 0.02425;
        let q, r;
        if (p < p_low) {
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else if (p <= 1 - p_low) {
            q = p - 0.5; r = q * q;
            return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
        } else {
            q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        }
    },

    injectOutlier() {
        if (this.observations.length === 0) return;
        // Randomly pre-select one eligible (no existing error) observation
        const eligible = this.observations.map((o, i) => i).filter(i => !this.observations[i].hasError);
        const preSelected = eligible.length > 0
            ? eligible[Math.floor(Math.random() * eligible.length)]
            : -1;
        // Build observation list for the modal
        const list = document.getElementById('blunderObsList');
        list.innerHTML = '';
        this.observations.forEach((obs, idx) => {
            const valDisplay = obs.val.toFixed(4) + ' m';
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none';
            const checked = (idx === preSelected) ? ' checked' : '';
            label.innerHTML = `
                <input type="checkbox" class="blunderObsCheck accent-rose-500" value="${idx}"${obs.hasError ? ' disabled' : checked}>
                <span class="font-mono">${obs.id}</span>
                <span class="text-stone-400">(${valDisplay}${obs.hasError ? ' — já contém erro' : ''})</span>
            `;
            list.appendChild(label);
        });
        // Reset slider display
        const pctInput = document.getElementById('blunderPct');
        document.getElementById('blunderPctVal').textContent = pctInput.value + '\u03C3';
        document.getElementById('blunderModal').style.display = 'flex';
    },

    closeBlunderModal() {
        document.getElementById('blunderModal').style.display = 'none';
    },

    confirmBlunder() {
        const selected = Array.from(document.querySelectorAll('.blunderObsCheck:checked'))
            .map(c => parseInt(c.value));
        if (selected.length === 0) {
            alert('Selecione ao menos uma observação candidata.');
            return;
        }
        const k = parseFloat(document.getElementById('blunderPct').value);
        const injected = [];
        selected.forEach(idx => {
            const obs = this.observations[idx];
            const magnitude = obs.std * k;
            const sign = Math.random() > 0.5 ? 1 : -1;
            obs._blunderOffset = sign * magnitude;
            obs.val = obs._baseVal + obs._blunderOffset + (obs._simNoise || 0);
            obs.hasError = true;
            const errDisplay = (magnitude * 1000).toFixed(3) + ' mm';
            injected.push(`${obs.id}: ${errDisplay}`);
        });
        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
        this.closeBlunderModal();
        alert(`Erros grosseiros injetados (${k}σ):\n${injected.join('\n')}\n\nExecute o ajustamento para detectar os outliers.`);
    },

    runAdjustment() {
        const unknowns = this.points.filter(p => !p.fixed);
        if (unknowns.length === 0) {
            alert('Não há pontos desconhecidos para ajustar.');
            return;
        }
        if (this.observations.length === 0) {
            alert('Sem observações. Verifique as conexões.');
            return;
        }

        // Re-sample Gaussian noise on every run; if sigma=0 no noise is added
        const sigLin = parseFloat(document.getElementById('simSigLin').value) / 1000; // mm/sqrt(km) -> m/sqrt(km)
        this.observations.forEach(obs => {
            obs._simNoise = sigLin > 0 ? this.randn_bm() * sigLin * Math.sqrt(obs.distance / 1000) : 0;
            obs.val = (obs._baseVal || obs.val) + (obs._blunderOffset || 0) + obs._simNoise;
        });

        const nu = unknowns.length; // total unknowns (H per station)
        const m  = this.observations.length;
        const dof = m - nu;

        if (dof < 1) {
            alert(`Redundância insuficiente: ${m} observações para ${nu} incógnitas. Adicione mais conexões.`);
            return;
        }

        // Diagonal weight matrix P
        const P = this.observations.map(() => Array(m).fill(0));
        this.observations.forEach((o, i) => P[i][i] = 1.0 / (o.std * o.std));

        // Map unknown point id → column index k
        const unkIdx = {};
        unknowns.forEach((p, k) => { unkIdx[p.id] = k; });

        // Reset points to initial approximations
        this.points.forEach(p => { if (!p.fixed && p._H0 != null) { p.H = p._H0; } });

        // Linear system: A is constant for leveling networks
        // A(i,k) = 1 if point k is the 'to' point, -1 if 'from' point, 0 otherwise
        const A = this.observations.map(() => Array(nu).fill(0));
        const L = [];

        this.observations.forEach((o, i) => {
            const pFrom = this.points.find(p => p.id === o.from);
            const pTo = this.points.find(p => p.id === o.to);

            if (!pFrom.fixed) A[i][unkIdx[pFrom.id]] = -1;
            if (!pTo.fixed) A[i][unkIdx[pTo.id]] = 1;

            const calcDH = pTo.H - pFrom.H;
            L.push([o.val - calcDH]); // linear observation equation misclosure
        });

        const At  = math.transpose(A);
        const AtP = math.multiply(At, P);
        const N   = math.multiply(AtP, A); // nu × nu
        const U   = math.multiply(AtP, L); // nu × 1

        let dx_vec;
        try {
            let sol = math.lusolve(N, U);
            dx_vec = typeof sol.toArray === 'function' ? sol.toArray() : sol; // nu × 1
        } catch(e) {
            console.error(e);
            alert('Erro Matemático: Geometria fraca ou singular no sistema de equações normais.');
            return;
        }

        // Apply corrections
        unknowns.forEach((p, k) => {
            p.H += dx_vec[k][0];
        });

        // --- Post-adjustment quality control ---

        // Recompute residuals
        const V = [];
        this.observations.forEach((o) => {
            const pFrom = this.points.find(p => p.id === o.from);
            const pTo = this.points.find(p => p.id === o.to);
            const computedDH = pTo.H - pFrom.H;
            V.push([computedDH - o.val]);
        });

        const VtPV = math.multiply(math.multiply(math.transpose(V), P), V)[0][0];
        const sigma02 = VtPV / dof;
        const sigma0  = Math.sqrt(sigma02);

        // Full Qxx (nu × nu)
        const AtP_f = math.multiply(math.transpose(A), P);
        const N_f   = math.multiply(AtP_f, A);
        const Qxx   = math.inv(N_f);

        // Residual cofactor Qv = P⁻¹ − A Qxx Aᵀ
        const Qv = math.subtract(
            math.inv(P),
            math.multiply(math.multiply(A, Qxx), math.transpose(A))
        );

        // Chi-square critical values
        const z_alpha = this.CRIT_W_TEST; // z for 1 - alpha/2
        const chi2_upper = dof * Math.pow(1 - 2/(9*dof) + z_alpha * Math.sqrt(2/(9*dof)), 3);
        const chi2_lower = Math.max(0, dof * Math.pow(1 - 2/(9*dof) - z_alpha * Math.sqrt(2/(9*dof)), 3));
        const globalPass = VtPV >= chi2_lower && VtPV <= chi2_upper;

        const obsData = this.observations.map((o, i) => {
            const v        = V[i][0];
            const sigma_vi = Math.sqrt(Math.max(0, Qv[i][i]));
            const w        = sigma_vi > 0 ? v / (sigma0 * sigma_vi) : NaN;
            const r_i      = Qv[i][i] * P[i][i];
            const mdb      = (this.NON_CENTRALITY * o.std) / Math.sqrt(r_i);

            // External reliability: elevation displacement caused by undetected MDB
            const ext = Qxx.map(row => row.reduce((s, q, j) => s + q * A[i][j] * P[i][i] * mdb, 0));
            return { obs: o, v, sigma_v: sigma_vi, w, r: r_i, mdb, ext, isOutlier: Math.abs(w) > this.CRIT_W_TEST };
        });

        // Extract per-point Qxx (1x1) + external reliability
        const stationResults = unknowns.map((p, k) => {
            const QxxBlock = Qxx[k][k];
            let maxExtMag = 0, maxExtObs = null;
            obsData.forEach(r => {
                const dH = Math.abs(r.ext[k]);
                if (dH > maxExtMag) { maxExtMag = dH; maxExtObs = r.obs.id; }
            });
            return { stationId: p.id, H: p.H, QxxBlock, maxExtMag, maxExtObs };
        });

        this.adjResults = { VtPV, dof, sigma02, sigma0, globalPass, chi2lim: chi2_upper, chi2low: chi2_lower, obsData, stationResults };
        this.updateUI_Results();
        this.drawNetwork();
    },

    // --- Drawing / Canvas Logic ---
    drawNetwork() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        // If no points yet, show a placeholder hint
        if (this.points.length === 0) {
            ctx.fillStyle = '#a8a29e';
            ctx.font = '13px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Clique em Adicionar Ponto para começar.', w / 2, h / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Find bounding box
        let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
        this.points.forEach(p => {
            if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
        });

        // Add padding
        const pad = 100;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const scale = Math.min(w / rangeX, h / rangeY);

        // Save transform for canvas→geo coordinate conversion
        this._mapTransform = { minX, minY, scale, h };

        const toCanvas = (geoX, geoY) => {
            // Geodetic Y is North (up). Canvas Y is down.
            // Apply base fit-to-content transform, then user zoom/pan.
            const bx = (geoX - minX) * scale;
            const by = h - ((geoY - minY) * scale);
            return {
                cx: bx * this._userZoom + this._userPan.x,
                cy: by * this._userZoom + this._userPan.y
            };
        };

        // Draw grid
        ctx.strokeStyle = '#f5f5f4';
        ctx.lineWidth = 1;
        for(let i=0; i<w; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
        for(let i=0; i<h; i+=50) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }

        // Draw leveling lines
        this.observations.forEach(obs => {
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (!pFrom || !pTo) return;

            const cFrom = toCanvas(pFrom.x, pFrom.y);
            const cTo = toCanvas(pTo.x, pTo.y);

            let isOutlierLine = false;
            if (this.adjResults) {
                isOutlierLine = this.adjResults.obsData.some(res => res.obs.id === obs.id && res.isOutlier);
            }

            ctx.beginPath();
            ctx.moveTo(cFrom.cx, cFrom.cy);
            ctx.lineTo(cTo.cx, cTo.cy);

            if (isOutlierLine) {
                ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
            } else {
                ctx.strokeStyle = 'rgba(120, 113, 108, 0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw small arrow to indicate direction
            const angle = Math.atan2(cTo.cy - cFrom.cy, cTo.cx - cFrom.cx);
            const midX = (cFrom.cx + cTo.cx) / 2;
            const midY = (cFrom.cy + cTo.cy) / 2;
            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(midX - 5 * Math.cos(angle - Math.PI/6), midY - 5 * Math.sin(angle - Math.PI/6));
            ctx.lineTo(midX - 5 * Math.cos(angle + Math.PI/6), midY - 5 * Math.sin(angle + Math.PI/6));
            ctx.closePath();
            ctx.fillStyle = isOutlierLine ? 'rgba(244, 63, 94, 0.8)' : 'rgba(120, 113, 108, 0.6)';
            ctx.fill();
        });

        // Draw Points
        this.points.forEach(pt => {
            const pc = toCanvas(pt.x, pt.y);

            // Error bar for adjusted points
            if (this.adjResults && !pt.fixed) {
                const pResult = this.adjResults.stationResults.find(r => r.stationId === pt.id);
                if (pResult) {
                    const stdH = Math.sqrt(pResult.QxxBlock);
                    const ellipseExag = parseFloat(document.getElementById('ellipseExag')?.value) || 10;
                    const vizScale = 5000 * scale * ellipseExag;
                    const barH = stdH * vizScale;

                    ctx.beginPath();
                    ctx.moveTo(pc.cx, pc.cy - barH);
                    ctx.lineTo(pc.cx, pc.cy + barH);
                    ctx.strokeStyle = '#0f766e';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(pc.cx - 3, pc.cy - barH);
                    ctx.lineTo(pc.cx + 3, pc.cy - barH);
                    ctx.moveTo(pc.cx - 3, pc.cy + barH);
                    ctx.lineTo(pc.cx + 3, pc.cy + barH);
                    ctx.stroke();
                }
            }

            if (pt.fixed) {
                ctx.fillStyle = '#292524'; // Stone-800
                ctx.beginPath();
                ctx.rect(pc.cx - 5, pc.cy - 5, 10, 10);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(pc.cx, pc.cy, 5, 0, 2*Math.PI);
                ctx.fillStyle = '#14b8a6'; // Teal
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.font = '10px Inter';
            ctx.fillStyle = '#292524';
            ctx.fillText(pt.id, pc.cx + 8, pc.cy - 8);

            // Draw H value
            ctx.font = '9px JetBrains Mono';
            ctx.fillStyle = '#57534e';
            ctx.fillText(`H: ${pt.H.toFixed(3)}`, pc.cx + 8, pc.cy + 4);
        });
    },

    // --- UI Updaters ---
    updateUI_Clear() {
        document.getElementById('panelGlobalTest').innerHTML = `
            <h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>
            <div class="text-center py-4"><p class="text-xs text-stone-400">Aguardando ajustamento...</p></div>`;

        document.querySelector('#tableResiduals tbody').innerHTML = `<tr><td colspan="6" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
        document.querySelector('#tableReliability tbody').innerHTML = `<tr><td colspan="4" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
        document.querySelector('#tableCoords tbody').innerHTML = `<tr><td colspan="5" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
    },

    updateUI_Results() {
        const res = this.adjResults;

        // 1. Global Test Panel
        const panel = document.getElementById('panelGlobalTest');
        const color = res.globalPass ? 'text-teal-600' : 'text-rose-600';
        const bg    = res.globalPass ? 'bg-teal-50 border-teal-200' : 'bg-rose-50 border-rose-200';
        const icon  = res.globalPass ? '&#10003; Aprovado' : '&#10007; Falhou';
        panel.innerHTML = `
            <h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>
            <div class="p-3 rounded-lg border ${bg} text-center mb-3">
                <span class="font-bold ${color}">${icon}</span>
            </div>
            <div class="space-y-1 text-sm text-stone-600 font-mono">
                <div class="flex justify-between"><span>V<sup>T</sup>PV:</span> <span class="font-bold">${res.VtPV.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&chi;&sup2; inf (&alpha;=${this.ALPHA_PCT}%):</span> <span>${res.chi2low.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&chi;&sup2; sup (&alpha;=${this.ALPHA_PCT}%):</span> <span>${res.chi2lim.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&sigma;&sup2;<sub>0</sub>:</span> <span>${res.sigma02.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&sigma;<sub>0</sub>:</span> <span>${res.sigma0.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>Graus de Liberdade:</span> <span>${res.dof}</span></div>
            </div>
            ${!res.globalPass ? '<p class="text-xs text-rose-600 mt-3">Anomalia detectada na rede. Analise o teste de Baarda abaixo.</p>' : ''}`;

        // 2. Residuals Table
        const tbRes = document.querySelector('#tableResiduals tbody');
        tbRes.innerHTML = '';
        res.obsData.forEach(r => {
            const tr = document.createElement('tr');
            const badge = r.isOutlier
                ? '<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold border border-rose-200">OUTLIER</span>'
                : '<span class="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs border border-teal-200">OK</span>';

            const wColor = r.isOutlier ? 'text-rose-600 font-bold' : '';

            const obsDisplay  = r.obs.val.toFixed(4) + ' m';
            const vDisplay    = (r.v * 1000).toFixed(3) + ' mm';
            const svDisplay   = (r.sigma_v * 1000).toFixed(3) + ' mm';

            const injectedIcon = r.obs.hasError ? ' <span class="text-rose-500" title="Erro Grosseiro Injetado">&#9888;</span>' : '';

            tr.innerHTML = `
                <td class="font-mono">${r.obs.id}${injectedIcon}</td>
                <td class="font-mono">${obsDisplay}</td>
                <td class="font-mono">${vDisplay}</td>
                <td class="font-mono">${svDisplay}</td>
                <td class="font-mono ${wColor}">${Math.abs(r.w).toFixed(2)}</td>
                <td>${badge}</td>
            `;
            tbRes.appendChild(tr);
        });

        // 3. Reliability Table
        const tbRel = document.querySelector('#tableReliability tbody');
        tbRel.innerHTML = '';
        res.obsData.forEach(r => {
            const tr = document.createElement('tr');

            // Color code redundancy (r > 0.5 is good, r < 0.1 is dangerous)
            let rColor = 'text-teal-600';
            let rQual = 'Boa';
            if(r.r < 0.3) { rColor = 'text-amber-500'; rQual = 'Média'; }
            if(r.r < 0.1) { rColor = 'text-rose-600 font-bold'; rQual = 'Crítica (Sem Controlo)'; }

            const mdbDisplay = (r.mdb * 1000).toFixed(3) + ' mm';

            const injectedIcon = r.obs.hasError ? ' <span class="text-rose-500" title="Erro Grosseiro Injetado">&#9888;</span>' : '';

            tr.innerHTML = `
                <td class="font-mono">${r.obs.id}${injectedIcon}</td>
                <td class="font-mono ${rColor}">${r.r.toFixed(3)}</td>
                <td class="font-mono">${mdbDisplay}</td>
                <td class="${rColor} text-xs uppercase font-semibold">${rQual}</td>
            `;
            tbRel.appendChild(tr);
        });

        // 4. Coordinates Table
        const tbCoords = document.querySelector('#tableCoords tbody');
        tbCoords.innerHTML = '';
        res.stationResults.forEach(sr => {
            const tr = document.createElement('tr');
            const sigH_pri = Math.sqrt(sr.QxxBlock) * 1000; // mm (a-priori)
            const sigH_pos = res.sigma0 * sigH_pri; // mm (a-posteriori)
            const extMm = sr.maxExtMag * 1000; // mm
            tr.innerHTML = `
                <td class="font-mono font-bold">${sr.stationId}</td>
                <td class="font-mono">${sr.H.toFixed(4)}</td>
                <td class="font-mono">${sigH_pri.toFixed(3)} <span class="text-stone-400 text-[10px]">(${sigH_pos.toFixed(3)})</span></td>
                <td class="font-mono">${extMm.toFixed(3)}</td>
                <td class="font-mono text-stone-400 text-xs">${sr.maxExtObs || '—'}</td>
            `;
            tbCoords.appendChild(tr);
        });
    },

    // --- Point Insertion Methods ---

    geoFromCanvas(cx, cy) {
        if (!this._mapTransform) return { x: 0, y: 0 };
        const { minX, minY, scale, h } = this._mapTransform;
        // Reverse user zoom/pan, then reverse base transform
        const bx = (cx - this._userPan.x) / this._userZoom;
        const by = (cy - this._userPan.y) / this._userZoom;
        return {
            x: bx / scale + minX,
            y: (h - by) / scale + minY
        };
    },

    canvasClick(event) {
        if (!this.insertMode) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const cx = event.offsetX * scaleX;
        const cy = event.offsetY * scaleY;
        const geo = this.geoFromCanvas(cx, cy);
        this.openPointModal('Point', geo.x, geo.y);
    },

    setInsertMode(type) {
        const btnA = document.getElementById('btnInsertA');
        const hint = document.getElementById('insertModeHint');

        this.insertMode = (this.insertMode === type) ? null : type;

        if (btnA) btnA.classList.toggle('insert-btn-active', this.insertMode === 'Point');
        if (this.canvas) this.canvas.style.cursor = this.insertMode ? 'crosshair' : 'default';
        if (hint) hint.classList.toggle('hidden', !this.insertMode);
    },

    openPointModal(type, geoX, geoY) {
        this._pendingPoint = { type, geoX, geoY };
        document.getElementById('modalTitle').textContent = 'Novo Ponto de Nivelamento';

        const defaultId = 'P' + (this.points.length + 1);

        let bodyHTML = `
            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Identificador</label>
                <input id="modalInputId" type="text" value="${defaultId}"
                    class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-stone-600 mb-1">E (X) para Vis. (m)</label>
                    <input id="modalInputX" type="number" step="0.1" value="${geoX.toFixed(1)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-stone-600 mb-1">N (Y) para Vis. (m)</label>
                    <input id="modalInputY" type="number" step="0.1" value="${geoY.toFixed(1)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
            </div>

            <div class="pt-2 border-t border-stone-100">
                <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                    <input type="checkbox" id="modalInputFixed" class="accent-teal-600 w-4 h-4" onchange="document.getElementById('modalInputH').disabled = !this.checked; if(!this.checked) document.getElementById('modalInputH').value = '100.000';" />
                    <span class="font-bold">Ponto Fixo (Altitude Conhecida)</span>
                </label>
            </div>

            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Altitude Inicial / Fixa H (m)</label>
                <input id="modalInputH" type="number" step="0.001" value="100.000" disabled
                    class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500 disabled:bg-stone-100 disabled:text-stone-400" />
            </div>`;

        if (this.points.length > 0) {
            bodyHTML += `
            <div class="mt-4 pt-4 border-t border-stone-100">
                <label class="block text-xs font-semibold text-stone-600 mb-2">Conectar a (Trechos de Nivelamento):</label>
                <div class="space-y-1 max-h-40 overflow-y-auto border border-stone-100 rounded p-2 bg-stone-50">`;
            this.points.forEach(pt => {
                bodyHTML += `
                <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                    <input type="checkbox" class="connCheck accent-teal-600" value="${pt.id}" />
                    ${pt.id} (H: ${pt.H.toFixed(3)})
                </label>`;
            });
            bodyHTML += `
                </div>
            </div>`;
        }

        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('pointModal').classList.add('active');
    },

    confirmPoint() {
        const pending = this._pendingPoint;
        if (!pending) return;

        const id = document.getElementById('modalInputId').value.trim();
        if (!id) { alert('O identificador não pode ser vazio.'); return; }

        if (this.points.some(p => p.id === id)) {
            alert(`Já existe um ponto com o ID "${id}". Escolha outro identificador.`);
            return;
        }

        const xVal = parseFloat(document.getElementById('modalInputX').value);
        const yVal = parseFloat(document.getElementById('modalInputY').value);
        const fixed = document.getElementById('modalInputFixed').checked;
        const hVal = parseFloat(document.getElementById('modalInputH').value);

        if (isNaN(xVal) || isNaN(yVal) || isNaN(hVal)) { alert('Valores numéricos inválidos.'); return; }

        const checkboxes = document.querySelectorAll('#modalBody .connCheck:checked');
        const connections = Array.from(checkboxes).map(cb => cb.value);

        this.points.push({
            id,
            x: xVal,
            y: yVal,
            fixed: fixed,
            H: hVal,
            true_H: hVal,
            _H0: hVal,
            connections
        });

        if (connections.length > 0) {
            this.adjResults = null;
            this.generateObservations();
            this.updateUI_Clear();
        }

        this.closeModal();
        this.drawNetwork();
    },

    closeModal() {
        document.getElementById('pointModal').classList.remove('active');
        this._pendingPoint = null;
        this.setInsertMode(null);
    },

    fitNetwork() {
        this._userZoom = 1;
        this._userPan = { x: 0, y: 0 };
        this.drawNetwork();
    },

    onWheel(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        // Mouse position in canvas pixel space
        const mx = event.offsetX * scaleX;
        const my = event.offsetY * scaleY;
        const factor = event.deltaY < 0 ? 1.1 : (1 / 1.1);
        // Zoom centered on mouse: keep the point under the cursor stationary
        this._userPan.x = mx + (this._userPan.x - mx) * factor;
        this._userPan.y = my + (this._userPan.y - my) * factor;
        this._userZoom *= factor;
        this.drawNetwork();
    },

    fitMcNetwork() {
        this._mcZoom = 1;
        this._mcPan = { x: 0, y: 0 };
        this.drawMonteCarlo();
    },

    onMcWheel(event) {
        event.preventDefault();
        const c = document.getElementById('mcCanvas');
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const scaleX = c.width / rect.width;
        const scaleY = c.height / rect.height;
        const mx = event.offsetX * scaleX;
        const my = event.offsetY * scaleY;
        const factor = event.deltaY < 0 ? 1.1 : (1 / 1.1);
        this._mcPan.x = mx + (this._mcPan.x - mx) * factor;
        this._mcPan.y = my + (this._mcPan.y - my) * factor;
        this._mcZoom *= factor;
        this.drawMonteCarlo();
    },

    // --- Monte Carlo Simulation ---
    rng(seed) {
        let s = seed >>> 0;
        return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    },

    seededGauss(r) {
        let u = 0, v = 0;
        while(u === 0) u = Math.max(r(), 1e-12);
        while(v === 0) v = Math.max(r(), 1e-12);
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },

    runMonteCarlo() {
        const unknowns = this.points.filter(p => !p.fixed);
        if (unknowns.length === 0 || this.observations.length === 0 || !this.adjResults) {
            alert('Você deve executar um ajustamento válido (Executar Ajustamento) antes de rodar o Monte Carlo.');
            return;
        }

        const n = Math.max(10, Math.min(100000, parseInt(document.getElementById('mcN').value) || 500));
        const seed = Math.floor(Math.random() * 1000) + 1; // Uniform from 1 to 1000
        const r = this.rng(seed);

        const mcStatus = document.getElementById('mcGlobalStatus');
        const mcTableContainer = document.getElementById('mcTableContainer');
        const tbMC = document.querySelector('#tableMC tbody');

        mcStatus.innerHTML = '<span class="text-stone-500">Executando simulação...</span>';

        setTimeout(() => {
            let pts = [];
            let accepted = 0, rejected = 0, crashed = 0;

            const nu = unknowns.length;
            const m = this.observations.length;
            const dof = m - nu;
            const z_alpha = this.CRIT_W_TEST;
            const chi2_upper = dof * Math.pow(1 - 2/(9*dof) + z_alpha * Math.sqrt(2/(9*dof)), 3);
            const chi2_lower = Math.max(0, dof * Math.pow(1 - 2/(9*dof) - z_alpha * Math.sqrt(2/(9*dof)), 3));

            const P = this.observations.map(() => Array(m).fill(0));
            this.observations.forEach((o, i) => P[i][i] = 1.0 / (o.std * o.std));

            const unkIdx = {};
            unknowns.forEach((p, k) => { unkIdx[p.id] = k; });

            // A matrix is constant for leveling
            const A = this.observations.map(() => Array(nu).fill(0));
            this.observations.forEach((o, i) => {
                const pFrom = this.points.find(p => p.id === o.from);
                const pTo = this.points.find(p => p.id === o.to);
                if (!pFrom.fixed) A[i][unkIdx[pFrom.id]] = -1;
                if (!pTo.fixed) A[i][unkIdx[pTo.id]] = 1;
            });
            const At = math.transpose(A);
            const AtP = math.multiply(At, P);
            const N_mat = math.multiply(AtP, A);

            let N_inv;
            try {
                N_inv = math.inv(N_mat);
            } catch(e) {
                mcStatus.innerHTML = '<span class="text-rose-600">Erro: Sistema singular.</span>';
                return;
            }

            for (let i = 0; i < n; i++) {
                // Simulate observations
                let L_obs = this.observations.map(o => {
                    const pFrom = this.points.find(p => p.id === o.from);
                    const pTo = this.points.find(p => p.id === o.to);

                    const trueH_from = pFrom._H0;
                    const trueH_to = pTo._H0;
                    const trueDH = trueH_to - trueH_from;

                    return trueDH + this.seededGauss(r) * o.std;
                });

                // Solve
                let L = [];
                this.observations.forEach((o, idx) => {
                    const pFrom = this.points.find(p => p.id === o.from);
                    const pTo = this.points.find(p => p.id === o.to);
                    const hFromApprox = pFrom.fixed ? pFrom.H : pFrom._H0;
                    const hToApprox = pTo.fixed ? pTo.H : pTo._H0;
                    const calcDH = hToApprox - hFromApprox;
                    L.push([L_obs[idx] - calcDH]);
                });

                const U = math.multiply(AtP, L);
                let dx_vec = math.multiply(N_inv, U);

                // Form simulated point heights
                let simH = unknowns.map((p, k) => p._H0 + dx_vec[k][0]);

                // Global test
                let VtPV = 0;
                this.observations.forEach((o, idx) => {
                    const pFrom = this.points.find(p => p.id === o.from);
                    const pTo = this.points.find(p => p.id === o.to);
                    const hFrom = pFrom.fixed ? pFrom.H : simH[unkIdx[pFrom.id]];
                    const hTo = pTo.fixed ? pTo.H : simH[unkIdx[pTo.id]];
                    const v = (hTo - hFrom) - L_obs[idx];
                    VtPV += v * P[idx][idx] * v;
                });

                const pass = (VtPV >= chi2_lower && VtPV <= chi2_upper);
                pts.push({ simH, pass });
                if (pass) accepted++; else rejected++;
            }

            mcStatus.innerHTML = `
                <div class="text-teal-600 font-bold">Aceitos no Teste Global: ${accepted} (${(100*accepted/n).toFixed(1)}%)</div>
                <div class="text-rose-600">Rejeitados: ${rejected} (${(100*rejected/n).toFixed(1)}%)</div>
                ${crashed > 0 ? `<div class="text-amber-600">Falhas numéricas: ${crashed}</div>` : ''}
                <div class="mt-2 text-[10px] text-stone-500 font-sans leading-tight normal-case text-justify">
                    As simulações reprovadas não passaram em um teste global de qui-quadrado com significância de ${this.ALPHA_PCT}%. Idealmente, o número de retornos negativos deve se aproximar deste valor teórico, sobretudo quando N for grande.
                </div>
            `;

            tbMC.innerHTML = '';
            let stats = [];
            unknowns.forEach((p, k) => {
                let sMeanH = 0;
                let c = pts.length;
                if(c === 0) return;
                pts.forEach(pt_sim => { sMeanH += pt_sim.simH[k]; });
                sMeanH /= c;

                let varH = 0;
                pts.forEach(pt_sim => {
                    let dH = pt_sim.simH[k] - sMeanH;
                    varH += dH * dH;
                });
                varH /= (c - 1);

                let sigH = Math.sqrt(varH);

                stats.push({ k, meanH: sMeanH, sigH });

                let tr = document.createElement('tr');
                let biasH = (sMeanH - p.H) * 1000;
                tr.innerHTML = `
                    <td class="font-mono font-bold">${p.id}</td>
                    <td class="font-mono">${biasH.toFixed(3)}</td>
                    <td class="font-mono">${(sigH*1000).toFixed(3)}</td>
                `;
                tbMC.appendChild(tr);
            });

            mcTableContainer.style.display = 'block';
            this.mcPts = pts;
            this.mcStats = stats;
            this.fitMcNetwork();

        }, 10);
    },

    drawMonteCarlo(pts = this.mcPts, stats = this.mcStats) {
        const c = document.getElementById('mcCanvas');
        if (!c) return;
        const rect = c.parentElement.getBoundingClientRect();
        c.width = rect.width;
        c.height = rect.height;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);

        const mcExagSlider = document.getElementById('mcExag');
        const mcExag = mcExagSlider ? (parseFloat(mcExagSlider.value) * 1000) : 5000;

        if (pts.length === 0) return;

        let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
        this.points.forEach(p => {
            if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
        });

        const m = 40;
        let rangeE = maxX - minX || 10;
        let rangeN = maxY - minY || 10;
        const sc = Math.min((c.width - 2*m) / rangeE, (c.height - 2*m) / rangeN);

        const cx = (maxX + minX) / 2;
        const cy = (maxY + minY) / 2;

        const tx = E => (c.width/2 + (E - cx) * sc) * this._mcZoom + this._mcPan.x;
        const ty = N => (c.height/2 - (N - cy) * sc) * this._mcZoom + this._mcPan.y;

        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1;
        this.observations.forEach(o => {
            const pFrom = this.points.find(p => p.id === o.from);
            const pTo = this.points.find(p => p.id === o.to);
            if (pFrom && pTo) {
                ctx.beginPath();
                ctx.moveTo(tx(pFrom.x), ty(pFrom.y));
                ctx.lineTo(tx(pTo.x), ty(pTo.y));
                ctx.stroke();
            }
        });

        const unknowns = this.points.filter(p => !p.fixed);

        pts.forEach(pt_sim => {
            ctx.fillStyle = pt_sim.pass ? 'rgba(15, 118, 110, 0.2)' : 'rgba(225, 29, 72, 0.2)';
            unknowns.forEach((p, k) => {
                const dH = pt_sim.simH[k] - p.H;
                const offsetY = dH * mcExag;
                ctx.beginPath();
                ctx.arc(tx(p.x), ty(p.y) - offsetY, 2, 0, 2*Math.PI);
                ctx.fill();
            });
        });

        this.points.forEach(p => {
            if (p.fixed) {
                ctx.fillStyle = '#292524';
                ctx.fillRect(tx(p.x)-4, ty(p.y)-4, 8, 8);
            } else {
                ctx.fillStyle = '#0f766e';
                ctx.beginPath();
                ctx.arc(tx(p.x), ty(p.y), 4, 0, 2*Math.PI);
                ctx.fill();
            }
            ctx.fillStyle = '#292524';
            ctx.font = '10px monospace';
            ctx.fillText(p.id, tx(p.x)+8, ty(p.y)-8);
        });
    }

};

window.addEventListener('load', () => app.init());
