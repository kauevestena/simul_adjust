// ============================================
// i18n Dictionary for Road Design Simulator (estradas)
// Fully Bilingual: PT-BR & EN
// ============================================

export const i18n = {
    'pt-BR': {
        pageTitle: "Simulador de Projeto Rodoviário",
        headerTitle: "Projeto Rodoviário",
        headerSubtitle: "Curvas, perfil, terraplenagem e locação",
        calcStatusReady: "Pronto",
        portalLink: "← Portal",
        portalTitle: "Voltar ao Portal Monorepo",

        // Sections
        sectionHCurve: "Curva Horizontal",
        sectionVProfile: "Perfil Vertical",
        sectionCrossSection: "Seção e Terraplenagem",
        sectionStakeout: "Locação Topográfica",

        // Field labels
        lblPiStation: "Estaca PI (m)",
        lblDelta: "Delta (°)",
        lblRadius: "Raio (m)",
        lblDirection: "Sentido",
        optRight: "Direita",
        optLeft: "Esquerda",
        lblStartAzimuth: "Azimute inicial",
        lblStartE: "E inicial",
        lblStartN: "N inicial",
        lblStartStation: "Estaca inicial (m)",

        lblPivStation: "Estaca PIV (m)",
        lblPivElev: "Cota PIV (m)",
        lblGradeIn: "Rampa entrada i₁ (%)",
        lblGradeOut: "Rampa saída i₂ (%)",
        lblCurveLenL: "Extensão vertical L (m)",
        lblStartElev: "Cota inicial terreno (m)",
        lblGenerateTerrain: "Gerar terreno",
        lblRecalc: "Recalcular",

        lblLaneWidth: "Largura da pista (m)",
        lblShoulderWidth: "Acostamento (m)",
        lblCrossSlope: "Declividade normal (%)",
        lblMaxSuperelev: "Superlargura / superelevação (%)",
        lblCutSlope: "Talude de corte (1:H)",
        lblFillSlope: "Talude de aterro (1:H)",
        lblInterval: "Intervalo estacas (m)",

        lblInstStation: "Estaca instrumento (m)",
        lblInstE: "E instrumento",
        lblInstN: "N instrumento",
        lblBacksightAz: "Azimute ré (graus)",

        // Tabs
        tabPlan: "Traçado",
        tabProfile: "Perfil",
        tabEarth: "Terra",
        tabStake: "Locação",

        // Legends
        legTangents: "Tangentes",
        legCircularCurve: "Curva Circular",
        legCenterlines: "Estacas",
        legInstrument: "Instrumento",
        legBacksight: "Ré",
        legSightlines: "Visadas",
        legGround: "Terreno Natural",
        legGrade: "Greide de Projeto",
        legVerticalCurve: "Curva Vertical",
        legCut: "Corte",
        legFill: "Aterro",
        legPavement: "Plataforma",
        legSlopes: "Taludes",

        // Table titles
        tableTitleCurve: "Tabela de Locação da Curva Horizontal",
        tableTitleProfile: "Notas de Serviço de Terraplenagem e Greide",
        tableTitleEarth: "Resumo Volumétrico de Terraplenagem",
        tableTitleStake: "Caderneta de Locação por Deflexão e Coordenadas"
    },

    'en': {
        pageTitle: "Road Design Simulator",
        headerTitle: "Road Design",
        headerSubtitle: "Horizontal curves, vertical profile, earthwork & stakeout",
        calcStatusReady: "Ready",
        portalLink: "← Portal",
        portalTitle: "Back to Monorepo Portal",

        // Sections
        sectionHCurve: "Horizontal Curve",
        sectionVProfile: "Vertical Profile",
        sectionCrossSection: "Cross-Section & Earthwork",
        sectionStakeout: "Topographic Stakeout",

        // Field labels
        lblPiStation: "PI Station (m)",
        lblDelta: "Deflection Angle Δ (°)",
        lblRadius: "Radius R (m)",
        lblDirection: "Turn Direction",
        optRight: "Right",
        optLeft: "Left",
        lblStartAzimuth: "Initial Azimuth",
        lblStartE: "Initial Easting E",
        lblStartN: "Initial Northing N",
        lblStartStation: "Initial Station (m)",

        lblPivStation: "PVI Station (m)",
        lblPivElev: "PVI Elevation (m)",
        lblGradeIn: "Inflow Grade g₁ (%)",
        lblGradeOut: "Outflow Grade g₂ (%)",
        lblCurveLenL: "Vertical Length L (m)",
        lblStartElev: "Initial Ground Elevation (m)",
        lblGenerateTerrain: "Generate Terrain",
        lblRecalc: "Recalculate",

        lblLaneWidth: "Lane Width (m)",
        lblShoulderWidth: "Shoulder Width (m)",
        lblCrossSlope: "Normal Crown (%)",
        lblMaxSuperelev: "Max Superelevation (%)",
        lblCutSlope: "Cut Slope (1:H)",
        lblFillSlope: "Fill Slope (1:H)",
        lblInterval: "Station Interval (m)",

        lblInstStation: "Instrument Station (m)",
        lblInstE: "Instrument Easting E",
        lblInstN: "Instrument Northing N",
        lblBacksightAz: "Backsight Azimuth (deg)",

        // Tabs
        tabPlan: "Plan Alignment",
        tabProfile: "Profile",
        tabEarth: "Earthwork",
        tabStake: "Stakeout",

        // Legends
        legTangents: "Tangents",
        legCircularCurve: "Circular Curve",
        legCenterlines: "Stations",
        legInstrument: "Instrument",
        legBacksight: "Backsight",
        legSightlines: "Sightlines",
        legGround: "Natural Ground",
        legGrade: "Design Grade",
        legVerticalCurve: "Vertical Curve",
        legCut: "Cut",
        legFill: "Fill",
        legPavement: "Roadway",
        legSlopes: "Side Slopes",

        // Table titles
        tableTitleCurve: "Horizontal Curve Stakeout Table",
        tableTitleProfile: "Grade & Earthwork Station Notes",
        tableTitleEarth: "Earthwork Volume Summary",
        tableTitleStake: "Field Stakeout Notebook (Deflection & Coordinates)"
    }
};
