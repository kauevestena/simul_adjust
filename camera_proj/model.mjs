// Numerical camera model. Matrices are row-major; quaternions are [w,x,y,z].
export const DEG = Math.PI / 180;
export const IDENTITY = [1, 0, 0, 0];
export const FACE_COLORS = [
  "#ee725b",
  "#8c7ff0",
  "#f4be57",
  "#49bda6",
  "#60a6ef",
  "#e783bf",
];
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, s) => a.map((v) => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.hypot(...a);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const transpose = (a) => [
  a[0],
  a[3],
  a[6],
  a[1],
  a[4],
  a[7],
  a[2],
  a[5],
  a[8],
];
export const mv = (a, v) => [
  dot(a.slice(0, 3), v),
  dot(a.slice(3, 6), v),
  dot(a.slice(6, 9), v),
];
export const mm = (a, b) =>
  Array.from({ length: 9 }, (_, i) =>
    dot(a.slice(3 * Math.floor(i / 3), 3 * Math.floor(i / 3) + 3), [
      b[i % 3],
      b[3 + (i % 3)],
      b[6 + (i % 3)],
    ]),
  );
export function unit(v) {
  const n = norm(v);
  if (!Number.isFinite(n) || n < 1e-12) throw Error("zeroVector");
  return scale(v, 1 / n);
}
export function normalizeQuaternion(q) {
  if (q.length !== 4 || !q.every(Number.isFinite))
    throw Error("invalidRotation");
  const n = norm(q);
  if (n < 1e-12) throw Error("invalidRotation");
  return scale(q, (q[0] < 0 ? -1 : 1) / n);
}
export function quaternionMatrix(input) {
  const [w, x, y, z] = normalizeQuaternion(input);
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
}
export function matrixQuaternion(m) {
  if (m.length !== 9 || !m.every(Number.isFinite))
    throw Error("invalidRotation");
  const check = mm(m, transpose(m));
  const det = dot(m.slice(0, 3), cross(m.slice(3, 6), m.slice(6, 9)));
  if (
    Math.max(...check.map((v, i) => Math.abs(v - (i % 4 === 0 ? 1 : 0)))) >
      1e-5 ||
    Math.abs(det - 1) > 1e-5
  )
    throw Error("invalidRotation");
  const tr = m[0] + m[4] + m[8];
  let q;
  if (tr > 0) {
    const s = 2 * Math.sqrt(1 + tr);
    q = [s / 4, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s];
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
    q = [(m[7] - m[5]) / s, s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s];
  } else if (m[4] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
    q = [(m[2] - m[6]) / s, (m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
    q = [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4];
  }
  return normalizeQuaternion(q);
}
// Photogrammetric convention: R_wc = R_kappa R_phi R_omega (passive).
// Equivalently the camera-to-world orientation is Q_cw = Rx(omega) Ry(phi) Rz(kappa).
export function anglesQuaternion(angles) {
  const [a, b, c] = angles.map((v) => (v * DEG) / 2),
    ca = Math.cos(a),
    sa = Math.sin(a),
    cb = Math.cos(b),
    sb = Math.sin(b),
    cc = Math.cos(c),
    sc = Math.sin(c);
  return normalizeQuaternion([
    ca * cb * cc - sa * sb * sc,
    sa * cb * cc + ca * sb * sc,
    ca * sb * cc - sa * cb * sc,
    ca * cb * sc + sa * sb * cc,
  ]);
}
export function quaternionAngles(q) {
  const m = quaternionMatrix(q),
    phi = Math.asin(Math.max(-1, Math.min(1, m[2])));
  const singular = Math.abs(Math.cos(phi)) < 1e-7;
  return {
    angles: [
      singular ? Math.atan2(m[7], m[4]) : Math.atan2(-m[5], m[8]),
      phi,
      singular ? 0 : Math.atan2(-m[1], m[0]),
    ].map((v) => v / DEG),
    singular,
  };
}
export function lookAtQuaternion(center, target, q = IDENTITY) {
  const z = unit(sub(target, center)),
    old = quaternionMatrix(q);
  let y = sub(mv(old, [0, 1, 0]), scale(z, dot(mv(old, [0, 1, 0]), z)));
  if (norm(y) < 1e-8) {
    const guide = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    y = sub(guide, scale(z, dot(guide, z)));
  }
  y = unit(y);
  const x = unit(cross(y, z));
  y = cross(z, x);
  return matrixQuaternion([
    x[0],
    y[0],
    z[0],
    x[1],
    y[1],
    z[1],
    x[2],
    y[2],
    z[2],
  ]);
}
export function defaults() {
  return {
    center: [0, 0, 0],
    q: [...IDENTITY],
    cubeCenter: [0, 0, 5],
    cubeQ: anglesQuaternion([20, 30, 0]),
    side: 1,
    focal: 50,
    sensor: [35, 24],
    offset: [0, 0],
    width: 700,
    plane: "physical",
    sampling: "continuous",
    distortion: "none",
    coefficients: [0, 0, 0, 0, 0],
    grid: false,
    axes: true,
    frustum: true,
  };
}
export function intrinsics(s) {
  const width = s.width,
    height = Math.max(1, Math.round((width * s.sensor[1]) / s.sensor[0]));
  const fx = (s.focal * width) / s.sensor[0],
    fy = (s.focal * height) / s.sensor[1];
  const cx = (width - 1) / 2 + (s.offset[0] * width) / s.sensor[0],
    cy = (height - 1) / 2 + (s.offset[1] * height) / s.sensor[1];
  return {
    width,
    height,
    fx,
    fy,
    cx,
    cy,
    K: [fx, 0, cx, 0, fy, cy, 0, 0, 1],
    pitch: [s.sensor[0] / width, s.sensor[1] / height],
  };
}
export function fieldOfView(s) {
  return s.sensor.map(
    (size, i) =>
      (Math.atan((size / 2 - s.offset[i]) / s.focal) -
        Math.atan((-size / 2 - s.offset[i]) / s.focal)) /
      DEG,
  );
}
export function coefficients(s) {
  const [k1, k2, p1, p2, k3] = s.coefficients;
  return s.distortion === "none"
    ? [0, 0, 0, 0, 0]
    : [
        k1,
        k2,
        s.distortion === "radial" ? 0 : p1,
        s.distortion === "radial" ? 0 : p2,
        s.distortion === "full" ? k3 : 0,
      ];
}
export function distort([x, y], d) {
  const [k1, k2, p1, p2, k3] = d,
    r2 = x * x + y * y,
    radial = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2;
  return [
    x * radial + 2 * p1 * x * y + p2 * (r2 + 2 * x * x),
    y * radial + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y,
  ];
}
export function distortionJacobian([x, y], d) {
  const [k1, k2, p1, p2, k3] = d,
    r2 = x * x + y * y,
    radial = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2,
    g = 2 * (k1 + 2 * k2 * r2 + 3 * k3 * r2 * r2);
  return [
    radial + g * x * x + 2 * p1 * y + 6 * p2 * x,
    g * x * y + 2 * p1 * x + 2 * p2 * y,
    g * x * y + 2 * p1 * x + 2 * p2 * y,
    radial + g * y * y + 6 * p1 * y + 2 * p2 * x,
  ];
}
export function undistort(target, d) {
  let p = [...target];
  for (let i = 0; i < 20; i++) {
    const e = sub(distort(p, d), target),
      j = distortionJacobian(p, d),
      det = j[0] * j[3] - j[1] * j[2];
    if (!Number.isFinite(det) || det <= 1e-10) return null;
    if (norm(e) < 1e-10) return p;
    p = sub(p, [
      (j[3] * e[0] - j[1] * e[1]) / det,
      (-j[2] * e[0] + j[0] * e[1]) / det,
    ]);
    if (norm(p) > 1e4) return null;
  }
  return norm(sub(distort(p, d), target)) < 1e-7 ? p : null;
}
export function worldToCamera(p, s) {
  return mv(transpose(quaternionMatrix(s.q)), sub(p, s.center));
}
export function cameraToWorld(p, s) {
  return add(s.center, mv(quaternionMatrix(s.q), p));
}
export function cubeToWorld(p, s) {
  return add(s.cubeCenter, mv(quaternionMatrix(s.cubeQ), scale(p, s.side)));
}
// Slab intersection; t is relative to the input direction (which need not be unit length).
export function hitCube(origin, direction, s) {
  const inv = transpose(quaternionMatrix(s.cubeQ)),
    o = mv(inv, sub(origin, s.cubeCenter)),
    d = mv(inv, direction),
    h = s.side / 2;
  let near = -Infinity,
    far = Infinity,
    nearFace = -1,
    farFace = -1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) {
      if (Math.abs(o[a]) > h) return null;
      continue;
    }
    let t1 = (-h - o[a]) / d[a],
      t2 = (h - o[a]) / d[a],
      f1 = 2 * a + 1,
      f2 = 2 * a;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      [f1, f2] = [f2, f1];
    }
    if (t1 > near) {
      near = t1;
      nearFace = f1;
    }
    if (t2 < far) {
      far = t2;
      farFace = f2;
    }
    if (near > far) return null;
  }
  const t = near > 1e-8 ? near : far,
    face = near > 1e-8 ? nearFace : farFace;
  if (t <= 1e-8 || !Number.isFinite(t)) return null;
  return {
    t,
    face,
    point: add(origin, scale(direction, t)),
    local: scale(add(o, scale(d, t)), 1 / s.side),
  };
}
export function project(p, s) {
  const pc = worldToCamera(p, s),
    k = intrinsics(s);
  if (pc[2] <= 1e-9) return { world: p, camera: pc, status: "behind" };
  const normalized = [pc[0] / pc[2], pc[1] / pc[2]],
    distorted = distort(normalized, coefficients(s));
  const cv = [k.fx * distorted[0] + k.cx, k.fy * distorted[1] + k.cy];
  const sign = s.plane === "physical" ? -1 : 1;
  const uv = sign === 1 ? cv : [k.width - 1 - cv[0], k.height - 1 - cv[1]];
  const inside =
    cv[0] >= -0.5 &&
    cv[0] < k.width - 0.5 &&
    cv[1] >= -0.5 &&
    cv[1] < k.height - 0.5;
  const hit = hitCube(s.center, sub(p, s.center), s),
    occluded = !!hit && hit.t < 1 - 1e-6;
  return {
    world: p,
    camera: pc,
    normalized,
    distorted,
    cv,
    uv,
    inside,
    occluded,
    pixel: uv.map((v) => Math.floor(v + 0.5)),
    mm: distorted.map((v) => sign * s.focal * v),
    ideal: cameraToWorld(
      [
        (sign * s.focal * normalized[0]) / 1000,
        (sign * s.focal * normalized[1]) / 1000,
        (sign * s.focal) / 1000,
      ],
      s,
    ),
    image: cameraToWorld(
      [
        (sign * s.focal * distorted[0]) / 1000,
        (sign * s.focal * distorted[1]) / 1000,
        (sign * s.focal) / 1000,
      ],
      s,
    ),
    status: !inside ? "outside" : occluded ? "occluded" : "visible",
  };
}
export function imageRay(uv, s) {
  const k = intrinsics(s),
    p =
      s.plane === "physical" ? [k.width - 1 - uv[0], k.height - 1 - uv[1]] : uv;
  const xy = undistort(
    [(p[0] - k.cx) / k.fx, (p[1] - k.cy) / k.fy],
    coefficients(s),
  );
  return xy ? mv(quaternionMatrix(s.q), [...xy, 1]) : null;
}
export function parseNumber(value) {
  const t = String(value).trim().replace(",", ".");
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t) ||
    !Number.isFinite(Number(t))
  )
    throw Error("invalidNumber");
  return Number(t);
}
