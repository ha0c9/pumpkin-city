// 南瓜公园 Pumpkin Park — an L of three blocks north of 南瓜大道.
// Northwest (empty lawn) holds the Christmas tree. Southwest and the block north of
// 愚园路, west of 中山路, were pocket parks. Lights are MeshBasic so they stay warm at noon.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, textTexture, mulberry32 } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, mesh } from './materials.js';

const THREE = window.THREE;

const bulbGold = new THREE.MeshBasicMaterial({ color: 0xffc53d });
const bulbRed = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
const bulbWhite = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
const windowGlow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
const jetMat = new THREE.MeshBasicMaterial({ color: 0xbfe9f6 });

const wood = colorMat(0x8a5a32, { roughness: 0.82 });
const woodDark = colorMat(0x6b3e24, { roughness: 0.85 });
const snow = colorMat(0xf4f7fb, { roughness: 0.62 });
const leaf = colorMat(0x0e6a28, { roughness: 0.9 });
const leafDark = colorMat(0x0a4c1c, { roughness: 0.92 });
const lawnMat = colorMat(0x5c9e45, { roughness: 0.96 });
const redCloth = colorMat(0xc0392b, { roughness: 0.55 });
const goldTrim = colorMat(0xd4af37, { metalness: 0.55, roughness: 0.35 });
const lodge = colorMat(0x8d4b2e, { roughness: 0.78 });
const FONT = '"WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';

let awningMat = null;
function awning() {
  if (awningMat) return awningMat;
  const c = makeCanvas(64, 32);
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#f6f1e6' : '#d21f28';
    g.fillRect(i * 8, 0, 8, 32);
  }
  awningMat = new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.62 });
  return awningMat;
}

let starMat = null;
function starPlazaMat() {
  if (starMat) return starMat;
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#8f1d28';
  g.fillRect(0, 0, S, S);
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2);
  g.fillStyle = '#f3ead6';
  g.fill();
  g.lineWidth = 22;
  g.strokeStyle = '#f6d56a';
  g.stroke();
  g.beginPath();
  const R = S * 0.40, r = S * 0.16;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    const x = S / 2 + Math.cos(a) * rad;
    const y = S / 2 + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#f0c43a';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#fff6d0';
  g.stroke();
  // Unlit, so the gold star stays gold under the noon sun.
  starMat = new THREE.MeshBasicMaterial({ map: canvasTexture(c, { anisotropy: 8 }) });
  return starMat;
}

function bulbs(group, pts, mat) {
  if (!pts.length) return;
  const geo = new THREE.SphereGeometry(0.28, 7, 5);
  const inst = new THREE.InstancedMesh(geo, mat, pts.length);
  inst.castShadow = false;
  inst.receiveShadow = false;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  pts.forEach((b, i) => {
    p.set(b[0], b[1], b[2]);
    s.set(b[3] || 1, b[3] || 1, b[3] || 1);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
}

function disk(group, r, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function lawn(group, w, d) {
  box(group, w, 0.16, d, 0, 0.08, 0, lawnMat, { cast: false });
}

function flowerBed(group, x, z, w, d, rng) {
  box(group, w, 0.32, d, x, 0.22, z, colorMat(0x4a3424, { roughness: 1 }), { cast: false });
  const colors = [0xe23b3b, 0xf7f4ee, 0xf0c84a];
  const geo = new THREE.SphereGeometry(0.16, 5, 4);
  const count = Math.round(w * d * 2.2);
  const meshes = colors.map((c) => new THREE.InstancedMesh(geo, colorMat(c, { roughness: 0.6 }), count));
  const n = [0, 0, 0];
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rng() * colors.length);
    mtx.makeTranslation(x + (rng() - 0.5) * (w - 0.4), 0.5 + rng() * 0.12, z + (rng() - 0.5) * (d - 0.4));
    meshes[k].setMatrixAt(n[k]++, mtx);
  }
  meshes.forEach((m, i) => {
    m.count = n[i];
    m.castShadow = false;
    m.receiveShadow = false;
    if (n[i]) group.add(m);
  });
}

function bench(group, x, z, rot) {
  const b = new THREE.Group();
  box(b, 1.8, 0.08, 0.46, 0, 0.48, 0, wood);
  box(b, 1.8, 0.42, 0.08, 0, 0.78, -0.2, wood);
  for (const sx of [-0.78, 0.78]) box(b, 0.08, 0.46, 0.42, sx, 0.24, 0, sharedMaterial('darkSteel'));
  b.position.set(x, 0, z);
  b.rotation.y = rot;
  group.add(b);
}

function sign(group, x, z, rot) {
  box(group, 0.16, 3.1, 0.16, x - 3.3, 1.55, z, sharedMaterial('darkSteel'));
  box(group, 0.16, 3.1, 0.16, x + 3.3, 1.55, z, sharedMaterial('darkSteel'));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.4), new THREE.MeshStandardMaterial({
    map: textTexture(['南瓜公园', 'PUMPKIN PARK'], {
      width: 1024, height: 320, bg: '#7d1d24', color: '#ffe7a3',
      font: `bold 148px ${FONT}`,
      subFont: `600 62px ${FONT}`,
    }),
    roughness: 0.55,
    side: THREE.DoubleSide,
  }));
  board.position.set(x, 3.15, z);
  board.rotation.y = rot;
  group.add(board);
}

