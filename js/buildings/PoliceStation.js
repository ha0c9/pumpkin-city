// 南瓜岛动物城警察局 — a round sandstone hall with vertical ribs, a grass roof and a glass geodesic dome.
// The street sign reads 南瓜岛动物城警察局 / Pumpkin Island Zootopia Police Station.
// The entrance sector is open so the curved reception desk and Officer Clawhauser are visible.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, mergeColored } from '../core/Utils.js';
import { colorMat, sharedMaterial, box, mesh, tiledBox } from './materials.js';
import { donutBox, secretRoom, slothClerk, markInterior } from './easterEggs.js';

const THREE = window.THREE;

const CJK = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","WenQuanYi Micro Hei",sans-serif';

function stationSign() {
  const c = makeCanvas(1024, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#c98545';
  x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = '#8a4e22';
  x.lineWidth = 14;
  x.strokeRect(12, 12, 1000, 232);
  x.fillStyle = '#f6efe4';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold 64px ${CJK}`;
  x.fillText('南瓜岛动物城警察局', 512, 64);
  x.font = 'bold 28px Arial, sans-serif';
  x.fillText('Pumpkin Island Zootopia Police Station', 512, 118);
  return canvasTexture(c, { anisotropy: 8 });
}

/** Round badge shared by the lobby pillar and the front door. */
let cachedBadge = null;
function badgeTexture() {
  if (cachedBadge) return cachedBadge;
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.beginPath();
  x.arc(256, 256, 246, 0, Math.PI * 2);
  x.fillStyle = '#f2c14d';
  x.fill();
  x.beginPath();
  x.arc(256, 256, 214, 0, Math.PI * 2);
  x.fillStyle = '#1d4e89';
  x.fill();
  x.beginPath();
  x.arc(256, 256, 196, 0, Math.PI * 2);
  x.strokeStyle = '#f2c14d';
  x.lineWidth = 8;
  x.stroke();
  x.save();
  x.translate(256, 168);
  x.fillStyle = '#f6e27a';
  x.beginPath();
  const spikes = 5, outer = 52, inner = 22;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
  x.restore();
  x.fillStyle = '#f7f1e4';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold 52px ${CJK}`;
  x.fillText('动物城警察', 256, 278);
  x.font = '22px Arial, sans-serif';
  x.fillText('Zootopia Police', 256, 332);
  cachedBadge = canvasTexture(c, { anisotropy: 4 });
  return cachedBadge;
}

/** Upper-hemisphere icosahedron edges, packed into one strut mesh. */
function domeStruts(radius) {
  // r128 builds this geometry non-indexed, three vertices per face.
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const seen = new Set();
  const parts = [];
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 5);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const keyOf = (v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  const edge = (i, j) => {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j);
    if (a.y < 0.2 && b.y < 0.2) return;
    const ka = keyOf(a), kb = keyOf(b);
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (seen.has(key)) return;
    seen.add(key);
    const len = a.distanceTo(b);
    if (len < 1e-4) return;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    q.setFromUnitVectors(up, b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.09, len, 0.09));
    parts.push({ geometry: cyl, matrix: m, color: 0xf7f4ee });
  };
  for (let i = 0; i < pos.count; i += 3) {
    edge(i, i + 1); edge(i + 1, i + 2); edge(i + 2, i);
  }
  geo.dispose();
  const out = mergeColored(parts);
  cyl.dispose();
  return out;
}

function sandstoneMaterial() {
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#e09a58';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    const g = 150 + ((i * 37) % 50);
    x.fillStyle = `rgba(${g},${70 + (i % 30)},28,0.07)`;
    x.fillRect((i * 53) % 512, (i * 97) % 512, 14, 4);
  }
  x.strokeStyle = 'rgba(110,55,20,0.28)';
  x.lineWidth = 2;
  for (let y = 16; y < 512; y += 36) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(512, y);
    x.stroke();
  }
  const map = canvasTexture(c, { anisotropy: 4 });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 2);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0.02 });
}

