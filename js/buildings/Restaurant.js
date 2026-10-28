// 南瓜大道意面馆 — two-storey pasta house. Ground and upper floors are dining rooms
// (tables set for service); a stair against the left wall climbs to the second floor.
// Built the same way as the other buildings: boxes, canvas signs, shared materials.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';
import { pastaBowl } from './easterEggs.js';

const THREE = window.THREE;

/** The small lot on the south side of 南瓜大道 that used to be a Lawson. */
export const RESTAURANT_LOT = [24, 18];

export function isRestaurantLot(spec) {
  const p = spec.position || [];
  return Math.abs(p[0] - RESTAURANT_LOT[0]) < 0.2 && Math.abs(p[1] - RESTAURANT_LOT[1]) < 0.2;
}

function signTexture() {
  const c = makeCanvas(1024, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#8e2f2a'; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#f3d48a'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 246, 1024, 10);
  x.fillStyle = '#fff8ee';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 108px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillText('南瓜大道意面馆', 512, 100);
  x.font = 'bold 48px "Arial","Helvetica Neue",sans-serif';
  x.fillStyle = '#f3d48a';
  x.fillText('PUMPKIN AVENUE  ·  PASTA', 512, 188);
  return canvasTexture(c, { anisotropy: 8 });
}

function table(g, x, y, z, wood, cloth, chair) {
  box(g, 0.12, 0.72, 0.12, x, y + 0.36, z, wood);
  box(g, 1.15, 0.06, 1.15, x, y + 0.76, z, wood);
  box(g, 1.02, 0.02, 1.02, x, y + 0.8, z, cloth);
  const seats = [[0.78, 0], [-0.78, 0], [0, 0.78], [0, -0.78]];
  for (const [dx, dz] of seats) {
    box(g, 0.38, 0.08, 0.38, x + dx, y + 0.46, z + dz, chair);
    const backY = y + 0.72;
    if (dx !== 0) box(g, 0.06, 0.42, 0.36, x + dx + Math.sign(dx) * 0.16, backY, z + dz, chair);
    else box(g, 0.36, 0.42, 0.06, x + dx, backY, z + dz + Math.sign(dz) * 0.16, chair);
  }
  mesh(g, new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), cloth, x - 0.22, y + 0.84, z);
  mesh(g, new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), cloth, x + 0.22, y + 0.84, z);
}

