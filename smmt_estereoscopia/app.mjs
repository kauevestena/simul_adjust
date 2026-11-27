import {
  DEFAULTS,
  SENSOR_PRESETS,
  groundCrossingAngleDeg,
  heightComparisonCurve,
  normalizeParams,
  simulate,
} from "./model.mjs";
import { PavementViewer3D } from "./viewer3d.mjs";
import { HeightOverlapChart } from "./chart.mjs";
import { OrthoSimulator } from "./ortho.mjs";
import { TRANSLATIONS, detectLang, saveLang, t } from "./i18n.mjs";

const state = {
  lang: detectLang(),
  params: { ...DEFAULTS },
  savedPitch: { nadir: 0, front: 25 },
  activeView: "iso",
  orthoTab: "preview",
  orthoCamera: "left",
  orthoGsdRatio: 3.5,
  visibility: {
    showCar: true,
    showFrustums: true,
    showAxes: true,
    showDimensions: true,
  },
};

const RANGE_PAIR_KEYS = [
  "height",
  "baseline",
  "convergenceDeg",
  "pitchDeg",
  "focal",
  "roadWidth",
  "targetOverlap",
];

const DIRECT_NUM_KEYS = ["sensorWidth", "sensorHeight", "resX", "resY"];
const TOGGLE_KEYS = ["showCar", "showFrustums", "showAxes", "showDimensions"];

const viewer = new PavementViewer3D(document.getElementById("viewport-3d"));
const orthoSim = new OrthoSimulator(
  document.getElementById("ortho-canvas-left"),
  document.getElementById("ortho-canvas-right"),
);
const chart = new HeightOverlapChart(document.getElementById("height-chart"), (h) => {
  state.params.height = h;
  syncInputsFromState();
  updateAll();
});

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.title = t(state.lang, "pageTitle");

  for (const el of document.querySelectorAll("[data-t]")) {
    const key = el.getAttribute("data-t");
    el.textContent = t(state.lang, key);
  }

  // Update sensor preset option labels
  const presetSelect = document.getElementById("sensor-preset");
  const names = TRANSLATIONS[state.lang].presetNames;
  for (const opt of presetSelect.options) {
    if (names[opt.value]) opt.textContent = names[opt.value];
  }

  for (const btn of document.querySelectorAll("[data-lang]")) {
    const active = btn.getAttribute("data-lang") === state.lang;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  const portalLink = document.getElementById("portal-link");
  if (portalLink) {
    portalLink.href = `../?lang=${encodeURIComponent(state.lang)}`;
  }
}

function syncModeUI() {
  const isFront = state.params.mountMode === "front";
  for (const btn of document.querySelectorAll("[data-mode]")) {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-mode") === state.params.mountMode ? "true" : "false");
  }
  const pitchLabel = document.getElementById("pitch-label");
  if (pitchLabel) {
    const key = isFront ? "pitchFront" : "pitch";
    pitchLabel.setAttribute("data-t", key);
    pitchLabel.textContent = t(state.lang, key);
  }
  const pitchMin = isFront ? 0 : -35;
  const pitchMax = isFront ? 75 : 35;
  for (const id of ["pitchDeg", "pitchDeg-range"]) {
    const el = document.getElementById(id);
    if (el) {
      el.min = String(pitchMin);
      el.max = String(pitchMax);
    }
  }
}

function syncInputsFromState() {
  syncModeUI();
  for (const key of RANGE_PAIR_KEYS) {
    const val = state.params[key];
    const numEl = document.getElementById(key);
    const rngEl = document.getElementById(`${key}-range`);
    if (numEl) numEl.value = val;
    if (rngEl) rngEl.value = val;
  }
  for (const key of DIRECT_NUM_KEYS) {
    const numEl = document.getElementById(key);
    if (numEl) numEl.value = state.params[key];
  }
  for (const key of TOGGLE_KEYS) {
    const cb = document.getElementById(key);
    if (cb) cb.checked = state.visibility[key];
  }
}