/** Curved desk, badge pillar, ring light and the cheetah officer. Hall center is z = -3. */
function addLobby(g, ctx) {
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xd8c4a4, roughness: 0.92, emissive: 0x6a4630, emissiveIntensity: 0.18,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(13.1, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.2, -3);
  floor.receiveShadow = true;
  g.add(floor);

  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.74, side: THREE.DoubleSide });
  const woodTop = new THREE.MeshStandardMaterial({ color: 0x4a2816, roughness: 0.62, side: THREE.DoubleSide });
  const deskZ = -0.15;
  const arc0 = -1.05;
  const arcLen = 2.1;
  const shell = (radius, height, y, mat, a0 = arc0, len = arcLen) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28, 1, true, a0, len), mat);
    m.position.set(0, y, deskZ);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  shell(3.45, 1.08, 0.74, wood);
  shell(3.12, 1.02, 0.72, wood);
  shell(3.62, 0.12, 1.3, woodTop, arc0 - 0.05, arcLen + 0.1);

  const gold = colorMat(0xf0c14d, { roughness: 0.35, metalness: 0.65 });
  const onArc = (ang, r) => [Math.sin(ang) * r, deskZ + Math.cos(ang) * r];
  const [tx, tz] = onArc(0.82, 3.4);
  mesh(g, new THREE.CylinderGeometry(0.11, 0.15, 0.07, 8), gold, tx, 1.4, tz);
  mesh(g, new THREE.CylinderGeometry(0.07, 0.045, 0.16, 8), gold, tx, 1.52, tz);
  mesh(g, new THREE.SphereGeometry(0.07, 8, 6), gold, tx, 1.66, tz);
  const [jx, jz] = onArc(-0.78, 3.35);
  const jar = new THREE.MeshStandardMaterial({
    color: 0xd7f3ff, transparent: true, opacity: 0.38, roughness: 0.08,
  });
  mesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10), jar, jx, 1.48, jz, { cast: false });
  mesh(g, new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), colorMat(0xf4f1ea, { roughness: 0.4 }), jx, 1.6, jz, { cast: false });
  [0xe24b32, 0xf0c14d, 0x3d9a4a, 0x3a6fd0].forEach((col, i) => {
    const a = (i / 4) * Math.PI * 2;
    mesh(g, new THREE.SphereGeometry(0.035, 6, 4), colorMat(col, { roughness: 0.4 }), jx + Math.cos(a) * 0.04, 1.46, jz + Math.sin(a) * 0.04, { cast: false });
  });
  const [dx0, dz0] = onArc(0.2, 3.28);
  donutBox(g, dx0, 1.38, dz0, -0.2);

  const orange = colorMat(0xe08a42, { roughness: 0.78 });
  box(g, 1.75, 6.5, 1.45, 0, 3.45, 0.05, orange);
  const badgeTex = badgeTexture();
  const badgeMat = new THREE.MeshStandardMaterial({
    map: badgeTex, emissive: 0xffffff, emissiveMap: badgeTex, emissiveIntensity: 0.28, roughness: 0.42,
  });
  ctx.nightMaterials.push({ material: badgeMat, intensity: 0.75, base: 0.28 });
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.74, 28), badgeMat);
  badge.position.set(0, 3.85, 0.8);
  g.add(badge);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e4, emissive: 0xfff1cc, emissiveIntensity: 0.9, roughness: 0.32,
  });
  ctx.nightMaterials.push({ material: lampMat, intensity: 1.35, base: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 10, 28), lampMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 6.05, 0.35);
  g.add(ring);
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), colorMat(0x8a8680, { roughness: 0.45, metalness: 0.35 }), 0, 7.7, 0.35, { cast: false });

  const officer = makeOfficer();
  officer.position.set(0, 0, 1.85);
  officer.scale.setScalar(1.35);
  officer.userData.dynamic = true;
  g.add(officer);
  g.userData.animate = (t) => {
    const wave = officer.userData.wave;
    wave.rotation.z = 0.5 + Math.sin(t * 1.7) * 0.16;
    wave.rotation.x = 0.28 + Math.sin(t * 1.15) * 0.07;
    const breath = 1 + Math.sin(t * 1.45) * 0.02;
    officer.userData.body.scale.set(1.22, 0.9 * breath, 0.96);
  };
}

