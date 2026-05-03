// --- Application Logic ---
const app = {
    canvas: null,
    ctx: null,
    points: [], // Control points (Type A)
    stations: [], // Setup points with unknown coords (Type B)
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
    SIGMA_DIST_MM: 5,
    SIGMA_DIST_PPM: 2,
    SIGMA_AZ_SEC: 3,
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
        sigLin.value = 0;
        document.getElementById('simSigLinVal').textContent = '0.0 mm';

        const sigAng = document.getElementById('simSigAng');
        sigAng.value = 0;
        document.getElementById('simSigAngVal').textContent = '0.0\u2033';

        const ellipseExag = document.getElementById('ellipseExag');
        if (ellipseExag) {
            ellipseExag.value = 1;
            document.getElementById('ellipseExagVal').textContent = '1.0\u00d7';
        }

        const blunderPct = document.getElementById('blunderPct');
        if (blunderPct) {
            blunderPct.value = 10;
            document.getElementById('blunderPctVal').textContent = '10\u03C3';
        }

        const aprioriDistMm = document.getElementById('aprioriDistMm');
        if (aprioriDistMm) {
            aprioriDistMm.value = 5;
            document.getElementById('aprioriDistMmVal').textContent = '5.0 mm';
        }
        const aprioriDistPpm = document.getElementById('aprioriDistPpm');
        if (aprioriDistPpm) {
            aprioriDistPpm.value = 2;
            document.getElementById('aprioriDistPpmVal').textContent = '2.0 ppm';
        }
        const aprioriAz = document.getElementById('aprioriAz');
        if (aprioriAz) {
            aprioriAz.value = 3;
            document.getElementById('aprioriAzVal').textContent = '3.0\u2033';
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
        const distPpmEl = document.getElementById('aprioriDistPpm');
        const azEl = document.getElementById('aprioriAz');
        const alphaEl = document.getElementById('aprioriAlpha');
        
        if (distMmEl) this.SIGMA_DIST_MM = parseFloat(distMmEl.value);
        if (distPpmEl) this.SIGMA_DIST_PPM = parseFloat(distPpmEl.value);
        if (azEl) this.SIGMA_AZ_SEC = parseFloat(azEl.value);
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
            const st = this.stations.find(s => s.id === obs.stationId);
            if (!st) return;
            const trueX = (st.true_x != null) ? st.true_x : st.x;
            const trueY = (st.true_y != null) ? st.true_y : st.y;
            const dx = obs.target.x - trueX;
            const dy = obs.target.y - trueY;
            const trueDist = Math.sqrt(dx*dx + dy*dy);

            if (obs.type === 'dist') {
                obs.std = (this.SIGMA_DIST_MM / 1000) + (trueDist * this.SIGMA_DIST_PPM / 1000000);
            } else {
                obs.std = this.SIGMA_AZ_SEC * (Math.PI / 180 / 3600);
            }
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
        // Center around (1000, 1000)
        this.points = [
            { id: 'A', x: 800 + Math.random()*100, y: 800 + Math.random()*100 },
            { id: 'B', x: 1200 + Math.random()*100, y: 850 + Math.random()*100 },
            { id: 'C', x: 1150 + Math.random()*100, y: 1200 + Math.random()*100 },
            { id: 'D', x: 850 + Math.random()*100, y: 1150 + Math.random()*100 }
        ];

        // True station position (roughly central)
        const genSt = { 
            id: 'E1', 
            true_x: 1000 + (Math.random()-0.5)*100, 
            true_y: 1000 + (Math.random()-0.5)*100,
            x: 0, y: 0 // Will hold current estimate
        };
        
        // Initial guess (Centroid of control points - standard geodetic start)
        genSt.x = this.points.reduce((s, p) => s + p.x, 0) / this.points.length;
        genSt.y = this.points.reduce((s, p) => s + p.y, 0) / this.points.length;
        genSt._x0 = genSt.x;
        genSt._y0 = genSt.y;

        // All control points connected by default for auto-generated networks
        genSt.connections = this.points.map(p => p.id);
        this.stations = [genSt];

        this.generateObservations();
        this.updateUI_Clear();
        this.setInsertMode(null);
        this._userZoom = 1;
        this._userPan = { x: 0, y: 0 };
        this.drawNetwork();
    },

    generateObservations() {
        this.observations = [];
        for (const st of this.stations) {
            const connIds = st.connections || this.points.map(p => p.id);
            const connectedPts = this.points.filter(p => connIds.includes(p.id));
            // Use true position for simulated networks; approx position for manual placements
            const trueX = (st.true_x != null) ? st.true_x : st.x;
            const trueY = (st.true_y != null) ? st.true_y : st.y;

            connectedPts.forEach((pt) => {
                const dx = pt.x - trueX;
                const dy = pt.y - trueY;
                const trueDist = Math.sqrt(dx*dx + dy*dy);
                const trueAz = Math.atan2(dx, dy); // Geodetic az: atan2(dE, dN)

                const stdDist = (this.SIGMA_DIST_MM / 1000) + (trueDist * this.SIGMA_DIST_PPM / 1000000);
                const stdAzRad = this.SIGMA_AZ_SEC * (Math.PI / 180 / 3600);

                const n1 = this.randn_bm();
                const n2 = this.randn_bm();

                const obsDist = trueDist + n1 * stdDist;
                const obsAz = trueAz + n2 * stdAzRad;

                this.observations.push({
                    id: `D_${st.id}-${pt.id}`, type: 'dist', target: pt,
                    stationId: st.id, val: obsDist, std: stdDist, hasError: false,
                    _baseVal: obsDist, _blunderOffset: 0, _simNoise: 0,
                    idx: this.observations.length
                });

                this.observations.push({
                    id: `Az_${st.id}-${pt.id}`, type: 'azimuth', target: pt,
                    stationId: st.id, val: obsAz, std: stdAzRad, hasError: false,
                    _baseVal: obsAz, _blunderOffset: 0, _simNoise: 0,
                    idx: this.observations.length
                });
            });
        }
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
            const isAngle = obs.type === 'azimuth';
            const valDisplay = isAngle
                ? this.formatDMS(obs.val)
                : obs.val.toFixed(4) + ' m';
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none';
            const checked = (idx === preSelected) ? ' checked' : '';
            label.innerHTML = `
                <input type="checkbox" class="blunderObsCheck accent-rose-500" value="${idx}"${obs.hasError ? ' disabled' : checked}>
                <span class="font-mono">${obs.id}</span>
                <span class="text-stone-400">(${isAngle ? 'Azimute' : 'Distância'}: ${valDisplay}${obs.hasError ? ' — já contém erro' : ''})</span>
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
            const isAngle = obs.type === 'azimuth';
            const errDisplay = isAngle
                ? this.r2as(magnitude).toFixed(2) + '″'
                : (magnitude * 1000).toFixed(3) + ' mm';
            injected.push(`${obs.id}: ${errDisplay}`);
        });
        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
        this.closeBlunderModal();
        alert(`Erros grosseiros injetados (${k}σ):\n${injected.join('\n')}\n\nExecute o ajustamento para detectar os outliers.`);
    },

    runAdjustment() {
        if (this.stations.length === 0) {
            alert('Nenhuma estação livre definida. Adicione uma estação do Tipo B primeiro.');
            return;
        }
        if (this.observations.length === 0) {
            alert('Sem observações. Verifique as conexões das estações.');
            return;
        }

        // Re-sample Gaussian noise on every run; if sigma=0 no noise is added
        const sigLin = parseFloat(document.getElementById('simSigLin').value) / 1000; // mm → m
        const sigAng = parseFloat(document.getElementById('simSigAng').value) * (Math.PI / 180 / 3600); // arcsec → rad
        this.observations.forEach(obs => {
            obs._simNoise = obs.type === 'dist'
                ? (sigLin > 0 ? this.randn_bm() * sigLin : 0)
                : (sigAng > 0 ? this.randn_bm() * sigAng : 0);
            obs.val = (obs._baseVal || obs.val) + (obs._blunderOffset || 0) + obs._simNoise;
        });

        const nu = 2 * this.stations.length; // total unknowns (X,Y per station)
        const m  = this.observations.length;
        const dof = m - nu;

        if (dof < 1) {
            alert(`Redundância insuficiente: ${m} observações para ${nu} incógnitas. Adicione mais conexões.`);
            return;
        }

        // Diagonal weight matrix P — constant across iterations
        const P = this.observations.map(() => Array(m).fill(0));
        this.observations.forEach((o, i) => P[i][i] = 1.0 / (o.std * o.std));

        // Map station id → column-block index k  (unknowns at cols 2k, 2k+1)
        const stIdx = {};
        this.stations.forEach((st, k) => { stIdx[st.id] = k; });

        // Reset station positions to initial approximations so each run is independent
        this.stations.forEach(st => { if (st._x0 != null) { st.x = st._x0; st.y = st._y0; } });

        const maxIter = 15;
        const tol = 0.0001; // 0.1 mm
        let iter = 0;
        let A, L, dx_vec;

        while (iter < maxIter) {
            // Build full design matrix A (m × nu) and misclosure vector L (m × 1)
            A = this.observations.map(() => Array(nu).fill(0));
            L = [];

            this.observations.forEach((o, i) => {
                const k  = stIdx[o.stationId];
                const st = this.stations[k];
                const calcDx   = o.target.x - st.x;
                const calcDy   = o.target.y - st.y;
                const calcDist = Math.sqrt(calcDx * calcDx + calcDy * calcDy);

                if (o.type === 'dist') {
                    A[i][2*k]   = -calcDx / calcDist;
                    A[i][2*k+1] = -calcDy / calcDist;
                    L.push([o.val - calcDist]);
                } else {
                    A[i][2*k]   = -calcDy / (calcDist * calcDist);
                    A[i][2*k+1] =  calcDx / (calcDist * calcDist);
                    let calcAz = Math.atan2(calcDx, calcDy);
                    let diff = o.val - calcAz;
                    while (diff >  Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    L.push([diff]);
                }
            });

            const At  = math.transpose(A);
            const AtP = math.multiply(At, P);
            const N   = math.multiply(AtP, A); // nu × nu
            const U   = math.multiply(AtP, L); // nu × 1

            try {
                let sol = math.lusolve(N, U);
                dx_vec = typeof sol.toArray === 'function' ? sol.toArray() : sol; // nu × 1, as [[v], ...]
            } catch(e) {
                console.error(e);
                alert('Erro Matemático: Geometria fraca ou singular no sistema de equações normais.');
                return;
            }

            let maxCorr = 0;
            this.stations.forEach((st, k) => {
                const dx = dx_vec[2*k][0];
                const dy = dx_vec[2*k+1][0];
                st.x += dx;
                st.y += dy;
                if (Math.abs(dx) > maxCorr) maxCorr = Math.abs(dx);
                if (Math.abs(dy) > maxCorr) maxCorr = Math.abs(dy);
            });

            iter++;
            if (maxCorr < tol) break;
        }

        // --- Post-adjustment quality control (single combined system) ---

        // Recompute residuals directly from converged coordinates
        const V = [];
        this.observations.forEach((o) => {
            const k  = stIdx[o.stationId];
            const st = this.stations[k];
            const dx = o.target.x - st.x;
            const dy = o.target.y - st.y;
            const computedDist = Math.sqrt(dx * dx + dy * dy);
            if (o.type === 'dist') {
                V.push([computedDist - o.val]);
            } else {
                let computedAz = Math.atan2(dx, dy);
                let diff = computedAz - o.val;
                while (diff >  Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                V.push([diff]);
            }
        });

        const VtPV = math.multiply(math.multiply(math.transpose(V), P), V)[0][0];
        const sigma02 = VtPV / dof;
        const sigma0  = Math.sqrt(sigma02);

        // Full Qxx (nu × nu) via general matrix inverse
        const AtP_f = math.multiply(math.transpose(A), P);
        const N_f   = math.multiply(AtP_f, A);
        const Qxx   = math.inv(N_f);

        // Residual cofactor Qv = P⁻¹ − A Qxx Aᵀ
        const Qv = math.subtract(
            math.inv(P),
            math.multiply(math.multiply(A, Qxx), math.transpose(A))
        );

        // Chi-square critical values (Wilson-Hilferty approximation)
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
            // External reliability: coordinate displacement caused by undetected MDB
            const ext = Qxx.map(row => row.reduce((s, q, j) => s + q * A[i][j] * P[i][i] * mdb, 0));
            return { obs: o, v, sigma_v: sigma_vi, w, r: r_i, mdb, ext, isOutlier: Math.abs(w) > this.CRIT_W_TEST };
        });

        // Extract per-station 2×2 Qxx sub-blocks + external reliability
        const stationResults = this.stations.map((st, k) => {
            const QxxBlock = [
                [Qxx[2*k][2*k],   Qxx[2*k][2*k+1]],
                [Qxx[2*k+1][2*k], Qxx[2*k+1][2*k+1]]
            ];
            let maxExtMag = 0, maxExtObs = null;
            obsData.forEach(r => {
                const dE = r.ext[2*k], dN = r.ext[2*k+1];
                const mag = Math.sqrt(dE*dE + dN*dN);
                if (mag > maxExtMag) { maxExtMag = mag; maxExtObs = r.obs.id; }
            });
            return { stationId: st.id, x: st.x, y: st.y, QxxBlock, maxExtMag, maxExtObs };
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
            ctx.fillText('Selecione um tipo de ponto no painel e clique aqui para inserir.', w / 2, h / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Find bounding box — include all stations
        let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
        const bboxPts = [...this.points, ...this.stations];
        bboxPts.forEach(p => {
            const px = (p.true_x != null) ? p.true_x : p.x;
            const py = (p.true_y != null) ? p.true_y : p.y;
            if(px < minX) minX = px; if(px > maxX) maxX = px;
            if(py < minY) minY = py; if(py > maxY) maxY = py;
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

        // Draw sight lines, error ellipses, and station dots — one loop per Type B station
        this.stations.forEach(st => {
            const connIds = st.connections || [];
            const connectedPts = this.points.filter(p => connIds.includes(p.id));
            connectedPts.forEach(pt => {
                const stC = toCanvas(st.x, st.y);
                const ptC = toCanvas(pt.x, pt.y);

                let isOutlierLine = false;
                if (this.adjResults) {
                    isOutlierLine = this.adjResults.obsData.some(res =>
                        res.obs.stationId === st.id && res.obs.target.id === pt.id && res.isOutlier);
                }

                ctx.beginPath();
                ctx.moveTo(stC.cx, stC.cy);
                ctx.lineTo(ptC.cx, ptC.cy);

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
            });

            // Error ellipse for this station (if adjusted)
            if (this.adjResults) {
                const stResult = this.adjResults.stationResults.find(r => r.stationId === st.id);
                if (stResult) {
                    const stC = toCanvas(st.x, st.y);
                    const Qx = stResult.QxxBlock;
                    const trace = Qx[0][0] + Qx[1][1];
                    const det = Qx[0][0]*Qx[1][1] - Qx[0][1]*Qx[1][0];
                    const l1 = (trace + Math.sqrt(trace*trace - 4*det))/2;
                    const l2 = (trace - Math.sqrt(trace*trace - 4*det))/2;
                    const a = Math.sqrt(l1);
                    const b = Math.sqrt(l2);
                    const theta = Math.atan2(2*Qx[0][1], Qx[0][0] - Qx[1][1]) / 2;
                    const ellipseExag = parseFloat(document.getElementById('ellipseExag')?.value) || 1;
                    const vizScale = 5000 * scale * ellipseExag;
                    ctx.beginPath();
                    ctx.ellipse(stC.cx, stC.cy, a * vizScale, b * vizScale, -theta, 0, 2*Math.PI);
                    ctx.fillStyle = 'rgba(20, 184, 166, 0.2)';
                    ctx.fill();
                    ctx.strokeStyle = '#0f766e';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Calculated position (teal dot)
            const calcSt = toCanvas(st.x, st.y);
            ctx.beginPath();
            ctx.arc(calcSt.cx, calcSt.cy, 5, 0, 2*Math.PI);
            ctx.fillStyle = '#14b8a6';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#14b8a6';
            ctx.font = '10px Inter';
            ctx.fillText(st.id, calcSt.cx + 8, calcSt.cy + 15);
        });

        // Draw Control Points (Type A)
        this.points.forEach(pt => {
            const pc = toCanvas(pt.x, pt.y);
            ctx.fillStyle = '#292524'; // Stone-800
            ctx.beginPath();
            ctx.rect(pc.cx - 5, pc.cy - 5, 10, 10);
            ctx.fill();
            ctx.font = '10px Inter';
            ctx.fillStyle = '#292524';
            ctx.fillText(pt.id, pc.cx + 8, pc.cy - 8);
        });
    },

    // --- UI Updaters ---
    updateUI_Clear() {
        document.getElementById('panelGlobalTest').innerHTML = `
            <h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>
            <div class="text-center py-4"><p class="text-xs text-stone-400">Aguardando ajustamento...</p></div>`;
        
        document.querySelector('#tableResiduals tbody').innerHTML = `<tr><td colspan="7" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
        document.querySelector('#tableReliability tbody').innerHTML = `<tr><td colspan="4" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
        document.querySelector('#tableCoords tbody').innerHTML = `<tr><td colspan="8" class="text-center text-stone-400 py-4">Aguardando ajustamento...</td></tr>`;
    },

    updateUI_Results() {
        const res = this.adjResults;

        // 1. Global Test Panel — single result for the combined network
        const panel = document.getElementById('panelGlobalTest');
        const color = res.globalPass ? 'text-teal-600' : 'text-rose-600';
        const bg    = res.globalPass ? 'bg-teal-50 border-teal-200' : 'bg-rose-50 border-rose-200';
        const icon  = res.globalPass ? '&#10003; Aprovado' : '&#10007; Falhou';
        const stList = this.stations.map(s => s.id).join(', ');
        panel.innerHTML = `
            <h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>
            ${this.stations.length > 1 ? `<p class="text-xs text-stone-400 mb-2">Estações: ${stList}</p>` : ''}
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
            const isAngle = r.obs.type === 'azimuth';
            const badge = r.isOutlier 
                ? '<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold border border-rose-200">OUTLIER</span>' 
                : '<span class="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs border border-teal-200">OK</span>';
            
            const wColor = r.isOutlier ? 'text-rose-600 font-bold' : '';

            const obsDisplay  = isAngle
                ? this.formatDMS(r.obs.val)
                : r.obs.val.toFixed(4) + ' m';
            const vDisplay    = isAngle
                ? this.r2as(r.v).toFixed(2) + '″'
                : (r.v * 1000).toFixed(3) + ' mm';
            const svDisplay   = isAngle
                ? this.r2as(r.sigma_v).toFixed(2) + '″'
                : (r.sigma_v * 1000).toFixed(3) + ' mm';

            const injectedIcon = r.obs.hasError ? ' <span class="text-rose-500" title="Erro Grosseiro Injetado">&#9888;</span>' : '';

            tr.innerHTML = `
                <td class="font-mono">${r.obs.id}${injectedIcon}</td>
                <td>${isAngle ? 'Azimute' : 'Distância'}</td>
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
            const isAngle = r.obs.type === 'azimuth';
            
            // Color code redundancy (r > 0.5 is good, r < 0.1 is dangerous)
            let rColor = 'text-teal-600';
            let rQual = 'Boa';
            if(r.r < 0.3) { rColor = 'text-amber-500'; rQual = 'Média'; }
            if(r.r < 0.1) { rColor = 'text-rose-600 font-bold'; rQual = 'Crítica (Sem Controlo)'; }

            const mdbDisplay = isAngle
                ? this.r2as(r.mdb).toFixed(2) + '″'
                : (r.mdb * 1000).toFixed(3) + ' mm';

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
            const sigE_pri = Math.sqrt(sr.QxxBlock[0][0]) * 1000; // mm (a-priori)
            const sigN_pri = Math.sqrt(sr.QxxBlock[1][1]) * 1000; // mm (a-priori)
            const sigE_pos = res.sigma0 * sigE_pri; // mm (a-posteriori)
            const sigN_pos = res.sigma0 * sigN_pri; // mm (a-posteriori)
            const rhoEN = sr.QxxBlock[0][1] / (Math.sqrt(sr.QxxBlock[0][0]) * Math.sqrt(sr.QxxBlock[1][1]));
            const extMm = sr.maxExtMag * 1000; // mm
            tr.innerHTML = `
                <td class="font-mono font-bold">${sr.stationId}</td>
                <td class="font-mono">${sr.x.toFixed(4)}</td>
                <td class="font-mono">${sr.y.toFixed(4)}</td>
                <td class="font-mono">${sigE_pri.toFixed(3)} <span class="text-stone-400 text-[10px]">(${sigE_pos.toFixed(3)})</span></td>
                <td class="font-mono">${sigN_pri.toFixed(3)} <span class="text-stone-400 text-[10px]">(${sigN_pos.toFixed(3)})</span></td>
                <td class="font-mono">${rhoEN.toFixed(3)}</td>
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
        this.openPointModal(this.insertMode, geo.x, geo.y);
    },

    setInsertMode(type) {
        const btnA = document.getElementById('btnInsertA');
        const btnB = document.getElementById('btnInsertB');
        const hint = document.getElementById('insertModeHint');

        this.insertMode = (this.insertMode === type) ? null : type;

        if (btnA) btnA.classList.toggle('insert-btn-active', this.insertMode === 'A');
        if (btnB) btnB.classList.toggle('insert-btn-active', this.insertMode === 'B');
        if (this.canvas) this.canvas.style.cursor = this.insertMode ? 'crosshair' : 'default';
        if (hint) hint.classList.toggle('hidden', !this.insertMode);
    },

    openPointModal(type, geoX, geoY) {
        this._pendingPoint = { type, geoX, geoY };
        document.getElementById('modalTitle').textContent =
            type === 'A' ? 'Novo Ponto de Apoio (Tipo A)' : 'Nova Estação Livre (Tipo B)';

        const defaultId = type === 'A'
            ? String.fromCharCode(65 + this.points.length)
            : ('E' + (this.stations.length + 1));

        let bodyHTML = `
            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Identificador</label>
                <input id="modalInputId" type="text" value="${defaultId}"
                    class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
            </div>`;

        if (type === 'A') {
            bodyHTML += `
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-stone-600 mb-1">E (X) &mdash; metros</label>
                    <input id="modalInputX" type="number" step="0.001" value="${geoX.toFixed(3)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-stone-600 mb-1">N (Y) &mdash; metros</label>
                    <input id="modalInputY" type="number" step="0.001" value="${geoY.toFixed(3)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
            </div>`;

            if (this.stations.length > 0) {
                bodyHTML += `
            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Conexão a Estações Livres</label>
                <div class="space-y-1">`;
                this.stations.forEach(st => {
                    bodyHTML += `
                <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                    <input type="checkbox" class="stationConnCheck accent-teal-600" value="${st.id}" />
                    ${st.id} (Estação Livre)
                </label>`;
                });
                bodyHTML += `
                </div>
                <p class="text-[10px] text-stone-400 mt-1">Padrão: sem conexão. Ative para incluir este ponto nas observações da estação.</p>
            </div>`;
            }

        } else {
            // Type B: show click position as initial estimate
            const approxX = geoX;
            const approxY = geoY;

            bodyHTML += `
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-stone-500 mb-1">E aprox. (X)</label>
                    <div class="px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded font-mono text-stone-500">${approxX.toFixed(3)}</div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-stone-500 mb-1">N aprox. (Y)</label>
                    <div class="px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded font-mono text-stone-500">${approxY.toFixed(3)}</div>
                </div>
            </div>
            <p class="text-[10px] text-stone-400 -mt-2">Posição inicial baseada no ponto clicado no mapa.</p>`;

            if (this.points.length === 0) {
                bodyHTML += `
            <p class="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded p-2">Nenhum ponto de apoio disponível. Insira ao menos 2 pontos do Tipo A primeiro.</p>`;
            } else {
                bodyHTML += `
            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-2">Conexões &mdash; pontos observados da estação</label>
                <div class="space-y-1 max-h-40 overflow-y-auto border border-stone-100 rounded p-2 bg-stone-50">`;
                this.points.forEach(pt => {
                    bodyHTML += `
                    <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                        <input type="checkbox" class="connCheck accent-teal-600" value="${pt.id}" checked />
                        ${pt.id}
                    </label>`;
                });
                bodyHTML += `
                </div>
                <p class="text-[10px] text-stone-400 mt-1">Mínimo de 2 pontos obrigatórios. Padrão: todos selecionados.</p>
            </div>`;
            }
        }

        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('pointModal').classList.add('active');
    },

    confirmPoint() {
        const pending = this._pendingPoint;
        if (!pending) return;

        const id = document.getElementById('modalInputId').value.trim();
        if (!id) { alert('O identificador não pode ser vazio.'); return; }

        if (pending.type === 'A') {
            if (this.points.some(p => p.id === id)) {
                alert(`Já existe um ponto com o ID "${id}". Escolha outro identificador.`);
                return;
            }
            const xVal = parseFloat(document.getElementById('modalInputX').value);
            const yVal = parseFloat(document.getElementById('modalInputY').value);
            if (isNaN(xVal) || isNaN(yVal)) { alert('Coordenadas inválidas.'); return; }

            this.points.push({ id, x: xVal, y: yVal });

            // Connect new point to any selected station(s)
            const stationChecks = document.querySelectorAll('#modalBody .stationConnCheck:checked');
            stationChecks.forEach(chk => {
                const targetSt = this.stations.find(s => s.id === chk.value);
                if (targetSt) targetSt.connections.push(id);
            });
            if (stationChecks.length > 0) {
                this.adjResults = null;
                this.generateObservations();
                this.updateUI_Clear();
            }

        } else {
            // Type B
            if (this.points.length < 2) {
                alert('Insira ao menos 2 pontos de apoio (Tipo A) antes de adicionar a estação livre.');
                return;
            }
            const checkboxes = document.querySelectorAll('#modalBody .connCheck:checked');
            const connections = Array.from(checkboxes).map(cb => cb.value);
            if (connections.length < 2) {
                alert('A estação livre deve estar conectada a no mínimo 2 pontos de apoio.');
                return;
            }

            const approxX = pending.geoX;
            const approxY = pending.geoY;

            if (this.stations.some(s => s.id === id)) {
                alert(`Já existe uma estação com o ID "${id}". Escolha outro identificador.`);
                return;
            }
            this.stations.push({
                id,
                true_x: null,
                true_y: null,
                x: approxX,
                y: approxY,
                _x0: approxX,
                _y0: approxY,
                connections
            });

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

    // --- Unit conversion helpers ---
    r2as(rad) {
        return rad * (180 / Math.PI) * 3600;
    },

    formatDMS(rad) {
        let deg = rad * (180 / Math.PI);
        deg = ((deg % 360) + 360) % 360;
        const d = Math.floor(deg);
        const mf = (deg - d) * 60;
        const m = Math.floor(mf);
        const s = (mf - m) * 60;
        return `${d}° ${String(m).padStart(2, '0')}′ ${s.toFixed(2).padStart(5, '0')}″`;
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
        if (this.stations.length === 0 || this.observations.length === 0 || !this.adjResults) {
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
            
            const m = this.observations.length;
            const nu = 2 * this.stations.length;
            const dof = m - nu;
            const z_alpha = this.CRIT_W_TEST;
            const chi2_upper = dof * Math.pow(1 - 2/(9*dof) + z_alpha * Math.sqrt(2/(9*dof)), 3);
            const chi2_lower = Math.max(0, dof * Math.pow(1 - 2/(9*dof) - z_alpha * Math.sqrt(2/(9*dof)), 3));
            
            const P = this.observations.map(() => Array(m).fill(0));
            this.observations.forEach((o, i) => P[i][i] = 1.0 / (o.std * o.std));
            const stIdx = {};
            this.stations.forEach((st, k) => { stIdx[st.id] = k; });

            for (let i = 0; i < n; i++) {
                let L_obs = this.observations.map(o => {
                    const st = this.stations.find(s => s.id === o.stationId);
                    const tgIdx = stIdx[o.target.id];
                    const tgE = tgIdx !== undefined ? this.stations[tgIdx].x : o.target.x;
                    const tgN = tgIdx !== undefined ? this.stations[tgIdx].y : o.target.y;
                    
                    const dx = tgE - st.x;
                    const dy = tgN - st.y;
                    let baseL = o.type === 'dist' ? Math.sqrt(dx*dx + dy*dy) : Math.atan2(dx, dy);
                    
                    return baseL + this.seededGauss(r) * o.std;
                });
                let coords = this.stations.map(st => ({ E: st._x0, N: st._y0 }));
                let maxIter = 15, iter = 0, dx_vec, converged = false;
                
                while (iter < maxIter) {
                    let A = this.observations.map(() => Array(nu).fill(0));
                    let L = [];
                    
                    this.observations.forEach((o, idx) => {
                        const k = stIdx[o.stationId];
                        const tgIdx = stIdx[o.target.id];
                        const targetE = tgIdx !== undefined ? coords[tgIdx].E : o.target.x;
                        const targetN = tgIdx !== undefined ? coords[tgIdx].N : o.target.y;
                        
                        const calcDx = targetE - coords[k].E;
                        const calcDy = targetN - coords[k].N;
                        const calcDist = Math.sqrt(calcDx * calcDx + calcDy * calcDy);
                        
                        if (o.type === 'dist') {
                            A[idx][2*k] = -calcDx / calcDist;
                            A[idx][2*k+1] = -calcDy / calcDist;
                            L.push([L_obs[idx] - calcDist]);
                        } else {
                            A[idx][2*k] = -calcDy / (calcDist * calcDist);
                            A[idx][2*k+1] = calcDx / (calcDist * calcDist);
                            let calcAz = Math.atan2(calcDx, calcDy);
                            let diff = L_obs[idx] - calcAz;
                            while (diff > Math.PI) diff -= 2 * Math.PI;
                            while (diff < -Math.PI) diff += 2 * Math.PI;
                            L.push([diff]);
                        }
                    });
                    
                    try {
                        const At = math.transpose(A);
                        const AtP = math.multiply(At, P);
                        const N_mat = math.multiply(AtP, A);
                        const U = math.multiply(AtP, L);
                        let sol = math.lusolve(N_mat, U);
                        dx_vec = typeof sol.toArray === 'function' ? sol.toArray() : sol;
                        
                        let maxC = 0;
                        coords.forEach((c, k) => {
                            c.E += dx_vec[2*k][0];
                            c.N += dx_vec[2*k+1][0];
                            maxC = Math.max(maxC, Math.abs(dx_vec[2*k][0]), Math.abs(dx_vec[2*k+1][0]));
                        });
                        
                        if (maxC < 0.0001) { converged = true; break; }
                        iter++;
                    } catch(e) {
                        break;
                    }
                }
                
                if (converged) {
                    let VtPV = 0;
                    this.observations.forEach((o, idx) => {
                        const k = stIdx[o.stationId];
                        const tgIdx = stIdx[o.target.id];
                        const targetE = tgIdx !== undefined ? coords[tgIdx].E : o.target.x;
                        const targetN = tgIdx !== undefined ? coords[tgIdx].N : o.target.y;
                        const dx = targetE - coords[k].E;
                        const dy = targetN - coords[k].N;
                        let v = 0;
                        if (o.type === 'dist') {
                            v = Math.sqrt(dx*dx + dy*dy) - L_obs[idx];
                        } else {
                            let calcAz = Math.atan2(dx, dy);
                            v = calcAz - L_obs[idx];
                            while (v > Math.PI) v -= 2 * Math.PI;
                            while (v < -Math.PI) v += 2 * Math.PI;
                        }
                        VtPV += v * P[idx][idx] * v;
                    });
                    const pass = (VtPV >= chi2_lower && VtPV <= chi2_upper);
                    pts.push({ coords, pass });
                    if (pass) accepted++; else rejected++;
                } else {
                    crashed++;
                }
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
            this.stations.forEach((st, k) => {
                let sMeanE = 0, sMeanN = 0;
                let c = pts.length;
                if(c === 0) return;
                pts.forEach(p => { sMeanE += p.coords[k].E; sMeanN += p.coords[k].N; });
                sMeanE /= c; sMeanN /= c;
                
                let varE = 0, varN = 0, covEN = 0;
                pts.forEach(p => {
                    let dE = p.coords[k].E - sMeanE;
                    let dN = p.coords[k].N - sMeanN;
                    varE += dE * dE;
                    varN += dN * dN;
                    covEN += dE * dN;
                });
                varE /= (c - 1); varN /= (c - 1); covEN /= (c - 1);
                
                let sigE = Math.sqrt(varE);
                let sigN = Math.sqrt(varN);
                let rho = covEN / (sigE * sigN);
                
                stats.push({ k, meanE: sMeanE, meanN: sMeanN, sigE, sigN, rho });
                
                let tr = document.createElement('tr');
                let biasE = (sMeanE - st.x) * 1000;
                let biasN = (sMeanN - st.y) * 1000;
                tr.innerHTML = `
                    <td class="font-mono font-bold">${st.id}</td>
                    <td class="font-mono">${biasE.toFixed(3)}</td>
                    <td class="font-mono">${biasN.toFixed(3)}</td>
                    <td class="font-mono">${(sigE*1000).toFixed(3)}</td>
                    <td class="font-mono">${(sigN*1000).toFixed(3)}</td>
                    <td class="font-mono">${rho.toFixed(3)}</td>
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
        
        let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
        this.points.forEach(p => { minE=Math.min(minE,p.x); maxE=Math.max(maxE,p.x); minN=Math.min(minN,p.y); maxN=Math.max(maxN,p.y); });
        this.stations.forEach(p => { minE=Math.min(minE,p.x); maxE=Math.max(maxE,p.x); minN=Math.min(minN,p.y); maxN=Math.max(maxN,p.y); });
        
        const m = 40; 
        let rangeE = maxE - minE || 10;
        let rangeN = maxN - minN || 10;
        const sc = Math.min((c.width - 2*m) / rangeE, (c.height - 2*m) / rangeN);
        
        const cx = (maxE + minE) / 2;
        const cy = (maxN + minN) / 2;
        
        const tx = E => (c.width/2 + (E - cx) * sc) * this._mcZoom + this._mcPan.x;
        const ty = N => (c.height/2 - (N - cy) * sc) * this._mcZoom + this._mcPan.y;
        
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1;
        this.observations.forEach(o => {
            const st = this.stations.find(s => s.id === o.stationId);
            const tg = this.points.find(p => p.id === o.target.id) || this.stations.find(s => s.id === o.target.id);
            if (st && tg) {
                ctx.beginPath();
                ctx.moveTo(tx(st.x), ty(st.y));
                ctx.lineTo(tx(tg.x), ty(tg.y));
                ctx.stroke();
            }
        });
        
        pts.forEach(p => {
            ctx.fillStyle = p.pass ? 'rgba(15, 118, 110, 0.4)' : 'rgba(225, 29, 72, 0.4)';
            p.coords.forEach((stCoords, k) => {
                const st = this.stations[k];
                const dE = stCoords.E - st.x;
                const dN = stCoords.N - st.y;
                const eX = st.x + dE * mcExag;
                const eY = st.y + dN * mcExag;
                ctx.beginPath();
                ctx.arc(tx(eX), ty(eY), 2, 0, 2*Math.PI);
                ctx.fill();
            });
        });
        
        this.stations.forEach((st, k) => {
            ctx.fillStyle = '#0f766e';
            ctx.beginPath();
            ctx.arc(tx(st.x), ty(st.y), 4, 0, 2*Math.PI);
            ctx.fill();
            ctx.fillStyle = '#0f766e';
            ctx.font = '10px monospace';
            ctx.fillText(st.id, tx(st.x)+8, ty(st.y)-8);
            
            if (stats[k]) {
                const dE = stats[k].meanE - st.x;
                const dN = stats[k].meanN - st.y;
                const mX = st.x + dE * mcExag;
                const mY = st.y + dN * mcExag;
                
                ctx.strokeStyle = '#b45309';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(tx(mX)-4, ty(mY));
                ctx.lineTo(tx(mX)+4, ty(mY));
                ctx.moveTo(tx(mX), ty(mY)-4);
                ctx.lineTo(tx(mX), ty(mY)+4);
                ctx.stroke();
            }
        });
        
        this.points.forEach(p => {
            ctx.fillStyle = '#292524';
            ctx.fillRect(tx(p.x)-4, ty(p.y)-4, 8, 8);
            ctx.fillStyle = '#292524';
            ctx.font = '10px monospace';
            ctx.fillText(p.id, tx(p.x)+8, ty(p.y)-8);
        });
    }

};

window.addEventListener('load', () => app.init());