function litTree(group, x, z, scale, golds, reds, whites) {
  mesh(group, new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 1.1 * scale, 6), woodDark, x, 0.55 * scale, z);
  mesh(group, new THREE.ConeGeometry(1.35 * scale, 2.4 * scale, 8), leaf, x, 1.9 * scale, z);
  mesh(group, new THREE.ConeGeometry(0.95 * scale, 1.8 * scale, 8), leafDark, x, 3.0 * scale, z);
  const top = mesh(group, new THREE.ConeGeometry(0.22 * scale, 0.7 * scale, 4), snow, x, 3.85 * scale, z);
  top.castShadow = false;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const y = 1.5 * scale + (i % 3) * 0.7 * scale;
    const rad = (1.15 - i * 0.1) * scale;
    const list = i % 3 === 0 ? reds : i % 3 === 1 ? golds : whites;
    list.push([x + Math.cos(a) * rad, y, z + Math.sin(a) * rad, 0.85]);
  }
}

function giantTree(group, golds, reds, whites) {
  mesh(group, new THREE.CylinderGeometry(0.55, 0.8, 2.6, 8), woodDark, 0, 1.3, 0);
  const layers = [
    [6.4, 4.6, 4.4, leaf],
    [5.1, 4.0, 7.4, leafDark],
    [3.8, 3.6, 10.2, leaf],
    [2.6, 3.1, 12.6, leafDark],
    [1.5, 2.5, 14.8, leaf],
  ];
  for (const [rad, h, y, mat] of layers) {
    mesh(group, new THREE.ConeGeometry(rad, h, 10), mat, 0, y, 0);
    const n = Math.round(10 + rad);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + y;
      const list = i % 3 === 0 ? reds : i % 3 === 1 ? golds : whites;
      list.push([Math.cos(a) * rad * 0.72, y - h * 0.05, Math.sin(a) * rad * 0.72, 1.7]);
    }
  }
  const star = mesh(group, new THREE.OctahedronGeometry(1.35, 0), bulbGold, 0, 16.8, 0);
  star.castShadow = false;
  mesh(group, new THREE.ConeGeometry(1.15, 1.1, 4), snow, 0, 15.9, 0).castShadow = false;
}

function gifts(group) {
  const piles = [[-3.2, 2.4, 0xc0392b, 0xf4f1ea], [2.6, 1.6, 0x1c7a34, 0xf0c84a], [1.2, -2.8, 0xd4af37, 0xc0392b], [-1.4, -2.2, 0x8d4b2e, 0xf7f4ee]];
  for (const [x, z, body, ribbon] of piles) {
    box(group, 1.15, 0.85, 1.05, x, 0.55, z, colorMat(body, { roughness: 0.55 }));
    box(group, 1.2, 0.1, 0.16, x, 0.95, z, colorMat(ribbon, { roughness: 0.45 }));
    box(group, 0.16, 0.9, 1.1, x, 0.55, z, colorMat(ribbon, { roughness: 0.45 }));
  }
}

function fountain(group, x, z, scale) {
  const stone = sharedMaterial('stone');
  mesh(group, new THREE.CylinderGeometry(2.15 * scale, 2.3 * scale, 0.55, 18), stone, x, 0.4, z);
  mesh(group, new THREE.CylinderGeometry(1.7 * scale, 1.7 * scale, 0.28, 18), sharedMaterial('water'), x, 0.62, z);
  const holder = new THREE.Group();
  holder.userData.dynamic = true;
  holder.position.set(x, 0.7, z);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.22 * scale, 1.5 * scale, 7), jetMat);
  jet.position.y = 0.75 * scale;
  jet.castShadow = false;
  holder.add(jet);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 6, 5), jetMat);
  drop.position.y = 1.55 * scale;
  drop.castShadow = false;
  holder.add(drop);
  group.add(holder);
  holder.userData.jetScale = scale;
  return holder;
}

