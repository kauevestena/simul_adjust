# SGB: rede altimétrica / vertical network

Revisão de fontes primárias / Primary-source review: **2026-10-21**.

Aplica-se a sgb_altimetria.tex, à edição inglesa que a inclui e ao script de cálculos. Preserva as quatro aulas de 50 minutos e os exemplos progressivos.
Applies to sgb_altimetria.tex, its English wrapper and the calculation script. Preserves the four 50-minute classes and progressive worked examples.

## Referências / References

As páginas abaixo são as impressas no documento; a página PDF é indicada quando difere.
Page references use printed page numbers; PDF page numbers are supplied where they differ.

1. **IBGE (1983).** *Especificações e Normas Gerais para Levantamentos Geodésicos em Território Brasileiro*. R.PR nº 22, 21/07/1983. [PDF oficial / official PDF](https://geoftp.ibge.gov.br/metodos_e_outros_documentos_de_referencia/normas/legisla_resolucao_d.pdf). **Quadro / Table VI, p. 30 (PDF 26)**, coluna alta precisão fundamental / fundamental high-precision column, itens / items 1.1, 3.1–3.3, 4. Contexto / context: pp. 28–29.
2. **IBGE (2011).** *Ajustamento Simultâneo da Rede Altimétrica de Alta Precisão do Sistema Geodésico Brasileiro: relatório*. [PDF oficial / official PDF](https://geoftp.ibge.gov.br/metodos_e_outros_documentos_de_referencia/outros_documentos_tecnicos/apresentacoes_artigos/relatorioajustamento.pdf). **p. 2**: 69 590 RRNN / benchmarks and >74 000 observations; **p. 8 (PDF 6)**: origins, Torres/Imbituba and Santana; **pp. 10–12**: eight adjustments, macro-loops, AAGP.
3. **IBGE (2019).** *Reajustamento da Rede Altimétrica com Números Geopotenciais*. **2ª edição / 2nd edition**, Rio de Janeiro, 56 p. ISBN 978-85-240-4502-8. [PDF oficial / official PDF](https://biblioteca.ibge.gov.br/visualizacao/livros/liv101666.pdf). First edition / primeira edição: 2018. **p. 13 (PDF 15)**: vertical datums; **pp. 29–32**: gravity interpolation; **p. 35 (PDF 37)**: principal-block quality table; **p. 36 (PDF 38), Fig. 16**: residual frequencies; **pp. 40–44**: individual lines and Amapá.
4. **Siqueira, J.; Lima, M.; Luz, R. (2018).** *Reajustamento da Rede Altimétrica Brasileira em Números Geopotenciais*. Simposio SIRGAS2018, Boletín 23. [Apresentação oficial / official presentation](https://sirgas.ipgh.org/docs/Boletines/Bol23/32_Siqueira_et_al_2018_Repro_red_vertical_Brasil.pdf). Slides **3–4, 9, 20–21, 31–36**: adjustment datums, measured/interpolated gravity and results.
5. **SIRGAS, Working Group III (Vertical datum).** [Página oficial / official page](https://sirgas.ipgh.org/en/organization/working-groups/working-group-iii/). Established at the **IAG Scientific Assembly, Rio de Janeiro, 1997**. The vertical definition follows the IHRS; realization is a regional IHRF densification with a common potential and reference epoch.
6. **Martínez, W.; Mackern, M. V.; Cioce, V.; Pérez Rodino, R.; de Freitas, S. R. C. (2019).** *SIRGAS: The Geocentric Reference System for the Americas*. Implementation of the GGRF in Latin America, 16–20 September 2019. [Apresentação SIRGAS / SIRGAS presentation](https://sirgas.ipgh.org/docs/Boletines/GGRF%20WORKSHOP_sep_2019_Mackern-Martinez-SIRGAS_v3.pdf), slide **15**: WG III consolidation at Cartagena in 2001; SIRGAS2000 tide-gauge and border stations.
7. **IBGE (2024).** *Rede Maregráfica Permanente para Geodésia: Nota técnica 01/2024. Novas formas de apresentação dos dados de nível do mar e meteorológicos das estações maregráficas*. [PDF oficial / official PDF](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102140.pdf), p. 1. Confirma seis estações e administração pelo IBGE desde 2001 / Confirms six stations and IBGE administration since 2001: Imbituba, Arraial do Cabo, Salvador, Fortaleza, Belém and Santana.
8. **IBGE, Rede Altimétrica.** [Página oficial / official page](https://www.ibge.gov.br/geociencias/informacoes-sobre-posicionamento-geodesico/rede-geodesica/16283-rede-altimetrica.html), seção sobre REALT-2018 / REALT-2018 section. Corroborates the residual percentages in reference 3, Figure 16.

## Critérios de qualidade / Quality criteria

K é a distância em quilômetros, contada uma vez. O retorno não duplica K.
K is the length in kilometres, counted once; the return run does not double K.

| Grandeza / Quantity | Alta precisão fundamental / Fundamental high precision | Evidência / Evidence |
|---|---|---|
| Discrepância ida/volta da seção / Section forward/backward discrepancy | 3√K mm | IBGE 1983, VI.3.1 |
| Discrepância ida/volta da linha / Line forward/backward discrepancy | 4√K mm | IBGE 1983, VI.3.2 |
| Discrepância acumulada por perímetro do circuito / Accumulated circuit discrepancy per perimeter | 0.5 mm/km; limite absoluto / absolute limit: 0.5K mm | IBGE 1983, VI.3.3, com correções / after corrections |
| Erro-padrão máximo da linha após ajuste / Maximum adjusted-line standard error | 2√K mm | IBGE 1983, VI.4 |
| Ruído de uma observação / Observation noise | η√K, η especificado ou estimado / selected or estimated | Modelo estocástico do exemplo / example stochastic model |
| Frequências de resíduos do REALT-2018 / REALT-2018 residual frequencies | 92.7%, 98.0%, 99.1%, 99.5% nos intervalos / within ±1, ±2, ±3, ±4√K mm | IBGE 2019, p. 36, Fig. 16; resultados empíricos / empirical results |

**Detalhe da própria norma:** o texto corrido da p. 29 menciona 3√K para controles seção a seção e acumulados na linha. O Quadro VI discrimina explicitamente **3√K para seção** e **4√K para linha**. As aulas identificam e seguem os itens específicos do Quadro VI. Não se converte o valor 2 em 3 por fator estatístico.

**Detail within the standard itself:** the prose on p. 29 mentions 3√K for section and accumulated line checks. Table VI explicitly distinguishes **3√K for a section** and **4√K for a line**. The slides identify and follow those specific table items. The value 2 is not statistically converted into 3.

A normalização de resíduos por distância v/√K (mm/√km) difere de v/σᵥ (adimensional), usado em testes estatísticos. Frequências de resíduos também não são erros-padrão de altitudes.
Distance normalization v/√K (mm/√km) differs from the dimensionless v/σᵥ used in statistical tests. Residual frequencies are also distinct from height standard errors.

## Correções e alcance / Corrections and scope

| Assunto / Subject | Resultado / Result |
|---|---|
| Seções ilustrativas / Example sections | 3.2 km → **2.8 km**, discrepância / discrepancy 4 mm, limite / limit **5.0 mm**. Exercício / exercise 5 km → **2 km**, discrepancy 8 mm > **4.2 mm**. Ambas respeitam o máximo de seção de 3 km / Both respect the 3-km section maximum. |
| Circuito de 39 km / 39-km circuit | Fechamento / misclosure **+6.0 mm**; limite corrigido / corrected limit **19.5 mm**; razão / ratio **0.154 mm/km**. |
| Circuito de 100 km / 100-km circuit | Controle / check **50 mm**, no lugar do uso indevido do limite de seção de 30 mm / replacing the misapplied 30-mm section rule. Correções físicas precedem a classificação / Physical corrections precede classification. |
| Comparação com altitudes publicadas / Comparison with published heights | Diferença corrigida 7.759 − 7.755 m = **4 mm**. Com incertezas ilustrativas 3/4/4 mm e covariância 8 mm², a incerteza combinada é **5 mm** e a razão **0.8**. Não se aplica a tolerância de ida/volta a essa comparação / Corrected difference **4 mm**, combined uncertainty **5 mm**, ratio **0.8**; the forward/backward tolerance does not apply to this comparison. |
| Resultados do REALT / REALT results | Percentuais atribuídos ao bloco principal de **2018**, documentados na edição de **2019**. Eliminada a conta 0.5% × 74 000 (dados de 2011) / Percentages attributed to the **2018** principal block in the **2019** edition; removed the mixed-year 0.5% × 74,000 calculation. |
| Contagens / Counts | **66 882** altitudes, **70 426** seções e **62 782** resíduos em seções formando circuitos / heights, sections and residuals in circuit-forming sections. São conjuntos do bloco principal / These describe the principal block. |
| Total nacional / National total | Não inferido dessa tabela; linhas excluídas do bloco principal e o Amapá recebem tratamentos próprios / Not inferred from this table; lines excluded from the principal block and Amapá have separate treatments. Removido o uso de 71 475 como total atual / Removed 71,475 as a current total. |
| Santana | NMM observado / observed MSL: **1957–1958**; adoção / adoption: **1980** (IBGE 2019, p. 13); implantação das RRNN antigas / old benchmark establishment: **1980–1981** (p. 44). |
| Torres → Imbituba | **1958** segundo IBGE 2011, p. 8; **1959** segundo IBGE 2019, p. 13, vinculada ao terceiro ajustamento / **1958** in IBGE 2011; **1959** in IBGE 2019, linked to the third adjustment. Preservada a divergência entre os documentos, sem inventar uma distinção administrativa / The documentary discrepancy remains explicit without inventing an administrative distinction. |
| AAGP | Trabalho iniciado em / work began in **1988**. Data de referência de cálculo no BDG / BDG calculation reference: **01/12/1992**, **43 079** RRNN (IBGE 2011, pp. 11–12). Isso não é uma data genérica de encerramento de todo trabalho posterior / This is not a generic end date for later work. |
| Oito ajustes / Eight adjustments | Os três primeiros usaram todas as estações; o particionamento começou no quarto / The first three used all stations; partitioning began with the fourth. 2011 representa a retomada, não o primeiro ajuste simultâneo de toda a história / 2011 represents a return, not the first simultaneous adjustment in the entire history. |
| Gravidade / Gravity | Observada **e interpolada**, sem supor medição em cada RN nem interpolação para todas / Observed **and interpolated**, without implying every benchmark had a measurement or every value was interpolated. |
| IHRS/IHRF | A definição do IHRS é de 2015; o IHRF é sua realização. Não se atribui a mesma data à conclusão do frame / The IHRS definition dates to 2015; IHRF is its realization. The same date is not assigned to completion of the frame. |
| Tendência do NMM / MSL trend | A projeção de cerca de 16 cm até 2026 é uma **extrapolação ilustrativa com taxa constante**, não observação atual / The roughly 16-cm projection to 2026 is an **illustrative constant-rate extrapolation**, not a current observation. |
| RMSE | O termo sistemático δK é um viés; η²K+(δK)² representa erro quadrático médio, não apenas variância aleatória / The systematic term δK is bias; η²K+(δK)² represents mean squared error, not random variance alone. |

Os 94% na faixa −15 a +5 mm isolam a inserção da gravidade com dados e geometria mantidos (IBGE 2019, p. 40, Fig. 20). Os cerca de 50 mil marcos/76% na faixa +20 a +30 cm descrevem a comparação completa com as altitudes anteriores (p. 37, Fig. 18).
The 94% within −15 to +5 mm isolate gravity integration with the same data and geometry (IBGE 2019, p. 40, Fig. 20). Approximately 50,000 benchmarks/76% within +20 to +30 cm describe the complete comparison with prior heights (p. 37, Fig. 18).

## Ressalvas mantidas / Retained qualifications

As taxas +2.24 ±0.4 mm/ano e −3.02 mm/ano, a faixa 0.45–1.40 m entre os data e a distância aproximada de 330 km foram herdadas dos estudos citados na versão anterior. Esta revisão **não confirma esses valores como parâmetros oficiais** nem os transforma em correções recomendadas. A bibliografia original desses estudos continua exigindo conferência específica: Da Silva e De Freitas (2017), tese UFPR (2017), Jaramillo, Freitas e Luz (2019), e trabalhos de 2013/2016.

The +2.24 ±0.4 mm/year and −3.02 mm/year rates, the 0.45–1.40 m inter-datum range and approximate 330-km gap were inherited from the studies cited in the prior version. This review **does not certify them as official parameters** or turn them into recommended corrections. Their original bibliography still needs a dedicated check: Da Silva and De Freitas (2017), a UFPR thesis (2017), Jaramillo, Freitas and Luz (2019), and 2013/2016 studies.

Os comprimentos de 230 000 e 370 000 km continuam apenas como exercício de escala, sem atribuição a inventários oficiais. Séries sintéticas e a rede de quatro nós continuam identificadas como exemplos. A rede de quatro nós é um modelo didático, sem alegação de atender a toda a configuração normativa de campo. A estrutura das quatro aulas permanece igual.
The 230,000- and 370,000-km lengths remain only as a scale exercise, without attribution to official inventories. Synthetic series and the four-node network remain labelled as examples. The four-node network is a teaching model, without a claim to satisfy all normative field configurations. The four-class structure is unchanged.

## Reprodução / Reproduction

Na pasta / From sistemas_coordenadas/explanations:

- python3 -m unittest -v test_sgb_altimetria_numeros.py
- python3 sgb_altimetria_numeros.py
- python3 sgb_altimetria_numeros.py --figuras
- latexmk -pdf -interaction=nonstopmode -halt-on-error sgb_altimetria.tex
- latexmk -pdf -interaction=nonstopmode -halt-on-error sgb_altimetria_en.tex

A revisão local usou pdfTeX/TeX Live 2022 e a implementação compatível siunitx v2. A regeneração final no GitHub Actions usa pdfTeX/TeX Live 2023 (Debian), Metropolis, babel-portuges e siunitx da distribuição. Ambos os ambientes compilaram as duas línguas. As dependências adicionais de revisão não são incluídas no repositório.
Local review used pdfTeX/TeX Live 2022 and the compatible siunitx v2 implementation. Final regeneration in GitHub Actions uses pdfTeX/TeX Live 2023 (Debian), Metropolis, babel-portuges and the distribution siunitx package. Both environments compiled both languages. Additional reviewer-environment dependencies are not vendored.

## Revisão de integração / Integration review (2026-10-23)

Os quatro PDFs oficiais abaixo foram baixados novamente e seus SHA-256 coincidem com os registrados. Os trechos citados sustentam os critérios do Quadro VI, as contagens e frequências do bloco principal e as correções históricas, mantendo as ressalvas documentadas. A página do GT III, a apresentação SIRGAS de 2019 e a nota técnica IBGE de 2024 também foram conferidas nos pontos citados.

The four official PDFs below were downloaded again and their SHA-256 values match the recorded checksums. The cited passages support the Table VI criteria, principal-block counts and frequencies, and historical corrections, with the documented qualifications retained. The WG III page, 2019 SIRGAS presentation and 2024 IBGE technical note were also checked at the cited locations.

Os nove testes numéricos e os dois modos do script passaram novamente. As duas versões foram recompiladas com TeX Live 2023, incluindo os padrões de hifenização portugueses. A inspeção visual identificou uma colisão entre a variável TikZ `\c` e o comando de cedilha no texto português de 2015: “definição” saía como “definicorMarcão”. A variável foi renomeada e o PDF português regenerado; a única alteração de conteúdo ocorre na página PDF 137. A recompilação inglesa preserva o texto das 165 páginas, e mantém-se no repositório o PDF inglês validado no Actions. Todos os 330 slides finais foram renderizados e verificados quanto a texto não vazio e palavras fora da página, sem problemas. Permanecem os avisos TeX não fatais já documentados.

The nine numerical tests and both script modes passed again. Both editions were rebuilt with TeX Live 2023, including Portuguese hyphenation patterns. Visual inspection found a collision between the TikZ variable `\c` and the cedilla command in the Portuguese 2015 label: “definição” rendered as “definicorMarcão”. The variable was renamed and the Portuguese PDF regenerated; its only content change is on PDF page 137. The English rebuild preserves the text of all 165 pages, and the Actions-validated English PDF is retained in the repository. All 330 final slides were rendered and checked for nonempty text and words outside the page, with no problems. The previously documented nonfatal TeX warnings remain.

O build Actions citado no PR validou o commit `4dc3c353ca19b50cd0a1d5dbb347e38bffb80643`; seu passo final gerou os PDFs no commit `1ee5a55`. O commit posterior `1af2d1f` apenas documentou o ambiente e removeu o workflow temporário. A revisão de integração verifica diretamente os arquivos finais; não apresenta aquele build anterior como um check do novo head. Na revisão, `main` não tinha checks obrigatórios nem rulesets e os workflows permanentes de simuladores não abrangiam os arquivos desta correção.

The Actions build cited in the PR validated commit `4dc3c353ca19b50cd0a1d5dbb347e38bffb80643`; its final step generated the PDFs in commit `1ee5a55`. The later `1af2d1f` commit only documented the environment and removed the temporary workflow. Integration review checks the final files directly; it does not describe that earlier build as a check of the new head. At review time, `main` had no required checks or rulesets, and permanent simulator workflows did not cover the files in this correction.

## Integridade dos PDFs consultados / Consulted-PDF integrity

SHA-256, arquivos oficiais baixados em / official files downloaded on 2026-10-21:

| Referência / Reference | SHA-256 |
|---|---|
| IBGE 1983 | 48a6b4072492ac967737f6f0f2cb965de14f6ccb3b484682d361f2556a7c1c27 |
| IBGE 2011 | acbbf12f8b40d7f3b7142d0c3b701ca190ec84847a5cdf69b4100efb9e68e469 |
| IBGE 2019, 2ª ed. | 1c074d16f4f911d26ab5c646f70b1c77825e85e809779affe122ec965738a32b |
| Siqueira et al. 2018 | 6af5e457117cd97d5f7265ff58a8008fee7adf73e79084cd8e98014f14e889f3 |

