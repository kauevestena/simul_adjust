const $=id=>document.getElementById(id);let cur=null,tab='A';
const NET_W=900,NET_H=460,NET_MIN_W=45,NET_RATIO=NET_W/NET_H;let netView={x:0,y:0,w:NET_W,h:NET_H};
function clampNetView(){netView.w=Math.min(NET_W,Math.max(NET_MIN_W,netView.w));netView.h=netView.w/NET_RATIO;if(netView.h>NET_H){netView.h=NET_H;netView.w=netView.h*NET_RATIO}netView.x=Math.min(NET_W-netView.w,Math.max(0,netView.x));netView.y=Math.min(NET_H-netView.h,Math.max(0,netView.y))}
function applyNetView(svg=$('net')){if(!svg)return;clampNetView();svg.setAttribute('viewBox',`${netView.x} ${netView.y} ${netView.w} ${netView.h}`)}
function resetNetView(){netView={x:0,y:0,w:NET_W,h:NET_H};applyNetView()}
function onNetWheel(e){let svg=$('net');if(!svg)return;e.preventDefault();let r=svg.getBoundingClientRect(),px=netView.x+(e.clientX-r.left)/r.width*netView.w,py=netView.y+(e.clientY-r.top)/r.height*netView.h,ux=(px-netView.x)/netView.w,uy=(py-netView.y)/netView.h,w=Math.min(NET_W,Math.max(NET_MIN_W,netView.w*Math.exp(e.deltaY*.001))),h=w/NET_RATIO;netView={x:px-ux*w,y:py-uy*h,w,h};applyNetView(svg)}
function initNetZoom(){let svg=$('net');if(!svg)return;svg.addEventListener('wheel',onNetWheel,{passive:false});svg.addEventListener('dblclick',resetNetView);applyNetView(svg)}
const pi=Math.PI;function d2r(d){return d*pi/180}function r2d(r){return r*180/pi}function as2r(a){return d2r(a/3600)}function r2as(r){return r2d(r)*3600}function mm2m(x){return x/1000}function m2mm(x){return x*1000}function fmt(x,n=3){return isFinite(x)?Number(x).toFixed(n):'--'}function wrapPi(a){while(a<=-pi)a+=2*pi;while(a>pi)a-=2*pi;return a}function wrap2(a){while(a<0)a+=2*pi;while(a>=2*pi)a-=2*pi;return a}
function parseDMS(t){let p=String(t).trim().replace(/[°ºd]/gi,' ').replace(/[′']/g,' ').replace(/[″"]/g,' ').replace(/:/g,' ').replace(/,/g,'.').split(/\s+/).filter(Boolean);if(!p.length)throw Error('Bad angle: '+t);let sg=p[0][0]=='-'?-1:1,d=Math.abs(parseFloat(p[0])),m=p[1]?parseFloat(p[1]):0,s=p[2]?parseFloat(p[2]):0;if(![d,m,s].every(isFinite))throw Error('Bad angle: '+t);return sg*(d+m/60+s/3600)}
function dmsDeg(deg,n=2){let sg=deg<0?'-':'';let x=Math.abs(deg),d=Math.floor(x),mf=(x-d)*60,m=Math.floor(mf),s=(mf-m)*60;if(s>=59.9995){s=0;m++}if(m>=60){m=0;d++}return `${sg}${d}° ${String(m).padStart(2,'0')}′ ${s.toFixed(n).padStart(n+3,'0')}″`}function dms(rad,n=2){return dmsDeg(r2d(rad),n)}
function az(E1,N1,E2,N2){return wrap2(Math.atan2(E2-E1,N2-N1))}
function tr(A){return A[0].map((_,j)=>A.map(r=>r[j]))}function diag(v){return v.map((x,i)=>v.map((_,j)=>i==j?x:0))}function mv(A,x){return A.map(r=>r.reduce((s,a,i)=>s+a*x[i],0))}function mmul(A,B){let C=Array.from({length:A.length},()=>Array(B[0].length).fill(0));for(let i=0;i<A.length;i++)for(let k=0;k<B.length;k++)for(let j=0;j<B[0].length;j++)C[i][j]+=A[i][k]*B[k][j];return C}
function solve(A,b){let n=A.length,M=A.map((r,i)=>r.slice().concat(b[i]));for(let k=0;k<n;k++){let im=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[im][k]))im=i;if(Math.abs(M[im][k])<1e-18)throw Error('Singular normal matrix');[M[k],M[im]]=[M[im],M[k]];let p=M[k][k];for(let j=k;j<=n;j++)M[k][j]/=p;for(let i=0;i<n;i++){if(i==k)continue;let f=M[i][k];for(let j=k;j<=n;j++)M[i][j]-=f*M[k][j]}}return M.map(r=>r[n])}
function inv(A){let n=A.length,M=A.map((r,i)=>r.slice().concat(Array.from({length:n},(_,j)=>i==j?1:0)));for(let k=0;k<n;k++){let im=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[im][k]))im=i;if(Math.abs(M[im][k])<1e-18)throw Error('Singular matrix');[M[k],M[im]]=[M[im],M[k]];let p=M[k][k];for(let j=0;j<2*n;j++)M[k][j]/=p;for(let i=0;i<n;i++){if(i==k)continue;let f=M[i][k];for(let j=0;j<2*n;j++)M[i][j]-=f*M[k][j]}}return M.map(r=>r.slice(n))}
function normInv(p){const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-.00778489400243029,-.322396458041137,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];let q,r;if(p<.02425){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/(((((d[0]*q+d[1])*q+d[2])*q+d[3])*q)+1)}if(p>.97575){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/(((((d[0]*q+d[1])*q+d[2])*q+d[3])*q)+1)}q=p-.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}function chi(p,k){let z=normInv(p),a=2/(9*k);return k*Math.pow(1-a+z*Math.sqrt(a),3)}
function eig2(a,b,c){let tr=a+c,det=a*c-b*b,di=Math.sqrt(Math.max(0,tr*tr-4*det)),l1=(tr-di)/2,l2=(tr+di)/2;let v=Math.abs(b)>1e-20?[l2-c,b]:(a>=c?[1,0]:[0,1]);let n=Math.hypot(v[0],v[1])||1;return{lmin:l1,lmax:l2,ang:Math.atan2(v[1]/n,v[0]/n)}}

// ── Bilingual Dictionary ──
let currentLang = 'en';

