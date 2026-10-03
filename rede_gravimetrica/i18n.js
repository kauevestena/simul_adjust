// ============================================
// i18n Dictionary for Gravimetric Network Simulator (rede_gravimetrica)
// Fully Bilingual: PT-BR & EN
// ============================================

export const i18n = {
    'pt-BR': {
        pageTitle: "Rede Gravimétrica - MMQ",
        pageDesc: "Simulação de Ajustamento de Redes Gravimétricas pelo Método dos Mínimos Quadrados.",
        headerTitle: "Rede Gravimétrica",
        headerSubtitle: "Simulação de Ajustamento pelo Método dos Mínimos Quadrados",
        portalLink: "← Portal",
        portalTitle: "Voltar ao Portal Monorepo",

        // Sidebar Panels
        networkControlTitle: "Controle da Rede",
        btnGenerateNetwork: "Gerar Nova Rede",
        btnInjectOutlier: "Simular Erro Grosseiro",
        btnRunAdjustment: "Executar Ajustamento",
        randomNoiseTitle: "σ ruído aleatório",
        randomNoiseSub: "(re-amostrado a cada execução)",
        randomNoiseHelp: "Gaussian(0, σ · √d) adicionado a cada execução. Se σ=0, nenhum ruído é inserido.",
        aprioriParamsTitle: "Parâmetros Estocásticos a Priori:",
        significanceLevel: "Nível de Significância (α)",
        varianceFactor: "Fator de Variância (σ²₀):",

        // Global Test
        globalTestTitle: "Teste Global (χ²)",
        awaitingAdjustment: "Aguardando ajustamento...",
        testPassed: "✓ Aprovado",
        testFailed: "✗ Falhou",
        calcChi2: "χ² calc. (VᵀPV):",
        infChi2: "χ² inf (α/2 = ",
        supChi2: "χ² sup (1-α/2 = ",
        estVariance: "σ̂²₀:",
        dof: "Graus de Liberdade:",
        anomalyDetected: "Anomalia detectada na rede. Analise o teste de Baarda abaixo.",

        // Map View / Tabs
        tabMapView: "▣ Vista de Mapa",
        tabDataTable: "☰ Tabela de Dados",
        toggleRelief: "Terreno 3D",
        legendFixed: "Ponto Fixo",
        legendComputed: "Ponto Calculado",
        fitNetwork: "⌕ Ajustar à janela",
        errorBarScale: "Escala barras de erro",
        mapHintCtrl: "Segure o botão Ctrl para rotacionar em 3D.",
        mapHintBars: "As barras de erro verticais estão ampliadas para efeitos de visualização.",

        // Data Table Tab
        dataTableHelp: "Edite diretamente as diferenças de gravidade observadas e os desvios padrão. Alterações resetam o ajustamento.",
        btnNewSection: "+ Novo Trecho",
        colFrom: "De",
        colTo: "Para",
        colDg: "Δg (mGal)",
        colSigmaMgal: "σ (mGal)",
        dataTableFootnote: "O desvio padrão (σ) é calculado automaticamente como σ_priori · √d, mas pode ser editado manualmente. Ao adicionar um novo trecho, os pontos devem existir na rede.",

        // Residuals Table
        residualsTitle: "Resíduos & Data Snooping",
        critLimit: "limite crítico |w| ≤ ",
        colSection: "Trecho",
        colObsDg: "Δg Observado",
        colResidualV: "v (Resíduo)",
        colStdV: "std(v)",
        colWTest: "w-test (Baarda)",
        colState: "Estado",
        tipSection: "Identificador da ligação gravimétrica (De-Para)",
        tipObsDg: "Diferença de gravidade simulada (com ruído e eventuais erros grosseiros)",
        tipResidualV: "Diferença entre o valor ajustado e o valor observado",
        tipStdV: "Desvio padrão a priori do resíduo e valor a posteriori entre parênteses",
        tipWTest: "Estatística de teste w (Resíduo padronizado). Se |w| > limite crítico, a observação é considerada um possível erro grosseiro.",
        tipState: "Resultado do Data Snooping (OK ou OUTLIER)",

        // Reliability Table
        reliabilityTitle: "Confiabilidade Interna (Sensibilidade)",
        colObs: "Obs.",
        colRedundancy: "r (Redundância)",
        colMdb: "∇₀l (Viés Mín. Detectável)",
        colQuality: "Qualidade",
        tipObs: "Identificador da observação",
        tipRedundancy: "Número de redundância local (0 a 1). Mede a contribuição da observação para a redundância do sistema.",
        tipMdb: "O menor erro grosseiro que o sistema consegue detectar estatisticamente (Viés Mínimo Detectável)",
        tipQuality: "Classificação da redundância local (Boa se r > 0.3, Crítica se r < 0.1)",
        qualGood: "Boa",
        qualMedium: "Média",
        qualCritical: "Crítica (Sem Controle)",
        reliabilityFootnote: "<strong>r (0 a 1):</strong> Contribuição da observação para a redundância do sistema.<br><strong>∇₀l:</strong> O menor erro grosseiro que o sistema consegue detectar estatisticamente com 80% de probabilidade.",

        // Coordinates Table
        coordsTitle: "Gravidades Ajustadas & Confiabilidade Externa",
        colPoint: "Ponto",
        colGadj: "g_adj (mGal)",
        colStdG: "std g (mGal)",
        colExtRelMax: "Conf. ext. máx. (mGal)",
        colOrigin: "Origem",
        tipPoint: "Identificador da estação gravimétrica",
        tipGadj: "Gravidade observada/ajustada final",
        tipStdG: "Desvio padrão da gravidade a priori e (a posteriori)",
        tipExtRelMax: "Maior deslocamento no parâmetro causado pelo erro mínimo detectável de qualquer observação",
        tipOrigin: "Observação que gerou o deslocamento máximo (pior caso de confiabilidade externa)",
        coordsFootnote: "<strong>Conf. ext. máx.:</strong> maior deslocamento da aceleração da gravidade causado pelo erro mínimo detectável (∇₀) de qualquer observação — confiabilidade externa da rede.",

        // Matrices
        matricesTitle: "Matrizes do Ajustamento",
        matrixDescSummary: "Descrição",
        matrixErrorRender: "Erro ao renderizar matriz.",
        matrixErrorKatex: "Erro: KaTeX não carregado.",
        explanations: {
            'A': '<strong>Matriz de Configuração / Jacobiana (A):</strong> Descreve a topologia das conexões entre estações relativas e bases absolutas.',
            'P': '<strong>Matriz de Pesos (P):</strong> Diagonal contendo os inversos das variâncias a priori das diferenças observadas.',
            'L': '<strong>Vetor de Termos Independentes (L):</strong> Diferenças observadas menos desníveis gravimétricos aproximados.',
            'X': '<strong>Vetor de Solução (dx):</strong> Estimativas de ajuste dos parâmetros de gravidade absoluta.',
            'V': '<strong>Vetor de Resíduos (V):</strong> Resíduos estimados das ligações gravimétricas.',
            'N': '<strong>Matriz das Equações Normais (N):</strong> Matriz simétrica N = Aᵀ P A.',
            'SigmaXa': '<strong>Matriz de Variância-Covariância (MVC) (&Sigma;<sub>X<sub>a</sub></sub>):</strong> Incertezas propagadas finais das gravidades estimadas.'
        },

        // Monte Carlo
        mcTitle: "Simulação de Monte Carlo",
        mcDesc: "Simula milhares de campanhas gravimétricas injetando ruído nas leituras para validar numericamente o modelo estocástico da rede.",
        mcTrials: "Número de Ensaios (N)",
        btnRunMonteCarlo: "Executar Monte Carlo",
        mcDispScale: "Escala dispersão",
        colBiasG: "Bias g (mGal)",
        colSampleStdG: "σ g amostral (mGal)",
        tipBiasG: "Viés Empírico (Média Amostral - Nominal)",
        tipSampleStdG: "Desvio Padrão Amostral",
        mcAccepted: "Aceitos no Teste Global:",
        mcRejected: "Rejeitados:",
        mcCrashed: "Falhas numéricas:",
        mcFootnoteTest: "As simulações reprovadas não passaram em um teste global de qui-quadrado com significância de",
        mcFootnoteIdeal: "%. Idealmente, o número de retornos negativos deve se aproximar deste valor teórico quando N for grande.",
        mcBiasDoc: "<strong>Viés Empírico (Bias g):</strong> Indica a ausência de tendências espúrias no estimador MMQ linearizado.",
        mcStdDoc: "<strong>Desvio Padrão Amostral (σ g):</strong> Mede a dispersão real observada nos ensaios simulados.",

        // Modals
        blunderModalTitle: "⚠ Simular Erro Grosseiro",
        blunderMagLabel: "Magnitude do erro (Múltiplo do desvio padrão do trecho)",
        blunderHelp: "Todas as observações selecionadas receberão um erro grosseiro de ±X vezes o seu desvio padrão a priori.",
        candidateObs: "Observações candidatas",
        selectOneOrMore: "(selecione uma ou mais)",
        btnCancel: "Cancelar",
        btnInject: "⚠ Injetar Erro",
        btnConfirm: "Confirmar"
    },

    'en': {
        pageTitle: "Gravimetric Network - LSE",
        pageDesc: "Simulation of Relative Gravimetric Network Adjustment using the Method of Least Squares.",
        headerTitle: "Gravimetric Network",
        headerSubtitle: "Adjustment Simulation via the Method of Least Squares",
        portalLink: "← Portal",
        portalTitle: "Back to Monorepo Portal",

        // Sidebar Panels
        networkControlTitle: "Network Control",
        btnGenerateNetwork: "Generate New Network",
        btnInjectOutlier: "Simulate Gross Error (Blunder)",
        btnRunAdjustment: "Run Adjustment",
        randomNoiseTitle: "σ random noise",
        randomNoiseSub: "(re-sampled on each run)",
        randomNoiseHelp: "Gaussian(0, σ · √d) added on each run. If σ=0, no noise is injected.",
        aprioriParamsTitle: "A Priori Stochastic Parameters:",
        significanceLevel: "Significance Level (α)",
        varianceFactor: "Variance Factor (σ²₀):",

        // Global Test
        globalTestTitle: "Global Test (χ²)",
        awaitingAdjustment: "Awaiting adjustment...",
        testPassed: "✓ Passed",
        testFailed: "✗ Failed",
        calcChi2: "calc. χ² (VᵀPV):",
        infChi2: "lower χ² (α/2 = ",
        supChi2: "upper χ² (1-α/2 = ",
        estVariance: "σ̂²₀:",
        dof: "Degrees of Freedom:",
        anomalyDetected: "Anomaly detected in the network. Check the Baarda w-test below.",

        // Map View / Tabs
        tabMapView: "▣ Map View",
        tabDataTable: "☰ Data Table",
        toggleRelief: "3D Terrain",
        legendFixed: "Base Station (Fixed)",
        legendComputed: "Adjusted Station",
        fitNetwork: "⌕ Fit to Window",
        errorBarScale: "Error bar scale",
        mapHintCtrl: "Hold Ctrl key to rotate in 3D.",
        mapHintBars: "Vertical error bars are exaggerated for visualization purposes.",

        // Data Table Tab
        dataTableHelp: "Edit observed gravity differences and standard deviations directly. Changes reset adjustment.",
        btnNewSection: "+ New Section",
        colFrom: "From",
        colTo: "To",
        colDg: "Δg (mGal)",
        colSigmaMgal: "σ (mGal)",
        dataTableFootnote: "Standard deviation (σ) is computed automatically as σ_priori · √d, but can be manually overridden. When adding a new section, endpoints must exist in the network.",

        // Residuals Table
        residualsTitle: "Residuals & Data Snooping",
        critLimit: "critical limit |w| ≤ ",
        colSection: "Section",
        colObsDg: "Observed Δg",
        colResidualV: "v (Residual)",
        colStdV: "std(v)",
        colWTest: "w-test (Baarda)",
        colState: "Status",
        tipSection: "Identifier of the gravimetric connection (From-To)",
        tipObsDg: "Simulated gravity difference (with random noise and potential blunders)",
        tipResidualV: "Difference between adjusted and observed value",
        tipStdV: "A priori standard deviation of residual and (a posteriori value in parentheses)",
        tipWTest: "w test statistic (Standardized residual). If |w| > critical limit, observation is flagged as a potential gross error.",
        tipState: "Data Snooping outcome (OK or OUTLIER)",

        // Reliability Table
        reliabilityTitle: "Internal Reliability (Sensitivity)",
        colObs: "Obs.",
        colRedundancy: "r (Redundancy)",
        colMdb: "∇₀l (Min. Detectable Bias)",
        colQuality: "Quality",
        tipObs: "Observation identifier",
        tipRedundancy: "Local redundancy number (0 to 1). Measures observation contribution to network redundancy.",
        tipMdb: "Smallest gross error statistically detectable by the system (Minimal Detectable Bias)",
        tipQuality: "Local redundancy grading (Good if r > 0.3, Critical if r < 0.1)",
        qualGood: "Good",
        qualMedium: "Medium",
        qualCritical: "Critical (Uncontrolled)",
        reliabilityFootnote: "<strong>r (0 to 1):</strong> Observation contribution to overall system redundancy.<br><strong>∇₀l:</strong> Smallest gross error detectable statistically with 80% power of test.",

        // Coordinates Table
        coordsTitle: "Adjusted Gravity & External Reliability",
        colPoint: "Station",
        colGadj: "g_adj (mGal)",
        colStdG: "std g (mGal)",
        colExtRelMax: "Max Ext. Rel. (mGal)",
        colOrigin: "Origin",
        tipPoint: "Gravimetric station identifier",
        tipGadj: "Final adjusted gravity value",
        tipStdG: "Standard deviation of gravity a priori and (a posteriori)",
        tipExtRelMax: "Maximum gravity displacement caused by the minimal detectable error of any observation",
        tipOrigin: "Observation responsible for maximum displacement (worst-case external reliability)",
        coordsFootnote: "<strong>Max Ext. Rel.:</strong> largest gravity displacement caused by the minimal detectable bias (∇₀) of any observation — external reliability of the network.",

        // Matrices
        matricesTitle: "Adjustment Matrices",
        matrixDescSummary: "Description",
        matrixErrorRender: "Error rendering matrix.",
        matrixErrorKatex: "Error: KaTeX not loaded.",
        explanations: {
            'A': '<strong>Design / Jacobian Matrix (A):</strong> Encodes the topology connecting relative gravity differences to unknown station gravities.',
            'P': '<strong>Weight Matrix (P):</strong> Diagonal containing inverse variances of observed differences.',
            'L': '<strong>Misclosure / Vector of Observations (L):</strong> Observed gravity differences minus initial approximations.',
            'X': '<strong>Solution Vector (dx):</strong> Least-squares adjustments to absolute gravity stations.',
            'V': '<strong>Residual Vector (V):</strong> Estimated observation residuals across ties.',
            'N': '<strong>Normal Equations Matrix (N):</strong> Symmetric normal matrix N = Aᵀ P A.',
            'SigmaXa': '<strong>Variance-Covariance Matrix (VCM) (&Sigma;<sub>X<sub>a</sub></sub>):</strong> Final propagated stochastic covariance matrix of adjusted gravities.'
        },

        // Monte Carlo
        mcTitle: "Monte Carlo Simulation",
        mcDesc: "Simulates thousands of synthetic gravimetric surveys by injecting Gaussian noise into observed ties, validating stochastic network bounds.",
        mcTrials: "Number of Trials (N)",
        btnRunMonteCarlo: "Run Monte Carlo",
        mcDispScale: "Dispersion scale",
        colBiasG: "Bias g (mGal)",
        colSampleStdG: "Sample σ g (mGal)",
        tipBiasG: "Empirical Bias (Sample Mean - Nominal)",
        tipSampleStdG: "Sample Standard Deviation",
        mcAccepted: "Accepted by Global Test:",
        mcRejected: "Rejected:",
        mcCrashed: "Numerical crashes:",
        mcFootnoteTest: "Rejected runs failed a chi-square global test at significance level of",
        mcFootnoteIdeal: "%. Ideally, rejection rates converge to this theoretical level as N grows large.",
        mcBiasDoc: "<strong>Empirical Bias (Bias g):</strong> Validates unbiased estimation under the linear gravimetric model.",
        mcStdDoc: "<strong>Sample Standard Deviation (σ g):</strong> Measures practical empirical spread across simulated realizations.",

        // Modals
        blunderModalTitle: "⚠ Simulate Gross Error (Blunder)",
        blunderMagLabel: "Error magnitude (Multiple of section standard deviation)",
        blunderHelp: "All selected observations will receive a blunder equal to ±X times their a priori standard deviation.",
        candidateObs: "Candidate observations",
        selectOneOrMore: "(select one or more)",
        btnCancel: "Cancel",
        btnInject: "⚠ Inject Error",
        btnConfirm: "Confirm"
    }
};
