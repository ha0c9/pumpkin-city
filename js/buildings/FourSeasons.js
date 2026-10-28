// 四季酒店 Four Seasons — luxury twin towers with a sky bridge, infinity pool and an amusement park
// (Ferris wheel, carousel, roller coaster) on the front lawn.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, mulberry32 } from '../core/Utils.js';
import { curtainWallMaterial, windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';
import { grandPiano, secretRoom, weddingCake, entranceFrame, markInterior } from './easterEggs.js';

const THREE = window.THREE;

function stripeTexture(a, b, n = 16) {
  const c = makeCanvas(512, 64);
  const x = c.getContext('2d');
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 512 / n, 0, 512 / n + 1, 64); }
  return canvasTexture(c);
}

function tower(ctx, g, x, z, w, h, seed) {
  const wall = curtainWallMaterial(ctx, { cols: 10, rows: Math.round(h / 3.4), seed, tint: [92, 80, 62], mullion: '#d9c8a4', litRatio: 0.5 });
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), wall);
  t.position.set(x, 10 + h / 2, z);
  t.castShadow = true; t.receiveShadow = true;
  g.add(t);
  const gold = colorMat(0xcaa86a, { metalness: 0.9, roughness: 0.3 });
  // Vertical champagne fins on the corners and a stepped crown.
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(g, 0.7, h, 0.7, x + sx * w / 2, 10 + h / 2, z + sz * w / 2, gold);
  box(g, w + 0.8, 1, w + 0.8, x, 10 + h + 0.5, z, gold);
  box(g, w - 3, 4, w - 3, x, 10 + h + 3, z, wall);
  const crownGlow = new THREE.MeshStandardMaterial({ color: 0xf6e2b0, emissive: 0xffd58a, emissiveIntensity: 0.1, roughness: 0.4 });
  ctx.nightMaterials.push({ material: crownGlow, intensity: 1.3, base: 0.1 });
  box(g, w - 2.4, 0.6, w - 2.4, x, 10 + h + 5.3, z, crownGlow, { cast: false });
  mesh(g, new THREE.CylinderGeometry(0.15, 0.25, 7, 8), gold, x, 10 + h + 9, z);
  return 10 + h + 12.5;
}

function ferrisWheel(ctx, g, x, z, R) {
  const steel = colorMat(0xf2f4f6, { metalness: 0.6, roughness: 0.35 });
  const hub = new THREE.Vector3(x, R + 3, z);
  // A-frame legs on both sides of the wheel plane.
  for (const sz of [-1.6, 1.6]) {
    rod(g, new THREE.Vector3(x - R * 0.55, 0.3, z + sz * 1.6), hub.clone().setZ(z + sz), 0.32, steel);
    rod(g, new THREE.Vector3(x + R * 0.55, 0.3, z + sz * 1.6), hub.clone().setZ(z + sz), 0.32, steel);
  }
  rod(g, hub.clone().setZ(z - 1.8), hub.clone().setZ(z + 1.8), 0.5, steel);
  const wheel = new THREE.Group();
  wheel.userData.dynamic = true;
  wheel.position.copy(hub);
  const rimLight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff6fb5, emissiveIntensity: 0.05, roughness: 0.4 });
  ctx.nightMaterials.push({ material: rimLight, intensity: 1.6, base: 0.05 });
  for (const sz of [-0.8, 0.8]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 6, 72), sz < 0 ? steel : rimLight);
    rim.position.z = sz;
    wheel.add(rim);
  }
  const N = 16;
  const cabins = [];
  const cabinColors = [0xe94b3c, 0xf6c344, 0x3b8bd0, 0x3fae5a, 0xff8a3d, 0x8e5cc4];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    for (const sz of [-0.8, 0.8]) rod(wheel, new THREE.Vector3(0, 0, sz), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, sz), 0.06, steel, 4);
    const cab = new THREE.Group();
    const body = mesh(cab, new THREE.BoxGeometry(1.5, 1.6, 1.3), colorMat(cabinColors[i % cabinColors.length], { roughness: 0.5 }), 0, -1.3, 0);
    body.castShadow = true;
    mesh(cab, new THREE.CylinderGeometry(0.9, 0.9, 0.2, 12), sharedMaterial('white'), 0, -0.4, 0);
    cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheel.add(cab);
    cabins.push(cab);
  }
  g.add(wheel);
  return (t) => {
    wheel.rotation.z = t * 0.08;
    for (const c of cabins) c.rotation.z = -wheel.rotation.z;
  };
}

