/* Static, offline-capable lesson UI. All numerical work lives in physics.js. */
(() => {
  'use strict';
  const P = window.MEDPhysics;
  const $ = id => document.getElementById(id);
  const colors = { teal: '#5eead4', cyan: '#67d6ff', amber: '#fbbf24', rose: '#fb7185', violet: '#c4b5fd', muted: '#a5b5c9' };

  let currentLang = 'pt-BR';
  let lessons = window.MEDLessonsPt || window.MEDLessons;

  const medI18n = {
    'en': {
      pageTitle: 'EDM — Electronic Distance Measurement Lab',
      brandTitle: 'Electronic Distance Measurement',
      brandSub: 'Topography & Geodesy · Fundamentals Laboratory',
      portalLinkText: '← Portal',
      sidebarEyebrow: 'Study Path',
      sidebarNote: 'Predict the outcome, change a variable, and compare observation with model.',
      supportLink: 'Theory notes and conventions ↗',
      btnReset: 'Reset experiment',
      objectiveLabel: 'Investigate',
      theoryEyebrow: 'From Phenomenon to Model',
      theoryTitle: 'Theoretical Background',
      exerciseEyebrow: 'Investigation Guide',
      exerciseSummary: 'View explanation',
      btnPrev: '← Previous',
      btnNext: 'Next →',
      skipLink: 'Skip to experiment',
      furtherReading: 'Further reading: ',
      experimentPrefix: 'Experiment',
      of: 'of',
      controlsHeading: 'Experiment conditions',
      animate: 'Animate signal',
      pauseAnimate: 'Pause animation',
      motionNote: 'Slowed motion. Physical values appear in the metrics.',
      invalidValue: 'Invalid value: enter a number within the specified range. Results keep the last valid setting.',
      actions: {
        phaseAll: 'Use all four',
        phaseFine: 'Only U = 10 m',
        phaseExample: 'Example 3 123.456 m',
        phaseChallenge: 'New challenge',
        phaseChallengeStart: 'Blind challenge',
        phaseExplore: 'Back to exploration',
        zeroErrors: 'Zero components',
        newNoise: 'New realization',
        matchAir: 'Match setting to ambient air',
        exportCalibration: 'Export observations CSV'
      },
      labels: {
        distance: 'One-way distance',
        timing: 'Round-trip timing error',
        position: 'Animation frame',
        frequency: 'Modulation frequency',
        depth: 'Modulation depth m',
        refDist: 'Reference distance',
        freqsUsed: 'Modulation frequencies (by U)',
        searchRange: 'Search range',
        targetDist: 'Distance to target',
        reflectance: 'Reflectance ρ',
        incidence: 'Incidence to normal',
        inspectDist: 'Inspection distance',
        zeroError: 'Zero error a',
        scaleError: 'Scale error b',
        cyclicAmp: 'Cyclic amplitude A',
        cyclicUnit: 'Error wavelength U',
        cyclicPhase: 'Cycle phase ψ',
        prismError: 'Residual prism error k',
        chartExtent: 'Plot extent',
        specConst: 'Spec: constant part',
        specPpm: 'Spec: ppm part',
        baselineDist: 'Baseline geometry',
        modelParams: 'Parameters to fit',
        simZero: 'Simulated zero',
        simScale: 'Simulated scale',
        simAmp: 'Simulated cyclic amplitude',
        noiseSigma: 'Observation noise σ',
        realTemp: 'Real temperature',
        realPress: 'Real local pressure',
        setTemp: 'Configured temperature',
        setPress: 'Configured pressure',
        totalLength: 'Total length',
        section1: 'Section 1 — at instrument',
        section2: 'Section 2 — intermediate region',
        section3: 'Section 3 — at target',
        uniformPress: 'Uniform pressure',
        reductionSensor: 'Index used in reduction',
        slopeDist: 'Slope distance S',
        zenithAngle: 'Zenith angle z',
        instHeight: 'Instrument height hᵢ',
        targetHeight: 'Target height hₐ',
        sigmaDist: 'Distance σ',
        sigmaAngle: 'Zenith angle σ',
        obsCount: 'Number of observations n',
        fixedBias: 'Injected bias',
        noiseIndependent: 'Independent noise σ'
      },
      tempo: {
        edm: 'EDM',
        target: 'Target',
        totalPath: 'total path',
        outbound: 'Outbound',
        inbound: 'Inbound',
        emission: 'Emission',
        reception: 'Reception',
        svgLabel: 'Round-trip signal over a distance of {d} meters. Total time {t} nanoseconds.',
        mRoundTrip: 'Round-trip physical time',
        mObsTime: 'Observed time',
        mMeasured: 'Measured distance',
        mError: 'Distance error',
        note: 'D = ({v} × {t} × 10⁻⁹) / 2 = <strong>{d} m</strong>. Timing error of {dt} ns produces {de} mm.'
      },
      modulacao: {
        xLabel: 'Time (ns)',
        yLabel: 'Intensity / I₀',
        label: 'Reference and return intensities; phase shift depends on distance and frequency.',
        refLegend: 'Internal reference',
        retLegend: 'Normalized return',
        caption: 'Return attenuation is normalized to compare phase.',
        mWavelength: 'Modulation λ',
        mUnit: 'Unit length U = λ/2',
        mPhase: 'Observable phase',
        mUndefined: 'Undefined',
        mDist001: 'Distance per 0.01°',
        noteActive: 'At this frequency, <strong>{d} m and {d2} m have identical phase</strong>. Phase provides the cycle fraction; the integer requires additional frequencies.',
        noteZero: 'Without modulation (m = 0), intensity is constant: phase cannot be observed.'
      },
      fase: {
        xLabel: 'Candidate distance (m)',
        yLabel: 'Compatible candidates',
        label: '{active} active frequencies. {count} compatible candidates within declared range.',
        mActiveFreqs: 'Active frequencies',
        mCandidates: 'Candidates',
        mUnrestricted: 'Unrestricted',
        mResolved: 'Resolved distance',
        mToRebuild: 'To solve',
        mNotUnique: 'Not unique',
        noteNone: 'Enable at least one frequency. Without observations, distance is unrestricted.',
        noteUniqueChallenge: 'The selected frequencies provide a unique solution. Reconstruct it from phases and verify your answer.',
        noteUnique: 'Single intersection in search range: <strong>{d} m</strong>. Uniqueness depends on the declared range.',
        noteMulti: '<strong>{count} compatible distances</strong> remain. {hint}',
        noteRepeat10k: 'The four unit lengths repeat the phase combination every 10 km.',
        noteUseCoarse: 'Enable coarser frequencies (larger U) to resolve ambiguity.',
        tblCaption: 'Phase readings and physical interpretation',
        tblHeaders: ['Status', 'U (m)', 'λₘ (m)', 'fₘ (MHz)', 'Δφ (°)', 'r (m)'],
        statusActive: 'Active',
        statusOff: 'Off',
        chTitle: 'Reconstruct a compatible distance',
        chHelp: 'Use metres, with decimal point, without thousands separators. Tolerance: 0.002 m.',
        chLabel: 'Your distance (m)',
        chBtn: 'Verify answer',
        detSummary: 'View candidate distances and reconstruction',
        detNone: 'No active readings.',
        chCorrect: 'Correct: {d} m. This is the unique compatible distance in the search range.',
        chCompatible: 'Compatible: {d} m. However there are {n} candidates; these readings do not yet determine a unique distance.',
        chWrong: 'This distance does not match the active phases. Calculate r = UΔφ/360° and test integer N values on other frequencies.',
        chPromptValid: 'Enter a valid distance without text or thousands separators.',
        chPromptActivate: 'Activate at least one frequency before verifying.',
        chPromptRange: 'Answer is outside the search range [0, range).'
      },
      alvos: {
        xLabel: 'Distance to target (m)',
        yLabel: 'Relative return (linear scale)',
        label: 'Diffuse surface return falls with the inverse square of distance.',
        caption: 'Dot marks current condition; 1 corresponds to normal white reference at 100 m.',
        mReturn: 'Relative return',
        mCompRef: 'Compared to reference',
        mIncidence: 'Incidence factor cos(i)',
        noteZero: 'No return signal under this ideal model configuration.',
        noteNormal: 'Doubling distance, all else equal, cuts this return by a factor of 4.',
        tblCaption: 'Comparison of target observing conditions',
        tblHeaders: ['Target', 'Behavior', 'Field caution'],
        tblRows: [
          ['Corner-cube prism', 'Retroreflection within acceptance aperture', 'Prism constant and orientation'],
          ['Diffuse surface', 'Return depends on surface texture & geometry', 'Confirm beam footprint spot'],
          ['Corner or partial obstruction', 'Split beam / multiple returns', 'Avoid mixing multiple target planes']
        ]
      },
      erros: {
        xLabel: 'Distance (m)',
        yLabel: 'Observed − reference error (mm)',
        label: 'Constant, proportional and cyclic error components; dashed band shows nominal spec.',
        captionOut: 'Inspection distance is outside the plot window. Increase plot extent to see the marker.',
        zero: 'Zero',
        scale: 'Scale',
        cyclic: 'Cyclic',
        total: 'Total',
        nominalSpec: '± nominal specification',
        mTotal: 'Total error',
        mCorr: 'First-order correction',
        mNominal: 'Nominal band',
        noteOut: 'Simulated error exceeds nominal specification at this distance.',
        noteIn: 'Being inside the band at this single distance does not prove compliance across the entire working range.',
        tblCaption: 'Decomposition at D = {d} m',
        tblHeaders: ['Component', 'Contribution (mm)'],
        tblRows: ['Zero a', 'Scale bD/1000', 'Cyclic', 'Residual prism error k', 'Total']
      },
      calibracao: {
        diverse: 'Diverse baseline',
        narrow: 'Narrow cluster',
        locked: 'Locked phases',
        repeated: 'Repeated single distance',
        linear: 'Zero + scale',
        cyclicModel: 'Zero + scale + cyclic',
        xLabel: 'Reference distance (m)',
        yLabel: 'Observed error (mm)',
        label: 'Simulated baseline observation errors and fitted calibration model.',
        legendObs: 'Observations',
        legendFit: 'Fitted model',
        mZero: 'Estimated zero â',
        mScale: 'Estimated scale b̂',
        mRms: 'Residual RMS',
        mDof: 'Degrees of freedom',
        mNonId: 'Non-identifiable model',
        mNoSol: 'No solution',
        noteNarrow: 'Narrow baseline distances make separating zero from scale mathematically unstable; inspect parameter variances.',
        noteIncomplete: 'The linear fit omits an active cyclic error present in data. Inspect residuals before accepting the model.',
        noteNormal: 'Compare estimated parameters with the synthetic true values used to generate observations.',
        tblCaption: 'Synthetic observations · seed {seed} · r = observed − model',
        tblHeaders: ['Dref (m)', 'Dobs (m)', 'Error (mm)', 'Model (mm)', 'r (mm)'],
        residTitle: 'Residuals after adjustment',
        residLabel: 'Calibration residuals vs distance.',
        seText: 'A priori standard errors: σ(â) = {sa} mm; σ(b̂) = {sb} ppm.{amp} {noise}'
      },
      atmosfera: {
        xLabel: 'Real temperature (°C)',
        yLabel: 'Required correction (ppm)',
        label: 'Atmospheric correction vs real temperature, with constant pressure and settings.',
        mActual: 'Actual index',
        mConfig: 'Configured index',
        mCorrPpm: 'Atmospheric correction',
        mCorrMm: 'Correction on this line',
        noteZero: 'Instrument configuration matches ambient air: residual correction is zero.',
        noteIncrease: 'Indicated distance must be increased.',
        noteDecrease: 'Indicated distance must be decreased.',
        detailNote: 'Dry gas refractivity model. Results demonstrate physical relations and sign conventions; do not input as operational corrections in total stations.'
      },
      trajeto: {
        banner: 'Three equal-length sections',
        section: 'Section',
        straightNote: 'Straight path · no ray curvature',
        svgLabel: 'Three-section path at {t1}, {t2}, and {t3} degrees Celsius.',
        mIntegrated: 'Integrated average index',
        mUsed: 'Index used in reduction',
        mRemaining: 'Remaining error',
        mTransitTime: 'Integrated time (round trip)',
        noteIntegrated: 'Integrated index recovers exact distance in this three-section model. This does not compute ray path curvature.',
        noteError: 'The selected meteorological strategy leaves <strong>{e} mm</strong> error. Setup temperature and line-average index are physically distinct.',
        tblCaption: 'Comparison of atmospheric reduction strategies',
        tblHeaders: ['Strategy', 'Remaining error (mm)'],
        tblRows: [
          'Thermometer at instrument',
          'Average of endpoint temperatures',
          'Integrated index across 3 sections'
        ]
      },
      estacao: {
        zenith: 'Zenith',
        svgLabel: 'Reduction triangle. Slope distance {s} meters, zenith angle {z} degrees.',
        caption: 'Center-to-center reduction triangle. Heights above ground marks enter separately in Δh.',
        mHorizontal: 'Horizontal distance H',
        mDeltaH: 'Elevation difference Δh',
        mSigmaH: 'σ of H component',
        mSigmaV: 'σ of V component',
        noteHoriz: 'Near horizontal (z = 90°), angular uncertainty affects elevation difference almost exclusively.',
        noteZenith: 'The angle is zenithal: horizontal component uses sine, vertical component uses cosine.',
        tblCaption: 'Standard error contributions before combining in quadrature',
        tblHeaders: ['Source', 'In H (mm)', 'In V (mm)'],
        tblRows: ['Distance S', 'Zenith angle z']
      },
      qualidade: {
        xLabel: 'Observation number',
        yLabel: 'Error relative to reference (mm)',
        label: 'Repeated observations, sample mean, and injected bias. Zero represents reference.',
        legendObs: 'Observations',
        legendMean: 'Sample mean',
        legendBias: 'Injected bias',
        mMeanErr: 'Observed mean error',
        mStdDev: 'Sample standard dev. s',
        mStdErr: 'Estimated standard error s/√n',
        mTheoErr: 'Theoretical standard error σ/√n',
        noteZeroSigma: 'All observations are identical and s = 0. This does not prove absence of systematic bias.',
        noteBias: 'Increasing n concentrates the mean around the biased value, not around the true reference.',
        detSummary: 'View individual sample values',
        tblCaption: 'Individual errors relative to known reference',
        tblHeaders: ['Observation', 'Error (mm)']
      }
    },
    'pt-BR': {
      pageTitle: 'MED — Medida Eletrônica de Distâncias',
      brandTitle: 'Medida Eletrônica de Distâncias',
      brandSub: 'Topografia e Geodésia · laboratório de fundamentos',
      portalLinkText: '← Portal',
      sidebarEyebrow: 'Percurso de estudo',
      sidebarNote: 'Preveja o resultado, altere uma variável e confronte a observação com o modelo.',
      supportLink: 'Texto de apoio e convenções ↗',
      btnReset: 'Restaurar experimento',
      objectiveLabel: 'Investigue',
      theoryEyebrow: 'Do fenômeno ao modelo',
      theoryTitle: 'Fundamentação',
      exerciseEyebrow: 'Roteiro de investigação',
      exerciseSummary: 'Ver explicação',
      btnPrev: '← Anterior',
      btnNext: 'Próximo →',
      skipLink: 'Ir para o experimento',
      furtherReading: 'Aprofundamento: ',
      experimentPrefix: 'Experimento',
      of: 'de',
      controlsHeading: 'Condições do experimento',
      animate: 'Animar sinal',
      pauseAnimate: 'Pausar animação',
      motionNote: 'Movimento desacelerado. Os valores físicos estão nas leituras.',
      invalidValue: 'Valor inválido: use um número dentro do intervalo indicado. Os resultados conservam a última configuração válida.',
      actions: {
        phaseAll: 'Usar as quatro',
        phaseFine: 'Somente U = 10 m',
        phaseExample: 'Exemplo 3 123,456 m',
        phaseChallenge: 'Novo desafio',
        phaseChallengeStart: 'Desafio sem referência',
        phaseExplore: 'Voltar à exploração',
        zeroErrors: 'Zerar componentes',
        newNoise: 'Nova realização',
        matchAir: 'Igualar configuração ao ar',
        exportCalibration: 'Exportar observações CSV'
      },
      labels: {
        distance: 'Distância de ida',
        timing: 'Erro no tempo de ida e volta',
        position: 'Instante na animação',
        frequency: 'Frequência de modulação',
        depth: 'Profundidade m',
        refDist: 'Distância de referência',
        freqsUsed: 'Frequências usadas (por U)',
        searchRange: 'Intervalo de busca',
        targetDist: 'Distância ao alvo',
        reflectance: 'Reflectância ρ',
        incidence: 'Incidência à normal',
        inspectDist: 'Distância de inspeção',
        zeroError: 'Erro de zero a',
        scaleError: 'Erro de escala b',
        cyclicAmp: 'Amplitude cíclica A',
        cyclicUnit: 'Período do erro U',
        cyclicPhase: 'Fase do ciclo ψ',
        prismError: 'Erro residual do prisma k',
        chartExtent: 'Janela do gráfico',
        specConst: 'Especificação: parcela constante',
        specPpm: 'Especificação: parcela proporcional',
        baselineDist: 'Distribuição de comprimentos',
        modelParams: 'Parâmetros a ajustar',
        simZero: 'Zero simulado',
        simScale: 'Escala simulada',
        simAmp: 'Amplitude cíclica simulada',
        noiseSigma: 'σ do ruído por observação',
        realTemp: 'Temperatura real',
        realPress: 'Pressão real no local',
        setTemp: 'Temperatura configurada',
        setPress: 'Pressão configurada',
        totalLength: 'Comprimento total',
        section1: 'Trecho 1 — junto ao instrumento',
        section2: 'Trecho 2 — região intermediária',
        section3: 'Trecho 3 — junto ao alvo',
        uniformPress: 'Pressão uniforme',
        reductionSensor: 'Índice usado na redução',
        slopeDist: 'Distância inclinada S',
        zenithAngle: 'Ângulo zenital z',
        instHeight: 'Altura do instrumento hᵢ',
        targetHeight: 'Altura do alvo hₐ',
        sigmaDist: 'σ da distância',
        sigmaAngle: 'σ do ângulo zenital',
        obsCount: 'Número de observações n',
        fixedBias: 'Viés fixo',
        noiseIndependent: 'σ do ruído independente'
      },
      tempo: {
        edm: 'EDM',
        target: 'Alvo',
        totalPath: 'percurso total',
        outbound: 'Ida',
        inbound: 'Volta',
        emission: 'Emissão',
        reception: 'Recepção',
        svgLabel: 'Sinal de ida e volta por uma distância de {d} metros. Tempo total {t} nanossegundos.',
        mRoundTrip: 'Tempo físico de ida e volta',
        mObsTime: 'Tempo observado',
        mMeasured: 'Distância medida',
        mError: 'Erro da distância',
        note: 'D = ({v} × {t} × 10⁻⁹) / 2 = <strong>{d} m</strong>. O erro temporal de {dt} ns produz {de} mm.'
      },
      modulacao: {
        xLabel: 'Tempo (ns)',
        yLabel: 'Intensidade / I₀',
        label: 'Intensidades de referência e retorno; sua defasagem depende da distância e da frequência.',
        refLegend: 'Referência interna',
        retLegend: 'Retorno normalizado',
        caption: 'A atenuação do retorno foi normalizada para comparar a fase.',
        mWavelength: 'λ da modulação',
        mUnit: 'Intervalo U = λ/2',
        mPhase: 'Fase observável',
        mUndefined: 'Indefinida',
        mDist001: 'Distância equivalente a 0,01°',
        noteActive: 'Nesta frequência, <strong>{d} m e {d2} m têm a mesma fase</strong>. A comparação fornece a fração do ciclo; o inteiro precisa de outras informações.',
        noteZero: 'Sem modulação (m = 0), os sinais são constantes. O comparador não pode observar a fase de modulação.'
      },
      fase: {
        xLabel: 'Distância candidata (m)',
        yLabel: 'Candidatos compatíveis',
        label: '{active} frequências ativas. {count} candidatos compatíveis no intervalo declarado.',
        mActiveFreqs: 'Frequências ativas',
        mCandidates: 'Candidatos',
        mUnrestricted: 'Sem restrição',
        mResolved: 'Distância resolvida',
        mToRebuild: 'A reconstruir',
        mNotUnique: 'Não única',
        noteNone: 'Ative uma frequência. Sem leituras, não há restrição observacional sobre a distância.',
        noteUniqueChallenge: 'As frequências selecionadas permitem uma solução no intervalo de busca. Reconstrua-a a partir das fases e confira sua resposta.',
        noteUnique: 'Há uma única interseção no intervalo de busca: <strong>{d} m</strong>. A unicidade depende também do alcance adotado.',
        noteMulti: 'Permanecem <strong>{count} distâncias compatíveis</strong>. {hint}',
        noteRepeat10k: 'Os quatro U repetem o conjunto de fases a cada 10 km.',
        noteUseCoarse: 'Ative frequências com U maior para reduzir a ambiguidade.',
        tblCaption: 'Leituras de fase e sua interpretação física',
        tblHeaders: ['Uso', 'U (m)', 'λₘ (m)', 'fₘ (MHz)', 'Δφ (°)', 'r (m)'],
        statusActive: 'Ativa',
        statusOff: 'Desligada',
        chTitle: 'Reconstrua uma distância compatível',
        chHelp: 'Use metros, com ponto ou vírgula decimal, sem separador de milhares. Tolerância de 0,002 m.',
        chLabel: 'Sua distância (m)',
        chBtn: 'Verificar resposta',
        detSummary: 'Ver os candidatos e a reconstrução',
        detNone: 'Nenhuma leitura ativa.',
        chCorrect: 'Correto: {d} m. Esta é a única distância compatível no intervalo.',
        chCompatible: 'Compatível: {d} m. Porém há {n} candidatos; esta leitura ainda não determina uma distância única.',
        chWrong: 'Essa distância não reproduz as fases ativas. Calcule r = UΔφ/360° e teste os inteiros N nas demais frequências.',
        chPromptValid: 'Digite uma distância válida, sem texto ou separadores de milhares.',
        chPromptActivate: 'Ative ao menos uma frequência antes de verificar.',
        chPromptRange: 'A resposta está fora do intervalo de busca [0, alcance).'
      },
      alvos: {
        xLabel: 'Distância ao alvo (m)',
        yLabel: 'Retorno relativo (escala linear)',
        label: 'Retorno de uma superfície difusa decresce com o quadrado da distância.',
        caption: 'O ponto marca a condição atual; 1 equivale à referência branca normal a 100 m.',
        mReturn: 'Retorno relativo',
        mCompRef: 'Comparado à referência',
        mIncidence: 'Fator de incidência cos(i)',
        noteZero: 'Não há retorno no modelo ideal desta configuração.',
        noteNormal: 'Dobrar a distância, sem alterar os demais fatores, divide este retorno por quatro.',
        tblCaption: 'Compare as condições de observação',
        tblHeaders: ['Alvo', 'Comportamento', 'Cuidado de campo'],
        tblRows: [
          ['Prisma de canto de cubo', 'Retroreflexão dentro da abertura útil', 'Constante e orientação do conjunto'],
          ['Superfície difusa', 'Retorno depende da superfície e geometria', 'Identificar o ponto iluminado'],
          ['Quina ou alvo parcialmente obstruído', 'Possibilidade de múltiplos retornos', 'Evitar misturar planos e distâncias']
        ]
      },
      erros: {
        xLabel: 'Distância (m)',
        yLabel: 'Erro observado − referência (mm)',
        label: 'Componentes constante, proporcional e cíclica do erro; faixa nominal em tracejado.',
        captionOut: 'A distância de inspeção está fora da janela do gráfico. Amplie a janela para ver o marcador.',
        zero: 'Zero',
        scale: 'Escala',
        cyclic: 'Cíclico',
        total: 'Total',
        nominalSpec: '± especificação nominal',
        mTotal: 'Erro total',
        mCorr: 'Correção de primeira ordem',
        mNominal: 'Faixa nominal',
        noteOut: 'O erro simulado está fora da faixa nominal nesta distância.',
        noteIn: 'Estar dentro da faixa nesta distância não demonstra conformidade do instrumento em toda a faixa de trabalho.',
        tblCaption: 'Decomposição em D = {d} m',
        tblHeaders: ['Componente', 'Contribuição (mm)'],
        tblRows: ['Zero a', 'Escala bD/1000', 'Ciclo', 'Erro residual do prisma k', 'Total']
      },
      calibracao: {
        diverse: 'Base diversificada',
        narrow: 'Comprimentos próximos',
        locked: 'Fases repetidas',
        repeated: 'Uma distância repetida',
        linear: 'Zero + escala',
        cyclicModel: 'Zero + escala + ciclo',
        xLabel: 'Distância de referência (m)',
        yLabel: 'Erro observado (mm)',
        label: 'Erros das observações simuladas e modelo de calibração ajustado.',
        legendObs: 'Observações',
        legendFit: 'Modelo ajustado',
        mZero: 'Zero estimado â',
        mScale: 'Escala estimada b̂',
        mRms: 'RMS dos resíduos',
        mDof: 'Graus de liberdade',
        mNonId: 'Modelo não identificável',
        mNoSol: 'Sem solução',
        noteNarrow: 'Comprimentos muito próximos tornam a separação dos parâmetros frágil; examine suas incertezas.',
        noteIncomplete: 'O ajuste ignora uma componente cíclica presente nos dados. Inspecione os resíduos antes de aceitar o modelo.',
        noteNormal: 'Compare os valores estimados com os parâmetros usados para gerar as observações.',
        tblCaption: 'Observações sintéticas · semente {seed} · r = observado − modelo',
        tblHeaders: ['Dref (m)', 'Dobs (m)', 'Erro (mm)', 'Modelo (mm)', 'r (mm)'],
        residTitle: 'Resíduos após o ajuste',
        residLabel: 'Resíduos da calibração em função da distância.',
        seText: 'Incertezas padrão a priori: σ(â) = {sa} mm; σ(b̂) = {sb} ppm.{amp} {noise}'
      },
      atmosfera: {
        xLabel: 'Temperatura real (°C)',
        yLabel: 'Correção a aplicar (ppm)',
        label: 'Correção atmosférica em função da temperatura real, mantendo as pressões e a configuração fixas.',
        mActual: 'Índice real',
        mConfig: 'Índice configurado',
        mCorrPpm: 'Correção atmosférica',
        mCorrMm: 'Correção nesta linha',
        noteZero: 'A configuração corresponde ao ar real: a correção residual é zero.',
        noteIncrease: 'É preciso aumentar a distância indicada.',
        noteDecrease: 'É preciso diminuir a distância indicada.',
        detailNote: 'Modelo de densidade de gás seco. Os resultados explicam a relação física e a convenção de sinal; não devem ser inseridos como correções operacionais em uma estação total.'
      },
      trajeto: {
        banner: 'Três trechos com o mesmo comprimento',
        section: 'Trecho',
        straightNote: 'Linha reta · sem traçado de raios',
        svgLabel: 'Linha em três trechos a {t1}, {t2} e {t3} graus Celsius.',
        mIntegrated: 'Índice médio integrado',
        mUsed: 'Índice usado na redução',
        mRemaining: 'Erro restante',
        mTransitTime: 'Tempo integrado (ida e volta)',
        noteIntegrated: 'O índice integrado recupera a distância neste modelo de três trechos conhecidos. Isso não calcula uma correção de curvatura do raio.',
        noteError: 'A leitura meteorológica selecionada deixa <strong>{e} mm</strong> de erro. Temperatura local e índice médio do caminho representam grandezas diferentes.',
        tblCaption: 'Comparação das estratégias de redução',
        tblHeaders: ['Estratégia', 'Erro restante (mm)'],
        tblRows: [
          'Termômetro no instrumento',
          'Média das temperaturas extremas',
          'Índice integrado dos três trechos'
        ]
      },
      estacao: {
        zenith: 'Zênite',
        svgLabel: 'Triângulo de redução. Distância inclinada {s} metros, ângulo zenital {z} graus.',
        caption: 'Triângulo entre os centros. As alturas sobre o terreno entram separadamente em Δh.',
        mHorizontal: 'Distância horizontal H',
        mDeltaH: 'Desnível entre pontos Δh',
        mSigmaH: 'σ da componente H',
        mSigmaV: 'σ da componente V',
        noteHoriz: 'Na horizontal, a incerteza angular atua principalmente no desnível.',
        noteZenith: 'O ângulo é zenital: a componente horizontal usa seno, a vertical usa cosseno.',
        tblCaption: 'Contribuições padrão antes de combinar em quadratura',
        tblHeaders: ['Origem', 'Em H (mm)', 'Em V (mm)'],
        tblRows: ['Distância', 'Ângulo zenital']
      },
      qualidade: {
        xLabel: 'Número da observação',
        yLabel: 'Erro em relação à referência (mm)',
        label: 'Observações repetidas, média amostral e viés imposto. Zero representa a referência.',
        legendObs: 'Observações',
        legendMean: 'Média da série',
        legendBias: 'Viés imposto',
        mMeanErr: 'Erro da média observada',
        mStdDev: 'Desvio padrão amostral s',
        mStdErr: 'Erro padrão estimado s/√n',
        mTheoErr: 'Erro padrão teórico σ/√n',
        noteZeroSigma: 'Todas as observações coincidem e s = 0. Isso não demonstra ausência de viés.',
        noteBias: 'Aumentar n concentra a média ao redor do valor com viés, não necessariamente ao redor da referência.',
        detSummary: 'Ver valores da série',
        tblCaption: 'Erros individuais em relação à referência conhecida',
        tblHeaders: ['Observação', 'Erro (mm)']
      }
    }
  };

  const t = keyPath => {
    const parts = keyPath.split('.');
    let cur = medI18n[currentLang] || medI18n['pt-BR'];
    for (const part of parts) {
      if (cur && cur[part] !== undefined) cur = cur[part];
      else return keyPath;
    }
    return cur;
  };

  const fmt = (v, digits = 3) => Number.isFinite(v) ? v.toLocaleString(currentLang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const signed = (v, digits = 3) => (v > 0 ? '+' : '') + fmt(v, digits);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const defaults = {
    tempo: { distance: 300, timing: 0, position: 25 },
    modulacao: { distance: 23.456, frequency: 15, depth: 0.7 },
    fase: { distance: 3123.456, active: [true, false, false, false], range: 10000, challenge: false, seed: 12, feedback: '' },
    alvos: { distance: 100, reflectance: 0.8, incidence: 0 },
    erros: { distance: 125, zero: 5, scale: 4, amplitude: 3, phaseDeg: 30, unit: 10, prism: 0, extent: 500, a: 2, b: 2 },
    calibracao: { zero: 5, scale: 4, amplitude: 3, unit: 20, noise: 1, baseline: 'diverse', model: 'linear', seed: 42 },
    atmosfera: { distance: 1000, temperature: 25, pressure: 1013.25, setTemperature: 15, setPressure: 1013.25 },
    trajeto: { distance: 1000, t1: 15, t2: 35, t3: 15, pressure: 1013.25, sensor: 'start' },
    estacao: { distance: 100, zenith: 60, hi: 1.5, ht: 2, sigma: 2, angleSigma: 5 },
    qualidade: { count: 30, bias: 5, sigma: 2, seed: 42 }
  };
  const states = structuredClone(defaults);
  let current = 0, animation = false, frame = null, lastTime = null, motion = 0;
  let calibrationRows = [];
  const state = () => states[lessons[current].id];
  const metric = (name, value, unit = '') => `<div class="metric"><span class="metric-label">${name}</span><span class="metric-value">${value}${unit ? `<span class="metric-unit">${unit}</span>` : ''}</span></div>`;
  const note = (text, warning = false) => { $('interpretation').classList.toggle('warning', warning); $('interpretation').innerHTML = `<p>${text}</p>`; };

  function control(key, label, min, max, step, unit = '', help = '') {
    const value = state()[key];
    return `<div class="control"><label for="input-${key}">${label}</label><div class="input-row"><input id="input-${key}" data-key="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"${help ? ` aria-describedby="help-${key}"` : ''}><span class="unit">${unit}</span></div><input type="range" data-key="${key}" aria-label="${label}" value="${value}" min="${min}" max="${max}" step="${step}">${help ? `<p class="help" id="help-${key}">${help}</p>` : ''}</div>`;
  }
  function select(key, label, options) {
    return `<div class="control"><label for="input-${key}">${label}</label><select id="input-${key}" data-key="${key}">${options.map(([value, name]) => `<option value="${value}"${String(state()[key]) === String(value) ? ' selected' : ''}>${name}</option>`).join('')}</select></div>`;
  }
  const action = (name, label) => `<button type="button" class="secondary" data-action="${name}">${label}</button>`;
  const motionControl = () => `<div class="control-actions">${action('animate', animation ? t('pauseAnimate') : t('animate'))}</div><p class="small">${t('motionNote')}</p>`;
  const legend = entries => `<div class="chart-legend">${entries.map(([label, color]) => `<span><i class="legend-swatch" style="--swatch:${color}"></i>${label}</span>`).join('')}</div>`;
  const table = (caption, headers, rows) => `<div class="table-wrap" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${caption}</caption><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  function dimensions(height = 300) { return { w: Math.max(300, $('visual').clientWidth - 16), h: height }; }
  function svg(body, label, w, h = 300) { return `<div class="chart-frame"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg></div>`; }
  function text(x, y, label, color = colors.muted, anchor = 'middle', size = 14) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="system-ui,sans-serif" font-size="${size}">${esc(label)}</text>`;
  }
  const line = (x1, y1, x2, y2, color, dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.7"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const circle = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;

  function chart({ series = [], xMin = 0, xMax = 1, yMin = -1, yMax = 1, xLabel = '', yLabel = '', label = '', marker = null, points = [], height = 300 }) {
    const { w, h } = dimensions(height), pad = { l: 58, r: 18, t: 30, b: 50 };
    const X = x => pad.l + (x - xMin) / (xMax - xMin) * (w - pad.l - pad.r);
    const Y = y => h - pad.b - (y - yMin) / (yMax - yMin) * (h - pad.t - pad.b);
    let body = text(pad.l, 18, yLabel, colors.muted, 'start');
    for (let i = 0; i <= 4; i++) {
      const x = xMin + (xMax - xMin) * i / 4, y = yMin + (yMax - yMin) * i / 4;
      body += line(X(x), pad.t, X(x), h - pad.b, '#1e3045') + line(pad.l, Y(y), w - pad.r, Y(y), '#1e3045');
      body += text(X(x), h - 29, fmt(x, xMax - xMin < 10 ? 1 : 0), colors.muted, 'middle', 12);
      body += text(pad.l - 8, Y(y) + 4, fmt(y, yMax - yMin < 10 ? 1 : 0), colors.muted, 'end', 12);
    }
    if (yMin < 0 && yMax > 0) body += line(pad.l, Y(0), w - pad.r, Y(0), '#60748a', '4 4');
    body += `<svg x="${pad.l}" y="${pad.t}" width="${w - pad.l - pad.r}" height="${h - pad.t - pad.b}" viewBox="${pad.l} ${pad.t} ${w - pad.l - pad.r} ${h - pad.t - pad.b}" overflow="hidden">`;
    for (const s of series) {
      body += `<polyline points="${s.data.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
    }
    if (marker !== null) body += line(X(marker), pad.t, X(marker), h - pad.b, colors.violet, '4 4');
    for (const p of points) body += circle(X(p.x), Y(p.y), p.r || 4, p.color || colors.amber);
    body += '</svg>' + text((pad.l + w - pad.r) / 2, h - 6, xLabel);
    return svg(body, label, w, h);
  }
  function samples(count, min, max, fn) { return Array.from({ length: count + 1 }, (_, i) => { const x = min + (max - min) * i / count; return [x, fn(x)]; }); }

  function renderControls() {
    const id = lessons[current].id, s = state();
    let html = `<h3>${t('controlsHeading')}</h3>`;
    if (id === 'tempo') html += control('distance', t('labels.distance'), 1, 2000, 1, 'm') + control('timing', t('labels.timing'), -2, 2, .01, 'ns') + control('position', t('labels.position'), 0, 100, 1, '%') + motionControl();
    if (id === 'modulacao') html += control('distance', t('labels.distance'), 0, 100, .001, 'm') + control('frequency', t('labels.frequency'), 1, 60, .1, 'MHz') + control('depth', t('labels.depth'), 0, 1, .05) + motionControl();
    if (id === 'fase') {
      if (!s.challenge) html += control('distance', t('labels.refDist'), 0, 9999.999, .001, 'm');
      else html += `<p class="small">${currentLang === 'en' ? 'Reference distance hidden. Solve the blind challenge using only the phase readings.' : 'Distância de referência oculta. Use somente as leituras para resolver o desafio.'}</p>`;
      html += `<div class="control"><fieldset><legend>${t('labels.freqsUsed')}</legend>` + P.UNITS.map((u, i) => `<label class="check-row"><input type="checkbox" data-frequency="${i}"${s.active[i] ? ' checked' : ''}>U = ${fmt(u, 0)} m</label>`).join('') + '</fieldset></div>';
      html += select('range', t('labels.searchRange'), [[10000, '0 ≤ D < 10 km'], [20000, '0 ≤ D < 20 km']]);
      html += `<div class="control-actions">${action('phaseAll', t('actions.phaseAll'))}${action('phaseFine', t('actions.phaseFine'))}${action('phaseExample', t('actions.phaseExample'))}${action('phaseChallenge', s.challenge ? t('actions.phaseChallenge') : t('actions.phaseChallengeStart'))}${s.challenge ? action('phaseExplore', t('actions.phaseExplore')) : ''}</div>`;
      html += `<p class="small">${currentLang === 'en' ? 'Phases are idealized. The table rounds display values; calculation uses full machine precision.' : 'As fases são ideais. A tabela arredonda a exibição; o cálculo usa a precisão completa.'}</p>`;
    }
    if (id === 'alvos') html += control('distance', t('labels.targetDist'), 10, 500, 1, 'm') + control('reflectance', t('labels.reflectance'), 0, 1, .01) + control('incidence', t('labels.incidence'), 0, 90, 1, '°') + `<p class="small">${currentLang === 'en' ? 'Relative diffuse model. Does not represent the maximum range of an instrument.' : 'Modelo relativo de superfície difusa. Não representa o alcance de um aparelho.'}</p>`;
    if (id === 'erros') html += control('distance', t('labels.inspectDist'), 1, 2000, 1, 'm') + control('zero', t('labels.zeroError'), -20, 20, .5, 'mm') + control('scale', t('labels.scaleError'), -20, 20, .5, 'ppm') + control('amplitude', t('labels.cyclicAmp'), 0, 10, .1, 'mm') + control('unit', t('labels.cyclicUnit'), 5, 50, 1, 'm') + control('phaseDeg', t('labels.cyclicPhase'), 0, 360, 5, '°') + control('prism', t('labels.prismError'), -30, 30, 1, 'mm') + select('extent', t('labels.chartExtent'), [[50, '0–50 m'], [500, '0–500 m'], [2000, '0–2 000 m']]) + control('a', t('labels.specConst'), 0, 10, .5, 'mm') + control('b', t('labels.specPpm'), 0, 10, .5, 'ppm') + `<div class="control-actions">${action('zeroErrors', t('actions.zeroErrors'))}</div>`;
    if (id === 'calibracao') html += select('baseline', t('labels.baselineDist'), [['diverse', t('calibracao.diverse')], ['narrow', t('calibracao.narrow')], ['locked', t('calibracao.locked')], ['repeated', t('calibracao.repeated')]]) + select('model', t('labels.modelParams'), [['linear', t('calibracao.linear')], ['cyclic', t('calibracao.cyclicModel')]]) + control('zero', t('labels.simZero'), -20, 20, .5, 'mm') + control('scale', t('labels.simScale'), -20, 20, .5, 'ppm') + control('amplitude', t('labels.simAmp'), 0, 10, .1, 'mm') + control('noise', t('labels.noiseSigma'), 0, 5, .1, 'mm') + `<p class="small">${currentLang === 'en' ? 'U = 20 m; ψ = 30°. The baseline contains 8 observations. Synthetic parameters are known only to the generator.' : 'U = 20 m; ψ = 30°. A base contém 8 observações. Os parâmetros simulados são conhecidos apenas pelo gerador.'}</p>` + `<div class="control-actions">${action('newNoise', t('actions.newNoise'))}${action('exportCalibration', t('actions.exportCalibration'))}</div>`;
    if (id === 'atmosfera') html += control('distance', t('labels.refDist'), 10, 5000, 10, 'm') + control('temperature', t('labels.realTemp'), -10, 45, .5, '°C') + control('pressure', t('labels.realPress'), 700, 1050, .25, 'hPa') + control('setTemperature', t('labels.setTemp'), -10, 45, .5, '°C') + control('setPressure', t('labels.setPress'), 700, 1050, .25, 'hPa') + `<div class="control-actions">${action('matchAir', t('actions.matchAir'))}</div><p class="small">${currentLang === 'en' ? 'Dry gas: humidity and detailed dispersion are not modeled here.' : 'Gás seco: umidade e dispersão não são simuladas.'}</p>`;
    if (id === 'trajeto') html += control('distance', t('labels.totalLength'), 30, 5000, 10, 'm') + control('t1', t('labels.section1'), -10, 45, .5, '°C') + control('t2', t('labels.section2'), -10, 45, .5, '°C') + control('t3', t('labels.section3'), -10, 45, .5, '°C') + control('pressure', t('labels.uniformPress'), 700, 1050, .25, 'hPa') + select('sensor', t('labels.reductionSensor'), [['start', t('trajeto.tblRows.0')], ['endpoints', t('trajeto.tblRows.1')], ['integrated', t('trajeto.tblRows.2')]]) + `<p class="small">${currentLang === 'en' ? 'Three segments with equal length. The line remains straight in this model.' : 'Três segmentos com o mesmo comprimento. A linha permanece reta no modelo.'}</p>`;
    if (id === 'estacao') html += control('distance', t('labels.slopeDist'), 1, 2000, 1, 'm') + control('zenith', t('labels.zenithAngle'), 0, 180, .1, '°') + control('hi', t('labels.instHeight'), 0, 5, .01, 'm') + control('ht', t('labels.targetHeight'), 0, 5, .01, 'm') + control('sigma', t('labels.sigmaDist'), 0, 10, .1, 'mm') + control('angleSigma', t('labels.sigmaAngle'), 0, 30, .5, '″');
    if (id === 'qualidade') html += control('count', t('labels.obsCount'), 2, 500, 1) + control('bias', t('labels.fixedBias'), -10, 10, .5, 'mm') + control('sigma', t('labels.noiseIndependent'), 0, 5, .1, 'mm') + `<div class="control-actions">${action('newNoise', currentLang === 'en' ? 'New series' : 'Nova série')}</div><p class="small">${currentLang === 'en' ? `Seed ${s.seed}. Altering n preserves the start of the same random number sequence.` : `Semente ${s.seed}. Alterar n conserva o início da mesma série de números aleatórios.`}</p>`;
    $('controls').innerHTML = html;
  }

  function renderPulse(onlyVisual = false) {
    const s = state(), r = P.pulse(s.distance, P.REFERENCE.index, s.timing), { w } = dimensions(270);
    const x1 = 44, x2 = w - 44, y = 78, fraction = animation ? (motion % 1) : s.position / 100;
    const outbound = fraction <= .5, position = outbound ? fraction * 2 : 2 - fraction * 2;
    let body = text(x1, 32, t('tempo.edm'), colors.cyan) + text(x2, 32, t('tempo.target'), colors.amber);
    body += line(x1, y, x2, y, '#45627c') + circle(x1, y, 7, colors.cyan) + circle(x2, y, 7, colors.amber);
    body += circle(x1 + (x2 - x1) * position, y, 6, outbound ? colors.teal : colors.rose);
    body += text(w / 2, 118, `D = ${fmt(s.distance, 0)} m · ${t('tempo.totalPath')} = ${fmt(2 * s.distance, 0)} m`);
    body += text(w / 2, 154, `${outbound ? t('tempo.outbound') : t('tempo.inbound')} · t = ${fmt(fraction * r.time * 1e9, 2)} ns`, colors.teal, 'middle', 16);
    const start = 58, end = w - 30;
    body += line(start, 207, end, 207, '#567086') + line(start, 195, start, 219, colors.cyan) + line(end, 195, end, 219, colors.rose);
    body += text(start, 240, t('tempo.emission'), colors.cyan, 'start') + text(end, 240, t('tempo.reception'), colors.rose, 'end');
    body += text(w / 2, 195, `Δt = ${fmt(r.time * 1e9, 3)} ns`, colors.muted);
    $('visual').innerHTML = svg(body, t('tempo.svgLabel').replace('{d}', s.distance).replace('{t}', fmt(r.time * 1e9)), w, 265);
    if (onlyVisual) return;
    $('metrics').innerHTML = metric(t('tempo.mRoundTrip'), fmt(r.time * 1e9), 'ns') + metric(t('tempo.mObsTime'), fmt(r.observedTime * 1e9), 'ns') + metric(t('tempo.mMeasured'), fmt(r.measured, 4), 'm') + metric(t('tempo.mError'), signed(r.errorMm), 'mm');
    note(t('tempo.note').replace('{v}', fmt(r.velocity, 1)).replace('{t}', fmt(r.observedTime * 1e9, 3)).replace('{d}', fmt(r.measured, 4)).replace('{dt}', signed(s.timing, 2)).replace('{de}', signed(r.errorMm)));
    $('labDetail').innerHTML = '';
  }

  function renderModulation(onlyVisual = false) {
    const s = state(), unit = P.C / (P.REFERENCE.index * s.frequency * 1e6 * 2), r = P.phase(s.distance, unit), offset = animation ? motion * 2 : 0;
    const periodNs = 1000 / s.frequency;
    $('visual').innerHTML = chart({ series: [
      { color: colors.cyan, data: samples(300, 0, 3 * periodNs, t0 => 1 + s.depth * Math.cos(P.TAU * t0 / periodNs - offset)) },
      { color: colors.amber, dash: '7 4', data: samples(300, 0, 3 * periodNs, t0 => 1 + s.depth * Math.cos(P.TAU * t0 / periodNs - offset - r.degrees * Math.PI / 180)) }
    ], xMax: 3 * periodNs, yMin: 0, yMax: 2.1, xLabel: t('modulacao.xLabel'), yLabel: t('modulacao.yLabel'), label: t('modulacao.label') }) + legend([[t('modulacao.refLegend'), colors.cyan], [t('modulacao.retLegend'), colors.amber]]) + `<p class="chart-caption">${t('modulacao.caption')}</p>`;
    if (onlyVisual) return;
    $('metrics').innerHTML = metric(t('modulacao.mWavelength'), fmt(r.wavelength, 4), 'm') + metric(t('modulacao.mUnit'), fmt(unit, 4), 'm') + metric(t('modulacao.mPhase'), s.depth ? fmt(r.degrees, 3) : t('modulacao.mUndefined'), s.depth ? '°' : '') + metric(t('modulacao.mDist001'), fmt(unit * .01 / 360 * 1000, 3), 'mm');
    note(s.depth ? t('modulacao.noteActive').replace('{d}', fmt(s.distance, 3)).replace('{d2}', fmt(s.distance + unit, 3)) : t('modulacao.noteZero'), !s.depth);
    $('labDetail').innerHTML = `<div class="equation">λ<sub>m</sub> = ${P.C} / (1.00028 × ${fmt(s.frequency, 1)} × 10⁶) = ${fmt(r.wavelength, 4)} m</div>`;
  }

  function renderPhase() {
    const s = state(), readings = P.UNITS.map(u => P.phase(s.distance, u)), active = readings.filter((_, i) => s.active[i]);
    const solution = P.solveAmbiguity(active, s.range), count = solution.candidates.length;
    const points = solution.candidates.map(c => ({ x: c.distance, y: 1, r: count > 100 ? 1 : count > 20 ? 2 : 5, color: colors.teal }));
    $('visual').innerHTML = chart({ points, xMax: s.range, yMin: 0, yMax: 2, xLabel: t('fase.xLabel'), yLabel: t('fase.yLabel'), label: t('fase.label').replace('{active}', active.length).replace('{count}', count) });
    const uniqueText = solution.unique && !s.challenge ? fmt(solution.candidates[0].distance) : s.challenge && solution.unique ? t('fase.mToRebuild') : t('fase.mNotUnique');
    $('metrics').innerHTML = metric(t('fase.mActiveFreqs'), String(active.length)) + metric(t('fase.mCandidates'), active.length ? String(count) : t('fase.mUnrestricted')) + metric(t('fase.mResolved'), uniqueText, solution.unique && !s.challenge ? 'm' : '');
    if (!active.length) note(t('fase.noteNone'), true);
    else if (solution.unique) note(s.challenge ? t('fase.noteUniqueChallenge') : t('fase.noteUnique').replace('{d}', fmt(solution.candidates[0].distance)));
    else note(t('fase.noteMulti').replace('{count}', count).replace('{hint}', s.range > 10000 ? t('fase.noteRepeat10k') : t('fase.noteUseCoarse')), true);
    $('labDetail').innerHTML = table(t('fase.tblCaption'), t('fase.tblHeaders'), readings.map((r, i) => [s.active[i] ? t('fase.statusActive') : t('fase.statusOff'), fmt(r.unit, 0), fmt(r.wavelength, 0), fmt(r.frequency / 1e6, 6), s.active[i] ? fmt(r.degrees, 6) : '—', s.active[i] ? fmt(r.remainder, 3) : '—'])) + (s.challenge ? `<div class="challenge"><h3>${t('fase.chTitle')}</h3><p class="small">${t('fase.chHelp')}</p><form id="phaseAnswerForm"><div class="control"><label for="phaseAnswer">${t('fase.chLabel')}</label><input id="phaseAnswer" type="text" inputmode="decimal" autocomplete="off" required></div><button type="submit">${t('fase.chBtn')}</button></form><p id="phaseFeedback" class="feedback" role="status">${s.feedback}</p></div>` : `<details><summary>${t('fase.detSummary')}</summary><p>${active.length ? solution.candidates.slice(0, 20).map(c => `${fmt(c.distance)} m`).join(' · ') + (count > 20 ? ` … (${count})` : '') : t('fase.detNone')}</p>${solution.unique ? `<p>D = ${solution.candidates[0].cycles} × ${fmt(Math.min(...active.map(r => r.unit)), 0)} + ${fmt(solution.candidates[0].distance % Math.min(...active.map(r => r.unit)))} = ${fmt(solution.candidates[0].distance)} m.</p>` : ''}</details>`);
  }

  function renderTargets() {
    const s = state(), signal = P.targetReturn(s.distance, s.reflectance, s.incidence);
    $('visual').innerHTML = chart({ series: [{ color: colors.amber, data: samples(250, 10, 500, d => P.targetReturn(d, s.reflectance, s.incidence)) }], points: [{ x: s.distance, y: signal }], xMin: 10, xMax: 500, yMin: 0, yMax: Math.max(.05, P.targetReturn(10, s.reflectance, s.incidence) * 1.1), xLabel: t('alvos.xLabel'), yLabel: t('alvos.yLabel'), label: t('alvos.label'), marker: s.distance }) + `<p class="chart-caption">${t('alvos.caption')}</p>`;
    $('metrics').innerHTML = metric(t('alvos.mReturn'), fmt(signal, 5)) + metric(t('alvos.mCompRef'), fmt(signal * 100, 2), '%') + metric(t('alvos.mIncidence'), fmt(Math.cos(s.incidence * Math.PI / 180), 3));
    note(`S = ${fmt(s.reflectance, 2)} × cos(${fmt(s.incidence, 0)}°) × (100/${fmt(s.distance, 0)})² = <strong>${fmt(signal, 5)}</strong>. ${signal < 1e-10 ? t('alvos.noteZero') : t('alvos.noteNormal')}`);
    $('labDetail').innerHTML = table(t('alvos.tblCaption'), t('alvos.tblHeaders'), t('alvos.tblRows'));
  }

  function renderErrors() {
    const s = state(), r = P.errorBudget(s.distance, s), n = P.nominalMm(s.distance, s.a, s.b);
    const samplesCount = Math.min(4000, Math.max(500, Math.ceil(s.extent / s.unit * 12)));
    const components = [['zero', t('erros.zero'), colors.cyan], ['scale', t('erros.scale'), colors.amber], ['cyclic', t('erros.cyclic'), colors.violet], ['total', t('erros.total'), colors.rose]];
    const series = components.map(([key, , color]) => ({ color, width: key === 'total' ? 2.5 : 1.3, data: samples(samplesCount, 0, s.extent, d => P.errorBudget(d, s)[key]) }));
    series.push(...[1, -1].map(sign => ({ color: colors.teal, dash: '6 5', data: samples(1, 0, s.extent, d => sign * P.nominalMm(d, s.a, s.b)) })));
    const extent = Math.max(1, ...series.flatMap(ser => ser.data.map(v => Math.abs(v[1])))) * 1.15;
    $('visual').innerHTML = chart({ series, xMax: s.extent, yMin: -extent, yMax: extent, xLabel: t('erros.xLabel'), yLabel: t('erros.yLabel'), label: t('erros.label'), marker: s.distance }) + legend([...components.map(([, name, color]) => [name, color]), [t('erros.nominalSpec'), colors.teal]]) + (s.distance > s.extent ? `<p class="chart-caption">${t('erros.captionOut')}</p>` : '');
    $('metrics').innerHTML = metric(t('erros.mTotal'), signed(r.total), 'mm') + metric(t('erros.mCorr'), signed(-r.total), 'mm') + metric(t('erros.mNominal'), `±${fmt(n, 2)}`, 'mm');
    note(`e = ${signed(r.zero)} + (${signed(r.scale)}) + (${signed(r.cyclic)}) + (${signed(r.prism)}) = <strong>${signed(r.total)} mm</strong>. ${Math.abs(r.total) > n ? t('erros.noteOut') : t('erros.noteIn')}`, Math.abs(r.total) > n);
    $('labDetail').innerHTML = table(t('erros.tblCaption').replace('{d}', fmt(s.distance, 0)), t('erros.tblHeaders'), [[t('erros.tblRows.0'), signed(r.zero)], [t('erros.tblRows.1'), signed(r.scale)], [t('erros.tblRows.2'), signed(r.cyclic)], [t('erros.tblRows.3'), signed(r.prism)], [t('erros.tblRows.4'), signed(r.total)]]);
  }

  const bases = { diverse: [20, 55, 109, 213, 347, 526, 781, 1004], narrow: [100, 100.1, 100.2, 100.3, 100.4, 100.5, 100.6, 100.7], locked: [20, 60, 120, 220, 360, 520, 780, 1020], repeated: [100, 100, 100, 100, 100, 100, 100, 100] };

  function renderCalibration() {
    const s = state();
    calibrationRows = P.calibrationObservations(bases[s.baseline], { ...s, phaseDeg: 30 }, s.noise, s.seed);
    let fit = null, error = '';
    try { fit = P.fitCalibration(calibrationRows, s.unit, s.model === 'cyclic'); } catch (e) { error = e.message; }
    const xMax = Math.max(...bases[s.baseline]) * 1.04;
    const extent = Math.max(1, ...calibrationRows.map(o => Math.abs(o.errorMm)), ...(fit ? fit.fitted.map(Math.abs) : [])) * 1.25;
    const fitFn = d => fit.coefficients[0] + fit.coefficients[1] * d / 1000 + (s.model === 'cyclic' ? fit.coefficients[2] * Math.sin(P.TAU * d / s.unit) + fit.coefficients[3] * Math.cos(P.TAU * d / s.unit) : 0);
    const xMin = s.baseline === 'narrow' ? 99.95 : 0;
    const plotMax = s.baseline === 'narrow' ? 100.75 : xMax;
    const fitData = fit ? samples(1000, xMin, plotMax, fitFn) : [];
    const visibleExtent = Math.max(extent, ...fitData.map(v => Math.abs(v[1]) * 1.1));
    $('visual').innerHTML = chart({ series: fit ? [{ color: colors.cyan, data: fitData }] : [], points: calibrationRows.map(o => ({ x: o.distance, y: o.errorMm })), xMin, xMax: plotMax, yMin: -visibleExtent, yMax: visibleExtent, xLabel: t('calibracao.xLabel'), yLabel: t('calibracao.yLabel'), label: t('calibracao.label') }) + legend([[t('calibracao.legendObs'), colors.amber], [t('calibracao.legendFit'), colors.cyan]]);
    $('metrics').innerHTML = fit ? metric(t('calibracao.mZero'), signed(fit.coefficients[0]), 'mm') + metric(t('calibracao.mScale'), signed(fit.coefficients[1]), 'ppm') + metric(t('calibracao.mRms'), fmt(fit.rms), 'mm') + metric(t('calibracao.mDof'), String(fit.dof)) : metric(t('calibracao.mNonId'), t('calibracao.mNoSol'));
    if (!fit) note(esc(error), true);
    else note(`Σ(r/σ)² / ν → σ̂₀ = <strong>${fmt(fit.sigma0)}</strong>. Correlação: ${fmt(fit.correlation, 4)}. ${s.baseline === 'narrow' ? t('calibracao.noteNarrow') : s.model === 'linear' && s.amplitude > 0 ? t('calibracao.noteIncomplete') : t('calibracao.noteNormal')}`, s.baseline === 'narrow' || (s.model === 'linear' && s.amplitude > 0));
    let detail = table(t('calibracao.tblCaption').replace('{seed}', s.seed), t('calibracao.tblHeaders'), calibrationRows.map((o, i) => [fmt(o.distance, 3), fmt(o.distance + o.errorMm / 1000, 6), signed(o.errorMm), fit ? signed(fit.fitted[i]) : '—', fit ? signed(fit.residuals[i]) : '—']));
    if (fit) {
      const residualLimit = Math.max(.1, ...fit.residuals.map(Math.abs)) * 1.2;
      detail += `<h4>${t('calibracao.residTitle')}</h4>` + chart({ points: calibrationRows.map((o, i) => ({ x: o.distance, y: fit.residuals[i], color: colors.rose })), xMin, xMax: plotMax, yMin: -residualLimit, yMax: residualLimit, xLabel: t('calibracao.xLabel'), yLabel: 'r (mm)', label: t('calibracao.residLabel'), height: 235 });
      const ampText = s.model === 'cyclic' ? ` Amplitude: ${fmt(fit.amplitude)} mm.` : '';
      const noiseText = s.noise === 0 ? (currentLang === 'en' ? ' With zero noise, weights use σ = 1 mm by convention.' : ' Com ruído nulo, pesos usam σ = 1 mm como convenção.') : '';
      detail += `<p class="small">${t('calibracao.seText').replace('{sa}', fmt(fit.standardErrors[0])).replace('{sb}', fmt(fit.standardErrors[1])).replace('{amp}', ampText).replace('{noise}', noiseText)}</p>`;
    }
    $('labDetail').innerHTML = detail;
  }

  function renderAtmosphere() {
    const s = state(), r = P.atmosphere(s.distance, s.temperature, s.pressure, s.setTemperature, s.setPressure);
    $('visual').innerHTML = chart({ series: [{ color: colors.teal, data: samples(150, -10, 45, t0 => P.atmosphere(s.distance, t0, s.pressure, s.setTemperature, s.setPressure).correctionPpm) }], points: [{ x: s.temperature, y: r.correctionPpm }], xMin: -10, xMax: 45, yMin: Math.min(-1, P.atmosphere(s.distance, -10, s.pressure, s.setTemperature, s.setPressure).correctionPpm) - 5, yMax: Math.max(1, P.atmosphere(s.distance, 45, s.pressure, s.setTemperature, s.setPressure).correctionPpm) + 5, xLabel: t('atmosfera.xLabel'), yLabel: t('atmosfera.yLabel'), label: t('atmosfera.label'), marker: s.temperature });
    $('metrics').innerHTML = metric(t('atmosfera.mActual'), fmt(r.actual, 8)) + metric(t('atmosfera.mConfig'), fmt(r.configured, 8)) + metric(t('atmosfera.mCorrPpm'), signed(r.correctionPpm, 3), 'ppm') + metric(t('atmosfera.mCorrMm'), signed(r.correctionMm, 3), 'mm');
    note(`D_ind = <strong>${fmt(r.indicated, 4)} m</strong>. Multiplicando por nconfig/nreal → ${fmt(r.corrected, 4)} m. ${Math.abs(r.correctionPpm) < .00001 ? t('atmosfera.noteZero') : (r.correctionMm > 0 ? t('atmosfera.noteIncrease') : t('atmosfera.noteDecrease'))}`);
    $('labDetail').innerHTML = `<p class="model-note">${t('atmosfera.detailNote')}</p>`;
  }

  function renderPath() {
    const s = state(), temps = [s.t1, s.t2, s.t3], start = P.pathAtmosphere(s.distance, temps, s.pressure, s.t1), ends = P.pathAtmosphere(s.distance, temps, s.pressure, (s.t1 + s.t3) / 2);
    const selectedIndex = s.sensor === 'integrated' ? start.average : s.sensor === 'endpoints' ? ends.sensorIndex : start.sensorIndex;
    const error = s.distance * (start.average / selectedIndex - 1) * 1000;
    const { w } = dimensions(250), left = 40, span = w - 80;
    let body = text(w / 2, 25, t('trajeto.banner'));
    temps.forEach((t0, i) => {
      const x = left + i * span / 3;
      body += `<rect x="${x}" y="55" width="${span / 3}" height="85" fill="hsl(${210 - (t0 + 10) / 55 * 195} 45% 24%)" stroke="#567086"/>`;
      body += text(x + span / 6, 91, `${fmt(t0, 1)} °C`, '#ffffff', 'middle', 16) + text(x + span / 6, 123, `${t('trajeto.section')} ${i + 1}`, '#e1e9f4');
    });
    body += line(left, 176, left + span, 176, colors.teal) + circle(left, 176, 5, colors.cyan) + circle(left + span, 176, 5, colors.amber);
    body += text(left, 203, 'EDM', colors.cyan) + text(left + span, 203, t('tempo.target'), colors.amber) + text(w / 2, 238, t('trajeto.straightNote'), colors.muted);
    $('visual').innerHTML = svg(body, t('trajeto.svgLabel').replace('{t1}', s.t1).replace('{t2}', s.t2).replace('{t3}', s.t3), w, 255);
    $('metrics').innerHTML = metric(t('trajeto.mIntegrated'), fmt(start.average, 8)) + metric(t('trajeto.mUsed'), fmt(selectedIndex, 8)) + metric(t('trajeto.mRemaining'), signed(error), 'mm') + metric(t('trajeto.mTransitTime'), fmt(start.time * 1e6, 6), 'µs');
    note(s.sensor === 'integrated' ? t('trajeto.noteIntegrated') : t('trajeto.noteError').replace('{e}', signed(error)), Math.abs(error) > 1);
    $('labDetail').innerHTML = table(t('trajeto.tblCaption'), t('trajeto.tblHeaders'), [[t('trajeto.tblRows.0'), signed(start.errorMm)], [t('trajeto.tblRows.1'), signed(ends.errorMm)], [t('trajeto.tblRows.2'), fmt(0)]]);
  }

  function renderStation() {
    const s = state(), r = P.reduceSlope(s.distance, s.zenith, s.hi, s.ht, s.sigma, s.angleSigma), { w } = dimensions(330);
    const z = s.zenith * Math.PI / 180, scale = Math.min((w - 110) / s.distance, 115 / s.distance), x0 = 60, y0 = 155, x1 = x0 + r.horizontal * scale, y1 = y0 - r.vertical * scale;
    let body = line(x0, y0, x0, 18, '#6e8399', '5 4') + text(x0 + 9, 20, t('estacao.zenith'), colors.muted, 'start');
    body += line(x0, y0, x1, y0, colors.teal) + line(x1, y0, x1, y1, colors.amber, '5 4') + line(x0, y0, x1, y1, colors.cyan);
    body += circle(x0, y0, 5, colors.cyan) + circle(x1, y1, 5, colors.amber);
    const radius = 28, ax = x0 + radius * Math.sin(z), ay = y0 - radius * Math.cos(z);
    body += `<path d="M ${x0} ${y0 - radius} A ${radius} ${radius} 0 0 1 ${ax} ${ay}" fill="none" stroke="${colors.violet}" stroke-width="2"/>`;
    body += text(w - 15, 48, `z = ${fmt(s.zenith, 1)}°`, colors.violet, 'end');
    body += text(w - 15, 73, `S = ${fmt(s.distance, 0)} m`, colors.cyan, 'end');
    body += text(w / 2, 295, `H = ${fmt(r.horizontal)} m`, colors.teal, 'middle', 16) + text(w / 2, 320, `V = ${signed(r.vertical)} m`, colors.amber, 'middle', 16);
    $('visual').innerHTML = svg(body, t('estacao.svgLabel').replace('{s}', s.distance).replace('{z}', s.zenith), w, 340) + `<p class="chart-caption">${t('estacao.caption')}</p>`;
    $('metrics').innerHTML = metric(t('estacao.mHorizontal'), fmt(r.horizontal), 'm') + metric(t('estacao.mDeltaH'), signed(r.heightDifference), 'm') + metric(t('estacao.mSigmaH'), fmt(r.sigmaHorizontalMm), 'mm') + metric(t('estacao.mSigmaV'), fmt(r.sigmaVerticalMm), 'mm');
    note(`Δh = ${fmt(s.hi, 2)} + (${signed(r.vertical)}) − ${fmt(s.ht, 2)} = <strong>${signed(r.heightDifference)} m</strong>. ${s.zenith === 90 ? t('estacao.noteHoriz') : t('estacao.noteZenith')}`);
    $('labDetail').innerHTML = table(t('estacao.tblCaption'), t('estacao.tblHeaders'), [[t('estacao.tblRows.0'), fmt(Math.abs(Math.sin(z) * s.sigma)), fmt(Math.abs(Math.cos(z) * s.sigma))], [t('estacao.tblRows.1'), fmt(Math.abs(s.distance * Math.cos(z) * s.angleSigma * Math.PI / 648000 * 1000)), fmt(Math.abs(s.distance * Math.sin(z) * s.angleSigma * Math.PI / 648000 * 1000))]]);
  }

  function renderQuality() {
    const s = state(), r = P.repeatedMeasurements(s.count, s.bias, s.sigma, s.seed);
    const limit = Math.max(1, Math.abs(s.bias) + s.sigma * 4, ...r.errors.map(Math.abs)) * 1.05;
    $('visual').innerHTML = chart({ series: [{ color: colors.cyan, dash: '7 3', data: [[1, r.mean], [s.count, r.mean]] }, { color: colors.amber, dash: '2 5', data: [[1, s.bias], [s.count, s.bias]] }], points: r.errors.map((v, i) => ({ x: i + 1, y: v, color: colors.teal, r: s.count > 100 ? 2 : 3 })), xMin: 1, xMax: s.count, yMin: -limit, yMax: limit, xLabel: t('qualidade.xLabel'), yLabel: t('qualidade.yLabel'), label: t('qualidade.label') }) + legend([[t('qualidade.legendObs'), colors.teal], [t('qualidade.legendMean'), colors.cyan], [t('qualidade.legendBias'), colors.amber]]);
    $('metrics').innerHTML = metric(t('qualidade.mMeanErr'), signed(r.mean), 'mm') + metric(t('qualidade.mStdDev'), fmt(r.standardDeviation), 'mm') + metric(t('qualidade.mStdErr'), fmt(r.standardError), 'mm') + metric(t('qualidade.mTheoErr'), fmt(r.expectedStandardError), 'mm');
    note(`Erro esperado: <strong>${signed(s.bias)} mm</strong>. ${s.sigma === 0 ? t('qualidade.noteZeroSigma') : t('qualidade.noteBias')}`, Math.abs(s.bias) > 0);
    $('labDetail').innerHTML = `<details><summary>${t('qualidade.detSummary')}</summary>${table(t('qualidade.tblCaption'), t('qualidade.tblHeaders'), r.errors.map((v, i) => [i + 1, signed(v)]))}</details>`;
  }

  const renderers = { tempo: renderPulse, modulacao: renderModulation, fase: renderPhase, alvos: renderTargets, erros: renderErrors, calibracao: renderCalibration, atmosfera: renderAtmosphere, trajeto: renderPath, estacao: renderStation, qualidade: renderQuality };
  function render() { renderers[lessons[current].id](); }
  function stopAnimation() { animation = false; if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; }
  function animate(time) {
    if (!animation || document.hidden) { frame = null; return; }
    if (lastTime !== null) motion += Math.min(time - lastTime, 100) / 4000;
    lastTime = time;
    if (lessons[current].id === 'tempo') renderPulse(true);
    if (lessons[current].id === 'modulacao') renderModulation(true);
    frame = requestAnimationFrame(animate);
  }

  function setLanguage(lang) {
    if (!medI18n[lang]) lang = 'pt-BR';
    currentLang = lang;
    try {
      localStorage.setItem('monorepo_lang', lang);
    } catch (e) {}

    document.documentElement.lang = lang;
    document.title = t('pageTitle');

    const setText = (id, textVal) => {
      const el = $(id);
      if (el) el.textContent = textVal;
    };

    setText('brandTitle', t('brandTitle'));
    setText('brandSub', t('brandSub'));
    setText('portalLinkText', t('portalLinkText'));
    setText('sidebarEyebrow', t('sidebarEyebrow'));
    setText('sidebarNote', t('sidebarNote'));
    setText('supportLink', t('supportLink'));
    setText('btnReset', t('btnReset'));
    setText('objectiveLabel', t('objectiveLabel'));
    setText('theoryEyebrow', t('theoryEyebrow'));
    setText('theoryTitle', t('theoryTitle'));
    setText('exerciseEyebrow', t('exerciseEyebrow'));
    setText('exerciseSummary', t('exerciseSummary'));
    setText('btnPrev', t('btnPrev'));
    setText('btnNext', t('btnNext'));
    setText('skipLink', t('skipLink'));

    const portalLink = $('portalLink');
    if (portalLink) {
      portalLink.href = '../index.html?lang=' + (lang === 'en' ? 'en' : 'pt');
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    lessons = lang === 'en' ? (window.MEDLessonsEn || window.MEDLessons) : (window.MEDLessonsPt || window.MEDLessons);
    buildTopicNav();
    selectTopic(current, false);
  }

  function buildTopicNav() {
    $('topicNav').innerHTML = lessons.map((lesson, i) => `<button class="topic-nav-item" type="button" data-topic="${i}"><span class="topic-num">${String(i + 1).padStart(2, '0')}</span><span>${lesson.nav}</span></button>`).join('');
  }

  function selectTopic(index, focus = false) {
    stopAnimation(); current = Math.max(0, Math.min(lessons.length - 1, index)); motion = 0;
    const lesson = lessons[current];
    document.querySelectorAll('.topic-nav-item').forEach((button, i) => { if (i === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
    $('topicBreadcrumb').textContent = `${t('experimentPrefix')} ${String(current + 1).padStart(2, '0')} / ${lessons.length}`;
    $('topicTitle').textContent = lesson.title; $('topicSummary').textContent = lesson.summary; $('topicObjective').textContent = lesson.objective;
    $('theoryContent').innerHTML = lesson.theory;
    $('exerciseTitle').textContent = lesson.exerciseTitle; $('exercisePrompt').textContent = lesson.exercise; $('exerciseAnswer').textContent = lesson.answer;
    $('exerciseAnswer').closest('details').open = false;
    $('sources').innerHTML = t('furtherReading') + lesson.sources.map(key => `<a href="${window.MEDSources[key].url}" target="_blank" rel="noopener noreferrer">${window.MEDSources[key].label} ↗</a>`).join(' ');
    $('btnPrev').disabled = current === 0; $('btnNext').disabled = current === lessons.length - 1; $('lessonPosition').textContent = `${current + 1} ${t('of')} ${lessons.length}`;
    renderControls(); render();
    try { history.replaceState(null, '', `#${lesson.id}`); } catch (_) { /* file:// history restrictions do not prevent lessons */ }
    if (focus) $('lesson').focus({ preventScroll: true });
  }

  function handleInput(event) {
    const input = event.target, s = state();
    if (input.dataset.frequency !== undefined) { s.active[Number(input.dataset.frequency)] = input.checked; s.feedback = ''; render(); return; }
    const key = input.dataset.key; if (!key) return;
    let value;
    if (input.tagName === 'SELECT') value = typeof defaults[lessons[current].id][key] === 'number' ? Number(input.value) : input.value;
    else {
      value = input.valueAsNumber;
      if (!Number.isFinite(value) || !input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        note(t('invalidValue'), true);
        return;
      }
      input.removeAttribute('aria-invalid');
    }
    s[key] = value;
    if (key === 'position') { stopAnimation(); motion = value / 100; const button = $('controls').querySelector('[data-action="animate"]'); if (button) button.textContent = t('animate'); }
    $('controls').querySelectorAll(`[data-key="${key}"]`).forEach(other => { if (other !== input) { other.value = value; other.removeAttribute('aria-invalid'); } });
    if (lessons[current].id === 'fase') s.feedback = '';
    render();
  }

  function exportCalibration() {
    const s = state();
    const header = 'distance_reference_m,distance_observed_m,error_observed_mm,sigma_weight_mm,noise_sigma_mm,seed,baseline,cyclic_unit_m,cyclic_phase_deg';
    const rows = calibrationRows.map(o => [o.distance.toFixed(6), (o.distance + o.errorMm / 1000).toFixed(9), o.errorMm.toFixed(9), o.sigmaMm, s.noise, s.seed, s.baseline, s.unit, 30].join(','));
    const blob = new Blob([header + '\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `med-calibracao-${s.baseline}-${s.seed}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleAction(event) {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const s = state();
    switch (button.dataset.action) {
      case 'animate':
        if (animation) { if (lessons[current].id === 'tempo') s.position = Math.round((motion % 1) * 100); stopAnimation(); }
        else { animation = true; motion = lessons[current].id === 'tempo' ? s.position / 100 : motion; frame = requestAnimationFrame(animate); }
        renderControls(); render(); return;
      case 'phaseAll': s.active = [true, true, true, true]; break;
      case 'phaseFine': s.active = [true, false, false, false]; break;
      case 'phaseExample': s.distance = 3123.456; s.challenge = false; break;
      case 'phaseChallenge': s.seed++; s.distance = ((1664525 * s.seed + 1013904223) >>> 0) % 10000000 / 1000; s.challenge = true; break;
      case 'phaseExplore': s.challenge = false; break;
      case 'zeroErrors': Object.assign(s, { zero: 0, scale: 0, amplitude: 0, prism: 0 }); break;
      case 'newNoise': s.seed++; break;
      case 'matchAir': s.setTemperature = s.temperature; s.setPressure = s.pressure; break;
      case 'exportCalibration': exportCalibration(); return;
    }
    if (lessons[current].id === 'fase') s.feedback = '';
    renderControls(); render();
  }

  function checkPhaseAnswer(event) {
    if (event.target.id !== 'phaseAnswerForm') return;
    event.preventDefault();
    const s = state(), raw = $('phaseAnswer').value.trim();
    let feedback;
    if (!/^\d+(?:[.,]\d+)?$/.test(raw)) feedback = t('fase.chPromptValid');
    else {
      const guess = Number(raw.replace(',', '.'));
      const active = P.UNITS.filter((_, i) => s.active[i]).map(u => P.phase(s.distance, u));
      if (!active.length) feedback = t('fase.chPromptActivate');
      else if (guess < 0 || guess >= s.range) feedback = t('fase.chPromptRange');
      else {
        const solved = P.solveAmbiguity(active, s.range);
        const candidate = solved.candidates.find(c => Math.abs(c.distance - guess) <= .002 + 1e-9);
        feedback = candidate ? (solved.unique ? t('fase.chCorrect').replace('{d}', fmt(candidate.distance)) : t('fase.chCompatible').replace('{d}', fmt(candidate.distance)).replace('{n}', solved.candidates.length)) : t('fase.chWrong');
      }
    }
    s.feedback = feedback; $('phaseFeedback').textContent = feedback;
  }

  buildTopicNav();
  $('topicNav').addEventListener('click', e => { const b = e.target.closest('[data-topic]'); if (b) selectTopic(Number(b.dataset.topic), true); });
  $('btnPrev').addEventListener('click', () => selectTopic(current - 1, true));
  $('btnNext').addEventListener('click', () => selectTopic(current + 1, true));
  $('btnReset').addEventListener('click', () => { states[lessons[current].id] = structuredClone(defaults[lessons[current].id]); selectTopic(current); });
  $('controls').addEventListener('input', handleInput);
  $('controls').addEventListener('click', handleAction);
  $('labDetail').addEventListener('submit', checkPhaseAnswer);
  window.addEventListener('hashchange', () => { const i = lessons.findIndex(l => `#${l.id}` === location.hash); if (i >= 0) selectTopic(i); });
  let resizeFrame;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(render); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; } else if (animation) frame = requestAnimationFrame(animate); });

  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get('lang');
  let initLang = 'pt-BR';
  if (paramLang === 'en' || paramLang === 'pt-BR') {
    initLang = paramLang;
  } else if (paramLang === 'pt') {
    initLang = 'pt-BR';
  } else {
    try {
      const stored = localStorage.getItem('monorepo_lang');
      if (stored === 'en' || stored === 'pt-BR') {
        initLang = stored;
      }
    } catch (e) {}
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetLang = e.currentTarget.getAttribute('data-lang');
      setLanguage(targetLang);
    });
  });

  const hashIdx = lessons.findIndex(l => `#${l.id}` === location.hash);
  current = Math.max(0, hashIdx);
  setLanguage(initLang);
})();
