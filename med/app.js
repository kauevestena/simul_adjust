/* Static, offline-capable lesson UI. All numerical work lives in physics.js. */
(() => {
  'use strict';
  const P = window.MEDPhysics;
  const lessons = window.MEDLessons;
  const $ = id => document.getElementById(id);
  const colors = { teal: '#5eead4', cyan: '#67d6ff', amber: '#fbbf24', rose: '#fb7185', violet: '#c4b5fd', muted: '#a5b5c9' };
  const fmt = (v, digits = 3) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const signed = (v, digits = 3) => (v > 0 ? '+' : '') + fmt(v, digits);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const defaults = {
    tempo: { distance: 300, timing: 0, position: 25 },
    modulacao: { distance: 23.456, frequency: 15, depth: 0.7 },
    fase: { distance: 3123.456, active: [true, false, false, false], range: 10000, challenge: false, seed: 12, feedback: '' },
    alvos: { distance: 100, reflectance: 0.8, incidence: 0 },
    erros: { distance: 125, zero: 5, scale: 4, amplitude: 3, phaseDeg: 30, unit: 10, prism: 0, extent: 500, a: 2, b: 2 },
    calibracao: { zero: 5, scale: 4, amplitude: 3, unit: 20, noise: 1, baseline: 'diverse', model: 'linear', seed: 42 },
    atmosfera: { distance: 1000, temperature: 25, pressure: 1013.25, setTemperature: 15, setPressure: 1013.25 },
    trajeto: { distance: 1000, t1: 15, t2: 35, t3: 15, pressure: 1013.25, sensor: 'start' },
    estacao: { distance: 100, zenith: 60, hi: 1.5, ht: 2, sigma: 2, angleSigma: 5 },
    qualidade: { count: 30, bias: 5, sigma: 2, seed: 42 }
  };
  const states = structuredClone(defaults);
  let current = 0, animation = false, frame = null, lastTime = null, motion = 0;
  let calibrationRows = [];
  const state = () => states[lessons[current].id];
  const metric = (name, value, unit = '') => `<div class="metric"><span class="metric-label">${name}</span><span class="metric-value">${value}<span class="metric-unit">${unit}</span></span></div>`;
  const note = (text, warning = false) => { $('interpretation').classList.toggle('warning', warning); $('interpretation').innerHTML = `<p>${text}</p>`; };
  function control(key, label, min, max, step, unit = '', help = '') {
    const value = state()[key];
    return `<div class="control"><label for="input-${key}">${label}</label><div class="input-row"><input id="input-${key}" data-key="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"${help ? ` aria-describedby="help-${key}"` : ''}><span class="unit">${unit}</span></div><input type="range" data-key="${key}" aria-label="${label} — controle deslizante" value="${value}" min="${min}" max="${max}" step="${step}">${help ? `<p class="help" id="help-${key}">${help}</p>` : ''}</div>`;
  }
  function select(key, label, options) {
    return `<div class="control"><label for="input-${key}">${label}</label><select id="input-${key}" data-key="${key}">${options.map(([value, name]) => `<option value="${value}"${String(state()[key]) === String(value) ? ' selected' : ''}>${name}</option>`).join('')}</select></div>`;
  }
  const action = (name, label) => `<button type="button" class="secondary" data-action="${name}">${label}</button>`;
  const motionControl = () => `<div class="control-actions">${action('animate', animation ? 'Pausar animação' : 'Animar sinal')}</div><p class="small">Movimento desacelerado. Os valores físicos estão nas leituras.</p>`;
  const legend = entries => `<div class="chart-legend">${entries.map(([label, color]) => `<span><i class="legend-swatch" style="--swatch:${color}"></i>${label}</span>`).join('')}</div>`;
  const table = (caption, headers, rows) => `<div class="table-wrap" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${caption}</caption><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  function dimensions(height = 300) { return { w: Math.max(300, $('visual').clientWidth - 16), h: height }; }
  function svg(body, label, w, h = 300) { return `<div class="chart-frame"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg></div>`; }
  function text(x, y, label, color = colors.muted, anchor = 'middle', size = 14) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="system-ui,sans-serif" font-size="${size}">${esc(label)}</text>`;
  }
  const line = (x1, y1, x2, y2, color, dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.7"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const circle = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  function chart({ series = [], xMin = 0, xMax = 1, yMin = -1, yMax = 1, xLabel = '', yLabel = '', label = '', marker = null, points = [], height = 300 }) {
    const { w, h } = dimensions(height), pad = { l: 58, r: 18, t: 30, b: 50 };
    const X = x => pad.l + (x - xMin) / (xMax - xMin) * (w - pad.l - pad.r);
    const Y = y => h - pad.b - (y - yMin) / (yMax - yMin) * (h - pad.t - pad.b);
    let body = text(pad.l, 18, yLabel, colors.muted, 'start');
    for (let i = 0; i <= 4; i++) {
      const x = xMin + (xMax - xMin) * i / 4, y = yMin + (yMax - yMin) * i / 4;
      body += line(X(x), pad.t, X(x), h - pad.b, '#1e3045') + line(pad.l, Y(y), w - pad.r, Y(y), '#1e3045');
      body += text(X(x), h - 29, fmt(x, xMax - xMin < 10 ? 1 : 0), colors.muted, 'middle', 12);
      body += text(pad.l - 8, Y(y) + 4, fmt(y, yMax - yMin < 10 ? 1 : 0), colors.muted, 'end', 12);
    }
    if (yMin < 0 && yMax > 0) body += line(pad.l, Y(0), w - pad.r, Y(0), '#60748a', '4 4');
    // Clip only plot marks; labels remain outside the plotting rectangle.
    body += `<svg x="${pad.l}" y="${pad.t}" width="${w - pad.l - pad.r}" height="${h - pad.t - pad.b}" viewBox="${pad.l} ${pad.t} ${w - pad.l - pad.r} ${h - pad.t - pad.b}" overflow="hidden">`;
    for (const s of series) {
      body += `<polyline points="${s.data.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
    }
    if (marker !== null) body += line(X(marker), pad.t, X(marker), h - pad.b, colors.violet, '4 4');
    for (const p of points) body += circle(X(p.x), Y(p.y), p.r || 4, p.color || colors.amber);
    body += '</svg>' + text((pad.l + w - pad.r) / 2, h - 6, xLabel);
    return svg(body, label, w, h);
  }
  function samples(count, min, max, fn) { return Array.from({ length: count + 1 }, (_, i) => { const x = min + (max - min) * i / count; return [x, fn(x)]; }); }
  function renderControls() {
    const id = lessons[current].id, s = state();
    let html = '<h3>Condições do experimento</h3>';
    if (id === 'tempo') html += control('distance', 'Distância de ida', 1, 2000, 1, 'm') + control('timing', 'Erro no tempo de ida e volta', -2, 2, .01, 'ns') + control('position', 'Instante na animação', 0, 100, 1, '%') + motionControl();
    if (id === 'modulacao') html += control('distance', 'Distância', 0, 100, .001, 'm') + control('frequency', 'Frequência de modulação', 1, 60, .1, 'MHz') + control('depth', 'Profundidade m', 0, 1, .05) + motionControl();
    if (id === 'fase') {
      if (!s.challenge) html += control('distance', 'Distância de referência', 0, 9999.999, .001, 'm');
      else html += '<p class="small">Distância de referência oculta. Use somente as leituras para resolver o desafio.</p>';
      html += '<div class="control"><fieldset><legend>Frequências usadas (por U)</legend>' + P.UNITS.map((u, i) => `<label class="check-row"><input type="checkbox" data-frequency="${i}"${s.active[i] ? ' checked' : ''}>U = ${fmt(u, 0)} m</label>`).join('') + '</fieldset></div>';
      html += select('range', 'Intervalo de busca', [[10000, '0 ≤ D < 10 km'], [20000, '0 ≤ D < 20 km']]);
      html += `<div class="control-actions">${action('phaseAll', 'Usar as quatro')}${action('phaseFine', 'Somente U = 10 m')}${action('phaseExample', 'Exemplo 3 123,456 m')}${action('phaseChallenge', s.challenge ? 'Novo desafio' : 'Desafio sem referência')}${s.challenge ? action('phaseExplore', 'Voltar à exploração') : ''}</div>`;
      html += '<p class="small">As fases são ideais. A tabela arredonda a exibição; o cálculo usa a precisão completa.</p>';
    }
    if (id === 'alvos') html += control('distance', 'Distância ao alvo', 10, 500, 1, 'm') + control('reflectance', 'Reflectância ρ', 0, 1, .01) + control('incidence', 'Incidência à normal', 0, 90, 1, '°') + '<p class="small">Modelo relativo de superfície difusa. Não representa o alcance de um aparelho.</p>';
    if (id === 'erros') html += control('distance', 'Distância de inspeção', 1, 2000, 1, 'm') + control('zero', 'Erro de zero a', -20, 20, .5, 'mm') + control('scale', 'Erro de escala b', -20, 20, .5, 'ppm') + control('amplitude', 'Amplitude cíclica A', 0, 10, .1, 'mm') + control('unit', 'Período do erro U', 5, 50, 1, 'm') + control('phaseDeg', 'Fase do ciclo ψ', 0, 360, 5, '°') + control('prism', 'Erro residual do prisma k', -30, 30, 1, 'mm') + select('extent', 'Janela do gráfico', [[50, '0–50 m'], [500, '0–500 m'], [2000, '0–2 000 m']]) + control('a', 'Especificação: parcela constante', 0, 10, .5, 'mm') + control('b', 'Especificação: parcela proporcional', 0, 10, .5, 'ppm') + `<div class="control-actions">${action('zeroErrors', 'Zerar componentes')}</div>`;
    if (id === 'calibracao') html += select('baseline', 'Distribuição de comprimentos', [['diverse', 'Base diversificada'], ['narrow', 'Comprimentos próximos'], ['locked', 'Fases repetidas'], ['repeated', 'Uma distância repetida']]) + select('model', 'Parâmetros a ajustar', [['linear', 'Zero + escala'], ['cyclic', 'Zero + escala + ciclo']]) + control('zero', 'Zero simulado', -20, 20, .5, 'mm') + control('scale', 'Escala simulada', -20, 20, .5, 'ppm') + control('amplitude', 'Amplitude cíclica simulada', 0, 10, .1, 'mm') + control('noise', 'σ do ruído por observação', 0, 5, .1, 'mm') + '<p class="small">U = 20 m; ψ = 30°. A base contém 8 observações. Os parâmetros simulados são conhecidos apenas pelo gerador.</p>' + `<div class="control-actions">${action('newNoise', 'Nova realização')}${action('exportCalibration', 'Exportar observações CSV')}</div>`;
    if (id === 'atmosfera') html += control('distance', 'Distância de referência', 10, 5000, 10, 'm') + control('temperature', 'Temperatura real', -10, 45, .5, '°C') + control('pressure', 'Pressão real no local', 700, 1050, .25, 'hPa') + control('setTemperature', 'Temperatura configurada', -10, 45, .5, '°C') + control('setPressure', 'Pressão configurada', 700, 1050, .25, 'hPa') + `<div class="control-actions">${action('matchAir', 'Igualar configuração ao ar')}</div><p class="small">Gás seco: umidade e dispersão não são simuladas.</p>`;
    if (id === 'trajeto') html += control('distance', 'Comprimento total', 30, 5000, 10, 'm') + control('t1', 'Trecho 1 — junto ao instrumento', -10, 45, .5, '°C') + control('t2', 'Trecho 2 — região intermediária', -10, 45, .5, '°C') + control('t3', 'Trecho 3 — junto ao alvo', -10, 45, .5, '°C') + control('pressure', 'Pressão uniforme', 700, 1050, .25, 'hPa') + select('sensor', 'Índice usado na redução', [['start', 'Termômetro no instrumento'], ['endpoints', 'Média das temperaturas extremas'], ['integrated', 'Índice integrado nos 3 trechos']]) + '<p class="small">Três segmentos com o mesmo comprimento. A linha permanece reta no modelo.</p>';
    if (id === 'estacao') html += control('distance', 'Distância inclinada S', 1, 2000, 1, 'm') + control('zenith', 'Ângulo zenital z', 0, 180, .1, '°') + control('hi', 'Altura do instrumento hᵢ', 0, 5, .01, 'm') + control('ht', 'Altura do alvo hₐ', 0, 5, .01, 'm') + control('sigma', 'σ da distância', 0, 10, .1, 'mm') + control('angleSigma', 'σ do ângulo zenital', 0, 30, .5, '″');
    if (id === 'qualidade') html += control('count', 'Número de observações n', 2, 500, 1) + control('bias', 'Viés fixo', -10, 10, .5, 'mm') + control('sigma', 'σ do ruído independente', 0, 5, .1, 'mm') + `<div class="control-actions">${action('newNoise', 'Nova série')}</div><p class="small">Semente ${s.seed}. Alterar n conserva o início da mesma série de números aleatórios.</p>`;
    $('controls').innerHTML = html;
  }
  function renderPulse(onlyVisual = false) {
    const s = state(), r = P.pulse(s.distance, P.REFERENCE.index, s.timing), { w } = dimensions(270);
    const x1 = 44, x2 = w - 44, y = 78, fraction = animation ? (motion % 1) : s.position / 100;
    const outbound = fraction <= .5, position = outbound ? fraction * 2 : 2 - fraction * 2;
    let body = text(x1, 32, 'EDM', colors.cyan) + text(x2, 32, 'Alvo', colors.amber);
    body += line(x1, y, x2, y, '#45627c') + circle(x1, y, 7, colors.cyan) + circle(x2, y, 7, colors.amber);
    body += circle(x1 + (x2 - x1) * position, y, 6, outbound ? colors.teal : colors.rose);
    body += text(w / 2, 118, `D = ${fmt(s.distance, 0)} m · percurso total = ${fmt(2 * s.distance, 0)} m`);
    body += text(w / 2, 154, `${outbound ? 'Ida' : 'Volta'} · t = ${fmt(fraction * r.time * 1e9, 2)} ns`, colors.teal, 'middle', 16);
    const start = 58, end = w - 30;
    body += line(start, 207, end, 207, '#567086') + line(start, 195, start, 219, colors.cyan) + line(end, 195, end, 219, colors.rose);
    body += text(start, 240, 'Emissão', colors.cyan, 'start') + text(end, 240, 'Recepção', colors.rose, 'end');
    body += text(w / 2, 195, `Δt = ${fmt(r.time * 1e9, 3)} ns`, colors.muted);
    $('visual').innerHTML = svg(body, `Sinal de ida e volta por uma distância de ${s.distance} metros. Tempo total ${fmt(r.time * 1e9)} nanossegundos.`, w, 265);
    if (onlyVisual) return;
    $('metrics').innerHTML = metric('Tempo físico de ida e volta', fmt(r.time * 1e9), 'ns') + metric('Tempo observado', fmt(r.observedTime * 1e9), 'ns') + metric('Distância medida', fmt(r.measured, 4), 'm') + metric('Erro da distância', signed(r.errorMm), 'mm');
    note(`D = (${fmt(r.velocity, 1)} × ${fmt(r.observedTime * 1e9, 3)} × 10⁻⁹) / 2 = <strong>${fmt(r.measured, 4)} m</strong>. O erro temporal de ${signed(s.timing, 2)} ns produz ${signed(r.errorMm)} mm.`);
    $('labDetail').innerHTML = '';
  }
  function renderModulation(onlyVisual = false) {
    const s = state(), unit = P.C / (P.REFERENCE.index * s.frequency * 1e6 * 2), r = P.phase(s.distance, unit), offset = animation ? motion * 2 : 0;
    const periodNs = 1000 / s.frequency;
    $('visual').innerHTML = chart({ series: [
      { color: colors.cyan, data: samples(300, 0, 3 * periodNs, t => 1 + s.depth * Math.cos(P.TAU * t / periodNs - offset)) },
      { color: colors.amber, dash: '7 4', data: samples(300, 0, 3 * periodNs, t => 1 + s.depth * Math.cos(P.TAU * t / periodNs - offset - r.degrees * Math.PI / 180)) }
    ], xMax: 3 * periodNs, yMin: 0, yMax: 2.1, xLabel: 'Tempo (ns)', yLabel: 'Intensidade / I₀', label: 'Intensidades de referência e retorno; sua defasagem depende da distância e da frequência.' }) + legend([['Referência interna', colors.cyan], ['Retorno normalizado', colors.amber]]) + '<p class="chart-caption">A atenuação do retorno foi normalizada para comparar a fase.</p>';
    if (onlyVisual) return;
    $('metrics').innerHTML = metric('λ da modulação', fmt(r.wavelength, 4), 'm') + metric('Intervalo U = λ/2', fmt(unit, 4), 'm') + metric('Fase observável', s.depth ? fmt(r.degrees, 3) : 'Indefinida', s.depth ? '°' : '') + metric('Distância equivalente a 0,01°', fmt(unit * .01 / 360 * 1000, 3), 'mm');
    note(s.depth ? `Nesta frequência, <strong>${fmt(s.distance, 3)} m e ${fmt(s.distance + unit, 3)} m têm a mesma fase</strong>. A comparação fornece a fração do ciclo; o inteiro precisa de outras informações.` : 'Sem modulação (m = 0), os sinais são constantes. O comparador não pode observar a fase de modulação.', !s.depth);
    $('labDetail').innerHTML = `<div class="equation">λ<sub>m</sub> = ${P.C} / (1,00028 × ${fmt(s.frequency, 1)} × 10⁶) = ${fmt(r.wavelength, 4)} m</div>`;
  }
  function renderPhase() {
    const s = state(), readings = P.UNITS.map(u => P.phase(s.distance, u)), active = readings.filter((_, i) => s.active[i]);
    const solution = P.solveAmbiguity(active, s.range), count = solution.candidates.length;
    const points = solution.candidates.map(c => ({ x: c.distance, y: 1, r: count > 100 ? 1 : count > 20 ? 2 : 5, color: colors.teal }));
    $('visual').innerHTML = chart({ points, xMax: s.range, yMin: 0, yMax: 2, xLabel: 'Distância candidata (m)', yLabel: 'Candidatos compatíveis', label: `${active.length} frequências ativas. ${count} candidatos compatíveis no intervalo declarado.` });
    const uniqueText = solution.unique && !s.challenge ? fmt(solution.candidates[0].distance) : s.challenge && solution.unique ? 'A reconstruir' : 'Não única';
    $('metrics').innerHTML = metric('Frequências ativas', String(active.length)) + metric('Candidatos', active.length ? String(count) : 'Sem restrição') + metric('Distância resolvida', uniqueText, solution.unique && !s.challenge ? 'm' : '');
    if (!active.length) note('Ative uma frequência. Sem leituras, não há restrição observacional sobre a distância.', true);
    else if (solution.unique) note(s.challenge ? 'As frequências selecionadas permitem uma solução no intervalo de busca. Reconstrua-a a partir das fases e confira sua resposta.' : `Há uma única interseção no intervalo de busca: <strong>${fmt(solution.candidates[0].distance)} m</strong>. A unicidade depende também do alcance adotado.`);
    else note(`Permanecem <strong>${count} distâncias compatíveis</strong>. ${s.range > 10000 ? 'Os quatro U repetem o conjunto de fases a cada 10 km.' : 'Ative frequências com U maior para reduzir a ambiguidade.'}`, true);
    $('labDetail').innerHTML = table('Leituras de fase e sua interpretação física', ['Uso', 'U (m)', 'λₘ (m)', 'fₘ (MHz)', 'Δφ (°)', 'r (m)'], readings.map((r, i) => [s.active[i] ? 'Ativa' : 'Desligada', fmt(r.unit, 0), fmt(r.wavelength, 0), fmt(r.frequency / 1e6, 6), s.active[i] ? fmt(r.degrees, 6) : '—', s.active[i] ? fmt(r.remainder, 3) : '—'])) + (s.challenge ? `<div class="challenge"><h3>Reconstrua uma distância compatível</h3><p class="small">Use metros, com ponto ou vírgula decimal, sem separador de milhares. Tolerância de 0,002 m.</p><form id="phaseAnswerForm"><div class="control"><label for="phaseAnswer">Sua distância (m)</label><input id="phaseAnswer" type="text" inputmode="decimal" autocomplete="off" required></div><button type="submit">Verificar resposta</button></form><p id="phaseFeedback" class="feedback" role="status">${s.feedback}</p></div>` : `<details><summary>Ver os candidatos e a reconstrução</summary><p>${active.length ? solution.candidates.slice(0, 20).map(c => `${fmt(c.distance)} m`).join(' · ') + (count > 20 ? ` … (${count} candidatos)` : '') : 'Nenhuma leitura ativa.'}</p>${solution.unique ? `<p>D = ${solution.candidates[0].cycles} × ${fmt(Math.min(...active.map(r => r.unit)), 0)} + ${fmt(solution.candidates[0].distance % Math.min(...active.map(r => r.unit)))} = ${fmt(solution.candidates[0].distance)} m.</p>` : ''}</details>`);
  }
  function renderTargets() {
    const s = state(), signal = P.targetReturn(s.distance, s.reflectance, s.incidence);
    $('visual').innerHTML = chart({ series: [{ color: colors.amber, data: samples(250, 10, 500, d => P.targetReturn(d, s.reflectance, s.incidence)) }], points: [{ x: s.distance, y: signal }], xMin: 10, xMax: 500, yMin: 0, yMax: Math.max(.05, P.targetReturn(10, s.reflectance, s.incidence) * 1.1), xLabel: 'Distância ao alvo (m)', yLabel: 'Retorno relativo (escala linear)', label: 'Retorno de uma superfície difusa decresce com o quadrado da distância.', marker: s.distance }) + '<p class="chart-caption">O ponto marca a condição atual; 1 equivale à referência branca normal a 100 m.</p>';
    $('metrics').innerHTML = metric('Retorno relativo', fmt(signal, 5)) + metric('Comparado à referência', fmt(signal * 100, 2), '%') + metric('Fator de incidência cos(i)', fmt(Math.cos(s.incidence * Math.PI / 180), 3));
    note(`S = ${fmt(s.reflectance, 2)} × cos(${fmt(s.incidence, 0)}°) × (100/${fmt(s.distance, 0)})² = <strong>${fmt(signal, 5)}</strong>. ${signal < 1e-10 ? 'Não há retorno no modelo ideal desta configuração.' : 'Dobrar a distância, sem alterar os demais fatores, divide este retorno por quatro.'}`);
    $('labDetail').innerHTML = table('Compare as condições de observação', ['Alvo', 'Comportamento', 'Cuidado de campo'], [['Prisma de canto de cubo', 'Retroreflexão dentro da abertura útil', 'Constante e orientação do conjunto'], ['Superfície difusa', 'Retorno depende da superfície e geometria', 'Identificar o ponto iluminado'], ['Quina ou alvo parcialmente obstruído', 'Possibilidade de múltiplos retornos', 'Evitar misturar planos e distâncias']]);
  }
  function renderErrors() {
    const s = state(), r = P.errorBudget(s.distance, s), n = P.nominalMm(s.distance, s.a, s.b);
    const samplesCount = Math.min(4000, Math.max(500, Math.ceil(s.extent / s.unit * 12)));
    const components = [['zero', 'Zero', colors.cyan], ['scale', 'Escala', colors.amber], ['cyclic', 'Cíclico', colors.violet], ['total', 'Total', colors.rose]];
    const series = components.map(([key, , color]) => ({ color, width: key === 'total' ? 2.5 : 1.3, data: samples(samplesCount, 0, s.extent, d => P.errorBudget(d, s)[key]) }));
    series.push(...[1, -1].map(sign => ({ color: colors.teal, dash: '6 5', data: samples(1, 0, s.extent, d => sign * P.nominalMm(d, s.a, s.b)) })));
    const extent = Math.max(1, ...series.flatMap(ser => ser.data.map(v => Math.abs(v[1])))) * 1.15;
    $('visual').innerHTML = chart({ series, xMax: s.extent, yMin: -extent, yMax: extent, xLabel: 'Distância (m)', yLabel: 'Erro observado − referência (mm)', label: 'Componentes constante, proporcional e cíclica do erro; faixa nominal em tracejado.', marker: s.distance }) + legend([...components.map(([, name, color]) => [name, color]), ['± especificação nominal', colors.teal]]) + (s.distance > s.extent ? '<p class="chart-caption">A distância de inspeção está fora da janela do gráfico. Amplie a janela para ver o marcador.</p>' : '');
    $('metrics').innerHTML = metric('Erro total', signed(r.total), 'mm') + metric('Correção de primeira ordem', signed(-r.total), 'mm') + metric('Faixa nominal', `±${fmt(n, 2)}`, 'mm');
    note(`e = ${signed(r.zero)} + (${signed(r.scale)}) + (${signed(r.cyclic)}) + (${signed(r.prism)}) = <strong>${signed(r.total)} mm</strong>. ${Math.abs(r.total) > n ? 'O erro simulado está fora da faixa nominal nesta distância.' : 'Estar dentro da faixa nesta distância não demonstra conformidade do instrumento em toda a faixa de trabalho.'}`, Math.abs(r.total) > n);
    $('labDetail').innerHTML = table(`Decomposição em D = ${fmt(s.distance, 0)} m`, ['Componente', 'Contribuição (mm)'], [['Zero a', signed(r.zero)], ['Escala bD/1000', signed(r.scale)], ['Ciclo', signed(r.cyclic)], ['Erro residual do prisma k', signed(r.prism)], ['Total', signed(r.total)]]);
  }
  const bases = { diverse: [20, 55, 109, 213, 347, 526, 781, 1004], narrow: [100, 100.1, 100.2, 100.3, 100.4, 100.5, 100.6, 100.7], locked: [20, 60, 120, 220, 360, 520, 780, 1020], repeated: [100, 100, 100, 100, 100, 100, 100, 100] };
  function renderCalibration() {
    const s = state();
    calibrationRows = P.calibrationObservations(bases[s.baseline], { ...s, phaseDeg: 30 }, s.noise, s.seed);
    let fit = null, error = '';
    try { fit = P.fitCalibration(calibrationRows, s.unit, s.model === 'cyclic'); } catch (e) { error = e.message; }
    const xMax = Math.max(...bases[s.baseline]) * 1.04;
    const extent = Math.max(1, ...calibrationRows.map(o => Math.abs(o.errorMm)), ...(fit ? fit.fitted.map(Math.abs) : [])) * 1.25;
    const fitFn = d => fit.coefficients[0] + fit.coefficients[1] * d / 1000 + (s.model === 'cyclic' ? fit.coefficients[2] * Math.sin(P.TAU * d / s.unit) + fit.coefficients[3] * Math.cos(P.TAU * d / s.unit) : 0);
    const xMin = s.baseline === 'narrow' ? 99.95 : 0;
    const plotMax = s.baseline === 'narrow' ? 100.75 : xMax;
    const fitData = fit ? samples(1000, xMin, plotMax, fitFn) : [];
    const visibleExtent = Math.max(extent, ...fitData.map(v => Math.abs(v[1]) * 1.1));
    $('visual').innerHTML = chart({ series: fit ? [{ color: colors.cyan, data: fitData }] : [], points: calibrationRows.map(o => ({ x: o.distance, y: o.errorMm })), xMin, xMax: plotMax, yMin: -visibleExtent, yMax: visibleExtent, xLabel: 'Distância de referência (m)', yLabel: 'Erro observado (mm)', label: 'Erros das observações simuladas e modelo de calibração ajustado.' }) + legend([['Observações', colors.amber], ['Modelo ajustado', colors.cyan]]);
    $('metrics').innerHTML = fit ? metric('Zero estimado â', signed(fit.coefficients[0]), 'mm') + metric('Escala estimada b̂', signed(fit.coefficients[1]), 'ppm') + metric('RMS dos resíduos', fmt(fit.rms), 'mm') + metric('Graus de liberdade', String(fit.dof)) : metric('Modelo não identificável', 'Sem solução');
    if (!fit) note(esc(error), true);
    else note(`Σ(r/σ)² / ν → σ̂₀ = <strong>${fmt(fit.sigma0)}</strong>. Correlação entre zero e escala: ${fmt(fit.correlation, 4)}. ${s.baseline === 'narrow' ? 'Comprimentos muito próximos tornam a separação dos parâmetros frágil; examine suas incertezas.' : s.model === 'linear' && s.amplitude > 0 ? 'O ajuste ignora uma componente cíclica presente nos dados. Inspecione os resíduos antes de aceitar o modelo.' : 'Compare os valores estimados com os parâmetros usados para gerar as observações.'}`, s.baseline === 'narrow' || (s.model === 'linear' && s.amplitude > 0));
    let detail = table(`Observações sintéticas · semente ${s.seed} · r = observado − modelo`, ['Dref (m)', 'Dobs (m)', 'Erro (mm)', 'Modelo (mm)', 'r (mm)'], calibrationRows.map((o, i) => [fmt(o.distance, 3), fmt(o.distance + o.errorMm / 1000, 6), signed(o.errorMm), fit ? signed(fit.fitted[i]) : '—', fit ? signed(fit.residuals[i]) : '—']));
    if (fit) {
      const residualLimit = Math.max(.1, ...fit.residuals.map(Math.abs)) * 1.2;
      detail += '<h4>Resíduos após o ajuste</h4>' + chart({ points: calibrationRows.map((o, i) => ({ x: o.distance, y: fit.residuals[i], color: colors.rose })), xMin, xMax: plotMax, yMin: -residualLimit, yMax: residualLimit, xLabel: 'Distância de referência (m)', yLabel: 'r (mm)', label: 'Resíduos da calibração em função da distância.', height: 235 });
      detail += `<p class="small">Incertezas padrão a priori: σ(â) = ${fmt(fit.standardErrors[0])} mm; σ(b̂) = ${fmt(fit.standardErrors[1])} ppm.${s.model === 'cyclic' ? ` Amplitude recuperada: ${fmt(fit.amplitude)} mm.` : ''} ${s.noise === 0 ? 'Com ruído gerado nulo, os pesos usam σ = 1 mm como convenção de referência; estas incertezas não significam ruído observado.' : ''}</p>`;
    }
    $('labDetail').innerHTML = detail;
  }
  function renderAtmosphere() {
    const s = state(), r = P.atmosphere(s.distance, s.temperature, s.pressure, s.setTemperature, s.setPressure);
    $('visual').innerHTML = chart({ series: [{ color: colors.teal, data: samples(150, -10, 45, t => P.atmosphere(s.distance, t, s.pressure, s.setTemperature, s.setPressure).correctionPpm) }], points: [{ x: s.temperature, y: r.correctionPpm }], xMin: -10, xMax: 45, yMin: Math.min(-1, P.atmosphere(s.distance, -10, s.pressure, s.setTemperature, s.setPressure).correctionPpm) - 5, yMax: Math.max(1, P.atmosphere(s.distance, 45, s.pressure, s.setTemperature, s.setPressure).correctionPpm) + 5, xLabel: 'Temperatura real (°C)', yLabel: 'Correção a aplicar (ppm)', label: 'Correção atmosférica em função da temperatura real, mantendo as pressões e a configuração fixas.', marker: s.temperature });
    $('metrics').innerHTML = metric('Índice real', fmt(r.actual, 8)) + metric('Índice configurado', fmt(r.configured, 8)) + metric('Correção atmosférica', signed(r.correctionPpm, 3), 'ppm') + metric('Correção nesta linha', signed(r.correctionMm, 3), 'mm');
    note(`A distância indicada é <strong>${fmt(r.indicated, 4)} m</strong>. Multiplicando por nconfig/nreal, obtém-se ${fmt(r.corrected, 4)} m. ${Math.abs(r.correctionPpm) < .00001 ? 'A configuração corresponde ao ar real: a correção residual é zero.' : `É preciso ${r.correctionMm > 0 ? 'aumentar' : 'diminuir'} a distância indicada.`}`);
    $('labDetail').innerHTML = '<p class="model-note">Modelo de densidade de gás seco. Os resultados explicam a relação física e a convenção de sinal; não devem ser inseridos como correções operacionais em uma estação total.</p>';
  }
  function renderPath() {
    const s = state(), temps = [s.t1, s.t2, s.t3], start = P.pathAtmosphere(s.distance, temps, s.pressure, s.t1), ends = P.pathAtmosphere(s.distance, temps, s.pressure, (s.t1 + s.t3) / 2);
    const selectedIndex = s.sensor === 'integrated' ? start.average : s.sensor === 'endpoints' ? ends.sensorIndex : start.sensorIndex;
    const error = s.distance * (start.average / selectedIndex - 1) * 1000;
    const { w } = dimensions(250), left = 40, span = w - 80;
    let body = text(w / 2, 25, 'Três trechos com o mesmo comprimento');
    temps.forEach((t, i) => {
      const x = left + i * span / 3;
      body += `<rect x="${x}" y="55" width="${span / 3}" height="85" fill="hsl(${210 - (t + 10) / 55 * 195} 45% 24%)" stroke="#567086"/>`;
      body += text(x + span / 6, 91, `${fmt(t, 1)} °C`, '#ffffff', 'middle', 16) + text(x + span / 6, 123, `Trecho ${i + 1}`, '#e1e9f4');
    });
    body += line(left, 176, left + span, 176, colors.teal) + circle(left, 176, 5, colors.cyan) + circle(left + span, 176, 5, colors.amber);
    body += text(left, 203, 'EDM', colors.cyan) + text(left + span, 203, 'Alvo', colors.amber) + text(w / 2, 238, 'Linha reta · sem traçado de raios', colors.muted);
    $('visual').innerHTML = svg(body, `Linha em três trechos a ${s.t1}, ${s.t2} e ${s.t3} graus Celsius.`, w, 255);
    $('metrics').innerHTML = metric('Índice médio integrado', fmt(start.average, 8)) + metric('Índice usado na redução', fmt(selectedIndex, 8)) + metric('Erro restante', signed(error), 'mm') + metric('Tempo integrado (ida e volta)', fmt(start.time * 1e6, 6), 'µs');
    note(s.sensor === 'integrated' ? 'O índice integrado recupera a distância neste modelo de três trechos conhecidos. Isso não calcula uma correção de curvatura do raio.' : `A leitura meteorológica selecionada deixa <strong>${signed(error)} mm</strong> de erro. Temperatura local e índice médio do caminho representam grandezas diferentes.`, Math.abs(error) > 1);
    $('labDetail').innerHTML = table('Comparação das estratégias de redução', ['Estratégia', 'Erro restante (mm)'], [['Termômetro no instrumento', signed(start.errorMm)], ['Média das temperaturas extremas', signed(ends.errorMm)], ['Índice integrado dos três trechos', fmt(0)]]);
  }
  function renderStation() {
    const s = state(), r = P.reduceSlope(s.distance, s.zenith, s.hi, s.ht, s.sigma, s.angleSigma), { w } = dimensions(330);
    const z = s.zenith * Math.PI / 180, scale = Math.min((w - 110) / s.distance, 115 / s.distance), x0 = 60, y0 = 155, x1 = x0 + r.horizontal * scale, y1 = y0 - r.vertical * scale;
    let body = line(x0, y0, x0, 18, '#6e8399', '5 4') + text(x0 + 9, 20, 'Zênite', colors.muted, 'start');
    body += line(x0, y0, x1, y0, colors.teal) + line(x1, y0, x1, y1, colors.amber, '5 4') + line(x0, y0, x1, y1, colors.cyan);
    body += circle(x0, y0, 5, colors.cyan) + circle(x1, y1, 5, colors.amber);
    const radius = 28, ax = x0 + radius * Math.sin(z), ay = y0 - radius * Math.cos(z);
    body += `<path d="M ${x0} ${y0 - radius} A ${radius} ${radius} 0 0 1 ${ax} ${ay}" fill="none" stroke="${colors.violet}" stroke-width="2"/>`;
    body += text(w - 15, 48, `z = ${fmt(s.zenith, 1)}°`, colors.violet, 'end');
    body += text(w - 15, 73, `S = ${fmt(s.distance, 0)} m`, colors.cyan, 'end');
    body += text(w / 2, 295, `H = ${fmt(r.horizontal)} m`, colors.teal, 'middle', 16) + text(w / 2, 320, `V = ${signed(r.vertical)} m`, colors.amber, 'middle', 16);
    $('visual').innerHTML = svg(body, `Triângulo de redução. Distância inclinada ${s.distance} metros, ângulo zenital ${s.zenith} graus.`, w, 340) + '<p class="chart-caption">Triângulo entre os centros. As alturas sobre o terreno entram separadamente em Δh.</p>';
    $('metrics').innerHTML = metric('Distância horizontal H', fmt(r.horizontal), 'm') + metric('Desnível entre pontos Δh', signed(r.heightDifference), 'm') + metric('σ da componente H', fmt(r.sigmaHorizontalMm), 'mm') + metric('σ da componente V', fmt(r.sigmaVerticalMm), 'mm');
    note(`Δh = ${fmt(s.hi, 2)} + (${signed(r.vertical)}) − ${fmt(s.ht, 2)} = <strong>${signed(r.heightDifference)} m</strong>. ${s.zenith === 90 ? 'Na horizontal, a incerteza angular atua principalmente no desnível.' : 'O ângulo é zenital: a componente horizontal usa seno, a vertical usa cosseno.'}`);
    $('labDetail').innerHTML = table('Contribuições padrão antes de combinar em quadratura', ['Origem', 'Em H (mm)', 'Em V (mm)'], [['Distância', fmt(Math.abs(Math.sin(z) * s.sigma)), fmt(Math.abs(Math.cos(z) * s.sigma))], ['Ângulo zenital', fmt(Math.abs(s.distance * Math.cos(z) * s.angleSigma * Math.PI / 648000 * 1000)), fmt(Math.abs(s.distance * Math.sin(z) * s.angleSigma * Math.PI / 648000 * 1000))]]);
  }
  function renderQuality() {
    const s = state(), r = P.repeatedMeasurements(s.count, s.bias, s.sigma, s.seed);
    const limit = Math.max(1, Math.abs(s.bias) + s.sigma * 4, ...r.errors.map(Math.abs)) * 1.05;
    $('visual').innerHTML = chart({ series: [{ color: colors.cyan, dash: '7 3', data: [[1, r.mean], [s.count, r.mean]] }, { color: colors.amber, dash: '2 5', data: [[1, s.bias], [s.count, s.bias]] }], points: r.errors.map((v, i) => ({ x: i + 1, y: v, color: colors.teal, r: s.count > 100 ? 2 : 3 })), xMin: 1, xMax: s.count, yMin: -limit, yMax: limit, xLabel: 'Número da observação', yLabel: 'Erro em relação à referência (mm)', label: 'Observações repetidas, média amostral e viés imposto. Zero representa a referência.' }) + legend([['Observações', colors.teal], ['Média da série', colors.cyan], ['Viés imposto', colors.amber]]);
    $('metrics').innerHTML = metric('Erro da média observada', signed(r.mean), 'mm') + metric('Desvio padrão amostral s', fmt(r.standardDeviation), 'mm') + metric('Erro padrão estimado s/√n', fmt(r.standardError), 'mm') + metric('Erro padrão teórico σ/√n', fmt(r.expectedStandardError), 'mm');
    note(`A média esperada do erro permanece <strong>${signed(s.bias)} mm</strong>. ${s.sigma === 0 ? 'Todas as observações coincidem e s = 0. Isso não demonstra ausência de viés.' : 'Aumentar n concentra a média ao redor do valor com viés, não necessariamente ao redor da referência.'}`, Math.abs(s.bias) > 0);
    $('labDetail').innerHTML = `<details><summary>Ver valores da série</summary>${table('Erros individuais em relação à referência conhecida', ['Observação', 'Erro (mm)'], r.errors.map((v, i) => [i + 1, signed(v)]))}</details>`;
  }
  const renderers = { tempo: renderPulse, modulacao: renderModulation, fase: renderPhase, alvos: renderTargets, erros: renderErrors, calibracao: renderCalibration, atmosfera: renderAtmosphere, trajeto: renderPath, estacao: renderStation, qualidade: renderQuality };
  function render() { renderers[lessons[current].id](); }
  function stopAnimation() { animation = false; if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; }
  function animate(time) {
    if (!animation || document.hidden) { frame = null; return; }
    if (lastTime !== null) motion += Math.min(time - lastTime, 100) / 4000;
    lastTime = time;
    if (lessons[current].id === 'tempo') renderPulse(true);
    if (lessons[current].id === 'modulacao') renderModulation(true);
    frame = requestAnimationFrame(animate);
  }
  function selectTopic(index, focus = false) {
    stopAnimation(); current = Math.max(0, Math.min(lessons.length - 1, index)); motion = 0;
    const lesson = lessons[current];
    document.querySelectorAll('.topic-nav-item').forEach((button, i) => { if (i === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    $('topicBreadcrumb').textContent = `Experimento ${String(current + 1).padStart(2, '0')} / ${lessons.length}`;
    $('topicTitle').textContent = lesson.title; $('topicSummary').textContent = lesson.summary; $('topicObjective').textContent = lesson.objective;
    $('theoryContent').innerHTML = lesson.theory;
    $('exerciseTitle').textContent = lesson.exerciseTitle; $('exercisePrompt').textContent = lesson.exercise; $('exerciseAnswer').textContent = lesson.answer;
    $('exerciseAnswer').closest('details').open = false;
    $('sources').innerHTML = 'Aprofundamento: ' + lesson.sources.map(key => `<a href="${window.MEDSources[key].url}" target="_blank" rel="noopener noreferrer">${window.MEDSources[key].label} ↗</a>`).join(' ');
    $('btnPrev').disabled = current === 0; $('btnNext').disabled = current === lessons.length - 1; $('lessonPosition').textContent = `${current + 1} de ${lessons.length}`;
    renderControls(); render();
    try { history.replaceState(null, '', `#${lesson.id}`); } catch (_) { /* file:// history restrictions do not prevent lessons */ }
    if (focus) $('lesson').focus({ preventScroll: true });
  }
  function handleInput(event) {
    const input = event.target, s = state();
    if (input.dataset.frequency !== undefined) { s.active[Number(input.dataset.frequency)] = input.checked; s.feedback = ''; render(); return; }
    const key = input.dataset.key; if (!key) return;
    let value;
    if (input.tagName === 'SELECT') value = typeof defaults[lessons[current].id][key] === 'number' ? Number(input.value) : input.value;
    else {
      value = input.valueAsNumber;
      if (!Number.isFinite(value) || !input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        note('Valor inválido: use um número dentro do intervalo indicado. Os resultados conservam a última configuração válida.', true);
        return;
      }
      input.removeAttribute('aria-invalid');
    }
    s[key] = value;
    if (key === 'position') { stopAnimation(); motion = value / 100; const button = $('controls').querySelector('[data-action="animate"]'); if (button) button.textContent = 'Animar sinal'; }
    $('controls').querySelectorAll(`[data-key="${key}"]`).forEach(other => { if (other !== input) { other.value = value; other.removeAttribute('aria-invalid'); } });
    if (lessons[current].id === 'fase') s.feedback = '';
    render();
  }
  function exportCalibration() {
    const s = state();
    const header = 'distance_reference_m,distance_observed_m,error_observed_mm,sigma_weight_mm,noise_sigma_mm,seed,baseline,cyclic_unit_m,cyclic_phase_deg';
    const rows = calibrationRows.map(o => [o.distance.toFixed(6), (o.distance + o.errorMm / 1000).toFixed(9), o.errorMm.toFixed(9), o.sigmaMm, s.noise, s.seed, s.baseline, s.unit, 30].join(','));
    const blob = new Blob([header + '\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `med-calibracao-${s.baseline}-${s.seed}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function handleAction(event) {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const s = state();
    switch (button.dataset.action) {
      case 'animate':
        if (animation) { if (lessons[current].id === 'tempo') s.position = Math.round((motion % 1) * 100); stopAnimation(); }
        else { animation = true; motion = lessons[current].id === 'tempo' ? s.position / 100 : motion; frame = requestAnimationFrame(animate); }
        renderControls(); render(); return;
      case 'phaseAll': s.active = [true, true, true, true]; break;
      case 'phaseFine': s.active = [true, false, false, false]; break;
      case 'phaseExample': s.distance = 3123.456; s.challenge = false; break;
      case 'phaseChallenge': s.seed++; s.distance = ((1664525 * s.seed + 1013904223) >>> 0) % 10000000 / 1000; s.challenge = true; break;
      case 'phaseExplore': s.challenge = false; break;
      case 'zeroErrors': Object.assign(s, { zero: 0, scale: 0, amplitude: 0, prism: 0 }); break;
      case 'newNoise': s.seed++; break;
      case 'matchAir': s.setTemperature = s.temperature; s.setPressure = s.pressure; break;
      case 'exportCalibration': exportCalibration(); return;
    }
    if (lessons[current].id === 'fase') s.feedback = '';
    renderControls(); render();
  }
  function checkPhaseAnswer(event) {
    if (event.target.id !== 'phaseAnswerForm') return;
    event.preventDefault();
    const s = state(), raw = $('phaseAnswer').value.trim();
    let feedback;
    if (!/^\d+(?:[.,]\d+)?$/.test(raw)) feedback = 'Digite uma distância válida, sem texto ou separadores de milhares.';
    else {
      const guess = Number(raw.replace(',', '.'));
      const active = P.UNITS.filter((_, i) => s.active[i]).map(u => P.phase(s.distance, u));
      if (!active.length) feedback = 'Ative ao menos uma frequência antes de verificar.';
      else if (guess < 0 || guess >= s.range) feedback = 'A resposta está fora do intervalo de busca [0, alcance).';
      else {
        const solved = P.solveAmbiguity(active, s.range);
        const candidate = solved.candidates.find(c => Math.abs(c.distance - guess) <= .002 + 1e-9);
        feedback = candidate ? (solved.unique ? `Correto: ${fmt(candidate.distance)} m. Esta é a única distância compatível no intervalo.` : `Compatível: ${fmt(candidate.distance)} m. Porém há ${solved.candidates.length} candidatos; esta leitura ainda não determina uma distância única.`) : 'Essa distância não reproduz as fases ativas. Calcule r = UΔφ/360° e teste os inteiros N nas demais frequências.';
      }
    }
    s.feedback = feedback; $('phaseFeedback').textContent = feedback;
  }
  $('topicNav').innerHTML = lessons.map((lesson, i) => `<button class="topic-nav-item" type="button" data-topic="${i}"><span class="topic-num">${String(i + 1).padStart(2, '0')}</span><span>${lesson.nav}</span></button>`).join('');
  $('topicNav').addEventListener('click', e => { const b = e.target.closest('[data-topic]'); if (b) selectTopic(Number(b.dataset.topic), true); });
  $('btnPrev').addEventListener('click', () => selectTopic(current - 1, true));
  $('btnNext').addEventListener('click', () => selectTopic(current + 1, true));
  $('btnReset').addEventListener('click', () => { states[lessons[current].id] = structuredClone(defaults[lessons[current].id]); selectTopic(current); });
  $('controls').addEventListener('input', handleInput);
  $('controls').addEventListener('click', handleAction);
  $('labDetail').addEventListener('submit', checkPhaseAnswer);
  window.addEventListener('hashchange', () => { const i = lessons.findIndex(l => `#${l.id}` === location.hash); if (i >= 0) selectTopic(i); });
  let resizeFrame;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(render); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; } else if (animation) frame = requestAnimationFrame(animate); });
  selectTopic(Math.max(0, lessons.findIndex(l => `#${l.id}` === location.hash)));
})();