function carousel(ctx, g, x, z) {
  mesh(g, new THREE.CylinderGeometry(7, 7.2, 0.6, 40), sharedMaterial('stone'), x, 0.6, z);
  const rot = new THREE.Group();
  rot.userData.dynamic = true;
  rot.position.set(x, 0.9, z);
  mesh(rot, new THREE.CylinderGeometry(6.6, 6.6, 0.25, 40), colorMat(0xb8322a, { roughness: 0.5 }), 0, 0.12, 0);
  mesh(rot, new THREE.CylinderGeometry(1.2, 1.2, 4.4, 16), colorMat(0xf6c344, { roughness: 0.4, metalness: 0.4 }), 0, 2.4, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ map: stripeTexture('#e23b3b', '#fff3d6'), roughness: 0.6 });
  mesh(rot, new THREE.ConeGeometry(7.4, 2.8, 32, 1), canopyMat, 0, 5.9, 0);
  mesh(rot, new THREE.CylinderGeometry(7.4, 7.4, 0.6, 32, 1, true), canopyMat, 0, 4.3, 0);
  const lights = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd27a, emissiveIntensity: 0.1 });
  ctx.nightMaterials.push({ material: lights, intensity: 1.5, base: 0.1 });
  mesh(rot, new THREE.TorusGeometry(7.4, 0.08, 6, 48), lights, 0, 4.0, 0).rotation.x = Math.PI / 2;
  mesh(rot, new THREE.SphereGeometry(0.4, 12, 8), colorMat(0xd4af37, { metalness: 1, roughness: 0.3 }), 0, 7.5, 0);
  const horseColors = [0xffffff, 0x3b2a20, 0xd9b38c, 0xf2f2f2];
  const horses = [];
  const gold = colorMat(0xd4af37, { metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const r = i % 2 ? 4.6 : 3.2;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    mesh(rot, new THREE.CylinderGeometry(0.06, 0.06, 4, 6), gold, px, 2.2, pz);
    const horse = new THREE.Group();
    const mat = colorMat(horseColors[i % horseColors.length], { roughness: 0.5 });
    mesh(horse, new THREE.BoxGeometry(0.5, 0.55, 1.5), mat);
    mesh(horse, new THREE.BoxGeometry(0.35, 0.8, 0.4), mat, 0, 0.45, 0.75).rotation.x = -0.4;
    mesh(horse, new THREE.BoxGeometry(0.32, 0.32, 0.6), mat, 0, 0.8, 1.05);
    for (const [lx, lz] of [[-0.18, 0.55], [0.18, 0.55], [-0.18, -0.55], [0.18, -0.55]]) mesh(horse, new THREE.BoxGeometry(0.12, 0.6, 0.12), mat, lx, -0.5, lz);
    horse.position.set(px, 1.6, pz);
    horse.rotation.y = -a;
    rot.add(horse);
    horses.push({ h: horse, ph: i * 0.9 });
  }
  g.add(rot);
  return (t) => {
    rot.rotation.y = t * 0.45;
    for (const h of horses) h.h.position.y = 1.6 + Math.sin(t * 2.4 + h.ph) * 0.35;
  };
}

