import * as THREE from 'three';

// ============================================
// Model Info
// ============================================
export const modelInfo = {
    name: 'Histórico',
    icon: '🐢',
    subtitle: 'Concepções antigas sobre a forma da Terra',
    cameraPosition: [5, 4, 6],

    history: `
        <h3>Concepções Históricas</h3>
        <p>Ao longo da história, diversas civilizações imaginaram formas distintas para a Terra.
        Desde a ideia de um disco plano apoiado sobre tartarugas e elefantes, até a concepção
        de esferas celestes concêntricas, cada modelo refletia o conhecimento e a cosmologia de seu tempo.</p>

        <h4>Principais Concepções</h4>
        <p><strong>Terra Plana (diversas culturas):</strong> A concepção mais antiga e difundida. Muitas
        civilizações imaginavam a Terra como um disco plano, por vezes apoiado sobre animais ou flutuando
        sobre águas primordiais.</p>

        <p><strong>Cosmologia Hindu:</strong> A Terra como um disco apoiado sobre quatro elefantes,
        que por sua vez estão sobre uma grande tartaruga cósmica (Akupāra).</p>

        <p><strong>Modelo Ptolemaico:</strong> Cláudio Ptolomeu (séc. II d.C.) formalizou o modelo
        geocêntrico com esferas celestes concêntricas, que dominou o pensamento ocidental por mais de mil anos.</p>

        <div class="figures-list">
            <div class="figure-card" data-figure-id="pitagoras">
                <div class="figure-avatar">P</div>
                <div class="figure-info">
                    <div class="figure-name">Pitágoras</div>
                    <div class="figure-years">~570–495 a.C.</div>
                    <div class="figure-contribution">Primeiras argumentações filosóficas sobre a Terra esférica</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="aristoteles">
                <div class="figure-avatar">A</div>
                <div class="figure-info">
                    <div class="figure-name">Aristóteles</div>
                    <div class="figure-years">384–322 a.C.</div>
                    <div class="figure-contribution">Argumentos observacionais a favor da esfericidade</div>
                </div>
            </div>
            <div class="figure-card" data-figure-id="ptolomeu">
                <div class="figure-avatar">Pt</div>
                <div class="figure-info">
                    <div class="figure-name">Ptolomeu</div>
                    <div class="figure-years">~100–170 d.C.</div>
                    <div class="figure-contribution">Modelo geocêntrico com esferas celestes</div>
                </div>
            </div>
        </div>
    `,

    howItWorks: `
        <h3>Modelos Antigos</h3>
        <p>Use os botões na aba <em>Interação</em> para alternar entre diferentes concepções históricas:</p>
        <h4>🐢 Tartaruga Cósmica</h4>
        <p>Baseada na cosmologia hindu, a Terra é representada como um disco plano apoiado sobre
        elefantes que ficam sobre uma tartaruga gigante. Observe a construção hierárquica do modelo.</p>
        <h4>🌐 Esferas Celestes</h4>
        <p>No modelo ptolemaico, a Terra fica no centro e é cercada por esferas transparentes concêntricas
        que carregam os planetas e as estrelas fixas.</p>
        <h4>📀 Disco Plano</h4>
        <p>A concepção mais simples: a Terra como um disco plano com bordas, cercada por água ou vazio.</p>
    `,
};

// ============================================
// 3D Scene Builders
// ============================================

