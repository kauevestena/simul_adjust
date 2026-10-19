
## Overview

This monorepo contains multiple independent serverless applications, each designed to run entirely on the user's side with no backend infrastructure required. Each application is self-contained with its own codebase, dependencies, and deployment configuration.

### Key Characteristics

- **Serverless Architecture**: All applications are built to execute without requiring server management or backend services
- **Client-Side Execution**: Applications run directly on the user's machine or browser environment
- **Independent Applications**: Each app has its own interface and model; the shared Terrarium loader is used by `nivelamento` and `network_preanalysis`.
- **Self-Contained**: Every application includes its own configuration, dependencies, and documentation

### Surveyor Valley has moved

The topography game that used to live in `surveyor_valley/` now has its own repository:
**[kauevestena/surveyor_valley](https://github.com/kauevestena/surveyor_valley)**, played at
[kauevestena.github.io/surveyor_valley](https://kauevestena.github.io/surveyor_valley/).
What is left in this directory is a notice pointing there.

### Bilingual Monorepo Ground Rule / Regra Fundamental Bilíngue

All applications, tools, simulators, and documentation within this monorepo are required to be **fully bilingual** (Portuguese `pt-BR` and English `en`):
- **Dynamic Language Switcher**: All simulators include a persistent language toggle switch (`PT` / `EN`).
- **Synchronized Preference**: Language state is shared across simulators via `localStorage('monorepo_lang')` and URL parameter `?lang=pt` / `?lang=en`.
- **Complete Terminology**: Both Portuguese and English technical nomenclature are faithfully maintained for Geodesy, Topography, and Least Squares Estimation (MMQ / LSE).

Todas as aplicações, ferramentas, simuladores e documentações deste monorepositório são obrigatoriamente **bilíngues** (Português `pt-BR` e Inglês `en`), contando com alternador de idioma integrado, preferência unificada e terminologia técnica especializada.

### Topographic Network Pre-Analysis / Pré-análise de Redes Topográficas

[`network_preanalysis/`](network_preanalysis/) is a bilingual PT-BR/EN design
laboratory for total-station networks: a 2D canvas, generic 3D ENU observations,
fixed/stochastic GNSS controls, predicted precision, redundancy and reliability.
It includes an ideal plane, real rural terrain and Pato Branco streets with a
3 m placement rule, using the same Terrarium loader as `nivelamento`. See its [technical documentation](network_preanalysis/README.md).

Laboratório de projeto de redes de estação total: interface 2D, cálculo 3D ENU,
apoio GNSS fixo/estocástico, precisão prevista, redundância e confiabilidade.
Inclui plano ideal, terreno rural e ruas de Pato Branco com limite de colocação
de 3 m, usando o carregador Terrarium compartilhado com `nivelamento`. Veja a [documentação em português](network_preanalysis/README.pt-BR.md).

### Transform Lab / Laboratório de Transformação 3D

[`transform_lab/`](transform_lab/) is a bilingual PT-BR/EN laboratory for *Ajustamento de Observações 2*:
it transforms a printed A4 reference grid (70 points, cm) into reflectorless total-station measurements (m)
with 3 rotations, 3 translations and an optional scale, by the combined (Gauss–Helmert) and parametric
(Gauss–Markov) methods, with four rotation parametrizations, distance constraint equations (*injunções*),
check points, 2D/3D views, a residual histogram, a theory page and a solution-comparison page. See its
[documentation](transform_lab/README.md).

Laboratório bilíngue para *Ajustamento de Observações 2*: transforma uma grade A4 impressa (70 pontos, cm) nas
medições de uma estação total sem prisma (m) com 3 rotações, 3 translações e escala opcional, pelos métodos
combinado e paramétrico, com quatro parametrizações da rotação, injunções de distância, pontos de verificação,
vistas 2D/3D, histograma dos resíduos, página de teoria e de comparação. Veja a
[documentação em português](transform_lab/README.pt-BR.md).

### Right-handed frames / Referenciais dextrogiros

Every simulator uses **right-handed** frames. The total-station local frame is `X = S·sinZ·sinHz`,
`Y = S·sinZ·cosHz`, `Z = S·cosZ` (azimuths grow clockwise from `Y` towards `X`), implemented once in
[`shared/total_station.mjs`](shared/total_station.mjs); `intersecao_re_3D` and `ajusta_planos` keep their own
copies and their tests check that they agree with it.

Todos os simuladores usam referenciais **dextrogiros**. O referencial local da estação total é
`X = S·senZ·senHz`, `Y = S·senZ·cosHz`, `Z = S·cosZ` (azimutes crescem no sentido horário, de `Y` para `X`),
implementado uma vez em [`shared/total_station.mjs`](shared/total_station.mjs); `intersecao_re_3D` e
`ajusta_planos` mantêm cópias próprias e seus testes verificam a concordância com ele.

### Getting Started

Refer to the individual README.md file in each application directory for specific setup instructions, system requirements, and execution guidelines.
