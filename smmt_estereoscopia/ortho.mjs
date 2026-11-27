// Single-camera projective orthophoto (IPM / planar homography) & horizontal GSD resolution bands
// Works seamlessly for both Nadir and Front-facing camera modes.

const MAX_ORTHO_RANGE = 26.0; // meters ahead/around camera for finite projective display

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Ray direction for normalized sensor coordinates su, sv in [-1, 1]
 * (su = +1 is right edge, sv = +1 is top edge of camera image).
 */
export function sensorRay(cam, params, su, sv) {
  const halfTanH = params.sensorWidth / (2 * params.focal);
  const halfTanV = params.sensorHeight / (2 * params.focal);
  return [
    cam.d[0] + su * halfTanH * cam.u[0] + sv * halfTanV * cam.v[0],
    cam.d[1] + su * halfTanH * cam.u[1] + sv * halfTanV * cam.v[1],
    cam.d[2] + su * halfTanH * cam.u[2] + sv * halfTanV * cam.v[2],
  ];
}

/**
 * Exact planar homography: projects a ground point (x, 0, z) into
 * normalized sensor coordinates (su, sv) in [-1, 1]^2.
 * Returns null if behind the camera.
 */
export function projectGroundToImage(cam, params, x, z) {
  const q = [x - cam.position[0], -cam.position[1], z - cam.position[2]];
  const zc = dot3(q, cam.d);
  if (zc <= 1e-5) return null;
  const xc = dot3(q, cam.u);
  const yc = dot3(q, cam.v);
  const halfTanH = params.sensorWidth / (2 * params.focal);
  const halfTanV = params.sensorHeight / (2 * params.focal);
  return {
    su: xc / (zc * halfTanH),
    sv: yc / (zc * halfTanV),
    depth: zc,
  };
}

/**
 * Intersects a sensor coordinate (su, sv) with the ground plane Y = 0.
 * Returns null if ray points at or above the horizon (vanishing line, ry >= 0).
 */
export function projectImageToGround(cam, params, su, sv) {
  const r = sensorRay(cam, params, su, sv);
  if (r[1] >= -1e-5) return null;
  const t = -cam.position[1] / r[1];
  const x = cam.position[0] + t * r[0];
  const z = cam.position[2] + t * r[2];
  const horizDist = Math.hypot(x - cam.position[0], z - cam.position[2]);
  return { x, z, t, horizDist };
}

/**
 * Exact local GSD (mm/px) at sensor coordinate (su, sv) using the Jacobian
 * of the 3D ray-ground projective map.
 * Returns { gsdAcrossMm, gsdAlongMm, gsdMaxMm, gsdGeomMm, x, z, horizDist } or null if above horizon.
 */
export function computePixelGsd(cam, params, su, sv) {
  const p = projectImageToGround(cam, params, su, sv);
  if (!p) return null;

  const du = 2 / params.resX;
  const dv = 2 / params.resY;
  const epsU = Math.max(du, 1e-4);
  const epsV = Math.max(dv, 1e-4);

  const pu1 = projectImageToGround(cam, params, su + epsU * 0.5, sv);
  const pu0 = projectImageToGround(cam, params, su - epsU * 0.5, sv);
  const pv1 = projectImageToGround(cam, params, su, sv + epsV * 0.5);
  const pv0 = projectImageToGround(cam, params, su, sv - epsV * 0.5);

  if (!pu1 || !pu0 || !pv1 || !pv0) return null;

  const dPdu = Math.hypot(pu1.x - pu0.x, pu1.z - pu0.z) / epsU;
  const dPdv = Math.hypot(pv1.x - pv0.x, pv1.z - pv0.z) / epsV;

  // Convert meters per unit-sensor to mm per pixel
  const gsdAcrossMm = dPdu * du * 1000;
  const gsdAlongMm = dPdv * dv * 1000;
  const gsdMaxMm = Math.max(gsdAcrossMm, gsdAlongMm);
  const gsdGeomMm = Math.sqrt(gsdAcrossMm * gsdAlongMm);

  return {
    gsdAcrossMm,
    gsdAlongMm,
    gsdMaxMm,
    gsdGeomMm,
    x: p.x,
    z: p.z,
    horizDist: p.horizDist,
  };
}

