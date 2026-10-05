# Material de aula

`gravimetria.pdf` — 100 slides em português, no mesmo formato didático das outras aulas do
repositório, com apêndice técnico. A **base sobre gravidade** (Parte 1) está em linguagem de
ensino fundamental; o resto, de ensino médio, passo a passo.

É o terceiro vértice da série de referenciais: `sgr_terrestres` trata da posição (ITRS/ITRF),
`geoide_e_alturas` das altitudes (IHRS/IHRF) e esta aula da **gravidade (IGRS/IGRF)**. Vai da
lei de Newton até a integral de Stokes. **Molodensky, teluróide e quase-geoide ficam para a
próxima aula** — `quase_geoide.pdf`, descrita mais abaixo.

## O percurso

Abre com duas surpresas. O mesmo quilo de feijão, numa balança de mola, "pesa" 1,3 g a mais em
Porto Alegre que em Belém. E o chão sobe e desce duas vezes por dia com a maré terrestre, o que
um gravímetro percebe. Daí sai a tese: **um valor de g precisa dizer onde, quando e em qual
referencial**.

**Parte 1 — o que é a gravidade.** Por que as coisas caem, "para baixo" é para o centro, a pena
e o martelo da Apollo 15, massa × peso. Depois Newton: tudo puxa tudo, o canhão, as duas regras
(o dobro da massa dobra o puxão; o dobro da distância o reduz a um quarto, com o spray de tinta
para explicar o quadrado). Então a fórmula, G minúsculo e Cavendish. Seguem `g = GM/R² ≈ 9,82`,
o carrossel (gravidade = gravitação + rotação), Equador × polos, o relógio de Richer, o
Huascarán e as rochas densas. Fecha com o Gal e uma escadinha de nove ordens de grandeza.

**Parte 2 — como se mede.** Pêndulo, queda livre no vácuo (laser = metro, relógio atômico =
segundo), mola (relativo: só diferenças, deriva, escala) e supercondutor. A tabela
absoluto/relativo/supercondutor, e os satélites GRACE e GOCE. Depois, o que faz g mudar no
mesmo lugar, a altura do instrumento e a **ficha** que todo valor de g precisa ter.

**Parte 3 — o referencial.** Viena, Potsdam e o erro de 14 mGal, e a IGSN71 (1 854 estações,
±0,1 mGal). O **IGRS** (IAG, Res. nº 2, 2015) é a aceleração instantânea de queda livre no SI,
com três combinados: maré zero, atmosfera ISO 2533:1975 e polo do IERS. O **IGRF** reúne as
estações de referência, de comparação e núcleo, as comparações do CIPM, o AGrav, a Res. nº 4
(2019) e o AGGO. Há um alerta para o homônimo geomagnético. No caso brasileiro: RENEGA, a
tabela lida (latitude soma, altitude tira) e a rede do Paraná do simulador como densificação.

**Parte 4 — até o geoide.** Gravidade normal (GRS80) e anomalia `Δg = g − γ`, com as reduções
de ar-livre e de Bouguer. O **exemplo resolvido é a estação absoluta de Curitiba**: +54,0 mGal
ar-livre e −47,8 mGal Bouguer. Depois vêm a isostasia, o potencial perturbador `T = W − U`,
**Bruns** (`N = T/γ`), a equação fundamental e a **integral de Stokes**: cada pedacinho da Terra
vota, com o gráfico de S(ψ) e zeros em 39° e 118°. Fecha com as quatro exigências (a primeira é
o gancho para Molodensky), remover-calcular-restaurar, o MAPGEO2015 e o laço
IGRF → g → Δg → N → altitudes.

Cada ideia tem cor fixa em todas as figuras: <span>idealizado</span> (elipsoide, γ, sistema)
índigo, <span>medido</span> (g, gravímetros, frame) teal, <span>massa</span> âmbar,
<span>geoide/água</span> azul, e a <span>diferença</span> (anomalia, N) rosa.

As aulas companheiras são `sistemas_coordenadas/explanations/sgr_terrestres.pdf` (sistema ×
frame) e `historia_modelos_terrestres/explanations/geoide_e_alturas.pdf` (geoide, número
geopotencial, IHRS).

## Recompilar

