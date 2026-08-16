// Planar geometry helpers, in world metres.
//
// Points are plain `{e, n}` objects (East, North) or `[e, n]` pairs where a
// polygon ring is involved. Nothing here knows about the screen.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) ** 2 + (by - ay) ** 2;

/** Round to millimetre, killing float drift before area computations. */
export const snapMm = (v) => Math.round(v * 1000) / 1000;

/**
 * Closest point on segment AB to P, plus the parameter t in [0, 1].
 * @returns {{e:number, n:number, t:number, d:number}}
 */
export function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  const e = ax + dx * t;
  const n = ay + dy * t;
  return { e, n, t, d: Math.hypot(px - e, py - n) };
}

/**
 * Does segment AB come within `r` of circle centre C?
 * Used for line-of-sight against trees, rocks and posts.
 * `skipEnds` excludes hits within that distance of either endpoint, so you can
 * sight past the tree you are standing next to, and a target never blocks itself.
 */
export function segmentHitsCircle(ax, ay, bx, by, cx, cy, r, skipEnds = 0) {
  const c = closestOnSegment(cx, cy, ax, ay, bx, by);
  if (c.d > r) return null;
  if (skipEnds > 0) {
    if (Math.hypot(c.e - ax, c.n - ay) < skipEnds) return null;
    if (Math.hypot(c.e - bx, c.n - by) < skipEnds) return null;
  }
  return { e: c.e, n: c.n, t: c.t };
}

/** Proper segment-segment intersection point, or null. */
export function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1 = bx - ax;
  const r2 = by - ay;
  const s1 = dx - cx;
  const s2 = dy - cy;
  const den = r1 * s2 - r2 * s1;
  if (Math.abs(den) < 1e-12) return null; // parallel or collinear
  const t = ((cx - ax) * s2 - (cy - ay) * s1) / den;
  const u = ((cx - ax) * r2 - (cy - ay) * r1) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { e: ax + r1 * t, n: ay + r2 * t, t };
}

/**
 * Ray-casting point-in-polygon.
 * @param {number} px @param {number} py
 * @param {Array<[number, number]>} ring
 */
export function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Signed area of a ring by the shoelace formula, in square metres.
 * Positive = counter-clockwise. The survey layer re-exports the absolute value
 * as the parcel area; the sign is what tells a traverse which way it was walked.
 * @param {Array<[number, number]>} ring
 */
export function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}

/** Area-weighted centroid of a ring. */
export function centroid(ring) {
  let a = 0;
  let e = 0;
  let n = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += cross;
    e += (ring[j][0] + ring[i][0]) * cross;
    n += (ring[j][1] + ring[i][1]) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-12) {
    // Degenerate ring: fall back to the vertex mean.
    return {
      e: ring.reduce((s, p) => s + p[0], 0) / ring.length,
      n: ring.reduce((s, p) => s + p[1], 0) / ring.length,
    };
  }
  return { e: e / (6 * a), n: n / (6 * a) };
}

/** Axis-aligned bounding box of a ring. */
export function bbox(ring) {
  let minE = Infinity;
  let minN = Infinity;
  let maxE = -Infinity;
  let maxN = -Infinity;
  for (const [e, n] of ring) {
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  }
  return { minE, minN, maxE, maxN, w: maxE - minE, h: maxN - minN };
}

/** Perimeter of a closed ring, in metres. */
export function ringPerimeter(ring) {
  let p = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    p += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
  }
  return p;
}

/** Does a closed ring intersect itself? Guards the parcel generator. */
export function isSelfIntersecting(ring) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent segments: they legitimately share a vertex.
      if (j === i || (j + 1) % n === i || j === (i + 1) % n) continue;
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentIntersection(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) return true;
    }
  }
  return false;
}

/**
 * Clip a convex-ish polygon by the half-plane on the inner side of a line.
 * Sutherland-Hodgman; the workhorse of the weighted-Voronoi parcel generator.
 * The half-plane keeps points where `nx*e + ny*n <= c`.
 */
export function clipHalfPlane(ring, nx, ny, c) {
  const out = [];
  const side = (p) => nx * p[0] + ny * p[1] - c;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cur = ring[i];
    const prev = ring[j];
    const sCur = side(cur);
    const sPrev = side(prev);
    if (sCur <= 0) {
      if (sPrev > 0) {
        const t = sPrev / (sPrev - sCur);
        out.push([lerp(prev[0], cur[0], t), lerp(prev[1], cur[1], t)]);
      }
      out.push([cur[0], cur[1]]);
    } else if (sPrev <= 0) {
      const t = sPrev / (sPrev - sCur);
      out.push([lerp(prev[0], cur[0], t), lerp(prev[1], cur[1], t)]);
    }
  }
  return out;
}

/**
 * Convex hull by Andrew's monotone chain, returned counter-clockwise.
 * The parcel block is built as a hull so that half-plane clipping is exact:
 * Sutherland-Hodgman is only well behaved on convex input.
 * @param {Array<[number, number]>} pts
 */
export function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;

  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Drop consecutive vertices closer together than `tol` metres. */
export function dedupeRing(ring, tol = 1e-6) {
  const out = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > tol) out.push(p);
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= tol) out.pop();
    else break;
  }
  return out;
}

/** Outward unit normal of the segment A->B for a counter-clockwise ring. */
export function outwardNormal(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { e: dy / len, n: -dx / len };
}
