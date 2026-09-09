# Medida Eletrônica de Distâncias — fundamentos e modelos

Este texto acompanha os dez experimentos de `med/index.html`. Cada tópico da apresentação contém uma explicação, equações, unidades, hipóteses e uma investigação com resposta comentada. Os dados são sintéticos e os modelos são didáticos; não são procedimentos de certificação instrumental.

## 1. Distância e tempo de voo

A medição eletrônica determina uma distância por observações da propagação de ondas eletromagnéticas. Em vez de transportar sucessivamente um padrão material ao longo da linha, mede-se uma grandeza relacionada ao tempo ou à fase do sinal. O Geodímetro, com luz, e o Telurômetro, com micro-ondas, foram marcos do desenvolvimento da técnica. Hoje o princípio, a fonte e o processamento dependem do instrumento e do modo de medição.

Para um caminho retilíneo, com índice de grupo homogêneo e alvo parado:

\[
v_g=\frac{c_0}{n_g},\qquad \Delta t=\frac{2n_gD}{c_0},\qquad D=\frac{c_0\Delta t}{2n_g}.
\]

- \(D\): distância de ida em metros;
- \(\Delta t\): tempo de ida e volta em segundos, descontados os atrasos internos;
- \(c_0=299\,792\,458\ \mathrm{m/s}\): velocidade da luz no vácuo, exata no SI;
- \(n_g\): índice de grupo, adimensional.