function updateMetrics(sim) {
  const L = state.lang;

  document.getElementById("m-overlap-pct").textContent = `${sim.overlapAreaPct.toFixed(1)}%`;
  document.getElementById("m-overlap-lat").textContent =
    sim.overlapAreaPct > 0
      ? `Lat: ${sim.overlapLateralPct.toFixed(1)}%`
      : t(L, "noOverlap");

  document.getElementById("m-overlap-width").textContent =
    sim.overlapWidth > 0 ? `${sim.overlapWidth.toFixed(2)} m` : "0.00 m";
  document.getElementById("m-overlap-area").textContent =
    sim.overlapWidth > 0
      ? `${sim.overlapArea.toFixed(2)} m²`
      : `${t(L, "gapLabel")}: ${sim.gapWidth.toFixed(2)} m`;

  document.getElementById("m-swath").textContent = `${sim.totalSwathWidth.toFixed(2)} m`;
  document.getElementById("m-road-cover").textContent = sim.coversRoad
    ? t(L, "coversRoadYes")
    : t(L, "coversRoadNo");

  document.getElementById("m-gsd").textContent = `${sim.gsdMm.toFixed(2)} mm/px`;
  document.getElementById("m-bh-ratio").textContent = `B/H = ${sim.bhRatio.toFixed(2)}`;

  const crossEl = document.getElementById("m-crossing");
  const crossSub = document.getElementById("m-crossing-sub");
  if (!sim.crossing) {
    crossEl.textContent = t(L, "parallelState");
    crossSub.textContent = `α_solo = ${sim.optimalGroundAngleDeg.toFixed(1)}°`;
  } else if (!sim.crossing.convergent) {
    crossEl.textContent = t(L, "divergentState");
    crossSub.textContent = `α = ${sim.params.convergenceDeg.toFixed(1)}°`;
  } else {
    crossEl.textContent = `Y = ${sim.crossing.heightAboveGround.toFixed(2)} m`;
    const locKey =
      sim.crossing.location === "ground"
        ? "crossOnGround"
        : sim.crossing.location === "above"
          ? "crossAbove"
          : "crossBelow";
    crossSub.textContent = `${t(L, locKey)} (α_solo ${sim.optimalGroundAngleDeg.toFixed(1)}°)`;
  }

  document.getElementById("m-fov").textContent = `${sim.hfovDeg.toFixed(1)}° × ${sim.vfovDeg.toFixed(1)}°`;
  document.getElementById("m-along-depth").textContent = `Along-track: ${sim.alongTrackDepth.toFixed(2)} m`;

  const legPar = document.getElementById("legend-parallel");
  legPar.style.display = Math.abs(sim.params.convergenceDeg) > 0.05 ? "inline-flex" : "none";
}

function updateOrtho(sim) {
  const L = state.lang;
  const isBands = state.orthoTab === "bands";

  const leftCap = document.getElementById("ortho-left-caption");
  const rightCap = document.getElementById("ortho-right-caption");
  leftCap.textContent = t(L, isBands ? "orthoCapOriginalBands" : "orthoCapOriginal");
  rightCap.textContent = t(L, isBands ? "orthoCapOrthoBands" : "orthoCapOrtho");

  document.getElementById("ortho-band-legend").hidden = !isBands;

  const analysis = orthoSim.render(sim, {
    tab: state.orthoTab,
    cameraSide: state.orthoCamera,
    gsdRatioLimit: state.orthoGsdRatio,
    labels: {
      vanishingLine: t(L, "orthoVanishing"),
      nearLabel: t(L, "orthoNear"),
      farLabel: t(L, "orthoFar"),
      noGround: t(L, "orthoNoGround"),
    },
  });

  document.getElementById("o-usable-area").textContent = `${analysis.usableAreaM2.toFixed(2)} m²`;
  document.getElementById("o-usable-pct").textContent = `${analysis.usablePct.toFixed(1)}%`;
  document.getElementById("o-sky-pct").textContent = `${analysis.unprojectablePct.toFixed(1)}%`;
  document.getElementById("o-gsd-range").textContent =
    analysis.minGsdMm > 0
      ? `${analysis.minGsdMm.toFixed(2)} → ${analysis.maxUsableGsdMm.toFixed(2)} mm/px`
      : "—";

  const minLbl = document.getElementById("viridis-min-label");
  const maxLbl = document.getElementById("viridis-max-label");
  if (minLbl && maxLbl && analysis.minGsdMm > 0) {
    minLbl.textContent = `${t(L, "orthoBestRes")}: ${analysis.minGsdMm.toFixed(2)} mm/px`;
    maxLbl.textContent = `${t(L, "orthoWorstRes")}: ≥ ${(analysis.minGsdMm * analysis.maxScale).toFixed(2)} mm/px`;
  }
}

function updateAll() {
  state.params = normalizeParams(state.params);
  const sim = simulate(state.params);
  viewer.update(sim, state.visibility);
  updateMetrics(sim);

  const curve = heightComparisonCurve(state.params, 90);
  chart.render(curve, sim, {
    target: t(state.lang, "chartTargetLine"),
    axisX: t(state.lang, "chartAxisX"),
    axisY: t(state.lang, "chartAxisY"),
  });

  updateOrtho(sim);
}

