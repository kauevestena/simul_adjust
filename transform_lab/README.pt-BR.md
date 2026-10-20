# transform_lab

Português · [English](README.md)

Laboratório bilíngue (PT-BR / EN) para a disciplina *Ajustamento de Observações 2*: transformar
entre **dois conjuntos dos mesmos pontos em referenciais diferentes** com 3 rotações, 3 translações
e um fator de escala opcional, ajustados pelos métodos **combinado** (Gauss–Helmert) e
**paramétrico** (Gauss–Markov). O laboratório também procura **erros grosseiros** (data snooping,
τ de Pope, regra kσ, RANSAC) e ajusta o **plano da folha** para mostrar o erro da estação total.

- **Conjunto de referência**: a grade A4 impressa de [`foundation/target_grid`](foundation/target_grid)
  (70 vértices A0…R2, espaçados de 3 cm, em **centímetros**), colada numa superfície rígida e plana.
- **Segundo conjunto**: os mesmos vértices medidos **sem prisma** com uma estação total, em **metros**
  (azimute, ângulo zenital e distância inclinada brutos → coordenadas locais com a MVC propagada, como em
  [`shared/total_station.mjs`](../shared/total_station.mjs)).

Abra `index.html` por um servidor web (`python3 -m http.server` na raiz do repositório e depois
`http://localhost:8000/transform_lab/`); módulos ES não carregam de `file://`.

## Páginas

| Página | O que faz |
|---|---|
| `index.html` | O simulador: observações, o fluxo de trabalho (ajustar → detectar outliers → desativar → ajustar de novo), o teste global; abas folha 2D, estação 3D, plano da folha, resíduos 1D, pontos, resultados e configurações |
| `teoria.html` | Teoria: a transformação 3D em forma matricial **e** escalar (elementos de R em cada parametrização, pequenas rotações, derivadas parciais), os dois métodos por ponto, injunções, estatística, propagação, o plano da folha, a detecção de outliers, referências |
| `comparacao.html` | Quaisquer duas configurações A × B sobre os mesmos dados e sorteios; pares prontos (aplicados na hora) e diálogo de edição (aplicado com ▶ Comparar) |

O visual segue o `ajusta_planos` (paleta pedra/verde-azulado, Inter e JetBrains Mono, cartões, fluxo de
trabalho numerado, abas em pílula), em CSS próprio e com as fontes no repositório: as páginas **não fazem
requisições externas**. A barra superior tem ← Simuladores (volta ao portal), Teoria e Comparação, e o
alternador PT/EN. Idioma: `?lang=` → `localStorage['monorepo_lang']` compartilhado → `navigator.language`;
todos os links preservam `?lang=`. O modo escuro segue o sistema.

## Fluxo de trabalho

Como no `ajusta_planos`, **nada é calculado até ▶ Executar ajustamento**. Alterar os dados ou qualquer
configuração descarta o resultado anterior («Aguardando ajustamento…»); as vistas continuam mostrando os
dados e o passo 1 do fluxo fica âmbar.

1. **Modelo**: método, parametrização da rotação, escala, percentual de verificação, injunções de distância → ▶.
2. **Detecção de outliers**: escolha o método → ⚠ Detectar outliers. Ele só *marca* os pontos (rosa).
3. **Desativar marcados** (ou desmarcar *Ativo* na aba ☰ Pontos) / **Reativar todos**.
4. Reexecutar o ajustamento.
5. Exportar os resultados por ponto e os parâmetros com sua MVC (CSV).

As configurações secundárias (σ do instrumento, MVC da referência, opções avançadas do modelo, sementes,
níveis dos testes, RANSAC, unidade de saída) ficam na aba ⚙ Configurações.

## Dados

Os botões de amostra carregam `data/ATV-AJ_56.csv` (o **padrão**), `data/ATV-AJ.csv` (70 pontos, com o
bloco deslocado) ou o simulado `data/sample_ts_raw.csv`; *Carregar arquivo próprio* lê os mesmos formatos.
O *Gerador sintético* (recolhido) guarda o cenário da simulação e o aplica com ↻ Gerar observações.
⚠ Simular erro grosseiro soma kσ a uma observação bruta (S, Hz ou Z) dos pontos escolhidos sem avisar o
modelo estocástico; *Remover erros injetados* desfaz.

**Formato de importação.** Colunas: *ID do ponto; Azimute; Ângulo zenital; Distância inclinada* (colunas de σ opcionais depois). A origem do azimute é arbitrária. Um ID sem correspondente na referência é apenas transformado (nunca entra no ajustamento nem é ponto de verificação); a opção «IDs numéricos seguem a ordem da grade» vem desligada. Trocar unidades, opções do arquivo ou a precisão do instrumento reanalisa o arquivo carregado.

