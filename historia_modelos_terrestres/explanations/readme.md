# Material de aula

`geoide_e_alturas.pdf` — 51 slides em português, no mesmo formato didático das aulas de
`ajusta_planos/explanations/`: ensino médio, passo a passo, com apêndice técnico.

**Parte 1 — por que o geoide é necessário.** Abre com um cano que não funciona (dois pontos
com a mesma altura de GNSS, e a água correndo de um para o outro) e vai, um degrau por vez,
até `h = H + N`. Depois mostra que as superfícies de nível não são paralelas, que por isso um
circuito de nivelamento não fecha, e chega ao **número geopotencial** `C = W₀ − W` — a altura
medida em esforço, que não depende do caminho. As altitudes ortométrica, normal e dinâmica
aparecem como três formas de traduzir o mesmo `C` em metros; o caso real são os Grandes Lagos,
cujo datum (IGLD 1985) usa altitudes dinâmicas exatamente por isso.

**Parte 2 — um zero para o mundo inteiro.** O zoológico de data verticais nacionais, o
**IHRS** (IAG, Resolução nº 1, IUGG 2015: `W₀ = 62 636 853,4 m²/s²`, coordenadas no ITRF,
altura em números geopotenciais) e o **IHRF** que o materializa. Fecha com o **Everest**: por
que China e Nepal discordavam — neve contra rocha, e Mar Amarelo contra Baía de Bengala — e
como o valor conjunto de 8 848,86 m, anunciado em 08/12/2020 sobre um geoide gravimétrico
calculado com base no IHRS, encerrou setenta anos de disputa. O que mudou não foi a montanha:
foi o zero.

Acompanha o simulador desta pasta — as abas **Geóide** e **Teluróide** mostram em 3D as
superfícies que a aula descreve.

## Recompilar

```
cd historia_modelos_terrestres/explanations
latexmk -pdf geoide_e_alturas.tex
latexmk -c                            # limpa os auxiliares (o PDF é versionado)
```

As fontes de cada fato e número citados estão listadas no cabeçalho do `.tex` e no slide
**A5 · Fontes**.
