// Procedural islands: height function, terrain mesh with caustics, and a baked seabed depth texture.
import { ISLANDS, TERRAIN, WATER, QUALITY } from '../config/world.config.js';
import { fbm, lerp, smoothstep, clamp } from '../core/Utils.js';

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
    this.islands = ISLANDS.map((isl) => ({ ...isl, bound: isl.radius * 1.9 }));
    this.size = TERRAIN.size;
    this.mesh = this._buildMesh();
    this.depthTexture = this._bakeDepthTexture(768);
    ctx.scene.add(this.mesh);
  }

  islandById(id) { return this.islands.find((i) => i.id === id); }

  _islandHeight(isl, x, z) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > isl.bound) return -Infinity;
    const ang = Math.atan2(dz, dx);
    const shapeR = isl.radius * (1 + isl.shape * fbm(Math.cos(ang) * 1.6 + isl.seed, Math.sin(ang) * 1.6, 3, isl.seed));
    const t = d / shapeR;
    const H = isl.height;
    let h;
    if (t <= isl.flat) {
      h = H;
    } else if (t <= 1.0) {
      const k = (t - isl.flat) / (1 - isl.flat);
      h = lerp(H, 0.3, smoothstep(0, 1, k));
      h += fbm(x * 0.15, z * 0.15, 2, isl.seed + 5) * 0.12 * (1 - k);
    } else if (t <= 1.13) {
      h = lerp(0.3, -1.7, (t - 1.0) / 0.13);
    } else {
      h = lerp(-1.7, TERRAIN.seabed, smoothstep(1.13, 1.8, t));
    }
    if (isl.hills > 0) {
      const mask = smoothstep(0.62, 0.25, t);
      if (mask > 0) {
        const n = fbm(x / 45 + isl.seed, z / 45, 4, isl.seed) * 0.5 + 0.5;
        h += Math.pow(n, 1.6) * isl.hills * mask;
      }
    }
    return h;
  }

  heightAt(x, z) {
    let h = TERRAIN.seabed + fbm(x * 0.01, z * 0.01, 2, 99) * 2.5;
    for (const isl of this.islands) {
      const ih = this._islandHeight(isl, x, z);
      if (ih > h) h = ih;
    }
    return h;
  }

  /** Returns the island that contains (x, z) or null. */
  islandAt(x, z) {
    let best = null, bestH = 0;
    for (const isl of this.islands) {
      const h = this._islandHeight(isl, x, z);
      if (h > bestH) { bestH = h; best = isl; }
    }
    return best;
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

  _buildMesh() {
    const seg = QUALITY.terrainSegments;
    const geo = new THREE.PlaneGeometry(this.size, this.size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xd9c49a), wetSand = new THREE.Color(0xb79f74), seabed = new THREE.Color(0xc9b98f);
    const grassA = new THREE.Color(0x4f7a2c), grassB = new THREE.Color(0x6f9a3a), grassC = new THREE.Color(0x3c6424);
    const rock = new THREE.Color(0x7d7468), deep = new THREE.Color(0x8a8a78);
    const rockLinear = rock.clone().convertSRGBToLinear();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.03, z * 0.03, 3, 7) * 0.5 + 0.5;
      const n2 = fbm(x * 0.11, z * 0.11, 2, 8) * 0.5 + 0.5;
      if (h < -0.2) {
        c.copy(seabed).lerp(deep, smoothstep(-2, -14, h));
      } else if (h < 0.55) {
        c.copy(wetSand).lerp(sand, smoothstep(-0.2, 0.55, h));
      } else if (h < 1.2) {
        c.copy(sand).lerp(grassB, smoothstep(0.95, 1.2, h) * 0.6);
      } else {
        c.copy(grassA).lerp(grassB, n).lerp(grassC, n2 * 0.45);
        if (h > 9) c.lerp(rock, smoothstep(9, 18, h) * 0.6);
      }
      c.convertSRGBToLinear();
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Steep slopes become rock.
    const nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const ny = nor.getY(i);
      if (ny < 0.86 && pos.getY(i) > 1) {
        const k = smoothstep(0.86, 0.7, ny);
        c.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]).lerp(rockLinear, k);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
    }

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
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
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    mesh.userData.isTerrain = true;
    return mesh;
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