**Exemplo real.** `data/ATV-AJ.csv` é o arquivo de campanha original `foundation/inputs/ATV-AJ.txt` convertido com `node transform_lab/scripts/convert_job.mjs <job.txt> <saida.csv>`: a grade foi varrida em serpentina a partir da linha de baixo (esquerda→direita, depois direita→esquerda…), e o script atribui os nomes A0…R2 de acordo (um ID repetido é uma remedição: vale a leitura posterior). `data/ATV-AJ_56.csv` mantém só as 8 primeiras linhas de varredura (`--rows 8`, 56 pontos): os 14 últimos pontos (IDs 57–70) ficam cerca de 10 mm deslocados em bloco (a folha ou o instrumento se mexeu), então o arquivo de 70 pontos é um exemplo pronto de erro grosseiro. A opção «IDs numéricos seguem a ordem da grade» supõe ordem por linhas e não serve para esse arquivo.

**Erro de pontaria.** Sem prisma, 2″ a 8 m são só 0,08 mm transversais à visada, enquanto uma cruz impressa
é apontada com alguns décimos de milímetro. As configurações do instrumento têm um *σ de pontaria* `p` (mm),
somado em quadratura como `p/S` (e `p/(S senZ)` para Hz). Os botões ATV-AJ usam `p = 0,4 mm`, o que dá
`σ̂₀² ≈ 0,95` nos 56 pontos limpos (com `p = 0` seria 10,7).

## Modelo

`x_T = t + λ R(p) x_S`, com `x_S` as coordenadas impressas e `x_T` as da estação total
(`teoria.html` §3 a escreve em forma matricial e escalar).

- **Referenciais: todos dextrogiros.** Folha: `x` para a direita, `y` para cima, `z` saindo da folha.
  Estação total: `X` em `Hz = 90°`, `Y` em `Hz = 0°` (zero do círculo, que é arbitrário: outra origem apenas gira o referencial em torno de `Z`, e a rotação da transformação a absorve), `Z` para cima;
  `X = S senZ senHz`, `Y = S senZ cosHz`, `Z = S cosZ`. (Até outubro de 2026, `intersecao_re_3D` e
  `ajusta_planos` usavam a troca levogira deste referencial; foram corrigidos junto com este laboratório
  e seus testes verificam a concordância com `shared/total_station.mjs`.)
- **Unidades e escala.** Escolha a unidade de cada conjunto e a de saída. Com `λ` estimado, a razão entre
  as unidades é absorvida pela escala (cm → m dá `λ ≈ 0,01`) e `δλ = λ/λ₀ − 1` é dado em ppm; ou converta a
  referência antes (`λ ≈ 1`), ou fixe `λ` (movimento rígido, 6 parâmetros).
- **Combinado × paramétrico.** Paramétrico: a referência é constante e só os pontos da estação total são
  observados. Combinado: os dois conjuntos são observados, cada um com sua matriz variância-covariância
  (a da referência pode até ser densa, pela escala incerta da impressora). Espere `σ̂₀² ≈ 1` no combinado
  e `> 1` no paramétrico quando a folha tem erro de impressão.
- **Parametrizações da rotação**: ângulos de Euler ω-φ-κ (padrão, sem injunções), quatérnio (`‖q‖ = 1`),
  matriz de rotação (6 injunções de ortonormalidade), eixo-ângulo (`‖n‖ = 1`). Cada uma pode ser executada
  sem suas injunções para ver a singularidade. Há cenários para o **gimbal lock** do Euler (folha em
  paisagem na parede) e para a singularidade do eixo-ângulo (`θ = 0`).
- **Modelo estocástico da estação total**: `σ_S = a + b·S` (2 mm + 2 ppm), ângulos de 2″ por padrão mais o
  σ de pontaria, covariância 3×3 completa por ponto («charuto» ao longo da visada) ou só a diagonal.
- **Modelo estocástico da referência**: `σ = 0,1 mm` por ponto (palpite fundamentado) mais uma incerteza
  de escala da impressora em ppm, opcional. A simulação pode usar um erro de impressão *real* diferente
  do declarado.

### Injunções (equações de restrição)

As distâncias entre pontos da folha são muito bem conhecidas (`d_ij`, com `σ_d` propagado da MVC da
referência). `data/reference_distances.csv` (também baixável no aplicativo) lista os 2415 pares.
Elas agem como equações sobre os **pontos da estação total** durante o ajustamento:

