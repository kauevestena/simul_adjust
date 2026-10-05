[English](readme.md) · **Português (BR)**

Rede 3D de estações livres (interseção a ré 3D) ajustada por mínimos quadrados. Visadas de
estação total — leitura horizontal, ângulo zenital e distância inclinada, cada uma com seu
desvio-padrão — ligam estações livres entre si e a pontos fixos. O aluno escolhe o modelo e o
datum:

- **combinado** ("método combinado" de Gemael, "general least squares" de Ghilani) ou
  **paramétrico** (Gauss–Markov);
- **pontos fixos**, **rede livre** (injunções internas) ou **injunções mínimas** (pose da primeira
  estação mantida fixa).

O simulador calcula as aproximações iniciais, ajusta a rede, a testa e informa coordenadas,
elipsoides de erro, resíduos, todas as matrizes do ajustamento e um relatório em PDF. O botão
**Explicação dos Modelos** abre `modelos.html`, que deduz as equações e as jacobianas A e B das
quatro variantes. O botão **Pré-Processamento** abre `preprocessamento.html`, que reduz cadernetas
brutas ao CSV de entrada (ver abaixo).

Sirva a raiz do repositório por HTTP (`python3 -m http.server`) e abra
`intersecao_re_3D/index.html`; a amostra é lida com `fetch`.

**Idioma:** a interface, o relatório (PDF/texto), as mensagens, os CSV de saída e a página de
modelos são bilíngues (PT-BR e EN). O idioma vem de `?lang=`, depois de `localStorage`
(`monorepo_lang`) e depois do navegador, e o botão PT/EN troca na hora.

## O modelo

Cada visada da estação *i* ao ponto *j* dá três equações de condição implícitas, uma por
componente do vetor irradiado:

```
F1 = Xj − Xi − S·sinZ·cos(Hz + ωi) = 0
F2 = Yj − Yi − S·sinZ·sin(Hz + ωi) = 0
F3 = Zj − Zi − S·cosZ              = 0
```

As observações `La = (Hz, Z, S)` e as incógnitas `Xa` (coordenadas das estações e dos pontos
livres, mais uma orientação `ω` por estação) aparecem misturadas em `F(La, Xa) = 0`, o que pede o
modelo combinado. Os pontos fixos entram como constantes.

| matriz | o que é aqui |
|---|---|
| `A = ∂F/∂Xa` | +I no ponto visado (se livre), −I na estação e a coluna de `ω`: `[S sinZ sinα, −S sinZ cosα, 0]` |
| `B = ∂F/∂La` | bloco-diagonal 3×3: a jacobiana da irradiação polar → cartesiana, a mesma do `ajusta_planos` |
| `M = B P⁻¹ Bᵀ` | bloco 3×3 por visada: a MVC cartesiana do vetor irradiado (`Σ_XYZ` no `ajusta_planos`) |
| `W` | erro de fechamento iterado de Gemael, `F(L0, X0) + B(Lb − L0)` |

`N = AᵀM⁻¹A`, `U = AᵀM⁻¹W`, `X = −N⁻¹U`, `K = −M⁻¹(AX + W)`, `V = P⁻¹BᵀK`, `La = Lb + V`, e
então relineariza-se em `(La, Xa)`. Na notação de Ghilani (cap. 22) a mesma solução é `J = A`,
`K = −W`, `We = M⁻¹`.

Convergência: máx |Δcoordenada| < 0,01 mm **e** máx |Δω| < 0,01″ (ambos editáveis), no máximo 25
iterações. As correções, `VᵀPV` e ‖W‖ de cada iteração são guardados e informados.

### A alternativa paramétrica

O modelo paramétrico escreve cada observação como função explícita das incógnitas:
`Hz = atan2(ΔY, ΔX) − ω`, `Z = atan2(h, ΔZ)`, `S = |Δ|`, com `V = AX + L`, `L = L0 − Lb`,
`N = AᵀPA`, `U = AᵀPL`, `X = −N⁻¹U`. É o modelo combinado com `F = f(Xa) − La`, isto é,
`B = −I`, `M = P⁻¹`, `W = L`; por isso o `adjustment.js` roda os dois no mesmo laço de iteração:
só os blocos por visada mudam.

