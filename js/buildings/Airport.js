// 南瓜机场 — two vaulted glass terminals in a line along the island's long axis.
// Each is two storeys: doors below, jet bridges off the upper floor, a lift at the west end.
// A flared control tower stands on the open lawn beside each hall, clear of the doors.
// Two airliners fly circuits: one is taking off while the other is on approach.
import { registerBuilding } from '../core/Registry.js';
import { textTexture } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';

const THREE = window.THREE;

const RUNWAYS = [
  { z: -75, id: '09L' },
  { z: -51, id: '09R' },
  { z: 51, id: '27R' },
  { z: 73, id: '27L' },
];
const RW_LEN = 290;
const RW_WID = 14;

function runwayMarkings(g, z, asphalt, paint) {
  tiledBox(g, RW_LEN, 0.08, RW_WID, 0, 0.08, z, asphalt, 0.35);
  box(g, RW_LEN, 0.02, 0.45, 0, 0.14, z - RW_WID / 2 + 0.6, paint);
  box(g, RW_LEN, 0.02, 0.45, 0, 0.14, z + RW_WID / 2 - 0.6, paint);
  const dashes = Math.floor(RW_LEN / 14);
  for (let i = 0; i < dashes; i++) {
    const x = -RW_LEN / 2 + 8 + i * 14;
    if (Math.abs(x) > RW_LEN / 2 - 22) continue;
    box(g, 7, 0.02, 0.4, x, 0.14, z, paint);
  }
  for (const end of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const zz = z - 4.2 + k * 1.7;
      box(g, 7, 0.02, 0.9, end * (RW_LEN / 2 - 12), 0.14, zz, paint);
    }
  }
}

