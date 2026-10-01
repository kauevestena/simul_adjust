import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import * as M from "./model.mjs";

const vec = (a) => new THREE.Vector3(...a);
const setQ = (object, q) => object.quaternion.set(q[1], q[2], q[3], q[0]);
function line(color, points = []) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map(vec)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
}
const setLine = (l, points) => {
  l.geometry.dispose();
  l.geometry = new THREE.BufferGeometry().setFromPoints(points.map(vec));
};
export class Viewer {
  constructor(container, image, onPoint) {
    this.container = container;
    this.onPoint = onPoint;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#17252d");
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.domElement.id = "world-canvas";
    container.prepend(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.002, 10000);
    this.camera.up.set(0, -1, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 10000;
    this.controls.addEventListener("change", () => this.draw());
    this.detailCamera = new THREE.PerspectiveCamera(42, 1, 0.0001, 1000);
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      M.FACE_COLORS.map(
        (color) =>
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      ),
    );
    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.cube.geometry),
      new THREE.LineBasicMaterial({ color: "#23343c" }),
    );
    this.cube.add(this.edges);
    this.scene.add(this.cube);
    this.globalAxes = new THREE.AxesHelper(0.65);
    this.scene.add(this.globalAxes);
    this.cameraGroup = new THREE.Group();
    this.scene.add(this.cameraGroup);
    this.localAxes = new THREE.AxesHelper(0.07);
    this.cameraGroup.add(this.localAxes);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.003, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#fff1be" }),
    );
    this.cameraGroup.add(pin);
    this.texture = new THREE.CanvasTexture(image);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.sensor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        side: THREE.DoubleSide,
      }),
    );
    this.cameraGroup.add(this.sensor);
    this.sensorFrame = line("#69d8cc");
    this.cameraGroup.add(this.sensorFrame);
    this.optical = line("#a4b9c3");
    this.cameraGroup.add(this.optical);
    this.frustum = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#7c9eaa",
        transparent: true,
        opacity: 0.25,
      }),
    );
    this.cameraGroup.add(this.frustum);
    this.ray = line("#ffd36d");
    this.ray.material.depthTest = false;
    this.ray.renderOrder = 3;
    this.scene.add(this.ray);
    this.displacement = line("#68e0d3");
    this.displacement.material.depthTest = false;
    this.displacement.renderOrder = 4;
    this.scene.add(this.displacement);
    const marker = (color) =>
      new THREE.Mesh(
        new THREE.SphereGeometry(1, 18, 12),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
    this.point = marker("#ffd36d");
    this.ideal = marker("#ffd36d");
    this.projected = marker("#68e0d3");
    for (const a of [this.point, this.ideal, this.projected]) {
      a.renderOrder = 5;
      this.scene.add(a);
    }
    this.raycaster = new THREE.Raycaster();
    this.resetView();
    const canvas = this.renderer.domElement;
    let down = null,
      drag = false;
    canvas.addEventListener("pointerdown", (e) => {
      down = [e.clientX, e.clientY];
      drag = false;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4)
        drag = true;
      if (e.buttons || drag) return;
      this.onPoint(this.pick(e), false);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (down && !drag && e.button === 0) {
        const p = this.pick(e);
        if (p) this.onPoint(p, true);
      }
      down = null;
      drag = false;
    });
    canvas.addEventListener("pointercancel", () => {
      down = null;
      drag = false;
    });
    canvas.addEventListener("pointerleave", () => {
      this.onPoint(null, false);
      down = null;
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }
  resetView() {
    const target = this.s
      ? M.scale(M.add(this.s.center, this.s.cubeCenter), 0.5)
      : [0, 0, 2.5];
    const d = this.s
      ? Math.max(
          0.5,
          M.norm(M.sub(this.s.center, this.s.cubeCenter)),
          this.s.side * 2,
        )
      : 5;
    this.controls.target.fromArray(target);
    this.camera.position
      .copy(vec(target))
      .add(vec([d * 0.95, -d * 0.65, -d * 1.08]));
    this.camera.up.set(0, -1, 0);
    this.controls.update();
    this.draw();
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov =
      (2 * Math.atan(Math.tan(20 * M.DEG) / Math.min(1, w / h))) / M.DEG;
    // Reserve visual space for the persistent orientation readout.
    this.camera.setViewOffset(
      w,
      h,
      w < 500 ? 0 : Math.min(100, w * 0.1),
      0,
      w,
      h,
    );
    this.camera.updateProjectionMatrix();
    this.draw();
  }
  update(s, result) {
    this.s = s;
    this.result = result;
    this.cube.position.fromArray(s.cubeCenter);
    this.cube.scale.setScalar(s.side);
    setQ(this.cube, s.cubeQ);
    this.cameraGroup.position.fromArray(s.center);
    setQ(this.cameraGroup, s.q);
    const sign = s.plane === "physical" ? -1 : 1,
      f = s.focal / 1000,
      w = s.sensor[0] / 1000,
      h = s.sensor[1] / 1000;
    const x = (-sign * s.offset[0]) / 1000,
      y = (-sign * s.offset[1]) / 1000,
      z = sign * f;
    this.sensor.position.set(x, y, z);
    this.sensor.scale.set(w, h, 1);
    const corners = [
      [-w / 2 + x, -h / 2 + y, z],
      [w / 2 + x, -h / 2 + y, z],
      [w / 2 + x, h / 2 + y, z],
      [-w / 2 + x, h / 2 + y, z],
    ];
    setLine(this.sensorFrame, [...corners, corners[0]]);
    setLine(this.optical, [
      [0, 0, -f * 1.4],
      [0, 0, Math.max(f * 2, M.norm(M.sub(s.cubeCenter, s.center)))],
    ]);
    const far = Math.max(f * 2, M.norm(M.sub(s.cubeCenter, s.center))),
      frustum = [];
    for (const c of corners) frustum.push([0, 0, 0], M.scale(c, far / z));
    this.frustum.geometry.dispose();
    this.frustum.geometry = new THREE.BufferGeometry().setFromPoints(
      frustum.map(vec),
    );
    this.frustum.visible = s.frustum;
    this.globalAxes.visible = s.axes;
    this.localAxes.visible = s.axes;
    this.texture.magFilter =
      s.sampling === "pixels" ? THREE.NearestFilter : THREE.LinearFilter;
    this.texture.minFilter = this.texture.magFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    const extent = Math.max(w, h, f, 0.005),
      qmat = M.quaternionMatrix(s.q);
    this.detailCamera.up.copy(vec(M.mv(qmat, [0, -1, 0])));
    this.detailCamera.position.fromArray(
      M.cameraToWorld([extent * 0.8, -extent * 0.45, z - extent * 1.5], s),
    );
    this.detailCamera.lookAt(
      vec(M.cameraToWorld([x * 0.5, y * 0.5, z * 0.6], s)),
    );
    this.setSelection(result);
    this.draw();
  }
  setSelection(r) {
    this.result = r;
    const exists = !!r,
      projectable = exists && r.status !== "behind";
    this.point.visible = exists;
    this.ray.visible = projectable;
    this.ideal.visible = projectable;
    this.projected.visible = projectable;
    this.displacement.visible = projectable;
    if (exists) {
      this.point.position.fromArray(r.world);
      this.point.scale.setScalar(this.s.side * 0.014);
    }
    if (projectable) {
      setLine(this.ray, [r.world, this.s.center, r.ideal]);
      setLine(this.displacement, [r.ideal, r.image]);
      this.ideal.position.fromArray(r.ideal);
      this.projected.position.fromArray(r.image);
      const size = Math.min(...this.s.sensor) / 1000 / 75;
      this.ideal.scale.setScalar(size);
      this.projected.scale.setScalar(size * 0.85);
    }
    this.draw();
  }
  pick(e) {
    if (!this.s) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    // The inset is a detail view, not a second picking surface.
    if (
      e.clientX - r.left < this.insetWidth + 20 &&
      e.clientY - r.top > r.height - this.insetHeight - 20
    )
      return null;
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        (2 * (e.clientX - r.left)) / r.width - 1,
        1 - (2 * (e.clientY - r.top)) / r.height,
      ),
      this.camera,
    );
    const hit = this.raycaster.intersectObject(this.cube, false)[0];
    if (!hit) return null;
    const local = this.cube.worldToLocal(hit.point.clone()).toArray();
    // Snap near vertices, measured in viewport pixels, without restricting face picking.
    let best = 10,
      p = local;
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) {
          const v = vec(M.cubeToWorld([x, y, z], this.s)).project(this.camera);
          const dist = Math.hypot(
            ((v.x + 1) * r.width) / 2 - (e.clientX - r.left),
            ((1 - v.y) * r.height) / 2 - (e.clientY - r.top),
          );
          if (v.z > -1 && v.z < 1 && dist < best) {
            best = dist;
            p = [x, y, z];
          }
        }
    return p;
  }
  draw() {
    if (!this.renderer || !this.container.clientHeight) return;
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.render(this.scene, this.camera);
    if (!this.s) return;
    this.insetWidth = Math.min(270, w * 0.34);
    this.insetHeight = Math.min(185, h * 0.3);
    const iw = this.insetWidth,
      ih = this.insetHeight;
    this.detailCamera.aspect = iw / ih;
    this.detailCamera.updateProjectionMatrix();
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(16, 16, iw, ih);
    this.renderer.setViewport(16, 16, iw, ih);
    this.scene.background.set("#21353e");
    this.globalAxes.visible = false;
    const pointVisible = this.point.visible;
    this.cube.visible = false;
    this.frustum.visible = false;
    this.point.visible = false;
    this.renderer.render(this.scene, this.detailCamera);
    this.cube.visible = true;
    this.frustum.visible = this.s.frustum;
    this.point.visible = pointVisible;
    this.scene.background.set("#17252d");
    this.globalAxes.visible = this.s.axes;
    this.renderer.setScissorTest(false);
    const label = this.container.querySelector("#camera-label"),
      p = vec(this.s.center).project(this.camera);
    if (label) {
      label.style.left = `${((p.x + 1) * w) / 2}px`;
      label.style.top = `${((1 - p.y) * h) / 2}px`;
      label.hidden = p.z > 1 || p.z < -1;
    }
    const caption = this.container.querySelector("#detail-caption");
    if (caption) {
      caption.style.bottom = `${ih + 21}px`;
      caption.style.width = `${iw}px`;
    }
  }
}
