import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Coordenadas Geodésicas',
    icon: '📐',
    subtitle: 'Latitude, Longitude e Altura Elipsoidal (φ, λ, h)',
    cameraPosition: [4.8, 3.4, 4.8],

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
    `,
};

// ============================================
// Text Sprite Helper
// ============================================
function makeTextSprite(text, color = 0xffffff, size = 0.32, background = false) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 384;
    canvas.height = 96;

    ctx.font = 'bold 36px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (background) {
        ctx.fillStyle = 'rgba(7, 11, 20, 0.75)';
        ctx.beginPath();
        ctx.roundRect(12, 12, 360, 72, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const hex = '#' + new THREE.Color(color).getHexString();
    ctx.fillStyle = hex;
    ctx.fillText(text, 192, 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size * 4, size, 1);
    return sprite;
}

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    // Ellipsoid base parameters
    const a = 2.0; // semi-major axis
    let f = 1 / 298.257; // flattening
    let fExag = 15.0; // flattening exaggeration
    let phi = 45; // latitude in degrees
    let lambda = 40; // longitude in degrees
    let hVal = 0.5; // height above ellipsoid

    // Cutaway & visibility state
    let cutMode = 'wedge'; // 'wedge', 'quadrant', 'meridian', 'none'
    let showNormal = true;
    let showGeocentric = true;
    let showEquatorialPlane = true;
    let showMeridianPlane = true;
    let showAngles = true;
    let showAxes = true;
    let showMeridians = true;
    let showParallels = true;

    // Camera animation state
    let isCameraAnimating = false;
    let cameraStartPos = new THREE.Vector3();
    let cameraEndPos = new THREE.Vector3();
    let targetStartPos = new THREE.Vector3();
    let targetEndPos = new THREE.Vector3();
    let animProgress = 0;

    // Materials
    const shellMat = new THREE.MeshPhongMaterial({
        color: 0x144265,
        emissive: 0x051829,
        specular: 0x38bdf8,
        shininess: 35,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const meridianCutMat = new THREE.MeshPhongMaterial({
        color: 0x0f2742,
        emissive: 0x051220,
        specular: 0x60a5fa,
        shininess: 40,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
    });

    const equatorialCutMat = new THREE.MeshPhongMaterial({
        color: 0x082b24,
        emissive: 0x031410,
        specular: 0x34d399,
        shininess: 40,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
    });

    const greenwichCutMat = new THREE.MeshPhongMaterial({
        color: 0x122338,
        emissive: 0x05101c,
        specular: 0x38bdf8,
        shininess: 30,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
    });

    const sectorPhiMat = new THREE.MeshBasicMaterial({
        color: 0xff6644,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthTest: false,
    });

    const sectorPhiPrimeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthTest: false,
    });

    const sectorLambdaMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthTest: false,
    });

    const normalMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    const geocentricMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const heightMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44, linewidth: 2 });
    const greenwichMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const meridianMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.28 });
    const parallelMat = new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.22 });
    const axisMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
    const arcPhiMat = new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2 });
    const arcPhiPrimeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const arcLambdaMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const gridLineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.25 });

    function getB() {
        const fEff = f * fExag;
        return a * (1 - fEff);
    }

    function getEcc2() {
        const b = getB();
        return Math.max(0, 1 - (b * b) / (a * a));
    }

    function getN(phiRad) {
        const e2 = getEcc2();
        return a / Math.sqrt(1 - e2 * Math.sin(phiRad) * Math.sin(phiRad));
    }

    // Point on ellipsoid surface (x: Greenwich, y: Polar North, z: 90° East)
    function ellipsoidPoint(latDeg, lonDeg, h = 0) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();
        const N = getN(phiRad);

        const x = (N + h) * Math.cos(phiRad) * Math.cos(lamRad);
        const z = (N + h) * Math.cos(phiRad) * Math.sin(lamRad);
        const y = (N * (1 - e2) + h) * Math.sin(phiRad);

        return new THREE.Vector3(x, y, z);
    }

    // Normal vector to ellipsoid at lat/lon (unit vector)
    function ellipsoidNormal(latDeg, lonDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            Math.cos(phiRad) * Math.cos(lamRad),
            Math.sin(phiRad),
            Math.cos(phiRad) * Math.sin(lamRad)
        ).normalize();
    }

    // Intersection of normal with polar Y axis: N1 = (0, -e² N sin(phi), 0)
    function getNormalAxisIntersection(latDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const e2 = getEcc2();
        const N = getN(phiRad);
        return new THREE.Vector3(0, -e2 * N * Math.sin(phiRad), 0);
    }

    // Geocentric latitude phi'
    function getGeocentricLatDeg(latDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const e2 = getEcc2();
        const phiPrimeRad = Math.atan((1 - e2) * Math.tan(phiRad));
        return THREE.MathUtils.radToDeg(phiPrimeRad);
    }

    // Helper: generate sliced ellipsoid outer mesh
    function createSlicedEllipsoidMesh(lamStartDeg, lamEndDeg) {
        const phiSegments = 64;
        const lamSegments = 64;
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const e2 = getEcc2();

        for (let i = 0; i <= phiSegments; i++) {
            const v = i / phiSegments;
            const phiDeg = -90 + v * 180;
            const phiRad = THREE.MathUtils.degToRad(phiDeg);
            const N = getN(phiRad);

            for (let j = 0; j <= lamSegments; j++) {
                const u = j / lamSegments;
                const lamDeg = lamStartDeg + u * (lamEndDeg - lamStartDeg);
                const lamRad = THREE.MathUtils.degToRad(lamDeg);

                const x = N * Math.cos(phiRad) * Math.cos(lamRad);
                const z = N * Math.cos(phiRad) * Math.sin(lamRad);
                const y = N * (1 - e2) * Math.sin(phiRad);

                positions.push(x, y, z);

                // Normal vector
                const nx = Math.cos(phiRad) * Math.cos(lamRad);
                const ny = Math.sin(phiRad);
                const nz = Math.cos(phiRad) * Math.sin(lamRad);
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
                normals.push(nx / len, ny / len, nz / len);

                uvs.push(u, v);
            }
        }

        for (let i = 0; i < phiSegments; i++) {
            for (let j = 0; j < lamSegments; j++) {
                const aIdx = i * (lamSegments + 1) + j;
                const bIdx = (i + 1) * (lamSegments + 1) + j;
                const cIdx = (i + 1) * (lamSegments + 1) + (j + 1);
                const dIdx = i * (lamSegments + 1) + (j + 1);

                indices.push(aIdx, bIdx, dIdx);
                indices.push(bIdx, cIdx, dIdx);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);

        return new THREE.Mesh(geo, shellMat);
    }

    // Helper: generate 2D planar half-ellipse interior face at a given longitude
    function createMeridianCutFace(lonDeg, isHalf = false, phiStart = -90, phiEnd = 90) {
        const segments = 48;
        const positions = [];
        const normals = [];
        const indices = [];

        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();

        // Normal of the meridian plane (perpendicular to plane at lonDeg)
        const planeNorm = new THREE.Vector3(-Math.sin(lamRad), 0, Math.cos(lamRad)).normalize();

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const phiDeg = phiStart + t * (phiEnd - phiStart);
            const phiRad = THREE.MathUtils.degToRad(phiDeg);
            const N = getN(phiRad);

            const y = N * (1 - e2) * Math.sin(phiRad);
            const x = N * Math.cos(phiRad) * Math.cos(lamRad);
            const z = N * Math.cos(phiRad) * Math.sin(lamRad);

            // Center spine point on polar axis
            positions.push(0, y, 0);
            normals.push(planeNorm.x, planeNorm.y, planeNorm.z);

            // Rim point on ellipsoid profile
            positions.push(x, y, z);
            normals.push(planeNorm.x, planeNorm.y, planeNorm.z);
        }

        for (let i = 0; i < segments; i++) {
            const p0 = i * 2;
            const p1 = i * 2 + 1;
            const p2 = (i + 1) * 2;
            const p3 = (i + 1) * 2 + 1;

            indices.push(p0, p1, p2);
            indices.push(p1, p3, p2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);

        return new THREE.Mesh(geo, meridianCutMat);
    }

    // Helper: generate equatorial plane sector face
    function createEquatorialSectorFace(startLonDeg, endLonDeg) {
        const segments = 48;
        const positions = [0, 0, 0]; // Center O
        const normals = [0, 1, 0];
        const indices = [];

        const span = endLonDeg - startLonDeg;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const lonDeg = startLonDeg + t * span;
            const lamRad = THREE.MathUtils.degToRad(lonDeg);

            const x = a * Math.cos(lamRad);
            const z = a * Math.sin(lamRad);

            positions.push(x, 0, z);
            normals.push(0, 1, 0);
        }

        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);

        return new THREE.Mesh(geo, equatorialCutMat);
    }

    // Helper: generate filled planar sector (triangle fan)
    function createSectorMesh(center, startVec, endVec, normal, segments = 32, material) {
        const positions = [center.x, center.y, center.z];
        const indices = [];

        const v1 = startVec.clone().sub(center);
        const v2 = endVec.clone().sub(center);
        const angle = v1.angleTo(v2);

        const cross = new THREE.Vector3().crossVectors(v1, v2);
        const sign = cross.dot(normal) >= 0 ? 1 : -1;
        const totalAngle = sign * angle;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const aStep = t * totalAngle;
            const pt = v1.clone().applyAxisAngle(normal, aStep).add(center);
            positions.push(pt.x, pt.y, pt.z);
        }

        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        return new THREE.Mesh(geo, material);
    }

    // Helper: create arc line
    function createArcLine(center, startVec, endVec, normal, radius, segments = 32, material) {
        const pts = [];
        const v1 = startVec.clone().sub(center).normalize();
        const v2 = endVec.clone().sub(center).normalize();
        const angle = v1.angleTo(v2);

        const cross = new THREE.Vector3().crossVectors(v1, v2);
        const sign = cross.dot(normal) >= 0 ? 1 : -1;
        const totalAngle = sign * angle;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const aStep = t * totalAngle;
            const pt = v1.clone().applyAxisAngle(normal, aStep).multiplyScalar(radius).add(center);
            pts.push(pt);
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return new THREE.Line(geo, material);
    }

    function buildScene() {
        // Clear previous children
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const b = getB();

        // 1. Calculate cut angles based on cutMode
        let shellStart = 0;
        let shellEnd = 360;
        let hasCut = cutMode !== 'none';

        if (cutMode === 'wedge') {
            if (lambda >= 0) {
                shellStart = lambda;
                shellEnd = 360;
            } else {
                shellStart = 0;
                shellEnd = 360 + lambda;
            }
        } else if (cutMode === 'quadrant') {
            shellStart = 90;
            shellEnd = 360;
        } else if (cutMode === 'meridian') {
            // Half cut along the meridian of P (exposing full meridian ellipse)
            shellStart = lambda + 90;
            shellEnd = lambda + 270;
        }

        // 2. Add Sliced Ellipsoid Shell
        if (hasCut) {
            const shellMesh = createSlicedEllipsoidMesh(shellStart, shellEnd);
            group.add(shellMesh);
        } else {
            const fullGeo = new THREE.SphereGeometry(1, 64, 64);
            const fullMesh = new THREE.Mesh(fullGeo, shellMat);
            fullMesh.scale.set(a, b, a);
            group.add(fullMesh);
        }

        // 3. Add Meridians and Parallels on the shell
        if (showMeridians) {
            const numMeridians = 12;
            for (let i = 0; i < numMeridians; i++) {
                const mDeg = (i / numMeridians) * 360;
                const pts = [];
                for (let j = 0; j <= 64; j++) {
                    const lat = -90 + (j / 64) * 180;
                    pts.push(ellipsoidPoint(lat, mDeg));
                }
                const geo = new THREE.BufferGeometry().setFromPoints(pts);
                group.add(new THREE.Line(geo, meridianMat));
            }
        }

        if (showParallels) {
            for (let i = 1; i <= 5; i++) {
                [-1, 1].forEach(sign => {
                    const lat = sign * (i / 6) * 90;
                    const pts = [];
                    for (let j = 0; j <= 64; j++) {
                        const lon = (j / 64) * 360;
                        pts.push(ellipsoidPoint(lat, lon));
                    }
                    const geo = new THREE.BufferGeometry().setFromPoints(pts);
                    group.add(new THREE.Line(geo, parallelMat));
                });
            }
        }

        // 4. Equator ring
        const eqPts = [];
        for (let j = 0; j <= 128; j++) {
            const lon = (j / 128) * 360;
            eqPts.push(ellipsoidPoint(0, lon));
        }
        const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
        group.add(new THREE.Line(eqGeo, equatorMat));

        // 5. Rotation axis (Z polar)
        if (showAxes) {
            const axisPts = [
                new THREE.Vector3(0, -b * 1.45, 0),
                new THREE.Vector3(0, b * 1.45, 0),
            ];
            const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
            group.add(new THREE.Line(axisGeo, axisMat));

            // North and South Pole Labels & Markers
            const poleMarkerGeo = new THREE.SphereGeometry(0.045, 12, 12);
            const poleMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });

            const nPole = new THREE.Mesh(poleMarkerGeo, poleMat);
            nPole.position.set(0, b, 0);
            group.add(nPole);

            const nLabel = makeTextSprite('Polo Norte (+Z)', 0x93c5fd, 0.28);
            nLabel.position.set(0, b * 1.35, 0);
            group.add(nLabel);

            const sPole = new THREE.Mesh(poleMarkerGeo, poleMat);
            sPole.position.set(0, -b, 0);
            group.add(sPole);

            const sLabel = makeTextSprite('Polo Sul (-Z)', 0x64748b, 0.25);
            sLabel.position.set(0, -b * 1.35, 0);
            group.add(sLabel);
        }

        // 6. Geocenter O
        const origin = new THREE.Vector3(0, 0, 0);
        const oGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const oMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const oMesh = new THREE.Mesh(oGeo, oMat);
        oMesh.position.copy(origin);
        group.add(oMesh);

        const oLabel = makeTextSprite('O (Geocentro)', 0xffffff, 0.26, true);
        oLabel.position.set(-0.25, -0.22, -0.25);
        group.add(oLabel);

        // 7. Interior Cross-Section Faces (When Cut is active)
        if (hasCut) {
            // A. Meridional Cut Face at meridian of P
            if (showMeridianPlane) {
                const meridianFace = createMeridianCutFace(lambda, true, -90, 90);
                group.add(meridianFace);

                // Grid lines inside the meridian cut face
                const lamRad = THREE.MathUtils.degToRad(lambda);
                const radDir = new THREE.Vector3(Math.cos(lamRad), 0, Math.sin(lamRad));

                // Radial division lines on meridian plane
                [15, 30, 45, 60, 75].forEach(deg => {
                    const pt = ellipsoidPoint(deg, lambda);
                    const lineGeo = new THREE.BufferGeometry().setFromPoints([origin, pt]);
                    group.add(new THREE.Line(lineGeo, gridLineMat));
                });

                // Equatorial radius line O - P0 on this meridian
                const p0 = new THREE.Vector3(a * Math.cos(lamRad), 0, a * Math.sin(lamRad));
                const eqLineGeo = new THREE.BufferGeometry().setFromPoints([origin, p0]);
                const eqLine = new THREE.Line(eqLineGeo, new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 }));
                group.add(eqLine);

                // Marker P0 (Projeção no Equador)
                const p0Mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
                p0Mesh.position.copy(p0);
                group.add(p0Mesh);

                const p0Label = makeTextSprite('P₀ (Equador)', 0x34d399, 0.24);
                p0Label.position.copy(p0.clone().add(radDir.clone().multiplyScalar(0.25)).add(new THREE.Vector3(0, -0.15, 0)));
                group.add(p0Label);

                // Dimension a (Semi-eixo maior)
                const aMid = p0.clone().multiplyScalar(0.5);
                const aLabel = makeTextSprite('a = 6.378 km', 0x34d399, 0.22);
                aLabel.position.copy(aMid.clone().add(new THREE.Vector3(0, -0.18, 0)));
                group.add(aLabel);

                // Dimension b (Semi-eixo menor)
                const bMid = new THREE.Vector3(0, b * 0.5, 0);
                const bLabel = makeTextSprite('b = 6.357 km', 0x93c5fd, 0.22);
                bLabel.position.copy(bMid.clone().add(radDir.clone().multiplyScalar(-0.35)));
                group.add(bLabel);
            }

            // B. Equatorial Cut Face
            if (showEquatorialPlane) {
                let eqStart = 0;
                let eqEnd = lambda;
                if (cutMode === 'quadrant') {
                    eqStart = 0;
                    eqEnd = 90;
                } else if (cutMode === 'meridian') {
                    eqStart = lambda - 90;
                    eqEnd = lambda + 90;
                }
                const eqFace = createEquatorialSectorFace(eqStart, eqEnd);
                group.add(eqFace);

                // Concentric circles on equatorial plane
                [0.5, 0.75, 1.0].forEach(factor => {
                    const rPts = [];
                    for (let k = 0; k <= 32; k++) {
                        const t = k / 32;
                        const lDeg = eqStart + t * (eqEnd - eqStart);
                        const lRad = THREE.MathUtils.degToRad(lDeg);
                        rPts.push(new THREE.Vector3(a * factor * Math.cos(lRad), 0, a * factor * Math.sin(lRad)));
                    }
                    const rGeo = new THREE.BufferGeometry().setFromPoints(rPts);
                    group.add(new THREE.Line(rGeo, gridLineMat));
                });
            }

            // C. Greenwich Cut Face (at lon = 0)
            if (cutMode === 'wedge' || cutMode === 'quadrant') {
                const greenwichFace = createMeridianCutFace(0, true, -90, 90);
                greenwichFace.material = greenwichCutMat;
                group.add(greenwichFace);
            }
        }

        // 8. Greenwich Reference Axis (X axis, lon = 0)
        const gwPt = new THREE.Vector3(a * 1.25, 0, 0);
        const gwGeo = new THREE.BufferGeometry().setFromPoints([origin, gwPt]);
        group.add(new THREE.Line(gwGeo, greenwichMat));

        const gwLabel = makeTextSprite('Greenwich (λ = 0°) / Eixo X', 0x10b981, 0.25, true);
        gwLabel.position.set(a * 1.35, 0, 0);
        group.add(gwLabel);

        // Reference meridian line on ellipsoid
        const gwMeridPts = [];
        for (let i = 0; i <= 32; i++) {
            const lat = -90 + (i / 32) * 180;
            gwMeridPts.push(ellipsoidPoint(lat, 0));
        }
        const gwMeridGeo = new THREE.BufferGeometry().setFromPoints(gwMeridPts);
        group.add(new THREE.Line(gwMeridGeo, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })));

        // 9. Point P on surface & with height h
        const pSurface = ellipsoidPoint(phi, lambda);
        const normal = ellipsoidNormal(phi, lambda);
        const pPoint = pSurface.clone().add(normal.clone().multiplyScalar(hVal));
        const n1Intersection = getNormalAxisIntersection(phi);

        // Surface point marker
        const sMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
        );
        sMesh.position.copy(pSurface);
        group.add(sMesh);

        // Point P marker
        const pGeo = new THREE.SphereGeometry(0.07, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pPoint);
        group.add(pMesh);

        const pLabel = makeTextSprite('P (φ, λ, h)', 0xffffff, 0.32, true);
        pLabel.position.copy(pPoint.clone().add(new THREE.Vector3(0.2, 0.2, 0.1)));
        group.add(pLabel);

        // 10. Normal line from N1 through surface to P and extending outward
        if (showNormal) {
            const normalFullStart = n1Intersection.clone();
            const normalFullEnd = pSurface.clone().add(normal.clone().multiplyScalar(hVal + 0.8));

            // Line segment from N1 to tip
            const normalGeo = new THREE.BufferGeometry().setFromPoints([normalFullStart, normalFullEnd]);
            group.add(new THREE.Line(normalGeo, normalMat));

            // Arrow head
            const arrowDir = normal.clone();
            const arrowLen = 0.22;
            const arrowHelper = new THREE.ArrowHelper(arrowDir, normalFullEnd.clone().sub(arrowDir.clone().multiplyScalar(arrowLen)), arrowLen, 0xff4444, 0.14, 0.07);
            group.add(arrowHelper);

            // Label "n"
            const nLabel = makeTextSprite('n (normal ao elipsoide)', 0xff4444, 0.26, true);
            nLabel.position.copy(normalFullEnd.clone().add(normal.clone().multiplyScalar(0.18)));
            group.add(nLabel);

            // N1 marker on polar axis
            const n1Mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.045, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0xff6644 })
            );
            n1Mesh.position.copy(n1Intersection);
            group.add(n1Mesh);

            const n1Label = makeTextSprite('N₁ (Interseção no Eixo Z)', 0xff6644, 0.24);
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const n1Offset = new THREE.Vector3(-Math.cos(lamRad) * 0.45, -0.15, -Math.sin(lamRad) * 0.45);
            n1Label.position.copy(n1Intersection.clone().add(n1Offset));
            group.add(n1Label);

            // Grande Normal N bracket/label
            const nMid = pSurface.clone().add(n1Intersection).multiplyScalar(0.5);
            const grandeNLabel = makeTextSprite('N (Grande Normal)', 0xff6644, 0.23);
            grandeNLabel.position.copy(nMid.clone().add(new THREE.Vector3(0.15, 0.12, 0.15)));
            group.add(grandeNLabel);
        }

        // 11. Geocentric Radius Vector OP (for comparison inside the cut)
        if (showGeocentric) {
            const geoRadiusGeo = new THREE.BufferGeometry().setFromPoints([origin, pSurface]);
            group.add(new THREE.Line(geoRadiusGeo, geocentricMat));

            const rLabel = makeTextSprite('r (raio vetor)', 0x38bdf8, 0.23);
            const rMid = pSurface.clone().multiplyScalar(0.55);
            rLabel.position.copy(rMid.clone().add(new THREE.Vector3(-0.15, 0.1, -0.15)));
            group.add(rLabel);
        }

        // 12. Height line (h)
        if (hVal > 0.02) {
            const hGeo = new THREE.BufferGeometry().setFromPoints([pSurface, pPoint]);
            group.add(new THREE.Line(hGeo, heightMat));

            const hMid = pSurface.clone().add(pPoint).multiplyScalar(0.5);
            const hLabel = makeTextSprite(`h = ${hVal.toFixed(2)}`, 0xfbbf24, 0.24);
            hLabel.position.copy(hMid.clone().add(new THREE.Vector3(0.2, 0, 0.2)));
            group.add(hLabel);
        }

        // 13. Angle Arcs and Shaded Sectors
        if (showAngles) {
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const phiRad = THREE.MathUtils.degToRad(phi);
            const phiPrimeDeg = getGeocentricLatDeg(phi);
            const phiPrimeRad = THREE.MathUtils.degToRad(phiPrimeDeg);

            // Plane normal for meridian of P
            const normMeridian = new THREE.Vector3(-Math.sin(lamRad), 0, Math.cos(lamRad));
            const radDir = new THREE.Vector3(Math.cos(lamRad), 0, Math.sin(lamRad));

            // --- A. Latitude Geodésica φ ---
            if (Math.abs(phi) > 0.5) {
                const arcRadiusPhi = 0.75;
                const horizAtN1 = n1Intersection.clone().add(radDir.clone().multiplyScalar(arcRadiusPhi));
                const normAtN1 = n1Intersection.clone().add(normal.clone().multiplyScalar(arcRadiusPhi));

                // Shaded sector for phi
                const phiSector = createSectorMesh(n1Intersection, horizAtN1, normAtN1, normMeridian, 32, sectorPhiMat);
                group.add(phiSector);

                // Arc line
                const phiArc = createArcLine(n1Intersection, horizAtN1, normAtN1, normMeridian, arcRadiusPhi, 32, arcPhiMat);
                group.add(phiArc);

                // Label phi
                const phiMidDir = new THREE.Vector3(
                    Math.cos(phiRad * 0.5) * Math.cos(lamRad),
                    Math.sin(phiRad * 0.5),
                    Math.cos(phiRad * 0.5) * Math.sin(lamRad)
                ).normalize();
                const phiLabel = makeTextSprite(`φ = ${phi.toFixed(1)}°`, 0xff6644, 0.28, true);
                phiLabel.position.copy(n1Intersection.clone().add(phiMidDir.multiplyScalar(arcRadiusPhi * 1.35)));
                group.add(phiLabel);
            }

            // --- B. Latitude Geocêntrica φ' (measured at Geocenter O) ---
            if (showGeocentric && Math.abs(phi) > 0.5) {
                const arcRadiusPhiPrime = 0.52;
                const horizAtO = origin.clone().add(radDir.clone().multiplyScalar(arcRadiusPhiPrime));
                const dirOP = pSurface.clone().normalize().multiplyScalar(arcRadiusPhiPrime);

                const phiPrimeSector = createSectorMesh(origin, horizAtO, dirOP, normMeridian, 32, sectorPhiPrimeMat);
                group.add(phiPrimeSector);

                const phiPrimeArc = createArcLine(origin, horizAtO, dirOP, normMeridian, arcRadiusPhiPrime, 32, arcPhiPrimeMat);
                group.add(phiPrimeArc);

                const phiPrimeMidDir = new THREE.Vector3(
                    Math.cos(phiPrimeRad * 0.5) * Math.cos(lamRad),
                    Math.sin(phiPrimeRad * 0.5),
                    Math.cos(phiPrimeRad * 0.5) * Math.sin(lamRad)
                ).normalize();
                const phiPrimeLabel = makeTextSprite(`φ' = ${phiPrimeDeg.toFixed(1)}°`, 0x38bdf8, 0.25);
                phiPrimeLabel.position.copy(origin.clone().add(phiPrimeMidDir.multiplyScalar(arcRadiusPhiPrime * 1.45)));
                group.add(phiPrimeLabel);

                // Latitude reduction callout Δφ
                const diffDeg = Math.abs(phi - phiPrimeDeg);
                if (diffDeg > 0.2) {
                    const diffLabel = makeTextSprite(`Δφ = ${diffDeg.toFixed(1)}° (Redução)`, 0xfbbf24, 0.23, true);
                    diffLabel.position.copy(pSurface.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.2, 0)));
                    group.add(diffLabel);
                }
            }

            // --- C. Longitude λ (measured in Equatorial Plane at Geocenter O) ---
            if (Math.abs(lambda) > 0.5) {
                const arcRadiusLambda = 1.35;
                const gwVec = new THREE.Vector3(arcRadiusLambda, 0, 0);
                const lamVec = new THREE.Vector3(arcRadiusLambda * Math.cos(lamRad), 0, arcRadiusLambda * Math.sin(lamRad));
                const normEquator = new THREE.Vector3(0, 1, 0);

                // Sector for lambda
                const lambdaSector = createSectorMesh(origin, gwVec, lamVec, normEquator, 32, sectorLambdaMat);
                group.add(lambdaSector);

                // Arc for lambda
                const lambdaArc = createArcLine(origin, gwVec, lamVec, normEquator, arcRadiusLambda, 32, arcLambdaMat);
                group.add(lambdaArc);

                // Label lambda
                const lamMidRad = THREE.MathUtils.degToRad(lambda * 0.5);
                const lamMidDir = new THREE.Vector3(
                    arcRadiusLambda * 1.25 * Math.cos(lamMidRad),
                    0.05,
                    arcRadiusLambda * 1.25 * Math.sin(lamMidRad)
                );
                const lamLabel = makeTextSprite(`λ = ${lambda.toFixed(1)}°`, 0x10b981, 0.28, true);
                lamLabel.position.copy(lamMidDir);
                group.add(lamLabel);
            }
        }

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const pSurface = ellipsoidPoint(phi, lambda);
        const normal = ellipsoidNormal(phi, lambda);
        const pPoint = pSurface.clone().add(normal.clone().multiplyScalar(hVal));
        const phiRad = THREE.MathUtils.degToRad(phi);
        const N = getN(phiRad);
        const b = getB();
        const e2 = getEcc2();
        const phiPrimeDeg = getGeocentricLatDeg(phi);
        const deltaPhiDeg = Math.abs(phi - phiPrimeDeg);
        const on1Dist = e2 * N * Math.abs(Math.sin(phiRad));

        readout.innerHTML = `
            <div class="readout-title">📐 Coordenadas Geodésicas</div>
            <div class="readout-row">
                <span class="readout-label">Latitude Geodésica (φ)</span>
                <span class="readout-value" style="color:#ff6644;">${phi.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Latitude Geocêntrica (φ')</span>
                <span class="readout-value" style="color:#38bdf8;">${phiPrimeDeg.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Redução (Δφ = φ - φ')</span>
                <span class="readout-value" style="color:#fbbf24;">${deltaPhiDeg.toFixed(2)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Longitude (λ)</span>
                <span class="readout-value" style="color:#10b981;">${lambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Altura Elipsoidal (h)</span>
                <span class="readout-value" style="color:#fbbf24;">${hVal.toFixed(2)}</span>
            </div>

            <div class="readout-section-divider"></div>
            <div class="readout-subtitle">Geometria da Seção Transversal</div>
            <div class="readout-row">
                <span class="readout-label">Grande Normal (N)</span>
                <span class="readout-value">${N.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Dist. Geocentro a N₁</span>
                <span class="readout-value">${on1Dist.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Semi-eixo a / b</span>
                <span class="readout-value">${a.toFixed(2)} / ${b.toFixed(2)}</span>
            </div>

            <div class="readout-section-divider"></div>
            <div class="readout-subtitle">Cartesianas ECEF</div>
            <div class="readout-row">
                <span class="readout-label">X</span>
                <span class="readout-value">${pPoint.x.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Y</span>
                <span class="readout-value">${pPoint.y.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Z</span>
                <span class="readout-value">${pPoint.z.toFixed(3)}</span>
            </div>
        `;
        readout.classList.add('visible');
    }

    // Camera animation helper
    function animateCameraTo(targetCamPos, targetLookAt) {
        cameraStartPos.copy(camera.position);
        cameraEndPos.copy(targetCamPos);
        targetStartPos.copy(controls.target);
        targetEndPos.copy(targetLookAt);
        animProgress = 0;
        isCameraAnimating = true;
    }

    buildScene();

    function update(time, delta) {
        if (isCameraAnimating) {
            animProgress += delta * 2.5; // ~0.4s transition
            if (animProgress >= 1) {
                animProgress = 1;
                isCameraAnimating = false;
            }
            const ease = 0.5 - 0.5 * Math.cos(Math.PI * animProgress);
            camera.position.lerpVectors(cameraStartPos, cameraEndPos, ease);
            controls.target.lerpVectors(targetStartPos, targetEndPos, ease);
            controls.update();
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

    function createControls(container) {
        container.innerHTML = `
            <div class="controls-section">
                <!-- Camera Presets -->
                <div class="control-group">
                    <label>🎯 Vistas Didáticas (Livro-Texto):</label>
                    <div class="btn-group view-presets">
                        <button class="ctrl-btn active" id="btn-view-3d" title="Perspectiva isométrica destacando ambos os cortes">
                            <span>📐</span> Vista 3D Isométrica
                        </button>
                        <button class="ctrl-btn" id="btn-view-meridian" title="Visão 2D ortogonal do plano meridiano com ângulo de latitude φ">
                            <span>🎯</span> Corte Meridiano (Plano φ)
                        </button>
                        <button class="ctrl-btn" id="btn-view-equator" title="Visão 2D zenital do plano equatorial com ângulo de longitude λ">
                            <span>🌐</span> Corte Equatorial (Plano λ)
                        </button>
                    </div>
                </div>

                <!-- Cut Mode Selector -->
                <div class="control-group">
                    <label>🔪 Tipo de Corte / Seção Transversal:</label>
                    <div class="btn-group cut-modes">
                        <button class="ctrl-btn ${cutMode === 'wedge' ? 'active' : ''}" data-cut="wedge">
                            Cunha (0° → λ)
                        </button>
                        <button class="ctrl-btn ${cutMode === 'quadrant' ? 'active' : ''}" data-cut="quadrant">
                            Quadrante (90°)
                        </button>
                        <button class="ctrl-btn ${cutMode === 'meridian' ? 'active' : ''}" data-cut="meridian">
                            Corte Meridiano (180°)
                        </button>
                        <button class="ctrl-btn ${cutMode === 'none' ? 'active' : ''}" data-cut="none">
                            Sem Corte (3D)
                        </button>
                    </div>
                </div>

                <!-- Primary Sliders -->
                <div class="control-group">
                    <label>Latitude Geodésica (φ): <span class="value-display" id="phi-val" style="color:#ff6644;">${phi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${phi}">
                </div>
                <div class="control-group">
                    <label>Longitude Geodésica (λ): <span class="value-display" id="lambda-val" style="color:#10b981;">${lambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lambda" min="-180" max="180" step="1" value="${lambda}">
                </div>
                <div class="control-group">
                    <label>Altura Elipsoidal (h): <span class="value-display" id="h-val" style="color:#fbbf24;">${hVal.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-h" min="0" max="2" step="0.05" value="${hVal}">
                </div>
                <div class="control-group">
                    <label>Exagero do Achatamento: <span class="value-display" id="fexag-val">${fExag.toFixed(0)}×</span></label>
                    <input type="range" id="ctrl-fexag" min="1" max="60" step="1" value="${fExag}">
                    <p class="ctrl-caption">
                        Achatamento real f ≈ 1/298 | Achatamento visual f = 1/${(1 / (f * fExag)).toFixed(1)}
                    </p>
                </div>

                <!-- Visual Toggles -->
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px; margin-top: 4px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-normal" ${showNormal ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Normal (n) e N₁</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geocentric" ${showGeocentric ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Comparar c/ Geocêntrica (φ')</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-angles" ${showAngles ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Arcos e Setores (φ, λ)</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-meridian-plane" ${showMeridianPlane ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Plano Meridiano</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-equatorial-plane" ${showEquatorialPlane ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Plano Equatorial</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-axes" ${showAxes ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Eixos e Semi-eixos (a, b)</span>
                    </label>
                </div>
            </div>
        `;

        // Camera preset button handlers
        const btn3D = container.querySelector('#btn-view-3d');
        const btnMeridian = container.querySelector('#btn-view-meridian');
        const btnEquator = container.querySelector('#btn-view-equator');

        function setActivePreset(activeBtn) {
            [btn3D, btnMeridian, btnEquator].forEach(b => b.classList.remove('active'));
            if (activeBtn) activeBtn.classList.add('active');
        }

        btn3D.addEventListener('click', () => {
            setActivePreset(btn3D);
            animateCameraTo(new THREE.Vector3(4.8, 3.4, 4.8), new THREE.Vector3(0, 0, 0));
        });

        btnMeridian.addEventListener('click', () => {
            setActivePreset(btnMeridian);
            // Looking perpendicular to meridian of P
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const dist = 5.6;
            const camX = dist * -Math.sin(lamRad);
            const camZ = dist * Math.cos(lamRad);
            animateCameraTo(new THREE.Vector3(camX, 0.15, camZ), new THREE.Vector3(0, 0, 0));
        });

        btnEquator.addEventListener('click', () => {
            setActivePreset(btnEquator);
            // Looking top-down onto the equator
            animateCameraTo(new THREE.Vector3(0.001, 6.2, 0), new THREE.Vector3(0, 0, 0));
        });

        // Cut mode handlers
        const cutButtons = container.querySelectorAll('.cut-modes .ctrl-btn');
        cutButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                cutButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                cutMode = btn.dataset.cut;
                buildScene();
            });
        });

        // Slider handlers
        container.querySelector('#ctrl-phi').addEventListener('input', e => {
            phi = parseFloat(e.target.value);
            container.querySelector('#phi-val').textContent = phi.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-lambda').addEventListener('input', e => {
            lambda = parseFloat(e.target.value);
            container.querySelector('#lambda-val').textContent = lambda.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-h').addEventListener('input', e => {
            hVal = parseFloat(e.target.value);
            container.querySelector('#h-val').textContent = hVal.toFixed(2);
            buildScene();
        });
        container.querySelector('#ctrl-fexag').addEventListener('input', e => {
            fExag = parseFloat(e.target.value);
            container.querySelector('#fexag-val').textContent = fExag.toFixed(0) + '×';
            buildScene();
        });

        // Toggle handlers
        container.querySelector('#ctrl-normal').addEventListener('change', e => {
            showNormal = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-geocentric').addEventListener('change', e => {
            showGeocentric = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-angles').addEventListener('change', e => {
            showAngles = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-meridian-plane').addEventListener('change', e => {
            showMeridianPlane = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-equatorial-plane').addEventListener('change', e => {
            showEquatorialPlane = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-axes').addEventListener('change', e => {
            showAxes = e.target.checked;
            buildScene();
        });
    }

    return { update, cleanup, createControls };
}
