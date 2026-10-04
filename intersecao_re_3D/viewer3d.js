// --- Visualizador 3D da rede: estações, pontos fixos e livres, visadas e elipsoides (three.js) ---
// O referencial do ajustamento segue o ajusta_planos: X na direção do zero do círculo, Y a
// 90° no sentido horário e Z para cima. Esse terno é de mão esquerda; desenhá-lo direto no
// three.js espelharia a rede. A tela usa (Y, X, Z), que é de mão direita e mostra a planta
// como ela é: X para "cima", Y para a direita.
(function (root) {
    'use strict';
    const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);

    const DEFAULTS = {
        colorStation: '#d97706',
        colorFixed: '#e11d48',
        colorFree: '#0f766e',
        colorEllipsoid: '#6366f1',
        colorLine: '#a8a29e',
        colorFlagged: '#e11d48',
        background: '#ffffff',
        showEllipsoids: true,
        showLines: true,
        showLabels: true,
        showAxes: true,
        ellipsoidScale: 300,
        pointScale: 1,
        confK: 1
    };

    // mundo (X, Y, Z) -> tela (Y, X, Z)
    const toDisplay = p => [p[1], p[0], p[2]];
    const SWAP = [[0, 1, 0], [1, 0, 0], [0, 0, 1]];

    class NetworkViewer3D {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.opts = Object.assign({}, DEFAULTS);
            this.scene3 = { points: [], lines: [] };
            this._ready = false;
            if (!this.container) return;
            if (typeof THREE === 'undefined') {
                this._fail(tr('Biblioteca three.js não carregada — verifique a conexão com a CDN.', 'three.js library not loaded — check the CDN connection.'));
                return;
            }
            try {
                this._build();
            } catch (e) {
                this._fail(tr('Não foi possível criar o contexto WebGL neste navegador. ' +
                    'As demais abas continuam funcionando.', 'Could not create a WebGL context in this browser. ' +
                    'The other tabs keep working.'));
                console.warn('NetworkViewer3D:', e);
            }
        }

        _fail(msg) {
            this._ready = false;
            if (!this.container) return;
            this.container.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:1.5rem;' +
                'text-align:center;font-size:0.8rem;color:#78716c">' + msg + '</div>';
        }

        _build() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(this.opts.background);
            const w = this.container.clientWidth || 800;
            const h = this.container.clientHeight || 520;
            this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 5000);
            this.camera.up.set(0, 0, 1);
            this.camera.position.set(20, -20, 12);

            // preserveDrawingBuffer: o relatório em PDF captura o canvas
            this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(w, h);
            this.container.appendChild(this.renderer.domElement);

            if (THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
            }

            this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
            const dir = new THREE.DirectionalLight(0xffffff, 0.55);
            dir.position.set(5, -5, 10);
            this.scene.add(dir);

            this.gHelpers = new THREE.Group();
            this.gLines = new THREE.Group();
            this.gEllipsoids = new THREE.Group();
            this.gPoints = new THREE.Group();
            this.gLabels = new THREE.Group();
            [this.gHelpers, this.gLines, this.gEllipsoids, this.gPoints, this.gLabels].forEach(g => this.scene.add(g));

            this._geo = {
                sphere: new THREE.SphereGeometry(1, 16, 12),
                station: new THREE.OctahedronGeometry(1),
                fixed: new THREE.ConeGeometry(0.9, 1.8, 3)
            };
            this._labelCache = new Map();
            this.center = [0, 0, 0];
            this.extent = 10;

            this._onResize = () => this.resize();
            window.addEventListener('resize', this._onResize);
            this._ready = true;
            this._animate();
        }

        setOptions(patch) {
            Object.assign(this.opts, patch);
            if (!this._ready) return;
            if ('background' in patch) this.scene.background = new THREE.Color(this.opts.background);
            this.redraw();
        }

        // scene: { points: [{ name, xyz, kind: station|fixed|free, Sigma|null }],
        //          lines: [{ a: xyz, b: xyz, state: active|inactive|flagged }] }
        setScene(scene, refit) {
            this.scene3 = scene || { points: [], lines: [] };
            const pts = this.scene3.points;
            if (pts.length) {
                const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
                pts.forEach(p => p.xyz.forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); }));
                this.center = min.map((v, i) => (v + max[i]) / 2);
                this.extent = Math.max(Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]), 1);
            }
            if (this._ready) {
                this.redraw();
                if (refit) this.fitView();
            }
        }

        // posição de tela, centrada na rede (evita perda de precisão em coordenadas grandes)
        _pos(xyz) {
            const d = toDisplay([xyz[0] - this.center[0], xyz[1] - this.center[1], xyz[2] - this.center[2]]);
            return new THREE.Vector3(d[0], d[1], d[2]);
        }

        redraw() {
            if (!this._ready) return;
            this._drawHelpers();
            this._drawLines();
            this._drawPoints();
            this._drawEllipsoids();
            this._drawLabels();
        }

        _drawHelpers() {
            this.gHelpers.clear();
            if (!this.opts.showAxes || !this.scene3.points.length) return;
            const L = this.extent * 0.12;
            // Eixos na origem do referencial (a estação de origem do datum local). Com
            // coordenadas de projeto (ex.: 5000, 8000) a origem fica longe da rede; aí os
            // eixos vão para o centro dela, para não sumirem do quadro.
            const near = Math.hypot(...this.center) < 2 * this.extent;
            const o = this._pos(near ? [0, 0, 0] : this.center);
            [[[1, 0, 0], '#dc2626', 'X'], [[0, 1, 0], '#16a34a', 'Y'], [[0, 0, 1], '#2563eb', 'Z']].forEach(([dir, col, name]) => {
                const d = toDisplay(dir);
                const v = new THREE.Vector3(d[0], d[1], d[2]);
                this.gHelpers.add(new THREE.ArrowHelper(v, o, L, new THREE.Color(col).getHex(), L * 0.18, L * 0.09));
                const lbl = this._label(name, col, false);
                lbl.position.copy(o.clone().add(v.clone().multiplyScalar(L * 1.15)));
                this.gHelpers.add(lbl);
            });
        }

        _drawLines() {
            this.gLines.clear();
            if (!this.opts.showLines) return;
            const groups = { active: [], flagged: [], inactive: [] };
            this.scene3.lines.forEach(l => {
                const a = this._pos(l.a), b = this._pos(l.b);
                (groups[l.state] || groups.active).push(a.x, a.y, a.z, b.x, b.y, b.z);
            });
            const add = (pos, material) => {
                if (!pos.length) return;
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                const seg = new THREE.LineSegments(g, material);
                if (material.isLineDashedMaterial) seg.computeLineDistances();
                this.gLines.add(seg);
            };
            add(groups.active, new THREE.LineBasicMaterial({ color: this.opts.colorLine, transparent: true, opacity: 0.85 }));
            add(groups.flagged, new THREE.LineBasicMaterial({ color: this.opts.colorFlagged }));
            const dash = this.extent * 0.01;
            add(groups.inactive, new THREE.LineDashedMaterial({ color: this.opts.colorLine, dashSize: dash, gapSize: dash, transparent: true, opacity: 0.6 }));
        }

        _drawPoints() {
            this.gPoints.clear();
            const size = this.extent * 0.011 * this.opts.pointScale;
            const mats = {
                station: new THREE.MeshStandardMaterial({ color: this.opts.colorStation, roughness: 0.5 }),
                fixed: new THREE.MeshStandardMaterial({ color: this.opts.colorFixed, roughness: 0.5 }),
                free: new THREE.MeshStandardMaterial({ color: this.opts.colorFree, roughness: 0.5 })
            };
            this.scene3.points.forEach(p => {
                const kind = p.kind === 'station' ? 'station' : (p.kind === 'fixed' ? 'fixed' : 'free');
                const geo = kind === 'station' ? this._geo.station : (kind === 'fixed' ? this._geo.fixed : this._geo.sphere);
                const mesh = new THREE.Mesh(geo, mats[kind]);
                mesh.position.copy(this._pos(p.xyz));
                const s = kind === 'free' ? size * 0.8 : size * 1.25;
                mesh.scale.set(s, s, s);
                if (kind === 'fixed') mesh.rotation.x = Math.PI / 2; // cone com a ponta para cima (Z)
                this.gPoints.add(mesh);
            });
        }

        // Elipsoide = autodecomposição de Σ já levada à tela (T Σ Tᵀ), semieixos k·√λ·escala
        _drawEllipsoids() {
            this.gEllipsoids.clear();
            if (!this.opts.showEllipsoids || typeof NetAdjust === 'undefined') return;
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(this.opts.colorEllipsoid),
                transparent: true, opacity: 0.32, roughness: 0.5, depthWrite: false
            });
            const L = NetAdjust.linalg;
            const k = this.opts.confK * this.opts.ellipsoidScale;
            this.scene3.points.forEach(p => {
                if (!p.Sigma) return;
                const Sd = L.matmul(L.matmul(SWAP, p.Sigma), SWAP);
                const el = NetAdjust.ellipsoid3D(Sd, k);
                if (!(el.axesAsc[2] > 0)) return;
                const R = el.R;
                const mesh = new THREE.Mesh(this._geo.sphere, mat);
                const m = new THREE.Matrix4();
                m.set(R[0][0], R[0][1], R[0][2], 0,
                    R[1][0], R[1][1], R[1][2], 0,
                    R[2][0], R[2][1], R[2][2], 0,
                    0, 0, 0, 1);
                mesh.quaternion.setFromRotationMatrix(m);
                mesh.scale.set(...el.axesAsc.map(a => Math.max(a, 1e-9)));
                mesh.position.copy(this._pos(p.xyz));
                this.gEllipsoids.add(mesh);
            });
        }

        _label(text, color, small) {
            const key = `${text}|${color}|${small}`;
            let tex = this._labelCache.get(key);
            if (!tex) {
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                const fs = 44;
                ctx.font = `600 ${fs}px Inter, sans-serif`;
                const w = Math.ceil(ctx.measureText(text).width) + 16;
                c.width = w; c.height = fs + 14;
                ctx.font = `600 ${fs}px Inter, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.92)';
                ctx.strokeText(text, 8, c.height / 2);
                ctx.fillStyle = color;
                ctx.fillText(text, 8, c.height / 2);
                tex = { texture: new THREE.CanvasTexture(c), aspect: c.width / c.height };
                this._labelCache.set(key, tex);
            }
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.texture, depthTest: false, transparent: true }));
            const h = this.extent * (small ? 0.03 : 0.038);
            sp.scale.set(h * tex.aspect, h, 1);
            sp.center.set(0, 0);
            return sp;
        }

        _drawLabels() {
            this.gLabels.clear();
            if (!this.opts.showLabels) return;
            const off = this.extent * 0.01;
            this.scene3.points.forEach(p => {
                const col = p.kind === 'station' ? '#92400e' : (p.kind === 'fixed' ? '#9f1239' : '#115e59');
                const lbl = this._label(p.name, col, p.kind === 'free');
                lbl.position.copy(this._pos(p.xyz).add(new THREE.Vector3(off, off, off)));
                this.gLabels.add(lbl);
            });
        }

        fitView() {
            if (!this._ready || !this.scene3.points.length) return;
            const radius = Math.max(this.extent / 2, 0.5);
            const dist = radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 0.8;
            const dirVec = new THREE.Vector3(0.9, -1, 0.75).normalize();
            this.camera.position.copy(dirVec.multiplyScalar(dist));
            this.camera.near = Math.max(dist / 1000, 0.001);
            this.camera.far = dist * 20;
            this.camera.updateProjectionMatrix();
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            } else {
                this.camera.lookAt(0, 0, 0);
            }
        }

        resize() {
            if (!this._ready) return;
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            if (!w || !h) return;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        }

        // Imagem da vista atual para o relatório
        snapshot() {
            if (!this._ready) return null;
            this.renderer.render(this.scene, this.camera);
            const c = this.renderer.domElement;
            if (!c.width || !c.height) return null;
            return { dataURL: c.toDataURL('image/jpeg', 0.9), width: c.width, height: c.height };
        }

        _animate() {
            requestAnimationFrame(() => this._animate());
            if (this.controls) this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    root.NetworkViewer3D = NetworkViewer3D;
    root.NetworkViewer3D.DEFAULTS = DEFAULTS;
})(typeof self !== 'undefined' ? self : this);