function rollerCoaster(ctx, g, pts) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'catmullrom', 0.4);
  const railMat = colorMat(0x2a6fd6, { roughness: 0.4, metalness: 0.5 });
  const supportMat = colorMat(0xf2f2f2, { roughness: 0.5, metalness: 0.4 });
  // Two rails offset sideways from the centerline.
  for (const off of [-0.6, 0.6]) {
    const railPts = [];
    for (let i = 0; i <= 400; i++) {
      const p = curve.getPointAt(i / 400);
      const tan = curve.getTangentAt(i / 400);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      railPts.push(p.addScaledVector(side, off));
    }
    mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, true), 400, 0.16, 6, true), railMat);
  }
  mesh(g, new THREE.TubeGeometry(curve, 400, 0.22, 6, true), supportMat, 0, -0.35, 0);
  for (let i = 0; i < 40; i++) {
    const p = curve.getPointAt(i / 40);
    if (p.y < 1.5) continue;
    rod(g, new THREE.Vector3(p.x, 0.3, p.z), new THREE.Vector3(p.x, p.y - 0.4, p.z), 0.18, supportMat, 6);
  }
  const train = [];
  const carColors = [0xe23b3b, 0xf6c344, 0xe23b3b, 0xf6c344];
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    car.userData.dynamic = true;
    mesh(car, new THREE.BoxGeometry(1.6, 0.8, 2.0), colorMat(carColors[i], { roughness: 0.4 }), 0, 0.5, 0);
    mesh(car, new THREE.BoxGeometry(1.5, 0.5, 0.3), sharedMaterial('darkSteel'), 0, 1.1, -0.6);
    g.add(car);
    train.push(car);
  }
  const len = curve.getLength();
  const look = new THREE.Vector3();
  let u = 0;
  let last = 0;
  return (t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const p0 = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const speed = 7 + Math.max(0, 14 - p0.y) * 1.4 - tan.y * 4;
    u = (u + Math.max(4, speed) * dt / len) % 1;
    train.forEach((car, i) => {
      const uu = (u - i * 2.3 / len + 1) % 1;
      const p = curve.getPointAt(uu);
      car.position.copy(p);
      look.copy(p).add(curve.getTangentAt(uu));
      car.lookAt(look);
    });
  };
}

