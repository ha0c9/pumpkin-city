// 南瓜岛地铁 — a glass headhouse. One entrance on each island.
// The round mark matches the whiteboard: a circle, a line through the middle that
// runs past the rim, and a downward arrow in the upper half.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox, rod } from './materials.js';

const THREE = window.THREE;

const CJK = '"WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';
const ORANGE = 0xe25b1a;
const MARK = 512;
const MARK_R = 178;

// Stair / escalator run. High end is the street side of the well (+Z); the low end
// enters the dark concourse mouth. Everything stays above the terrain.
const Z_HI = 2.15;
const Z_LO = -0.95;
const Y_HI = 1.28;
const Y_LO = 0.22;

let glassMat = null;
let roofMat = null;
let markMat = null;
let beltMat = null;
let lampMat = null;

function drawMark(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e25b1a';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.09;
  ctx.stroke();
  ctx.lineWidth = r * 0.072;
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.22, cy);
  ctx.lineTo(cx + r * 1.22, cy);
  ctx.stroke();
  const tip = cy - r * 0.14;
  const top = cy - r * 0.74;
  ctx.lineWidth = r * 0.085;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, tip);
  ctx.stroke();
  const head = r * 0.36;
  ctx.beginPath();
  ctx.moveTo(cx - head, tip - head * 0.9);
  ctx.lineTo(cx, tip + r * 0.04);
  ctx.lineTo(cx + head, tip - head * 0.9);
  ctx.stroke();
  ctx.restore();
}

function markTexture() {
  const c = makeCanvas(MARK, MARK);
  drawMark(c.getContext('2d'), MARK / 2, MARK / 2, MARK_R);
  return canvasTexture(c, { anisotropy: 8 });
}

function nameTexture(name, nameEn) {
  const c = makeCanvas(1800, 420);
  const x = c.getContext('2d');
  x.fillStyle = '#f6f3ee';
  x.fillRect(0, 0, 1800, 420);
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.fillStyle = '#1b1916';
  x.font = `bold 176px ${CJK}`;
  x.fillText(name, 28, 158);
  x.fillStyle = '#e25b1a';
  x.font = 'bold 48px Arial, sans-serif';
  x.fillText(String(nameEn || '').toUpperCase(), 32, 318);
  x.fillStyle = '#ead8c4';
  x.fillRect(980, 78, 5, 264);
  x.fillStyle = '#1b1916';
  x.font = `bold 132px ${CJK}`;
  x.fillText('南瓜地铁', 1036, 145);
  x.fillStyle = '#e25b1a';
  x.font = 'italic 72px Arial, sans-serif';
  x.fillText('in the ground', 1040, 292);
  return canvasTexture(c, { anisotropy: 8 });
}

