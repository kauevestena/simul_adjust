class Viewport3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510); // Very dark blue

        // Camera setup (Field of view simulating a theodolite lens, e.g., 20 degrees)
        this.camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // State
        this.pitch = 45; // degrees (Altitude)
        this.yaw = 0;    // degrees (Azimuth)
        
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        
        // Objects
        this.starsGroup = new THREE.Group();
        this.scene.add(this.starsGroup);
        this.starMeshes = [];

        // Raycaster for center detection
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.5; // tolerance
        this.centerVector = new THREE.Vector2(0, 0); // Always center of screen

        this.initEvents();
        this.animate();
    }

    initEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Pointer Lock for FPS-like controls
        this.container.addEventListener('click', () => {
            this.container.requestPointerLock();
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.container) {
                const deltaX = e.movementX || 0;
                const deltaY = e.movementY || 0;

                // Sensitivity
                this.yaw -= deltaX * 0.05;
                this.pitch -= deltaY * 0.05; // Invert depending on preference

                // Clamp pitch so we don't look past zenith or too far below horizon (limit to -30 alt / 120 zenith)
                this.pitch = Math.max(-30, Math.min(90, this.pitch));
                
                // Wrap yaw
                this.yaw = AstronomyMath.normalizeAngle(this.yaw);

                this.updateCameraRotation();
                
                // Dispatch event for UI updates
                document.dispatchEvent(new CustomEvent('viewportMoved', {
                    detail: {
                        pitch: this.pitch,
                        yaw: this.yaw
                    }
                }));
            }
        });
        
        // Touch support
        this.container.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, {passive: true});
        
        this.container.addEventListener('touchend', () => {
            this.isDragging = false;
        });
        
        this.container.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
                const deltaY = e.touches[0].clientY - this.previousMousePosition.y;

                this.yaw -= deltaX * 0.05;
                this.pitch -= deltaY * 0.05;
                this.pitch = Math.max(-30, Math.min(90, this.pitch));
                this.yaw = AstronomyMath.normalizeAngle(this.yaw);

                this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.updateCameraRotation();
                
                document.dispatchEvent(new CustomEvent('viewportMoved', {
                    detail: { pitch: this.pitch, yaw: this.yaw }
                }));
            }
        }, {passive: true});
    }

    updateCameraRotation() {
        // Spherical coordinates to euler
        // We look from origin. Yaw is around Y axis, Pitch is angle up from XZ plane.
        // In three.js, Y is up. Z is out of screen.
        
        const phi = (90 - this.pitch) * DEG_TO_RAD;
        const theta = (90 - this.yaw) * DEG_TO_RAD;

        const target = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
        );

        this.camera.lookAt(target);
    }

    populateStars(starsData, lat, lon, time) {
        // Clear previous
        while(this.starsGroup.children.length > 0){ 
            const obj = this.starsGroup.children[0];
            this.starsGroup.remove(obj); 
            if(obj.material) obj.material.dispose();
            if(obj.geometry) obj.geometry.dispose();
        }
        this.starMeshes = [];

        const gmst = AstronomyMath.getGMST(time);
        
        // Create geometry for points
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const sizes = [];

        starsData.forEach(star => {
            // Compute horizontal coordinates
            const calc = AstronomyMath.equatorialToHorizontal(star.ra, star.dec, lat, lon, gmst);
            
            // Convert to 3D Cartesian coordinates on a sphere of radius 100
            const r = 100;
            const phi = (90 - calc.alt) * DEG_TO_RAD;
            const theta = (90 - calc.az) * DEG_TO_RAD;

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.cos(phi);
            const z = r * Math.sin(phi) * Math.sin(theta);
            
            // Only add if above horizon (or slightly below)
            if (calc.alt > -5) {
                positions.push(x, y, z);
                
                // Color (could be based on star type, but white for now)
                colors.push(1, 1, 1);
                
                // Magnitude determines size (lower mag = brighter/bigger)
                // Mag ranges roughly from -1.5 to 2.0
                const baseSize = window.devicePixelRatio || 1;
                const size = Math.max(2, (6 - star.mag) * 2 * baseSize);
                sizes.push(size);
                
                this.starMeshes.push({
                    x, y, z,
                    data: star
                });
            }
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        // Use ShaderMaterial to allow per-point sizing via attributes
        const material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: this.createCircleTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 customColor;
                varying vec3 vColor;
                void main() {
                    vColor = customColor;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                void main() {
                    gl_FragColor = vec4(vColor, 0.9) * texture2D(pointTexture, gl_PointCoord);
                }
            `,
            transparent: true,
            depthTest: false
        });

        const points = new THREE.Points(geometry, material);
        this.starsGroup.add(points);
        this.pointsObject = points;
    }

    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    checkCrosshairIntersect() {
        if (!this.pointsObject) return null;
        
        this.raycaster.setFromCamera(this.centerVector, this.camera);
        const intersects = this.raycaster.intersectObject(this.pointsObject);
        
        if (intersects.length > 0) {
            // Get the star data
            const index = intersects[0].index;
            return this.starMeshes[index].data;
        }
        return null;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}
