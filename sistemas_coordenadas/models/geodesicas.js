import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Coordenadas Geodésicas',
    icon: '📐',
    subtitle: 'Latitude, Longitude e Altura Elipsoidal (φ, λ, h)',
    cameraPosition: [5, 3, 5],

    concept: `
        <h3>Coordenadas Geodésicas (φ, λ, h)</h3>
        <p>O sistema de <strong>coordenadas geodésicas</strong> é o mais utilizado em Geodésia para 
        descrever posições sobre ou próximas à superfície terrestre. Ele está fundamentado na 
        geometria de um <strong>elipsoide de revolução</strong> como superfície de referência.</p>

        <h4>Grandezas</h4>
        <p><strong>Latitude geodésica (φ)</strong>: ângulo formado entre a <em>normal ao elipsoide</em> 
        no ponto P e o plano do equador. Varia de −90° (polo sul) a +90° (polo norte).</p>

        <p><strong>Longitude geodésica (λ)</strong>: ângulo medido no plano equatorial entre o 
        meridiano de referência (Greenwich) e o meridiano que contém o ponto P. Varia de −180° a +180°.</p>

        <p><strong>Altura elipsoidal (h)</strong>: distância ao longo da normal ao elipsoide, do 
        elipsoide até o ponto P. Pode ser positiva (acima) ou negativa (abaixo do elipsoide).</p>

        <h4>Aspecto Fundamental</h4>
        <p>A <em>normal ao elipsoide</em> <strong>não passa pelo centro da Terra</strong> (exceto no 
        equador e nos polos). Isso diferencia essencialmente a latitude geodésica da latitude 
        geocêntrica (esférica).</p>
    `,

    howItWorks: `
        <h3>Como Funciona</h3>
        <p>A posição de um ponto P no espaço é definida pela tripla <span class="coord-badge">(φ, λ, h)</span>.</p>

        <h4>Conversão para Cartesianas (ECEF)</h4>
        <div class="formula-block">
            <div class="formula-label">Geodésicas → ECEF</div>
            <p>$$X = (N + h) \\cos\\varphi \\cos\\lambda$$</p>
            <p>$$Y = (N + h) \\cos\\varphi \\sin\\lambda$$</p>
            <p>$$Z = \\left[N(1 - e^2) + h\\right] \\sin\\varphi$$</p>
        </div>

        <p>Onde $N$ é o <strong>raio de curvatura da seção normal primeiro vertical</strong>:</p>
        <div class="formula-block">
            <div class="formula-label">Grande Normal</div>
            <p>$$N = \\frac{a}{\\sqrt{1 - e^2 \\sin^2\\varphi}}$$</p>
        </div>

        <p>Com $a$ = semi-eixo maior do elipsoide e $e$ = primeira excentricidade.</p>

        <h4>Diferença para Esféricas</h4>
        <p>No modelo esférico, a "normal" é o próprio raio vetor que passa pelo centro. 
        No elipsoide, a normal e o raio vetor formam um ângulo (a <strong>redução da latitude</strong>), 
        que pode chegar a ~11,5' de arco (~21 km na superfície).</p>
    `,
};

