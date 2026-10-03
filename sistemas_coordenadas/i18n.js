// ============================================
// i18n Dictionary for Sistemas de Coordenadas
// ============================================

export const i18n = {
    ui: {
        pt: {
            pageTitle: 'Sistemas de Coordenadas — Simulador Didático de Geodésia',
            pageDesc: 'Simulador didático interativo dos sistemas de coordenadas fundamentais para Geodésia: Geodésicas, Esféricas, Astronômicas, ECEF, ENU e Plano Topográfico Local.',
            backToPortal: '← Portal',
            portalTitle: 'Voltar ao Portal Monorepo',
            appTitle: 'Sistemas de Coordenadas',
            appSubtitle: 'Geodésia Fundamental',
            sidebarFooter: 'Explore os sistemas de coordenadas fundamentais utilizados na Geodésia e suas relações.',
            tabConcept: 'Conceito',
            tabHow: 'Como Funciona',
            tabInteract: 'Interação',
            togglePanelTitle: 'Expandir / Recolher painel'
        },
        en: {
            pageTitle: 'Coordinate Systems — Educational Geodesy Simulator',
            pageDesc: 'Interactive educational simulator for fundamental coordinate systems in Geodesy: Geodetic, Spherical, Astronomical, ECEF, ENU, and Local Topographic Plane.',
            backToPortal: '← Portal',
            portalTitle: 'Back to Monorepo Portal',
            appTitle: 'Coordinate Systems',
            appSubtitle: 'Fundamental Geodesy',
            sidebarFooter: 'Explore fundamental coordinate systems used in Geodesy and their geometric relationships.',
            tabConcept: 'Concept',
            tabHow: 'How It Works',
            tabInteract: 'Interaction',
            togglePanelTitle: 'Expand / Collapse panel'
        }
    },

    models: {
        geodesicas: {
            pt: {
                name: 'Coordenadas Geodésicas',
                subtitle: 'Latitude, Longitude e Altura Elipsoidal (φ, λ, h)',
                concept: `
                    <h3>Coordenadas Geodésicas (φ, λ, h) e Seção Transversal</h3>
                    <p>O sistema de <strong>coordenadas geodésicas</strong> é o alicerce geométrico da Geodésia moderna. 
                    Ele adota um <strong>elipsoide de revolução</strong> (achatado nos polos) como superfície de referência 
                    matemática para a Terra.</p>

                    <h4>A Seção Transversal (Corte Didático de Livro-Texto)</h4>
                    <p>Ao realizar um <strong>corte seccional</strong> no elipsoide — expondo o plano equatorial e o plano meridiano do ponto $P$ —, 
                    as grandezas fundamentais tornam-se visíveis no interior da Terra:</p>

                    <p><strong>1. Plano Equatorial (Longitude $\\lambda$)</strong>: Medida no plano do equador a partir do meridiano de 
                    Greenwich ($X$, $\\lambda = 0^\\circ$) até o meridiano que contém o ponto $P$. Varia de $-180^\\circ$ a $+180^\\circ$ (ou $0^\\circ$ a $360^\\circ$).</p>

                    <p><strong>2. Plano Meridiano (Latitude Geodésica $\\varphi$)</strong>: Ângulo formado entre a <em>normal ao elipsoide</em> 
                    no ponto $P$ e o <em>plano equatorial</em>. Varia de $-90^\\circ$ (polo sul) a $+90^\\circ$ (polo norte).</p>

                    <p><strong>3. Altura Elipsoidal ($h$)</strong>: Distância geométrica medida ao longo da normal, da superfície do elipsoide 
                    até o ponto $P$.</p>

                    <h4>Propriedade Fundamental da Normal</h4>
                    <p>No elipsoide, a <strong>normal em $P$ NÃO passa pelo centro da Terra $O$</strong> (exceto exatamente no equador $\\varphi=0^\\circ$ 
                    e nos polos $\\varphi=\\pm 90^\\circ$). A normal intercepta o eixo de rotação polar ($Z$) no ponto 
                    <strong>$N_1$</strong>, localizado a uma distância $ON_1 = e^2 N \\sin\\varphi$ <em>abaixo</em> do geocentro.</p>

                    <p>O comprimento total do segmento da superfície até o eixo polar $N_1$ é a <strong>Grande Normal ($N$)</strong> (raio de curvatura do primeiro vertical).</p>
                `,
                howItWorks: `
                    <h3>Como Funciona a Geometria do Corte</h3>
                    <p>A posição tridimensional de $P$ é calculada a partir de <span class="coord-badge">(φ, λ, h)</span>:</p>

                    <h4>Grande Normal ($N$) e Interseção no Eixo Polar ($N_1$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Grande Normal (Raio Primeiro Vertical)</div>
                        <p>$$N = \\frac{a}{\\sqrt{1 - e^2 \\sin^2\\varphi}}$$</p>
                    </div>

                    <div class="formula-block">
                        <div class="formula-label">Ponto de Interseção da Normal no Eixo Polar ($N_1$)</div>
                        <p>$$Z_{N_1} = -e^2 N \\sin\\varphi$$</p>
                        <p>$$\\text{Distância ao Geocentro: } ON_1 = e^2 N |\\sin\\varphi|$$</p>
                    </div>

                    <h4>Conversão para Coordenadas Cartesianas ECEF</h4>
                    <div class="formula-block">
                        <div class="formula-label">Geodésicas → Cartesianas (X, Y, Z)</div>
                        <p>$$X = (N + h) \\cos\\varphi \\cos\\lambda$$</p>
                        <p>$$Y = (N + h) \\cos\\varphi \\sin\\lambda$$</p>
                        <p>$$Z = \\left[N(1 - e^2) + h\\right] \\sin\\varphi$$</p>
                    </div>

                    <h4>Latitude Geodésica ($\\varphi$) vs. Latitude Geocêntrica ($\\varphi'$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Redução da Latitude (Diferença no Corte)</div>
                        <p>$$\\tan\\varphi' = (1 - e^2) \\tan\\varphi$$</p>
                        <p>$$\\Delta\\varphi = \\varphi - \\varphi' \\approx \\frac{e^2}{2} \\sin(2\\varphi)$$</p>
                    </div>
                    <p>No corte meridiano, você pode observar claramente a abertura angular entre a <strong>normal (vermelha)</strong> 
                    e o <strong>raio vetor geocêntrico (ciano)</strong>.</p>
                `
            },
            en: {
                name: 'Geodetic Coordinates',
                subtitle: 'Latitude, Longitude and Ellipsoidal Height (φ, λ, h)',
                concept: `
                    <h3>Geodetic Coordinates (φ, λ, h) and Cross-Sectional Geometry</h3>
                    <p>The <strong>geodetic coordinate system</strong> is the geometric foundation of modern Geodesy. 
                    It adopts an <strong>ellipsoid of revolution</strong> (flattened at the poles) as the mathematical reference 
                    surface for the Earth.</p>

                    <h4>The Didactic Cross-Section (Textbook Cutaway)</h4>
                    <p>By executing a <strong>sectional cut</strong> through the ellipsoid — exposing the equatorial plane and the meridian plane of point $P$ —, 
                    the fundamental geodetic quantities become directly visible inside the Earth:</p>

                    <p><strong>1. Equatorial Plane (Longitude $\\lambda$)</strong>: Angle measured in the equatorial plane from the 
                    Greenwich meridian ($X$, $\\lambda = 0^\\circ$) to the meridian containing point $P$. Ranges from $-180^\\circ$ to $+180^\\circ$ (or $0^\\circ$ to $360^\\circ$).</p>

                    <p><strong>2. Meridian Plane (Geodetic Latitude $\\varphi$)</strong>: Angle formed between the <em>ellipsoid normal</em> 
                    at point $P$ and the <em>equatorial plane</em>. Ranges from $-90^\\circ$ (South Pole) to $+90^\\circ$ (North Pole).</p>

                    <p><strong>3. Ellipsoidal Height ($h$)</strong>: Geometric distance measured along the ellipsoidal normal from the surface of the ellipsoid 
                    to point $P$.</p>

                    <h4>Fundamental Property of the Normal</h4>
                    <p>On an ellipsoid, the <strong>normal at $P$ DOES NOT pass through Earth's center $O$</strong> (except exactly at the equator $\\varphi=0^\\circ$ 
                    and at the poles $\\varphi=\\pm 90^\\circ$). The normal intersects the polar rotation axis ($Z$) at point 
                    <strong>$N_1$</strong>, located at a distance $ON_1 = e^2 N \\sin\\varphi$ <em>below</em> the geocenter.</p>

                    <p>The total segment length from the surface to the polar axis intersection $N_1$ is the <strong>Prime Vertical Radius of Curvature ($N$)</strong> (Great Normal).</p>
                `,
                howItWorks: `
                    <h3>Geometry of the Cross-Section</h3>
                    <p>The three-dimensional position of $P$ is calculated from <span class="coord-badge">(φ, λ, h)</span>:</p>

                    <h4>Prime Vertical Radius ($N$) and Polar Axis Intersection ($N_1$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Prime Vertical Radius of Curvature</div>
                        <p>$$N = \\frac{a}{\\sqrt{1 - e^2 \\sin^2\\varphi}}$$</p>
                    </div>

                    <div class="formula-block">
                        <div class="formula-label">Intersection Point on Polar Axis ($N_1$)</div>
                        <p>$$Z_{N_1} = -e^2 N \\sin\\varphi$$</p>
                        <p>$$\\text{Distance to Geocenter: } ON_1 = e^2 N |\\sin\\varphi|$$</p>
                    </div>

                    <h4>Conversion to Cartesian ECEF Coordinates</h4>
                    <div class="formula-block">
                        <div class="formula-label">Geodetic → Cartesian (X, Y, Z)</div>
                        <p>$$X = (N + h) \\cos\\varphi \\cos\\lambda$$</p>
                        <p>$$Y = (N + h) \\cos\\varphi \\sin\\lambda$$</p>
                        <p>$$Z = \\left[N(1 - e^2) + h\\right] \\sin\\varphi$$</p>
                    </div>

                    <h4>Geodetic Latitude ($\\varphi$) vs. Geocentric Latitude ($\\varphi'$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Latitude Reduction (Difference in Meridian Cut)</div>
                        <p>$$\\tan\\varphi' = (1 - e^2) \\tan\\varphi$$</p>
                        <p>$$\\Delta\\varphi = \\varphi - \\varphi' \\approx \\frac{e^2}{2} \\sin(2\\varphi)$$</p>
                    </div>
                    <p>In the meridian cut, you can clearly observe the angular difference between the <strong>ellipsoidal normal (red)</strong> 
                    and the <strong>geocentric radius vector (cyan)</strong>.</p>
                `
            }
        },

        esfericas: {
            pt: {
                name: 'Coordenadas Esféricas',
                subtitle: "Latitude Geocêntrica, Longitude e Raio (φ', λ, r)",
                concept: `
                    <h3>Coordenadas Esféricas / Geocêntricas (φ', λ, r) e Seção Transversal</h3>
                    <p>O sistema de <strong>coordenadas esféricas</strong> (ou geocêntricas) adota uma <strong>esfera</strong> 
                    como superfície de aproximação para a Terra. A posição de qualquer ponto $P$ no espaço é definida 
                    pelo <em>raio vetor</em> que parte diretamente do centro de massa da Terra ($O$).</p>

                    <h4>A Seção Transversal Didática</h4>
                    <p>Ao realizar o corte transversal no modelo esférico, a geometria se simplifica e revela a base conceitual da navegação:</p>

                    <p><strong>1. Plano Equatorial (Longitude $\\lambda$)</strong>: Ângulo medido no plano equatorial a partir do meridiano 
                    de Greenwich ($X$) até o meridiano do ponto $P$. Idêntica à longitude geodésica.</p>

                    <p><strong>2. Plano Meridiano (Latitude Geocêntrica $\\varphi'$)</strong>: Ângulo formado no <em>centro da Terra ($O$)</em> 
                    entre o raio vetor $\\vec{r}$ e o plano equatorial. Ao contrário da latitude geodésica, a latitude esférica tem seu 
                    vértice <strong>exatamente no geocentro</strong>.</p>

                    <p><strong>3. Distância Radial ($r$)</strong>: Comprimento do raio vetor do centro $O$ até o ponto $P$. Para pontos 
                    na superfície esférica, $r = R$.</p>

                    <h4>Comparação no Corte: Esfera vs. Elipsoide</h4>
                    <p>Na aba de interação, ative a opção <strong>"Comparar c/ Geodésicas"</strong> para ver no mesmo corte seccional 
                    a diferença entre a <em>normal ao elipsoide</em> (que não passa pelo centro) e o <em>raio vetor da esfera</em> 
                    (que passa pelo centro). Essa diferença é a <strong>redução da latitude ($\\Delta\\varphi = \\varphi - \\varphi'$)</strong>, 
                    que atinge até $\\approx 11,5'$ de arco (cerca de $21\\text{ km}$ na superfície terrestre).</p>
                `,
                howItWorks: `
                    <h3>Como Funciona</h3>
                    <p>A posição de um ponto no sistema esférico é dada por <span class="coord-badge">(φ', λ, r)</span>.</p>

                    <h4>Conversão para Coordenadas Cartesianas (X, Y, Z)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Esféricas → Cartesianas</div>
                        <p>$$X = r \\cos\\varphi' \\cos\\lambda$$</p>
                        <p>$$Y = r \\cos\\varphi' \\sin\\lambda$$</p>
                        <p>$$Z = r \\sin\\varphi'$$</p>
                    </div>

                    <h4>Relação com a Latitude Geodésica ($\\varphi$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Relação Geocêntrica ↔ Geodésica</div>
                        <p>$$\\tan\\varphi' = (1 - e^2) \\tan\\varphi$$</p>
                        <p>$$\\tan\\varphi = \\frac{\\tan\\varphi'}{1 - e^2}$$</p>
                    </div>

                    <h4>Aplicações</h4>
                    <p>Coordenadas esféricas são amplamente empregadas em <strong>astrometria</strong>, mecânica orbital 
                    (órbitas preliminares de satélites distantes), cosmologia e modelos climáticos globais onde a complexidade 
                    do elipsoide pode ser aproximada por uma esfera média.</p>
                `
            },
            en: {
                name: 'Spherical Coordinates',
                subtitle: "Geocentric Latitude, Longitude and Radius (φ', λ, r)",
                concept: `
                    <h3>Spherical / Geocentric Coordinates (φ', λ, r) and Cross-Section</h3>
                    <p>The <strong>spherical coordinate system</strong> (or geocentric) adopts a <strong>sphere</strong> 
                    as an approximation surface for the Earth. The position of any point $P$ in space is defined 
                    by the <em>radius vector</em> originating directly from Earth's center of mass ($O$).</p>

                    <h4>Didactic Cross-Section</h4>
                    <p>Executing a sectional cut in the spherical model simplifies geometry and reveals the classical foundation of celestial navigation:</p>

                    <p><strong>1. Equatorial Plane (Longitude $\\lambda$)</strong>: Angle measured in the equatorial plane from the 
                    Greenwich meridian ($X$) to the meridian of point $P$. Identical to geodetic longitude.</p>

                    <p><strong>2. Meridian Plane (Geocentric Latitude $\\varphi'$)</strong>: Angle formed at the <em>Earth's center ($O$)</em> 
                    between the radius vector $\\vec{r}$ and the equatorial plane. Unlike geodetic latitude, spherical latitude has its 
                    vertex <strong>exactly at the geocenter</strong>.</p>

                    <p><strong>3. Radial Distance ($r$)</strong>: Length of the radius vector from center $O$ to point $P$. For points 
                    on the spherical surface, $r = R$.</p>

                    <h4>Cut Comparison: Sphere vs. Ellipsoid</h4>
                    <p>In the interaction tab, enable <strong>"Compare w/ Geodetic"</strong> to observe in the same sectional cut 
                    the divergence between the <em>ellipsoid normal</em> (which does not pass through the center) and the <em>sphere radius vector</em> 
                    (which passes directly through the center). This difference is the <strong>latitude reduction ($\\Delta\\varphi = \\varphi - \\varphi'$)</strong>, 
                    reaching up to $\\approx 11.5'$ of arc (about $21\\text{ km}$ on Earth's surface).</p>
                `,
                howItWorks: `
                    <h3>How It Works</h3>
                    <p>The position of a point in the spherical system is given by <span class="coord-badge">(φ', λ, r)</span>.</p>

                    <h4>Conversion to Cartesian Coordinates (X, Y, Z)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Spherical → Cartesian</div>
                        <p>$$X = r \\cos\\varphi' \\cos\\lambda$$</p>
                        <p>$$Y = r \\cos\\varphi' \\sin\\lambda$$</p>
                        <p>$$Z = r \\sin\\varphi'$$</p>
                    </div>

                    <h4>Relationship with Geodetic Latitude ($\\varphi$)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Geocentric ↔ Geodetic Relationship</div>
                        <p>$$\\tan\\varphi' = (1 - e^2) \\tan\\varphi$$</p>
                        <p>$$\\tan\\varphi = \\frac{\\tan\\varphi'}{1 - e^2}$$</p>
                    </div>

                    <h4>Applications</h4>
                    <p>Spherical coordinates are widely used in <strong>astrometry</strong>, orbital mechanics 
                    (initial orbit determination for distant satellites), cosmology, and global climate models where the 
                    complexity of an ellipsoid can be approximated by a mean sphere.</p>
                `
            }
        },

        astronomicas: {
            pt: {
                name: 'Coordenadas Astronômicas',
                subtitle: 'Latitude e Longitude Astronômicas (Φ, Λ)',
                concept: `
                    <h3>Coordenadas Astronômicas (Φ, Λ)</h3>
                    <p>O sistema de <strong>coordenadas astronômicas</strong> define a posição de um ponto 
                    na superfície terrestre com base na direção da <em>vertical do lugar</em> — a direção 
                    da gravidade (fio de prumo).</p>

                    <h4>Grandezas</h4>
                    <p><strong>Latitude astronômica (Φ)</strong>: ângulo entre a <em>vertical do lugar</em> 
                    (direção do fio de prumo) e o plano do equador. É determinada por observações astronômicas 
                    (altura de estrelas).</p>

                    <p><strong>Longitude astronômica (Λ)</strong>: ângulo medido no plano equatorial, 
                    determinada pela diferença entre o tempo sideral local (observado) e o tempo sideral 
                    em Greenwich.</p>

                    <h4>Desvio da Vertical</h4>
                    <p>A <strong>vertical astronômica</strong> geralmente <em>não coincide</em> com a 
                    <strong>normal ao elipsoide</strong>. A diferença angular entre elas é o 
                    <strong>desvio da vertical</strong>, causado pelas irregularidades do campo gravitacional 
                    (anomalias de massa na crosta e manto terrestre).</p>

                    <p>O desvio é decomposto em duas componentes:</p>
                    <p>• <strong>ξ (xi)</strong>: componente meridiana — $\\xi = \\Phi - \\varphi$</p>
                    <p>• <strong>η (eta)</strong>: componente no primeiro vertical — $\\eta = (\\Lambda - \\lambda) \\cos\\varphi$</p>

                    <p>Valores típicos do desvio: <strong>5" a 30"</strong> de arco (podendo ultrapassar 1' em regiões montanhosas).</p>
                `,
                howItWorks: `
                    <h3>Como Funciona</h3>
                    <p>As coordenadas astronômicas <span class="coord-badge purple">(Φ, Λ)</span> são 
                    obtidas por <strong>observação direta</strong> da posição de estrelas, enquanto as 
                    geodésicas <span class="coord-badge">(φ, λ)</span> são calculadas a partir do elipsoide.</p>

                    <h4>Relação com Coordenadas Geodésicas</h4>
                    <div class="formula-block">
                        <div class="formula-label">Desvio da Vertical</div>
                        <p>$$\\xi = \\Phi - \\varphi$$</p>
                        <p>$$\\eta = (\\Lambda - \\lambda) \\cos\\varphi$$</p>
                    </div>

                    <h4>Equação de Laplace</h4>
                    <div class="formula-block">
                        <div class="formula-label">Equação de Laplace</div>
                        <p>$$\\Lambda - \\lambda = (\\Lambda - \\lambda)_{\\text{obs}} = \\eta \\sec\\varphi$$</p>
                    </div>

                    <p>A equação de Laplace relaciona a diferença entre longitude astronômica e geodésica 
                    com a componente η do desvio da vertical. É fundamental para a orientação de 
                    redes geodésicas clássicas.</p>

                    <h4>Determinação</h4>
                    <p><strong>Φ</strong> é obtida medindo-se a altitude de estrelas (método de Sterneck, pares 
                    de estrelas de Horrebow-Talcott, etc.)</p>
                    <p><strong>Λ</strong> é obtida pela diferença de tempo sideral, historicamente via 
                    telégrafo e hoje via GNSS.</p>
                `
            },
            en: {
                name: 'Astronomical Coordinates',
                subtitle: 'Astronomical Latitude and Longitude (Φ, Λ)',
                concept: `
                    <h3>Astronomical Coordinates (Φ, Λ)</h3>
                    <p>The <strong>astronomical coordinate system</strong> defines the position of a point 
                    on Earth's surface based on the direction of the <em>local plumb line</em> — the true direction 
                    of gravity.</p>

                    <h4>Quantities</h4>
                    <p><strong>Astronomical Latitude (Φ)</strong>: Angle between the <em>local vertical</em> 
                    (direction of the plumb line) and the equatorial plane. Determined through direct astronomical observations 
                    (star elevations).</p>

                    <p><strong>Astronomical Longitude (Λ)</strong>: Angle measured in the equatorial plane, 
                    determined from the difference between local observed sidereal time and Greenwich sidereal time.</p>

                    <h4>Deflection of the Vertical</h4>
                    <p>The <strong>astronomical vertical</strong> generally <em>does not coincide</em> with the 
                    <strong>ellipsoidal normal</strong>. The angular separation between them is the 
                    <strong>deflection of the vertical</strong>, caused by mass irregularities in Earth's crust and mantle 
                    distorting the gravity field (geoid undulations).</p>

                    <p>The deflection is decomposed into two orthogonal components:</p>
                    <p>• <strong>ξ (xi)</strong>: Meridian component — $\\xi = \\Phi - \\varphi$</p>
                    <p>• <strong>η (eta)</strong>: Prime vertical component — $\\eta = (\\Lambda - \\lambda) \\cos\\varphi$</p>

                    <p>Typical deflection magnitudes: <strong>5" to 30"</strong> of arc (exceeding 1' in steep mountainous terrain).</p>
                `,
                howItWorks: `
                    <h3>How It Works</h3>
                    <p>Astronomical coordinates <span class="coord-badge purple">(Φ, Λ)</span> are 
                    obtained by <strong>direct celestial observations</strong>, whereas geodetic 
                    coordinates <span class="coord-badge">(φ, λ)</span> are defined geometrically relative to the ellipsoid.</p>

                    <h4>Relationship with Geodetic Coordinates</h4>
                    <div class="formula-block">
                        <div class="formula-label">Deflection of the Vertical Components</div>
                        <p>$$\\xi = \\Phi - \\varphi$$</p>
                        <p>$$\\eta = (\\Lambda - \\lambda) \\cos\\varphi$$</p>
                    </div>

                    <h4>Laplace Equation</h4>
                    <div class="formula-block">
                        <div class="formula-label">Laplace Azimuth & Longitude Condition</div>
                        <p>$$\\Lambda - \\lambda = (\\Lambda - \\lambda)_{\\text{obs}} = \\eta \\sec\\varphi$$</p>
                    </div>

                    <p>The Laplace equation connects the longitude difference with the prime vertical deflection component η. 
                    It is fundamental for constraining azimuth drift in classical geodetic triangulation networks.</p>

                    <h4>Observational Determination</h4>
                    <p><strong>Φ</strong> is measured via zenith distances of meridian stars (Sterneck or Horrebow-Talcott methods).</p>
                    <p><strong>Λ</strong> is determined by comparing local sidereal transit times with reference time (historically telegraphic radio signals, now GNSS/VLBI).</p>
                `
            }
        },

        ecef: {
            pt: {
                name: 'ECEF Cartesiano',
                subtitle: 'Earth-Centered, Earth-Fixed (X, Y, Z)',
                concept: `
                    <h3>ECEF — Earth-Centered, Earth-Fixed (X, Y, Z)</h3>
                    <p>O sistema <strong>ECEF</strong> é um sistema de coordenadas <em>cartesianas tridimensionais</em> 
                    com origem no centro de massa da Terra. O sistema é <strong>solidário à Terra</strong> 
                    (gira junto com ela).</p>

                    <h4>Definição dos Eixos</h4>
                    <p><strong>Eixo X</strong>: aponta para a interseção do meridiano de Greenwich (λ = 0°) 
                    com o plano do equador (φ = 0°).</p>

                    <p><strong>Eixo Y</strong>: completa o sistema dextrogiro no plano equatorial. 
                    Aponta para λ = 90° E.</p>

                    <p><strong>Eixo Z</strong>: direção do polo norte convencional (CIO — Conventional 
                    International Origin), aproximadamente coincidente com o eixo de rotação médio.</p>

                    <h4>Características</h4>
                    <p>• Sistema cartesiano ortogonal dextrogiro</p>
                    <p>• Origem no geocentro (centro de massa da Terra)</p>
                    <p>• Fixo à Terra (roda junto)</p>
                    <p>• Usado nativamente pelo <strong>GNSS</strong> — as coordenadas dos satélites e dos 
                    receptores são calculadas inicialmente em ECEF</p>
                    <p>• Unidade: <strong>metros</strong></p>
                `,
                howItWorks: `
                    <h3>Como Funciona</h3>
                    <p>Um ponto P tem posição <span class="coord-badge">(X, Y, Z)</span> em metros a partir 
                    do centro da Terra.</p>

                    <h4>Conversão de Geodésicas para ECEF</h4>
                    <div class="formula-block">
                        <div class="formula-label">Geodésicas (φ, λ, h) → ECEF (X, Y, Z)</div>
                        <p>$$X = (N + h) \\cos\\varphi \\cos\\lambda$$</p>
                        <p>$$Y = (N + h) \\cos\\varphi \\sin\\lambda$$</p>
                        <p>$$Z = \\left[N(1 - e^2) + h\\right] \\sin\\varphi$$</p>
                    </div>

                    <h4>Conversão Inversa (ECEF → Geodésicas)</h4>
                    <p>A conversão inversa é <strong>iterativa</strong> (não possui solução fechada simples). 
                    Os métodos mais utilizados são:</p>
                    <p>• <strong>Método de Bowring</strong> (iterativo, convergência rápida)</p>
                    <p>• <strong>Método de Heikkinen</strong> (solução fechada aproximada)</p>

                    <div class="formula-block">
                        <div class="formula-label">Longitude (solução direta)</div>
                        <p>$$\\lambda = \\arctan\\!\\left(\\frac{Y}{X}\\right)$$</p>
                    </div>
                `
            },
            en: {
                name: 'ECEF Cartesian',
                subtitle: 'Earth-Centered, Earth-Fixed (X, Y, Z)',
                concept: `
                    <h3>ECEF — Earth-Centered, Earth-Fixed (X, Y, Z)</h3>
                    <p>The <strong>ECEF</strong> system is a <em>3D right-handed Cartesian coordinate system</em> 
                    with its origin at Earth's center of mass. The frame is <strong>co-rotating with the Earth</strong>.</p>

                    <h4>Axis Definitions</h4>
                    <p><strong>X-Axis</strong>: Points to the intersection of the Greenwich reference meridian (λ = 0°) 
                    with the equatorial plane (φ = 0°).</p>

                    <p><strong>Y-Axis</strong>: Completes the right-handed triad in the equatorial plane, pointing towards λ = 90° E.</p>

                    <p><strong>Z-Axis</strong>: Aligned with the Conventional Terrestrial Pole (CTP/CIO), closely coinciding with Earth's mean rotation axis.</p>

                    <h4>Key Characteristics</h4>
                    <p>• Orthogonal right-handed Cartesian coordinate frame</p>
                    <p>• Origin at the geocenter (Earth's barycenter)</p>
                    <p>• Earth-fixed (rotates rigidly with the planet)</p>
                    <p>• Native coordinate frame for <strong>GNSS</strong> — satellite ephemerides and receiver solutions are computed directly in ECEF</p>
                    <p>• Metric unit: <strong>meters</strong></p>
                `,
                howItWorks: `
                    <h3>How It Works</h3>
                    <p>Any point P has spatial position <span class="coord-badge">(X, Y, Z)</span> in meters from the geocenter.</p>

                    <h4>Forward Conversion (Geodetic → ECEF)</h4>
                    <div class="formula-block">
                        <div class="formula-label">Geodetic (φ, λ, h) → ECEF (X, Y, Z)</div>
                        <p>$$X = (N + h) \\cos\\varphi \\cos\\lambda$$</p>
                        <p>$$Y = (N + h) \\cos\\varphi \\sin\\lambda$$</p>
                        <p>$$Z = \\left[N(1 - e^2) + h\\right] \\sin\\varphi$$</p>
                    </div>

                    <h4>Inverse Conversion (ECEF → Geodetic)</h4>
                    <p>Because geodetic latitude $\\varphi$ depends on height $h$ and prime vertical radius $N(\\varphi)$, the inverse conversion requires non-linear solution methods:</p>
                    <p>• <strong>Bowring's algorithm</strong> (fastest iterative convergence, sub-millimeter in 2 iterations)</p>
                    <p>• <strong>Heikkinen / Vermeille closed-form solutions</strong> (direct analytical formulations)</p>

                    <div class="formula-block">
                        <div class="formula-label">Direct Longitude Solution</div>
                        <p>$$\\lambda = \\arctan2(Y, X)$$</p>
                    </div>
                `
            }
        },

        enu: {
            pt: {
                name: 'Topocêntrico ENU',
                subtitle: 'East, North, Up — Sistema Topocêntrico',
                concept: `
                    <h3>ENU — East, North, Up</h3>
                    <p>O sistema <strong>ENU</strong> (East-North-Up) é um sistema de coordenadas 
                    <em>topocêntrico</em> local, centrado num ponto de referência na superfície terrestre. 
                    É o sistema mais natural para observadores na superfície.</p>

                    <h4>Definição dos Eixos</h4>
                    <p><strong>E (East)</strong>: tangente ao paralelo, apontando para leste. Perpendicular 
                    ao meridiano local.</p>

                    <p><strong>N (North)</strong>: tangente ao meridiano, apontando para o norte geográfico. 
                    Contido no plano meridiano.</p>

                    <p><strong>U (Up)</strong>: direção da normal ao elipsoide no ponto de referência, apontando 
                    para o zênite. Coincide com a direção "para cima" local.</p>

                    <h4>Características</h4>
                    <p>• Sistema <strong>local</strong>: cada ponto de referência gera um triedro ENU diferente</p>
                    <p>• Os eixos mudam de orientação conforme a posição no globo</p>
                    <p>• A orientação do triedro depende da latitude e longitude do ponto de origem</p>
                    <p>• Relaciona-se diretamente com o <strong>azimute</strong> (ângulo a partir do Norte) 
                    e a <strong>elevação</strong> (ângulo acima do horizonte)</p>
                `,
                howItWorks: `
                    <h3>Como Funciona</h3>
                    <p>Um vetor entre dois pontos no espaço ECEF pode ser expresso no sistema ENU local do 
                    primeiro ponto como <span class="coord-badge green">(ΔE, ΔN, ΔU)</span>.</p>

                    <h4>Rotação ECEF → ENU</h4>
                    <div class="formula-block">
                        <div class="formula-label">Transformação ECEF → ENU</div>
                        <p>$$\\begin{pmatrix} \\Delta E \\\\ \\Delta N \\\\ \\Delta U \\end{pmatrix} = \\mathbf{R} \\begin{pmatrix} \\Delta X \\\\ \\Delta Y \\\\ \\Delta Z \\end{pmatrix}$$</p>
                    </div>

                    <p>Onde a matriz de rotação $\\mathbf{R}$ é:</p>
                    <div class="formula-block">
                        <div class="formula-label">Matriz de Rotação</div>
                        <p>$$\\mathbf{R} = \\begin{pmatrix} -\\sin\\lambda & \\cos\\lambda & 0 \\\\ -\\sin\\varphi\\cos\\lambda & -\\sin\\varphi\\sin\\lambda & \\cos\\varphi \\\\ \\cos\\varphi\\cos\\lambda & \\cos\\varphi\\sin\\lambda & \\sin\\varphi \\end{pmatrix}$$</p>
                    </div>

                    <h4>Relação com Azimute e Elevação</h4>
                    <div class="formula-block">
                        <div class="formula-label">Azimute e Elevação</div>
                        <p>$$Az = \\arctan\\!\\left(\\frac{\\Delta E}{\\Delta N}\\right)$$</p>
                        <p>$$El = \\arctan\\!\\left(\\frac{\\Delta U}{\\sqrt{\\Delta E^2 + \\Delta N^2}}\\right)$$</p>
                    </div>
                `
            },
            en: {
                name: 'Topocentric ENU',
                subtitle: 'East, North, Up — Local Topocentric System',
                concept: `
                    <h3>ENU — East, North, Up</h3>
                    <p>The <strong>ENU</strong> (East-North-Up) system is a local <em>topocentric</em> coordinate 
                    frame, centered on an observer or reference station on the Earth's surface. 
                    It is the most intuitive reference frame for ground-based engineering and surveying.</p>

                    <h4>Axis Definitions</h4>
                    <p><strong>E (East)</strong>: Tangent to the parallel of latitude, pointing eastward. Perpendicular 
                    to the local meridian.</p>

                    <p><strong>N (North)</strong>: Tangent to the meridian, pointing towards geographic north. 
                    Contained in the meridian plane.</p>

                    <p><strong>U (Up)</strong>: Aligned with the ellipsoidal normal at the reference station, pointing toward 
                    the local ellipsoidal zenith.</p>

                    <h4>Key Characteristics</h4>
                    <p>• <strong>Local topocentric triad</strong>: each station defines its own unique ENU orientation</p>
                    <p>• Axes rotate with latitude $\\varphi_0$ and longitude $\\lambda_0$ of the station origin</p>
                    <p>• Directly maps to topocentric polar angles: <strong>azimuth</strong> (clockwise from North) 
                    and <strong>elevation</strong> (vertical angle above the local horizon)</p>
                `,
                howItWorks: `
                    <h3>How It Works</h3>
                    <p>A baseline vector between two points in ECEF space is transformed into the local ENU frame as <span class="coord-badge green">(ΔE, ΔN, ΔU)</span>.</p>

                    <h4>Rotation from ECEF to ENU</h4>
                    <div class="formula-block">
                        <div class="formula-label">ECEF → ENU Transformation</div>
                        <p>$$\\begin{pmatrix} \\Delta E \\\\ \\Delta N \\\\ \\Delta U \\end{pmatrix} = \\mathbf{R} \\begin{pmatrix} \\Delta X \\\\ \\Delta Y \\\\ \\Delta Z \\end{pmatrix}$$</p>
                    </div>

                    <p>Where the orthogonal rotation matrix $\\mathbf{R}(\\varphi, \\lambda)$ is:</p>
                    <div class="formula-block">
                        <div class="formula-label">Rotation Matrix</div>
                        <p>$$\\mathbf{R} = \\begin{pmatrix} -\\sin\\lambda & \\cos\\lambda & 0 \\\\ -\\sin\\varphi\\cos\\lambda & -\\sin\\varphi\\sin\\lambda & \\cos\\varphi \\\\ \\cos\\varphi\\cos\\lambda & \\cos\\varphi\\sin\\lambda & \\sin\\varphi \\end{pmatrix}$$</p>
                    </div>

                    <h4>Azimuth and Elevation Angles</h4>
                    <div class="formula-block">
                        <div class="formula-label">Azimuth & Elevation</div>
                        <p>$$Az = \\arctan2(\\Delta E, \\Delta N)$$</p>
                        <p>$$El = \\arctan2\\!\\left(\\Delta U, \\sqrt{\\Delta E^2 + \\Delta N^2}\\right)$$</p>
                    </div>
                `
            }
        },

        plano_local: {
            pt: {
                name: 'Plano Topográfico Local',
                subtitle: 'Coordenadas Planas Locais (x, y, z)',
                concept: `
                    <h3>Plano Topográfico Local (PTL)</h3>
                    <p>O <strong>Plano Topográfico Local</strong> é a aproximação mais clássica e intuitiva: 
                    trata-se de projetar uma região da superfície sobre um <em>plano tangente</em>, 
                    utilizando coordenadas cartesianas planas.</p>

                    <h4>Princípio</h4>
                    <p>Em áreas suficientemente pequenas, a curvatura da Terra pode ser <strong>desprezada</strong>. 
                    O levantador trabalha como se a superfície fosse plana, com um sistema de eixos ortogonais 
                    definidos localmente a uma determinada <strong>altitude</strong>.</p>

                    <h4>Grandezas</h4>
                    <p><strong>x</strong>: coordenada horizontal no sentido do Norte (tangente ao meridiano local)</p>
                    <p><strong>y</strong>: coordenada horizontal no sentido do Este (tangente ao paralelo local)</p>
                    <p><strong>z</strong>: cota ou altitude — componente vertical coincidente com a normal ao elipsoide</p>

                    <h4>Limitações</h4>
                    <p>À medida que nos afastamos do ponto de tangência, a <strong>distorção</strong> cresce. 
                    A norma brasileira (NBR 14166) estabelece que o plano topográfico local é válido para 
                    áreas com raio de até <strong>~80 km</strong> do ponto de tangência, com deformações 
                    lineares inferiores a 1:50.000.</p>
                `,
                howItWorks: `
                    <h3>Como Funciona</h3>
                    <p>O plano é estabelecido a uma <strong>altitude média</strong> da região de levantamento 
                    (nesta simulação, variando de 100m a 8km) e posicionado ao longo da normal ao elipsoide.</p>

                    <h4>Distorção Linear</h4>
                    <div class="formula-block">
                        <div class="formula-label">Erro relativo no PTL</div>
                        <p>$$\\frac{\\delta}{d} \\approx \\frac{d^2}{3R^2}$$</p>
                    </div>

                    <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.78rem;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(100,140,220,0.2);">
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Raio (km)</th>
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Erro relativo</th>
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Erro em 1 km</th>
                            </tr>
                        </thead>
                        <tbody style="color:var(--text-secondary)">
                            <tr><td style="padding:4px 6px">10</td><td>1 : 12.000.000</td><td>~0.08 mm</td></tr>
                            <tr><td style="padding:4px 6px">30</td><td>1 : 1.350.000</td><td>~0.7 mm</td></tr>
                            <tr><td style="padding:4px 6px">50</td><td>1 : 490.000</td><td>~2 mm</td></tr>
                            <tr><td style="padding:4px 6px">80</td><td>1 : 190.000</td><td>~5 mm</td></tr>
                            <tr><td style="padding:4px 6px">100</td><td>1 : 122.000</td><td>~8 mm</td></tr>
                        </tbody>
                    </table>
                `
            },
            en: {
                name: 'Local Topographic Plane',
                subtitle: 'Local Plane Coordinates (x, y, z)',
                concept: `
                    <h3>Local Topographic Plane (LTP)</h3>
                    <p>The <strong>Local Topographic Plane</strong> is the most classical surveying approximation: 
                    projecting a local area of the Earth's curved surface onto an osculating or <em>tangent plane</em>, 
                    using 2D plane Cartesian coordinates.</p>

                    <h4>Foundational Principle</h4>
                    <p>In sufficiently small survey areas, Earth curvature can be <strong>neglected</strong> for short-range engineering measurements. 
                    The surveyor operates in a plane Cartesian grid defined at a specific reference <strong>elevation</strong>.</p>

                    <h4>Quantities</h4>
                    <p><strong>x</strong>: Horizontal coordinate along the local meridian (North)</p>
                    <p><strong>y</strong>: Horizontal coordinate along the local parallel (East)</p>
                    <p><strong>z</strong>: Height or elevation component aligned with the local normal</p>

                    <h4>Engineering Limitations & Standards</h4>
                    <p>As distance $d$ increases from the origin tangent point, spherical departure and <strong>linear distortion</strong> grow parabolically. 
                    Geodetic standards (such as NBR 14166) limit local tangent planes to radial extents of <strong>~50–80 km</strong>, 
                    ensuring linear scale errors remain smaller than 1:50,000 (20 ppm).</p>
                `,
                howItWorks: `
                    <h3>How It Works</h3>
                    <p>The plane is established at a <strong>mean elevation</strong> of the project site 
                    and oriented tangentially along the reference ellipsoidal normal.</p>

                    <h4>Linear Scale Distortion</h4>
                    <div class="formula-block">
                        <div class="formula-label">Relative Scale Distortion in Tangent Plane</div>
                        <p>$$\\frac{\\delta}{d} \\approx \\frac{d^2}{3R^2}$$</p>
                    </div>

                    <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.78rem;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(100,140,220,0.2);">
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Radius (km)</th>
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Relative Error</th>
                                <th style="text-align:left; padding:6px; color:var(--accent-primary)">Error per 1 km</th>
                            </tr>
                        </thead>
                        <tbody style="color:var(--text-secondary)">
                            <tr><td style="padding:4px 6px">10</td><td>1 : 12,000,000</td><td>~0.08 mm</td></tr>
                            <tr><td style="padding:4px 6px">30</td><td>1 : 1,350,000</td><td>~0.7 mm</td></tr>
                            <tr><td style="padding:4px 6px">50</td><td>1 : 490,000</td><td>~2 mm</td></tr>
                            <tr><td style="padding:4px 6px">80</td><td>1 : 190,000</td><td>~5 mm</td></tr>
                            <tr><td style="padding:4px 6px">100</td><td>1 : 122,000</td><td>~8 mm</td></tr>
                        </tbody>
                    </table>
                `
            }
        }
    }
};