function catenary(golds, reds, whites, ax, az, bx, bz, y, droop) {
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sag = Math.sin(t * Math.PI) * droop;
    const list = i % 3 === 0 ? reds : i % 3 === 1 ? golds : whites;
    list.push([ax + (bx - ax) * t, y - sag, az + (bz - az) * t, 0.8]);
  }
}

function posts(group, golds, reds, whites, corners, y, droop) {
  for (const [x, z] of corners) {
    mesh(group, new THREE.CylinderGeometry(0.08, 0.1, y, 6), sharedMaterial('darkSteel'), x, y / 2, z);
    golds.push([x, y + 0.15, z, 1.1]);
  }
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    catenary(golds, reds, whites, a[0], a[1], b[0], b[1], y, droop);
  }
}

function parkSignAndLawn(group, w, d) {
  lawn(group, w, d);
  const curb = sharedMaterial('stone');
  box(group, w, 0.22, 0.45, 0, 0.16, d / 2 - 0.25, curb, { cast: false });
  box(group, w, 0.22, 0.45, 0, 0.16, -d / 2 + 0.25, curb, { cast: false });
  box(group, 0.45, 0.22, d, w / 2 - 0.25, 0.16, 0, curb, { cast: false });
  box(group, 0.45, 0.22, d, -w / 2 + 0.25, 0.16, 0, curb, { cast: false });
}

function buildGarden(group, spec, rng, golds, reds, whites) {
  const [W, D] = spec.footprint;
  parkSignAndLawn(group, W, D);
  disk(group, 9.5, 0, 0.2, -1, sharedMaterial('paving'));
  disk(group, 7.2, 0, 0.22, -1, colorMat(0xe7e0d4, { roughness: 0.85 }));
  const jet = fountain(group, 0, -1, 1.15);
  flowerBed(group, -16, -12, 8, 5, rng);
  flowerBed(group, 16, -12, 8, 5, rng);
  flowerBed(group, -16, 10, 7, 4.5, rng);
  flowerBed(group, 16, 10, 7, 4.5, rng);
  const spots = [[-20, -6], [20, -6], [-20, 8], [20, 8], [-8, 14], [8, 14], [0, -16]];
  for (const [x, z] of spots) litTree(group, x, z, 1.15, golds, reds, whites);
  posts(group, golds, reds, whites, [[-22, -16], [22, -16], [22, 16], [-22, 16]], 4.2, 0.7);
  bench(group, -10, 6, 0);
  bench(group, 10, 6, Math.PI);
  bench(group, -10, -10, Math.PI / 2);
  sign(group, 0, D / 2 - 1.4, 0);
  return { jets: [jet], spinner: null, height: 6 };
}

function buildTree(group, spec, rng, golds, reds, whites) {
  const [W, D] = spec.footprint;
  parkSignAndLawn(group, W, D);
  const ring = new THREE.Mesh(new THREE.RingGeometry(16.2, 17.6, 48), new THREE.MeshBasicMaterial({ color: 0xc0392b }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  ring.receiveShadow = true;
  group.add(ring);
  disk(group, 16.2, 0, 0.22, 0, starPlazaMat());
  giantTree(group, golds, reds, whites);
  gifts(group);
  const jet = fountain(group, 14, 13, 0.85);
  flowerBed(group, -20, 14, 7, 4, rng);
  flowerBed(group, 20, -14, 6, 4, rng);
  for (const [x, z] of [[-22, -16], [22, -16], [-22, 16], [22, 12]]) litTree(group, x, z, 1.05, golds, reds, whites);
  const corners = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    corners.push([Math.cos(a) * 14.2, Math.sin(a) * 14.2]);
  }
  posts(group, golds, reds, whites, corners, 3.6, 0.85);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    bench(group, Math.cos(a) * 12.2, Math.sin(a) * 12.2, -a + Math.PI);
  }
  sign(group, 0, D / 2 - 1.4, 0);
  return { jets: [jet], spinner: null, height: 24 };
}

