// 明珠马术训练场 — stable, office and two oval arenas on the south side of 东方明珠岛.
// Boxes, canvas sign and shared materials, same as the other buildings. Ponies trot the rail.
import { registerBuilding } from '../core/Registry.js';
import { textTexture } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';

const THREE = window.THREE;

function pony(g, color, maneColor) {
  const body = colorMat(color, { roughness: 0.75 });
  const mane = colorMat(maneColor, { roughness: 0.8 });
  const hoof = colorMat(0x241c16, { roughness: 0.6 });
  const group = new THREE.Group();
  box(group, 0.36, 0.34, 0.92, 0, 0.98, 0, body);
  box(group, 0.22, 0.16, 0.22, 0, 1.08, -0.48, body);
  const neck = box(group, 0.16, 0.4, 0.2, 0, 1.22, 0.38, body);
  neck.rotation.x = -0.55;
  box(group, 0.15, 0.16, 0.34, 0, 1.46, 0.66, body);
  box(group, 0.11, 0.09, 0.14, 0, 1.38, 0.84, mane);
  for (const s of [-1, 1]) {
    const ear = box(group, 0.04, 0.12, 0.05, s * 0.05, 1.6, 0.6, body);
    ear.rotation.z = s * -0.2;
    mesh(group, new THREE.SphereGeometry(0.025, 8, 6), hoof, s * 0.06, 1.48, 0.8);
  }
  box(group, 0.06, 0.28, 0.28, 0, 1.38, 0.42, mane);
  const tail = box(group, 0.07, 0.42, 0.08, 0, 0.95, -0.58, mane);
  tail.rotation.x = 0.5;
  const legs = [];
  const spots = [[-0.12, 0.32], [0.12, 0.32], [-0.12, -0.32], [0.12, -0.32]];
  for (const [x, z] of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.86, z);
    box(pivot, 0.08, 0.52, 0.08, 0, -0.26, 0, body);
    box(pivot, 0.09, 0.05, 0.11, 0, -0.54, 0.02, hoof);
    group.add(pivot);
    legs.push(pivot);
  }
  group.userData.dynamic = true;
  group.userData.legs = legs;
  g.add(group);
  return group;
}

function ellipseRail(g, cx, cz, rx, rz, white, post) {
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p0 = new THREE.Vector3(cx + Math.cos(a0) * rx, 0, cz + Math.sin(a0) * rz);
    const p1 = new THREE.Vector3(cx + Math.cos(a1) * rx, 0, cz + Math.sin(a1) * rz);
    box(g, 0.08, 1.15, 0.08, p0.x, 0.58, p0.z, post);
    for (const y of [0.55, 1.05]) {
      rod(g, p0.clone().setY(y), p1.clone().setY(y), 0.035, white);
    }
  }
}

function jump(g, x, z, rot, wood, poleMat) {
  const j = new THREE.Group();
  j.position.set(x, 0, z);
  j.rotation.y = rot;
  for (const sx of [-1.35, 1.35]) {
    box(j, 0.1, 1.45, 0.1, sx, 0.75, 0, wood);
    box(j, 0.22, 0.08, 0.22, sx, 0.08, 0, wood);
    for (const y of [0.45, 0.75, 1.05]) box(j, 0.16, 0.05, 0.08, sx, y, 0.06, poleMat);
  }
  box(j, 2.55, 0.08, 0.08, 0, 0.75, 0, poleMat);
  g.add(j);
}