/** Chubby spotted cheetah in a blue uniform, one paw raised. Flat colors, no skinning. */
function makeOfficer() {
  const root = new THREE.Group();
  const fur = colorMat(0xe39a22, { roughness: 0.7 });
  const spot = colorMat(0x5c3210, { roughness: 0.72 });
  const muzzleC = colorMat(0xf6d48a, { roughness: 0.68 });
  const blue = colorMat(0x2c5ed2, { roughness: 0.5 });
  const bow = colorMat(0x1a2030, { roughness: 0.4 });
  const dark = colorMat(0x241810, { roughness: 0.5 });
  const white = colorMat(0xf7f4ee, { roughness: 0.45 });
  const pink = colorMat(0xf0a0a4, { roughness: 0.55 });
  const noseC = colorMat(0x3a2a22, { roughness: 0.45 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 12), blue);
  body.scale.set(1.22, 0.9, 0.96);
  body.position.y = 1.2;
  root.add(body);
  root.userData.body = body;

  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), blue);
  collar.position.set(0, 1.7, 0.16);
  collar.scale.set(1.35, 0.65, 0.8);
  root.add(collar);
  const tie = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bow);
  tie.scale.set(2.1, 0.7, 0.7);
  tie.position.set(0, 1.64, 0.42);
  root.add(tie);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), bow);
  knot.position.set(0, 1.7, 0.46);
  root.add(knot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), fur);
  head.position.set(0, 2.15, 0.04);
  root.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), muzzleC);
  snout.position.set(0, 2.04, 0.32);
  snout.scale.set(1.1, 0.72, 0.85);
  root.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), noseC);
  nose.position.set(0, 2.1, 0.5);
  root.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 5, 10, Math.PI), dark);
  smile.position.set(0, 1.94, 0.48);
  smile.rotation.z = Math.PI;
  root.add(smile);

  for (const s of [-1, 1]) {
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), white);
    eyeW.position.set(s * 0.15, 2.22, 0.36);
    eyeW.scale.set(1, 1.15, 0.5);
    root.add(eyeW);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 5), dark);
    pupil.position.set(s * 0.15, 2.22, 0.41);
    root.add(pupil);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), fur);
    ear.position.set(s * 0.3, 2.52, -0.02);
    ear.scale.set(0.8, 1.05, 0.5);
    root.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), pink);
    inner.position.set(s * 0.3, 2.5, 0.05);
    inner.scale.set(0.65, 0.85, 0.35);
    root.add(inner);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), pink);
    cheek.position.set(s * 0.24, 2.02, 0.32);
    cheek.scale.set(1.1, 0.65, 0.45);
    root.add(cheek);
  }

  const spotGeo = new THREE.SphereGeometry(0.055, 6, 5);
  // Sit on the head surface (center 0, 2.15, 0.04, radius 0.44), mostly toward the door.
  for (const [x, y, z, sc] of [
    [-0.2, 2.36, 0.32, 1.1], [0.22, 2.38, 0.28, 1], [-0.06, 2.5, 0.26, 0.85],
    [0.28, 2.22, 0.3, 0.95], [-0.3, 2.22, 0.22, 1], [0.04, 2.52, 0.16, 0.8],
    [-0.14, 2.28, 0.4, 0.9], [0.16, 2.26, 0.38, 0.85],
  ]) {
    const sp = new THREE.Mesh(spotGeo, spot);
    sp.position.set(x, y, z);
    sp.scale.setScalar(sc);
    root.add(sp);
  }

  const wave = new THREE.Group();
  wave.position.set(-0.62, 1.55, 0.1);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.4, 8), fur);
  upper.position.y = 0.18;
  wave.add(upper);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), fur);
  paw.position.set(0, 0.42, 0.02);
  wave.add(paw);
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), pink);
  pad.position.set(0, 0.44, 0.12);
  wave.add(pad);
  root.add(wave);
  root.userData.wave = wave;

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 8), fur);
  arm.position.set(0.55, 1.32, 0.22);
  arm.rotation.z = -0.8;
  arm.rotation.x = 0.35;
  root.add(arm);

  const tail = new THREE.Group();
  tail.position.set(0.42, 1.05, -0.28);
  const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), fur);
  t1.position.set(0.14, 0.02, -0.06);
  tail.add(t1);
  const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fur);
  t2.position.set(0.3, 0.16, -0.02);
  tail.add(t2);
  const t3 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), spot);
  t3.position.set(0.22, 0.1, 0.04);
  tail.add(t3);
  root.add(tail);
  return root;
}

