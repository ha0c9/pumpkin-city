// 美国大厦 America Tower — glass curtain-wall supertall with setbacks, crown and spire.
import { registerBuilding } from '../core/Registry.js';
import { textTexture } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, box, tiledBox } from './materials.js';

const THREE = window.THREE;

function prism(group, w, h, d, y, wallMat, roofMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
  m.position.y = y + h / 2;
  m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  return m;
}

function octagon(group, r, h, y, wallMat, roofMat) {
  let g = new THREE.CylinderGeometry(r, r, h, 8, 1);
  g.rotateY(Math.PI / 8);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, [wallMat, roofMat, roofMat]);
  m.position.y = y + h / 2;
  m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  return m;
}

registerBuilding('americaTower', {
  label: '超高层 Skyscraper',
  footprint: [36, 33],
  create(ctx, spec = {}) {
    const g = new THREE.Group();
    const signLines = spec.sign || ['美国大厦 1号楼', 'AMERICA TOWER 1'];
    const steel = sharedMaterial('steel');
    const roof = sharedMaterial('roof');
    const floorH = 4;

    // Plaza.
    tiledBox(g, 36, 0.3, 33, 0, 0.15, 0, sharedMaterial('paving'), 0.5);

    // Lobby podium: double-height clear glass with stone frame.
    const lobbyGlass = curtainWallMaterial(ctx, { cols: 12, rows: 2, seed: 4, tint: [70, 95, 110], mullion: '#d8dde2', litRatio: 0.9 });
    prism(g, 28, 9, 28, 0.3, lobbyGlass, roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 1.2, 9.6, 1.2, sx * 14, 4.9, sz * 14, sharedMaterial('stone'));
    box(g, 29.2, 0.8, 29.2, 0, 9.6, 0, sharedMaterial('stone'));

    // Tier 1.
    const h1 = 13 * floorH;
    const glass1 = curtainWallMaterial(ctx, { cols: 16, rows: 13, seed: 11 });
    prism(g, 26, h1, 26, 10, glass1, roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.5, h1, 0.5, sx * 13.05, 10 + h1 / 2, sz * 13.05, steel, { receive: false });
    box(g, 27, 0.7, 27, 0, 10 + h1, 0, steel);

    // Tier 2: octagonal.
    const y2 = 10 + h1 + 0.7;
    const h2 = 9 * floorH;
    const glass2 = curtainWallMaterial(ctx, { cols: 6, rows: 9, seed: 12, tint: [36, 66, 92], repeatX: 8 });
    octagon(g, 12.5, h2, y2, glass2, roof);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.7, 8), steel);
    ring.rotation.y = Math.PI / 8;
    ring.position.y = y2 + h2;
    g.add(ring);

    // Tier 3.
    const y3 = y2 + h2 + 0.35;
    const h3 = 6 * floorH;
    const glass3 = curtainWallMaterial(ctx, { cols: 11, rows: 6, seed: 13, tint: [44, 76, 104] });
    prism(g, 16, h3, 16, y3, glass3, roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.45, h3 + 4, 0.45, sx * 8.05, y3 + (h3 + 4) / 2, sz * 8.05, steel, { receive: false });

    // Crown: open steel fins around a lit lantern.
    const yc = y3 + h3;
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xbfd8ea, metalness: 0.7, roughness: 0.1, emissive: 0xcfe6ff, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: lanternMat, intensity: 1.6 });
    box(g, 12, 6, 12, 0, yc + 3, 0, lanternMat);
    for (let i = 0; i < 4; i++) {
      for (let k = -3; k <= 3; k++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8 - Math.abs(k) * 0.6, 0.9), steel);
        const a = i * Math.PI / 2;
        const off = k * 1.9;
        fin.position.set(Math.sin(a) * 7.6 + Math.cos(a) * off, yc + (8 - Math.abs(k) * 0.6) / 2, Math.cos(a) * 7.6 - Math.sin(a) * off);
        fin.rotation.y = a;
        fin.castShadow = true;
        g.add(fin);
      }
    }
    // Spire with aviation light.
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.7, 20, 10), steel);
    spire.position.y = yc + 6 + 10;
    spire.castShadow = true;
    g.add(spire);
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a00, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: beaconMat, intensity: 6, blink: true, always: true });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), beaconMat);
    beacon.position.y = yc + 26.3;
    g.add(beacon);

    // Entrance canopy + sign facing +Z.
    box(g, 14, 0.5, 2.8, 0, 6.5, 15.4, steel);
    for (const sx of [-1, 1]) box(g, 0.3, 6.3, 0.3, sx * 6.6, 3.45, 16.5, steel);
    const signTex = textTexture(signLines, { width: 1024, height: 256, color: '#f5f1e6', glow: 'rgba(255,220,160,0.6)' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25, roughness: 0.4 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.4, base: 0.25 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signMat);
    sign.position.set(0, 7.9, 14.05);
    g.add(sign);
    // Monument sign on the plaza.
    box(g, 6, 1.6, 0.8, -13.5, 1.1, 15.6, sharedMaterial('stoneDark'));
    const mono = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshStandardMaterial({ map: textTexture(signLines, { color: '#2a2a2a' }), transparent: true }));
    mono.position.set(-13.5, 1.15, 16.02);
    g.add(mono);

    g.userData.treeSpots = [[-16.2, -12], [16.2, -12], [-16.2, -3], [16.2, -3], [-16.2, 6], [16.2, 6], [13.5, 15.6]];
    g.userData.height = yc + 26;
    return g;
  },
});
