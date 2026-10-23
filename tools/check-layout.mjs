// Validate js/config/city.layout.js against the island terrain and draw a top-down map.
// Usage: node tools/check-layout.mjs [out.png]
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { ISLANDS, TERRAIN, CITY_GROUND } from '../js/config/world.config.js';
import { ROADS, ROAD_STYLE, BRIDGES, LANDMARKS, LOTS } from '../js/config/city.layout.js';
import { IslandField } from '../js/world/IslandField.js';

// Keep in sync with the building modules' `footprint`.
const FOOTPRINTS = {
  americaTower: [36, 33], americaMuseum: [52, 42], heritageMuseum: [33, 36], school: [46, 58],
  homeInn: [40, 22], fourSeasons: [68, 98], ghostMuseum: [46, 46], oceanMuseum: [74, 26],
  oceanGallery: [40, 34], scienceMuseum: [60, 60],
};

const t0 = Date.now();
const field = new IslandField(ISLANDS, { ...TERRAIN, plateau: CITY_GROUND });
console.log(`height grid ${field.n}x${field.n} baked in ${Date.now() - t0} ms`);

const errors = [];
const flat = (x, z) => Math.abs(field.rawHeight(x, z) - CITY_GROUND) < 0.03;
const halfTotal = (lanes) => (lanes * ROAD_STYLE.laneWidth) / 2 + ROAD_STYLE.sidewalk;

function rectCorners(cx, cz, w, d, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const lx = (i / 6 - 0.5) * w, lz = (j / 6 - 0.5) * d;
      pts.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
    }
  }
  return pts;
}

const roadRects = ROADS.map((r) => {
  const horiz = r.from[1] === r.to[1];
  const ht = halfTotal(r.lanes || 2);
  const x0 = Math.min(r.from[0], r.to[0]), x1 = Math.max(r.from[0], r.to[0]);
  const z0 = Math.min(r.from[1], r.to[1]), z1 = Math.max(r.from[1], r.to[1]);
  return horiz ? { r, x0, x1, z0: z0 - ht, z1: z1 + ht } : { r, x0: x0 - ht, x1: x1 + ht, z0, z1 };
});
for (const rr of roadRects) {
  for (let x = rr.x0; x <= rr.x1; x += 2) {
    for (let z = rr.z0; z <= rr.z1; z += 2) {
      if (!flat(x, z)) { errors.push(`road ${rr.r.id} not flat at ${x.toFixed(0)},${z.toFixed(0)} (h=${field.rawHeight(x, z).toFixed(2)})`); x = Infinity; break; }
    }
  }
}

const overlapsRoad = (pts) => roadRects.find((rr) => pts.some(([x, z]) => x > rr.x0 && x < rr.x1 && z > rr.z0 && z < rr.z1));
const placed = [];
function checkRect(label, cx, cz, w, d, rot) {
  const pts = rectCorners(cx, cz, w, d, rot);
  const bad = pts.find(([x, z]) => !flat(x, z));
  if (bad) errors.push(`${label} not on flat ground at ${bad[0].toFixed(0)},${bad[1].toFixed(0)} (h=${field.rawHeight(bad[0], bad[1]).toFixed(2)})`);
  const road = overlapsRoad(pts);
  if (road) errors.push(`${label} overlaps road ${road.r.id}`);
  for (const p of placed) {
    if (pts.some(([x, z]) => {
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      const dx = x - p.cx, dz = z - p.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      return Math.abs(lx) < p.w / 2 - 0.5 && Math.abs(lz) < p.d / 2 - 0.5;
    })) errors.push(`${label} overlaps ${p.label}`);
  }
  placed.push({ label, cx, cz, w, d, rot });
}
for (const l of LANDMARKS) {
  const fp = l.footprint || FOOTPRINTS[l.type];
  checkRect(`landmark ${l.id}`, l.position[0], l.position[1], fp[0], fp[1], l.rotation || 0);
}
LOTS.large.forEach((l, i) => checkRect(`large lot #${i}`, l.position[0], l.position[1], l.size[0], l.size[1], 0));
LOTS.small.forEach((l, i) => {
  const r = l.rotation || 0;
  const swap = Math.abs(Math.sin(r)) > 0.5;
  checkRect(`small lot #${i}`, l.position[0], l.position[1], swap ? l.size[1] : l.size[0], swap ? l.size[0] : l.size[1], 0);
});