const freeStationI18n = {
  'en': {
    pageTitle: '2D Resection Lab v3 — Free Station 2D',
    headerTitle: '2D Resection Lab v3',
    headerSub: 'Single-setup 2D resection with directions, a derived-angle alternative, slope-distance plus zenith preprocessing, least-squares adjustment, reliability, sensitivity, matrices, Monte Carlo, and model comparison. Angles are displayed as degrees-minutes-seconds.',
    portalLinkText: 'Portal',
    themeBtn: 'Toggle theme',
    netTitle: 'Network and ellipses',
    fitBtn: 'Fit to window',
    ellipseScaleLabel: 'Ellipse scale',
    inputsTitle: 'Inputs',
    labelModel: 'Model',
    optDir: 'Directions + one orientation constant',
    optAng: 'Derived horizontal angle + distances',
    labelAlpha: 'Global test alpha',
    labelWlim: 'Data snooping |w| threshold',
    labelDelta0: 'delta0 for MDB/MDS',
    labelMcN: 'MC samples',
    labelSeed: 'MC seed',
    legStations: 'Known stations',
    legApprox: 'Approximate point P0',
    guessBtn: 'Guess from distances',
    legDir: 'Direction readings at P',
    labelDirA: 'Direction P to A (DMS)',
    labelDirB: 'Direction P to B (DMS)',
    labelSigDir: 'sigma direction (arcsec)',
    legDist: 'Slope distances and zenith angles',
    titleToA: 'To A',
    labelSA: 'Slope S_A (m)',
    labelZA: 'Zenith Z_A (DMS)',
    titleToB: 'To B',
    labelSB: 'Slope S_B (m)',
    labelZB: 'Zenith Z_B (DMS)',
    labelSigS: 'sigma slope distance (mm)',
    labelSigZ: 'sigma zenith (arcsec)',
    runBtn: 'Run adjustment',
    cleanBtn: 'Clean example',
    blunderBtn: 'Small blunder',
    noisyBtn: 'Noisy case',
    compareBtn: 'Compare models',
    mcBtn: 'Run Monte Carlo',
    jsonBtn: 'Export JSON',
    csvBtn: 'Export CSV',
    summaryTitle: 'Summary',
    comparisonTitle: 'Direction-vs-angle comparison',
    preTitle: 'Preprocessing',
    obsTitle: 'Observations, residuals, reliability',
    itersTitle: 'Iteration history',
    matTitle: 'Matrices',
    heatTitle: 'Covariance / correlation heatmap',
    qualityTitle: 'Precision and sensitivity',
    mcTitle: 'Monte Carlo',
    mcHint: 'Monte Carlo is here to check the linearized adjustment from repeated simulated observations. It perturbs the measured directions, slope distances, and zenith angles using their entered standard deviations, solves the station again for each trial, then compares the empirical coordinate spread with the formal covariance from least squares.',
    mcPanelBtn: 'Run Monte Carlo',
    mcInitialStatus: 'No Monte Carlo run yet. Use this section\'s button or the input-panel button to generate trials.',
    notesTitle: 'Model notes',
    note1: 'There is only one setup at P. Direction mode estimates exactly one orientation constant omega.',
    note2: 'Angle mode forms beta = direction(P to B) - direction(P to A). Its variance is propagated from the two directions.',
    note3: 'Zenith angles are used only to reduce slope distances to horizontal distances for this 2D adjustment.',
    note4: 'The two-point mixed resection is minimally redundant: direction mode has 4 observations and 3 unknowns; angle mode has 3 observations and 2 unknowns.',
    footerText: 'Static client-side scientific lab. Vanilla JavaScript & SVG.',
    obsNames: {
      dirPA: 'Direction P->A',
      dirPB: 'Direction P->B',
      distPA: 'Horizontal distance P->A',
      distPB: 'Horizontal distance P->B',
      angAPB: 'Horizontal angle A-P-B'
    },
    summary: {
      mode: 'Mode',
      modeDir: 'Directions + omega',
      modeAng: 'Derived angle',
      omegaNotEst: 'not estimated',
      dof: 'f (redundancy)',
      globalTest: 'global test',
      pass: 'PASS',
      fail: 'FAIL',
      sigma0Hat: 'sigma0 hat',
      maxW: 'max |w|',
      sE_apriori: 'σ E (a-priori)',
      sN_apriori: 'σ N (a-priori)',
      sE_apost: 'σ E (a-post.)',
      sN_apost: 'σ N (a-post.)'
    },
    preTable: {
      headers: ['target', 'S raw', 'Z raw', 'D=S sin Z', 'sigma D', 'partials'],
      dirPA: 'direction P->A',
      dirPB: 'direction P->B',
      derivedBeta: 'derived beta',
      sigmaBeta: 'sigma beta'
    },
    obsTable: {
      headers: ['observation', 'observed', 'sigma', 'residual', 'sigma v', 'w', 'r', 'MDB', 'external effect']
    },
    itersTable: {
      headers: ['iter', 'E', 'N', 'omega', 'dE mm', 'dN mm', 'domega arcsec', 'correction norm']
    },
    bars: {
      stdRes: 'standardized residuals',
      redun: 'redundancy'
    },
    heat: {
      covTitle: '<h3>Coordinate covariance Qxx (m^2)</h3>',
      corrTitle: '<h3>Coordinate correlation</h3>'
    },
    quality: {
      vTPv: 'vTPv',
      chi2Lo: 'chi2 lower',
      chi2Hi: 'chi2 upper',
      sigma02Hat: 'sigma0^2 hat',
      semiMinorApriori: '1σ minor (a-priori)',
      semiMajorApriori: '1σ major (a-priori)',
      semiMinorApost: '1σ minor (a-post.)',
      semiMajorApost: '1σ major (a-post.)',
      mdsMinor: 'MDS minor',
      mdsMajor: 'MDS major',
      orientation: 'ellipse orientation'
    },
    legend: {
      html: '<p><b>Legend</b></p><ul><li>Green lines: sights from P.</li><li>Dashed line: baseline AB.</li><li>Green ellipse: 1 sigma.</li><li>Blue ellipse: MDS.</li><li>Gray dots, after Monte Carlo: simulated adjusted positions.</li></ul>'
    },
    compare: {
      headers: ['quantity', 'directions + omega', 'derived angle', 'difference']
    },
    mc: {
      allFailed: 'All {n} Monte Carlo trials failed to adjust. Check the geometry, approximate point, and stochastic model.',
      trials: 'trials',
      accepted: 'accepted by global test',
      rejected: 'rejected by global test',
      failures: 'adjustment failures',
      meanE: 'mean E',
      meanN: 'mean N',
      biasE: 'bias E',
      biasN: 'bias N',
      sampleSigE: 'sample sigma E',
      linSigE: 'linearized sigma E',
      sampleSigN: 'sample sigma N',
      linSigN: 'linearized sigma N',
      sampleRho: 'sample rho EN',
      sampleMajor: 'sample ellipse major',
      sampleMinor: 'sample ellipse minor',
      sampleAngle: 'sample ellipse angle',
      covTitle: 'Empirical coordinate covariance (m^2)',
      svgLegend: 'Green: accepted trials, red: global-test rejected, blue cross: nominal adjustment, orange dot: sample mean, solid/dashed ellipse: 1 sigma/3 sigma sample covariance.'
    }
  },
  'pt-BR': {
    pageTitle: 'Laboratório de Estação Livre 2D v3',
    headerTitle: 'Laboratório de Estação Livre 2D v3',
    headerSub: 'Ajustamento de estação livre 2D com direções (constante de orientação omega) ou ângulo derivado, redução de distâncias e zenitais, resíduos, confiabilidade (MDB), sensibilidade (MDS), matrizes, Monte Carlo e comparação de modelos.',
    portalLinkText: 'Portal',
    themeBtn: 'Alternar tema',
    netTitle: 'Rede e elipses de erro',
    fitBtn: 'Ajustar à janela',
    ellipseScaleLabel: 'Escala da elipse',
    inputsTitle: 'Dados de Entrada',
    labelModel: 'Modelo Funcional',
    optDir: 'Direções + constante de orientação (omega)',
    optAng: 'Ângulo horizontal derivado + distâncias',
    labelAlpha: 'Nível de significância alfa do teste global',
    labelWlim: 'Limiar de data snooping |w|',
    labelDelta0: 'delta0 para MDB/MDS',
    labelMcN: 'Amostras de Monte Carlo',
    labelSeed: 'Semente de Monte Carlo',
    legStations: 'Pontos de apoio conhecidos',
    legApprox: 'Coordenadas aproximadas P0',
    guessBtn: 'Estimar por distâncias',
    legDir: 'Leituras de direção em P',
    labelDirA: 'Direção P para A (GMS)',
    labelDirB: 'Direção P para B (GMS)',
    labelSigDir: 'Desvio-padrão da direção (segundos)',
    legDist: 'Distâncias inclinadas e ângulos zenitais',
    titleToA: 'Para A',
    labelSA: 'Dist. inclinada S_A (m)',
    labelZA: 'Zenital Z_A (GMS)',
    titleToB: 'Para B',
    labelSB: 'Dist. inclinada S_B (m)',
    labelZB: 'Zenital Z_B (GMS)',
    labelSigS: 'Desvio-padrão dist. inclinada (mm)',
    labelSigZ: 'Desvio-padrão zenital (segundos)',
    runBtn: 'Executar ajustamento',
    cleanBtn: 'Exemplo padrão',
    blunderBtn: 'Erro grosseiro sutil',
    noisyBtn: 'Caso ruidoso',
    compareBtn: 'Comparar modelos',
    mcBtn: 'Rodar Monte Carlo',
    jsonBtn: 'Exportar JSON',
    csvBtn: 'Exportar CSV',
    summaryTitle: 'Resumo do Ajustamento',
    comparisonTitle: 'Comparação: Direções vs Ângulo',
    preTitle: 'Pré-processamento (Redução de Distâncias)',
    obsTitle: 'Observações, Resíduos e Confiabilidade',
    itersTitle: 'Histórico de Iterações',
    matTitle: 'Matrizes do Ajustamento',
    heatTitle: 'Matriz de Covariância e Correlação',
    qualityTitle: 'Precisão e Sensibilidade',
    mcTitle: 'Simulação de Monte Carlo',
    mcHint: 'A simulação de Monte Carlo verifica a validade do modelo linearizado do ajustamento gerando observações perturbadas repetidamente de acordo com seus desvios-padrão estocásticos, resolvendo o ponto da estação para cada realização e comparando a dispersão empírica com as matrizes formais de covariância do MMQ.',
    mcPanelBtn: 'Rodar Monte Carlo',
    mcInitialStatus: 'Nenhuma simulação de Monte Carlo executada ainda. Use os botões acima para gerar as realizações.',
    notesTitle: 'Notas Teóricas do Modelo',
    note1: 'Há apenas uma estação ocupada em P. O modelo de direções estima exatamente uma constante de orientação omega.',
    note2: 'O modelo angular calcula o ângulo beta = direção(P para B) − direção(P para A). Sua variância é propagada a partir das duas direções originais.',
    note3: 'Os ângulos zenitais são empregados exclusivamente para reduzir distâncias inclinadas a distâncias horizontais para este ajustamento 2D plano.',
    note4: 'A estação livre com 2 pontos de apoio é minimamente redundante: o modelo de direções possui 4 observações e 3 incógnitas (f=1); o modelo angular possui 3 observações e 2 incógnitas (f=1).',
    footerText: 'Laboratório científico estático client-side. Vanilla JavaScript e SVG.',
    obsNames: {
      dirPA: 'Direção P->A',
      dirPB: 'Direção P->B',
      distPA: 'Distância horizontal P->A',
      distPB: 'Distância horizontal P->B',
      angAPB: 'Ângulo horizontal A-P-B'
    },
    summary: {
      mode: 'Modelo',
      modeDir: 'Direções + omega',
      modeAng: 'Ângulo derivado',
      omegaNotEst: 'não estimado',
      dof: 'Graus de liberdade (f)',
      globalTest: 'Teste global (qui-quadrado)',
      pass: 'APROVADO',
      fail: 'REJEITADO',
      sigma0Hat: 'sigma0 estimado',
      maxW: '|w| máximo',
      sE_apriori: 'σ E (a priori)',
      sN_apriori: 'σ N (a priori)',
      sE_apost: 'σ E (a posteriori)',
      sN_apost: 'σ N (a posteriori)'
    },
    preTable: {
      headers: ['Alvo', 'S bruto', 'Z bruto', 'D = S·sen(Z)', 'sigma D', 'Derivadas parciais'],
      dirPA: 'Direção P->A',
      dirPB: 'Direção P->B',
      derivedBeta: 'Ângulo beta derivado',
      sigmaBeta: 'sigma beta'
    },
    obsTable: {
      headers: ['Observação', 'Observado', 'sigma', 'Resíduo (v)', 'sigma v', 'w (padron.)', 'r (redun.)', 'MDB', 'Efeito externo (delta x)']
    },
    itersTable: {
      headers: ['Iter.', 'E (m)', 'N (m)', 'omega', 'dE (mm)', 'dN (mm)', 'domega (seg)', 'Norma da correção']
    },
    bars: {
      stdRes: 'Resíduos padronizados (|w|)',
      redun: 'Números de redundância (r)'
    },
    heat: {
      covTitle: '<h3>Covariância de Coordenadas Qxx (m²)</h3>',
      corrTitle: '<h3>Correlação entre Coordenadas</h3>'
    },
    quality: {
      vTPv: 'vᵀPv',
      chi2Lo: 'Limite inf. qui-quadrado',
      chi2Hi: 'Limite sup. qui-quadrado',
      sigma02Hat: 'sigma0² estimado',
      semiMinorApriori: '1σ semi-eixo menor (a priori)',
      semiMajorApriori: '1σ semi-eixo maior (a priori)',
      semiMinorApost: '1σ semi-eixo menor (a post.)',
      semiMajorApost: '1σ semi-eixo maior (a post.)',
      mdsMinor: 'MDS semi-eixo menor',
      mdsMajor: 'MDS semi-eixo maior',
      orientation: 'Orientação da elipse (azimute)'
    },
    legend: {
      html: '<p><b>Legenda</b></p><ul><li>Linhas verdes: visadas a partir de P.</li><li>Linha tracejada: linha de base AB.</li><li>Elipse verde: elipse de erro 1 sigma.</li><li>Elipse azul: elipse de sensibilidade máxima (MDS).</li><li>Pontos cinzas (Monte Carlo): posições ajustadas simuladas.</li></ul>'
    },
    compare: {
      headers: ['Grandeza', 'Direções + omega', 'Ângulo derivado', 'Diferença']
    },
    mc: {
      allFailed: 'Todos os {n} ensaios de Monte Carlo falharam no ajustamento. Verifique a geometria e o modelo estocástico.',
      trials: 'Realizações (ensaios)',
      accepted: 'Aprovadas no teste global',
      rejected: 'Rejeitadas no teste global',
      failures: 'Falhas de convergência',
      meanE: 'Média E',
      meanN: 'Média N',
      biasE: 'Viés E',
      biasN: 'Viés N',
      sampleSigE: 'Desvio-padrão amostral E',
      linSigE: 'Desvio-padrão linearizado E',
      sampleSigN: 'Desvio-padrão amostral N',
      linSigN: 'Desvio-padrão linearizado N',
      sampleRho: 'Correlação amostral rho(E,N)',
      sampleMajor: 'Semi-eixo maior amostral',
      sampleMinor: 'Semi-eixo menor amostral',
      sampleAngle: 'Orientação da elipse amostral',
      covTitle: 'Covariância empírica de coordenadas (m²)',
      svgLegend: 'Verde: ensaios aprovados, vermelho: rejeitados pelo teste global, cruz azul: ajustamento nominal, ponto laranja: média amostral, elipse contínua/tracejada: covariância amostral a 1 sigma/3 sigma.'
    }
  }
};