Na convergência os dois descrevem o mesmo problema de mínimos quadrados
(`A_par = −B⁻¹A_comb ⇒ AᵀPA = AᵀM⁻¹A`) e concordam em ~1e-13 nas coordenadas e resíduos. O
`test_adjust.js` verifica isso tanto pelo modelo paramétrico do aplicativo quanto contra uma
solução Gauss–Markov independente escrita no teste.

### Datum: pontos fixos, rede livre ou injunções mínimas

As observações são cegas a uma translação da rede inteira e a uma rotação em torno da vertical,
com todos os ω girando junto. As distâncias fixam a escala e os zenitais a vertical. Assim, com
todos os pontos incógnitos, N tem **defeito de posto 4**.

- **Pontos fixos** entram como constantes, então suas colunas saem de A. São necessários pelo
  menos 2: um fixa as translações, não a rotação. `gl = n − u`.
- **Rede livre**: todos os pontos são incógnitas, inclusive os de apoio. Suas coordenadas servem
  só de aproximação; sem elas, a primeira estação as inicia no datum assumido.
  - O defeito é removido por **injunções internas** `GᵀX = 0`, em que G é o espaço nulo com as
    linhas de ω zeradas. Resolve-se o sistema orlado `[N G; Gᵀ 0]`, e Q, o bloco superior
    esquerdo da sua inversa, dá `Σ_Xa = σ̂₀²Q`. `gl = n − u + 4`.
  - Entre todas as escolhas de datum, esta solução tem o traço mínimo de Σ_Xa nas coordenadas.
  - G é montada uma só vez nas aproximações, então a rede ajustada conserva exatamente o
    centróide e a orientação média delas, seja qual for o modelo.
- **Injunções mínimas**: exatamente as 4 injunções do defeito de posto, sem excesso. A primeira
  estação (a origem) tem `X, Y, Z` e `ω` constantes nos valores de "Datum local assumido" (padrão
  `0, 0, 0, 0`); todos os demais pontos, inclusive os de apoio, são incógnitas. N tem posto
  completo, `gl = n − u`.
  - Mesma solução da rede livre sob a injunção `CᵀX = 0` (C seleciona `X, Y, Z, ω` da origem):
    uma transformação S, `S = I − H(CᵀH)⁻¹Cᵀ`. Resíduos, VᵀPV, números de redundância e
    distâncias entre pontos (e sua precisão) concordam com a rede livre; coordenadas, σ e
    elipsoides mudam — a origem tem σ = 0 e o traço de Σ é maior que o mínimo da rede livre.
  - Ao contrário de dois pontos fixos, não há injunções a mais: nenhuma visada perde redundância e
    nenhum σ é reduzido por coordenadas que na verdade saíram das próprias observações.
  - As coordenadas dos pontos "Fixo" no CSV não são usadas; as aproximações partem da estação de
    origem.

A aba **Comparar Modelos** roda as quatro variantes lado a lado.
- Entre modelos com o mesmo datum, tudo concorda.
- Entre datums, resíduos, VᵀPV e distâncias entre pontos concordam, enquanto coordenadas, σ,
  elipsoides e gl mudam.
- Ela também roda o teste de compatibilidade dos pontos fixos,
  `ΔVᵀPV = VᵀPV_fixos − VᵀPV_livre ~ χ²` com `gl_fixos − gl_livre` graus de liberdade.

Na amostra, a rede livre tem gl 13 (72 − 63 + 4) contra 15, e as injunções mínimas também 13
(72 − 59, com A fixa na origem). VᵀPV é o mesmo, 193,585, nos três, e ΔVᵀPV = 0, porque M01/M02
saem das próprias visadas de A.

### Convenções

A irradiação segue `ajusta_planos/io.js`: `X` no zero do círculo, `Y` em Hz = 90° (sentido
horário), `Z` para cima. Esse referencial é de mão esquerda; a vista 3D desenha `(Y, X, Z)` e a
planta põe X para cima e Y para a direita, para a rede não aparecer espelhada. Alturas de
instrumento e de alvo não são modeladas — as visadas são do centro do instrumento ao ponto
visado. Curvatura da Terra e refração são ignoradas, o que vale para redes locais como a amostra
(≤ 15 m); para visadas longas, veja Ghilani cap. 23.

## CSV de entrada

