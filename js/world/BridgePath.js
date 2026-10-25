// Bridge centerline shared by js/world/Bridges.js and tools/check-layout.mjs (pure math, no THREE).
// A bridge leaves a road end on one island and lands on a road end of another island. Both road ends
// may be offset sideways and sit on different plateau heights, so the deck is a smooth curve in plan
// (cubic Hermite between the two abutments) and climbs or descends between the two heights.

// Mostly linear climb with eased ends, so the steepest grade stays close to the average.
const ease = (t) => 0.4 * t + 0.6 * t * t * (3 - 2 * t);

/**
 * Walk from a road end along `dir` and return the distance to the last plateau point before the water
 * (small dips on the way are ignored), or null if no water is found.
 */
export function abutmentDistance(field, x, z, dir, maxDist = 600) {
  const h0 = field.heightAt(x, z);
  let lastFlat = 0;
  for (let t = 0; t < maxDist; t += 0.5) {
    const h = field.heightAt(x + dir[0] * t, z + dir[1] * t);
    if (h >= h0 - 0.03) lastFlat = t;
    if (h < 0) return Math.max(0, lastFlat - 1.5);
  }
  return null;
}

export class BridgePath {
  /**
   * cfg: { from: [x, z], dir: [dx, dz], end: [x, z], endDir: [dx, dz], style }
   * `dir` points out of the start island; `endDir` is the travel direction when arriving at `end`.
   */
  constructor(cfg, field) {
    const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
    this.dA = norm(cfg.dir);
    this.dB = norm(cfg.endDir);
    const tA = abutmentDistance(field, cfg.from[0], cfg.from[1], this.dA);
    const tB = abutmentDistance(field, cfg.end[0], cfg.end[1], [-this.dB[0], -this.dB[1]]);
    this.ok = tA !== null && tB !== null;
    this.start = cfg.from;
    this.end = cfg.end;
    this.A = [cfg.from[0] + this.dA[0] * (tA || 0), cfg.from[1] + this.dA[1] * (tA || 0)];
    this.B = [cfg.end[0] - this.dB[0] * (tB || 0), cfg.end[1] - this.dB[1] * (tB || 0)];
    this.hA = field.heightAt(...this.A);
    this.hB = field.heightAt(...this.B);
    // A bridge that already climbs to a higher island needs little extra crown over the water.
    const crown = { arch: 2.6, cable: 4.5, beam: 3.4, viaduct: 7 }[cfg.style] || 3;
    this.rise = crown * Math.min(1, Math.max(0.15, 1 - Math.abs(this.hB - this.hA) / 7));

    // Hermite tangents scaled to the chord give a gentle S when the ends are offset sideways.
    const chord = Math.hypot(this.B[0] - this.A[0], this.B[1] - this.A[1]);
    const k = chord * 0.9;
    const n = Math.max(64, Math.ceil(chord / 1.5));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      pts.push([
        h00 * this.A[0] + h10 * k * this.dA[0] + h01 * this.B[0] + h11 * k * this.dB[0],
        h00 * this.A[1] + h10 * k * this.dA[1] + h01 * this.B[1] + h11 * k * this.dB[1],
      ]);
    }
    // Arc-length table so s in [0, 1] advances at constant speed along the deck.
    const cum = [0];
    for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.pts = pts;
    this.cum = cum;
    this.length = cum[n];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    this.bounds = [minX, minZ, maxX, maxZ];
  }

  _locate(s) {
    const d = Math.min(Math.max(s, 0), 1) * this.length;
    const cum = this.cum;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo];
    return { i: lo, f: seg > 1e-9 ? (d - cum[lo]) / seg : 0 };
  }

  /** Centerline point and unit tangent at arc-length fraction s. */
  at(s) {
    const { i, f } = this._locate(s);
    const p = this.pts[i], q = this.pts[i + 1];
    const tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1;
    return { x: p[0] + tx * f, z: p[1] + tz * f, tx: tx / l, tz: tz / l };
  }

  /** Deck height: eases between the two island heights with a crown over the water. */
  deckY(s) {
    const c = Math.min(Math.max(s, 0), 1);
    const k = Math.sin(Math.PI * c);
    return this.hA + (this.hB - this.hA) * ease(c) + this.rise * k * k;
  }

  /** Closest centerline point to (x, z): { s, across } (across > 0 to the right of travel), or null past the ends. */
  project(x, z, margin = 0) {
    const b = this.bounds;
    if (x < b[0] - margin || x > b[2] + margin || z < b[1] - margin || z > b[3] + margin) return null;
    const pts = this.pts;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const ex = q[0] - p[0], ez = q[1] - p[1];
      const l2 = ex * ex + ez * ez;
      let t = l2 > 0 ? ((x - p[0]) * ex + (z - p[1]) * ez) / l2 : 0;
      t = Math.min(Math.max(t, 0), 1);
      const dx = p[0] + ex * t - x, dz = p[1] + ez * t - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const p = pts[bi], q = pts[bi + 1];
    const ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1;
    const along = this.cum[bi] + (this.cum[bi + 1] - this.cum[bi]) * bt;
    // Off either end of the deck the closest point is the end itself; reject those.
    const ax = ((x - p[0]) * ex + (z - p[1]) * ez) / l;
    if ((bi === 0 && ax < 0) || (bi === pts.length - 2 && ax > l)) return null;
    // Right of travel = (-tz, tx), matching Bridge.point().
    const across = ((x - p[0]) * -ez + (z - p[1]) * ex) / l;
    return { s: along / this.length, across };
  }
}
