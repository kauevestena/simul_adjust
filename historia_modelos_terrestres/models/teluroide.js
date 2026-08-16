import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Teluróide',
    icon: '⛰️',
    subtitle: 'Superfície teluroidiana e anomalia de altura',
    cameraPosition: [5, 3, 5],

    history: `
        <h3>O Teluróide</h3>
        <p>O conceito de teluróide foi introduzido por <strong>Mikhail Sergeevich Molodensky</strong>
        nos anos 1940-1950, como parte de sua teoria para determinação da forma da Terra sem
        necessidade de hipóteses sobre a distribuição de massa interna.</p>

        <p>Molodensky propôs uma abordagem revolucionária: ao invés de determinar o geóide
        (que requer conhecimento da densidade interna), ele definiu o <strong>teluróide</strong>
        como superfície de referência e a <strong>anomalia de altura (ζ)</strong> como medida da
        separação entre a superfície física e o teluróide.</p>

        <p><strong>Veikko Heiskanen</strong> e <strong>Helmut Moritz</strong> consolidaram
        a teoria, comparando as abordagens de Stokes (geóide) e Molodensky (teluróide) em
        seu tratado clássico de Geodésia Física.</p>

        <div class="figures-list">
            <div class="figure-card" data-figure-id="molodensky">
                <div class="figure-avatar">M</div>
                <div class="figure-info">
                    <div class="figure-name">M. S. Molodensky</div>
                    <div class="figure-years">1909–1991</div>
                    <div class="figure-contribution">Criador da teoria do teluróide e anomalia de altura</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="heiskanen">
                <div class="figure-avatar">Hi</div>
                <div class="figure-info">
                    <div class="figure-name">Veikko Heiskanen</div>
                    <div class="figure-years">1895–1971</div>
                    <div class="figure-contribution">Geodésia física e modelos de geóide</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="moritz">
                <div class="figure-avatar">Mo</div>
                <div class="figure-info">
                    <div class="figure-name">Helmut Moritz</div>
                    <div class="figure-years">1933–2022</div>
                    <div class="figure-contribution">Teoria do potencial e geodésia física</div>
                </div>
            </div>
        </div>
    `,

    howItWorks: `
        <h3>Relação entre Superfícies</h3>
        <p>O modelo do teluróide envolve três superfícies fundamentais da geodésia:</p>

        <h4>1. Elipsóide (Referência Geométrica)</h4>
        <p>Superfície matemática regular definida por semi-eixos <em>a</em> e <em>b</em>.
        Base para coordenadas geodésicas (φ, λ, h).</p>

        <h4>2. Geóide (Referência Física)</h4>
        <p>Superfície equipotencial do campo gravitacional. A separação entre o geóide e o
        elipsóide é a <strong>ondulação geoidal N</strong>.</p>

        <h4>3. Teluróide / Quase-geóide</h4>
        <p>Cada ponto P na superfície física da Terra tem um ponto correspondente Q no
        teluróide, tal que o potencial normal em Q é igual ao potencial real em P.
        A distância P→Q é a <strong>anomalia de altura ζ</strong>.</p>

        <h4>Relações Fundamentais</h4>
        <p><strong>h = H + N</strong> (Stokes): altitude elipsoidal = altitude ortométrica + ondulação</p>
        <p><strong>h = H* + ζ</strong> (Molodensky): altitude elipsoidal = altitude normal + anomalia de altura</p>
        <p>Onde <em>H* ≈ H</em> e <em>ζ ≈ N</em> na maioria dos casos práticos.</p>
    `,
};

// ============================================
// Simplified undulation/terrain functions
// ============================================
function geoidUndulation(theta, phi) {
    let N = 0;
    N += 0.25 * (3 * Math.cos(theta) * Math.cos(theta) - 1);
    N += 0.12 * Math.sin(theta) * Math.sin(theta) * Math.cos(2 * phi);
    N += 0.08 * Math.sin(theta) * (5 * Math.cos(theta) * Math.cos(theta) - 1) * Math.cos(phi);
    N += 0.05 * Math.sin(2 * theta) * Math.cos(3 * phi);
    N += 0.04 * Math.sin(3 * theta) * Math.sin(4 * phi + 0.8);
    return N;
}