function runwayNumber(g, label, x, z, yaw) {
  const tex = textTexture([label], {
    width: 256, height: 256, bg: '#3a3f46', color: '#f4f4f2',
    font: 'bold 188px Arial, sans-serif',
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mat);
  m.rotation.order = 'XYZ';
  m.rotation.x = -Math.PI / 2;
  m.rotation.y = yaw;
  m.position.set(x, 0.16, z);
  m.receiveShadow = true;
  g.add(m);
}

/** Flared cab, mast, crossbar and ball, matching the sketch. One per terminal. */
function controlTower(g, x, z, mats, beacon) {
  const baseY = 0;
  mesh(g, new THREE.CylinderGeometry(2.4, 2.8, 1.2, 6), mats.concrete, x, baseY + 0.6, z);
  mesh(g, new THREE.CylinderGeometry(1.05, 1.25, 34, 12), mats.concrete, x, baseY + 18, z);
  const cabY = baseY + 37.2;
  const shell = new THREE.CylinderGeometry(5.2, 3.15, 5.6, 4);
  shell.rotateY(Math.PI / 4);
  mesh(g, shell, mats.concrete, x, cabY, z);
  const glass = new THREE.CylinderGeometry(4.55, 2.7, 4.3, 4);
  glass.rotateY(Math.PI / 4);
  mesh(g, glass, mats.cabGlass, x, cabY + 0.15, z);
  mesh(g, new THREE.CylinderGeometry(5.5, 5.5, 0.35, 4), mats.frame, x, cabY + 2.95, z).rotation.y = Math.PI / 4;
  box(g, 1.4, 0.9, 1.4, x, cabY + 3.5, z, mats.frame);
  const mastY = cabY + 7.4;
  mesh(g, new THREE.CylinderGeometry(0.16, 0.22, 8.2, 8), mats.frame, x, mastY, z);
  box(g, 4.6, 0.18, 0.18, x, mastY + 2.3, z, mats.frame);
  mesh(g, new THREE.SphereGeometry(0.55, 12, 10), beacon, x, mastY + 4.3, z, { cast: false });
  const sign = textTexture(['塔台'], {
    width: 256, height: 128, bg: '#1d4c6e', color: '#f4f7f8',
    font: 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 });
  const plate = mesh(g, new THREE.PlaneGeometry(3.2, 1.6), signMat, x, 6.2, z + 1.35, { cast: false });
  plate.material = signMat;
}

/** Upper-level jet bridge. Slopes down from the terminal floor to the aircraft door. */
function jetBridge(g, x, zFace, dir, floorY, mats) {
  const len = 15.4;
  const drop = 1.05;
  const slope = Math.atan2(drop, len);
  const yaw = new THREE.Group();
  yaw.position.set(x, floorY, zFace);
  yaw.rotation.y = dir > 0 ? 0 : Math.PI;
  const pitch = new THREE.Group();
  pitch.rotation.x = slope;
  yaw.add(pitch);
  box(pitch, 2.4, 0.14, len, 0, 0.07, len / 2, mats.bridge);
  box(pitch, 2.62, 0.12, len + 0.2, 0, 2.62, len / 2, mats.frame);
  for (const side of [-1, 1]) {
    box(pitch, 0.08, 2.25, len - 0.4, side * 1.16, 1.3, len / 2, mats.bridgeGlass);
  }
  for (let i = 0; i <= 5; i++) {
    const z = 0.15 + (len - 0.3) * i / 5;
    box(pitch, 2.58, 2.55, 0.1, 0, 1.32, z, mats.frame);
  }
  mesh(pitch, new THREE.CylinderGeometry(1.32, 1.32, 2.55, 12), mats.bridge, 0, 1.32, len + 0.35);
  box(pitch, 0.18, 2.7, 0.16, -1.3, 1.32, 0.06, mats.frame);
  box(pitch, 0.18, 2.7, 0.16, 1.3, 1.32, 0.06, mats.frame);
  box(pitch, 2.8, 0.16, 0.16, 0, 2.68, 0.06, mats.frame);
  g.add(yaw);
  const reach = len + 0.35;
  const endZ = zFace + dir * Math.cos(slope) * reach;
  const endY = floorY - Math.sin(slope) * reach + 1.2;
  box(g, 0.32, Math.max(0.6, endY), 0.32, x, endY / 2, endZ, mats.frame);
}

function archGeometry(R, length, beta, segments = 28) {
  const geo = new THREE.CylinderGeometry(R, R, length, segments, 1, true, Math.PI / 2 - beta, beta * 2);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

function gableGeometry(R, beta, centerY, springY) {
  const shape = new THREE.Shape();
  const steps = 20;
  const half = R * Math.sin(beta);
  shape.moveTo(half, springY);
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI / 2 + beta - (2 * beta) * (i / steps);
    const y = centerY + R * Math.sin(theta);
    shape.lineTo(-R * Math.cos(theta), y);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateY(Math.PI / 2);
  return geo;
}

function facade(g, w, h, x, y, z, rotY, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function groundDoor(g, x, z, rotY, w, mats) {
  const door = new THREE.Group();
  const h = 2.9;
  box(door, w + 0.36, h + 0.24, 0.2, 0, h / 2 + 0.06, 0, mats.frame);
  box(door, w * 0.46, h - 0.1, 0.08, -w * 0.24, h / 2 + 0.06, 0.1, mats.door);
  box(door, w * 0.46, h - 0.1, 0.08, w * 0.24, h / 2 + 0.06, 0.1, mats.door);
  box(door, w * 0.9, 0.08, 0.1, 0, 1.15, 0.16, mats.frame);
  door.position.set(x, 0, z);
  door.rotation.y = rotY;
  g.add(door);
}

/** Twin cars in a glass shaft on the west end. One rises while the other descends. */
function addElevators(g, xWest, z, FH, springY, mats, list) {
  const depth = 3.4;
  const width = 6.6;
  const cx = xWest - depth / 2 - 0.15;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, 0.22, springY + 0.3, 0.22, cx + sx * (depth / 2 - 0.08), (springY + 0.3) / 2, z + sz * (width / 2 - 0.08), mats.frame);
    }
  }
  box(g, depth + 0.45, 0.2, width + 0.45, cx, springY + 0.12, z, mats.frame);
  box(g, depth + 0.15, 0.12, width + 0.15, cx, FH, z, mats.accent);
  const glassH = springY - 0.2;
  facade(g, width - 0.3, glassH, cx - depth / 2, glassH / 2 + 0.05, z, -Math.PI / 2, mats.shaftGlass);
  facade(g, depth - 0.3, glassH, cx, glassH / 2 + 0.05, z - width / 2, Math.PI, mats.shaftGlass);
  facade(g, depth - 0.3, glassH, cx, glassH / 2 + 0.05, z + width / 2, 0, mats.shaftGlass);
  const signTex = textTexture(['电梯'], {
    width: 256, height: 128, bg: '#1d4c6e', color: '#f4f7f8',
    font: 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55 });
  const plate = mesh(g, new THREE.PlaneGeometry(2.2, 1.1), signMat, cx - depth / 2 - 0.08, springY - 0.9, z, { cast: false });
  plate.rotation.y = -Math.PI / 2;
  const groundY = 1.48;
  const upperY = FH + 1.5;
  for (const [dz, phase] of [[-1.4, 0], [1.4, Math.PI]]) {
    const car = new THREE.Group();
    car.userData.dynamic = true;
    box(car, 2.05, 2.35, 2.2, 0, 0, 0, mats.cabBody);
    box(car, 2.05, 0.16, 2.2, 0, 1.18, 0, mats.accent);
    box(car, 1.35, 1.7, 0.06, 0, -0.05, 1.08, mats.cabGlass);
    box(car, 0.08, 2.35, 2.2, -1.02, 0, 0, mats.frame);
    box(car, 0.08, 2.35, 2.2, 1.02, 0, 0, mats.frame);
    car.position.set(cx, groundY, z + dz);
    g.add(car);
    list.push({ car, groundY, upperY, phase, speed: 0.62 });
  }
}

