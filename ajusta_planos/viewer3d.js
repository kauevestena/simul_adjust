// --- Visualizador 3D da nuvem, dos elipsoides de erro e do plano ajustado (three.js) ---
// Referencial da estação total: origem no instrumento, Z para cima.
(function (root) {
    'use strict';

    const DEFAULTS = {
        colorPoint: '#0f766e',
        colorOutlier: '#e11d48',
        colorInactive: '#a8a29e',
        colorEllipsoid: '#6366f1',
        colorPlane: '#14b8a6',
        colorResidualPos: '#2563eb',
        colorResidualNeg: '#f97316',
        background: '#ffffff',
        showEllipsoids: true,
        showPlane: true,
        showResiduals: false,
        showAxes: true,
        ellipsoidScale: 200,
        residualScale: 50,
        pointSize: 7
    };

    class PlaneViewer3D {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.opts = Object.assign({}, DEFAULTS);
            this.points = [];
            this.result = null;
            this._ready = false;
            if (!this.container) return;
            if (typeof THREE === 'undefined') {
                this._fail('Biblioteca three.js não carregada — verifique a conexão com a CDN.');
                return;
            }
            try {
                this._build();
            } catch (e) {
                // Sem WebGL o restante do simulador (tabelas, matrizes, resíduos 2D) segue utilizável
                this._fail('Não foi possível criar o contexto WebGL neste navegador. ' +
                    'As demais abas continuam funcionando.');
                console.warn('PlaneViewer3D:', e);
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
            this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 2000);
            this.camera.up.set(0, 0, 1); // Z para cima, como no referencial topográfico
            this.camera.position.set(8, -8, 5);

            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(w, h);
            this.container.appendChild(this.renderer.domElement);

            if (THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
            }

            this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
            const dir = new THREE.DirectionalLight(0xffffff, 0.55);
            dir.position.set(5, -5, 10);
            this.scene.add(dir);

            this.gPoints = new THREE.Group();
            this.gEllipsoids = new THREE.Group();
            this.gPlane = new THREE.Group();
            this.gResiduals = new THREE.Group();
            this.gHelpers = new THREE.Group();
            [this.gHelpers, this.gPlane, this.gEllipsoids, this.gResiduals, this.gPoints]
                .forEach(g => this.scene.add(g));

            this._buildHelpers();
            this._sphereGeom = new THREE.SphereGeometry(1, 16, 12);

            this._onResize = () => this.resize();
            window.addEventListener('resize', this._onResize);
            this._ready = true;
            this._animate();
        }

        _buildHelpers() {
            this.gHelpers.clear();
            if (!this.opts.showAxes) return;
            const axes = new THREE.AxesHelper(1.5); // X vermelho, Y verde, Z azul
            this.gHelpers.add(axes);
            // Marcador da estação total na origem
            const st = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.09),
                new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6 })
            );
            this.gHelpers.add(st);
        }

        setOptions(patch) {
            Object.assign(this.opts, patch);
            if (!this._ready) return;
            if ('background' in patch) this.scene.background = new THREE.Color(this.opts.background);
            if ('showAxes' in patch) this._buildHelpers();
            this.redraw();
        }

        setData(points, result) {
            this.points = points || [];
            this.result = result || null;
            if (this._ready) this.redraw();
        }

        redraw() {
            if (!this._ready) return;
            this._drawPoints();
            this._drawEllipsoids();
            this._drawPlane();
            this._drawResiduals();
        }

        // --- pontos observados, coloridos por estado ---
        _drawPoints() {
            this.gPoints.clear();
            if (!this.points.length) return;

            const cPoint = new THREE.Color(this.opts.colorPoint);
            const cOut = new THREE.Color(this.opts.colorOutlier);
            const cOff = new THREE.Color(this.opts.colorInactive);

            const pos = [], col = [];
            this.points.forEach(p => {
                pos.push(p.xyz[0], p.xyz[1], p.xyz[2]);
                const c = !p.active ? cOff : (p.flagged ? cOut : cPoint);
                col.push(c.r, c.g, c.b);
            });

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            const mat = new THREE.PointsMaterial({
                size: this.opts.pointSize,
                sizeAttenuation: false,
                vertexColors: true
            });
            this.gPoints.add(new THREE.Points(geom, mat));
        }

        // --- elipsoides de erro: autodecomposição de Sigma_XYZ, semieixos sqrt(lambda)*escala ---
        _drawEllipsoids() {
            this.gEllipsoids.clear();
            if (!this.opts.showEllipsoids || !this.points.length) return;
            if (typeof PlaneAdjust === 'undefined') return;

            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(this.opts.colorEllipsoid),
                transparent: true, opacity: 0.28, roughness: 0.5,
                depthWrite: false
            });
            const k = this.opts.ellipsoidScale;

            this.points.forEach(p => {
                if (!p.active) return;
                const { values, vectors } = PlaneAdjust.linalg.eigSym(p.sigXYZ);
                const mesh = new THREE.Mesh(this._sphereGeom, mat);
                // Colunas de `vectors` são os autovetores: montam a rotação do elipsoide
                const m = new THREE.Matrix4();
                m.set(
                    vectors[0][0], vectors[0][1], vectors[0][2], 0,
                    vectors[1][0], vectors[1][1], vectors[1][2], 0,
                    vectors[2][0], vectors[2][1], vectors[2][2], 0,
                    0, 0, 0, 1
                );
                mesh.quaternion.setFromRotationMatrix(m);
                mesh.scale.set(
                    Math.sqrt(Math.max(values[0], 0)) * k,
                    Math.sqrt(Math.max(values[1], 0)) * k,
                    Math.sqrt(Math.max(values[2], 0)) * k
                );
                mesh.position.set(p.xyz[0], p.xyz[1], p.xyz[2]);
                this.gEllipsoids.add(mesh);
            });
        }

        // --- plano ajustado, recortado à extensão da nuvem ---
        _drawPlane() {
            this.gPlane.clear();
            if (!this.opts.showPlane || !this.result) return;

            const X = this.result.normalized ? this.result.normalized.Xn : this.result.Xa;
            const n = new THREE.Vector3(X[0], X[1], X[2]);
            const len = n.length();
            if (len < 1e-12) return;
            n.divideScalar(len);
            const D = X[3] / len;

            // Centróide dos pontos ativos projetado no plano
            const pts = this.result.Lb;
            const c = new THREE.Vector3();
            pts.forEach(p => c.add(new THREE.Vector3(p[0], p[1], p[2])));
            c.divideScalar(pts.length);
            const dist = n.dot(c) + D;
            const origin = c.clone().sub(n.clone().multiplyScalar(dist));

            // Extensão no referencial local do plano
            const helper = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
            const e1 = new THREE.Vector3().crossVectors(helper, n).normalize();
            const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();
            let du = 0, dv = 0;
            pts.forEach(p => {
                const d = new THREE.Vector3(p[0], p[1], p[2]).sub(origin);
                du = Math.max(du, Math.abs(d.dot(e1)));
                dv = Math.max(dv, Math.abs(d.dot(e2)));
            });
            const su = Math.max(du * 2.1, 0.5), sv = Math.max(dv * 2.1, 0.5);

            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
            const geom = new THREE.PlaneGeometry(su, sv);
            const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
                color: new THREE.Color(this.opts.colorPlane),
                transparent: true, opacity: 0.22, side: THREE.DoubleSide,
                roughness: 0.8, depthWrite: false
            }));
            mesh.position.copy(origin);
            mesh.quaternion.copy(quat);
            this.gPlane.add(mesh);

            // Grade sobre o plano, para dar noção de profundidade e inclinação
            const grid = new THREE.GridHelper(Math.max(su, sv), 16,
                new THREE.Color(this.opts.colorPlane), new THREE.Color(this.opts.colorPlane));
            grid.material.transparent = true;
            grid.material.opacity = 0.35;
            // GridHelper nasce no plano XZ; leva para XY e depois para o plano ajustado
            grid.quaternion.copy(quat.clone().multiply(
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))));
            grid.position.copy(origin);
            this.gPlane.add(grid);

            // Vetor normal, ancorado no centro do plano
            const arrow = new THREE.ArrowHelper(n, origin, Math.max(su, sv) * 0.3,
                new THREE.Color(this.opts.colorPlane).getHex(), undefined, undefined);
            this.gPlane.add(arrow);
        }

        // --- resíduos: do ponto observado até a observação ajustada, com exagero ---
        _drawResiduals() {
            this.gResiduals.clear();
            if (!this.opts.showResiduals || !this.result) return;

            const k = this.opts.residualScale;
            const cPos = new THREE.Color(this.opts.colorResidualPos);
            const cNeg = new THREE.Color(this.opts.colorResidualNeg);
            const pos = [], col = [];

            this.result.obsData.forEach(o => {
                const p = this.result.Lb[o.i];
                const v = o.v;
                const c = o.d >= 0 ? cPos : cNeg;
                pos.push(p[0], p[1], p[2]);
                pos.push(p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k);
                col.push(c.r, c.g, c.b, c.r, c.g, c.b);
            });
            if (!pos.length) return;

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            this.gResiduals.add(new THREE.LineSegments(geom,
                new THREE.LineBasicMaterial({ vertexColors: true })));
        }

        fitView() {
            if (!this._ready || !this.points.length) return;
            const box = new THREE.Box3();
            this.points.forEach(p => box.expandByPoint(new THREE.Vector3(p.xyz[0], p.xyz[1], p.xyz[2])));
            box.expandByPoint(new THREE.Vector3(0, 0, 0)); // mantém a estação em quadro
            const center = box.getCenter(new THREE.Vector3());
            const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
            const dist = radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.15;

            const dirVec = new THREE.Vector3(1, -1, 0.6).normalize();
            this.camera.position.copy(center.clone().add(dirVec.multiplyScalar(dist)));
            this.camera.near = Math.max(dist / 1000, 0.001);
            this.camera.far = dist * 10;
            this.camera.updateProjectionMatrix();
            if (this.controls) {
                this.controls.target.copy(center);
                this.controls.update();
            } else {
                this.camera.lookAt(center);
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

        _animate() {
            requestAnimationFrame(() => this._animate());
            if (this.controls) this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    root.PlaneViewer3D = PlaneViewer3D;
    root.PlaneViewer3D.DEFAULTS = DEFAULTS;
})(typeof self !== 'undefined' ? self : this);
