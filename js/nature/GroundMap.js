// Baked ground height and grass mask for vegetation placement. The mask stays on the CPU
// (grassAt) so animals and trees still avoid pavement. Upright blade meshes are gone, so
// this no longer uploads a GPU texture.
import { TERRAIN } from '../config/world.config.js';

export class GroundMap {
  constructor(terrain, mask, res = 1024) {
    this.res = res;
    this.size = TERRAIN.size;
    const half = this.size / 2;
    const n = res * res;
    this.height = new Float32Array(n);
    this.grass = new Float32Array(n);
    const field = terrain.field;
    for (let j = 0; j < res; j++) {
      const z = -half + (j + 0.5) / res * this.size;
      for (let i = 0; i < res; i++) {
        const x = -half + (i + 0.5) / res * this.size;
        const k = j * res + i;
        if (!field.influencedAt(x, z)) { this.height[k] = -10; continue; }
        const h = terrain.heightAt(x, z);
        this.height[k] = h;
        if (h > 1.25 && mask.isFree(x, z, 0.3)) this.grass[k] = 1;
      }
    }
    // Remove grass on steep slopes and soften the mask edge near sand.
    const cell = this.size / res;
    for (let j = 1; j < res - 1; j++) {
      for (let i = 1; i < res - 1; i++) {
        const k = j * res + i;
        if (!this.grass[k]) continue;
        const sx = (this.height[k + 1] - this.height[k - 1]) / (2 * cell);
        const sz = (this.height[k + res] - this.height[k - res]) / (2 * cell);
        const slope = Math.sqrt(sx * sx + sz * sz);
        if (slope > 0.7) this.grass[k] = 0;
        else if (this.height[k] < 1.6) this.grass[k] = 0.5;
      }
    }
    this.texture = null;
  }

  _idx(x, z) {
    const i = Math.floor((x / this.size + 0.5) * this.res);
    const j = Math.floor((z / this.size + 0.5) * this.res);
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) return -1;
    return j * this.res + i;
  }

  grassAt(x, z) { const k = this._idx(x, z); return k < 0 ? 0 : this.grass[k]; }
  heightAt(x, z) { const k = this._idx(x, z); return k < 0 ? -10 : this.height[k]; }
}
