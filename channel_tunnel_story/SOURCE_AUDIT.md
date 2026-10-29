# Historical source audit / Auditoria das fontes históricas

Reviewed 2026-10-27 (São Paulo). / Revisado em 27/10/2026.

## English

Numbers correspond to the story's bibliography. Evidence scope is explicit: a bibliographic abstract verifies only what it says, not the inaccessible full paper. The teaching data are independent of these historical sources.

| Claim | Evidence inspected | Decision |
| --- | --- | --- |
| Three bores; 50.45 km total and 37.9 km undersea | [1] ICE project page, introductory section; [8] Geological Society, project description | Retain ICE's lengths with its citation. Other institutional pages round to 50.5 and 38 km. |
| Project grid commissioned in 1986; IGN's independent full-network computation; GPS in 1987 | [2] Calvert, *Survey Review* 30(231), 1989, pp. 3–14, DOI `10.1179/sre.1989.30.231.3`: publisher abstract | Retain only the roles and dates supported by the abstract. Its 2013 online date is not the original publication year. No claimed datum transformation, covariance or reconstruction of campaign observations. |
| 1,500 km of seismic profiles; 50,000 geophysical points | [3] BRGM institutional history, 1986 entry | Retain, attributed to BRGM; these are geological-investigation inputs, not a count of geodetic control stations. |
| Gyroscopic directions, optical traverses and lateral refraction | [9] N. Korittke, IWAA 1990, pp. 315–331; full paper, especially §3, pp. 324–329 and tables 1–2 | Replaced the indirect citations with this original paper. It compares optical and gyro-supported adjustments and discusses wall/centreline campaigns. GPS is not described as operating underground. |
| Start dates and eleven TBMs | [7] Operator timeline; [9] pp. 321–323; [1] construction section | UK December 1987; France February 1988. Six UK and five French machines. ICE's broad “1988” wording does not replace the operator's two dates. Animated machines are representative only. |
| Breakthrough date and offsets | [4] Korittke, *Felsbau* 9(1), 1991, pp. 48–49, TRID abstract; [1] ICE section on first probe connection | Keep accounts separate: [4] dates the service-tunnel breakthrough to 1 December and reports transverse 361, longitudinal 69, vertical 58 mm; [1] gives horizontal 358 and vertical 58 mm in an October probe-connection account. No averaging, component conflation, invented reconciliation, or conversion into an observation SD. |
| Geological setting | [8] Geological Society, “Undersea Section”; [9] pp. 320–321, fig. 4 | Supports the lithological context. It does not license treating the app's invented mesh as a measured geological model. Linked enlarged Geological Society figures returned 404 during the audit; no figure was copied or silently digitised. |
| Construction monitoring | [5] Warren & Varley (1992), TRID abstract | Supports probing and geological observations. It is not evidence for a modern deformation feed. |
| Operational lining monitoring | [6] CIRIA C671 (2009), case study 13, pp. 340–345; full text, §§13.4–13.6 | Supports the historical inspection/instrumentation strategy, including optical convergence and levelling markers. Does not establish present operating practice or actual displacement time series. |
| Official opening | [7] Operator, opening section | Retain 6 May 1994; distinguish official opening from later service milestones. |

### Access and reproducibility

- [1] https://www.ice.org.uk/what-is-civil-engineering/infrastructure-projects/the-channel-tunnel
- [2] https://www.tandfonline.com/doi/abs/10.1179/sre.1989.30.231.3 — indexed publisher abstract accessible; direct publisher requests returned 403. Full article not inspected.
- [3] https://histoire.brgm.fr/en/instants/1986-brgm-and-channel-tunnel
- [4] https://trid.trb.org/View/1011750 — abstract inspected; original German article not obtained.
- [5] https://trid.trb.org/View/375986 — abstract inspected; full article not obtained.
- [6] https://www.apmgs.ro/files/documente/CIRIA_report_C671_Tunnells_inspection_as1.pdf?download=1 — full PDF inspected. Initial unqualified download was malformed; the query variant was a valid PDF.
- [7] https://www.leshuttle.com/uk-en/discover/why-choose-leshuttle/build/the-channel-tunnel
- [8] https://www.geolsoc.org.uk/science-and-policy/100-great-geosites/industrial-and-economic-importance/channel-tunnel/
- [9] https://www.slac.stanford.edu/econf/C9009106/papers/023.PDF — full PDF downloaded and relevant pages rendered/inspected.

SHA-256 of inspected PDFs (not redistributed):

```text
[6] 7eeafedf691f1b10121e44db5330e21a17dc1ebf9df98390c8196f7b00c20648
[9] 5337080811545d700bffcbf7a28b2e1a2128bf897f7bde6c21d56021fceb329b
```

Remaining research work: obtain the original breakthrough publication and underlying engineering data before resolving the offset discrepancy or reconstructing the surveyed network, geology and alignment. These are disclosed scientific limits, not values to fill with invented historical observations.

## Português

A numeração corresponde às fontes da página. A tabela distingue texto completo, resumo e fonte institucional. Calvert confirma a grade comum e os papéis de OS, IGN e Nortech; o artigo original é de 1989, embora publicado online em 2013. Não se reproduzem observações da campanha.

O artigo original de Korittke (1990) sustenta a explicação de poligonais, direções giroscópicas e refração. Os relatos do encontro permanecem separados: 361 mm transversais, 69 mm longitudinais e 58 mm verticais no resumo de 1991; 358 mm horizontais e 58 mm verticais na narrativa de sondagem da ICE. Não há base aqui para reconciliar datas/componentes ou interpretar desencontro como desvio-padrão.

O CIRIA foi consultado integralmente no estudo de caso 13, pp. 340–345. A descrição de monitoramento é histórica, sem afirmar acesso a medições operacionais atuais. O corte 3D, a poligonal ajustada e as épocas de monitoramento são didáticos e explicitamente sintéticos. Os links, escopos de acesso e checksums acima permitem refazer a verificação. Uma reconstrução georreferenciada exige dados de engenharia e licença adequados.
