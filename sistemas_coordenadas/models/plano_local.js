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
        trata-se de projetar uma região da superfície terrestre sobre um <em>plano tangente</em>, 
        utilizando coordenadas cartesianas planas.</p>

        <h4>Princípio</h4>
        <p>Em áreas suficientemente pequenas, a curvatura da Terra pode ser <strong>desprezada</strong>. 
        O levantador trabalha como se a superfície fosse plana, com um sistema de eixos ortogonais 
        definidos localmente.</p>

        <h4>Grandezas</h4>
        <p><strong>x</strong>: coordenada horizontal no sentido do Norte (ou de uma direção de referência)</p>
        <p><strong>y</strong>: coordenada horizontal no sentido do Este</p>
        <p><strong>z</strong>: cota ou altitude — componente vertical</p>

        <h4>Limitações</h4>
        <p>À medida que nos afastamos do ponto de tangência, a <strong>distorção</strong> cresce. 
        A norma brasileira (NBR 14166) estabelece que o plano topográfico local é válido para 
        áreas com raio de até <strong>~80 km</strong> do ponto de tangência, com deformações 
        lineares inferiores a 1:50.000.</p>

        <p>Para um raio $d$ a partir do ponto de tangência, o erro relativo na distância é 
        aproximadamente:</p>
        <p>$$\\frac{\\delta}{d} \\approx \\frac{d^2}{3R^2}$$</p>
        <p>Onde $R$ é o raio médio da Terra (~6.371 km).</p>
    `,

    howItWorks: `
        <h3>Como Funciona</h3>
        <p>Os pontos da superfície curva são projetados ortogonalmente no plano tangente, 
        resultando em coordenadas planas <span class="coord-badge">(x, y)</span> e a 
        componente vertical <span class="coord-badge green">z</span>.</p>

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

        <h4>Relação com ENU</h4>
        <p>O plano topográfico local é conceitualmente similar ao sistema ENU, porém sem a 
        rigorosa definição de orientação em relação ao elipsoide. Na prática, para 
        pequenas áreas, ambos produzem resultados equivalentes.</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    const R = 2.0; // "Earth" radius in scene units
    let planeRadius = 1.0; // radius of the tangent plane region
    let tangentPhi = 30; // tangent point latitude
    let tangentLambda = 0; // tangent point longitude
    let numPoints = 12;
    let showDistortion = true;
    let showCurvedSurface = true;
    let showProjectionLines = true;
    let showValidityCircle = true;
    let exaggerateCurvature = 1.0;

    // Materials
    const sphereMat = new THREE.MeshPhongMaterial({
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

    function spherePoint(latDeg, lonDeg, r = R) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            r * Math.cos(phi) * Math.cos(lam),
            r * Math.sin(phi),
            r * Math.cos(phi) * Math.sin(lam)
        );
    }

    function getUp(latDeg, lonDeg) {
        const phi = THREE.MathUtils.degToRad(latDeg);
        const lam = THREE.MathUtils.degToRad(lonDeg);
        return new THREE.Vector3(
            Math.cos(phi) * Math.cos(lam),
            Math.sin(phi),
            Math.cos(phi) * Math.sin(lam)
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

    function buildScene() {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        // --- Sphere (Earth) ---
        if (showCurvedSurface) {
            const sGeo = new THREE.SphereGeometry(R, 48, 48);
            const sMesh = new THREE.Mesh(sGeo, sphereMat);
            group.add(sMesh);

            // Wireframe
            const wGeo = new THREE.SphereGeometry(R, 24, 24);
            const wMat = new THREE.MeshBasicMaterial({
                color: 0x4488cc, wireframe: true, transparent: true, opacity: 0.06,
            });
            group.add(new THREE.Mesh(wGeo, wMat));
        }

        // --- Tangent point ---
        const tangentPos = spherePoint(tangentPhi, tangentLambda);
        const up = getUp(tangentPhi, tangentLambda);
        const east = getEast(tangentLambda);
        const north = getNorth(tangentPhi, tangentLambda);

        // Tangent point marker
        const tMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        tMesh.position.copy(tangentPos);
        group.add(tMesh);

        // --- Tangent Plane ---
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

        // --- Sample points on the surface and their projections ---
        const samplePoints = [];
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const dist = (0.3 + Math.random() * 0.7) * planeRadius;
            // Convert from local plane coords to lat/lon
            const localE = Math.cos(angle) * dist;
            const localN = Math.sin(angle) * dist;

            // Angular displacement on sphere
            const angE = localE / R;
            const angN = localN / R;

            const ptLat = tangentPhi + THREE.MathUtils.radToDeg(angN);
            const ptLon = tangentLambda + THREE.MathUtils.radToDeg(angE) / Math.cos(THREE.MathUtils.degToRad(tangentPhi));

            const surfPt = spherePoint(ptLat, ptLon);
            const planePt = tangentPos.clone()
                .add(east.clone().multiplyScalar(localE))
                .add(north.clone().multiplyScalar(localN));

            samplePoints.push({ surfPt, planePt, dist });
        }

        samplePoints.forEach(({ surfPt, planePt, dist }) => {
            // Surface point
            const sMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff6644 })
            );
            sMesh.position.copy(surfPt);
            group.add(sMesh);

            // Projected point on plane
            const pMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
            );
            pMesh.position.copy(planePt);
            group.add(pMesh);

            // Projection line
            if (showProjectionLines) {
                const projGeo = new THREE.BufferGeometry().setFromPoints([surfPt, planePt]);
                const projMat = new THREE.LineDashedMaterial({
                    color: 0xffffff, dashSize: 0.05, gapSize: 0.03,
                    transparent: true, opacity: 0.3,
                });
                const projLine = new THREE.Line(projGeo, projMat);
                projLine.computeLineDistances();
                group.add(projLine);
            }

            // Distortion indicator (color-coded)
            if (showDistortion) {
                const relError = (dist * dist) / (3 * R * R);
                // Map error to color: green (small) → yellow → red (large)
                const hue = Math.max(0, 0.33 - relError * 5000);
                const color = new THREE.Color().setHSL(hue, 1, 0.5);

                const distMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.025 + relError * 50, 8, 8),
                    new THREE.MeshBasicMaterial({ color })
                );
                distMesh.position.copy(planePt.clone().add(up.clone().multiplyScalar(0.06)));
                group.add(distMesh);
            }
        });

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

        // --- Show curvature separation ---
        if (exaggerateCurvature > 1) {
            // Arc on the sphere from tangent point to edge of plane
            const arcPts = [];
            const arcSteps = 32;
            const angularExtent = planeRadius / R; // radians
            for (let i = 0; i <= arcSteps; i++) {
                const t = (i / arcSteps) * angularExtent;
                const lat = tangentPhi + THREE.MathUtils.radToDeg(t);
                arcPts.push(spherePoint(lat, tangentLambda));
            }
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(arcPts),
                new THREE.LineBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.6 })
            ));

            // Corresponding straight line on the plane
            const straightStart = tangentPos;
            const straightEnd = tangentPos.clone().add(north.clone().multiplyScalar(planeRadius));
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([straightStart, straightEnd]),
                new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
            ));
        }

        // Tangent point label
        const tLabel = makeTextSprite('O (tangência)', 0x38bdf8, 0.22);
        tLabel.position.copy(tangentPos.clone().add(new THREE.Vector3(-0.15, -0.2, 0.15)));
        group.add(tLabel);

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');

        // Calculate error at edge of plane
        const dKm = planeRadius / R * 6371; // approximate real distance
        const relError = (dKm * dKm) / (3 * 6371 * 6371);
        const errMm = relError * 1000 * 1000; // mm per km

        readout.innerHTML = `
            <div class="readout-title">Plano Topográfico Local</div>
            <div class="readout-row">
                <span class="readout-label">φ (tang.) =</span>
                <span class="readout-value">${tangentPhi.toFixed(1)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">λ (tang.) =</span>
                <span class="readout-value">${tangentLambda.toFixed(1)}°</span>
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
                    <label>Latitude (tangência): <span class="value-display" id="phi-val">${tangentPhi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${tangentPhi}">
                </div>
                <div class="control-group">
                    <label>Longitude (tangência): <span class="value-display" id="lam-val">${tangentLambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lam" min="-180" max="180" step="1" value="${tangentLambda}">
                </div>
                <div class="control-group">
                    <label>Raio do plano: <span class="value-display" id="radius-val">${planeRadius.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-radius" min="0.3" max="2.5" step="0.05" value="${planeRadius}">
                </div>
                <div class="control-group">
                    <label>Pontos amostrais: <span class="value-display" id="pts-val">${numPoints}</span></label>
                    <input type="range" id="ctrl-pts" min="4" max="30" step="1" value="${numPoints}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-distortion" ${showDistortion ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Distorção</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-curved" ${showCurvedSurface ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Superfície Curva</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-projlines" ${showProjectionLines ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Linhas de Projeção</span>
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
        container.querySelector('#ctrl-radius').addEventListener('input', e => {
            planeRadius = parseFloat(e.target.value);
            container.querySelector('#radius-val').textContent = planeRadius.toFixed(2);
            buildScene();
        });
        container.querySelector('#ctrl-pts').addEventListener('input', e => {
            numPoints = parseInt(e.target.value);
            container.querySelector('#pts-val').textContent = numPoints;
            buildScene();
        });
        container.querySelector('#ctrl-distortion').addEventListener('change', e => {
            showDistortion = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-curved').addEventListener('change', e => {
            showCurvedSurface = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-projlines').addEventListener('change', e => {
            showProjectionLines = e.target.checked;
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
