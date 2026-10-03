/* The ten lessons follow the ten paragraphs of the original teoria.md.
 * Authored explanations, definitions, model limits and instructor prompts in Portuguese and English. */
window.MEDSources = {
  rueger: { label: 'Rüeger · Electronic Distance Measurement', url: 'https://doi.org/10.1007/978-3-642-80233-1' },
  ngs: { label: 'NGS · Establishment of Calibration Base Lines', url: 'https://geodesy.noaa.gov/library/pdfs/NOAA_TM_NOS_NGS_0008.pdf' },
  nist: { label: 'NIST · Index of Refraction Documentation', url: 'https://emtoolbox.nist.gov/Wavelength/Documentation.asp' },
  bipm: { label: 'BIPM · Realisation of the Metre', url: 'https://www.bipm.org/documents/20126/41489670/SI-App2-metre.pdf' },
  leica: { label: 'Leica · Prism and Reflectorless Measurement', url: 'https://leica-geosystems.com/-/media/files/leicageosystems/products/datasheets/leica_icon_robot_50_ds.ashx?sc_lang=en' }
};

window.MEDLessonsPt = [
  {
    id: 'tempo', nav: 'Distância e tempo de voo', title: 'Como o tempo se transforma em distância?',
    summary: 'O EDM observa a propagação de um sinal. A grandeza procurada é a distância de ida; o cronômetro registra a viagem completa até o alvo e de volta.',
    objective: 'Duplique a distância. O tempo duplica? Quanto um erro de 1 ns desloca a distância medida?',
    theory: `<p>A medição eletrônica substitui a materialização sucessiva de comprimentos por uma observação de tempo ou de fase. O Geodímetro e o Telurômetro foram marcos desse desenvolvimento; a tecnologia empregada hoje depende do instrumento e do modo de medição.</p>
      <p>Para um trajeto retilíneo em meio homogêneo, a velocidade de grupo é <strong>v = c₀/n<sub>g</sub></strong>. O pulso percorre 2D, portanto:</p>
      <div class="equation">Δt = 2n<sub>g</sub>D / c₀<br>D = c₀Δt / (2n<sub>g</sub>)<br>δD = c₀δt / (2n<sub>g</sub>)</div>
      <dl class="definitions"><dt>D [m]</dt><dd>Distância entre as referências do instrumento e do alvo.</dd><dt>Δt [s]</dt><dd>Tempo de ida e volta, após compensar atrasos internos.</dd><dt>c₀ [m/s]</dt><dd>299 792 458, valor exato da velocidade da luz no vácuo.</dd><dt>n<sub>g</sub> [1]</dt><dd>Índice de grupo do meio; neste primeiro experimento, 1,00028 fixo.</dd></dl>
      <p>Em 100 m, a viagem leva aproximadamente 667 ns. Um erro de 1 ns corresponde a cerca de 150 mm. Isso explica por que resolução temporal, processamento do sinal e calibração são relevantes; não significa que todos os aparelhos tenham resolução de 1 ns.</p>
      <p class="model-note">A animação é desacelerada para observação. Sua duração na tela não representa segundos físicos. O modelo exclui atrasos internos, movimento do alvo e curvatura do trajeto.</p>`,
    exerciseTitle: 'Por que dividir por dois?',
    exercise: 'Use 300 m e erro temporal zero. Calcule vΔt sem dividir por dois. Depois aplique +0,1 ns e compare o erro em 300 m e em 600 m.',
    answer: 'vΔt fornece 600 m: o comprimento da ida e da volta. +0,1 ns produz aproximadamente +15 mm em ambas as distâncias. Um atraso temporal fixo é um erro aditivo; não cresce proporcionalmente à distância.',
    sources: ['bipm', 'rueger']
  },
  {
    id: 'modulacao', nav: 'Portadora e modulação', title: 'O que o comparador de fase observa?',
    summary: 'A luz transporta uma modulação de intensidade. O receptor extrai essa modulação e a compara com uma referência interna; não conta diretamente as oscilações ópticas.',
    objective: 'Aumente a frequência de modulação e observe o compromisso entre sensibilidade e ambiguidade.',
    theory: `<p>No modelo de modulação em amplitude, um oscilador define a frequência f<sub>m</sub>. Essa modulação atua sobre a intensidade da portadora óptica produzida pela fonte. Um fotodetector converte o retorno em sinal elétrico, permitindo comparar a modulação recebida com a referência.</p>
      <div class="equation">I(t) = I₀[1 + m cos(2πf<sub>m</sub>t)]<br>λ<sub>m</sub> = c₀ / (n<sub>g</sub>f<sub>m</sub>)<br>Δφ = (4πD / λ<sub>m</sub>) mod 2π<br>U = λ<sub>m</sub>/2</div>
      <dl class="definitions"><dt>m [1]</dt><dd>Profundidade de modulação de intensidade, entre 0 e 1 neste modelo.</dd><dt>f<sub>m</sub> [Hz]</dt><dd>Frequência de modulação, em MHz nos controles.</dd><dt>λ<sub>m</sub> [m]</dt><dd>Comprimento espacial da modulação no meio, distinto do comprimento de onda óptico.</dd><dt>U [m]</dt><dd>Intervalo de distância que corresponde a uma volta completa da fase.</dd></dl>
      <p>O gráfico inferior apresenta os sinais após remover a componente contínua e normalizar a amplitude. Definimos Δφ como o atraso do retorno em relação à emissão, entre 0° e 360°. A convenção eletrônica de sinal pode mudar entre instrumentos.</p>
      <p>Para uma mesma incerteza de fase, σ<sub>D</sub> = Uσ<sub>φ</sub>/360°, com σ<sub>φ</sub> em graus. Aumentar f<sub>m</sub> reduz U e melhora essa sensibilidade, mas aproxima os candidatos de distância. Em m = 0, este modelo não fornece uma fase de modulação observável.</p>
      <p class="model-note">As oscilações ópticas não são desenhadas em escala. O gráfico representa a intensidade e a modulação demodulada. A precisão efetiva também depende do sinal, eletrônica e algoritmo.</p>`,
    exerciseTitle: 'Frequência alta resolve tudo?',
    exercise: 'Compare 15 MHz e 30 MHz mantendo D. O que acontece com U e com a distância equivalente a 0,01°? Depois zere a profundidade de modulação.',
    answer: 'Dobrar a frequência reduz U e a distância equivalente a 0,01° à metade. Também reduz o intervalo sem ambiguidade à metade. Com m = 0, a intensidade é constante e não há fase da modulação para comparar, embora a luz continue presente.',
    sources: ['rueger', 'nist']
  },
  {
    id: 'fase', nav: 'Resolver a ambiguidade', title: 'Uma fase, muitas distâncias possíveis',
    summary: 'Uma frequência determina uma fração de U. Para obter a distância, é necessário identificar também o número inteiro de intervalos. Combine frequências e acompanhe os candidatos que permanecem.',
    objective: 'Comece com uma frequência e ative as demais. Descubra por que o alcance declarado faz parte da solução.',
    theory: `<p>A fase não informa quantos ciclos completos ocorreram no percurso de ida e volta. O instrumento mede uma posição dentro do ciclo, e não uma distância absoluta:</p>
      <div class="equation">2D = λ<sub>m</sub>(N + Δφ/360°)<br>D = U(N + Δφ/360°)<br>r = UΔφ/360°; D<sub>N</sub> = NU + r</div>
      <dl class="definitions"><dt>N [inteiro]</dt><dd>Número de ciclos completos da modulação no percurso 2D.</dd><dt>r [m]</dt><dd>Resto da distância ao dividi-la por U.</dd><dt>U [m]</dt><dd>λ<sub>m</sub>/2. Aqui são usados 10, 100, 1 000 e 10 000 m.</dd></dl>
      <p>Para D = 3 123,456 m e U = 10 m: N = 312, r = 3,456 m e Δφ = 124,416°. Mas 3,456 m, 13,456 m e 23,456 m produzem a mesma fase. As demais frequências eliminam candidatos incompatíveis dentro do intervalo declarado.</p>
      <p>Os quatro restos desse exemplo são 3,456; 23,456; 123,456 e 3 123,456 m. A interface mostra as fases correspondentes e testa os candidatos numericamente. Os algarismos são uma consequência dessa estrutura decimal, não o princípio físico do método.</p>
      <p class="model-note">Leituras ideais, sem ruído e com n<sub>g</sub> fixo. O intervalo de busca é [0, alcance), com limite superior excluído. As frequências são harmonizadas por construção. Instrumentos reais usam estratégias próprias e tolerâncias de fase; nenhuma combinação garante unicidade fora de seu intervalo de ambiguidade.</p>`,
    exerciseTitle: 'O mesmo conjunto pode ter duas soluções?',
    exercise: 'Ative todas as frequências e altere o alcance de busca de 10 km para 20 km. Depois tente o desafio sem consultar a distância de referência.',
    answer: 'Sim. Como os U são divisores de 10 000 m, D e D + 10 000 m repetem todas as fases. Em [0, 10 000) há uma solução; em [0, 20 000) há duas. Conhecer o intervalo admissível faz parte da resolução da ambiguidade.',
    sources: ['rueger']
  },
  {
    id: 'alvos', nav: 'Refletores e retorno', title: 'Quanto sinal consegue voltar?',
    summary: 'Um prisma retrorefletor favorece o retorno na direção do instrumento. Uma superfície difusa espalha energia; reflectância, incidência e distância alteram a parcela recebida.',
    objective: 'Isole o efeito da distância, depois incline a superfície. Relacione o retorno com a confiabilidade da leitura.',
    theory: `<p>Um prisma de canto de cubo usa três faces ortogonais para produzir uma direção de saída aproximadamente antiparalela à incidente, dentro de sua abertura útil. Isso não significa devolver toda a energia: há perdas, divergência e requisitos de orientação.</p>
      <p>Sem prisma, o sinal retorna da própria superfície. O experimento adota uma superfície lambertiana ideal, mantendo potência interceptada, área receptora e demais fatores fixos. O sinal relativo é:</p>
      <div class="equation">S<sub>rel</sub> = ρ cos(i) (100 m / D)²</div>
      <dl class="definitions"><dt>ρ [1]</dt><dd>Reflectância ideal entre 0 e 1.</dd><dt>i [°]</dt><dd>Ângulo entre a normal à superfície e a direção para o instrumento.</dd><dt>S<sub>rel</sub> [1]</dt><dd>Sinal relativo ao de uma superfície branca normal ao feixe a 100 m.</dd></dl>
      <p>Esta relação permite uma investigação controlada, sem prever o alcance de um aparelho. Em uma quina, o feixe pode atingir duas superfícies em distâncias diferentes; sinal suficiente não garante que a distância corresponda ao ponto visado.</p>
      <p class="model-note">Não se comparam numericamente prismas e superfícies difusas com esta mesma lei. A classificação de precisão depende do instrumento, modo, alvo e condições especificadas. Vidro, metais especulares e alvos molhados não são superfícies lambertianas ideais.</p>`,
    exerciseTitle: 'Uma leitura fraca é apenas ruído?',
    exercise: 'Em 100 m, use ρ = 0,8 e i = 0°. Depois use 200 m e i = 60°. Qual a razão entre os retornos? O modelo detectaria um feixe dividido entre uma parede e seu fundo?',
    answer: 'O primeiro retorno é 0,8 e o segundo é 0,1: a distância divide o sinal por quatro e a inclinação por dois, produzindo 1/8 do retorno inicial. O modelo não representa múltiplos alvos; uma leitura de uma quina exige avaliar a geometria do feixe e o alvo efetivamente medido.',
    sources: ['leica', 'rueger']
  },
  {
    id: 'erros', nav: 'Erros e especificação', title: 'Separe as assinaturas dos erros',
    summary: 'Deslocamento constante, variação proporcional e oscilação periódica deixam padrões diferentes no erro em função da distância. Ative cada componente e compare suas ordens de grandeza.',
    objective: 'Identifique qual componente domina em uma linha curta e qual pode dominar em uma linha longa.',
    theory: `<p>Adotamos erro e = D<sub>obs</sub> − D<sub>ref</sub>. Valores positivos indicam uma distância observada maior. A correção a aplicar tem sinal oposto. O modelo didático, já em milímetros, é:</p>
      <div class="equation">e(D) = a + bD/1000 + A sin(2πD/U + ψ) + k<br>D<sub>corr</sub> ≈ D<sub>obs</sub> − e(D<sub>obs</sub>)/1000</div>
      <dl class="definitions"><dt>a, k [mm]</dt><dd>Erro de zero do conjunto e erro residual de configuração do prisma. k não é uma convenção universal de fabricante.</dd><dt>b [ppm]</dt><dd>Erro de escala: 1 ppm = 1 mm por km.</dd><dt>A [mm], ψ [°]</dt><dd>Amplitude e fase do erro cíclico; U é seu período em distância neste exemplo.</dd></dl>
      <p>O fator de escala pode decorrer da frequência de modulação usada como referência, além de efeitos atmosféricos. Erros cíclicos podem resultar de interferências internas no comparador. A constante aditiva efetiva inclui caminhos internos e o conjunto instrumento–refletor; não se reduz à posição física do emissor.</p>
      <p>A especificação nominal ±(a<sub>nom</sub> mm + b<sub>nom</sub> ppm) é mostrada como uma faixa distinta do erro simulado. Em 500 m, 2 mm + 2 ppm correspondem a 3 mm. Essa expressão não é automaticamente uma distribuição normal, um intervalo de 95% ou uma soma quadrática.</p>
      <p class="model-note">O seno representa uma componente cíclica, não um diagnóstico completo. A aproximação de correção usa a distância observada no termo do erro. Em calibração rigorosa, a equação de observação e o sinal da constante devem ser explicitados.</p>`,
    exerciseTitle: 'Um erro de 5 mm pode virar 5 ppm?',
    exercise: 'Zere todas as componentes, imponha a = 5 mm e compare 10, 100 e 1 000 m. Repita com a = 0 e b = 5 ppm.',
    answer: 'O erro de zero continua 5 mm em qualquer distância. O erro de 5 ppm corresponde a 0,05; 0,5 e 5 mm, respectivamente. Só coincidem em 1 km; tratá-los como equivalentes torna a correção errada nas demais distâncias.',
    sources: ['rueger', 'ngs']
  },
  {
    id: 'calibracao', nav: 'Calibração por MMQ', title: 'Recupere os erros a partir de uma base',
    summary: 'Simule distâncias de referência e observações com erro. Ajuste os parâmetros, examine os resíduos e compare uma base diversificada com uma base incapaz de separar os efeitos.',
    objective: 'Compare o ajuste de zero + escala com o modelo que também estima o erro cíclico.',
    theory: `<p>Uma calibração compara observações a referências com rastreabilidade e incerteza conhecida. A distribuição de comprimentos importa: uma única distância repetida melhora a repetibilidade, mas não separa zero de escala. O conjunto instrumento–prisma e as condições atmosféricas precisam ser registrados.</p>
      <div class="equation">yᵢ = 1000(D<sub>obs,i</sub> − D<sub>ref,i</sub>)<br>yᵢ = a + bDᵢ/1000 + α sin(2πDᵢ/U) + β cos(2πDᵢ/U) + εᵢ<br>x̂ = arg min Σ [(yᵢ − Xᵢx)/σᵢ]²</div>
      <p>As incógnitas são a e b, ou a, b, α e β. A forma seno–cosseno torna o modelo linear nos parâmetros: A = √(α² + β²). A amplitude simulada não é passada ao ajuste. O estimador recebe somente as distâncias, os erros observados, seus pesos e o período adotado.</p>
      <p>Os resíduos mostrados são r = y − Xx̂, isto é, observado menos modelado. Se preferirmos v = Xx̂ − y como correções às observações, v = −r. O número de graus de liberdade é ν = n − p e σ̂₀ = √[Σ(rᵢ/σᵢ)²/ν]. Um padrão nos resíduos sugere inadequação do modelo.</p>
      <p class="model-note">Dados sintéticos com referências exatas, ruído normal independente e pesos conhecidos. As incertezas dos parâmetros usam (XᵀWX)⁻¹, a priori; não incluem incerteza da base nem efeitos omitidos. O botão de nova realização muda somente o ruído. Não constitui certificado ou classificação normativa.</p>`,
    exerciseTitle: 'Resíduo pequeno comprova boa calibração?',
    exercise: 'Use amplitude cíclica de 3 mm, ruído zero e ajuste apenas zero + escala. Depois inclua o ciclo. Por fim, escolha a base com fases repetidas.',
    answer: 'Na base diversificada, o modelo incompleto deixa estrutura nos resíduos; o modelo completo recupera os parâmetros sem ruído. Na base com fases repetidas, os termos cíclicos se confundem com a constante ou desaparecem. O ajuste deve informar a falta de identificabilidade, mesmo que algum modelo mais simples apresente resíduos pequenos.',
    sources: ['ngs', 'rueger']
  },
  {
    id: 'atmosfera', nav: 'Primeira velocidade', title: 'A atmosfera altera a escala da medida',
    summary: 'O instrumento converte a propagação usando um índice configurado. Se o índice real do trajeto for diferente, a distância indicada terá um erro de escala.',
    objective: 'Compare o ar real com a configuração do instrumento e determine o sinal da correção necessária.',
    theory: `<p>A temperatura, a pressão, a composição do ar e a umidade influenciam o índice de refração. Para pulsos e modulação óptica é necessário tratar o índice de grupo apropriado, não substituir automaticamente por um índice de fase de interferometria.</p>
      <div class="equation">n<sub>g</sub> − 1 = (n<sub>ref</sub> − 1) (p/p<sub>ref</sub>) (T<sub>ref</sub>/T)<br>D<sub>ind</sub> = D · n<sub>real</sub>/n<sub>config</sub><br>c<sub>atm</sub> [ppm] = (n<sub>config</sub>/n<sub>real</sub> − 1) · 10⁶<br>D<sub>corr</sub> = D<sub>ind</sub>(1 + c<sub>atm</sub>·10⁻⁶)</div>
      <dl class="definitions"><dt>T [K]</dt><dd>Temperatura absoluta: t [°C] + 273,15.</dd><dt>p [hPa]</dt><dd>Pressão no local da observação; não a pressão reduzida ao nível do mar.</dd><dt>Referência</dt><dd>n<sub>ref</sub> = 1,00028; t<sub>ref</sub> = 15 °C; p<sub>ref</sub> = 1 013,25 hPa, escolhidos para o experimento.</dd></dl>
      <p>Ar mais quente, à mesma pressão, tem menor densidade e menor refratividade neste modelo. Mantida uma configuração mais fria, o instrumento indica uma distância menor e necessita de correção positiva. Perto da referência, 1 °C equivale aproximadamente a 1 ppm, não a uma regra exata para todas as condições.</p>
      <p class="model-note"><strong>Aproximação de gás seco, n − 1 proporcional a p/T.</strong> A banda óptica e a composição são fixas; umidade, dispersão detalhada e gradientes não são calculados aqui. Não é implementação das fórmulas Ciddor/IUGG nem correção homologada de um fabricante. A ausência de correção significa 0 ppm relativo à configuração adotada, e não 0 °C.</p>`,
    exerciseTitle: 'Corrigir duas vezes também introduz erro',
    exercise: 'Use D = 1 000 m, ar real a 25 °C e configuração a 15 °C, com pressões iguais. Depois iguale a configuração ao ar real. O que ocorreria se a primeira correção fosse aplicada novamente?',
    answer: 'Inicialmente é necessária uma correção positiva. Quando configuração e atmosfera coincidem, a correção residual é zero. Reaplicar a correção inicial a uma distância já corrigida introduziria um novo erro de escala.',
    sources: ['nist', 'ngs']
  },
  {
    id: 'trajeto', nav: 'Atmosfera ao longo da linha', title: 'Um termômetro representa todo o trajeto?',
    summary: 'A propagação acumula o efeito do índice ao longo da linha. Uma zona aquecida entre extremos com a mesma temperatura pode escapar de uma leitura feita apenas no instrumento.',
    objective: 'Aqueça o trecho intermediário e compare a medição no instrumento, nos extremos e ao longo da linha.',
    theory: `<p>Em um meio não homogêneo, o tempo de propagação depende da integral do índice sobre o caminho. Para três trechos retilíneos de mesmo comprimento, usados no experimento:</p>
      <div class="equation">Δt = (2/c₀) ∫ n<sub>g</sub>(s) ds<br>n̄<sub>g</sub> = (n₁ + n₂ + n₃)/3<br>D<sub>ind</sub> = D · n̄<sub>g</sub>/n<sub>sensor</sub></div>
      <p>A temperatura medida no início não necessariamente representa n̄<sub>g</sub>. A média das temperaturas também não produz, em geral, exatamente a média dos índices, porque n depende de 1/T. Medições distribuídas permitem aproximar a integral com pesos proporcionais ao comprimento de cada trecho.</p>
      <p>Este efeito ao longo do trajeto ainda pertence à modelagem da velocidade. Gradientes transversais também curvam o raio e alteram a geometria. Uma curva desenhada arbitrariamente não calcula a chamada segunda correção: seria necessário modelar o campo de índice, o traçado do raio e a redução geométrica adotada.</p>
      <p class="model-note">O experimento calcula somente a integral em três segmentos retos, sem traçado de raios, curvatura terrestre ou segunda correção geométrica. A pressão é uniforme e o mesmo modelo de gás seco da lição anterior é usado.</p>`,
    exerciseTitle: 'Dois extremos iguais, linha diferente',
    exercise: 'Defina 15 °C no primeiro e no último trecho e 35 °C no trecho central. Compare “Instrumento”, “Média dos extremos” e “Índice integrado”.',
    answer: 'Instrumento e extremos indicam 15 °C e não detectam a região central aquecida. Ambos deixam o mesmo erro. A opção integrada usa a média ponderada dos três índices e elimina o erro dentro deste modelo segmentado ideal. Isso não equivale a corrigir uma trajetória curva.',
    sources: ['ngs', 'nist']
  },
  {
    id: 'estacao', nav: 'Reduções na estação total', title: 'Distância inclinada não é distância horizontal',
    summary: 'A estação total combina a distância com a direção observada. O ângulo zenital e as alturas do instrumento e do alvo determinam a redução e o desnível entre os pontos do terreno.',
    objective: 'Altere o ângulo zenital e descubra onde a incerteza angular mais influencia cada componente.',
    theory: `<p>O EDM mede entre os centros instrumentais. Em um referencial local plano, com o ângulo zenital z contado a partir da vertical ascendente:</p>
      <div class="equation">H = S sin z<br>V = S cos z<br>Δh = hᵢ + V − hₐ</div>
      <dl class="definitions"><dt>S, H, V [m]</dt><dd>Distância inclinada, componente horizontal e componente vertical entre centros.</dd><dt>z [°]</dt><dd>0° para cima, 90° horizontal e 180° para baixo.</dd><dt>hᵢ, hₐ [m]</dt><dd>Altura do instrumento e altura do alvo sobre seus pontos do terreno.</dd></dl>
      <p>Para S = 100 m e z = 60°, H = 86,603 m e V = 50 m. Com hᵢ = 1,5 m e hₐ = 2 m, o desnível é +49,5 m. Uma diferença nas alturas desloca Δh, mas não altera a distância inclinada já observada.</p>
      <div class="equation">σ²<sub>H</sub> = sin²z · σ²<sub>S</sub> + S²cos²z · σ²<sub>z</sub><br>σ²<sub>V</sub> = cos²z · σ²<sub>S</sub> + S²sin²z · σ²<sub>z</sub></div>
      <p class="model-note">Propagação linear com erros independentes e σ<sub>z</sub> em radianos. As alturas são exatas neste experimento: σ<sub>Δh</sub> = σ<sub>V</sub>. Não estão incluídos centragem, nivelamento, curvatura, refração vertical, redução ao elipsoide ou projeção cartográfica. As alturas dos suportes no desenho são esquemáticas.</p>`,
    exerciseTitle: 'Onde a pontaria vertical pesa mais?',
    exercise: 'Use S = 1 000 m, σS = 2 mm e σz = 5″. Compare z = 90° com uma visada quase vertical. Depois altere apenas a altura do alvo.',
    answer: 'Na horizontal, o termo angular é máximo em V e nulo em H na aproximação de primeira ordem. Perto da vertical, ocorre o inverso. Em 1 km, 5″ correspondem a cerca de 24,24 mm na componente mais sensível. Aumentar hₐ em 0,5 m reduz Δh em 0,5 m.',
    sources: ['rueger']
  },
  {
    id: 'qualidade', nav: 'Repetibilidade e aplicações', title: 'Repetir melhora a precisão. E o viés?',
    summary: 'Uma série muito concentrada pode estar deslocada do valor de referência. Separe o desvio padrão de uma observação, a incerteza da média e um erro sistemático que persiste.',
    objective: 'Aumente o número de observações mantendo um viés fixo. Compare a dispersão individual e a posição da média.',
    theory: `<p>Considere observações independentes de uma distância estável, com viés b fixo e ruído ε de média zero. O valor verdadeiro é conhecido apenas porque esta é uma simulação:</p>
      <div class="equation">Dᵢ = D<sub>ref</sub> + b + εᵢ<br>E[D̄ − D<sub>ref</sub>] = b<br>σ<sub>D̄</sub> = σ/√n<br>s² = Σ(Dᵢ − D̄)²/(n − 1)</div>
      <p>A média reduz a componente aleatória independente, mas não elimina b. O desvio padrão amostral s descreve a dispersão das observações; s/√n estima o erro padrão da média sob as hipóteses adotadas. Não mede o viés desconhecido. Repetições correlacionadas tampouco seguem automaticamente a lei 1/√n.</p>
      <p>Nas aplicações, o caminho de medição muda. Estações totais e muitos scanners usam ida e volta; SLR e LLR também usam pulsos refletidos. No GNSS, a pseudodistância é uma observação de propagação unidirecional com termos de relógio, órbita e atmosfera: não se deve simplesmente transplantar o fator 1/2 do EDM.</p>
      <p class="model-note">Ruído normal independente com semente reproduzível. O viés é imposto, não estimado pela repetição. Certificação, rastreabilidade e adequação ao levantamento exigem avaliação que vai além deste experimento.</p>`,
    exerciseTitle: 'Cem medições eliminam uma constante errada?',
    exercise: 'Imponha viés de +5 mm e σ = 2 mm. Compare 4 e 100 observações. Por fim, use σ = 0 mantendo o viés.',
    answer: 'O erro padrão teórico da média passa de 1 mm para 0,2 mm, mas seu erro esperado permanece +5 mm. Com σ = 0, todas as observações coincidem e s = 0, embora todas estejam erradas em +5 mm. Boa repetibilidade não comprova ausência de erro sistemático.',
    sources: ['rueger', 'bipm']
  }
];

