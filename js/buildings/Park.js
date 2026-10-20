// 口袋公园 Pocket park (large lots) and 街角花园 corner garden (small lots): filler for unused lots.
import { registerBuilding } from '../core/Registry.js';
import { sharedMaterial, box, tiledBox } from './materials.js';

const THREE = window.THREE;

function bench(g, x, z, rot) {
  const b = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 });
  box(b, 1.8, 0.08, 0.5, 0, 0.45, 0, wood);
  box(b, 1.8, 0.4, 0.06, 0, 0.75, -0.22, wood);
  for (const sx of [-0.8, 0.8]) box(b, 0.06, 0.45, 0.45, sx, 0.22, 0, sharedMaterial('darkSteel'));
  b.position.set(x, 0, z);
  b.rotation.y = rot;
  g.add(b);
}

function flowerBed(g, x, z, w, d, rng) {
  tiledBox(g, w, 0.45, d, x, 0.22, z, sharedMaterial('stoneDark'), 0.5);
  box(g, w - 0.3, 0.1, d - 0.3, x, 0.47, z, new THREE.MeshStandardMaterial({ color: 0x4b3423, roughness: 1 }), { cast: false });
  const colors = [0xe8423f, 0xf7c548, 0xf0f0f0, 0xd94fa2, 0x8a5cf5];
  const geo = new THREE.SphereGeometry(0.16, 6, 4);
  const mats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const count = Math.round(w * d * 3);
  const inst = mats.map((m) => new THREE.InstancedMesh(geo, m, count));
  const counters = inst.map(() => 0);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rng() * mats.length);
    mtx.makeTranslation(x + (rng() - 0.5) * (w - 0.5), 0.6 + rng() * 0.12, z + (rng() - 0.5) * (d - 0.5));
    inst[k].setMatrixAt(counters[k]++, mtx);
  }
  inst.forEach((m, i) => { m.count = counters[i]; g.add(m); });
}

registerBuilding('pocketPark', {
  label: '口袋公园 Pocket Park',
  footprint: [34, 30],
  create(ctx, spec, rng) {
    const g = new THREE.Group();
    const path = sharedMaterial('paving');
    tiledBox(g, 3, 0.12, 30, 0, 0.06, 0, path, 0.5);
    tiledBox(g, 34, 0.12, 3, 0, 0.06, 0, path, 0.5);
    // Fountain.
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.7, 40), sharedMaterial('stone'));
    basin.position.y = 0.35; basin.castShadow = true; basin.receiveShadow = true;
    g.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 40), sharedMaterial('water'));
    water.position.y = 0.66;
    g.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 16), sharedMaterial('stone'));
    column.position.y = 1.4; column.castShadow = true;
    g.add(column);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), sharedMaterial('stone'));
    bowl.position.y = 2.6;
    g.add(bowl);
    const jetMat = new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.55, roughness: 0.1 });
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 12, 1, true), jetMat);
    jet.position.y = 3.3; jet.rotation.x = Math.PI;
    g.add(jet);
    g.userData.animate = (t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.08; };

    for (const [x, z, r] of [[-6, 3, 0], [6, 3, 0], [-6, -3, Math.PI], [6, -3, Math.PI], [3, 9, Math.PI / 2], [-3, -9, -Math.PI / 2]]) bench(g, x, z, r);
    flowerBed(g, -11, 9, 6, 3, rng);
    flowerBed(g, 11, -9, 6, 3, rng);
    g.userData.treeSpots = [[-12, -10], [-8, -12], [12, 10], [9, 12], [-14, 2.5], [14, -2.5], [-5, 12], [5, -12], [14, 12], [-14, -12]];
    g.userData.height = 4;
    return g;
  },
});

registerBuilding('cornerGarden', {
  label: '街角花园 Corner Garden',
  footprint: [12, 9],
  create(ctx, spec, rng) {
    const g = new THREE.Group();
    tiledBox(g, 12, 0.12, 2, 0, 0.06, 2.5, sharedMaterial('paving'), 0.5);
    flowerBed(g, -3, -1.5, 4.5, 3, rng);
    flowerBed(g, 3, -1.5, 4.5, 3, rng);
    bench(g, -2.5, 2.5, Math.PI);
    bench(g, 2.5, 2.5, Math.PI);
    g.userData.treeSpots = [[-5, -3.5], [5, -3.5]];
    g.userData.height = 3;
    return g;
  },
});
