# sistema_sensores

Simulador 3D interativo (PT-BR / EN) de **frustum duplo para câmeras de quadro embarcadas em veículo** para mapeamento de pavimento de estradas.

Interactive 3D simulator (PT-BR / EN) of **dual frame-camera frustums mounted on a survey vehicle** for road pavement mapping.

## Recursos / Features

- **Canvas 3D (Three.js)** com via pavimentada (asfalto procedural com marcação central em amarelo e faixas laterais brancas), veículo de levantamento com suporte telescópico ajustável, duas câmeras 3D, frustums volumétricos e projeções no solo.
- **Visualização exata da sobreposição**: recorte exato de polígonos convexos (Sutherland–Hodgman) destacando em verde a zona de sobreposição sobre o pavimento.
- **Eixos paralelos e convergentes**: inicia com eixos paralelos (`α = 0°`), permitindo ajustar o ângulo dos eixos (`-20°` a `+45°`) para cruzar acima, sobre ou abaixo do pavimento, com atalho direto **"Cruzar no solo"** (`α_solo = arctan(B·cos(pitch) / 2H)`).
- **Comparação Altura × Sobreposição**: gráfico interativo comparando a sobreposição em função da altura `H` para o ângulo atual versus eixos paralelos (clique no gráfico para ajustar `H`).
- **Métricas em tempo real**: sobreposição por área e lateral (%), largura sobreposta (m), largura total de varredura (swath), GSD (mm/px), razão B/H, ponto de cruzamento dos eixos e FOV (H × V).

## Como executar / How to run

Como o projeto usa ES Modules (`type="module"`), sirva a pasta com qualquer servidor HTTP local:

```bash
cd /home/kaue/tests/sistema_sensores
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador.

## Testes / Tests

```bash
node --test /home/kaue/tests/sistema_sensores/tests/model.test.mjs
```
