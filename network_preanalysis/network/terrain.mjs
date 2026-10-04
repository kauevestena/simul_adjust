import { createTerrarium, pixelResolution } from '../../shared/terrarium.mjs';
import { enuToLlh, llhToEnu } from './coordinates.mjs';
import { RURAL } from './scenarios.mjs';
import { validatePointPlacement } from './constraints.mjs';

export async function createTerrain(config = RURAL, tiles = createTerrarium()) {
  const H0 = await tiles.sample(config.lon, config.lat);
  const origin = config.origin ?? { lat: config.lat, lon: config.lon, h: H0 + config.geoidUndulation };
  const resolution = pixelResolution(origin.lat);
  const sampler = {
    origin, bounds: config.bounds, resolution, geoidUndulation: config.geoidUndulation,
    metadata: { ...tiles.metadata, heightDatum: config.heightDatum ?? RURAL.heightDatum },
    async ground(E, N) {
      const placement = validatePointPlacement({ E, N }, { bounds: config.bounds });
      if (!placement.valid) throw Error(placement.reason);
      // Iterate the ENU vertical intersection with the height surface. This avoids
      // equating ENU U with ellipsoidal h or using a flat lat/lon approximation.
      let U = 0, llh, H;
      for (let i = 0; i < 5; i++) {
        llh = enuToLlh([E, N, U], origin); H = await tiles.sample(llh.lon, llh.lat);
        const next = llhToEnu({ ...llh, h: H + config.geoidUndulation }, origin)[2];
        if (Math.abs(next - U) < 1e-6) { U = next; break; }
        U = next;
      }
      return { U, H, h: H + config.geoidUndulation, lat: llh.lat, lon: llh.lon };
    },
    async sample(E, N) { return (await sampler.ground(E, N)).U; },
  };
  return sampler;
}
export const createRuralTerrain = createTerrain;

export async function lineOfSight(from, to, terrain, sight = {}, tolerance = 0.02) {
  const dx = to.E - from.E, dy = to.N - from.N, length = Math.hypot(dx, dy);
  const bottom = from.U + from.HI, top = to.U + (sight.HT ?? to.HT);
  if (!Number.isFinite(length + bottom + top) || !(terrain.resolution > 0)) return { status: 'missing', minimumClearance: null };
  const count = Math.max(2, Math.ceil(length / (terrain.resolution / 2)));
  if (count > 20000) return { status: 'missing', minimumClearance: null };
  let minimumClearance = Infinity, obstruction = null;
  try {
    // Include endpoints: a height above one cell does not guarantee beam clearance.
    for (let start = 0; start <= count; start += 128) {
      const samples = await Promise.all(Array.from({ length: Math.min(128, count + 1 - start) }, async (_, j) => {
        const t = (start + j) / count, E = from.E + t * dx, N = from.N + t * dy;
        const ground = await terrain.sample(E, N);
        if (!Number.isFinite(ground)) throw Error('terrainMissing');
        return { E, N, U: ground, t, clearance: bottom + t * (top - bottom) - ground };
      }));
      for (const sample of samples) if (sample.clearance < minimumClearance) {
        minimumClearance = sample.clearance; obstruction = sample;
      }
    }
  } catch { return { status: 'missing', minimumClearance: null }; }
  return { status: minimumClearance < -tolerance ? 'blocked' : 'visible', minimumClearance,
    obstruction: minimumClearance < -tolerance ? obstruction : null, sampleSpacing: length / count, tolerance };
}
export async function networkVisibility(network, terrain) {
  const points = new Map(network.points.map(p => [p.id, p]));
  const rows = await Promise.all(network.sights.filter(s => s.active !== false).map(async s => [s.id,
    await lineOfSight(points.get(s.from), points.get(s.to), terrain, s)]));
  return Object.fromEntries(rows);
}
