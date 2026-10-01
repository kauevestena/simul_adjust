import * as M from "./model.mjs";
import { ImageRenderer } from "./image-renderer.mjs";
import { Viewer } from "./viewer.mjs";
import { t, setLanguage } from "./i18n.mjs";

const $ = (id) => document.getElementById(id);
let state = M.defaults(),
  pinned = null,
  hovered = null,
  image,
  viewer,
  frame = 0;
export const getState = () => structuredClone(state);
export const getSelection = () => {
  const local = hovered || pinned;
  return local ? M.project(M.cubeToWorld(local, state), state) : null;
};
const vertices = [];
for (const x of [-0.5, 0.5])
  for (const y of [-0.5, 0.5])
    for (const z of [-0.5, 0.5]) vertices.push([x, y, z]);
const fmt = (v, n = 3) =>
  Math.abs(v) < 0.5 * 10 ** -n ? (0).toFixed(n) : v.toFixed(n);
const values = (a, n = 3) => a.map((v) => fmt(v, n)).join("  ");
const matrixText = (m, n = 5) =>
  [0, 3, 6]
    .map((i) =>
      m
        .slice(i, i + 3)
        .map((v) => fmt(v, n).padStart(n + 3))
        .join(" "),
    )
    .join("\n");

function fail(error, input) {
  if (input) input.setAttribute("aria-invalid", "true");
  $("form-error").textContent =
    t(error.message) + (error.range ? ` ${error.range.join(" … ")}` : "");
  $("form-error").hidden = false;
}
function clearError() {
  $("form-error").hidden = true;
  document
    .querySelectorAll("[aria-invalid]")
    .forEach((e) => e.removeAttribute("aria-invalid"));
}
function read(id, min = -1e6, max = 1e6, integer = false) {
  const input = $(id);
  let v;
  try {
    v = M.parseNumber(input.value);
    if (v < min || v > max || (integer && !Number.isInteger(v))) {
      const error = Error("range");
      error.range = [min, max];
      throw error;
    }
  } catch (e) {
    input.setAttribute("aria-invalid", "true");
    throw e;
  }
  return v;
}
function applyFields() {
  clearError();
  try {
    const draft = {
      ...state,
      center: ["cx", "cy", "cz"].map((id) => read(id)),
      cubeCenter: ["ox", "oy", "oz"].map((id) => read(id)),
      cubeQ: M.anglesQuaternion(["rx", "ry", "rz"].map((id) => read(id))),
      side: read("side", 0.001, 10000),
      focal: read("focal", 0.1, 1000),
      sensor: [
        read("sensor-width", 0.1, 1000),
        read("sensor-height", 0.1, 1000),
      ],
      offset: [read("offset-x", -1000, 1000), read("offset-y", -1000, 1000)],
      width: read("resolution", 16, 4096, true),
      coefficients: ["k1", "k2", "p1", "p2", "k3"].map((id) =>
        read(id, -100, 100),
      ),
      plane: $("plane").value,
      sampling: $("sampling").value,
      distortion: $("distortion").value,
      axes: $("axes").checked,
      frustum: $("frustum").checked,
      grid: $("grid").checked,
    };
    const k = M.intrinsics(draft);
    if (k.height > 4096 || k.width * k.height > 8e6) throw Error("tooLarge");
    state = draft;
    syncDistortion();
    refresh();
  } catch (e) {
    fail(e);
  }
}
function syncDistortion() {
  for (const id of ["k1", "k2", "p1", "p2", "k3"])
    $(id).disabled =
      state.distortion === "none" ||
      (state.distortion === "radial" && ["p1", "p2", "k3"].includes(id)) ||
      (state.distortion === "tangential" && id === "k3");
}
function rotationInputs() {
  const mode = $("representation").value;
  const labels =
    mode === "angles"
      ? ["ω", "φ", "κ"]
      : mode === "quaternion"
        ? ["w", "x", "y", "z"]
        : Array.from(
            { length: 9 },
            (_, i) => `r${Math.floor(i / 3) + 1}${(i % 3) + 1}`,
          );
  const a =
    mode === "angles"
      ? M.quaternionAngles(state.q).angles
      : mode === "quaternion"
        ? state.q
        : M.transpose(M.quaternionMatrix(state.q));
  $("rotation-inputs").className =
    `fields ${mode === "quaternion" ? "four" : "three"}`;
  $("rotation-inputs").replaceChildren(
    ...labels.map((label, i) => {
      const l = document.createElement("label");
      l.textContent = label;
      const input = document.createElement("input");
      input.id = `rotation-${i}`;
      input.inputMode = "decimal";
      input.value = fmt(a[i], 8);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyRotation();
      });
      l.append(input);
      return l;
    }),
  );
}
function applyRotation() {
  clearError();
  try {
    const a = [...$("rotation-inputs").querySelectorAll("input")].map((e) =>
      read(e.id),
    );
    state.q =
      $("representation").value === "angles"
        ? M.anglesQuaternion(a)
        : $("representation").value === "quaternion"
          ? M.normalizeQuaternion(a)
          : M.matrixQuaternion(M.transpose(a));
    rotationInputs();
    refresh();
  } catch (e) {
    fail(e);
  }
}
function syncFields() {
  const vals = {
    cx: state.center[0],
    cy: state.center[1],
    cz: state.center[2],
    ox: state.cubeCenter[0],
    oy: state.cubeCenter[1],
    oz: state.cubeCenter[2],
    rx: 20,
    ry: 30,
    rz: 0,
    side: state.side,
    "sensor-width": state.sensor[0],
    "sensor-height": state.sensor[1],
    focal: state.focal,
    "offset-x": state.offset[0],
    "offset-y": state.offset[1],
    resolution: state.width,
    k1: 0,
    k2: 0,
    k3: 0,
    p1: 0,
    p2: 0,
  };
  for (const [id, value] of Object.entries(vals)) $(id).value = value;
  for (const id of ["plane", "sampling", "distortion"]) $(id).value = state[id];
  for (const id of ["axes", "frustum", "grid"]) $(id).checked = state[id];
  $("representation").value = "angles";
  $("vertex").value = "";
  rotationInputs();
  syncDistortion();
}
function orientationReadout() {
  const e = M.quaternionAngles(state.q),
    r = M.transpose(M.quaternionMatrix(state.q));
  $("euler-readout").textContent = values(e.angles, 2);
  $("quaternion-readout").textContent =
    `w ${fmt(state.q[0], 4)}  x ${fmt(state.q[1], 4)}\ny ${fmt(state.q[2], 4)}  z ${fmt(state.q[3], 4)}`;
  $("matrix-readout").textContent = matrixText(r, 4);
  $("gimbal-warning").hidden = !e.singular;
  $("gimbal-warning").textContent = t("singular");
  $("camera-label").replaceChildren(document.createTextNode("C "));
  const span = document.createElement("span");
  span.className = "mono";
  span.textContent = `(${values(state.center, 2)})`;
  $("camera-label").append(span);
}
function pointReadout(result) {
  $("point-help").hidden = !!result;
  $("clear-point").hidden = !result;
  const box = $("point-values");
  box.replaceChildren();
  if (!result) return;
  const status = document.createElement("div");
  status.className = "point-status";
  status.dataset.status = result.status;
  const type = document.createElement("span");
  type.textContent = t(hovered ? "hover" : "pinned");
  const visibility = document.createElement("span");
  visibility.textContent = t(result.status);
  status.append(type, visibility);
  box.append(status);
  const rows = [
    ["worldCoords", values(result.world, 4)],
    ["cameraCoords", values(result.camera, 4)],
  ];
  if (result.status !== "behind")
    rows.push(
      ["normalized", values(result.normalized, 5)],
      ["imageMM", values(result.mm, 3)],
      ["imageUV", values(result.uv, 3)],
      ["cvUV", values(result.cv, 3)],
      ["pixel", result.inside ? result.pixel.join(", ") : "—"],
    );
  for (const [key, value] of rows) {
    const row = document.createElement("div");
    row.className = "point-row";
    row.dataset.row = key;
    const label = document.createElement("span");
    label.textContent = t(key);
    const code = document.createElement("code");
    code.textContent = value;
    row.append(label, code);
    box.append(row);
  }
  if (result.occluded) {
    const p = document.createElement("p");
    p.className = "point-note";
    p.textContent = t("selectionNote");
    box.append(p);
  }
}
function overlay(result) {
  const c = $("image-overlay"),
    rect = $("image-container").getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2),
    k = M.intrinsics(state);
  c.width = Math.max(1, Math.round(rect.width * dpr));
  c.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const sx = rect.width / k.width,
    sy = rect.height / k.height;
  const screen = (uv) => [(uv[0] + 0.5) * sx, (uv[1] + 0.5) * sy];
  if (
    state.grid &&
    state.sampling === "pixels" &&
    k.width <= 140 &&
    k.height <= 140
  ) {
    ctx.strokeStyle = "#c9e0d425";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= k.width; i++) {
      ctx.moveTo(i * sx, 0);
      ctx.lineTo(i * sx, rect.height);
    }
    for (let i = 0; i <= k.height; i++) {
      ctx.moveTo(0, i * sy);
      ctx.lineTo(rect.width, i * sy);
    }
    ctx.stroke();
  }
  const center = screen(
    state.plane === "physical"
      ? [k.width - 1 - k.cx, k.height - 1 - k.cy]
      : [k.cx, k.cy],
  );
  ctx.strokeStyle = "#f7fff88a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(center[0] - 5, center[1]);
  ctx.lineTo(center[0] + 5, center[1]);
  ctx.moveTo(center[0], center[1] - 5);
  ctx.lineTo(center[0], center[1] + 5);
  ctx.stroke();
  if (!result || result.status === "behind" || !result.inside) return;
  const [x, y] = screen(result.uv);
  ctx.strokeStyle = result.occluded ? "#c0caca" : "#68e0d3";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1.5;
  if (result.occluded) ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!result.occluded) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, 2 * Math.PI);
    ctx.fill();
  }
  if (state.sampling === "pixels") {
    ctx.strokeStyle = "#ffd36d";
    ctx.strokeRect(
      result.pixel[0] * sx,
      result.pixel[1] * sy,
      Math.max(sx, 1),
      Math.max(sy, 1),
    );
  }
  const idealCV = [
      k.fx * result.normalized[0] + k.cx,
      k.fy * result.normalized[1] + k.cy,
    ],
    idealUV =
      state.plane === "physical"
        ? [k.width - 1 - idealCV[0], k.height - 1 - idealCV[1]]
        : idealCV;
  const [ix, iy] = screen(idealUV);
  if (Math.hypot(ix - x, iy - y) > 1) {
    ctx.strokeStyle = "#ffd36d";
    ctx.beginPath();
    ctx.arc(ix, iy, 3, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = "#68e0d3";
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}
function distortionWarning() {
  const k = M.intrinsics(state),
    d = M.coefficients(state);
  let bad = false;
  for (let i = 0; i <= 8; i++)
    for (let j = 0; j <= 8; j++) {
      const target = [
          ((i * k.width) / 8 - 0.5 - k.cx) / k.fx,
          ((j * k.height) / 8 - 0.5 - k.cy) / k.fy,
        ],
        inv = M.undistort(target, d),
        jac = M.distortionJacobian(target, d);
      if (
        !inv ||
        jac[0] * jac[3] - jac[1] * jac[2] <= 0 ||
        jac[0] <= 0 ||
        jac[3] <= 0
      )
        bad = true;
    }
  $("distortion-warning").hidden = !bad;
  $("distortion-warning").textContent = t("fold");
  $("preview-warning").hidden = !bad;
  $("preview-warning").textContent = t("fold");
  $("image-container").title = bad ? t("fold") : t("principalLegend");
}
function render() {
  frame = 0;
  if (!image || !viewer) return;
  const k = M.intrinsics(state),
    result = getSelection();
  image.render(state);
  viewer.update(state, result);
  overlay(result);
  orientationReadout();
  pointReadout(result);
  $("resolution-badge").textContent = `${k.width} × ${k.height}`;
  $("plane-caption").textContent = t(
    state.plane === "physical" ? "physicalHint" : "virtualHint",
  );
  const fov = M.fieldOfView(state);
  const derived = $("derived");
  derived.replaceChildren();
  for (const [label, value] of [
    [t("fov"), `${values(fov, 1).replace("  ", "° × ")}°`],
    [
      t("pitch"),
      `${values(
        k.pitch.map((v) => v * 1000),
        2,
      ).replace("  ", " × ")} µm`,
    ],
  ]) {
    const row = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "mono";
    valueEl.textContent = value;
    row.append(name, valueEl);
    derived.append(row);
  }
  const pre = document.createElement("pre");
  pre.textContent = `K (px)\n${matrixText(k.K, 2)}`;
  derived.append(pre);
  distortionWarning();
}
function refresh() {
  if (!frame) frame = requestAnimationFrame(render);
}
function select(local, pin) {
  if (pin) {
    pinned = local;
    hovered = null;
    $("vertex").value = "";
  } else hovered = local;
  const result = getSelection();
  if (viewer) viewer.setSelection(result);
  pointReadout(result);
  overlay(result);
}

function init() {
  setLanguage("pt-BR");
  for (let i = 0; i < vertices.length; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `V${i + 1} (${vertices[i].map((x) => (x > 0 ? "+" : "−")).join(", ")})`;
    $("vertex").append(option);
  }
  for (const b of document.querySelectorAll("[data-lang]"))
    b.addEventListener("click", () => {
      setLanguage(b.dataset.lang);
      refresh();
    });
  for (const field of document.querySelectorAll(
    ".controls input,.controls select",
  ))
    if (field.id !== "representation")
      field.addEventListener("change", applyFields);
  for (const b of document.querySelectorAll("[data-resolution]"))
    b.addEventListener("click", () => {
      $("resolution").value = b.dataset.resolution;
      applyFields();
    });
  $("representation").addEventListener("change", rotationInputs);
  $("apply-rotation").addEventListener("click", applyRotation);
  $("face-object").addEventListener("click", () => {
    clearError();
    try {
      state.q = M.lookAtQuaternion(state.center, state.cubeCenter, state.q);
      rotationInputs();
      refresh();
    } catch (e) {
      fail(e);
    }
  });
  $("vertex").addEventListener("change", () => {
    if ($("vertex").value !== "") {
      pinned = [...vertices[Number($("vertex").value)]];
      hovered = null;
      refresh();
    }
  });
  $("clear-point").addEventListener("click", () => {
    pinned = null;
    hovered = null;
    $("vertex").value = "";
    refresh();
  });
  $("reset-view").addEventListener("click", () => viewer?.resetView());
  $("reset").addEventListener("click", () => {
    state = M.defaults();
    pinned = null;
    hovered = null;
    clearError();
    syncFields();
    refresh();
    if (viewer) {
      viewer.s = state;
      viewer.resetView();
    }
  });
  $("theory").addEventListener("click", () => $("theory-dialog").showModal());
  $("close-theory").addEventListener("click", () => $("theory-dialog").close());
  const imagePoint = (e) => {
    const r = $("image-container").getBoundingClientRect(),
      k = M.intrinsics(state),
      uv = [
        ((e.clientX - r.left) / r.width) * k.width - 0.5,
        ((e.clientY - r.top) / r.height) * k.height - 0.5,
      ];
    const direction = M.imageRay(uv, state);
    return direction
      ? (M.hitCube(state.center, direction, state)?.local ?? null)
      : null;
  };
  $("image-container").addEventListener("pointermove", (e) =>
    select(imagePoint(e), false),
  );
  $("image-container").addEventListener("pointerleave", () =>
    select(null, false),
  );
  $("image-container").addEventListener("click", (e) => {
    const p = imagePoint(e);
    if (p) select(p, true);
  });
  syncFields();
  try {
    image = new ImageRenderer($("image-container"));
    viewer = new Viewer($("viewport"), image.canvas, select);
    viewer.resize();
    refresh();
  } catch (e) {
    $("graphics-error").textContent = t("webgl");
    $("graphics-error").hidden = false;
    console.error(e);
  }
  new ResizeObserver(refresh).observe($("image-container"));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
}
init();
