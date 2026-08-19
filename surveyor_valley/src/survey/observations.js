// Grouping raw sights into the field book (caderneta) the student reads.
//
// Nothing here re-derives geometry; it arranges what station.js already
// produced, so the table, the drawing and the memorial cannot drift apart.

import { normalize360 } from './units.js';
import { rumo } from './geometry.js';

/**
 * Group observations by the setup they were taken from, in occupation order.
 * @param {Array} setups
 * @param {Array} observations
 */
export function groupBySetup(setups, observations) {
  return setups.map((setup) => {
    const rows = observations
      .filter((o) => o.setupId === setup.id)
      .map((o) => ({
        ...o,
        rumo: rumo(o.azimuth),
        dE: o.E - setup.E,
        dN: o.N - setup.N,
      }));
    return { setup, rows };
  });
}

/**
 * Angles to the right between consecutive sights from one setup, which is what
 * a student is asked to tabulate. Sorted by circle reading so the sequence
 * matches the order the instrument was actually turned.
 */
export function derivedAngles(rows) {
  const sorted = [...rows].sort((a, b) => a.hz - b.hz);
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push({
      from: sorted[i - 1].label,
      to: sorted[i].label,
      angle: normalize360(sorted[i].hz - sorted[i - 1].hz),
    });
  }
  return out;
}

/** The most recent sight to a given target, across every setup. */
export function latestForTarget(observations, targetId) {
  let best = null;
  for (const o of observations) {
    if (o.targetId !== targetId) continue;
    if (!best || o.at >= best.at) best = o;
  }
  return best;
}

/**
 * Best available coordinate for every target that has been sighted, by taking
 * the mean of all reductions. Crude on purpose: averaging repeated sights is
 * exactly what the course teaches before any rigorous adjustment appears.
 *
 * `adjE/adjN` win when they are there. They are the same observation reduced
 * again from a compensated traverse — see `service.js#reradiate` — and this one
 * line is what carries the compensation out to the corners, the area and the
 * documents. Preferring them HERE rather than at each call site means the
 * reduction cache, the reload path and anything else reading points all inherit
 * it without knowing the adjustment exists.
 */
export function reducedPoints(observations) {
  const acc = new Map();
  for (const o of observations) {
    if (!acc.has(o.targetId)) acc.set(o.targetId, { id: o.targetId, label: o.label, E: 0, N: 0, k: 0 });
    const a = acc.get(o.targetId);
    a.E += o.adjE ?? o.E;
    a.N += o.adjN ?? o.N;
    a.k++;
  }
  return [...acc.values()].map((a) => ({
    id: a.id,
    label: a.label,
    E: a.E / a.k,
    N: a.N / a.k,
    sights: a.k,
  }));
}

/** How many distinct targets have been sighted at least `min` times. */
export function coverage(observations, min = 1) {
  const counts = new Map();
  for (const o of observations) counts.set(o.targetId, (counts.get(o.targetId) || 0) + 1);
  return [...counts.values()].filter((c) => c >= min).length;
}
