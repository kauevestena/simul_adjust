# transform_lab

Português · [English](README.md)

Laboratório bilíngue (PT-BR / EN) para a disciplina *Ajustamento de Observações 2*: transformar
entre **dois conjuntos dos mesmos pontos em referenciais diferentes** com 3 rotações, 3 translações
e um fator de escala opcional, ajustados pelos métodos **combinado** (Gauss–Helmert) e
**paramétrico** (Gauss–Markov), e comparar os resultados.

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
| `index.html` | O simulador: dados (simulação ou importação), modelo, pontos de verificação, injunções de distância; vista 2D da folha, vista 3D da estação, histograma dos resíduos, resultados, tabela por ponto |
| `teoria.html` | Teoria: os dois modelos em forma matricial **e** algébrica, parametrizações da rotação, injunções, estatística, propagação, referências |
| `comparacao.html` | Quaisquer duas configurações A × B sobre os mesmos dados e sorteios; pares prontos e diálogo de edição |

A barra superior tem ← Simuladores (volta ao portal), Teoria e Comparação, e o alternador PT/EN.
Idioma: `?lang=` → `localStorage['monorepo_lang']` compartilhado → `navigator.language`; todos os
links preservam `?lang=`.

## Modelo

`x_T = t + λ R(p) x_S`, com `x_S` as coordenadas impressas e `x_T` as da estação total.

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
- **Modelo estocástico da estação total**: `σ_S = a + b·S` (2 mm + 2 ppm), ângulos de 2″ por padrão,
  covariância 3×3 completa por ponto («charuto» ao longo da visada) ou só a diagonal.
- **Modelo estocástico da referência**: `σ = 0,1 mm` por ponto (palpite fundamentado) mais uma incerteza
  de escala da impressora em ppm, opcional. A simulação pode usar um erro de impressão *real* diferente
  do declarado.

**Formato de importação.** Colunas: *ID do ponto; Azimute; Ângulo zenital; Distância inclinada* (colunas de σ opcionais depois). A origem do azimute é arbitrária. Um ID sem correspondente na referência é apenas transformado (nunca entra no ajustamento nem é ponto de verificação); a opção «IDs numéricos seguem a ordem da grade» vem desligada.

**Exemplo real.** `data/ATV-AJ.csv` é o arquivo de campanha original `foundation/inputs/ATV-AJ.txt` convertido com `node transform_lab/scripts/convert_job.mjs <job.txt> <saida.csv>`: a grade foi varrida em serpentina a partir da linha de baixo (esquerda→direita, depois direita→esquerda…), e o script atribui os nomes A0…R2 de acordo (um ID repetido é uma remedição: vale a leitura posterior). `data/ATV-AJ_56.csv` mantém só as 8 primeiras linhas de varredura (`--rows 8`, 56 pontos): os 14 últimos pontos (IDs 57–70) ficam cerca de 10 mm deslocados em bloco (a folha ou o instrumento se mexeu), então o arquivo de 70 pontos é um exemplo pronto de erro grosseiro. A opção «IDs numéricos seguem a ordem da grade» supõe ordem por linhas e não serve para esse arquivo.

**Origem dos dados.** *Importar arquivo* é o padrão e o arquivo de exemplo (`data/sample_ts_raw.csv`) já vem carregado; as opções que só fazem sentido com dados simulados (cenário, semente, geometria, % coletado, pontos extras, erro de impressão verdadeiro) ficam ocultas até escolher *Simulação*. Trocar unidades ou a precisão do instrumento reanalisa o arquivo carregado.

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

## Sobre a precisão da impressão

Não há norma para uma impressão a laser em A4, então os padrões são didáticos. O que se encontrou: a colocação
da imagem é especificada em cerca de ±5 mm, com ≈ 1 mm de uma página a outra; o posicionamento aleatório dos
pontos é limitado pelos pixels de 21–42 µm (1200–600 dpi); o papel encolhe no fusor em cerca de 0,1–0,5 %
(≈ 600–700 µm em papel leve), mais na transversal; um amador mediu 0,4 mm e ≈ 1 mm numa A4 impressa a laser.
Assim, 0,1 mm de erro aleatório é razoável, mas um **erro sistemático de escala de 1000–5000 ppm** o dominaria:
por isso a escala é estimada e o laboratório tem uma `Σ_S` densa. As fontes estão em `teoria.html` §11.

## Validação

```sh
npm install --prefix transform_lab                      # só o playwright
npm test --prefix transform_lab                         # node:test (unitários, oráculo, i18n)
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
- `tests/browser.cjs`: todas as páginas, nenhuma requisição externa, idioma, downloads, importação, 390 px.

## Estrutura

```
index.html teoria.html comparacao.html  páginas        app.mjs compare.mjs theory.mjs
i18n.mjs words.mjs                       dicionário PT/EN
core/                                    matemática pura (sem DOM): linalg, lsq (Gauss–Helmert), transform, rotations,
                                         reference, simulate, propagate, pipeline, io, stats, rng, units
views/                                   canvas 2D, 3D (three.js), histograma
vendor/                                  three.js r160, KaTeX 0.16.9 (ver THIRD_PARTY.txt); sem CDN
data/ scripts/ tests/ foundation/        dados de exemplo, geradores, testes, o alvo imprimível
```

## Não modelado

Alturas de instrumento e de alvo, refração e curvatura, erros de centragem e nivelamento, o efeito do ângulo
de incidência nas distâncias sem prisma (o cenário da mesa avisa que cresce na incidência rasante) e escala
anisotrópica da impressora (`x` e `y` podem diferir, mas não há cisalhamento).