function createTurtleScene() {
    const group = new THREE.Group();

    // --- Materials ---
    const shellMat = new THREE.MeshPhongMaterial({
        color: 0x2d6a4f,
        specular: 0x224422,
        shininess: 30,
        flatShading: false,
    });
    const skinMat = new THREE.MeshPhongMaterial({
        color: 0x40916c,
        specular: 0x113311,
        shininess: 15,
    });
    const earthDiscMat = new THREE.MeshPhongMaterial({
        color: 0x4a8c5c,
        specular: 0x222222,
        shininess: 10,
    });
    const waterMat = new THREE.MeshPhongMaterial({
        color: 0x1a6ea0,
        specular: 0x4488cc,
        shininess: 60,
    });
    const mountainMat = new THREE.MeshPhongMaterial({
        color: 0x8b7355,
        flatShading: true,
    });
    const elephantMat = new THREE.MeshPhongMaterial({
        color: 0x808080,
        specular: 0x333333,
        shininess: 20,
    });

    // --- Turtle Shell ---
    const shellGeo = new THREE.SphereGeometry(1.6, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.scale.set(1, 0.55, 1);
    shell.position.y = -1.2;
    group.add(shell);

    // Shell bottom (belly)
    const bellyGeo = new THREE.CircleGeometry(1.6, 32);
    const belly = new THREE.Mesh(bellyGeo, skinMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.y = -1.2;
    group.add(belly);

    // --- Head ---
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(1.6, -1.0, 0);
    head.scale.set(1.3, 0.9, 0.9);
    group.add(head);

    // Eyes
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 100 });
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(1.85, -0.88, 0.2);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(1.85, -0.88, -0.2);
    group.add(rightEye);

    // --- Legs (4) ---
    const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 10);
    const legPositions = [
        [1.0, -1.55, 0.9],
        [1.0, -1.55, -0.9],
        [-1.0, -1.55, 0.9],
        [-1.0, -1.55, -0.9],
    ];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(...pos);
        group.add(leg);

        // Foot
        const footGeo = new THREE.SphereGeometry(0.22, 8, 8);
        const foot = new THREE.Mesh(footGeo, skinMat);
        foot.position.set(pos[0], pos[1] - 0.35, pos[2]);
        foot.scale.set(1, 0.5, 1);
        group.add(foot);
    });

    // --- Tail ---
    const tailGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
    const tail = new THREE.Mesh(tailGeo, skinMat);
    tail.position.set(-1.7, -1.1, 0);
    tail.rotation.z = Math.PI / 2;
    group.add(tail);

    // --- Elephants (4 pillars on the shell) ---
    const elephantPositions = [
        [0.7, -0.2, 0.7],
        [0.7, -0.2, -0.7],
        [-0.7, -0.2, 0.7],
        [-0.7, -0.2, -0.7],
    ];
    elephantPositions.forEach(pos => {
        const elephantGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.5, 8);
        const body = new THREE.Mesh(bodyGeo, elephantMat);
        elephantGroup.add(body);

        // Head
        const eHeadGeo = new THREE.SphereGeometry(0.13, 8, 8);
        const eHead = new THREE.Mesh(eHeadGeo, elephantMat);
        eHead.position.set(0.12, 0.2, 0);
        elephantGroup.add(eHead);

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.2, 6);
        const trunk = new THREE.Mesh(trunkGeo, elephantMat);
        trunk.position.set(0.22, 0.12, 0);
        trunk.rotation.z = -Math.PI / 3;
        elephantGroup.add(trunk);

        elephantGroup.position.set(...pos);
        group.add(elephantGroup);
    });

    // --- Earth Disc on top ---
    const discGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.12, 64);
    const disc = new THREE.Mesh(discGeo, earthDiscMat);
    disc.position.y = 0.1;
    group.add(disc);

    // Water ring on disc
    const waterRingGeo = new THREE.RingGeometry(1.5, 2.2, 64);
    const waterRing = new THREE.Mesh(waterRingGeo, waterMat);
    waterRing.rotation.x = -Math.PI / 2;
    waterRing.position.y = 0.17;
    group.add(waterRing);

    // Land patches on disc (simplified continents)
    const landGeo = new THREE.CircleGeometry(1.5, 48);
    const land = new THREE.Mesh(landGeo, earthDiscMat);
    land.rotation.x = -Math.PI / 2;
    land.position.y = 0.17;
    group.add(land);

    // Mountains (cones on the disc)
    const mountainPositions = [
        [0.3, 0.17, 0.5, 0.3, 0.5],
        [-0.4, 0.17, -0.3, 0.2, 0.4],
        [0.7, 0.17, -0.6, 0.25, 0.45],
        [-0.8, 0.17, 0.4, 0.18, 0.35],
        [0.0, 0.17, -0.8, 0.22, 0.38],
    ];
    mountainPositions.forEach(([x, y, z, r, h]) => {
        const mGeo = new THREE.ConeGeometry(r, h, 6);
        const mountain = new THREE.Mesh(mGeo, mountainMat);
        mountain.position.set(x, y + h / 2, z);
        group.add(mountain);
    });

    // Trees (tiny cones)
    const treeMat = new THREE.MeshPhongMaterial({ color: 0x228833, flatShading: true });
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.3 + Math.random() * 1.0;
        const treeGeo = new THREE.ConeGeometry(0.08, 0.2, 5);
        const tree = new THREE.Mesh(treeGeo, treeMat);
        tree.position.set(
            Math.cos(angle) * dist,
            0.27,
            Math.sin(angle) * dist
        );
        group.add(tree);
    }

    return group;
}

