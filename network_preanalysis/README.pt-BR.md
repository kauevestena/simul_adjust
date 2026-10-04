# Pré-análise de Redes Topográficas

Português · [English](README.md)

Laboratório bilíngue para projetar redes de estação total **antes do trabalho de
campo**. A interface é um plano 2D; o cálculo usa uma rede genérica 3D em ENU.
Abra `network_preanalysis/` no portal do monorepositório. Para execução local:

```sh
python -m http.server 8000
```

Acesse `http://localhost:8000/network_preanalysis/`. Não é necessário compilar nem
instalar pacotes para usar a aplicação. Módulos ES precisam de HTTP, não `file://`.
O nível 0 funciona sem requisições externas. Os níveis 1–2 carregam elevações
públicas AWS Terrarium; o recorte de ruas do nível 2 é carregado localmente. Idioma: parâmetro `?lang=pt-BR`/`?lang=en`, preferência compartilhada
`monorepo_lang` e, por último, idioma do navegador, nessa ordem. O seletor PT/EN
atualiza a interface, a preferência e o link de retorno ao portal.

## Exploração

- Selecione um ponto ou uma seta para editar propriedades. Arraste pontos para
  redesenhar a rede; o cálculo é atualizado ao soltar. A roda controla o zoom,
  o botão direito desloca a vista e **Enquadrar** mostra a rede inteira.
- **Estações** podem originar visadas; **pontos somente visados** podem ser alvos.
  Cada visada é dirigida. Visadas recíprocas são observações separadas, desenhadas
  com setas paralelas que podem ser selecionadas individualmente.
- Ative direção horizontal, ângulo zenital e distância inclinada separadamente.
  HI pertence à estação; HT pertence ao alvo, com substituição opcional por visada.
- Cada ponto pode ser desconhecido, apoio fixo ou apoio estocástico. Os botões de
  início/fim GNSS apenas atribuem papéis e apoio fixo a pontos comuns.
- Edite a precisão instrumental e do apoio; inspecione σE, σN, σU, σω, elipses,
  redundância e MDB por componente. Selecione um MDB para visualizar os vetores
  de deslocamento que esse erro causaria nas coordenadas.
- Fixe uma referência para comparar antes/depois; use desfazer/refazer e salve/abra
  JSON. Ao importar uma rede rural/urbana, alturas e visibilidade são recalculadas.
- A janela de matrizes mostra A, P, N e Σxx com a ordem das incógnitas e observações.
  A prévia limita-se a 40 linhas/colunas; a exportação JSON contém as matrizes completas.

Há exemplos de poligonal com dois apoios GNSS, geometria alongada fraca, interseção
à ré, interseção angular e rede mista. Todos usam o mesmo modelo. Na interseção
angular, visadas entre os apoios determinam a orientação das estações: dois apoios
com orientação livre e apenas uma direção cada ao alvo não determinariam o alvo.

## Modelo de observações e coordenadas

Internamente, as unidades são metros e radianos, em precisão dupla. A interface
recebe precisões angulares em segundos de arco, constante linear em mm e escala
em ppm. As coordenadas E, N, U referem-se ao ponto no solo. Para i → j:

```text
v = [Ej − Ei, Nj − Ni, Uj + HTj − Ui − HIi]
ρ = hypot(vE, vN)
s = hypot(ρ, vU)
d = atan2(vE, vN) − ωi
z = atan2(ρ, vU)
σs = hypot(a/1000, b·10⁻⁶·s)
```

Azimutes são horários a partir do Norte. Diferenças angulares usam normalização
em ±π. Os jacobianos analíticos são verificados por diferenças finitas centradas.
Visadas verticais não fornecem derivadas válidas de direção/ângulo zenital e são
diagnosticadas. Também são excluídas visadas nulas, entre pontos coincidentes,
ao próprio ponto ou originadas de pontos somente visados.

Adota-se **ξ = η = 0** e Up local paralelo. HI e HT são deslocamentos exatos nesta
etapa: suas incertezas de medição ainda não são propagadas. Não são modelados
centragem, atmosfera, refração, curvatura das visadas, desvio da vertical ou
processamento de linhas de base GNSS. A hipótese está isolada em `observations.mjs`.

