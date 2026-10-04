import { emptyNetwork, makePoint, makeSight } from './model.mjs';
import { nearestStreet } from './constraints.mjs';
import { PATO_BRANCO } from './streets.mjs';
export { validatePointPlacement } from './constraints.mjs';

export function example(name = 'traverse') {
  const n = emptyNetwork(); n.scenario = name;
  const add = (id, e, north, type = 'station', control = 'unknown') => n.points.push(makePoint(id, e, north, type, control));
  const sight = (from, to) => n.sights.push(makeSight(from, to));
  if (['traverse', 'weak', 'mixed', 'rural'].includes(name)) {
    add('G01', -240, -60, 'station', 'fixed');
    add('S01', -120, 45); add('S02', 0, -30); add('S03', 120, 70);
    add('G02', 250, 0, 'station', 'fixed');
    n.points[0].role = 'gnssStart'; n.points[4].role = 'gnssFinish';
    for (let i = 0; i < 4; i++) { sight(n.points[i].id, n.points[i + 1].id); sight(n.points[i + 1].id, n.points[i].id); }
    if (name === 'weak') n.points.forEach((p, i) => { p.E = [-240, -1000, -2000, -3000, -238][i]; p.N = [0, 1, 2, 3, 1][i]; });
    if (name === 'mixed') {
      add('P01', 0, 130, 'sighted_only');
      sight('S01', 'S03'); sight('S03', 'S01'); sight('S01', 'P01'); sight('S03', 'P01'); sight('S02', 'P01');
    }
  } else if (name === 'resection') {
    add('S01', 0, 0);
    add('C01', -150, -100, 'sighted_only', 'fixed'); add('C02', 140, -100, 'sighted_only', 'fixed'); add('C03', 20, 150, 'sighted_only', 'fixed');
    for (const id of ['C01', 'C02', 'C03']) sight('S01', id);
  } else if (name === 'intersection') {
    add('C01', -130, -70, 'station', 'fixed'); add('C02', 130, -70, 'station', 'fixed');
    add('P01', 20, 100, 'sighted_only');
    sight('C01', 'C02'); sight('C02', 'C01'); sight('C01', 'P01'); sight('C02', 'P01');
    // Actual angular intersection: control-to-control sights establish orientations.
    for (const s of n.sights) s.components.distance = false;
  } else throw Error('invalidNetwork');
  return n;
}

export function urbanExample(scenario) {
  const n = emptyNetwork(); n.level = 2; n.scenario = 'pato-branco'; n.streetDataset = PATO_BRANCO.id;
  n.origin = scenario.origin; n.geoidUndulation = PATO_BRANCO.geoidUndulation;
  n.heightDatum = PATO_BRANCO.heightDatum;
  // A compact design network, anchored to the actual pinned street geometry.
  const seeds = [[-220, -160], [-110, -80], [0, 30], [140, 80], [260, 160]];
  n.points = seeds.map(([E, N], i) => {
    const { nearest } = nearestStreet({ E, N }, scenario.streets);
    if (!nearest) throw Error('streetsMissing');
    const fixed = i === 0 || i === seeds.length - 1;
    const p = makePoint(i === 0 ? 'G01' : fixed ? 'G02' : `S0${i}`, ...nearest, 'station', fixed ? 'fixed' : 'unknown');
    if (fixed) p.role = i === 0 ? 'gnssStart' : 'gnssFinish';
    return p;
  });
  for (let i = 1; i < n.points.length; i++) {
    n.sights.push(makeSight(n.points[i - 1].id, n.points[i].id), makeSight(n.points[i].id, n.points[i - 1].id));
  }
  return n;
}
export const RURAL = Object.freeze({
  lat: -25.454, lon: -49.07, bounds: [-650, -500, 650, 500],
  // Explicit didactic constant, NOT an EGM96/ellipsoidal equivalence or measured N.
  geoidUndulation: 0, heightDatum: 'terrain H; h = H + N0, N0 = 0 m (local teaching approximation)',
});