```
Estacao,Ponto Visado,Leitura Horizontal,desvio padrão H,Ângulo Zenital,desvio padrão V,Distância Incinada,desvio padrão D,Fixo,X,Y,Z
```

- Os cabeçalhos são comparados sem distinguir maiúsculas e acentos ("Incinada" e "Inclinada"
  funcionam); sem cabeçalho reconhecível, as colunas são lidas nesta ordem. `;` com vírgula
  decimal também funciona.
- Os desvios-padrão angulares estão em **segundos de arco** por padrão (uma opção em
  Configurações aceita graus); o de distância, em metros. Em branco ou ≤ 0, usa-se o valor
  nominal, com aviso.
- `Fixo` aceita `sim/não`, `true/false`, `1/0`. É propriedade do *ponto*; se as linhas
  discordam, o ponto é tratado como fixo e um aviso é registrado.
- `X,Y,Z` são opcionais e só lidos nas linhas de pontos fixos. Em branco significa "não dado".

### Pontos fixos sem coordenadas: a regra do datum

Um ponto fixo sem X,Y,Z é calculado **por irradiação da única estação que o observa** — as
equações de levantamento 3D acima, como no `ajusta_planos`. Só uma estação de origem desse tipo é
aceita, e um ponto fixo sem coordenadas visado de duas estações é rejeitado, pois não haveria como
escolher. A pose da estação de origem vem de uma resseção quando ela vê ao menos dois pontos
fixos que têm coordenadas; do contrário, do **datum local assumido** em Configurações (padrão
X = Y = Z = 0, ω = 0: o instrumento na origem, como no `ajusta_planos`).

Dois pontos fixos bastam. As distâncias fixam a escala e os zenitais a vertical, então o defeito
de datum de uma rede de estação total é 4 (três translações e a rotação em torno da vertical), e
dois pontos conhecidos o removem por inteiro.

Quando o datum vem dessas mesmas visadas, seus resíduos são nulos por construção: as coordenadas
foram derivadas delas e nada mais na rede puxa a pose daquela estação. O log avisa.

## Pré-processamento (`preprocessamento.html`)

O botão **Pré-Processamento**, ao lado de *Explicação dos Modelos*, abre uma página que transforma
uma caderneta bruta (várias séries em PD e PI por visada, como
`inputs/raw_obs/raw_observations.csv`) num arquivo no formato acima.

- **Entrada:** `Estação, Ponto, Leitura horizontal, Ângulo zenital, Distância inclinada`, uma
  linha por pontaria. Formato dos ângulos num menu (detectado ao carregar): **g.mmss**
  compactado (`134.1704` = 134°17′04″; zeros à direita podem faltar: `163.033` = 163°03′30″),
  **graus decimais** ou **G, M, S em 3 colunas** por ângulo. A face vem do zenital (PD: Z < 180°);
  a k-ésima leitura PD forma a série k com a k-ésima PI.
- **Política de exportação por observável**, em três colunas (Hz, Z, S), cada uma com regra de
  valor e de σ (desvio-padrão empírico da média, modelo nominal propagado ou o maior dos dois):
  - Hz e Z: média das séries (padrão), média das 2n leituras reduzidas à PD, uma única série,
    uma única leitura (sem correção) ou a média de uma face corrigida pelo **erro de colimação /
    de índice vertical global**, com o σ da estimativa propagado.
  - S: média de todas, das N primeiras, uma só leitura ou a mediana. As distâncias são tratadas
    independentemente dos ângulos (qualquer face, qualquer série).
  - Desvio-padrão com n − 1 (padrão) ou n; um piso de σ evita pesos infinitos.
  - Predefinição **Reproduzir arquivo de referência**: média das 2n leituras reduzidas com σ
    populacional — regenera exatamente as 24 linhas de `inputs/observations.csv`.
- **Erros globais:** ε e c de todas as séries completas de todas as visadas, com eliminação
  opcional de extremos (k·s ou % por cauda), num diagrama de pontos.