function wireEvents() {
  // Mount mode switcher (nadir vs front-facing)
  for (const btn of document.querySelectorAll("[data-mode]")) {
    btn.addEventListener("click", () => {
      const nextMode = btn.getAttribute("data-mode");
      if (nextMode === state.params.mountMode) return;
      state.savedPitch[state.params.mountMode] = state.params.pitchDeg;
      state.params.mountMode = nextMode;
      state.params.pitchDeg = state.savedPitch[nextMode];
      syncInputsFromState();
      viewer.setView(state.activeView, nextMode);
      updateAll();
    });
  }

  // Language switcher
  for (const btn of document.querySelectorAll("[data-lang]")) {
    btn.addEventListener("click", () => {
      state.lang = btn.getAttribute("data-lang");
      saveLang(state.lang);
      applyI18n();
      updateAll();
    });
  }

  // Range + Number synchronized inputs
  for (const key of RANGE_PAIR_KEYS) {
    const numEl = document.getElementById(key);
    const rngEl = document.getElementById(`${key}-range`);
    rngEl.addEventListener("input", () => {
      state.params[key] = Number(rngEl.value);
      numEl.value = rngEl.value;
      updateAll();
    });
    numEl.addEventListener("input", () => {
      const v = Number(numEl.value);
      if (!Number.isFinite(v)) return;
      state.params[key] = v;
      rngEl.value = v;
      updateAll();
    });
  }

  // Direct camera sensor inputs
  const presetSelect = document.getElementById("sensor-preset");
  for (const key of DIRECT_NUM_KEYS) {
    const el = document.getElementById(key);
    el.addEventListener("input", () => {
      const v = Number(el.value);
      if (!Number.isFinite(v)) return;
      state.params[key] = v;
      presetSelect.value = "custom";
      updateAll();
    });
  }

  presetSelect.addEventListener("change", () => {
    const preset = SENSOR_PRESETS[presetSelect.value];
    if (!preset) return;
    Object.assign(state.params, preset);
    syncInputsFromState();
    updateAll();
  });

  // Quick axis orientation buttons
  document.getElementById("btn-parallel").addEventListener("click", () => {
    state.params.convergenceDeg = 0;
    syncInputsFromState();
    updateAll();
  });

  document.getElementById("btn-cross-ground").addEventListener("click", () => {
    const ang = Math.round(groundCrossingAngleDeg(state.params) * 10) / 10;
    state.params.convergenceDeg = ang;
    syncInputsFromState();
    updateAll();
  });

  // Visibility toggles
  for (const key of TOGGLE_KEYS) {
    document.getElementById(key).addEventListener("change", (e) => {
      state.visibility[key] = e.target.checked;
      updateAll();
    });
  }

  // Reset all
  document.getElementById("reset-all").addEventListener("click", () => {
    state.params = { ...DEFAULTS };
    state.savedPitch = { nadir: 0, front: 25 };
    presetSelect.value = "1_inch";
    syncInputsFromState();
    viewer.setView(state.activeView, state.params.mountMode);
    updateAll();
  });

  // Ortho tabs & controls
  const orthoTabs = document.querySelectorAll("[data-ortho-tab]");
  for (const btn of orthoTabs) {
    btn.addEventListener("click", () => {
      state.orthoTab = btn.getAttribute("data-ortho-tab");
      for (const b of orthoTabs) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      }
      updateAll();
    });
  }

  document.getElementById("ortho-camera").addEventListener("change", (e) => {
    state.orthoCamera = e.target.value;
    updateAll();
  });

  document.getElementById("ortho-ratio").addEventListener("change", (e) => {
    state.orthoGsdRatio = Number(e.target.value) || 3.5;
    updateAll();
  });

  // Pixel resolution hover tooltip on both ortho canvases
  const tooltip = document.getElementById("ortho-tooltip");
  for (const [which, id] of [
    ["left", "ortho-canvas-left"],
    ["right", "ortho-canvas-right"],
  ]) {
    const canvas = document.getElementById(id);
    canvas.addEventListener("pointermove", (e) => {
      const sample = orthoSim.sampleAtPointer(which, e.clientX, e.clientY);
      if (!sample || sample.status === "outside") {
        tooltip.hidden = true;
        return;
      }
      if (sample.status === "sky") {
        tooltip.innerHTML = `<div class="tt-main">${t(state.lang, "orthoHoverSky")}</div>`;
      } else {
        tooltip.innerHTML =
          `<div class="tt-main">GSD: ${sample.gsdMaxMm.toFixed(2)} mm/px (${sample.ratio.toFixed(2)}×)</div>` +
          `<div class="tt-sub">X/Z: ${sample.gsdAcrossMm.toFixed(2)} × ${sample.gsdAlongMm.toFixed(2)} mm/px</div>` +
          `<div class="tt-sub">Solo: X=${sample.x.toFixed(2)}m · Z=${sample.z.toFixed(2)}m</div>`;
      }
      tooltip.hidden = false;
      const pad = 14;
      const tw = tooltip.offsetWidth || 180;
      const th = tooltip.offsetHeight || 56;
      const leftPos = e.clientX + pad + tw > window.innerWidth ? e.clientX - tw - pad : e.clientX + pad;
      const topPos = e.clientY + pad + th > window.innerHeight ? e.clientY - th - pad : e.clientY + pad;
      tooltip.style.left = `${Math.max(8, leftPos)}px`;
      tooltip.style.top = `${Math.max(8, topPos)}px`;
    });
    canvas.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
  }

  // 3D viewport camera presets
  const viewButtons = document.querySelectorAll("[data-view]");
  for (const btn of viewButtons) {
    btn.addEventListener("click", () => {
      for (const b of viewButtons) b.classList.remove("active");
      btn.classList.add("active");
      state.activeView = btn.getAttribute("data-view");
      viewer.setView(state.activeView, state.params.mountMode);
    });
  }
}

applyI18n();
syncInputsFromState();
wireEvents();
viewer.setView(state.activeView, state.params.mountMode);
updateAll();
