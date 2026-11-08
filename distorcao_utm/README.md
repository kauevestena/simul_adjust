# Distorções UTM e do Geoide em Nuvens de Pontos / UTM & Geoid Distortions in Point Clouds

## Português

Uma nuvem de pontos sintética (uma grade de edificações cúbicas de tamanhos variados sobre um
terreno plano de altitude elipsoidal constante, que acompanha o elipsoide) é gerada em **ECEF**
e mostrada em duas vistas 3D sincronizadas:

- **Esquerda:** ECEF → **ENU** no ponto central. É uma rotação mais uma translação, portanto
  sem nenhuma distorção (é a geometria verdadeira, inclusive a curvatura da Terra).
- **Direita:** ECEF → (φ, λ, h) → **UTM** (E, N) + altura, tratado como cartesiano. A altura é a
  elipsoidal h ou, com a caixa do geoide marcada, a ortométrica H = h − N (**EGM2008**). Os pontos
  são coloridos pela distorção local e a diferença em relação à posição verdadeira pode ser
  exagerada (padrão ×100).

Abaixo das vistas ficam o **mapa 2D da distorção** (mapa de calor com isolinhas, edificações,
meridiano central, setas de deslocamento e leitura sob o cursor) e um resumo com fuso, fatores
de escala, convergência meridiana, ondulação geoidal e as arestas dos cubos medidas em UTM. Os
cubos deixam de ser cubos: as arestas horizontais mudam de (k·ρ/(ρ+h) − 1)·a e as verticais não.

### Distorção é erro sistemático
A distorção que o UTM e o geoide introduzem na geometria da nuvem é um **erro sistemático**. Ele é
determinístico (sai das fórmulas do fator de escala, do fator de elevação, da curvatura e da
ondulação geoidal), tem sinal e padrão espacial definidos e não diminui com mais pontos,
repetições ou ajustamento por mínimos quadrados. Cresce com a extensão: proporcionalmente à
distância na escala (ppm = mm/km) e com o quadrado da distância na curvatura (d²/2R). Só se elimina
por modelagem: trabalhar em ENU ou num sistema topográfico local, aplicar o fator combinado, usar uma
projeção de baixa distorção, não misturar fusos e manter as alturas coerentes.

O painel **Erro sistemático desta configuração** mede cinco componentes: o erro de escala no
centro, o maior erro numa aresta de cubo e os maiores erros de posição horizontal, vertical e 3D
(|d| = √(dE² + dN² + dU²), porque uma nuvem de pontos é um produto 3D). Cada um é comparado com uma tolerância T: desprezível até T/3, tolerável até T, excede
acima de T. Mudar T só refaz o veredito, sem recalcular a nuvem.

A caixa **Mostrar também o erro 3D escalar da nuvem** acrescenta ao mapa 2D um segundo painel,
sincronizado, com |d| de todos os pontos da nuvem (terreno, fachadas e telhados), o maior valor em
torno de cada nó. Os telhados somam ≈ a·s/R ao erro horizontal: no ENU cada edifício a uma distância s
se inclina para fora (a vertical aponta para o centro da Terra), no UTM todas as verticais são
paralelas (1,6 cm para 100 m de altura a 1 km do centro).

### Cenários prontos
O seletor de cenários (também `?scenario=<id>` na URL) carrega local, área, tolerância, métrica e
exagero. Os números citados nos textos são verificados contra o modelo em `tests/scenarios.test.mjs`.

