# Pré-análise de Redes GNSS / GNSS Network Pre-Analysis

Português · [English](README.md)

Ferramenta didática PT-BR/EN para **projetar redes de linhas de base GNSS antes de ir a campo**.
Os pontos são colocados num mapa MapLibre (mapa base OpenFreeMap); pontos novos recebem a altitude
do MDT Terrarium da AWS, e as estações da RBMC podem ser usadas como apoio com *snap*. Para cada
vetor, a ferramenta monta a matriz variância-covariância (MVC) a priori a partir da precisão nominal
do receptor e a propaga pela rede (método paramétrico), prevendo precisão das coordenadas,
redundância e confiabilidade.

Sirva a raiz do monorepositório e abra `gnss_preanalysis/`:

```sh
python -m http.server 8000   # depois http://localhost:8000/gnss_preanalysis/
```

Não há etapa de build nem instalação de pacotes em tempo de execução. Módulos ES exigem HTTP, não
`file://`. O mapa base (`tiles.openfreemap.org`) e o MDT (`s3.amazonaws.com/elevation-tiles-prod`)
são baixados durante o uso; sem eles, o cálculo, os painéis e os arquivos JSON continuam funcionando.

## Como explorar

- **+ Ponto**: clique no mapa. Dentro do raio de *snap* de uma estação RBMC, o clique se ajusta a ela,
  que entra como apoio fixo com as coordenadas do catálogo. Caso contrário, cria-se um ponto novo e a
  altitude é amostrada do MDT.
- **↔ Linha de base**: clique em dois pontos (ou numa estação RBMC, que entra automaticamente). A linha
  vai para a **sessão ativa**; `+ S` cria uma sessão. Cada sessão tem nome e duração.
- **Selecionar / mover**: inspecione pontos, vetores e estações; arraste pontos novos para redesenhar.
  Desfazer/refazer, `Delete` e `Esc` funcionam pelo teclado.
- Modelo de precisão, erros de instalação, sessões, visualização e confiabilidade ficam no painel
  lateral. **Teoria** resume as fórmulas; **Matrizes** mostra A, Σ_Lb, P, N e Σxx.
- Quatro exemplos: rede com duas estações RBMC e quatro pontos em quatro sessões; irradiação sem
  redundância; sessão com quatro receptores e três linhas triviais; e linhas longas diante do guia de
  tempo do IBGE. Os projetos são salvos e abertos em JSON versionado.

## Modelo estocástico de um vetor

A precisão nominal é especificada por componente do sistema local, para uma linha de comprimento D (km):

```text
σH = aH + bH·D          (linear, padrão; conservadora)
σH = √(aH² + (bH·D)²)   (alternativa quadrática)          idem para σV
σE = σN = σH            (por componente, padrão)  ou  σE = σN = σH/√2  (especificação radial 2D)
Σ_ENU = diag(σE² + σc,i² + σc,j², σN² + σc,i² + σc,j², σU² + σh,i² + σh,j²)
Σ_ΔXYZ = Rᵀ Σ_ENU R      (R no ponto médio geodésico; rotação ENU da Navipedia)
```

σc e σh são os erros de centragem e de altura da antena de cada ocupação (padrão 1 mm e 2 mm para
pontos novos; 0 para CORS, com centragem forçada). Cada ponto pode ter valores próprios.

| Predefinição | Horizontal | Vertical | Fonte |
|---|---|---|---|
| Estático / estático rápido | 3 mm + 0,5 ppm | 5 mm + 0,5 ppm | catálogo típico (p. ex. Trimble R10/R12), RMS |
| Estático de alta precisão | 3 mm + 0,1 ppm | 3,5 mm + 0,4 ppm | idem; > 30 km exige efemérides precisas e até 24 h |
| RTK (linha única < 30 km) | 8 mm + 1 ppm | 15 mm + 1 ppm | idem |
| IBGE (2008), Tab. 3.2 | 10 mm + 1 ppm (≤ 20 km), 5 mm + 1 ppm (> 20 km) | igual | o IBGE não separa H e V; 10 mm é o extremo conservador de 5–10 mm |

As correlações em XYZ surgem apenas porque σU ≠ σH; uma matriz ENU isotrópica permanece diagonal (testado).

## Rede, datum e posto

