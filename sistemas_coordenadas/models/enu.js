import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'ENU',
    icon: '🧭',
    subtitle: 'East, North, Up — Sistema Topocêntrico',
    cameraPosition: [5, 4, 5],

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

        <h4>Aplicações</h4>
        <p>• Levantamentos topográficos e geodésicos locais</p>
        <p>• Cálculo de azimutes e distâncias</p>
        <p>• Posicionamento relativo GNSS (baselines)</p>
        <p>• Rastreamento de satélites e aeronaves</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    const a = 2.0;
    const fExag = 15.0;
    const f = 1 / 298.257;

    let originPhi = 30;
    let originLambda = 30;
    let originH = 1000; // altitude in meters
    let targetPhi = 45;
    let targetLambda = 60;
    let targetH = 3000; // altitude in meters
    let hExag = 50.0; // visual exaggeration for altitude

    let showEllipsoid = true;
    let showENUAxes = true;
    let showDiffVector = true;
    let showENUComponents = true;

    function getB() { return a * (1 - f * fExag); }
    function getEcc2() { const b = getB(); return 1 - (b * b) / (a * a); }

    function computeECEF(latDeg, lonDeg, hMeters = 0) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();

        // hMeters to scene units (with exaggeration to be visible)
        // Earth radius a = 6378137m -> 2.0 units
        const hScene = (hMeters / 6378137) * a * hExag;

        const N = a / Math.sqrt(1 - e2 * Math.sin(phiRad) * Math.sin(phiRad));
        return new THREE.Vector3(
            (N + hScene) * Math.cos(phiRad) * Math.cos(lamRad),
            (N * (1 - e2) + hScene) * Math.sin(phiRad),
            (N + hScene) * Math.cos(phiRad) * Math.sin(lamRad)
        );
    }

    function getENUAxes(latDeg, lonDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);

        // East: -sin(λ), 0, cos(λ)
        const east = new THREE.Vector3(
            -Math.sin(lamRad),
            0,
            Math.cos(lamRad)
        ).normalize();

        // North: -sin(φ)*cos(λ), cos(φ), -sin(φ)*sin(λ)
        const north = new THREE.Vector3(
            -Math.sin(phiRad) * Math.cos(lamRad),
            Math.cos(phiRad),
            -Math.sin(phiRad) * Math.sin(lamRad)
        ).normalize();

        // Up: cos(φ)*cos(λ), sin(φ), cos(φ)*sin(λ)
        const up = new THREE.Vector3(
            Math.cos(phiRad) * Math.cos(lamRad),
            Math.sin(phiRad),
            Math.cos(phiRad) * Math.sin(lamRad)
        ).normalize();

        return { east, north, up };
    }

    function ecefToENU(origin, target, latDeg, lonDeg) {
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        const dz = target.z - origin.z;

        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);

        const dE = -Math.sin(lamRad) * dx + Math.cos(lamRad) * dz;
        const dN = -Math.sin(phiRad) * Math.cos(lamRad) * dx + Math.cos(phiRad) * dy - Math.sin(phiRad) * Math.sin(lamRad) * dz;
        const dU = Math.cos(phiRad) * Math.cos(lamRad) * dx + Math.sin(phiRad) * dy + Math.cos(phiRad) * Math.sin(lamRad) * dz;

        return { dE, dN, dU };
    }

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x1a5276,
        specular: 0x4488cc,
        shininess: 30,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
    });

    function buildScene() {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const b = getB();

        // --- Ellipsoid ---
        if (showEllipsoid) {
            const ellGeo = new THREE.SphereGeometry(1, 48, 48);
            const ellMesh = new THREE.Mesh(ellGeo, ellipsoidMat);
            ellMesh.scale.set(a, b, a);
            group.add(ellMesh);

            // Wireframe
            const wireGeo = new THREE.SphereGeometry(1, 24, 24);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0x4488cc,
                wireframe: true,
                transparent: true,
                opacity: 0.06,
            });
            const wireMesh = new THREE.Mesh(wireGeo, wireMat);
            wireMesh.scale.set(a, b, a);
            group.add(wireMesh);

            // Equator
            const eqPts = [];
            for (let j = 0; j <= 128; j++) {
                const lon = (j / 128) * 360;
                eqPts.push(computeECEF(0, lon));
            }
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(eqPts),
                new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.4 })
            ));
        }

        // --- Origin point ---
        const originPos = computeECEF(originPhi, originLambda, originH);
        const originMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        originMesh.position.copy(originPos);
        group.add(originMesh);

        const oLabel = makeTextSprite('Origem', 0x38bdf8, 0.25);
        oLabel.position.copy(originPos.clone().add(new THREE.Vector3(-0.1, -0.25, 0)));
        group.add(oLabel);

        // --- ENU axes at origin ---
        if (showENUAxes) {
            const { east, north, up } = getENUAxes(originPhi, originLambda);
            const axisLen = 1.2;

            // East (red-orange)
            const eArrow = new THREE.ArrowHelper(east, originPos, axisLen, 0xff6644, 0.15, 0.07);
            group.add(eArrow);
            const eLabel = makeTextSprite('E', 0xff6644, 0.3);
            eLabel.position.copy(originPos.clone().add(east.clone().multiplyScalar(axisLen + 0.2)));
            group.add(eLabel);

            // North (green)
            const nArrow = new THREE.ArrowHelper(north, originPos, axisLen, 0x44ff66, 0.15, 0.07);
            group.add(nArrow);
            const nLabel = makeTextSprite('N', 0x44ff66, 0.3);
            nLabel.position.copy(originPos.clone().add(north.clone().multiplyScalar(axisLen + 0.2)));
            group.add(nLabel);

            // Up (blue)
            const uArrow = new THREE.ArrowHelper(up, originPos, axisLen, 0x4488ff, 0.15, 0.07);
            group.add(uArrow);
            const uLabel = makeTextSprite('U', 0x4488ff, 0.3);
            uLabel.position.copy(originPos.clone().add(up.clone().multiplyScalar(axisLen + 0.2)));
            group.add(uLabel);

            // Tangent plane (small disc)
            const planeGeo = new THREE.CircleGeometry(0.8, 32);
            const planeMat = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
            });
            const planeMesh = new THREE.Mesh(planeGeo, planeMat);
            planeMesh.position.copy(originPos);

            // Orient the plane to be perpendicular to Up
            const planeNormal = up.clone();
            planeMesh.lookAt(originPos.clone().add(planeNormal));
            group.add(planeMesh);
        }

        // --- Target point Q ---
        const targetPos = computeECEF(targetPhi, targetLambda, targetH);
        const targetMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff4444 })
        );
        targetMesh.position.copy(targetPos);
        group.add(targetMesh);

        const qLabel = makeTextSprite('Q', 0xff4444, 0.3);
        qLabel.position.copy(targetPos.clone().add(new THREE.Vector3(0.15, 0.15, 0)));
        group.add(qLabel);

        // --- Difference vector ---
        if (showDiffVector) {
            const diffGeo = new THREE.BufferGeometry().setFromPoints([originPos, targetPos]);
            const diffMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
            group.add(new THREE.Line(diffGeo, diffMat));

            // Arrow
            const diffDir = targetPos.clone().sub(originPos).normalize();
            const diffLen = originPos.distanceTo(targetPos);
            const arrow = new THREE.ArrowHelper(diffDir, originPos, diffLen, 0xffaa00, 0.12, 0.06);
            group.add(arrow);
        }

        // --- ENU components of diff ---
        if (showENUComponents) {
            const { east, north, up } = getENUAxes(originPhi, originLambda);
            const enuCoords = ecefToENU(originPos, targetPos, originPhi, originLambda);

            // Show component vectors
            const eVec = east.clone().multiplyScalar(enuCoords.dE);
            const nVec = north.clone().multiplyScalar(enuCoords.dN);
            const uVec = up.clone().multiplyScalar(enuCoords.dU);

            // E component
            if (Math.abs(enuCoords.dE) > 0.01) {
                const eEnd = originPos.clone().add(eVec);
                const eGeo = new THREE.BufferGeometry().setFromPoints([originPos, eEnd]);
                group.add(new THREE.Line(eGeo, new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2 })));

                const deLabel = makeTextSprite(`ΔE=${enuCoords.dE.toFixed(2)}`, 0xff6644, 0.2);
                deLabel.position.copy(originPos.clone().add(eVec.clone().multiplyScalar(0.5)).add(east.clone().multiplyScalar(0.15)));
                group.add(deLabel);
            }

            // N component
            if (Math.abs(enuCoords.dN) > 0.01) {
                const eEnd = originPos.clone().add(eVec);
                const nEnd = eEnd.clone().add(nVec);
                const nGeo = new THREE.BufferGeometry().setFromPoints([eEnd, nEnd]);
                group.add(new THREE.Line(nGeo, new THREE.LineBasicMaterial({ color: 0x44ff66, linewidth: 2 })));

                const dnLabel = makeTextSprite(`ΔN=${enuCoords.dN.toFixed(2)}`, 0x44ff66, 0.2);
                dnLabel.position.copy(eEnd.clone().add(nVec.clone().multiplyScalar(0.5)).add(north.clone().multiplyScalar(0.15)));
                group.add(dnLabel);
            }

            // U component
            if (Math.abs(enuCoords.dU) > 0.01) {
                const eEnd = originPos.clone().add(eVec);
                const nEnd = eEnd.clone().add(nVec);
                const uEnd = nEnd.clone().add(uVec);
                const uGeo = new THREE.BufferGeometry().setFromPoints([nEnd, uEnd]);
                group.add(new THREE.Line(uGeo, new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 })));

                const duLabel = makeTextSprite(`ΔU=${enuCoords.dU.toFixed(2)}`, 0x4488ff, 0.2);
                duLabel.position.copy(nEnd.clone().add(uVec.clone().multiplyScalar(0.5)).add(up.clone().multiplyScalar(0.15)));
                group.add(duLabel);
            }
        }

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const originPos = computeECEF(originPhi, originLambda, originH);
        const targetPos = computeECEF(targetPhi, targetLambda, targetH);
        const enuCoords = ecefToENU(originPos, targetPos, originPhi, originLambda);
        const dist = originPos.distanceTo(targetPos);
        const az = THREE.MathUtils.radToDeg(Math.atan2(enuCoords.dE, enuCoords.dN));
        const el = THREE.MathUtils.radToDeg(Math.atan2(enuCoords.dU, Math.sqrt(enuCoords.dE ** 2 + enuCoords.dN ** 2)));

        readout.innerHTML = `
            <div class="readout-title">ENU (Origem → Q)</div>
            <div class="readout-row">
                <span class="readout-label">ΔE =</span>
                <span class="readout-value" style="color:#ff6644">${enuCoords.dE.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">ΔN =</span>
                <span class="readout-value" style="color:#44ff66">${enuCoords.dN.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">ΔU =</span>
                <span class="readout-value" style="color:#4488ff">${enuCoords.dU.toFixed(3)}</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
                <span class="readout-label">Dist =</span>
                <span class="readout-value">${dist.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Az =</span>
                <span class="readout-value">${((az + 360) % 360).toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Elev =</span>
                <span class="readout-value">${el.toFixed(1)}°</span>
            </div>
        `;
        readout.classList.add('visible');
    }

    buildScene();

    function update(time) {}

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
                    <label>Origem — φ: <span class="value-display" id="ophi-val">${originPhi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-ophi" min="-90" max="90" step="1" value="${originPhi}">
                </div>
                <div class="control-group">
                    <label>Origem — λ: <span class="value-display" id="olam-val">${originLambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-olam" min="-180" max="180" step="1" value="${originLambda}">
                </div>
                <div class="control-group">
                    <label>Origem — h: <span class="value-display" id="oh-val">${originH} m</span></label>
                    <input type="range" id="ctrl-oh" min="100" max="8000" step="100" value="${originH}">
                </div>
                <div class="control-group">
                    <label>Ponto Q — φ: <span class="value-display" id="tphi-val">${targetPhi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-tphi" min="-90" max="90" step="1" value="${targetPhi}">
                </div>
                <div class="control-group">
                    <label>Ponto Q — λ: <span class="value-display" id="tlam-val">${targetLambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-tlam" min="-180" max="180" step="1" value="${targetLambda}">
                </div>
                <div class="control-group">
                    <label>Ponto Q — h: <span class="value-display" id="th-val">${targetH} m</span></label>
                    <input type="range" id="ctrl-th" min="100" max="8000" step="100" value="${targetH}">
                </div>
                <div class="control-group">
                    <label>Exagero Visual (h): <span class="value-display" id="exag-val">${hExag.toFixed(0)}x</span></label>
                    <input type="range" id="ctrl-exag" min="1" max="200" step="1" value="${hExag}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-enu" ${showENUAxes ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Eixos ENU</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-diff" ${showDiffVector ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Vetor Diferença</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-comp" ${showENUComponents ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Componentes ENU</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-ell" ${showEllipsoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Elipsoide</span>
                    </label>
                </div>
            </div>
        `;

        container.querySelector('#ctrl-ophi').addEventListener('input', e => {
            originPhi = parseFloat(e.target.value);
            container.querySelector('#ophi-val').textContent = originPhi.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-olam').addEventListener('input', e => {
            originLambda = parseFloat(e.target.value);
            container.querySelector('#olam-val').textContent = originLambda.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-oh').addEventListener('input', e => {
            originH = parseFloat(e.target.value);
            container.querySelector('#oh-val').textContent = originH + ' m';
            buildScene();
        });
        container.querySelector('#ctrl-tphi').addEventListener('input', e => {
            targetPhi = parseFloat(e.target.value);
            container.querySelector('#tphi-val').textContent = targetPhi.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-tlam').addEventListener('input', e => {
            targetLambda = parseFloat(e.target.value);
            container.querySelector('#tlam-val').textContent = targetLambda.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-th').addEventListener('input', e => {
            targetH = parseFloat(e.target.value);
            container.querySelector('#th-val').textContent = targetH + ' m';
            buildScene();
        });
        container.querySelector('#ctrl-exag').addEventListener('input', e => {
            hExag = parseFloat(e.target.value);
            container.querySelector('#exag-val').textContent = hExag.toFixed(0) + 'x';
            buildScene();
        });
        container.querySelector('#ctrl-enu').addEventListener('change', e => {
            showENUAxes = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-diff').addEventListener('change', e => {
            showDiffVector = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-comp').addEventListener('change', e => {
            showENUComponents = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-ell').addEventListener('change', e => {
            showEllipsoid = e.target.checked;
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
    canvas.width = 512;
    canvas.height = 64;

    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hex = '#' + new THREE.Color(color).getHexString();
    ctx.fillStyle = hex;
    ctx.fillText(text, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size * 4, size * 0.5, 1);
    return sprite;
}
