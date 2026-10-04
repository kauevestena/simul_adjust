# Pato Branco streets / Ruas de Pato Branco

English · Português abaixo

`pato-branco-streets.geojson` is an unmodified-coordinate OpenStreetMap street
extract for the Level 2 exercise. Data © OpenStreetMap contributors, licensed
under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
[Copyright and attribution](https://www.openstreetmap.org/copyright).
The data license is separate from the application code license.

- Source: [OSM API map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-52.68,-26.237,-52.662,-26.222).
- Retrieved: **2026-10-04T13:52:30.345759+00:00**.
- Coordinate order: WGS84 longitude, latitude (degrees).
- 288 ways; OSM way IDs, versions, timestamps and node IDs are retained.
- Included `highway` values: primary, secondary, tertiary, residential,
  unclassified, living_street, pedestrian and the three corresponding link types.
  Areas (`area=yes`), service drives, footways and steps are excluded.
- The API returns complete ways crossing the query rectangle. Runtime code
  projects them at the ENU origin's reference ellipsoidal height, then clips
  individual segments to the 1300 × 1300 m exercise bounds. No geometry is invented
  or simplified; no node heights are inferred from OSM.
- Source XML SHA-256 and canonical feature SHA-256 are recorded in `metadata`.
  The numerical suite verifies the feature checksum, provenance and projection.
- Snapshot ID: `pato-branco-streets-v1`. Saved networks refer to that immutable
  snapshot. A future geometry replacement must use a new ID and an explicit
  migration decision for saved networks.

The 3 m distance is measured to the mapped **centerline**, not a curb/road edge.
OSM positional accuracy is not asserted to be 3 m. The dataset and DEM do not
model buildings or the elevation of bridge decks/tunnels. Access tags are
preserved when present, but the exercise does not establish permission to survey.

To reproduce conversion from the downloaded XML (Python standard library only):

```sh
python network_preanalysis/scripts/build_streets.py \
  /tmp/pato-branco.osm /tmp/pato-branco-streets.geojson \
  --retrieved-at 2026-10-04T13:52:30.345759+00:00
```

The source URL is in the file metadata and converter. A new download reflects
OSM edits since this snapshot, so it need not have the same source/content hash.
Runtime uses only the included GeoJSON; no Overpass or OSM API call is needed.

## Português

`pato-branco-streets.geojson` contém um recorte de ruas OpenStreetMap, sem alterar
as coordenadas, para o nível 2. Dados © colaboradores do OpenStreetMap, sob
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
[Direitos e atribuição](https://www.openstreetmap.org/copyright/pt-BR).
A licença dos dados é separada da licença do código da aplicação.

A fonte é a API OSM no retângulo indicado acima, obtida em
**2026-10-04T13:52:30.345759+00:00**. A ordem é longitude/latitude WGS84 em graus.
As 288 vias preservam IDs, versões, datas OSM e IDs dos nós. Incluem-se vias
primary, secondary, tertiary, residential, unclassified, living_street,
pedestrian e os três tipos link correspondentes. Excluem-se áreas (`area=yes`),
acessos de serviço, caminhos de pedestres e escadas.

A API fornece vias completas que cruzam o retângulo. Durante o uso, cada segmento
é projetado na altura elipsoidal de referência da origem ENU e recortado na área
de 1300 × 1300 m. A geometria não é inventada nem simplificada; não se atribuem
alturas OSM aos nós. Os hashes SHA-256 do XML original e das feições canônicas
estão em `metadata`. A suíte verifica integridade, procedência e projeção.

O ID `pato-branco-streets-v1` identifica um recorte imutável nos arquivos salvos.
Uma substituição futura exige novo ID e decisão explícita sobre migração. A
regra de 3 m mede distância ao **eixo**, não ao meio-fio ou bordo da rua, e não
atesta precisão OSM de 3 m. Não há modelo de edifícios, tabuleiros de pontes ou
túneis. As etiquetas de acesso existentes são preservadas, mas não estabelecem
permissão para levantamento.

O comando acima reproduz a conversão do XML com a biblioteca padrão do Python.
Uma nova consulta pode conter edições posteriores do OSM e ter hashes diferentes.
O cenário usa somente o GeoJSON incluído; não consulta Overpass nem a API OSM.
