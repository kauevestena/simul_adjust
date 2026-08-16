import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { figureDetails } from './figures.js';

// Import all model modules
import * as historicoModule from './models/historico.js';
import * as esferaModule from './models/esfera.js';
import * as elipsoideModule from './models/elipsoide.js';
import * as geoideModule from './models/geoide.js';
import * as teluroideModule from './models/teluroide.js';

// ============================================
// Model Registry
// ============================================
const models = [
    { id: 'historico',  module: historicoModule },
    { id: 'esfera',     module: esferaModule },
    { id: 'elipsoide',  module: elipsoideModule },
    { id: 'geoide',     module: geoideModule },
    { id: 'teluroide',  module: teluroideModule },
];

// ============================================
// State
// ============================================
let currentModelId = null;
let currentModelInstance = null; // { update, cleanup, createControls }
let scene, camera, renderer, controls;
let clock;
let animationId;
let starField;

// ============================================
// Initialization
// ============================================
function init() {
    clock = new THREE.Clock();

    setupThreeJS();
    createStarField();
    setupLighting();
    buildSidebar();
    setupTabs();
    setupPanelToggle();
    setupFigureModal();

    // Select the first model
    selectModel('historico');

    // Start render loop
    animate();

    // Handle resize
    window.addEventListener('resize', onResize);
}

// ============================================
// Three.js Setup
// ============================================
function setupThreeJS() {
    const canvas = document.getElementById('three-canvas');
    const container = document.getElementById('three-container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(4, 3, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Orbit Controls
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
}

function createStarField() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const r = 50 + Math.random() * 150;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        color: 0x88aaee,
        size: 0.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
    });

    starField = new THREE.Points(geometry, material);
    scene.add(starField);
}

function setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    // Main directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8888cc, 0.4);
    fillLight.position.set(-3, 2, -4);
    scene.add(fillLight);

    // Hemisphere for environment
    const hemi = new THREE.HemisphereLight(0x88aaff, 0x224466, 0.3);
    scene.add(hemi);
}

// ============================================
// Sidebar
// ============================================
function buildSidebar() {
    const nav = document.getElementById('model-nav');
    nav.innerHTML = '';

    models.forEach(({ id, module }) => {
        const info = module.modelInfo;
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.dataset.modelId = id;
        item.id = `nav-${id}`;

        item.innerHTML = `
            <div class="nav-item-icon">${info.icon}</div>
            <div class="nav-item-text">
                <div class="nav-item-name">${info.name}</div>
                <div class="nav-item-desc">${info.subtitle}</div>
            </div>
        `;

        item.addEventListener('click', () => selectModel(id));
        nav.appendChild(item);
    });
}

// ============================================
// Model Selection
// ============================================
function selectModel(id) {
    if (id === currentModelId) return;

    // Cleanup previous model
    if (currentModelInstance) {
        currentModelInstance.cleanup();
        currentModelInstance = null;
    }

    currentModelId = id;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.modelId === id);
    });

    // Find the module
    const entry = models.find(m => m.id === id);
    if (!entry) return;

    const { module } = entry;
    const info = module.modelInfo;

    // Update title overlay with animation
    const overlay = document.getElementById('model-title-overlay');
    overlay.style.animation = 'none';
    overlay.offsetHeight; // trigger reflow
    overlay.style.animation = 'fadeSlideIn 0.6s ease forwards';

    document.getElementById('current-model-name').textContent = info.name;
    document.getElementById('current-model-subtitle').textContent = info.subtitle;

    // Populate info tabs
    document.getElementById('tab-history').innerHTML = info.history;
    document.getElementById('tab-how').innerHTML = info.howItWorks;

    // Attach click listeners to figure cards for modal popups
    attachFigureCardListeners();

    // Setup the 3D scene
    currentModelInstance = module.setup(scene, camera, controls);

    // Create controls in the interact tab
    const interactTab = document.getElementById('tab-interact');
    interactTab.innerHTML = '';
    if (currentModelInstance.createControls) {
        currentModelInstance.createControls(interactTab);
    }

    // Reset camera if model provides a default position
    if (info.cameraPosition) {
        camera.position.set(...info.cameraPosition);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// ============================================
// Tabs
// ============================================
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update active button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active pane
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

// ============================================
// Panel Toggle
// ============================================
function setupPanelToggle() {
    const panel = document.getElementById('info-panel');
    const toggleBtn = document.getElementById('toggle-panel');

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        // Trigger resize so canvas updates
        setTimeout(onResize, 350);
    });
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    animationId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Slowly rotate star field
    if (starField) {
        starField.rotation.y += 0.0001;
    }

    // Update current model
    if (currentModelInstance && currentModelInstance.update) {
        currentModelInstance.update(elapsed, delta);
    }

    controls.update();
    renderer.render(scene, camera);
}

// ============================================
// Figure Detail Modal
// ============================================
function setupFigureModal() {
    const modal = document.getElementById('figure-modal');
    const closeBtn = document.getElementById('modal-close');

    // Close on button click
    closeBtn.addEventListener('click', closeFigureModal);

    // Close on overlay click (outside modal content)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFigureModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeFigureModal();
        }
    });
}

function attachFigureCardListeners() {
    const cards = document.querySelectorAll('.figure-card[data-figure-id]');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const figureId = card.dataset.figureId;
            openFigureModal(figureId);
        });
    });
}

function openFigureModal(figureId) {
    const figure = figureDetails[figureId];
    if (!figure) {
        console.warn(`Figure details not found for: ${figureId}`);
        return;
    }

    const modal = document.getElementById('figure-modal');

    // Populate portrait
    const portraitImg = document.getElementById('modal-portrait');
    portraitImg.src = figure.portrait;
    portraitImg.alt = `Retrato de ${figure.name}`;

    // Populate text
    document.getElementById('modal-name').textContent = figure.name;
    document.getElementById('modal-years').textContent = figure.years;
    document.getElementById('modal-description').innerHTML = figure.description;

    // Populate illustration
    const illustWrapper = document.getElementById('modal-illustration-wrapper');
    const illustImg = document.getElementById('modal-illustration');
    const illustCaption = document.getElementById('modal-illustration-caption');

    if (figure.illustration) {
        illustWrapper.style.display = 'block';
        illustImg.src = figure.illustration;
        illustImg.alt = figure.illustrationCaption || '';
        illustCaption.textContent = figure.illustrationCaption || '';
    } else {
        illustWrapper.style.display = 'none';
    }

    // Open modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // prevent background scrolling
}

function closeFigureModal() {
    const modal = document.getElementById('figure-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================
// Resize Handler
// ============================================
function onResize() {
    const container = document.getElementById('three-container');
    const w = container.clientWidth;
    const h = container.clientHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// ============================================
// Start
// ============================================
init();
