// Occupancy mask: buildings, roads and bridges register footprints so vegetation avoids them.
export class OccupancyMask {
  constructor() { this.shapes = []; }

  /** Oriented rectangle centered at (cx, cz), full size w x d, rotated by rot around Y. */
  addRect(cx, cz, w, d, rot = 0, tag = '') {
    this.shapes.push({ kind: 'rect', cx, cz, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot), tag });
  }

  addCircle(cx, cz, r, tag = '') { this.shapes.push({ kind: 'circle', cx, cz, r, tag }); }

  /** Returns the tag of the first shape covering (x, z) expanded by pad (optionally only shapes with `tag`), or null. */
  hit(x, z, pad = 0, tag = null) {
    for (const sh of this.shapes) {
      if (tag !== null && sh.tag !== tag) continue;
      const dx = x - sh.cx, dz = z - sh.cz;
      if (sh.kind === 'circle') {
        if (dx * dx + dz * dz < (sh.r + pad) * (sh.r + pad)) return sh.tag || 'occupied';
      } else {
        // Inverse rotation of a Y rotation by `rot`.
        const lx = dx * sh.c - dz * sh.s;
        const lz = dx * sh.s + dz * sh.c;
        if (Math.abs(lx) < sh.hw + pad && Math.abs(lz) < sh.hd + pad) return sh.tag || 'occupied';
      }
    }
    return null;
  }

  isFree(x, z, pad = 0) { return this.hit(x, z, pad) === null; }
}