function totemTexture(name) {
  const c = makeCanvas(640, 1680);
  const x = c.getContext('2d');
  x.fillStyle = '#f6f3ee';
  x.fillRect(0, 0, 640, 1680);
  x.strokeStyle = '#e25b1a';
  x.lineWidth = 26;
  x.strokeRect(18, 18, 604, 1644);
  drawMark(x, 320, 390, 200);
  x.fillStyle = '#1b1916';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold 210px ${CJK}`;
  const chars = [...name];
  const top = 860;
  const bot = 1520;
  chars.forEach((ch, i) => {
    const y = chars.length === 1 ? (top + bot) / 2 : top + ((bot - top) * i) / (chars.length - 1);
    x.fillText(ch, 320, y);
  });
  return canvasTexture(c, { anisotropy: 8 });
}

function beltTexture() {
  const c = makeCanvas(64, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#f0c31a';
  x.fillRect(0, 0, 64, 128);
  x.fillStyle = '#1a1c20';
  x.fillRect(0, 0, 64, 16);
  x.fillStyle = '#d9a20f';
  x.fillRect(0, 16, 64, 10);
  x.fillStyle = '#ffe38a';
  x.fillRect(0, 108, 64, 8);
  const tex = canvasTexture(c, { anisotropy: 4 });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function signMaterial(ctx, map) {
  const m = new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.22,
    roughness: 0.55, metalness: 0.04,
  });
  ctx.nightMaterials.push({ material: m, intensity: 0.9, base: 0.22 });
  return m;
}

function materials(ctx) {
  if (!glassMat) {
    glassMat = new THREE.MeshStandardMaterial({
      color: 0xd5e7f0, metalness: 0.55, roughness: 0.05,
      transparent: true, opacity: 0.38, envMapIntensity: 1.35,
      side: THREE.DoubleSide, depthWrite: false,
    });
    roofMat = glassMat.clone();
    roofMat.opacity = 0.42;
    roofMat.depthWrite = false;
    roofMat.color.set(0xb7d4e4);
    ctx.nightMaterials.push({ material: glassMat, intensity: 0.25 });
    ctx.nightMaterials.push({ material: roofMat, intensity: 0.3 });

    const markMap = markTexture();
    markMat = new THREE.MeshStandardMaterial({
      map: markMap, transparent: true, alphaTest: 0.35,
      roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide,
    });

    const beltMap = beltTexture();
    beltMap.repeat.set(1, 1);
    beltMat = new THREE.MeshStandardMaterial({
      map: beltMap, roughness: 0.45, metalness: 0.15, color: 0xfff2c4,
    });

    lampMat = new THREE.MeshStandardMaterial({
      color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.55, roughness: 0.4,
    });
    ctx.nightMaterials.push({ material: lampMat, intensity: 1.6, base: 0.55 });
  }
  return { glassMat, roofMat, markMat, beltMat, lampMat };
}

/** Group whose local +Z runs from the high end down the slope to the low end. */
function slopeGroup(x, z0, y0, z1, y1) {
  const g = new THREE.Group();
  const len = Math.hypot(z1 - z0, y1 - y0);
  g.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
  g.rotation.x = Math.atan2(-(y1 - y0), z1 - z0);
  g.userData.len = len;
  return g;
}

function pavilion(g, mats) {
  const steel = colorMat(0x2c3238, { roughness: 0.35, metalness: 0.75 });
  const white = colorMat(0xf4f1ea, { roughness: 0.55 });
  const orange = colorMat(ORANGE, { roughness: 0.42 });
  const dark = colorMat(0x12141a, { roughness: 0.92 });

  tiledBox(g, 14.4, 0.06, 11.2, 0, 0.04, -0.2, sharedMaterial('paving'), 0.35);
  box(g, 8.5, 0.08, 6.5, 0, 0.08, -0.7, dark, { cast: false });

  const corners = [[-4.15, 2.55], [4.15, 2.55], [-4.15, -3.7], [4.15, -3.7]];
  for (const [x, z] of corners) box(g, 0.18, 3.72, 0.18, x, 1.86, z, steel);
  for (const x of [-4.15, 4.15]) {
    for (const z of [-1.6, 0.5]) box(g, 0.1, 3.55, 0.1, x, 1.78, z, steel);
  }

  const wall = (w, h, x, y, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glassMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    g.add(m);
  };
  wall(6.1, 3.35, -4.15, 1.85, -0.55, Math.PI / 2);
  wall(6.1, 3.35, 4.15, 1.85, -0.55, Math.PI / 2);
  wall(8.1, 1.85, 0, 2.7, -3.7, 0);

  box(g, 8.7, 0.1, 0.14, 0, 3.68, 2.55, steel);
  box(g, 8.7, 0.1, 0.14, 0, 3.68, -3.7, steel);
  box(g, 0.12, 0.1, 6.3, -4.15, 3.68, -0.58, steel);
  box(g, 0.12, 0.1, 6.3, 4.15, 3.68, -0.58, steel);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 6.05), mats.roofMat);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(0, 3.74, -0.58);
  g.add(roof);
  box(g, 8.5, 0.07, 0.1, 0, 3.52, 2.58, orange);

  // Narrow threshold. The flight itself stays in view under the glass roof.
  box(g, 7.6, 0.1, 0.36, 0, Y_HI - 0.02, Z_HI + 0.22, white);
  box(g, 7.6, 0.045, 0.08, 0, Y_HI + 0.04, Z_HI + 0.04, orange);
}

function stairs(g) {
  const tread = colorMat(0xe4e0d8, { roughness: 0.72 });
  const riser = colorMat(0xc8c3b8, { roughness: 0.8 });
  const nose = colorMat(ORANGE, { roughness: 0.45 });
  const steel = colorMat(0x2c3238, { roughness: 0.35, metalness: 0.75 });
  const x0 = -3.55;
  const x1 = -0.42;
  const w = x1 - x0;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 1) / n;
    const zA = Z_HI + (Z_LO - Z_HI) * a;
    const zB = Z_HI + (Z_LO - Z_HI) * b;
    const yA = Y_HI + (Y_LO - Y_HI) * a;
    const yB = Y_HI + (Y_LO - Y_HI) * b;
    const zc = (zA + zB) / 2;
    box(g, w, 0.07, Math.abs(zB - zA) * 0.96, (x0 + x1) / 2, yB - 0.035, zc, tread);
    box(g, w, Math.max(0.04, yA - yB), 0.05, (x0 + x1) / 2, (yA + yB) / 2, zA, riser);
    box(g, w, 0.025, 0.06, (x0 + x1) / 2, yB + 0.01, zA - 0.02, nose);
  }
  for (const x of [x0, x1]) {
    rod(g, new THREE.Vector3(x, Y_HI + 0.95, Z_HI), new THREE.Vector3(x, Y_LO + 0.95, Z_LO), 0.045, steel, 8);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const z = Z_HI + (Z_LO - Z_HI) * t;
      const y = Y_HI + (Y_LO - Y_HI) * t;
      box(g, 0.05, 0.95, 0.05, x, y + 0.48, z, steel);
    }
  }
}

function escalator(g, mats) {
  const steel = colorMat(0x1a1d22, { roughness: 0.4, metalness: 0.55 });
  const groove = colorMat(0x1a1c20, { roughness: 0.5, metalness: 0.3 });
  const x0 = 0.5;
  const x1 = 3.5;
  const mid = (x0 + x1) / 2;
  const w = x1 - x0;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 1) / n;
    const zA = Z_HI + (Z_LO - Z_HI) * a;
    const zB = Z_HI + (Z_LO - Z_HI) * b;
    const yA = Y_HI + (Y_LO - Y_HI) * a;
    const yB = Y_HI + (Y_LO - Y_HI) * b;
    const zc = (zA + zB) / 2;
    box(g, w - 0.36, 0.08, Math.abs(zB - zA) * 0.78, mid, yB + 0.02, zc, mats.beltMat);
    box(g, w - 0.36, Math.max(0.05, yA - yB), 0.06, mid, (yA + yB) / 2, zA, groove);
  }
  const slope = slopeGroup(mid, Z_HI, Y_HI, Z_LO, Y_LO);
  const len = slope.userData.len;
  g.add(slope);
  for (const s of [-1, 1]) {
    box(slope, 0.08, 0.08, len, s * (w / 2 - 0.12), 0.16, 0, steel);
    box(slope, 0.06, 0.05, len, s * (w / 2 - 0.12), 0.78, 0, steel);
  }
  const bal = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.55), mats.glassMat);
  bal.position.set(-w / 2 + 0.16, 0.46, 0);
  bal.rotation.y = Math.PI / 2;
  slope.add(bal);
}

function concourse(g, mats) {
  const dark = colorMat(0x101218, { roughness: 0.95 });
  const steel = colorMat(0x2c3238, { roughness: 0.4, metalness: 0.7 });
  const orange = colorMat(ORANGE, { roughness: 0.42 });
  // Mouth frame. Open toward the stairs (+Z).
  const mouth = Z_LO - 0.18;
  box(g, 0.16, 1.7, 0.18, -3.72, 0.95, mouth, steel);
  box(g, 0.16, 1.7, 0.18, 3.72, 0.95, mouth, steel);
  box(g, 7.6, 0.16, 0.18, 0, 1.76, mouth, orange);
  box(g, 7.5, 1.55, 0.16, 0, 0.86, -3.62, dark);
  box(g, 0.16, 1.55, 2.15, -3.78, 0.86, -2.45, dark);
  box(g, 0.16, 1.55, 2.15, 3.78, 0.86, -2.45, dark);
  box(g, 7.5, 0.12, 2.15, 0, 1.58, -2.45, dark);
  const shades = [0x3a3e46, 0x2a2e36, 0x1c2028, 0x12141a];
  for (let i = 0; i < shades.length; i++) {
    const z = mouth - 0.28 - i * 0.32;
    box(g, 3.05, 0.06, 0.26, -1.95, 0.16 - i * 0.02, z, colorMat(shades[i], { roughness: 0.85 }), { cast: false });
  }
  for (const x of [-2.4, 0, 2.4]) box(g, 0.35, 0.06, 0.12, x, 1.48, mouth - 0.7, mats.lampMat, { cast: false });
  for (const x of [-1.6, 1.6]) box(g, 0.28, 0.05, 0.1, x, 1.44, -3.2, mats.lampMat, { cast: false });
}

function header(g, ctx, mats, name, nameEn) {
  const white = colorMat(0xf6f3ee, { roughness: 0.5 });
  const orange = colorMat(ORANGE, { roughness: 0.42 });
  box(g, 7.6, 1.28, 0.14, 0.15, 3.02, 2.48, white);
  box(g, 7.6, 0.07, 0.16, 0.15, 2.36, 2.48, orange);
  const logoSize = 1.22;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(logoSize, logoSize), mats.markMat);
  logo.position.set(-2.72, 3.04, 2.58);
  g.add(logo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(logoSize * MARK_R / MARK, 0.035, 8, 40), orange);
  ring.position.copy(logo.position);
  ring.position.z -= 0.01;
  g.add(ring);
  const tex = nameTexture(name, nameEn);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.35, 1.25), signMaterial(ctx, tex));
  face.position.set(0.72, 3.02, 2.58);
  g.add(face);
}

function totem(g, ctx, name) {
  const orange = colorMat(ORANGE, { roughness: 0.42 });
  const steel = colorMat(0x2c3238, { roughness: 0.35, metalness: 0.75 });
  const concrete = sharedMaterial('concrete');
  box(g, 1.15, 0.16, 0.55, 6.05, 0.12, 1.7, concrete);
  box(g, 0.1, 3.15, 0.1, 6.05, 1.7, 1.58, steel);
  const faceMat = signMaterial(ctx, totemTexture(name));
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.92, 3.05, 0.06), [orange, orange, orange, orange, faceMat, faceMat]);
  board.position.set(6.05, 1.78, 1.72);
  board.castShadow = true;
  g.add(board);
}

function create(ctx, spec) {
  const g = new THREE.Group();
  const mats = materials(ctx);
  const name = spec.name || '地铁站';
  const nameEn = spec.nameEn || 'Metro';
  pavilion(g, mats);
  stairs(g);
  escalator(g, mats);
  concourse(g, mats);
  header(g, ctx, mats, name, nameEn);
  totem(g, ctx, name);
  g.userData.height = 4.2;
  // The step grooves scroll down into the concourse. One shared map, so every entrance moves together.
  g.userData.animate = (t) => {
    if (mats.beltMat.map) mats.beltMat.map.offset.y = (t * 0.45) % 1;
  };
  return g;
}

registerBuilding('subwayEntrance', {
  label: '地铁 Metro',
  footprint: [15, 12],
  create,
});
