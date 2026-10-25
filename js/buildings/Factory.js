// 南湾机械厂 — a small machine works: sawtooth workshop, two-storey office, silos,
// chimney and a loading dock. Replaces the construction site on the far south island.
// Same modeling kit as the other buildings (boxes, cylinders, canvas sign, window walls).
import { registerBuilding } from '../core/Registry.js';
import { textTexture } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';

const THREE = window.THREE;

/** Large lot on 南湾岛, well clear of 南瓜中心岛. */
export const FACTORY_LOT = [42, 456];

export function isFactoryLot(spec) {
  const p = spec.position || [];
  return Math.abs(p[0] - FACTORY_LOT[0]) < 0.2 && Math.abs(p[1] - FACTORY_LOT[1]) < 0.2;
}

export function buildFactory(ctx, spec) {
  const g = new THREE.Group();
  const [lotW, lotD] = spec.size || [50, 50];
  const concrete = sharedMaterial('concrete');
  const steel = sharedMaterial('steel');
  const dark = sharedMaterial('darkSteel');
  const blue = colorMat(0x2f5168, { roughness: 0.55, metalness: 0.35 });
  const roofMat = colorMat(0x8a9298, { roughness: 0.45, metalness: 0.6 });
  const yellow = colorMat(0xe0a106, { roughness: 0.5 });
  const red = colorMat(0xb23b32, { roughness: 0.5 });

  tiledBox(g, lotW - 2, 0.2, lotD - 2, 0, 0.1, 0, concrete, 0.35);

  // Workshop hall, set back so the yard and dock sit on the street side (+Z).
  const hallW = 30, hallD = 20, hallH = 8.2;
  const hx = -4, hz = -6;
  box(g, hallW, hallH, 0.3, hx, hallH / 2 + 0.2, hz - hallD / 2, blue);
  box(g, hallW, hallH, 0.3, hx, hallH / 2 + 0.2, hz + hallD / 2, blue);
  box(g, 0.3, hallH, hallD, hx - hallW / 2, hallH / 2 + 0.2, hz, blue);
  box(g, 0.3, hallH, hallD, hx + hallW / 2, hallH / 2 + 0.2, hz, blue);
  // Clerestory band along the long sides.
  const glass = new THREE.MeshStandardMaterial({
    color: 0xb7d4e2, metalness: 0.75, roughness: 0.08, emissive: 0xfff1d2, emissiveIntensity: 0.08,
  });
  ctx.nightMaterials.push({ material: glass, intensity: 0.55, base: 0.08 });
  for (const side of [-1, 1]) {
    box(g, hallW - 1, 1.3, 0.12, hx, hallH - 1.1, hz + side * (hallD / 2 + 0.05), glass, { cast: false });
  }

  // Sawtooth roof: four glazed north lights.
  const bays = 4;
  const bay = (hallD - 0.6) / bays;
  for (let i = 0; i < bays; i++) {
    const z = hz - hallD / 2 + bay * (i + 0.45);
    const slope = new THREE.Mesh(new THREE.BoxGeometry(hallW - 0.6, 0.16, bay * 0.85), roofMat);
    slope.position.set(hx, hallH + 1.15, z);
    slope.rotation.x = -0.5;
    slope.castShadow = true;
    g.add(slope);
    const light = new THREE.Mesh(new THREE.BoxGeometry(hallW - 0.8, bay * 0.38, 0.1), glass);
    light.position.set(hx, hallH + 1.7, z - bay * 0.32);
    light.rotation.x = 0.55;
    g.add(light);
  }

  // Two-storey office against the street, to the right of the loading dock.
  const floors = 2, floorH = 3.3;
  const offW = 14, offD = 8;
  const ox = 12, oz = 10;
  const front = windowWallMaterial(ctx, {
    cols: 6, rows: floors, wall: 'concrete', frame: '#f4f1ea', glass: '#35586c', seed: 17, winW: 0.62, winH: 0.55, litRatio: 0.7,
  });
  const side = windowWallMaterial(ctx, {
    cols: 3, rows: floors, wall: 'concrete', frame: '#f4f1ea', glass: '#35586c', seed: 18, winW: 0.6, winH: 0.55, litRatio: 0.5,
  });
  const office = new THREE.Mesh(new THREE.BoxGeometry(offW, floors * floorH, offD), [side, side, concrete, concrete, front, front]);
  office.position.set(ox, floors * floorH / 2 + 0.2, oz);
  office.castShadow = true; office.receiveShadow = true;
  g.add(office);
  box(g, offW + 0.4, 0.35, offD + 0.4, ox, floors * floorH + 0.4, oz, concrete);
  box(g, 2.2, 2.4, 0.15, ox, 1.4, oz + offD / 2 + 0.05, dark);

  const signTex = textTexture(['南湾机械厂', 'NANWAN WORKS'], {
    width: 1024, height: 280, bg: '#1e3d52', color: '#f4f7f8',
    font: 'bold 108px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: 'bold 52px Arial, sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3, roughness: 0.45,
  });
  ctx.nightMaterials.push({ material: signMat, intensity: 1.1, base: 0.3 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 0.3), [dark, dark, dark, dark, signMat, dark]);
  sign.position.set(ox, floors * floorH + 2.4, oz + offD / 2 - 0.2);
  sign.castShadow = true;
  g.add(sign);

  // Loading dock and canopy on the street side of the hall.
  box(g, 12, 1.15, 6, hx - 6, 0.75, hz + hallD / 2 + 3.2, concrete);
  box(g, 8, 3.2, 0.15, hx - 6, 2.7, hz + hallD / 2 + 0.1, yellow);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 5), roofMat);
  canopy.position.set(hx - 6, 4.6, hz + hallD / 2 + 2.6);
  canopy.castShadow = true;
  g.add(canopy);
  for (const x of [-5.4, 5.4]) mesh(g, new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), dark, hx - 6 + x, 2.4, hz + hallD / 2 + 4.6);

  // Silos and a banded chimney at the back of the yard.
  for (const dx of [-2.2, 2.2]) {
    mesh(g, new THREE.CylinderGeometry(2.1, 2.1, 11, 16), steel, hx - hallW / 2 - 3.2, 5.7, hz - 4 + dx);
    mesh(g, new THREE.CylinderGeometry(2.25, 2.25, 0.5, 16), dark, hx - hallW / 2 - 3.2, 11.4, hz - 4 + dx);
    rod(g, new THREE.Vector3(hx - hallW / 2, 3, hz - 4 + dx), new THREE.Vector3(hx - hallW / 2 - 1.2, 3, hz - 4 + dx), 0.18, dark);
  }
  const chimneyX = hx + hallW / 2 - 3, chimneyZ = hz - hallD / 2 + 3;
  mesh(g, new THREE.CylinderGeometry(1.15, 1.45, 16, 12), concrete, chimneyX, 8.2, chimneyZ);
  mesh(g, new THREE.CylinderGeometry(1.25, 1.25, 1.2, 12), red, chimneyX, 12.4, chimneyZ);
  mesh(g, new THREE.CylinderGeometry(1.2, 1.2, 0.8, 12), concrete, chimneyX, 13.4, chimneyZ);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 1.1, 12), dark);
  cap.position.set(chimneyX, 16.4, chimneyZ);
  cap.castShadow = true;
  g.add(cap);

  // A few crates on the dock so the yard reads as a working plant.
  box(g, 1.3, 1.1, 1.3, hx - 10, 1.7, hz + hallD / 2 + 3, colorMat(0x8a6238, { roughness: 0.8 }));
  box(g, 1.1, 0.9, 1.1, hx - 8.4, 1.6, hz + hallD / 2 + 3.4, colorMat(0x6e5130, { roughness: 0.8 }));

  g.userData.height = 18;
  g.userData.treeSpots = [];
  return g;
}

registerBuilding('factory', {
  label: '工厂 Factory',
  footprint: [46, 42],
  create(ctx, spec) { return buildFactory(ctx, spec); },
  info() {
    return {
      category: '工厂 Factory',
      name: '南湾机械厂', nameEn: 'Nanwan Works',
      description: '南湾岛上的机械厂，离南瓜中心岛隔着一湾海水。锯齿厂房、两层办公楼、两座筒仓、烟囱和临街的装卸月台。',
      featured: true,
    };
  },
});
