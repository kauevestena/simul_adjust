// Dual frame-camera pavement mapping geometry & overlap model
// Coordinate system (right-handed, Three.js Y-up):
//   X: across-track (right = +X, left = -X)
//   Y: height above pavement (ground plane at Y = 0)
//   Z: along-track (forward driving direction = -Z, rear = +Z)

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const SENSOR_PRESETS = {
  "1_18": { sensorWidth: 7.2, sensorHeight: 5.4, resX: 2048, resY: 1536 },
  "2_3": { sensorWidth: 8.8, sensorHeight: 6.6, resX: 2448, resY: 2048 },
  "1_inch": { sensorWidth: 13.2, sensorHeight: 8.8, resX: 4096, resY: 2732 },
  "apsc": { sensorWidth: 23.5, sensorHeight: 15.6, resX: 6000, resY: 4000 },
  "fullframe": { sensorWidth: 36.0, sensorHeight: 24.0, resX: 6000, resY: 4000 },
};

export const DEFAULTS = {
  mountMode: "front",  // "front" (front-facing) | "nadir" (downward)
  height: 1.5,         // meters above pavement
  baseline: 0.9,       // meters between camera optical centers
  focal: 8.0,          // mm
  sensorWidth: 13.2,   // mm (1" industrial camera)
  sensorHeight: 8.8,   // mm
  resX: 4096,          // px
  resY: 2732,          // px
  convergenceDeg: 0.0, // degrees: 0 = parallel, >0 = crossing (toe-in), <0 = divergent
  pitchDeg: 25.0,      // front: downward depression (0..75); nadir: longitudinal tilt (-35..35)
  roadWidth: 7.0,      // meters (2 lanes of 3.5 m)
  targetOverlap: 20,   // % reference line on height chart
};

export const LIMITS = {
  height: [0.5, 5.0],
  baseline: [0.1, 2.5],
  focal: [2.8, 50.0],
  sensorWidth: [3.0, 44.0],
  sensorHeight: [2.0, 33.0],
  resX: [640, 12000],
  resY: [480, 9000],
  convergenceDeg: [-20, 45],
  pitchDeg: [-35, 75],
  roadWidth: [2.5, 16.0],
};

const MAX_GROUND_DIST = 26.0;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeParams(raw = {}) {
  const p = { ...DEFAULTS, ...raw };
  p.mountMode = p.mountMode === "front" ? "front" : "nadir";
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = Number(p[key]);
    p[key] = Number.isFinite(n) ? clamp(n, min, max) : DEFAULTS[key];
  }
  if (p.mountMode === "nadir") {
    p.pitchDeg = clamp(p.pitchDeg, -35, 35);
  } else {
    p.pitchDeg = clamp(p.pitchDeg, 0, 75);
  }
  p.targetOverlap = clamp(Number(p.targetOverlap) || DEFAULTS.targetOverlap, 5, 95);
  return p;
}

