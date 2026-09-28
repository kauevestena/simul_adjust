# Material de aula

`gravimetria.pdf` — 100 slides em português, no mesmo formato didático das outras aulas do
repositório, com apêndice técnico. A **base sobre gravidade** (Parte 1) está em linguagem de
ensino fundamental; o resto, de ensino médio, passo a passo.

É o terceiro vértice da série de referenciais: `sgr_terrestres` trata da posição (ITRS/ITRF),
`geoide_e_alturas` das altitudes (IHRS/IHRF) e esta aula da **gravidade (IGRS/IGRF)**. Vai da
lei de Newton até a integral de Stokes. **Molodensky, teluróide e quase-geoide ficam para a
próxima aula.**

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
