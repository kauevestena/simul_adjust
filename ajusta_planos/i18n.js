// ============================================
// i18n Dictionary for Plane Fitting (ajusta_planos)
// Fully Bilingual: PT-BR & EN
// ============================================

export const i18n = {
    'pt-BR': {
        pageTitle: "Ajustamento de Planos — Modelo Combinado",
        pageDesc: "Simulador didático de ajustamento de planos pelo Método Combinado (MMQ) a partir de observações brutas de estação total: propagação da MVC, detecção de outliers, visualização 3D e modelo 2D dos resíduos.",
        headerTitle: "Ajustamento de Planos",
        headerSubtitle: "Método Combinado (MMQ) sobre nuvens de pontos de estação total",
        portalLink: "← Portal",
        portalTitle: "Voltar ao Portal Monorepo",
        volumeLink: "▣ Estimativa de Volume",

        // Sections
        secObs: "Observações",
        lblSamples: "Amostras (estação total sem prisma)",
        sampleHelp: "Seis planos da mesma sala, medidos da mesma estação.",
        sampleFront: " Frontal",
        sampleBack: " Traseira",
        sampleLeft: " Esquerda",
        sampleRight: " Direita",
        sampleFloor: " Piso",
        sampleCeil: " Teto",

        // Buttons
        btnRunAdjustment: "Executar Ajustamento",
        btnExportCsv: "Exportar CSV",
        btnExportReport: "Exportar Relatório",

        // Volume page
        volTitle: "Estimativa de Volume",
        volSubtitle: "Seis faces ajustadas, volume por fórmula algébrica e incerteza por propagação de covariâncias",
        volAdjustLink: "← Ajustamento",
        volSecData: "Dados das seis faces",
        btnVolExample: "Usar exemplo (as seis amostras)",
        btnVolUpload: "Carregar 6 faces",
        chkGeometricChecks: "Executar conferências geométricas"
    },

    'en': {
        pageTitle: "Plane Fitting — Combined Gauss-Helmert Model",
        pageDesc: "Educational simulator for 3D plane fitting via Combined Least Squares (Gauss-Helmert Model) from total station observations: VCM propagation, outlier detection, 3D visualization, and 2D residual modeling.",
        headerTitle: "Plane Fitting",
        headerSubtitle: "Combined Least Squares (Gauss-Helmert) on total station point clouds",
        portalLink: "← Portal",
        portalTitle: "Back to Monorepo Portal",
        volumeLink: "▣ Volume Estimation",

        // Sections
        secObs: "Observations",
        lblSamples: "Samples (reflectorless total station)",
        sampleHelp: "Six bounding planes of the same room, measured from a single instrument station.",
        sampleFront: " Front Wall",
        sampleBack: " Back Wall",
        sampleLeft: " Left Wall",
        sampleRight: " Right Wall",
        sampleFloor: " Floor",
        sampleCeil: " Ceiling",

        // Buttons
        btnRunAdjustment: "Run Adjustment",
        btnExportCsv: "Export CSV",
        btnExportReport: "Export Report",

        // Volume page
        volTitle: "Volume Estimation",
        volSubtitle: "Six adjusted plane faces, algebraic room volume and uncertainty via covariance propagation",
        volAdjustLink: "← Plane Fitting",
        volSecData: "Six Plane Faces Data",
        btnVolExample: "Load example (all six walls/slabs)",
        btnVolUpload: "Upload 6 faces",
        chkGeometricChecks: "Perform geometric validation checks"
    }
};
