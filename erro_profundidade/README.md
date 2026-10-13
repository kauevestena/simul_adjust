# Simulador de Erro em Profundidade / Depth Error Simulator

## Português
Sirva a raiz do repositório com `python -m http.server 8000` e abra
`http://localhost:8000/erro_profundidade/?lang=pt-BR`. Não requer instalação ou CDN.
Seis sliders controlam Z, base, focal, largura do sensor, largura da imagem e σ por
imagem. O exemplo inicial usa 10 m, 2 m, 24 mm, 36 mm, 6000 px e 5 px.
Compare eixos paralelos e convergentes, observe os raios em escala e exporte a
curva em passos de 0,5 m. A escala vertical do gráfico é logarítmica.
O alvo é simétrico: C1=(-B/2,0,0), C2=(B/2,0,0), P=(0,0,Z). Z não é a distância
inclinada de cada câmera ao alvo. Poses e calibração são exatas. Erros por imagem
são independentes, com o mesmo desvio-padrão. Resultado: propagação de primeira
ordem em profundidade, não erro máximo nem incerteza 3D total. Configurações
paralelas fora do sensor são omitidas do gráfico e recebem campo vazio no CSV.
Os números do CSV usam ponto decimal, delimitador ponto e vírgula e cabeçalhos
no idioma atual; inclui parâmetros para reprodução. As fórmulas estão na interface.

## English
Serve the repository root with `python -m http.server 8000` and open
`http://localhost:8000/erro_profundidade/?lang=en`. No installation or CDN required.
Six sliders control Z, baseline, focal length, sensor width, image width and
per-image σ. Defaults are 10 m, 2 m, 24 mm, 36 mm, 6000 px and 5 px.
Compare parallel and convergent axes, inspect true-scale rays and export samples
at 0.5 m intervals. The chart uses a logarithmic vertical scale.
The target is symmetric: C1=(-B/2,0,0), C2=(B/2,0,0), P=(0,0,Z). Z is not the
slant distance from each camera to the target. Poses and calibration are exact;
image errors are independent with equal standard deviations. Results are
first-order depth standard deviations, not maximum errors or total 3D uncertainty.
Off-sensor parallel configurations are omitted from the chart and left blank in
CSV. CSV uses decimal points, semicolons and localized headers; parameters are
included for reproducibility. Formulas and assumptions are shown in the UI.

## Model / Modelo
`fpx = f*N/W`

`σZ_parallel = sqrt(2)*σpx*Z²/(fpx*B)`

`σZ_convergent = sqrt(2)*σpx*(Z²+B²/4)/(fpx*B)`

Differentiate the intersection `Z = B/(tan(aL)-tan(aR))` with respect to
independent image coordinates. For convergence, nominal ray angles are ±atan(B/2Z),
with pixel-to-angle derivative 1/fpx at the principal point. For parallel axes,
nominal coordinates are ±fpx*B/(2Z), giving the extra cosine-squared factor.

Referência / Reference: [Ames Stereo Pipeline error propagation](https://stereopipeline.readthedocs.io/en/stable/error_propagation.html).

## Tests / Testes
`node --test erro_profundidade/tests/model.test.mjs`

Numerical ray-intersection derivatives verify both formulas across baselines;
additional checks cover scaling, sensor visibility, invalid inputs and i18n.

Browser / Navegador (reuse the monorepo's pinned Playwright / reutiliza Playwright fixado):

```sh
npm ci --prefix camera_proj
npx --prefix camera_proj playwright install chromium
NODE_PATH=./camera_proj/node_modules node erro_profundidade/tests/browser.cjs
```

Checks / Verifica: sliders, numeric fields, reset, off-sensor warning, language
switching, CSV download, portal navigation and mobile overflow.