/**
 * Two-storey hall: glass curtain wall, ground-floor doors, upper floor opening onto
 * the jet bridges, barrel-vault roof, and a lift shaft on the west end.
 */
function terminal(ctx, g, cx, cz, title, mats, elevators) {
  const W = 60;
  const D = 22;
  const FH = 4.2;
  const springY = FH * 2;
  const rise = 4.8;
  const R = (D * D / 4 + rise * rise) / (2 * rise);
  const beta = Math.asin((D / 2) / R);
  const centerY = springY - R * Math.cos(beta);
  const wallH = FH - 0.28;
  const groundCy = 0.2 + wallH / 2;
  const upperCy = FH + 0.22 + wallH / 2;

  box(g, W + 1.6, 0.28, D + 1.6, cx, 0.14, cz, mats.concrete);
  box(g, W + 0.85, 0.32, D + 0.7, cx, FH, cz, mats.frame);

  const longGlass = curtainWallMaterial(ctx, {
    cols: 16, rows: 1, seed: 40 + cx, tint: [62, 118, 150], mullion: '#f2f6f8', litRatio: 0.6,
  });
  const shortGlass = curtainWallMaterial(ctx, {
    cols: 6, rows: 1, seed: 47 + cx, tint: [62, 118, 150], mullion: '#f2f6f8', litRatio: 0.48,
  });
  facade(g, W, wallH, cx, groundCy, cz - D / 2, Math.PI, longGlass);
  facade(g, W, wallH, cx, upperCy, cz - D / 2, Math.PI, longGlass);
  facade(g, W, wallH, cx, groundCy, cz + D / 2, 0, longGlass);
  facade(g, W, wallH, cx, upperCy, cz + D / 2, 0, longGlass);
  facade(g, D, wallH, cx + W / 2, groundCy, cz, Math.PI / 2, shortGlass);
  facade(g, D, wallH, cx + W / 2, upperCy, cz, Math.PI / 2, shortGlass);
  const shaftW = 6.6;
  const sideW = (D - shaftW) / 2;
  for (const sz of [-1, 1]) {
    const zz = cz + sz * (shaftW / 2 + sideW / 2);
    facade(g, sideW, wallH, cx - W / 2, groundCy, zz, -Math.PI / 2, shortGlass);
    facade(g, sideW, wallH, cx - W / 2, upperCy, zz, -Math.PI / 2, shortGlass);
  }

  for (const dir of [-1, 1]) {
    for (const dx of [-28, 2]) {
      groundDoor(g, cx + dx, cz + dir * (D / 2 + 0.12), dir > 0 ? 0 : Math.PI, 2.7, mats);
      box(g, 4.4, 0.12, 2.3, cx + dx, FH - 0.16, cz + dir * (D / 2 + 1.2), mats.accent);
    }
  }
  groundDoor(g, cx + W / 2 + 0.12, cz, Math.PI / 2, 6.6, mats);
  box(g, 3.8, 0.14, 8.4, cx + W / 2 + 2.0, FH - 0.12, cz, mats.accent);

  const signTex = textTexture([title, 'PUMPKIN AIRPORT'], {
    width: 1024, height: 280, bg: '#1d4c6e', color: '#f4f7f8',
    font: 'bold 108px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: 'bold 48px Arial, sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25, roughness: 0.5,
  });
  ctx.nightMaterials.push({ material: signMat, intensity: 0.9, base: 0.25 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.5, 12), [signMat, mats.frame, mats.frame, mats.frame, mats.frame, mats.frame]);
  sign.position.set(cx + W / 2 + 0.18, upperCy, cz);
  sign.castShadow = true;
  g.add(sign);

  mesh(g, archGeometry(R - 0.05, W - 0.6, beta), mats.vault, cx, centerY, cz);
  for (let i = 0; i <= 8; i++) {
    const x = cx - W / 2 + (W / 8) * i;
    mesh(g, archGeometry(R + 0.28, 0.42, beta, 18), mats.rib, x, centerY, cz);
  }
  box(g, W + 1.1, 0.26, 0.5, cx, springY + 0.02, cz - D / 2, mats.frame);
  box(g, W + 1.1, 0.26, 0.5, cx, springY + 0.02, cz + D / 2, mats.frame);
  const gable = gableGeometry(R - 0.05, beta, centerY, springY);
  mesh(g, gable, mats.vault, cx - W / 2 + 0.02, 0, cz, { cast: false });
  mesh(g, gable, mats.vault, cx + W / 2 - 0.02, 0, cz, { cast: false });

  addElevators(g, cx - W / 2, cz, FH, springY, mats, elevators);
  return { D, floorY: FH + 0.2 };
}

