// Bilingual i18n (PT-BR / EN) following simul_adjust monorepo conventions

const STORAGE_KEY = "monorepo_lang";

export const TRANSLATIONS = {
  "pt-BR": {
    pageTitle: "Simulação SMMT: Estereoscopia",
    brandTitle: "Simulação SMMT: Estereoscopia",
    portal: "← Portal",
    subtitle: "Simulador 3D de frustum duplo embarcado em veículo",
    viewTop: "Planta (Nadir)",
    viewRear: "Corte Transversal",
    viewSide: "Lateral",
    viewIso: "Perspectiva 3D",
    resetView: "Resetar câmera",
    navigateHint: "Arraste para orbitar · Scroll para zoom · Botão direito para mover",
    sectionRig: "Montagem no Veículo",
    mountMode: "Orientação das câmeras",
    modeNadir: "Nadir (Para baixo)",
    modeFront: "Frontal (Front-facing)",
    sectionCamera: "Parâmetros da Câmera",
    sectionAxes: "Orientação dos Eixos Ópticos",
    sectionRoad: "Via & Visualização",
    height: "Altura em relação ao solo (H)",
    baseline: "Distância entre câmeras (B)",
    focal: "Distância focal (f)",
    sensorPreset: "Preset de sensor",
    sensorCustom: "Personalizado",
    sensorWidth: "Largura do sensor (Ws)",
    sensorHeight: "Altura do sensor (Hs)",
    resX: "Resolução X (px)",
    resY: "Resolução Y (px)",
    convergence: "Ângulo dos eixos (α)",
    convergenceHint: "0° = eixos paralelos · >0° = eixos convergentes (cruzam) · <0° = divergentes",
    pitch: "Inclinação longitudinal (pitch)",
    pitchFront: "Depressão vertical (tilt p/ baixo)",
    btnParallel: "Paralelos (0°)",
    btnCrossGround: "Cruzar no solo",
    roadWidth: "Largura do pavimento",
    targetOverlap: "Sobreposição alvo (%)",
    showCar: "Exibir veículo",
    showFrustums: "Exibir frustums 3D",
    showAxes: "Exibir eixos ópticos",
    showDimensions: "Exibir cotas na pista",
    resetAll: "Restaurar padrões",
    // Metrics
    metricOverlapArea: "Sobreposição (Área)",
    metricOverlapWidth: "Faixa Sobreposta",
    metricSwath: "Largura Total (Swath)",
    metricGsd: "GSD no Pavimento",
    metricCrossing: "Cruzamento dos Eixos",
    metricFov: "FOV (H × V)",
    noOverlap: "Sem sobreposição",
    gapLabel: "Lacuna",
    parallelState: "Paralelos (∞)",
    divergentState: "Divergentes",
    crossAbove: "Acima do solo",
    crossOnGround: "No pavimento",
    crossBelow: "Abaixo do solo",
    coversRoadYes: "Cobre toda a via",
    coversRoadNo: "Cobertura parcial",
    horizonWarning: "Atenção: parte do frustum atinge o horizonte devido à inclinação elevada.",
    // Legend
    legendLeft: "Câmera Esquerda",
    legendRight: "Câmera Direita",
    legendOverlap: "Zona de Sobreposição",
    legendCrossing: "Ponto de Cruzamento",
    // Chart
    chartTitle: "Comparação: Altura do Sensor (H) × Sobreposição (%)",
    chartSubtitle: "Clique no gráfico para testar uma altura H diretamente no cenário 3D",
    chartCurrentCurve: "Configuração atual",
    chartParallelCurve: "Eixos paralelos (0°)",
    chartTargetLine: "Meta",
    chartAxisX: "Altura em relação ao solo H (m)",
    chartAxisY: "Sobreposição (%)",
    chartCurrentH: "H atual",
    // Ortho panel
    orthoTitle: "Ortofoto Projetiva Simplificada (1 Câmera · Homografia / IPM)",
    orthoSubtitle: "Projeção planar no pavimento (Y = 0). A linha de fuga vive no infinito e não é projetável; áreas muito oblíquas sofrem estiramento severo.",
    orthoTabPreview: "Preview + Ortofoto",
    orthoTabBands: "Faixas de Resolução",
    orthoCamLeft: "Câmera Esquerda",
    orthoCamRight: "Câmera Direita",
    orthoCapOriginal: "Imagem Original (Perspectiva)",
    orthoCapOrtho: "Ortofoto Gerada (Homografia · Vista Superior)",
    orthoCapOriginalBands: "Imagem Original · Faixas de GSD",
    orthoCapOrthoBands: "Trapézio da Ortofoto · Faixas Horizontais de Resolução",
    orthoStatUsableArea: "Área útil projetável",
    orthoStatUsablePct: "Pixels utilizáveis",
    orthoStatSkyPct: "Não projetável (≥ horizonte)",
    orthoStatGsdRange: "GSD Base → Topo útil",
    orthoVanishing: "Linha de fuga (∞)",
    orthoNear: "Base (maior resolução)",
    orthoFar: "Topo (menor resolução)",
    orthoNoGround: "Sem projeção no solo",
    orthoBestRes: "Melhor res.",
    orthoWorstRes: "Menor res.",
    orthoHoverSky: "Acima do horizonte (∞ · não projetável)",
    // Theory
    theoryTitle: "Modelo Geométrico & Fórmulas",
    theoryIntro:
      "Cada câmera de quadro é modelada pelo modelo pinhole com campo de visão horizontal HFOV = 2·arctan(Ws / 2f) e vertical VFOV = 2·arctan(Hs / 2f). Os quatro raios de borda são intersectados com o plano do pavimento (Y = 0) e a região de sobreposição é calculada exatamente por recorte de polígonos convexos (Sutherland–Hodgman).",
    theoryCross:
      "Para eixos paralelos (α = 0°), a sobreposição cresce monotonicamente com a altura H. Ao convergir os eixos (α > 0°), os eixos ópticos se cruzam na altura Y_cruz = H − (B / (2·tan α))·cos(pitch), permitindo maximizar a sobreposição a alturas menores — ao custo de reduzir a largura total de varredura e introduzir obliquidade nas bordas.",
    presetNames: {
      "1_18": '1/1.8" Industrial (7.2 × 5.4 mm)',
      "2_3": '2/3" Machine Vision (8.8 × 6.6 mm)',
      "1_inch": '1" Global Shutter (13.2 × 8.8 mm)',
      "apsc": "APS-C (23.5 × 15.6 mm)",
      "fullframe": "Full Frame 35mm (36 × 24 mm)",
    },
  },
  en: {
    pageTitle: "SMMT Simulation: Stereoscopy",
    brandTitle: "SMMT Simulation: Stereoscopy",
    portal: "← Portal",
    subtitle: "3D vehicle-mounted dual frame-camera frustum simulator",
    viewTop: "Top (Nadir)",
    viewRear: "Cross-Section",
    viewSide: "Side",
    viewIso: "3D Perspective",
    resetView: "Reset view",
    navigateHint: "Drag to orbit · Scroll to zoom · Right-click to pan",
    sectionRig: "Vehicle Mounting",
    mountMode: "Camera orientation",
    modeNadir: "Nadir (Downward)",
    modeFront: "Front-facing",
    sectionCamera: "Camera Parameters",
    sectionAxes: "Optical Axis Geometry",
    sectionRoad: "Road & Display",
    height: "Height above ground (H)",
    baseline: "Camera baseline (B)",
    focal: "Focal length (f)",
    sensorPreset: "Sensor preset",
    sensorCustom: "Custom",
    sensorWidth: "Sensor width (Ws)",
    sensorHeight: "Sensor height (Hs)",
    resX: "Resolution X (px)",
    resY: "Resolution Y (px)",
    convergence: "Axis angle (α)",
    convergenceHint: "0° = parallel axes · >0° = convergent (crossing) · <0° = divergent",
    pitch: "Longitudinal tilt (pitch)",
    pitchFront: "Downward tilt (depression)",
    btnParallel: "Parallel (0°)",
    btnCrossGround: "Cross on road",
    roadWidth: "Pavement width",
    targetOverlap: "Target overlap (%)",
    showCar: "Show vehicle",
    showFrustums: "Show 3D frustums",
    showAxes: "Show optical axes",
    showDimensions: "Show ground markers",
    resetAll: "Reset defaults",
    // Metrics
    metricOverlapArea: "Overlap (Area)",
    metricOverlapWidth: "Overlap Width",
    metricSwath: "Total Swath Width",
    metricGsd: "Pavement GSD",
    metricCrossing: "Axes Crossing",
    metricFov: "FOV (H × V)",
    noOverlap: "No overlap",
    gapLabel: "Gap",
    parallelState: "Parallel (∞)",
    divergentState: "Divergent",
    crossAbove: "Above road",
    crossOnGround: "On pavement",
    crossBelow: "Below road",
    coversRoadYes: "Full road covered",
    coversRoadNo: "Partial coverage",
    horizonWarning: "Warning: part of the frustum reaches the horizon due to high tilt.",
    // Legend
    legendLeft: "Left Camera",
    legendRight: "Right Camera",
    legendOverlap: "Overlap Zone",
    legendCrossing: "Crossing Point",
    // Chart
    chartTitle: "Comparison: Sensor Height (H) × Overlap (%)",
    chartSubtitle: "Click the chart to set height H directly in the 3D scene",
    chartCurrentCurve: "Current angle",
    chartParallelCurve: "Parallel axes (0°)",
    chartTargetLine: "Target",
    chartAxisX: "Height above ground H (m)",
    chartAxisY: "Overlap (%)",
    chartCurrentH: "Current H",
    // Ortho panel
    orthoTitle: "Simplified Projective Orthophoto (1 Camera · Homography / IPM)",
    orthoSubtitle: "Planar projection onto the pavement (Y = 0). The vanishing line lies at infinity and cannot be projected; oblique far regions suffer severe stretching.",
    orthoTabPreview: "Preview + Orthophoto",
    orthoTabBands: "Resolution Bands",
    orthoCamLeft: "Left Camera",
    orthoCamRight: "Right Camera",
    orthoCapOriginal: "Original Image (Perspective)",
    orthoCapOrtho: "Generated Orthophoto (Homography · Bird's-Eye)",
    orthoCapOriginalBands: "Original Image · GSD Bands",
    orthoCapOrthoBands: "Orthophoto Trapezoid · Horizontal Resolution Bands",
    orthoStatUsableArea: "Usable ground area",
    orthoStatUsablePct: "Usable pixels",
    orthoStatSkyPct: "Unprojectable (≥ horizon)",
    orthoStatGsdRange: "GSD Near → Usable Far",
    orthoVanishing: "Vanishing line (∞)",
    orthoNear: "Bottom (higher res.)",
    orthoFar: "Top (lower res.)",
    orthoNoGround: "No ground projection",
    orthoBestRes: "Best res.",
    orthoWorstRes: "Coarser res.",
    orthoHoverSky: "Above horizon (∞ · unprojectable)",
    // Theory
    theoryTitle: "Geometric Model & Formulas",
    theoryIntro:
      "Each frame camera uses a pinhole model with horizontal FOV = 2·arctan(Ws / 2f) and vertical FOV = 2·arctan(Hs / 2f). The four corner rays are intersected with the pavement plane (Y = 0) and the exact overlap region is computed via Sutherland–Hodgman convex polygon clipping.",
    theoryCross:
      "For parallel axes (α = 0°), overlap increases monotonically with height H. Converging the axes (α > 0°) crosses them at height Y_cross = H − (B / (2·tan α))·cos(pitch), increasing overlap at lower mounting heights at the trade-off of narrower total swath and oblique ground projection.",
    presetNames: {
      "1_18": '1/1.8" Industrial (7.2 × 5.4 mm)',
      "2_3": '2/3" Machine Vision (8.8 × 6.6 mm)',
      "1_inch": '1" Global Shutter (13.2 × 8.8 mm)',
      "apsc": "APS-C (23.5 × 15.6 mm)",
      "fullframe": "Full Frame 35mm (36 × 24 mm)",
    },
  },
};

export function detectLang() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("lang");
  if (q) {
    return q.toLowerCase().startsWith("en") ? "en" : "pt-BR";
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt-BR") return saved;
  } catch {
    // ignore storage errors
  }
  return (navigator.language || "").toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

export function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export function t(lang, key) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS["pt-BR"];
  return dict[key] ?? key;
}
