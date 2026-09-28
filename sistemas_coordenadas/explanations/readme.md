# Material de aula

`sgr_terrestres.pdf` — 54 slides em português, no mesmo formato didático das outras aulas do
repositório: ensino médio, passo a passo, com apêndice técnico.

O `descricao.md` desta pasta registra que **"sistemas de coordenadas ≠ Sistemas Geodésicos de
Referência"**. O simulador mostra *como* converter entre (φ, λ, h), ECEF, ENU e plano local;
esta aula é sobre *sobre o quê* essas coordenadas se apoiam — exatamente o que o simulador
deixa de fora de propósito.

**Esta é a Parte 1: os referenciais terrestres.** Os celestes ficam para a Parte 2.

## O percurso

Abre com dois choques. O primeiro: o mesmo poste, plotado na planta de 1995 e no mapa de
hoje, cai a ~65 m de distância — e ninguém errou a medida. O segundo: a placa sul-americana
leva o Brasil para noroeste a pouco mais de 1 cm/ano, e o SIRGAS2000 está congelado na época
2000,4, o que já acumula cerca de 30 cm. Daí sai a tese da aula: **uma coordenada precisa
dizer em qual frame e em qual época**, ou não quer dizer nada.

A ideia central vem por analogia com o metro — a definição pela velocidade da luz (o
**sistema**, um texto, do qual não se mede nada) e a trena no bolso (o **frame**, coisa de
verdade, que obedece à definição com algum errinho). Depois: as quatro coisas que um sistema
precisa dizer (origem, orientação, escala e evolução no tempo), como ele vira frame (rede de
estações, as quatro técnicas — VLBI, SLR, GNSS, DORIS —, coordenada *e* velocidade, época), a
linhagem do ITRF, a transformação de Helmert de 7 e de 14 parâmetros, o dilema entre
referenciais presos à placa (ETRS89, NAD83, GDA2020) e presos ao planeta, e o que o WGS 84
realmente é. Fecha com o caso brasileiro: Córrego Alegre, SAD69, a campanha de maio de 2000,
a Resolução IBGE 01/2005 e o fim da transição em 25/02/2015.

Cada superfície de ideia tem cor fixa em todas as figuras: <span>sistema</span> índigo,
<span>frame</span> teal, <span>tempo</span> âmbar.

A aula companheira sobre o lado **vertical** da mesma dupla (IHRS e IHRF) é
`historia_modelos_terrestres/explanations/geoide_e_alturas.pdf`.

## Recompilar

```
cd sistemas_coordenadas/explanations
latexmk -pdf sgr_terrestres.tex
latexmk -c                            # limpa os auxiliares (o PDF é versionado)
```

As fontes de cada fato e número citados estão no cabeçalho do `.tex` e no slide
**A5 · Fontes**.
