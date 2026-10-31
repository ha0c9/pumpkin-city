// 南瓜岛医院 — a low outpatient wing beside a taller ward tower, red crosses, and an ambulance bay.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';
import { createAmbulance } from '../world/ambulanceModel.js';
import { createHelicopter } from '../world/Helicopter.js';

const THREE = window.THREE;
const CJK = '"WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';
const RED = 0xd0121a;

function hospitalSign() {
  const c = makeCanvas(2048, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#f4f7f8';
  x.fillRect(0, 0, 2048, 512);
  x.fillStyle = '#d0121a';
  x.fillRect(74, 64, 108, 384);
  x.fillRect(28, 188, 200, 136);
  x.fillRect(520, 78, 12, 356);
  x.fillStyle = '#1b1916';
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.font = `bold 196px ${CJK}`;
  x.fillText('南瓜岛医院', 580, 190);
  x.fillStyle = '#d0121a';
  x.font = 'bold 78px Arial, sans-serif';
  x.fillText('PUMPKIN ISLAND HOSPITAL', 584, 360);
  return canvasTexture(c, { anisotropy: 8 });
}

function crossTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, s, s);
  x.fillStyle = '#d0121a';
  const arm = s * 0.3;
  x.fillRect((s - arm) / 2, s * 0.08, arm, s * 0.84);
  x.fillRect(s * 0.08, (s - arm) / 2, s * 0.84, arm);
  return canvasTexture(c, { anisotropy: 8 });
}

function crossPanel(g, w, x, y, z, ry, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  g.add(m);
  return m;
}