As observações são ΔX, ΔY, ΔZ de cada vetor ativo; as incógnitas são X, Y, Z de todo ponto não fixo
usado por algum vetor. **A é a matriz de incidência ⊗ I₃** (−I na origem, +I no destino) e não depende
das coordenadas: a geometria entra apenas por Σ_Lb. P = Σ_Lb⁻¹ (σ₀² = 1 a priori) e Σxx = (AᵀPA)⁻¹.
N é acumulada a partir das linhas esparsas de A (no máximo dois ±1 cada). Após o equilíbrio das
colunas, usa-se a fatoração de Cholesky quando todos os pivôs superam 1e-10 (cada pivô é ≥ o menor
autovalor, então a rede tem posto completo com folga); caso contrário, o posto é decidido como em
`network_preanalysis`, pela SVD da matriz de projeto branqueada e equilibrada, com limiar relativo
`100·eps·max(n,u)·s_max`. Os testes verificam que os dois caminhos concordam. Uma rede com deficiência
de posto nunca apresenta precisão absoluta. As maiores redes permitidas (150 pontos, 600 vetores) são
calculadas em cerca de 0,3 s quando têm datum. Apoio fixo é eliminado; apoio estocástico acrescenta três pseudo-observações com σ ENU
diagonal rotacionado para XYZ. As linhas já carregam escala e orientação, então cada parte conectada
precisa só de suas 3 translações; partes sem apoio são apontadas (`datumMissing`), assim como partes
desconectadas e pontos sem vetores (deixados fora do cálculo).

Em cada ponto, Σ_XYZ é levada ao ENU local para σE, σN, σU e a elipse horizontal (1σ: 39,35 % de
probabilidade conjunta; 95 %: ×2,44774683). Elipses e vetores de efeito do MDB são desenhados com
exagero explícito; o modo "automático" escolhe um valor 1-2-5 para que a maior elipse tenha cerca de
10 % da extensão da rede. O painel também mostra a precisão relativa ajustada de cada vetor.

## Sessões

- **Linhas triviais.** Na ordem de desenho, um vetor cujos dois receptores já estão ligados por vetores
  anteriores da mesma sessão é dependente (r receptores dão r − 1 vetores independentes). Por padrão
  ele fica no ajustamento e é sinalizado (precisão otimista, Craymer & Beck 1992); "excluir" o remove.
- **Correlação de sessão (opcional).** Σ_sessão = D·blkdiag(Σ_estação)·Dᵀ + blkdiag(Σ_comprimento): cada
  estação contribui com metade do termo constante e sua instalação, partilhados por todos os vetores
  nela apoiados (ρ = ±0,5 para dois vetores iguais irradiados ou encadeados); o termo em ppm segue
  independente. Cada vetor mantém a variância do modelo independente (a menos da diferença de rotação
  entre estação e ponto médio, testado). Na predefinição IBGE, a constante partilhada é 5 mm da tabela.
- **Guia do IBGE (2008).** O comprimento de cada vetor é comparado à duração mínima da sessão
  (0–5 km: 5 min; 5–10 km: 10; 10–20 km: 10; 20–50 km: 120; 50–100 km: 180; > 100 km: 240) e, para
  receptores só L1, ao limite de 20 km. São avisos: o modelo nominal não depende do tempo.

## Confiabilidade

R = I − A Σxx AᵀP. A **redundância de um vetor** é o traço do seu bloco 3 × 3 (invariante ao
referencial; mostrada dividida por 3). O **MDB ao longo de E, N e U** de um vetor resolve o teste
bilateral de uma observação com covariância a priori conhecida: ∇ = δ₀ / √(eᵀ M e), com
M = P − PAΣxxAᵀP restrita ao vetor e e a direção unitária E, N ou U no seu ponto médio (δ₀ = 4,13
para α = 0,001 e poder 0,8; `network_preanalysis/network/reliability.mjs`). Vieses não observáveis
aparecem como não detectáveis. O efeito externo de um MDB sobre os pontos pode ser desenhado no mapa.
Não há correção para testes múltiplos.

## Altitudes e estações

