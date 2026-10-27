// Baked ground data (height + grass mask) used by GPU grass and vegetation placement.
import { TERRAIN } from '../config/world.config.js';

const THREE = window.THREE;

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
    // GPU copy is RGBA8, not RGBA32F. r128 cannot size an RG16F upload (it leaves the
    // unsized RG internal format, and the texture comes back empty). Height is packed as
    // a 16-bit unorm over [-32, 96] in R,G (step ≈ 2 mm). Grass is the three mask levels
    // in B (0, 128, 255). The grass shader unpacks both. CPU queries keep the float arrays;
    // this upload buffer is released after the first frame.
    const data = new Uint8Array(n * 4);
    for (let k = 0; k < n; k++) {
      let u = Math.round((this.height[k] + 32) / 128 * 65535);
      if (u < 0) u = 0;
      else if (u > 65535) u = 65535;
      const g = this.grass[k];
      data[k * 4] = u >> 8;
      data[k * 4 + 1] = u & 255;
      data[k * 4 + 2] = g >= 0.75 ? 255 : g >= 0.25 ? 128 : 0;
      data[k * 4 + 3] = 255;
    }
    this.texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
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
