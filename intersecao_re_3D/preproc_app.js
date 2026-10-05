// --- Interface da página de pré-processamento (preprocessamento.html) ---
// Os cálculos ficam em preproc.js; aqui só leitura dos controles, desenho e exportação.
// tr(pt, en): texto no idioma atual; globalThis.APP_LANG alimenta também preproc.js e io.js
const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);

const STORE_SETTINGS = 'intersecao_re_3D_preproc_settings';
const STORE_FIXED = 'intersecao_re_3D_preproc_fixed';
const STORE_HANDOFF = 'intersecao_re_3D_preproc_csv';
const SAMPLE_PATH = 'inputs/raw_obs/raw_observations.csv';
const SAMPLE_FIXED = ['M01', 'M02']; // como em inputs/observations.csv

function storeGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function storeSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } }

const pre = {
    lang: (function () {
        const p = new URLSearchParams(window.location.search).get('lang');
        if (p === 'en' || p === 'pt' || p === 'pt-BR') return p.startsWith('pt') ? 'pt-BR' : 'en';
        let s = null;
        try { s = localStorage.getItem('monorepo_lang'); } catch (e) { /* sem armazenamento */ }
        if (s === 'en' || s === 'pt' || s === 'pt-BR') return s.startsWith('pt') ? 'pt-BR' : 'en';
        return (navigator.language && navigator.language.startsWith('pt')) ? 'pt-BR' : 'en';
    })(),

    settings: Preproc.mergeSettings(Preproc.DEFAULT_SETTINGS, storeGet(STORE_SETTINGS) || {}),
    fixed: new Map(Object.entries(storeGet(STORE_FIXED) || {})), // ponto -> { fixed, xyz }
    rawText: null,
    sourceName: '',
    parsed: null,
    groups: [],
    result: null,
    open: new Set(),
    _domItems: [],
    _loadSeq: 0,

    // ---------------------------------------------------------------- idioma
    t(key) {
        const d = window.intersecaoI18n || {};
        const v = (d[this.lang] && d[this.lang][key]) || (d['pt-BR'] && d['pt-BR'][key]);
        return v !== undefined ? v : key;
    },

    // Elementos com data-i18n: o português fica no HTML, o inglês em i18n.js (preprocEn)
    _scanDom() {
        this._domItems = [...document.querySelectorAll('[data-i18n]')].map(el => ({ el, key: el.dataset.i18n, pt: el.innerHTML }));
    },

    _renderMath() {
        const th = document.getElementById('theory');
        if (th && window.renderMathInElement) {
            renderMathInElement(th, {
                delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }],
                throwOnError: false
            });
        }
    },

    setLanguage(lang) {
        if (lang === 'pt') lang = 'pt-BR';
        this.lang = lang;
        globalThis.APP_LANG = lang.startsWith('pt') ? 'pt-BR' : 'en';
        try { localStorage.setItem('monorepo_lang', lang); } catch (e) { /* sem armazenamento */ }
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url.toString());
        this._applyLanguage();
        // Mensagens de leitura vêm de preproc.js no idioma corrente: relê o arquivo
        if (this.rawText !== null) this._parse(false); else this.render();
    },

    _applyLanguage() {
        const en = globalThis.APP_LANG === 'en';
        const map = window.intersecaoPreprocEn || {};
        this._domItems.forEach(it => { it.el.innerHTML = en && map[it.key] !== undefined ? map[it.key] : it.pt; });
        this._renderMath();

        const isPt = !en, q = isPt ? 'pt' : 'en';
        document.documentElement.lang = isPt ? 'pt-BR' : 'en';
        document.title = this.t('preprocPageTitle');
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', this.t('preprocPageDesc'));
        document.querySelector('header h1').textContent = this.t('preprocTitle');
        document.querySelector('header p').textContent = this.t('preprocSubtitle');
        const set = (id, href, text) => { const a = document.getElementById(id); if (a) { a.href = href; if (text) a.textContent = text; } };
        set('portalLink', `../index.html?lang=${q}`, this.t('portalLink'));
        set('simulLink', `index.html?lang=${q}`, this.t('simulLink'));
        set('modelosLink', `modelos.html?lang=${q}`, this.t('modelosLink'));
        const on = 'px-2.5 py-1 text-xs font-bold rounded-md transition-all bg-teal-600 text-white shadow-sm';
        const off = 'px-2.5 py-1 text-xs font-bold rounded-md transition-all text-stone-400 hover:text-white';
        document.getElementById('btnLangPt').className = isPt ? on : off;
        document.getElementById('btnLangEn').className = isPt ? off : on;
    },

    // ---------------------------------------------------------------- início
    init() {
        globalThis.APP_LANG = this.lang.startsWith('pt') ? 'pt-BR' : 'en';
        this._scanDom();
        this._applyLanguage();
        this._writeForm();
        this.render();
        this.loadSample();
    },

    esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // ---------------------------------------------------------------- dados
    async loadSample() {
        const seq = ++this._loadSeq;
        try {
            const resp = await fetch(SAMPLE_PATH);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            if (seq !== this._loadSeq) return;
            SAMPLE_FIXED.forEach(n => { if (!this.fixed.has(n)) this.fixed.set(n, { fixed: true, xyz: null }); });
            this._setText(text, tr('exemplo ', 'sample ') + SAMPLE_PATH);
        } catch (e) {
            if (seq !== this._loadSeq) return;
            alert(tr(`Não foi possível ler ${SAMPLE_PATH}.\n\n${e.message}\n\nAbra a página por um servidor HTTP (ex.: python3 -m http.server) — o navegador bloqueia a leitura de arquivos locais via file://.`,
                `Could not read ${SAMPLE_PATH}.\n\n${e.message}\n\nOpen the page through an HTTP server (e.g. python3 -m http.server) — the browser blocks reading local files via file://.`));
        }
    },

    loadUserFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const seq = ++this._loadSeq;
        const reader = new FileReader();
        reader.onload = () => { if (seq === this._loadSeq) this._setText(reader.result, file.name); };
        reader.readAsText(file);
        event.target.value = '';
    },

    _setText(text, name) {
        this.rawText = text;
        this.sourceName = name;
        const guess = Preproc.detectFormat(text);
        if (guess) { this.settings.angleFormat = guess; document.getElementById('angleFormat').value = guess; }
        this._parse(true);
    },

    onFormatChange() {
        this.settings.angleFormat = document.getElementById('angleFormat').value;
        this._saveSettings();
        if (this.rawText !== null) this._parse(true);
    },

    // fresh = true descarta exclusões feitas pelo usuário (arquivo ou formato novos)
    _parse(fresh) {
        const keepUse = !fresh && this.groups.length
            ? this.groups.flatMap(g => g.readings.map(r => Object.assign({}, r.use))) : null;
        this.parsed = Preproc.parseRaw(this.rawText, { angleFormat: this.settings.angleFormat });
        const b = Preproc.buildGroups(this.parsed.readings);
        this.groups = b.groups;
        this.structWarnings = b.warnings;
        if (keepUse) {
            let i = 0;
            this.groups.forEach(g => g.readings.forEach(r => { if (keepUse[i]) r.use = keepUse[i]; i++; }));
        } else this.open.clear();
        this.recompute();
    },

    // ---------------------------------------------------------------- configurações
    _num(id, def) { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : def; },

    readSettings() {
        const S = this.settings, D = Preproc.DEFAULT_SETTINGS, v = id => document.getElementById(id).value;
        S.sigAngSec = Math.max(0.01, this._num('sigAngSec', D.sigAngSec));
        S.edmMm = Math.max(0, this._num('edmMm', D.edmMm));
        S.edmPpm = Math.max(0, this._num('edmPpm', D.edmPpm));
        S.floorAngSec = Math.max(0, this._num('floorAngSec', D.floorAngSec));
        S.floorDistMm = Math.max(0, this._num('floorDistMm', D.floorDistMm));
        S.flagMethod = v('flagMethod');
        S.flagK = Math.max(1, this._num('flagK', D.flagK));
        S.flagAlphaPct = Math.min(20, Math.max(0.1, this._num('flagAlphaPct', D.flagAlphaPct)));
        S.groupK = Math.max(1, this._num('groupK', D.groupK));
        S.trim = v('trim');
        S.trimK = Math.max(1, this._num('trimK', D.trimK));
        S.trimPct = Math.min(45, Math.max(0, this._num('trimPct', D.trimPct)));
        S.stdConv = v('stdConv');
        ['hz', 'z'].forEach(o => {
            S[o] = { value: v(o + 'Value'), sigma: v(o + 'Sigma'), series: Math.max(1, Math.round(this._num(o + 'Series', 1))), face: v(o + 'Face') };
        });
        S.d = { value: v('dValue'), sigma: v('dSigma'), n: Math.max(1, Math.round(this._num('dN', 4))) };
        this._saveSettings();
        this._showConditional();
        this.recompute();
    },

    _writeForm() {
        const S = this.settings, set = (id, val) => { document.getElementById(id).value = val; };
        ['angleFormat', 'sigAngSec', 'edmMm', 'edmPpm', 'floorAngSec', 'floorDistMm', 'flagMethod', 'flagK',
            'flagAlphaPct', 'groupK', 'trim', 'trimK', 'trimPct', 'stdConv'].forEach(k => set(k, S[k]));
        ['hz', 'z'].forEach(o => {
            set(o + 'Value', S[o].value); set(o + 'Sigma', S[o].sigma); set(o + 'Series', S[o].series); set(o + 'Face', S[o].face);
        });
        set('dValue', S.d.value); set('dSigma', S.d.sigma); set('dN', S.d.n);
        this._showConditional();
    },

    _showConditional() {
        document.querySelectorAll('[data-show]').forEach(el => {
            const [obs, vals] = el.dataset.show.split(':');
            el.style.display = vals.split(',').includes(this.settings[obs].value) ? '' : 'none';
        });
        const m = this.settings.flagMethod;
        document.getElementById('flagAlphaPct').disabled = m !== 'grubbs';
        document.getElementById('flagK').disabled = m === 'grubbs';
        document.getElementById('trimK').disabled = this.settings.trim !== 'ksigma';
        document.getElementById('trimPct').disabled = this.settings.trim !== 'pct';
    },

    _saveSettings() { storeSet(STORE_SETTINGS, this.settings); },

    applyPreset(name) {
        this.settings = Preproc.applyPreset(this.settings, name);
        this._writeForm();
        this._saveSettings();
        this.recompute();
    },

    // ---------------------------------------------------------------- cálculo
    recompute() {
        this.result = this.groups.length ? Preproc.compute(this.groups, this.settings) : null;
        this.render();
    },

    toggleGroup(i) {
        if (this.open.has(i)) this.open.delete(i); else this.open.add(i);
        this.renderTable();
    },

    toggleUse(gi, ri, obs, on) {
        this.groups[gi].readings[ri].use[obs] = on;
        this.recompute();
    },

    excludeFlagged() {
        if (!this.result) return;
        const n = Preproc.excludeFlagged(this.groups);
        this.recompute();
        this._status(n ? tr(`${n} leitura(s) excluída(s). A triagem foi refeita: novas marcas podem surgir.`, `${n} reading(s) excluded. Screening was rerun: new flags may appear.`)
            : tr('Nenhuma leitura marcada.', 'No flagged reading.'));
    },

    includeAll() {
        if (!this.result) return;
        Preproc.includeAll(this.groups);
        this.recompute();
        this._status(tr('Todas as leituras reincluídas.', 'All readings included again.'));
    },

    // ---------------------------------------------------------------- desenho
    render() {
        this.renderStatus();
        this.renderGlobal();
        this.renderHints();
        this.renderTable();
        this.renderFixed();
        ['btnExport', 'btnOpenSim', 'btnReport'].forEach(id => { document.getElementById(id).disabled = !this.result; });
    },

    renderStatus() {
        const st = document.getElementById('dataStatus'), wl = document.getElementById('warnList');
        if (!this.parsed) { st.textContent = tr('Nenhuma caderneta carregada.', 'No field book loaded.'); wl.innerHTML = ''; return; }
        const nSt = new Set(this.groups.map(g => g.station)).size;
        st.innerHTML = tr(
            `<strong>${this.parsed.readings.length}</strong> leituras · <strong>${this.groups.length}</strong> visadas · <strong>${nSt}</strong> estações — ${this.esc(this.sourceName)}`,
            `<strong>${this.parsed.readings.length}</strong> readings · <strong>${this.groups.length}</strong> sightings · <strong>${nSt}</strong> stations — ${this.esc(this.sourceName)}`);
        const item = (cls, text) => `<li class="text-[11px] leading-tight ${cls} rounded px-2 py-1">${this.esc(text)}</li>`;
        const errs = this.parsed.errors.slice(0, 12).map(e => item('bg-rose-50 text-rose-800', e));
        if (this.parsed.errors.length > 12) errs.push(item('bg-rose-50 text-rose-800', `… +${this.parsed.errors.length - 12}`));
        const warns = [...this.parsed.warnings, ...(this.structWarnings || [])].map(w => item('bg-amber-50 text-amber-800', w));
        wl.innerHTML = errs.concat(warns).join('');
    },

    renderGlobal() {
        const R = this.result, f = (v, d = 2) => (v === null || v === undefined) ? '—' : v.toFixed(d);
        const box = (id, G, sym) => {
            const el = document.getElementById(id);
            if (!R || G.m === 0) { el.textContent = tr('— sem séries completas', '— no complete series'); return; }
            el.innerHTML = `${sym}̄ = ${f(G.mean)}″ ± ${f(G.sMean === null ? G.sMeanNom : G.sMean)}″` +
                `<br><span class="text-stone-500">s = ${f(G.s)}″ · m = ${G.m}/${G.mTotal} · ${tr('nominal', 'nominal')} ±${f(G.sMeanNom)}″</span>`;
        };
        box('indexBox', R && R.global.index, 'ε');
        box('collBox', R && R.global.coll, 'c');
        document.getElementById('indexPlot').innerHTML = R ? this._stripPlot(R.global.index, 'ε') : '';
        document.getElementById('collPlot').innerHTML = R ? this._stripPlot(R.global.coll, 'c') : '';

        const pb = document.getElementById('pooledBox');
        if (!R) { pb.innerHTML = ''; return; }
        const P = R.global.pooled, S = this.settings;
        const p = (o, u, d) => P[o].sigma ? `${P[o].sigma.toFixed(d)}${u} <span class="text-stone-400">(${tr('gl', 'dof')} ${P[o].dof})</span>` : '—';
        pb.innerHTML = `${tr('σ de 1 leitura, estimado da rede', 'σ of 1 reading, network estimate')}:<br>` +
            `Hz ${p('hz', '″', 2)} · Z ${p('z', '″', 2)} · S ${p('d', ' mm', 2)}<br>` +
            `<span class="text-stone-400">${tr('nominal', 'nominal')}: ${S.sigAngSec}″ · ${S.edmMm} mm + ${S.edmPpm} ppm</span>`;
    },

    // Diagrama de pontos (uma série): cheios = usados, vazados = extremos eliminados; a linha
    // vertical é a média adotada e a tracejada o zero. Dica com a visada ao passar o mouse.
    _stripPlot(G, sym) {
        if (!G.values.length) return '';
        const W = 300, r = 4, padX = 12;
        const vals = G.values.map(v => v.val);
        let lo = Math.min(...vals, 0), hi = Math.max(...vals, 0);
        if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
        const span = hi - lo; lo -= span * 0.05; hi += span * 0.05;
        const x = v => padX + (v - lo) / (hi - lo) * (W - 2 * padX);
        // Empilhamento simples para não sobrepor pontos
        const lanes = [];
        const pts = G.values.map(v => ({ v, px: x(v.val) })).sort((a, b) => a.px - b.px);
        pts.forEach(p => {
            let li = lanes.findIndex(last => p.px - last >= 2 * r + 1);
            if (li < 0) { li = lanes.length; lanes.push(p.px); } else lanes[li] = p.px;
            p.lane = li;
        });
        const nL = Math.min(lanes.length, 10), H = 22 + nL * (2 * r + 1) + 14;
        const baseY = 14 + nL * (2 * r + 1);
        const step = this._niceStep(hi - lo, 5);
        let ticks = '';
        for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
            const tx = x(t);
            ticks += `<line x1="${tx}" x2="${tx}" y1="${baseY}" y2="${baseY + 3}" stroke="#a8a29e"/>` +
                `<text x="${tx}" y="${baseY + 12}" font-size="8" text-anchor="middle" fill="#78716c">${+t.toFixed(6)}″</text>`;
        }
        const circles = pts.map(p => {
            const cy = baseY - 6 - Math.min(p.lane, nL - 1) * (2 * r + 1);
            const fill = p.v.trimmed ? '#fff' : '#0f766e';
            const tip = `${p.v.key}: ${sym} = ${p.v.val.toFixed(2)}″${p.v.trimmed ? tr(' (eliminado)', ' (trimmed)') : ''}`;
            return `<circle cx="${p.px.toFixed(1)}" cy="${cy}" r="${r}" fill="${fill}" stroke="${p.v.trimmed ? '#78716c' : '#fff'}" stroke-width="${p.v.trimmed ? 1.5 : 1}"><title>${this.esc(tip)}</title></circle>`;
        }).join('');
        const mean = G.mean === null ? '' :
            `<line x1="${x(G.mean)}" x2="${x(G.mean)}" y1="4" y2="${baseY}" stroke="#0f766e" stroke-width="2"/>` +
            `<text x="${Math.min(W - 30, x(G.mean) + 3)}" y="10" font-size="8" fill="#115e59" font-weight="600">${sym}̄ ${G.mean.toFixed(2)}″</text>`;
        return `<svg class="strip w-full" viewBox="0 0 ${W} ${H}" role="img" aria-label="${this.esc(sym)}">` +
            `<line x1="${x(0)}" x2="${x(0)}" y1="4" y2="${baseY}" stroke="#a8a29e" stroke-dasharray="2 2"/>` +
            `<line x1="${padX}" x2="${W - padX}" y1="${baseY}" y2="${baseY}" stroke="#d6d3d1"/>` +
            ticks + mean + circles + `</svg>`;
    },

    _niceStep(range, n) {
        const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const f = raw / mag;
        return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
    },

    // Explicação curta da política escolhida em cada coluna
    renderHints() {
        const S = this.settings;
        const sig = {
            empirical: tr('σ = s/√n das parcelas usadas (n < 2 → nominal).', 'σ = s/√n of the values used (n < 2 → nominal).'),
            nominal: tr('σ propagado da precisão nominal.', 'σ propagated from the nominal precision.'),
            max: tr('σ = maior entre empírico e nominal.', 'σ = larger of empirical and nominal.')
        };
        const ang = (o, corr) => {
            const P = S[o];
            const val = {
                series: tr('Média das n séries completas; c e ε se cancelam. Nominal: σ₀/√(2n).', 'Mean of the n complete series; c and ε cancel. Nominal: σ₀/√(2n).'),
                reduced: tr('Média das 2n leituras reduzidas à PD (forma do arquivo de referência). Nominal: σ₀/√(2n).', 'Mean of the 2n readings reduced to face left (reference-file form). Nominal: σ₀/√(2n).'),
                oneSeries: tr(`Só a série ${P.series}: (PD + PI)/2. Nominal: σ₀/√2.`, `Series ${P.series} only: (PD + PI)/2. Nominal: σ₀/√2.`),
                oneFace: tr(`Só a ${P.series}ª leitura ${P.face}, sem correção (carrega ${corr}). Nominal: σ₀.`, `Only the ${P.face} reading of series ${P.series}, uncorrected (carries ${corr}). Nominal: σ₀.`),
                facePlusCorr: tr(`Média das leituras ${P.face} corrigida pelo ${corr} global; σ² = σ²(média) + σ²(${corr}̄).`, `Mean of the ${P.face} readings corrected by the global ${corr}; σ² = σ²(mean) + σ²(${corr}̄).`)
            }[P.value];
            return val + ' ' + sig[P.sigma];
        };
        document.getElementById('hzHint').textContent = ang('hz', tr('c', 'c'));
        document.getElementById('zHint').textContent = ang('z', 'ε');
        const D = S.d;
        const dv = {
            all: tr('Média de todas as distâncias incluídas, de qualquer face ou série.', 'Mean of all included distances, from any face or series.'),
            firstN: tr(`Média das ${D.n} primeiras distâncias incluídas, de qualquer face ou série.`, `Mean of the first ${D.n} included distances, from any face or series.`),
            one: tr('Só a primeira distância incluída.', 'First included distance only.'),
            median: tr('Mediana das distâncias incluídas; σ ≈ √(π/2)·s/√n.', 'Median of the included distances; σ ≈ √(π/2)·s/√n.')
        }[D.value];
        document.getElementById('dHint').textContent = dv + ' ' + sig[D.sigma] + ' ' + tr('Nominal: (a + b·S)/√N.', 'Nominal: (a + b·S)/√N.');
    },

    renderTable() {
        const body = document.getElementById('resultBody');
        if (!this.result) {
            body.innerHTML = `<tr><td colspan="10" class="text-center text-stone-400 py-6">${tr('Carregue uma caderneta.', 'Load a field book.')}</td></tr>`;
            return;
        }
        const dms = v => Preproc.degToDms(v, 1);
        const html = [];
        this.groups.forEach((g, gi) => {
            const O = g.out;
            const flagged = o => g.readings.some(r => r.use[o] && r.flags[o].length) || g.groupFlags.some(f => f.obs === o);
            const cls = o => flagged(o) ? 'cell-flag' : '';
            const val = (o, fn) => O[o].valid ? fn(O[o]) : '—';
            const badges = [];
            if (g.nFlags) badges.push(`<span class="badge badge-flag" title="${this.esc(tr('leituras marcadas pela triagem', 'readings flagged by screening'))}">⚑ ${g.nFlags}</span>`);
            g.groupFlags.forEach(f => badges.push(`<span class="badge badge-flag" title="${this.esc(Preproc.flagText(f))}">${f.obs.toUpperCase()} ×${f.ratio.toFixed(1)}</span>`));
            const notes = Preproc.OBS.flatMap(o => (O[o].notes || []).map(n => `${o.toUpperCase()}: ${Preproc.noteText(n)}`));
            if (notes.length) badges.push(`<span class="badge badge-note" title="${this.esc(notes.join('\n'))}">ⓘ ${notes.length}</span>`);
            if (!g.valid) badges.push(`<span class="badge badge-flag">${tr('não exportada', 'not exported')}</span>`);
            if (!badges.length) badges.push(`<span class="badge badge-ok">ok</span>`);
            const isOpen = this.open.has(gi);
            html.push(`<tr class="grp ${isOpen ? 'grp-open' : ''}" onclick="pre.toggleGroup(${gi})">
                <td class="font-semibold">${isOpen ? '▾' : '▸'} ${this.esc(g.station)}</td>
                <td class="font-semibold">${this.esc(g.target)}</td>
                <td class="font-mono" title="${val('hz', h => h.value.toFixed(9) + '°')}">${val('hz', h => dms(h.value))}</td>
                <td class="font-mono ${cls('hz')}">${val('hz', h => h.sigma.toFixed(2))}</td>
                <td class="font-mono" title="${val('z', h => h.value.toFixed(9) + '°')}">${val('z', h => dms(h.value))}</td>
                <td class="font-mono ${cls('z')}">${val('z', h => h.sigma.toFixed(2))}</td>
                <td class="font-mono">${val('d', h => h.value.toFixed(4))}</td>
                <td class="font-mono ${cls('d')}">${val('d', h => (h.sigma * 1000).toFixed(2))}</td>
                <td class="font-mono text-stone-500">${['hz', 'z', 'd'].map(o => O[o].valid ? O[o].n : 0).join('/')}</td>
                <td class="space-x-1">${badges.join('')}</td></tr>`);
            if (isOpen) html.push(`<tr class="detail"><td colspan="10" class="!p-0">${this._detail(g, gi)}</td></tr>`);
        });
        body.innerHTML = html.join('');
    },

    _detail(g, gi) {
        const dms = v => Preproc.degToDms(v, 1);
        const f = (v, d) => v === null || v === undefined ? '—' : v.toFixed(d);
        const summary = Preproc.OBS.map(o => {
            const O = g.out[o], u = o === 'd' ? 1000 : 1, unit = o === 'd' ? ' mm' : '″';
            const name = { hz: 'Hz', z: 'Z', d: 'S' }[o];
            if (!O.valid) return `<div><strong>${name}</strong>: ${this.esc((O.notes || []).map(Preproc.noteText).join('; '))}</div>`;
            const ratio = g.ratios[o] === null ? '' : ` · ${tr('dispersão', 'scatter')} ${g.ratios[o].toFixed(1)}×`;
            const notes = O.notes.length ? ` · <em>${this.esc(O.notes.map(Preproc.noteText).join('; '))}</em>` : '';
            return `<div><strong>${name}</strong>: n = ${O.n} · σ ${tr('emp.', 'emp.')} ${O.sigmaEmp === null ? '—' : f(O.sigmaEmp * u, 2) + unit} · σ ${tr('nom.', 'nom.')} ${f(O.sigmaNom * u, 2)}${unit}${ratio}${notes}</div>`;
        }).join('');
        const rows = g.readings.map((r, ri) => {
            const c = o => (!r.use[o] ? 'cell-off' : (r.flags[o].length ? 'cell-flag' : ''));
            const box = o => `<input type="checkbox" class="accent-teal-600 cursor-pointer" ${r.use[o] ? 'checked' : ''} onclick="event.stopPropagation()" onchange="pre.toggleUse(${gi}, ${ri}, '${o}', this.checked)" aria-label="${o}">`;
            const marks = Preproc.OBS.flatMap(o => r.flags[o].map(fl => `${{ hz: 'Hz', z: 'Z', d: 'S' }[o]}: ${Preproc.flagText(fl)}`));
            return `<tr>
                <td class="text-stone-500">${r.line}</td><td>${r.face}</td><td>${r.k}</td>
                <td class="font-mono ${c('hz')}">${dms(r.hz)}</td><td class="font-mono ${c('z')}">${dms(r.z)}</td><td class="font-mono ${c('d')}">${r.d.toFixed(4)}</td>
                <td class="font-mono ${c('hz')}">${f(r.res.hz, 1)}</td><td class="font-mono ${c('z')}">${f(r.res.z, 1)}</td><td class="font-mono ${c('d')}">${f(r.res.d, 2)}</td>
                <td class="text-center">${box('hz')}</td><td class="text-center">${box('z')}</td><td class="text-center">${box('d')}</td>
                <td class="marks text-[11px] text-rose-800">${this.esc(marks.join(' · '))}</td></tr>`;
        }).join('');
        return `<div class="detail-wrap">
            <div class="text-[11px] text-stone-600 font-mono space-y-0.5 mb-2">${summary}</div>
            <table class="bg-white border border-stone-200 rounded"><thead><tr>
                <th>${tr('Linha', 'Line')}</th><th>Face</th><th>${tr('Série', 'Series')}</th>
                <th>${tr('Hz lido', 'Hz read')}</th><th>${tr('Z lido', 'Z read')}</th><th>S (m)</th>
                <th class="normal-case">v<sub>Hz</sub> (″)</th><th class="normal-case">v<sub>Z</sub> (″)</th><th class="normal-case">v<sub>S</sub> (mm)</th>
                <th>${tr('Usar', 'Use')} Hz</th><th>${tr('Usar', 'Use')} Z</th><th>${tr('Usar', 'Use')} S</th><th>${tr('Marcas', 'Flags')}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="hint mt-1">${tr('v = leitura (reduzida à PD e livre do erro de colimação/índice) menos a média das demais leituras incluídas e não marcadas.',
                'v = reading (reduced to face left and free of the collimation/index error) minus the mean of the other included, unflagged readings.')}</p></div>`;
    },

    renderFixed() {
        const body = document.getElementById('fixedBody');
        if (!this.groups.length) { body.innerHTML = ''; return; }
        const targets = new Map();
        this.groups.forEach(g => {
            if (!targets.has(g.target)) targets.set(g.target, []);
            targets.get(g.target).push(g.station);
        });
        body.innerHTML = [...targets.entries()].map(([t, sts]) => {
            const fx = this.fixed.get(t) || { fixed: false, xyz: null };
            const xyz = fx.xyz || ['', '', ''];
            const id = encodeURIComponent(t).replace(/'/g, '%27');
            const inp = i => `<input type="number" step="0.0001" class="field !w-28" value="${xyz[i]}" ${fx.fixed ? '' : 'disabled'} onchange="pre.setFixed('${id}')" data-fx="${this.esc(t)}" data-i="${i}">`;
            return `<tr><td class="font-semibold">${this.esc(t)}</td>
                <td><input type="checkbox" class="accent-teal-600 cursor-pointer" ${fx.fixed ? 'checked' : ''} onchange="pre.setFixed('${id}', this.checked)" aria-label="${this.esc(t)}"></td>
                <td>${inp(0)}</td><td>${inp(1)}</td><td>${inp(2)}</td>
                <td class="text-stone-500">${this.esc(sts.join(', '))}</td></tr>`;
        }).join('');
    },

    setFixed(encoded, checked) {
        const t = decodeURIComponent(encoded);
        const fx = this.fixed.get(t) || { fixed: false, xyz: null };
        if (checked !== undefined) fx.fixed = checked;
        const inputs = [...document.querySelectorAll('#fixedBody input[data-fx]')].filter(el => el.dataset.fx === t);
        const vals = inputs.sort((a, b) => a.dataset.i - b.dataset.i).map(el => el.value.trim() === '' ? null : parseFloat(el.value));
        fx.xyz = vals.length === 3 && vals.every(v => v !== null && Number.isFinite(v)) ? vals : null;
        this.fixed.set(t, fx);
        storeSet(STORE_FIXED, Object.fromEntries(this.fixed));
        if (checked !== undefined) this.renderFixed();
    },

    // ---------------------------------------------------------------- exportação
    _status(text) { document.getElementById('exportStatus').textContent = text; },

    _buildCSV() {
        const fixed = new Map([...this.fixed].filter(([, v]) => v.fixed));
        const out = Preproc.toObservationsCSV(this.groups, fixed);
        const targets = new Set(this.groups.map(g => g.target));
        const nFixed = [...fixed.keys()].filter(t => targets.has(t)).length;
        const partialXYZ = [...fixed.entries()].filter(([t, v]) => targets.has(t) && !v.xyz);
        const msg = [tr(`${out.n} visada(s) exportada(s).`, `${out.n} sighting(s) exported.`)];
        if (out.skipped.length) msg.push(tr(`Sem valor (fora do arquivo): ${out.skipped.join(', ')}.`, `No value (left out): ${out.skipped.join(', ')}.`));
        if (!nFixed) msg.push(tr('Nenhum ponto fixo marcado: no simulador use rede livre ou injunções mínimas.', 'No control point marked: use free network or minimal constraints in the simulator.'));
        else if (partialXYZ.length) msg.push(tr(`Fixos sem X,Y,Z (${partialXYZ.map(e => e[0]).join(', ')}) serão irradiados pelo simulador.`, `Control points without X,Y,Z (${partialXYZ.map(e => e[0]).join(', ')}) will be radiated by the simulator.`));
        this._status(msg.join(' '));
        return out;
    },

    exportObservations() {
        if (!this.result) return;
        const out = this._buildCSV();
        if (out.n) RedeIO.download('observations.csv', out.csv);
    },

    openInSimulator() {
        if (!this.result) return;
        const out = this._buildCSV();
        if (!out.n) return;
        try { localStorage.setItem(STORE_HANDOFF, out.csv); } catch (e) {
            alert(tr('O navegador bloqueou o armazenamento local; baixe o observations.csv e carregue-o no simulador.',
                'The browser blocked local storage; download observations.csv and load it in the simulator.'));
            return;
        }
        window.open(`index.html?lang=${this.lang.startsWith('pt') ? 'pt' : 'en'}&source=preproc`, '_blank');
    },

    exportReport() {
        if (!this.result) return;
        RedeIO.download(tr('preprocessamento_leituras.csv', 'preprocessing_readings.csv'), Preproc.toReportCSV(this.result));
    }
};

document.addEventListener('DOMContentLoaded', () => pre.init());
