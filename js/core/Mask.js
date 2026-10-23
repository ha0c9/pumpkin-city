// Occupancy mask: buildings, roads and bridges register footprints so vegetation avoids them.
// Shapes are bucketed in a coarse grid so the millions of lookups made while baking ground data stay fast.
const CELL = 32;
const MAX_PAD = 12;

export class OccupancyMask {
  constructor() { this.shapes = []; this.grid = null; }

  /** Oriented rectangle centered at (cx, cz), full size w x d, rotated by rot around Y. */
  addRect(cx, cz, w, d, rot = 0, tag = '') {
    const c = Math.cos(rot), s = Math.sin(rot);
    const ex = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, ez = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
    this.shapes.push({ kind: 'rect', cx, cz, hw: w / 2, hd: d / 2, c, s, tag, ex, ez });
    this.grid = null;
  }

  addCircle(cx, cz, r, tag = '') { this.shapes.push({ kind: 'circle', cx, cz, r, tag, ex: r, ez: r }); this.grid = null; }

  _build() {
    this.grid = new Map();
    for (const sh of this.shapes) {
      const i0 = Math.floor((sh.cx - sh.ex - MAX_PAD) / CELL), i1 = Math.floor((sh.cx + sh.ex + MAX_PAD) / CELL);
      const j0 = Math.floor((sh.cz - sh.ez - MAX_PAD) / CELL), j1 = Math.floor((sh.cz + sh.ez + MAX_PAD) / CELL);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = i * 100003 + j;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(sh);
        }
      }
    }
  }

  /** Returns the tag of the first shape covering (x, z) expanded by pad (optionally only shapes with `tag`), or null. */
  hit(x, z, pad = 0, tag = null) {
    let list = this.shapes;
    if (pad <= MAX_PAD) {
      if (!this.grid) this._build();
      list = this.grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
      if (!list) return null;
    }
    for (const sh of list) {
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