window.MEDLessonsEn = [
  {
    id: 'tempo', nav: 'Distance & time-of-flight', title: 'How does time transform into distance?',
    summary: 'The EDM observes signal propagation. The sought quantity is the one-way distance; the timer records the complete round trip to the target and back.',
    objective: 'Double the distance. Does the time double? How much does a 1 ns timing error shift the measured distance?',
    theory: `<p>Electronic distance measurement replaces physical chaining with time or phase observation. The Geodimeter and Tellurometer were milestones; modern instruments use phase or pulse methods tailored to range and target.</p>
      <p>For a straight path in a homogeneous medium, group velocity is <strong>v = c₀/n<sub>g</sub></strong>. The pulse travels 2D, therefore:</p>
      <div class="equation">Δt = 2n<sub>g</sub>D / c₀<br>D = c₀Δt / (2n<sub>g</sub>)<br>δD = c₀δt / (2n<sub>g</sub>)</div>
      <dl class="definitions"><dt>D [m]</dt><dd>One-way distance between instrument and target reference planes.</dd><dt>Δt [s]</dt><dd>Round-trip travel time, after compensating internal delays.</dd><dt>c₀ [m/s]</dt><dd>299 792 458 m/s, exact speed of light in vacuum.</dd><dt>n<sub>g</sub> [1]</dt><dd>Group refractive index; fixed at 1.00028 in this introductory lesson.</dd></dl>
      <p>At 100 m, the round trip takes approximately 667 ns. A 1 ns timing error corresponds to ~150 mm. This highlights why picosecond resolution, signal processing, and zero calibration are vital.</p>
      <p class="model-note">The screen animation is slowed down for visual clarity. Internal delays, target motion, and ray curvature are omitted here.</p>`,
    exerciseTitle: 'Why divide by two?',
    exercise: 'Set D = 300 m and timing error = 0. Calculate vΔt without dividing by 2. Then apply +0.1 ns and compare the error at 300 m vs 600 m.',
    answer: 'vΔt yields 600 m: the total round-trip distance. +0.1 ns produces approx. +15 mm in both distances. A fixed time delay is an additive error; it does not grow with distance.',
    sources: ['bipm', 'rueger']
  },
  {
    id: 'modulacao', nav: 'Carrier & modulation', title: 'What does the phase comparator observe?',
    summary: 'Light carries intensity modulation. The receiver extracts this modulation envelope and compares it against an internal reference; it does not directly count optical oscillations.',
    objective: 'Increase the modulation frequency and observe the trade-off between sensitivity and ambiguity.',
    theory: `<p>In amplitude modulation, an oscillator sets frequency f<sub>m</sub> modulating the optical carrier intensity. A photodetector converts returned light into an electrical signal to compare against the emitted reference.</p>
      <div class="equation">I(t) = I₀[1 + m cos(2πf<sub>m</sub>t)]<br>λ<sub>m</sub> = c₀ / (n<sub>g</sub>f<sub>m</sub>)<br>Δφ = (4πD / λ<sub>m</sub>) mod 2π<br>U = λ<sub>m</sub>/2</div>
      <dl class="definitions"><dt>m [1]</dt><dd>Intensity modulation depth (0 to 1).</dd><dt>f<sub>m</sub> [Hz]</dt><dd>Modulation frequency, in MHz.</dd><dt>λ<sub>m</sub> [m]</dt><dd>Modulation wavelength in the medium (distinct from optical wavelength).</dd><dt>U [m]</dt><dd>Unit length (one-way distance corresponding to one full 360° phase cycle).</dd></dl>
      <p>The lower plot shows the normalized, demodulated signals. Δφ is the phase delay between 0° and 360°. For a phase uncertainty σ<sub>φ</sub>, distance precision is σ<sub>D</sub> = Uσ<sub>φ</sub>/360°. Higher f<sub>m</sub> shortens U and improves precision, but brings ambiguous candidates closer together. At m = 0, no modulation phase can be observed.</p>
      <p class="model-note">Optical waves are not drawn to scale. The graph represents the demodulated modulation envelope.</p>`,
    exerciseTitle: 'Does high frequency solve everything?',
    exercise: 'Compare 15 MHz and 30 MHz at constant D. What happens to U and the distance equivalent to 0.01°? Then set modulation depth to zero.',
    answer: 'Doubling the frequency halves U and halves the distance equivalent to 0.01°, doubling sensitivity but halving the unambiguous interval. At m = 0, light is unmodulated: no phase can be determined.',
    sources: ['rueger', 'nist']
  },
  {
    id: 'fase', nav: 'Resolving ambiguity', title: 'One phase, many candidate distances',
    summary: 'A single frequency determines only the fractional part of U. To find the full distance, the integer cycle count N must be determined. Combine frequencies to eliminate false candidates.',
    objective: 'Start with one frequency and activate the others. Discover why knowing the declared search range is part of the solution.',
    theory: `<p>Phase alone does not indicate how many complete cycles occurred over the round trip. The instrument measures position within a cycle, not absolute distance:</p>
      <div class="equation">2D = λ<sub>m</sub>(N + Δφ/360°)<br>D = U(N + Δφ/360°)<br>r = UΔφ/360°; D<sub>N</sub> = NU + r</div>
      <dl class="definitions"><dt>N [integer]</dt><dd>Number of full modulation cycles along the 2D path.</dd><dt>r [m]</dt><dd>Remainder after dividing distance by U.</dd><dt>U [m]</dt><dd>Unit length: 10, 100, 1 000, and 10 000 m in this lab.</dd></dl>
      <p>For D = 3 123.456 m with U = 10 m: N = 312, r = 3.456 m, Δφ = 124.416°. But 3.456, 13.456, and 23.456 m yield identical phase. Coarser frequencies remove candidates until a unique distance remains within the search range.</p>
      <p class="model-note">Ideal readings without noise. The search interval is [0, range). Frequencies are harmonized decimals. Real instruments use proprietary frequency schemes and phase tolerances.</p>`,
    exerciseTitle: 'Can the same phase set have two solutions?',
    exercise: 'Enable all frequencies and change search range from 10 km to 20 km. Then try the blind challenge without looking at the reference distance.',
    answer: 'Yes. Because the unit lengths divide 10,000 m, D and D + 10,000 m produce identical phase sets. In [0, 10 km) there is 1 solution; in [0, 20 km) there are 2. Knowing the unambiguous range is part of solving the ambiguity.',
    sources: ['rueger']
  },
  {
    id: 'alvos', nav: 'Targets & return signal', title: 'How much signal returns?',
    summary: 'A retroreflector prism returns light back along the incidence axis. A diffuse surface scatters energy in all directions; reflectance, incidence angle, and distance govern received power.',
    objective: 'Isolate the distance effect, then tilt the surface. Relate received signal to measurement reliability.',
    theory: `<p>A corner-cube prism uses three mutually perpendicular reflective faces to return incoming rays antiparallel to the incidence direction within its acceptance aperture.</p>
      <p>In reflectorless mode, the beam scatters from a natural surface. Under an ideal Lambertian model:</p>
      <div class="equation">S<sub>rel</sub> = ρ cos(i) (100 m / D)²</div>
      <dl class="definitions"><dt>ρ [1]</dt><dd>Surface reflectance (0 to 1).</dd><dt>i [°]</dt><dd>Angle of incidence to surface normal.</dd><dt>S<sub>rel</sub> [1]</dt><dd>Signal relative to a white normal surface at 100 m.</dd></dl>
      <p>At an edge or corner, the beam may split across two targets at different distances; sufficient return signal does not guarantee measuring the intended feature.</p>
      <p class="model-note">Prisms and diffuse targets are not quantitatively compared with the same equation. Wet surfaces, glass, and specular metals violate Lambertian assumptions.</p>`,
    exerciseTitle: 'Is weak signal just noise?',
    exercise: 'At 100 m, set ρ = 0.8 and i = 0°. Then set 200 m and i = 60°. What is the ratio between returns? Would the model detect a split beam?',
    answer: 'The first return is 0.8 and the second is 0.1: distance divides by 4 and tilt divides by 2, yielding 1/8 the initial power. The model assumes a single planar target; split-beam edge situations require field inspection.',
    sources: ['leica', 'rueger']
  },
  {
    id: 'erros', nav: 'Errors & specifications', title: 'Isolating error signatures',
    summary: 'Constant offsets, scale errors, and periodic oscillations leave distinct signatures vs distance. Toggle each component and compare orders of magnitude.',
    objective: 'Identify which error component dominates on short lines vs long lines.',
    theory: `<p>We define error e = D<sub>obs</sub> − D<sub>ref</sub>. A positive error means the measured distance is too long. The applied correction has the opposite sign:</p>
      <div class="equation">e(D) = a + bD/1000 + A sin(2πD/U + ψ) + k<br>D<sub>corr</sub> ≈ D<sub>obs</sub> − e(D<sub>obs</sub>)/1000</div>
      <dl class="definitions"><dt>a, k [mm]</dt><dd>System zero error and residual prism constant.</dd><dt>b [ppm]</dt><dd>Scale error: 1 ppm = 1 mm per km.</dd><dt>A [mm], ψ [°]</dt><dd>Cyclic error amplitude and phase; U is the cyclic wavelength (unit length).</dd></dl>
      <p>Scale error stems from oscillator drift and uncorrected atmospheric index. Cyclic error arises from optical-electrical cross-talk inside the comparator. The additive constant encompasses internal optical paths, electronics, and the reflector offset.</p>
      <p>Instrument specification ±(a<sub>nom</sub> mm + b<sub>nom</sub> ppm) defines manufacturer bounds (e.g. ±(2 mm + 2 ppm) = ±3 mm at 500 m).</p>
      <p class="model-note">A single sine wave models fundamental cyclic error. In rigorous calibration, sign conventions and full observation equations must be declared.</p>`,
    exerciseTitle: 'Can 5 mm become 5 ppm?',
    exercise: 'Zero all components, set a = 5 mm, and check 10, 100, and 1,000 m. Repeat with a = 0 and b = 5 ppm.',
    answer: 'Zero error remains 5 mm at all distances. 5 ppm corresponds to 0.05 mm at 10 m, 0.5 mm at 100 m, and 5 mm at 1 km. They only match at 1 km; treating them as interchangeable leads to incorrect corrections.',
    sources: ['rueger', 'ngs']
  },
  {
    id: 'calibracao', nav: 'Least-squares calibration', title: 'Recovering errors on a baseline',
    summary: 'Simulate baseline reference distances and noisy observations. Estimate parameters, inspect residuals, and compare a diverse baseline against an unidentifiable layout.',
    objective: 'Compare a zero + scale fit with a model that also estimates cyclic error.',
    theory: `<p>Calibration compares observed distances against certified baseline lengths. Geometry matters: repeating a single distance improves precision but cannot decouple zero from scale.</p>
      <div class="equation">yᵢ = 1000(D<sub>obs,i</sub> − D<sub>ref,i</sub>)<br>yᵢ = a + bDᵢ/1000 + α sin(2πDᵢ/U) + β cos(2πDᵢ/U) + εᵢ<br>x̂ = arg min Σ [(yᵢ − Xᵢx)/σᵢ]²</div>
      <p>Linearizing cyclic error as α sin + β cos gives A = √(α² + β²). The estimator receives only observed errors, distances, weights, and unit length U.</p>
      <p>Residuals are r = y − Xx̂ (observed minus modeled). Degree of freedom is ν = n − p, and reference variance is σ̂₀ = √[Σ(rᵢ/σᵢ)²/ν]. Systematic trends in residuals reveal unmodeled effects.</p>
      <p class="model-note">Synthetic data with exact references, normal independent noise, and known weights. Parameter uncertainties reflect (XᵀWX)⁻¹ a priori.</p>`,
    exerciseTitle: 'Do small residuals prove good calibration?',
    exercise: 'Use 3 mm cyclic amplitude, zero noise, and fit only zero + scale. Then include cyclic terms. Finally, select the locked-phase baseline.',
    answer: 'On a diverse baseline, the incomplete model leaves clear wave structure in residuals; the full model recovers all parameters. On locked phases, cyclic terms become collinear with zero error. A fit must check parameter estimability, not just residual size.',
    sources: ['ngs', 'rueger']
  },
  {
    id: 'atmosfera', nav: 'First velocity correction', title: 'Atmosphere scales the measurement',
    summary: 'The instrument scales propagation using a programmed refractive index. If the real line index differs, an atmospheric scale error occurs.',
    objective: 'Compare actual air with instrument settings and determine the sign of the required correction.',
    theory: `<p>Temperature, pressure, and humidity alter air refractivity. For optical pulses and modulation envelopes, group index n<sub>g</sub> must be used, not phase index.</p>
      <div class="equation">n<sub>g</sub> − 1 = (n<sub>ref</sub> − 1) (p/p<sub>ref</sub>) (T<sub>ref</sub>/T)<br>D<sub>ind</sub> = D · n<sub>real</sub>/n<sub>set</sub><br>c<sub>atm</sub> [ppm] = (n<sub>set</sub>/n<sub>real</sub> − 1) · 10⁶<br>D<sub>corr</sub> = D<sub>ind</sub>(1 + c<sub>atm</sub>·10⁻⁶)</div>
      <dl class="definitions"><dt>T [K]</dt><dd>Absolute temperature: t [°C] + 273.15.</dd><dt>p [hPa]</dt><dd>Ambient atmospheric pressure at the setup (not sea-level reduced).</dd><dt>Reference</dt><dd>n<sub>ref</sub> = 1.00028, t<sub>ref</sub> = 15 °C, p<sub>ref</sub> = 1013.25 hPa.</dd></dl>
      <p>Warmer air at constant pressure is less dense, with lower refractivity. If the instrument is set for cooler air, it underestimates distance and requires a positive ppm correction (~1 ppm/°C near reference).</p>
      <p class="model-note">Dry air approximation (n − 1 ∝ p/T). Humidity and dispersion are not modeled. 0 ppm means zero correction relative to instrument setting, not 0 °C.</p>`,
    exerciseTitle: 'Double correction also introduces error',
    exercise: 'Set D = 1,000 m, real air at 25 °C, setting at 15 °C (equal pressures). Then match setting to real air. What happens if the initial correction is applied again?',
    answer: 'Initially, a positive correction is required. Once the instrument is correctly configured for ambient air, residual correction is 0 ppm. Reapplying the initial correction to already corrected data introduces a false scale error.',
    sources: ['nist', 'ngs']
  },
  {
    id: 'trajeto', nav: 'Atmosphere along the path', title: 'Does one thermometer represent the path?',
    summary: 'Travel time integrates refractive index along the line. A warm pocket between identical endpoints will be missed by measuring only at the instrument.',
    objective: 'Heat the middle section and compare measurements at the instrument, endpoints average, and integrated along the line.',
    theory: `<p>In a heterogeneous atmosphere, transit time is the line integral of index along the ray path:</p>
      <div class="equation">Δt = (2/c₀) ∫ n<sub>g</sub>(s) ds<br>n̄<sub>g</sub> = (n₁ + n₂ + n₃)/3<br>D<sub>ind</sub> = D · n̄<sub>g</sub>/n<sub>sensor</sub></div>
      <p>Temperature at the instrument does not necessarily represent the path average n̄<sub>g</sub>. Nor does the mean of temperatures equal the mean of indices, since n depends on 1/T. Distributed measurements allow approximating the path integral with length-weighted segments.</p>
      <p>Transverse gradients also bend the ray path (requiring the geometric second velocity correction in geodetic lines).</p>
      <p class="model-note">Three equal straight segments, dry air, uniform pressure. Ray curvature and second velocity correction are omitted.</p>`,
    exerciseTitle: 'Identical endpoints, different line',
    exercise: 'Set 15 °C at both endpoints and 35 °C in the middle. Compare "Instrument", "Endpoints average", and "Integrated index".',
    answer: 'Both instrument and endpoint averages read 15 °C, missing the warm central zone and leaving an uncorrected scale error. The integrated index properly weights all segments and eliminates the error in this model.',
    sources: ['ngs', 'nist']
  },
  {
    id: 'estacao', nav: 'Total station reductions', title: 'Slope distance vs horizontal distance',
    summary: 'A total station combines slope distance with zenith angle. Instrument and target heights determine horizontal reduction and elevation difference between ground marks.',
    objective: 'Change zenith angle and observe where angular uncertainty has the greatest impact.',
    theory: `<p>EDM measures between optical centers. In a topocentric Cartesian frame, with zenith angle z from the upward vertical:</p>
      <div class="equation">H = S sin z<br>V = S cos z<br>Δh = hᵢ + V − hₐ</div>
      <dl class="definitions"><dt>S, H, V [m]</dt><dd>Slope distance, horizontal distance, and vertical distance between centers.</dd><dt>z [°]</dt><dd>Zenith angle: 0° zenith, 90° horizontal, 180° nadir.</dd><dt>hᵢ, hₐ [m]</dt><dd>Instrument height and target height above ground marks.</dd></dl>
      <p>For S = 100 m, z = 60°: H = 86.603 m, V = 50.000 m. With hᵢ = 1.5 m, hₐ = 2.0 m, ground Δh = +49.5 m.</p>
      <div class="equation">σ²<sub>H</sub> = sin²z · σ²<sub>S</sub> + S²cos²z · σ²<sub>z</sub><br>σ²<sub>V</sub> = cos²z · σ²<sub>S</sub> + S²sin²z · σ²<sub>z</sub></div>
      <p class="model-note">Linear propagation with independent errors (σ<sub>z</sub> in radians). Earth curvature, refraction, and projection reductions are omitted.</p>`,
    exerciseTitle: 'Where does pointing error weigh more?',
    exercise: 'Set S = 1,000 m, σS = 2 mm, σz = 5″. Compare z = 90° with a steep sight. Then change only target height.',
    answer: 'Near horizontal (z = 90°), angular error affects V maximally (~24.2 mm at 1 km) and has zero first-order impact on H. Near vertical, the reverse occurs. Changing target height shifts ground Δh directly without altering measured slope distance S.',
    sources: ['rueger']
  },
  {
    id: 'qualidade', nav: 'Repeatability & bias', title: 'Repetition improves precision, not bias',
    summary: 'A tight cluster of measurements can still be biased. Distinguish single-shot standard deviation, standard error of the mean, and persistent systematic error.',
    objective: 'Increase sample count n while keeping a fixed bias. Observe individual scatter vs mean position.',
    theory: `<p>Consider independent observations of a stable baseline with fixed bias b and zero-mean noise ε:</p>
      <div class="equation">Dᵢ = D<sub>ref</sub> + b + εᵢ<br>E[D̄ − D<sub>ref</sub>] = b<br>σ<sub>D̄</sub> = σ/√n<br>s² = Σ(Dᵢ − D̄)²/(n − 1)</div>
      <p>Averaging reduces independent random noise by 1/√n, but leaves systematic bias b completely untouched. Sample standard deviation s quantifies scatter; s/√n quantifies mean precision, not accuracy.</p>
      <p>Different technologies use different propagation paths: total stations and terrestrial scanners use two-way EDM; satellite laser ranging (SLR) uses two-way pulses; GNSS pseudorange is one-way with satellite and receiver clock terms (where the 1/2 factor does not apply).</p>
      <p class="model-note">Independent Gaussian noise with reproducible pseudo-random seed. Systematic bias is an injected constant.</p>`,
    exerciseTitle: 'Does averaging 100 shots eliminate a constant error?',
    exercise: 'Inject a +5 mm bias and σ = 2 mm. Compare 4 vs 100 observations. Then set σ = 0 with the same bias.',
    answer: 'Standard error of the mean drops from 1 mm to 0.2 mm, but expected error remains +5 mm. With σ = 0, all shots are identical and s = 0, yet all are wrong by +5 mm. High repeatability does not prove absence of systematic error.',
    sources: ['rueger', 'bipm']
  }
];

window.MEDLessons = window.MEDLessonsPt;
