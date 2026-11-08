// Pre-built scenarios: where the systematic error of UTM (+ geoid) is tolerable and where it is not.
// Numbers quoted in the texts are checked against the model in tests/scenarios.test.mjs (claim.*).
// tolerance in metres; params override model DEFAULTS; display sets metric / exaggeration.

export const SCENARIOS = [
  {
    id: 'rio', group: 'tolerable', tolerance: 0.02,
    params: { lat: -22.9035, lon: -43.1755, h0: 5, spanWE: 250, spanNS: 250, grid: 3, sizeMin: 20, sizeMax: 60 },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: 32, overall: ['negligible'] },
    title: ['Rio de Janeiro — perto da linha de escala unitária', 'Rio de Janeiro — near the line of unit scale'],
    text: [
      'O centro fica ~186 km a leste do meridiano central do fuso 23 (45° O), perto da linha onde k = 1, e praticamente ao nível do mar, onde o fator de elevação ρ/(ρ+h) ≈ 1. O erro sistemático de escala é de só ≈ +32 ppm, ou 3 mm a cada 100 m. Numa área de 250 m × 250 m, todas as componentes ficam abaixo de um terço da tolerância de 2 cm de um levantamento com nuvem de pontos: o erro é desprezível. Ele continua sistemático: dobre a área e ele dobra.',
      'The centre lies ~186 km east of the central meridian of zone 23 (45° W), close to the line where k = 1, and practically at sea level, where the elevation factor ρ/(ρ+h) ≈ 1. The systematic scale error is only ≈ +32 ppm, or 3 mm every 100 m. Over a 250 m × 250 m area every component stays below one third of the 2 cm tolerance of a point-cloud survey: the error is negligible. It is still systematic: double the area and it doubles.',
    ],
  },
  {
    id: 'nairobi', group: 'tolerable', tolerance: 0.02,
    params: { lat: -1.2864, lon: 36.8172, h0: 1700, spanWE: 300, spanNS: 300, grid: 3, sizeMin: 20, sizeMax: 60 },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: 63, overall: ['negligible', 'tolerable'] },
    title: ['Nairóbi — a altitude compensa o fator de escala', 'Nairobi — altitude offsets the scale factor'],
    text: [
      'A 2,2° do meridiano central (39° L), o fator de escala alonga as distâncias em ≈ +330 ppm. A 1700 m de altitude, o fator de elevação as encurta em ≈ −267 ppm. Os dois erros sistemáticos têm sinais opostos e quase se cancelam, sobrando ≈ +63 ppm (6 mm a cada 100 m). Essa é a ideia das projeções de baixa distorção (LDP/LTM): escolher o meridiano central e k₀ para que a compensação aconteça justamente no local da obra.',
      'At 2.2° from the central meridian (39° E), the scale factor stretches distances by ≈ +330 ppm. At 1700 m of altitude, the elevation factor shortens them by ≈ −267 ppm. The two systematic errors have opposite signs and almost cancel, leaving ≈ +63 ppm (6 mm every 100 m). This is the idea behind low-distortion projections (LDP/LTM): choose the central meridian and k₀ so that the compensation happens right at the site.',
    ],
  },
  {
    id: 'mapping', group: 'tolerable', tolerance: 0.20,
    params: { spanWE: 1000, spanNS: 1000, grid: 4, sizeMin: 20, sizeMax: 120 },
    display: { metric: 'dh', exaggeration: 100 },
    claim: { ppm: -213, overall: ['tolerable'] },
    title: ['Mapeamento urbano 1:1000 (tolerância de 20 cm)', 'Urban mapping at 1:1000 (20 cm tolerance)'],
    text: [
      'É o mesmo erro sistemático do caso típico de Pato Branco (≈ −213 ppm), mas o produto agora é uma planta na escala 1:1000, cuja tolerância, da ordem de 0,2 mm no papel × 1000 = 20 cm, é dez vezes maior que a de um levantamento de precisão. Os deslocamentos de até ≈ 15 cm na área de 1 km ficam dentro dela. O erro não muda; o que muda é a tolerância da finalidade.',
      'This is the same systematic error as the typical Pato Branco case (≈ −213 ppm), but the product is now a 1:1000 map, whose tolerance, about 0.2 mm on paper × 1000 = 20 cm, is ten times that of a precise survey. The displacements of up to ≈ 15 cm over the 1 km area stay within it. The error does not change; the tolerance of the purpose does.',
    ],
  },
  {
    id: 'pato', group: 'critical', tolerance: 0.02,
    params: {},
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: -213, overall: ['exceeds'] },
    title: ['Pato Branco — caso típico (padrão)', 'Pato Branco — typical case (default)'],
    text: [
      'A 1,7° do meridiano central (51° O) e a 1000 m de altitude, os dois efeitos têm o mesmo sinal: k − 1 ≈ −56 ppm e fator de elevação ≈ −157 ppm, total ≈ −213 ppm. Uma aresta de 120 m encurta ≈ 2,6 cm e, na área de 2 km, as posições se afastam até ≈ 30 cm das verdadeiras. A planta continua boa, mas para uma nuvem de pontos de precisão (tolerância de 2 cm) o erro sistemático já excede a tolerância.',
      'At 1.7° from the central meridian (51° W) and 1000 m of altitude, both effects have the same sign: k − 1 ≈ −56 ppm and elevation factor ≈ −157 ppm, ≈ −213 ppm in total. A 120 m edge shrinks by ≈ 2.6 cm and, over the 2 km area, positions move up to ≈ 30 cm away from the true ones. A map would still be fine, but for a precise point cloud (2 cm tolerance) the systematic error already exceeds the tolerance.',
    ],
  },
  {
    id: 'poa', group: 'critical', tolerance: 0.02,
    params: { lat: -30.0346, lon: -51.2177, h0: 10, spanWE: 1000, spanNS: 1000, grid: 4 },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: -396, overall: ['exceeds'] },
    title: ['Porto Alegre — sobre o meridiano central', 'Porto Alegre — on the central meridian'],
    text: [
      'Mesmo sobre o meridiano central e ao nível do mar há erro sistemático: k₀ = 0,9996 encurta tudo em 400 ppm, ou 4 cm a cada 100 m. O UTM é secante de propósito: distribui a distorção pelo fuso (−400 ppm no meridiano central, perto de zero a ~180 km dele, cerca de +1000 ppm nas bordas) em vez de anulá-la em algum lugar útil para a obra.',
      'Even on the central meridian and at sea level there is a systematic error: k₀ = 0.9996 shortens everything by 400 ppm, or 4 cm every 100 m. UTM is secant on purpose: it spreads the distortion over the zone (−400 ppm on the central meridian, near zero ~180 km from it, about +1000 ppm at the edges) instead of cancelling it where the site happens to be.',
    ],
  },
  {
    id: 'elalto', group: 'critical', tolerance: 0.02,
    params: { lat: -16.5, lon: -68.19, h0: 4100, spanWE: 1000, spanNS: 1000, grid: 4 },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: -952, overall: ['exceeds'] },
    title: ['El Alto (La Paz) — grande altitude', 'El Alto (La Paz) — high altitude'],
    text: [
      'A 4100 m de altitude o fator de elevação sozinho vale ≈ −644 ppm. Somado a k − 1 ≈ −308 ppm perto do meridiano central, chega a ≈ −950 ppm: quase 10 cm a cada 100 m, e uma aresta de 120 m encurta mais de 11 cm. Em altitude, o erro sistemático de reduzir as distâncias ao elipsoide domina; as alturas não são reduzidas, então os cubos viram prismas achatados.',
      'At 4100 m of altitude the elevation factor alone is ≈ −644 ppm. Added to k − 1 ≈ −308 ppm near the central meridian, it reaches ≈ −950 ppm: almost 10 cm every 100 m, and a 120 m edge shrinks by more than 11 cm. At altitude, the systematic error of reducing distances to the ellipsoid dominates; heights are not reduced, so the cubes become flattened prisms.',
    ],
  },
  {
    id: 'manaus', group: 'critical', tolerance: 0.02,
    params: { lat: -3.119, lon: -60.0217, h0: 70 },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: 946, overall: ['exceeds'] },
    title: ['Manaus — na borda entre os fusos 20 e 21', 'Manaus — on the edge between zones 20 and 21'],
    text: [
      'Manaus fica praticamente sobre o meridiano de 60° O, limite entre os fusos 20 e 21, a ~330 km de qualquer meridiano central. O fator de escala chega a ≈ +946 ppm (9,5 cm a cada 100 m) e as posições na área de 2 km se deslocam mais de 1 m. Trocar para o fuso 21 não ajuda (≈ +986 ppm; experimente o fuso vizinho a leste). Nas bordas dos fusos o erro sistemático do UTM é máximo.',
      'Manaus lies practically on the 60° W meridian, the boundary between zones 20 and 21, ~330 km from either central meridian. The scale factor reaches ≈ +946 ppm (9.5 cm every 100 m) and positions over the 2 km area move by more than 1 m. Switching to zone 21 does not help (≈ +986 ppm; try the neighbouring zone to the east). At zone edges the systematic error of UTM is at its largest.',
    ],
  },
  {
    id: 'df', group: 'critical', tolerance: 0.02,
    params: { lat: -15.78, lon: -47.8, h0: 1160, spanWE: 100000, spanNS: 60000, grid: 6, sizeMin: 30, sizeMax: 150 },
    display: { metric: 'ppm', exaggeration: 10 },
    claim: { ppm: 531, overall: ['exceeds'] },
    title: ['Distrito Federal — área que atravessa o limite de fusos', 'Federal District (Brazil) — area crossing a zone boundary'],
    text: [
      'Uma área de 100 km × 60 km centrada perto de Brasília cruza o meridiano de 48° O (limite entre os fusos 22 e 23) e é toda calculada no fuso 23. Dentro da própria área o erro sistemático de escala varia de ≈ +190 ppm (leste) a ≈ +940 ppm (oeste, já fora do fuso; veja o mapa). As posições se deslocam ≈ 44 m nas bordas e a curvatura achatada soma ≈ 270 m na vertical. Um único fuso UTM não serve como sistema cartesiano para uma área dessas. Exagero ×10.',
      'A 100 km × 60 km area centred near Brasília crosses the 48° W meridian (the boundary between zones 22 and 23) and is computed entirely in zone 23. Within the area itself the systematic scale error ranges from ≈ +190 ppm (east) to ≈ +940 ppm (west, already outside the zone; see the map). Positions move ≈ 44 m at the edges and the flattened curvature adds ≈ 270 m vertically. A single UTM zone is no Cartesian frame for such an area. Exaggeration ×10.',
    ],
  },
  {
    id: 'wrongzone', group: 'critical', tolerance: 0.02,
    params: { zone: 'west' },
    display: { metric: 'ppm', exaggeration: 100 },
    claim: { ppm: 1755, overall: ['exceeds'] },
    title: ['Pato Branco no fuso vizinho (21)', 'Pato Branco in the neighbouring zone (21)'],
    text: [
      'Calcular a nuvem no fuso 21 (meridiano central 57° O), por exemplo para manter o fuso de um projeto vizinho, põe o centro a 4,3° do meridiano central. O total passa a ≈ +1755 ppm, ou 17,5 cm a cada 100 m, contra −213 ppm no fuso correto. Fora do próprio fuso, o erro sistemático cresce com o quadrado da distância ao meridiano central (k ≈ k₀(1 + x²/2R²)).',
      'Computing the cloud in zone 21 (central meridian 57° W), for instance to keep the zone of a neighbouring project, puts the centre 4.3° from the central meridian. The total becomes ≈ +1755 ppm, or 17.5 cm every 100 m, against −213 ppm in the correct zone. Outside its own zone, the systematic error grows with the square of the distance from the central meridian (k ≈ k₀(1 + x²/2R²)).',
    ],
  },
  {
    id: 'corridor', group: 'critical', tolerance: 0.02,
    params: { spanWE: 100000, spanNS: 4000, grid: 8 },
    display: { metric: 'dz', exaggeration: 10 },
    claim: { ppm: -213, overall: ['exceeds'] },
    title: ['Corredor de 100 km (rodovia ou ferrovia)', '100 km corridor (road or railway)'],
    text: [
      'Em obras lineares longas o erro sistemático se acumula. Ao longo do traçado O–L o fator de escala varia de ≈ −390 ppm (perto do meridiano central) a ≈ +20 ppm, e as posições se deslocam ≈ 15 m nas extremidades. A curvatura da Terra, achatada pelo UTM, produz ≈ 200 m de diferença vertical a 50 km do centro (d²/2R): irrelevante para as altitudes, mas enorme para qualquer cálculo 3D cartesiano feito nesse sistema. Exagero ×10.',
      'On long linear works the systematic error accumulates. Along the W–E alignment the scale factor ranges from ≈ −390 ppm (near the central meridian) to ≈ +20 ppm, and positions move ≈ 15 m at the ends. Earth curvature, flattened by UTM, produces ≈ 200 m of vertical difference 50 km from the centre (d²/2R): irrelevant for heights, but huge for any 3D Cartesian computation done in this frame. Exaggeration ×10.',
    ],
  },
  {
    id: 'kathmandu', group: 'critical', tolerance: 0.02,
    params: { lat: 27.7172, lon: 85.324, h0: 1350, spanWE: 4000, spanNS: 4000, geoid: true },
    display: { metric: 'dg', exaggeration: 100 },
    claim: { ppm: -275, overall: ['exceeds'] },
    title: ['Katmandu — geoide íngreme (Himalaia)', 'Kathmandu — steep geoid (Himalaya)'],
    text: [
      'Com o geoide ligado, a ondulação N do EGM2008 varia ≈ 26 cm/km sob Katmandu, por efeito do Himalaia. A troca h → H = h − N está correta como altitude física, mas como transformação geométrica não é rígida: inclina a nuvem pelo gradiente do geoide (o desvio da vertical), ≈ 70 cm entre o centro e os cantos da área de 4 km. É um erro sistemático na forma da nuvem, somado ao de escala (≈ −275 ppm). Veja a métrica «efeito do geoide na altura».',
      'With the geoid on, the EGM2008 undulation N varies ≈ 26 cm/km under Kathmandu because of the Himalaya. Replacing h with H = h − N is correct as a physical height, but as a geometric transformation it is not rigid: it tilts the cloud by the geoid gradient (the deflection of the vertical), ≈ 70 cm between the centre and the corners of the 4 km area. It is a systematic error in the shape of the cloud, added to the scale error (≈ −275 ppm). See the «geoid effect on height» metric.',
    ],
  },
];

export const scenarioById = id => SCENARIOS.find(s => s.id === id) || null;
export const DEFAULT_SCENARIO = 'pato';
