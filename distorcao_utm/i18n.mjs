// PT-BR / EN dictionary pairs, t(), data-t / data-t-html / data-label convention (as transform_lab).
// Keys used from code are written t('key') so tests/i18n.test.mjs can find them.
export const words = {
  title: ['Distorções UTM e do Geoide em Nuvens de Pontos', 'UTM & Geoid Distortions in Point Clouds'],
  subtitle: ['Uma nuvem capturada em ECEF vista em ENU (sem distorção) e em UTM + altitude (distorcida)', 'A cloud captured in ECEF seen in ENU (undistorted) and in UTM + height (distorted)'],
  portal: ['← Portal', '← Portal'],
  langGroup: ['Idioma', 'Language'],
  controls: ['Parâmetros', 'Parameters'],
  secCentre: ['Ponto central', 'Centre point'],
  lat: ['Latitude φ (°)', 'Latitude φ (°)'],
  lon: ['Longitude λ (°)', 'Longitude λ (°)'],
  h0: ['Altitude elipsoidal h (m)', 'Ellipsoidal height h (m)'],
  secArea: ['Área', 'Area'],
  spanWE: ['Extensão O–L (m)', 'W–E span (m)'],
  spanNS: ['Extensão S–N (m)', 'S–N span (m)'],
  secBuildings: ['Edificações cúbicas', 'Cubic buildings'],
  grid: ['Grade de edificações (n × n)', 'Building grid (n × n)'],
  sizeMin: ['Menor aresta (m)', 'Smallest edge (m)'],
  sizeMax: ['Maior aresta (m)', 'Largest edge (m)'],
  sizeCapped: ['Arestas limitadas a 80 % da célula ({c} m).', 'Edges capped at 80 % of the cell ({c} m).'],
  reseed: ['Sortear tamanhos', 'Shuffle sizes'],
  secDensity: ['Densidade de pontos', 'Point density'],
  buildingDensity: ['Fachadas e telhados (pts/m²)', 'Walls and roofs (pts/m²)'],
  terrainDensity: ['Terreno (pts/m²)', 'Terrain (pts/m²)'],
  estimate: ['Estimativa: {n} de no máximo {max} pontos', 'Estimate: {n} of at most {max} points'],
  budgetReduced: ['Limite atingido: densidades efetivas de {t} pts/m² (terreno) e {b} pts/m² (edificações).', 'Budget reached: effective densities of {t} pts/m² (terrain) and {b} pts/m² (buildings).'],
  budgetWhy: ['O limite mantém o cálculo em ~1–2 s (medido em tests/bench.mjs).', 'The budget keeps the computation at ~1–2 s (measured in tests/bench.mjs).'],
  secProjection: ['Projeção e geoide', 'Projection and geoid'],
  zone: ['Fuso UTM', 'UTM zone'],
  zoneAuto: ['Automático (fuso do centro)', 'Automatic (centre zone)'],
  zoneWest: ['Fuso vizinho a oeste', 'Neighbouring zone to the west'],
  zoneEast: ['Fuso vizinho a leste', 'Neighbouring zone to the east'],
  geoid: ['Aplicar modelo geoidal (H = h − N, EGM2008)', 'Apply geoid model (H = h − N, EGM2008)'],
  geoidLoading: ['Carregando tiles do EGM2008…', 'Loading EGM2008 tiles…'],
  geoidLoaded: ['EGM2008 5′: {n} tile(s) de 10° × 10° baixado(s) sob demanda.', 'EGM2008 5′: {n} tile(s) of 10° × 10° fetched on demand.'],
  geoidFailed: ['Falha ao carregar o geoide: {e}', 'Could not load the geoid: {e}'],
  geoidIdle: ['Desligado: altura = h elipsoidal.', 'Off: height = ellipsoidal h.'],
  secDisplay: ['Visualização', 'Display'],
  metric: ['Distorção mostrada', 'Distortion shown'],
  metric_ppm: ['Distorção linear local', 'Local linear distortion'],
  metric_dh: ['Deslocamento horizontal', 'Horizontal displacement'],
  metric_dz: ['Deslocamento vertical', 'Vertical displacement'],
  metric_dg: ['Efeito do geoide na altura', 'Geoid effect on height'],
  metric_d3: ['Deslocamento 3D', '3D displacement'],
  metricHelp_ppm: ['(k·ρ/(ρ+h) − 1)·10⁶ em cada ponto, em ppm = mm/km. Azul: encurta; vermelho: alonga.', '(k·ρ/(ρ+h) − 1)·10⁶ at each point, in ppm = mm/km. Blue: shortens; red: stretches.'],
  metricHelp_dh: ['Distância horizontal entre o ponto em UTM e a sua posição verdadeira (ENU alinhado no centro).', 'Horizontal distance between the point in UTM and its true position (ENU aligned at the centre).'],
  metricHelp_dz: ['Altura em UTM menos a altura verdadeira: curvatura achatada e, com o geoide, −(N − N₀). Azul: abaixo; vermelho: acima.', 'Height in UTM minus the true height: flattened curvature and, with the geoid, −(N − N₀). Blue: below; red: above.'],
  metricHelp_dg: ['Só a parte do deslocamento vertical causada pelo geoide: −(N − N₀). O valor N₀ do centro é absorvido pelo alinhamento. Azul: o ponto desce; vermelho: sobe.', 'Only the part of the vertical displacement caused by the geoid: −(N − N₀). The centre value N₀ is absorbed by the alignment. Blue: the point goes down; red: it goes up.'],
  metricHelp_d3: ['Módulo do deslocamento 3D em relação à posição verdadeira.', 'Magnitude of the 3D displacement from the true position.'],
  range: ['Escala de cores', 'Colour scale'],
  rangeData: ['Ajustada aos dados', 'Stretched to the data'],
  rangeZero: ['Ancorada no zero', 'Anchored at zero'],
  exaggeration: ['Exagero da distorção (×)', 'Distortion exaggeration (×)'],
  exaggerationHint: ['×1 = geometria verdadeira. Cores e mapa usam sempre os valores reais.', '×1 = true geometry. Colours and the map always use the real values.'],
  pointSize: ['Tamanho do ponto (px)', 'Point size (px)'],
  outline: ['Mostrar o contorno verdadeiro dos cubos', 'Show the true outline of the cubes'],
  resetView: ['Reenquadrar vistas', 'Reset views'],
  views3d: ['Vistas 3D sincronizadas: arraste para girar, role para aproximar, botão direito para deslocar.', 'Synchronized 3D views: drag to orbit, scroll to zoom, right button to pan.'],
  viewLeft: ['ECEF → ENU · transformação rígida, sem distorção', 'ECEF → ENU · rigid transformation, no distortion'],
  viewRight: ['ECEF → UTM + {h} · distorção ×{f}', 'ECEF → UTM + {h} · distortion ×{f}'],
  hEll: ['h elipsoidal', 'ellipsoidal h'],
  hOrt: ['H ortométrica', 'orthometric H'],
  legendLeft: ['Cores neutras: terreno, telhados e fachadas.', 'Neutral colours: terrain, roofs and walls.'],
  busy: ['Calculando…', 'Computing…'],
  chartTitle: ['Mapa 2D da distorção', '2D distortion map'],
  chartNote: ['Grade de 121 × 121 nós na altitude do terreno; isolinhas nos valores marcados na barra; quadrados = edificações; tracejado = meridiano central. Passe o cursor para ler os valores.', '121 × 121 grid at terrain height; isolines at the values marked on the bar; squares = buildings; dashed = central meridian. Hover to read values.'],
  arrowsNote: ['Setas: direção do deslocamento horizontal (comprimento relativo).', 'Arrows: direction of the horizontal displacement (relative length).'],
  chartLabel: ['Mapa de calor da distorção sobre a área, com isolinhas', 'Heat map of the distortion over the area, with isolines'],
  axisE: ['e (O–L)', 'e (W–E)'],
  axisN: ['n (S–N)', 'n (S–N)'],
  cmShort: ['MC', 'CM'],
  readHere: ['Cursor', 'Cursor'],
  readCentre: ['Centro', 'Centre'],
  efShort: ['Fator de elevação', 'Elevation factor'],
  geoidN: ['Ondulação N', 'Undulation N'],
  geoidOff: ['geoide desligado', 'geoid off'],
  statsTitle: ['Resumo', 'Summary'],
  stZone: ['Fuso / meridiano central', 'Zone / central meridian'],
  stCentre: ['Centro (E, N)', 'Centre (E, N)'],
  stK: ['Fator de escala k', 'Scale factor k'],
  stEf: ['Fator de elevação ρ/(ρ+h)', 'Elevation factor ρ/(ρ+h)'],
  stCombined: ['Fator combinado (distorção)', 'Combined factor (distortion)'],
  stGamma: ['Convergência meridiana γ', 'Meridian convergence γ'],
  stN: ['Ondulação geoidal N no centro', 'Geoid undulation N at the centre'],
  stPoints: ['Pontos (terreno + edificações)', 'Points (terrain + buildings)'],
  stTime: ['Tempo de cálculo', 'Computation time'],
  stRange: ['Faixa da métrica na nuvem', 'Metric range in the cloud'],
  stMaxDisp: ['Maior deslocamento (horizontal / vertical)', 'Largest displacement (horizontal / vertical)'],
  south: ['S', 'S'],
  north: ['N', 'N'],
  cubesTitle: ['Os cubos deixam de ser cubos', 'The cubes stop being cubes'],
  cubesNote: ['Arestas O–L, S–N e altura medidas em UTM (E, N e altura) entre os vértices verdadeiros de cada cubo; abaixo, a diferença para a aresta real.', 'W–E, S–N and height edges measured in UTM (E, N and height) between the true vertices of each cube; below, the difference from the true edge.'],
  cubeWhich: ['Edificação', 'Building'],
  cubeTrue: ['Aresta real', 'True edge'],
  cubeWE: ['O–L', 'W–E'],
  cubeSN: ['S–N', 'S–N'],
  cubeH: ['Altura', 'Height'],
  cubeMost: ['mais distorcida (ppm)', 'most distorted (ppm)'],
  cubeLeast: ['menos distorcida (ppm)', 'least distorted (ppm)'],
  cubeLargest: ['maior cubo', 'largest cube'],
  theoryTitle: ['Teoria e hipóteses', 'Theory and assumptions'],
  webglFail: ['WebGL indisponível: as vistas 3D não podem ser exibidas (o mapa 2D e o resumo continuam válidos).', 'WebGL unavailable: the 3D views cannot be shown (the 2D map and the summary remain valid).'],
  workerFail: ['Web Worker indisponível: calculando na thread principal.', 'Web Worker unavailable: computing on the main thread.'],
  error: ['Erro: {e}', 'Error: {e}'],
  theoryBody: [`
<h3>1. Do ECEF ao ENU: só rotação e translação</h3>
<p>Cada ponto nasce em coordenadas cartesianas geocêntricas (X, Y, Z). O sistema geodésico local ENU (<i>east–north–up</i>) no ponto central (φ₀, λ₀, h₀) é</p>
<p class="formula">[e n u]ᵀ = R(φ₀, λ₀) · ([X Y Z]ᵀ − [X₀ Y₀ Z₀]ᵀ)</p>
<p>R é uma matriz de rotação, portanto distâncias, ângulos e volumes são preservados: a vista da esquerda é a referência sem distorção. Ela mostra inclusive a curvatura: o terreno, de altitude elipsoidal constante, cai cerca de d²/(2R) longe do centro (8 cm a 1 km, 7,8 m a 10 km), e cada edifício fica a prumo segundo a sua própria normal.</p>
<h3>2. Do ECEF ao UTM</h3>
<p>Cada ponto é convertido em (φ, λ, h) (iteração de ponto fixo a partir do valor inicial de Bowring) e projetado pela Transversa de Mercator (séries de Krüger até n⁶, Karney 2011), com k₀ = 0,9996, falso leste de 500 000 m e falso norte de 10 000 000 m no hemisfério sul. O terno (E, N, h), ou (E, N, H), é então tratado como se fosse cartesiano, como faz quem importa a nuvem num programa de CAD ou de processamento de nuvens.</p>
<h3>3. Distorção linear local</h3>
<p>A projeção é conforme: localmente só a escala muda. Um comprimento horizontal na altitude h é reduzido ao elipsoide pelo fator de elevação ρ/(ρ + h), com ρ = √(MN), e depois multiplicado pelo fator de escala k ≈ k₀ (1 + x²/(2R²)), em que x é a distância ao meridiano central. O fator combinado e a distorção são</p>
<p class="formula">F = k · ρ/(ρ + h) &nbsp;&nbsp; δ = (F − 1) · 10⁶ ppm (mm/km)</p>
<p>As alturas, porém, não são escaladas: as arestas horizontais de um cubo mudam de δ·a e as verticais não. Com h = 1000 m o fator de elevação encurta os comprimentos em ≈ 157 ppm; somado a k₀ (−400 ppm) no meridiano central, uma aresta de 100 m encurta 5,6 cm.</p>
<h3>4. Curvatura achatada e convergência meridiana</h3>
<p>Em (E, N, h) todas as verticais ficam paralelas e o terreno fica plano: a queda d²/(2R) da vista ENU desaparece. A convergência meridiana γ (ângulo do norte verdadeiro ao norte da quadrícula) gira a nuvem como um todo; como isso é um movimento rígido, a referência da direita é a nuvem ENU girada de θ ≈ γ₀ e transladada para o centro. O deslocamento mostrado é</p>
<p class="formula">d = (E − E₀, N − N₀, V − V₀) − R(θ) · (e, n, u)</p>
<h3>5. Modelo geoidal</h3>
<p>Com o geoide ligado, a altura é a ortométrica H = h − N, com N do EGM2008 (grade de 5′ com interpolação bicúbica; só os tiles de 10° × 10° da área são baixados). O valor constante N₀ é absorvido pelo alinhamento; o restante, −(N − N₀), inclina e ondula o terreno e aparece no deslocamento vertical (a métrica «efeito do geoide na altura» mostra só essa parcela). A distorção linear não muda, porque E e N dependem só de φ e λ. Usar H no lugar de h no fator de elevação erra cerca de N/R (≈ 1 ppm a cada 6 m de ondulação).</p>
<h3>6. Exagero</h3>
<p>A vista da direita mostra R(θ)·ENU + f·d. Com f = 1 a geometria é a verdadeira; o padrão f = 100 torna visíveis distorções de centímetros. As cores, o mapa 2D e o resumo usam sempre os valores verdadeiros.</p>
<h3>Simplificações</h3>
<ul>
<li>Fusos UTM padrão, sem as exceções da Noruega e de Svalbard; o fuso do centro (ou o vizinho escolhido) vale para toda a área.</li>
<li>Desvio da vertical ignorado: os edifícios ficam a prumo segundo a normal ao elipsoide.</li>
<li>Fator de elevação com o raio médio de Gauss √(MN); a diferença entre as direções O–L e S–N é de cerca de 1 ppm.</li>
<li>EGM2008 5′ com erro de interpolação de ~5 mm (RMS) em relação ao modelo completo.</li>
</ul>
<p class="refs">Referências: Karney, C. F. F. (2011), <i>Transverse Mercator with an accuracy of a few nanometers</i>, J. Geodesy 85(8); Pavlis et al. (2012), EGM2008, JGR 117; grade de 5′ do GeographicLib.</p>`, `
<h3>1. From ECEF to ENU: rotation and translation only</h3>
<p>Every point is born in geocentric Cartesian coordinates (X, Y, Z). The local geodetic ENU (east–north–up) frame at the centre point (φ₀, λ₀, h₀) is</p>
<p class="formula">[e n u]ᵀ = R(φ₀, λ₀) · ([X Y Z]ᵀ − [X₀ Y₀ Z₀]ᵀ)</p>
<p>R is a rotation matrix, so distances, angles and volumes are preserved: the left view is the undistorted reference. It even shows the curvature: the terrain, at constant ellipsoidal height, drops about d²/(2R) away from the centre (8 cm at 1 km, 7.8 m at 10 km), and every building stands plumb along its own normal.</p>
<h3>2. From ECEF to UTM</h3>
<p>Every point is converted to (φ, λ, h) (fixed-point iteration from Bowring's starting value) and projected with the Transverse Mercator (Krüger series to n⁶, Karney 2011), with k₀ = 0.9996, a false easting of 500 000 m and a false northing of 10 000 000 m in the southern hemisphere. The triple (E, N, h), or (E, N, H), is then treated as if it were Cartesian, as happens when the cloud is imported into CAD or point-cloud software.</p>
<h3>3. Local linear distortion</h3>
<p>The projection is conformal: locally only the scale changes. A horizontal length at height h is reduced to the ellipsoid by the elevation factor ρ/(ρ + h), with ρ = √(MN), and then multiplied by the scale factor k ≈ k₀ (1 + x²/(2R²)), where x is the distance from the central meridian. The combined factor and the distortion are</p>
<p class="formula">F = k · ρ/(ρ + h) &nbsp;&nbsp; δ = (F − 1) · 10⁶ ppm (mm/km)</p>
<p>Heights, however, are not scaled: the horizontal edges of a cube change by δ·a while the vertical ones do not. At h = 1000 m the elevation factor shortens lengths by ≈ 157 ppm; added to k₀ (−400 ppm) on the central meridian, a 100 m edge becomes 5.6 cm shorter.</p>
<h3>4. Flattened curvature and meridian convergence</h3>
<p>In (E, N, h) all verticals become parallel and the terrain becomes flat: the d²/(2R) drop of the ENU view disappears. The meridian convergence γ (angle from true north to grid north) turns the cloud as a whole; since that is a rigid motion, the right-hand reference is the ENU cloud rotated by θ ≈ γ₀ and translated to the centre. The displacement shown is</p>
<p class="formula">d = (E − E₀, N − N₀, V − V₀) − R(θ) · (e, n, u)</p>
<h3>5. Geoid model</h3>
<p>With the geoid on, the height is the orthometric H = h − N, with N from EGM2008 (5′ grid with bicubic interpolation; only the 10° × 10° tiles of the area are downloaded). The constant N₀ is absorbed by the alignment; the rest, −(N − N₀), tilts and warps the terrain and shows up in the vertical displacement (the «geoid effect on height» metric shows that part alone). The linear distortion does not change, because E and N depend only on φ and λ. Using H instead of h in the elevation factor is off by about N/R (≈ 1 ppm for every 6 m of undulation).</p>
<h3>6. Exaggeration</h3>
<p>The right view shows R(θ)·ENU + f·d. At f = 1 the geometry is the true one; the default f = 100 makes centimetre distortions visible. Colours, the 2D map and the summary always use the true values.</p>
<h3>Simplifications</h3>
<ul>
<li>Standard UTM zones, without the Norway and Svalbard exceptions; the centre zone (or the chosen neighbour) is used for the whole area.</li>
<li>Deflection of the vertical ignored: buildings stand plumb along the ellipsoid normal.</li>
<li>Elevation factor with the Gaussian mean radius √(MN); the W–E and S–N directions differ by about 1 ppm.</li>
<li>EGM2008 5′ with ~5 mm (RMS) interpolation error against the full model.</li>
</ul>
<p class="refs">References: Karney, C. F. F. (2011), <i>Transverse Mercator with an accuracy of a few nanometers</i>, J. Geodesy 85(8); Pavlis et al. (2012), EGM2008, JGR 117; GeographicLib 5′ grid.</p>`],
};