- conjuntos: todos os pares · vizinhos com diagonais (231) · vizinhos horizontais e verticais (123) ·
  um percentual aleatório;
- **relativas** (a distância é uma observação com `σ_D = fator · σ_d`) ou **absolutas** (exatas,
  multiplicadores de Lagrange);
- equações dependentes são removidas (de um conjunto plano só `2m − 3` distâncias são independentes; a
  rede de vizinhos já fixa a forma, então «todos os pares» não acrescenta nada).

O que fazem: no modelo **paramétrico** os pontos ajustados são uma cópia da referência, então todas as
injunções absolutas se reduzem a `λ = λ₀` (e valem automaticamente no movimento rígido). No
**combinado** elas travam a forma da referência ajustada, aproximando-a do resultado paramétrico. Veja
`teoria.html` §8 para as ressalvas (informação contada em duplicidade, viés com erro de escala real).

### Pontos de verificação e pontos sem correspondência

Um sorteio de 0 a 90 % (passos de 5 %), mais o clique para alternar na vista 2D, fica fora do ajustamento e
das injunções e é validado com a covariância conjunta completa (partes no plano e normal reportadas).
Pontos da referência não coletados são só transformados, e pontos da estação total sem correspondente
são levados de volta à folha, ambos com a covariância propagada.

## Detecção de outliers

Todo método testa as **observações brutas** (Hz, Z, S) de cada ponto de controle e marca o ponto inteiro
(como no `intersecao_re_3D`). Do ajustamento saem `g_i = (BᵀK)_i` e `H_i = B_iᵀ Q_K B_i` para as três
coordenadas da estação no ponto `i` e, com a jacobiana polar `J_i`:
`w_k = (J_iᵀg_i)_k / √(J_iᵀH_iJ_i)_kk`, o número de redundância `r_k = σ_k²(J_iᵀH_iJ_i)_kk` (somam `r`) e o
menor erro detectável `∇₀_k = δ₀ σ_k/√r_k`. Arquivos de coordenadas (e a MVC diagonal) testam `x, y, z`.

| Método | Regra |
|---|---|
| Data snooping iterativo (Baarda) | `σ₀` conhecido a priori; ajusta, retira o ponto de maior `\|w\|` acima de `z(1 − α₀/2)` (3,29 para `α₀ = 0,1 %`), reajusta… Um ponto essencial é mantido. |
| Teste τ de Pope | Numa passada, `\|τ\| = \|w\|/σ̂₀` acima de `τ_c = t√r/√(r − 1 + t²)`. |
| Regra kσ | `\|v\|/σ > k` com o σ nominal. |
| RANSAC | Forma fechada de Horn em 3 pontos de controle sorteados (com semente); consenso pelo comprimento de Mahalanobis de cada discrepância (< `k_R` σ, padrão 8); o maior consenso é reajustado e cada ponto fora dele é marcado se a sua discrepância falhar no `χ²(3)` ao nível `α₀`. |

**O caso ATV-AJ** (70 pontos, todos de controle): `σ̂₀² ≈ 20`, `δλ ≈ −15 000 ppm`. O RANSAC marca exatamente
os 14 pontos deslocados; o data snooping iterativo retira esses 14 primeiro e depois 6 pontos bons
(propagação, *swamping*); o τ de Pope não acha nada porque `σ̂₀` está inflado pelo bloco (mascaramento);
a regra kσ marca quase tudo. Sem o bloco, `δλ ≈ −3200 ppm` (a retração do papel) e `σ̂₀² ≈ 1,1`. Com os 20 %
padrão de pontos de verificação, 3 dos 14 são de verificação e reprovam no teste conjunto.

## O plano da folha

A folha é plana, então um plano ajustado **só às observações da estação total** (todos os pontos ativos,
casados ou não; modelo combinado `n·xᵢ − d = 0` com `‖n‖ = 1`, `Σ_T` completa) mostra o erro da estação na
profundidade: a distância `dᵢ` de cada ponto ao plano, com `σ_d² = nᵀΣᵢn ≈ σ_S²` quando a estação está de
frente para a folha. A aba ▭ Plano da folha mapeia `d` (ou `w`) visto da estação, com uma superfície IDW;
a vista 3D desenha o plano e os desvios exagerados; o histograma compara `d` com o σ nominal ao longo da
normal. No ATV-AJ (56): RMS `d ≈ 0,67 mm` contra 1,90 mm nominais — o distanciômetro é bem melhor que
2 mm + 2 ppm a 8 m. O plano não acusa o bloco do ATV-AJ: aquele deslocamento foi dentro do plano da folha.
Pontos desativados saem dos dois ajustamentos.