- **MDT.** `shared/terrarium.mjs` amostra os AWS Terrain Tiles (Terrarium, z14, pixel vizinho por
  truncamento). O valor é tratado como uma altitude H do tipo ortométrica e **h = H + N₀**, com N₀
  constante definida por você (0 m por padrão, aproximação didática como em `network_preanalysis`).
  Enquanto o tile carrega, ou se falhar, o ponto mantém uma altitude aproximada com o aviso
  `heightAssumed`; ela nunca é apresentada como dado do MDT. A altitude quase não afeta a covariância
  (só via D), mas o aviso mantém o registro honesto.
- **RBMC.** `data/rbmc-stations.json` é um retrato fixo de 141 estações RBMC ativas/inativas
  (removidas ficam de fora). As coordenadas são **aproximadas** (decímetros; 134 do NGL, as demais de
  site logs e descritivos do IBGE): servem para projetar, não para calcular. Veja
  [data/README.md](data/README.md).
- **Suas estações.** "Importar estações" lê CSV (`id,lat,lon,h[,city,status]`, graus decimais, h
  elipsoidal; `;` com vírgula decimal também é aceito) ou GeoJSON de pontos (`properties.id`, `h` ou a
  terceira coordenada). IDs têm 4 caracteres; estações importadas substituem as do pacote com o mesmo ID.

## Validação

```sh
npm test --prefix gnss_preanalysis
npm ci --prefix gnss_preanalysis
npx --prefix gnss_preanalysis playwright install chromium
npm run test:browser --prefix gnss_preanalysis
```

`tests/generate_reference.py` é uma implementação independente em NumPy/SciPy (forma matricial do
modelo de sessão, mínimos quadrados densos, quantis normais do SciPy) cujo arquivo de referência cobre
nove casos: sessões independentes e correlacionadas, configurações quadrática/radial/alta precisão,
apoio estocástico, irradiação, linhas triviais mantidas/excluídas/correlacionadas e a predefinição do
IBGE com vetores longos. Os testes em Node comparam posto, redundância, Σxx, σ, elipses, σ a priori e
ajustado dos vetores e MDB. Também verificam o exemplo de 5 km (σX 6,60, σY 6,87, σZ 6,16 mm;
ρXY −0,29), o retrato da RBMC (somas de verificação, limites do Brasil, concordância com coordenadas
oficiais do IBGE), a importação CSV/GeoJSON, JSON e os dicionários. O teste de navegador usa a página
real com cliques de mouse (inserção, *snap*, desenho, arraste, sessões, configurações, arquivos,
layout de celular, falha do MDT), com OpenFreeMap e Terrarium respondidos por arquivos locais;
`GNSS_SCREENSHOTS=/tmp/dir` guarda capturas e `CHROME_PATH` escolhe um Chrome local.

```sh
python gnss_preanalysis/tests/generate_reference.py
```

## Estrutura e dependências

`model/` independe da interface (`stochastic.mjs`, `analysis.mjs`, `network.mjs`, `cors.mjs`,
`examples.mjs`). `app.mjs` guarda estado, histórico e eventos; `map.mjs`, a visão MapLibre;
`inspector.mjs`, os painéis; `geometry.mjs`, os desenhos no mapa; e `i18n.mjs`, o dicionário PT-BR/EN
(parâmetro `lang` da URL, depois `monorepo_lang` no armazenamento, depois o navegador; a troca atualiza
textos, URL e link do portal). Reutilizados sem cópia: MapLibre GL JS 4.7.1 de
`channel_tunnel_story/vendor`, o pacote SVD ml-matrix e as funções WGS84/ENU, de covariância e de
confiabilidade de `network_preanalysis`, e `shared/terrarium.mjs`.

## Limites

Precisão nominal em boas condições; sem geometria dos satélites (DOP/RDOP), multicaminho, obstruções,
cintilação ionosférica ou estratégia de processamento. A MVC formal do processamento real costuma ser
otimista e precisa de fator de variância: depois da campanha, teste σ̂₀² e estime a e b com vetores
repetidos. Coordenadas das estações e do MDT são valores de projeto. Limites: 150 pontos, 600 vetores,
60 sessões.

Referências: IBGE (2008) *Recomendações para levantamentos relativos estáticos – GPS*; Craymer, M. R.
& Beck, N. (1992) *Session versus baseline GPS processing*, Proc. ION GPS-92, 995–1004; Gemael, C. et al.
*Introdução ao ajustamento de observações: aplicações geodésicas*; Monico, J. F. G. (2008) *Posicionamento pelo GNSS*.
