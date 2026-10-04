// Shared with nivelamento. Same AWS dataset, z=14, floored nearest-pixel sampling.
// No invented elevation on a failed request. Callers must handle missing terrain.
export const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRARIUM_SOURCE = Object.freeze({ type: 'raster-dem', tiles: [TERRARIUM_URL], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
export const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;
export function tilePixel(lon, lat, zoom = 14) {
  if (![lon, lat].every(Number.isFinite) || Math.abs(lon) > 180 || Math.abs(lat) > 85.05112878) throw Error('coordinateRange');
  const n = 2 ** zoom, phi = lat * Math.PI / 180;
  const x = Math.min(n - Number.EPSILON * n, (lon + 180) / 360 * n);
  const y = Math.max(0, Math.min(n - Number.EPSILON * n, (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n));
  return { x: Math.floor(x), y: Math.floor(y), px: Math.min(255, Math.floor((x - Math.floor(x)) * 256)), py: Math.min(255, Math.floor((y - Math.floor(y)) * 256)), zoom };
}
export const pixelResolution = (lat, zoom = 14) => 2 * Math.PI * 6378137 * Math.cos(lat * Math.PI / 180) / (256 * 2 ** zoom);

async function browserTile(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error('terrainMissing');
  // Avoid color-space conversion of RGB-encoded numerical elevations.
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  if (bitmap.width !== 256 || bitmap.height !== 256) { bitmap.close(); throw Error('terrainMissing'); }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0); bitmap.close();
  return ctx.getImageData(0, 0, 256, 256).data;
}
export function createTerrarium({ loadTile = browserTile, maxTiles = 64 } = {}) {
  const cache = new Map();
  return {
    metadata: { source: TERRARIUM_URL, zoom: 14, sampling: 'floor-nearest-pixel', height: 'terrain elevation H; source vertical datum must be preserved by scenario' },
    async sample(lon, lat) {
      const p = tilePixel(lon, lat), key = `${p.zoom}/${p.x}/${p.y}`;
      if (!cache.has(key)) {
        const url = TERRARIUM_URL.replace('{z}', p.zoom).replace('{x}', p.x).replace('{y}', p.y);
        const pending = Promise.resolve().then(() => loadTile(url)).catch(error => { cache.delete(key); throw error; });
        cache.set(key, pending);
        if (cache.size > maxTiles) cache.delete(cache.keys().next().value);
      }
      const rgba = await cache.get(key), i = (p.py * 256 + p.px) * 4;
      if (!rgba || rgba.length !== 256 * 256 * 4 || rgba[i + 3] === 0) throw Error('terrainMissing');
      const h = decodeTerrarium(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (!(h > -12000 && h < 10000)) throw Error('terrainMissing');
      return h;
    },
    clear() { cache.clear(); },
  };
}