No nível 0, U do solo é inicialmente zero, mas permanece incógnita em todo ponto
não fixo. O terreno também fornece apenas coordenadas de projeto, **sem impor uma
restrição exata de altitude** às incógnitas.

Dados reais passam por LLH → ECEF → ENU no WGS84, com origem explícita e inversas
testadas. As funções do globo didático em `sistemas_coordenadas` usam dimensões
exageradas de cena e não serviriam como transformação numérica. Os testes cobrem
equador, polos, orientação dos eixos e ida/volta. Referência:
[ESA Navipedia, transformações ECEF/ENU](https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates).

## Posto, datum e covariância

O vetor de incógnitas contém ENU dos pontos ativos não fixos e uma orientação por
estação com direções válidas. Apoios fixos são eliminados do vetor. Apoios
estocásticos permanecem incógnitas com três pseudo-observações; o modelo aceita
covariância ENU 3×3 completa no JSON. A interface apresenta desvios-padrão
diagonais. Editá-los substitui os termos cruzados importados, conforme aviso.

Não se exige vetor de observações L nem fator de variância posterior. Dada a
covariância a priori C = L Lᵀ, faz-se o branqueamento B = L⁻¹A e o equilíbrio das
colunas por S, para tornar comparáveis as escalas de parâmetros em metros/radianos.
Pela decomposição em valores singulares:

```text
B S = U D Vᵀ
Σxx = S V D⁻² Vᵀ S       (apenas com posto completo)
N = Aᵀ C⁻¹ A
```

O limiar de posto é `100 · eps · max(n,u) · maior valor singular`. O espaço nulo
identifica pontos/orientações afetados; componentes desconectados são diagnosticados
separadamente. Com deficiência de posto, não são apresentadas covariâncias absolutas,
elipses ou deslocamentos externos. O projetor dos resíduos ainda permite calcular
redundâncias e MDB. Não há fixação oculta de datum nem exigência de segundo apoio
inicial. O teste principal tem um início GNSS fixo, um fim GNSS fixo, três estações
intermediárias, oito visadas recíprocas, 24 componentes, 14 incógnitas, posto 14 e
redundância 10.

Σxx já usa as variâncias reais a priori, equivalentes a fator de variância 1.
A elipse **2D de 1σ** contém aproximadamente 39,35% da probabilidade conjunta.
Para 95%, aplica-se `√(−2 ln 0,05) = 2,44774683`. O azimute da elipse é horário do
Norte, módulo 180°. O rodapé sempre apresenta 1σ; a confiança escolhida apenas
escala a elipse e seus semieixos.

## Confiabilidade

Com P = C⁻¹, K = Σxx AᵀP e R = I − AK, a redundância de cada componente original
é `ri = Rii`. A soma é `n − posto(A)`, incluindo as coordenadas de apoios
estocásticos. A interface separa a contagem dessas coordenadas e das observações
de visadas. Com correlações, redundâncias individuais nas coordenadas originais
não precisam estar no intervalo [0,1]; a soma continua obedecendo ao traço.

O MDB usa teste normal bilateral de uma única observação e covariância a priori
conhecida. Padrões: α = 0,001 e poder = 0,8. Resolve-se δ ≥ 0 tal que:

```text
P(|Z + δ| > Φ⁻¹(1 − α/2)) = poder
wi = [P − P A Σxx Aᵀ P]ii
MDBi = δ / √wi
```

Para observações independentes, isso equivale a `δ σi / √ri`. Quando
`wi/Pii ≤ 10⁻¹⁰`, o erro é marcado como não detectável. O deslocamento externo é
`dx = K[:,i] · MDBi`, com exagero gráfico explícito. Isso representa sensibilidade
a um erro, não resíduos simulados, detecção de outliers, controle de testes
múltiplos ou teste de hipóteses posterior.

## Terreno compartilhado