registerBuilding('fourSeasons', {
  label: '酒店 Hotel',
  footprint: [68, 98],
  create(ctx, spec) {
    const g = new THREE.Group();
    const rng = mulberry32(44);
    const white = sharedMaterial('white');
    const gold = colorMat(0xcaa86a, { metalness: 0.9, roughness: 0.3 });
    tiledBox(g, 68, 0.3, 98, 0, 0.15, 0, sharedMaterial('paving'), 0.5);

    // Hotel: stone podium, twin towers, sky bridge.
    const podMat = windowWallMaterial(ctx, { cols: 18, rows: 2, wall: 'stone', frame: '#e8dcc0', glass: '#2c3a46', seed: 61, winW: 0.7, winH: 0.68, litRatio: 0.7 });
    const pod = new THREE.Mesh(new THREE.BoxGeometry(60, 9.7, 24), [podMat, podMat, sharedMaterial('paving'), podMat, podMat, podMat]);
    pod.position.set(0, 0.3 + 4.85, -34);
    pod.castShadow = true; pod.receiveShadow = true;
    g.add(pod);
    box(g, 61, 0.6, 25, 0, 10.2, -34, gold);
    const topA = tower(ctx, g, -15, -36, 15, 66, 81);
    tower(ctx, g, 15, -36, 15, 58, 82);
    const skyGlass = curtainWallMaterial(ctx, { cols: 6, rows: 2, seed: 83, tint: [60, 80, 96], litRatio: 0.8 });
    box(g, 15, 6, 10, 0, 56, -36, skyGlass);
    box(g, 15.4, 0.5, 10.4, 0, 52.8, -36, gold);
    box(g, 15.4, 0.5, 10.4, 0, 59.2, -36, gold);

    // Grand porte-cochere and the hotel sign.
    box(g, 22, 0.8, 8, 0, 6, -18, gold);
    for (const x of [-10, 10]) mesh(g, new THREE.CylinderGeometry(0.4, 0.4, 5.6, 16), white, x, 3, -15);
    const signTex = textTexture(['四季酒店', 'FOUR SEASONS'], { width: 1024, height: 256, color: '#f6e2b0', glow: '#ffd58a',
      font: 'bold 110px "Songti SC","STSong","PingFang SC",serif', subFont: '600 56px Georgia,"Times New Roman",serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.2, base: 0.3 });
    const sign = mesh(g, new THREE.PlaneGeometry(14, 3.5), signMat, 0, 8.2, -21.9, { cast: false });
    sign.castShadow = false;

    // Infinity pool terrace with loungers and umbrellas.
    tiledBox(g, 50, 0.6, 14, 0, 0.6, -12 + 2, sharedMaterial('stone'), 0.25);
    const pool = mesh(g, new THREE.BoxGeometry(40, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x3fb6d8, metalness: 0.4, roughness: 0.05 }), 0, 0.95, -10, { cast: false });
    pool.receiveShadow = true;
    for (let i = 0; i < 8; i++) {
      const x = -21 + i * 6;
      box(g, 0.8, 0.3, 2, x, 1.1, -4.4, white);
      mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), sharedMaterial('steel'), x + 2.6, 2.1, -4.4);
      mesh(g, new THREE.ConeGeometry(1.6, 0.6, 8), colorMat(i % 2 ? 0xffffff : 0xcaa86a, { roughness: 0.7 }), x + 2.6, 3.3, -4.4);
    }

    // Amusement park in front: low fence + gate, lawn, rides.
    box(g, 66, 0.1, 50, 0, 0.32, 23, colorMat(0x58a243, { roughness: 0.95 }), { cast: false });
    tiledBox(g, 4, 0.12, 50, 0, 0.4, 23, sharedMaterial('paving'), 0.5);
    tiledBox(g, 60, 0.12, 4, 0, 0.4, 14, sharedMaterial('paving'), 0.5);
    const gateMat = colorMat(0x6a3fb5, { roughness: 0.5 });
    for (const x of [-4.5, 4.5]) box(g, 1.2, 6, 1.2, x, 3.3, 47.5, gateMat);
    const parkSign = textTexture(['四季乐园', 'SEASONS PARK'], { width: 1024, height: 256, bg: '#6a3fb5', color: '#ffe16b',
      font: 'bold 110px "PingFang SC","Microsoft YaHei",sans-serif', subFont: 'bold 56px sans-serif' });
    const parkMat = new THREE.MeshStandardMaterial({ map: parkSign, emissive: 0xffffff, emissiveMap: parkSign, emissiveIntensity: 0.15 });
    ctx.nightMaterials.push({ material: parkMat, intensity: 1, base: 0.15 });
    const pBoard = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.4, 0.4), [gateMat, gateMat, gateMat, gateMat, parkMat, parkMat]);
    pBoard.position.set(0, 7, 47.5);
    pBoard.castShadow = true;
    g.add(pBoard);

    const animWheel = ferrisWheel(ctx, g, -20, 28, 14);
    const animCarousel = carousel(ctx, g, 18, 24);
    const animCoaster = rollerCoaster(ctx, g, [
      [-30, 4, 38], [-12, 3, 44], [8, 9, 44], [22, 18, 43], [30, 9, 38], [30, 4, 30],
      [28, 12, 4], [22, 6, -0.5], [10, 3, 3], [-2, 8, 8], [-14, 14, 4], [-28, 7, 2], [-32, 4, 18],
    ]);

    // Balloon vendor + food kiosks.
    const kioskColors = [0xe94b3c, 0x3b8bd0, 0x3fae5a];
    for (let i = 0; i < 3; i++) {
      const kx = 4 + i * 6, kz = 37;
      box(g, 3.4, 2.4, 2.6, kx, 1.5, kz, white);
      const roof = mesh(g, new THREE.ConeGeometry(2.6, 1.2, 4), colorMat(kioskColors[i], { roughness: 0.6 }), kx, 3.3, kz);
      roof.rotation.y = Math.PI / 4;
    }
    const balloons = new THREE.Group();
    balloons.userData.dynamic = true;
    for (let i = 0; i < 9; i++) {
      const b = mesh(balloons, new THREE.SphereGeometry(0.45, 12, 10), colorMat(kioskColors[i % 3], { roughness: 0.3 }), (rng() - 0.5) * 1.6, 3.6 + rng() * 1.2, (rng() - 0.5) * 1.6, { cast: false });
      b.scale.y = 1.2;
    }
    balloons.position.set(-4, 0, 38);
    g.add(balloons);

    grandPiano(g, -3.2, 0.32, -16.5, 0.5);
    entranceFrame(g, 0, -21.55, '宴会厅');
    secretRoom(g, -1.44, 0.36, -22.4, 0, {
      wall: 0xf7f1e6, floor: 0xe7d7b8, trim: 0xcaa86a,
      width: 8, depth: 5.4, height: 4.2,
      sign: ['宴会厅', 'BALLROOM'],
      furnish(room, spot) { weddingCake(room, spot.x, spot.y, spot.z).scale.setScalar(1.5); },
    });
    markInterior(ctx, spec, [[-1.4, -19, 10, 14]]);
    g.userData.animate = (t) => {
      animWheel(t); animCarousel(t); animCoaster(t);
      balloons.rotation.y = Math.sin(t * 0.6) * 0.2;
    };
    g.userData.treeSpots = [[-31, -47], [31, -47], [-31, -20], [31, -20], [-31, 47], [31, 47], [-12, 47], [12, 47], [-31, 12], [31, 14]];
    g.userData.height = topA;
    return g;
  },
});