let language = 'pt-BR';
const listeners = [];

export function detectLanguage({ query = '', stored = '', browser = '' } = {}) {
  for (const value of [new URLSearchParams(query).get('lang'), stored]) {
    if (value === 'en') return 'en';
    if (value === 'pt' || value === 'pt-BR') return 'pt-BR';
  }
  return browser.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function initialLanguage() {
  let stored = '';
  try { stored = localStorage.getItem('monorepo_lang') || ''; } catch { /* storage blocked */ }
  return detectLanguage({ query: location.search, stored, browser: navigator.language || '' });
}

export const getLanguage = () => language;
export const onLanguage = fn => { listeners.push(fn); };

export function t(key, values = {}) {
  return (words[key]?.[language === 'pt-BR' ? 0 : 1] ?? key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

export function applyLanguage(root = document) {
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  root.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
  root.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.label)); });
}

export function setLanguage(lang) {
  language = lang === 'en' ? 'en' : 'pt-BR';
  if (typeof document === 'undefined') return;
  try { localStorage.setItem('monorepo_lang', language); } catch { /* storage blocked */ }
  const url = new URL(location.href); url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  document.documentElement.lang = language;
  applyLanguage(document);
  document.title = `distorcao_utm · ${t('title')}`;
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
  document.querySelectorAll('a.portal').forEach(el => { el.href = `../?lang=${language}`; });
  listeners.forEach(fn => fn(language));
}

export function bootLanguage() {
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
  setLanguage(initialLanguage());
}
