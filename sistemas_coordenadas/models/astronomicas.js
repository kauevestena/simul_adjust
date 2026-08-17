import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Coordenadas Astronômicas',
    icon: '⭐',
    subtitle: 'Latitude e Longitude Astronômicas (Φ, Λ)',
    cameraPosition: [5, 3.5, 5],

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
    let phi = 45;       // geodetic latitude
    let lambda = 30;    // longitude
    let deviationExag = 30; // exaggeration factor for deviation visualization
    let xi = 10;        // meridional component (arcsec, real-ish value)
    let eta = 8;        // prime vertical component (arcsec)

    let showGeoide = true;
    let showDeviationAngle = true;
    let showBothVectors = true;

    function getB() { return a * (1 - f * fExag); }
    function getEcc2() { const b = getB(); return 1 - (b * b) / (a * a); }

    function ellipsoidPoint(latDeg, lonDeg, h = 0) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);
        const e2 = getEcc2();
        const N = a / Math.sqrt(1 - e2 * Math.sin(phiRad) * Math.sin(phiRad));
        return new THREE.Vector3(
            (N + h) * Math.cos(phiRad) * Math.cos(lamRad),
            (N * (1 - e2) + h) * Math.sin(phiRad),
            (N + h) * Math.cos(phiRad) * Math.sin(lamRad)
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

    // Compute the astronomical vertical (deviated from normal)
    function astronomicalVertical(latDeg, lonDeg) {
        const phiRad = THREE.MathUtils.degToRad(latDeg);
        const lamRad = THREE.MathUtils.degToRad(lonDeg);

        const normal = ellipsoidNormal(latDeg, lonDeg);

        // deviation angles in radians (exaggerated for visualization)
        const xiRad = THREE.MathUtils.degToRad(xi / 3600 * deviationExag);
        const etaRad = THREE.MathUtils.degToRad(eta / 3600 * deviationExag);

        // Compute tangent vectors at the point
        // meridional tangent (north direction)
        const tNorth = new THREE.Vector3(
            -Math.sin(phiRad) * Math.cos(lamRad),
            Math.cos(phiRad),
            -Math.sin(phiRad) * Math.sin(lamRad)
        ).normalize();

        // east tangent
        const tEast = new THREE.Vector3(
            -Math.sin(lamRad),
            0,
            Math.cos(lamRad)
        ).normalize();

        // Deviate the normal by xi (meridional) and eta (prime vertical)
        const vertical = normal.clone()
            .add(tNorth.clone().multiplyScalar(-Math.tan(xiRad)))
            .add(tEast.clone().multiplyScalar(-Math.tan(etaRad)))
            .normalize();

        return vertical;
    }

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x1a5276,
        specular: 0x4488cc,
        shininess: 40,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
    });

    const geoideMat = new THREE.MeshPhongMaterial({
        color: 0x2a7a5a,
        specular: 0x44cc88,
        shininess: 20,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        wireframe: false,
    });

    function buildScene() {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const b = getB();

        // --- Ellipsoid ---
        const ellGeo = new THREE.SphereGeometry(1, 64, 64);
        const ellMesh = new THREE.Mesh(ellGeo, ellipsoidMat);
        ellMesh.scale.set(a, b, a);
        group.add(ellMesh);

        // --- Geoide (simplified wavy surface) ---
        if (showGeoide) {
            const geoideGeo = new THREE.SphereGeometry(1, 64, 64);
            const posAttr = geoideGeo.getAttribute('position');
            const pos = posAttr.array;

            for (let i = 0; i < pos.length; i += 3) {
                const x = pos[i], y = pos[i + 1], z = pos[i + 2];
                const r = Math.sqrt(x * x + y * y + z * z);
                const lat = Math.asin(y / r);
                const lon = Math.atan2(z, x);

                // Undulation: simplified sinusoidal model
                const undulation = 0.03 * Math.sin(3 * lat) * Math.cos(2 * lon) +
                    0.02 * Math.sin(5 * lat + lon) +
                    0.015 * Math.cos(4 * lon - 2 * lat);

                const scale = new THREE.Vector3(a, b, a);
                pos[i] = (x + x / r * undulation) * scale.x;
                pos[i + 1] = (y + y / r * undulation) * scale.y;
                pos[i + 2] = (z + z / r * undulation) * scale.z;
            }
            posAttr.needsUpdate = true;
            geoideGeo.computeVertexNormals();

            const geoideMesh = new THREE.Mesh(geoideGeo, geoideMat);
            group.add(geoideMesh);
        }

        // --- Meridians/Parallels/Equator ---
        const meridianMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.25 });
        const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44 });

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

        const eqPts = [];
        for (let j = 0; j <= 128; j++) {
            eqPts.push(ellipsoidPoint(0, (j / 128) * 360));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), equatorMat));

        // --- Point P on surface ---
        const pSurface = ellipsoidPoint(phi, lambda);
        const normal = ellipsoidNormal(phi, lambda);
        const vertical = astronomicalVertical(phi, lambda);

        // Point P marker
        const pMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff6644 })
        );
        pMesh.position.copy(pSurface);
        group.add(pMesh);

        const vecLen = 1.5;

        // --- Normal to ellipsoid (blue) ---
        if (showBothVectors) {
            const nEnd = pSurface.clone().add(normal.clone().multiplyScalar(vecLen));
            const nGeo = new THREE.BufferGeometry().setFromPoints([
                pSurface.clone().sub(normal.clone().multiplyScalar(0.2)),
                nEnd
            ]);
            const nMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
            group.add(new THREE.Line(nGeo, nMat));

            const arrowN = new THREE.ArrowHelper(normal, nEnd.clone().sub(normal.clone().multiplyScalar(0.15)), 0.15, 0x38bdf8, 0.1, 0.05);
            group.add(arrowN);

            const nLabel = makeTextSprite('n (normal)', 0x38bdf8, 0.25);
            nLabel.position.copy(nEnd.clone().add(normal.clone().multiplyScalar(0.2)));
            group.add(nLabel);
        }

        // --- Astronomical vertical (green) ---
        const vEnd = pSurface.clone().add(vertical.clone().multiplyScalar(vecLen));
        const vGeo = new THREE.BufferGeometry().setFromPoints([
            pSurface.clone().sub(vertical.clone().multiplyScalar(0.2)),
            vEnd
        ]);
        const vMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
        group.add(new THREE.Line(vGeo, vMat));

        const arrowV = new THREE.ArrowHelper(vertical, vEnd.clone().sub(vertical.clone().multiplyScalar(0.15)), 0.15, 0x34d399, 0.1, 0.05);
        group.add(arrowV);

        const vLabel = makeTextSprite('g (vertical)', 0x34d399, 0.25);
        vLabel.position.copy(vEnd.clone().add(vertical.clone().multiplyScalar(0.2)));
        group.add(vLabel);

        // --- Deviation angle arc ---
        if (showDeviationAngle && showBothVectors) {
            const devAngle = normal.angleTo(vertical);
            if (devAngle > 0.001) {
                const arcR = 0.9;
                const arcPts = [];
                const arcSteps = 24;
                const crossAxis = new THREE.Vector3().crossVectors(normal, vertical).normalize();

                for (let i = 0; i <= arcSteps; i++) {
                    const t = (i / arcSteps) * devAngle;
                    const dir = normal.clone().applyAxisAngle(crossAxis, t).multiplyScalar(arcR);
                    arcPts.push(pSurface.clone().add(dir));
                }
                const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
                const arcMat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
                group.add(new THREE.Line(arcGeo, arcMat));

                // Deviation label
                const totalDev = Math.sqrt(xi * xi + eta * eta);
                const devLabel = makeTextSprite(`δ = ${totalDev.toFixed(1)}"`, 0xffaa00, 0.25);
                const midPt = arcPts[Math.floor(arcSteps / 2)];
                const offset = midPt.clone().sub(pSurface).normalize().multiplyScalar(0.3);
                devLabel.position.copy(midPt.clone().add(offset));
                group.add(devLabel);
            }
        }

        // P label
        const pLabel = makeTextSprite('P', 0xffffff);
        pLabel.position.copy(pSurface.clone().add(new THREE.Vector3(0.2, -0.15, 0)));
        group.add(pLabel);

        updateReadout();
    }

    function updateReadout() {
        const readout = document.getElementById('coord-readout');
        const PhiAst = phi + xi / 3600;
        const LambdaAst = lambda + eta / 3600 / Math.cos(THREE.MathUtils.degToRad(phi));

        readout.innerHTML = `
            <div class="readout-title">Coord. Astronômicas vs Geodésicas</div>
            <div class="readout-row">
                <span class="readout-label">Φ (astro) =</span>
                <span class="readout-value">${PhiAst.toFixed(4)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">φ (geod) =</span>
                <span class="readout-value">${phi.toFixed(1)}°</span>
            </div>
            <div class="readout-row" style="margin-top:4px">
                <span class="readout-label">Λ (astro) =</span>
                <span class="readout-value">${LambdaAst.toFixed(4)}°</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">λ (geod) =</span>
                <span class="readout-value">${lambda.toFixed(1)}°</span>
            </div>
            <div class="readout-row" style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(100,140,220,0.12)">
                <span class="readout-label">ξ =</span>
                <span class="readout-value">${xi.toFixed(1)}"</span>
            </div>
            <div class="readout-row">
                <span class="readout-label">η =</span>
                <span class="readout-value">${eta.toFixed(1)}"</span>
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
                    <label>Latitude geodésica (φ): <span class="value-display" id="phi-val">${phi.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-phi" min="-90" max="90" step="1" value="${phi}">
                </div>
                <div class="control-group">
                    <label>Longitude (λ): <span class="value-display" id="lambda-val">${lambda.toFixed(1)}°</span></label>
                    <input type="range" id="ctrl-lambda" min="-180" max="180" step="1" value="${lambda}">
                </div>
                <div class="control-group">
                    <label>Desvio ξ (meridiano): <span class="value-display" id="xi-val">${xi.toFixed(1)}"</span></label>
                    <input type="range" id="ctrl-xi" min="-60" max="60" step="1" value="${xi}">
                </div>
                <div class="control-group">
                    <label>Desvio η (1° vertical): <span class="value-display" id="eta-val">${eta.toFixed(1)}"</span></label>
                    <input type="range" id="ctrl-eta" min="-60" max="60" step="1" value="${eta}">
                </div>
                <div class="control-group">
                    <label>Exagero visual: <span class="value-display" id="exag-val">${deviationExag}×</span></label>
                    <input type="range" id="ctrl-exag" min="1" max="200" step="1" value="${deviationExag}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geoide" ${showGeoide ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Geoide</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-both" ${showBothVectors ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Normal</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-devarc" ${showDeviationAngle ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Arco do desvio</span>
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
        container.querySelector('#ctrl-xi').addEventListener('input', e => {
            xi = parseFloat(e.target.value);
            container.querySelector('#xi-val').textContent = xi.toFixed(1) + '"';
            buildScene();
        });
        container.querySelector('#ctrl-eta').addEventListener('input', e => {
            eta = parseFloat(e.target.value);
            container.querySelector('#eta-val').textContent = eta.toFixed(1) + '"';
            buildScene();
        });
        container.querySelector('#ctrl-exag').addEventListener('input', e => {
            deviationExag = parseFloat(e.target.value);
            container.querySelector('#exag-val').textContent = deviationExag + '×';
            buildScene();
        });
        container.querySelector('#ctrl-geoide').addEventListener('change', e => {
            showGeoide = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-both').addEventListener('change', e => {
            showBothVectors = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-devarc').addEventListener('change', e => {
            showDeviationAngle = e.target.checked;
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
