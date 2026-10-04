
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
It includes an ideal plane and real rural terrain using the same Terrarium loader
as `nivelamento`. See its [technical documentation](network_preanalysis/README.md).

Laboratório de projeto de redes de estação total: interface 2D, cálculo 3D ENU,
apoio GNSS fixo/estocástico, precisão prevista, redundância e confiabilidade.
Inclui plano ideal e terreno rural com o carregador Terrarium compartilhado
com `nivelamento`. Veja a [documentação em português](network_preanalysis/README.pt-BR.md).

### Getting Started

Refer to the individual README.md file in each application directory for specific setup instructions, system requirements, and execution guidelines.