function rotateX(v, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * Computes basis vectors (u: right, v: along-track forward, d: optical axis)
 * for side = -1 (left camera) or +1 (right camera).
 */
export function cameraFrame(params, side) {
  const alpha = params.convergenceDeg * DEG;
  const pitch = params.pitchDeg * DEG;
  // Side -1 (left) tilts optical axis toward +X for positive alpha.
  // Side +1 (right) tilts optical axis toward -X for positive alpha.
  const sign = -side; // +1 for left, -1 for right
  const sa = Math.sin(alpha) * sign;
  const ca = Math.cos(alpha);

  let d, u, v;
  if (params.mountMode === "front") {
    // Front-facing: base optical axis looks forward (-Z), yawed inward by alpha around Y,
    // then pitched downward toward the pavement by depression angle pitchDeg (R_x(-pitch)).
    const d0 = [sa, 0, -ca];
    const u0 = [ca, 0, sa];
    const v0 = [0, 1, 0];
    d = normalize3(rotateX(d0, -pitch));
    u = normalize3(rotateX(u0, -pitch));
    v = normalize3(rotateX(v0, -pitch));
  } else {
    // Nadir: base optical axis looks straight down (-Y), rolled inward by alpha around Z,
    // then pitched longitudinally by pitchDeg around X.
    const d0 = [sa, -ca, 0];
    const u0 = [ca, sa, 0];
    const v0 = [0, 0, -1];
    d = normalize3(rotateX(d0, pitch));
    u = normalize3(rotateX(u0, pitch));
    v = normalize3(rotateX(v0, pitch));
  }

  const position = [(side * params.baseline) / 2, params.height, 0];
  return { position, u, v, d };
}

/**
 * Intersects a ray C + t*dir with the ground plane Y = 0.
 * If the ray points at/above the horizon or exceeds MAX_GROUND_DIST,
 * clips cleanly along the horizontal azimuth at MAX_GROUND_DIST.
 */
export function intersectGround(origin, dir) {
  const minDown = -origin[1] / MAX_GROUND_DIST;
  if (dir[1] < minDown) {
    const t = -origin[1] / dir[1];
    const p = add3(origin, scale3(dir, t));
    return { point: [p[0], 0, p[2]], t, clipped: false };
  }
  const hLen = Math.hypot(dir[0], dir[2]) || 1;
  const gx = origin[0] + (dir[0] / hLen) * MAX_GROUND_DIST;
  const gz = origin[2] + (dir[2] / hLen) * MAX_GROUND_DIST;
  return {
    point: [gx, 0, gz],
    t: Math.hypot(gx - origin[0], origin[1], gz - origin[2]),
    clipped: true,
  };
}

/**
 * Computes frustum geometry and ground footprint for one camera.
 */
export function computeCameraFrustum(params, side) {
  const frame = cameraFrame(params, side);
  const halfTanH = params.sensorWidth / (2 * params.focal);
  const halfTanV = params.sensorHeight / (2 * params.focal);

  // Order corners so the ground projection (X, Z) is consistently ordered
  // Top-left (-u, +v), Top-right (+u, +v), Bottom-right (+u, -v), Bottom-left (-u, -v)
  const cornerSigns = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];

  let horizonClipped = false;
  const groundCorners = [];
  const nearCorners = [];
  const nearDist = 0.14;

  for (const [su, sv] of cornerSigns) {
    const ray = normalize3([
      frame.d[0] + su * halfTanH * frame.u[0] + sv * halfTanV * frame.v[0],
      frame.d[1] + su * halfTanH * frame.u[1] + sv * halfTanV * frame.v[1],
      frame.d[2] + su * halfTanH * frame.u[2] + sv * halfTanV * frame.v[2],
    ]);
    const hit = intersectGround(frame.position, ray);
    if (hit.clipped) horizonClipped = true;
    groundCorners.push(hit.point);
    nearCorners.push(add3(frame.position, scale3(ray, nearDist)));
  }

  const axisHit = intersectGround(frame.position, frame.d);
  const footprint2D = ensureCCW(groundCorners.map(([x, , z]) => [x, z]));
  const area = polygonArea(footprint2D);

  // GSD at optical axis ground hit (mm / px)
  const pixelPitchMm = params.sensorWidth / params.resX;
  const gsdMm = (axisHit.t * pixelPitchMm / params.focal) * 1000;

  return {
    side,
    ...frame,
    nearCorners,
    groundCorners,
    axisGround: axisHit.point,
    axisDistance: axisHit.t,
    horizonClipped: horizonClipped || axisHit.clipped,
    footprint2D,
    area,
    gsdMm,
    hfovDeg: 2 * Math.atan(halfTanH) * RAD,
    vfovDeg: 2 * Math.atan(halfTanV) * RAD,
  };
}

// --- 2D Polygon geometry (Sutherland-Hodgman intersection) ---

export function signedArea(poly) {
  if (!poly || poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return 0.5 * s;
}

export function polygonArea(poly) {
  return Math.abs(signedArea(poly));
}

export function ensureCCW(poly) {
  if (signedArea(poly) < 0) return [...poly].reverse();
  return [...poly];
}

function cross2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentLineIntersect(s, e, cp1, cp2) {
  const dcx = cp1[0] - cp2[0];
  const dcy = cp1[1] - cp2[1];
  const dpx = s[0] - e[0];
  const dpy = s[1] - e[1];
  const denom = dcx * dpy - dcy * dpx;
  if (Math.abs(denom) < 1e-12) return [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2];
  const n1 = cp1[0] * cp2[1] - cp1[1] * cp2[0];
  const n2 = s[0] * e[1] - s[1] * e[0];
  return [
    (n1 * dpx - n2 * dcx) / denom,
    (n1 * dpy - n2 * dcy) / denom,
  ];
}

/**
 * Exact intersection of two convex 2D polygons (both assumed CCW).
 */
export function intersectConvexPolygons(subjectPoly, clipPoly) {
  let output = ensureCCW(subjectPoly);
  const clip = ensureCCW(clipPoly);
  if (output.length < 3 || clip.length < 3) return [];

  for (let i = 0; i < clip.length; i++) {
    const cp1 = clip[i];
    const cp2 = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) break;

    let s = input[input.length - 1];
    for (const e of input) {
      const eInside = cross2(cp1, cp2, e) >= -1e-9;
      const sInside = cross2(cp1, cp2, s) >= -1e-9;
      if (eInside) {
        if (!sInside) output.push(segmentLineIntersect(s, e, cp1, cp2));
        output.push(e);
      } else if (sInside) {
        output.push(segmentLineIntersect(s, e, cp1, cp2));
      }
      s = e;
    }
  }
  return output.length >= 3 ? output : [];
}

function xBounds(poly) {
  if (!poly || poly.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, width: maxX - minX, minZ, maxZ, depth: maxZ - minZ };
}

/**
 * Exact crossing angle (degrees) where the two optical axes intersect on the ground plane Y = 0.
 */