function t(keyPath) {
  const parts = keyPath.split('.');
  let cur = freeStationI18n[currentLang] || freeStationI18n['en'];
  for (const part of parts) {
    if (cur && cur[part] !== undefined) {
      cur = cur[part];
    } else {
      return keyPath;
    }
  }
  return cur;
}

function setLanguage(lang) {
  if (!freeStationI18n[lang]) lang = 'en';
  currentLang = lang;
  try {
    localStorage.setItem('monorepo_lang', lang);
  } catch (e) {}

  document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';
  document.title = t('pageTitle');

  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };

  setText('headerTitle', t('headerTitle'));
  setText('headerSub', t('headerSub'));
  setText('portalLinkText', t('portalLinkText'));
  setText('themeBtn', t('themeBtn'));
  setText('netTitle', t('netTitle'));
  setText('fitBtn', t('fitBtn'));
  setText('ellipseScaleLabel', t('ellipseScaleLabel'));
  setText('inputsTitle', t('inputsTitle'));
  setText('labelModel', t('labelModel'));
  setText('optDir', t('optDir'));
  setText('optAng', t('optAng'));
  setText('labelAlpha', t('labelAlpha'));
  setText('labelWlim', t('labelWlim'));
  setText('labelDelta0', t('labelDelta0'));
  setText('labelMcN', t('labelMcN'));
  setText('labelSeed', t('labelSeed'));
  setText('legStations', t('legStations'));
  setText('legApprox', t('legApprox'));
  setText('guessBtn', t('guessBtn'));
  setText('legDir', t('legDir'));
  setText('labelDirA', t('labelDirA'));
  setText('labelDirB', t('labelDirB'));
  setText('labelSigDir', t('labelSigDir'));
  setText('legDist', t('legDist'));
  setText('titleToA', t('titleToA'));
  setText('labelSA', t('labelSA'));
  setText('labelZA', t('labelZA'));
  setText('titleToB', t('titleToB'));
  setText('labelSB', t('labelSB'));
  setText('labelZB', t('labelZB'));
  setText('labelSigS', t('labelSigS'));
  setText('labelSigZ', t('labelSigZ'));
  setText('runBtn', t('runBtn'));
  setText('cleanBtn', t('cleanBtn'));
  setText('blunderBtn', t('blunderBtn'));
  setText('noisyBtn', t('noisyBtn'));
  setText('compareBtn', t('compareBtn'));
  setText('mcBtn', t('mcBtn'));
  setText('jsonBtn', t('jsonBtn'));
  setText('csvBtn', t('csvBtn'));
  setText('summaryTitle', t('summaryTitle'));
  setText('comparisonTitle', t('comparisonTitle'));
  setText('preTitle', t('preTitle'));
  setText('obsTitle', t('obsTitle'));
  setText('itersTitle', t('itersTitle'));
  setText('matTitle', t('matTitle'));
  setText('heatTitle', t('heatTitle'));
  setText('qualityTitle', t('qualityTitle'));
  setText('mcTitle', t('mcTitle'));
  setText('mcHint', t('mcHint'));
  setText('mcPanelBtn', t('mcPanelBtn'));
  setText('notesTitle', t('notesTitle'));
  setText('note1', t('note1'));
  setText('note2', t('note2'));
  setText('note3', t('note3'));
  setText('note4', t('note4'));
  setText('footerText', t('footerText'));

  const portalLink = $('portalLink');
  if (portalLink) {
    portalLink.href = '../index.html?lang=' + (lang === 'pt-BR' ? 'pt' : 'en');
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  const mcEl = $('mc');
  if (mcEl && mcEl.classList.contains('mcstatus')) {
    mcEl.textContent = t('mcInitialStatus');
  }

  if (cur) {
    render(cur);
  }
}

