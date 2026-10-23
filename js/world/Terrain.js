// Procedural islands: terrain mesh with caustics and a baked seabed depth texture.
// Heights come from IslandField (pure math, also used by tools/check-layout.mjs).
import { ISLANDS, TERRAIN, WATER, QUALITY, CITY_GROUND } from '../config/world.config.js';
import { fbm, smoothstep, clamp } from '../core/Utils.js';
import { IslandField } from './IslandField.js';

const THREE = window.THREE;

export const CAUSTICS_GLSL = /* glsl */`
float causticPattern(vec2 uv, float time) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
`;

export const NOISE_GLSL = /* glsl */`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

export class Terrain {
  constructor(ctx) {
    this.ctx = ctx;
    this.field = new IslandField(ISLANDS, { ...TERRAIN, plateau: CITY_GROUND });
    this.islands = this.field.islands;
    this.size = TERRAIN.size;
    this.mesh = this._buildMesh();
    this.seabedMesh = this._buildSeabed();
    this.depthTexture = this._bakeDepthTexture(1024);
    ctx.scene.add(this.mesh, this.seabedMesh);
  }

  islandById(id) { return this.islands.find((i) => i.id === id); }
  heightAt(x, z) { return this.field.heightAt(x, z); }
  islandAt(x, z) { return this.field.islandAt(x, z, 6); }
  coastDistance(x, z) { return this.field.coastDistance(x, z); }

  /** Uniform random land point on an island (rejection sampled). */
  randomPointOn(isl, rng, minHeight = 1.25) {
    const b = isl.landBox;
    for (let k = 0; k < 200; k++) {
      const x = b[0] + rng() * (b[2] - b[0]), z = b[1] + rng() * (b[3] - b[1]);
      if (this.heightAt(x, z) >= minHeight && this.field.islandAt(x, z) === isl) return { x, z };
    }
    return { x: isl.x, z: isl.z };
  }

  surfaceAt(x, z) {
    const h = this.heightAt(x, z);
    if (h < 0) return 'water';
    if (h < 1.15) return 'sand';
    const slope = this.slopeAt(x, z);
    if (slope > 0.55) return 'rock';
    return 'grass';
  }

  slopeAt(x, z) {
    const e = 1.0;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.sqrt(hx * hx + hz * hz) / (2 * e);
  }

  /** Grid mesh over the islands' bounds; deep open-sea cells are skipped (the seabed mesh covers them). */
  _buildMesh() {
    const cell = QUALITY.terrainCell;
    const [minX, minZ, maxX, maxZ] = this.field.bounds;
    const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
    const count = nx * nz;
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const keep = new Uint8Array(count);
    const sand = new THREE.Color(0xd9c49a), wetSand = new THREE.Color(0xb79f74), seabed = new THREE.Color(0xc9b98f);
    const grassA = new THREE.Color(0x4f7a2c), grassB = new THREE.Color(0x6f9a3a), grassC = new THREE.Color(0x3c6424);
    const rock = new THREE.Color(0x7d7468), deep = new THREE.Color(0x8a8a78);
    const c = new THREE.Color();
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = minX + i * cell, z = minZ + j * cell;
        const h = this.heightAt(x, z);
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        keep[k] = this.field.influencedAt(x, z) ? 1 : 0;
        const n = fbm(x * 0.03, z * 0.03, 3, 7) * 0.5 + 0.5;
        const n2 = fbm(x * 0.11, z * 0.11, 2, 8) * 0.5 + 0.5;
        if (h < -0.2) c.copy(seabed).lerp(deep, smoothstep(-2, -14, h));
        else if (h < 0.55) c.copy(wetSand).lerp(sand, smoothstep(-0.2, 0.55, h));
        else if (h < 1.2) c.copy(sand).lerp(grassB, smoothstep(0.95, 1.2, h) * 0.6);
        else {
          c.copy(grassA).lerp(grassB, n).lerp(grassC, n2 * 0.45);
          if (h > 9) c.lerp(rock, smoothstep(9, 22, h) * 0.55);
        }
        c.convertSRGBToLinear();
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
    }
    const index = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
        if (!(keep[a] | keep[b] | keep[d] | keep[e])) continue;
        index.push(a, d, b, b, d, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
    geo.computeVertexNormals();
    // Steep slopes become rock.
    const nor = geo.attributes.normal;
    const rockLinear = rock.clone().convertSRGBToLinear();
    for (let k = 0; k < count; k++) {
      const ny = nor.getY(k);
      if (ny < 0.86 && pos[k * 3 + 1] > 1) {
        c.setRGB(colors[k * 3], colors[k * 3 + 1], colors[k * 3 + 2]).lerp(rockLinear, smoothstep(0.86, 0.7, ny));
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
    }
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
    this._patchMaterial(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    mesh.userData.isTerrain = true;
    return mesh;
  }

  /** Coarse open-sea floor that sits slightly below the detailed mesh. */
  _buildSeabed() {
    const S = this.size * 4;
    const geo = new THREE.PlaneGeometry(S, S, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, this.field.seabedAt(p.getX(i), p.getZ(i)) - 0.6);
    geo.computeVertexNormals();
    const col = new THREE.Color(0x8a8a78).convertSRGBToLinear();
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 1 });
    this._patchMaterial(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'seabed';
    return mesh;
  }

  _patchMaterial(mat) {
    const u = this.ctx.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime;
      shader.uniforms.uRain = u.uRain;
      shader.uniforms.uDaylight = u.uDaylight;
      shader.uniforms.uSimTex = u.uSimTex;
      shader.uniforms.uSimBounds = u.uSimBounds;
      shader.uniforms.uWaterTint = u.uWaterTint;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWorldPos;
          uniform float uTime; uniform float uRain; uniform float uDaylight;
          uniform sampler2D uSimTex; uniform vec4 uSimBounds; uniform vec3 uWaterTint;
          ${NOISE_GLSL}
          ${CAUSTICS_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float detail = vnoise(vWorldPos.xz * 0.9) * 0.5 + vnoise(vWorldPos.xz * 3.7) * 0.35 + vnoise(vWorldPos.xz * 0.21) * 0.6;
          diffuseColor.rgb *= 0.78 + detail * 0.32;
          float wet = uRain * smoothstep(-0.5, 0.6, vWorldPos.y);
          diffuseColor.rgb *= 1.0 - wet * 0.35;
          float underwater = smoothstep(0.15, -0.35, vWorldPos.y);
          float depthM = max(-vWorldPos.y, 0.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uWaterTint, underwater * clamp(depthM / 9.0, 0.0, 1.0));`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.35, wet * 0.8);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (underwater > 0.0) {
            vec2 simUv = (vWorldPos.xz - uSimBounds.xy) / uSimBounds.zw;
            vec2 distort = vec2(0.0);
            if (simUv.x > 0.0 && simUv.x < 1.0 && simUv.y > 0.0 && simUv.y < 1.0) {
              distort = texture2D(uSimTex, simUv).ba * 2.5;
            }
            vec2 cuv = vWorldPos.xz * 0.055 + distort;
            float ca = causticPattern(cuv, uTime * 0.55);
            float cb = causticPattern(cuv * 1.37 + 3.1, uTime * 0.43 + 4.0);
            float caustic = min(ca + cb * 0.6, 2.2);
            float fade = underwater * exp(-depthM * 0.13) * uDaylight * (1.0 - uRain * 0.6);
            totalEmissiveRadiance += diffuseColor.rgb * vec3(0.75, 0.95, 1.0) * caustic * fade * 0.9;
          }`);
    };
  }

  /** R = normalized water depth, G = land mask. Covers the full terrain extent. */
  _bakeDepthTexture(res) {
    const data = new Uint8Array(res * res * 4);
    const half = this.size / 2;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = -half + (i + 0.5) / res * this.size;
        const z = -half + (j + 0.5) / res * this.size;
        const h = this.heightAt(x, z);
        const depth = clamp(-h / WATER.maxDepth, 0, 1);
        const k = (j * res + i) * 4;
        data[k] = Math.round(Math.sqrt(depth) * 255);
        data[k + 1] = h > 0.05 ? 255 : 0;
        data[k + 2] = 0;
        data[k + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}
