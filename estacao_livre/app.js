// --- Mini Matrix Math Library (No dependencies) ---
const Mat = {
    transpose: (a) => a[0].map((_, c) => a.map(r => r[c])),
    multiply: (a, b) => {
        const result = Array(a.length).fill(0).map(() => Array(b[0].length).fill(0));
        return result.map((row, i) => row.map((val, j) => a[i].reduce((sum, elm, k) => sum + elm * b[k][j], 0)));
    },
    // Special fast inverse for 2x2 matrices (perfect for 2D Resection with X, Y unknowns)
    invert2x2: (m) => {
        const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
        if (Math.abs(det) < 1e-12) throw new Error("Matriz singular.");
        return [
            [m[1][1] / det, -m[0][1] / det],
            [-m[1][0] / det, m[0][0] / det]
        ];
    },
    subtract: (a, b) => a.map((row, i) => row.map((val, j) => val - b[i][j])),
    add: (a, b) => a.map((row, i) => row.map((val, j) => val + b[i][j])),
    // For n x n diagonal matrices (like P matrix)
    invertDiag: (m) => m.map((row, i) => row.map((val, j) => i === j ? 1/val : 0)),
    // Solve n×n system A*x = b using Gaussian elimination with partial pivoting.
    // A is n×n array-of-arrays, b is n×1 array-of-arrays. Returns n×1 array-of-arrays.
    solve: (A, b) => {
        const n = A.length;
        const M = A.map((row, i) => [...row, b[i][0]]);
        for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col + 1; row < n; row++)
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            [M[col], M[maxRow]] = [M[maxRow], M[col]];
            if (Math.abs(M[col][col]) < 1e-12) throw new Error('Matriz singular.');
            for (let row = col + 1; row < n; row++) {
                const f = M[row][col] / M[col][col];
                for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
            }
        }
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = M[i][n];
            for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
            x[i] /= M[i][i];
        }
        return x.map(v => [v]);
    },
    // Invert general n×n matrix using Gauss-Jordan elimination.
    inv: (A) => {
        const n = A.length;
        const M = A.map((row, i) => [
            ...row,
            ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
        ]);
        for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col + 1; row < n; row++)
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            [M[col], M[maxRow]] = [M[maxRow], M[col]];
            if (Math.abs(M[col][col]) < 1e-12) throw new Error('Matriz singular.');
            const div = M[col][col];
            for (let k = col; k < 2 * n; k++) M[col][k] /= div;
            for (let row = 0; row < n; row++) {
                if (row === col) continue;
                const f = M[row][col];
                for (let k = col; k < 2 * n; k++) M[row][k] -= f * M[col][k];
            }
        }
        return M.map(row => row.slice(n));
    }
};

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
    
    // Constants
    SIGMA_DIST_MM: 5,
    SIGMA_DIST_PPM: 2,
    SIGMA_AZ_SEC: 3,
    CRIT_W_TEST: 2.576, // alpha = 0.01 (two-tailed Normal)
    NON_CENTRALITY: 4.13, // Power 80%, alpha 0.01 for 1 DOF
    
    init() {
        this.canvas = document.getElementById('networkCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('click', e => this.canvasClick(e));
        this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });

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
            blunderPct.value = 5;
            document.getElementById('blunderPctVal').textContent = '5%';
        }

        this.generateNetwork();
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
        document.getElementById('blunderPctVal').textContent = pctInput.value + '%';
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
        const pct = parseFloat(document.getElementById('blunderPct').value) / 100;
        const injected = [];
        selected.forEach(idx => {
            const obs = this.observations[idx];
            const magnitude = Math.abs(obs._baseVal) * pct;
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
        alert(`Erros grosseiros injetados (${(pct * 100).toFixed(0)}%):\n${injected.join('\n')}\n\nExecute o ajustamento para detectar os outliers.`);
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

            const At  = Mat.transpose(A);
            const AtP = Mat.multiply(At, P);
            const N   = Mat.multiply(AtP, A); // nu × nu
            const U   = Mat.multiply(AtP, L); // nu × 1

            try {
                dx_vec = Mat.solve(N, U); // nu × 1, as [[v], ...]
            } catch(e) {
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
        const V    = Mat.subtract(Mat.multiply(A, dx_vec), L); // V = A*dx - L
        const VtPV = Mat.multiply(Mat.multiply(Mat.transpose(V), P), V)[0][0];
        const sigma02 = VtPV / dof;

        // Full Qxx (nu × nu) via general matrix inverse
        const AtP_f = Mat.multiply(Mat.transpose(A), P);
        const N_f   = Mat.multiply(AtP_f, A);
        const Qxx   = Mat.inv(N_f);

        // Residual covariance Qv = P⁻¹ − A Qxx Aᵀ
        const Qv = Mat.subtract(
            Mat.invertDiag(P),
            Mat.multiply(Mat.multiply(A, Qxx), Mat.transpose(A))
        );

        // Chi-square critical value (Wilson-Hilferty approximation, α = 1%)
        const chi2_upper = dof * Math.pow(1 - 2/(9*dof) + 2.326 * Math.sqrt(2/(9*dof)), 3);
        const globalPass = VtPV <= chi2_upper;

        const obsData = this.observations.map((o, i) => {
            const v        = V[i][0];
            const sigma_vi = Math.sqrt(Qv[i][i]);
            const w        = v / sigma_vi;
            const r_i      = Qv[i][i] * P[i][i];
            const mdb      = (this.NON_CENTRALITY * o.std) / Math.sqrt(r_i);
            // External reliability: coordinate displacement caused by undetected MDB
            const ext = Qxx.map(row => row.reduce((s, q, j) => s + q * A[i][j] * P[i][i] * mdb, 0));
            return { obs: o, v, sigma_v: sigma_vi, w, r: r_i, mdb, ext, isOutlier: Math.abs(w) > this.CRIT_W_TEST };
        });

        // Extract per-station 2×2 Qxx sub-blocks + external reliability
        const stationResults = this.stations.map((st, k) => {
            const SigmaX = [
                [Qxx[2*k][2*k],   Qxx[2*k][2*k+1]],
                [Qxx[2*k+1][2*k], Qxx[2*k+1][2*k+1]]
            ];
            let maxExtMag = 0, maxExtObs = null;
            obsData.forEach(r => {
                const dE = r.ext[2*k], dN = r.ext[2*k+1];
                const mag = Math.sqrt(dE*dE + dN*dN);
                if (mag > maxExtMag) { maxExtMag = mag; maxExtObs = r.obs.id; }
            });
            return { stationId: st.id, x: st.x, y: st.y, SigmaX, maxExtMag, maxExtObs };
        });

        this.adjResults = { VtPV, dof, sigma02, globalPass, chi2lim: chi2_upper, obsData, stationResults };
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
                    const Qx = stResult.SigmaX;
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
                <div class="flex justify-between"><span>&chi;&sup2; lim (&alpha;=1%):</span> <span>${res.chi2lim.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&sigma;&sup2;<sub>0</sub>:</span> <span>${res.sigma02.toFixed(4)}</span></div>
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

            tr.innerHTML = `
                <td class="font-mono">${r.obs.id}</td>
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

            tr.innerHTML = `
                <td class="font-mono">${r.obs.id}</td>
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
            const sigE = Math.sqrt(sr.SigmaX[0][0]) * 1000; // mm
            const sigN = Math.sqrt(sr.SigmaX[1][1]) * 1000; // mm
            const rhoEN = sr.SigmaX[0][1] / (Math.sqrt(sr.SigmaX[0][0]) * Math.sqrt(sr.SigmaX[1][1]));
            const extMm = sr.maxExtMag * 1000; // mm
            tr.innerHTML = `
                <td class="font-mono font-bold">${sr.stationId}</td>
                <td class="font-mono">${sr.x.toFixed(4)}</td>
                <td class="font-mono">${sr.y.toFixed(4)}</td>
                <td class="font-mono">${sigE.toFixed(3)}</td>
                <td class="font-mono">${sigN.toFixed(3)}</td>
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
    }

};

window.addEventListener('load', () => app.init());