```
cd rede_gravimetrica/explanations
latexmk -pdf gravimetria.tex
latexmk -c                            # limpa os auxiliares (o PDF é versionado)
```

As fontes de cada fato e número citados estão no cabeçalho do `.tex` e no slide
**A7 · Fontes**. Os números derivados (γ, anomalias de Curitiba, feijão, zeros de S(ψ)) foram
recalculados por script.

---

# A próxima aula: `quase_geoide.pdf` · The next class: `quase_geoide.pdf`

## Português

`quase_geoide.pdf` — **E quando as montanhas não saem do caminho?** Molodensky, o teluróide, o
quase-geoide e as altitudes normais. É a continuação direta de `gravimetria.pdf`, que fecha
anunciando este assunto. São **quatro partes, uma por aula de 50 minutos**, no mesmo formato
e com a mesma paleta: linguagem de ensino médio, uma ideia por slide, devagar. O apêndice
técnico fica no fim.

| aula | páginas do PDF | tema |
|---|---|---|
| 1 | 4–32 | a montanha no caminho |
| 2 | 33–64 | uma altura que não precisa da densidade |
| 3 | 65–93 | o problema de Molodensky |
| 4 | 94–119 | na prática: GNSS, quase-geoide e altitudes normais |
| apêndice | 120–126 | fórmulas completas e fontes |

Cada aula abre com **Onde paramos** e **As perguntas de hoje**, e fecha com **Para levar para
casa**, que responde às perguntas e anuncia a próxima aula. Os slides **Sua vez** e **Pare e
pense** mostram a resposta só no clique seguinte (é a mesma página repetida no PDF).

**Aula 1 — a montanha no caminho.** Recupera a corrente g → Δg → Stokes → N → H e puxa o elo
que range: a exigência de Stokes de "nenhuma massa acima do geoide". Um canal fininho ligado ao
mar mostra que, debaixo dos continentes, o geoide passa por dentro da rocha. Em Curitiba são
uns 900 m de rocha. O spray de tinta da aula anterior explica por que Stokes quer o espaço
vazio. As três saídas (fingir, tirar, amassar: ar-livre, Bouguer, Helmert) esbarram no mesmo
problema: quanto pesa a montanha? Vêm então a tabela de densidades e o chute de 2 670 kg/m³
(com o basalto do terceiro planalto paranaense) e o preço do chute em Curitiba: ±12 mGal na
anomalia de Bouguer. Depois, a altitude ortométrica H = C/ḡ, cujo fio de prumo atravessa a
montanha, e a conta de Poincaré–Prey passo a passo. O erro de H cresce com o quadrado da
altitude. Fecha com Molodensky (1909–1991) e a ideia de 1945: resolver tudo na superfície.

**Aula 2 — uma altura sem densidade.** O esforço C = Σ g Δn se mede com nível, mira e
gravímetro. Para virar metros, divide-se por uma gravidade, e a analogia do combustível (o
consumo real numa estrada inacessível × o consumo da tabela do fabricante) separa a altitude
ortométrica da **normal**, H* = C/γ̄. Em Curitiba, H* = 909,956 m para qualquer rocha. Depois:
as duas Terras (W e U), o **sósia** Q de cada ponto (U_Q = W_P), a prova de que o desenho e a
conta dão o mesmo H*, o **teluróide** (tellus, "chão"), a **anomalia de altura** ζ = h − H*,
e o **quase-geoide**, que aparece ao trocar a ordem das parcelas de h = H* + ζ. A separação
N − ζ ≈ Δg_B·H/γ̄ é deduzida em dois passos: −4,4 cm em Curitiba, metros nas grandes
cordilheiras.

**Aula 3 — o problema de Molodensky.** A mesma pergunta de Stokes, noutro palco: a fronteira é
a incógnita. A saída é o truque do ajustamento, X = X₀ + x (superfície = teluróide + ζ,
W = U + T). Entram a anomalia de Molodensky Δg = g_P − γ_Q, que é a ar-livre na superfície
(+54,0 mGal em Curitiba, para qualquer rocha), Bruns no ponto (ζ = T_P/γ_Q) e a equação
fundamental. Num terreno plano, a solução é Stokes; com relevo, entra a correção G₁ (vizinhos
pesados por 1/ℓ³) e a série G₂, G₃… Com GNSS a superfície é conhecida: problema de contorno
fixo e distúrbio δg = g_P − γ_P.

