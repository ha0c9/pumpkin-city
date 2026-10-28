// Validate js/config/city.layout.js against the island terrain and draw a top-down map.
// Usage: node tools/check-layout.mjs [out.png]
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { ISLANDS, TERRAIN, CITY_GROUND } from '../js/config/world.config.js';
import { ROADS, ROAD_STYLE, BRIDGES, LANDMARKS, LOTS } from '../js/config/city.layout.js';
import { IslandField } from '../js/world/IslandField.js';
import { BridgePath } from '../js/world/BridgePath.js';

// Keep in sync with the building modules' `footprint`.
const FOOTPRINTS = {
  americaTower: [36, 33], americaMuseum: [52, 42], heritageMuseum: [33, 36], school: [46, 58],
  homeInn: [40, 22], policeStation: [54, 50], fourSeasons: [68, 98], ghostMuseum: [46, 46], oceanMuseum: [74, 26],
  oceanGallery: [40, 34], scienceMuseum: [60, 60], americaTower2: [36, 33], planetarium: [116, 40],
  orientalPearl: [70, 70], fulaiTower: [40, 40],
  equestrianCenter: [74, 52], schoolAheadSign: [0.8, 0.8], airport: [200, 120],
};

const t0 = Date.now();
const field = new IslandField(ISLANDS, { ...TERRAIN, plateau: CITY_GROUND });
console.log(`height grid ${field.n}x${field.n} baked in ${Date.now() - t0} ms`);

const errors = [];
const groundAt = (x, z) => { const isl = field.islandAt(x, z); return isl ? isl.height : CITY_GROUND; };
const flat = (x, z) => Math.abs(field.rawHeight(x, z) - groundAt(x, z)) < 0.03;
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

// Bridges: same curve as js/world/Bridges.js.
const bridges = BRIDGES.map((b) => {
  const path = new BridgePath(b, field);
  if (!path.ok) { errors.push(`bridge ${b.id} never reaches the water`); return { b, path }; }
  const endIsland = field.islandAt(...b.end);
  if (!endIsland || endIsland.id !== b.to) errors.push(`bridge ${b.id} end ${b.end} is not on ${b.to}`);
  let maxGrade = 0, minClear = Infinity;
  const n = Math.ceil(path.length / 2);
  for (let i = 0; i < n; i++) {
    const s0 = i / n, s1 = (i + 1) / n;
    maxGrade = Math.max(maxGrade, Math.abs(path.deckY(s1) - path.deckY(s0)) / (path.length / n));
    if (s0 > 0.06 && s0 < 0.94) {
      const c = path.at(s0);
      minClear = Math.min(minClear, path.deckY(s0) - field.heightAt(c.x, c.z));
    }
  }
  console.log(`bridge ${b.id}: A=${path.A.map((v) => v.toFixed(0))} (h ${path.hA.toFixed(1)}) B=${path.B.map((v) => v.toFixed(0))} (h ${path.hB.toFixed(1)}) length ${path.length.toFixed(0)} m, max grade ${(maxGrade * 100).toFixed(1)}%, min clearance ${minClear.toFixed(1)} m`);
  if (maxGrade > 0.08) errors.push(`bridge ${b.id} is too steep (${(maxGrade * 100).toFixed(1)}%)`);
  if (minClear < 0.2) errors.push(`bridge ${b.id} deck cuts into land (clearance ${minClear.toFixed(1)} m)`);
  return { b, path };
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
    else if (h <= groundAt(x, z) + 0.02) c = [100 - h * 3, 160 - h * 4, 70 - h * 2];
    else { const k = Math.min(1, (h - groundAt(x, z)) / 20); c = [90 + 90 * k, 150 - 20 * k, 70 + 50 * k]; }
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
for (const { b, path } of bridges) {
  if (!path.ok) continue;
  const w = (b.lanes || 2) * ROAD_STYLE.laneWidth + 2 * ROAD_STYLE.sidewalk;
  const n = Math.ceil(path.length / 2);
  for (let i = 0; i < n; i++) {
    const c = path.at((i + 0.5) / n);
    fillRect(c.x, c.z, path.length / n + 1, w, Math.atan2(-c.tz, c.tx), [200, 200, 205]);
  }
  for (const [p, q] of [[b.from, path.A], [path.B, b.end]]) {
    fillRect((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.abs(p[0] - q[0]) || w, Math.abs(p[1] - q[1]) || w, 0, [70, 70, 75]);
  }
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