export function groundCrossingAngleDeg(params) {
  const pitch = params.pitchDeg * DEG;
  if (params.height <= 0) return 0;
  if (params.mountMode === "front") {
    const sinPitch = Math.sin(pitch);
    if (sinPitch <= 1e-6) return 0;
    return clamp(Math.atan((params.baseline * sinPitch) / (2 * params.height)) * RAD, 0, 45);
  }
  const cosPitch = Math.cos(pitch);
  if (cosPitch <= 1e-6) return 0;
  return clamp(Math.atan((params.baseline * cosPitch) / (2 * params.height)) * RAD, 0, 45);
}

/**
 * Computes full dual-camera simulation state.
 */
export function simulate(rawParams) {
  const params = normalizeParams(rawParams);
  const left = computeCameraFrustum(params, -1);
  const right = computeCameraFrustum(params, 1);

  const overlapPoly2D = intersectConvexPolygons(left.footprint2D, right.footprint2D);
  const overlapArea = polygonArea(overlapPoly2D);
  const singleArea = Math.min(left.area, right.area);
  const overlapAreaPct = singleArea > 1e-9 ? (overlapArea / singleArea) * 100 : 0;

  const leftBounds = xBounds(left.footprint2D);
  const rightBounds = xBounds(right.footprint2D);
  const overlapBounds = xBounds(overlapPoly2D);

  const singleWidth = Math.min(leftBounds.width, rightBounds.width);
  const overlapWidth = overlapBounds ? overlapBounds.width : 0;
  const overlapLateralPct = singleWidth > 1e-9 ? (overlapWidth / singleWidth) * 100 : 0;

  const swathMinX = Math.min(leftBounds.minX, rightBounds.minX);
  const swathMaxX = Math.max(leftBounds.maxX, rightBounds.maxX);
  const totalSwathWidth = swathMaxX - swathMinX;
  const alongTrackDepth = Math.max(leftBounds.depth, rightBounds.depth);

  // Gap width when there is no overlap
  let gapWidth = 0;
  if (!overlapBounds) {
    gapWidth = Math.max(0, rightBounds.minX - leftBounds.maxX, leftBounds.minX - rightBounds.maxX);
  }

  // Optical axes crossing point (valid when convergenceDeg != 0)
  const alpha = params.convergenceDeg * DEG;
  const pitch = params.pitchDeg * DEG;
  let crossing = null;
  if (Math.abs(params.convergenceDeg) > 0.05) {
    const tCross = params.baseline / (2 * Math.sin(alpha));
    const halfCot = params.baseline / (2 * Math.tan(alpha));
    let drop, zShift;
    if (params.mountMode === "front") {
      drop = halfCot * Math.sin(pitch);
      zShift = -halfCot * Math.cos(pitch);
    } else {
      drop = halfCot * Math.cos(pitch);
      zShift = -halfCot * Math.sin(pitch);
    }
    const yCross = params.height - drop;
    crossing = {
      convergent: params.convergenceDeg > 0,
      point: [0, yCross, zShift],
      heightAboveGround: yCross,
      distanceFromCameras: Math.abs(tCross),
      location:
        params.convergenceDeg < 0
          ? "divergent"
          : Math.abs(yCross) < 0.04
            ? "ground"
            : yCross > 0
              ? "above"
              : "below",
    };
  }

  const optimalGroundAngleDeg = groundCrossingAngleDeg(params);
  const bhRatio = params.baseline / params.height;
  const coversRoad = totalSwathWidth >= params.roadWidth && gapWidth === 0;

  return {
    params,
    left,
    right,
    overlapPoly2D,
    overlapArea,
    overlapAreaPct,
    overlapWidth,
    overlapLateralPct,
    gapWidth,
    singleWidth,
    totalSwathWidth,
    alongTrackDepth,
    swathMinX,
    swathMaxX,
    gsdMm: (left.gsdMm + right.gsdMm) / 2,
    hfovDeg: left.hfovDeg,
    vfovDeg: left.vfovDeg,
    bhRatio,
    crossing,
    optimalGroundAngleDeg,
    coversRoad,
    horizonClipped: left.horizonClipped || right.horizonClipped,
  };
}

/**
 * Generates Height vs. Overlap comparison curve from hMin to hMax,
 * comparing the current convergence angle against parallel axes (0°).
 */
export function heightComparisonCurve(rawParams, steps = 90) {
  const base = normalizeParams(rawParams);
  const [hMin, hMax] = LIMITS.height;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const h = hMin + ((hMax - hMin) * i) / steps;
    const cur = simulate({ ...base, height: h });
    const par =
      Math.abs(base.convergenceDeg) < 1e-6
        ? cur
        : simulate({ ...base, height: h, convergenceDeg: 0 });
    points.push({
      height: h,
      overlapAreaPct: cur.overlapAreaPct,
      overlapLateralPct: cur.overlapLateralPct,
      overlapWidth: cur.overlapWidth,
      totalSwathWidth: cur.totalSwathWidth,
      gsdMm: cur.gsdMm,
      parallelOverlapPct: par.overlapAreaPct,
      parallelSwathWidth: par.totalSwathWidth,
    });
  }
  return points;
}
