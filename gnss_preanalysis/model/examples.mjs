// Didactic projects. New points are generic design positions (not monuments); their
// heights are sampled from the DEM when the project opens (hSource 'pending' until then).
import { emptyProject, makePoint, makeSession, makeBaseline } from './network.mjs';

export const EXAMPLE_IDS = ['network', 'radial', 'trivial', 'long'];
const NEW_POINTS = {
  P1: [-25.4000, -49.2300], P2: [-25.4250, -49.1500], P3: [-25.4800, -49.1700], P4: [-25.4600, -49.2800],
  PG: [-25.0950, -50.1620],
};
const corsPoint = (stations, id) => {
  const s = stations.find(x => x.id === id);
  if (!s) throw Error('corsMissing');
  return makePoint({ id, label: id, lat: s.lat, lon: s.lon, h: s.h, hSource: 'cors', kind: 'cors', corsId: id });
};
const newPoint = (id, fallbackH) => makePoint({ id, lat: NEW_POINTS[id][0], lon: NEW_POINTS[id][1], h: fallbackH, hSource: 'pending' });

export function buildExample(name, stations) {
  const p = emptyProject();
  const link = (pairs, session) => pairs.forEach(([a, b]) => p.baselines.push(makeBaseline(a, b, session)));
  if (name === 'long') {
    p.title = 'long';
    p.points = [corsPoint(stations, 'UFPR'), corsPoint(stations, 'PRGU'), newPoint('PG', 900)];
    p.sessions = [makeSession('S1', 'S1', 60, 0), makeSession('S2', 'S2', 60, 1)];
    link([['UFPR', 'PG'], ['PRGU', 'PG']], 'S1');
    link([['UFPR', 'PG']], 'S2');
    return p;
  }
  const h0 = stations.find(x => x.id === 'UFPR')?.h ?? 0;
  p.points = [corsPoint(stations, 'UFPR'), corsPoint(stations, 'PRPI'), ...['P1', 'P2', 'P3', 'P4'].map(id => newPoint(id, h0))];
  if (name === 'radial') {
    p.title = 'radial';
    p.points = p.points.filter(x => x.id !== 'PRPI');
    p.sessions = [makeSession('S1', 'S1', 60, 0)];
    link([['UFPR', 'P1'], ['UFPR', 'P2'], ['UFPR', 'P3'], ['UFPR', 'P4']], 'S1');
  } else if (name === 'trivial') {
    p.title = 'trivial';
    p.points = p.points.filter(x => !['PRPI', 'P4'].includes(x.id));
    p.sessions = [makeSession('S1', 'S1', 90, 0)];
    link([['UFPR', 'P1'], ['UFPR', 'P2'], ['UFPR', 'P3'], ['P1', 'P2'], ['P2', 'P3'], ['P1', 'P3']], 'S1');
  } else {
    p.title = 'network';
    p.sessions = ['S1', 'S2', 'S3', 'S4'].map((id, i) => makeSession(id, id, 90, i));
    link([['UFPR', 'P1'], ['UFPR', 'P4']], 'S1');
    link([['PRPI', 'P1'], ['PRPI', 'P2']], 'S2');
    link([['UFPR', 'P3'], ['P3', 'P2']], 'S3');
    link([['P4', 'P3'], ['P4', 'P1']], 'S4');
  }
  return p;
}