| id | Cenário | Lição | Erro de escala | Veredito (T) |
|---|---|---|---:|---|
| `rio` | Rio de Janeiro, 250 m | perto da linha k = 1, ao nível do mar | +32 ppm | desprezível (2 cm) |
| `nairobi` | Nairóbi, 300 m | a altitude compensa o fator de escala (ideia das LDP) | +63 ppm | tolerável (2 cm) |
| `mapping` | Pato Branco, planta 1:1000 | o mesmo erro é tolerável para outra finalidade | −213 ppm | tolerável (20 cm) |
| `pato` | Pato Branco, 2 km (padrão) | caso típico: os dois efeitos somam | −213 ppm | excede (2 cm) |
| `poa` | Porto Alegre, 1 km | sobre o meridiano central, só k₀ já dá −400 ppm | −396 ppm | excede (2 cm) |
| `elalto` | El Alto, 4100 m | a redução ao elipsoide domina em altitude | −952 ppm | excede (2 cm) |
| `manaus` | Manaus, 2 km | na borda entre os fusos 20 e 21 | +946 ppm | excede (2 cm) |
| `df` | Distrito Federal, 100 × 60 km | área que cruza o limite de fusos | +531 ppm (+190 a +940) | excede (2 cm) |
| `wrongzone` | Pato Branco no fuso 21 | fuso vizinho forçado | +1755 ppm | excede (2 cm) |
| `corridor` | corredor de 100 km | acúmulo ao longo de obra linear e curvatura achatada (≈ 200 m) | −213 ppm (−390 a +20) | excede (2 cm) |
| `kathmandu` | Katmandu, 4 km, geoide | gradiente do geoide (≈ 26 cm/km) inclina a nuvem ≈ 70 cm | −275 ppm | excede (2 cm) |

### Como usar
Sirva a raiz do repositório com `python3 -m http.server 8000` e abra
`http://localhost:8000/distorcao_utm/?lang=pt-BR`. Não há instalação nem CDN.

Parâmetros (além dos cenários): latitude/longitude do centro, altitude elipsoidal (padrão 1000 m), extensões O–L e
S–N (100 m a 100 km), grade n × n de edificações e faixa de tamanhos (com sorteio), densidade de
pontos das fachadas/telhados e do terreno, fuso UTM (automático ou vizinho), geoide, métrica
mostrada, escala de cores, exagero, tamanho do ponto e contorno verdadeiro dos cubos.

Métricas (todas componentes do erro sistemático): **erro de escala local** em ppm (= mm/km; padrão),
**erro horizontal de posição**, **erro vertical de posição** (curvatura achatada + geoide), **efeito do
geoide na altura** −(N − N₀) e **erro 3D de posição**. Os erros de posição são medidos em relação à nuvem ENU girada da
convergência meridiana e transladada para o centro, de modo que o movimento rígido não conta
como distorção.

### Desempenho e limite de pontos
Todo o cálculo (geração em ECEF, ECEF → geodésicas, UTM, geoide, métricas e mapa 2D) roda num
Web Worker, com arrays tipados transferidos para a página. O exagero é aplicado no shader, sem
recálculo. `node distorcao_utm/tests/bench.mjs` mediu, num contêiner de 4 núcleos (Node 22):

| pontos | tempo total | ns/ponto |
|---:|---:|---:|
| 100 000 | 107 ms | 1066 |
| 500 000 | 342 ms | 685 |
| 1 000 000 | 657 ms | 658 |
| 2 000 000 | 1402 ms | 701 |
| 3 000 000 | 2211 ms | 738 |

Por isso o limite é de **2 milhões de pontos** (1 milhão em telas de toque ou com
`deviceMemory ≤ 4`). Acima dele a densidade do terreno é reduzida primeiro e depois a das
edificações; a interface mostra as densidades efetivas. No teste de navegador, a cena de 2 M
pontos levou ~1,9 s no worker, e a maior tarefa da thread principal levou ~140 ms.

### Dados do geoide
`data/egm2008-5/` contém 648 tiles de 10° × 10° (7,5 MB no total) da grade de 5′ do EGM2008
empacotada pelo GeographicLib. Só os tiles da área são baixados, e apenas quando o geoide é ligado.
Os tiles são gerados por `scripts/build_geoid_tiles.py` (veja `data/README.md`).

