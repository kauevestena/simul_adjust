import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Plano Topográfico Local',
    icon: '📏',
    subtitle: 'Coordenadas Planas Locais (x, y, z)',
    cameraPosition: [5, 5, 5],

    concept: `
        <h3>Plano Topográfico Local (PTL)</h3>
        <p>O <strong>Plano Topográfico Local</strong> é a aproximação mais antiga e intuitiva: 
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

        <h4>Hipótese da Terra Plana</h4>
        <p>Em topografia clássica, admite-se que:</p>
        <p>• As verticais são <strong>paralelas</strong> (e não convergentes)</p>
        <p>• As superfícies de nível são <strong>planas</strong> (e não curvas)</p>
        <p>• Distâncias no plano = distâncias na superfície (sem redução)</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    const a = 2.0; // Earth equatorial radius in scene units
    const fExag = 15.0;
    const f = 1 / 298.257;

    let planeRadius = 1.0; // radius of the tangent plane region
    let tangentPhi = 30; // tangent point latitude
    let tangentLambda = 0; // tangent point longitude
    let tangentH = 2000; // altitude in meters (100 to 8000)
    let hExag = 50.0; // visual exaggeration for altitude

    let showEllipsoid = true;
    let showValidityCircle = true;

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

    function ellipsoidNormal(latDeg, lonDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            Math.cos(phiRad) * Math.cos(lamRad),
            Math.sin(phiRad),
            Math.cos(phiRad) * Math.sin(lamRad)
        ).normalize();
    }

    function getEast(lonDeg) {
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(-Math.sin(lam), 0, Math.cos(lam)).normalize();
    }

    function getNorth(latDeg, lonDeg) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            -Math.sin(phi) * Math.cos(lam),
            Math.cos(phi),
            -Math.sin(phi) * Math.sin(lam)
        ).normalize();
    }

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x1a5276,
        specular: 0x4488cc,
        shininess: 30,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
    });

    const planeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.12,
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
                color: 0x4488cc, wireframe: true, transparent: true, opacity: 0.06,
            });
            const wireMesh = new THREE.Mesh(wireGeo, wireMat);
            wireMesh.scale.set(a, b, a);
            group.add(wireMesh);
        }

        // --- Tangent point and Plane ---
        const tangentPos = computeECEF(tangentPhi, tangentLambda, tangentH);
        const up = ellipsoidNormal(tangentPhi, tangentLambda);
        const east = getEast(tangentLambda);
        const north = getNorth(tangentPhi, tangentLambda);

        // Marker at altitude
        const tMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        tMesh.position.copy(tangentPos);
        group.add(tMesh);
        
        // Line from ellipsoid to plane
        const surfacePos = computeECEF(tangentPhi, tangentLambda, 0);
        const hLineGeo = new THREE.BufferGeometry().setFromPoints([surfacePos, tangentPos]);
        const hLineMat = new THREE.LineDashedMaterial({ 
            color: 0xffffff, dashSize: 0.05, gapSize: 0.05, transparent: true, opacity: 0.5 
        });
        const hLine = new THREE.Line(hLineGeo, hLineMat);
        hLine.computeLineDistances();
        group.add(hLine);

        // Tangent Plane
        const planeSize = planeRadius * 2;
        const pGeo = new THREE.PlaneGeometry(planeSize, planeSize, 20, 20);
        const pMesh = new THREE.Mesh(pGeo, planeMat);
        pMesh.position.copy(tangentPos);

        // Orient: plane normal = up direction
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
        pMesh.quaternion.copy(quat);
        group.add(pMesh);

        // Plane border
        const borderPts = [];
        const borderSegs = 64;
        for (let i = 0; i <= borderSegs; i++) {
            const angle = (i / borderSegs) * Math.PI * 2;
            const pt = tangentPos.clone()
                .add(east.clone().multiplyScalar(Math.cos(angle) * planeRadius))
                .add(north.clone().multiplyScalar(Math.sin(angle) * planeRadius));
            borderPts.push(pt);
        }
        group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(borderPts),
            new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
        ));

        // Grid on plane
        const gridLines = 8;
        const gridMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15 });
        for (let i = -gridLines / 2; i <= gridLines / 2; i++) {
            const frac = (i / (gridLines / 2)) * planeRadius;
            // Lines along east
            const p1 = tangentPos.clone()
                .add(north.clone().multiplyScalar(frac))
                .add(east.clone().multiplyScalar(-planeRadius));
            const p2 = tangentPos.clone()
                .add(north.clone().multiplyScalar(frac))
                .add(east.clone().multiplyScalar(planeRadius));
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([p1, p2]), gridMat
            ));

            // Lines along north
            const p3 = tangentPos.clone()
                .add(east.clone().multiplyScalar(frac))
                .add(north.clone().multiplyScalar(-planeRadius));
            const p4 = tangentPos.clone()
                .add(east.clone().multiplyScalar(frac))
                .add(north.clone().multiplyScalar(planeRadius));
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([p3, p4]), gridMat
            ));
        }

        // Axes on plane
        const axisLen = planeRadius * 1.15;
        const xArrow = new THREE.ArrowHelper(north, tangentPos, axisLen, 0x44ff66, 0.1, 0.05);
        group.add(xArrow);
        const xLabel = makeTextSprite('x (Norte)', 0x44ff66, 0.2);
        xLabel.position.copy(tangentPos.clone().add(north.clone().multiplyScalar(axisLen + 0.15)));
        group.add(xLabel);

        const yArrow = new THREE.ArrowHelper(east, tangentPos, axisLen, 0xff6644, 0.1, 0.05);
        group.add(yArrow);
        const yLabel = makeTextSprite('y (Este)', 0xff6644, 0.2);
        yLabel.position.copy(tangentPos.clone().add(east.clone().multiplyScalar(axisLen + 0.15)));
        group.add(yLabel);

        const zArrow = new THREE.ArrowHelper(up, tangentPos, axisLen * 0.7, 0x4488ff, 0.1, 0.05);
        group.add(zArrow);
        const zLabel = makeTextSprite('z (cota)', 0x4488ff, 0.2);
        zLabel.position.copy(tangentPos.clone().add(up.clone().multiplyScalar(axisLen * 0.7 + 0.15)));
        group.add(zLabel);

        // --- Validity circle ---
        if (showValidityCircle) {
            // Show ~80 km equivalent circle (scaled)
            const validityR = planeRadius * 0.8;
            const vPts = [];
            for (let i = 0; i <= 64; i++) {
                const angle = (i / 64) * Math.PI * 2;
                const pt = tangentPos.clone()
                    .add(east.clone().multiplyScalar(Math.cos(angle) * validityR))
                    .add(north.clone().multiplyScalar(Math.sin(angle) * validityR))
                    .add(up.clone().multiplyScalar(0.01));
                vPts.push(pt);
            }
            const vMat = new THREE.LineDashedMaterial({
                color: 0xffdd44, dashSize: 0.08, gapSize: 0.04, transparent: true, opacity: 0.7,
            });
            const vLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPts), vMat);
            vLine.computeLineDistances();
            group.add(vLine);

            const vLabel = makeTextSprite('Limite ~80 km', 0xffdd44, 0.2);
            vLabel.position.copy(tangentPos.clone()
                .add(north.clone().multiplyScalar(validityR))
                .add(up.clone().multiplyScalar(0.15)));
            group.add(vLabel);
        }

        // Tangent point label
        const tLabel = makeTextSprite('O (origem)', 0x38bdf8, 0.22);
        tLabel.position.copy(tangentPos.clone().add(new THREE.Vector3(-0.15, -0.2, 0.15)));
        group.add(tLabel);

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');

        // Calculate error at edge of plane
        const dKm = planeRadius / a * 6378; // approximate real distance
        const relError = (dKm * dKm) / (3 * 6378 * 6378);
        const errMm = relError * 1000 * 1000; // mm per km

        readout.innerHTML = `
            <div class="readout-title">Plano Topográfico Local</div>
            <div class="readout-row">
                <span class="readout-label">φ (origem) =</span>
                <span class="readout-value">${tangentPhi.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">λ (origem) =</span>
                <span class="readout-value">${tangentLambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">h (alt.) =</span>
                <span class="readout-value">${tangentH.toFixed(0)} m</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
                <span class="readout-label">Raio =</span>
                <span class="readout-value">${dKm.toFixed(0)} km</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Erro rel. =</span>
                <span class="readout-value">1:${Math.round(1 / relError).toLocaleString()}</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">Erro/km =</span>
                <span class="readout-value">${errMm.toFixed(1)} mm</span>
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
                    <label>Latitude (origem): <span class="value-display" id="phi-val">${tangentPhi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${tangentPhi}">
                </div>
                <div class="control-group">
                    <label>Longitude (origem): <span class="value-display" id="lam-val">${tangentLambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lam" min="-180" max="180" step="1" value="${tangentLambda}">
                </div>
                <div class="control-group">
                    <label>Altitude h (m): <span class="value-display" id="h-val">${tangentH} m</span></label>
                    <input type="range" id="ctrl-h" min="100" max="8000" step="100" value="${tangentH}">
                </div>
                <div class="control-group">
                    <label>Raio do plano: <span class="value-display" id="radius-val">${planeRadius.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-radius" min="0.3" max="2.5" step="0.05" value="${planeRadius}">
                </div>
                <div class="control-group">
                    <label>Exagero Visual (h): <span class="value-display" id="exag-val">${hExag.toFixed(0)}x</span></label>
                    <input type="range" id="ctrl-exag" min="1" max="200" step="1" value="${hExag}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-ellipsoid" ${showEllipsoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Elipsoide</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-validity" ${showValidityCircle ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Círculo de Validade</span>
                    </label>
                </div>
            </div>
        `;

        container.querySelector('#ctrl-phi').addEventListener('input', e => {
            tangentPhi = parseFloat(e.target.value);
            container.querySelector('#phi-val').textContent = tangentPhi.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-lam').addEventListener('input', e => {
            tangentLambda = parseFloat(e.target.value);
            container.querySelector('#lam-val').textContent = tangentLambda.toFixed(1) + '°';
            buildScene();
        });
        container.querySelector('#ctrl-h').addEventListener('input', e => {
            tangentH = parseFloat(e.target.value);
            container.querySelector('#h-val').textContent = tangentH + ' m';
            buildScene();
        });
        container.querySelector('#ctrl-radius').addEventListener('input', e => {
            planeRadius = parseFloat(e.target.value);
            container.querySelector('#radius-val').textContent = planeRadius.toFixed(2);
            buildScene();
        });
        container.querySelector('#ctrl-exag').addEventListener('input', e => {
            hExag = parseFloat(e.target.value);
            container.querySelector('#exag-val').textContent = hExag.toFixed(0) + 'x';
            buildScene();
        });
        container.querySelector('#ctrl-ellipsoid').addEventListener('change', e => {
            showEllipsoid = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-validity').addEventListener('change', e => {
            showValidityCircle = e.target.checked;
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
