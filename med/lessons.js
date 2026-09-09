/* The ten lessons follow the ten paragraphs of the original teoria.md.
 * Authored explanations, definitions, model limits and instructor prompts. */
window.MEDSources = {
  rueger: { label: 'Rüeger · Electronic Distance Measurement', url: 'https://doi.org/10.1007/978-3-642-80233-1' },
  ngs: { label: 'NGS · Establishment of Calibration Base Lines', url: 'https://geodesy.noaa.gov/library/pdfs/NOAA_TM_NOS_NGS_0008.pdf' },
  nist: { label: 'NIST · índice de fase e índice de grupo', url: 'https://emtoolbox.nist.gov/Wavelength/Documentation.asp' },
  bipm: { label: 'BIPM · realização do metro', url: 'https://www.bipm.org/documents/20126/41489670/SI-App2-metre.pdf' },
  leica: { label: 'Leica · condições de medição com e sem prisma', url: 'https://leica-geosystems.com/-/media/files/leicageosystems/products/datasheets/leica_icon_robot_50_ds.ashx?sc_lang=en' }
};
window.MEDLessons = [
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