/**
 * Vanishing line (horizon) vertical coordinate sv at a given su:
 * solves r_y(su, sv) = 0 => d_y + su*tanH*u_y + sv*tanV*v_y = 0.
 * Returns null if v_y is ~0 (pure nadir, horizon is not parallel to image rows).
 */
export function horizonSvAt(cam, params, su = 0) {
  const halfTanH = params.sensorWidth / (2 * params.focal);
  const halfTanV = params.sensorHeight / (2 * params.focal);
  const denom = halfTanV * cam.v[1];
  if (Math.abs(denom) < 1e-6) return null;
  return -(cam.d[1] + su * halfTanH * cam.u[1]) / denom;
}

/**
 * Evaluates ortho usability metrics & horizontal resolution profile along the image rows.
 * gsdRatioLimit: maximum acceptable GSD relative to best (bottom/nadir) GSD (e.g. 3.0x).
 */
export function analyzeOrthoUsability(cam, params, gsdRatioLimit = 3.5) {
  const rows = 48;
  const cols = 24;
  let totalPixels = 0;
  let projectablePixels = 0;
  let usablePixels = 0;
  let minGsd = Infinity;
  let maxUsableGsd = 0;
  let usableAreaM2 = 0;

  // First pass: find minimum GSD in the frame (typically bottom edge / nearest pavement)
  const samples = [];
  for (let r = 0; r < rows; r++) {
    const sv = 1 - ((r + 0.5) / rows) * 2; // +1 (top) to -1 (bottom)
    for (let c = 0; c < cols; c++) {
      const su = -1 + ((c + 0.5) / cols) * 2;
      totalPixels++;
      const g = computePixelGsd(cam, params, su, sv);
      if (g && g.horizDist <= MAX_ORTHO_RANGE) {
        projectablePixels++;
        if (g.gsdMaxMm < minGsd) minGsd = g.gsdMaxMm;
      }
      samples.push({ r, c, sv, su, g });
    }
  }

  const gsdCutoffMm = Number.isFinite(minGsd) ? minGsd * gsdRatioLimit : Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const cellPixelsX = params.resX / cols;
  const cellPixelsY = params.resY / rows;

  for (const s of samples) {
    const g = s.g;
    if (!g || g.horizDist > MAX_ORTHO_RANGE) continue;
    if (g.gsdMaxMm <= gsdCutoffMm) {
      usablePixels++;
      if (g.gsdMaxMm > maxUsableGsd) maxUsableGsd = g.gsdMaxMm;
      // Approximate physical ground patch area (m^2)
      const patchArea = (g.gsdAcrossMm * cellPixelsX * 1e-3) * (g.gsdAlongMm * cellPixelsY * 1e-3);
      usableAreaM2 += patchArea;
      if (g.x < minX) minX = g.x;
      if (g.x > maxX) maxX = g.x;
      if (g.z < minZ) minZ = g.z;
      if (g.z > maxZ) maxZ = g.z;
    }
  }

  // Also include projectable bounds (capped to MAX_ORTHO_RANGE) for display framing
  let dispMinX = minX;
  let dispMaxX = maxX;
  let dispMinZ = minZ;
  let dispMaxZ = maxZ;
  for (const s of samples) {
    const g = s.g;
    if (!g || g.horizDist > MAX_ORTHO_RANGE) continue;
    if (g.x < dispMinX) dispMinX = g.x;
    if (g.x > dispMaxX) dispMaxX = g.x;
    if (g.z < dispMinZ) dispMinZ = g.z;
    if (g.z > dispMaxZ) dispMaxZ = g.z;
  }

  const horizonSv = horizonSvAt(cam, params, 0);
  const horizonVisible = horizonSv !== null && horizonSv >= -1.0 && horizonSv <= 1.0;

  return {
    minGsdMm: Number.isFinite(minGsd) ? minGsd : 0,
    maxUsableGsdMm: maxUsableGsd,
    gsdCutoffMm: Number.isFinite(gsdCutoffMm) ? gsdCutoffMm : 0,
    usablePct: (usablePixels / totalPixels) * 100,
    unprojectablePct: ((totalPixels - projectablePixels) / totalPixels) * 100,
    usableAreaM2,
    horizonSv,
    horizonVisible,
    usableBounds: Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null,
    displayBounds: Number.isFinite(dispMinX)
      ? { minX: dispMinX, maxX: dispMaxX, minZ: dispMinZ, maxZ: dispMaxZ }
      : null,
  };
}

