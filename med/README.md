# MED — laboratório de fundamentos

Aplicação estática independente, em português, para ensinar Medida Eletrônica de Distâncias. Abra `index.html` diretamente ou sirva a raiz do monorepo e acesse `/med/`. Não há instalação, compilação, CDN, fontes externas ou backend. Os links de aprofundamento requerem internet.

## Percurso de aula

Os dez tópicos preservam a sequência conceitual do texto original, mas substituem animações decorativas por investigações com grandezas observáveis:

1. Tempo de voo: percurso 2D, atraso em ns e erro em mm; animação com pausa e controle do instante.
2. Portadora/modulação: frequência, profundidade, intensidade de referência/retorno, sensibilidade e fase não observável sem modulação.
3. Ambiguidade: fases, λ = 2U, candidatos por frequência, alcance exclusivo, reconstrução e desafio com referência oculta.
4. Alvos: lei relativa de retorno de uma superfície lambertiana e seus limites.
5. Erros: zero, escala, ciclo e erro residual do prisma; decomposição e faixa nominal separadas.
6. Calibração: observações sintéticas, QR ponderado, resíduos, incertezas a priori, bases deficientes e CSV.
7. Atmosfera: erro e correção relativos à configuração, usando uma aproximação declarada de gás seco.
8. Trajeto: índice integrado em três segmentos e comparação de amostragem meteorológica; sem simulação de raio curvo.
9. Estação total: redução por ângulo zenital, alturas e propagação de incerteza.
10. Qualidade: séries reproduzíveis, desvio padrão, erro padrão da média e viés persistente.

Cada tópico contém objetivo, equações, unidades, interpretação dos resultados, hipótese de modelagem, investigação e resposta comentada. `teoria.md` oferece o texto de apoio revisado. Os modelos simplificados não geram correções operacionais ou certificados.

## Organização

- `physics.js`: modelos numéricos puros, utilizáveis também em Node (`require`).
- `lessons.js`: conteúdo de aula e referências verificáveis.
- `app.js`: controles, navegação, SVGs, animação e exportação; estado conservado por tópico na sessão.
- `style.css`: tema escuro do monorepo, navegação adaptativa, foco visível, tabelas roláveis e impressão.
- `physics.test.js`: referências numéricas independentes, invariantes físicas e casos degenerados.

Os endereços `#tempo`, `#modulacao`, `#fase`, `#alvos`, `#erros`, `#calibracao`, `#atmosfera`, `#trajeto`, `#estacao` e `#qualidade` abrem diretamente a lição correspondente. Navegação e controles usam elementos nativos acessíveis por teclado. Animações começam paradas e param de consumir quadros quando a página fica oculta.

## Verificação

Com Node.js 18 ou posterior:

```sh
node --check med/app.js
node --check med/lessons.js
node --check med/physics.js
node --test med/physics.test.js
```

Os testes cobrem tempo de ida e volta, U versus λ, o exemplo 3 123,456 m, fronteiras de fase e alcance, ausência de solução e de unicidade, conversão ppm/mm, recuperação de parâmetros independentes, covariância e ortogonalidade ponderada, bases de posto deficiente, sinais atmosféricos, integração segmentada, redução zenital, retorno relativo e séries reproduzíveis.

Verificação manual de interface para revisão em navegador:

- Percorrer os dez tópicos pelo teclado e pelos botões Anterior/Próximo; verificar links diretos e preservação de valores.
- Animar, pausar e mudar o instante no tempo de voo; retornar a outro tópico e confirmar parada da animação.
- Em fase, testar 0; 9,999; 10; 9 999,999 m, ativar frequências e ampliar o alcance para 20 km.
- Resolver o desafio com vírgula decimal; rejeitar texto parcial ou valores fora do intervalo; distinguir resposta compatível de solução única.
- Em calibração, selecionar uma distância repetida e o modelo completo na base com fases repetidas; ambos devem informar deficiência.
- Exportar o CSV e conferir observações e pesos contra a tabela.
- Abrir em tela estreita e com zoom de 200%; conferir controles, gráficos e rolagem das tabelas sem transbordamento da página.

Essa lista documenta a revisão visual recomendada; não é uma alegação de que testes de navegador foram executados.
