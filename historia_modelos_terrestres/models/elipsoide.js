import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Elipsóide',
    icon: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
            <linearGradient id="ell-icon-grad" x1="16" y1="8" x2="16" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
                <stop offset="50%" stop-color="#0284c7" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#0369a1" stop-opacity="0.5"/>
            </linearGradient>
        </defs>
        <!-- Rotation axis N-S -->
        <line x1="16" y1="3" x2="16" y2="29" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="2 1.5"/>
        <!-- Oblate Spheroid body with clear polar flattening (a=14, b=8.5) -->
        <ellipse cx="16" cy="16" rx="14" ry="8.5" fill="url(#ell-icon-grad)" stroke="#38bdf8" stroke-width="1.6"/>
        <!-- Equator line -->
        <ellipse cx="16" cy="16" rx="14" ry="3.2" stroke="#38bdf8" stroke-width="0.9" stroke-dasharray="2 1.5" opacity="0.85"/>
        <!-- Central Meridian line -->
        <ellipse cx="16" cy="16" rx="5.5" ry="8.5" stroke="#38bdf8" stroke-width="0.9" stroke-dasharray="2 1.5" opacity="0.75"/>
        <!-- Polar dots (N/S) -->
        <circle cx="16" cy="7.5" r="1.3" fill="#f59e0b"/>
        <circle cx="16" cy="24.5" r="1.3" fill="#f59e0b"/>
    </svg>`,
    subtitle: 'Modelo elipsoidal da Terra',
    cameraPosition: [4, 3, 5],

    history: `
        <h3>O Elipsóide de Revolução</h3>
        <p>Isaac Newton, no final do século XVII, previu teoricamente que a Terra deveria
        ser achatada nos polos devido à sua rotação. Ele argumentou que a força centrífuga
        causaria um abaulamento equatorial.</p>

        <p>A confirmação veio no século XVIII com as expedições geodésicas francesas: uma
        ao <strong>Peru</strong> (1735, Bouguer e La Condamine) e outra à <strong>Lapônia</strong>
        (1736, Maupertuis). Ao medir arcos de meridiano em diferentes latitudes, comprovaram
        que a Terra é achatada nos polos.</p>

        <p><strong>Clairaut</strong> formalizou a relação entre o achatamento e a gravidade,
        estabelecendo o Teorema de Clairaut, fundamental para a geodésia.</p>

        <p>Diversos elipsóides de referência foram definidos ao longo da história, sendo
        o <strong>GRS80</strong> (1980) e o <strong>WGS84</strong> (1984) os mais utilizados atualmente.</p>

        <div class="figures-list">
            <div class="figure-card" data-figure-id="newton">
                <div class="figure-avatar">N</div>
                <div class="figure-info">
                    <div class="figure-name">Isaac Newton</div>
                    <div class="figure-years">1643–1727</div>
                    <div class="figure-contribution">Previu o achatamento polar da Terra</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="clairaut">
                <div class="figure-avatar">C</div>
                <div class="figure-info">
                    <div class="figure-name">Alexis Clairaut</div>
                    <div class="figure-years">1713–1765</div>
                    <div class="figure-contribution">Teorema de Clairaut (gravidade e achatamento)</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="maupertuis">
                <div class="figure-avatar">M</div>
                <div class="figure-info">
                    <div class="figure-name">Pierre-Louis Maupertuis</div>
                    <div class="figure-years">1698–1759</div>
                    <div class="figure-contribution">Expedição à Lapônia – confirmou o achatamento</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="bessel">
                <div class="figure-avatar">B</div>
                <div class="figure-info">
                    <div class="figure-name">Friedrich Bessel</div>
                    <div class="figure-years">1784–1846</div>
                    <div class="figure-contribution">Elipsóide de Bessel (1841)</div>
                </div>
            </div>
        </div>
    `,

    howItWorks: `
        <h3>Elipsóide de Revolução</h3>
        <p>O elipsóide é obtido pela rotação de uma elipse em torno de seu eixo menor (eixo polar).
        É definido por dois parâmetros:</p>

        <h4>Parâmetros (WGS84)</h4>
        <p><strong>Semi-eixo maior (a):</strong> 6.378.137 m (raio equatorial)</p>
        <p><strong>Semi-eixo menor (b):</strong> 6.356.752,3 m (raio polar)</p>
        <p><strong>Achatamento (f):</strong> 1/298,257223563</p>
        <p><strong>Diferença a − b:</strong> ≈ 21.385 m (~21 km)</p>

        <h4>Achatamento</h4>
        <p>O achatamento <em>f = (a − b) / a</em> é muito pequeno (~0,3%), tornando difícil
        visualizá-lo a olho nu. Use o slider de <em>exagero</em> na aba Interação para
        amplificar visualmente o efeito do achatamento.</p>

        <h4>Aplicações</h4>
        <p>O elipsóide é a superfície de referência padrão para sistemas de coordenadas
        geodésicas (latitude, longitude, altitude elipsoidal) e para o GPS/GNSS.</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    let flatteningExaggeration = 10;  // 1x real = 1/298, exaggerate for visualization
    let showReferenceSphere = true;
    let showSemiAxes = true;
    let showDifference = true;
    const baseRadius = 2;
    const realFlattening = 1 / 298.257;

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x2563eb,
        specular: 0x4488ff,
        shininess: 40,
        transparent: true,
        opacity: 0.8,
    });

    const sphereWireMat = new THREE.MeshBasicMaterial({
        color: 0x44ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
    });

    const axisMatA = new THREE.LineBasicMaterial({ color: 0xff6b6b });
    const axisMatB = new THREE.LineBasicMaterial({ color: 0x51cf66 });

    let ellipsoidMesh, refSphereMesh;
    let semiAxisALine, semiAxisBLine;
    let diffLines = [];
    let aLabel, bLabel;

    function buildScene() {
        // Remove old objects
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }
        diffLines = [];

        const f = realFlattening * flatteningExaggeration;
        const a = baseRadius;
        const b = a * (1 - f);

        // Ellipsoid
        const ellGeo = new THREE.SphereGeometry(a, 64, 64);
        ellipsoidMesh = new THREE.Mesh(ellGeo, ellipsoidMat);
        ellipsoidMesh.scale.set(1, b / a, 1);  // Scale Y axis for polar flattening
        group.add(ellipsoidMesh);

        // Reference sphere (wireframe)
        if (showReferenceSphere) {
            const refGeo = new THREE.SphereGeometry(a, 32, 32);
            refSphereMesh = new THREE.Mesh(refGeo, sphereWireMat);
            group.add(refSphereMesh);
        }

        // Semi-axes
        if (showSemiAxes) {
            // Semi-axis a (equatorial) - red
            const aPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(a * 1.15, 0, 0)];
            const aGeo = new THREE.BufferGeometry().setFromPoints(aPoints);
            semiAxisALine = new THREE.Line(aGeo, axisMatA);
            group.add(semiAxisALine);

            // Semi-axis b (polar) - green
            const bPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, b * 1.15, 0)];
            const bGeo = new THREE.BufferGeometry().setFromPoints(bPoints);
            semiAxisBLine = new THREE.Line(bGeo, axisMatB);
            group.add(semiAxisBLine);

            // Endpoint markers
            const markerGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const markerMatA = new THREE.MeshBasicMaterial({ color: 0xff6b6b });
            const mA = new THREE.Mesh(markerGeo, markerMatA);
            mA.position.set(a * 1.15, 0, 0);
            group.add(mA);

            const markerMatB = new THREE.MeshBasicMaterial({ color: 0x51cf66 });
            const mB = new THREE.Mesh(markerGeo, markerMatB);
            mB.position.set(0, b * 1.15, 0);
            group.add(mB);

            // Labels using small colored spheres as indicators
            // "a" label line
            const aLabelPoints = [new THREE.Vector3(a * 0.5, -0.15, 0), new THREE.Vector3(a * 0.5, 0, 0)];
            const aLabelGeo = new THREE.BufferGeometry().setFromPoints(aLabelPoints);
            group.add(new THREE.Line(aLabelGeo, axisMatA));

            // "b" label line
            const bLabelPoints = [new THREE.Vector3(-0.15, b * 0.5, 0), new THREE.Vector3(0, b * 0.5, 0)];
            const bLabelGeo = new THREE.BufferGeometry().setFromPoints(bLabelPoints);
            group.add(new THREE.Line(bLabelGeo, axisMatB));
        }

        // Difference visualization (lines showing the gap between sphere and ellipsoid at poles)
        if (showDifference && showReferenceSphere) {
            const diffMat = new THREE.LineBasicMaterial({
                color: 0xffdd44,
                transparent: true,
                opacity: 0.8,
            });

            // At north pole
            const nDiffPoints = [new THREE.Vector3(0, b, 0), new THREE.Vector3(0, a, 0)];
            const nDiffGeo = new THREE.BufferGeometry().setFromPoints(nDiffPoints);
            const nLine = new THREE.Line(nDiffGeo, diffMat);
            group.add(nLine);
            diffLines.push(nLine);

            // At south pole
            const sDiffPoints = [new THREE.Vector3(0, -b, 0), new THREE.Vector3(0, -a, 0)];
            const sDiffGeo = new THREE.BufferGeometry().setFromPoints(sDiffPoints);
            const sLine = new THREE.Line(sDiffGeo, diffMat);
            group.add(sLine);
            diffLines.push(sLine);

            // Markers at the difference
            const diffMarkerGeo = new THREE.SphereGeometry(0.03, 6, 6);
            const diffMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
            [b, -b, a, -a].forEach(y => {
                const m = new THREE.Mesh(diffMarkerGeo, diffMarkerMat);
                m.position.set(0, y, 0);
                group.add(m);
            });
        }

        // Equatorial ring
        const eqPoints = [];
        for (let i = 0; i <= 128; i++) {
            const theta = (i / 128) * Math.PI * 2;
            eqPoints.push(new THREE.Vector3(
                a * 1.002 * Math.cos(theta),
                0,
                a * 1.002 * Math.sin(theta)
            ));
        }
        const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPoints);
        const eqMat = new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.3 });
        group.add(new THREE.Line(eqGeo, eqMat));
    }

    buildScene();

    camera.position.set(4, 3, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    function update(time) {
        group.rotation.y = time * 0.12;
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
        const f = realFlattening * flatteningExaggeration;
        const bVal = baseRadius * (1 - f);

        container.innerHTML = `
            <div class="controls-section">
                <div class="control-group">
                    <label>Exagero do achatamento: <span class="value-display" id="flat-val">${flatteningExaggeration}×</span></label>
                    <input type="range" id="ctrl-flattening" min="1" max="80" step="1" value="${flatteningExaggeration}">
                    <p style="color: var(--text-muted); font-size: 0.7rem; margin-top: 2px;">
                        f real = 1/298,26 | f exagerado = 1/<span id="flat-inv">${(1 / f).toFixed(1)}</span>
                    </p>
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-ref-sphere" ${showReferenceSphere ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Esfera de referência</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-semi-axes" ${showSemiAxes ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Semi-eixos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-diff" ${showDifference ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Diferença a − b</span>
                    </label>
                </div>
                <div style="margin-top: 8px; padding: 8px 12px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">
                        <strong style="color: #ff6b6b;">a</strong> (equatorial) = ${baseRadius.toFixed(3)} u
                        &nbsp;|&nbsp;
                        <strong style="color: #51cf66;">b</strong> (polar) = <span id="b-display">${bVal.toFixed(3)}</span> u
                        &nbsp;|&nbsp;
                        Δ = <span id="diff-display">${((baseRadius - bVal) * 1000).toFixed(1)}</span> × 10⁻³ u
                    </p>
                </div>
            </div>
        `;

        container.querySelector('#ctrl-flattening').addEventListener('input', e => {
            flatteningExaggeration = parseInt(e.target.value);
            const fNew = realFlattening * flatteningExaggeration;
            const bNew = baseRadius * (1 - fNew);
            container.querySelector('#flat-val').textContent = `${flatteningExaggeration}×`;
            container.querySelector('#flat-inv').textContent = (1 / fNew).toFixed(1);
            container.querySelector('#b-display').textContent = bNew.toFixed(3);
            container.querySelector('#diff-display').textContent = ((baseRadius - bNew) * 1000).toFixed(1);
            buildScene();
        });

        container.querySelector('#ctrl-ref-sphere').addEventListener('change', e => {
            showReferenceSphere = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-semi-axes').addEventListener('change', e => {
            showSemiAxes = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-diff').addEventListener('change', e => {
            showDifference = e.target.checked;
            buildScene();
        });
    }

    return { update, cleanup, createControls };
}