O fator 2 decorre da geometria da observação. Um atraso de 1 ns corresponde a aproximadamente 150 mm na distância. Em 100 m, a propagação de ida e volta leva aproximadamente 667 ns. A animação desacelerada não representa a velocidade física na tela. A relação do metro com a velocidade da luz é documentada pelo [BIPM](https://www.bipm.org/documents/20126/41489670/SI-App2-metre.pdf).

## 2. Portadora, modulação e comparação

Na modulação de intensidade adotada como exemplo:

\[
I(t)=I_0[1+m\cos(2\pi f_mt)],\quad
\lambda_m=\frac{c_0}{n_gf_m},\quad
U=\frac{\lambda_m}{2}.
\]

O oscilador define a modulação \(f_m\); a fonte produz a portadora óptica. O fotodetector extrai um sinal elétrico do retorno para comparação com uma referência. O comprimento de onda óptico, normalmente expresso em nanômetros, não é o comprimento espacial da modulação \(\lambda_m\), aqui expresso em metros. Tampouco a frequência de modulação é a frequência óptica.

No modelo, a fase de atraso é

\[
\Delta\varphi=\left(\frac{4\pi D}{\lambda_m}\right)\bmod 2\pi.
\]

Para uma incerteza de fase expressa em graus, \(\sigma_D=U\sigma_\varphi/360\). Aumentar a frequência reduz a distância equivalente a uma mesma incerteza angular, mas também reduz o intervalo de ambiguidade. Em profundidade de modulação \(m=0\), não há fase de modulação observável. O gráfico normaliza a amplitude do retorno e não representa perdas radiométricas.

## 3. Ambiguidade e múltiplas frequências

A fase revela apenas a fração do ciclo. Para recuperar a distância, falta o inteiro \(N\):

\[
2D=\lambda_m\left(N+\frac{\Delta\varphi}{360^\circ}\right),\qquad
D=U\left(N+\frac{\Delta\varphi}{360^\circ}\right).
\]

A grandeza \(r=U\Delta\varphi/360^\circ\) é um resto **da distância de ida em U**, não em \(\lambda_m\). Para \(D=3123{,}456\) m e \(U=10\) m:

\[
N=312,\quad r=3{,}456\ \mathrm{m},\quad\Delta\varphi=124{,}416^\circ.
\]

O mesmo valor de fase é compatível com 3,456 m, 13,456 m, 23,456 m etc. O simulador enumera os candidatos associados à menor unidade ativa e verifica suas diferenças circulares de fase nas demais frequências. O algoritmo recebe somente as leituras e o intervalo de busca, sem consultar a distância simulada.

| U (m) | λ da modulação (m) | Resto de D (m) | Fase (°) |
|---:|---:|---:|---:|
| 10 | 20 | 3,456 | 124,416 |
| 100 | 200 | 23,456 | 84,4416 |
| 1 000 | 2 000 | 123,456 | 44,44416 |
| 10 000 | 20 000 | 3 123,456 | 112,444416 |

Dentro de \([0,10000)\) m, a ativação sucessiva dessas unidades reduz os candidatos de 1 000 para 100, 10 e 1. Em \([0,20000)\) m, permanecem duas soluções mesmo com as quatro frequências. O limite superior é excluído. Os controles ilustram frequências harmonizadas com fases ideais, sem ruído; estratégias reais também precisam tratar tolerâncias e possíveis erros de identificação do inteiro. A concatenação de algarismos não é uma formulação geral do método.

## 4. Alvos e retorno do sinal

Um prisma de canto de cubo favorece o retorno aproximadamente antiparalelo à direção incidente dentro de sua abertura útil. Há perdas, divergência e limitações de orientação: retroreflexão não equivale a recuperar integralmente a energia emitida.

A superfície difusa espalha energia em várias direções. Para investigar uma única dependência por vez, adota-se o modelo relativo de uma superfície lambertiana:

\[
S_\mathrm{rel}=\rho\cos i\left(\frac{100\ \mathrm{m}}{D}\right)^2.
\]

A reflectância \(\rho\) varia de 0 a 1; \(i\) é a incidência à normal da superfície. A potência interceptada, a abertura receptora e os demais fatores são mantidos fixos. \(S_\mathrm{rel}=1\) corresponde a uma superfície branca, normal à visada, a 100 m. Não é uma previsão de alcance nem uma comparação quantitativa com prismas.

Em 100 m, com \(\rho=0{,}8\) e incidência normal, o retorno é 0,8. Em 200 m e 60°, ele é 0,1. Quinas, materiais especulares, superfícies molhadas e alvos parcialmente obstruídos exigem outros modelos e cuidados. O desempenho com e sem prisma depende das condições de ensaio e do modo do aparelho, como explicitado em [especificações do fabricante](https://leica-geosystems.com/-/media/files/leicageosystems/products/datasheets/leica_icon_robot_50_ds.ashx?sc_lang=en).

## 5. Erro de zero, escala, ciclo e prisma

Adota-se a convenção **erro = observado − referência**. A correção tem sinal oposto. Com \(D\) em metros, o modelo em milímetros é:

\[
e(D)=a+\frac{bD}{1000}+A\sin\left(\frac{2\pi D}{U}+\psi\right)+k.
\]

- \(a\): componente aditiva em mm;
- \(b\): fator de escala em ppm;
- \(A\): amplitude cíclica em mm, \(\psi\) sua fase;
- \(U\): período do erro em distância;
- \(k\): erro residual de configuração do prisma, em mm.

A componente aditiva efetiva envolve o conjunto instrumento–refletor e caminhos internos; não corresponde apenas ao deslocamento físico do emissor. A frequência de **modulação** usada como referência pode afetar a escala. A atmosfera também produz efeitos proporcionais. A constante de prisma exige observar a convenção do fabricante; o controle \(k\) não representa um valor universal dessa constante.

**1 ppm = 1 mm/km.** Portanto, 5 ppm geram 0,05 mm em 10 m, 0,5 mm em 100 m e 5 mm em 1 000 m. Um erro aditivo de 5 mm permanece 5 mm nas três distâncias.

A especificação nominal \(\pm(a_\mathrm{nom}\ \mathrm{mm}+b_\mathrm{nom}\ \mathrm{ppm})\) deve ser interpretada conforme o fabricante. Ela não é automaticamente uma incerteza padrão, um intervalo de 95% ou uma soma quadrática de componentes independentes. Uma faixa nominal de 2 mm + 2 ppm corresponde a 3 mm em 500 m.

## 6. Calibração por mínimos quadrados

A calibração usa referências e condições de observação documentadas, com rastreabilidade e incerteza. A escolha de comprimentos determina quais efeitos podem ser separados. A documentação do [NGS sobre bases de calibração](https://geodesy.noaa.gov/library/pdfs/NOAA_TM_NOS_NGS_0008.pdf) descreve a necessidade de registrar instrumento, refletor, meteorologia e referências.

No experimento, as referências são exatas e cada observação produz:

\[
y_i=1000(D_{\mathrm{obs},i}-D_{\mathrm{ref},i}).
\]

Ajustam-se duas ou quatro incógnitas:

\[
y_i=a+bD_i/1000+\alpha\sin(2\pi D_i/U)+\beta\cos(2\pi D_i/U)+\varepsilon_i,
\]

\[
\hat{x}=\arg\min_x\sum_i\left(\frac{y_i-X_ix}{\sigma_i}\right)^2,
\qquad A=\sqrt{\alpha^2+\beta^2}.
\]

O código resolve o sistema por QR com reortogonalização. O ajuste não recebe os parâmetros usados pelo gerador. O período U = 20 m é considerado conhecido. A fase geradora é 30°; no modelo completo, a fase é absorvida pelos coeficientes seno e cosseno.

A tabela usa resíduos \(r=y-X\hat{x}\). Se as correções às observações forem escritas como \(v=X\hat{x}-y\), então \(v=-r\). Com n observações e p parâmetros:

\[
\nu=n-p,\qquad \hat\sigma_0=\sqrt{\frac{\sum_i(r_i/\sigma_i)^2}{\nu}}.
\]

As incertezas padrão mostradas derivam da covariância a priori \((X^TWX)^{-1}\), com \(W=\mathrm{diag}(1/\sigma_i^2)\). Com ruído gerado nulo, adota-se σ = 1 mm como peso de referência, identificado na interface. Esse valor não é uma estimativa da dispersão de dados sem ruído.

Há quatro bases: diversificada, comprimentos próximos, fases repetidas e uma distância repetida. A última não separa zero de escala; fases repetidas não permitem identificar o modelo cíclico completo. A interface informa a falta de identificabilidade em vez de produzir valores arbitrários. Comprimentos próximos podem admitir solução numérica, mas com incertezas elevadas e forte correlação. Um pequeno resíduo, isoladamente, não comprova boa calibração.

A série é reproduzível por semente. O CSV registra observações, pesos e cenário para trabalho posterior. Não inclui uma certificação nem incerteza da base.

## 7. Atmosfera e primeira velocidade

O índice relevante depende da forma de observação. O [NIST distingue explicitamente índice de fase e de grupo](https://emtoolbox.nist.gov/Wavelength/Documentation.asp): um cálculo para interferometria não deve ser aplicado automaticamente à propagação de modulação ou pulsos.

Para ensinar a relação entre densidade e refratividade sem simular uma correção homologada, usa-se a aproximação de gás seco:

\[
n_g-1=(n_\mathrm{ref}-1)\frac{p}{p_\mathrm{ref}}\frac{T_\mathrm{ref}}{T},
\]

com \(n_\mathrm{ref}=1{,}00028\), \(T_\mathrm{ref}=288{,}15\) K e \(p_\mathrm{ref}=1013{,}25\) hPa. T é absoluta; p é a pressão no local, sem redução ao nível do mar.

Se o índice real diferir do configurado:

\[
D_\mathrm{ind}=D\frac{n_\mathrm{real}}{n_\mathrm{config}},\qquad
c_\mathrm{atm}=10^6\left(\frac{n_\mathrm{config}}{n_\mathrm{real}}-1\right),
\]

\[
D_\mathrm{corr}=D_\mathrm{ind}(1+c_\mathrm{atm}10^{-6}).
\]

Ar real mais quente, com pressão fixa e configuração mantida, reduz a distância indicada neste modelo: a correção necessária é positiva. Se ar e configuração coincidirem, a correção residual é zero. Isso não equivale a configurar 0 °C. Reaplicar uma correção já incorporada introduz erro.

**Limite do experimento:** banda óptica e composição fixas; sem umidade, dispersão detalhada ou gradientes. Não é uma implementação Ciddor/IUGG nem fórmula operacional de uma estação total. Instrumentos reais precisam do modelo adequado ao equipamento e de medições meteorológicas compatíveis com a precisão pretendida.

## 8. Integração ao longo do trajeto e segunda correção

A propagação em um meio variável exige uma integral ao longo do caminho:

\[
\Delta t=\frac{2}{c_0}\int n_g(s)\,ds.
\]

No experimento, a linha é dividida em três segmentos retos de comprimentos iguais:

\[
\bar n_g=(n_1+n_2+n_3)/3,\quad
D_\mathrm{ind}=D\bar n_g/n_\mathrm{sensor}.
\]

Um trecho central aquecido pode não ser detectado nem pelo termômetro no instrumento nem pela média das temperaturas dos extremos. A média de temperaturas também não é exatamente equivalente à média dos índices, devido à dependência não linear de n com T. Em trechos de comprimentos diferentes, os índices devem ser ponderados pelo comprimento.

**Não confundir duas questões:** representar a velocidade ao longo de uma linha e modelar o desvio geométrico do raio. Gradientes transversais podem curvar a trajetória, o que exige um campo de índices, traçado de raios e uma redução geométrica bem definida. O simulador calcula somente a integral em três segmentos retos; não calcula a segunda correção geométrica nem usa uma curva ilustrativa como se fosse uma solução física.

## 9. Estação total e propagação de incerteza

A distância inclinada S é observada entre os centros do instrumento e do alvo. Em geometria local plana, com z contado desde a vertical ascendente:

\[
H=S\sin z,\qquad V=S\cos z,\qquad \Delta h=h_i+V-h_a.
\]

Para S = 100 m, z = 60°, hi = 1,5 m e ha = 2 m: H ≈ 86,603 m, V = 50 m e Δh = 49,5 m.

Com erros pequenos, independentes, e σz expresso em radianos:

\[
\sigma_H^2=\sin^2z\,\sigma_S^2+S^2\cos^2z\,\sigma_z^2,
\]

\[
\sigma_V^2=\cos^2z\,\sigma_S^2+S^2\sin^2z\,\sigma_z^2.
\]

A interface recebe σz em segundos de arco e converte para radianos. Para 1 km e 5″, a contribuição angular máxima é aproximadamente 24,24 mm. Em uma visada horizontal ela atua em V; perto da vertical, atua em H.

As alturas são exatas neste modelo, portanto σΔh = σV. Não se incluem centragem, nivelamento, curvatura terrestre, refração vertical, incertezas das alturas, redução ao elipsoide ou projeção. O resultado H é uma componente horizontal local, não automaticamente uma distância de quadrícula.

## 10. Repetibilidade, viés e aplicações

Para observações independentes, com viés b e erro aleatório de média zero:

\[
D_i=D_\mathrm{ref}+b+\varepsilon_i,\qquad
E[\bar D-D_\mathrm{ref}]=b,\qquad
\sigma_{\bar D}=\sigma/\sqrt n.
\]

O desvio padrão amostral s estima a dispersão de uma observação; s/√n estima o erro padrão da média sob essas hipóteses. Nenhum dos dois quantifica um viés desconhecido apenas por repetição. Se b = 5 mm e σ = 0, todas as observações coincidem e estão erradas em 5 mm. Repetições correlacionadas não seguem automaticamente a redução 1/√n.

A simulação usa ruído normal com semente conhecida. Alterar n preserva o início da mesma série; “Nova série” troca a realização. Assim, a comparação não se confunde com uma mudança de todos os números aleatórios a cada controle.

Estações totais, scanners e sistemas SLR/LLR compartilham princípios de propagação, embora usem técnicas e requisitos próprios. GNSS observa propagação unidirecional e inclui termos de relógio, órbita e atmosfera nas pseudodistâncias. Não é o mesmo modelo de ida e volta de um EDM.

## Referências para aprofundamento

- RÜEGER, J. M. *Electronic Distance Measurement: An Introduction*. Springer, 1996. [DOI e registro editorial](https://doi.org/10.1007/978-3-642-80233-1). Referência geral para princípios, instrumentação e erros; as equações e os exemplos numéricos acima são desenvolvidos para este material.
- NATIONAL GEODETIC SURVEY. *Establishment of Calibration Base Lines*. [Documento técnico](https://geodesy.noaa.gov/library/pdfs/NOAA_TM_NOS_NGS_0008.pdf). Condições, documentação e referências para bases instrumentais.
- STONE, J. A.; ZIMMERMAN, J. H. *Index of Refraction of Air*. NIST Engineering Metrology Toolbox. [Documentação](https://emtoolbox.nist.gov/Wavelength/Documentation.asp). Distinção entre índice de fase e de grupo e dependências ambientais.
- BIPM. *Mise en pratique for the definition of the metre in the SI*. [Documento](https://www.bipm.org/documents/20126/41489670/SI-App2-metre.pdf).
- LEICA GEOSYSTEMS. *Leica iCON robot 50 — datasheet*. [Especificações e condições de ensaio](https://leica-geosystems.com/-/media/files/leicageosystems/products/datasheets/leica_icon_robot_50_ds.ashx?sc_lang=en).

O texto não estabelece classificação normativa ou conformidade de um aparelho com a NBR 13133. Essas conclusões exigem requisitos, procedimentos e evidências específicos.
