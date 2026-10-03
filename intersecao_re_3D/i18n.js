// ============================================
// i18n Dictionary for 3D Resection Network (intersecao_re_3D)
// Fully Bilingual: PT-BR & EN
// ============================================

export const i18n = {
    'pt-BR': {
        pageTitle: "Interseção a Ré 3D — Modelo Combinado",
        pageDesc: "Simulador didático de rede 3D de estações livres (interseção a ré) ajustada pelos métodos combinado e paramétrico (MMQ), com pontos fixos ou como rede livre: aproximações iniciais, controle de qualidade, detecção de outliers, elipsoides de erro e relatório em PDF.",
        headerTitle: "Interseção a Ré 3D",
        headerSubtitle: "Rede de estações livres — métodos combinado e paramétrico, com pontos fixos ou rede livre (MMQ)",
        portalLink: "← Portal",
        portalTitle: "Voltar ao Portal Monorepo",
        modelosLink: "∑ Explicação dos Modelos",
        simulLink: "▶ Simulador",

        // Sections
        secObs: "Observações",
        lblSample: "Amostra",
        sampleBtnText: "△ Estações A, B, C — fixos M01, M02",
        sampleHelp: "24 visadas; os fixos não têm X,Y,Z no arquivo e são irradiados de A (datum local).",
        lblCsvUser: "Carregar CSV próprio",

        // Model explanation doc
        docTitle: "Explicação dos Modelos",
        docSubtitle: "Modelos de ajustamento e modelo matemático utilizado na interseção a ré 3D"
    },

    'en': {
        pageTitle: "3D Resection Network — Combined Model",
        pageDesc: "Educational simulator for 3D free station networks adjusted via Combined Gauss-Helmert and Parametric Least Squares, with fixed or inner constraints (free network): initial approximations, blunder detection, error ellipsoids, and PDF reports.",
        headerTitle: "3D Resection Network",
        headerSubtitle: "3D Free Station Networks — combined and parametric adjustment, with control points or free network datum",
        portalLink: "← Portal",
        portalTitle: "Back to Monorepo Portal",
        modelosLink: "∑ Models Formulation",
        simulLink: "▶ Simulator",

        // Sections
        secObs: "Observations",
        lblSample: "Sample Dataset",
        sampleBtnText: "△ Stations A, B, C — Control points M01, M02",
        sampleHelp: "24 spatial sights; control targets are oriented from Station A to define the local spatial datum.",
        lblCsvUser: "Upload custom CSV",

        // Model explanation doc
        docTitle: "Models Formulation",
        docSubtitle: "Mathematical adjustment models and equations implemented in the 3D resection network"
    }
};