// Bridges: same marching as js/world/Bridges.js.
const bridges = BRIDGES.map((b) => {
  const D = [b.dir[0], b.dir[1]];
  const hStart = field.heightAt(b.from[0], b.from[1]);
  let tA = 0, tB = 0;
  let lastFlat = 0;
  for (let t = 0; t < 600; t += 0.5) {
    const h = field.heightAt(b.from[0] + D[0] * t, b.from[1] + D[1] * t);
    if (h >= hStart - 0.03) lastFlat = t;
    if (h < 0) { tA = Math.max(0, lastFlat - 1.5); break; }
  }
  for (let t = tA + 5; t < 800; t += 0.5) {
    const x = b.from[0] + D[0] * t, z = b.from[1] + D[1] * t;
    const isl = field.islandAt(x, z);
    if (isl && isl.id === b.to && field.heightAt(x, z) >= CITY_GROUND - 0.03) { tB = t + 1.5; break; }
  }
  const A = [b.from[0] + D[0] * tA, b.from[1] + D[1] * tA], B = [b.from[0] + D[0] * tB, b.from[1] + D[1] * tB];
  console.log(`bridge ${b.id}: A=${A.map((v) => v.toFixed(0))} B=${B.map((v) => v.toFixed(0))} length ${(tB - tA).toFixed(0)} m`);
  if (!tB) errors.push(`bridge ${b.id} never reaches ${b.to}`);
  return { b, A, B };
});

// --- Map ---
const out = process.argv[2] || 'layout-map.png';
const S = 1000, scale = TERRAIN.size / S;
const img = Buffer.alloc(S * S * 3);
const put = (px, py, rgb) => {
  if (px < 0 || py < 0 || px >= S || py >= S) return;
  const k = (py * S + px) * 3; img[k] = rgb[0]; img[k + 1] = rgb[1]; img[k + 2] = rgb[2];
};
const toPx = (x, z) => [Math.round((x + TERRAIN.size / 2) / scale), Math.round((z + TERRAIN.size / 2) / scale)];
for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    const x = -TERRAIN.size / 2 + (px + 0.5) * scale, z = -TERRAIN.size / 2 + (py + 0.5) * scale;
    const h = field.heightAt(x, z);
    let c;
    if (h < 0) { const k = Math.min(1, -h / 16); c = [30 + 40 * (1 - k), 120 + 90 * (1 - k), 170 + 50 * (1 - k)]; }
    else if (h < 1.15) c = [220, 200, 150];
    else if (h <= CITY_GROUND + 0.02) c = [90, 150, 70];
    else { const k = Math.min(1, (h - CITY_GROUND) / 20); c = [90 + 90 * k, 150 - 20 * k, 70 + 50 * k]; }
    put(px, py, c);
  }
}
const fillRect = (cx, cz, w, d, rot, rgb) => {
  for (const [x, z] of rectCorners(cx, cz, w, d, rot)) put(...toPx(x, z), rgb);
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let lx = -w / 2; lx <= w / 2; lx += scale * 0.7) {
    for (let lz = -d / 2; lz <= d / 2; lz += scale * 0.7) put(...toPx(cx + lx * c + lz * s, cz - lx * s + lz * c), rgb);
  }
};
for (const rr of roadRects) fillRect((rr.x0 + rr.x1) / 2, (rr.z0 + rr.z1) / 2, rr.x1 - rr.x0, rr.z1 - rr.z0, 0, [70, 70, 75]);
for (const { A, B, b } of bridges) {
  const w = (b.lanes || 2) * ROAD_STYLE.laneWidth + 2 * ROAD_STYLE.sidewalk;
  fillRect((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, Math.abs(B[0] - A[0]) || w, Math.abs(B[1] - A[1]) || w, 0, [200, 200, 205]);
  fillRect((A[0] + b.from[0]) / 2, (A[1] + b.from[1]) / 2, Math.abs(A[0] - b.from[0]) || w, Math.abs(A[1] - b.from[1]) || w, 0, [70, 70, 75]);
}
for (const p of placed) {
  const col = p.label.startsWith('landmark') ? [230, 120, 30] : p.label.startsWith('large') ? [150, 90, 200] : [240, 220, 60];
  fillRect(p.cx, p.cz, p.w, p.d, p.rot, col);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const raw = Buffer.alloc((S * 3 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (S * 3 + 1)] = 0; img.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3); }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`map written to ${out}`);
console.log(errors.length ? `${errors.length} problem(s):\n  ${errors.join('\n  ')}` : 'layout OK');
process.exitCode = errors.length ? 1 : 0;
