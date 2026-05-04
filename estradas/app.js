const app = {
    canvas: null,
    ctx: null,
    activeTab: 'plan',
    viewports: {
        plan: { zoom: 1, panX: 0, panY: 0 },
        profile: { zoom: 1, panX: 0, panY: 0 },
        earth: { zoom: 1, panX: 0, panY: 0 },
        stake: { zoom: 1, panX: 0, panY: 0 }
    },
    isPanning: false,
    panStart: null,
    panOrigin: null,
    terrainPhase: 0,
    generatedTerrain: false,
    profile: [],
    curveTable: [],
    earthRows: [],
    stake: null,
    h: null,
    v: null,

    init() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        const hashTab = window.location.hash.replace('#', '');
        if (['plan', 'profile', 'earth', 'stake'].includes(hashTab)) this.activeTab = hashTab;
        this.bindEvents();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.recalculate(true);
        this.switchTab(this.activeTab);
        if (window.lucide) window.lucide.createIcons();
    },

    bindEvents() {
        document.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', () => this.recalculate(false));
            el.addEventListener('change', () => this.recalculate(false));
        });
        document.getElementById('btnTerrain').addEventListener('click', () => {
            this.terrainPhase = Math.random() * 500;
            this.generatedTerrain = false;
            this.recalculate(true);
        });
        document.getElementById('btnRecalc').addEventListener('click', () => this.recalculate(false));
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        this.canvas.addEventListener('wheel', e => this.onCanvasWheel(e), { passive: false });
        this.canvas.addEventListener('pointerdown', e => this.onCanvasPointerDown(e));
        this.canvas.addEventListener('pointermove', e => this.onCanvasPointerMove(e));
        this.canvas.addEventListener('pointerup', e => this.onCanvasPointerUp(e));
        this.canvas.addEventListener('pointercancel', e => this.onCanvasPointerUp(e));
        this.canvas.addEventListener('dblclick', () => this.resetActiveViewport());
    },

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.max(320, rect.width) * dpr;
        this.canvas.height = (parseFloat(getComputedStyle(this.canvas).height) || 520) * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    },

    switchTab(tab) {
        this.activeTab = tab;
        if (window.location.hash.replace('#', '') !== tab) {
            history.replaceState(null, '', `#${tab}`);
        }
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('tab-btn-active', btn.dataset.tab === tab);
        });
        this.draw();
        this.renderTable();
        this.renderLegend();
    },

    val(id, fallback = 0) {
        const n = parseFloat(document.getElementById(id).value);
        return Number.isFinite(n) ? n : fallback;
    },

    recalculate(forceTerrain) {
        this.h = this.computeHorizontal();
        this.v = this.computeVertical();
        if (forceTerrain || !this.generatedTerrain || !this.profile.length) {
            this.generateTerrain();
        } else {
            this.refreshProfile();
        }
        this.curveTable = this.computeCurveTable();
        this.earthRows = this.computeEarthwork();
        this.stake = this.computeStakeout();
        this.renderSummary();
        this.renderTable();
        this.renderLegend();
        this.draw();
        document.getElementById('calcStatus').textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        if (window.lucide) window.lucide.createIcons();
    },

    computeHorizontal() {
        const startStation = this.val('startStation', 0);
        const piStation = this.val('piStation', 420);
        const deltaDeg = Math.abs(this.val('deltaDeg', 42));
        const radius = Math.max(1, Math.abs(this.val('radius', 300)));
        const turn = document.getElementById('turnDirection').value === 'L' ? -1 : 1;
        const azimuth = this.degToRad(this.val('azimuthDeg', 38));
        const start = { e: this.val('startE', 1000), n: this.val('startN', 1000) };
        const delta = this.degToRad(deltaDeg);
        const t = radius * Math.tan(delta / 2);
        const length = radius * delta;
        const longChord = 2 * radius * Math.sin(delta / 2);
        const external = radius * (1 / Math.cos(delta / 2) - 1);
        const middle = radius * (1 - Math.cos(delta / 2));
        const pcStation = piStation - t;
        const ptStation = pcStation + length;
        const stationEquation = (piStation + t) - ptStation;
        const forwardAz = this.normRad(azimuth + turn * delta);
        const degree100 = 18000 / (Math.PI * radius);
        const pi = this.projectFrom(start, azimuth, piStation - startStation);
        const pc = this.projectFrom(start, azimuth, pcStation - startStation);
        const pt = this.pointAtOnCurve(pc, azimuth, turn, radius, length);
        const right = this.rightVector(azimuth);
        const center = {
            e: pc.e + turn * radius * right.e,
            n: pc.n + turn * radius * right.n
        };
        const routeEnd = Math.max(ptStation + 260, this.val('vpiStation', 420) + this.val('verticalLength', 260), startStation + 760);
        return {
            startStation,
            piStation,
            deltaDeg,
            delta,
            radius,
            turn,
            azimuth,
            forwardAz,
            start,
            pi,
            pc,
            pt,
            center,
            t,
            length,
            longChord,
            external,
            middle,
            pcStation,
            ptStation,
            stationEquation,
            degree100,
            routeEnd
        };
    },

    computeVertical() {
        const vpiStation = this.val('vpiStation', 420);
        const vpiElev = this.val('vpiElev', 118);
        const g1Pct = this.val('gradeIn', 2.2);
        const g2Pct = this.val('gradeOut', -1.4);
        const length = Math.max(1, Math.abs(this.val('verticalLength', 260)));
        const g1 = g1Pct / 100;
        const g2 = g2Pct / 100;
        const bvcStation = vpiStation - length / 2;
        const evcStation = bvcStation + length;
        const bvcElev = vpiElev - g1 * length / 2;
        const evcElev = vpiElev + g2 * length / 2;
        const algebraic = g2Pct - g1Pct;
        const k = Math.abs(algebraic) > 1e-9 ? length / Math.abs(algebraic) : Infinity;
        const type = algebraic < 0 ? 'Crista' : algebraic > 0 ? 'Concava' : 'Tangente';
        let critical = null;
        if (Math.abs(g2 - g1) > 1e-12) {
            const x = -g1 * length / (g2 - g1);
            if (x >= 0 && x <= length) {
                const station = bvcStation + x;
                critical = {
                    station,
                    elev: this.verticalElevationAt(station, { bvcStation, bvcElev, g1, g2, length }),
                    label: algebraic < 0 ? 'Ponto alto' : 'Ponto baixo'
                };
            }
        }
        return {
            vpiStation,
            vpiElev,
            g1Pct,
            g2Pct,
            g1,
            g2,
            length,
            bvcStation,
            evcStation,
            bvcElev,
            evcElev,
            algebraic,
            k,
            type,
            critical
        };
    },

    verticalElevation(station) {
        return this.verticalElevationAt(station, this.v);
    },

    verticalElevationAt(station, v) {
        if (station < v.bvcStation) {
            return v.bvcElev + v.g1 * (station - v.bvcStation);
        }
        if (station > v.evcStation) {
            return v.evcElev + v.g2 * (station - v.evcStation);
        }
        const x = station - v.bvcStation;
        return v.bvcElev + v.g1 * x + ((v.g2 - v.g1) / (2 * v.length)) * x * x;
    },

    generateTerrain() {
        const interval = Math.max(5, this.val('stationInterval', 20));
        const start = this.h.startStation;
        const end = this.h.routeEnd;
        this.profile = [];
        for (let s = start; s <= end + 0.001; s += interval) {
            const grade = this.verticalElevation(s);
            const p = this.terrainPhase;
            const terrainWave =
                2.7 * Math.sin((s + p) / 95) +
                1.4 * Math.cos((s + p * 0.73) / 47) +
                0.7 * Math.sin((s - p * 0.31) / 28);
            const trend = 0.0022 * (s - (start + end) / 2);
            this.profile.push({ station: s, ground: grade + terrainWave + trend });
        }
        this.generatedTerrain = true;
        this.refreshProfile();
    },

    refreshProfile() {
        this.profile.forEach(p => {
            p.grade = this.verticalElevation(p.station);
            p.cutFill = p.ground - p.grade;
        });
    },

    computeCurveTable() {
        const h = this.h;
        const interval = Math.max(5, this.val('stationInterval', 20));
        const stations = this.uniqueStations([
            h.pcStation,
            ...this.rangeStations(Math.ceil(h.pcStation / interval) * interval, h.ptStation, interval),
            h.ptStation
        ]);
        let prev = h.pcStation;
        return stations.map(station => {
            const arc = Math.max(0, station - h.pcStation);
            const point = this.pointAtStation(station);
            const deflection = arc / (2 * h.radius);
            const totalChord = 2 * h.radius * Math.sin(arc / (2 * h.radius));
            const incArc = Math.max(0, station - prev);
            const incChord = 2 * h.radius * Math.sin(incArc / (2 * h.radius));
            const row = {
                station,
                arc,
                deflection,
                totalChord,
                incChord,
                e: point.e,
                n: point.n,
                azimuth: point.azimuth
            };
            prev = station;
            return row;
        });
    },

    computeEarthwork() {
        const width = Math.max(1, this.val('roadWidth', 12));
        const crossSlope = this.val('crossSlope', 4) / 100;
        const cutSlope = Math.max(0.2, this.val('cutSlope', 1.5));
        const fillSlope = Math.max(0.2, this.val('fillSlope', 2));
        const fillFactor = this.val('fillFactor', 15) / 100;
        const rows = this.profile.map(p => {
            const section = this.computeSection(p.station, p.ground, p.grade, width, crossSlope, cutSlope, fillSlope);
            return {
                station: p.station,
                ground: p.ground,
                grade: p.grade,
                centerCutFill: p.ground - p.grade,
                cutArea: section.cut,
                fillArea: section.fill,
                leftIntercept: section.left,
                rightIntercept: section.right,
                cutVolume: 0,
                fillVolume: 0,
                adjustedFillVolume: 0,
                cumulative: 0
            };
        });
        let cumulative = 0;
        for (let i = 1; i < rows.length; i++) {
            const prev = rows[i - 1];
            const row = rows[i];
            const length = row.station - prev.station;
            const cutVol = length * (prev.cutArea + row.cutArea) / 2;
            const fillVol = length * (prev.fillArea + row.fillArea) / 2;
            row.cutVolume = cutVol;
            row.fillVolume = fillVol;
            row.adjustedFillVolume = fillVol * (1 + fillFactor);
            cumulative += cutVol - row.adjustedFillVolume;
            row.cumulative = cumulative;
        }
        return rows;
    },

    computeSection(station, centerGround, grade, width, crossSlope, cutSlope, fillSlope) {
        const half = width / 2;
        const ground = { a: crossSlope, b: centerGround };
        const edgeLeftGround = centerGround + crossSlope * -half;
        const edgeRightGround = centerGround + crossSlope * half;
        const leftMode = edgeLeftGround >= grade ? 'cut' : 'fill';
        const rightMode = edgeRightGround >= grade ? 'cut' : 'fill';
        const leftLine = leftMode === 'cut'
            ? { a: -1 / cutSlope, b: grade - half / cutSlope }
            : { a: 1 / fillSlope, b: grade + half / fillSlope };
        const rightLine = rightMode === 'cut'
            ? { a: 1 / cutSlope, b: grade - half / cutSlope }
            : { a: -1 / fillSlope, b: grade + half / fillSlope };
        let left = this.intersectionX(ground, leftLine);
        let right = this.intersectionX(ground, rightLine);
        if (!Number.isFinite(left) || left > -half) {
            left = -half - Math.max(2, Math.abs(edgeLeftGround - grade) * (leftMode === 'cut' ? cutSlope : fillSlope));
        }
        if (!Number.isFinite(right) || right < half) {
            right = half + Math.max(2, Math.abs(edgeRightGround - grade) * (rightMode === 'cut' ? cutSlope : fillSlope));
        }
        const segments = [
            { x1: left, x2: -half, line: leftLine },
            { x1: -half, x2: half, line: { a: 0, b: grade } },
            { x1: half, x2: right, line: rightLine }
        ];
        let cut = 0;
        let fill = 0;
        segments.forEach(seg => {
            const part = this.integrateDifference(seg.x1, seg.x2, ground.a - seg.line.a, ground.b - seg.line.b);
            cut += part.cut;
            fill += part.fill;
        });
        return { cut, fill, left, right };
    },

    computeStakeout() {
        const station = this.val('stakeStation', 460);
        const offset = this.val('stakeOffset', 3);
        const center = this.pointAtStation(station);
        const right = this.rightVector(center.azimuth);
        const point = {
            e: center.e + offset * right.e,
            n: center.n + offset * right.n
        };
        const inst = { e: this.val('instE', 940), n: this.val('instN', 1025) };
        const dx = point.e - inst.e;
        const dy = point.n - inst.n;
        const distance = Math.hypot(dx, dy);
        const azimuth = this.normRad(Math.atan2(dx, dy));
        const backsight = this.degToRad(this.val('backsightAz', 20));
        const angleRight = this.normRad(azimuth - backsight);
        const grade = this.verticalElevation(station);
        const ground = this.groundAt(station) + (this.val('crossSlope', 4) / 100) * offset;
        return {
            station,
            offset,
            center,
            point,
            inst,
            distance,
            azimuth,
            angleRight,
            grade,
            ground,
            cutFill: ground - grade
        };
    },

    pointAtStation(station) {
        const h = this.h;
        if (station <= h.pcStation) {
            const p = this.projectFrom(h.start, h.azimuth, station - h.startStation);
            return { ...p, azimuth: h.azimuth };
        }
        if (station <= h.ptStation) {
            const arc = station - h.pcStation;
            const p = this.pointAtOnCurve(h.pc, h.azimuth, h.turn, h.radius, arc);
            return { ...p, azimuth: this.normRad(h.azimuth + h.turn * arc / h.radius) };
        }
        const p = this.projectFrom(h.pt, h.forwardAz, station - h.ptStation);
        return { ...p, azimuth: h.forwardAz };
    },

    pointAtOnCurve(pc, azimuth, turn, radius, arc) {
        const theta = arc / radius;
        const f = this.forwardVector(azimuth);
        const l = this.leftVector(azimuth);
        const x = radius * Math.sin(theta);
        const y = turn === -1 ? radius * (1 - Math.cos(theta)) : -radius * (1 - Math.cos(theta));
        return {
            e: pc.e + x * f.e + y * l.e,
            n: pc.n + x * f.n + y * l.n
        };
    },

    projectFrom(origin, azimuth, distance) {
        const f = this.forwardVector(azimuth);
        return { e: origin.e + distance * f.e, n: origin.n + distance * f.n };
    },

    groundAt(station) {
        if (!this.profile.length) return this.verticalElevation(station);
        if (station <= this.profile[0].station) return this.profile[0].ground;
        const last = this.profile[this.profile.length - 1];
        if (station >= last.station) return last.ground;
        for (let i = 1; i < this.profile.length; i++) {
            const a = this.profile[i - 1];
            const b = this.profile[i];
            if (station <= b.station) {
                const t = (station - a.station) / (b.station - a.station);
                return a.ground + t * (b.ground - a.ground);
            }
        }
        return last.ground;
    },

    renderSummary() {
        const h = this.h;
        const v = this.v;
        const totalCut = this.earthRows.reduce((s, r) => s + r.cutVolume, 0);
        const totalFill = this.earthRows.reduce((s, r) => s + r.adjustedFillVolume, 0);
        const balance = totalCut - totalFill;
        const crit = v.critical ? `${v.critical.label}: ${this.formatStation(v.critical.station)} / ${this.fmt(v.critical.elev, 3)} m` : 'Sem extremo interno';
        const cards = [
            {
                label: 'Horizontal',
                value: `PC ${this.formatStation(h.pcStation)}`,
                sub: `PT ${this.formatStation(h.ptStation)} | T ${this.fmt(h.t, 2)} m | L ${this.fmt(h.length, 2)} m`
            },
            {
                label: 'Elementos',
                value: `E ${this.fmt(h.external, 2)} m`,
                sub: `M ${this.fmt(h.middle, 2)} m | LC ${this.fmt(h.longChord, 2)} m | D100 ${this.fmt(h.degree100, 4)} deg`
            },
            {
                label: 'Vertical',
                value: `${v.type} | K ${Number.isFinite(v.k) ? this.fmt(v.k, 2) : 'inf'} m/%`,
                sub: `BVC ${this.formatStation(v.bvcStation)} | EVC ${this.formatStation(v.evcStation)} | ${crit}`
            },
            {
                label: 'Balanco',
                value: `${this.fmt(balance, 0)} m3`,
                sub: `Corte ${this.fmt(totalCut, 0)} m3 | Aterro ajust. ${this.fmt(totalFill, 0)} m3`
            }
        ];
        document.getElementById('summaryGrid').innerHTML = cards.map(card => `
            <div class="summary-card">
                <div class="summary-label">${card.label}</div>
                <div class="summary-value">${card.value}</div>
                <div class="summary-sub">${card.sub}</div>
            </div>
        `).join('');
    },

    renderLegend() {
        const legends = {
            plan: [
                ['#0f766e', 'eixo projetado'],
                ['#1c1917', 'PI / tangentes'],
                ['#e11d48', 'ponto locado']
            ],
            profile: [
                ['#0f766e', 'greide'],
                ['#a16207', 'terreno'],
                ['#e11d48', 'corte'],
                ['#0ea5a4', 'aterro']
            ],
            earth: [
                ['#0f766e', 'massa acumulada'],
                ['#e11d48', 'secao de corte'],
                ['#0ea5a4', 'secao de aterro']
            ],
            stake: [
                ['#0f766e', 'alinhamento'],
                ['#e11d48', 'locacao'],
                ['#78716c', 'visada']
            ]
        };
        document.getElementById('viewLegend').innerHTML = legends[this.activeTab].map(([color, label]) => `
            <span class="flex items-center gap-1"><span style="background:${color}" class="inline-block w-3 h-3 rounded-sm"></span>${label}</span>
        `).join('');
    },

    renderTable() {
        const table = document.getElementById('dataTable');
        const title = document.getElementById('tableTitle');
        const hint = document.getElementById('tableHint');
        if (this.activeTab === 'plan') {
            title.textContent = 'Locacao da curva horizontal';
            hint.textContent = 'Deflexoes a partir do PC';
            table.innerHTML = `
                <thead><tr>
                    <th>Estaca</th><th>Arco</th><th>Deflexao</th><th>Corda total</th><th>Corda inc.</th><th>E</th><th>N</th><th>Azimute</th>
                </tr></thead>
                <tbody>${this.curveTable.map(r => `
                    <tr>
                        <td>${this.formatStation(r.station)}</td>
                        <td class="num">${this.fmt(r.arc, 3)}</td>
                        <td class="num">${this.formatDms(r.deflection)}</td>
                        <td class="num">${this.fmt(r.totalChord, 3)}</td>
                        <td class="num">${this.fmt(r.incChord, 3)}</td>
                        <td class="num">${this.fmt(r.e, 3)}</td>
                        <td class="num">${this.fmt(r.n, 3)}</td>
                        <td class="num">${this.formatDms(r.azimuth)}</td>
                    </tr>
                `).join('')}</tbody>`;
            return;
        }
        if (this.activeTab === 'profile') {
            title.textContent = 'Perfil longitudinal';
            hint.textContent = 'Terreno, greide e diferenca no eixo';
            table.innerHTML = `
                <thead><tr>
                    <th>Estaca</th><th>Terreno</th><th>Greide</th><th>C/F eixo</th><th>Trecho</th>
                </tr></thead>
                <tbody>${this.profile.map(r => `
                    <tr>
                        <td>${this.formatStation(r.station)}</td>
                        <td class="num">${this.fmt(r.ground, 3)}</td>
                        <td class="num">${this.fmt(r.grade, 3)}</td>
                        <td class="num ${r.cutFill > 0 ? 'status-cut' : r.cutFill < 0 ? 'status-fill' : 'status-neutral'}">${this.fmt(Math.abs(r.cutFill), 3)} ${r.cutFill > 0 ? 'C' : r.cutFill < 0 ? 'A' : '-'}</td>
                        <td>${this.profileSegment(r.station)}</td>
                    </tr>
                `).join('')}</tbody>`;
            return;
        }
        if (this.activeTab === 'earth') {
            title.textContent = 'Volumes por areas medias';
            hint.textContent = 'm3 entre secoes consecutivas';
            table.innerHTML = `
                <thead><tr>
                    <th>Estaca</th><th>Area corte</th><th>Area aterro</th><th>Vol. corte</th><th>Vol. aterro</th><th>Aterro ajust.</th><th>Massa acum.</th>
                </tr></thead>
                <tbody>${this.earthRows.map(r => `
                    <tr>
                        <td>${this.formatStation(r.station)}</td>
                        <td class="num">${this.fmt(r.cutArea, 2)}</td>
                        <td class="num">${this.fmt(r.fillArea, 2)}</td>
                        <td class="num">${this.fmt(r.cutVolume, 1)}</td>
                        <td class="num">${this.fmt(r.fillVolume, 1)}</td>
                        <td class="num">${this.fmt(r.adjustedFillVolume, 1)}</td>
                        <td class="num ${r.cumulative >= 0 ? 'status-cut' : 'status-fill'}">${this.fmt(r.cumulative, 1)}</td>
                    </tr>
                `).join('')}</tbody>`;
            return;
        }
        title.textContent = 'Dados de locacao';
        hint.textContent = 'Offset positivo para a direita';
        const s = this.stake;
        const rows = [
            ['Estaca', this.formatStation(s.station)],
            ['Offset', `${this.fmt(s.offset, 3)} m`],
            ['E/N do ponto', `${this.fmt(s.point.e, 3)} / ${this.fmt(s.point.n, 3)}`],
            ['Azimute da visada', this.formatDms(s.azimuth)],
            ['Angulo a direita', this.formatDms(s.angleRight)],
            ['Distancia horizontal', `${this.fmt(s.distance, 3)} m`],
            ['Cota greide', `${this.fmt(s.grade, 3)} m`],
            ['Terreno no offset', `${this.fmt(s.ground, 3)} m`],
            ['Corte/Aterro', `${this.fmt(Math.abs(s.cutFill), 3)} m ${s.cutFill > 0 ? 'C' : s.cutFill < 0 ? 'A' : '-'}`]
        ];
        table.innerHTML = `
            <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
            <tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`).join('')}</tbody>`;
    },

    draw() {
        if (!this.ctx || !this.h || !this.v) return;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, width, height);
        this.drawCanvasBase(width, height);
        this._pendingOverlay = null;
        if (this.activeTab === 'plan' || this.activeTab === 'stake') {
            this._viewZoom = this.getActiveViewport().zoom;
            this.ctx.save();
            this.applyActiveViewport(width, height);
            if (this.activeTab === 'plan') this.drawPlan(width, height, false);
            if (this.activeTab === 'stake') this.drawPlan(width, height, true);
            this.ctx.restore();
            if (this._pendingOverlay) {
                this.drawInfoBox(this._pendingOverlay.lines, this._pendingOverlay.x, this._pendingOverlay.y);
                this._pendingOverlay = null;
            }
        } else {
            this._viewZoom = 1;
            if (this.activeTab === 'profile') this.drawProfile(width, height);
            if (this.activeTab === 'earth') this.drawEarth(width, height);
        }
    },

    getActiveViewport() {
        return this.viewports[this.activeTab] || this.viewports.plan;
    },

    applyActiveViewport(width, height) {
        const view = this.getActiveViewport();
        this.ctx.translate(width / 2 + view.panX, height / 2 + view.panY);
        this.ctx.scale(view.zoom, view.zoom);
        this.ctx.translate(-width / 2, -height / 2);
    },

    resetActiveViewport() {
        const view = this.getActiveViewport();
        view.zoom = 1;
        view.panX = 0;
        view.panY = 0;
        this.draw();
    },

    onCanvasWheel(event) {
        event.preventDefault();
        const view = this.getActiveViewport();
        const pos = this.canvasEventPoint(event);
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const oldZoom = view.zoom;
        const factor = Math.exp(-event.deltaY * 0.001);
        const nextZoom = Math.min(10, Math.max(0.35, oldZoom * factor));
        const ratio = nextZoom / oldZoom;

        view.panX = pos.x - centerX - (pos.x - centerX - view.panX) * ratio;
        view.panY = pos.y - centerY - (pos.y - centerY - view.panY) * ratio;
        view.zoom = nextZoom;
        this.draw();
    },

    onCanvasPointerDown(event) {
        if (event.button !== 0) return;
        const view = this.getActiveViewport();
        this.isPanning = true;
        this.panStart = this.canvasEventPoint(event);
        this.panOrigin = { x: view.panX, y: view.panY };
        this.canvas.classList.add('canvas-panning');
        this.canvas.setPointerCapture(event.pointerId);
    },

    onCanvasPointerMove(event) {
        if (!this.isPanning) return;
        const view = this.getActiveViewport();
        const pos = this.canvasEventPoint(event);
        view.panX = this.panOrigin.x + pos.x - this.panStart.x;
        view.panY = this.panOrigin.y + pos.y - this.panStart.y;
        this.draw();
    },

    onCanvasPointerUp(event) {
        if (!this.isPanning) return;
        this.isPanning = false;
        this.panStart = null;
        this.panOrigin = null;
        this.canvas.classList.remove('canvas-panning');
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
    },

    canvasEventPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    },

    drawCanvasBase(width, height) {
        const ctx = this.ctx;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#f5f5f4';
        ctx.lineWidth = 1;
        for (let x = 40; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 40; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
    },

    drawPlan(width, height, includeInstrument) {
        const ctx = this.ctx;
        const samples = [];
        const step = Math.max(5, this.h.length / 60);
        for (let s = this.h.startStation; s <= this.h.routeEnd; s += step) samples.push({ station: s, ...this.pointAtStation(s) });
        samples.push({ station: this.h.piStation, ...this.h.pi });
        samples.push({ station: this.h.pcStation, ...this.h.pc });
        samples.push({ station: this.h.ptStation, ...this.h.pt });
        if (this.stake) {
            samples.push({ ...this.stake.point });
            samples.push({ ...this.stake.inst });
        }
        const tr = this.fitTransform(samples, width, height, 50);

        this.strokePolyline(samples.filter(p => p.station != null).map(p => tr(p)), '#0f766e', 4);
        ctx.setLineDash([7, 6]);
        this.strokePolyline([tr(this.h.pc), tr(this.h.pi), tr(this.h.pt)], '#78716c', 1.4);
        ctx.setLineDash([]);

        this.drawPoint(tr(this.h.pc), '#0f766e', 'PC');
        this.drawPoint(tr(this.h.pt), '#0f766e', 'PT');
        this.drawPoint(tr(this.h.pi), '#1c1917', 'PI');

        const interval = Math.max(20, this.val('stationInterval', 20) * 5);
        this.rangeStations(Math.ceil(this.h.startStation / interval) * interval, this.h.routeEnd, interval).forEach(st => {
            const p = this.pointAtStation(st);
            const screen = tr(p);
            const zoom = this._viewZoom || 1;
            ctx.fillStyle = '#57534e';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 2.3 / zoom, 0, Math.PI * 2);
            ctx.fill();
            if (st % (interval * 2) === 0) this.drawSmallLabel(this.formatStation(st), screen.x + 5, screen.y - 5, '#57534e');
        });

        if (this.stake) {
            const sp = tr(this.stake.point);
            this.drawPoint(sp, '#e11d48', 'P');
            if (includeInstrument) {
                const ip = tr(this.stake.inst);
                this.drawPoint(ip, '#78716c', 'TS');
                ctx.strokeStyle = '#a8a29e';
                ctx.lineWidth = 1.4 / (this._viewZoom || 1);
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(ip.x, ip.y);
                ctx.lineTo(sp.x, sp.y);
                ctx.stroke();
                ctx.setLineDash([]);
                this._pendingOverlay = {
                    lines: [
                        `Az ${this.formatDms(this.stake.azimuth)}`,
                        `AD ${this.formatDms(this.stake.angleRight)}`,
                        `DH ${this.fmt(this.stake.distance, 3)} m`
                    ],
                    x: 18, y: 18
                };
            }
        }
    },

    drawProfile(width, height) {
        const ctx = this.ctx;
        const pad = { l: 54, r: 18, t: 24, b: 44 };
        const stations = this.profile.map(p => p.station);
        const elevs = this.profile.flatMap(p => [p.ground, p.grade]);
        const minS = Math.min(...stations);
        const maxS = Math.max(...stations);
        const minE = Math.min(...elevs) - 1.5;
        const maxE = Math.max(...elevs) + 1.5;
        const chartPxW = width - pad.l - pad.r;
        const chartPxH = height - pad.t - pad.b;
        const view = this.getActiveViewport();
        const cx_left  = (pad.l          - width  / 2 - view.panX) / view.zoom + width  / 2;
        const cx_right = (width  - pad.r  - width  / 2 - view.panX) / view.zoom + width  / 2;
        const cy_top   = (pad.t          - height / 2 - view.panY) / view.zoom + height / 2;
        const cy_bot   = (height - pad.b  - height / 2 - view.panY) / view.zoom + height / 2;
        const visMinS = minS + (cx_left  - pad.l) / chartPxW * (maxS - minS);
        const visMaxS = minS + (cx_right - pad.l) / chartPxW * (maxS - minS);
        const visMaxE = maxE - (cy_top - pad.t) / chartPxH * (maxE - minE);
        const visMinE = maxE - (cy_bot - pad.t) / chartPxH * (maxE - minE);
        const sx = s => pad.l + (s - visMinS) / (visMaxS - visMinS) * chartPxW;
        const sy = e => pad.t + (visMaxE - e) / (visMaxE - visMinE) * chartPxH;
        this.drawAxes(width, height, pad, visMinS, visMaxS, visMinE, visMaxE, sx, sy);

        for (let i = 1; i < this.profile.length; i++) {
            const a = this.profile[i - 1];
            const b = this.profile[i];
            ctx.fillStyle = (a.ground + b.ground) / 2 > (a.grade + b.grade) / 2 ? 'rgba(225, 29, 72, 0.10)' : 'rgba(15, 118, 110, 0.11)';
            ctx.beginPath();
            ctx.moveTo(sx(a.station), sy(a.ground));
            ctx.lineTo(sx(b.station), sy(b.ground));
            ctx.lineTo(sx(b.station), sy(b.grade));
            ctx.lineTo(sx(a.station), sy(a.grade));
            ctx.closePath();
            ctx.fill();
        }
        this.strokePolyline(this.profile.map(p => ({ x: sx(p.station), y: sy(p.ground) })), '#a16207', 2.2);
        this.strokePolyline(this.profile.map(p => ({ x: sx(p.station), y: sy(p.grade) })), '#0f766e', 3);
        [this.v.bvcStation, this.v.vpiStation, this.v.evcStation].forEach((s, i) => {
            const label = ['BVC', 'VPI', 'EVC'][i];
            const x = sx(s);
            ctx.strokeStyle = '#d6d3d1';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, height - pad.b); ctx.stroke();
            ctx.setLineDash([]);
            this.drawSmallLabel(label, x + 4, pad.t + 12, '#57534e');
        });
    },

    drawEarth(width, height) {
        const ctx = this.ctx;
        const selected = this.closestEarthRow(this.stake.station);
        const pad = { l: 54, r: 18, t: 24, b: 44 };
        const stations = this.earthRows.map(r => r.station);
        const masses = this.earthRows.map(r => r.cumulative);
        const minS = Math.min(...stations);
        const maxS = Math.max(...stations);
        const maxAbs = Math.max(1, ...masses.map(v => Math.abs(v))) * 1.15;
        const chartPxW = width - pad.l - pad.r;
        const earthChartH = height * 0.52 - pad.t;
        const view = this.getActiveViewport();
        const cx_left  = (pad.l          - width  / 2 - view.panX) / view.zoom + width  / 2;
        const cx_right = (width  - pad.r  - width  / 2 - view.panX) / view.zoom + width  / 2;
        const cy_top   = (pad.t          - height / 2 - view.panY) / view.zoom + height / 2;
        const cy_bot   = (height * 0.52   - height / 2 - view.panY) / view.zoom + height / 2;
        const visMinS = minS + (cx_left  - pad.l) / chartPxW * (maxS - minS);
        const visMaxS = minS + (cx_right - pad.l) / chartPxW * (maxS - minS);
        const visMaxM = maxAbs - (cy_top - pad.t) / earthChartH * 2 * maxAbs;
        const visMinM = maxAbs - (cy_bot - pad.t) / earthChartH * 2 * maxAbs;
        const sx = s => pad.l + (s - visMinS) / (visMaxS - visMinS) * chartPxW;
        const sy = m => pad.t + (visMaxM - m) / (visMaxM - visMinM) * earthChartH;
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, sy(0));
        ctx.lineTo(width - pad.r, sy(0));
        ctx.stroke();
        this.strokePolyline(this.earthRows.map(r => ({ x: sx(r.station), y: sy(r.cumulative) })), '#0f766e', 3);
        this.drawSmallLabel('diagrama de massa', pad.l, pad.t + 4, '#57534e');
        this.drawSmallLabel(`${this.fmt(maxAbs, 0)} m3`, pad.l, sy(maxAbs) + 12, '#78716c');
        this.drawSmallLabel(`${this.fmt(-maxAbs, 0)} m3`, pad.l, sy(-maxAbs) - 4, '#78716c');

        const crossTop = height * 0.60;
        this.drawCrossSection(selected, width, height, crossTop);
    },

    drawCrossSection(row, width, height, top) {
        const ctx = this.ctx;
        const grade = row.grade;
        const groundCenter = row.ground;
        const crossSlope = this.val('crossSlope', 4) / 100;
        const roadWidth = this.val('roadWidth', 12);
        const half = roadWidth / 2;
        const left = row.leftIntercept;
        const right = row.rightIntercept;
        const cutSlope = Math.max(0.2, this.val('cutSlope', 1.5));
        const fillSlope = Math.max(0.2, this.val('fillSlope', 2));
        const ground = x => groundCenter + crossSlope * x;
        const design = x => {
            if (x < -half) {
                const edgeG = ground(-half);
                return edgeG >= grade ? grade + (-half - x) / cutSlope : grade - (-half - x) / fillSlope;
            }
            if (x > half) {
                const edgeG = ground(half);
                return edgeG >= grade ? grade + (x - half) / cutSlope : grade - (x - half) / fillSlope;
            }
            return grade;
        };
        const xs = [];
        const n = 70;
        for (let i = 0; i <= n; i++) xs.push(left + (right - left) * i / n);
        const ys = xs.flatMap(x => [ground(x), design(x)]);
        const minY = Math.min(...ys) - 0.8;
        const maxY = Math.max(...ys) + 0.8;
        const pad = { l: 60, r: 26, t: top + 22, b: 24 };
        const sx = x => pad.l + (x - left) / (right - left) * (width - pad.l - pad.r);
        const sy = y => pad.t + (maxY - y) / (maxY - minY) * (height - pad.t - pad.b);
        this.drawSmallLabel(`secao ${this.formatStation(row.station)}`, pad.l, top + 14, '#57534e');

        for (let i = 1; i < xs.length; i++) {
            const a = xs[i - 1], b = xs[i];
            const mid = (a + b) / 2;
            ctx.fillStyle = ground(mid) > design(mid) ? 'rgba(225,29,72,.13)' : 'rgba(15,118,110,.14)';
            ctx.beginPath();
            ctx.moveTo(sx(a), sy(ground(a)));
            ctx.lineTo(sx(b), sy(ground(b)));
            ctx.lineTo(sx(b), sy(design(b)));
            ctx.lineTo(sx(a), sy(design(a)));
            ctx.closePath();
            ctx.fill();
        }
        this.strokePolyline(xs.map(x => ({ x: sx(x), y: sy(ground(x)) })), '#a16207', 2);
        this.strokePolyline(xs.map(x => ({ x: sx(x), y: sy(design(x)) })), '#0f766e', 3);
        ctx.strokeStyle = '#d6d3d1';
        ctx.beginPath(); ctx.moveTo(sx(0), sy(maxY)); ctx.lineTo(sx(0), sy(minY)); ctx.stroke();
        this.drawSmallLabel(`C ${this.fmt(row.cutArea, 2)} m2 | A ${this.fmt(row.fillArea, 2)} m2`, width - 210, top + 14, '#57534e');
    },

    drawAxes(width, height, pad, minS, maxS, minE, maxE, sx, sy) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t);
        ctx.lineTo(pad.l, height - pad.b);
        ctx.lineTo(width - pad.r, height - pad.b);
        ctx.stroke();
        ctx.fillStyle = '#78716c';
        ctx.font = '11px JetBrains Mono, monospace';
        for (let i = 0; i <= 4; i++) {
            const e = minE + (maxE - minE) * i / 4;
            const y = sy(e);
            ctx.strokeStyle = '#f1f5f9';
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
            ctx.fillText(this.fmt(e, 1), 8, y + 4);
        }
        for (let i = 0; i <= 5; i++) {
            const s = minS + (maxS - minS) * i / 5;
            ctx.fillText(this.formatStation(s), sx(s) - 18, height - 18);
        }
    },

    drawPoint(p, color, label) {
        const ctx = this.ctx;
        const zoom = this._viewZoom || 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        this.drawSmallLabel(label, p.x + 7 / zoom, p.y - 7 / zoom, color);
    },

    drawSmallLabel(text, x, y, color) {
        const ctx = this.ctx;
        const zoom = this._viewZoom || 1;
        ctx.font = `${11 / zoom}px Inter, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    },

    drawInfoBox(lines, x, y) {
        const ctx = this.ctx;
        ctx.font = '12px JetBrains Mono, monospace';
        const w = Math.max(...lines.map(t => ctx.measureText(t).width)) + 22;
        const h = lines.length * 20 + 14;
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#292524';
        lines.forEach((line, i) => ctx.fillText(line, x + 11, y + 22 + i * 20));
    },

    strokePolyline(points, color, width) {
        if (points.length < 2) return;
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = width / (this._viewZoom || 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    },

    fitTransform(points, width, height, pad) {
        const minE = Math.min(...points.map(p => p.e));
        const maxE = Math.max(...points.map(p => p.e));
        const minN = Math.min(...points.map(p => p.n));
        const maxN = Math.max(...points.map(p => p.n));
        const spanE = Math.max(1, maxE - minE);
        const spanN = Math.max(1, maxN - minN);
        const scale = Math.min((width - 2 * pad) / spanE, (height - 2 * pad) / spanN);
        return p => ({
            x: pad + (p.e - minE) * scale + ((width - 2 * pad) - spanE * scale) / 2,
            y: height - pad - (p.n - minN) * scale - ((height - 2 * pad) - spanN * scale) / 2
        });
    },

    profileSegment(station) {
        if (Math.abs(station - this.v.bvcStation) < 1e-6) return 'BVC';
        if (Math.abs(station - this.v.evcStation) < 1e-6) return 'EVC';
        if (station < this.v.bvcStation) return 'Tangente g1';
        if (station > this.v.evcStation) return 'Tangente g2';
        return 'Parabola';
    },

    closestEarthRow(station) {
        return this.earthRows.reduce((best, row) => (
            Math.abs(row.station - station) < Math.abs(best.station - station) ? row : best
        ), this.earthRows[0]);
    },

    intersectionX(lineA, lineB) {
        const den = lineA.a - lineB.a;
        if (Math.abs(den) < 1e-12) return NaN;
        return (lineB.b - lineA.b) / den;
    },

    integrateDifference(x1, x2, p, q) {
        if (x2 < x1) [x1, x2] = [x2, x1];
        const d1 = p * x1 + q;
        const d2 = p * x2 + q;
        const area = (a, b) => 0.5 * (p * a + q + p * b + q) * (b - a);
        if (d1 >= 0 && d2 >= 0) return { cut: area(x1, x2), fill: 0 };
        if (d1 <= 0 && d2 <= 0) return { cut: 0, fill: -area(x1, x2) };
        const x0 = -q / p;
        if (d1 > 0) return { cut: area(x1, x0), fill: -area(x0, x2) };
        return { cut: area(x0, x2), fill: -area(x1, x0) };
    },

    rangeStations(start, end, step) {
        const out = [];
        for (let s = start; s <= end + 1e-7; s += step) out.push(s);
        return out;
    },

    uniqueStations(stations) {
        const sorted = stations.filter(Number.isFinite).sort((a, b) => a - b);
        const out = [];
        sorted.forEach(station => {
            if (!out.length || Math.abs(station - out[out.length - 1]) > 1e-6) out.push(station);
        });
        return out;
    },

    forwardVector(az) {
        return { e: Math.sin(az), n: Math.cos(az) };
    },

    rightVector(az) {
        return { e: Math.cos(az), n: -Math.sin(az) };
    },

    leftVector(az) {
        const r = this.rightVector(az);
        return { e: -r.e, n: -r.n };
    },

    degToRad(deg) {
        return deg * Math.PI / 180;
    },

    radToDeg(rad) {
        return rad * 180 / Math.PI;
    },

    normRad(rad) {
        const twoPi = Math.PI * 2;
        return ((rad % twoPi) + twoPi) % twoPi;
    },

    formatStation(station) {
        const sign = station < 0 ? '-' : '';
        const s = Math.abs(station);
        const km = Math.floor(s / 1000);
        const m = s - km * 1000;
        return `${sign}${km}+${m.toFixed(3).padStart(7, '0')}`;
    },

    formatDms(rad) {
        const totalTenths = Math.round(this.radToDeg(this.normRad(rad)) * 36000) % (360 * 36000);
        const d = Math.floor(totalTenths / 36000);
        const rem = totalTenths - d * 36000;
        const m = Math.floor(rem / 600);
        const sec = (rem - m * 600) / 10;
        return `${String(d).padStart(3, '0')}°${String(m).padStart(2, '0')}'${sec.toFixed(1).padStart(4, '0')}"`;
    },

    fmt(value, digits = 2) {
        if (!Number.isFinite(value)) return '-';
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
