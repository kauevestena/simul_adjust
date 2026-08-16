// Uniform hash grid over the world, in 16 m cells.
//
// Three consumers share it, which is why it exists at all: collision broad
// phase every frame, click hit-testing, and line-of-sight ray traversal.
// Without it, a 200 m sight line would test every tree in the valley.

const CELL = 16;

export function makeSpatialIndex(cellSize = CELL) {
  /** @type {Map<string, Array>} */
  const cells = new Map();
  const key = (cx, cy) => `${cx},${cy}`;
  const cellOf = (v) => Math.floor(v / cellSize);

  function insert(entity) {
    // Big footprints straddle cells, so register in every cell they touch.
    const r = Math.max(entity.r || 0, entity.losR || 0);
    const minX = cellOf(entity.e - r);
    const maxX = cellOf(entity.e + r);
    const minY = cellOf(entity.n - r);
    const maxY = cellOf(entity.n + r);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const k = key(cx, cy);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(entity);
      }
    }
    // Polylines can be far longer than their radius suggests.
    if (entity.seg) {
      for (const [e, n] of entity.seg) {
        const k = key(cellOf(e), cellOf(n));
        if (!cells.has(k)) cells.set(k, []);
        const bucket = cells.get(k);
        if (!bucket.includes(entity)) bucket.push(entity);
      }
    }
  }

  function queryCircle(e, n, radius) {
    const seen = new Set();
    const out = [];
    const minX = cellOf(e - radius);
    const maxX = cellOf(e + radius);
    const minY = cellOf(n - radius);
    const maxY = cellOf(n + radius);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = cells.get(key(cx, cy));
        if (!bucket) continue;
        for (const ent of bucket) {
          if (seen.has(ent.id)) continue;
          seen.add(ent.id);
          out.push(ent);
        }
      }
    }
    return out;
  }

  const queryRect = (minE, minN, maxE, maxN) => {
    const seen = new Set();
    const out = [];
    for (let cx = cellOf(minE); cx <= cellOf(maxE); cx++) {
      for (let cy = cellOf(minN); cy <= cellOf(maxN); cy++) {
        const bucket = cells.get(key(cx, cy));
        if (!bucket) continue;
        for (const ent of bucket) {
          if (seen.has(ent.id)) continue;
          seen.add(ent.id);
          out.push(ent);
        }
      }
    }
    return out;
  };

  /**
   * Entities whose cells the segment A->B passes through, walked with a DDA so
   * a long sight line only touches the cells it actually crosses.
   */
  function queryRay(ax, ay, bx, by, pad = 0) {
    const seen = new Set();
    const out = [];
    const add = (cx, cy) => {
      const bucket = cells.get(key(cx, cy));
      if (!bucket) return;
      for (const ent of bucket) {
        if (seen.has(ent.id)) continue;
        seen.add(ent.id);
        out.push(ent);
      }
    };

    let cx = cellOf(ax);
    let cy = cellOf(ay);
    const endX = cellOf(bx);
    const endY = cellOf(by);

    const dx = bx - ax;
    const dy = by - ay;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;

    // Distance along the ray to the next cell boundary in each axis.
    const tDeltaX = dx === 0 ? Infinity : Math.abs(cellSize / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(cellSize / dy);
    const nextBoundX = (cx + (stepX > 0 ? 1 : 0)) * cellSize;
    const nextBoundY = (cy + (stepY > 0 ? 1 : 0)) * cellSize;
    let tMaxX = dx === 0 ? Infinity : (nextBoundX - ax) / dx;
    let tMaxY = dy === 0 ? Infinity : (nextBoundY - ay) / dy;

    // Padding widens the corridor so an entity whose radius overlaps the ray
    // from an adjacent cell is not missed.
    const padCells = Math.ceil(pad / cellSize);

    let guard = 0;
    for (;;) {
      for (let ox = -padCells; ox <= padCells; ox++) {
        for (let oy = -padCells; oy <= padCells; oy++) add(cx + ox, cy + oy);
      }
      if (cx === endX && cy === endY) break;
      if (++guard > 4096) break; // pathological input; bail rather than hang
      if (tMaxX < tMaxY) {
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        tMaxY += tDeltaY;
        cy += stepY;
      }
    }
    return out;
  }

  return {
    insert,
    insertAll: (list) => list.forEach(insert),
    queryCircle,
    queryRect,
    queryRay,
    clear: () => cells.clear(),
    get size() {
      return cells.size;
    },
    cellSize,
  };
}