// Phrase replacement dictionaries for interact tab controls & readout overlay
const interactReplacements = [
    // Headings & labels
    ['🎯 Vistas Didáticas (Livro-Texto):', '🎯 Didactic Views (Textbook):'],
    ['Vista 3D Isométrica', '3D Isometric View'],
    ['Corte Meridiano (Plano φ)', 'Meridian Cut (φ-Plane)'],
    ['Corte Equatorial (Plano λ)', 'Equatorial Cut (λ-Plane)'],
    ['🔪 Tipo de Corte / Seção Transversal:', '🔪 Cut Type / Cross-Section:'],
    ['Cunha (0° → λ)', 'Wedge (0° → λ)'],
    ['Quadrante (90°)', 'Quadrant (90°)'],
    ['Corte Meridiano (180°)', 'Meridian Cut (180°)'],
    ['Sem Corte (3D)', 'No Cut (3D)'],
    ['Latitude Geodésica (φ):', 'Geodetic Latitude (φ):'],
    ['Longitude Geodésica (λ):', 'Geodetic Longitude (λ):'],
    ['Altura Elipsoidal (h):', 'Ellipsoidal Height (h):'],
    ['Exagero do Achatamento:', 'Flattening Exaggeration:'],
    ['Achatamento real f ≈ 1/298 | Achatamento visual f =', 'Real flattening f ≈ 1/298 | Visual flattening f ='],
    ['Normal (n) e N₁', 'Normal (n) & N₁'],
    ['Comparar c/ Geocêntrica (φ\')', 'Compare w/ Geocentric (φ\')'],
    ['Arcos e Setores (φ, λ)', 'Arcs & Sectors (φ, λ)'],
    ['Plano Meridiano', 'Meridian Plane'],
    ['Plano Equatorial', 'Equatorial Plane'],
    ['Superfície Semi-Transparente', 'Semi-Transparent Surface'],
    ['Grid de Meridianos / Paralelos', 'Meridian / Parallel Grid'],
    ['Caixa Delimitadora 3D', '3D Bounding Box'],
    ['Auto-Rotacionar Cena', 'Auto-Rotate Scene'],
    ['Animar Pulsação do Ponto P', 'Animate Pulsing Point P'],
    ['Latitude Geocêntrica (φ\'):', 'Geocentric Latitude (φ\'):'],
    ['Longitude Esférica (λ):', 'Spherical Longitude (λ):'],
    ['Raio da Esfera (r):', 'Sphere Radius (r):'],
    ['Comparar c/ Geodésicas', 'Compare w/ Geodetic'],
    ['Mostrar Raio Vetor (r)', 'Show Radius Vector (r)'],
    ['Componente Meridiana (ξ):', 'Meridian Component (ξ):'],
    ['Componente Primeiro Vertical (η):', 'Prime Vertical Component (η):'],
    ['Exagero do Desvio da Vertical:', 'Deflection Exaggeration:'],
    ['Exibir Superfície do Geóide', 'Display Geoid Surface'],
    ['Exibir Vetores (Normal e Vertical)', 'Display Vectors (Normal & Vertical)'],
    ['Exibir Ângulo de Desvio (θ)', 'Display Deflection Angle (θ)'],
    ['Posição do Ponto P (ECEF):', 'Point P Position (ECEF):'],
    ['Eixo X (Greenwich):', 'X-Axis (Greenwich):'],
    ['Eixo Y (90° E):', 'Y-Axis (90° E):'],
    ['Eixo Z (Polo Norte):', 'Z-Axis (North Pole):'],
    ['Exibir Triedro ECEF', 'Show ECEF Triad'],
    ['Exibir Linhas de Projeção nos Planos', 'Show Plane Projection Lines'],
    ['Exibir Esfera / Elipsoide de Referência', 'Show Reference Surface'],
    ['Origem do Triedro ENU (Ponto de Estação):', 'ENU Origin (Station Point):'],
    ['Latitude da Origem (φ₀):', 'Origin Latitude (φ₀):'],
    ['Longitude da Origem (λ₀):', 'Origin Longitude (λ₀):'],
    ['Ponto Alvo (Vetor Observado):', 'Target Point (Observed Vector):'],
    ['Componente East (ΔE):', 'East Component (ΔE):'],
    ['Componente North (ΔN):', 'North Component (ΔN):'],
    ['Componente Up (ΔU):', 'Up Component (ΔU):'],
    ['Exibir Plano do Horizonte Local', 'Show Local Horizon Plane'],
    ['Exibir Ângulos de Azimute e Elevação', 'Show Azimuth & Elevation Angles'],
    ['Exibir Triedro ENU Local', 'Show Local ENU Triad'],
    ['Raio do Plano Topográfico:', 'Topographic Plane Radius:'],
    ['Altitude do Plano (h₀):', 'Plane Altitude (h₀):'],
    ['Exibir Curvatura Terrestre', 'Show Earth Curvature'],
    ['Exibir Distorção de Projeção', 'Show Projection Distortion'],
    ['Exibir Malha Quadriculada (Grid)', 'Show Coordinate Grid']
];

