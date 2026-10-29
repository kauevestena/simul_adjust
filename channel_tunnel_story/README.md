# Beneath the Channel / Sob o Canal da Mancha

## English

Bilingual, client-side story in the `simul_adjust` monorepo: seven chapters from planning to operation, a geographic map with terrain, a 3D cutaway with two representative TBMs, and four learning experiments (including a vertical-datum illustration). Language order: URL (`en`, `pt`, `pt-BR`), `monorepo_lang`, browser language. Language switching preserves focus and chapter nodes. Portal links preserve language.

Serve the **repository root** (the cutaway reuses the existing camera simulator's locally licensed Three.js). No build, API key or backend is required. MapLibre is pinned and vendored locally; OpenFreeMap vector tiles and AWS Terrarium DEMs need internet. The story, cutaway and calculations work when external maps are unavailable. Terrain failure falls back to a flat map. On phones, the map stays compact above the story and the experiments appear in the reading column. Map attribution remains accessible.

```sh
npm ci --prefix channel_tunnel_story
npm test --prefix channel_tunnel_story
npx --prefix channel_tunnel_story playwright install --with-deps chromium firefox webkit
npm run test:browser --prefix channel_tunnel_story
xvfb-run -a env STORY_BROWSER=firefox npm run test:browser --prefix channel_tunnel_story
STORY_BROWSER=webkit npm run test:browser --prefix channel_tunnel_story
npm run test:live --prefix channel_tunnel_story
python -m http.server 8000
# http://localhost:8000/channel_tunnel_story/?lang=en#chapter-control
```

Browser tests use the real WebGL renderer and controlled terrain tiles for deterministic regressions; `test:live` separately requires successful real vector and elevation responses. Tests cover 1440, 390 and 320 px plus 844 × 390 landscape, all chapters, scroll/keyboard navigation, language, source links, axe WCAG A/AA checks, both 3D views, map failures and blocked storage. Screenshots go to ignored `test-results/`. CI also runs existing simulators' numerical/browser checks. For a deployed-site check:

```sh
STORY_BASE_URL=https://kauevestena.github.io/simul_adjust STORY_LIVE_MAP=1 node channel_tunnel_story/tests/browser.cjs
```

### What is historical, and what is invented?

See [SOURCE_AUDIT.md](SOURCE_AUDIT.md) for claim-level evidence, original publication dates, access limitations and the conflicting breakthrough accounts.

- **Story progression:** the solid orange segment indicates the current chapter's illustrative progression along a straight chord; the dashed line shows its full extent. It is **not** observed TBM position, historical time, or measured chainage. The 3D cutaway's two representative TBMs follow the same chapter cue, and users can manipulate their progress manually.
- **Map:** approximate portals and a straight geographic chord. No as-built axis, control stations or geological boundaries are inferred from this line. Terrain is surface elevation, not a reconstruction of bathymetry or bore depth; 1.6× exaggeration is disclosed.
- **Synthetic survey overlay:** an optional set of 13 illustrative stations and 12 sight lines appears as the chapter progresses; it is neither a surveyed control network nor a reconstructed historical traverse. Toggle it in the 3D cutaway.\n- **3D cutaway:** actual rotatable meshes, but invented layer boundaries, tunnel curves and deliberately unequal scales. Lithological ordering is contextual; geometry is not digitised from engineering drawings. The two animated machines stand for opposing drives, not the actual eleven machines. Progress is not historical date, speed or chainage.
- **Bearing experiment:** `d = L tan(Δα)`, with km converted to m and arcseconds to radians. Signed errors are allowed. It does not reproduce any historical breakthrough offset.
- **Traverse:** six synthetic 3 km legs, fixed y₀ = 0, unknown transverse y₁…y₆. Linearised observations are `yᵢ − yᵢ₋₁ = L Δαᵢ`. Optical noise (arcsec): `[0.8, -0.5, 1.2, -0.9, 0.3, -0.4]` plus the slider's common bias; optical σ = 2″. Optional independent gyro observations on legs 2, 4, 6: `[0.2, -0.3, 0.1]″`, σ = 0.8″. Weighted least squares solves `(AᵀPA)y = AᵀPl`; covariance is `(AᵀPA)⁻¹` using known a-priori sigmas, with no posterior variance scaling. Redundancy is 0 or 3. Unmodelled systematic bias can survive while formal uncertainty decreases. This is a 1D teaching adjustment, not a reconstructed 3D survey.
- **Monitoring:** two invented epochs, three stable references plus one target. Each epoch has independent 1 mm standard deviation. Estimate the common shift by averaging reference changes; subtract it from the target. `σ(corrected change) = √(2(1 + 1/3)) mm`. The displayed normal-theory interval is `±1.96σ`. A deliberately unstable reference invalidates this simple model; it is not a safety alarm threshold. Fixed difference noise in mm: `[+0.4, −0.6, +0.2, +0.3]`.

No historical observation dataset, deformation feed, geological mesh or as-built alignment is bundled. Obtaining a licensed, georeferenced engineering dataset is the prerequisite for a defensible reconstruction.

## Português

História bilíngue inteiramente no navegador: sete capítulos, mapa com relevo, corte 3D com duas tuneladoras representativas e quatro experimentos (incluindo uma ligação de datums altimétricos). Ordem do idioma: URL, `monorepo_lang`, navegador. A troca preserva foco e elementos dos capítulos; os links para o portal conservam o idioma.

Sirva a **raiz do repositório**: o corte reutiliza o Three.js local do simulador de câmera. Não há build, chave de API ou backend. MapLibre é local; os tiles OpenFreeMap e DEM Terrarium precisam de internet. Texto, corte e cálculos funcionam sem mapa externo; falha de relevo mantém o mapa plano. No celular, o mapa é compacto e os exercícios ficam na coluna de leitura. A atribuição permanece acessível.

Use os comandos acima (`?lang=pt` para português). Os testes usam renderização WebGL real e tiles controlados; `test:live` verifica os serviços externos separadamente. Há verificações em 1440, 390 e 320 px, além de 844 × 390 em paisagem de rolagem, teclado, sete capítulos, idiomas, fontes, cálculos, acessibilidade automatizada, falhas de mapa e armazenamento bloqueado. Isso não substitui testes em aparelhos físicos ou uma avaliação manual completa com leitor de tela.

### História e simulação

A [auditoria de fontes](SOURCE_AUDIT.md) registra evidências e limitações. A linha tracejada indica a corda inteira entre portais aproximados; o segmento laranja mostra apenas um avanço ilustrativo sincronizado ao capítulo, não a quilometragem ou data real de escavação. O controle do corte 3D permite avançar manualmente. A corda entre portais não é o eixo construído. Relevo superficial com exagero 1,6× não informa profundidade do túnel. O corte oferece uma rede didática opcional de 13 estações e 12 visadas sem posições históricas, exibidas conforme o avanço ilustrativo. O corte tem malhas 3D reais, mas limites geológicos, curvas e escalas inventados; o avanço das duas máquinas não representa cronologia ou produção real.

O erro angular usa `d = L tan(Δα)`. A poligonal sintética tem seis lados de 3 km e ajusta apenas coordenadas transversais linearizadas, com ponto inicial fixo; usa σ óptico = 2″ e σ giroscópico = 0,8″. As observações giroscópicas nos lados 2, 4, 6 elevam a redundância de 0 para 3. A covariância é a priori, `(AᵀPA)⁻¹`; um viés não modelado não desaparece por reduzir a incerteza formal. Os valores fixos do ruído estão listados na seção inglesa e no código.

O monitoramento usa duas épocas inventadas, três referências e um alvo. Estima-se o deslocamento comum pelas referências e subtrai-se do alvo. Com σ = 1 mm em cada época, `σ(Δ corrigido) = √(8/3) mm` e o intervalo normal de 95% é `±1,96σ`. Uma referência instável invalida o modelo; o intervalo não é um limite operacional de segurança. Todos os dados são sintéticos, não séries históricas.

Não há conjunto original de observações, modelo geológico georreferenciado ou eixo construído. Uma reconstrução defensável depende da obtenção de dados de engenharia com referência espacial e licença adequadas.


### Guided 3D experience / Experiência 3D guiada

- Scrolling/navigating to **control**, **underground traverses**, **excavation** or **breakthrough** opens the Three.js scene automatically. The **Map / Cutaway** buttons still work. The hero button offers a direct jump.
- The *control* scene renders one connected illustrative cross-Channel network including surface GPS signals; it is not the surveyed 1987 point network. The earlier CTG86 relied on terrestrial observations; GPS strengthened RTM87. Ground and satellite observations are not conflated.
- **Vertical reference** is shown separately via a datum-tie slider and `H ≈ h − N` teaching example. A historically reported 1988 datum revision supported NTM88; the displayed numeric slider is deliberately synthetic and is not an estimate from real data.
- The *traverse* scene reveals invented optical sight lines, stations and gyro-theodolite check symbols; switching gyro support changes the numerical weighted adjustment and 2D diagram.
- The *excavation* scene grows **three drawn, lined bores** from both shores. Only the service bore has the two representative TBM meshes. The scene stages are not historical time, geometry or excavation rates.
- **Follow TBM** activates a third-person chase view; **Overview** restores orbit control. The progress slider and play/pause change the visible bore and machinery. The target-monitoring and bearing-error sliders also update local SVG illustrations (exaggerated for visibility).

This is not a true boolean-subtracted 3D excavation mesh nor an as-built tunnel BIM model. Its surface-control diagram, lining, geometry, machine speeds, and proportions are interpretive educational graphics. A reconstruction would require licensed georeferenced alignments, geological data, control-network data and a documented survey frame.

### Português

Os capítulos de rede geodésica, poligonal, escavação e encontro ativam o corte 3D; os botões Mapa/Corte continuam disponíveis. A ligação de controle retrata uma rede de projeto única **com GPS em ambas as margens**, mas não exclusivamente com GPS: observações terrestres definiram a CTG86, reforçada pelo GPS para a RTM87. A compatibilização de altitudes é outra operação, vinculada à referência vertical NTM88; o slider mostra dados **hipotéticos**. A poligonal sintética apresenta estações e verificações giroscópicas. As galerias com revestimentos aparecem progressivamente e a opção **Seguir tuneladora** acompanha uma TBM em terceira pessoa. As curvas, proporções, velocidades e camadas são didáticas, não representam a obra como construída.