registerBuilding('hospital', {
  label: '医院 Hospital',
  footprint: [70, 54],
  create(ctx) {
    const g = new THREE.Group();
    const white = colorMat(0xf7f8f6, { roughness: 0.72 });
    const red = colorMat(RED, { roughness: 0.45 });
    const trim = sharedMaterial('white');
    const steel = sharedMaterial('darkSteel');
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9ec4d6, metalness: 0.65, roughness: 0.12, emissive: 0xfff0d0, emissiveIntensity: 0.06,
    });
    ctx.nightMaterials.push({ material: glass, intensity: 0.85, base: 0.06 });
    const lobbyGlass = new THREE.MeshStandardMaterial({
      color: 0xd5eef8, metalness: 0.55, roughness: 0.08, transparent: true, opacity: 0.42,
    });

    tiledBox(g, 66, 0.16, 50, 0, 0.08, 0, sharedMaterial('paving'), 0.5);

    // Low outpatient wing on the east (local -X). Front faces +Z, toward 雾林路.
    const low = { x: -20, z: 3, w: 26, h: 11.2, d: 18 };
    box(g, low.w, low.h, low.d, low.x, 0.2 + low.h / 2, low.z, white);
    box(g, low.w + 0.4, 0.7, 0.25, low.x, 1.15, low.z + low.d / 2 + 0.05, red);
    const lowFloors = 3;
    for (let i = 0; i < lowFloors; i++) {
      const y = 2.4 + i * 3.15;
      box(g, low.w - 1.2, 1.15, 0.12, low.x, y, low.z + low.d / 2 + 0.04, glass, { cast: false });
      box(g, 0.12, 1.15, low.d - 2, low.x - low.w / 2 - 0.04, y, low.z, glass, { cast: false });
    }
    box(g, low.w + 1.2, 0.45, low.d + 1.2, low.x, low.h + 0.35, low.z, trim);

    // Ward tower, west side, about eight floors.
    const tower = { x: 6, z: -8, w: 22, h: 30, d: 22 };
    box(g, tower.w, tower.h, tower.d, tower.x, 0.2 + tower.h / 2, tower.z, white);
    box(g, tower.w + 0.3, 0.85, 0.28, tower.x, 1.3, tower.z + tower.d / 2 + 0.06, red);
    for (let i = 0; i < 8; i++) {
      const y = 3.3 + i * 3.35;
      box(g, tower.w - 1.4, 1.25, 0.12, tower.x, y, tower.z + tower.d / 2 + 0.04, glass, { cast: false });
      box(g, 0.12, 1.25, tower.d - 2.2, tower.x + tower.w / 2 + 0.04, y, tower.z, glass, { cast: false });
      box(g, 0.12, 1.25, tower.d - 2.2, tower.x - tower.w / 2 - 0.04, y, tower.z, glass, { cast: false });
    }
    box(g, tower.w + 1.4, 0.55, tower.d + 1.4, tower.x, tower.h + 0.4, tower.z, trim);
    box(g, 8, 2.5, 6, tower.x, tower.h + 1.9, tower.z - 6, white);

    // Entrance block in the gap, facing the road.
    box(g, 12, 5.1, 7, -1, 2.7, 15.2, white);
    box(g, 3.2, 2.6, 0.08, -3.2, 1.7, 18.75, lobbyGlass, { cast: false });
    box(g, 3.2, 2.6, 0.08, 1.4, 1.7, 18.75, lobbyGlass, { cast: false });
    box(g, 4.2, 1.05, 1.1, -0.6, 0.75, 16.2, colorMat(0xe7eef2, { roughness: 0.55 }));
    const canopy = box(g, 14, 0.32, 3.4, -1, 5.15, 20.2, trim);
    canopy.castShadow = true;
    for (const x of [-7.2, 5.2]) box(g, 0.22, 5, 0.22, x, 2.5, 21.4, white);

    const signTex = hospitalSign();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.18, roughness: 0.5,
    });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.15, base: 0.18 });
    const edge = steel;
    const board = new THREE.Mesh(new THREE.BoxGeometry(16.5, 3.15, 0.18), [edge, edge, edge, edge, signMat, edge]);
    board.position.set(low.x, 8.7, low.z + low.d / 2 + 0.2);
    board.castShadow = true;
    g.add(board);

    const crossMap = crossTexture();
    const crossMat = new THREE.MeshStandardMaterial({
      map: crossMap, emissive: 0xffffff, emissiveMap: crossMap, emissiveIntensity: 0.2, roughness: 0.4,
    });
    ctx.nightMaterials.push({ material: crossMat, intensity: 0.9, base: 0.2 });
    crossPanel(g, 6.6, tower.x, 21.2, tower.z + tower.d / 2 + 0.2, 0, crossMat);
    crossPanel(g, 6.2, tower.x + tower.w / 2 + 0.16, 21.2, tower.z, Math.PI / 2, crossMat);

    // Roof helipad replaces the roof cross. The shuttle flies to America Tower 2.
    const padMap = (() => {
      const c = makeCanvas(256, 256);
      const x = c.getContext('2d');
      x.fillStyle = '#2c4634';
      x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#f4f4f2';
      x.lineWidth = 14;
      x.beginPath();
      x.arc(128, 128, 100, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = '#f4f4f2';
      x.fillRect(86, 68, 22, 120);
      x.fillRect(148, 68, 22, 120);
      x.fillRect(86, 117, 84, 22);
      return canvasTexture(c, { anisotropy: 4 });
    })();
    const padMat = new THREE.MeshStandardMaterial({ map: padMap, roughness: 0.9 });
    const padY = tower.h + 0.82;
    const padZ = tower.z + 4;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.28, 28), [steel, padMat, steel]);
    pad.position.set(tower.x, padY, padZ);
    pad.castShadow = true;
    g.add(pad);
    const padLight = new THREE.MeshStandardMaterial({ color: 0x16331c, emissive: 0x39ff6a, emissiveIntensity: 0.15 });
    ctx.nightMaterials.push({ material: padLight, intensity: 2 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(g, new THREE.SphereGeometry(0.16, 8, 6), padLight, tower.x + Math.cos(a) * 4.7, padY + 0.22, padZ + Math.sin(a) * 4.7, { cast: false });
    }
    const padTop = padY + 0.14;
    const yaw = new THREE.Group();
    yaw.userData.dynamic = true;
    const heli = createHelicopter();
    yaw.add(heli);
    g.add(yaw);
    g.userData.heli = yaw;

    // Ambulance bay on the west side of the plaza, three bays facing the road.
    const asphalt = colorMat(0x3a3f46, { roughness: 0.92 });
    const line = colorMat(0xf3f4f2, { roughness: 0.6 });
    box(g, 16.5, 0.06, 20, 26, 0.2, 12, asphalt, { cast: false });
    for (const x of [20.2, 24.6, 29, 33.4]) box(g, 0.1, 0.02, 6.2, x, 0.26, 13, line, { cast: false });
    box(g, 14, 0.28, 2.6, 26, 3.35, 3.2, red);
    const er = makeCanvas(512, 160);
    const ex = er.getContext('2d');
    ex.fillStyle = '#d0121a';
    ex.fillRect(0, 0, 512, 160);
    ex.fillStyle = '#ffffff';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    ex.font = `bold 92px ${CJK}`;
    ex.fillText('急诊', 256, 80);
    const erTex = canvasTexture(er, { anisotropy: 4 });
    const erMat = new THREE.MeshStandardMaterial({ map: erTex, emissive: 0xffffff, emissiveMap: erTex, emissiveIntensity: 0.2, roughness: 0.45 });
    ctx.nightMaterials.push({ material: erMat, intensity: 1, base: 0.2 });
    const erBoard = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.12), [red, red, red, red, erMat, red]);
    erBoard.position.set(26, 3.15, 4.55);
    g.add(erBoard);

    const lamps = [];
    for (const x of [22.2, 26.8, 31.2]) {
      const amb = createAmbulance();
      amb.position.set(x, 0.22, 13.2);
      g.add(amb);
      lamps.push(amb.userData.lamps);
    }
    const padLocal = new THREE.Vector3(tower.x, padTop, padZ);
    // America Tower 2 helipad: local top is yTop + 6.75, island ground is 2.
    const towerPad = new THREE.Vector3(113, 2 + 12.8 + 26 * 3.6 + 6.75, -33);
    g.userData.animate = (t) => {
      const f = 0.5 + 0.5 * Math.sin(t * 10);
      for (const [a, b] of lamps) {
        a.emissiveIntensity = 0.2 + f * 2.6;
        b.emissiveIntensity = 0.2 + (1 - f) * 2.6;
      }
      const dwell = 12, fly = 18, cycle = (dwell + fly) * 2;
      const u = t % cycle;
      const ease = (x) => x * x * (3 - 2 * x);
      // Parent rotation is PI, so local (lx, lz) maps to world (px - lx, pz - lz).
      const here = new THREE.Vector3(g.position.x - padLocal.x, g.position.y + padLocal.y, g.position.z - padLocal.z);
      let from = here, to = towerPad, k = 0, flying = false;
      if (u < dwell) { from = here; to = towerPad; k = 0; }
      else if (u < dwell + fly) { from = here; to = towerPad; k = ease((u - dwell) / fly); flying = true; }
      else if (u < dwell * 2 + fly) { from = towerPad; to = here; k = 0; }
      else { from = towerPad; to = here; k = ease((u - dwell * 2 - fly) / fly); flying = true; }
      const lift = flying ? Math.sin(k * Math.PI) * 38 : 0;
      const wx = from.x + (to.x - from.x) * k;
      const wy = from.y + (to.y - from.y) * k + lift;
      const wz = from.z + (to.z - from.z) * k;
      yaw.position.set(g.position.x - wx, wy - g.position.y, g.position.z - wz);
      const faceX = to.x - from.x, faceZ = to.z - from.z;
      const worldYaw = Math.atan2(faceX, faceZ);
      yaw.rotation.y = worldYaw - Math.PI;
      heli.rotation.x = flying ? 0.16 : 0;
      heli.userData.rotor.rotation.y = t * 22;
      heli.userData.tailRotor.rotation.x = t * 36;
      heli.userData.beacon.emissiveIntensity = 0.2 + (0.5 + 0.5 * Math.sin(t * (flying ? 16 : 4))) * 2.2;
    };

    g.userData.treeSpots = [[-32, 22], [10, 23]];
    g.userData.height = tower.h + 6;
    return g;
  },
});
