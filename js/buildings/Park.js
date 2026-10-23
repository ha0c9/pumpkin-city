// 口袋公园 Pocket park (large lots) and 街角花园 corner garden (small lots): filler for unused lots.
import { registerBuilding } from '../core/Registry.js';
import { sharedMaterial, colorMat, box, tiledBox } from './materials.js';

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

function playground(g, x, z) {
  const red = colorMat(0xe23b3b, { roughness: 0.5 }), yellow = colorMat(0xf6c344, { roughness: 0.5 }), blue = colorMat(0x2f7fd0, { roughness: 0.5 });
  box(g, 10, 0.08, 8, x, 0.12, z, colorMat(0xd9c49a, { roughness: 1 }), { cast: false }); // sand
  // Slide tower.
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(g, 0.15, 2.6, 0.15, x - 2.5 + dx, 1.3, z + dz, blue);
  box(g, 2.3, 0.15, 2.3, x - 2.5, 1.6, z, yellow);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1, 4), red);
  roof.rotation.y = Math.PI / 4; roof.position.set(x - 2.5, 3.1, z); roof.castShadow = true;
  g.add(roof);
  const slide = box(g, 0.9, 0.08, 3.6, x - 2.5, 0.95, z + 2.6, red);
  slide.rotation.x = 0.48;
  // Swings.
  for (const sx of [-1, 1]) {
    const leg = box(g, 0.12, 2.6, 0.12, x + 2.5 + sx * 2, 1.3, z - 2, blue);
    leg.rotation.z = sx * 0.1;
  }
  box(g, 4.4, 0.12, 0.12, x + 2.5, 2.6, z - 2, blue);
  for (const sx of [-0.9, 0.9]) box(g, 0.6, 0.06, 0.3, x + 2.5 + sx, 0.6, z - 2, yellow);
  // See-saw.
  box(g, 0.3, 0.5, 0.3, x + 2.5, 0.35, z + 2.2, blue);
  const bar = box(g, 3.6, 0.1, 0.3, x + 2.5, 0.62, z + 2.2, yellow);
  bar.rotation.z = 0.15;
}

registerBuilding('pocketPark', {
  label: '城市公园 City Park',
  footprint: [34, 30],
  create(ctx, spec, rng) {
    const g = new THREE.Group();
    const [W, D] = spec.size || [34, 30];
    const path = sharedMaterial('paving');
    const lawn = colorMat(0x5c9e45, { roughness: 0.95 });
    // Four lawns separated by a cross of paths and a perimeter walk.
    const qw = (W - 6) / 2 - 2, qd = (D - 6) / 2 - 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(g, qw, 0.14, qd, sx * (qw / 2 + 1.5), 0.07, sz * (qd / 2 + 1.5), lawn, { cast: false });
    }
    tiledBox(g, 3, 0.12, D, 0, 0.06, 0, path, 0.5);
    tiledBox(g, W, 0.12, 3, 0, 0.06, 0, path, 0.5);
    for (const sz of [-1, 1]) tiledBox(g, W, 0.1, 2, 0, 0.05, sz * (D / 2 - 1), path, 0.5);
    for (const sx of [-1, 1]) tiledBox(g, 2, 0.1, D, sx * (W / 2 - 1), 0.05, 0, path, 0.5);
    // Playground and pond in two quadrants when there is room.
    const big = W > 40 && D > 34;
    const qx = qw / 2 + 1.5, qz = qd / 2 + 1.5;
    if (big) {
      playground(g, -qx, qz);
      const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), sharedMaterial('water'));
      pond.rotation.x = -Math.PI / 2;
      pond.scale.set(qw * 0.36, qd * 0.32, 1);
      pond.position.set(qx, 0.2, -qz);
      g.add(pond);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), sharedMaterial('stone'));
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(qw * 0.36, qd * 0.32, 4);
      rim.position.set(qx, 0.2, -qz);
      g.add(rim);
      // Little wooden pavilion beside the pond.
      const wood = colorMat(0x8a5a32, { roughness: 0.8 });
      for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) box(g, 0.25, 2.8, 0.25, qx - qw * 0.38 + dx, 1.4, -qz + qd * 0.3 + dz, wood);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 4), colorMat(0x7a2e22, { roughness: 0.7 }));
      roof.rotation.y = Math.PI / 4; roof.position.set(qx - qw * 0.38, 3.4, -qz + qd * 0.3); roof.castShadow = true;
      g.add(roof);
    }
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
    const fx = Math.min(qx, 11), fz = Math.min(qz, 9);
    flowerBed(g, big ? -qx : -fx, big ? -qz : fz, 6, 3, rng);
    flowerBed(g, fx, big ? qz : -fz, 6, 3, rng);
    // Trees around the perimeter walk and inside the lawns.
    const spots = [];
    const hx = W / 2 - 3.2, hz = D / 2 - 3.2;
    for (let x = -hx; x <= hx + 0.1; x += Math.max(7, (2 * hx) / Math.round(2 * hx / 9))) {
      if (Math.abs(x) > 3.5) { spots.push([x, -hz], [x, hz]); }
    }
    for (let z = -hz + 8; z <= hz - 8 + 0.1; z += 9) if (Math.abs(z) > 3.5) spots.push([-hx, z], [hx, z]);
    const inner = big ? [[qx, qz], [-qx, -qz]] : [[-qx, -qz], [qx, qz], [-qx, qz], [qx, -qz]];
    for (const [x, z] of inner) for (let k = 0; k < 3; k++) spots.push([x + (rng() - 0.5) * qw * 0.6, z + (rng() - 0.5) * qd * 0.6]);
    g.userData.treeSpots = spots.filter(([x, z]) => Math.hypot(x, z) > 6.5);
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