export function buildRestaurant(ctx) {
  const g = new THREE.Group();
  const W = 11, D = 7.4, floorH = 3.15;
  const wall = colorMat(0xf4efe6, { roughness: 0.7 });
  const trim = colorMat(0x6e3b2a, { roughness: 0.55 });
  const floorMat = colorMat(0xc4a06a, { roughness: 0.45 });
  const cloth = colorMat(0xf7f1e6, { roughness: 0.6 });
  const chair = colorMat(0x2e3c34, { roughness: 0.6 });
  const stairMat = colorMat(0x8d5a32, { roughness: 0.5 });
  const red = colorMat(0x8e2f2a, { roughness: 0.5 });
  const steel = sharedMaterial('darkSteel');
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc5ddd4, metalness: 0.7, roughness: 0.06, transparent: true, opacity: 0.22,
    envMapIntensity: 1.2, side: THREE.DoubleSide,
  });

  tiledBox(g, 14, 0.2, 11, 0, 0.1, 0, sharedMaterial('paving'), 0.5);
  box(g, W - 0.4, 0.08, D - 0.4, 0, 0.26, 0, floorMat);

  // Side walls are frames with glass, so the dining rooms and the stair read from the street, not only from the front.
  for (const x of [-W / 2, W / 2]) {
    box(g, 0.24, 0.45, D, x, 0.45, 0, wall);
    box(g, 0.24, 0.28, D, x, floorH + 0.2, 0, trim);
    box(g, 0.24, 0.4, D, x, floorH * 2 + 0.05, 0, wall);
    for (const z of [-D / 2 + 0.1, D / 2 - 0.1]) box(g, 0.24, floorH * 2, 0.22, x, floorH + 0.15, z, wall);
    for (let i = 1; i <= 3; i++) {
      box(g, 0.12, floorH * 2 - 0.55, 0.1, x, floorH + 0.22, -D / 2 + 0.45 + i * (D - 0.9) / 4, trim);
    }
    for (const floor of [0, 1]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.7, floorH - 0.85), glass);
      pane.position.set(x + Math.sign(x) * 0.08, floor * floorH + floorH / 2 + 0.28, 0);
      pane.rotation.y = Math.PI / 2;
      g.add(pane);
    }
  }
  box(g, W, 0.28, D + 0.3, 0, floorH * 2 + 0.34, 0, trim);
  box(g, W + 0.5, 0.35, D + 0.5, 0, floorH * 2 + 0.62, 0, sharedMaterial('roof'));

  // Second-floor slab stops short of the left wall, leaving the stairwell open.
  const slabLeft = -W / 2 + 2.15;
  box(g, W - 2.15, 0.16, D - 0.5, (slabLeft + W / 2) / 2, floorH + 0.2, 0, floorMat);
  // Balustrade along the open edge of the upper floor.
  box(g, 0.08, 0.85, D - 0.7, slabLeft, floorH + 0.7, 0, trim);
  for (let i = 0; i < 6; i++) {
    box(g, 0.06, 0.7, 0.06, slabLeft, floorH + 0.62, -D / 2 + 0.8 + i * (D - 1.2) / 5, steel);
  }

  // Stair, left wall, climbing toward the back. Treads only, so the run reads as a staircase.
  const steps = 14;
  const run = 4.1;
  const sx = -W / 2 + 1.05;
  const z0 = 1.7;
  for (let i = 0; i < steps; i++) {
    const y = 0.26 + ((i + 1) / steps) * floorH;
    const z = z0 - ((i + 0.5) / steps) * run;
    box(g, 1.25, 0.08, run / steps + 0.04, sx, y, z, stairMat);
  }
  const railA = new THREE.Vector3(sx - 0.55, 0.9, z0);
  const railB = new THREE.Vector3(sx - 0.55, 0.9 + floorH, z0 - run);
  const railC = new THREE.Vector3(sx + 0.55, 0.9, z0);
  const railD = new THREE.Vector3(sx + 0.55, 0.9 + floorH, z0 - run);
  rod(g, railA, railB, 0.035, steel);
  rod(g, railC, railD, 0.035, steel);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    rod(g, new THREE.Vector3(sx - 0.55, 0.26, z0 - t * run), new THREE.Vector3(sx - 0.55, 0.9 + t * floorH, z0 - t * run), 0.03, steel);
  }

  // Kitchen pass at the back of the ground floor, clear of the stair.
  box(g, 5.2, 0.9, 0.55, 1.6, 0.7, -D / 2 + 0.55, trim);
  box(g, 5.2, 0.08, 0.5, 1.6, 1.18, -D / 2 + 0.55, cloth);

  const ground = [[0.3, -1.35], [2.6, -1.35], [0.3, 1.15], [2.6, 1.15]];
  for (const [x, z] of ground) table(g, x, 0.26, z, stairMat, cloth, chair);
  pastaBowl(g, 2.6, 1.08, 1.28).scale.setScalar(2.3);
  const upper = [[-0.4, -1.2], [2.2, -1.2], [0.9, 1.15]];
  for (const [x, z] of upper) table(g, x, floorH + 0.28, z, stairMat, cloth, chair);

  // Warm ceilings, visible through the glass and lit at night.
  for (const y of [floorH + 0.05, floorH * 2 + 0.12]) {
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 2.4, D - 0.6),
      new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffe0b0, emissiveIntensity: 0.25 }),
    );
    ctx.nightMaterials.push({ material: ceil.material, intensity: 0.9, base: 0.25 });
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(1.2, y, 0);
    g.add(ceil);
  }

  // Glass on the street front and the south side, split by the floor slab so both rooms show.
  for (const z of [D / 2, -D / 2]) {
    for (const floor of [0, 1]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, floorH - 0.55), glass);
      pane.position.set(0.15, floor * floorH + (floorH - 0.55) / 2 + 0.4, z);
      if (z < 0) pane.rotation.y = Math.PI;
      g.add(pane);
    }
    box(g, W, 0.16, 0.12, 0, floorH + 0.2, z, trim);
    for (let i = 0; i <= 4; i++) {
      box(g, 0.08, floorH * 2 - 0.2, 0.1, -W / 2 + 0.4 + i * (W - 0.8) / 4, floorH + 0.15, z, trim);
    }
  }

  // Awning and the illuminated fascia over the avenue entrance (local +Z, faces north).
  const awning = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.1, 1.5), red);
  awning.position.set(1.2, floorH - 0.12, D / 2 + 0.95);
  awning.rotation.x = 0.18;
  awning.castShadow = true;
  g.add(awning);
  const signTex = signTexture();
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, roughness: 0.45,
  });
  ctx.nightMaterials.push({ material: signMat, intensity: 1.15, base: 0.35 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 1.15, 0.22), [red, red, red, red, signMat, red]);
  sign.position.set(0, floorH * 2 - 0.15, D / 2 + 0.08);
  sign.castShadow = true;
  g.add(sign);

  g.userData.height = floorH * 2 + 1.2;
  return g;
}

registerBuilding('restaurant', {
  label: '意面馆 Pasta',
  footprint: [14, 11],
  create(ctx, spec) { return buildRestaurant(ctx, spec); },
  info() {
    return {
      category: '意面馆 Pasta',
      name: '南瓜大道意面馆', nameEn: 'Pumpkin Avenue Pasta',
      description: '两层意面馆。一楼和二楼都摆着餐桌，左墙的楼梯通到二楼，临街两面是玻璃，从外面就能看见里面。',
      featured: true,
    };
  },
});
