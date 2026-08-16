import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Geóide',
    icon: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
            <radialGradient id="geoid-icon-grad" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="40%" stop-color="#10b981"/>
                <stop offset="70%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#ef4444"/>
            </radialGradient>
        </defs>
        <!-- Bumpy geoid potato shape -->
        <path d="M16 5 C23 4, 28 9, 29 15 C30 21, 26 27, 19 28 C13 29, 5 25, 4 18 C3 11, 9 5, 16 5 Z" fill="url(#geoid-icon-grad)" opacity="0.85" stroke="#38bdf8" stroke-width="1.4"/>
        <!-- Equipotential wave lines -->
        <path d="M6 16 Q16 11, 26 17" stroke="#ffffff" stroke-width="0.9" stroke-dasharray="2 1.5" opacity="0.85"/>
        <path d="M8 21 Q16 18, 24 22" stroke="#ffffff" stroke-width="0.8" stroke-dasharray="2 1.5" opacity="0.65"/>
    </svg>`,
    subtitle: 'Superfície equipotencial gravitacional',
    cameraPosition: [4, 3, 5],

    history: `
        <h3>O Geóide</h3>
        <p>O conceito de geóide surgiu da necessidade de definir uma superfície de referência
        que respeitasse o <strong>campo gravitacional real</strong> da Terra, e não apenas sua geometria geométrica idealizada.</p>

        <p><strong>Johann Benedict Listing</strong> cunhou o termo <em>"Geoid"</em> em 1873 (do grego <em>ge</em> = Terra + <em>eidos</em> = forma), definindo-o
        como a superfície equipotencial do campo gravitacional terrestre que coincide com o nível médio dos oceanos em repouso prolongado através dos continentes.</p>

        <p><strong>Sir George Gabriel Stokes</strong> (1849) desenvolveu a teoria matemática para determinar
        o geóide a partir de medições de anomalias de gravidade na superfície terrestre (Fórmula de Stokes).</p>

        <p><strong>Friedrich Robert Helmert</strong> sistematizou a geodésia física moderna, criando métodos de condensação topográfica para aplicação prática da teoria de Stokes.</p>

        <p>No século XXI, missões de satélites gravimétricos dedicados como <strong>GRACE</strong> (NASA/DLR) e <strong>GOCE</strong> (ESA), juntamente com o modelo global <strong>EGM2008</strong>, permitiram mapear o geóide global com precisão centimétrica e resolução espacial sem precedentes.</p>

        <div class="figures-list">
            <div class="figure-card" data-figure-id="listing">
                <div class="figure-avatar">L</div>
                <div class="figure-info">
                    <div class="figure-name">J. B. Listing</div>
                    <div class="figure-years">1808–1882</div>
                    <div class="figure-contribution">Cunhou o termo "geóide" (1873)</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="stokes">
                <div class="figure-avatar">S</div>
                <div class="figure-info">
                    <div class="figure-name">George G. Stokes</div>
                    <div class="figure-years">1819–1903</div>
                    <div class="figure-contribution">Fórmula de Stokes para determinação do geóide</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="helmert">
                <div class="figure-avatar">V</div>
                <div class="figure-info">
                    <div class="figure-name">Friedrich R. Helmert</div>
                    <div class="figure-years">1843–1917</div>
                    <div class="figure-contribution">Fundador da geodésia física moderna</div>
                </div>
            </div>
        </div>
    `,

    howItWorks: `
        <h3>O que é o Geóide?</h3>
        <p>O geóide é a <strong>superfície equipotencial</strong> ($W = W_0 = \\text{constante}$) do campo de gravidade da Terra que melhor se ajusta ao Nível Médio do Mar (NMM) global em repouso. Em cada ponto da superfície, o vetor da gravidade real ($\\vec{g}$) é rigorosamente perpendicular ao geóide.</p>

        <h4>A Relação Fundamental das Altitudes</h4>
        <p style="text-align: center; font-size: 1.1em; color: var(--accent-primary); font-family: monospace; margin: 10px 0;">
            h = H + N
        </p>
        <p>• <strong>h</strong>: Altitude elipsoidal (obtida por receptores GNSS/GPS, medida a partir do elipsóide de referência WGS84).</p>
        <p>• <strong>H</strong>: Altitude ortométrica (altitude física acima do nível do mar, obtida por nivelamento geométrico e gravimetria).</p>
        <p>• <strong>N</strong>: <em>Ondulação geoidal</em> (a separação vertical entre o geóide e o elipsóide).</p>

        <h4>Extremos Globais Reais</h4>
        <p>A ondulação geoidal na Terra varia entre aproximadamente <strong>−106 m</strong> e <strong>+85 m</strong>:</p>
        <p>• <strong>Depressão do Oceano Índico (IOGL)</strong>: ~$−106\\text{ m}$ (o maior déficit gravimétrico da Terra, gerado por convecção no manto e restos de placas antigas).</p>
        <p>• <strong>Domo da Nova Guiné / Indonésia</strong>: ~$+85\\text{ m}$ (máximo global devido ao intenso soerguimento do manto e subducção).</p>
        <p>• <strong>Alto da Islândia / Atlântico Norte</strong>: ~$+68\\text{ m}$ (pluma mantélica quente associada à dorsal meso-atlântica).</p>
        <p>• <strong>Depressão da Baía de Hudson</strong>: ~$−58\\text{ m}$ (déficit de massa isostático pós-glacial da calota Laurentide).</p>

        <h4>Desvio da Vertical ($\\theta$)</h4>
        <p>Como o geóide é irregular, a normal ao geóide (direção do fio de prumo $\\vec{g}$) não coincide exatamente com a normal ao elipsóide ($\\vec{\\gamma}$). O ângulo entre elas é o <strong>desvio da vertical</strong> ($\\theta$), essencial para correções astronômicas e geodésicas de alta precisão.</p>
    `,
};

// ============================================
// Real Earth Spherical Harmonics & Geoid Model
// ============================================
// Returns realistic geoid undulation N in meters (range: ~-106m to +89m)
export function geoidUndulationMeters(latRad, lonRad) {
    const sinP = Math.sin(latRad);
    const cosP = Math.cos(latRad);

    // Fully normalized Legendre harmonics (Degrees 2 to 4)
    const P20 = Math.sqrt(5) / 2.0 * (3 * sinP * sinP - 1);
    const P21 = Math.sqrt(15) * sinP * cosP;
    const P22 = Math.sqrt(15) / 2.0 * cosP * cosP;

    const P30 = Math.sqrt(7) / 2.0 * (5 * sinP * sinP * sinP - 3 * sinP);
    const P31 = Math.sqrt(21 / 4.0) * cosP * (5 * sinP * sinP - 1);
    const P32 = Math.sqrt(105) / 2.0 * sinP * cosP * cosP;
    const P33 = Math.sqrt(35 / 8.0) * cosP * cosP * cosP;

    const P40 = 3 / 8.0 * (35 * Math.pow(sinP, 4) - 30 * sinP * sinP + 3);
    const P41 = Math.sqrt(45 / 4.0) * cosP * (7 * Math.pow(sinP, 3) - 3 * sinP);
    const P42 = Math.sqrt(45 / 8.0) * cosP * cosP * (7 * sinP * sinP - 1);
    const P43 = Math.sqrt(315 / 4.0) * sinP * Math.pow(cosP, 3);
    const P44 = Math.sqrt(315 / 64.0) * Math.pow(cosP, 4);

    let N = 0.0;
    N += P20 * -1.5;
    N += P21 * (2.1 * Math.cos(lonRad) - 1.4 * Math.sin(lonRad));
    N += P22 * (4.2 * Math.cos(2 * lonRad) - 3.8 * Math.sin(2 * lonRad));

    N += P30 * 5.5;
    N += P31 * (3.8 * Math.cos(lonRad) + 4.2 * Math.sin(lonRad));
    N += P32 * (2.6 * Math.cos(2 * lonRad) - 2.1 * Math.sin(2 * lonRad));
    N += P33 * (3.4 * Math.cos(3 * lonRad) + 4.1 * Math.sin(3 * lonRad));

    N += P40 * -2.2;
    N += P41 * (-1.8 * Math.cos(lonRad) + 2.0 * Math.sin(lonRad));
    N += P42 * (-2.5 * Math.cos(2 * lonRad) + 2.8 * Math.sin(2 * lonRad));
    N += P43 * (1.9 * Math.cos(3 * lonRad) - 2.2 * Math.sin(3 * lonRad));
    N += P44 * (-1.5 * Math.cos(4 * lonRad) - 1.6 * Math.sin(4 * lonRad));

    // Great circle angular distances to major regional Earth gravity anomalies
    // 1. Indian Ocean Geoid Low (IOGL: lat -7°, lon 78°) -> N ~ -106m
    const dIOGL = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(-7 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(-7 * Math.PI / 180) * Math.cos(lonRad - 78 * Math.PI / 180)
    )));
    const iogl = -70.0 * Math.exp(-Math.pow(dIOGL / 0.52, 2));

    // 2. New Guinea / West Pacific High (lat -4°, lon 146°) -> N ~ +85m
    const dNGH = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(-4 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(-4 * Math.PI / 180) * Math.cos(lonRad - 146 * Math.PI / 180)
    )));
    const ngh = +50.0 * Math.exp(-Math.pow(dNGH / 0.58, 2));

    // 3. North Atlantic / Iceland High (lat 60°, lon -25°) -> N ~ +68m
    const dNAH = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(60 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(60 * Math.PI / 180) * Math.cos(lonRad - (-25 * Math.PI / 180))
    )));
    const nah = +38.0 * Math.exp(-Math.pow(dNAH / 0.62, 2));

    // 4. Hudson Bay Low (lat 56°, lon -85°) -> N ~ -58m
    const dHBL = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(56 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(56 * Math.PI / 180) * Math.cos(lonRad - (-85 * Math.PI / 180))
    )));
    const hbl = -32.0 * Math.exp(-Math.pow(dHBL / 0.48, 2));

    // 5. Andes / South American High (lat -20°, lon -68°) -> N ~ +42m
    const dSAH = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(-20 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(-20 * Math.PI / 180) * Math.cos(lonRad - (-68 * Math.PI / 180))
    )));
    const sah = +24.0 * Math.exp(-Math.pow(dSAH / 0.50, 2));

    // 6. Afar / East Africa High (lat 12°, lon 42°) -> N ~ +35m
    const dAFR = Math.acos(Math.max(-1.0, Math.min(1.0,
        Math.sin(latRad) * Math.sin(12 * Math.PI / 180) +
        Math.cos(latRad) * Math.cos(12 * Math.PI / 180) * Math.cos(lonRad - 42 * Math.PI / 180)
    )));
    const afr = +18.0 * Math.exp(-Math.pow(dAFR / 0.45, 2));

    return N + iogl + ngh + nah + hbl + sah + afr;
}

// Scientific GOCE / GRACE Multi-Stop Color Map
function getGeoidColor(N, isOcean = false) {
    if (isOcean) {
        // Realistic deep ocean shader with subtle tint
        const t = Math.max(0, Math.min(1, (N + 106) / (85 + 106)));
        return [0.08 + t * 0.1, 0.28 + t * 0.25, 0.55 + t * 0.35];
    }

    // Normalized from -106m to +85m
    const minN = -106;
    const maxN = 85;
    const t = Math.max(0, Math.min(1, (N - minN) / (maxN - minN)));

    // 7-Color Scientific Gradient: Navy -> Royal Blue -> Cyan -> Emerald Green -> Yellow -> Orange -> Crimson
    const stops = [
        { pos: 0.00, r: 0.03, g: 0.11, b: 0.35 }, // -106m (Deep Navy)
        { pos: 0.18, r: 0.13, g: 0.37, b: 0.66 }, // -70m (Ocean Blue)
        { pos: 0.36, r: 0.25, g: 0.71, b: 0.77 }, // -35m (Cyan)
        { pos: 0.55, r: 0.50, g: 0.80, b: 0.45 }, //  0m (Emerald Green)
        { pos: 0.72, r: 0.99, g: 0.85, b: 0.46 }, // +30m (Gold / Yellow)
        { pos: 0.86, r: 0.99, g: 0.55, b: 0.24 }, // +60m (Warm Orange)
        { pos: 1.00, r: 0.85, g: 0.10, b: 0.18 }, // +85m (Crimson Red)
    ];

    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].pos && t <= stops[i + 1].pos) {
            const f = (t - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
            return [
                stops[i].r + f * (stops[i + 1].r - stops[i].r),
                stops[i].g + f * (stops[i + 1].g - stops[i].g),
                stops[i].b + f * (stops[i + 1].b - stops[i].b),
            ];
        }
    }
    return [stops[stops.length - 1].r, stops[stops.length - 1].g, stops[stops.length - 1].b];
}

// Major Global Continents Coastlines Coordinates (approximate vector polylines in degrees)
const worldCoastlines = [
    // South America
    [[-80, 9], [-75, 11], [-60, 10], [-50, 0], [-35, -5], [-38, -13], [-41, -21], [-48, -28], [-53, -33], [-58, -38], [-65, -45], [-68, -55], [-75, -50], [-73, -40], [-71, -30], [-76, -14], [-81, -5], [-80, 2], [-80, 9]],
    // North America
    [[-165, 65], [-140, 70], [-120, 70], [-90, 70], [-80, 60], [-60, 50], [-65, 45], [-75, 35], [-80, 25], [-90, 30], [-97, 26], [-90, 20], [-85, 15], [-78, 8], [-85, 13], [-105, 20], [-115, 30], [-124, 40], [-125, 50], [-135, 58], [-165, 65]],
    // Africa
    [[-6, 36], [10, 37], [25, 32], [34, 28], [43, 12], [51, 11], [42, -5], [35, -20], [32, -28], [20, -35], [15, -23], [12, -15], [9, 4], [-13, 9], [-17, 15], [-12, 26], [-6, 36]],
    // Eurasia
    [[-9, 39], [0, 43], [10, 44], [15, 40], [25, 40], [35, 36], [55, 25], [60, 23], [70, 20], [77, 8], [80, 13], [85, 20], [95, 17], [100, 14], [104, 1], [108, 15], [120, 23], [122, 30], [120, 38], [130, 42], [140, 50], [160, 55], [170, 65], [180, 68], [140, 72], [100, 76], [60, 70], [40, 68], [25, 71], [10, 60], [5, 53], [-4, 48], [-9, 43], [-9, 39]],
    // Australia
    [[114, -22], [125, -15], [135, -12], [142, -11], [146, -18], [153, -28], [150, -37], [140, -38], [130, -32], [115, -34], [114, -22]],
    // Antarctica
    [[-60, -64], [0, -70], [60, -66], [120, -66], [160, -72], [-160, -75], [-120, -73], [-80, -72], [-60, -64]],
    // Greenland
    [[-50, 60], [-40, 65], [-20, 75], [-30, 83], [-55, 82], [-58, 70], [-50, 60]],
    // Madagascar
    [[44, -12], [50, -15], [47, -25], [44, -25], [44, -12]],
    // British Isles
    [[-5, 50], [1, 51], [0, 53], [-2, 57], [-5, 58], [-5, 55], [-5, 50]],
    // Japan
    [[131, 33], [135, 34], [140, 36], [141, 41], [141, 45], [144, 44], [139, 35], [131, 33]],
    // New Zealand
    [[168, -46], [171, -43], [174, -41], [178, -38], [175, -36], [173, -42], [168, -46]],
];

// Major Global Geoid Landmarks / Anomalies
export const geoidLandmarks = [
    {
        id: 'iogl',
        name: 'Depressão do Oceano Índico (IOGL)',
        lat: -7,
        lon: 78,
        N: -106,
        type: 'low',
        color: '#38bdf8',
        desc: 'O ponto mais baixo do geóide no planeta (−106 m). Provocado por um enorme déficit de densidade de massa no manto inferior, associado ao afundamento de placas antigas (Tétis).',
    },
    {
        id: 'ngh',
        name: 'Domo da Nova Guiné / Pacífico Oeste',
        lat: -4,
        lon: 146,
        N: +85,
        type: 'high',
        color: '#ef4444',
        desc: 'O ponto mais alto do geóide global (+85 m). Formado pelo intenso soerguimento por convecção mantélica e empilhamento de placas convergentes na região indo-australiana.',
    },
    {
        id: 'nah',
        name: 'Alto da Islândia / Atlântico Norte',
        lat: 60,
        lon: -25,
        N: +68,
        type: 'high',
        color: '#f59e0b',
        desc: 'Forte elevação geoidal (+68 m) causada pela pluma mantélica quente da Islândia e pela expansão ativa ao longo da dorsal meso-atlântica.',
    },
    {
        id: 'hbl',
        name: 'Depressão da Baía de Hudson',
        lat: 56,
        lon: -85,
        N: -58,
        type: 'low',
        color: '#60a5fa',
        desc: 'Depressão geoidal (−58 m) remanescente do afundamento do manto durante a última glaciação sob a gigantesca calota de gelo Laurentide (ajuste isostático pós-glacial).',
    },
    {
        id: 'sah',
        name: 'Alto dos Andes / América do Sul',
        lat: -20,
        lon: -68,
        N: +42,
        type: 'high',
        color: '#fbbf24',
        desc: 'Elevação geoidal (+42 m) associada à raiz crustal espessada da cordilheira andina e à subducção ativa da placa de Nazca sob a América do Sul.',
    },
    {
        id: 'afr',
        name: 'Domo de Afar / Leste Africano',
        lat: 12,
        lon: 42,
        N: +35,
        type: 'high',
        color: '#fb923c',
        desc: 'Anomalia positiva (+35 m) ligada à superpluma mantélica africana e à abertura do Rifte do Leste Africano.',
    },
];

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    // State parameters
    let exaggeration = 0.005; // Base visual multiplier: ~0.005 * 100m = ~0.5 units of deformation
    let showRefEllipsoid = true;
    let showCoastlines = true;
    let showDeviationRods = false;
    let showLandmarks = true;
    let showIsolines = true;
    let showDeflection = false;
    let showColorScale = true;
    let autoRotate = true;
    let selectedLandmarkId = null;

    const baseRadius = 2.0;
    const segments = 128; // High resolution mesh

    // Materials
    const refEllipsoidMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
    });

    const coastlineMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
    });

    let geoidMesh, refMesh;
    let landmarkObjects = [];
    let landmarkRings = [];

    // Helper: Convert lat/lon (deg) to 3D position on deformed geoid
    function latLonToGeoidPos(latDeg, lonDeg, extraOffset = 0) {
        const latRad = latDeg * Math.PI / 180;
        const lonRad = lonDeg * Math.PI / 180;

        const N = geoidUndulationMeters(latRad, lonRad);
        const r = baseRadius + (N * exaggeration) + extraOffset;

        // Spherical to Cartesian (Three.js coordinate system: Y is North Pole)
        const x = r * Math.cos(latRad) * Math.sin(lonRad);
        const y = r * Math.sin(latRad);
        const z = r * Math.cos(latRad) * Math.cos(lonRad);

        return new THREE.Vector3(x, y, z);
    }

    // Helper: Convert lat/lon (deg) to 3D position on reference ellipsoid
    function latLonToEllipsoidPos(latDeg, lonDeg) {
        const latRad = latDeg * Math.PI / 180;
        const lonRad = lonDeg * Math.PI / 180;
        const f = 1 / 298.257; // WGS84 flattening
        const b = baseRadius * (1 - f);
        const a = baseRadius;

        const cosLat = Math.cos(latRad);
        const sinLat = Math.sin(latRad);

        const x = a * cosLat * Math.sin(lonRad);
        const y = b * sinLat;
        const z = a * cosLat * Math.cos(lonRad);

        return new THREE.Vector3(x, y, z);
    }

    function buildScene() {
        // Clear previous objects
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        landmarkObjects = [];
        landmarkRings = [];

        // 1. Deformed Geoid 3D Mesh
        const geoidGeo = new THREE.SphereGeometry(baseRadius, segments, segments);
        const positions = geoidGeo.attributes.position;
        const colors = new Float32Array(positions.count * 3);

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            const r = Math.sqrt(x * x + y * y + z * z);
            if (r < 0.0001) continue;

            const latRad = Math.asin(y / r);
            const lonRad = Math.atan2(x, z);

            const N = geoidUndulationMeters(latRad, lonRad);
            const deformedRadius = baseRadius + (N * exaggeration);
            const scale = deformedRadius / r;

            positions.setX(i, x * scale);
            positions.setY(i, y * scale);
            positions.setZ(i, z * scale);

            const [cr, cg, cb] = getGeoidColor(N, !showColorScale);
            colors[i * 3] = cr;
            colors[i * 3 + 1] = cg;
            colors[i * 3 + 2] = cb;
        }

        geoidGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geoidGeo.computeVertexNormals();

        const geoidMat = new THREE.MeshPhongMaterial({
            vertexColors: true,
            specular: 0x223344,
            shininess: 40,
            transparent: true,
            opacity: 0.96,
            side: THREE.DoubleSide,
        });

        geoidMesh = new THREE.Mesh(geoidGeo, geoidMat);
        group.add(geoidMesh);

        // 2. Reference Ellipsoid Mesh
        if (showRefEllipsoid) {
            const refGeo = new THREE.SphereGeometry(baseRadius, 48, 48);
            // Apply slight polar flattening to reference ellipsoid
            refGeo.scale(1, 1 - (1 / 298.257) * 4, 1); // 4x visible flattening for clear visual distinction
            refMesh = new THREE.Mesh(refGeo, refEllipsoidMat);
            group.add(refMesh);
        }

        // 3. Continental Coastlines
        if (showCoastlines) {
            worldCoastlines.forEach(poly => {
                const points = [];
                for (let i = 0; i < poly.length; i++) {
                    const [lon, lat] = poly[i];
                    points.push(latLonToGeoidPos(lat, lon, 0.005));
                }
                const coastGeo = new THREE.BufferGeometry().setFromPoints(points);
                const coastLine = new THREE.Line(coastGeo, coastlineMat);
                group.add(coastLine);
            });
        }

        // 4. Undulation Deviation Rods (Hastores N)
        if (showDeviationRods) {
            const rodPoints = [];
            const rodColors = [];

            for (let lat = -80; lat <= 80; lat += 20) {
                for (let lon = -180; lon < 180; lon += 20) {
                    const latRad = lat * Math.PI / 180;
                    const lonRad = lon * Math.PI / 180;
                    const N = geoidUndulationMeters(latRad, lonRad);

                    const pEll = latLonToEllipsoidPos(lat, lon);
                    const pGeo = latLonToGeoidPos(lat, lon);

                    rodPoints.push(pEll, pGeo);

                    const [cr, cg, cb] = N >= 0 ? [0.99, 0.65, 0.2] : [0.2, 0.65, 0.99];
                    rodColors.push(cr, cg, cb, cr, cg, cb);
                }
            }

            const rodsGeo = new THREE.BufferGeometry().setFromPoints(rodPoints);
            rodsGeo.setAttribute('color', new THREE.Float32BufferAttribute(rodColors, 3));
            const rodsMat = new THREE.LineSegmentsMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.75,
                linewidth: 2,
            });
            group.add(new THREE.LineSegments(rodsGeo, rodsMat));
        }

        // 5. Isoline Contours (Equipotential Curves)
        if (showIsolines) {
            const isoMatZero = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.7 });
            const isoMatNeg = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
            const isoMatPos = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 });

            // Tracing latitude contour approximations
            for (let lat = -85; lat <= 85; lat += 10) {
                const pts = [];
                for (let lon = -180; lon <= 180; lon += 4) {
                    pts.push(latLonToGeoidPos(lat, lon, 0.003));
                }
                const isoGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const mat = lat === 0 ? isoMatZero : (lat > 0 ? isoMatPos : isoMatNeg);
                group.add(new THREE.Line(isoGeo, mat));
            }
        }

        // 6. Global Geoid Anomaly Landmarks (3D Pins & Pulsing Rings)
        if (showLandmarks) {
            geoidLandmarks.forEach(lm => {
                const pos = latLonToGeoidPos(lm.lat, lm.lon, 0.02);

                // Pin Sphere
                const pinGeo = new THREE.SphereGeometry(0.045, 16, 16);
                const pinMat = new THREE.MeshBasicMaterial({ color: lm.color });
                const pinMesh = new THREE.Mesh(pinGeo, pinMat);
                pinMesh.position.copy(pos);
                pinMesh.userData = { landmark: lm };
                group.add(pinMesh);
                landmarkObjects.push(pinMesh);

                // Pulsing Ring
                const ringGeo = new THREE.RingGeometry(0.06, 0.08, 32);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: lm.color,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6,
                });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                ringMesh.position.copy(pos);
                ringMesh.lookAt(pos.clone().multiplyScalar(2));
                group.add(ringMesh);
                landmarkRings.push(ringMesh);
            });
        }

        // 7. Deflection of the Vertical Vectors (Plumbline vs Ellipsoid normal)
        if (showDeflection) {
            const defPoints = [];
            const defColors = [];

            for (let lat = -60; lat <= 60; lat += 30) {
                for (let lon = -150; lon <= 150; lon += 60) {
                    const basePos = latLonToGeoidPos(lat, lon, 0.01);
                    const latRad = lat * Math.PI / 180;
                    const lonRad = lon * Math.PI / 180;

                    // Ellipsoidal normal vector (radial approx)
                    const nEll = basePos.clone().normalize();
                    const pEllEnd = basePos.clone().add(nEll.clone().multiplyScalar(0.35));

                    // Geoid normal vector (with small deflection tilt proportional to dN)
                    const delta = 0.02;
                    const n1 = geoidUndulationMeters(latRad + delta, lonRad);
                    const n0 = geoidUndulationMeters(latRad - delta, lonRad);
                    const dN_dlat = (n1 - n0) / (2 * delta);

                    const tiltAxis = new THREE.Vector3(-Math.sin(lonRad), 0, Math.cos(lonRad)).normalize();
                    const nGeo = nEll.clone().applyAxisAngle(tiltAxis, dN_dlat * 0.003).normalize();
                    const pGeoEnd = basePos.clone().add(nGeo.clone().multiplyScalar(0.35));

                    // Green line = Ellipsoid normal (\gamma)
                    defPoints.push(basePos, pEllEnd);
                    defColors.push(0.2, 0.9, 0.4, 0.2, 0.9, 0.4);

                    // Red/Amber line = True gravity vector (g)
                    defPoints.push(basePos, pGeoEnd);
                    defColors.push(0.95, 0.3, 0.2, 0.95, 0.3, 0.2);
                }
            }

            const defGeo = new THREE.BufferGeometry().setFromPoints(defPoints);
            defGeo.setAttribute('color', new THREE.Float32BufferAttribute(defColors, 3));
            const defMat = new THREE.LineSegmentsMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                linewidth: 2,
            });
            group.add(new THREE.LineSegments(defGeo, defMat));
        }
    }

    buildScene();

    camera.position.set(4, 3, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    function update(time, delta) {
        if (autoRotate) {
            group.rotation.y += delta * 0.15;
        }

        // Pulse landmark rings
        if (landmarkRings.length > 0) {
            const scale = 1.0 + 0.25 * Math.sin(time * 3.5);
            landmarkRings.forEach(ring => {
                ring.scale.set(scale, scale, 1);
            });
        }
    }

    function cleanup() {
        group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
        scene.remove(group);
    }

    function focusOnLandmark(landmark) {
        selectedLandmarkId = landmark.id;
        autoRotate = false;

        const autoRotCheckbox = document.getElementById('ctrl-geoid-auto-rot');
        if (autoRotCheckbox) autoRotCheckbox.checked = false;

        // Calculate target camera position facing the landmark
        const latRad = landmark.lat * Math.PI / 180;
        const lonRad = landmark.lon * Math.PI / 180;
        const dist = 5.2;

        const targetX = dist * Math.cos(latRad) * Math.sin(lonRad);
        const targetY = dist * Math.sin(latRad);
        const targetZ = dist * Math.cos(latRad) * Math.cos(lonRad);

        // Smooth camera transition
        const startPos = camera.position.clone();
        const endPos = new THREE.Vector3(targetX, targetY, targetZ);
        let progress = 0;

        function animateCam() {
            progress += 0.04;
            if (progress <= 1) {
                camera.position.lerpVectors(startPos, endPos, progress);
                controls.update();
                requestAnimationFrame(animateCam);
            }
        }
        animateCam();

        // Update details card in UI
        const infoDiv = document.getElementById('geoid-landmark-details');
        if (infoDiv) {
            infoDiv.innerHTML = `
                <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid ${landmark.color}; border-radius: 8px; padding: 10px 12px; margin-top: 8px; animation: fadeIn 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: ${landmark.color}; font-size: 0.85rem;">${landmark.name}</span>
                        <span style="background: ${landmark.color}; color: #070b14; font-weight: 800; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">N = ${landmark.N > 0 ? '+' : ''}${landmark.N} m</span>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 6px 0 0 0; line-height: 1.35;">
                        ${landmark.desc}
                    </p>
                </div>
            `;
        }
    }

    function createControls(container) {
        container.innerHTML = `
            <div class="controls-section">
                <!-- Exaggeration Slider -->
                <div class="control-group">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label for="ctrl-geoid-exag">Exagero da deformação do Geóide:</label>
                        <span class="value-display" id="geoid-exag-val" style="font-size: 0.85rem; font-weight: 700; color: var(--accent-primary);">
                            ${(exaggeration * 10000).toFixed(0)}x
                        </span>
                    </div>
                    <input type="range" id="ctrl-geoid-exag" min="0" max="0.012" step="0.0005" value="${exaggeration}">
                    <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-muted);">
                        <span>0x (Escala 1:1)</span>
                        <span>50.000x (Padrão)</span>
                        <span>120.000x (Máximo)</span>
                    </div>
                </div>

                <!-- Feature Toggles -->
                <div class="control-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-ref-ell" ${showRefEllipsoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Elipsóide WGS84</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-coast" ${showCoastlines ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Continentes</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-landmarks" ${showLandmarks ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Anomalias (Pins)</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-isolines" ${showIsolines ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Isolinhas de N</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-rods" ${showDeviationRods ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Vetores N (Hastores)</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-deflection" ${showDeflection ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Desvio da Vertical</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-colors" ${showColorScale ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Mapa GOCE/GRACE</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoid-auto-rot" ${autoRotate ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Rotação contínua</span>
                    </label>
                </div>

                <!-- Scientific Colorbar Legend -->
                <div style="margin-top: 6px; padding: 10px; background: rgba(15, 23, 42, 0.7); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">
                        <span>Ondulação Geoidal N (metros):</span>
                    </div>
                    <!-- Color gradient bar -->
                    <div style="height: 12px; width: 100%; border-radius: 3px; background: linear-gradient(to right, #081d58, #225ea8, #41b6c4, #7fcdbb, #c7e9b4, #fed976, #fd8d3c, #bd0026); border: 1px solid rgba(255,255,255,0.15);"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.68rem; font-family: monospace; color: var(--text-secondary); margin-top: 3px;">
                        <span style="color: #60a5fa;">−106 m</span>
                        <span style="color: #7fcdbb;">−50 m</span>
                        <span style="color: #c7e9b4;">0 m</span>
                        <span style="color: #fed976;">+40 m</span>
                        <span style="color: #ef4444;">+85 m</span>
                    </div>
                </div>

                <!-- Quick Focus Landmark Buttons -->
                <div style="margin-top: 6px;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 6px;">
                        Navegar para Anomalias Globais:
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                        <button class="btn btn-secondary landmark-btn" data-lmid="iogl" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #38bdf8;">
                            🔵 Oceano Índico (−106 m)
                        </button>
                        <button class="btn btn-secondary landmark-btn" data-lmid="ngh" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #ef4444;">
                            🔴 Nova Guiné (+85 m)
                        </button>
                        <button class="btn btn-secondary landmark-btn" data-lmid="nah" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #f59e0b;">
                            🟠 Atlântico Norte (+68 m)
                        </button>
                        <button class="btn btn-secondary landmark-btn" data-lmid="hbl" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #60a5fa;">
                            🔵 Baía de Hudson (−58 m)
                        </button>
                        <button class="btn btn-secondary landmark-btn" data-lmid="sah" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #fbbf24;">
                            🟡 Andes / Am. Sul (+42 m)
                        </button>
                        <button class="btn btn-secondary landmark-btn" data-lmid="afr" style="font-size: 0.72rem; padding: 6px 8px; text-align: left; border-left: 3px solid #fb923c;">
                            🟡 Domo de Afar (+35 m)
                        </button>
                    </div>
                    <div id="geoid-landmark-details"></div>
                </div>
            </div>
        `;

        // Bind events
        container.querySelector('#ctrl-geoid-exag').addEventListener('input', e => {
            exaggeration = parseFloat(e.target.value);
            container.querySelector('#geoid-exag-val').textContent = `${(exaggeration * 10000).toFixed(0)}x`;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-ref-ell').addEventListener('change', e => {
            showRefEllipsoid = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-coast').addEventListener('change', e => {
            showCoastlines = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-landmarks').addEventListener('change', e => {
            showLandmarks = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-isolines').addEventListener('change', e => {
            showIsolines = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-rods').addEventListener('change', e => {
            showDeviationRods = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-deflection').addEventListener('change', e => {
            showDeflection = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-colors').addEventListener('change', e => {
            showColorScale = e.target.checked;
            buildScene();
        });

        container.querySelector('#ctrl-geoid-auto-rot').addEventListener('change', e => {
            autoRotate = e.target.checked;
        });

        // Landmark quick focus buttons
        container.querySelectorAll('.landmark-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lmid = btn.dataset.lmid;
                const lm = geoidLandmarks.find(item => item.id === lmid);
                if (lm) focusOnLandmark(lm);
            });
        });
    }

    return { update, cleanup, createControls };
}