`shared/terrarium.mjs` extrai de `nivelamento` a URL AWS, zoom 14, transformação
para pixel, decodificação RGB e amostragem pelo pixel com índice inteiro inferior.
Ambos usam esse carregador, que compartilha requisições em andamento, mantém cache,
permite nova tentativa e rejeita pixels ausentes. No nivelamento, uma falha agora
é informada em vez de introduzir uma altura fictícia de 100 m. Seu cálculo de
ajustamento e seus exemplos permanecem iguais.

A área rural tem centro em **25,454° S, 49,070° W** e extensão de 1300 × 1000 m,
sem restrições de ruas. A fonte é o mesmo MDT do nivelamento:
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) e
[documentação do formato Tilezen](https://github.com/tilezen/joerd/blob/master/docs/formats.md).
Nenhum arquivo de terreno é duplicado no repositório.

Preservam-se separadamente a elevação **H** do terreno, assumida como ortométrica,
a altura elipsoidal **h** e a componente local **U**. Usa-se `h = H + N₀`, com
**N₀ = 0 m como aproximação didática constante**, não como modelo geoidal validado
ou equivalência entre H e h. A origem recebe h₀ = H₀ + N₀. O JSON pode especificar
outro N₀ constante. O datum e a precisão da fonte não sustentam uma conversão para
levantamento real; trata-se de ensino de geometria e projeto.

A colocação de pontos intersecta iterativamente uma vertical ENU com a superfície
de alturas, usando a transformação geográfica inversa. A visibilidade é amostrada
a cada **meio pixel do zoom 14**, aproximadamente 4,3 m, incluindo os extremos da
linha instrumento/prisma. Retornam-se a menor folga e sua posição aproximada.
Folga inferior a −0,02 m bloqueia a visada: esse valor é tolerância numérica,
**não precisão do MDT**. Visadas bloqueadas ou sem elevação são excluídas de A.
O fundo colorido é apenas uma prévia mais grosseira; a visibilidade usa o
carregador original. Obstáculos menores que o pixel, edifícios e vegetação não
são resolvidos neste exercício.

## Escopo, arquivos e evolução

Esta entrega cobre **níveis 0–2 e confiabilidade**. O nível 2 usa uma área de
1,3 × 1,3 km no centro de Pato Branco, com origem em **26,229° S, 52,671° W**.
O recorte OSM incluído contém 288 vias, projetadas no mesmo referencial ENU local
da rede. As linhas são recortadas nos limites do exercício antes da consulta de
distância, desenho e aproximação.

Estações e pontos somente visados devem ficar **até 3,0 m horizontais do eixo de
uma rua**. A faixa azul representa essa região permitida, não a largura da via
ou suas calçadas. A aproximação opcional, inicialmente ligada, leva uma posição
inválida do canvas ao eixo mais próximo somente até 15 m de distância. Posições
já válidas mantêm seu afastamento. A prévia mostra a posição aproximada e o
deslocamento ou um marcador vermelho de rejeição. Desligue a aproximação para
colocação exata; **Enquadrar área** mostra todo o recorte.

A restrição vale para inclusão, arraste, coordenadas digitadas, importação e
pontos inativos. Coordenadas digitadas e JSON são validados sem aproximação
automática. Edições rejeitadas preservam a rede e o histórico de desfazer.
O JSON guarda `streetDataset` e a origem geográfica, não geometria de ruas
fornecida pelo usuário nem visibilidade em cache. Recorte/origem incompatíveis
são rejeitados. A API de cálculo do nível 2 é
`analyze(network, visibility, scenario)`; sem restrições de ruas, o cálculo é
recusado. Os arquivos JSON dos níveis 0/1 permanecem compatíveis.

Ambos os cenários reais usam o mesmo MDT, convenção de alturas e algoritmo de
visibilidade. A regra de ruas limita as posições de projeto; não acrescenta
observações nem altera a propagação de covariâncias. Os apoios iniciais são
papéis GNSS fictícios sobre ruas reais, não marcos geodésicos publicados. Uma
visada inicial pode estar bloqueada: inspecione a folga, mova a estação ou altere
HI/HT para redesenhar. Não são modelados edifícios, vegetação, pontes e túneis.
A regra de 3 m é didática; não implica precisão OSM de 3 m nem acesso legal à via.

Dados de ruas © colaboradores do OpenStreetMap, ODbL-1.0; a atribuição permanece
visível no canvas urbano. [data/README.md](data/README.md) registra fonte exata,
filtro, data, hashes e reprodução. Nenhuma API de ruas é consultada durante o uso.
Falhas no carregamento das ruas preservam o cenário anterior.

Ficam para etapas futuras: edifícios, centragem,
incertezas de HI/HT, curvatura/refração/desvio da vertical, metas de exercícios e
prévia mais detalhada de visadas candidatas. A comparação existente usa indicadores
determinísticos antes/depois. Não é um processador de observações de campo.

O JSON de versão 1 inclui pontos, papéis, apoio/covariância, HI/HT, visadas/componentes,
instrumento, estatística, cenário e origem ENU. `observationCovariance` opcional
define correlações entre componentes de visadas válidas/ativas, na ordem das visadas
e de direção/zenital/distância. Deve ser atualizado se a topologia mudar; tamanho
incompatível ou matriz não positiva definida são rejeitados. Limites: 100 pontos e
500 visadas dirigidas; uso esperado: dezenas de pontos e cerca de 500 componentes.
O cálculo ocorre ao soltar/editar, não a cada pixel de arraste.

`network/` contém o cálculo independente da interface. `app.mjs` coordena estado e
terreno assíncrono; `canvas.mjs` desenha e trata ponteiros; `inspector.mjs` apresenta
propriedades; `i18n.mjs` segue pares PT-BR/EN e atributos `data-t`, além das regras
de idioma do monorepositório. Apenas a preferência de idioma é compartilhada.

## Validação e dependências

```sh
npm test --prefix network_preanalysis
npm ci --prefix network_preanalysis
npx --prefix network_preanalysis playwright install chromium
npm run test:browser --prefix network_preanalysis
node test.js
```

Os testes numéricos exigem apenas Node 20+ e a biblioteca SVD incluída. A referência
independente usa diferenças finitas centradas e QR do NumPy/LAPACK para covariância;
o MDB usa distribuição normal e busca de raiz do SciPy. O arquivo de referência
registra as versões. Para regenerá-lo com NumPy/SciPy instalados:

```sh
python network_preanalysis/tests/generate_reference.py
```

A suíte verifica transformações, geometria/alturas, jacobianos, apoio GNSS em dois
pontos, interseções genéricas, deficiências de posto, covariância polar fechada,
correlações, elipses, redundância, MDB, confiabilidade externa, entradas inválidas,
JSON, terreno, idiomas, limite exato de ruas, aproximação, recorte, integridade
do conjunto de dados e posto/visibilidade no nível 2. O navegador testa ações reais de mouse/formulários,
importação/exportação, terreno rural/urbano, rejeição e aproximação no canvas,
rejeição de coordenadas digitadas/JSON, nova tentativa após falha das ruas, troca
rápida de cenário e tela pequena. A imagem
`tests/synthetic-terrain.png` é explicitamente sintética e torna a CI independente
de serviço externo. Defina `NETWORK_SCREENSHOTS=/tmp/pasta` para guardar capturas.

`vendor/ml-matrix.mjs` inclui **ml-matrix 6.12.1** e suas dependências transitivas,
com licenças MIT preservadas. Exporta apenas Matrix e SingularValueDecomposition.
Para reconstruir com esbuild 0.25.10, sem dependência de CDN na execução:

```sh
mkdir -p /tmp/network-preanalysis-deps
npm install --prefix /tmp/network-preanalysis-deps ml-matrix@6.12.1 esbuild@0.25.10
echo "export { Matrix, SingularValueDecomposition } from 'ml-matrix';" > /tmp/network-preanalysis-deps/entry.mjs
/tmp/network-preanalysis-deps/node_modules/.bin/esbuild /tmp/network-preanalysis-deps/entry.mjs --bundle --format=esm --minify --outfile=network_preanalysis/vendor/ml-matrix.mjs
```
