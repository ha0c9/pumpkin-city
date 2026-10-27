// GPU grass: a fixed set of blade clumps that wraps around the camera (toroidal), placed via the baked ground map.
import { QUALITY } from '../config/world.config.js';
import { mulberry32 } from '../core/Utils.js';
import { LAYER_DETAIL } from '../world/Water.js';

const THREE = window.THREE;

function clumpGeometry(rng) {
  const pos = [], col = [], nor = [], idx = [];
  const blades = 5;
  for (let b = 0; b < blades; b++) {
    const ox = (rng() - 0.5) * 0.5, oz = (rng() - 0.5) * 0.5;
    const ang = rng() * Math.PI;
    const h = 0.35 + rng() * 0.4;
    const w = 0.045 + rng() * 0.03;
    const bend = 0.12 + rng() * 0.25;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const segs = 4;
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = t * h;
      const width = w * (1 - t * 0.92);
      const forward = bend * t * t;
      for (const side of [-1, 1]) {
        const lx = side * width, lz = forward;
        pos.push(ox + lx * ca - lz * sa, y, oz + lx * sa + lz * ca);
        nor.push(-sa * 0.5, 0.8, ca * 0.5);
        const shade = 0.45 + t * 0.6;
        col.push(0.32 * shade + t * 0.12, 0.55 * shade + t * 0.08, 0.16 * shade);
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export class Grass {
  constructor(ctx, groundMap) {
    this.ctx = ctx;
    const rng = mulberry32(77);
    const count = QUALITY.grassCount;
    const radius = QUALITY.grassRadius * 0.6;
    const size = radius * 2;
    const geo = clumpGeometry(rng);
    const offsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      offsets[i * 3] = rng() * size;
      offsets[i * 3 + 1] = rng() * size;
      offsets[i * 3 + 2] = rng();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));

    this.uniforms = {
      uCenter: { value: new THREE.Vector3() },
      uSize: { value: size },
      uRadius: { value: radius },
      uGround: { value: groundMap.texture },
      uGroundRes: { value: groundMap.res },
      uTerrainSize: { value: groundMap.size },
      uTime: ctx.uniforms.uTime,
      uRain: ctx.uniforms.uRain,
      uStorm: ctx.uniforms.uStorm,
    };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 aOffset;
          uniform vec3 uCenter; uniform float uSize; uniform float uRadius;
          uniform sampler2D uGround; uniform float uGroundRes; uniform float uTerrainSize;
          uniform float uTime; uniform float uRain; uniform float uStorm;
          vec2 groundTexel(vec2 ij) {
            // Matches GroundMap: height is a 16-bit unorm over [-32, 96], grass is 0 / 0.5 / 1.
            vec4 t = texture2D(uGround, (ij + 0.5) / uGroundRes);
            float hi = floor(t.r * 255.0 + 0.5);
            float lo = floor(t.g * 255.0 + 0.5);
            float h = (hi * 256.0 + lo) / 65535.0 * 128.0 - 32.0;
            float g8 = floor(t.b * 255.0 + 0.5);
            float grass = g8 > 200.0 ? 1.0 : (g8 > 64.0 ? 0.5 : 0.0);
            return vec2(h, grass);
          }
          vec2 groundSample(vec2 wp) {
            vec2 p = (wp / uTerrainSize + 0.5) * uGroundRes - 0.5;
            vec2 i = floor(p); vec2 f = p - i;
            vec2 a = groundTexel(i), b = groundTexel(i + vec2(1.0, 0.0));
            vec2 c = groundTexel(i + vec2(0.0, 1.0)), d = groundTexel(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }`)
        .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(mix(vec3(normal), vec3(0.0, 1.0, 0.0), 0.55));`)
        .replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position);
          float ang = aOffset.z * 6.2831853;
          float ca = cos(ang), sa = sin(ang);
          transformed.xz = mat2(ca, -sa, sa, ca) * transformed.xz;
          vec2 wp = mod(aOffset.xy - uCenter.xz + uSize * 0.5, uSize) + uCenter.xz - uSize * 0.5;
          vec2 gs = groundSample(wp);
          float dist = length(wp - uCenter.xz);
          float fade = (1.0 - smoothstep(uRadius * 0.55, uRadius, dist)) * smoothstep(0.45, 0.9, gs.y);
          float scl = fade * (0.75 + 0.6 * fract(aOffset.z * 13.17));
          transformed *= scl;
          float hgt = position.y;
          float gust = sin(uTime * 1.7 + wp.x * 0.31 + wp.y * 0.23) * 0.6 + sin(uTime * 3.3 + wp.x * 0.9 - wp.y * 0.4) * 0.25;
          float windAmt = (0.35 + uRain * 0.5 + uStorm * 2.4) * hgt * hgt;
          transformed.x += gust * windAmt;
          transformed.z += gust * windAmt * 0.45;
          transformed.x += uStorm * 1.4 * hgt * hgt;
          transformed.xz += wp;
          transformed.y += gs.x - 0.03;`)
        .replace('#include <color_vertex>', `#include <color_vertex>
          float hue = fract(aOffset.z * 7.31);
          vColor.rgb *= mix(vec3(0.82, 0.95, 0.75), vec3(1.12, 1.05, 0.7), hue);
          vColor.rgb *= 1.0 - uRain * 0.25;`);
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    const id = new THREE.Matrix4();
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, id);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.layers.set(LAYER_DETAIL);
    this.mesh.name = 'grass';
    ctx.scene.add(this.mesh);
  }

  update(camera) {
    const c = this.uniforms.uCenter.value;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() > 0) dir.normalize();
    const reach = Math.min(this.uniforms.uRadius.value * 0.55, Math.max(0, camera.position.y * 0.4));
    c.set(camera.position.x + dir.x * reach, 0, camera.position.z + dir.z * reach);
    // Hide entirely when the camera is too high for blades to be visible.
    this.mesh.visible = camera.position.y < 140;
  }
}