function input(){let I={mode:$('mode').value,A:{E:+$('AE').value,N:+$('AN').value},B:{E:+$('BE').value,N:+$('BN').value},P0:{E:+$('E0').value,N:+$('N0').value},dirA:d2r(parseDMS($('dirA').value)),dirB:d2r(parseDMS($('dirB').value)),SA:+$('SA').value,SB:+$('SB').value,ZA:d2r(parseDMS($('ZA').value)),ZB:d2r(parseDMS($('ZB').value)),sd:as2r(+$('sigDir').value),sS:mm2m(+$('sigS').value),sZ:as2r(+$('sigZ').value),alpha:+$('alpha').value,wlim:+$('wlim').value,delta:+$('delta0').value};if(![I.A.E,I.A.N,I.B.E,I.B.N,I.P0.E,I.P0.N,I.dirA,I.dirB,I.SA,I.SB,I.ZA,I.ZB,I.sd,I.sS,I.sZ,I.alpha,I.wlim,I.delta].every(isFinite))throw Error('Check inputs');return I}
function red(S,Z,sS,sZ){let D=S*Math.sin(Z),a=Math.sin(Z),b=S*Math.cos(Z),v=a*a*sS*sS+b*b*sZ*sZ;return{D,s:Math.sqrt(v),dS:a,dZ:b}}
function inter(A,B,r1,r2,g){let dx=B.E-A.E,dy=B.N-A.N,d=Math.hypot(dx,dy);let a=(r1*r1-r2*r2+d*d)/(2*d),h2=r1*r1-a*a;if(h2<-.001)throw Error('Distance circles do not intersect');let h=Math.sqrt(Math.max(0,h2)),x=A.E+a*dx/d,y=A.N+a*dy/d,p1={E:x-dy*h/d,N:y+dx*h/d},p2={E:x+dy*h/d,N:y-dx*h/d};return Math.hypot(p1.E-g.E,p1.N-g.N)<Math.hypot(p2.E-g.E,p2.N-g.N)?p1:p2}
function obs(I){let ra=red(I.SA,I.ZA,I.sS,I.sZ),rb=red(I.SB,I.ZB,I.sS,I.sZ),beta={v:wrap2(I.dirB-I.dirA),s:Math.sqrt(2)*I.sd};let O=I.mode=='dir'?[{key:'dirPA',n:t('obsNames.dirPA'),t:'dir',l:I.dirA,s:I.sd,T:I.A},{key:'dirPB',n:t('obsNames.dirPB'),t:'dir',l:I.dirB,s:I.sd,T:I.B},{key:'distPA',n:t('obsNames.distPA'),t:'dist',l:ra.D,s:ra.s,T:I.A},{key:'distPB',n:t('obsNames.distPB'),t:'dist',l:rb.D,s:rb.s,T:I.B}]:[{key:'angAPB',n:t('obsNames.angAPB'),t:'ang',l:beta.v,s:beta.s,Ts:[I.A,I.B]},{key:'distPA',n:t('obsNames.distPA'),t:'dist',l:ra.D,s:ra.s,T:I.A},{key:'distPB',n:t('obsNames.distPB'),t:'dist',l:rb.D,s:rb.s,T:I.B}];return{ra,rb,beta,O}}
function linRow(o,x,mode){if(o.t=='dist'){let dE=o.T.E-x[0],dN=o.T.N-x[1],s=Math.hypot(dE,dN);return{row:[-dE/s,-dN/s].concat(mode=='dir'?[0]:[]),mis:s-o.l}}if(o.t=='dir'){let dE=o.T.E-x[0],dN=o.T.N-x[1],s=Math.hypot(dE,dN),f=wrapPi(az(x[0],x[1],o.T.E,o.T.N)-x[2]);return{row:[-dN/(s*s),dE/(s*s),-1],mis:wrapPi(f-o.l)}}let A=o.Ts[0],B=o.Ts[1],dEA=A.E-x[0],dNA=A.N-x[1],sA=Math.hypot(dEA,dNA),dEB=B.E-x[0],dNB=B.N-x[1],sB=Math.hypot(dEB,dNB),ba=wrap2(az(x[0],x[1],B.E,B.N)-az(x[0],x[1],A.E,A.N));let r=[-dNB/(sB*sB)+dNA/(sA*sA), dEB/(sB*sB)-dEA/(sA*sA)];return{row:r,mis:wrapPi(ba-o.l)}}
function adjust(I){let B=obs(I),nu=I.mode=='dir'?3:2,f=B.O.length-nu;if(f<1)throw Error('No redundancy');let x=I.mode=='dir'?[I.P0.E,I.P0.N,wrap2(az(I.P0.E,I.P0.N,I.A.E,I.A.N)-I.dirA)]:[I.P0.E,I.P0.N];let p=B.O.map(o=>1/(o.s*o.s)),A,w,N,Q,its=[];for(let it=0;it<20;it++){A=[];w=[];B.O.forEach(o=>{let r=linRow(o,x,I.mode);A.push(r.row);w.push(r.mis)});N=Array.from({length:nu},()=>Array(nu).fill(0));let u=Array(nu).fill(0),At=tr(A);for(let i=0;i<B.O.length;i++)for(let r=0;r<nu;r++){u[r]+=At[r][i]*p[i]*w[i];for(let c=0;c<nu;c++)N[r][c]+=At[r][i]*p[i]*A[i][c]}let dx=solve(N,u.map(v=>-v));x=x.map((v,i)=>v+dx[i]);if(I.mode=='dir')x[2]=wrap2(x[2]);its.push({it:it+1,E:x[0],N:x[1],omega:I.mode=='dir'?x[2]:null,dE:dx[0],dN:dx[1],dw:I.mode=='dir'?dx[2]:null,norm:Math.hypot(...dx)});if(Math.hypot(...dx)<1e-10){Q=inv(N);break}if(it==19)throw Error('No convergence')}
A=[];w=[];B.O.forEach(o=>{let r=linRow(o,x,I.mode);A.push(r.row);w.push(r.mis)});let v=w,T=v.reduce((s,vi,i)=>s+vi*p[i]*vi,0),s0=Math.sqrt(T/f),Cll=diag(B.O.map(o=>o.s*o.s)),Qvv=Cll.map((r,i)=>r.map((val,j)=>val-mmul(mmul(A,Q),tr(A))[i][j]));let an=B.O.map((o,i)=>{let sv=Math.sqrt(Math.max(0,Qvv[i][i])),redn=Qvv[i][i]/(o.s*o.s),ws=sv?v[i]/(s0*sv):NaN,mdb=I.delta*o.s/Math.sqrt(Math.max(redn,1e-20));let ex=mv(Q,A[i].map(a=>a*p[i]*mdb));return{...o,v:v[i],sv,r:redn,w:ws,mdb,ex}});let C=[[Q[0][0],Q[0][1]],[Q[1][0],Q[1][1]]],eg=eig2(C[0][0],C[0][1],C[1][1]),lo=chi(I.alpha/2,f),hi=chi(1-I.alpha/2,f);return{I,B,x:{E:x[0],N:x[1],omega:I.mode=='dir'?x[2]:null},nu,f,T,s0,s02:T/f,lo,hi,pass:T>=lo&&T<=hi,A,P:diag(p),Nmat:N,Q,Qvv,an,C,eg,its}}
function cell(x){return `<td>${x}</td>`}function table(h,rows){return `<div class="table"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`}function kpis(a){return `<div class="kpis">${a.map(([h,v])=>`<div class="kpi"><h4>${h}</h4><div>${v}</div></div>`).join('')}</div>`}
function val(o){return o.t=='dist'?fmt(o.l,4)+' m':dms(o.l,2)}function sig(o){return o.t=='dist'?fmt(m2mm(o.s),3)+' mm':fmt(r2as(o.s),3)+'"'}function res(a){return a.t=='dist'?fmt(m2mm(a.v),3)+' mm':fmt(r2as(a.v),3)+'"'}function mdb(a){return a.t=='dist'?fmt(m2mm(a.mdb),3)+' mm':fmt(r2as(a.mdb),3)+'"'}
function render(R){cur=R;
R.an.forEach(a => { if (a.key) a.n = t('obsNames.' + a.key); });
$('summary').innerHTML=kpis([[t('summary.mode'),R.I.mode=='dir'?t('summary.modeDir'):t('summary.modeAng')],['E(P)',fmt(R.x.E,4)+' m'],['N(P)',fmt(R.x.N,4)+' m'],['omega',R.x.omega==null?t('summary.omegaNotEst'):dms(R.x.omega,2)],[t('summary.dof'),R.f],[t('summary.globalTest'),`<span class="${R.pass?'pass':'fail'}">${R.pass?t('summary.pass'):t('summary.fail')}</span>`],[t('summary.sigma0Hat'),fmt(R.s0,4)],[t('summary.maxW'),fmt(Math.max(...R.an.map(a=>Math.abs(a.w))),3)],[t('summary.sE_apriori'),fmt(m2mm(Math.sqrt(R.C[0][0])),3)+' mm'],[t('summary.sN_apriori'),fmt(m2mm(Math.sqrt(R.C[1][1])),3)+' mm'],[t('summary.sE_apost'),fmt(m2mm(R.s0*Math.sqrt(R.C[0][0])),3)+' mm'],[t('summary.sN_apost'),fmt(m2mm(R.s0*Math.sqrt(R.C[1][1])),3)+' mm']]);
$('pre').innerHTML=table(t('preTable.headers'),[['A',fmt(R.I.SA,3)+' m',dms(R.I.ZA),fmt(R.B.ra.D,4)+' m',fmt(m2mm(R.B.ra.s),3)+' mm',`dD/dS=${fmt(R.B.ra.dS,6)}<br>dD/dZ=${fmt(R.B.ra.dZ,6)} m/rad`],['B',fmt(R.I.SB,3)+' m',dms(R.I.ZB),fmt(R.B.rb.D,4)+' m',fmt(m2mm(R.B.rb.s),3)+' mm',`dD/dS=${fmt(R.B.rb.dS,6)}<br>dD/dZ=${fmt(R.B.rb.dZ,6)} m/rad`]])+kpis([[t('preTable.dirPA'),dms(R.I.dirA)],[t('preTable.dirPB'),dms(R.I.dirB)],[t('preTable.derivedBeta'),dms(R.B.beta.v)],[t('preTable.sigmaBeta'),fmt(r2as(R.B.beta.s),3)+'"']]);
$('obs').innerHTML=table(t('obsTable.headers'),R.an.map(a=>[a.n,val(a),sig(a),res(a),a.t=='dist'?fmt(m2mm(a.sv),3)+' mm':fmt(r2as(a.sv),3)+'"',`<span class="${Math.abs(a.w)>R.I.wlim?'fail':''}">${fmt(a.w,3)}</span>`,fmt(a.r,3),mdb(a),`dE=${fmt(m2mm(a.ex[0]),3)} mm<br>dN=${fmt(m2mm(a.ex[1]),3)} mm<br>|d|=${fmt(m2mm(Math.hypot(a.ex[0],a.ex[1])),3)} mm`]));
$('iters').innerHTML=table(t('itersTable.headers'),R.its.map(i=>[i.it,fmt(i.E,6),fmt(i.N,6),i.omega==null?'--':dms(i.omega,2),fmt(m2mm(i.dE),4),fmt(m2mm(i.dN),4),i.dw==null?'--':fmt(r2as(i.dw),4),i.norm.toExponential(3)]));
$('quality').innerHTML=kpis([[t('quality.vTPv'),fmt(R.T,4)],[t('quality.chi2Lo'),fmt(R.lo,4)],[t('quality.chi2Hi'),fmt(R.hi,4)],[t('quality.sigma02Hat'),fmt(R.s02,4)],[t('quality.semiMinorApriori'),fmt(m2mm(Math.sqrt(R.eg.lmin)),3)+' mm'],[t('quality.semiMajorApriori'),fmt(m2mm(Math.sqrt(R.eg.lmax)),3)+' mm'],[t('quality.semiMinorApost'),fmt(m2mm(R.s0*Math.sqrt(R.eg.lmin)),3)+' mm'],[t('quality.semiMajorApost'),fmt(m2mm(R.s0*Math.sqrt(R.eg.lmax)),3)+' mm'],[t('quality.mdsMinor'),fmt(m2mm(R.I.delta*Math.sqrt(R.eg.lmin)),3)+' mm'],[t('quality.mdsMajor'),fmt(m2mm(R.I.delta*Math.sqrt(R.eg.lmax)),3)+' mm'],[t('quality.orientation'),dms(R.eg.ang,1)]]);
renderBars(R);renderMatrix();renderHeat(R);draw(R)}
function renderBars(R){let wm=Math.max(R.I.wlim,...R.an.map(a=>Math.abs(a.w)),.1);let W=R.an.map(a=>{let pct=50*Math.min(Math.abs(a.w)/wm,1),left=a.w>=0?50:50-pct;return `<div class="barrow"><div>${a.n}</div><div class="track"><div class="fill ${a.w>=0?'pos':'neg'}" style="left:${left}%;width:${pct}%"></div></div><div>${fmt(a.w,2)}</div></div>`}).join('');let RR=R.an.map(a=>`<div class="barrow"><div>${a.n}</div><div class="track"><div class="fill blue" style="width:${100*Math.max(0,Math.min(1,a.r))}%"></div></div><div>${fmt(a.r,2)}</div></div>`).join('');$('bars').innerHTML=`<div class="bars"><div class="barbox"><h3>${t('bars.stdRes')}</h3>${W}</div><div class="barbox"><h3>${t('bars.redun')}</h3>${RR}</div></div>`}
function renderMatrix(){if(!cur)return;let M={A:cur.A,P:cur.P,N:cur.Nmat,Qxx:cur.Q,Qvv:cur.Qvv}[tab];$('mat').innerHTML=table(M[0].map((_,i)=>'c'+(i+1)),M.map(r=>r.map(v=>Math.abs(v)>1000||Math.abs(v)<1e-4&&v!=0?v.toExponential(4):fmt(v,6))))}
function heatCell(v){let a=Math.min(1,Math.abs(v)),h=v>=0?210:0;return `<span class="heat" style="background:hsl(${h} 80% ${85-45*a}%);">${fmt(v,3)}</span>`}function renderHeat(R){let sE=Math.sqrt(R.C[0][0]),sN=Math.sqrt(R.C[1][1]),rho=R.C[0][1]/(sE*sN);$('heat').innerHTML=t('heat.covTitle')+table(['','E','N'],[['E',heatCell(R.C[0][0]),heatCell(R.C[0][1])],['N',heatCell(R.C[1][0]),heatCell(R.C[1][1])]])+t('heat.corrTitle')+table(['','E','N'],[['E',heatCell(1),heatCell(rho)],['N',heatCell(rho),heatCell(1)]])}
function draw(R,pts=[]){let svg=$('net');svg.innerHTML='';let W=900,H=460,m=40,P=R.x,A=R.I.A,B=R.I.B;let all=[A,B,P,...pts];let minE=Math.min(...all.map(p=>p.E)),maxE=Math.max(...all.map(p=>p.E)),minN=Math.min(...all.map(p=>p.N)),maxN=Math.max(...all.map(p=>p.N));let pe=Math.max((maxE-minE)*.25,25),pn=Math.max((maxN-minN)*.25,25);minE-=pe;maxE+=pe;minN-=pn;maxN+=pn;let sc=Math.min((W-2*m)/(maxE-minE||1),(H-2*m)/(maxN-minN||1));let xy=p=>({x:m+(p.E-minE)*sc,y:H-m-(p.N-minN)*sc});let el=(t,a)=>{let e=document.createElementNS('http://www.w3.org/2000/svg',t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));svg.appendChild(e);return e};let a=xy(A),b=xy(B),p=xy(P);el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#94a3b8','stroke-width':2,'stroke-dasharray':'6,5'});el('line',{x1:p.x,y1:p.y,x2:a.x,y2:a.y,stroke:'#0f766e','stroke-width':2});el('line',{x1:p.x,y1:p.y,x2:b.x,y2:b.y,stroke:'#0f766e','stroke-width':2});pts.forEach(q=>{let z=xy(q);el('circle',{cx:z.x,cy:z.y,r:2,fill:'#64748b',opacity:.35})});let exag=parseFloat($('ellipseExag').value)||1,ex=2500,rx=Math.sqrt(R.eg.lmax)*sc*ex*exag,ry=Math.sqrt(R.eg.lmin)*sc*ex*exag,ang=-r2d(R.eg.ang);el('ellipse',{cx:p.x,cy:p.y,rx:R.I.delta*rx,ry:R.I.delta*ry,fill:'rgba(29,78,216,.08)',stroke:'#1d4ed8','stroke-width':2,transform:`rotate(${ang} ${p.x} ${p.y})`});el('ellipse',{cx:p.x,cy:p.y,rx,ry,fill:'rgba(15,118,110,.12)',stroke:'#0f766e','stroke-width':2,transform:`rotate(${ang} ${p.x} ${p.y})`});[[A,'A','#1d4ed8'],[B,'B','#1d4ed8'],[P,'P','#b45309']].forEach(([q,l,c])=>{let z=xy(q);el('circle',{cx:z.x,cy:z.y,r:7,fill:c});let tx=el('text',{x:z.x+10,y:z.y-10,fill:'currentColor','font-size':14,'font-weight':700});tx.textContent=`${l} (${fmt(q.E,3)}, ${fmt(q.N,3)})`});applyNetView(svg);$('vizText').innerHTML=t('legend.html')}
function compare(){let I=input(),a=adjust({...I,mode:'dir'}),b=adjust({...I,mode:'ang'});$('comparison').innerHTML=table(t('compare.headers'),[['E(P)',fmt(a.x.E,6),fmt(b.x.E,6),fmt(m2mm(a.x.E-b.x.E),4)+' mm'],['N(P)',fmt(a.x.N,6),fmt(b.x.N,6),fmt(m2mm(a.x.N-b.x.N),4)+' mm'],['f',a.f,b.f,a.f-b.f],['vTPv',fmt(a.T,6),fmt(b.T,6),fmt(a.T-b.T,6)],['sigma0',fmt(a.s0,6),fmt(b.s0,6),fmt(a.s0-b.s0,6)],['sigma E',fmt(m2mm(Math.sqrt(a.C[0][0])),4)+' mm',fmt(m2mm(Math.sqrt(b.C[0][0])),4)+' mm',fmt(m2mm(Math.sqrt(a.C[0][0])-Math.sqrt(b.C[0][0])),4)+' mm']])}
function rng(seed){let s=seed>>>0;return()=>((s=(1664525*s+1013904223)>>>0)/4294967296)}function gauss(r){let u=Math.max(r(),1e-12),v=Math.max(r(),1e-12);return Math.sqrt(-2*Math.log(u))*Math.cos(2*pi*v)}
function stats2(pts){let n=pts.length;if(!n)return null;let meanE=pts.reduce((s,p)=>s+p.E,0)/n,meanN=pts.reduce((s,p)=>s+p.N,0)/n;if(n<2)return{n,meanE,meanN,varE:NaN,varN:NaN,covEN:NaN,sigE:NaN,sigN:NaN,rho:NaN,eg:null};let varE=pts.reduce((s,p)=>s+(p.E-meanE)**2,0)/(n-1),varN=pts.reduce((s,p)=>s+(p.N-meanN)**2,0)/(n-1),covEN=pts.reduce((s,p)=>s+(p.E-meanE)*(p.N-meanN),0)/(n-1),sigE=Math.sqrt(varE),sigN=Math.sqrt(varN),rho=covEN/(sigE*sigN);return{n,meanE,meanN,varE,varN,covEN,sigE,sigN,rho,eg:eig2(varE,covEN,varN)}}
function monte(){clearErr();let base=input(),nominal=adjust(base),n=Math.max(10,Math.min(2000,+$('mcN').value||300)),r=rng(+$('seed').value||1),pts=[],accepted=0,rejected=0,crashed=0;for(let i=0;i<n;i++){let I={...base,A:{...base.A},B:{...base.B},P0:{...base.P0}};I.dirA+=gauss(r)*I.sd;I.dirB+=gauss(r)*I.sd;I.SA+=gauss(r)*I.sS;I.SB+=gauss(r)*I.sS;I.ZA+=gauss(r)*I.sZ;I.ZB+=gauss(r)*I.sZ;try{let R=adjust(I),pass=R.pass;pts.push({E:R.x.E,N:R.x.N,pass,T:R.T,s0:R.s0});pass?accepted++:rejected++}catch(e){crashed++}}let S=stats2(pts);if(!S){$('mc').innerHTML=`<p class="fail">${t('mc.allFailed').replace('{n}', n)}</p>`;return}let aSigE=Math.sqrt(nominal.C[0][0]),aSigN=Math.sqrt(nominal.C[1][1]),biasE=S.meanE-nominal.x.E,biasN=S.meanN-nominal.x.N,coverage=100*accepted/n,crashPct=100*crashed/n,rejPct=100*rejected/n;let cards=kpis([[t('mc.trials'),n],[t('mc.accepted'),`${accepted} (${fmt(coverage,1)}%)`],[t('mc.rejected'),`${rejected} (${fmt(rejPct,1)}%)`],[t('mc.failures'),`${crashed} (${fmt(crashPct,1)}%)`],[t('mc.meanE'),fmt(S.meanE,4)+' m'],[t('mc.meanN'),fmt(S.meanN,4)+' m'],[t('mc.biasE'),fmt(m2mm(biasE),3)+' mm'],[t('mc.biasN'),fmt(m2mm(biasN),3)+' mm'],[t('mc.sampleSigE'),fmt(m2mm(S.sigE),3)+' mm'],[t('mc.linSigE'),fmt(m2mm(aSigE),3)+' mm'],[t('mc.sampleSigN'),fmt(m2mm(S.sigN),3)+' mm'],[t('mc.linSigN'),fmt(m2mm(aSigN),3)+' mm'],[t('mc.sampleRho'),fmt(S.rho,3)],[t('mc.sampleMajor'),S.eg?fmt(m2mm(Math.sqrt(S.eg.lmax)),3)+' mm':'--'],[t('mc.sampleMinor'),S.eg?fmt(m2mm(Math.sqrt(S.eg.lmin)),3)+' mm':'--'],[t('mc.sampleAngle'),S.eg?dms(S.eg.ang,1):'--']]);let cov=table(['','E','N'],[['E',fmt(S.varE,8),fmt(S.covEN,8)],['N',fmt(S.covEN,8),fmt(S.varN,8)]]);$('mc').innerHTML=`<div class="mcgrid"><svg id="mcSvg" viewBox="0 0 900 420"></svg><div>${cards}<h3>${t('mc.covTitle')}</h3>${cov}</div></div>`;drawMC(pts,S,nominal);draw(nominal,pts)}
function drawMC(pts,S,nominal){let svg=$('mcSvg');if(!svg)return;svg.innerHTML='';let W=900,H=420,m=35;if(!pts.length)return;let refs=[...pts,{E:S.meanE,N:S.meanN},{E:nominal.x.E,N:nominal.x.N}],spread=S.eg?3*Math.sqrt(Math.max(S.eg.lmax,1e-12)):0;let minE=Math.min(...refs.map(p=>p.E))-spread,maxE=Math.max(...refs.map(p=>p.E))+spread,minN=Math.min(...refs.map(p=>p.N))-spread,maxN=Math.max(...refs.map(p=>p.N))+spread;let pe=Math.max(maxE-minE,.01)*.25,pn=Math.max(maxN-minN,.01)*.25;minE-=pe;maxE+=pe;minN-=pn;maxN+=pn;let sc=Math.min((W-2*m)/(maxE-minE),(H-2*m)/(maxN-minN));let xy=p=>({x:m+(p.E-minE)*sc,y:H-m-(p.N-minN)*sc});let el=(t,a)=>{let e=document.createElementNS('http://www.w3.org/2000/svg',t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));svg.appendChild(e);return e};pts.forEach(p=>{let q=xy(p);el('circle',{cx:q.x,cy:q.y,r:2,fill:p.pass?'#0f766e':'#b91c1c',opacity:.42})});if(S.eg){let c=xy({E:S.meanE,N:S.meanN}),rx=Math.sqrt(S.eg.lmax)*sc,ry=Math.sqrt(S.eg.lmin)*sc,ang=-r2d(S.eg.ang);el('ellipse',{cx:c.x,cy:c.y,rx,ry,fill:'rgba(15,118,110,.10)',stroke:'#0f766e','stroke-width':2,transform:`rotate(${ang} ${c.x} ${c.y})`});el('ellipse',{cx:c.x,cy:c.y,rx:3*rx,ry:3*ry,fill:'none',stroke:'#0f766e','stroke-width':1.5,'stroke-dasharray':'7,5',transform:`rotate(${ang} ${c.x} ${c.y})`})}let n=xy({E:nominal.x.E,N:nominal.x.N}),c=xy({E:S.meanE,N:S.meanN});el('line',{x1:n.x-8,y1:n.y,x2:n.x+8,y2:n.y,stroke:'#1d4ed8','stroke-width':2});el('line',{x1:n.x,y1:n.y-8,x2:n.x,y2:n.y+8,stroke:'#1d4ed8','stroke-width':2});el('circle',{cx:c.x,cy:c.y,r:5,fill:'#b45309'});let lg=el('text',{x:m,y:H-12,fill:'currentColor','font-size':14,'font-weight':700});lg.textContent=t('mc.svgLegend')}
function showErr(e){$('err').textContent=e.message||String(e);$('err').classList.remove('hidden')}function clearErr(){$('err').classList.add('hidden')}
function run(){clearErr();try{render(adjust(input()))}catch(e){console.error(e);showErr(e)}}function reset(){['AE','AN','BE','BN','E0','N0'].forEach(()=>{});$('mode').value='dir';$('AE').value='1000';$('AN').value='1000';$('BE').value='1200';$('BN').value='1000';$('E0').value='1082';$('N0').value='1118';$('dirA').value='213 41 24.85';$('dirB').value='133 53 39.16';$('SA').value='143.701426';$('SB').value='166.877333';$('ZA').value='90 34 40.00';$('ZB').value='89 55 40.00';$('sigDir').value='2';$('sigS').value='2';$('sigZ').value='3';resetNetView();run()}function blunder(){reset();$('dirB').value='133 54 09.16';$('SB').value='166.913333';run()}function noisy(){reset();$('sigDir').value='5';$('sigS').value='5';$('sigZ').value='8';$('dirA').value='213 41 26.20';$('dirB').value='133 53 37.58';$('SA').value='143.705426';$('SB').value='166.872333';run()}function guess(){try{let I=input(),B=obs(I),g=inter(I.A,I.B,B.ra.D,B.rb.D,I.P0);$('E0').value=fmt(g.E,3);$('N0').value=fmt(g.N,3)}catch(e){showErr(e)}}function expJSON(){if(!cur)return;download(JSON.stringify(cur,null,2),'resection_v3_results.json','application/json')}function expCSV(){if(!cur)return;let rows=[['observation','type','value','sigma','residual','w','r','mdb','ext_dE_mm','ext_dN_mm']].concat(cur.an.map(a=>[a.n,a.t,a.t=='dist'?a.l:r2d(a.l),a.t=='dist'?m2mm(a.s):r2as(a.s),a.t=='dist'?m2mm(a.v):r2as(a.v),a.w,a.r,a.t=='dist'?m2mm(a.mdb):r2as(a.mdb),m2mm(a.ex[0]),m2mm(a.ex[1])]));download(rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'),'resection_v3_observations.csv','text/csv')}function download(c,n,t){let b=new Blob([c],{type:t}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function runMonte(){try{monte()}catch(e){showErr(e)}}
$('fitBtn').onclick=resetNetView;$('ellipseExag').oninput=()=>{let v=parseFloat($('ellipseExag').value)||1;$('ellipseExagVal').textContent=v.toFixed(1)+'×';if(cur)draw(cur)};$('runBtn').onclick=run;$('cleanBtn').onclick=reset;$('blunderBtn').onclick=blunder;$('noisyBtn').onclick=noisy;$('guessBtn').onclick=guess;$('compareBtn').onclick=()=>{try{compare()}catch(e){showErr(e)}};$('mcBtn').onclick=runMonte;$('mcPanelBtn').onclick=runMonte;$('jsonBtn').onclick=expJSON;$('csvBtn').onclick=expCSV;$('themeBtn').onclick=()=>document.body.classList.toggle('dark');document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');tab=b.dataset.m;renderMatrix()});
window.onload=()=>{
  initNetZoom();
  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get('lang');
  let initLang = 'en';
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

  reset();
  setLanguage(initLang);
};
