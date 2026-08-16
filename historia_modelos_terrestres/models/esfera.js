import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Esfera',
    icon: '🔵',
    subtitle: 'Modelo esférico da Terra',
    cameraPosition: [4, 3, 5],

    history: `
        <h3>A Terra Esférica</h3>
        <p>A ideia de que a Terra é esférica remonta à Grécia Antiga. <strong>Pitágoras</strong>
        (séc. VI a.C.) foi possivelmente o primeiro a propor uma Terra esférica, baseando-se em
        argumentos de simetria e harmonia matemática.</p>

        <p><strong>Aristóteles</strong> (séc. IV a.C.) apresentou evidências observacionais:
        a sombra circular da Terra durante eclipses lunares, a mudança das constelações visíveis
        conforme se viaja para norte ou sul, e o fato de que navios desaparecem gradualmente no horizonte.</p>

        <p><strong>Eratóstenes</strong> (séc. III a.C.) realizou a primeira medição conhecida
        da circunferência terrestre, comparando a sombra de varas em Siena e Alexandria no solstício
        de verão. Seu resultado (~39.375 km) é surpreendentemente próximo do valor moderno (~40.075 km).</p>

        <div class="figures-list">
            <div class="figure-card" data-figure-id="pitagoras">
                <div class="figure-avatar">Pi</div>
                <div class="figure-info">
                    <div class="figure-name">Pitágoras</div>
                    <div class="figure-years">~570–495 a.C.</div>
                    <div class="figure-contribution">Propôs a Terra esférica por simetria</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="aristoteles">
                <div class="figure-avatar">Ar</div>
                <div class="figure-info">
                    <div class="figure-name">Aristóteles</div>
                    <div class="figure-years">384–322 a.C.</div>
                    <div class="figure-contribution">Evidências observacionais da esfericidade</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="eratostenes">
                <div class="figure-avatar">Er</div>
                <div class="figure-info">
                    <div class="figure-name">Eratóstenes</div>
                    <div class="figure-years">~276–194 a.C.</div>
                    <div class="figure-contribution">Mediu a circunferência da Terra</div>
                </div>
            </div>
        </div>
    `,

    howItWorks: `
        <h3>O Modelo Esférico</h3>
        <p>O modelo esférico assume que a Terra é uma esfera perfeita. Este é o modelo mais
        simples e ainda é utilizado em muitas aplicações práticas, como navegação e cartografia
        de pequenas áreas.</p>

        <h4>Parâmetros</h4>
        <p><strong>Raio médio:</strong> R ≈ 6.371 km</p>
        <p><strong>Circunferência:</strong> C ≈ 40.030 km</p>
        <p><strong>Área superficial:</strong> A ≈ 510 × 10⁶ km²</p>

        <h4>Meridianos e Paralelos</h4>
        <p>Os <strong>meridianos</strong> são grandes círculos que passam pelos polos, definindo a longitude.
        Os <strong>paralelos</strong> são círculos menores perpendiculares ao eixo de rotação, definindo a latitude.
        O <strong>Equador</strong> é o único paralelo que é um grande círculo.</p>

        <h4>Limitações</h4>
        <p>A Terra real não é perfeitamente esférica — ela é achatada nos polos devido à rotação.
        Para aplicações geodésicas de alta precisão, o modelo esférico é insuficiente.</p>
    `,
};

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const group = new THREE.Group();
    scene.add(group);

    let radius = 2;
    let numMeridians = 12;
    let numParallels = 6;
    let showMeridians = true;
    let showParallels = true;
    let showEquator = true;
    let showAxis = true;

    // --- Materials ---
    const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x1e6091,
        specular: 0x4488cc,
        shininess: 40,
        transparent: true,
        opacity: 0.85,
    });

    const meridianMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
    const parallelMat = new THREE.LineBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.4 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffdd44, linewidth: 2 });
    const axisMat = new THREE.LineBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.6 });

    // --- Sphere ---
    let sphereMesh;
    let meridianLines = [];
    let parallelLines = [];
    let equatorLine;
    let axisLine;

    function buildScene() {
        // Remove old objects
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }
        meridianLines = [];
        parallelLines = [];

        // Main sphere
        const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
        sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        group.add(sphereMesh);

        // Meridians
        if (showMeridians) {
            for (let i = 0; i < numMeridians; i++) {
                const angle = (i / numMeridians) * Math.PI;
                const points = [];
                for (let j = 0; j <= 64; j++) {
                    const phi = (j / 64) * Math.PI * 2;
                    const x = radius * 1.002 * Math.sin(phi) * Math.cos(angle);
                    const y = radius * 1.002 * Math.cos(phi);
                    const z = radius * 1.002 * Math.sin(phi) * Math.sin(angle);
                    points.push(new THREE.Vector3(x, y, z));
                }
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geo, meridianMat);
                group.add(line);
                meridianLines.push(line);
            }
        }

        // Parallels
        if (showParallels) {
            for (let i = 1; i <= numParallels; i++) {
                // Northern and southern hemisphere
                [-1, 1].forEach(sign => {
                    const lat = (i / (numParallels + 1)) * Math.PI * 0.5;
                    const r = radius * 1.002 * Math.cos(lat);
                    const y = radius * 1.002 * Math.sin(lat) * sign;
                    const points = [];
                    for (let j = 0; j <= 64; j++) {
                        const theta = (j / 64) * Math.PI * 2;
                        points.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
                    }
                    const geo = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geo, parallelMat);
                    group.add(line);
                    parallelLines.push(line);
                });
            }
        }

        // Equator
        if (showEquator) {
            const eqPoints = [];
            for (let i = 0; i <= 128; i++) {
                const theta = (i / 128) * Math.PI * 2;
                eqPoints.push(new THREE.Vector3(
                    radius * 1.003 * Math.cos(theta),
                    0,
                    radius * 1.003 * Math.sin(theta)
                ));
            }
            const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPoints);
            equatorLine = new THREE.Line(eqGeo, equatorMat);
            group.add(equatorLine);
        }

        // Axis
        if (showAxis) {
            const axisPoints = [
                new THREE.Vector3(0, -radius * 1.4, 0),
                new THREE.Vector3(0, radius * 1.4, 0),
            ];
            const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
            axisLine = new THREE.Line(axisGeo, axisMat);
            group.add(axisLine);

            // Pole markers
            const poleMat = new THREE.MeshBasicMaterial({ color: 0xff6666 });
            const poleGeo = new THREE.SphereGeometry(0.06, 8, 8);
            const northPole = new THREE.Mesh(poleGeo, poleMat);
            northPole.position.set(0, radius * 1.4, 0);
            group.add(northPole);
            const southPole = new THREE.Mesh(poleGeo, poleMat);
            southPole.position.set(0, -radius * 1.4, 0);
            group.add(southPole);
        }
    }

    buildScene();

    // Camera
    camera.position.set(4, 3, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    function update(time) {
        group.rotation.y = time * 0.15;
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
                    <label>Raio: <span class="value-display" id="radius-val">${radius.toFixed(1)}</span></label>
                    <input type="range" id="ctrl-radius" min="1" max="3.5" step="0.1" value="${radius}">
                </div>
                <div class="control-group">
                    <label>Meridianos: <span class="value-display" id="meridians-val">${numMeridians}</span></label>
                    <input type="range" id="ctrl-meridians" min="4" max="36" step="2" value="${numMeridians}">
                </div>
                <div class="control-group">
                    <label>Paralelos: <span class="value-display" id="parallels-val">${numParallels}</span></label>
                    <input type="range" id="ctrl-parallels" min="2" max="18" step="1" value="${numParallels}">
                </div>
                <div class="control-group" style="flex-direction: row; flex-wrap: wrap; gap: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-show-meridians" ${showMeridians ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Meridianos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-show-parallels" ${showParallels ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Paralelos</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-show-equator" ${showEquator ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Equador</span>
                    </label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="ctrl-show-axis" ${showAxis ? 'checked' : ''}>
                        <span class="toggle-track"></span>
                        <span class="toggle-label">Eixo</span>
                    </label>
                </div>
            </div>
        `;

        // Slider handlers
        container.querySelector('#ctrl-radius').addEventListener('input', e => {
            radius = parseFloat(e.target.value);
            container.querySelector('#radius-val').textContent = radius.toFixed(1);
            buildScene();
        });
        container.querySelector('#ctrl-meridians').addEventListener('input', e => {
            numMeridians = parseInt(e.target.value);
            container.querySelector('#meridians-val').textContent = numMeridians;
            buildScene();
        });
        container.querySelector('#ctrl-parallels').addEventListener('input', e => {
            numParallels = parseInt(e.target.value);
            container.querySelector('#parallels-val').textContent = numParallels;
            buildScene();
        });

        // Toggle handlers
        container.querySelector('#ctrl-show-meridians').addEventListener('change', e => {
            showMeridians = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-show-parallels').addEventListener('change', e => {
            showParallels = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-show-equator').addEventListener('change', e => {
            showEquator = e.target.checked;
            buildScene();
        });
        container.querySelector('#ctrl-show-axis').addEventListener('change', e => {
            showAxis = e.target.checked;
            buildScene();
        });
    }

    return { update, cleanup, createControls };
}
