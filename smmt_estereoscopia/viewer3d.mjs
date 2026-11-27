// 3D Three.js scene for dual frame-camera pavement mapping simulator
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const COLORS = {
  bg: 0x0b1220,
  left: 0x38bdf8,
  right: 0xfb923c,
  overlap: 0x22c55e,
  overlapEdge: 0x86efac,
  crossing: 0xf43f5e,
  axisLeft: 0x7dd3fc,
  axisRight: 0xfdba74,
  rig: 0x94a3b8,
  heightGuide: 0xfacc15,
};

function createAsphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Base asphalt gray (markings are rendered as crisp physical 3D strips
  // so they never stretch when pavement width changes)
  ctx.fillStyle = "#2b3038";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle longitudinal wheel tracks (2 lanes)
  const tracks = [80, 175, 337, 432];
  for (const tx of tracks) {
    const grad = ctx.createLinearGradient(tx - 24, 0, tx + 24, 0);
    grad.addColorStop(0, "rgba(18, 21, 26, 0)");
    grad.addColorStop(0.5, "rgba(15, 18, 22, 0.35)");
    grad.addColorStop(1, "rgba(18, 21, 26, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(tx - 24, 0, 48, 512);
  }

  // Deterministic asphalt aggregate grain
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 18000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = Math.floor(34 + rand() * 34);
    ctx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 7}, 0.55)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 9);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildPolygonGeometry(poly2D, yOffset) {
  const geom = new THREE.BufferGeometry();
  if (!poly2D || poly2D.length < 3) {
    geom.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    return geom;
  }
  // Fan triangulation for convex polygon
  const verts = [];
  const [x0, z0] = poly2D[0];
  for (let i = 1; i < poly2D.length - 1; i++) {
    const [x1, z1] = poly2D[i];
    const [x2, z2] = poly2D[i + 1];
    verts.push(x0, yOffset, z0, x1, yOffset, z1, x2, yOffset, z2);
  }
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.computeVertexNormals();
  return geom;
}

function buildPolygonLoopGeometry(poly2D, yOffset) {
  const geom = new THREE.BufferGeometry();
  if (!poly2D || poly2D.length < 2) {
    geom.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    return geom;
  }
  const verts = [];
  for (const [x, z] of poly2D) {
    verts.push(x, yOffset, z);
  }
  verts.push(poly2D[0][0], yOffset, poly2D[0][1]);
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return geom;
}

