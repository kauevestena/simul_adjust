# Beneath the Channel / Sob o Canal da Mancha

## English
A fully client-side bilingual (PT-BR / EN) geodesy scrollytelling story for the `simul_adjust` monorepo. Open `channel_tunnel_story/` through GitHub Pages or a static local server. The map uses MapLibre GL JS, OpenFreeMap and third-party Terrarium DEM tiles. Internet connectivity is required for map tiles and CDN assets; the narrative and bearing-error model degrade gracefully without the map.

Seven chapters cover the challenge, the shared geodetic grid and 1987 GPS campaigns, geological investigations, underground traverses and gyro-theodolites, excavation, the 1 December 1990 breakthrough, and operational inspection/monitoring. Historical claims are linked to sources at the end of the page. The horizontal breakthrough difference (358 mm) and vertical difference (58 mm) are cited as *reported* values, not a derivation of the simplified model.

### Scientific caveats
- Portal positions are approximate. The orange line is a **straight schematic chord**, not the as-built three-tunnel axis. The surface DEM does not reconstruct subsea bathymetry, bore depth or underground geology.
- Terrain exaggeration (1.6×) is purely for visual comprehension.
- The independent sensitivity lab evaluates `d = L tan(Δα)` with distance in metres and bearing error in arcseconds. It is **not** an adjusted 3D traverse, not a measurement reconstruction and cannot reproduce the actual breakthrough difference.
- The text about ongoing inspection/monitoring does not claim access to observed deformation time series. Cite and verify any future numeric deformation data before publication.

### Local tests
```sh
node --test channel_tunnel_story/tests/model.test.mjs
python -m http.server 8000
# open http://localhost:8000/channel_tunnel_story/?lang=en
```

## Português
Uma narrativa interativa bilíngue (PT-BR / EN) que funciona inteiramente no navegador e integra o monorepositório `simul_adjust`. Hospede `channel_tunnel_story/` no GitHub Pages ou em servidor estático local. Mapa com MapLibre GL JS, OpenFreeMap e elevação Terrarium externa. A narrativa e o experimento continuam acessíveis caso o mapa não carregue.

Sete capítulos abordam o desafio, a rede de referência conjunta e as campanhas GPS de 1987, estudos geológicos, poligonais subterrâneas e giroteodolitos, execução, encontro de 1º de dezembro de 1990 e monitoramento operacional. O desencontro divulgado (358 mm horizontal e 58 mm vertical) é um valor **relatado** na literatura, não um cálculo proveniente do simulador.

### Limitações científicas
- Os portais são aproximados; a linha laranja é uma **corda esquemática**, não o traçado real das três galerias. O modelo de terreno mostra superfície, não a batimetria ou profundidade dos túneis.
- Exagero do relevo (1,6×) com fim visual.
- O exercício avalia apenas `d = L tan(Δα)`, com comprimento em metros e direção em segundos de arco. Não representa poligonal ajustada nem as observações originais.
- Não são exibidas séries reais de deformações. Novos valores quantitativos exigem fontes verificáveis.

### Testes
```sh
node --test channel_tunnel_story/tests/model.test.mjs
python -m http.server 8000
# acesse http://localhost:8000/channel_tunnel_story/?lang=pt
```
