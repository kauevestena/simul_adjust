# Dados do geoide / Geoid data

## Português
`egm2008-5/` contém a ondulação geoidal do **EGM2008** (NGA, domínio público) na grade de 5′
empacotada pelo **GeographicLib** (`egm2008-5.pgm`, C. F. F. Karney; arquivo
`egm2008-5.tar.bz2`, SHA-256 `9a57c143…0852970`, registrado em `egm2008-5/index.json`).

- 648 tiles de 10° × 10° (`rRRcCC.bin`; linha 0 = 90°N, coluna 0 = 180°W), 7,5 MB no total.
- Cada tile tem 123 × 123 nós: a célula de 120 × 120 mais 1 nó de margem antes e 2 depois,
  o suficiente para a interpolação bicúbica sem consultar tiles vizinhos.
- Valores em uint16 com N = −108 + 0,003·v (quantização de 3 mm, a mesma da grade original),
  codificados por um preditor planar (resíduos int16 little-endian) e comprimidos com gzip.
- O navegador baixa só os tiles da área, e apenas quando o geoide é ligado.

Para regenerar: `python3 distorcao_utm/scripts/build_geoid_tiles.py` (baixa o arquivo do
SourceForge) ou `--tarball caminho/egm2008-5.tar.bz2`. O script também grava
`tests/geoid-node-fixture.json`. O oráculo independente `tests/geoid-cubic-reference.json` vem de
`tests/generate_geoid_fixture.py` (pygeodesy).

Erros da grade de 5′ em relação ao modelo completo, segundo o cabeçalho do GeographicLib:
interpolação cúbica com máximo de 0,294 m e RMS de 0,005 m.

## English
`egm2008-5/` holds the **EGM2008** geoid undulation (NGA, public domain) on the 5′ grid packaged by
**GeographicLib** (`egm2008-5.pgm`, C. F. F. Karney; archive `egm2008-5.tar.bz2`, SHA-256 recorded
in `egm2008-5/index.json`).

- 648 tiles of 10° × 10° (`rRRcCC.bin`; row 0 = 90°N, column 0 = 180°W), 7.5 MB in total.
- Each tile has 123 × 123 nodes: the 120 × 120 cell plus 1 margin node before and 2 after, enough
  for bicubic interpolation without reading neighbouring tiles.
- uint16 values with N = −108 + 0.003·v (3 mm quantum, as in the original grid), coded with a
  planar predictor (int16 little-endian residuals) and gzipped.
- The browser fetches only the tiles of the area, and only when the geoid is on.

To rebuild: `python3 distorcao_utm/scripts/build_geoid_tiles.py` (downloads the archive from
SourceForge) or `--tarball path/egm2008-5.tar.bz2`. The script also writes
`tests/geoid-node-fixture.json`. The independent oracle `tests/geoid-cubic-reference.json` comes
from `tests/generate_geoid_fixture.py` (pygeodesy).

Errors of the 5′ grid against the full model, from GeographicLib's header: cubic interpolation with
a 0.294 m maximum and 0.005 m RMS.
