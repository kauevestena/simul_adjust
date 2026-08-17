import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'ECEF',
    icon: '🎯',
    subtitle: 'Earth-Centered, Earth-Fixed (X, Y, Z)',
    cameraPosition: [6, 4, 6],

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

        <h4>Uso em GNSS</h4>
        <p>Os receptores GNSS calculam posições em ECEF. A conversão para geodésicas 
        (φ, λ, h) é feita internamente pelo firmware do receptor para apresentar 
        resultados ao usuário.</p>
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

    let phi = 30;
    let lambda = 45;
    let hVal = 0.3;

    let showProjections = true;
    let showAxisLabels = true;
    let showEllipsoid = true;
    let showCoordPlanes = false;

    function getB() { return a * (1 - f * fExag); }
    function getEcc2() { const b = getB(); return 1 - (b * b) / (a * a); }

    function computeECEF(latDeg, lonDeg, h) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();
        const N = a / Math.sqrt(1 - e2 * Math.sin(phiRad) * Math.sin(phiRad));

        const X = (N + h) * Math.cos(phiRad) * Math.cos(lamRad);
        const Z = (N + h) * Math.cos(phiRad) * Math.sin(lamRad); // Z in three.js is "Y" in geodesy
        const Y = (N * (1 - e2) + h) * Math.sin(phiRad);

        return new THREE.Vector3(X, Y, Z);
    }

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
            const ellMat = new THREE.MeshPhongMaterial({
                color: 0x1a5276,
                specular: 0x4488cc,
                shininess: 30,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
            });
            const ellMesh = new THREE.Mesh(ellGeo, ellMat);
            ellMesh.scale.set(a, b, a);
            group.add(ellMesh);

            // Wireframe
            const wireGeo = new THREE.SphereGeometry(1, 24, 24);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0x4488cc,
                wireframe: true,
                transparent: true,
                opacity: 0.08,
            });
            const wireMesh = new THREE.Mesh(wireGeo, wireMat);
            wireMesh.scale.set(a, b, a);
            group.add(wireMesh);
        }

        // --- ECEF Axes ---
        const axisLen = 3.5;
        const axisColors = {
            x: 0xff4444,  // Red
            y: 0x44ff44,  // Green
            z: 0x4488ff,  // Blue
        };

        // X axis
        const xArrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0),
            axisLen, axisColors.x, 0.2, 0.1
        );
        group.add(xArrow);
        // Negative X
        const xNeg = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(-axisLen * 0.5, 0, 0)
        ]);
        group.add(new THREE.Line(xNeg, new THREE.LineBasicMaterial({ color: axisColors.x, transparent: true, opacity: 0.3 })));

        // Y axis (up in Three.js = Z in ECEF geodetic, but we use Y=up=polar)
        const yArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0),
            axisLen, axisColors.y, 0.2, 0.1
        );
        group.add(yArrow);
        const yNeg = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -axisLen * 0.5, 0)
        ]);
        group.add(new THREE.Line(yNeg, new THREE.LineBasicMaterial({ color: axisColors.y, transparent: true, opacity: 0.3 })));

        // Z axis
        const zArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
            axisLen, axisColors.z, 0.2, 0.1
        );
        group.add(zArrow);
        const zNeg = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -axisLen * 0.5)
        ]);
        group.add(new THREE.Line(zNeg, new THREE.LineBasicMaterial({ color: axisColors.z, transparent: true, opacity: 0.3 })));

        // Axis labels
        if (showAxisLabels) {
            const xLabel = makeTextSprite('X', axisColors.x, 0.4);
            xLabel.position.set(axisLen + 0.3, 0, 0);
            group.add(xLabel);

            const yLabel = makeTextSprite('Z', axisColors.y, 0.4);
            yLabel.position.set(0, axisLen + 0.3, 0);
            group.add(yLabel);

            const zLabel = makeTextSprite('Y', axisColors.z, 0.4);
            zLabel.position.set(0, 0, axisLen + 0.3);
            group.add(zLabel);

            // Origin label
            const oLabel = makeTextSprite('O', 0xffffff, 0.3);
            oLabel.position.set(-0.2, -0.2, -0.2);
            group.add(oLabel);

            // Greenwich label on X axis
            const gLabel = makeTextSprite('Greenwich (λ=0°)', 0xff6644, 0.2);
            gLabel.position.set(axisLen * 0.7, 0.3, 0);
            group.add(gLabel);

            // Polo Norte on Z(Y) axis
            const pnLabel = makeTextSprite('Polo Norte', 0x44ff44, 0.2);
            pnLabel.position.set(0.4, axisLen * 0.85, 0);
            group.add(pnLabel);
        }

        // --- Coordinate planes (semi-transparent) ---
        if (showCoordPlanes) {
            // Equatorial plane (XY in ECEF = XZ in Three.js)
            const eqPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(axisLen * 2, axisLen * 2),
                new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.05, side: THREE.DoubleSide })
            );
            eqPlane.rotation.x = -Math.PI / 2;
            group.add(eqPlane);
        }

        // --- Point P ---
        const pPos = computeECEF(phi, lambda, hVal);

        const pMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff6644 })
        );
        pMesh.position.copy(pPos);
        group.add(pMesh);

        // Position vector
        const vecGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pPos]);
        const vecMat = new THREE.LineBasicMaterial({ color: 0xff6644, linewidth: 2 });
        group.add(new THREE.Line(vecGeo, vecMat));

        // --- Projections ---
        if (showProjections) {
            const dashedMaterial = (color) => new THREE.LineDashedMaterial({
                color, dashSize: 0.1, gapSize: 0.05, transparent: true, opacity: 0.5
            });

            // Project onto XZ plane (equatorial) — drop Y
            const pXZ = new THREE.Vector3(pPos.x, 0, pPos.z);
            const projYGeo = new THREE.BufferGeometry().setFromPoints([pPos, pXZ]);
            const projYLine = new THREE.Line(projYGeo, dashedMaterial(axisColors.y));
            projYLine.computeLineDistances();
            group.add(projYLine);

            // Project onto X axis
            const pX = new THREE.Vector3(pPos.x, 0, 0);
            const projXGeo = new THREE.BufferGeometry().setFromPoints([pXZ, pX]);
            const projXLine = new THREE.Line(projXGeo, dashedMaterial(axisColors.x));
            projXLine.computeLineDistances();
            group.add(projXLine);

            // Project onto Z axis
            const pZ = new THREE.Vector3(0, 0, pPos.z);
            const projZGeo = new THREE.BufferGeometry().setFromPoints([pXZ, pZ]);
            const projZLine = new THREE.Line(projZGeo, dashedMaterial(axisColors.z));
            projZLine.computeLineDistances();
            group.add(projZLine);

            // Small squares at projections
            [pX, pXZ, pZ].forEach(pt => {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.04, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xaaaaaa })
                );
                dot.position.copy(pt);
                group.add(dot);
            });

            // Component labels
            const xCompLabel = makeTextSprite(`X=${pPos.x.toFixed(2)}`, axisColors.x, 0.2);
            xCompLabel.position.copy(pX.clone().add(new THREE.Vector3(0, -0.2, 0)));
            group.add(xCompLabel);

            const yCompLabel = makeTextSprite(`Z=${pPos.y.toFixed(2)}`, axisColors.y, 0.2);
            yCompLabel.position.copy(new THREE.Vector3(pPos.x * 0.5, pPos.y * 0.5 + 0.15, pPos.z * 0.5));
            group.add(yCompLabel);

            const zCompLabel = makeTextSprite(`Y=${pPos.z.toFixed(2)}`, axisColors.z, 0.2);
            zCompLabel.position.copy(pZ.clone().add(new THREE.Vector3(0, -0.2, 0)));
            group.add(zCompLabel);
        }

        // P label
        const pLabel = makeTextSprite('P', 0xffffff, 0.35);
        pLabel.position.copy(pPos.clone().add(new THREE.Vector3(0.2, 0.2, 0)));
        group.add(pLabel);

        updateReadout(pPos);
    }

    function updateReadout(pPos) {
        const readout = document.getElementById('coord-readout');
        readout.innerHTML = `
            <div class="readout-title">ECEF (X, Y, Z)</div>
            <div class="readout-row">
                <span class="readout-label">X =</span>
                <span class="readout-value" style="color:#ff4444">${pPos.x.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Y =</span>
                <span class="readout-value" style="color:#4488ff">${pPos.z.toFixed(3)}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Z =</span>
                <span class="readout-value" style="color:#44ff44">${pPos.y.toFixed(3)}</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
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
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-proj" ${showProjections ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Projeções</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-ell" ${showEllipsoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Elipsoide</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-planes" ${showCoordPlanes ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Plano Equatorial</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-labels" ${showAxisLabels ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Rótulos</span>
                    </label>
                </div>
            </div>
        `;

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
        container.querySelector('#ctrl-proj').addEventListener('change', e => {
            showProjections = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-ell').addEventListener('change', e => {
            showEllipsoid = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-planes').addEventListener('change', e => {
            showCoordPlanes = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-labels').addEventListener('change', e => {
            showAxisLabels = e.target.checked;
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
