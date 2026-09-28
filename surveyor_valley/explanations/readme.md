# Material de aula

`poligonal_e_irradiacao.pdf` — 57 slides em português, no mesmo formato didático das outras
aulas do repositório: ensino médio, passo a passo, com apêndice técnico. **Só planimetria:
X e Y.**

> Nota: esta pasta fica ao lado do `index.html` que hoje é apenas a placa avisando que o jogo
> Surveyor Valley mudou de endereço. A aula é material independente.

## O percurso

**Parte 1 — a poligonal aberta.** Começa pela pergunta de onde vêm os números de uma planta,
passa pela separação entre **apoio** (poucos pontos, muito cuidado) e **detalhe** (muitos
pontos, rápido), e mostra que uma poligonal precisa de duas coisas para existir no mundo: um
ponto de partida e uma direção de partida. Os três tipos — fechada, enquadrada e aberta —
são apresentados pelo que realmente os separa: **existe ou não um confronto no fim**. Depois
vem o cálculo, e então a parte honesta: um erro de 1° no ângulo de P1 joga P3 a **três metros**
de distância, e a conta fecha exatamente igual. Como não há erro de fechamento para acusar,
uma seção inteira é dedicada ao cuidado de campo, que vira o único controle que sobra. Fecha
mostrando quando a poligonal aberta é de fato a ferramenta certa — túnel, mina, faixa de
estrada — e o cálculo da linha de fechamento.

**Parte 2 — irradiação.** O instrumento fica parado e varre os detalhes: um ângulo e uma
distância por ponto. É **a mesma regra de azimute** da Parte 1, com uma diferença que muda
tudo — como não se pisa no ponto calculado, o erro não se propaga. Termina em como conferir
um método que também não se confere sozinho: irradiar alguns pontos de duas estações.

A espinha da aula é uma regra só, usada do começo ao fim:

```
Az(vante) = Az(ré) + ângulo horário − 180°       (± 360° para caber em 0–360)
ΔX = d · sen(Az)        ΔY = d · cos(Az)
```

## Os números

Um único levantamento fictício costura as duas partes: a poligonal aberta M1 → P1 → P2 → P3
define as estações, e os detalhes são irradiados dessas mesmas estações. Nenhum número foi
digitado à mão — todos saem de `poligonal_irradiacao.js`, que refaz as contas e, no fim,
**reproduz os exercícios originais de dois dos livros consultados**:

```
node surveyor_valley/explanations/poligonal_irradiacao.js
```

## Fontes

Lidas em `~/Documents/material_estudo/livros/topografia`:

- **VEIGA, L. A. K.; ZANETTI, M. A. Z.; FAGGION, P. L.** — *Fundamentos de Topografia*
  (UFPR). Capítulo 9: tipos de poligonal, formas de obter o azimute de partida (com a
  recomendação da NBR 13133 de ter dois pontos do SGB em comum), método de irradiação,
  caderneta e croqui, e o exercício resolvido 9.3.1 — que o script reproduz ao centímetro.
- **SILVA, Irineu da** — *Topografia para engenharia: teoria e prática de geomática*.
  Seções 10.3 (ponto lançado), 10.4 (transporte de azimute) e 11.2 (poligonação: tipos,
  reconhecimento de campo, fontes de erro, centragem forçada com três tripés).
- **WOLF, P. R.; GHILANI, C. D.** — *Elementary Surveying*. Seção 9.1 (*open traverses should
  be avoided because they offer no means of checking*) e seção 10.13, com o Exemplo 10.11 da
  linha de fechamento — também reproduzido pelo script.

## Recompilar

```
cd surveyor_valley/explanations
latexmk -pdf poligonal_e_irradiacao.tex
latexmk -c                                # limpa os auxiliares (o PDF é versionado)
```