function buildFrustumSideGeometry(origin, groundCorners) {
  const verts = [];
  const [ox, oy, oz] = origin;
  for (let i = 0; i < 4; i++) {
    const a = groundCorners[i];
    const b = groundCorners[(i + 1) % 4];
    verts.push(ox, oy, oz, a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.computeVertexNormals();
  return geom;
}

function buildFrustumEdgesGeometry(origin, groundCorners) {
  const verts = [];
  const [ox, oy, oz] = origin;
  for (let i = 0; i < 4; i++) {
    const a = groundCorners[i];
    const b = groundCorners[(i + 1) % 4];
    // Corner ray
    verts.push(ox, oy, oz, a[0], a[1], a[2]);
    // Ground edge
    verts.push(a[0], a[1] + 0.01, a[2], b[0], b[1] + 0.01, b[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return geom;
}

function buildSurveyCar() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.3,
    transparent: true,
    opacity: 0.88,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.5,
    transparent: true,
    opacity: 0.82,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    emissive: 0x78350f,
    emissiveIntensity: 0.3,
  });

  // Position car slightly ahead of Z = 0 (rear bumper at Z = -0.45, front at Z = -4.65)
  // so downward-looking rear-mounted camera rig at Z = 0 has an unobstructed view of the pavement.
  const carCenterZ = -2.55;

  // Lower chassis
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 4.2), bodyMat);
  lower.position.set(0, 0.56, carCenterZ);
  group.add(lower);

  // Upper cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.62, 2.35), cabinMat);
  cabin.position.set(0, 1.16, carCenterZ + 0.15);
  group.add(cabin);

  // Roof beacon / GNSS dome
  const gnss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.09, 20), accentMat);
  gnss.position.set(0, 1.52, carCenterZ + 0.45);
  group.add(gnss);

  // Roof rails
  const railGeom = new THREE.BoxGeometry(0.06, 0.06, 2.1);
  for (const sx of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(railGeom, rimMat);
    rail.position.set(sx, 1.5, carCenterZ + 0.2);
    group.add(rail);
  }

  // Tail lights (red) facing +Z
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  for (const sx of [-0.68, 0.68]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.04), tailMat);
    light.position.set(sx, 0.68, carCenterZ + 2.11);
    group.add(light);
  }

  // Headlights (white) facing -Z
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (const sx of [-0.66, 0.66]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.04), headMat);
    light.position.set(sx, 0.64, carCenterZ - 2.11);
    group.add(light);
  }

  // 4 Wheels
  const wheelGeom = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 24);
  wheelGeom.rotateZ(Math.PI / 2);
  const rimGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.23, 16);
  rimGeom.rotateZ(Math.PI / 2);

  for (const sx of [-0.9, 0.9]) {
    for (const sz of [carCenterZ - 1.32, carCenterZ + 1.32]) {
      const w = new THREE.Mesh(wheelGeom, wheelMat);
      w.position.set(sx, 0.33, sz);
      group.add(w);
      const r = new THREE.Mesh(rimGeom, rimMat);
      r.position.set(sx, 0.33, sz);
      group.add(r);
    }
  }

  return group;
}

function buildCameraModel(accentHex) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.65,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.8,
  });
  const ringMat = new THREE.MeshBasicMaterial({ color: accentHex });

  // Camera body extends along -Z in local frame (we will orient local +Z to optical axis d)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.16), bodyMat);
  body.position.set(0, 0, -0.06);
  group.add(body);

  // Lens barrel along +Z (optical axis)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 20), lensMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.05);
  group.add(barrel);

  // Colored accent ring on lens front
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 10, 24), ringMat);
  ring.position.set(0, 0, 0.085);
  group.add(ring);

  return group;
}

function orientCameraObject(obj, cam) {
  obj.position.set(cam.position[0], cam.position[1], cam.position[2]);
  const xAxis = new THREE.Vector3(...cam.u);
  const yAxis = new THREE.Vector3(...cam.v);
  const zAxis = new THREE.Vector3(...cam.d);
  // Ensure right-handed basis for Three.js matrix
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  obj.quaternion.setFromRotationMatrix(m);
}