function airliner(bodyColor, tailColor, beacon) {
  const g = new THREE.Group();
  const body = colorMat(bodyColor, { roughness: 0.32, metalness: 0.45 });
  const tail = colorMat(tailColor, { roughness: 0.4, metalness: 0.25 });
  const dark = sharedMaterial('darkSteel');
  const glass = colorMat(0xb7d4e2, { roughness: 0.12, metalness: 0.55 });
  const fuse = mesh(g, new THREE.CylinderGeometry(1.28, 1.28, 15.5, 14), body, -0.4, 2.55, 0);
  fuse.rotation.z = Math.PI / 2;
  mesh(g, new THREE.SphereGeometry(1.28, 14, 12), body, 7.2, 2.55, 0);
  const nose = mesh(g, new THREE.SphereGeometry(1.15, 14, 10), body, 8.3, 2.45, 0);
  nose.scale.set(1.35, 1, 1);
  mesh(g, new THREE.SphereGeometry(1.05, 12, 8), glass, 8.7, 2.85, 0).scale.set(0.7, 0.45, 0.7);
  box(g, 4.2, 0.28, 18.5, -0.6, 2.45, 0, body);
  box(g, 3.4, 2.5, 0.22, -6.6, 3.5, 0, tail);
  box(g, 0.18, 0.16, 6.4, -6.5, 3.15, 0, tail);
  for (const s of [-1, 1]) {
    mesh(g, new THREE.CylinderGeometry(0.55, 0.62, 2.4, 10), dark, -1.4, 1.7, s * 3.5).rotation.z = Math.PI / 2;
    mesh(g, new THREE.CylinderGeometry(0.5, 0.15, 0.7, 10), dark, -0.15, 1.7, s * 3.5).rotation.z = Math.PI / 2;
  }
  const gear = new THREE.Group();
  for (const [gx, gz] of [[6.2, 0], [-1.2, 1.5], [-1.2, -1.5]]) {
    box(gear, 0.12, 1.35, 0.12, gx, 1.15, gz, dark);
    mesh(gear, new THREE.CylinderGeometry(0.28, 0.28, 0.18, 8), dark, gx, 0.42, gz).rotation.z = Math.PI / 2;
  }
  g.add(gear);
  g.userData.gear = gear;
  mesh(g, new THREE.SphereGeometry(0.18, 8, 6), beacon, -6.6, 4.85, 0, { cast: false });
  return g;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const ease = (t) => t * t * (3 - 2 * t);

/** Closed circuit: roll, rotate, climb, turn, descend, land. yaw 0 noses east. */
function circuitKeys(runwayZ, outerZ) {
  const y0 = 1.7;
  return [
    { s: 0, x: -132, y: y0, z: runwayZ, yaw: 0, pitch: 0, bank: 0 },
    { s: 0.18, x: 90, y: y0, z: runwayZ, yaw: 0, pitch: 0.08, bank: 0 },
    { s: 0.26, x: 168, y: 10, z: runwayZ, yaw: 0, pitch: 0.42, bank: 0 },
    { s: 0.36, x: 230, y: 30, z: runwayZ + (outerZ - runwayZ) * 0.35, yaw: -0.9, pitch: 0.12, bank: -0.45 },
    { s: 0.48, x: 150, y: 36, z: outerZ, yaw: -Math.PI, pitch: 0, bank: 0.1 },
    { s: 0.64, x: -170, y: 30, z: outerZ, yaw: -Math.PI, pitch: -0.08, bank: 0 },
    { s: 0.76, x: -230, y: 14, z: runwayZ + (outerZ - runwayZ) * 0.4, yaw: -Math.PI * 2 + 0.7, pitch: 0.05, bank: 0.4 },
    { s: 0.86, x: -180, y: 5.5, z: runwayZ, yaw: -Math.PI * 2, pitch: 0.22, bank: 0 },
    { s: 0.93, x: -132, y: y0, z: runwayZ, yaw: -Math.PI * 2, pitch: 0.12, bank: 0 },
    { s: 1, x: -100, y: y0, z: runwayZ, yaw: -Math.PI * 2, pitch: 0, bank: 0 },
  ];
}

function sampleCircuit(keys, s) {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].s <= s) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const t = ease(Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s || 1))));
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: lerpAngle(a.yaw, b.yaw, t),
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    bank: a.bank + (b.bank - a.bank) * t,
  };
}