**Aula 4 — na prática.** H* = h − ζ, com cuidado com o sinal e com os referenciais. O modelo é
validado em pontos com GNSS e nivelamento (mínimos quadrados de novo). Seguem
remover-calcular-restaurar com colocação e o experimento do Colorado (~2 cm nas montanhas).
No Brasil: altitudes normais oficiais desde 30/07/2018 (REALT-2018), o que mudou nas RNs, e o
hgeoHNOR2020 (fator η, data de Imbituba e Santana; não é um quase-geoide gravimétrico puro).
Depois, quem usa que altitude no mundo e o elo com o IHRS (W_P = U_P + T_P, C = γ̄·H*). O cano
da aula do geoide volta com ζ no lugar de N, e a água continua descendo 28 cm. Fecha com
Stokes × Molodensky e as quatro aulas num slide.

Cores (as mesmas de `gravimetria.pdf`): idealizado (elipsoide, teluróide, γ, H*) índigo, medido
(g, C, h do GNSS) teal, massa/terreno âmbar, geoide/água azul, quase-geoide e ζ rosa. O
teluróide e o quase-geoide são tracejados porque não são superfícies de nível.

O simulador **Modelos Terrestres**, aba **Teluróide**, mostra em 3D as superfícies da aula 2.

## English

`quase_geoide_en.pdf` — **What if the mountains won't get out of the way?** Molodensky, the
telluroid, the quasigeoid and normal heights. It is the direct sequel to `gravimetria.pdf`,
whose last slide announces this topic. It has **four parts, one per 50-minute class**, in the
same format and palette as the other decks: high-school language, one idea per slide, slow
pacing, with a technical appendix at the end. The English and Portuguese PDFs come from the same
source file, so the slides, figures and numbers are identical and the page ranges in the table
above apply to both.

- **Class 1 — the mountain in the way.** Under the continents the geoid runs inside the rock;
  Stokes needs empty space above it, and both the reductions and the orthometric height
  H = C/ḡ need the rock density, which is only a guess (±12 mGal in Curitiba's Bouguer anomaly;
  the height error grows with H²). Molodensky's 1945 idea: solve everything on the surface.
- **Class 2 — a height without density.** The effort C = Σ g Δn is measured. Dividing it by
  normal gravity gives the **normal height** H* = C/γ̄ (fuel-consumption analogy). Then come the
  twin Q (U_Q = W_P), the **telluroid**, the **height anomaly** ζ = h − H*, the **quasigeoid**,
  and N − ζ ≈ Δg_B·H/γ̄ (−4.4 cm in Curitiba).
- **Class 3 — Molodensky's problem.** A free boundary-value problem solved like a least-squares
  adjustment (approximate + correction). Molodensky's anomaly Δg = g_P − γ_Q is the surface
  free-air anomaly. Bruns applies at the point, and the solution is Stokes + G₁ + …. With
  GNSS, it becomes a fixed boundary-value problem using the gravity disturbance δg.
- **Class 4 — in practice.** GNSS leveling H* = h − ζ, model validation, the Colorado
  experiment, Brazil's normal heights since 30 July 2018 (REALT-2018) and hgeoHNOR2020,
  height systems around the world, and the link to the IHRS.

The **Earth Models** simulator, **Telluroid** tab, shows the surfaces of class 2 in 3D.

## Recompilar · Rebuild

```
cd rede_gravimetrica/explanations
latexmk -pdf quase_geoide.tex          # português -> quase_geoide.pdf
latexmk -pdf quase_geoide_en.tex       # English   -> quase_geoide_en.pdf
latexmk -c quase_geoide.tex quase_geoide_en.tex
python3 quase_geoide_numeros.py        # refaz os números derivados / recomputes derived numbers
```

Todo texto visível passa por `\tr{português}{english}` e todo decimal por `\num{}`, que usa
vírgula em português e ponto em inglês. As fontes estão no cabeçalho do `.tex` e no slide
**A6 · Fontes**. · Every visible string goes through `\tr{português}{english}` and every decimal
through `\num{}` (comma in Portuguese, point in English). Sources are listed in the `.tex`
header and on slide **A6 · Sources**.