export function buildEquestrianCenter(ctx) {
  const g = new THREE.Group();
  const white = sharedMaterial('white');
  const wood = colorMat(0x7a4a2a, { roughness: 0.75 });
  const stall = colorMat(0x8d5a32, { roughness: 0.7 });
  const sandMat = colorMat(0xd2b48a, { roughness: 0.95 });
  const red = colorMat(0xb23b32, { roughness: 0.5 });
  const blue = colorMat(0x2f6f9f, { roughness: 0.5 });
  const yellow = colorMat(0xe0a106, { roughness: 0.5 });
  const green = colorMat(0x3d7a45, { roughness: 0.6 });
  const wall = colorMat(0xf3efe4, { roughness: 0.7 });

  tiledBox(g, 72, 0.16, 50, 0, 0.08, 0, colorMat(0xc5c0b2, { roughness: 0.95 }), 0.4);

  const arenas = [
    { cx: -16.2, cz: 2.2, rx: 13.2, rz: 10.2 },
    { cx: 16.2, cz: 2.2, rx: 13.2, rz: 10.2 },
  ];
  for (const a of arenas) {
    const sand = new THREE.Mesh(new THREE.CircleGeometry(1, 40), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.scale.set(a.rx - 0.7, a.rz - 0.7, 1);
    sand.position.set(a.cx, 0.18, a.cz);
    sand.receiveShadow = true;
    g.add(sand);
    ellipseRail(g, a.cx, a.cz, a.rx, a.rz, white, white);
  }

  // Dressage letters around the west arena.
  const letters = ['A', 'K', 'E', 'H', 'C', 'M', 'B', 'F'];
  letters.forEach((ch, i) => {
    const a = -Math.PI / 2 + (i / letters.length) * Math.PI * 2;
    const x = arenas[0].cx + Math.cos(a) * (arenas[0].rx + 1.5);
    const z = arenas[0].cz + Math.sin(a) * (arenas[0].rz + 1.5);
    box(g, 0.06, 0.7, 0.06, x, 0.5, z, white);
    const tex = textTexture([ch], { width: 128, height: 128, bg: '#f7f4ea', color: '#1c1c1c', font: 'bold 92px Arial,sans-serif' });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    plate.position.set(x, 1.05, z);
    plate.lookAt(arenas[0].cx, 1.05, arenas[0].cz);
    g.add(plate);
  });

  // Jumping arena: an oxer, a line of cavaletti and a few cones.
  jump(g, arenas[1].cx, arenas[1].cz - 2.2, 0.4, white, red);
  jump(g, arenas[1].cx + 1.2, arenas[1].cz + 3.4, -0.3, white, blue);
  for (let i = 0; i < 4; i++) {
    const z = arenas[1].cz + 0.2 + i * 1.15;
    box(g, 0.1, 0.22, 0.1, arenas[1].cx - 5.2, 0.16, z, white);
    box(g, 0.1, 0.22, 0.1, arenas[1].cx - 3.2, 0.16, z, white);
    box(g, 1.9, 0.07, 0.07, arenas[1].cx - 4.2, 0.28, z, i % 2 ? yellow : blue);
  }
  for (const [dx, dz] of [[6.2, -4.5], [6.6, -3.2], [5.6, -3.6]]) {
    mesh(g, new THREE.ConeGeometry(0.16, 0.38, 10), yellow, arenas[1].cx + dx, 0.36, arenas[1].cz + dz);
  }
  box(g, 0.7, 0.45, 0.4, arenas[0].cx + 4, 0.4, arenas[0].cz + arenas[0].rz + 2.2, wood);

  // Stable along the back-left, open toward the arenas.
  const sx = -16, sz = -16.2, sW = 24, sD = 8, sH = 4.2, stalls = 4;
  box(g, sW, sH, 0.28, sx, sH / 2 + 0.2, sz - sD / 2, stall);
  for (let i = 0; i < stalls; i++) {
    const x = sx - sW / 2 + (i + 0.5) * (sW / stalls);
    box(g, 1.1, 0.8, 0.08, x, 2.5, sz - sD / 2 - 0.04, colorMat(0x8fb4c4, { roughness: 0.15, metalness: 0.4 }), { cast: false });
  }
  box(g, 0.28, sH, sD, sx - sW / 2, sH / 2 + 0.2, sz, stall);
  box(g, 0.28, sH, sD, sx + sW / 2, sH / 2 + 0.2, sz, stall);
  box(g, sW + 1.2, 0.28, sD + 1.4, sx, sH + 0.45, sz, colorMat(0x6e4428, { roughness: 0.7 }));
  box(g, sW + 0.4, 0.4, 0.5, sx, sH + 0.85, sz, colorMat(0x5c3a22, { roughness: 0.7 }));
  for (let i = 0; i < stalls; i++) {
    const x = sx - sW / 2 + (i + 0.5) * (sW / stalls);
    if (i > 0) box(g, 0.12, sH - 0.4, sD - 0.4, x - sW / stalls / 2, sH / 2, sz, wood);
    box(g, sW / stalls - 0.5, 1.35, 0.12, x, 0.9, sz + sD / 2, wood);
    box(g, sW / stalls - 0.9, 0.1, 0.12, x, 2.15, sz + sD / 2, wood);
  }
  const shedTex = textTexture(['马棚', 'STABLE'], {
    width: 512, height: 160, bg: '#6e3b2a', color: '#f6e7c1',
    font: 'bold 78px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: '600 36px Arial,sans-serif',
  });
  const shedSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshStandardMaterial({ map: shedTex, roughness: 0.6 }));
  shedSign.position.set(sx, sH - 0.2, sz + sD / 2 + 0.08);
  g.add(shedSign);
  for (const hx of [-6, 4]) box(g, 0.9, 0.55, 0.7, sx + hx, 0.45, sz + sD / 2 + 1.3, yellow);

  // Two-storey office to the right of the stable.
  const ox = 16.5, oz = -16, ow = 12, od = 8, floors = 2, floorH = 3.15;
  const front = windowWallMaterial(ctx, {
    cols: 4, rows: floors, wall: 'concrete', frame: '#f4f1ea', glass: '#35586c', seed: 21, winW: 0.55, winH: 0.5, litRatio: 0.65,
  });
  const side = windowWallMaterial(ctx, {
    cols: 3, rows: floors, wall: 'concrete', frame: '#f4f1ea', glass: '#35586c', seed: 22, winW: 0.5, winH: 0.5, litRatio: 0.4,
  });
  const concrete = sharedMaterial('concrete');
  const office = new THREE.Mesh(new THREE.BoxGeometry(ow, floors * floorH, od), [side, side, concrete, concrete, front, front]);
  office.position.set(ox, floors * floorH / 2 + 0.2, oz);
  office.castShadow = true; office.receiveShadow = true;
  g.add(office);
  box(g, ow + 0.5, 0.3, od + 0.5, ox, floors * floorH + 0.4, oz, concrete);
  box(g, 1.6, 2.2, 0.12, ox, 1.3, oz + od / 2 + 0.05, sharedMaterial('darkSteel'));
  const signTex = textTexture(['明珠马术', 'PEARL RIDING'], {
    width: 1024, height: 256, bg: '#1e3d32', color: '#f4f7f2',
    font: 'bold 108px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: 'bold 48px Arial,sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.28, roughness: 0.45,
  });
  ctx.nightMaterials.push({ material: signMat, intensity: 1.05, base: 0.28 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.2, 0.2), [green, green, green, green, signMat, green]);
  sign.position.set(ox, floors * floorH + 1.7, oz + od / 2 - 0.15);
  sign.castShadow = true;
  g.add(sign);

  // Entrance gate on the north side, facing the rest of the island.
  for (const x of [-3.2, 3.2]) box(g, 0.28, 2.4, 0.28, x, 1.3, 22.2, white);
  box(g, 7.2, 0.55, 0.18, 0, 2.55, 22.2, green);
  const gateTex = textTexture(['明珠马术训练场', 'PEARL EQUESTRIAN'], {
    width: 1024, height: 180, bg: '#1e3d32', color: '#f4f7f2',
    font: 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: '600 36px Arial,sans-serif',
  });
  const gateMat = new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: gateTex, emissiveIntensity: 0.2 });
  ctx.nightMaterials.push({ material: gateMat, intensity: 0.8, base: 0.2 });
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.1), gateMat);
  gate.position.set(0, 2.55, 22.32);
  g.add(gate);

  const ponies = [];
  const coats = [
    [0x8d4a28, 0x2a1c14],
    [0xc8c4bc, 0x5c584f],
    [0x6b3a1f, 0x1a140f],
    [0xd7b15a, 0xf2efe6],
  ];
  arenas.forEach((a, ai) => {
    for (let k = 0; k < 2; k++) {
      const [coat, hair] = coats[ai * 2 + k];
      const horse = pony(g, coat, hair);
      ponies.push({
        group: horse, legs: horse.userData.legs,
        cx: a.cx, cz: a.cz, rx: a.rx - 3.4, rz: a.rz - 2.8,
        speed: 0.55 + ai * 0.12, phase: k * Math.PI + ai,
      });
    }
  });
  // Two more ponies looking out of the stable.
  for (const [x, coat, hair] of [[sx - 9, 0x8d4a28, 0x2a1c14], [sx - 3, 0xc8c4bc, 0x5c584f]]) {
    const horse = pony(g, coat, hair);
    horse.position.set(x, 0, sz + sD / 2 - 0.55);
    horse.scale.set(0.92, 0.92, 0.92);
  }

  g.userData.animate = (t) => {
    for (const p of ponies) {
      const u = t * p.speed + p.phase;
      p.group.position.set(
        p.cx + Math.cos(u) * p.rx,
        0.02 + Math.abs(Math.sin(u * 4)) * 0.035,
        p.cz + Math.sin(u) * p.rz,
      );
      p.group.rotation.y = -u;
      const swing = Math.sin(u * 4) * 0.5;
      p.legs[0].rotation.x = swing;
      p.legs[1].rotation.x = -swing;
      p.legs[2].rotation.x = -swing;
      p.legs[3].rotation.x = swing;
    }
  };

  g.userData.height = 9;
  g.userData.treeSpots = [];
  return g;
}

registerBuilding('equestrianCenter', {
  label: '马术训练场 Equestrian Centre',
  footprint: [74, 52],
  create(ctx) { return buildEquestrianCenter(ctx); },
  info() {
    return {
      category: '马术训练场 Equestrian',
      name: '明珠马术训练场', nameEn: 'Pearl Equestrian Centre',
      description: '东方明珠岛南侧的马术训练场。一栋马棚、一间两层办公室，旁边是两个椭圆形训练场：一场走盛装舞步，一场摆着障碍和踩杆，场里有小马在绕圈训练。',
      featured: true,
    };
  },
});