registerBuilding('airport', {
  label: '机场 Airport',
  footprint: [200, 120],
  create(ctx, spec) {
    const g = new THREE.Group();
    const concrete = sharedMaterial('concrete');
    const asphalt = colorMat(0x3a3f46, { roughness: 0.92 });
    const paint = colorMat(0xf3f1ea, { roughness: 0.6 });
    const accent = colorMat(0xe07a2f, { roughness: 0.5 });
    const frame = colorMat(0xd5dbe2, { roughness: 0.45, metalness: 0.35 });
    const bridge = colorMat(0xc5ced6, { roughness: 0.4, metalness: 0.5 });
    const bridgeGlass = colorMat(0x8fb4c8, { roughness: 0.12, metalness: 0.45 });
    const cabGlass = new THREE.MeshStandardMaterial({
      color: 0x8ec3d6, roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.72,
    });
    const vault = new THREE.MeshStandardMaterial({
      color: 0xf4f7f8, roughness: 0.42, metalness: 0.12, side: THREE.DoubleSide,
    });
    const rib = colorMat(0xb9c6d1, { roughness: 0.4, metalness: 0.35 });
    const shaftGlass = new THREE.MeshStandardMaterial({
      color: 0xc5e4f2, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.38, side: THREE.DoubleSide,
    });
    const door = colorMat(0x16384c, { roughness: 0.18, metalness: 0.45 });
    const cabBody = colorMat(0xf4f1ea, { roughness: 0.45, metalness: 0.2 });
    const beacon = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff2200, emissiveIntensity: 0.2 });
    ctx.nightMaterials.push({ material: beacon, intensity: 3.5, blink: true, always: true, base: 0.2 });
    const edgeLight = new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffe7a8, emissiveIntensity: 0.15 });
    ctx.nightMaterials.push({ material: edgeLight, intensity: 1.4, base: 0.15 });
    const mats = {
      concrete, roof: colorMat(0xd9dde2, { roughness: 0.55, metalness: 0.2 }),
      accent, frame, bridge, bridgeGlass, cabGlass, edgeLight, vault, rib, shaftGlass, door, cabBody,
    };

    const [wx, wz] = spec.position;
    const rot = spec.rotation || 0;
    tiledBox(g, 210, 0.1, 96, 0, 0.06, 0, concrete, 0.3);
    // Keep trees off the runways, the infield and the strips between each pair.
    ctx.mask.addRect(wx, wz, 320, 186, rot, 'building');
    for (const rw of RUNWAYS) {
      runwayMarkings(g, rw.z, asphalt, paint);
      ctx.mask.addRect(wx, wz + rw.z, RW_LEN, RW_WID + 6, rot, 'building');
      for (const side of [-1, 1]) {
        for (let i = 0; i <= 12; i++) {
          const x = -RW_LEN / 2 + 8 + i * (RW_LEN - 16) / 12;
          mesh(g, new THREE.SphereGeometry(0.28, 8, 6), mats.edgeLight, x, 0.4, rw.z + side * (RW_WID / 2 + 1.3), { cast: false });
        }
      }
    }
    runwayNumber(g, '09', -RW_LEN / 2 + 28, -75, -Math.PI / 2);
    runwayNumber(g, '27', RW_LEN / 2 - 28, -75, Math.PI / 2);
    runwayNumber(g, '09', -RW_LEN / 2 + 28, 73, -Math.PI / 2);
    runwayNumber(g, '27', RW_LEN / 2 - 28, 73, Math.PI / 2);

    // Taxiways from each apron onto the inner runway, near the west threshold.
    for (const dir of [-1, 1]) {
      const z0 = dir * 14;
      const z1 = dir * 51;
      box(g, 14, 0.08, Math.abs(z1 - z0), -118, 0.1, (z0 + z1) / 2, asphalt);
      box(g, 14, 0.02, 0.35, -118, 0.15, (z0 + z1) / 2, paint);
    }

    const elevators = [];
    const terminals = [
      { x: -46, title: '1号航站楼' },
      { x: 48, title: '2号航站楼' },
    ];
    for (const t of terminals) {
      const hall = terminal(ctx, g, t.x, 0, t.title, mats, elevators);
      for (const dir of [-1, 1]) {
        for (const gx of [-18, 16]) {
          jetBridge(g, t.x + gx, dir * (hall.D / 2), dir, hall.floorY, mats);
          const parked = airliner(0xf4f7f8, t.x < 0 ? 0x1d4c6e : 0xe07a2f, beacon);
          parked.position.set(t.x + gx, 0, dir * 28.5);
          g.add(parked);
        }
      }
    }
    // Towers sit on the open lawn beside each terminal, clear of doors, halls and the curb.
    controlTower(g, -138, -20, mats, beacon);
    controlTower(g, 136, -26, mats, beacon);

    const flights = [
      { group: airliner(0xf7f8f4, 0x1d4c6e, beacon), keys: circuitKeys(-75, -158), phase: 0 },
      { group: airliner(0xf7f8f4, 0xc4562a, beacon), keys: circuitKeys(73, 158), phase: 0.5 },
    ];
    for (const f of flights) {
      f.group.userData.dynamic = true;
      f.group.rotation.order = 'YZX';
      g.add(f.group);
    }

    const period = 26;
    g.userData.animate = (t) => {
      for (const f of flights) {
        const s = ((t / period) + f.phase) % 1;
        const p = sampleCircuit(f.keys, s);
        f.group.position.set(p.x, p.y, p.z);
        f.group.rotation.y = p.yaw;
        f.group.rotation.z = p.pitch;
        f.group.rotation.x = p.bank;
        f.group.userData.gear.visible = p.y < 4.2;
      }
      for (const e of elevators) {
        const u = (Math.sin(t * e.speed + e.phase) + 1) / 2;
        e.car.position.y = e.groundY + (e.upperY - e.groundY) * u;
      }
    };

    g.userData.height = 16;
    return g;
  },
  info() {
    return {
      category: '机场 Airport',
      name: '南瓜机场', nameEn: 'Pumpkin Airport',
      description: '两座航站楼沿岛的长边排开，圆弧玻璃顶、两层幕墙。下层是门，上层连廊桥，楼西端有电梯上下。塔台站在航站楼侧面的空地上。南北两侧各有一组跑道，飞机从跑道起飞、绕场后再降落。',
      featured: true,
    };
  },
});