- **Triagem:** cada leitura é comparada à média das demais do seu grupo, uma por vez, contra
  k·σ da rede (estimativa combinada; padrão), k·σ nominal, escore robusto (MAD) ou teste de
  Grubbs. Séries cujo ε ou c destoa do global e grupos com dispersão excessiva também são
  marcados. Leituras podem ser excluídas por observável (Hz, Z, S) à mão ou com *Excluir
  marcadas*. Leituras repetidas literalmente em outra estação (bloco ou visada copiada) são
  avisadas — na amostra, C→00d, C→00e e C→00f repetem as leituras de B; elas não fazem parte de
  `inputs/observations.csv`.
- **Saída:** `observations.csv` (pontos fixos e X,Y,Z opcionais marcados na página), um CSV de
  relatório por leitura, ou **Abrir no simulador**, que entrega o arquivo ao `index.html` via
  `localStorage` (`?source=preproc`).

## A amostra

`inputs/observations.csv`: estações A, B, C encadeadas por pontos comuns, 24 visadas. A vê os
pontos fixos M01, M02 e os pontos M03, 00d, 00e, 00f; B vê 00d, 00e, 00f e mais seis; C divide 17,
37, 16, 12 com B e acrescenta cinco. São 72 equações, 57 incógnitas, **15 graus de liberdade**.

Duas edições foram feitas no arquivo recebido:

- **`A,00f` Hz: 227,578240740741° → 47,578240740741°.** A leitura estava 180° errada — uma
  leitura em face II não reduzida. Reduzida de 180°, as distâncias 00d–00f e 00e–00f vistas de A
  coincidem com as vistas de B em 2 mm; como recebidas, discordavam 19,5 m. A etapa de
  aproximações agora detecta exatamente isso e aponta a visada certa ("a diferença desaparece
  somando 180° à leitura horizontal de A→00f"), então o mesmo erro num arquivo do usuário é
  pego antes de ajustar.
- **M03 é livre** (`Fixo = não`); M01 e M02 são os pontos fixos. Colunas `X,Y,Z` vazias foram
  acrescentadas para documentar o formato.

Resultados com as configurações padrão:

| origem do σ | σ̂₀² | teste global | data snooping |
|---|---|---|---|
| CSV (padrão) | 12,91 | reprova | marca B→16 (D, w = 9,46) e C→12 (Zen, w = 5,99) |
| máx(CSV, nominal) | 0,78 | aprova | nada |
| nominal (2″, 2 mm + 2 ppm) | 0,90 | aprova | nada |

Os desvios-padrão do CSV são desvios-padrão da média de leituras repetidas — 0,15 mm numa
distância, 0,3″ num ângulo. Como precisão absoluta, são otimistas. Os mesmos pontos vistos de B e
C discordam de 2 a 4 mm, então o teste global rejeita os valores do CSV e aceita os nominais. Dá
um bom caso de sala de aula.

Sete pontos (00c, 36, 33, 30, 34, 39, 03a) e M03 são vistos de uma só estação: três observações,
três incógnitas, redundância r = 0. O ajustamento os reproduz exatamente e nenhum erro grosseiro
neles pode ser detectado. O log os lista.

## Detecção de outliers

Roda-se após o ajustamento; depois desativa-se e reexecuta-se quantas vezes for preciso:

- **Data snooping (Baarda)**, iterativo: remove a visada de maior |w| e reajusta. Se a rede deixa
  de ter solução sem essa visada (na amostra, B→17: sem ela C não pode mais ser resseccionada), a
  visada é **essencial**. Ela é restaurada, informada no detalhe e *não* marcada, de modo que
  "Desativar marcadas" nunca quebra a rede.
- **Teste τ de Pope**: resíduos padronizados com σ̂₀ (a posteriori), numa só rodada.
- **Regra kσ**: |v| contra o σ a priori da própria observação.

O RANSAC, oferecido no `ajusta_planos`, não faz sentido para uma rede e não é oferecido aqui.

As marcações são por componente (Hz, Z, S), mas a desativação é por visada, porque as três
equações de condição de uma visada compartilham suas três observações.

## Vistas

- **3D** (three.js): estações, pontos fixos e livres, visadas (tracejadas quando inativas,
  vermelhas quando marcadas), elipsoides de erro a partir dos blocos 3×3 de `Σ_Xa`. O exagero e o
  nível de confiança (1σ, 95 %, 99 %, com χ² em 3 graus de liberdade) são ajustáveis. A cada novo
  conjunto de dados o exagero é escolhido para que o maior elipsoide ocupe cerca de 5 % da rede.
- **2D** XY (planta), XZ e YZ. As elipses são as **projeções dos elipsoides 3D**: o bloco marginal
  2×2 de Σ com o *mesmo* k do elipsoide, que é exatamente o contorno da sombra dele. Em qualquer
  direção do plano ambos têm a mesma função suporte `k√(dᵀΣd)`, e os testes verificam isso.
  Assim, a 95 % o fator é 2,796, e não os 2,448 de uma elipse 2D isolada. Os cortes podem exagerar
  Z, escolhido automaticamente para redes achatadas; as elipses acompanham (`DΣD`) e os rótulos
  de Z ficam em metros verdadeiros.

## Saídas

- `coordenadas_ajustadas.csv`: ponto, tipo, X, Y, Z, σX, σY, σZ, ω e σω das estações, semieixos
  do elipsoide e seu nível de confiança.
- `residuos_observacoes.csv`: por visada, Hz/Z/S ajustados, v, w, r e MDB de cada componente;
  as unidades estão nos nomes das colunas.
- `matriz_<nome>.csv`: qualquer matriz, com rótulos de incógnitas/observações.
- `relatorio_ajustamento.pdf`: tamanho do problema, datum, modelo estocástico, etapas das
  aproximações, tabela de iterações com o critério de convergência e o resultado, teste global,
  avisos e erros, todas as tentativas de ajustamento da sessão (as que falharam também),
  coordenadas, orientações, resíduos, detecção de outliers e as vistas 3D e 2D. Usa jsPDF +
  autotable e embute a DejaVu Sans do CDN, porque as fontes embutidas do jsPDF não imprimem σ, ω,
  χ² nem ″. Sem essa fonte, translitera para ASCII; sem o jsPDF, oferece o relatório em texto.

Os nomes dos arquivos e os cabeçalhos do CSV de observações ficam em português, para que a
exportação possa ser relida; os CSV de coordenadas e resíduos e os relatórios saem no idioma
escolhido na interface.

## Arquivos

| Arquivo | Função |
|---|---|
| `io.js` | leitura de CSV, configurações, gerador de rede sintética, injeção de erro grosseiro, escritores de CSV |
| `adjustment.js` | montagem da rede, regra do datum, aproximações, modelos combinado e paramétrico, datum fixo, livre ou mínimo, comparação de modelos, controle de qualidade, detecção de outliers, elipsoides |
| `viewer3d.js` | vista three.js |
| `views2d.js` | canvases XY / XZ / YZ |
| `report.js` | modelo do relatório (dados puros), renderizadores de texto e PDF |
| `modelos.html` | página estática: modelos, equações, jacobianas, teoria do datum |
| `modelos_en.js` | tradução para inglês do conteúdo de `modelos.html` |
| `i18n.js` | dicionário PT-BR / EN da interface, do HTML estático de `index.html` e da página de pré-processamento |
| `app.js` | estado, abas, tabelas, fluxo de trabalho |
| `preprocessamento.html` | página de pré-processamento: caderneta bruta → `observations.csv` |
| `preproc.js` | leitura bruta (g.mmss, graus, G/M/S), redução das séries, erros de índice/colimação globais, políticas de exportação, triagem, escritores de CSV |
| `preproc_app.js` | interface da página de pré-processamento |
| `test_adjust.js` | `node intersecao_re_3D/test_adjust.js` |
| `test_preproc.js` | `node intersecao_re_3D/test_preproc.js` |

## Referências

- Gemael, C.; Machado, A. M. L.; Wandresen, R. *Introdução ao ajustamento de observações:
  aplicações geodésicas*, 2. ed., Editora UFPR, 2015 — modelos paramétrico e combinado, forma
  iterada.
- Ghilani, C. D.; Wolf, P. R. *Adjustment Computations: Spatial Data Analysis*, 4th ed., Wiley,
  2006 — cap. 19 (elipses de erro), cap. 21 (detecção de erros grosseiros, confiabilidade
  interna), cap. 22 (general least squares), cap. 23 (redes geodésicas 3D).
- Caspary, W. F. *Concepts of Network and Deformation Analysis*, Monograph 11, School of
  Surveying, UNSW, 1987 — redes livres, injunções internas, transformações S.