export class PavementViewer3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 22, 60);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.id = "world-canvas";
    container.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.05, 160);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 35;

    // Lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(8, 14, 10);
    this.scene.add(dir);
    const backDir = new THREE.DirectionalLight(0x93c5fd, 0.45);
    backDir.position.set(-8, 6, -10);
    this.scene.add(backDir);

    this._buildEnvironment();
    this._buildRigAndSensors();
    this._buildFrustumsAndFootprints();
    this._buildGuides();

    this.setView("iso");
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);

    this._animate = this._animate.bind(this);
    this._raf = requestAnimationFrame(this._animate);
  }

  _buildEnvironment() {
    // Large ground verge / terrain plane slightly below road
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x151e2c,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    // Subtle metric grid on verge
    const grid = new THREE.GridHelper(40, 40, 0x26354d, 0x1a2639);
    grid.position.y = -0.015;
    this.scene.add(grid);

    // Paved road mesh (width scaled dynamically to roadWidth)
    const asphaltTex = createAsphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    const roadLen = 64;
    const roadCenterZ = -12;
    this.roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, roadLen), roadMat);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.set(0, 0, roadCenterZ);
    this.scene.add(this.roadMesh);

    // Physical-width road markings (never stretch when roadWidth changes)
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const edgeGeom = new THREE.PlaneGeometry(0.14, roadLen);
    edgeGeom.rotateX(-Math.PI / 2);

    this.leftEdgeLine = new THREE.Mesh(edgeGeom, whiteMat);
    this.leftEdgeLine.position.set(-3.35, 0.003, roadCenterZ);
    this.rightEdgeLine = new THREE.Mesh(edgeGeom, whiteMat);
    this.rightEdgeLine.position.set(3.35, 0.003, roadCenterZ);
    this.scene.add(this.leftEdgeLine, this.rightEdgeLine);

    // Yellow center marking: continuous left stripe + dashed right stripe
    const centerSolidGeom = new THREE.PlaneGeometry(0.11, roadLen);
    centerSolidGeom.rotateX(-Math.PI / 2);
    const centerSolid = new THREE.Mesh(centerSolidGeom, yellowMat);
    centerSolid.position.set(-0.09, 0.003, roadCenterZ);
    this.scene.add(centerSolid);

    const dashGeom = new THREE.PlaneGeometry(0.11, 2.4);
    dashGeom.rotateX(-Math.PI / 2);
    for (let z = roadCenterZ - roadLen / 2 + 2; z < roadCenterZ + roadLen / 2 - 1; z += 4.5) {
      const dash = new THREE.Mesh(dashGeom, yellowMat);
      dash.position.set(0.09, 0.003, z);
      this.scene.add(dash);
    }

    // Survey car
    this.carGroup = buildSurveyCar();
    this.scene.add(this.carGroup);
  }

  _buildRigAndSensors() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: COLORS.rig,
      roughness: 0.35,
      metalness: 0.75,
    });

    this.rigGroup = new THREE.Group();
    this.scene.add(this.rigGroup);

    // Horizontal crossbar holding both cameras at Y = H, Z = 0
    this.crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 16), metalMat);
    this.crossbar.rotation.z = Math.PI / 2;
    this.rigGroup.add(this.crossbar);

    // Telescopic mast from car roof boom to crossbar center (0, H, 0)
    this.mastVertical = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1, 16), metalMat);
    this.rigGroup.add(this.mastVertical);

    // Horizontal boom from car roof (Z = -1.2) back to Z = 0 at roof height (Y = 1.52)
    this.boomHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.3), metalMat);
    this.boomHoriz.position.set(0, 1.52, -0.65);
    this.rigGroup.add(this.boomHoriz);

    // Two camera 3D models
    this.camLeftObj = buildCameraModel(COLORS.left);
    this.camRightObj = buildCameraModel(COLORS.right);
    this.scene.add(this.camLeftObj, this.camRightObj);
  }

  _buildFrustumsAndFootprints() {
    this.frustumGroup = new THREE.Group();
    this.scene.add(this.frustumGroup);

    // Left frustum
    this.leftFrustumMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COLORS.left,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.leftFrustumEdges = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: COLORS.left,
        transparent: true,
        opacity: 0.65,
      }),
    );

    // Right frustum
    this.rightFrustumMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COLORS.right,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.rightFrustumEdges = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: COLORS.right,
        transparent: true,
        opacity: 0.65,
      }),
    );

    this.frustumGroup.add(
      this.leftFrustumMesh,
      this.leftFrustumEdges,
      this.rightFrustumMesh,
      this.rightFrustumEdges,
    );

    // Ground footprints (always visible even if 3D frustum walls are toggled off)
    this.leftFootprintMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COLORS.left,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.leftFootprintEdge = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.left }),
    );

    this.rightFootprintMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COLORS.right,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.rightFootprintEdge = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.right }),
    );

    // Exact Overlap Polygon on pavement
    this.overlapMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: COLORS.overlap,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.overlapMesh.renderOrder = 2;
    this.overlapEdge = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.overlapEdge }),
    );
    this.overlapEdge.renderOrder = 3;

    this.scene.add(
      this.leftFootprintMesh,
      this.leftFootprintEdge,
      this.rightFootprintMesh,
      this.rightFootprintEdge,
      this.overlapMesh,
      this.overlapEdge,
    );
  }

  _buildGuides() {
    this.axesGroup = new THREE.Group();
    this.scene.add(this.axesGroup);

    this.leftAxisLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.axisLeft, transparent: true, opacity: 0.95 }),
    );
    this.rightAxisLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.axisRight, transparent: true, opacity: 0.95 }),
    );

    // Crossing point marker
    this.crossingSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 20, 14),
      new THREE.MeshBasicMaterial({ color: COLORS.crossing }),
    );
    this.crossingRing = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.13, 28),
      new THREE.MeshBasicMaterial({
        color: COLORS.crossing,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.crossingRing.rotation.x = -Math.PI / 2;

    this.crossingDropLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: COLORS.crossing,
        transparent: true,
        opacity: 0.55,
      }),
    );

    this.axesGroup.add(
      this.leftAxisLine,
      this.rightAxisLine,
      this.crossingSphere,
      this.crossingRing,
      this.crossingDropLine,
    );

    // Height & Swath dimension guides
    this.dimGroup = new THREE.Group();
    this.scene.add(this.dimGroup);

    this.heightLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.heightGuide, transparent: true, opacity: 0.85 }),
    );
    this.swathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.7 }),
    );
    this.dimGroup.add(this.heightLine, this.swathLine);
  }

  update(sim, visibility = {}) {
    const { params, left, right, overlapPoly2D, crossing } = sim;

    // Road width & white shoulder line positions
    this.roadMesh.scale.set(params.roadWidth, 1, 1);
    const edgeOffset = Math.max(0.35, params.roadWidth / 2 - 0.16);
    this.leftEdgeLine.position.x = -edgeOffset;
    this.rightEdgeLine.position.x = edgeOffset;

    // Position survey car cleanly relative to sensor bar at Z = 0:
    // - nadir: rear-mounted boom (car ahead of Z = 0)
    // - front: front roof-mounted boom (car behind Z = 0 looking forward toward -Z)
    const isFront = params.mountMode === "front";
    this.carGroup.position.z = isFront ? 4.65 : 0;
    this.boomHoriz.position.set(0, 1.52, isFront ? 0.75 : -0.65);

    // Visibility toggles
    this.carGroup.visible = visibility.showCar !== false;
    this.boomHoriz.visible = this.carGroup.visible;
    this.frustumGroup.visible = visibility.showFrustums !== false;
    this.axesGroup.visible = visibility.showAxes !== false;
    this.dimGroup.visible = visibility.showDimensions !== false;

    // Rig crossbar & vertical mast
    const barWidth = Math.max(params.baseline + 0.24, 0.45);
    this.crossbar.scale.set(1, barWidth, 1);
    this.crossbar.position.set(0, params.height, 0);

    const mastBaseY = this.carGroup.visible ? 1.52 : 0;
    const mastLen = Math.max(0.05, Math.abs(params.height - mastBaseY));
    this.mastVertical.scale.set(1, mastLen, 1);
    this.mastVertical.position.set(0, (params.height + mastBaseY) / 2, 0);

    // Orient camera models
    orientCameraObject(this.camLeftObj, left);
    orientCameraObject(this.camRightObj, right);

    // Update frustum meshes & wireframes
    this._replaceGeom(this.leftFrustumMesh, buildFrustumSideGeometry(left.position, left.groundCorners));
    this._replaceGeom(this.leftFrustumEdges, buildFrustumEdgesGeometry(left.position, left.groundCorners));
    this._replaceGeom(this.rightFrustumMesh, buildFrustumSideGeometry(right.position, right.groundCorners));
    this._replaceGeom(this.rightFrustumEdges, buildFrustumEdgesGeometry(right.position, right.groundCorners));

    // Update footprints & overlap polygon
    this._replaceGeom(this.leftFootprintMesh, buildPolygonGeometry(left.footprint2D, 0.008));
    this._replaceGeom(this.leftFootprintEdge, buildPolygonLoopGeometry(left.footprint2D, 0.012));
    this._replaceGeom(this.rightFootprintMesh, buildPolygonGeometry(right.footprint2D, 0.008));
    this._replaceGeom(this.rightFootprintEdge, buildPolygonLoopGeometry(right.footprint2D, 0.012));

    const hasOverlap = overlapPoly2D.length >= 3;
    this.overlapMesh.visible = hasOverlap;
    this.overlapEdge.visible = hasOverlap;
    if (hasOverlap) {
      this._replaceGeom(this.overlapMesh, buildPolygonGeometry(overlapPoly2D, 0.016));
      this._replaceGeom(this.overlapEdge, buildPolygonLoopGeometry(overlapPoly2D, 0.02));
    }

    // Optical axes lines
    this._setLinePoints(this.leftAxisLine, [left.position, left.axisGround]);
    this._setLinePoints(this.rightAxisLine, [right.position, right.axisGround]);

    // Crossing marker (only when convergent and above or near ground)
    const showCrossing = crossing && crossing.convergent && crossing.heightAboveGround > -1.5;
    this.crossingSphere.visible = Boolean(showCrossing);
    this.crossingRing.visible = Boolean(showCrossing);
    this.crossingDropLine.visible = Boolean(showCrossing && Math.abs(crossing.heightAboveGround) > 0.04);
    if (showCrossing) {
      const [cx, cy, cz] = crossing.point;
      this.crossingSphere.position.set(cx, cy, cz);
      this.crossingRing.position.set(cx, Math.max(0.024, cy), cz);
      this._setLinePoints(this.crossingDropLine, [
        [cx, cy, cz],
        [cx, 0.02, cz],
      ]);
    }

    // Height & swath dimension lines
    this._setLinePoints(this.heightLine, [
      [0, 0.02, 0],
      [0, params.height, 0],
    ]);

    const zFront = Math.max(
      ...left.footprint2D.map((p) => p[1]),
      ...right.footprint2D.map((p) => p[1]),
    );
    const dimZ = zFront + 0.35;
    this._setLinePoints(this.swathLine, [
      [sim.swathMinX, 0.025, dimZ - 0.12],
      [sim.swathMinX, 0.025, dimZ],
      [sim.swathMaxX, 0.025, dimZ],
      [sim.swathMaxX, 0.025, dimZ - 0.12],
    ]);
  }

  setView(preset, mountMode = "nadir") {
    const isFront = mountMode === "front";
    if (preset === "top") {
      this.camera.position.set(0, isFront ? 20 : 12.5, isFront ? -5.5 : 0.01);
      this.controls.target.set(0, 0, isFront ? -5.5 : -0.3);
    } else if (preset === "rear") {
      this.camera.position.set(0, isFront ? 3.2 : 2.3, isFront ? 9.5 : 8.8);
      this.controls.target.set(0, 1.1, isFront ? -3.0 : 0);
    } else if (preset === "side") {
      this.camera.position.set(isFront ? 13.5 : 9.2, isFront ? 3.6 : 2.8, isFront ? -4.5 : -0.8);
      this.controls.target.set(0, 1.0, isFront ? -4.5 : -0.8);
    } else {
      // iso / perspective 3D
      this.camera.position.set(isFront ? 9.5 : 6.2, isFront ? 6.2 : 5.1, isFront ? 7.8 : 6.8);
      this.controls.target.set(0, 0.9, isFront ? -4.2 : -0.6);
    }
    this.controls.update();
  }

  _replaceGeom(obj, nextGeom) {
    obj.geometry.dispose();
    obj.geometry = nextGeom;
  }

  _setLinePoints(line, pts) {
    const verts = [];
    for (const p of pts) verts.push(p[0], p[1], p[2]);
    line.geometry.dispose();
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    line.geometry = geom;
  }

  _resize() {
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