const readoutReplacements = [
    ['📐 Coordenadas Geodésicas', '📐 Geodetic Coordinates'],
    ['🌐 Coordenadas Esféricas', '🌐 Spherical Coordinates'],
    ['⭐ Coordenadas Astronômicas', '⭐ Astronomical Coordinates'],
    ['🎯 ECEF Cartesiano', '🎯 ECEF Cartesian'],
    ['🧭 Topocêntrico ENU', '🧭 Topocentric ENU'],
    ['Plano Topográfico Local', 'Local Topographic Plane'],
    ['Geometria da Seção Transversal', 'Cross-Section Geometry'],
    ['Latitude Geodésica (φ)', 'Geodetic Latitude (φ)'],
    ['Latitude Geocêntrica (φ\')', 'Geocentric Latitude (φ\')'],
    ['Redução (Δφ = φ - φ\')', 'Reduction (Δφ = φ - φ\')'],
    ['Longitude (λ)', 'Longitude (λ)'],
    ['Altura Elipsoidal (h)', 'Ellipsoidal Height (h)'],
    ['Grande Normal (N)', 'Prime Vertical (N)'],
    ['Dist. Eixo Polar (ON₁)', 'Polar Axis Dist. (ON₁)'],
    ['Coords. Cartesianas (X, Y, Z)', 'Cartesian Coords (X, Y, Z)'],
    ['Latitude Astronômica (Φ)', 'Astronomical Latitude (Φ)'],
    ['Longitude Astronômica (Λ)', 'Astronomical Longitude (Λ)'],
    ['Desvio Meridiano (ξ)', 'Meridian Deflection (ξ)'],
    ['Desvio Prim. Vert. (η)', 'Prime Vert. Deflection (η)'],
    ['Desvio Total (θ)', 'Total Deflection (θ)'],
    ['Origem ENU (φ₀, λ₀)', 'ENU Origin (φ₀, λ₀)'],
    ['Vetor (ΔE, ΔN, ΔU)', 'Vector (ΔE, ΔN, ΔU)'],
    ['Distância 3D (S)', '3D Distance (S)'],
    ['Distância Horizontal (D)', 'Horizontal Distance (D)'],
    ['Azimute (Az)', 'Azimuth (Az)'],
    ['Elevação (El)', 'Elevation (El)'],
    ['Raio =', 'Radius ='],
    ['Erro rel. =', 'Rel. error ='],
    ['Erro/km =', 'Error/km ='],
    ['φ (origem) =', 'φ (origin) ='],
    ['λ (origem) =', 'λ (origin) ='],
    ['h (alt.) =', 'h (alt.) =']
];

