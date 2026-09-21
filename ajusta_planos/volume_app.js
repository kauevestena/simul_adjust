// --- Interface da estimativa de volume ---
// Cinco painéis empilhados: dados -> ajustamento das seis faces -> resumo -> volume geométrico
// -> propagação e intervalos. O cálculo vive em volume.js; aqui só há orquestração e desenho.
const volApp = {

    // A injunção unitária é fixa nesta página: é o gauge em que Sigma_Xa pode ser propagada
    // para o volume sem nenhuma reparametrização.
    settings: Object.assign({}, PlanoIO.DEFAULT_SETTINGS, { gauge: 'constraint' }),

    faces: [],          // uma entrada por slot de PlanoVolume.SLOTS
    est: null,          // resultado de PlanoVolume.estimate
    viewer: null,
    _loadSeq: 0,
    _upload: [],

    init() {
        this.faces = PlanoVolume.SLOTS.map((slot, i) => ({
            slot, idx: i, rows: null, points: null, result: null, normalized: null,
            det: null, metodo: '3sigma', origem: null
        }));
        this._buildFacePanels();
        this._buildUploadSlots();
        this._updateButtons();
    },

    // ------------------------------------------------------------------ painel 1: dados

    async loadExample() {
        const seq = ++this._loadSeq;
        const g = document.getElementById('dataSummary');
        g.innerHTML = 'Carregando as seis amostras…';
        try {
            const textos = await Promise.all(PlanoVolume.SLOTS.map(async s => {
                const resp = await fetch(`samples/${s.sample}`);
                if (!resp.ok) throw new Error(`${s.sample}: HTTP ${resp.status}`);
                return resp.text();
            }));
            if (seq !== this._loadSeq) return;   // outro carregamento começou no meio
            const parsed = textos.map(t => PlanoIO.parseCSV(t));
            const ruins = parsed.flatMap((p, i) => p.errors.map(e => `${PlanoVolume.SLOTS[i].sample}: ${e}`));
            if (ruins.length) throw new Error(ruins.slice(0, 5).join('\n'));
            this._setFaces(parsed.map(p => p.rows), PlanoVolume.SLOTS.map(s => s.sample));
        } catch (e) {
            g.innerHTML = '';
            alert('Não foi possível ler as amostras.\n\n' + e.message +
                '\n\nA página precisa ser servida por HTTP (os CSVs são lidos com fetch): ' +
                'rode "python3 -m http.server" na raiz do repositório.');
        }
    },

    _setFaces(listaDeRows, origens) {
        this.faces.forEach((f, i) => {
            f.rows = listaDeRows[i];
            f.points = PlanoIO.buildPoints(listaDeRows[i], this.settings);
            f.result = null; f.normalized = null; f.det = null;
            f.origem = origens[i];
        });
        this.est = null;
        const total = this.faces.reduce((s, f) => s + f.points.length, 0);
        document.getElementById('dataSummary').innerHTML =
            `<span class="font-semibold text-stone-700">${total} observações</span> em 6 faces: ` +
            this.faces.map(f => `${f.slot.label} <span class="font-mono">${f.points.length}</span>`).join(' · ');
        this.runChecks();
        this.faces.forEach((_, i) => this.renderFace(i));
        this.renderSummary();
        this._updateButtons();
    },

    onChecksToggle() { this.runChecks(); },

    runChecks() {
        const alvo = document.getElementById('checkList');
        const ligado = document.getElementById('chkChecks').checked;
        if (!ligado || !this.faces[0].points) { alvo.innerHTML = ''; return; }
        let chk;
        try {
            chk = PlanoVolume.geometryChecks(this.faces.map(f => f.points.map(p => p.xyz)));
        } catch (e) {
            alvo.innerHTML = `<p class="text-xs text-rose-600">Conferências falharam: ${e.message}</p>`;
            return;
        }
        alvo.innerHTML = chk.itens.map(it => `
            <div class="flex gap-1.5 items-start text-[11px] leading-tight py-0.5">
                <span class="${it.ok ? 'text-teal-600' : 'text-amber-600'} font-bold">${it.ok ? '✓' : '!'}</span>
                <span><span class="font-semibold text-stone-700">${it.titulo}</span>
                    <span class="text-stone-500">— ${it.detalhe}</span></span>
            </div>`).join('');
        const avisos = chk.itens.filter(i => !i.ok).length;
        if (avisos) {
            alvo.innerHTML += `<p class="text-[11px] text-amber-700 col-span-full mt-1">${avisos}
                conferência(s) fora da tolerância. Isso não impede o cálculo — só avisa que os arquivos
                podem estar em slots trocados.</p>`;
        }
    },

    // ------------------------------------------------------------------ modal de upload

    _buildUploadSlots() {
        document.getElementById('uploadSlots').innerHTML = PlanoVolume.SLOTS.map((s, i) => `
            <div>
                <label class="field-label" for="up${i}">${i + 1}. ${s.label}
                    <span class="text-stone-400 font-normal">(${s.tipo})</span></label>
                <input id="up${i}" type="file" accept=".csv,.txt" class="field text-[11px]"
                       onchange="volApp.onUploadPick(${i}, event)">
            </div>`).join('');
    },

    openUploadModal() {
        this._upload = new Array(6).fill(null);
        document.getElementById('uploadStatus').innerHTML = '';
        document.getElementById('btnConfirmUpload').disabled = true;
        PlanoVolume.SLOTS.forEach((_, i) => { document.getElementById(`up${i}`).value = ''; });
        document.getElementById('uploadModal').style.display = 'flex';
    },

    closeUploadModal() { document.getElementById('uploadModal').style.display = 'none'; },

    onUploadPick(i, event) {
        const file = event.target.files[0];
        if (!file) { this._upload[i] = null; this._uploadStatus(); return; }
        const reader = new FileReader();
        reader.onload = e => {
            const parsed = PlanoIO.parseCSV(e.target.result);
            this._upload[i] = { nome: file.name, parsed };
            this._uploadStatus();
        };
        reader.readAsText(file);
    },

    _uploadStatus() {
        const prontos = this._upload.filter(u => u && u.parsed.rows.length).length;
        const problemas = this._upload.flatMap((u, i) => !u ? [] :
            (u.parsed.errors.length ? [`${PlanoVolume.SLOTS[i].label}: ${u.parsed.errors.length} linha(s) inválida(s)`] :
                (u.parsed.rows.length < 4 ? [`${PlanoVolume.SLOTS[i].label}: só ${u.parsed.rows.length} observações, mínimo 4`] : [])));
        document.getElementById('uploadStatus').innerHTML =
            `<span class="${prontos === 6 ? 'text-teal-700' : 'text-stone-500'}">${prontos} de 6 slots preenchidos.</span>` +
            (problemas.length ? `<br><span class="text-amber-700">${problemas.join('<br>')}</span>` : '');
        document.getElementById('btnConfirmUpload').disabled = !(prontos === 6 && !problemas.length);
    },

    confirmUpload() {
        this._loadSeq++;   // cancela qualquer carregamento de exemplo em voo
        this._setFaces(this._upload.map(u => u.parsed.rows), this._upload.map(u => u.nome));
        this.closeUploadModal();
    },

    // ------------------------------------------------------------------ painel 2: ajustamento

    _buildFacePanels() {
        document.getElementById('facePanels').innerHTML = this.faces.map((f, i) => `
            <div class="border border-stone-200 rounded-lg overflow-hidden" id="facePanel${i}">
                <div class="bg-stone-50 px-3 py-1.5 flex justify-between items-center border-b border-stone-200">
                    <span class="text-xs font-bold text-stone-700">${i + 1}. ${f.slot.label}
                        <span class="font-normal text-stone-400" id="faceOrigem${i}"></span></span>
                    <span class="text-[11px]" id="faceBadge${i}"></span>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-3 p-3">
                    <div class="lg:col-span-2 space-y-2">
                        <button onclick="volApp.adjustFace(${i})" id="btnAdj${i}" disabled
                            class="btn w-full py-1.5 bg-teal-600 text-white rounded shadow hover:bg-teal-700
                                   text-xs font-bold">&#9654; Ajustar</button>
                        <div class="border-t border-stone-100 pt-2">
                            <label class="field-label" for="met${i}">Detecção de outliers</label>
                            <select id="met${i}" class="field text-xs" onchange="volApp.onMethodChange(${i})">
                                <option value="3sigma">Regra kσ (a priori)</option>
                                <option value="snooping">Data snooping iterativo</option>
                                <option value="ransac">RANSAC</option>
                            </select>
                            <div id="metOpts${i}" class="mt-2 grid grid-cols-2 gap-2"></div>
                            <button onclick="volApp.detectFace(${i})" id="btnDet${i}" disabled
                                class="btn w-full mt-2 py-1 bg-amber-500 text-white rounded shadow
                                       hover:bg-amber-600 text-[11px] font-bold">&#9888; Detectar outliers</button>
                            <button onclick="volApp.removeAndRefit(${i})" id="btnRem${i}" disabled
                                class="btn w-full mt-1.5 py-1 bg-stone-100 text-stone-700 border
                                       border-stone-300 rounded hover:bg-stone-200 text-[11px] font-semibold">
                                &#8635; Remover outliers e recalcular</button>
                            <button onclick="volApp.resetFace(${i})" id="btnReset${i}" disabled
                                class="btn w-full mt-1.5 py-1 text-stone-500 hover:text-stone-800 text-[11px]">
                                Reativar todas as observações</button>
                        </div>
                    </div>
                    <div class="lg:col-span-3" id="faceOut${i}">
                        <p class="text-xs text-stone-400 italic">Aguardando ajustamento.</p>
                    </div>
                </div>
            </div>`).join('');
        this.faces.forEach((_, i) => this.onMethodChange(i));
    },

    onMethodChange(i) {
        const m = document.getElementById(`met${i}`).value;
        this.faces[i].metodo = m;
        const s = this.settings;
        const campo = (id, rot, val, step) => `
            <div><label class="field-label text-[10px]" for="${id}${i}">${rot}</label>
                 <input id="${id}${i}" type="number" step="${step}" value="${val}" class="field text-xs"></div>`;
        const html = m === '3sigma' ? campo('optK', 'k (sigmas)', s.sigmaRuleK, '0.1')
            : m === 'snooping' ? campo('optA0', 'α₀ (%)', s.alpha0Pct, '0.01')
                : campo('optIt', 'iterações', s.ransacIters, '100') +
                  campo('optTh', 'limiar (mm)', s.ransacThreshMm, '0.5');
        document.getElementById(`metOpts${i}`).innerHTML = html;
    },

    // Settings da face, com os parâmetros do método escolhido
    _faceSettings(i) {
        const s = Object.assign({}, this.settings);
        const num = id => {
            const el = document.getElementById(`${id}${i}`);
            return el ? parseFloat(el.value) : NaN;
        };
        const m = this.faces[i].metodo;
        if (m === '3sigma' && isFinite(num('optK'))) s.sigmaRuleK = num('optK');
        if (m === 'snooping' && isFinite(num('optA0'))) s.alpha0Pct = num('optA0');
        if (m === 'ransac') {
            if (isFinite(num('optIt'))) s.ransacIters = num('optIt');
            if (isFinite(num('optTh'))) s.ransacThreshMm = num('optTh');
        }
        return s;
    },

    adjustFace(i) {
        const f = this.faces[i];
        if (!f.points) return;
        try {
            f.result = PlaneAdjust.adjustPlane(f.points, this._faceSettings(i));
            // Normaliza sempre: é o que torna os parâmetros das seis faces comparáveis e é a
            // forma em que a MVC entra na propagação.
            f.normalized = PlaneAdjust.normalizeParameters(f.result);
            f.det = null;
            if (!f.result.converged) {
                alert(`${f.slot.label}: o ajustamento não convergiu em ${this.settings.maxIter} iterações.`);
            }
        } catch (e) {
            f.result = null; f.normalized = null;
            alert(`${f.slot.label}: falha no ajustamento.\n\n${e.message}`);
        }
        this.est = null;
        this.renderFace(i);
        this.renderSummary();
        this._updateButtons();
    },

    adjustAll() { this.faces.forEach((_, i) => this.adjustFace(i)); },

    detectFace(i) {
        const f = this.faces[i];
        if (!f.result) return;
        try {
            f.det = PlaneAdjust.detectOutliers(f.points, f.result, f.metodo, this._faceSettings(i));
            f.points.forEach(p => { p.flagged = false; });
            f.det.flagged.forEach(k => { if (f.points[k]) f.points[k].flagged = true; });
        } catch (e) {
            alert(`${f.slot.label}: falha na detecção.\n\n${e.message}`);
            return;
        }
        this.renderFace(i);
        this._updateButtons();
    },

    removeAndRefit(i) {
        const f = this.faces[i];
        if (!f.det || !f.det.flagged.length) return;
        f.det.flagged.forEach(k => { if (f.points[k]) f.points[k].active = false; });
        const restantes = f.points.filter(p => p.active).length;
        if (restantes < 4) {
            alert(`${f.slot.label}: sobrariam só ${restantes} observações ativas, o mínimo é 4.`);
            f.det.flagged.forEach(k => { if (f.points[k]) f.points[k].active = true; });
            return;
        }
        this.adjustFace(i);
    },

    resetFace(i) {
        const f = this.faces[i];
        if (!f.points) return;
        f.points.forEach(p => { p.active = true; p.flagged = false; });
        f.det = null;
        this.adjustFace(i);
    },

    renderFace(i) {
        const f = this.faces[i];
        document.getElementById(`faceOrigem${i}`).textContent = f.origem ? `· ${f.origem}` : '';
        const badge = document.getElementById(`faceBadge${i}`);
        const alvo = document.getElementById(`faceOut${i}`);

        if (!f.result) {
            badge.innerHTML = f.points
                ? `<span class="badge badge-off">${f.points.length} obs</span>`
                : '';
            alvo.innerHTML = '<p class="text-xs text-stone-400 italic">Aguardando ajustamento.</p>';
            return;
        }

        const r = f.result, X = f.normalized.Xn, S = f.normalized.SigmaXn;
        const ativas = f.points.filter(p => p.active).length;
        const desativadas = f.points.length - ativas;
        const rms = this._rms(r);
        badge.innerHTML =
            `<span class="badge ${r.globalPass ? 'badge-ok' : 'badge-out'}">${r.globalPass ? 'teste global passa' : 'teste global reprova'}</span>` +
            ` <span class="badge badge-off">${ativas} obs${desativadas ? ` (−${desativadas})` : ''}</span>`;

        const nomes = ['A', 'B', 'C', 'D'];
        const params = nomes.map((n, k) => `
            <tr><td class="font-mono font-bold pr-2">${n}</td>
                <td class="font-mono text-right pr-3">${X[k].toFixed(9)}</td>
                <td class="font-mono text-right text-stone-500">${Math.sqrt(Math.max(S[k][k], 0)).toExponential(2)}</td></tr>`).join('');
        const mvc = S.map((linha, a) => `<tr><td class="font-mono text-stone-400 pr-2">${nomes[a]}</td>` +
            linha.map(v => `<td class="font-mono text-right pl-2">${v.toExponential(2)}</td>`).join('') + '</tr>').join('');

        alvo.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Parâmetros (‖n‖ = 1)</p>
                    <table class="text-[11px] w-full"><thead><tr class="text-stone-400">
                        <th></th><th class="text-right pr-3">valor</th><th class="text-right">σ</th></tr></thead>
                        <tbody>${params}</tbody></table>
                    <p class="text-[11px] mt-2 text-stone-600">
                        σ̂₀² = <span class="font-mono font-bold">${r.sigma02.toFixed(4)}</span> ·
                        gl = <span class="font-mono">${r.dof}</span><br>
                        RMS dos resíduos = <span class="font-mono font-bold">${rms.toFixed(3)} mm</span> ·
                        ${r.iterations} iterações</p>
                    ${f.det ? this._detSummary(f) : ''}
                </div>
                <div>
                    <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">MVC dos parâmetros</p>
                    <table class="text-[10px] w-full"><thead><tr class="text-stone-400">
                        <th></th>${nomes.map(n => `<th class="text-right pl-2">${n}</th>`).join('')}</tr></thead>
                        <tbody>${mvc}</tbody></table>
                </div>
            </div>`;
    },

    _detSummary(f) {
        const n = f.det.flagged.length;
        return `<p class="text-[11px] mt-2 ${n ? 'text-rose-600' : 'text-teal-700'}">
            ${f.det.method}: ${n ? `${n} observação(ões) marcada(s)` : 'nenhum outlier'}
            ${f.det.detail ? `<span class="text-stone-400">· ${f.det.detail}</span>` : ''}</p>`;
    },

    // RMS dos resíduos ortogonais ao plano, em mm
    _rms(r) {
        if (!r.obsData.length) return 0;
        return Math.sqrt(r.obsData.reduce((s, o) => s + o.d * o.d, 0) / r.obsData.length) * 1000;
    },

    // ------------------------------------------------------------------ painel 3: resumo

    renderSummary() {
        const alvo = document.getElementById('summaryTable');
        if (!this._allAdjusted()) {
            const feitas = this.faces.filter(f => f.result).length;
            alvo.className = 'table-container text-xs text-stone-500 italic';
            alvo.innerHTML = `Ajuste as seis faces para ver o resumo (${feitas} de 6 prontas).`;
            return;
        }
        alvo.className = 'table-container';
        const linhas = this.faces.map(f => {
            const X = f.normalized.Xn, S = f.normalized.SigmaXn;
            const cel = k => `<td class="font-mono text-right pr-1">${X[k].toFixed(6)}</td>
                <td class="font-mono text-right text-stone-500 pr-3 text-[10px]">${Math.sqrt(Math.max(S[k][k], 0)).toExponential(1)}</td>`;
            return `<tr class="border-b border-stone-100">
                <td class="font-semibold pr-3">${f.slot.label}</td>
                <td class="font-mono text-right pr-3 text-stone-500">${f.result.m}</td>
                ${[0, 1, 2, 3].map(cel).join('')}
                <td class="font-mono text-right pr-3 ${f.result.globalPass ? '' : 'text-rose-600 font-bold'}">${f.result.sigma02.toFixed(3)}</td>
                <td class="font-mono text-right">${this._rms(f.result).toFixed(2)}</td></tr>`;
        }).join('');
        alvo.innerHTML = `
            <table class="text-[11px] w-full min-w-[720px]">
                <thead><tr class="text-stone-400 border-b border-stone-200">
                    <th class="text-left pb-1">face</th><th class="text-right pr-3">obs</th>
                    <th class="text-right pr-1">A</th><th class="text-right pr-3">σ</th>
                    <th class="text-right pr-1">B</th><th class="text-right pr-3">σ</th>
                    <th class="text-right pr-1">C</th><th class="text-right pr-3">σ</th>
                    <th class="text-right pr-1">D</th><th class="text-right pr-3">σ</th>
                    <th class="text-right pr-3">σ̂₀²</th><th class="text-right">RMS (mm)</th>
                </tr></thead><tbody>${linhas}</tbody></table>
            <p class="text-[11px] text-stone-500 mt-2">σ̂₀² em vermelho marca as faces que reprovam o teste
                global: a superfície é mais rugosa que os 2 mm + 2″ nominais do instrumento.</p>`;
    },

    // ------------------------------------------------------------------ painel 4: volume

    computeVolume() {
        if (!this._allAdjusted()) return;
        try {
            this.est = PlanoVolume.estimate(this.faces.map(f => ({
                X: f.normalized.Xn, Sigma: f.normalized.SigmaXn, dof: f.result.dof
            })));
        } catch (e) {
            alert('Falha no cálculo do volume.\n\n' + e.message);
            return;
        }
        this.renderVolume();
        this.renderProp();
        this.renderFinal();
        this._updateButtons();
    },

    _katex(el, tex) {
        if (typeof katex === 'undefined') { el.textContent = tex; return; }
        try { katex.render(tex, el, { displayMode: true, throwOnError: false }); }
        catch (e) { el.textContent = tex; }
    },

    renderVolume() {
        const e = this.est;
        document.getElementById('volumeHint').style.display = 'none';
        document.getElementById('volumeBody').style.display = '';

        const cont = document.getElementById('volumeFormula');
        cont.innerHTML = `<p class="text-[11px] text-stone-500 mb-2">Cada vértice é o encontro de três
            planos, um de cada par de faces opostas:</p><div id="fx1"></div>
            <p class="text-[11px] text-stone-500 mt-3 mb-2">As seis faces são planas, então o volume sai
            exato da fronteira triangulada — 6 faces × 2 triângulos, orientados para fora:</p><div id="fx2"></div>`;
        this._katex(document.getElementById('fx1'),
            '\\mathbf{M}_{ijk}\\,\\mathbf{v}_{ijk} = -\\mathbf{d}_{ijk}, \\qquad ' +
            '\\mathbf{M}_{ijk} = \\begin{bmatrix} \\mathbf{n}_i^{\\mathsf{T}} \\\\ \\mathbf{n}_j^{\\mathsf{T}} \\\\ ' +
            '\\mathbf{n}_k^{\\mathsf{T}} \\end{bmatrix}, \\quad \\mathbf{d}_{ijk} = (D_i, D_j, D_k)^{\\mathsf{T}}');
        this._katex(document.getElementById('fx2'),
            'V = \\frac{1}{6}\\left| \\sum_{t=1}^{12} \\det\\left[\\,\\mathbf{p}_{t1}\\;\\; \\mathbf{p}_{t2}\\;\\; ' +
            '\\mathbf{p}_{t3}\\,\\right] \\right|');

        const pares = e.pairs.map((p, k) => `
            <tr><td class="pr-3">eixo ${k + 1}</td>
                <td class="pr-3">${PlanoVolume.SLOTS[p[0]].label} ↔ ${PlanoVolume.SLOTS[p[1]].label}</td>
                <td class="font-mono text-right">${e.sala.separacoes[k].toFixed(4)} m</td></tr>`).join('');

        document.getElementById('volumeNumbers').innerHTML = `
            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                <p class="text-[11px] uppercase tracking-wider text-indigo-500 font-bold">Volume</p>
                <p class="text-3xl font-bold text-indigo-700 font-mono mt-1">${e.volume.toFixed(4)}
                    <span class="text-lg">m³</span></p>
            </div>
            <table class="text-[11px] w-full mt-3">
                <thead><tr class="text-stone-400"><th class="text-left">par de faces opostas</th><th></th>
                    <th class="text-right">separação</th></tr></thead><tbody>${pares}</tbody></table>
            <p class="text-[11px] text-stone-600 mt-3">
                Produto das três separações: <span class="font-mono">${e.caixaIngenua.toFixed(4)} m³</span>.
                O poliedro exato difere em
                <span class="font-mono font-bold">${(e.volume - e.caixaIngenua).toFixed(4)} m³</span> —
                a sala não é uma caixa perfeita, e só a fórmula do poliedro leva isso em conta.</p>`;

        document.getElementById('vertexTable').innerHTML = `
            <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Os 8 vértices (m)</p>
            <table class="text-[10px] w-full"><thead><tr class="text-stone-400">
                <th class="text-left">#</th><th class="text-right">X</th><th class="text-right">Y</th>
                <th class="text-right">Z</th></tr></thead><tbody>
                ${e.sala.vertices.map((v, k) => `<tr><td class="text-stone-400">${k}</td>` +
                    v.map(c => `<td class="font-mono text-right pl-2">${c.toFixed(4)}</td>`).join('') +
                    '</tr>').join('')}
            </tbody></table>`;

        if (!this.viewer) this.viewer = new RoomViewer3D('roomView');
        this.viewer.setRoom(e.sala);
    },

    // ------------------------------------------------------------------ painel 5: propagação

    renderProp() {
        const e = this.est, p = e.propagacao;
        document.getElementById('propHint').style.display = 'none';
        document.getElementById('propBody').style.display = '';

        const cont = document.getElementById('propFormula');
        cont.innerHTML = `<p class="text-[11px] text-stone-500 mb-2">A jacobiana do volume em relação aos
            24 parâmetros é analítica, e Σ é bloco-diagonal porque as seis faces vêm de levantamentos
            independentes — não há covariância cruzada entre elas:</p><div id="fx3"></div>`;
        this._katex(document.getElementById('fx3'),
            '\\sigma_V^2 = \\mathbf{J}\\,\\boldsymbol{\\Sigma}\\,\\mathbf{J}^{\\mathsf{T}}, \\qquad ' +
            '\\boldsymbol{\\Sigma} = \\mathrm{blockdiag}(\\boldsymbol{\\Sigma}_1,\\dots,\\boldsymbol{\\Sigma}_6), \\qquad ' +
            '\\frac{\\partial \\mathbf{v}}{\\partial \\mathbf{x}_i} = -\\mathbf{M}^{-1}\\mathbf{e}_r\\,' +
            '[\\,v_x\\;\\;v_y\\;\\;v_z\\;\\;1\\,]');

        const linhas = this.faces.map((f, i) => {
            const frac = p.fracoes[i];
            return `<tr class="border-b border-stone-100">
                <td class="pr-3">${f.slot.label}</td>
                <td class="font-mono text-right pr-3">${Math.sqrt(Math.max(p.contribuicoes[i], 0)).toFixed(4)}</td>
                <td class="font-mono text-right pr-3">${(100 * frac).toFixed(1)}%</td>
                <td class="pr-2" style="width:90px"><div style="background:#e7e5e4;height:6px;border-radius:3px">
                    <div style="background:#4f46e5;height:6px;border-radius:3px;width:${(100 * frac).toFixed(1)}%"></div></div></td>
                <td class="font-mono text-right pr-3 text-stone-500">${f.result.sigma02.toFixed(2)}</td>
                <td class="font-mono text-right text-stone-500">${f.result.dof}</td></tr>`;
        }).join('');

        const somaGl = this.faces.reduce((s, f) => s + f.result.dof, 0);
        const pior = p.fracoes.indexOf(Math.max(...p.fracoes));

        document.getElementById('propContrib').innerHTML = `
            <div class="bg-stone-50 border border-stone-200 rounded-lg p-4 mb-3">
                <p class="text-[11px] uppercase tracking-wider text-stone-400 font-bold">Desvio-padrão do volume</p>
                <p class="text-2xl font-bold text-stone-800 font-mono mt-1">± ${p.sigma.toFixed(4)}
                    <span class="text-base">m³</span>
                    <span class="text-sm text-stone-500 font-normal">(${(100 * p.sigma / e.volume).toFixed(4)} % do volume)</span></p>
            </div>
            <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">De onde vem a incerteza</p>
            <table class="text-[11px] w-full"><thead><tr class="text-stone-400 border-b border-stone-200">
                <th class="text-left pb-1">face</th><th class="text-right pr-3">σ parcial (m³)</th>
                <th class="text-right pr-3">da variância</th><th></th>
                <th class="text-right pr-3">σ̂₀²</th><th class="text-right">gl</th>
            </tr></thead><tbody>${linhas}</tbody></table>
            <p class="text-[11px] text-stone-600 mt-2">Quem manda na incerteza é a pior superfície:
                <strong>${this.faces[pior].slot.label}</strong> responde por
                ${(100 * p.fracoes[pior]).toFixed(1)}% da variância, porque tem o maior σ̂₀².</p>`;

        const ic = e.intervalos.map(iv => `
            <tr class="border-b border-stone-100">
                <td class="font-bold pr-3">${iv.alpha}%</td>
                <td class="text-stone-500 pr-3">${iv.confianca}%</td>
                <td class="font-mono text-right pr-2 text-stone-500">${iv.z.toFixed(4)}</td>
                <td class="font-mono text-right pr-3">${iv.z_lo.toFixed(4)} – ${iv.z_hi.toFixed(4)}</td>
                <td class="font-mono text-right pr-2 text-stone-500">${iv.t.toFixed(4)}</td>
                <td class="font-mono text-right">${iv.t_lo.toFixed(4)} – ${iv.t_hi.toFixed(4)}</td></tr>`).join('');

        document.getElementById('propIntervals').innerHTML = `
            <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Intervalos de confiança (m³)</p>
            <table class="text-[11px] w-full"><thead>
                <tr class="text-stone-400"><th></th><th></th>
                    <th colspan="2" class="text-center border-b border-stone-200 pb-0.5">normal</th>
                    <th colspan="2" class="text-center border-b border-stone-200 pb-0.5">t de Student</th></tr>
                <tr class="text-stone-400 border-b border-stone-200">
                    <th class="text-left pb-1">α</th><th class="text-left pr-3">confiança</th>
                    <th class="text-right pr-2">z</th><th class="text-right pr-3">intervalo</th>
                    <th class="text-right pr-2">t</th><th class="text-right">intervalo</th></tr>
                </thead><tbody>${ic}</tbody></table>
            <p class="text-[11px] text-stone-600 mt-3">
                A coluna t usa <strong>${p.nuEf.toFixed(1)} graus de liberdade efetivos</strong>
                (Welch–Satterthwaite), não os ${somaGl} da soma das seis faces: as faces têm σ̂₀ muito
                diferentes, e quem domina a variância também domina o gl. Com esse gl a t fica
                ${((e.intervalos[0].t / e.intervalos[0].z - 1) * 100).toFixed(1)}% mais larga que a normal
                a 99%.</p>
            <p class="text-[11px] text-stone-500 mt-2 italic">Os intervalos cobrem só a incerteza das
                medidas propagada pelo modelo. Não cobrem erro de modelo — por exemplo, a sala não ser
                exatamente um hexaedro de faces planas.</p>`;
    },

    // ------------------------------------------------------------------ painel 6: entrega

    // Só o volume e a faixa de 99%, que é o que o cliente leva. O resto da página é a memória
    // de cálculo; aqui vale a informação sozinha, ancorada em objetos que dão para imaginar.
    renderFinal() {
        const e = this.est;
        const iv = e.intervalos.find(x => x.alpha === 1);
        document.getElementById('finalHint').style.display = 'none';
        const alvo = document.getElementById('finalBody');
        alvo.style.display = '';

        // Vírgula decimal só aqui: os outros painéis são memória de cálculo, este é a entrega
        const br = (v, casas) => v.toFixed(casas).replace('.', ',');
        const nf = (n) => n >= 100 ? br(n, 0) : br(n, 1);
        const conta = (eq) => `${nf(eq.n)} ${eq.n >= 2 ? eq.ref.plural : eq.ref.singular}`;

        const eqVol = PlanoVolume.equivalenciaDestaque(e.volume, 'volume');
        const eqInc = PlanoVolume.equivalenciaDestaque(iv.margemT, 'incerteza');
        const outrasVol = PlanoVolume.equivalencias(e.volume, 'volume').filter(x => x.ref !== eqVol.ref);
        const outrasInc = PlanoVolume.equivalencias(iv.margemT, 'incerteza').filter(x => x.ref !== eqInc.ref);

        // O gancho: a faixa inteira de dúvida, nos dois sentidos, comparada à referência grande
        const faixaEmRefGrande = 2 * iv.margemT / eqVol.ref.volume;

        const lista = (arr) => arr.map(x =>
            `<li>${conta(x)} <span class="text-stone-400">— ${x.ref.base}</span></li>`).join('');

        alvo.innerHTML = `
            <div class="text-center">
                <p class="text-xs uppercase tracking-[0.2em] text-stone-400 font-bold">Volume da sala</p>
                <p class="text-5xl sm:text-6xl font-bold text-stone-900 font-mono mt-2 mb-1">
                    ${br(e.volume, 2)} <span class="text-2xl sm:text-3xl text-stone-500">m³</span></p>
                <p class="text-base text-stone-700">
                    &plusmn; ${br(iv.margemT, 2)} m³
                    <span class="text-stone-400">·</span>
                    <span class="font-semibold">${iv.confianca}% de confiança</span></p>
                <p class="text-sm text-stone-500 font-mono mt-1">
                    entre ${br(iv.t_lo, 2)} e ${br(iv.t_hi, 2)} m³</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div class="border border-stone-200 rounded-lg p-5">
                    <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold">O tamanho da sala</p>
                    <p class="text-2xl font-bold text-teal-700 mt-1">${conta(eqVol)}</p>
                    <p class="text-[11px] text-stone-400 mt-0.5">${eqVol.ref.base}</p>
                    <ul class="text-[11px] text-stone-600 mt-3 space-y-0.5 list-disc list-inside">${lista(outrasVol)}</ul>
                </div>
                <div class="border border-stone-200 rounded-lg p-5">
                    <p class="text-[10px] uppercase tracking-wider text-stone-400 font-bold">A margem de erro</p>
                    <p class="text-2xl font-bold text-indigo-700 mt-1">${conta(eqInc)}</p>
                    <p class="text-[11px] text-stone-400 mt-0.5">${eqInc.ref.base}</p>
                    <ul class="text-[11px] text-stone-600 mt-3 space-y-0.5 list-disc list-inside">${lista(outrasInc)}</ul>
                </div>
            </div>

            <p class="text-center text-sm text-stone-700 mt-7 max-w-3xl mx-auto leading-relaxed">
                A sala tem o volume de <strong>${conta(eqVol)}</strong>. A dúvida inteira, somando os dois
                lados da faixa, não chega a <strong class="whitespace-nowrap">${br(100 * faixaEmRefGrande, 0)}%
                de ${eqVol.ref.artigo} ${eqVol.ref.singular}</strong>.</p>
            <p class="text-center text-[11px] text-stone-400 mt-3 max-w-3xl mx-auto">
                Faixa de ${iv.confianca}% pela t de Student com ${br(e.propagacao.nuEf, 0)} graus de
                liberdade efetivos, a partir de ${this.faces.reduce((s, f) => s + f.result.m, 0)}
                observações nas seis faces. Cobre a incerteza das medidas propagada pelo modelo, não erro
                de modelo.</p>`;
    },

    // ------------------------------------------------------------------ estado dos botões

    _allAdjusted() { return this.faces.every(f => f.result && f.normalized); },

    _updateButtons() {
        const temDados = !!this.faces[0].points;
        document.getElementById('btnAdjustAll').disabled = !temDados;
        this.faces.forEach((f, i) => {
            document.getElementById(`btnAdj${i}`).disabled = !f.points;
            document.getElementById(`btnDet${i}`).disabled = !f.result;
            document.getElementById(`btnRem${i}`).disabled = !(f.det && f.det.flagged.length);
            document.getElementById(`btnReset${i}`).disabled =
                !f.points || !f.points.some(p => !p.active || p.flagged);
        });

        const prontas = this.faces.filter(f => f.result).length;
        document.getElementById('btnVolume').disabled = !this._allAdjusted();
        const dica = document.getElementById('volumeHint');
        if (!this.est) {
            dica.style.display = '';
            dica.textContent = this._allAdjusted()
                ? 'Tudo pronto — clique em "Calcular Volume".'
                : `Ajuste as seis faces primeiro (${prontas} de 6 prontas).`;
            document.getElementById('volumeBody').style.display = 'none';
            document.getElementById('propHint').style.display = '';
            document.getElementById('propHint').textContent = 'Calcule o volume primeiro.';
            document.getElementById('propBody').style.display = 'none';
            document.getElementById('finalHint').style.display = '';
            document.getElementById('finalBody').style.display = 'none';
        }
    }
};