### Testes
```sh
node --test distorcao_utm/tests/*.test.mjs
npm ci --prefix camera_proj && npx --prefix camera_proj playwright install chromium
NODE_PATH=./camera_proj/node_modules node distorcao_utm/tests/browser.cjs
```
Os testes unitários comparam o UTM com o PROJ (pyproj: E/N < 1 mm, k < 1e-9, γ < 1e-7°), o
geoide com a interpolação cúbica do GeographicLib (pygeodesy, < 3 cm) e com os nós da grade,
e a conversão geodésica com `network_preanalysis/network/coordinates.mjs`. Também verificam os
invariantes geométricos (cubos exatos em ENU, arestas em UTM escaladas por k·ρ/(ρ+h), altura
preservada), o limite de pontos, o determinismo e as traduções. O teste de navegador cobre
worker, WebGL, métricas, exagero, geoide sob demanda, idiomas, limite de pontos, retorno ao
portal e layout de celular. Os oráculos são gerados por
`tests/generate_pyproj_fixture.py` e `tests/generate_geoid_fixture.py`.

## English

A synthetic point cloud (a grid of cubic buildings of various sizes on flat terrain at constant
ellipsoidal height, which follows the ellipsoid) is generated in **ECEF** and shown in two
synchronized 3D views:

- **Left:** ECEF → **ENU** at the centre point. This is a rotation plus a translation, so there
  is no distortion at all (it is the true geometry, Earth curvature included).
- **Right:** ECEF → (φ, λ, h) → **UTM** (E, N) + height, treated as Cartesian. The height is the
  ellipsoidal h or, with the geoid box checked, the orthometric H = h − N (**EGM2008**). Points
  are coloured by the local distortion, and the difference from the true position can be
  exaggerated (×100 by default).

Below the views are the **2D distortion map** (heat map with isolines, buildings, central
meridian, displacement arrows and a hover readout) and a summary with the zone, scale factors,
meridian convergence, geoid undulation and the cube edges measured in UTM. The cubes stop being
cubes: horizontal edges change by (k·ρ/(ρ+h) − 1)·a and vertical ones do not.

### Distortion is systematic error
The distortion that UTM and the geoid introduce into the geometry of the cloud is a **systematic
error**. It is deterministic (it follows from the formulas of the scale factor, elevation factor,
curvature and geoid undulation), has a definite sign and spatial pattern, and does not shrink with
more points, repetitions or least-squares adjustment. It grows with extent: proportionally to distance
for scale (ppm = mm/km) and with the square of distance for curvature (d²/2R). It is removed only by
modelling: work in ENU or a local topographic frame, apply the combined factor, use a low-distortion
projection, never mix zones, and keep heights consistent.

The **Systematic error of this configuration** panel measures five components: the scale error at the
centre, the largest error on a cube edge and the largest horizontal, vertical and 3D position errors
(|d| = √(dE² + dN² + dU²), because a point cloud is a 3D product). Each is compared with a tolerance T: negligible up to T/3, tolerable up to T,
exceeding above T. Changing T only re-judges, without recomputing the cloud.

The **Also show the scalar 3D error of the cloud** box adds a second, synchronized panel to the 2D
map with |d| of every cloud point (terrain, walls and roofs), the largest value around each node.
Roofs add ≈ a·s/R to the horizontal error: in ENU every building at distance s leans outward (its
vertical points to the Earth centre), while in UTM all verticals are parallel (1.6 cm for a 100 m
building 1 km from the centre).

### Ready-made scenarios
The scenario selector (also `?scenario=<id>` in the URL) loads site, area, tolerance, metric and
exaggeration. The numbers quoted in the texts are checked against the model in
`tests/scenarios.test.mjs`. The scenarios are the same as in the table above: Rio de Janeiro (near the
k = 1 line, negligible), Nairobi (altitude offsets the scale factor, tolerable), 1:1000 mapping (the
same error, tolerable for a coarser purpose), and the critical ones: the Pato Branco default, Porto
Alegre on the central meridian, El Alto at 4100 m, Manaus on the zone 20/21 boundary, the Federal
District crossing a zone boundary, Pato Branco forced into zone 21, a 100 km corridor, and Kathmandu's
steep geoid.

### How to use
Serve the repository root with `python3 -m http.server 8000` and open
`http://localhost:8000/distorcao_utm/?lang=en`. No installation or CDN is needed.

