// --- Vista 3D da sala reconstituída a partir das seis faces ajustadas (three.js) ---
// Mostra os 8 vértices, as 12 arestas e as 6 faces do poliedro, com a estação total na origem.
// Mesmo referencial do visualizador principal: Z para cima.
(function (root) {
    'use strict';

    const DEFAULTS = {
        colorFace: '#14b8a6',
        colorEdge: '#1c1917',
        colorVertex: '#4f46e5',
        background: '#ffffff',
        opacity: 0.16,
        showFaces: true,
        showStation: true
    };

    // Arestas do cubo combinatório: pares de vértices que diferem em um único bit
    const ARESTAS = [];
    for (let i = 0; i < 8; i++) {
        for (const bit of [1, 2, 4]) {
            const j = i ^ bit;
            if (j > i) ARESTAS.push([i, j]);
        }
    }

    class RoomViewer3D {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.opts = Object.assign({}, DEFAULTS);
            this.sala = null;
            this._ready = false;
            if (!this.container) return;
            if (typeof THREE === 'undefined') {
                this._fail('Biblioteca three.js não carregada — verifique a conexão com a CDN.');
                return;
            }
            try {
                this._build();
            } catch (e) {
                // Sem WebGL o resto da página (números, tabelas, intervalos) segue utilizável
                this._fail('Não foi possível criar o contexto WebGL neste navegador. ' +
                    'Os números do volume continuam disponíveis acima.');
                console.warn('RoomViewer3D:', e);
            }
        }

        _fail(msg) {
            this._ready = false;
            if (!this.container) return;
            this.container.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
                'padding:1.5rem;text-align:center;font-size:0.8rem;color:#78716c">' + msg + '</div>';
        }

        _build() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(this.opts.background);

            const w = this.container.clientWidth || 700;
            const h = this.container.clientHeight || 420;
            this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 2000);
            this.camera.up.set(0, 0, 1);
            this.camera.position.set(14, -14, 9);

            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(w, h);
            this.container.appendChild(this.renderer.domElement);

            if (THREE.OrbitControls) {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
            }

            this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
            const dir = new THREE.DirectionalLight(0xffffff, 0.5);
            dir.position.set(8, -8, 14);
            this.scene.add(dir);

            this.gRoom = new THREE.Group();
            this.scene.add(this.gRoom);

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

        // `sala` é o objeto devolvido por PlanoVolume.buildRoom
        setRoom(sala) {
            this.sala = sala || null;
            if (this._ready) { this.redraw(); this.fitView(); }
        }

        redraw() {
            if (!this._ready) return;
            this.gRoom.clear();
            if (!this.sala) return;

            const V = this.sala.vertices.map(v => new THREE.Vector3(v[0], v[1], v[2]));

            // Faces semitransparentes, cada quadrilátero em dois triângulos
            if (this.opts.showFaces) {
                const pos = [];
                this.sala.faces.forEach(f => {
                    const [a, b, c, d] = f.quad;
                    [[a, b, c], [a, c, d]].forEach(t => t.forEach(k => pos.push(V[k].x, V[k].y, V[k].z)));
                });
                const geom = new THREE.BufferGeometry();
                geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                geom.computeVertexNormals();
                this.gRoom.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
                    color: new THREE.Color(this.opts.colorFace),
                    transparent: true, opacity: this.opts.opacity,
                    side: THREE.DoubleSide, roughness: 0.85, depthWrite: false
                })));
            }

            // Arestas
            const ep = [];
            ARESTAS.forEach(([i, j]) => {
                ep.push(V[i].x, V[i].y, V[i].z, V[j].x, V[j].y, V[j].z);
            });
            const eg = new THREE.BufferGeometry();
            eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
            this.gRoom.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
                color: new THREE.Color(this.opts.colorEdge)
            })));

            // Vértices
            const vg = new THREE.BufferGeometry();
            vg.setAttribute('position', new THREE.Float32BufferAttribute(
                V.flatMap(v => [v.x, v.y, v.z]), 3));
            this.gRoom.add(new THREE.Points(vg, new THREE.PointsMaterial({
                color: new THREE.Color(this.opts.colorVertex), size: 8, sizeAttenuation: false
            })));

            // Estação total na origem
            if (this.opts.showStation) {
                const st = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.16),
                    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 })
                );
                this.gRoom.add(st);
                this.gRoom.add(new THREE.AxesHelper(1.2));
            }
        }

        fitView() {
            if (!this._ready || !this.sala) return;
            const box = new THREE.Box3();
            this.sala.vertices.forEach(v => box.expandByPoint(new THREE.Vector3(v[0], v[1], v[2])));
            const center = box.getCenter(new THREE.Vector3());
            const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
            const dist = radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.2;
            const dirVec = new THREE.Vector3(1, -1, 0.55).normalize();
            this.camera.position.copy(center.clone().add(dirVec.multiplyScalar(dist)));
            this.camera.near = Math.max(dist / 1000, 0.001);
            this.camera.far = dist * 10;
            this.camera.updateProjectionMatrix();
            if (this.controls) { this.controls.target.copy(center); this.controls.update(); }
            else this.camera.lookAt(center);
        }

        resize() {
            if (!this._ready) return;
            const w = this.container.clientWidth, h = this.container.clientHeight;
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

    root.RoomViewer3D = RoomViewer3D;
    root.RoomViewer3D.DEFAULTS = DEFAULTS;
})(typeof self !== 'undefined' ? self : this);
