// Procedural canvas textures shared by roads, bridges and buildings. Results are cached.
import { makeCanvas, canvasTexture, mulberry32 } from './Utils.js';

const THREE = window.THREE;
const cache = new Map();

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noiseFill(ctx, w, h, base, variance, seed = 1) {
  const rng = mulberry32(seed);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (rng() - 0.5) * variance;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Low-frequency blotches.
  for (let i = 0; i < 40; i++) {
    const r = 10 + rng() * 60;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    const a = rng() * 0.08;
    const dark = rng() > 0.5;
    g.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
}

/** Carriageway with lane markings. U spans the road width, V repeats every `unit` meters. */
export function roadTexture(lanes, laneWidth) {
  return cached(`road-${lanes}`, () => {
    const W = lanes * laneWidth;
    const unit = 12;
    const pxPerM = 48;
    const w = Math.round(W * pxPerM), h = Math.round(unit * pxPerM);
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    noiseFill(ctx, w, h, [58, 60, 63], 26, lanes);
    const m = (v) => v * pxPerM;
    // Tyre wear darkening in the middle of each lane.
    for (let i = 0; i < lanes; i++) {
      const cx = m(laneWidth * (i + 0.5));
      const g = ctx.createLinearGradient(cx - m(1.2), 0, cx + m(1.2), 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.12)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - m(1.2), 0, m(2.4), h);
    }
    ctx.fillStyle = 'rgba(236,236,230,0.92)';
    ctx.fillRect(m(0.25), 0, m(0.15), h);
    ctx.fillRect(w - m(0.4), 0, m(0.15), h);
    ctx.fillStyle = 'rgba(240,190,40,0.95)';
    const mid = w / 2;
    ctx.fillRect(mid - m(0.25), 0, m(0.13), h);
    ctx.fillRect(mid + m(0.12), 0, m(0.13), h);
    ctx.fillStyle = 'rgba(236,236,230,0.9)';
    for (let i = 1; i < lanes / 2; i++) {
      for (const side of [-1, 1]) {
        const x = mid + side * m(laneWidth * i) - m(0.07);
        ctx.fillRect(x, m(1), m(0.14), m(6));
      }
    }
    const tex = canvasTexture(c, { anisotropy: 8 });
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return { texture: tex, unit };
  });
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const c = makeCanvas(256, 256);
    noiseFill(c.getContext('2d'), 256, 256, [60, 62, 65], 26, 3);
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

export function paverTexture() {
  return cached('paver', () => {
    const s = 256;
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    noiseFill(ctx, s, s, [176, 172, 164], 20, 5);
    const rng = mulberry32(9);
    const n = 4;
    const cell = s / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const t = (rng() - 0.5) * 18;
        ctx.fillStyle = `rgba(${150 + t},${146 + t},${140 + t},0.35)`;
        ctx.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
      }
    }
    ctx.strokeStyle = 'rgba(90,88,84,0.65)'; ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell); ctx.stroke();
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

export function concreteTexture() {
  return cached('concrete', () => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    noiseFill(ctx, 256, 256, [168, 166, 160], 22, 11);
    ctx.strokeStyle = 'rgba(80,80,80,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

export function brickTexture() {
  return cached('brick', () => {
    const w = 512, h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9c1b4'; ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(21);
    const bh = 32, bw = 64;
    for (let row = 0; row < h / bh; row++) {
      const off = (row % 2) * bw / 2;
      for (let x = -bw; x < w + bw; x += bw) {
        const t = (rng() - 0.5) * 40;
        ctx.fillStyle = `rgb(${158 + t},${74 + t * 0.6},${56 + t * 0.4})`;
        ctx.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

export function stoneTexture() {
  return cached('stone', () => {
    const w = 512, h = 512;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    noiseFill(ctx, w, h, [222, 214, 196], 16, 31);
    ctx.strokeStyle = 'rgba(120,110,95,0.35)'; ctx.lineWidth = 2;
    const bh = 64;
    for (let row = 0; row <= h / bh; row++) {
      ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(w, row * bh); ctx.stroke();
      const off = (row % 2) * 96;
      for (let x = off; x < w; x += 192) {
        ctx.beginPath(); ctx.moveTo(x, row * bh); ctx.lineTo(x, row * bh + bh); ctx.stroke();
      }
    }
    return canvasTexture(c, { repeat: [1, 1] });
  });
}

export function trackTexture() {
  return cached('track', () => {
    const c = makeCanvas(512, 256);
    const ctx = c.getContext('2d');
    noiseFill(ctx, 512, 256, [178, 72, 52], 30, 41);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 256 / 6); ctx.lineTo(512, i * 256 / 6); ctx.stroke();
    }
    return canvasTexture(c);
  });
}

/** Planar world-space UVs for merged static geometry (top faces use XZ, sides use the horizontal axis + Y). */
export function applyWorldUV(geometry, scale = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny > 0.6) { uv[i * 2] = x * scale; uv[i * 2 + 1] = z * scale; }
    else if (nx > 0.6) { uv[i * 2] = z * scale; uv[i * 2 + 1] = y * scale; }
    else { uv[i * 2] = x * scale; uv[i * 2 + 1] = y * scale; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