Parameters (besides the scenarios): centre latitude/longitude, ellipsoidal height (default 1000 m), W–E and S–N spans
(100 m to 100 km), n × n building grid and size range (with shuffle), point density of
walls/roofs and of the terrain, UTM zone (automatic or a neighbour), geoid, displayed metric,
colour scale, exaggeration, point size and the true outline of the cubes.

Metrics (all components of the systematic error): **local scale error** in ppm (= mm/km; default),
**horizontal position error**, **vertical position error** (flattened curvature + geoid), **geoid effect
on height** −(N − N₀) and **3D position error**. Position errors are measured against the ENU cloud rotated by the
meridian convergence and translated to the centre, so the rigid motion is not counted as
distortion.

### Performance and point budget
The whole computation (ECEF generation, ECEF → geodetic, UTM, geoid, metrics and 2D map) runs in
a Web Worker and the typed arrays are transferred to the page. The exaggeration is applied in the
shader, with no recomputation. `node distorcao_utm/tests/bench.mjs` measured, on a 4-core
container (Node 22), the timings in the table above (≈ 0.7 µs per point). The budget is therefore
**2 million points** (1 million on touch screens or with `deviceMemory ≤ 4`). Above it the terrain
density is reduced first, then the building density; the UI shows the effective densities. In the
browser test, the 2 M-point scene took ~1.9 s in the worker and the longest main-thread task was
~140 ms.

### Geoid data
`data/egm2008-5/` holds 648 tiles of 10° × 10° (7.5 MB in total) of GeographicLib's 5′ EGM2008
grid. Only the tiles of the area are fetched, and only when the geoid is on. The tiles are built by
`scripts/build_geoid_tiles.py` (see `data/README.md`).

### Tests
Commands as above. Unit tests compare UTM with PROJ (pyproj: E/N < 1 mm, k < 1e-9, γ < 1e-7°),
the geoid with GeographicLib's cubic interpolation (pygeodesy, < 3 cm) and with the grid nodes,
and the geodetic conversion with `network_preanalysis/network/coordinates.mjs`. They also check
the geometric invariants (exact cubes in ENU, UTM edges scaled by k·ρ/(ρ+h), heights preserved),
the point budget, determinism and translations. The browser test covers the worker, WebGL,
metrics, exaggeration, on-demand geoid, languages, point budget, portal round trip and phone
layout. The oracles are generated by `tests/generate_pyproj_fixture.py` and
`tests/generate_geoid_fixture.py`.

## Files / Arquivos
| File | Role / Função |
|---|---|
| `model.mjs` | ECEF ↔ geodetic, UTM (Krüger n⁶), scene, budget, metrics, 2D grid / geodésia, cena, métricas |
| `scenarios.mjs` | Ready-made scenarios with bilingual explanations / cenários prontos com explicações |
| `systematic.mjs` | Systematic-error assessment against a tolerance / avaliação do erro sistemático |
| `geoid.mjs` | EGM2008 tiles: decode, mosaic, bicubic sampling, loader / tiles do geoide |
| `worker.mjs` | Web Worker running `simulate()` / executa o cálculo fora da thread principal |
| `viewer.mjs` | Split Three.js view, shared camera, exaggeration shader / vistas 3D |
| `chart.mjs` | 2D distortion map and colour bars / mapa 2D e barras de cores |
| `colors.mjs` | OKLab colour scales (diverging/sequential) / escalas de cores |
| `app.mjs`, `i18n.mjs`, `index.html`, `style.css` | UI and PT-BR/EN texts / interface e textos |

Three.js r160 is reused from `camera_proj/vendor/`. / O Three.js r160 é reutilizado de `camera_proj/vendor/`.

## References / Referências
- Karney, C. F. F. (2011). Transverse Mercator with an accuracy of a few nanometers. *Journal of Geodesy* 85(8), 475–485.
- Pavlis, N. K. et al. (2012). The development and evaluation of the Earth Gravitational Model 2008 (EGM2008). *JGR* 117, B04406.
- GeographicLib geoid grids: <https://geographiclib.sourceforge.io/C++/doc/geoid.html>.