function createCelestialSpheres() {
    const group = new THREE.Group();

    // Central Earth (small sphere)
    const earthGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const earthMat = new THREE.MeshPhongMaterial({
        color: 0x4488bb,
        specular: 0x224466,
        shininess: 30,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    group.add(earth);

    // Concentric celestial spheres
    const sphereData = [
        { radius: 1.2, color: 0xcccccc, label: 'Lua', opacity: 0.08 },
        { radius: 1.8, color: 0xddaa44, label: 'Sol', opacity: 0.06 },
        { radius: 2.5, color: 0xdd4444, label: 'Marte', opacity: 0.05 },
        { radius: 3.2, color: 0xddcc88, label: 'Júpiter', opacity: 0.04 },
        { radius: 3.8, color: 0xccbb66, label: 'Saturno', opacity: 0.04 },
        { radius: 4.5, color: 0xaaaadd, label: 'Estrelas Fixas', opacity: 0.03 },
    ];

    const celestialBodies = [];

    sphereData.forEach(({ radius, color, opacity }, idx) => {
        // Transparent sphere
        const sGeo = new THREE.SphereGeometry(radius, 32, 32);
        const sMat = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const sphere = new THREE.Mesh(sGeo, sMat);
        group.add(sphere);

        // Wireframe ring (equator)
        const ringGeo = new THREE.RingGeometry(radius - 0.01, radius + 0.01, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Small body on the sphere
        const bodyGeo = new THREE.SphereGeometry(0.08 + idx * 0.015, 12, 12);
        const bodyMat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(radius, 0, 0);
        group.add(body);

        celestialBodies.push({ body, radius, speed: 0.3 / (idx + 1) });
    });

    group.userData.celestialBodies = celestialBodies;
    return group;
}

function createFlatDisc() {
    const group = new THREE.Group();

    // Flat earth disc
    const discGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.08, 64);
    const discMat = new THREE.MeshPhongMaterial({
        color: 0x4a8c5c,
        specular: 0x223322,
        shininess: 20,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    // Water around the disc
    const waterGeo = new THREE.RingGeometry(2.5, 3.5, 64);
    const waterMat = new THREE.MeshPhongMaterial({
        color: 0x1a6ea0,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.04;
    group.add(water);

    // Ice wall at the edge
    const wallGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.6, 64, 1, true);
    const wallMat = new THREE.MeshPhongMaterial({
        color: 0xd4e6f1,
        specular: 0xffffff,
        shininess: 60,
        transparent: true,
        opacity: 0.6,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 0.3;
    group.add(wall);

    // Dome above
    const domeGeo = new THREE.SphereGeometry(3.5, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshPhongMaterial({
        color: 0x334477,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    group.add(dome);

    // Sun (small sphere orbiting under the dome)
    const sunGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(1.5, 1.5, 0);
    group.add(sun);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    group.add(glow);

    group.userData.sun = sun;
    group.userData.glow = glow;

    return group;
}

// ============================================
// Setup & Lifecycle
// ============================================
export function setup(scene, camera, controls) {
    const container = new THREE.Group();
    scene.add(container);

    let currentView = 'turtle';
    let currentGroup = null;

    function showView(view) {
        if (currentGroup) {
            container.remove(currentGroup);
            disposeGroup(currentGroup);
        }

        currentView = view;
        switch (view) {
            case 'turtle':
                currentGroup = createTurtleScene();
                break;
            case 'celestial':
                currentGroup = createCelestialSpheres();
                break;
            case 'flat':
                currentGroup = createFlatDisc();
                break;
        }
        container.add(currentGroup);
    }

    showView('turtle');

    // Camera default
    camera.position.set(5, 4, 6);
    controls.target.set(0, 0, 0);
    controls.update();

    function update(time) {
        if (!currentGroup) return;

        if (currentView === 'turtle') {
            // Gentle floating motion
            container.position.y = Math.sin(time * 0.5) * 0.15;
            container.rotation.y = time * 0.1;
        } else if (currentView === 'celestial') {
            const bodies = currentGroup.userData.celestialBodies;
            if (bodies) {
                bodies.forEach(({ body, radius, speed }) => {
                    const angle = time * speed;
                    body.position.x = Math.cos(angle) * radius;
                    body.position.z = Math.sin(angle) * radius;
                });
            }
        } else if (currentView === 'flat') {
            const sun = currentGroup.userData.sun;
            const glow = currentGroup.userData.glow;
            if (sun) {
                const angle = time * 0.3;
                const r = 1.5;
                const h = 1.5 + Math.sin(time * 0.2) * 0.3;
                sun.position.set(Math.cos(angle) * r, h, Math.sin(angle) * r);
                glow.position.copy(sun.position);
            }
        }
    }

    function cleanup() {
        if (currentGroup) {
            container.remove(currentGroup);
            disposeGroup(currentGroup);
        }
        scene.remove(container);
        container.position.set(0, 0, 0);
        container.rotation.set(0, 0, 0);
    }

    function createControls(controlsContainer) {
        controlsContainer.innerHTML = `
            <div class="controls-section">
                <div class="control-group">
                    <label>Escolha a concepção histórica:</label>
                    <div class="btn-group" style="margin-top: 6px;">
                        <button class="ctrl-btn active" data-view="turtle" id="ctrl-view-turtle">🐢 Tartaruga Cósmica</button>
                        <button class="ctrl-btn" data-view="celestial" id="ctrl-view-celestial">🌐 Esferas Celestes</button>
                        <button class="ctrl-btn" data-view="flat" id="ctrl-view-flat">📀 Disco Plano</button>
                    </div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
                    Use o mouse para rotacionar e zoom na cena 3D.
                </p>
            </div>
        `;

        controlsContainer.querySelectorAll('.ctrl-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                controlsContainer.querySelectorAll('.ctrl-btn[data-view]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showView(btn.dataset.view);
            });
        });
    }

    return { update, cleanup, createControls };
}

// ============================================
// Utilities
// ============================================
function disposeGroup(group) {
    group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}