export function translateInteractHTML(html, lang) {
    if (lang !== 'en') return html;
    let res = html;
    for (const [pt, en] of interactReplacements) {
        res = res.replaceAll(pt, en);
    }
    return res;
}

export function translateReadoutHTML(html, lang) {
    if (lang !== 'en') return html;
    let res = html;
    for (const [pt, en] of readoutReplacements) {
        res = res.replaceAll(pt, en);
    }
    return res;
}

export function translateInteractDOM(container, lang) {
    if (!container) return;
    if (lang !== 'en') return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        let text = node.nodeValue;
        for (const [pt, en] of interactReplacements) {
            if (text.includes(pt)) {
                text = text.replaceAll(pt, en);
            }
        }
        if (text !== node.nodeValue) {
            node.nodeValue = text;
        }
    }
    container.querySelectorAll('[title]').forEach(el => {
        let title = el.getAttribute('title');
        if (!title) return;
        for (const [pt, en] of interactReplacements) {
            if (title.includes(pt)) {
                title = title.replaceAll(pt, en);
            }
        }
        el.setAttribute('title', title);
    });
}

export function translateReadoutDOM(container, lang) {
    if (!container) return;
    if (lang !== 'en') return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        let text = node.nodeValue;
        for (const [pt, en] of readoutReplacements) {
            if (text.includes(pt)) {
                text = text.replaceAll(pt, en);
            }
        }
        if (text !== node.nodeValue) {
            node.nodeValue = text;
        }
    }
}

