// PT-BR / EN dictionary pairs, t(), data-t / data-t-html / data-label convention (as transform_lab).
// Keys used from code are written t('key') so tests/i18n.test.mjs can find them.
export const words = {
  title: ['Distorções UTM e do Geoide em Nuvens de Pontos', 'UTM & Geoid Distortions in Point Clouds'],
  subtitle: ['Uma nuvem capturada em ECEF vista em ENU (sem distorção) e em UTM + altitude (com erro sistemático)', 'A cloud captured in ECEF seen in ENU (undistorted) and in UTM + height (with systematic error)'],
  portal: ['← Portal', '← Portal'],
  langGroup: ['Idioma', 'Language'],
  controls: ['Parâmetros', 'Parameters'],
  scenario: ['Cenários prontos', 'Ready-made scenarios'],
  groupTolerable: ['Erro sistemático tolerável', 'Tolerable systematic error'],
  groupCritical: ['Erro sistemático crítico', 'Critical systematic error'],
  custom: ['Personalizado', 'Custom'],
  customTitle: ['Configuração personalizada', 'Custom configuration'],
  customText: ['Parâmetros alterados a partir do cenário «{base}». O erro sistemático e o veredito abaixo são recalculados para esta configuração.', 'Parameters changed from the «{base}» scenario. The systematic error and the verdict below are recomputed for this configuration.'],
  sysTitle: ['Erro sistemático desta configuração', 'Systematic error of this configuration'],
  systematicDef: ['Erro sistemático: determinístico, com sinal e padrão definidos; não diminui com mais pontos, repetições ou ajustamento, só com modelagem e correção (veja a teoria).', 'Systematic error: deterministic, with a definite sign and pattern; it does not shrink with more points, repetitions or adjustment, only with modelling and correction (see the theory).'],
  tolerance: ['Tolerância T (cm)', 'Tolerance T (cm)'],
  tileScale: ['Erro de escala no centro', 'Scale error at the centre'],
  tileScaleSub: ['= {mm} mm a cada 100 m (proporcional à distância)', '= {mm} mm every 100 m (proportional to distance)'],
  tileEdge: ['Maior erro numa aresta de cubo', 'Largest error on a cube edge'],
  tileEdgeSub: ['cubo #{id} ({size} m), aresta {which}', 'cube #{id} ({size} m), {which} edge'],
  edgeWE: ['O–L', 'W–E'],
  edgeSN: ['S–N', 'S–N'],
  edgeH: ['vertical', 'vertical'],
  tileHorizontal: ['Maior erro horizontal de posição', 'Largest horizontal position error'],
  tileHorizontalSub: ['acumulado do centro até a borda da área', 'accumulated from the centre to the edge of the area'],
  tileVertical: ['Maior erro vertical de posição', 'Largest vertical position error'],
  tileVerticalSub: ['curvatura achatada (d²/2R)', 'flattened curvature (d²/2R)'],
  tileVerticalGeoid: ['curvatura achatada + geoide (parte do geoide: {g})', 'flattened curvature + geoid (geoid part: {g})'],
  show3d: ['Mostrar também o erro 3D escalar da nuvem', 'Also show the scalar 3D error of the cloud'],
  panel3dTitle: ['Erro 3D escalar da nuvem |d|', 'Scalar 3D error of the cloud |d|'],
  panel3dNote: ['Painel 3D: |d| = √(dE² + dN² + dU²), o maior valor entre os pontos da nuvem (terreno, fachadas e telhados) em torno de cada nó. Uma nuvem de pontos é um produto 3D: os telhados somam ≈ a·s/R ao erro horizontal, porque no ENU cada edifício se inclina para fora (a vertical aponta para o centro da Terra), enquanto no UTM todas as verticais ficam paralelas.', '3D panel: |d| = √(dE² + dN² + dU²), the largest value among the cloud points (terrain, walls and roofs) around each node. A point cloud is a 3D product: roofs add ≈ a·s/R to the horizontal error, because in ENU every building leans outward (its vertical points to the Earth centre) while in UTM all verticals are parallel.'],
  tile3d: ['Maior erro 3D de posição', 'Largest 3D position error'],
  tile3dSub: ['|d| = √(dE² + dN² + dU²) em toda a nuvem', '|d| = √(dE² + dN² + dU²) over the whole cloud'],
  level_negligible: ['desprezível (≤ T/3)', 'negligible (≤ T/3)'],
  level_tolerable: ['tolerável (≤ T)', 'tolerable (≤ T)'],
  level_exceeds: ['excede a tolerância (> T)', 'exceeds the tolerance (> T)'],
  overall_negligible: ['desprezível', 'negligible'],
  overall_tolerable: ['tolerável', 'tolerable'],
  overall_exceeds: ['excede a tolerância', 'exceeds the tolerance'],
  verdictLabel: ['Veredito', 'Verdict'],
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
  metric: ['Erro sistemático mostrado', 'Systematic error shown'],
  metric_ppm: ['Erro de escala local', 'Local scale error'],
  metric_dh: ['Erro horizontal de posição', 'Horizontal position error'],
  metric_dz: ['Erro vertical de posição', 'Vertical position error'],
  metric_dg: ['Efeito do geoide na altura', 'Geoid effect on height'],
  metric_d3: ['Erro 3D de posição', '3D position error'],
  metricHelp_ppm: ['Erro sistemático de escala (k·ρ/(ρ+h) − 1)·10⁶ em cada ponto, em ppm = mm/km: proporcional à distância. Azul: encurta; vermelho: alonga.', 'Systematic scale error (k·ρ/(ρ+h) − 1)·10⁶ at each point, in ppm = mm/km: proportional to distance. Blue: shortens; red: stretches.'],
  metricHelp_dh: ['Erro sistemático acumulado: distância horizontal entre o ponto em UTM e a sua posição verdadeira (ENU alinhado no centro).', 'Accumulated systematic error: horizontal distance between the point in UTM and its true position (ENU aligned at the centre).'],
  metricHelp_dz: ['Erro sistemático vertical: altura em UTM menos a altura verdadeira, ou seja, a curvatura achatada (d²/2R) e, com o geoide, −(N − N₀). Azul: abaixo; vermelho: acima.', 'Vertical systematic error: height in UTM minus the true height, i.e. the flattened curvature (d²/2R) and, with the geoid, −(N − N₀). Blue: below; red: above.'],
  metricHelp_dg: ['Só a parte do deslocamento vertical causada pelo geoide: −(N − N₀). O valor N₀ do centro é absorvido pelo alinhamento. Azul: o ponto desce; vermelho: sobe.', 'Only the part of the vertical displacement caused by the geoid: −(N − N₀). The centre value N₀ is absorbed by the alignment. Blue: the point goes down; red: it goes up.'],
  metricHelp_d3: ['Módulo do erro sistemático 3D em relação à posição verdadeira.', 'Magnitude of the 3D systematic error from the true position.'],
  range: ['Escala de cores', 'Colour scale'],
  rangeData: ['Ajustada aos dados', 'Stretched to the data'],
  rangeZero: ['Ancorada no zero', 'Anchored at zero'],
  exaggeration: ['Exagero do erro sistemático (×)', 'Systematic error exaggeration (×)'],
  exaggerationHint: ['×1 = geometria verdadeira. Cores e mapa usam sempre os valores reais.', '×1 = true geometry. Colours and the map always use the real values.'],
  pointSize: ['Tamanho do ponto (px)', 'Point size (px)'],
  outline: ['Mostrar o contorno verdadeiro dos cubos', 'Show the true outline of the cubes'],
  resetView: ['Reenquadrar vistas', 'Reset views'],
  views3d: ['Vistas 3D sincronizadas: arraste para girar, role para aproximar, botão direito para deslocar.', 'Synchronized 3D views: drag to orbit, scroll to zoom, right button to pan.'],
  viewLeft: ['ECEF → ENU · transformação rígida, sem distorção', 'ECEF → ENU · rigid transformation, no distortion'],
  viewRight: ['ECEF → UTM + {h} · erro sistemático ×{f}', 'ECEF → UTM + {h} · systematic error ×{f}'],
  hEll: ['h elipsoidal', 'ellipsoidal h'],
  hOrt: ['H ortométrica', 'orthometric H'],
  legendLeft: ['Cores neutras: terreno, telhados e fachadas.', 'Neutral colours: terrain, roofs and walls.'],
  busy: ['Calculando…', 'Computing…'],
  chartTitle: ['Mapa 2D do erro sistemático', '2D map of the systematic error'],
  chartNote: ['Grade de 121 × 121 nós na altitude do terreno; isolinhas nos valores marcados na barra; quadrados = edificações; tracejado = meridiano central. Passe o cursor para ler os valores.', '121 × 121 grid at terrain height; isolines at the values marked on the bar; squares = buildings; dashed = central meridian. Hover to read values.'],
  arrowsNote: ['Setas: direção do deslocamento horizontal (comprimento relativo).', 'Arrows: direction of the horizontal displacement (relative length).'],
  chartLabel: ['Mapa de calor do erro sistemático sobre a área, com isolinhas', 'Heat map of the systematic error over the area, with isolines'],
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
  stCombined: ['Fator combinado (erro de escala)', 'Combined factor (scale error)'],
  stGamma: ['Convergência meridiana γ', 'Meridian convergence γ'],
  stN: ['Ondulação geoidal N no centro', 'Geoid undulation N at the centre'],
  stPoints: ['Pontos (terreno + edificações)', 'Points (terrain + buildings)'],
  stTime: ['Tempo de cálculo', 'Computation time'],
  stRange: ['Faixa da métrica na nuvem', 'Metric range in the cloud'],
  stMaxDisp: ['Maior erro de posição (horizontal / vertical)', 'Largest position error (horizontal / vertical)'],
  south: ['S', 'S'],
  north: ['N', 'N'],
  cubesTitle: ['Os cubos deixam de ser cubos (erro sistemático nas arestas)', 'The cubes stop being cubes (systematic error on the edges)'],
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
<h3>1. Distorção é erro sistemático</h3>
<p>Os erros de observação costumam ser classificados em grosseiros (enganos), sistemáticos e aleatórios. A distorção que o UTM e o geoide introduzem na geometria da nuvem é um <b>erro sistemático</b> puro:</p>
<ul>
<li><b>Determinístico:</b> decorre de fórmulas conhecidas (fator de escala, fator de elevação, curvatura, ondulação geoidal). Repetir a captura reproduz exatamente o mesmo erro.</li>
<li><b>Sinal e padrão definidos:</b> encurta (azul) ou alonga (vermelho) de forma suave e correlacionada no espaço, sem a dispersão do ruído do sensor.</li>
<li><b>Não diminui com redundância:</b> mais pontos, mais repetições ou o ajustamento por mínimos quadrados não o reduzem, e ele não se cancela na média. Se não for modelado, enviesa as coordenadas ou é absorvido como um falso fator de escala numa transformação de similaridade, sem piorar a precisão aparente (σ̂₀).</li>
<li><b>Cresce com a extensão:</b> é proporcional à distância na escala (ppm = mm/km) e ao quadrado da distância na curvatura (d²/2R).</li>
<li><b>Pode ser eliminado por modelagem:</b> conhecido o modelo, corrige-se exatamente (seção 8).</li>
</ul>
<p>A pergunta, portanto, não é se ele existe (sempre existe), mas se é <b>tolerável</b> para a finalidade. O painel de erro sistemático compara cada componente com a tolerância T: desprezível até T/3, tolerável até T, excede acima de T. Os cenários prontos mostram casos de cada tipo.</p>
<h3>2. Do ECEF ao ENU: só rotação e translação</h3>
<p>Cada ponto nasce em coordenadas cartesianas geocêntricas (X, Y, Z). O sistema geodésico local ENU (<i>east–north–up</i>) no ponto central (φ₀, λ₀, h₀) é</p>
<p class="formula">[e n u]ᵀ = R(φ₀, λ₀) · ([X Y Z]ᵀ − [X₀ Y₀ Z₀]ᵀ)</p>
<p>R é uma matriz de rotação, portanto distâncias, ângulos e volumes são preservados: a vista da esquerda é a referência sem erro sistemático. Ela mostra inclusive a curvatura: o terreno, de altitude elipsoidal constante, cai cerca de d²/(2R) longe do centro (8 cm a 1 km, 7,8 m a 10 km), e cada edifício fica a prumo segundo a sua própria normal.</p>
<h3>3. Do ECEF ao UTM</h3>
<p>Cada ponto é convertido em (φ, λ, h) (iteração de ponto fixo a partir do valor inicial de Bowring) e projetado pela Transversa de Mercator (séries de Krüger até n⁶, Karney 2011), com k₀ = 0,9996, falso leste de 500 000 m e falso norte de 10 000 000 m no hemisfério sul. O terno (E, N, h), ou (E, N, H), é então tratado como se fosse cartesiano, como faz quem importa a nuvem num programa de CAD ou de processamento de nuvens. É esse uso que transforma a distorção da projeção em erro sistemático da geometria.</p>
<h3>4. Erro sistemático de escala</h3>
<p>A projeção é conforme: localmente só a escala muda. Um comprimento horizontal na altitude h é reduzido ao elipsoide pelo fator de elevação ρ/(ρ + h), com ρ = √(MN), e depois multiplicado pelo fator de escala k ≈ k₀ (1 + x²/(2R²)), em que x é a distância ao meridiano central. O fator combinado e o erro de escala são</p>
<p class="formula">F = k · ρ/(ρ + h) &nbsp;&nbsp; δ = (F − 1) · 10⁶ ppm (mm/km)</p>
<p>As alturas, porém, não são escaladas: as arestas horizontais de um cubo erram δ·a e as verticais não. Com h = 1000 m o fator de elevação encurta os comprimentos em ≈ 157 ppm; somado a k₀ (−400 ppm) no meridiano central, uma aresta de 100 m encurta 5,6 cm. O erro é mínimo perto das linhas onde F = 1 (cenários do Rio e de Nairóbi) e máximo nas bordas dos fusos e em grandes altitudes (Manaus, El Alto).</p>
<h3>5. Curvatura achatada e convergência meridiana</h3>
<p>Em (E, N, h) todas as verticais ficam paralelas e o terreno fica plano: a queda d²/(2R) da vista ENU desaparece. Isso é um erro sistemático vertical que cresce com o quadrado da distância. Ele é irrelevante para as altitudes em si, mas aparece em qualquer cálculo 3D (distâncias inclinadas, volumes, registro com nuvens em sistema local). A convergência meridiana γ (ângulo do norte verdadeiro ao norte da quadrícula) gira a nuvem como um todo. Como isso é um movimento rígido, não é contado como erro: a referência da direita é a nuvem ENU girada de θ ≈ γ₀ e transladada para o centro. O erro de posição mostrado é</p>
<p class="formula">d = (E − E₀, N − N₀, V − V₀) − R(θ) · (e, n, u)</p>
<p>Uma nuvem de pontos é um produto 3D, então o erro que importa para ela é o escalar |d| = √(dE² + dN² + dU²), que soma as componentes horizontal e vertical. Há ainda um efeito puramente 3D: no ENU cada edifício a uma distância s do centro se inclina para fora de s/R (a sua vertical aponta para o centro da Terra), enquanto no UTM todas as verticais são paralelas. Assim, o telhado de um edifício de altura a carrega ≈ a·s/R de erro horizontal a mais que a sua base: 1,6 cm para 100 m de altura a 1 km do centro. O painel 3D do mapa 2D e o quinto bloco do painel de erro sistemático usam |d| de todos os pontos da nuvem.</p>
<h3>6. Modelo geoidal</h3>
<p>Com o geoide ligado, a altura é a ortométrica H = h − N, com N do EGM2008 (grade de 5′ com interpolação bicúbica; só os tiles de 10° × 10° da área são baixados). O valor constante N₀ é absorvido pelo alinhamento. O restante, −(N − N₀), inclina e ondula o terreno e aparece no erro vertical (a métrica «efeito do geoide na altura» mostra só essa parcela). A altitude física fica correta, mas a geometria sofre um erro sistemático igual ao gradiente do geoide, isto é, ao desvio da vertical: ≈ 26 cm/km em Katmandu. O erro de escala não muda, porque E e N dependem só de φ e λ. Usar H em vez de h no fator de elevação erra cerca de N/R (≈ 1 ppm a cada 6 m de ondulação).</p>
<h3>7. Exagero</h3>
<p>A vista da direita mostra R(θ)·ENU + f·d. Com f = 1 a geometria é a verdadeira; o padrão f = 100 torna visíveis erros de centímetros. As cores, o mapa 2D, o painel de erro sistemático e o resumo usam sempre os valores verdadeiros.</p>
<h3>8. Como eliminar ou reduzir o erro sistemático</h3>
<ul>
<li>Fazer a geometria 3D num sistema cartesiano local (ENU, ou o Sistema Topográfico Local da NBR 14166) e converter para UTM só os produtos cartográficos.</li>
<li>Aplicar o fator combinado para passar distâncias da quadrícula para o terreno (d_terreno = d_UTM / F) e vice-versa.</li>
<li>Usar uma projeção de baixa distorção (LDP, RTM/LTM) com meridiano central e k₀ escolhidos para a obra, que leva o caso de qualquer local ao do cenário de Nairóbi.</li>
<li>Nunca misturar fusos. Se a área cruza um limite, estender um único fuso ou adotar uma projeção local (cenários de Manaus, do Distrito Federal e do fuso vizinho).</li>
<li>Manter as alturas coerentes (todas elipsoidais ou todas ortométricas com o mesmo modelo geoidal) e lembrar que a conversão pelo geoide inclina a geometria (cenário de Katmandu).</li>
</ul>
<h3>Simplificações</h3>
<ul>
<li>Fusos UTM padrão, sem as exceções da Noruega e de Svalbard; o fuso do centro (ou o vizinho escolhido) vale para toda a área.</li>
<li>Desvio da vertical ignorado na construção da cena: os edifícios ficam a prumo segundo a normal ao elipsoide.</li>
<li>Fator de elevação com o raio médio de Gauss √(MN); a diferença entre as direções O–L e S–N é de cerca de 1 ppm.</li>
<li>EGM2008 5′ com erro de interpolação de ~5 mm (RMS) em relação ao modelo completo.</li>
</ul>
<p class="refs">Referências: Karney, C. F. F. (2011), <i>Transverse Mercator with an accuracy of a few nanometers</i>, J. Geodesy 85(8); Pavlis et al. (2012), EGM2008, JGR 117; grade de 5′ do GeographicLib; ABNT NBR 14166 (Rede de Referência Cadastral Municipal).</p>`, `
<h3>1. Distortion is systematic error</h3>
<p>Observation errors are usually classified as gross errors (blunders), systematic errors and random errors. The distortion that UTM and the geoid introduce into the geometry of the cloud is a pure <b>systematic error</b>:</p>
<ul>
<li><b>Deterministic:</b> it follows from known formulas (scale factor, elevation factor, curvature, geoid undulation). Repeating the capture reproduces exactly the same error.</li>
<li><b>Definite sign and pattern:</b> it shortens (blue) or stretches (red) smoothly and with spatial correlation, without the scatter of sensor noise.</li>
<li><b>Does not shrink with redundancy:</b> more points, more repetitions or least-squares adjustment do not reduce it, and it does not cancel out on average. If it is not modelled, it biases the coordinates or is absorbed as a false scale factor in a similarity transformation, without worsening the apparent precision (σ̂₀).</li>
<li><b>Grows with extent:</b> it is proportional to distance for scale (ppm = mm/km) and to the square of distance for curvature (d²/2R).</li>
<li><b>Can be removed by modelling:</b> once the model is known, it is corrected exactly (section 8).</li>
</ul>
<p>So the question is not whether it exists (it always does) but whether it is <b>tolerable</b> for the purpose. The systematic-error panel compares each component with the tolerance T: negligible up to T/3, tolerable up to T, exceeding above T. The ready-made scenarios show cases of each kind.</p>
<h3>2. From ECEF to ENU: rotation and translation only</h3>
<p>Every point is born in geocentric Cartesian coordinates (X, Y, Z). The local geodetic ENU (east–north–up) frame at the centre point (φ₀, λ₀, h₀) is</p>
<p class="formula">[e n u]ᵀ = R(φ₀, λ₀) · ([X Y Z]ᵀ − [X₀ Y₀ Z₀]ᵀ)</p>
<p>R is a rotation matrix, so distances, angles and volumes are preserved: the left view is the reference without systematic error. It even shows the curvature: the terrain, at constant ellipsoidal height, drops about d²/(2R) away from the centre (8 cm at 1 km, 7.8 m at 10 km), and every building stands plumb along its own normal.</p>
<h3>3. From ECEF to UTM</h3>
<p>Every point is converted to (φ, λ, h) (fixed-point iteration from Bowring's starting value) and projected with the Transverse Mercator (Krüger series to n⁶, Karney 2011), with k₀ = 0.9996, a false easting of 500 000 m and a false northing of 10 000 000 m in the southern hemisphere. The triple (E, N, h), or (E, N, H), is then treated as if it were Cartesian, as happens when the cloud is imported into CAD or point-cloud software. That use is what turns the projection distortion into a systematic error of the geometry.</p>
<h3>4. Systematic scale error</h3>
<p>The projection is conformal: locally only the scale changes. A horizontal length at height h is reduced to the ellipsoid by the elevation factor ρ/(ρ + h), with ρ = √(MN), and then multiplied by the scale factor k ≈ k₀ (1 + x²/(2R²)), where x is the distance from the central meridian. The combined factor and the scale error are</p>
<p class="formula">F = k · ρ/(ρ + h) &nbsp;&nbsp; δ = (F − 1) · 10⁶ ppm (mm/km)</p>
<p>Heights, however, are not scaled: the horizontal edges of a cube are off by δ·a while the vertical ones are not. At h = 1000 m the elevation factor shortens lengths by ≈ 157 ppm; added to k₀ (−400 ppm) on the central meridian, a 100 m edge becomes 5.6 cm shorter. The error is smallest near the lines where F = 1 (Rio and Nairobi scenarios) and largest at zone edges and at high altitude (Manaus, El Alto).</p>
<h3>5. Flattened curvature and meridian convergence</h3>
<p>In (E, N, h) all verticals become parallel and the terrain becomes flat: the d²/(2R) drop of the ENU view disappears. This is a vertical systematic error that grows with the square of the distance. It is irrelevant for the heights themselves, but it shows up in any 3D computation (slope distances, volumes, registration with clouds in a local frame). The meridian convergence γ (angle from true north to grid north) turns the cloud as a whole. Since that is a rigid motion, it is not counted as error: the right-hand reference is the ENU cloud rotated by θ ≈ γ₀ and translated to the centre. The position error shown is</p>
<p class="formula">d = (E − E₀, N − N₀, V − V₀) − R(θ) · (e, n, u)</p>
<p>A point cloud is a 3D product, so the error that matters for it is the scalar |d| = √(dE² + dN² + dU²), which combines the horizontal and vertical components. There is also a purely 3D effect: in ENU every building at distance s from the centre leans outward by s/R (its vertical points to the Earth centre), while in UTM all verticals are parallel. So the roof of a building of height a carries ≈ a·s/R more horizontal error than its base: 1.6 cm for a 100 m building 1 km from the centre. The 3D panel of the 2D map and the fifth tile of the systematic-error panel use |d| over every point of the cloud.</p>
<h3>6. Geoid model</h3>
<p>With the geoid on, the height is the orthometric H = h − N, with N from EGM2008 (5′ grid with bicubic interpolation; only the 10° × 10° tiles of the area are downloaded). The constant N₀ is absorbed by the alignment. The rest, −(N − N₀), tilts and warps the terrain and shows up in the vertical error (the «geoid effect on height» metric shows that part alone). The physical height is right, but the geometry gets a systematic error equal to the geoid gradient, that is, the deflection of the vertical: ≈ 26 cm/km in Kathmandu. The scale error does not change, because E and N depend only on φ and λ. Using H instead of h in the elevation factor is off by about N/R (≈ 1 ppm for every 6 m of undulation).</p>
<h3>7. Exaggeration</h3>
<p>The right view shows R(θ)·ENU + f·d. At f = 1 the geometry is the true one; the default f = 100 makes centimetre errors visible. Colours, the 2D map, the systematic-error panel and the summary always use the true values.</p>
<h3>8. How to remove or reduce the systematic error</h3>
<ul>
<li>Do the 3D geometry in a local Cartesian frame (ENU, or a local topographic system such as Brazil's NBR 14166) and convert only the cartographic products to UTM.</li>
<li>Apply the combined factor to go from grid to ground distances (d_ground = d_UTM / F) and back.</li>
<li>Use a low-distortion projection (LDP, RTM/LTM) with a central meridian and k₀ chosen for the site, which brings any location to the Nairobi case.</li>
<li>Never mix zones. If the area crosses a boundary, extend a single zone or adopt a local projection (Manaus, Federal District and neighbouring-zone scenarios).</li>
<li>Keep heights consistent (all ellipsoidal, or all orthometric with the same geoid model) and remember that the geoid conversion tilts the geometry (Kathmandu scenario).</li>
</ul>
<h3>Simplifications</h3>
<ul>
<li>Standard UTM zones, without the Norway and Svalbard exceptions; the centre zone (or the chosen neighbour) is used for the whole area.</li>
<li>Deflection of the vertical ignored when building the scene: buildings stand plumb along the ellipsoid normal.</li>
<li>Elevation factor with the Gaussian mean radius √(MN); the W–E and S–N directions differ by about 1 ppm.</li>
<li>EGM2008 5′ with ~5 mm (RMS) interpolation error against the full model.</li>
</ul>
<p class="refs">References: Karney, C. F. F. (2011), <i>Transverse Mercator with an accuracy of a few nanometers</i>, J. Geodesy 85(8); Pavlis et al. (2012), EGM2008, JGR 117; GeographicLib 5′ grid; ABNT NBR 14166 (municipal cadastral reference network).</p>`],
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
