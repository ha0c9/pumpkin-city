// Pure island geometry (no THREE / DOM): signed distance coastline, height profile and a baked height grid.
// Everything that asks "how high is the ground here?" goes through IslandField.heightAt().
import { fbm, smoothstep, lerp, clamp } from '../core/Noise.js';

const UNDERWATER_FALLOFF = 120; // meters offshore until the slope reaches the open seabed

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export class IslandField {
  constructor(islands, { size, seabed, shore, heightCell, plateau }) {
    this.size = size;
    this.seabed = seabed;
    this.shore = shore;
    this.plateau = plateau;
    this.islands = islands.map((isl) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z, r] of isl.blobs) {
        minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
        minZ = Math.min(minZ, z - r); maxZ = Math.max(maxZ, z + r);
      }
      const pad = isl.coast * 1.5 + 10;
      const radius = Math.max(maxX - minX, maxZ - minZ) / 2;
      return {
        ...isl, height: isl.ground ?? plateau, radius,
        landBox: [minX - pad, minZ - pad, maxX + pad, maxZ + pad],
        box: [minX - pad - UNDERWATER_FALLOFF, minZ - pad - UNDERWATER_FALLOFF, maxX + pad + UNDERWATER_FALLOFF, maxZ + pad + UNDERWATER_FALLOFF],
      };
    });
    this._bakeGrid(heightCell);
  }

  /** Signed distance to the coastline in meters (negative = inland). */
  sdf(isl, x, z) {
    let d = Infinity;
    for (const [bx, bz, r] of isl.blobs) {
      const v = Math.hypot(x - bx, z - bz) - r;
      d = d === Infinity ? v : smin(d, v, 60);
    }
    if (d > isl.coast * 2 + UNDERWATER_FALLOFF + 20) return d;
    d += isl.coast * fbm(x / 95 + isl.seed, z / 95, 3, isl.seed);
    d += isl.coast * 0.45 * fbm(x / 31, z / 31 + isl.seed, 2, isl.seed + 3);
    return d;
  }

  seabedAt(x, z) { return this.seabed + fbm(x * 0.01, z * 0.01, 2, 99) * 2.5; }

  _islandHeight(isl, x, z) {
    const b = isl.box;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return -Infinity;
    const d = this.sdf(isl, x, z);
    // Higher islands get a wider (still steeper) shore, so they rise from the sea as low cliffs.
    const H = isl.height, W = this.shore + Math.max(0, H - this.plateau) * 0.6;
    let h;
    if (d <= -W) h = H;
    else if (d <= 0) {
      const k = (d + W) / W;
      h = lerp(H, 0.3, smoothstep(0, 1, k));
      h += fbm(x * 0.15, z * 0.15, 2, isl.seed + 5) * 0.12 * k * (1 - k) * 4;
    } else if (d <= 12) h = lerp(0.3, -1.7, d / 12);
    else h = lerp(-1.7, this.seabed - 1, smoothstep(12, UNDERWATER_FALLOFF, d));
    if (isl.hills.length && d < -W) {
      const inland = smoothstep(-W, -W - 28, d);
      for (const [hx, hz, hr, hh] of isl.hills) {
        const t2 = ((x - hx) ** 2 + (z - hz) ** 2) / (hr * hr);
        if (t2 >= 1) continue;
        const bump = (1 - t2) * (1 - t2);
        const n = 0.72 + 0.28 * (fbm(x / 26 + isl.seed, z / 26, 3, isl.seed + 9) * 0.5 + 0.5);
        h += hh * bump * n * inland;
      }
    }
    return h;
  }

  /** Analytic height (slow): islands + seabed. */
  rawHeight(x, z) {
    let h = this.seabedAt(x, z);
    for (const isl of this.islands) {
      const ih = this._islandHeight(isl, x, z);
      if (ih > h) h = ih;
    }
    return h;
  }

  _bakeGrid(cell) {
    const n = Math.ceil(this.size / cell) + 1;
    this.cell = this.size / (n - 1);
    this.n = n;
    this.grid = new Float32Array(n * n);
    this.influence = new Uint8Array(n * n);
    const half = this.size / 2;
    for (let j = 0; j < n; j++) {
      const z = -half + j * this.cell;
      for (let i = 0; i < n; i++) {
        const x = -half + i * this.cell;
        const sb = this.seabedAt(x, z);
        let h = sb, inf = 0;
        for (const isl of this.islands) {
          const ih = this._islandHeight(isl, x, z);
          if (ih > h) { h = ih; inf = 1; }
        }
        this.grid[j * n + i] = h;
        this.influence[j * n + i] = inf;
      }
    }
  }

  /** Bilinear lookup in the baked grid; falls back to the seabed outside it. */
  heightAt(x, z) {
    const half = this.size / 2;
    const fx = (x + half) / this.cell, fz = (z + half) / this.cell;
    const n = this.n;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return this.seabedAt(x, z);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const k = j * n + i;
    const g = this.grid;
    const a = g[k] + (g[k + 1] - g[k]) * tx;
    const b = g[k + n] + (g[k + n + 1] - g[k + n]) * tx;
    return a + (b - a) * tz;
  }

  influencedAt(x, z) {
    const half = this.size / 2;
    const i = Math.round((x + half) / this.cell), j = Math.round((z + half) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return false;
    return this.influence[j * this.n + i] === 1;
  }

  /** Island whose coastline is closest (inland or within `margin` meters offshore). */
  islandAt(x, z, margin = 0) {
    let best = null, bestD = margin;
    for (const isl of this.islands) {
      const b = isl.landBox;
      if (x < b[0] - margin || x > b[2] + margin || z < b[1] - margin || z > b[3] + margin) continue;
      const d = this.sdf(isl, x, z);
      if (d < bestD) { bestD = d; best = isl; }
    }
    return best;
  }

  /** Signed distance to the nearest island coastline. */
  coastDistance(x, z) {
    let best = Infinity;
    for (const isl of this.islands) best = Math.min(best, this.sdf(isl, x, z));
    return best;
  }

  /** Bounds [minX, minZ, maxX, maxZ] covering every island including its underwater slope. */
  get bounds() {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const isl of this.islands) {
      b[0] = Math.min(b[0], isl.box[0]); b[1] = Math.min(b[1], isl.box[1]);
      b[2] = Math.max(b[2], isl.box[2]); b[3] = Math.max(b[3], isl.box[3]);
    }
    const h = this.size / 2;
    return [clamp(b[0], -h, h), clamp(b[1], -h, h), clamp(b[2], -h, h), clamp(b[3], -h, h)];
  }
}