function stall(group, x, z, rot) {
  const s = new THREE.Group();
  box(s, 4.4, 1.05, 2.15, 0, 0.62, 0, wood);
  box(s, 4.5, 0.1, 2.3, 0, 1.15, 0, woodDark);
  const aw = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.08, 2.7), awning());
  aw.position.set(0, 2.45, 0.25);
  aw.rotation.x = -0.22;
  aw.castShadow = true;
  s.add(aw);
  for (const dx of [-2.15, 2.15]) box(s, 0.12, 2.35, 0.12, dx, 1.2, 1.2, woodDark);
  for (const [dx, col] of [[-1.2, 0xc0392b], [0, 0x1c7a34], [1.2, 0xd4af37]]) {
    box(s, 0.55, 0.45, 0.55, dx, 1.45, 0.15, colorMat(col, { roughness: 0.5 }));
  }
  s.position.set(x, 0, z);
  s.rotation.y = rot;
  group.add(s);
}

function carousel(group, x, z) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  g.position.set(x, 0, z);
  const deck = mesh(g, new THREE.CylinderGeometry(4.3, 4.5, 0.4, 16), colorMat(0xf3efe6, { roughness: 0.6 }), 0, 0.28, 0);
  deck.castShadow = false;
  mesh(g, new THREE.CylinderGeometry(0.16, 0.2, 3.6, 8), goldTrim, 0, 2.2, 0);
  mesh(g, new THREE.ConeGeometry(4.7, 1.8, 12), redCloth, 0, 4.3, 0);
  mesh(g, new THREE.ConeGeometry(4.9, 0.28, 12), snow, 0, 3.3, 0);
  const coats = [0xc0392b, 0x2f7fd0, 0xf0c84a, 0xf7f4ee];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const h = new THREE.Group();
    const coat = colorMat(coats[i], { roughness: 0.55 });
    box(h, 1.35, 0.42, 0.42, 0, 1.05, 0, coat);
    box(h, 0.38, 0.36, 0.48, 0.72, 1.35, 0, coat);
    box(h, 0.12, 0.7, 0.12, 0.35, 0.7, 0.12, woodDark);
    box(h, 0.12, 0.7, 0.12, 0.35, 0.7, -0.12, woodDark);
    h.position.set(Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7);
    h.rotation.y = -a + Math.PI / 2;
    g.add(h);
  }
  group.add(g);
  return g;
}

function chalet(group, golds, reds, whites, ox, oz) {
  const g = new THREE.Group();
  // Door (local +Z) turns to face west, toward the Christmas tree.
  g.position.set(ox, 0, oz);
  g.rotation.y = Math.PI / 2;
  group.add(g);
  const put = (list, x, y, z, s) => list.push([ox - z, y, oz + x, s]);
  box(g, 16, 6.2, 10, 0, 3.2, 0, lodge);
  box(g, 0.4, 6.2, 0.4, -7.85, 3.2, 4.85, snow);
  box(g, 0.4, 6.2, 0.4, 7.85, 3.2, 4.85, snow);
  box(g, 16.3, 0.4, 0.4, 0, 6.15, 4.85, snow);
  box(g, 16.4, 0.35, 10.4, 0, 6.4, 0, snow);
  const roof = mesh(g, new THREE.ConeGeometry(8.6, 4.2, 4), snow, 0, 8.5, 0);
  roof.rotation.y = Math.PI / 4;
  // Steeple on the north face (local +Z). A star, not a cross.
  box(g, 2.4, 7.5, 2.4, 0, 8.2, 3.6, colorMat(0xf7f4ee, { roughness: 0.55 }));
  mesh(g, new THREE.ConeGeometry(1.8, 3.2, 4), snow, 0, 13.4, 3.6).rotation.y = Math.PI / 4;
  const spire = mesh(g, new THREE.OctahedronGeometry(0.55, 0), bulbGold, 0, 15.5, 3.6);
  spire.castShadow = false;
  // Door and warm windows face local +Z.
  box(g, 1.8, 2.6, 0.12, 0, 1.5, 5.06, woodDark);
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 6, 14), leaf);
  wreath.position.set(0, 1.7, 5.16);
  g.add(wreath);
  for (const [wx, wy] of [[-5.2, 3.4], [-2.4, 3.4], [2.4, 3.4], [5.2, 3.4], [-3.8, 5.1], [3.8, 5.1]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.15), windowGlow);
    win.position.set(wx, wy, 5.08);
    g.add(win);
  }
  for (const [wx, wz] of [[-8.2, 4.2], [8.2, 4.2], [-8.2, -4.2], [8.2, -4.2]]) {
    put(golds, wx, 6.7, wz, 1);
    put(reds, wx * 0.55, 7.6, wz * 0.7, 0.9);
  }
  catenary(golds, reds, whites, ox - 5, oz - 8, ox - 5, oz + 8, 6.5, 0.45);
}