// --- Procedural road pavement sampler (RGB) for sharp projective preview & IPM ortho ---

function sampleRoadRGB(x, z, roadWidth, showGrid = true) {
  const halfRoad = roadWidth / 2;
  const ax = Math.abs(x);

  // Outside paved road: dark gravel shoulder / verge
  if (ax > halfRoad) {
    const g = (((Math.floor(x * 6) * 73856093) ^ (Math.floor(z * 6) * 19349663)) & 15) - 7;
    return [24 + g, 34 + g, 47 + g];
  }

  // White shoulder edge lines (0.14 m wide)
  if (ax >= halfRoad - 0.24 && ax <= halfRoad - 0.1) {
    return [230, 236, 244];
  }

  // Yellow center road marking: continuous left (-0.15..-0.04) + dashed right (0.04..0.15)
  if (x >= -0.15 && x <= -0.04) {
    return [250, 204, 21];
  }
  if (x >= 0.04 && x <= 0.15) {
    const zMod = ((z % 4.5) + 4.5) % 4.5;
    if (zMod < 2.4) return [250, 204, 21];
  }

  // Asphalt base + subtle wheel tracks + deterministic aggregate texture
  const lanePos = Math.abs(ax - halfRoad * 0.5);
  const trackDark = lanePos < 0.45 ? -7 : 0;
  const h = (((Math.floor(x * 18) * 73856093) ^ (Math.floor(z * 18) * 19349663)) >>> 0) & 31;
  const grain = (h - 15) * 0.7;

  // Subtle 1m metric reference lines & small pavement distress targets (cracks/patches)
  // so projective stretching & resolution degradation are immediately legible
  let r = 52 + trackDark + grain;
  let g = 57 + trackDark + grain;
  let b = 65 + trackDark + grain;

  if (showGrid) {
    const gx = Math.abs(x - Math.round(x));
    const gz = Math.abs(z - Math.round(z));
    if (gx < 0.018 || gz < 0.018) {
      r += 16;
      g += 20;
      b += 26;
    }
  }

  // Synthetic transverse pavement crack every 5 m so sharpness loss near horizon is obvious
  const crackMod = ((z % 5.0) + 5.0) % 5.0;
  const crackWave = 0.08 * Math.sin(x * 4.5);
  if (Math.abs(crackMod - 2.5 - crackWave) < 0.025 && ax < halfRoad - 0.4) {
    r = 22;
    g = 24;
    b = 28;
  }

  return [
    Math.max(0, Math.min(255, r | 0)),
    Math.max(0, Math.min(255, g | 0)),
    Math.max(0, Math.min(255, b | 0)),
  ];
}

