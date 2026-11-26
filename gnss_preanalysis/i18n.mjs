// PT-BR / EN dictionary pairs, t(), data-t / data-label / data-html conventions as in network_preanalysis.
export const words = {
  title: ['Pré-análise de Redes GNSS', 'GNSS Network Pre-Analysis'],
  subtitle: ['LINHAS DE BASE · SESSÕES · PRECISÃO A PRIORI', 'BASELINES · SESSIONS · A PRIORI PRECISION'],
  portal: ['Simuladores', 'Simulators'], language: ['Idioma', 'Language'], theory: ['Teoria', 'Theory'], help: ['Como usar', 'How to use'],
  examples: ['Exemplo', 'Example'], exNetwork: ['Rede · 2 RBMC + 4 pontos, 4 sessões', 'Network · 2 RBMC + 4 points, 4 sessions'],
  exRadial: ['Irradiação · sem redundância', 'Radial survey · no redundancy'], exTrivial: ['Linhas triviais · sessão com 4 receptores', 'Trivial baselines · 4-receiver session'],
  exLong: ['Linhas longas · guia do IBGE', 'Long baselines · IBGE guide'], exEmpty: ['Rede vazia', 'Empty network'],
  basemap: ['Mapa base', 'Basemap'], save: ['Salvar GeoJSON', 'Save GeoJSON'], load: ['Abrir GeoJSON', 'Open GeoJSON'],
  saveTitle: ['Salvar GeoJSON: pontos e linhas de base com os resultados (duas camadas no QGIS)', 'Save GeoJSON: points and baselines with the results (two layers in QGIS)'],
  loadTitle: ['Abrir GeoJSON salvo aqui (também aceita o .json antigo)', 'Open GeoJSON saved here (older .json files also work)'],
  importCors: ['Importar estações', 'Import stations'], panel: ['Propriedades', 'Properties'], tools: ['Ferramentas', 'Tools'],
  select: ['Selecionar / mover', 'Select / move'], point: ['Ponto', 'Point'], baseline: ['Linha de base', 'Baseline'], delete: ['Excluir', 'Delete'],
  activeSession: ['Sessão ativa', 'Active session'], addSession: ['Nova sessão', 'New session'], undo: ['Desfazer', 'Undo'], redo: ['Refazer', 'Redo'],
  fit: ['Enquadrar', 'Fit network'], map: ['Mapa da rede', 'Network map'],
  mapUnavailable: ['Mapa indisponível.', 'Map unavailable.'],
  mapUnavailableBody: [' O cálculo continua funcionando; verifique a conexão ou o suporte a WebGL.', ' Computation still works; check the connection or WebGL support.'],
  loading: ['Consultando o MDT…', 'Sampling the DEM…'], network: ['Rede', 'Network'],
  precisionModel: ['Modelo de precisão (a priori)', 'Precision model (a priori)'], preset: ['Precisão nominal', 'Nominal precision'],
  pStatic: ['Estático / estático rápido · 3 mm + 0,5 ppm', 'Static / fast static · 3 mm + 0.5 ppm'],
  pHpStatic: ['Estático de alta precisão · 3 mm + 0,1 ppm', 'High-precision static · 3 mm + 0.1 ppm'],
  pRtk: ['RTK · 8 mm + 1 ppm', 'RTK · 8 mm + 1 ppm'], pIbge: ['IBGE (2008), Tab. 3.2', 'IBGE (2008), Table 3.2'], pCustom: ['Personalizado', 'Custom'],
  aH: ['a horizontal (mm)', 'Horizontal a (mm)'], bH: ['b horizontal (ppm)', 'Horizontal b (ppm)'],
  aV: ['a vertical (mm)', 'Vertical a (mm)'], bV: ['b vertical (ppm)', 'Vertical b (ppm)'],
  combination: ['Combinação de a e b', 'Combining a and b'], linear: ['Linear: a + b·D (conservadora)', 'Linear: a + b·D (conservative)'],
  quadratic: ['Quadrática: √(a² + (b·D)²)', 'Quadratic: √(a² + (b·D)²)'],
  horizontalSpec: ['Precisão horizontal do catálogo', 'Catalogue horizontal precision'],
  perComponent: ['Por componente: σE = σN = σH', 'Per component: σE = σN = σH'], radial2d: ['Radial 2D: σE = σN = σH/√2', '2D radial: σE = σN = σH/√2'],
  frequency: ['Receptores', 'Receivers'], dual: ['Multifrequência (L1/L2…)', 'Multi-frequency (L1/L2…)'], single: ['Somente L1', 'L1 only'],
  presetStatic: ['Valores típicos de catálogo (RMS ≈ 1σ), p. ex. folha de dados Trimble R10/R12, estático e estático rápido.', 'Typical catalogue values (RMS ≈ 1σ), e.g. the Trimble R10/R12 data sheet, static and fast static.'],
  presetHpStatic: ['Estático de alta precisão: ocupações longas; acima de 30 km o fabricante exige efemérides precisas e até 24 h.', 'High-precision static: long occupations; above 30 km the manufacturer requires precise ephemerides and up to 24 h.'],
  presetRtk: ['RTK com linha única < 30 km (catálogo).', 'Single-baseline RTK < 30 km (catalogue).'],
  presetIbge: ['IBGE (2008), Tab. 3.2: 5–10 mm + 1 ppm até 20 km (usa 10 mm, o extremo conservador) e 5 mm + 1 ppm acima, com sessões longas. A tabela não separa horizontal e vertical.', 'IBGE (2008), Table 3.2: 5–10 mm + 1 ppm up to 20 km (10 mm used, the conservative end) and 5 mm + 1 ppm beyond, with long sessions. The table does not separate horizontal and vertical.'],
  presetCustom: ['Valores definidos por você.', 'Values you define.'],
  formula: ['σ = a + b·D ou √(a² + (b·D)²); D em km, b em ppm (= mm/km).', 'σ = a + b·D or √(a² + (b·D)²); D in km, b in ppm (= mm/km).'],
  setupErrors: ['Erros de instalação (por ocupação)', 'Setup errors (per occupation)'],
  setupNote: ['Somados nas duas extremidades de cada vetor, como a centragem do instrumento e do alvo na topografia clássica. Estações RBMC têm centragem forçada em pilar.', 'Added at both ends of each vector, like instrument and target centering in classical surveying. RBMC stations use forced centering on a pillar.'],
  newCentering: ['Ponto novo · centragem σc (mm)', 'New point · centering σc (mm)'], newHeight: ['Ponto novo · altura da antena σh (mm)', 'New point · antenna height σh (mm)'],
  corsCentering: ['CORS · centragem σc (mm)', 'CORS · centering σc (mm)'], corsHeight: ['CORS · altura σh (mm)', 'CORS · height σh (mm)'],
  sessions: ['Sessões', 'Sessions'], sessionCorrelation: ['Correlacionar linhas da mesma sessão', 'Correlate baselines of the same session'],
  trivialHandling: ['Linhas triviais (dependentes)', 'Trivial (dependent) baselines'], trivialFlag: ['Manter e avisar', 'Keep and warn'],
  trivialExclude: ['Excluir automaticamente', 'Exclude automatically'],
  sessionNote: ['Com r receptores numa sessão há r − 1 linhas independentes. Correlação: cada estação contribui com metade do termo constante e sua instalação, partilhados pelas linhas que nela se apoiam (ρ ≈ ±0,5); o termo em ppm é independente por linha.', 'With r receivers in a session there are r − 1 independent baselines. Correlation: each station contributes half the constant term plus its setup, shared by the baselines using it (ρ ≈ ±0.5); the ppm term is independent per baseline.'],
  sessionLabel: ['Nome', 'Name'], duration: ['Duração (min)', 'Duration (min)'], receivers: ['receptores', 'receivers'],
  lines: ['linhas', 'baselines'], dependentShort: ['triviais', 'trivial'], makeActive: ['Ativar', 'Make active'], removeSession: ['Excluir sessão', 'Delete session'],
  layers: ['Visualização', 'View'], labels: ['Rótulos dos pontos', 'Point labels'], ellipses: ['Elipses de erro', 'Error ellipses'],
  precisionLabels: ['Rótulos com σ horizontal / σU', 'Labels with horizontal σ / σU'], redundancyColor: ['Colorir linhas pela redundância', 'Colour baselines by redundancy'],
  corsLayer: ['Estações (RBMC e importadas)', 'Stations (RBMC and imported)'], corsInactive: ['Mostrar estações inativas', 'Show inactive stations'], hillshade: ['Relevo sombreado (MDT)', 'Hillshade (DEM)'],
  snapCors: ['Ajustar cliques às estações (snap)', 'Snap clicks to stations'], confidence: ['Elipse', 'Ellipse'],
  oneSigma: ['1σ · 39,35% em 2D', '1σ · 39.35% in 2D'], confidence95: ['95% em 2D', '95% in 2D'], exaggeration: ['Exagero gráfico ×', 'Display exaggeration ×'],
  snapRadius: ['Raio do snap (px)', 'Snap radius (px)'], autoExaggeration: ['Exagero automático das elipses', 'Automatic ellipse exaggeration'], geoid: ['N₀ do MDT (m): h = H + N₀', 'DEM N₀ (m): h = H + N₀'],
  reliability: ['Confiabilidade', 'Reliability'], alpha: ['Significância α', 'Significance α'], power: ['Poder 1−β', 'Power 1−β'],
  reliabilityNote: ['MDB ao longo de E, N e U de cada vetor: teste bilateral de uma observação, covariância a priori conhecida, sem correção para testes múltiplos.', 'MDB along E, N and U of each vector: two-sided single-observation test, known a priori covariance, no multiple-testing correction.'],
  clearEffect: ['Limpar vetores de efeito', 'Clear effect vectors'], compare: ['Fixar referência de comparação', 'Pin comparison baseline'],
  matrix: ['Matrizes', 'Matrices'], close: ['Fechar', 'Close'],
  credits: ['Mapa © OpenFreeMap · OpenMapTiles · OpenStreetMap. Elevação: AWS Terrain Tiles (Terrarium). Estações: lista SIRGAS (RBMC/IBGE) com coordenadas aproximadas do NGL; as coordenadas oficiais estão nos descritivos do IBGE.', 'Map © OpenFreeMap · OpenMapTiles · OpenStreetMap. Elevation: AWS Terrain Tiles (Terrarium). Stations: SIRGAS list (RBMC/IBGE) with approximate NGL coordinates; official coordinates are in the IBGE station reports.'],
  matrixHint: ['Ordem das incógnitas (X, Y, Z dos pontos não fixos) e das observações (ΔX, ΔY, ΔZ de cada vetor) abaixo. Metros e m²; P inclui os apoios estocásticos.', 'Order of unknowns (X, Y, Z of non-fixed points) and observations (ΔX, ΔY, ΔZ of each vector) below. Metres and m²; P includes stochastic controls.'],
  matrixLimited: ['Prévia limitada a 40 linhas/colunas. Baixe as matrizes completas.', 'Preview limited to 40 rows/columns. Download the complete matrices.'],
  matrixSave: ['Baixar matrizes (JSON)', 'Download matrices (JSON)'],
  selectHint: ['Clique em um ponto, linha ou estação. Arraste pontos novos para redesenhar.', 'Click a point, baseline or station. Drag new points to redesign.'],
  pointHint: ['Clique no mapa para criar um ponto; perto de uma estação, o clique se ajusta a ela.', 'Click the map to add a point; near a station, the click snaps to it.'],
  baselineHint: ['Escolha o primeiro ponto (ou uma estação RBMC). Esc cancela.', 'Choose the first point (or an RBMC station). Esc cancels.'],
  baselineTargetHint: ['Agora o segundo ponto. A linha entra na sessão {session}.', 'Now the second point. The baseline goes to session {session}.'],
  deleteHint: ['Clique em um ponto ou linha para excluir.', 'Click a point or baseline to delete.'],
  points: ['Pontos', 'Points'], baselines: ['Linhas', 'Baselines'], observations: ['Observações n', 'Observations n'], unknowns: ['Incógnitas u', 'Unknowns u'],
  dof: ['Redundância n − u', 'Redundancy n − u'], worstH: ['Maior semieixo · 1σ', 'Largest semi-axis · 1σ'], worstU: ['Maior σU', 'Largest σU'],
  lowestR: ['Menor redundância de vetor', 'Lowest vector redundancy'], trivialCount: ['triviais', 'trivial'],
  solved: ['Rede determinável', 'Network determinable'], unsolved: ['Rede indeterminada', 'Network underdetermined'], empty: ['Rede sem linhas de base', 'Network without baselines'],
  summary: ['Resumo da rede', 'Network summary'], warnings: ['Avisos e critérios', 'Warnings and criteria'], noWarnings: ['Nenhum aviso.', 'No warnings.'],
  emptySelection: ['Clique em um ponto, linha de base ou estação para inspecionar.', 'Click a point, baseline or station to inspect.'],
  label: ['Rótulo', 'Label'], kind: ['Tipo', 'Type'], kindNew: ['Ponto novo', 'New point'], kindCors: ['Estação CORS', 'CORS station'],
  control: ['Papel no datum', 'Datum role'], free: ['Desconhecido', 'Unknown'], fixed: ['Apoio fixo', 'Fixed control'], stochastic: ['Apoio estocástico', 'Stochastic control'],
  sigmaControl: ['σE / σN / σU do apoio (mm)', 'Control σE / σN / σU (mm)'], latitude: ['Latitude (°)', 'Latitude (°)'], longitude: ['Longitude (°)', 'Longitude (°)'],
  height: ['Altitude elipsoidal h (m)', 'Ellipsoidal height h (m)'], heightSource: ['Origem de h', 'Source of h'],
  terrain: ['MDT AWS (h = H + N₀)', 'AWS DEM (h = H + N₀)'], cors: ['Coordenadas da estação', 'Station coordinates'], manual: ['Digitada', 'Typed'],
  pending: ['Aguardando o MDT (aproximada)', 'Waiting for the DEM (approximate)'], missing: ['MDT indisponível (aproximada)', 'DEM unavailable (approximate)'],
  setupOverride: ['Instalação própria: σc / σh (mm)', 'Own setup: σc / σh (mm)'], useDefault: ['vazio = padrão', 'empty = default'],
  apply: ['Aplicar', 'Apply'], deletePoint: ['Excluir ponto', 'Delete point'], predicted: ['Precisão prevista (1σ)', 'Predicted precision (1σ)'],
  major: ['Semieixo maior', 'Major semi-axis'], minor: ['Semieixo menor', 'Minor semi-axis'], azimuth: ['Azimute da elipse', 'Ellipse azimuth'],
  notDetermined: ['Ponto fora do cálculo (sem linhas ou rede indeterminada).', 'Point not computed (no baselines or underdetermined network).'],
  fixedNote: ['Apoio fixo: coordenadas eliminadas do ajustamento (σ = 0).', 'Fixed control: coordinates eliminated from the adjustment (σ = 0).'],
  session: ['Sessão', 'Session'], activeLine: ['Linha ativa', 'Active baseline'], length: ['Comprimento', 'Length'],
  aprioriSigma: ['σ a priori do vetor (E / N / U)', 'Vector a priori σ (E / N / U)'], adjustedSigma: ['σ após o ajustamento (E / N / U)', 'σ after adjustment (E / N / U)'],
  correlations: ['Correlações em XYZ (ρXY / ρXZ / ρYZ)', 'XYZ correlations (ρXY / ρXZ / ρYZ)'], sigmaXYZ: ['σ em X / Y / Z', 'σ in X / Y / Z'],
  redundancy: ['Redundância do vetor (traço/3)', 'Vector redundancy (trace/3)'], mdb: ['MDB ao longo de E / N / U', 'MDB along E / N / U'],
  undetectable: ['não detectável', 'undetectable'], ibgeGuide: ['Guia IBGE: sessão mínima', 'IBGE guide: minimum session'],
  trivialYes: ['Linha trivial: combinação de outras linhas da mesma sessão.', 'Trivial baseline: combination of other baselines of the same session.'],
  trivialExcludedNote: ['Excluída do cálculo (linhas triviais: excluir).', 'Excluded from the computation (trivial baselines: exclude).'],
  effectE: ['Efeito MDB E', 'MDB effect E'], effectN: ['Efeito MDB N', 'MDB effect N'], effectU: ['Efeito MDB U', 'MDB effect U'],
  effectShown: ['Deslocamentos ampliados pelo exagero gráfico. Maior: {value}.', 'Displacements enlarged by the display exaggeration. Largest: {value}.'],
  deleteBaseline: ['Excluir linha', 'Delete baseline'], station: ['Estação', 'Station'], status: ['Situação', 'Status'],
  stActive: ['ativa', 'active'], stInactive: ['inativa', 'inactive'], stUnverified: ['não verificada nesta cópia', 'not verified in this snapshot'],
  networks: ['Redes', 'Networks'], agencies: ['Instituições', 'Agencies'], coordSource: ['Coordenadas', 'Coordinates'],
  srcNgl: ['aproximadas do NGL (ITRF)', 'approximate, NGL (ITRF)'], srcLog: ['posição aproximada do site log', 'site-log approximate position'],
  srcIbge: ['oficiais SIRGAS2000 (descritivo IBGE)', 'official SIRGAS2000 (IBGE report)'], srcImport: ['importadas por você', 'imported by you'],
  importedStation: ['Estação importada', 'Imported station'], hFile: ['Do arquivo', 'From the file'], hConstant: ['Constante (assistente)', 'Constant (wizard)'],
  addToNetwork: ['Adicionar à rede', 'Add to network'], inNetwork: ['Já está na rede.', 'Already in the network.'], reference: ['Fonte', 'Source'],
  legendNew: ['Ponto novo', 'New point'], legendFixed: ['Apoio fixo (RBMC)', 'Fixed control (RBMC)'], legendStochastic: ['Apoio estocástico', 'Stochastic control'],
  legendCors: ['Estação RBMC fora da rede', 'RBMC station not in the network'], legendTrivial: ['Linha trivial (tracejada)', 'Trivial baseline (dashed)'],
  legendImported: ['Estação importada fora da rede', 'Imported station not in the network'],
  legendEllipse: ['Elipses ×{x} · {conf}', 'Ellipses ×{x} · {conf}'], legendRedundancy: ['Redundância: vermelho 0 → verde 1', 'Redundancy: red 0 → green 1'],
  comparison: ['Antes → agora', 'Before → now'],
  imported: ['Estações importadas: {count}.{details}', 'Stations imported: {count}.{details}'],
  importedPoints: ['Pontos novos importados na rede: {count}.{details}', 'New points imported into the network: {count}.{details}'],
  detailControl: ['{count} na rede como apoio', '{count} added to the network as control'], detailReplaced: ['{count} substituída(s)', '{count} replaced'],
  detailRenamed: ['{count} renomeada(s)', '{count} renamed'], detailSkipped: ['{count} ignorada(s)', '{count} skipped'],
  detailMissing: ['{count} sem MDT (h aproximada)', '{count} without the DEM (approximate h)'],
  importRemoved: ['Estações importadas removidas (Desfazer as recupera).', 'Imported stations removed (Undo brings them back).'],
  openedInWizard: ['O arquivo não é uma rede salva: os pontos foram abertos no assistente de importação.', 'The file is not a saved network: its points were opened in the import wizard.'],
  notProject: ['Arquivo não reconhecido: abra um GeoJSON salvo aqui ou use “Importar estações”.', 'File not recognised: open a GeoJSON saved here or use “Import stations”.'],
  mm: ['mm', 'mm'], km: ['km', 'km'], min: ['min', 'min'],
  // Import wizard
  importTitle: ['Importar estações ou pontos', 'Import stations or points'], stepFile: ['Arquivo', 'File'], stepColumns: ['Colunas', 'Columns'],
  stepImport: ['Importar', 'Import'], back: ['Voltar', 'Back'], next: ['Avançar', 'Next'], importRun: ['Importar', 'Import'],
  dropHint: ['Arraste um arquivo aqui ou clique para escolher', 'Drop a file here or click to choose'],
  importFormats: ['GeoJSON de pontos, JSON, CSV, TSV, “;” ou espaços. Bastam latitude e longitude (decimal, vírgula decimal ou GMS como 25°26′54″S); ID, nome e h são opcionais.', 'GeoJSON points, JSON, CSV, TSV, “;” or spaces. Latitude and longitude are enough (decimal, decimal comma or DMS such as 25°26′54″S); ID, name and h are optional.'],
  chooseFile: ['Escolher arquivo', 'Choose file'], pasteLabel: ['…ou cole o conteúdo', '…or paste the content'], readPasted: ['Ler texto colado', 'Read pasted text'],
  importCurrent: ['Este projeto tem {count} estação(ões) importada(s).', 'This project has {count} imported station(s).'],
  importRemove: ['Remover estações importadas', 'Remove imported stations'],
  detectedJson: ['GeoJSON/JSON: {count} ponto(s); {skipped} feição(ões) que não são pontos ignorada(s).', 'GeoJSON/JSON: {count} point(s); {skipped} non-point feature(s) ignored.'],
  detectedTable: ['Tabela: {rows} linha(s) de dados, {columns} coluna(s).', 'Table: {rows} data row(s), {columns} column(s).'],
  delimiter: ['Separador', 'Delimiter'], delimAuto: ['Automático', 'Automatic'], delimComma: ['Vírgula', 'Comma'], delimSemicolon: ['Ponto e vírgula', 'Semicolon'],
  delimTab: ['Tabulação', 'Tab'], delimPipe: ['Barra vertical |', 'Pipe |'], delimSpace: ['Espaços', 'Spaces'], headerRow: ['Primeira linha é cabeçalho', 'First row is a header'],
  coordsFrom: ['Coordenadas', 'Coordinates'], coordsGeometry: ['Da geometria (GeoJSON)', 'From the geometry (GeoJSON)'], coordsProperties: ['Das propriedades', 'From the properties'],
  mapLat: ['Latitude', 'Latitude'], mapLon: ['Longitude', 'Longitude'], mapH: ['Altitude elipsoidal h', 'Ellipsoidal height h'], mapId: ['Identificador', 'Identifier'],
  mapName: ['Nome / cidade', 'Name / city'], mapStatus: ['Situação', 'Status'], automaticId: ['— automático —', '— automatic —'],
  chooseColumn: ['— escolha —', '— choose —'], noneColumn: ['— nenhuma —', '— none —'], zCoordinate: ['Coordenada Z da geometria', 'Geometry Z coordinate'],
  swapLatLon: ['Trocar latitude ↔ longitude', 'Swap latitude ↔ longitude'],
  swapHint: ['Há latitudes fora de ±85° que seriam longitudes válidas: as colunas parecem trocadas.', 'Some latitudes beyond ±85° would be valid longitudes: the columns look swapped.'],
  heightMode: ['Altitude h', 'Height h'], heightFile: ['Do arquivo (vazia → MDT)', 'From the file (empty → DEM)'], heightDem: ['Sempre do MDT (h = H + N₀)', 'Always from the DEM (h = H + N₀)'],
  heightConstant: ['Constante', 'Constant'], constantHeight: ['Valor constante (m)', 'Constant value (m)'], idPrefix: ['Prefixo dos IDs automáticos', 'Prefix of automatic IDs'],
  importValid: ['{valid} de {total} válida(s)', '{valid} of {total} valid'], importInvalid: ['{count} rejeitada(s)', '{count} rejected'],
  importAutoIds: ['{count} ID(s) automático(s)', '{count} automatic ID(s)'], importRenamed: ['{count} ID(s) repetido(s) renomeado(s)', '{count} repeated ID(s) renamed'],
  importDemCount: ['{count} altitude(s) virão do MDT', '{count} height(s) will come from the DEM'],
  importBbox: ['Latitude {lat0}° a {lat1}° · longitude {lon0}° a {lon1}°', 'Latitude {lat0}° to {lat1}° · longitude {lon0}° to {lon1}°'],
  importName: ['Nome', 'Name'], importFromDem: ['MDT', 'DEM'],
  importPreviewNote: ['Prévia das primeiras linhas (* = ID automático). Os pontos válidos aparecem em laranja no mapa.', 'Preview of the first rows (* = automatic ID). Valid points are shown in orange on the map.'],
  importUse: ['Usar como', 'Use as'], useStations: ['Estações de referência para o snap', 'Reference stations to snap to'],
  useFixed: ['Estações + apoio fixo na rede', 'Stations + fixed control in the network'], useStochastic: ['Estações + apoio estocástico na rede', 'Stations + stochastic control in the network'],
  usePoints: ['Pontos novos da rede (incógnitas)', 'New network points (unknowns)'],
  importUseNote: ['Estações ficam salvas no projeto e entram na rede com um clique (ou pelo snap). Pontos novos entram direto na rede, como se tivessem sido clicados no mapa.', 'Stations are saved with the project and join the network with one click (or by snapping). New points go straight into the network, as if clicked on the map.'],
  importNetwork: ['Rede (rótulo)', 'Network (label)'], importDefaultNetwork: ['importadas', 'imported'], importDefaultStatus: ['Situação padrão', 'Default status'],
  importConflict: ['IDs que já existem', 'IDs already in use'], conflictRename: ['Renomear (ID-2, ID-3…)', 'Rename (ID-2, ID-3…)'],
  conflictReplace: ['Substituir (vale o importado)', 'Replace (the import wins)'], conflictSkip: ['Ignorar', 'Skip'],
  planStations: ['{count} estação(ões) a importar', '{count} station(s) to import'], planPoints: ['{count} ponto(s) a importar', '{count} point(s) to import'],
  planControl: ['{count} ponto(s) de apoio novo(s) na rede', '{count} new control point(s) in the network'],
  importConflicts: ['{count} ID(s) já existem', '{count} ID(s) already in use'],
  importTooManyPoints: ['a rede ficaria com {total} pontos; o limite é {max}', 'the network would have {total} points; the limit is {max}'],
  importTooManyStations: ['o limite é de {max} estações importadas', 'the limit is {max} imported stations'],
  importSampling: ['Consultando o MDT: {done}/{total}…', 'Sampling the DEM: {done}/{total}…'],
  importTooLarge: ['Arquivo grande demais (até 5 MB e 5000 pontos).', 'File too large (up to 5 MB and 5000 points).'],
  importEmpty: ['Nada para ler: o arquivo ou o texto está vazio.', 'Nothing to read: the file or text is empty.'],
  importJson: ['JSON inválido ou sem pontos reconhecíveis.', 'Invalid JSON or no recognisable points.'],
  importNoPoints: ['Nenhum ponto encontrado (linhas e polígonos são ignorados).', 'No points found (lines and polygons are ignored).'],
  importNoCoordinates: ['sem coordenadas', 'no coordinates'], importBadCoordinate: ['latitude ou longitude ilegível', 'unreadable latitude or longitude'],
  importOutOfRange: ['fora de |lat| ≤ 85° ou |lon| ≤ 180° (coordenadas projetadas?)', 'outside |lat| ≤ 85° or |lon| ≤ 180° (projected coordinates?)'],
  // Diagnostics
  invalidBaseline: ['Linha {id} inválida: {reason}.', 'Baseline {id} is invalid: {reason}.'],
  sessionShort: ['Sessão {session}: {minutes} min, mas o guia do IBGE (2008) indica ≥ {needed} min para {km} km.', 'Session {session}: {minutes} min, but the IBGE (2008) guide asks for ≥ {needed} min at {km} km.'],
  singleFrequencyLong: ['Linha {id} ({km} km): receptores L1 só até 20 km pelo guia do IBGE.', 'Baseline {id} ({km} km): L1 receivers only up to 20 km by the IBGE guide.'],
  trivialBaselines: ['Sessão {session}: {count} linha(s) trivial(is) com {receivers} receptores; a precisão fica otimista.', 'Session {session}: {count} trivial baseline(s) with {receivers} receivers; precision is optimistic.'],
  trivialExcluded: ['Sessão {session}: {count} linha(s) trivial(is) excluída(s).', 'Session {session}: {count} trivial baseline(s) excluded.'],
  longBaselinePrecise: ['Há linhas acima de 30 km: use efemérides precisas e sessões longas (até 24 h) para atingir o catálogo.', 'Baselines above 30 km: use precise ephemerides and long sessions (up to 24 h) to reach the catalogue values.'],
  isolatedPoints: ['Pontos sem linhas, fora do cálculo: {ids}.', 'Points without baselines, not computed: {ids}.'],
  heightAssumed: ['Altitude aproximada (MDT pendente ou indisponível): {ids}.', 'Approximate height (DEM pending or unavailable): {ids}.'],
  disconnected: ['A rede tem {count} partes desconectadas.', 'The network has {count} disconnected parts.'],
  datumMissing: ['Sem apoio (datum) em {ids}: faltam as 3 translações.', 'No control (datum) for {ids}: 3 translations are missing.'],
  noObservations: ['Adicione linhas de base para analisar a rede.', 'Add baselines to analyse the network.'],
  singularSession: ['Sessão {session}: covariância singular (linhas dependentes sem termo em ppm).', 'Session {session}: singular covariance (dependent baselines without a ppm term).'],
  rankDefect: ['Deficiência de posto: {count}.', 'Rank defect: {count}.'], pointUndetermined: ['Pontos indeterminados: {ids}.', 'Undetermined points: {ids}.'],
  weakGeometry: ['Geometria numericamente fraca; confira as incertezas.', 'Numerically weak geometry; check the uncertainties.'],
  invalidProject: ['Projeto inválido ou acima dos limites (150 pontos, 600 linhas, 60 sessões).', 'Invalid project or above the limits (150 points, 600 baselines, 60 sessions).'],
  invalidPoint: ['Ponto inválido: confira identificador e coordenadas.', 'Invalid point: check the ID and coordinates.'],
  invalidSession: ['Sessão inválida: a duração deve ser positiva.', 'Invalid session: the duration must be positive.'],
  invalidSettings: ['Configuração inválida.', 'Invalid settings.'], invalidSigma: ['Desvios-padrão devem ser positivos (a > 0 ou b > 0).', 'Standard deviations must be positive (a > 0 or b > 0).'],
  invalidSetup: ['Erros de instalação entre 0 e 100 mm.', 'Setup errors between 0 and 100 mm.'],
  invalidStatistics: ['Use 0,000001 ≤ α ≤ 0,2 e 0,5 ≤ poder < 0,9999.', 'Use 0.000001 ≤ α ≤ 0.2 and 0.5 ≤ power < 0.9999.'],
  coordinateRange: ['Coordenadas fora do intervalo aceito.', 'Coordinates outside the supported range.'],
  coincident: ['pontos coincidentes', 'coincident points'], terrainMissing: ['Elevação indisponível; h fica aproximada. Edite h no ponto, se souber.', 'Elevation unavailable; h stays approximate. Edit h on the point if you know it.'],
  corsMissing: ['Lista de estações indisponível.', 'Station list unavailable.'], invalidCors: ['Lista de estações inválida (IDs de 1 a 20 caracteres, coordenadas e situação).', 'Invalid station list (IDs of 1 to 20 characters, coordinates and status).'],
  lastSession: ['A rede precisa de ao menos uma sessão.', 'The network needs at least one session.'], invalidNumber: ['Informe um número válido.', 'Enter a valid number.'],
  duplicateBaseline: ['Essa linha já existe nesta sessão (seria trivial).', 'This baseline already exists in this session (it would be trivial).'],
  sameEndpoint: ['Escolha dois pontos diferentes.', 'Choose two different points.'],
  helpBody: [`<p>Projete a rede GNSS antes de ir a campo:</p><ol>
<li><b>+ Ponto</b>: clique no mapa para criar um ponto novo; a altitude vem do MDT da AWS (h = H + N₀). Perto de uma estação RBMC, o clique se ajusta a ela, que entra como <b>apoio fixo</b>.</li>
<li><b>↔ Linha de base</b>: escolha dois pontos; a linha entra na <b>sessão ativa</b>. Clicar numa estação RBMC fora da rede a adiciona automaticamente.</li>
<li>Organize as <b>sessões</b>: cada sessão é um período com vários receptores; com r receptores há r − 1 linhas independentes. A duração é comparada ao guia do IBGE (2008).</li>
<li>Escolha o <b>modelo de precisão</b> (catálogo, IBGE ou personalizado) e os <b>erros de centragem e de altura da antena</b>.</li>
<li>Leia o resultado: elipses (ampliadas), σE/σN/σU, redundância e MDB de cada vetor. Clique em um ponto ou linha para os detalhes e arraste pontos novos para redesenhar.</li></ol>
<p><b>Salvar GeoJSON</b> grava pontos e linhas de base com os resultados (σ, elipses, redundância, MDB) num só arquivo, que o QGIS abre como duas camadas; <b>Abrir GeoJSON</b> o recupera (o .json antigo também abre). <b>Importar estações</b> abre um assistente: GeoJSON, CSV ou texto colado com apenas latitude e longitude bastam; IDs e altitudes (do MDT) são completados. Arrastar um arquivo para a página também funciona. O botão <b>Teoria</b> resume as fórmulas.</p>`,
  `<p>Design the GNSS network before fieldwork:</p><ol>
<li><b>+ Point</b>: click the map to add a new point; its height comes from the AWS DEM (h = H + N₀). Near an RBMC station the click snaps to it, and the station joins as <b>fixed control</b>.</li>
<li><b>↔ Baseline</b>: pick two points; the baseline goes to the <b>active session</b>. Clicking an RBMC station outside the network adds it automatically.</li>
<li>Organise the <b>sessions</b>: each session is one period with several receivers; r receivers give r − 1 independent baselines. The duration is checked against the IBGE (2008) guide.</li>
<li>Choose the <b>precision model</b> (catalogue, IBGE or custom) and the <b>centering and antenna-height errors</b>.</li>
<li>Read the result: ellipses (enlarged), σE/σN/σU, redundancy and MDB of every vector. Click a point or baseline for details and drag new points to redesign.</li></ol>
<p><b>Save GeoJSON</b> writes points and baselines with the results (σ, ellipses, redundancy, MDB) to one file, which QGIS opens as two layers; <b>Open GeoJSON</b> brings it back (older .json files also open). <b>Import stations</b> opens a wizard: GeoJSON, CSV or pasted text with only latitude and longitude is enough; IDs and heights (from the DEM) are filled in. Dropping a file on the page works too. The <b>Theory</b> button summarises the formulas.</p>`],
  theoryBody: [`<h3>1. Precisão nominal no sistema local</h3><p>O fabricante especifica a precisão do vetor em E, N, U: σ<sub>H</sub> = a<sub>H</sub> + b<sub>H</sub>·D e σ<sub>V</sub> = a<sub>V</sub> + b<sub>V</sub>·D (D em km, b em ppm = mm/km), RMS ≈ 1σ. A soma linear é conservadora; a quadrática √(a² + (b·D)²) é a alternativa. Se o valor horizontal for radial (2D), σ<sub>E</sub> = σ<sub>N</sub> = σ<sub>H</sub>/√2. O termo a reúne ruído, multicaminho e centro de fase; b·D, os resíduos de órbita, troposfera e ionosfera (no Brasil a anomalia equatorial pode aumentá-lo, sobretudo em L1).</p>
<h3>2. Instalação nas duas extremidades</h3><p>Σ<sub>ENU</sub> = diag(σ<sub>E</sub>² + σ<sub>c,i</sub>² + σ<sub>c,j</sub>², σ<sub>N</sub>² + σ<sub>c,i</sub>² + σ<sub>c,j</sub>², σ<sub>U</sub>² + σ<sub>h,i</sub>² + σ<sub>h,j</sub>²), como a centragem de instrumento e alvo na topografia clássica.</p>
<h3>3. Rotação para o geocêntrico</h3><p>Σ<sub>ΔXYZ</sub> = Rᵀ Σ<sub>ENU</sub> R, com φ, λ no meio da linha e</p><pre>    ⎡ −sen λ        cos λ        0    ⎤
R = ⎢ −sen φ cos λ  −sen φ sen λ  cos φ ⎥
    ⎣  cos φ cos λ   cos φ sen λ  sen φ ⎦</pre><p>As correlações em XYZ só aparecem porque σ<sub>U</sub> ≠ σ<sub>H</sub>.</p>
<h3>4. Rede (método paramétrico)</h3><p>L<sub>b</sub> = (ΔX, ΔY, ΔZ) de cada vetor; A é a matriz de incidência ⊗ I₃ (−I na origem, +I no destino) e não depende das coordenadas. P = σ₀² Σ<sub>Lb</sub>⁻¹ com σ₀² = 1 a priori; Σ<sub>Xa</sub> = σ₀² (AᵀPA)⁻¹, levado ao ENU de cada ponto para σ e elipses. As linhas já definem escala e orientação: o datum exige só 3 translações (estação fixa ou apoio estocástico por pseudo-observações).</p>
<h3>5. Sessões e linhas triviais</h3><p>Com r receptores há r − 1 linhas independentes; as demais são combinações lineares (triviais) e incluí-las aumenta artificialmente a redundância (MVC otimista). Opcionalmente, as linhas da mesma sessão são correlacionadas: Σ<sub>sessão</sub> = D Σ<sub>est</sub> Dᵀ + Σ<sub>comp</sub>, em que cada estação contribui com metade do termo constante e sua instalação (ρ ≈ ±0,5 entre linhas que partilham a estação) e o termo em ppm é independente.</p>
<h3>6. Duração das sessões (IBGE, 2008, Tab. 3.2)</h3><p>0–5 km: 5–10 min · 5–10 km: 10–15 min · 10–20 km: 10–30 min (L1 ou L1/L2) · 20–50 km: 2–3 h · 50–100 km: ≥ 3 h · &gt; 100 km: ≥ 4 h (L1/L2). Valem em condições favoráveis (sem perdas de ciclo, sem multicaminho, antena estável).</p>
<h3>7. Confiabilidade</h3><p>r<sub>i</sub> = (I − A Σ<sub>Xa</sub> AᵀP)<sub>ii</sub>; o traço do bloco 3 × 3 de cada vetor não depende do referencial. MDB ao longo da direção e: ∇ = δ₀ / √(eᵀ M e), M = P − PAΣ<sub>Xa</sub>AᵀP (δ₀ = 4,13 para α = 0,1% e poder 80%). Vetores irradiados sem repetição têm r = 0: erros grosseiros neles não são detectáveis.</p>
<h3>8. Limites</h3><p>A MVC formal do processamento costuma ser otimista (correlação temporal das observações) e precisa de fator de escala; por isso a pré-análise usa a precisão nominal. Depois da campanha, teste σ̂₀² e estime a e b com linhas repetidas (componentes de variância). As coordenadas das estações são aproximadas (decímetros) e h do MDT usa N₀ constante: bastam para projetar, não para calcular.</p>`,
  `<h3>1. Nominal precision in the local frame</h3><p>Manufacturers specify the vector precision in E, N, U: σ<sub>H</sub> = a<sub>H</sub> + b<sub>H</sub>·D and σ<sub>V</sub> = a<sub>V</sub> + b<sub>V</sub>·D (D in km, b in ppm = mm/km), RMS ≈ 1σ. The linear sum is conservative; the quadratic √(a² + (b·D)²) is the alternative. If the horizontal value is radial (2D), σ<sub>E</sub> = σ<sub>N</sub> = σ<sub>H</sub>/√2. The a term gathers noise, multipath and phase centre; b·D the orbit, troposphere and ionosphere residuals (in Brazil the equatorial anomaly can increase it, above all with L1).</p>
<h3>2. Setup at both ends</h3><p>Σ<sub>ENU</sub> = diag(σ<sub>E</sub>² + σ<sub>c,i</sub>² + σ<sub>c,j</sub>², σ<sub>N</sub>² + σ<sub>c,i</sub>² + σ<sub>c,j</sub>², σ<sub>U</sub>² + σ<sub>h,i</sub>² + σ<sub>h,j</sub>²), like instrument and target centering in classical surveying.</p>
<h3>3. Rotation to geocentric</h3><p>Σ<sub>ΔXYZ</sub> = Rᵀ Σ<sub>ENU</sub> R, with φ, λ at the midpoint and</p><pre>    ⎡ −sin λ        cos λ        0    ⎤
R = ⎢ −sin φ cos λ  −sin φ sin λ  cos φ ⎥
    ⎣  cos φ cos λ   cos φ sin λ  sin φ ⎦</pre><p>XYZ correlations appear only because σ<sub>U</sub> ≠ σ<sub>H</sub>.</p>
<h3>4. Network (parametric method)</h3><p>L<sub>b</sub> = (ΔX, ΔY, ΔZ) of each vector; A is the incidence matrix ⊗ I₃ (−I at the origin, +I at the end) and does not depend on the coordinates. P = σ₀² Σ<sub>Lb</sub>⁻¹ with σ₀² = 1 a priori; Σ<sub>Xa</sub> = σ₀² (AᵀPA)⁻¹, taken to each point's ENU for σ and ellipses. Baselines already carry scale and orientation: the datum needs only 3 translations (a fixed station or stochastic control through pseudo-observations).</p>
<h3>5. Sessions and trivial baselines</h3><p>r receivers give r − 1 independent baselines; the others are linear combinations (trivial) and including them inflates the redundancy (optimistic covariance). Optionally, baselines of one session are correlated: Σ<sub>session</sub> = D Σ<sub>stations</sub> Dᵀ + Σ<sub>length</sub>, where each station contributes half the constant term plus its setup (ρ ≈ ±0.5 between baselines sharing it) and the ppm term is independent.</p>
<h3>6. Session length (IBGE, 2008, Table 3.2)</h3><p>0–5 km: 5–10 min · 5–10 km: 10–15 min · 10–20 km: 10–30 min (L1 or L1/L2) · 20–50 km: 2–3 h · 50–100 km: ≥ 3 h · &gt; 100 km: ≥ 4 h (L1/L2). Valid under favourable conditions (no cycle slips, no multipath, stable antenna).</p>
<h3>7. Reliability</h3><p>r<sub>i</sub> = (I − A Σ<sub>Xa</sub> AᵀP)<sub>ii</sub>; the trace of each vector's 3 × 3 block does not depend on the frame. MDB along direction e: ∇ = δ₀ / √(eᵀ M e), M = P − PAΣ<sub>Xa</sub>AᵀP (δ₀ = 4.13 for α = 0.1% and power 80%). Radial vectors without repetition have r = 0: gross errors in them cannot be detected.</p>
<h3>8. Limits</h3><p>The formal covariance from processing is usually optimistic (time-correlated observations) and needs a scale factor; that is why pre-analysis uses the nominal precision. After the campaign, test σ̂₀² and estimate a and b from repeated baselines (variance components). Station coordinates are approximate (decimetres) and DEM heights use a constant N₀: enough to design, not to compute.</p>`],
};
let language = 'pt-BR';
export function detectLanguage({ query = '', stored = '', browser = '' } = {}) {
  for (const value of [new URLSearchParams(query).get('lang'), stored]) {
    if (value === 'en') return 'en';
    if (value === 'pt' || value === 'pt-BR') return 'pt-BR';
  }
  return String(browser).toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}
export function initialLanguage() {
  let stored = '';
  try { stored = localStorage.getItem('monorepo_lang') || ''; } catch {}
  return detectLanguage({ query: location.search, stored, browser: navigator.language });
}
export const getLanguage = () => language;
export function t(key, values = {}) {
  return (words[key]?.[language === 'pt-BR' ? 0 : 1] ?? key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}
const decimal = () => (language === 'pt-BR' ? 'pt-BR' : 'en');
export const num = (x, digits = 1) => Number.isFinite(x) ? x.toLocaleString(decimal(), { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
export function setLanguage(lang, onChange) {
  language = lang === 'en' ? 'en' : 'pt-BR';
  if (typeof document === 'undefined') return;
  try { localStorage.setItem('monorepo_lang', language); } catch {}
  const url = new URL(location.href); url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  document.documentElement.lang = language; document.title = `gnss_preanalysis · ${t('title')}`;
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-html]').forEach(el => { el.innerHTML = t(el.dataset.html); }); // trusted dictionary text only
  document.querySelectorAll('[data-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.label)); el.title = t(el.dataset.label); });
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
  document.querySelectorAll('a.portal').forEach(el => { el.href = `../?lang=${language}`; });
  onChange?.(language);
}
