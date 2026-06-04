// --- Application Logic ---
const app = {
    map: null,
    terrainLoaded: false,
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
    _selectedPoint: null,
    _dragging: false,
    _dragTarget: null,
    _dragStartGeo: null,
    _mouseDownPos: null,
    _DRAG_THRESHOLD: 5,

    // Constants
    SIGMA_DIST_MM: 5, // mm / sqrt(km)
    ALPHA_PCT: 5,
    CRIT_W_TEST: 2.5758, // Z for 1 - alpha/2
    NON_CENTRALITY: 3.4174, // Z(1-alpha/2) + Z(beta=0.8)

    init() {
        // Inicializa o MapLibre GL JS
        this.map = new maplibregl.Map({
            container: 'map',
            style: {
                version: 8,
                sources: {
                    'carto': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
                    }
                },
                layers: [
                    {
                        id: 'carto-basemap',
                        type: 'raster',
                        source: 'carto',
                        minzoom: 0,
                        maxzoom: 22
                    }
                ]
            },
            center: [-49.236, -25.448], // initial_points center
            zoom: 14,
            pitch: 0,
            bearing: 0
        });

        this.map.addControl(new maplibregl.ScaleControl({
            maxWidth: 150,
            unit: 'metric'
        }), 'bottom-left');

        this.map.on('load', () => {
            // Adiciona a fonte de terreno global (Mapzen Terrarium hospedado na AWS Open Data)
            this.map.addSource('terrain', {
                type: 'raster-dem',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                encoding: 'terrarium',
                tileSize: 256,
                maxzoom: 14
            });
            this.map.setTerrain({ source: 'terrain', exaggeration: 1 });
            this.terrainLoaded = true;

            // Sources para a rede
            this.map.addSource('network-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            
            // Camadas para as linhas
            this.map.addLayer({
                id: 'network-lines-layer',
                type: 'line',
                source: 'network-lines',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': ['get', 'width']
                }
            });

            this.map.on('click', (e) => this.onMapClick(e));
            this.drawNetwork();
        });

        // Força um redesenho quando o mapa terminar totalmente de carregar terreno e tiles
        this.map.on('idle', () => {
            if (!this._initialIdleDone) {
                this._initialIdleDone = true;
                this.drawNetwork();
            }
        });

        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.deselectPoint(); });
        const mcCanvas = document.getElementById('mcCanvas');
        if (mcCanvas) mcCanvas.addEventListener('wheel', e => this.onMcWheel(e), { passive: false });

        // Reset range inputs to defaults
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

    toggleRelief(enabled) {
        if (!this.map) return;
        if (enabled) {
            this.map.setTerrain({ source: 'terrain', exaggeration: 1 });
        } else {
            this.map.setTerrain(null);
        }
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
            const dist = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y); // Geo distance for weight

            obs.std = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(dist / 1000);
        });

        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
    },

    resizeCanvas() {
        if (this.map) this.map.resize();
        // MC canvas
        const mcCanvas = document.getElementById('mcCanvas');
        if (mcCanvas && mcCanvas.parentElement) {
            const rect = mcCanvas.parentElement.getBoundingClientRect();
            mcCanvas.width = rect.width;
            mcCanvas.height = rect.height || 350;
            if(this.points.length > 0) this.drawMonteCarlo();
        }
    },

    // Generates a random realistic network geometry
    generateNetwork() {
        this.adjResults = null;
        this._selectedPoint = null;
        
        // Carrega os pontos da defaultNetwork gerada do geojson
        this.points = [];
        if (typeof defaultNetwork !== 'undefined') {
            this.points = defaultNetwork.map(p => ({
                id: p.id,
                x: p.lon,
                y: p.lat,
                fixed: p.fixed,
                H: p.elev,
                true_H: p.elev,
                _H0: p.elev
            }));
        }

        // Define observation lines (from -> to) connecting all to all
        const lines = [];
        for (let i = 0; i < this.points.length; i++) {
            for (let j = i + 1; j < this.points.length; j++) {
                lines.push([this.points[i].id, this.points[j].id]);
            }
        }

        this.generateObservations(lines);
        this.updateUI_Clear();
        this.setInsertMode(null);
        this.drawNetwork();
        this.fitNetwork();
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
            const trueDist = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);

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

    haversineDist(lon1, lat1, lon2, lat2) {
        const R = 6371e3; // meters
        const phi1 = lat1 * Math.PI/180;
        const phi2 = lat2 * Math.PI/180;
        const deltaPhi = (lat2-lat1) * Math.PI/180;
        const deltaLambda = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // distance in meters
    },

    validateLevelingNetwork() {
        const errors = [];
        const pointIds = new Set(this.points.map(p => p.id));
        if (!this.points.some(p => p.fixed)) {
            errors.push('A rede precisa de ao menos um ponto fixo para definir o datum altimétrico.');
        }

        const adjacency = new Map(this.points.map(p => [p.id, new Set()]));
        this.observations.forEach((obs, idx) => {
            const label = obs.id || `linha ${idx + 1}`;
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);

            if (!pointIds.has(obs.from) || !pointIds.has(obs.to) || !pFrom || !pTo) {
                errors.push(`${label}: ponto de origem ou destino inexistente.`);
                return;
            }
            if (obs.from === obs.to) {
                errors.push(`${label}: origem e destino não podem ser o mesmo ponto.`);
            }
            if (!(obs.std > 0) || !Number.isFinite(obs.std)) {
                errors.push(`${label}: desvio padrão deve ser positivo.`);
            }

            const dist = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);
            obs.distance = dist;
            if (!(dist > 0) || !Number.isFinite(dist)) {
                errors.push(`${label}: trecho com distância nula ou inválida.`);
            }

            if (obs.from !== obs.to) {
                adjacency.get(obs.from).add(obs.to);
                adjacency.get(obs.to).add(obs.from);
            }
        });

        const reachable = new Set();
        const queue = this.points.filter(p => p.fixed).map(p => p.id);
        queue.forEach(id => reachable.add(id));
        while (queue.length) {
            const id = queue.shift();
            (adjacency.get(id) || []).forEach(next => {
                if (!reachable.has(next)) {
                    reachable.add(next);
                    queue.push(next);
                }
            });
        }

        this.points.forEach(p => {
            if (!p.fixed && !reachable.has(p.id)) {
                errors.push(`${p.id}: ponto desconhecido desconectado de qualquer ponto fixo.`);
            }
        });

        return [...new Set(errors)];
    },

    randn_bm() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },

    logGamma(z) {
        const p = [
            676.5203681218851, -1259.1392167224028, 771.32342877765313,
            -176.61502916214059, 12.507343278686905, -0.13857109526572012,
            9.9843695780195716e-6, 1.5056327351493116e-7
        ];
        if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
        z -= 1;
        let x = 0.99999999999980993;
        for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
        const t = z + p.length - 0.5;
        return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    },

    regularizedGammaP(a, x) {
        if (x <= 0) return 0;
        if (a <= 0) return NaN;
        const gln = this.logGamma(a);
        const EPS = 1e-14;
        const ITMAX = 200;
        if (x < a + 1) {
            let ap = a;
            let sum = 1 / a;
            let del = sum;
            for (let n = 1; n <= ITMAX; n++) {
                ap += 1;
                del *= x / ap;
                sum += del;
                if (Math.abs(del) < Math.abs(sum) * EPS) {
                    return sum * Math.exp(-x + a * Math.log(x) - gln);
                }
            }
            return sum * Math.exp(-x + a * Math.log(x) - gln);
        }

        let b = x + 1 - a;
        let c = 1 / 1e-300;
        let d = 1 / b;
        let h = d;
        for (let i = 1; i <= ITMAX; i++) {
            const an = -i * (i - a);
            b += 2;
            d = an * d + b;
            if (Math.abs(d) < 1e-300) d = 1e-300;
            c = b + an / c;
            if (Math.abs(c) < 1e-300) c = 1e-300;
            d = 1 / d;
            const del = d * c;
            h *= del;
            if (Math.abs(del - 1) < EPS) break;
        }
        return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
    },

    chi2CDF(x, dof) {
        return this.regularizedGammaP(dof / 2, x / 2);
    },

    chi2Inv(p, dof) {
        if (p <= 0) return 0;
        if (p >= 1) return Infinity;
        let lo = 0;
        let hi = Math.max(dof, 1);
        while (this.chi2CDF(hi, dof) < p) hi *= 2;
        for (let i = 0; i < 80; i++) {
            const mid = (lo + hi) / 2;
            if (this.chi2CDF(mid, dof) < p) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
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
        const validationErrors = this.validateLevelingNetwork();
        if (validationErrors.length > 0) {
            alert(`Rede de nivelamento inválida:\n${validationErrors.join('\n')}`);
            return;
        }

        // Re-sample Gaussian noise on every run; if sigma=0 no noise is added
        const sigLin = parseFloat(document.getElementById('simSigLin').value) / 1000; // mm/sqrt(km) -> m/sqrt(km)
        this.observations.forEach(obs => {
            obs._simNoise = sigLin > 0 ? this.randn_bm() * sigLin * Math.sqrt(obs.distance / 1000) : 0;
            obs.val = (obs._baseVal != null ? obs._baseVal : obs.val) + (obs._blunderOffset || 0) + obs._simNoise;
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
        const QxxRaw = math.inv(N_f);
        const Qxx = typeof QxxRaw.toArray === 'function' ? QxxRaw.toArray() : QxxRaw;
        const SigmaXa = Qxx.map(row => row.map(v => v * sigma02));

        // Residual cofactor Qv = P⁻¹ − A Qxx Aᵀ
        const QvRaw = math.subtract(
            math.inv(P),
            math.multiply(math.multiply(A, Qxx), math.transpose(A))
        );
        const Qv = typeof QvRaw.toArray === 'function' ? QvRaw.toArray() : QvRaw;

        // Exact chi-square critical values
        const alpha = this.ALPHA_PCT / 100;
        const chi2_upper = this.chi2Inv(1 - alpha / 2, dof);
        const chi2_lower = this.chi2Inv(alpha / 2, dof);
        const globalPass = VtPV >= chi2_lower && VtPV <= chi2_upper;

        const obsData = this.observations.map((o, i) => {
            const v        = V[i][0];
            const sigma_vi = Math.sqrt(Math.max(0, Qv[i][i]));
            const w        = sigma_vi > 0 ? v / sigma_vi : NaN; // Teste de Baarda exige variância a priori
            const r_i      = Math.max(0, Qv[i][i] * P[i][i]);
            const reliable = r_i > 1e-12 && Number.isFinite(r_i);
            const mdb      = reliable ? (this.NON_CENTRALITY * o.std) / Math.sqrt(r_i) : null;

            // External reliability: elevation displacement caused by undetected MDB
            const ext = reliable
                ? Qxx.map(row => row.reduce((s, q, j) => s + q * A[i][j] * P[i][i] * mdb, 0))
                : null;
            return { obs: o, v, sigma_v: sigma_vi, w, r: r_i, mdb, ext, isOutlier: Math.abs(w) > this.CRIT_W_TEST };
        });

        // Extract per-point Qxx (1x1) + external reliability
        const stationResults = unknowns.map((p, k) => {
            const QxxBlock = Qxx[k][k];
            let maxExtMag = 0, maxExtObs = null;
            obsData.forEach(r => {
                if (!r.ext) return;
                const dH = Math.abs(r.ext[k]);
                if (dH > maxExtMag) { maxExtMag = dH; maxExtObs = r.obs.id; }
            });
            return { stationId: p.id, H: p.H, QxxBlock, maxExtMag, maxExtObs };
        });

        this.adjResults = { 
            VtPV, dof, sigma02, sigma0, globalPass, 
            chi2lim: chi2_upper, chi2low: chi2_lower, 
            obsData, stationResults,
            matrices: { A, P, L, X: dx_vec, V, N: N_f, SigmaXa }
        };
        this.updateUI_Results();
        this.drawNetwork();
    },

    // --- Drawing / MapLibre Logic ---
    _markers: {},

    drawNetwork() {
        if (!this.map || !this.map.getSource('network-lines')) return;

        // Atualizar Fonte GeoJSON (Linhas)
        const features = [];
        this.observations.forEach(obs => {
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (!pFrom || !pTo) return;

            let isOutlierLine = false;
            if (this.adjResults) {
                isOutlierLine = this.adjResults.obsData.some(res => res.obs.id === obs.id && res.isOutlier);
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[pFrom.x, pFrom.y], [pTo.x, pTo.y]]
                },
                properties: {
                    color: isOutlierLine ? '#f43f5e' : '#78716c',
                    width: isOutlierLine ? 4 : 2
                }
            });
        });

        const source = this.map.getSource('network-lines');
        if (source) {
            source.setData({ type: 'FeatureCollection', features });
        }

        // Limpar marcadores antigos
        Object.values(this._markers).forEach(m => m.remove());
        this._markers = {};

        // Adicionar Marcadores para os Pontos
        this.points.forEach(pt => {
            const el = document.createElement('div');
            el.className = 'cursor-pointer select-none';
            el.style.position = 'relative';
            el.style.width = '0px';
            el.style.height = '0px';
            el.style.setProperty('opacity', '1', 'important');

            // Marcador Base
            const dot = document.createElement('div');
            const isSelected = this._selectedPoint && this._selectedPoint.id === pt.id;
            
            dot.style.position = 'absolute';
            dot.style.top = '0px';
            dot.style.left = '0px';
            dot.style.width = pt.fixed ? '12px' : '10px';
            dot.style.height = pt.fixed ? '12px' : '10px';
            dot.style.backgroundColor = pt.fixed ? '#292524' : '#2076DF';
            dot.style.borderRadius = pt.fixed ? '2px' : '50%';
            dot.style.border = isSelected ? '2px solid #f59e0b' : '1px solid #fff';
            dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
            dot.style.transform = 'translate(-50%, -50%)';

            el.appendChild(dot);

            // Label
            const label = document.createElement('div');
            label.innerText = pt.id;
            label.style.position = 'absolute';
            label.style.left = '8px';
            label.style.top = '-16px';
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.color = '#292524';
            label.style.textShadow = '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff';
            label.style.pointerEvents = 'none';
            el.appendChild(label);

            const hLabel = document.createElement('div');
            hLabel.innerText = `H: ${pt.H.toFixed(3)}`;
            hLabel.style.position = 'absolute';
            hLabel.style.left = '10px';
            hLabel.style.top = '4px';
            hLabel.style.fontSize = '10px';
            hLabel.style.color = '#57534e';
            hLabel.style.fontFamily = 'monospace';
            hLabel.style.whiteSpace = 'nowrap';
            hLabel.style.background = 'rgba(255,255,255,0.8)';
            hLabel.style.padding = '0 2px';
            hLabel.style.borderRadius = '2px';
            hLabel.style.pointerEvents = 'none';
            el.appendChild(hLabel);

            // Barra de Erro
            if (this.adjResults && !pt.fixed) {
                const pResult = this.adjResults.stationResults.find(r => r.stationId === pt.id);
                if (pResult) {
                    const stdH = Math.sqrt(pResult.QxxBlock);
                    const ellipseExag = parseFloat(document.getElementById('ellipseExag')?.value) || 10;
                    // Escala visual da barra de erro
                    const barH = stdH * 1000 * ellipseExag; // std em mm * exage
                    
                    const bar = document.createElement('div');
                    bar.style.position = 'absolute';
                    bar.style.left = '-1px';
                    bar.style.top = `-${barH/2}px`;
                    bar.style.width = '2px';
                    bar.style.height = `${barH}px`;
                    bar.style.backgroundColor = 'rgba(15, 118, 110, 0.6)';
                    bar.style.pointerEvents = 'none';
                    el.appendChild(bar);

                    // Top/Bottom caps
                    const capTop = document.createElement('div');
                    capTop.style.position = 'absolute';
                    capTop.style.left = '-4px';
                    capTop.style.top = `-${barH/2}px`;
                    capTop.style.width = '8px';
                    capTop.style.height = '2px';
                    capTop.style.backgroundColor = 'rgba(15, 118, 110, 0.6)';
                    el.appendChild(capTop);

                    const capBot = document.createElement('div');
                    capBot.style.position = 'absolute';
                    capBot.style.left = '-4px';
                    capBot.style.top = `${barH/2}px`;
                    capBot.style.width = '8px';
                    capBot.style.height = '2px';
                    capBot.style.backgroundColor = 'rgba(15, 118, 110, 0.6)';
                    el.appendChild(capBot);
                }
            }

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.insertMode) return;
                this.selectPoint(pt);
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([pt.x, pt.y])
                .addTo(this.map);
            
            this._markers[pt.id] = marker;
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
        
        const matContainer = document.getElementById('matrixContent');
        if (matContainer) matContainer.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
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
            const svDisplay   = `${(r.sigma_v * 1000).toFixed(3)} mm <span class="text-stone-400 text-[10px]">(${(res.sigma0 * r.sigma_v * 1000).toFixed(3)})</span>`;

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

            const mdbDisplay = r.mdb == null ? '--' : (r.mdb * 1000).toFixed(3) + ' mm';

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
        
        this.renderMatrixTab();
    },

    _activeMatrixTab: 'A',

    switchMatrixTab(tab) {
        this._activeMatrixTab = tab;
        document.querySelectorAll('.mat-tab-btn').forEach(btn => {
            btn.className = 'mat-tab-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-all text-stone-600 hover:bg-stone-200';
        });
        const activeBtn = document.getElementById(`matTab-${tab}`);
        if (activeBtn) activeBtn.className = 'mat-tab-btn mat-tab-active px-3 py-1.5 text-xs font-semibold rounded-md transition-all bg-white shadow-sm text-teal-700';
        this.renderMatrixTab();
    },

    formatMatrixToLatex(name, mat) {
        if (!mat) return '\\text{Erro: Matriz indefinida}';
        if (!mat.length) return '\\text{Erro: Matriz vazia}';
        
        // Only show up to 20 rows/cols to prevent browser freezing if huge
        const MAX_DIM = 20;
        let isTruncated = mat.length > MAX_DIM || mat[0] && mat[0].length > MAX_DIM;
        
        let displayMat = mat;
        if (isTruncated) {
            displayMat = mat.slice(0, MAX_DIM).map(row => row ? row.slice(0, MAX_DIM) : []);
        }

        const formatNumber = (v) => {
            if (v === null || v === undefined || isNaN(v)) return '\\text{NaN}';
            if (Math.abs(v) < 1e-15) return '0';
            if (Number.isInteger(v)) return v.toString();
            
            let absV = Math.abs(v);
            if (absV < 0.001 || absV > 100000) {
                let exp = v.toExponential(4);
                let parts = exp.split('e');
                return `${parts[0]} \\times 10^{${parseInt(parts[1])}}`;
            }
            return parseFloat(v).toFixed(4);
        };

        let rows = displayMat.map(row => {
            if (!Array.isArray(row)) return formatNumber(row);
            return row.map(v => formatNumber(v)).join(' & ');
        }).join(' \\\\ \n');
        
        if (isTruncated) {
             rows += ' \\\\ \n \\vdots & \\ddots';
        }

        let prefix = name;
        if (name === 'X') prefix = 'dx';
        else if (name === 'SigmaXa') prefix = '\\Sigma_{X_a}';
        
        return `${prefix} = \\begin{bmatrix}\n${rows}\n\\end{bmatrix}`;
    },

    renderMatrixTab() {
        const container = document.getElementById('matrixContent');
        if (!container) return;
        if (!this.adjResults || !this.adjResults.matrices) {
            container.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            return;
        }
        
        const mat = this.adjResults.matrices[this._activeMatrixTab];
        if (!mat) return;

        container.innerHTML = '';
        const mDesc = document.getElementById('matDesc');

        const explanations = {
            'A': '<strong>Matriz de Configuração / Jacobiana (A):</strong> Contém as derivadas parciais das equações de observação em relação às incógnitas. Ela descreve matematicamente a geometria da rede, conectando os parâmetros calculados com as medições de campo.',
            'P': '<strong>Matriz de Pesos (P):</strong> Uma matriz quadrada, que no contexto não-correlacionado, é puramente diagonal contendo o inverso das variâncias a priori. Ela quantifica o nível de incerteza da medição, fazendo com que observações mais precisas tenham maior atração/peso na solução.',
            'L': '<strong>Vetor de Termos Independentes ou Desfechamento (L):</strong> Vetor que armazena a diferença entre os valores observados no campo (L<sub>obs</sub>) e os calculados matematicamente a partir das coordenadas atuais/aproximadas (L<sub>calc</sub>).',
            'X': '<strong>Vetor de Solução (dx):</strong> Correções estimadas por mínimos quadrados (dx = N<sup>-1</sup>U). No nivelamento, o modelo é linear, então a solução é obtida em uma etapa após montar A, P e L.',
            'V': '<strong>Vetor de Resíduos (V):</strong> Valores teóricos impostos pelo ajustamento que devem ser somados às observações originais (L<sub>obs</sub>) para que a rede "feche" geometricamente (L<sub>adj</sub> = L<sub>obs</sub> + V). O princípio fundamental do MMQ é fazer com que a soma global ponderada V<sup>T</sup> P V atinja seu ponto mínimo.',
            'N': '<strong>Matriz das Equações Normais (N):</strong> Equacionada por N = A<sup>T</sup> P A, condensa o modelo estocástico (peso) e geométrico da rede numa matriz simétrica. Ela só é positiva definida quando há datum altimétrico e cada componente desconhecida está conectada a ponto fixo. <em>Nota: valores altos são normais porque os pesos são inversos das variâncias.</em>',
            'SigmaXa': '<strong>Matriz de Variância-Covariância (MVC) dos Parâmetros Ajustados (&Sigma;<sub>X<sub>a</sub></sub>):</strong> Obtida pela propagação das variâncias multiplicando a Matriz Cofatora (Q<sub>xx</sub> = N<sup>-1</sup>) pelo Fator de Variância a posteriori (&sigma;<sub>0</sub><sup>2</sup>). Sua diagonal principal contém a variância estatística (incerteza) final de cada parâmetro ajustado, e os demais elementos representam as covariâncias entre eles.'
        };

        if (mDesc) mDesc.innerHTML = explanations[this._activeMatrixTab] || '';

        const latexStr = this.formatMatrixToLatex(this._activeMatrixTab, mat);
        if (window.katex) {
            try {
                katex.render(latexStr, container, {
                    displayMode: true,
                    throwOnError: false
                });
            } catch(e) {
                container.innerHTML = '<p class="text-xs text-rose-500">Erro ao renderizar matriz.</p>';
            }
        } else {
            container.innerHTML = '<p class="text-xs text-rose-500">Erro: KaTeX não carregado.</p>';
        }
    },

    // --- Point Insertion Methods ---

    async getElevation(lng, lat) {
        // Try to get from MapLibre first if available and loaded at high res
        if (this.terrainLoaded && this.map.getZoom() > 10) {
            const elev = this.map.queryTerrainElevation({lng, lat});
            if (elev !== null && elev > -10000 && elev < 10000) {
                // If it looks reasonable, we might still want to fetch the real data
                // because queryTerrainElevation might return interpolated or exaggerated values.
                // Actually, let's always use the direct tile fetch to guarantee precision.
            }
        }

        // Direct tile decode (Robust Serverless approach)
        try {
            const zoom = 14; // Max zoom for Mapzen terrain
            const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
            const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

            const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
            
            const response = await fetch(url);
            if (!response.ok) return 100.000; // Fallback
            
            const blob = await response.blob();
            const img = await createImageBitmap(blob);
            
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const n = Math.pow(2, zoom);
            const x_pixel = Math.floor(((lng + 180) / 360 * n - x) * 256);
            const y_pixel = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n - y) * 256);

            // Bounds check
            const px = Math.max(0, Math.min(255, x_pixel));
            const py = Math.max(0, Math.min(255, y_pixel));

            const pixelData = ctx.getImageData(px, py, 1, 1).data;
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];

            const elev = (r * 256 + g + b / 256) - 32768;
            return elev;
        } catch (err) {
            console.error("Erro ao buscar elevação", err);
            return 100.000;
        }
    },

    async onMapClick(e) {
        if (this.insertMode === 'Point') {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            
            document.body.style.cursor = 'wait';
            const elevation = await this.getElevation(lng, lat);
            document.body.style.cursor = 'default';

            this.openPointModal('Point', lng, lat, elevation);
        } else {
            this.deselectPoint();
        }
    },

    selectPoint(hit) {
        this._selectedPoint = hit;
        this.drawNetwork();
        this._showTrashButton();
    },

    deselectPoint() {
        if (!this._selectedPoint) return;
        this._selectedPoint = null;
        this.drawNetwork();
        this._hideTrashButton();
    },

    _showTrashButton() {
        let btn = document.getElementById('canvasTrashBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'canvasTrashBtn';
            btn.innerHTML = '&#128465;';
            btn.title = 'Excluir ponto selecionado';
            btn.className = 'absolute top-2 right-2 bg-rose-600 text-white rounded p-2 shadow hover:bg-rose-700 z-20';
            btn.addEventListener('click', () => this.deleteSelectedPoint());
            document.getElementById('map').parentElement.appendChild(btn);
        }
        btn.style.display = 'block';
    },

    _hideTrashButton() {
        const btn = document.getElementById('canvasTrashBtn');
        if (btn) btn.style.display = 'none';
    },

    deleteSelectedPoint() {
        if (!this._selectedPoint) return;
        const id = this._selectedPoint.obj.id;
        // Remove observations involving the deleted point
        this.observations = this.observations.filter(o => o.from !== id && o.to !== id);
        this.observations.forEach((o, i) => o.idx = i);
        // Remove the point itself
        this.points = this.points.filter(p => p.id !== id);
        // Remove connections referencing this point
        this.points.forEach(pt => {
            if (pt.connections) pt.connections = pt.connections.filter(c => c !== id);
        });
        this._selectedPoint = null;
        this._hideTrashButton();
        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
    },

    _resetAfterGeometryChange() {
        // Recalculate observation distances and weights without regenerating
        this.observations.forEach(obs => {
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (pFrom && pTo) {
                const dx = pTo.x - pFrom.x;
                const dy = pTo.y - pFrom.y;
                obs.distance = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);
                obs.std = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(obs.distance / 1000);
            }
        });
        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
    },

    setInsertMode(type) {
        const btnA = document.getElementById('btnInsertA');
        const hint = document.getElementById('insertModeHint');

        this.insertMode = (this.insertMode === type) ? null : type;

        // Entering insert mode clears any selection
        if (this.insertMode) {
            this._selectedPoint = null;
            this._hideTrashButton();
        }

        if (btnA) btnA.classList.toggle('insert-btn-active', this.insertMode === 'Point');
        if (this.map) this.map.getCanvas().style.cursor = this.insertMode ? 'crosshair' : 'grab';
        if (hint) hint.classList.toggle('hidden', !this.insertMode);
    },

    // --- Tab System ---
    _activeTab: 'map',

    switchTab(tab) {
        this._activeTab = tab;
        const mapContent = document.getElementById('tabMapContent');
        const tableContent = document.getElementById('tabTableContent');
        const mapBtn = document.getElementById('tabMapBtn');
        const tableBtn = document.getElementById('tabTableBtn');
        const legend = document.getElementById('mapLegend');

        if (tab === 'map') {
            mapContent.style.display = '';
            tableContent.style.display = 'none';
            mapBtn.classList.add('tab-btn-active');
            tableBtn.classList.remove('tab-btn-active');
            if (legend) legend.style.display = '';
            this.resizeCanvas();
        } else {
            mapContent.style.display = 'none';
            tableContent.style.display = '';
            mapBtn.classList.remove('tab-btn-active');
            tableBtn.classList.add('tab-btn-active');
            if (legend) legend.style.display = 'none';
            this.renderObsTable();
        }
    },

    renderObsTable() {
        const tbody = document.getElementById('obsEditBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.observations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-stone-400 py-4">Nenhuma observação. Clique em "+ Novo Trecho" para adicionar.</td></tr>';
            return;
        }

        this.observations.forEach((obs, idx) => {
            const tr = document.createElement('tr');
            const stdMm = obs.std * 1000;

            // Build point option lists
            const pointOpts = this.points.map(p =>
                `<option value="${p.id}"${p.id === obs.from ? ' selected' : ''}>${p.id}</option>`
            ).join('');
            const pointOptsTo = this.points.map(p =>
                `<option value="${p.id}"${p.id === obs.to ? ' selected' : ''}>${p.id}</option>`
            ).join('');

            tr.innerHTML = `
                <td><select data-idx="${idx}" data-field="from">${pointOpts}</select></td>
                <td><select data-idx="${idx}" data-field="to">${pointOptsTo}</select></td>
                <td><input type="number" step="0.0001" value="${obs.val.toFixed(4)}" data-idx="${idx}" data-field="val"></td>
                <td><input type="number" step="0.01" value="${stdMm.toFixed(2)}" data-idx="${idx}" data-field="std"></td>
                <td><button class="obs-delete-btn" data-idx="${idx}" title="Remover trecho">&#215;</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Attach event listeners
        tbody.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', e => this.updateObsFromTable(e));
        });
        tbody.querySelectorAll('.obs-delete-btn').forEach(el => {
            el.addEventListener('click', e => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                this.removeObservation(idx);
            });
        });
    },

    updateObsFromTable(event) {
        const el = event.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.field;
        const obs = this.observations[idx];
        if (!obs) return;

        if (field === 'val') {
            const newVal = parseFloat(el.value);
            if (isNaN(newVal)) return;
            obs.val = newVal;
            obs._baseVal = newVal;
            obs._blunderOffset = 0;
            obs._simNoise = 0;
            obs.hasError = false;
        } else if (field === 'std') {
            const newStdMm = parseFloat(el.value);
            if (isNaN(newStdMm) || newStdMm <= 0) return;
            obs.std = newStdMm / 1000;
        } else if (field === 'from') {
            obs.from = el.value;
            obs.id = `\u0394H_${obs.from}-${obs.to}`;
            // Recalculate distance for weight
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (pFrom && pTo) {
                obs.distance = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);
                obs.std = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(obs.distance / 1000);
            }
        } else if (field === 'to') {
            obs.to = el.value;
            obs.id = `\u0394H_${obs.from}-${obs.to}`;
            const pFrom = this.points.find(p => p.id === obs.from);
            const pTo = this.points.find(p => p.id === obs.to);
            if (pFrom && pTo) {
                obs.distance = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);
                obs.std = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(obs.distance / 1000);
            }
        }

        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
        // Re-render table to reflect recalculated σ when from/to changes
        if (field === 'from' || field === 'to') this.renderObsTable();
    },

    addObservationRow() {
        if (this.points.length < 2) {
            alert('É necessário ter ao menos 2 pontos na rede para criar um trecho.');
            return;
        }

        const pFrom = this.points[0];
        const pTo = this.points[1];
        const dx = pTo.x - pFrom.x;
        const dy = pTo.y - pFrom.y;
        const dist = this.haversineDist(pFrom.x, pFrom.y, pTo.x, pTo.y);
        const stdDist = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(dist / 1000);

        const trueH_from = (pFrom.true_H != null) ? pFrom.true_H : pFrom.H;
        const trueH_to = (pTo.true_H != null) ? pTo.true_H : pTo.H;
        const trueDH = trueH_to - trueH_from;

        this.observations.push({
            id: `\u0394H_${pFrom.id}-${pTo.id}`,
            type: 'dh',
            from: pFrom.id,
            to: pTo.id,
            val: trueDH,
            std: stdDist,
            hasError: false,
            _baseVal: trueDH,
            _blunderOffset: 0,
            _simNoise: 0,
            idx: this.observations.length,
            distance: dist
        });

        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
        this.renderObsTable();
    },

    removeObservation(idx) {
        this.observations.splice(idx, 1);
        // Re-index
        this.observations.forEach((o, i) => o.idx = i);
        this.adjResults = null;
        this.updateUI_Clear();
        this.drawNetwork();
        this.renderObsTable();
    },

    openPointModal(type, geoX, geoY, defaultElev = 100.000) {
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
                    <label class="block text-xs font-semibold text-stone-600 mb-1">Longitude</label>
                    <input id="modalInputX" type="number" step="0.000001" value="${geoX.toFixed(6)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-stone-600 mb-1">Latitude</label>
                    <input id="modalInputY" type="number" step="0.000001" value="${geoY.toFixed(6)}"
                        class="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-teal-500" />
                </div>
            </div>

            <div class="pt-2 border-t border-stone-100">
                <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                    <input type="checkbox" id="modalInputFixed" class="accent-teal-600 w-4 h-4" onchange="document.getElementById('modalInputH').disabled = !this.checked; if(!this.checked) document.getElementById('modalInputH').value = '${defaultElev.toFixed(3)}';" />
                    <span class="font-bold">Ponto Fixo (Altitude Conhecida)</span>
                </label>
            </div>

            <div>
                <label class="block text-xs font-semibold text-stone-600 mb-1">Altitude Inicial / Fixa H (m)</label>
                <input id="modalInputH" type="number" step="0.001" value="${defaultElev.toFixed(3)}" disabled
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
            // Append new observations for the new connections (don't regenerate all)
            const newPt = this.points.find(p => p.id === id);
            connections.forEach(connId => {
                const otherPt = this.points.find(p => p.id === connId);
                if (!newPt || !otherPt) return;
                const dx = otherPt.x - newPt.x;
                const dy = otherPt.y - newPt.y;
                const dist = this.haversineDist(newPt.x, newPt.y, otherPt.x, otherPt.y);
                const stdDist = (this.SIGMA_DIST_MM / 1000) * Math.sqrt(dist / 1000);
                const trueDH = (otherPt.true_H != null ? otherPt.true_H : otherPt.H)
                             - (newPt.true_H != null ? newPt.true_H : newPt.H);
                this.observations.push({
                    id: `\u0394H_${id}-${connId}`,
                    type: 'dh',
                    from: id,
                    to: connId,
                    val: trueDH + this.randn_bm() * stdDist,
                    std: stdDist,
                    hasError: false,
                    _baseVal: trueDH,
                    _blunderOffset: 0,
                    _simNoise: 0,
                    idx: this.observations.length,
                    distance: dist
                });
            });
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
        if (this.map && this.points.length > 0) {
            let minX = 9999, minY = 9999, maxX = -9999, maxY = -9999;
            this.points.forEach(p => {
                if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
                if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
            });
            this.map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 50 });
        }
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
        const validationErrors = this.validateLevelingNetwork();
        if (validationErrors.length > 0) {
            alert(`Rede de nivelamento inválida:\n${validationErrors.join('\n')}`);
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
            const alpha = this.ALPHA_PCT / 100;
            const chi2_upper = this.chi2Inv(1 - alpha / 2, dof);
            const chi2_lower = this.chi2Inv(alpha / 2, dof);

            const P = this.observations.map(() => Array(m).fill(0));
            this.observations.forEach((o, i) => P[i][i] = 1.0 / (o.std * o.std));

            const unkIdx = {};
            unknowns.forEach((p, k) => { unkIdx[p.id] = k; });
            const nominalH = {};
            this.points.forEach(p => { nominalH[p.id] = p.H; });

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

                    const trueH_from = nominalH[pFrom.id];
                    const trueH_to = nominalH[pTo.id];
                    const trueDH = trueH_to - trueH_from;

                    return trueDH + this.seededGauss(r) * o.std;
                });

                // Solve
                let L = [];
                this.observations.forEach((o, idx) => {
                    const pFrom = this.points.find(p => p.id === o.from);
                    const pTo = this.points.find(p => p.id === o.to);
                    const hFromApprox = nominalH[pFrom.id];
                    const hToApprox = nominalH[pTo.id];
                    const calcDH = hToApprox - hFromApprox;
                    L.push([L_obs[idx] - calcDH]);
                });

                const U = math.multiply(AtP, L);
                let dx_vec = math.multiply(N_inv, U);

                // Form simulated point heights
                let simH = unknowns.map((p, k) => nominalH[p.id] + dx_vec[k][0]);

                // Global test
                let VtPV = 0;
                this.observations.forEach((o, idx) => {
                    const pFrom = this.points.find(p => p.id === o.from);
                    const pTo = this.points.find(p => p.id === o.to);
                    const hFrom = pFrom.fixed ? nominalH[pFrom.id] : simH[unkIdx[pFrom.id]];
                    const hTo = pTo.fixed ? nominalH[pTo.id] : simH[unkIdx[pTo.id]];
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
                let biasH = (sMeanH - nominalH[p.id]) * 1000;
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
