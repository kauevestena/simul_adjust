// Same PT-BR/EN dictionary pairs, t(), data-t/data-label convention as camera_proj.
export const words = {
  title: ['Pré-análise de Redes Topográficas', 'Topographic Network Pre-Analysis'],
  subtitle: ['PROJETAR · OBSERVAR · COMPREENDER', 'DESIGN · OBSERVE · UNDERSTAND'],
  portal: ['Simuladores', 'Simulators'], plane: ['Nível 0 · Plano fictício', 'Level 0 · Fictional plane'],
  rural: ['Nível 1 · Terreno rural', 'Level 1 · Rural terrain'], level: ['Cenário', 'Scenario'],
  level2Note: ['Nível 2 · Pato Branco: próxima etapa.', 'Level 2 · Pato Branco: next phase.'],
  examples: ['Exemplos de rede', 'Network examples'], traverse: ['Poligonal · dois apoios GNSS', 'Traverse · two GNSS controls'],
  weak: ['Geometria alongada e fraca', 'Weak elongated geometry'], resection: ['Interseção à ré', 'Resection'],
  intersection: ['Interseção angular', 'Angular intersection'], mixed: ['Rede mista', 'Mixed network'],
  select: ['Selecionar / mover', 'Select / move'], station: ['Estação', 'Station'], sighted_only: ['Ponto somente visado', 'Sighted-only point'],
  sight: ['Criar visada', 'Create sight'], delete: ['Excluir', 'Delete'], fit: ['Enquadrar', 'Fit network'],
  undo: ['Desfazer', 'Undo'], redo: ['Refazer', 'Redo'], save: ['Salvar JSON', 'Save JSON'], load: ['Abrir JSON', 'Open JSON'],
  help: ['Como usar', 'How to use'], panel: ['Propriedades', 'Properties'], close: ['Fechar', 'Close'],
  network: ['Rede', 'Network'], points: ['Pontos', 'Points'], stations: ['Estações', 'Stations'], targets: ['Somente visados', 'Sighted only'],
  components: ['Componentes de observação', 'Observation components'], controls: ['Coordenadas de apoio estocásticas', 'Stochastic control coordinates'],
  unknowns: ['Incógnitas', 'Unknowns'], rank: ['Posto', 'Rank'], dof: ['Redundância global', 'Global redundancy'],
  solved: ['Rede determinável', 'Network determinable'], unsolved: ['Rede indeterminada', 'Network underdetermined'],
  worstH: ['Maior semieixo horizontal · 1σ', 'Largest horizontal semiaxis · 1σ'], worstU: ['Maior σU', 'Largest σU'],
  lowestR: ['Menor redundância de observação', 'Lowest observation redundancy'], invalidSights: ['Visadas inválidas / bloqueadas', 'Invalid / blocked sights'],
  precision: ['Precisão prevista', 'Predicted precision'], label: ['Rótulo', 'Label'], type: ['Tipo', 'Type'],
  control: ['Apoio', 'Control'], unknown: ['Desconhecido', 'Unknown'], fixed: ['Fixo', 'Fixed'], stochastic: ['Estocástico', 'Stochastic'],
  active: ['Ativo', 'Active'], HI: ['Altura do instrumento HI (m)', 'Instrument height HI (m)'], HT: ['Altura do alvo HT (m)', 'Target height HT (m)'],
  htOverride: ['HT própria desta visada', 'Override HT for this sight'], gnssStart: ['Início GNSS', 'GNSS start'], gnssFinish: ['Fim GNSS', 'GNSS finish'],
  setStart: ['Definir como início GNSS', 'Set as GNSS start'], setFinish: ['Definir como fim GNSS', 'Set as GNSS finish'],
  apply: ['Aplicar', 'Apply'], sigmaControl: ['σE / σN / σU do apoio (mm)', 'Control σE / σN / σU (mm)'],
  covarianceNote: ['Apoio com covariâncias importadas. Editar σ substitui a matriz por uma diagonal.', 'Imported control covariances. Editing σ replaces the matrix with a diagonal.'],
  incoming: ['Visadas recebidas', 'Incoming sights'], outgoing: ['Visadas originadas', 'Outgoing sights'],
  orientation: ['Incerteza da orientação σω (″)', 'Orientation uncertainty σω (″)'],
  direction: ['Direção horizontal', 'Horizontal direction'], zenith: ['Ângulo zenital', 'Zenith angle'], distance: ['Distância inclinada', 'Slope distance'],
  horizontal: ['Distância horizontal', 'Horizontal distance'], deltaU: ['ΔU entre instrumento e alvo', 'Instrument-to-target ΔU'],
  azimuth: ['Azimute da elipse', 'Ellipse azimuth'], major: ['Semieixo maior', 'Major semiaxis'], minor: ['Semieixo menor', 'Minor semiaxis'],
  instrument: ['Modelo de precisão', 'Precision model'], educational: ['Didático', 'Educational'], standard: ['Padrão', 'Standard'], precise: ['Alta precisão', 'High precision'],
  custom: ['Personalizado', 'Custom'], directionArcsec: ['σ direção (″)', 'Direction σ (″)'], zenithArcsec: ['σ zenital (″)', 'Zenith σ (″)'],
  distanceMm: ['Constante a (mm)', 'Constant a (mm)'], ppm: ['Escala b (ppm)', 'Scale b (ppm)'],
  formula: ['σs = √(a² + (b · s)²). Incertezas a priori, sem resíduos simulados.', 'σs = √(a² + (b · s)²). A priori uncertainty, without simulated residuals.'],
  layers: ['Visualização', 'View layers'], labels: ['Rótulos dos pontos', 'Point labels'], ellipses: ['Elipses de erro', 'Error ellipses'],
  precisionLabels: ['Rótulos de σU', 'σU labels'], redundancyColor: ['Colorir por redundância da distância', 'Color by distance redundancy'],
  terrain: ['Terreno', 'Terrain'], confidence: ['Elipse', 'Ellipse'], oneSigma: ['1σ · 39,35% em 2D', '1σ · 39.35% in 2D'],
  confidence95: ['95% em 2D', '95% in 2D'], exaggeration: ['Exagero gráfico ×', 'Display exaggeration ×'],
  exaggerationNote: ['Elipses e vetores ampliados', 'Ellipses and vectors enlarged'],
  reliability: ['Confiabilidade', 'Reliability'], redundancy: ['Redundância', 'Redundancy'], mdb: ['Erro mínimo detectável (MDB)', 'Minimal detectable bias (MDB)'],
  alpha: ['Significância α', 'Significance α'], power: ['Poder 1−β', 'Power 1−β'],
  reliabilityNote: ['Teste bilateral de uma observação, covariância a priori conhecida. Sem correção para testes múltiplos.', 'Two-sided single-observation test with known a priori covariance. No multiple-testing correction.'],
  undetectable: ['Não detectável', 'Undetectable'], effect: ['Ver efeito do MDB', 'Show MDB effect'], clearEffect: ['Limpar vetores', 'Clear vectors'],
  displacement: ['Deslocamento pelo MDB', 'Displacement from MDB'], matrix: ['Matrizes', 'Matrices'], matrixHint: ['Ordem das incógnitas e observações abaixo. Radianos e metros; P inclui os apoios estocásticos.', 'Unknown and observation order below. Radians and metres; P includes stochastic controls.'],
  matrixLimited: ['Prévia limitada a 40 linhas/colunas. Baixe as matrizes completas.', 'Preview limited to 40 rows/columns. Download complete matrices.'],
  matrixSave: ['Baixar matrizes', 'Download matrices'], compare: ['Fixar referência de comparação', 'Pin comparison baseline'],
  comparison: ['Antes → agora', 'Before → now'], clearComparison: ['Limpar comparação', 'Clear comparison'],
  visible: ['Visada livre', 'Clear line of sight'], blocked: ['Bloqueada pelo terreno', 'Terrain blocked'], missing: ['Terreno indisponível', 'Terrain unavailable'],
  clearance: ['Menor folga do terreno', 'Minimum terrain clearance'], loading: ['Carregando terreno e verificando visadas…', 'Loading terrain and checking sights…'],
  terrainCredit: ['Terreno: AWS / Mapzen Terrarium · mesmo MDT de nivelamento', 'Terrain: AWS / Mapzen Terrarium · shared with nivelamento'],
  terrainApprox: ['h = H + N₀; N₀ = {geoid} m é uma aproximação didática local, não uma conversão geoidal validada. Visibilidade limitada pela resolução do MDT.', 'h = H + N₀; N₀ = {geoid} m is a local teaching approximation, not a validated geoid conversion. Visibility is limited by DEM resolution.'],
  frameNote: ['ENU local · ξ = η = 0 · HI/HT exatas', 'Local ENU · ξ = η = 0 · exact HI/HT'],
  pointHint: ['Arraste os pontos. Use a roda para zoom; botão direito para deslocar.', 'Drag points. Wheel to zoom; right-drag to pan.'],
  sightHint: ['Escolha uma estação de origem e depois o alvo. Esc cancela.', 'Choose an origin station, then the target. Esc cancels.'],
  targetHint: ['Agora escolha o alvo.', 'Now choose the target.'], addHint: ['Clique no plano para inserir um ponto.', 'Click the plan to add a point.'],
  deleteHint: ['Clique em um ponto ou visada para excluir.', 'Click a point or sight to delete.'],
  emptySelection: ['Clique em um ponto ou em uma seta para inspecionar.', 'Click a point or an arrow to inspect.'],
  helpBody: ['Desenhe a rede antes de ir a campo. Estações podem observar; pontos somente visados recebem observações. Cada seta representa uma visada independente. Arraste pontos, altere o apoio ou desligue componentes e observe a precisão e a redundância. Um início GNSS e um fim GNSS podem definir a orientação da rede. Na interseção angular, as visadas entre apoios orientam as estações. Elipses são ampliadas para leitura; o fator 1σ contém 39,35% da probabilidade conjunta em 2D. O terreno fornece coordenadas de projeto, nunca uma restrição de altura exata no ajustamento. HI e HT afetam a geometria; suas incertezas ainda não são propagadas.', 'Design your network before fieldwork. Stations can observe; sighted-only points receive observations. Each arrow is an independent sight. Drag points, change control or disable components and inspect precision and redundancy. One GNSS start and one GNSS finish can determine network orientation. In the angular intersection, control-to-control sights orient the stations. Ellipses are enlarged for readability; a 1σ ellipse contains 39.35% joint probability in 2D. Terrain supplies design coordinates, never an exact height constraint in the adjustment. HI and HT affect geometry; their uncertainties are not yet propagated.'],
  limitations: ['Sem curvatura/refração das visadas, centragem, desvio da vertical, obstáculos urbanos ou observações reais. O modo urbano fica para a próxima etapa.', 'No sight curvature/refraction, centering errors, vertical deflection, urban obstacles or actual observations. Urban mode is a later phase.'],
  noValue: ['Indisponível', 'Unavailable'], invalidNumber: ['Informe um número finito válido.', 'Enter a valid finite number.'],
  invalidNetwork: ['Rede inválida ou excede 100 pontos / 500 visadas.', 'Invalid network or exceeds 100 points / 500 sights.'],
  invalidPoint: ['Ponto inválido: verifique coordenadas, tipo, identificador e alturas.', 'Invalid point: check coordinates, type, ID and heights.'],
  invalidSight: ['Visada inválida: confira os extremos e componentes.', 'Invalid sight: check endpoints and components.'],
  invalidSigma: ['Desvios-padrão devem ser positivos; distância precisa de a > 0 ou b > 0.', 'Standard deviations must be positive; distance requires a > 0 or b > 0.'],
  invalidCovariance: ['A covariância deve ser simétrica e positiva definida.', 'Covariance must be symmetric positive definite.'],
  invalidStatistics: ['Use 0,000001 ≤ α ≤ 0,2 e 0,5 ≤ poder < 0,9999.', 'Use 0.000001 ≤ α ≤ 0.2 and 0.5 ≤ power < 0.9999.'],
  coordinateRange: ['Coordenadas fora do intervalo aceito.', 'Coordinates outside the supported range.'],
  planeHeight: ['No nível 0, U do solo deve ser zero.', 'Level 0 ground U must be zero.'],
  selfSight: ['Uma visada não pode ter o mesmo ponto de origem e destino.', 'A sight cannot have the same origin and target.'],
  stationOrigin: ['A origem da visada deve ser uma estação.', 'The sight origin must be a station.'],
  coincident: ['Pontos coincidentes: geometria indefinida.', 'Coincident points: undefined geometry.'],
  zeroLength: ['Distância nula: geometria indefinida.', 'Zero distance: undefined geometry.'],
  verticalSight: ['Direção/derivada zenital indefinida em uma visada vertical.', 'Direction/zenith derivative is undefined on a vertical sight.'],
  terrainBlocked: ['Visada bloqueada pelo terreno; excluída do cálculo.', 'Terrain-blocked sight; excluded from calculation.'],
  terrainMissing: ['Elevação indisponível. Tente carregar o nível 1 novamente; visadas sem terreno são excluídas.', 'Elevation unavailable. Try loading Level 1 again; sights with missing terrain are excluded.'],
  outsideTerrain: ['Fora da área rural carregada.', 'Outside the loaded rural area.'],
  disconnected: ['Rede com {count} componentes desconectados.', 'Network has {count} disconnected components.'],
  rankDefect: ['Deficiência de posto: {count} parâmetro(s) independente(s) não determinado(s).', 'Rank defect: {count} independent undetermined parameter(s).'],
  orientationUnknown: ['Estação {id}: orientação não determinada.', 'Station {id}: undetermined orientation.'],
  pointUndetermined: ['Ponto {id}: determinação 3D insuficiente.', 'Point {id}: insufficient 3D determination.'],
  datumMissing: ['Sem apoio: translações e rotação de datum não estão definidas.', 'No control: datum translations and rotation are not defined.'],
  weakGeometry: ['Geometria numericamente fraca; inspecione as incertezas.', 'Numerically weak geometry; inspect uncertainties.'],
  noObservations: ['Adicione visadas válidas para analisar a rede.', 'Add valid sights to analyze the network.'],
  duplicateSight: ['Esta visada já existe. Selecione-a para editar.', 'This directed sight already exists. Select it to edit.'],
  disabledSight: ['Visada desativada', 'Disabled sight'], invalidComponent: ['Componente inválido', 'Invalid component'],
  streetsMissing: ['Geometria de ruas indisponível', 'Street geometry unavailable'], streetDistance: ['Distância à rua maior que 3 m', 'More than 3 m from a street'],
};
let language = 'pt-BR';
export function detectLanguage({ query = '', stored = '', browser = '' } = {}) {
  for (const value of [new URLSearchParams(query).get('lang'), stored]) {
    if (value === 'en') return 'en';
    if (value === 'pt' || value === 'pt-BR') return 'pt-BR';
  }
  return browser.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}
export function initialLanguage() {
  let stored = '';
  try { stored = localStorage.getItem('monorepo_lang'); } catch {}
  return detectLanguage({ query: location.search, stored, browser: navigator.language });
}
export const getLanguage = () => language;
export function t(key, values = {}) {
  return (words[key]?.[language === 'pt-BR' ? 0 : 1] ?? key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}
export function setLanguage(lang) {
  language = lang === 'en' ? 'en' : 'pt-BR';
  if (typeof document === 'undefined') return;
  try { localStorage.setItem('monorepo_lang', language); } catch {}
  const url = new URL(location.href); url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  document.documentElement.lang = language; document.title = `network_preanalysis · ${t('title')}`;
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.label)); el.title = t(el.dataset.label); });
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
  document.querySelectorAll('a.portal').forEach(el => { el.href = `../?lang=${language}`; });
}