// Continuous perceptually-uniform Viridis colormap:
// t = 1.0 -> bright yellow (#fde725, best resolution / smallest GSD)
// t = 0.0 -> deep purple  (#440154, coarsest resolution / largest GSD)
const VIRIDIS_STOPS = [
  [0.0,  [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5,  [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.0,  [253, 231, 37]],
];

export function sampleViridis(t) {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < VIRIDIS_STOPS.length - 1; i++) {
    const [t0, c0] = VIRIDIS_STOPS[i];
    const [t1, c1] = VIRIDIS_STOPS[i + 1];
    if (clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return VIRIDIS_STOPS[VIRIDIS_STOPS.length - 1][1];
}

function viridisForGsdRatio(ratio, maxScale = 6.0) {
  const r = Math.max(1, ratio);
  const u = Math.min(1, Math.log(r) / Math.log(Math.max(2, maxScale)));
  return sampleViridis(1 - u);
}

export class OrthoSimulator {
  constructor(canvasLeft, canvasRight) {
    this.canvasLeft = canvasLeft;
    this.canvasRight = canvasRight;
    this._last = null;
  }

  render(sim, options = {}) {
    const cam = options.cameraSide === "right" ? sim.right : sim.left;
    const params = sim.params;
    const tab = options.tab || "preview";
    const gsdRatioLimit = options.gsdRatioLimit || 3.5;
    const maxScale = Math.max(gsdRatioLimit * 1.6, 5.5);
    const labels = options.labels || {};

    const analysis = analyzeOrthoUsability(cam, params, gsdRatioLimit);
    this._last = { cam, params, analysis, maxScale, orthoMap: null };

    if (tab === "bands") {
      this._renderCameraImage(this.canvasLeft, cam, params, analysis, true, maxScale, labels);
      this._renderOrtho(this.canvasRight, cam, params, analysis, true, maxScale, labels);
    } else {
      this._renderCameraImage(this.canvasLeft, cam, params, analysis, false, maxScale, labels);
      this._renderOrtho(this.canvasRight, cam, params, analysis, false, maxScale, labels);
    }

    return { ...analysis, maxScale };
  }

  /**
   * Samples exact resolution / ground info at client pointer coordinates on either canvas.
   */
  sampleAtPointer(which, clientX, clientY) {
    if (!this._last) return null;
    const canvas = which === "right" ? this.canvasRight : this.canvasLeft;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) return null;

    const { cam, params, analysis, orthoMap } = this._last;
    const minGsd = Math.max(analysis.minGsdMm, 1e-4);

    if (which === "left") {
      const su = -1 + (px / canvas.width) * 2;
      const sv = 1 - (py / canvas.height) * 2;
      const g = computePixelGsd(cam, params, su, sv);
      if (!g) return { status: "sky" };
      return {
        status: g.horizDist > MAX_ORTHO_RANGE ? "far" : "ok",
        gsdMaxMm: g.gsdMaxMm,
        gsdAcrossMm: g.gsdAcrossMm,
        gsdAlongMm: g.gsdAlongMm,
        ratio: g.gsdMaxMm / minGsd,
        x: g.x,
        z: g.z,
        horizDist: g.horizDist,
      };
    }

    if (!orthoMap) return null;
    const x = orthoMap.fromPx(px);
    const z = orthoMap.fromPy(py);
    const proj = projectGroundToImage(cam, params, x, z);
    if (!proj || Math.abs(proj.su) > 1 || Math.abs(proj.sv) > 1) {
      return { status: "outside" };
    }
    const g = computePixelGsd(cam, params, proj.su, proj.sv);
    if (!g || g.horizDist > MAX_ORTHO_RANGE) return { status: "outside" };
    return {
      status: "ok",
      gsdMaxMm: g.gsdMaxMm,
      gsdAcrossMm: g.gsdAcrossMm,
      gsdAlongMm: g.gsdAlongMm,
      ratio: g.gsdMaxMm / minGsd,
      x: g.x,
      z: g.z,
      horizDist: g.horizDist,
    };
  }

  _renderCameraImage(canvas, cam, params, analysis, bandMode, maxScale, labels) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const minGsd = Math.max(analysis.minGsdMm, 1e-4);
    const cutoff = analysis.gsdCutoffMm;

    for (let py = 0; py < h; py++) {
      const sv = 1 - ((py + 0.5) / h) * 2;
      for (let px = 0; px < w; px++) {
        const su = -1 + ((px + 0.5) / w) * 2;
        const idx = (py * w + px) * 4;
        const g = computePixelGsd(cam, params, su, sv);

        if (!g) {
          // Above vanishing line (sky / infinity - non-projectable)
          const t = py / h;
          data[idx] = Math.round(14 + 18 * t);
          data[idx + 1] = Math.round(24 + 28 * t);
          data[idx + 2] = Math.round(44 + 38 * t);
          data[idx + 3] = 255;
          continue;
        }

        const [rr, gg, bb] = sampleRoadRGB(g.x, g.z, params.roadWidth, true);

        if (bandMode) {
          const vc = viridisForGsdRatio(g.gsdMaxMm / minGsd, maxScale);
          const alpha = g.horizDist > MAX_ORTHO_RANGE ? 0.45 : 0.76;
          data[idx] = Math.round(rr * (1 - alpha) + vc[0] * alpha);
          data[idx + 1] = Math.round(gg * (1 - alpha) + vc[1] * alpha);
          data[idx + 2] = Math.round(bb * (1 - alpha) + vc[2] * alpha);
          data[idx + 3] = 255;
        } else {
          // Dim pixels beyond usable GSD threshold or max projective range
          const unusable = g.gsdMaxMm > cutoff || g.horizDist > MAX_ORTHO_RANGE;
          if (unusable) {
            const stripe = ((px + py) & 7) < 2 ? 1.15 : 0.55;
            data[idx] = Math.min(255, Math.round(rr * 0.45 * stripe + 55));
            data[idx + 1] = Math.round(gg * 0.35);
            data[idx + 2] = Math.round(bb * 0.38);
          } else {
            data[idx] = rr;
            data[idx + 1] = gg;
            data[idx + 2] = bb;
          }
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Overlay horizon / vanishing line if visible in frame
    const svLeft = horizonSvAt(cam, params, -1);
    const svRight = horizonSvAt(cam, params, 1);
    if (
      svLeft !== null &&
      svRight !== null &&
      ((svLeft >= -1.2 && svLeft <= 1.2) || (svRight >= -1.2 && svRight <= 1.2))
    ) {
      const yL = ((1 - svLeft) / 2) * h;
      const yR = ((1 - svRight) / 2) * h;
      ctx.save();
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, yL);
      ctx.lineTo(w, yR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      const ly = Math.max(16, Math.min(h - 14, (yL + yR) / 2 - 8));
      const tag = labels.vanishingLine || "Linha de fuga (∞)";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      const tw = ctx.measureText(tag).width + 12;
      ctx.fillRect(8, ly - 12, tw, 18);
      ctx.fillStyle = "#fda4af";
      ctx.fillText(tag, 14, ly + 1);
      ctx.restore();
    }

    // Center optical axis crosshair
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, h / 2);
    ctx.lineTo(w / 2 + 8, h / 2);
    ctx.moveTo(w / 2, h / 2 - 8);
    ctx.lineTo(w / 2, h / 2 + 8);
    ctx.stroke();
    ctx.restore();
  }

  _renderOrtho(canvas, cam, params, analysis, bandMode, maxScale, labels) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, w, h);

    const bounds = analysis.displayBounds;
    if (!bounds) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels.noGround || "Sem projeção no solo", w / 2, h / 2);
      return;
    }

    const padX = 34;
    const padY = 22;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    const spanX = Math.max(bounds.maxX - bounds.minX, 1.0);
    const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1.0);
    // Preserve 1:1 metric aspect ratio in the orthophoto!
    const scale = Math.min(plotW / spanX, plotH / spanZ);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;

    // Ground (x, z) -> canvas (px, py), with -Z (forward / far) at top, +Z (near) at bottom
    const toPx = (x) => w / 2 + (x - cx) * scale;
    const toPy = (z) => h / 2 + (z - cz) * scale;
    const fromPx = (px) => cx + (px - w / 2) / scale;
    const fromPy = (py) => cz + (py - h / 2) / scale;
    if (this._last) this._last.orthoMap = { toPx, toPy, fromPx, fromPy };

    const img = ctx.createImageData(w, h);
    const data = img.data;
    const minGsd = Math.max(analysis.minGsdMm, 1e-4);
    const cutoff = analysis.gsdCutoffMm;

    for (let py = 0; py < h; py++) {
      const z = fromPy(py);
      for (let px = 0; px < w; px++) {
        const x = fromPx(px);
        const idx = (py * w + px) * 4;

        const proj = projectGroundToImage(cam, params, x, z);
        if (!proj || Math.abs(proj.su) > 1 || Math.abs(proj.sv) > 1) {
          // Outside camera frustum: dark blueprint background
          data[idx] = 11;
          data[idx + 1] = 18;
          data[idx + 2] = 32;
          data[idx + 3] = 255;
          continue;
        }

        const g = computePixelGsd(cam, params, proj.su, proj.sv);
        if (!g || g.horizDist > MAX_ORTHO_RANGE) {
          data[idx] = 11;
          data[idx + 1] = 18;
          data[idx + 2] = 32;
          data[idx + 3] = 255;
          continue;
        }

        // Simulate realistic IPM pixelation: quantize (su, sv) to a coarse sensor grid
        // so far pixels visually stretch when projected onto the orthophoto!
        const qCols = Math.min(params.resX, 320);
        const qRows = Math.min(params.resY, 240);
        const qSu = (Math.floor(((proj.su + 1) * 0.5) * qCols) + 0.5) / qCols * 2 - 1;
        const qSv = (Math.floor(((proj.sv + 1) * 0.5) * qRows) + 0.5) / qRows * 2 - 1;
        const qGround = projectImageToGround(cam, params, qSu, qSv) || g;
        const [rr, gg, bb] = sampleRoadRGB(qGround.x, qGround.z, params.roadWidth, true);

        const ratio = g.gsdMaxMm / minGsd;
        if (bandMode) {
          const vc = viridisForGsdRatio(ratio, maxScale);
          const alpha = 0.78;
          data[idx] = Math.round(rr * (1 - alpha) + vc[0] * alpha);
          data[idx + 1] = Math.round(gg * (1 - alpha) + vc[1] * alpha);
          data[idx + 2] = Math.round(bb * (1 - alpha) + vc[2] * alpha);
          data[idx + 3] = 255;
        } else {
          const unusable = g.gsdMaxMm > cutoff;
          if (unusable) {
            const stripe = ((px + py) & 7) < 2 ? 1.15 : 0.6;
            data[idx] = Math.min(255, Math.round(rr * 0.48 * stripe + 50));
            data[idx + 1] = Math.round(gg * 0.36);
            data[idx + 2] = Math.round(bb * 0.4);
          } else {
            data[idx] = rr;
            data[idx + 1] = gg;
            data[idx + 2] = bb;
          }
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Draw metric scale bar in bottom-left
    const niceMeters = scale * 1 >= 42 ? 1 : scale * 2 >= 42 ? 2 : 5;
    const barPx = niceMeters * scale;
    ctx.save();
    ctx.fillStyle = "rgba(11, 18, 32, 0.8)";
    ctx.fillRect(10, h - 28, Math.max(barPx + 18, 66), 20);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, h - 14);
    ctx.lineTo(16 + barPx, h - 14);
    ctx.moveTo(16, h - 18);
    ctx.lineTo(16, h - 10);
    ctx.moveTo(16 + barPx, h - 18);
    ctx.lineTo(16 + barPx, h - 10);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 10.5px ui-monospace, monospace";
    ctx.fillText(`${niceMeters} m`, 20 + barPx, h - 11);

    // Direction arrows: Near (bottom) vs Far (top)
    ctx.fillStyle = "rgba(11, 18, 32, 0.78)";
    const nearTag = labels.nearLabel || "Base (maior res.)";
    const farTag = labels.farLabel || "Topo (menor res.)";
    ctx.font = "600 10.5px Inter, system-ui, sans-serif";
    const wFar = ctx.measureText(farTag).width + 10;
    const wNear = ctx.measureText(nearTag).width + 10;
    ctx.fillRect(w - wFar - 8, 8, wFar, 18);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(farTag, w - wFar - 3, 21);

    ctx.fillStyle = "rgba(11, 18, 32, 0.78)";
    ctx.fillRect(w - wNear - 8, h - 26, wNear, 18);
    ctx.fillStyle = "#fde725";
    ctx.fillText(nearTag, w - wNear - 3, h - 13);

    // Draw camera ground nadir/position dot if within view
    const camPx = toPx(cam.position[0]);
    const camPy = toPy(cam.position[2]);
    if (camPx >= 6 && camPx <= w - 6 && camPy >= 6 && camPy <= h - 6) {
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(camPx, camPy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}