function terrainHeight(theta, phi) {
    // Simulated topography - more irregular than geoid
    let h = 0;
    h += 0.3 * Math.sin(3 * theta) * Math.cos(2 * phi);
    h += 0.2 * Math.cos(5 * phi + theta);
    h += 0.15 * Math.sin(4 * theta - phi);
    h += 0.1 * Math.sin(7 * phi) * Math.sin(2 * theta);
    h += 0.08 * Math.cos(6 * theta + 3 * phi);
    // Mountains (localized bumps)
    const peak1 = Math.exp(-((theta - 1.2) ** 2 + (phi - 0.8) ** 2) / 0.1) * 0.5;
    const peak2 = Math.exp(-((theta - 0.8) ** 2 + (phi + 1.5) ** 2) / 0.15) * 0.4;
    const peak3 = Math.exp(-((theta - 2.0) ** 2 + (phi - 2.5) ** 2) / 0.12) * 0.45;
    h += peak1 + peak2 + peak3;
    return h;
}

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    let separation = 0.5;
    let showEllipsoid = true;
    let showGeoid = true;
    let showTerrain = true;
    let showConnectors = true;
    let showLabels = true;
    let autoRotate = true;
    const baseRadius = 2;
    const segments = 64;

    // Materials
    const ellipsoidMat = new THREE.MeshPhongMaterial({
        color: 0x2563eb,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const geoidMat = new THREE.MeshPhongMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const terrainMat = new THREE.MeshPhongMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.6,
        flatShading: true,
    });

    const ellipsoidWireMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
    });

    const geoidWireMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        wireframe: true,
        transparent: true,
        opacity: 0.1,
    });

    function buildScene() {
        // Remove old objects
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const exag = 0.25; // undulation exaggeration for visual

        // --- Ellipsoid (innermost) ---
        if (showEllipsoid) {
            const ellGeo = new THREE.SphereGeometry(baseRadius, segments, segments);
            const ell = new THREE.Mesh(ellGeo, ellipsoidMat);
            group.add(ell);

            const ellWire = new THREE.Mesh(
                new THREE.SphereGeometry(baseRadius, 24, 24),
                ellipsoidWireMat
            );
            group.add(ellWire);
        }

        // --- Geoid (middle) ---
        if (showGeoid) {
            const geoidGeo = new THREE.SphereGeometry(baseRadius, segments, segments);
            const positions = geoidGeo.attributes.position;
            const normals = geoidGeo.attributes.normal;

            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                const r = Math.sqrt(x * x + y * y + z * z);
                if (r < 0.001) continue;

                const theta = Math.acos(y / r);
                const phi = Math.atan2(z, x);
                const N = geoidUndulation(theta, phi) * exag;
                const offset = N + separation * 0.5;

                positions.setX(i, x + normals.getX(i) * offset);
                positions.setY(i, y + normals.getY(i) * offset);
                positions.setZ(i, z + normals.getZ(i) * offset);
            }
            geoidGeo.computeVertexNormals();

            const geoid = new THREE.Mesh(geoidGeo, geoidMat);
            group.add(geoid);

            const gWire = new THREE.Mesh(
                new THREE.SphereGeometry(baseRadius + separation * 0.5, 24, 24),
                geoidWireMat
            );
            group.add(gWire);
        }

        // --- Terrain / Physical Surface (outermost) ---
        if (showTerrain) {
            const terrGeo = new THREE.SphereGeometry(baseRadius, segments, segments);
            const positions = terrGeo.attributes.position;
            const normals = terrGeo.attributes.normal;

            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                const r = Math.sqrt(x * x + y * y + z * z);
                if (r < 0.001) continue;

                const theta = Math.acos(y / r);
                const phi = Math.atan2(z, x);
                const h = terrainHeight(theta, phi) * exag;
                const offset = h + separation;

                positions.setX(i, x + normals.getX(i) * offset);
                positions.setY(i, y + normals.getY(i) * offset);
                positions.setZ(i, z + normals.getZ(i) * offset);
            }
            terrGeo.computeVertexNormals();

            const terrain = new THREE.Mesh(terrGeo, terrainMat);
            group.add(terrain);
        }

        // --- Connector lines (showing N, ζ, h relationships) ---
        if (showConnectors && separation > 0.2) {
            const connMat = new THREE.LineBasicMaterial({
                color: 0xfbbf24,
                transparent: true,
                opacity: 0.6,
            });

            const numConnectors = 16;
            for (let i = 0; i < numConnectors; i++) {
                const theta = 0.4 + (i / numConnectors) * 2.3;
                const phi = (i * 2.399) % (Math.PI * 2); // golden angle distribution

                // Direction
                const dx = Math.sin(theta) * Math.cos(phi);
                const dy = Math.cos(theta);
                const dz = Math.sin(theta) * Math.sin(phi);

                // Points on each surface
                const rEll = baseRadius;
                const N = geoidUndulation(theta, phi) * exag;
                const rGeoid = baseRadius + N + separation * 0.5;
                const h = terrainHeight(theta, phi) * exag;
                const rTerr = baseRadius + h + separation;

                const pEll = new THREE.Vector3(dx * rEll, dy * rEll, dz * rEll);
                const pGeoid = new THREE.Vector3(dx * rGeoid, dy * rGeoid, dz * rGeoid);
                const pTerr = new THREE.Vector3(dx * rTerr, dy * rTerr, dz * rTerr);

                // Ellipsoid to Geoid (N)
                if (showEllipsoid && showGeoid) {
                    const nGeo = new THREE.BufferGeometry().setFromPoints([pEll, pGeoid]);
                    const nLine = new THREE.Line(nGeo, new THREE.LineBasicMaterial({
                        color: 0x22c55e, transparent: true, opacity: 0.4,
                    }));
                    group.add(nLine);
                }

                // Ellipsoid to Terrain (h)
                if (showEllipsoid && showTerrain) {
                    const hGeo = new THREE.BufferGeometry().setFromPoints([pEll, pTerr]);
                    const hLine = new THREE.Line(hGeo, connMat);
                    group.add(hLine);
                }

                // Small markers at connection points
                const markerGeo = new THREE.SphereGeometry(0.02, 6, 6);
                if (showEllipsoid) {
                    const mE = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
                    mE.position.copy(pEll);
                    group.add(mE);
                }
                if (showGeoid) {
                    const mG = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
                    mG.position.copy(pGeoid);
                    group.add(mG);
                }
                if (showTerrain) {
                    const mT = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xd97706 }));
                    mT.position.copy(pTerr);
                    group.add(mT);
                }
            }
        }
    }

    buildScene();

    camera.position.set(5, 3, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    function update(time) {
        if (autoRotate) {
            group.rotation.y = time * 0.08;
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
                <div class="control-group">
                    <label>Separação entre superfícies: <span class="value-display" id="sep-val">${separation.toFixed(2)}</span></label>
                    <input type="range" id="ctrl-sep" min="0" max="1.5" step="0.05" value="${separation}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-ell" ${showEllipsoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label" style="color: #3b82f6;">Elipsóide</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-geo" ${showGeoid ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label" style="color: #22c55e;">Geóide</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-terr" ${showTerrain ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label" style="color: #d97706;">Superfície Física</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-conn" ${showConnectors ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Conectores</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-rot" ${autoRotate ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Rotação</span>
                    </label>
                </div>
                <div style="margin-top: 8px; padding: 8px 12px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <p style="font-size: 0.72rem; color: var(--text-secondary); margin: 0;">
                        <span style="color: #3b82f6; font-weight: 600;">■ Elipsóide</span> →
                        <span style="color: #22c55e;">N</span> →
                        <span style="color: #22c55e; font-weight: 600;">■ Geóide</span> →
                        <span style="color: #fbbf24;">ζ</span> →
                        <span style="color: #d97706; font-weight: 600;">■ Superfície Física</span>
                    </p>
                    <p style="font-size: 0.7rem; color: var(--text-muted); margin: 4px 0 0 0;">
                        h = N + H &nbsp;(Stokes) &nbsp;|&nbsp; h = ζ + H* &nbsp;(Molodensky)
                    </p>
                </div>
            </div>
        `;

        container.querySelector('#ctrl-sep').addEventListener('input', e => {
            separation = parseFloat(e.target.value);
            container.querySelector('#sep-val').textContent = separation.toFixed(2);
            buildScene();
        });

        container.querySelector('#ctrl-ell').addEventListener('change', e => {
            showEllipsoid = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-geo').addEventListener('change', e => {
            showGeoid = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-terr').addEventListener('change', e => {
            showTerrain = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-conn').addEventListener('change', e => {
            showConnectors = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-rot').addEventListener('change', e => {
            autoRotate = e.target.checked;
        });
    }

    return { update, cleanup, createControls };
}