## Sobre a precisão da impressão

Não há norma para uma impressão a laser em A4, então os padrões são didáticos. O que se encontrou: a colocação
da imagem é especificada em cerca de ±5 mm, com ≈ 1 mm de uma página a outra; o posicionamento aleatório dos
pontos é limitado pelos pixels de 21–42 µm (1200–600 dpi); o papel encolhe no fusor em cerca de 0,1–0,5 %
(≈ 600–700 µm em papel leve), mais na transversal; um amador mediu 0,4 mm e ≈ 1 mm numa A4 impressa a laser.
Assim, 0,1 mm de erro aleatório é razoável, mas um **erro sistemático de escala de 1000–5000 ppm** o dominaria:
por isso a escala é estimada e o laboratório tem uma `Σ_S` densa. As fontes estão em `teoria.html` §13.

## Validação

```sh
npm install --prefix transform_lab                      # só o playwright
npm test --prefix transform_lab                         # node:test (unitários, oráculo, plano, outliers, i18n)
npm run test:browser --prefix transform_lab             # Playwright (CHROME_PATH=… para um Chrome do sistema)
python3 transform_lab/tests/generate_reference.py       # regenera o oráculo NumPy
npm run data --prefix transform_lab                     # regenera data/*.csv
```

- `tests/oracle.test.mjs` compara nove casos (os dois métodos, Euler e quatérnio, rígido, `Σ_S` densa,
  injunções absolutas e relativas) com `tests/numerical-reference.json`, gerado por `generate_reference.py`:
  uma implementação independente em NumPy com jacobianas por diferenças finitas, conferida por um
  Gauss–Newton ponderado simples.
- `tests/core.test.mjs`: recuperação sem ruído para toda parametrização × método × modo de escala,
  invariância à parametrização, combinado → paramétrico quando `Σ_S → 0`, comportamento das injunções,
  gimbal lock e casos singulares, Monte Carlo (`E[σ̂₀²] ≈ 1`, cobertura dos pontos de verificação).
- `tests/plane.test.mjs`: o plano coincide com o da PCA para Σ isotrópica, `Σrᵢ = m − 3`, Monte Carlo
  `σ̂₀² ≈ 1`, um erro de 10σ dá o maior `|w|`.
- `tests/outliers.test.mjs`: valores críticos de Student e τ, números de redundância somando `r`, um erro de
  20σ na distância encontrado pelo data snooping com `S` como pior observação, o RANSAC isolando exatamente
  o bloco do ATV-AJ, pontos desativados.
- `tests/rotations.test.mjs` também confere que as fórmulas impressas na teoria (elementos de R, derivadas
  de Euler, pequenos ângulos) são as que o código usa.
- `tests/browser.cjs`: todas as páginas, o fluxo com botão, detecção e desativação, injeção de erro,
  nenhuma requisição externa, idioma, downloads, importação, 390 px.

O ajustamento inverte `M = BΣBᵀ` por blocos (ela é bloco-diagonal, a menos que injunções de distância ou uma
`Σ_S` densa liguem os pontos) e trabalha com as linhas esparsas de `B`; assim um ajustamento de 70 pontos
leva algumas dezenas de milissegundos num notebook e o data snooping iterativo pode repeti-lo muitas vezes.

## Estrutura

```
index.html teoria.html comparacao.html  páginas        app.mjs compare.mjs theory.mjs
i18n.mjs words.mjs                       dicionário PT/EN
core/                                    matemática pura (sem DOM): linalg, lsq (Gauss–Helmert), transform, rotations,
                                         reference, simulate, propagate, pipeline, io, stats, rng, units,
                                         plane (plano da folha), reliability (testes de Hz/Z/S), outliers (detectores)
views/                                   folha 2D, 3D (three.js), plano da folha, histograma
vendor/                                  three.js r160, KaTeX 0.16.9, Inter, JetBrains Mono (ver THIRD_PARTY.txt); sem CDN
data/ scripts/ tests/ foundation/        dados de exemplo, geradores, testes, o alvo imprimível
```

## Não modelado

Alturas de instrumento e de alvo, refração e curvatura, centragem e nivelamento do instrumento, o efeito do
ângulo de incidência nas distâncias sem prisma (o aplicativo avisa quando ele cresce na incidência rasante) e
escala anisotrópica da impressora (`x` e `y` podem diferir, mas não há cisalhamento).
