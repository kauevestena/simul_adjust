import { llhToEnu } from './coordinates.mjs';
import { clipSegment } from './constraints.mjs';

export const PATO_BRANCO = Object.freeze({
  level: 2, id: 'pato-branco-streets-v1', lat: -26.229, lon: -52.671,
  bounds: [-650, -650, 650, 650], geoidUndulation: 0,
  heightDatum: 'terrain H; h = H + N0, N0 = 0 m (local teaching approximation)',
});

let pending;
export async function loadStreetData() {
  // Failed downloads can be retried; there is no fabricated geometry fallback.
  pending ??= fetch(new URL('../data/pato-branco-streets.geojson', import.meta.url), { signal: AbortSignal.timeout(20000) })
    .then(r => { if (!r.ok) throw Error('streetsMissing'); return r.json(); })
    .catch(() => { pending = null; throw Error('streetsMissing'); });
  return pending;
}

export function projectStreets(data, origin) {
  if (data?.type !== 'FeatureCollection' || data.metadata?.id !== PATO_BRANCO.id || !Array.isArray(data.features) || !data.features.length)
    throw Error('streetsMissing');
  const streets = [], streetFeatures = [];
  for (const feature of data.features) {
    const geometry = feature?.geometry;
    if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2)
      throw Error('streetsMissing');
    const line = geometry.coordinates.map(coordinate => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) throw Error('streetsMissing');
      const [lon, lat] = coordinate;
      if (![lon, lat].every(Number.isFinite) || Math.abs(lon - PATO_BRANCO.lon) > .1 || Math.abs(lat - PATO_BRANCO.lat) > .1)
        throw Error('streetsMissing');
      // Common reference ellipsoidal height defines the horizontal street frame.
      return llhToEnu({ lat, lon, h: origin.h }, origin).slice(0, 2);
    });
    for (let i = 1; i < line.length; i++) {
      const segment = clipSegment(line[i - 1], line[i], PATO_BRANCO.bounds);
      if (!segment || Math.hypot(segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]) < .001) continue;
      streets.push(segment);
      streetFeatures.push({ id: feature.id, name: feature.properties?.name ?? '', line: segment });
    }
  }
  if (!streets.length) throw Error('streetsMissing');
  return { ...PATO_BRANCO, origin, streets, streetFeatures, metadata: data.metadata };
}