registerBuilding('policeStation', {
  label: '南瓜岛动物城警察局',
  footprint: [54, 50],
  info: () => ({
    featured: true,
    category: '警察局 Police Station',
    name: '南瓜岛动物城警察局',
    nameEn: 'Pumpkin Island Zootopia Police Station',
  }),
  create(ctx, spec) {
    const g = new THREE.Group();
    const sand = sandstoneMaterial();
    const rib = colorMat(0xc56d38, { roughness: 0.74 });
    const ribLight = colorMat(0xe2a15c, { roughness: 0.7 });
    const grass = colorMat(0x4f9a38, { roughness: 0.95 });
    const grassDark = colorMat(0x3d7a2c, { roughness: 0.95 });
    const stone = sharedMaterial('stone');
    const white = sharedMaterial('white');
    const steel = sharedMaterial('darkSteel');

    tiledBox(g, 54, 0.16, 50, 0, 0.08, 0, sharedMaterial('paving'), 0.45);

    // Round hall, open on the street side (+Z, theta 0) so the lobby reads from the steps and the dome.
    const R = 13.5;
    const hallH = 9.2;
    const gap = 0.9;
    sand.side = THREE.DoubleSide;
    const hall = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R + 0.4, hallH, 48, 1, true, gap / 2, Math.PI * 2 - gap),
      sand,
    );
    hall.position.set(0, hallH / 2 + 0.2, -3);
    hall.castShadow = true;
    hall.receiveShadow = true;
    g.add(hall);
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.7, R + 0.9, 0.7, 48, 1, true, gap / 2, Math.PI * 2 - gap),
      rib,
    );
    plinth.position.set(0, 0.55, -3);
    plinth.castShadow = true;
    g.add(plinth);
    for (const s of [-1, 1]) {
      const ang = s * gap / 2;
      const jamb = box(g, 0.5, hallH, 1.4, Math.sin(ang) * (R - 0.2), hallH / 2 + 0.2, Math.cos(ang) * (R - 0.2) - 3, rib);
      jamb.rotation.y = ang;
    }

    const fin = new THREE.BoxGeometry(1.05, hallH + 1.4, 2.6);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const a = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(a) < 0.34) continue;
      const m = new THREE.Mesh(fin, rib);
      m.position.set(Math.sin(ang) * (R - 0.15), hallH / 2 + 0.55, Math.cos(ang) * (R - 0.15) - 3);
      m.rotation.y = ang;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    // Narrow windows between ribs, lit at night.
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8eb6c9, metalness: 0.65, roughness: 0.12, emissive: 0xffe2b0, emissiveIntensity: 0.05,
    });
    ctx.nightMaterials.push({ material: glass, intensity: 0.85, base: 0.05 });
    const win = new THREE.BoxGeometry(0.55, 5.2, 0.18);
    for (let i = 0; i < 22; i++) {
      const ang = ((i + 0.5) / 22) * Math.PI * 2;
      if (Math.cos(ang) > 0.55) continue;
      const m = new THREE.Mesh(win, glass);
      m.position.set(Math.sin(ang) * (R + 0.55), 4.6, Math.cos(ang) * (R + 0.55) - 3);
      m.rotation.y = ang;
      m.castShadow = false;
      g.add(m);
    }

    // Grass roof with a round opening under the dome so the lobby is visible from above.
    const roofMat = grass.clone();
    roofMat.side = THREE.DoubleSide;
    const roof = new THREE.Mesh(new THREE.RingGeometry(7.15, R + 1.15, 48), roofMat);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(0, hallH + 0.48, -3);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);
    const trim = mesh(g, new THREE.TorusGeometry(7.4, 0.45, 8, 28), grassDark, 0, hallH + 0.7, -3);
    trim.rotation.x = Math.PI / 2;
    const domeY = hallH + 0.75;
    const domeGlass = new THREE.Mesh(
      new THREE.SphereGeometry(6.15, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xb7dce8, metalness: 0.55, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 1.2,
      }),
    );
    domeGlass.position.set(0, domeY, -3);
    domeGlass.castShadow = false;
    g.add(domeGlass);
    const struts = new THREE.Mesh(domeStruts(6.35), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.08 }));
    struts.position.set(0, domeY, -3);
    struts.castShadow = true;
    g.add(struts);

    // Crystalline crest over the entrance, the same warm stone as the ribs.
    const shards = [
      [0, 9.4, 12.4, 1.7, 8.4, 1.8, 0],
      [-3.6, 8.2, 12.8, 1.45, 6.2, 1.6, 0.38],
      [3.6, 8.2, 12.8, 1.45, 6.2, 1.6, -0.38],
      [-6.4, 6.4, 13.1, 1.3, 4.6, 1.5, 0.62],
      [6.4, 6.4, 13.1, 1.3, 4.6, 1.5, -0.62],
      [-8.6, 4.8, 13.3, 1.15, 3.2, 1.4, 0.85],
      [8.6, 4.8, 13.3, 1.15, 3.2, 1.4, -0.85],
      [-2.1, 4.6, 13.4, 1.05, 2.6, 1.3, 0.18],
      [2.1, 4.6, 13.4, 1.05, 2.6, 1.3, -0.18],
    ];
    for (const [x, y, z, w, h, d, rz] of shards) {
      const m = box(g, w, h, d, x, y, z, x === 0 ? ribLight : rib);
      m.rotation.z = rz;
    }

    // Open doorway (glass at the sides only) and the name plaque. Front faces +Z.
    box(g, 0.42, 3.5, 0.5, -3.15, 1.95, 13.4, white);
    box(g, 0.42, 3.5, 0.5, 3.15, 1.95, 13.4, white);
    box(g, 6.7, 0.28, 0.5, 0, 3.56, 13.4, white);
    const doorGlass = new THREE.MeshStandardMaterial({
      color: 0xc5e4ee, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.16,
    });
    box(g, 1.2, 3.15, 0.08, -1.9, 1.9, 13.48, doorGlass, { cast: false });
    box(g, 1.2, 3.15, 0.08, 1.9, 1.9, 13.48, doorGlass, { cast: false });
    const peg = colorMat(0xf0c14d, { roughness: 0.35, metalness: 0.65 });
    box(g, 1.05, 1.05, 0.06, -1.85, 2.55, 13.7, peg, { cast: false });
    const doorBadgeTex = badgeTexture();
    const doorBadgeMat = new THREE.MeshStandardMaterial({
      map: doorBadgeTex, emissive: 0xffffff, emissiveMap: doorBadgeTex, emissiveIntensity: 0.4, roughness: 0.4,
    });
    ctx.nightMaterials.push({ material: doorBadgeMat, intensity: 0.85, base: 0.4 });
    const doorBadge = new THREE.Mesh(new THREE.CircleGeometry(0.48, 28), doorBadgeMat);
    doorBadge.position.set(-1.85, 2.55, 13.78);
    g.add(doorBadge);
    const signTex = stationSign();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.18, roughness: 0.55,
    });
    ctx.nightMaterials.push({ material: signMat, intensity: 0.9, base: 0.18 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.5, 0.28), [steel, steel, steel, steel, signMat, steel]);
    plaque.position.set(0, 6.15, 13.7);
    plaque.castShadow = true;
    g.add(plaque);

    // Steps down toward the street, widest at the bottom.
    for (let i = 0; i < 7; i++) {
      const w = 12 + i * 2.1;
      box(g, w, 0.24, 1.45, 0, 0.16 + (6 - i) * 0.2, 14.6 + i * 1.35, i % 2 ? stone : white, { cast: false });
    }
    for (const x of [-8.5, 8.5]) {
      mesh(g, new THREE.CylinderGeometry(0.28, 0.34, 1.15, 10), white, x, 0.7, 20.5);
      mesh(g, new THREE.SphereGeometry(0.22, 10, 8), colorMat(0x1d4e89, { roughness: 0.4, metalness: 0.2 }), x, 1.35, 20.5);
    }

    addLobby(g, ctx);

    // Records room off the right side of the drum. The door faces the lobby,
    // not the street, and the sloth sits behind the return wall.
    secretRoom(g, 6.5, 0.22, -6.6, -Math.PI / 2, {
      wall: 0xf4ead8, floor: 0xd8c4a4, trim: 0xc56d38,
      width: 4.6, depth: 3.5, height: 3.15,
      sign: ['档案室', 'RECORDS'],
      furnish(room, spot) { slothClerk(room, spot.x, spot.y, spot.z, 0.8); },
    });
    markInterior(ctx, spec, [
      [0, 8, 12, 44],
      [8.4, -6.8, 8, 7],
    ]);

    g.userData.treeSpots = [[-20, 16], [20, 16], [-18, -16], [18, -16]];
    g.userData.height = hallH + 8;
    return g;
  },
});