// ============================================
// Helper: create arc geometry
// ============================================
function createArc(center, start, end, normal, radius, segments = 64) {
    const points = [];
    const startVec = start.clone().sub(center).normalize();
    const endVec = end.clone().sub(center).normalize();

    // angle between start and end around normal
    const angle = startVec.angleTo(endVec);
    const cross = new THREE.Vector3().crossVectors(startVec, endVec);
    const sign = cross.dot(normal) >= 0 ? 1 : -1;
    const totalAngle = sign * angle;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = t * totalAngle;
        const pt = startVec.clone().applyAxisAngle(normal, a).multiplyScalar(radius).add(center);
        points.push(pt);
    }
    return points;
}

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    // Ellipsoid parameters (in scene units)
    const a = 2.0; // semi-major axis
    let f = 1 / 298.257; // flattening (real value)
    let fExag = 15.0; // exaggeration factor for visualization
    let phi = 45; // latitude in degrees
    let lambda = 30; // longitude in degrees
    let hVal = 0.5; // height above ellipsoid

    let showNormal = true;
    let showAngles = true;
    let showMeridians = true;
    let showParallels = true;
    let showEquator = true;

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x1a5276,
        specular: 0x4488cc,
        shininess: 40,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
    });

    const normalMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    const meridianMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
    const parallelMat = new THREE.LineBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.3 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44, linewidth: 2 });
    const arcPhiMat = new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2 });
    const arcLambdaMat = new THREE.LineBasicMaterial({ color: 0x44ff66, linewidth: 2 });
    const heightMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });

    function getB() {
        const fEff = f * fExag;
        return a * (1 - fEff);
    }

    function getEcc2() {
        const b = getB();
        return 1 - (b * b) / (a * a);
    }

    // Compute point on ellipsoid surface
    function ellipsoidPoint(latDeg, lonDeg, h = 0) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();
        const N = a / Math.sqrt(1 - e2 * Math.sin(phiRad) * Math.sin(phiRad));

        const x = (N + h) * Math.cos(phiRad) * Math.cos(lamRad);
        const z = (N + h) * Math.cos(phiRad) * Math.sin(lamRad);
        const y = (N * (1 - e2) + h) * Math.sin(phiRad);

        return new THREE.Vector3(x, y, z);
    }

    // Normal to ellipsoid at a given lat/lon (unit vector)
    function ellipsoidNormal(latDeg, lonDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);

        // The normal direction is simply (cos(phi)*cos(lam), sin(phi), cos(phi)*sin(lam))
        // for geodetic coordinates on the ellipsoid
        const nx = Math.cos(phiRad) * Math.cos(lamRad);
        const ny = Math.sin(phiRad);
        const nz = Math.cos(phiRad) * Math.sin(lamRad);

        return new THREE.Vector3(nx, ny, nz).normalize();
    }

    function buildScene() {
        // Clear group
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const b = getB();

        // --- Ellipsoid ---
        const ellGeo = new THREE.SphereGeometry(1, 64, 64);
        // Scale to ellipsoid
        const ellMesh = new THREE.Mesh(ellGeo, ellipsoidMat);
        ellMesh.scale.set(a, b, a); // x=a, y=b (polar axis), z=a
        group.add(ellMesh);

        // --- Meridians ---
        if (showMeridians) {
            for (let i = 0; i < 12; i++) {
                const lon = (i / 12) * 360;
                const pts = [];
                for (let j = 0; j <= 64; j++) {
                    const lat = -90 + (j / 64) * 180;
                    pts.push(ellipsoidPoint(lat, lon));
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
                        pts.push(ellipsoidPoint(lat, lon));
                    }
                    const geo = new THREE.BufferGeometry().setFromPoints(pts);
                    group.add(new THREE.Line(geo, parallelMat));
                });
            }
        }

        // --- Equator ---
        if (showEquator) {
            const eqPts = [];
            for (let j = 0; j <= 128; j++) {
                const lon = (j / 128) * 360;
                eqPts.push(ellipsoidPoint(0, lon));
            }
            const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
            group.add(new THREE.Line(eqGeo, equatorMat));
        }

        // --- Rotation axis ---
        const axisPts = [
            new THREE.Vector3(0, -b * 1.4, 0),
            new THREE.Vector3(0, b * 1.4, 0),
        ];
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
        const axisMat2 = new THREE.LineBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.4 });
        group.add(new THREE.Line(axisGeo, axisMat2));

        // --- Point P on surface ---
        const pSurface = ellipsoidPoint(phi, lambda);
        const normal = ellipsoidNormal(phi, lambda);
        const pPoint = pSurface.clone().add(normal.clone().multiplyScalar(hVal));

        // Point P marker
        const pGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pPoint);
        group.add(pMesh);

        // Surface point marker
        const sMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        sMesh.position.copy(pSurface);
        group.add(sMesh);

        // --- Normal line ---
        if (showNormal) {
            const normalLen = hVal + 1.0;
            const nEnd = pSurface.clone().add(normal.clone().multiplyScalar(normalLen));
            const nGeo = new THREE.BufferGeometry().setFromPoints([pSurface.clone().sub(normal.clone().multiplyScalar(0.3)), nEnd]);
            group.add(new THREE.Line(nGeo, normalMat));

            // Arrow head
            const arrowDir = normal.clone();
            const arrowLen = 0.2;
            const arrowHelper = new THREE.ArrowHelper(arrowDir, nEnd.clone().sub(arrowDir.clone().multiplyScalar(arrowLen)), arrowLen, 0xff4444, 0.12, 0.06);
            group.add(arrowHelper);

            // Label "n" near the normal
            const labelSprite = makeTextSprite('n', 0xff4444);
            labelSprite.position.copy(nEnd.clone().add(normal.clone().multiplyScalar(0.15)));
            group.add(labelSprite);
        }

        // --- Height line (h) ---
        if (hVal > 0.01) {
            const hGeo = new THREE.BufferGeometry().setFromPoints([pSurface, pPoint]);
            group.add(new THREE.Line(hGeo, heightMat));

            // Label "h"
            const hMid = pSurface.clone().add(pPoint).multiplyScalar(0.5);
            const hLabel = makeTextSprite('h', 0xffaa00);
            hLabel.position.copy(hMid.clone().add(new THREE.Vector3(0.15, 0, 0.15)));
            group.add(hLabel);
        }

        // --- Angle arcs ---
        if (showAngles) {
            // φ arc: from equatorial plane to normal direction
            const phiRad = THREE.MathUtils.degToRad(phi);
            const lamRad = THREE.MathUtils.degToRad(lambda);

            // Project of P onto equator plane
            const pEquator = new THREE.Vector3(
                Math.cos(lamRad),
                0,
                Math.sin(lamRad)
            ).normalize();

            // Draw arc from equator direction to normal direction
            const arcRadius = 0.8;
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

                // Label "φ"
                const midIdx = Math.floor(phiSteps / 2);
                const phiLabel = makeTextSprite('φ', 0xff6644);
                phiLabel.position.copy(phiPts[midIdx].clone().multiplyScalar(1.25));
                group.add(phiLabel);
            }

            // λ arc: from X axis (Greenwich) to the meridian of P on equator
            const lambdaPts = [];
            const lambdaSteps = 32;
            for (let i = 0; i <= lambdaSteps; i++) {
                const t = (i / lambdaSteps) * lamRad;
                const dir = new THREE.Vector3(
                    Math.cos(t),
                    0,
                    Math.sin(t)
                ).normalize().multiplyScalar(arcRadius * 0.6);
                lambdaPts.push(dir);
            }
            if (lambdaPts.length > 1) {
                const lamGeo = new THREE.BufferGeometry().setFromPoints(lambdaPts);
                group.add(new THREE.Line(lamGeo, arcLambdaMat));

                const midIdx = Math.floor(lambdaSteps / 2);
                const lamLabel = makeTextSprite('λ', 0x44ff66);
                lamLabel.position.copy(lambdaPts[midIdx].clone().add(new THREE.Vector3(0, -0.15, 0)));
                group.add(lamLabel);
            }

            // Reference meridian line (Greenwich, λ=0)
            const refMeridianPts = [];
            for (let i = 0; i <= 32; i++) {
                const lat = (i / 32) * 90;
                refMeridianPts.push(ellipsoidPoint(lat, 0));
            }
            const refMeridGeo = new THREE.BufferGeometry().setFromPoints(refMeridianPts);
            const refMeridMat = new THREE.LineBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.6 });
            group.add(new THREE.Line(refMeridGeo, refMeridMat));
        }

        // --- P label ---
        const pLabel = makeTextSprite('P', 0xffffff);
        pLabel.position.copy(pPoint.clone().add(new THREE.Vector3(0.15, 0.15, 0)));
        group.add(pLabel);

        // Update readout
        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const pSurface = ellipsoidPoint(phi, lambda);
        const normal = ellipsoidNormal(phi, lambda);
        const pPoint = pSurface.clone().add(normal.clone().multiplyScalar(hVal));

        readout.innerHTML = `
            <div class="readout-title">Coordenadas Geodésicas</div>
            <div class="readout-row">
                <span class="readout-label">φ =</span>
                <span class="readout-value">${phi.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">λ =</span>
                <span class="readout-value">${lambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">h =</span>
                <span class="readout-value">${hVal.toFixed(2)}</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
                <span class="readout-label">X =</span>
                <span class="readout-value">${pPoint.x.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Y =</span>
                <span class="readout-value">${pPoint.y.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Z =</span>
                <span class="readout-value">${pPoint.z.toFixed(3)}</span>
            </div>
        `;
        readout.classList.add('visible');
    }

    buildScene();

    function update(time) {
        // gentle auto-rotation
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
                    <label>Latitude (φ): <span class="value-display" id="phi-val">${phi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${phi}">
                </div>
                <div class="control-group">
                    <label>Longitude (λ): <span class="value-display" id="lambda-val">${lambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lambda" min="-180" max="180" step="1" value="${lambda}">
                </div>
                <div class="control-group">
                    <label>Altura (h): <span class="value-display" id="h-val">${hVal.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-h" min="0" max="2" step="0.05" value="${hVal}">
                </div>
                <div class="control-group">
                    <label>Exagero do achatamento: <span class="value-display" id="fexag-val">${fExag.toFixed(0)}×</span></label>
                    <input type="range" id="ctrl-fexag" min="1" max="80" step="1" value="${fExag}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-normal" ${showNormal ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Normal</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-angles" ${showAngles ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Ângulos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-meridians" ${showMeridians ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Meridianos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-parallels" ${showParallels ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Paralelos</span>
                    </label>
                </div>
            </div>
        `;

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
        container.querySelector('#ctrl-angles').addEventListener('change', e => {
            showAngles = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-meridians').addEventListener('change', e => {
            showMeridians = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-parallels').addEventListener('change', e => {
            showParallels = e.target.checked;
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
    canvas.width = 128;
    canvas.height = 64;

    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Convert color to CSS
    const hex = '#' + new THREE.Color(color).getHexString();
    ctx.fillStyle = hex;
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size * 2, size, 1);
    return sprite;
}
