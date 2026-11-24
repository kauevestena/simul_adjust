# RBMC stations / Estações da RBMC

English · Português abaixo

`rbmc-stations.json` (snapshot `rbmc-sirgas-ngl-2026-11-24`) lists **141 RBMC stations** for the
pre-analysis map: 117 active, 22 inactive and 2 whose status this snapshot did not verify. Stations
marked *removed* are left out. It is built by `../scripts/build_cors.py` (Python standard library)
from three inputs kept in `sources/`:

1. **Membership and status** – the SIRGAS station list
   (<https://www.sirgas.org/en/stations/station-list>), every row whose ID ends in `BRA`, transcribed on
   2026-11-24 into `sources/sirgas-station-list-BRA-2026-11-24.txt` (188 rows: 119 active, 24 inactive,
   45 removed). The page shows network and agency in one cell; the script splits them by the known
   network names (`RMBC` on the page is read as `RBMC`). IBGE's own servers could not be reached when
   the snapshot was made, so the IBGE list was not used.
2. **Approximate coordinates** – Nevada Geodetic Laboratory positions as distributed in
   `gnssrefl/station_pos_2024.db` (commit `f3f5e14f79ddbf5a9f6eb986d83a48a77e47857e` of
   <https://github.com/kristinemlarson/gnssrefl>; SHA-256 in the JSON metadata). The database is not
   copied here. Cite Blewitt, Hammond & Kreemer (2018), *Eos* 99, doi:10.1029/2018EO104623.
3. **Supplementary coordinates** (`sources/supplementary-coordinates.csv`) – for stations whose
   four-character ID is missing from NGL or belongs there to an unrelated station abroad. CORU, CRAT,
   MSGR and MTGA use the *approximate position* of their SIRGAS/IBGE site logs (about 0.3 m); MSPP uses
   the official SIRGAS2000 (epoch 2000.4) coordinates of its IBGE station report. PRPI (Pinhais) and
   STHA (Santa Helena, at UTFPR) are RBMC stations absent from the SIRGAS list; they come from their IBGE
   reports with status `unverified`.

**Checks.** Four-character IDs are not unique worldwide: in NGL, CORU, CRAT, MSGR, MSMN, MSPP, MTGA,
SCBL and SCCR are other stations (Turkey, the United States, Australia…). Every NGL match must
therefore fall inside the bounding box (±0.5°) of the station's Brazilian state, from the ID prefix or
an explicit table in the script; matches outside are rejected. Excluded for lack of a reliable
coordinate: MSMN and RJRE (inactive), SCBL and SCCR (active). NGL positions were compared with official
IBGE SIRGAS2000 values (`sources/official-check-coordinates.csv`):

| Station | ΔN | ΔE | Δh |
|---|---|---|---|
| POLI | 0.124 m | −0.021 m | 0.079 m |
| SPC1 | 0.196 m | −0.058 m | −0.006 m |
| SCFL | 0.170 m | −0.048 m | −0.054 m |

Decimetre differences of this kind are expected between a recent ITRF-aligned position and
SIRGAS2000 at epoch 2000.4 (plate motion). They are irrelevant for designing a network, but these are
**not official coordinates**: compute with the IBGE station reports. The JSON metadata records the
SHA-256 of every input and of the canonical station list; the Node tests verify them.

```sh
python gnss_preanalysis/scripts/build_cors.py --ngl /path/to/station_pos_2024.db
# or, from NGL directly: --ngl llh.out --ngl-label "NGL llh.out, retrieved YYYY-MM-DD"
```

A refreshed list must use a new snapshot ID. IBGE asks users of RBMC data to cite IBGE as its
provider; station metadata © IBGE / SIRGAS, approximate positions © NGL.

---

`rbmc-stations.json` (retrato `rbmc-sirgas-ngl-2026-11-24`) traz **141 estações da RBMC** para o mapa
de pré-análise: 117 ativas, 22 inativas e 2 cuja situação não foi verificada. Estações *removidas*
ficam de fora. É gerado por `../scripts/build_cors.py` (só a biblioteca padrão do Python) a partir de
três entradas em `sources/`:

1. **Pertinência e situação** – a lista de estações do SIRGAS, todas as linhas com ID terminado em
   `BRA`, transcritas em 2026-11-24 (188 linhas: 119 ativas, 24 inativas, 45 removidas). A página junta
   rede e instituição numa célula; o script as separa pelos nomes de rede conhecidos (`RMBC` é lido como
   `RBMC`). Os servidores do IBGE não estavam acessíveis na data, por isso a lista do IBGE não foi usada.
2. **Coordenadas aproximadas** – posições do Nevada Geodetic Laboratory distribuídas em
   `gnssrefl/station_pos_2024.db` (commit indicado acima; SHA-256 nos metadados). O banco não é copiado.
3. **Coordenadas suplementares** – para estações cujo ID de quatro caracteres falta no NGL ou pertence,
   lá, a outra estação no exterior: CORU, CRAT, MSGR e MTGA usam a posição aproximada dos *site logs*
   SIRGAS/IBGE (cerca de 0,3 m); MSPP usa as coordenadas oficiais SIRGAS2000 (época 2000,4) do descritivo
   do IBGE. PRPI (Pinhais) e STHA (Santa Helena, na UTFPR) são estações da RBMC ausentes da lista do
   SIRGAS; vêm dos descritivos do IBGE, com situação `unverified`.

**Verificações.** IDs de quatro caracteres não são únicos no mundo: no NGL, CORU, CRAT, MSGR, MSMN,
MSPP, MTGA, SCBL e SCCR são outras estações. Por isso toda correspondência do NGL precisa cair na caixa
envolvente (±0,5°) do estado da estação; as de fora são rejeitadas. Ficaram de fora, sem coordenada
confiável: MSMN e RJRE (inativas), SCBL e SCCR (ativas). A tabela acima compara o NGL com coordenadas
oficiais do IBGE: diferenças de decímetros, esperadas entre uma posição ITRF recente e o SIRGAS2000 na
época 2000,4 (movimento da placa). Não afetam o projeto de uma rede, mas **não são coordenadas
oficiais**: para calcular, use os descritivos do IBGE. Uma lista atualizada deve receber novo ID.
O IBGE pede que usuários dos dados da RBMC citem o IBGE como fornecedor.
