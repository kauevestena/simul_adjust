import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Coordenadas Esféricas',
    icon: '🌐',
    subtitle: 'Latitude Geocêntrica, Longitude e Raio (φ\', λ, r)',
    cameraPosition: [5, 3, 5],

    concept: `
        <h3>Coordenadas Esféricas / Geocêntricas (φ', λ, r)</h3>
        <p>O sistema de <strong>coordenadas esféricas</strong> (também chamado geocêntrico) utiliza 
        uma <strong>esfera</strong> como superfície de referência. A posição de um ponto P é definida 
        pelo <em>raio vetor</em> que parte do centro da Terra.</p>

        <h4>Grandezas</h4>
        <p><strong>Latitude geocêntrica (φ')</strong>: ângulo entre o <em>raio vetor</em> 
        (do centro da Terra ao ponto P) e o plano do equador. Difere da latitude geodésica 
        porque o raio vetor sempre passa pelo centro.</p>

        <p><strong>Longitude (λ)</strong>: idêntica à longitude geodésica — ângulo no plano 
        equatorial a partir do meridiano de Greenwich.</p>

        <p><strong>Raio (r)</strong>: distância do centro da Terra ao ponto P. Para um ponto 
        na superfície da esfera, $r = R$ (raio da esfera).</p>

        <h4>Diferença entre φ e φ'</h4>
        <p>A diferença $\\varphi - \\varphi'$ é chamada de <strong>redução da latitude</strong>. 
        Ela é máxima em latitude ~45° e pode atingir aproximadamente <strong>11,5 minutos de arco</strong> 
        (~21 km na superfície). Esta diferença existe porque a normal ao elipsoide não passa pelo 
        centro da Terra.</p>
    `,

    howItWorks: `
        <h3>Como Funciona</h3>
        <p>A posição no sistema esférico é dada por <span class="coord-badge">(φ', λ, r)</span>.</p>

        <h4>Conversão para Cartesianas</h4>
        <div class="formula-block">
            <div class="formula-label">Esféricas → Cartesianas</div>
            <p>$$X = r \\cos\\varphi' \\cos\\lambda$$</p>
            <p>$$Y = r \\cos\\varphi' \\sin\\lambda$$</p>
            <p>$$Z = r \\sin\\varphi'$$</p>
        </div>

        <h4>Relação com Latitude Geodésica</h4>
        <div class="formula-block">
            <div class="formula-label">Redução da Latitude</div>
            <p>$$\\tan\\varphi' = (1 - e^2) \\tan\\varphi$$</p>
        </div>
        <p>Onde $e^2$ é o quadrado da primeira excentricidade do elipsoide.</p>

        <h4>Quando Usar</h4>
        <p>Coordenadas esféricas são adequadas quando a simplificação esférica é aceitável: 
        navegação astronômica, cálculos de satélites distantes, e problemas onde o achatamento 
        da Terra é desprezível.</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    let radius = 2.0;
    let phiPrime = 45; // geocentric latitude
    let lambda = 30; // longitude
    let rVal = 2.0; // distance from center

    let showRadiusVector = true;
    let showAngles = true;
    let showComparison = false; // compare with geodetic
    let showMeridians = true;
    let showParallels = true;

    // Ellipsoid params for comparison
    const aEll = 2.0;
    const fEll = 1 / 298.257;
    const fExag = 15.0;

    // Materials
    const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x1a6b5c,
        specular: 0x44ccaa,
        shininess: 40,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
    });

    const radiusVecMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const arcPhiMat = new THREE.LineBasicMaterial({ color: 0xff6644 });
    const arcLambdaMat = new THREE.LineBasicMaterial({ color: 0x44ff66 });
    const meridianMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
    const parallelMat = new THREE.LineBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.3 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44 });

    // For comparison
    const normalMat = new THREE.LineBasicMaterial({ color: 0xff4444 });
    const compEllMat = new THREE.MeshPhongMaterial({
        color: 0x1a5276,
        specular: 0x4488cc,
        shininess: 30,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
    });

    function spherePoint(latDeg, lonDeg, r) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            r * Math.cos(phi) * Math.cos(lam),
            r * Math.sin(phi),
            r * Math.cos(phi) * Math.sin(lam)
        );
    }

    function ellipsoidPoint(latDeg, lonDeg) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        const bEll = aEll * (1 - fEll * fExag);
        const e2 = 1 - (bEll * bEll) / (aEll * aEll);
        const N = aEll / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
        return new THREE.Vector3(
            N * Math.cos(phi) * Math.cos(lam),
            N * (1 - e2) * Math.sin(phi),
            N * Math.cos(phi) * Math.sin(lam)
        );
    }

    function buildScene() {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        // --- Sphere ---
        const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        group.add(sphereMesh);

        // --- Meridians ---
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

        // --- Parallels ---
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

        // --- Equator ---
        const eqPts = [];
        for (let j = 0; j <= 128; j++) {
            const lon = (j / 128) * 360;
            eqPts.push(spherePoint(0, lon, radius * 1.003));
        }
        const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
        group.add(new THREE.Line(eqGeo, equatorMat));

        // --- Rotation axis ---
        const axisPts = [
            new THREE.Vector3(0, -radius * 1.4, 0),
            new THREE.Vector3(0, radius * 1.4, 0),
        ];
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
        const axisMat = new THREE.LineBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.4 });
        group.add(new THREE.Line(axisGeo, axisMat));

        // --- Point P ---
        const pPos = spherePoint(phiPrime, lambda, rVal);

        const pGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pPos);
        group.add(pMesh);

        // --- Radius vector ---
        if (showRadiusVector) {
            const origin = new THREE.Vector3(0, 0, 0);
            const rvGeo = new THREE.BufferGeometry().setFromPoints([origin, pPos]);
            group.add(new THREE.Line(rvGeo, radiusVecMat));

            // Arrow at P
            const dir = pPos.clone().normalize();
            const arrowHelper = new THREE.ArrowHelper(dir, pPos.clone().sub(dir.clone().multiplyScalar(0.2)), 0.2, 0x38bdf8, 0.12, 0.06);
            group.add(arrowHelper);

            // Label "r"
            const rLabel = makeTextSprite('r', 0x38bdf8);
            rLabel.position.copy(pPos.clone().multiplyScalar(0.5).add(new THREE.Vector3(0.15, 0.1, 0)));
            group.add(rLabel);
        }

        // --- Angle arcs ---
        if (showAngles) {
            const phiRad = THREE.MathUtils.degToRad(phiPrime);
            const lamRad = THREE.MathUtils.degToRad(lambda);
            const arcRadius = 0.7;

            // φ' arc
            const phiPts = [];
            const phiSteps = 32;
            for (let i = 0; i <= phiSteps; i++) {
                const t = (i / phiSteps) * phiRad;
                const dir = new THREE.Vector3(
                    Math.cos(t) * Math.cos(lamRad),
                    Math.sin(t),
                    Math.cos(t) * Math.sin(lamRad)
                ).normalize().multiplyScalar(arcRadius);
                phiPts.push(dir);
            }
            if (phiPts.length > 1) {
                const phiGeo = new THREE.BufferGeometry().setFromPoints(phiPts);
                group.add(new THREE.Line(phiGeo, arcPhiMat));

                const midIdx = Math.floor(phiSteps / 2);
                const phiLabel = makeTextSprite("φ'", 0xff6644);
                phiLabel.position.copy(phiPts[midIdx].clone().multiplyScalar(1.3));
                group.add(phiLabel);
            }

            // λ arc
            const lambdaPts = [];
            const lambdaSteps = 32;
            for (let i = 0; i <= lambdaSteps; i++) {
                const t = (i / lambdaSteps) * lamRad;
                const dir = new THREE.Vector3(
                    Math.cos(t), 0, Math.sin(t)
                ).normalize().multiplyScalar(arcRadius * 0.5);
                lambdaPts.push(dir);
            }
            if (lambdaPts.length > 1) {
                const lamGeo = new THREE.BufferGeometry().setFromPoints(lambdaPts);
                group.add(new THREE.Line(lamGeo, arcLambdaMat));

                const midIdx = Math.floor(lambdaSteps / 2);
                const lamLabel = makeTextSprite('λ', 0x44ff66);
                lamLabel.position.copy(lambdaPts[midIdx].clone().add(new THREE.Vector3(0, -0.12, 0)));
                group.add(lamLabel);
            }
        }

        // --- Comparison with geodetic ---
        if (showComparison) {
            const bEll = aEll * (1 - fEll * fExag);

            // Ellipsoid (transparent overlay)
            const ellGeo = new THREE.SphereGeometry(1, 64, 64);
            const ellMesh = new THREE.Mesh(ellGeo, compEllMat);
            ellMesh.scale.set(aEll, bEll, aEll);
            group.add(ellMesh);

            // Compute geodetic latitude for same geocentric point
            // tan(φ) = tan(φ') / (1 - e²)
            const e2 = 1 - (bEll * bEll) / (aEll * aEll);
            const phiPrimeRad = THREE.MathUtils.degToRad(phiPrime);
            const phiGeodRad = Math.atan(Math.tan(phiPrimeRad) / (1 - e2));
            const phiGeodDeg = THREE.MathUtils.radToDeg(phiGeodRad);

            // Show normal to ellipsoid at the geodetic point
            const pEll = ellipsoidPoint(phiGeodDeg, lambda);
            const normalDir = new THREE.Vector3(
                Math.cos(phiGeodRad) * Math.cos(THREE.MathUtils.degToRad(lambda)),
                Math.sin(phiGeodRad),
                Math.cos(phiGeodRad) * Math.sin(THREE.MathUtils.degToRad(lambda))
            ).normalize();

            const nLen = 1.2;
            const nStart = pEll.clone().sub(normalDir.clone().multiplyScalar(0.3));
            const nEnd = pEll.clone().add(normalDir.clone().multiplyScalar(nLen));
            const nGeo = new THREE.BufferGeometry().setFromPoints([nStart, nEnd]);
            group.add(new THREE.Line(nGeo, normalMat));

            // Normal label
            const nLabel = makeTextSprite('n (normal)', 0xff4444, 0.25);
            nLabel.position.copy(nEnd.clone().add(normalDir.clone().multiplyScalar(0.15)));
            group.add(nLabel);

            // Angle difference indicator
            const diffLabel = makeTextSprite(
                `Δ = ${Math.abs(phiGeodDeg - phiPrime).toFixed(2)}°`,
                0xffaa00, 0.25
            );
            diffLabel.position.copy(pPos.clone().add(new THREE.Vector3(0.3, 0.3, 0)));
            group.add(diffLabel);
        }

        // P label
        const pLabel = makeTextSprite('P', 0xffffff);
        pLabel.position.copy(pPos.clone().add(new THREE.Vector3(0.15, 0.15, 0)));
        group.add(pLabel);

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const pPos = spherePoint(phiPrime, lambda, rVal);

        readout.innerHTML = `
            <div class="readout-title">Coordenadas Esféricas</div>
            <div class="readout-row">
                <span class="readout-label">φ' =</span>
                <span class="readout-value">${phiPrime.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">λ =</span>
                <span class="readout-value">${lambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">r =</span>
                <span class="readout-value">${rVal.toFixed(2)}</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
                <span class="readout-label">X =</span>
                <span class="readout-value">${pPos.x.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Y =</span>
                <span class="readout-value">${pPos.y.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Z =</span>
                <span class="readout-value">${pPos.z.toFixed(3)}</span>
            </div>
        `;
        readout.classList.add('visible');
    }

    buildScene();

    function update(time) {
        // No auto-rotation
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
                <div class="control-group">
                    <label>Latitude Geocêntrica (φ'): <span class="value-display" id="phi-val">${phiPrime.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${phiPrime}">
                </div>
                <div class="control-group">
                    <label>Longitude (λ): <span class="value-display" id="lambda-val">${lambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lambda" min="-180" max="180" step="1" value="${lambda}">
                </div>
                <div class="control-group">
                    <label>Raio (r): <span class="value-display" id="r-val">${rVal.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-r" min="0.5" max="3.5" step="0.05" value="${rVal}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-rv" ${showRadiusVector ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Raio Vetor</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-angles" ${showAngles ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Ângulos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-comparison" ${showComparison ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Comparar c/ Geodésicas</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-meridians" ${showMeridians ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Meridianos</span>
                    </label>
                </div>
            </div>
        `;

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
        container.querySelector('#ctrl-meridians').addEventListener('change', e => {
            showMeridians = e.target.checked;
            buildScene();
        });
    }

    return { update, cleanup, createControls };
}

// ============================================
// Text Sprite Helper
// ============================================
function makeTextSprite(text, color = 0xffffff, size = 0.35) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hex = '#' + new THREE.Color(color).getHexString();
    ctx.fillStyle = hex;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size * 3, size * 0.75, 1);
    return sprite;
}