function lightArch(group, x, z, rot, golds, reds, whites) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const to = (lx, ly) => [x + lx * c, ly, z - lx * s];
  for (const lx of [-3.3, 3.3]) {
    const p = to(lx, 0);
    mesh(group, new THREE.CylinderGeometry(0.1, 0.12, 3.3, 6), colorMat(0xf7f4ee, { roughness: 0.5 }), p[0], 1.65, p[2]);
  }
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI * (i / 16);
    const p = to(Math.cos(t) * 3.3, 3.3 + Math.sin(t) * 1.7);
    const list = i % 3 === 0 ? reds : i % 3 === 1 ? golds : whites;
    list.push([p[0], p[1], p[2], 1.15]);
  }
}

function buildMarket(group, spec, rng, golds, reds, whites) {
  const [W, D] = spec.footprint;
  parkSignAndLawn(group, W, D);
  // Lodge on the west side, facing the tree. Stalls and the carousel fill the east side.
  box(group, 3.2, 0.08, 30, 6, 0.2, 2, sharedMaterial('paving'), { cast: false });
  box(group, 24, 0.08, 3.2, 4, 0.2, 8, sharedMaterial('paving'), { cast: false });
  chalet(group, golds, reds, whites, -8, 0);
  stall(group, 6, 14, 0.2);
  stall(group, 16, -6, -Math.PI / 2);
  stall(group, 2, -14, Math.PI);
  const spinner = carousel(group, 16, 6);
  lightArch(group, -2, 18, 0, golds, reds, whites);
  flowerBed(group, 18, -16, 6, 3.2, rng);
  flowerBed(group, -18, 16, 5, 3.2, rng);
  for (const [x, z] of [[-20, -16], [20, 18], [20, -16], [-4, 18]]) litTree(group, x, z, 0.95, golds, reds, whites);
  posts(group, golds, reds, whites, [[-20, 18], [20, 18], [20, -18], [-20, -18]], 4.4, 0.8);
  bench(group, 8, -8, 0.4);
  bench(group, -2, 12, Math.PI / 2);
  bench(group, 8, 4, Math.PI);
  sign(group, 0, D / 2 - 1.5, 0);
  return { jets: [], spinner, height: 16 };
}

registerBuilding('pumpkinPark', {
  label: '南瓜公园 Pumpkin Park',
  footprint: [56, 46],
  info(spec) {
    return {
      name: '南瓜公园',
      nameEn: 'Pumpkin Park',
      featured: spec.kind === 'tree',
    };
  },
  create(ctx, spec) {
    // Flowers use their own generator. The city RNG is already mid-stream here and
    // still has to shuffle the facility lots the same way as before.
    const rng = mulberry32((Math.abs(Math.round(spec.position[0] * 17 + spec.position[1] * 31)) + 9) >>> 0);
    const group = new THREE.Group();
    const golds = [], reds = [], whites = [];
    const kind = spec.kind || 'tree';
    const built = kind === 'garden'
      ? buildGarden(group, spec, rng, golds, reds, whites)
      : kind === 'market'
        ? buildMarket(group, spec, rng, golds, reds, whites)
        : buildTree(group, spec, rng, golds, reds, whites);
    bulbs(group, golds, bulbGold);
    bulbs(group, reds, bulbRed);
    bulbs(group, whites, bulbWhite);
    group.userData.height = built.height;
    group.userData.animate = (time) => {
      const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2.3));
      const b = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2.3 + 2.2));
      bulbGold.color.setRGB(1, 0.62 + 0.28 * a, 0.18 + 0.25 * a);
      bulbRed.color.setRGB(1, 0.08 + 0.18 * b, 0.08);
      bulbWhite.color.setRGB(1, 0.9 + 0.1 * a, 0.7 + 0.25 * b);
      if (built.spinner) built.spinner.rotation.y = time * 0.32;
      for (const jet of built.jets) {
        const p = 0.72 + 0.28 * Math.sin(time * 2.6 + jet.position.x);
        jet.scale.y = p;
      }
    };
    return group;
  },
});
