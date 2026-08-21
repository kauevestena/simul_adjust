import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Coordenadas Esféricas',
    icon: '🌐',
    subtitle: 'Latitude Geocêntrica, Longitude e Raio (φ\', λ, r)',
    cameraPosition: [4.8, 3.4, 4.8],

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

    let radius = 2.0;
    let phiPrime = 45; // geocentric latitude
    let lambda = 40; // longitude
    let rVal = 2.0; // distance from center

    let cutMode = 'wedge'; // 'wedge', 'quadrant', 'meridian', 'none'
    let showRadiusVector = true;
    let showAngles = true;
    let showComparison = false;
    let showMeridianPlane = true;
    let showEquatorialPlane = true;
    let showMeridians = true;
    let showParallels = true;
    let showAxes = true;

    // Ellipsoid comparison parameters
    const aEll = 2.0;
    const fEll = 1 / 298.257;
    const fExag = 15.0;

    // Camera animation state
    let isCameraAnimating = false;
    let cameraStartPos = new THREE.Vector3();
    let cameraEndPos = new THREE.Vector3();
    let targetStartPos = new THREE.Vector3();
    let targetEndPos = new THREE.Vector3();
    let animProgress = 0;

    // Materials
    const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x115e59,
        emissive: 0x042f2e,
        specular: 0x2dd4bf,
        shininess: 40,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const meridianCutMat = new THREE.MeshPhongMaterial({
        color: 0x0d3834,
        emissive: 0x041f1c,
        specular: 0x5eead4,
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
        color: 0x122e2b,
        emissive: 0x051a18,
        specular: 0x2dd4bf,
        shininess: 30,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
    });

    const sectorPhiMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
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

    const radiusVecMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const arcPhiMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const arcLambdaMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const meridianMat = new THREE.LineBasicMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.28 });
    const parallelMat = new THREE.LineBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.22 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44, linewidth: 2 });
    const greenwichMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const axisMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
    const gridLineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.25 });

    // Comparison materials
    const compNormalMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    const compEllLineMat = new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2, transparent: true, opacity: 0.8 });

    function spherePoint(latDeg, lonDeg, r) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            r * Math.cos(phi) * Math.cos(lam),
            r * Math.sin(phi),
            r * Math.cos(phi) * Math.sin(lam)
        );
    }

    function createSlicedSphereMesh(lamStartDeg, lamEndDeg) {
        const phiSegments = 64;
        const lamSegments = 64;
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= phiSegments; i++) {
            const v = i / phiSegments;
            const phiDeg = -90 + v * 180;
            const phiRad = THREE.MathUtils.degToRad(phiDeg);

            for (let j = 0; j <= lamSegments; j++) {
                const u = j / lamSegments;
                const lamDeg = lamStartDeg + u * (lamEndDeg - lamStartDeg);
                const lamRad = THREE.MathUtils.degToRad(lamDeg);

                const nx = Math.cos(phiRad) * Math.cos(lamRad);
                const ny = Math.sin(phiRad);
                const nz = Math.cos(phiRad) * Math.sin(lamRad);

                positions.push(radius * nx, radius * ny, radius * nz);
                normals.push(nx, ny, nz);
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

        return new THREE.Mesh(geo, sphereMat);
    }

    function createMeridianCutFace(lonDeg, phiStart = -90, phiEnd = 90) {
        const segments = 48;
        const positions = [];
        const normals = [];
        const indices = [];

        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const planeNorm = new THREE.Vector3(-Math.sin(lamRad), 0, Math.cos(lamRad)).normalize();

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const phiDeg = phiStart + t * (phiEnd - phiStart);
            const phiRad = THREE.MathUtils.degToRad(phiDeg);

            const y = radius * Math.sin(phiRad);
            const x = radius * Math.cos(phiRad) * Math.cos(lamRad);
            const z = radius * Math.cos(phiRad) * Math.sin(lamRad);

            positions.push(0, y, 0);
            normals.push(planeNorm.x, planeNorm.y, planeNorm.z);

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

    function createEquatorialSectorFace(startLonDeg, endLonDeg) {
        const segments = 48;
        const positions = [0, 0, 0];
        const normals = [0, 1, 0];
        const indices = [];

        const span = endLonDeg - startLonDeg;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const lonDeg = startLonDeg + t * span;
            const lamRad = THREE.MathUtils.degToRad(lonDeg);

            const x = radius * Math.cos(lamRad);
            const z = radius * Math.sin(lamRad);

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

    function createArcLine(center, startVec, endVec, normal, rad, segments = 32, material) {
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
            const pt = v1.clone().applyAxisAngle(normal, aStep).multiplyScalar(rad).add(center);
            pts.push(pt);
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return new THREE.Line(geo, material);
    }

    function buildScene() {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

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
            shellStart = lambda + 90;
            shellEnd = lambda + 270;
        }

        // 1. Sphere outer shell
        if (hasCut) {
            const shellMesh = createSlicedSphereMesh(shellStart, shellEnd);
            group.add(shellMesh);
        } else {
            const fullGeo = new THREE.SphereGeometry(radius, 64, 64);
            const fullMesh = new THREE.Mesh(fullGeo, sphereMat);
            group.add(fullMesh);
        }

        // 2. Meridians and Parallels
        if (showMeridians) {
            for (let i = 0; i < 12; i++) {
                const lon = (i / 12) * 360;
                const pts = [];
                for (let j = 0; j <= 64; j++) {
                    const lat = -90 + (j / 64) * 180;
                    pts.push(spherePoint(lat, lon, radius * 1.002));
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
                        pts.push(spherePoint(lat, lon, radius * 1.002));
                    }
                    const geo = new THREE.BufferGeometry().setFromPoints(pts);
                    group.add(new THREE.Line(geo, parallelMat));
                });
            }
        }

        // 3. Equator ring
        const eqPts = [];
        for (let j = 0; j <= 128; j++) {
            const lon = (j / 128) * 360;
            eqPts.push(spherePoint(0, lon, radius * 1.003));
        }
        const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
        group.add(new THREE.Line(eqGeo, equatorMat));

        // 4. Polar Axis
        if (showAxes) {
            const axisPts = [
                new THREE.Vector3(0, -radius * 1.45, 0),
                new THREE.Vector3(0, radius * 1.45, 0),
            ];
            const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
            group.add(new THREE.Line(axisGeo, axisMat));

            const nLabel = makeTextSprite('Polo Norte (+Z)', 0x99f6e4, 0.28);
            nLabel.position.set(0, radius * 1.35, 0);
            group.add(nLabel);

            const sLabel = makeTextSprite('Polo Sul (-Z)', 0x64748b, 0.25);
            sLabel.position.set(0, -radius * 1.35, 0);
            group.add(sLabel);
        }

        // 5. Geocenter O
        const origin = new THREE.Vector3(0, 0, 0);
        const oMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        oMesh.position.copy(origin);
        group.add(oMesh);

        const oLabel = makeTextSprite('O (Geocentro)', 0xffffff, 0.26, true);
        oLabel.position.set(-0.25, -0.22, -0.25);
        group.add(oLabel);

        // 6. Interior Cut Faces
        if (hasCut) {
            if (showMeridianPlane) {
                const meridianFace = createMeridianCutFace(lambda, -90, 90);
                group.add(meridianFace);

                const lamRad = THREE.MathUtils.degToRad(lambda);
                const radDir = new THREE.Vector3(Math.cos(lamRad), 0, Math.sin(lamRad));

                // Radial division lines
                [15, 30, 45, 60, 75].forEach(deg => {
                    const pt = spherePoint(deg, lambda, radius);
                    const lineGeo = new THREE.BufferGeometry().setFromPoints([origin, pt]);
                    group.add(new THREE.Line(lineGeo, gridLineMat));
                });

                // Equatorial radius line O - P0
                const p0 = new THREE.Vector3(radius * Math.cos(lamRad), 0, radius * Math.sin(lamRad));
                const eqLineGeo = new THREE.BufferGeometry().setFromPoints([origin, p0]);
                group.add(new THREE.Line(eqLineGeo, new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 })));

                const p0Mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
                p0Mesh.position.copy(p0);
                group.add(p0Mesh);

                const p0Label = makeTextSprite('P₀ (Equador)', 0x34d399, 0.24);
                p0Label.position.copy(p0.clone().add(radDir.clone().multiplyScalar(0.25)).add(new THREE.Vector3(0, -0.15, 0)));
                group.add(p0Label);

                const rLabel = makeTextSprite(`R = ${radius.toFixed(1)}`, 0x34d399, 0.22);
                rLabel.position.copy(p0.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, -0.18, 0)));
                group.add(rLabel);
            }

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

                [0.5, 0.75, 1.0].forEach(factor => {
                    const rPts = [];
                    for (let k = 0; k <= 32; k++) {
                        const t = k / 32;
                        const lDeg = eqStart + t * (eqEnd - eqStart);
                        const lRad = THREE.MathUtils.degToRad(lDeg);
                        rPts.push(new THREE.Vector3(radius * factor * Math.cos(lRad), 0, radius * factor * Math.sin(lRad)));
                    }
                    const rGeo = new THREE.BufferGeometry().setFromPoints(rPts);
                    group.add(new THREE.Line(rGeo, gridLineMat));
                });
            }

            if (cutMode === 'wedge' || cutMode === 'quadrant') {
                const greenwichFace = createMeridianCutFace(0, -90, 90);
                greenwichFace.material = greenwichCutMat;
                group.add(greenwichFace);
            }
        }

        // 7. Greenwich Reference Axis (X axis)
        const gwPt = new THREE.Vector3(radius * 1.25, 0, 0);
        const gwGeo = new THREE.BufferGeometry().setFromPoints([origin, gwPt]);
        group.add(new THREE.Line(gwGeo, greenwichMat));

        const gwLabel = makeTextSprite('Greenwich (λ = 0°) / Eixo X', 0x10b981, 0.25, true);
        gwLabel.position.set(radius * 1.35, 0, 0);
        group.add(gwLabel);

        // 8. Point P Position
        const pPos = spherePoint(phiPrime, lambda, rVal);
        const pGeo = new THREE.SphereGeometry(0.07, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pPos);
        group.add(pMesh);

        const pLabel = makeTextSprite("P (φ', λ, r)", 0xffffff, 0.32, true);
        pLabel.position.copy(pPos.clone().add(new THREE.Vector3(0.2, 0.2, 0.1)));
        group.add(pLabel);

        // 9. Radius Vector OP
        if (showRadiusVector) {
            const rvGeo = new THREE.BufferGeometry().setFromPoints([origin, pPos]);
            group.add(new THREE.Line(rvGeo, radiusVecMat));

            const dir = pPos.clone().normalize();
            const arrowHelper = new THREE.ArrowHelper(dir, pPos.clone().sub(dir.clone().multiplyScalar(0.22)), 0.22, 0x38bdf8, 0.14, 0.07);
            group.add(arrowHelper);

            const rText = makeTextSprite(`r = ${rVal.toFixed(2)}`, 0x38bdf8, 0.25, true);
            rText.position.copy(pPos.clone().multiplyScalar(0.55).add(new THREE.Vector3(0.15, 0.15, 0)));
            group.add(rText);
        }

        // 10. Angle Arcs and Sectors
        if (showAngles) {
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const phiRad = THREE.MathUtils.degToRad(phiPrime);
            const normMeridian = new THREE.Vector3(-Math.sin(lamRad), 0, Math.cos(lamRad));
            const radDir = new THREE.Vector3(Math.cos(lamRad), 0, Math.sin(lamRad));

            // φ' sector at center O
            if (Math.abs(phiPrime) > 0.5) {
                const arcRadiusPhi = 0.85;
                const horizAtO = origin.clone().add(radDir.clone().multiplyScalar(arcRadiusPhi));
                const dirOP = pPos.clone().normalize().multiplyScalar(arcRadiusPhi);

                const phiSector = createSectorMesh(origin, horizAtO, dirOP, normMeridian, 32, sectorPhiMat);
                group.add(phiSector);

                const phiArc = createArcLine(origin, horizAtO, dirOP, normMeridian, arcRadiusPhi, 32, arcPhiMat);
                group.add(phiArc);

                const phiMidRad = THREE.MathUtils.degToRad(phiPrime * 0.5);
                const phiMidDir = new THREE.Vector3(
                    Math.cos(phiMidRad) * Math.cos(lamRad),
                    Math.sin(phiMidRad),
                    Math.cos(phiMidRad) * Math.sin(lamRad)
                ).normalize();
                const phiLabel = makeTextSprite(`φ' = ${phiPrime.toFixed(1)}°`, 0x38bdf8, 0.28, true);
                phiLabel.position.copy(origin.clone().add(phiMidDir.multiplyScalar(arcRadiusPhi * 1.35)));
                group.add(phiLabel);
            }

            // λ sector on equator
            if (Math.abs(lambda) > 0.5) {
                const arcRadiusLambda = 1.35;
                const gwVec = new THREE.Vector3(arcRadiusLambda, 0, 0);
                const lamVec = new THREE.Vector3(arcRadiusLambda * Math.cos(lamRad), 0, arcRadiusLambda * Math.sin(lamRad));
                const normEquator = new THREE.Vector3(0, 1, 0);

                const lambdaSector = createSectorMesh(origin, gwVec, lamVec, normEquator, 32, sectorLambdaMat);
                group.add(lambdaSector);

                const lambdaArc = createArcLine(origin, gwVec, lamVec, normEquator, arcRadiusLambda, 32, arcLambdaMat);
                group.add(lambdaArc);

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

        // 11. Comparison with Geodetic Normal
        if (showComparison) {
            const bEll = aEll * (1 - fEll * fExag);
            const e2 = 1 - (bEll * bEll) / (aEll * aEll);

            // Compute geodetic latitude: tan(phi) = tan(phi') / (1 - e²)
            const phiPrimeRad = THREE.MathUtils.degToRad(phiPrime);
            const phiGeodRad = Math.atan(Math.tan(phiPrimeRad) / (1 - e2));
            const phiGeodDeg = THREE.MathUtils.radToDeg(phiGeodRad);
            const lamRad = THREE.MathUtils.degToRad(lambda);

            const N = aEll / Math.sqrt(1 - e2 * Math.sin(phiGeodRad) * Math.sin(phiGeodRad));
            const pEll = new THREE.Vector3(
                N * Math.cos(phiGeodRad) * Math.cos(lamRad),
                N * (1 - e2) * Math.sin(phiGeodRad),
                N * Math.cos(phiGeodRad) * Math.sin(lamRad)
            );

            const n1 = new THREE.Vector3(0, -e2 * N * Math.sin(phiGeodRad), 0);
            const normDir = new THREE.Vector3(
                Math.cos(phiGeodRad) * Math.cos(lamRad),
                Math.sin(phiGeodRad),
                Math.cos(phiGeodRad) * Math.sin(lamRad)
            ).normalize();

            // Normal line
            const nEnd = pEll.clone().add(normDir.clone().multiplyScalar(1.2));
            const nGeo = new THREE.BufferGeometry().setFromPoints([n1, nEnd]);
            group.add(new THREE.Line(nGeo, compNormalMat));

            // Ellipsoid meridian profile line in this cross section
            const ellPts = [];
            for (let k = -90; k <= 90; k += 2) {
                const kRad = THREE.MathUtils.degToRad(k);
                const Nk = aEll / Math.sqrt(1 - e2 * Math.sin(kRad) * Math.sin(kRad));
                ellPts.push(new THREE.Vector3(
                    Nk * Math.cos(kRad) * Math.cos(lamRad),
                    Nk * (1 - e2) * Math.sin(kRad),
                    Nk * Math.cos(kRad) * Math.sin(lamRad)
                ));
            }
            const ellGeo = new THREE.BufferGeometry().setFromPoints(ellPts);
            group.add(new THREE.Line(ellGeo, compEllLineMat));

            // Labels for comparison
            const nLabel = makeTextSprite('Normal Geodésica (n)', 0xff4444, 0.25, true);
            nLabel.position.copy(nEnd.clone().add(normDir.clone().multiplyScalar(0.18)));
            group.add(nLabel);

            const diff = Math.abs(phiGeodDeg - phiPrime);
            const diffLabel = makeTextSprite(`Δφ = ${diff.toFixed(2)}° (Redução)`, 0xfbbf24, 0.25, true);
            diffLabel.position.copy(pPos.clone().add(new THREE.Vector3(0.3, 0.25, 0.1)));
            group.add(diffLabel);
        }

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const pPos = spherePoint(phiPrime, lambda, rVal);
        const bEll = aEll * (1 - fEll * fExag);
        const e2 = 1 - (bEll * bEll) / (aEll * aEll);
        const phiPrimeRad = THREE.MathUtils.degToRad(phiPrime);
        const phiGeodRad = Math.atan(Math.tan(phiPrimeRad) / (1 - e2));
        const phiGeodDeg = THREE.MathUtils.radToDeg(phiGeodRad);
        const diff = Math.abs(phiGeodDeg - phiPrime);

        readout.innerHTML = `
            <div class="readout-title">🌐 Coordenadas Esféricas</div>
            <div class="readout-row">
                <span class="readout-label">Latitude Geocêntrica (φ')</span>
                <span class="readout-value" style="color:#38bdf8;">${phiPrime.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Longitude (λ)</span>
                <span class="readout-value" style="color:#10b981;">${lambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Raio (r)</span>
                <span class="readout-value" style="color:#38bdf8;">${rVal.toFixed(2)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Raio da Esfera (R)</span>
                <span class="readout-value">${radius.toFixed(2)}</span>
            </div>

            ${showComparison ? `
            <div class="readout-section-divider"></div>
            <div class="readout-subtitle">Comparação com Elipsoide</div>
            <div class="readout-row">
                <span class="readout-label">Latitude Geodésica (φ)</span>
                <span class="readout-value" style="color:#ff6644;">${phiGeodDeg.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Redução (Δφ = φ - φ')</span>
                <span class="readout-value" style="color:#fbbf24;">${diff.toFixed(2)}°</span>
            </div>
            ` : ''}

            <div class="readout-section-divider"></div>
            <div class="readout-subtitle">Cartesianas (X, Y, Z)</div>
            <div class="readout-row">
                <span class="readout-label">X</span>
                <span class="readout-value">${pPos.x.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Y</span>
                <span class="readout-value">${pPos.y.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Z</span>
                <span class="readout-value">${pPos.z.toFixed(3)}</span>
            </div>
        `;
        readout.classList.add('visible');
    }

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
            animProgress += delta * 2.5;
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
                        <button class="ctrl-btn" id="btn-view-meridian" title="Visão 2D ortogonal do plano meridiano com ângulo de latitude φ'">
                            <span>🎯</span> Corte Meridiano (Plano φ')
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

                <!-- Sliders -->
                <div class="control-group">
                    <label>Latitude Geocêntrica (φ'): <span class="value-display" id="phi-val" style="color:#38bdf8;">${phiPrime.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${phiPrime}">
                </div>
                <div class="control-group">
                    <label>Longitude (λ): <span class="value-display" id="lambda-val" style="color:#10b981;">${lambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lambda" min="-180" max="180" step="1" value="${lambda}">
                </div>
                <div class="control-group">
                    <label>Raio (r): <span class="value-display" id="r-val" style="color:#38bdf8;">${rVal.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-r" min="0.5" max="3.5" step="0.05" value="${rVal}">
                </div>

                <!-- Visual Toggles -->
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px; margin-top: 4px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-rv" ${showRadiusVector ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Raio Vetor (r)</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-angles" ${showAngles ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Arcos e Setores (φ', λ)</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-comparison" ${showComparison ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Comparar c/ Geodésicas</span>
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
                </div>
            </div>
        `;

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
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const dist = 5.6;
            const camX = dist * -Math.sin(lamRad);
            const camZ = dist * Math.cos(lamRad);
            animateCameraTo(new THREE.Vector3(camX, 0.15, camZ), new THREE.Vector3(0, 0, 0));
        });

        btnEquator.addEventListener('click', () => {
            setActivePreset(btnEquator);
            animateCameraTo(new THREE.Vector3(0.001, 6.2, 0), new THREE.Vector3(0, 0, 0));
        });

        const cutButtons = container.querySelectorAll('.cut-modes .ctrl-btn');
        cutButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                cutButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                cutMode = btn.dataset.cut;
                buildScene();
            });
        });

        container.querySelector('#ctrl-phi').addEventListener('input', e => {
            phiPrime = parseFloat(e.target.value);
            container.querySelector('#phi-val').textContent = phiPrime.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-lambda').addEventListener('input', e => {
            lambda = parseFloat(e.target.value);
            container.querySelector('#lambda-val').textContent = lambda.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-r').addEventListener('input', e => {
            rVal = parseFloat(e.target.value);
            container.querySelector('#r-val').textContent = rVal.toFixed(2);
            buildScene();
        });

        container.querySelector('#ctrl-rv').addEventListener('change', e => {
            showRadiusVector = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-angles').addEventListener('change', e => {
            showAngles = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-comparison').addEventListener('change', e => {
            showComparison = e.target.checked;
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
    }

    return { update, cleanup, createControls };
}
