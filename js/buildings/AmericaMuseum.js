// 美国博物馆 Museum of America — Federal-style red brick hall, white Corinthian portico, cupola and steeple.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, mergeSimple } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';

const THREE = window.THREE;

function usFlagTexture() {
  const c = makeCanvas(380, 200);
  const x = c.getContext('2d');
  for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#b22234'; x.fillRect(0, i * 200 / 13, 380, 200 / 13 + 1); }
  x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, 152, 200 * 7 / 13);
  x.fillStyle = '#fff';
  for (let r = 0; r < 9; r++) {
    for (let k = 0; k < (r % 2 ? 5 : 6); k++) {
      x.beginPath(); x.arc(13 + k * 25 + (r % 2 ? 12 : 0), 9 + r * 11.5, 3.2, 0, Math.PI * 2); x.fill();
    }
  }
  return canvasTexture(c);
}

/** Gable roof prism over a w x d block (ridge along X). */
function gable(w, d, h) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, 0);
  return g;
}

function hall(ctx, g, w, h, d, x, z, floors, seed) {
  const front = windowWallMaterial(ctx, { cols: Math.round(w / 3.2), rows: floors, wall: 'brick', frame: '#f6f3ea', glass: '#2f3e4c', seed, winW: 0.46, winH: 0.62, litRatio: 0.55 });
  const side = windowWallMaterial(ctx, { cols: Math.round(d / 3.2), rows: floors, wall: 'brick', frame: '#f6f3ea', glass: '#2f3e4c', seed: seed + 1, winW: 0.46, winH: 0.62, litRatio: 0.55 });
  for (const m of [front, side]) m.color.set(0xd8a090);
  const roof = sharedMaterial('roof');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, front, front]);
  m.position.set(x, 1.2 + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  const white = sharedMaterial('white');
  box(g, w + 0.6, 0.9, d + 0.6, x, 1.2 + h + 0.45, z, white);  // cornice
  box(g, w + 0.3, 0.35, d + 0.3, x, 1.2 + h * 0.5, z, white);  // string course
  return m;
}

registerBuilding('americaMuseum', {
  label: '博物馆 Museum',
  footprint: [52, 42],
  create(ctx) {
    const g = new THREE.Group();
    const white = sharedMaterial('white');
    const slate = colorMat(0x4a4f57, { roughness: 0.75 });

    // Plaza, lawn and paths.
    tiledBox(g, 52, 0.3, 42, 0, 0.15, 0, sharedMaterial('paving'), 0.5);
    for (const sx of [-1, 1]) box(g, 18, 0.1, 9, sx * 15, 0.35, 15.5, colorMat(0x4f8f3c, { roughness: 0.95 }), { cast: false });

    // Raised basement + main block + wings.
    tiledBox(g, 46, 1.2, 22, 0, 0.6, -6, sharedMaterial('stoneDark'), 0.25);
    hall(ctx, g, 26, 13, 18, 0, -6, 3, 71);
    for (const sx of [-1, 1]) hall(ctx, g, 10, 9, 15, sx * 17.5, -6, 2, 73 + sx);
    const mainRoof = mesh(g, gable(26.6, 18.6, 5.2), slate, 0, 14.6, -6);
    mainRoof.castShadow = true;
    for (const sx of [-1, 1]) mesh(g, gable(10.6, 15.6, 3.6), slate, sx * 17.5, 10.6, -6);
    for (const sx of [-1, 1]) for (const dx of [-8, 8]) box(g, 1.6, 4, 1.6, dx, 17.8, -6 + sx * 2.5, colorMat(0x9c4a3a, { roughness: 0.85 })); // chimneys

    // Portico: steps, six Corinthian columns, entablature with inscription, pediment.
    for (let i = 0; i < 6; i++) tiledBox(g, 18, 0.3 * (i + 1), 0.7, 0, 0.3 + 0.15 * (i + 1), 8.95 + (5 - i) * 0.7, white, 0.25);
    tiledBox(g, 18, 0.4, 6, 0, 2.0, 5.6, white, 0.25);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const cx = -7.5 + i * 3;
      const shaft = new THREE.CylinderGeometry(0.55, 0.65, 9.2, 20); shaft.translate(cx, 2.2 + 0.3 + 4.6, 7.6); parts.push(shaft);
      const base = new THREE.CylinderGeometry(0.85, 0.9, 0.5, 20); base.translate(cx, 2.45, 7.6); parts.push(base);
      const cap = new THREE.CylinderGeometry(0.95, 0.6, 0.9, 20); cap.translate(cx, 2.2 + 9.8, 7.6); parts.push(cap);
      const abacus = new THREE.BoxGeometry(1.9, 0.3, 1.9); abacus.translate(cx, 2.2 + 10.4, 7.6); parts.push(abacus);
    }
    mesh(g, mergeSimple(parts), white);
    tiledBox(g, 19.4, 1.6, 6.4, 0, 13.4, 5.6, white, 0.25);
    const inscription = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.2), new THREE.MeshStandardMaterial({
      map: textTexture(['MUSEUM OF AMERICA · 美国博物馆'], { width: 2048, height: 128, color: '#3b3226', font: 'bold 80px "Times New Roman","PingFang SC",serif' }),
      transparent: true, roughness: 0.8,
    }));
    inscription.position.set(0, 13.4, 8.82);
    g.add(inscription);
    const ped = new THREE.Shape();
    ped.moveTo(-9.9, 0); ped.lineTo(9.9, 0); ped.lineTo(0, 3.6); ped.lineTo(-9.9, 0);
    const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 6.4, bevelEnabled: false });
    mesh(g, pedGeo, white, 0, 14.2, 2.4);
    const disk = mesh(g, new THREE.CircleGeometry(1.1, 24), colorMat(0xc9a23a, { metalness: 0.9, roughness: 0.3 }), 0, 15.5, 8.82);
    disk.castShadow = false;

    // Front door with fanlight, warm at night.
    const door = new THREE.MeshStandardMaterial({ color: 0x223a2e, roughness: 0.5, emissive: 0xffc77a, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: door, intensity: 0.5 });
    box(g, 3, 4.6, 0.3, 0, 2.2 + 2.3, 3.05, door);
    const fan = mesh(g, new THREE.CircleGeometry(1.5, 20, 0, Math.PI), door, 0, 6.8, 3.22);
    fan.castShadow = false;

    // Cupola: square base, octagonal lantern with arched openings, dome and steeple.
    tiledBox(g, 5.2, 3, 5.2, 0, 19.8 + 1.5 - 1.6, -6, white, 0.3);
    const lantern = mesh(g, new THREE.CylinderGeometry(2, 2, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.5, emissive: 0xffe3a8, emissiveIntensity: 0 }), 0, 23.1, -6);
    ctx.nightMaterials.push({ material: lantern.material, intensity: 0.35 });
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) / 8 * Math.PI * 2;
      const col = mesh(g, new THREE.BoxGeometry(0.28, 3.4, 0.28), white, Math.sin(a) * 2.05, 23.1, -6 + Math.cos(a) * 2.05);
      col.castShadow = false;
    }
    mesh(g, new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), colorMat(0x5b7f73, { metalness: 0.4, roughness: 0.45 }), 0, 24.8, -6);
    mesh(g, new THREE.ConeGeometry(0.55, 6, 8), white, 0, 29.6, -6);
    mesh(g, new THREE.SphereGeometry(0.35, 12, 8), colorMat(0xd4af37, { metalness: 1, roughness: 0.25 }), 0, 32.7, -6);

    // Flagpole with the Stars and Stripes on the lawn.
    mesh(g, new THREE.CylinderGeometry(0.09, 0.12, 14, 10), sharedMaterial('steel'), 0, 7.3, 16);
    const flagGeo = new THREE.PlaneGeometry(3.8, 2, 12, 2);
    flagGeo.translate(1.9, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: usFlagTexture(), side: THREE.DoubleSide, roughness: 0.85 }));
    flag.position.set(0.1, 13, 16);
    flag.castShadow = true;
    flag.userData.dynamic = true;
    g.add(flag);
    const fp = flagGeo.attributes.position;
    const base = Float32Array.from(fp.array);
    g.userData.animate = (t) => {
      for (let i = 0; i < fp.count; i++) {
        const u = base[i * 3];
        fp.setZ(i, Math.sin(u * 1.8 - t * 4) * 0.18 * (u / 3.8));
      }
      fp.needsUpdate = true;
    };

    // Lamp posts and hedges along the walk.
    for (const sx of [-1, 1]) {
      tiledBox(g, 1.2, 1.1, 16, sx * 24, 0.85, 12, sharedMaterial('hedge'), 0.5);
      for (const z of [12, 19]) {
        mesh(g, new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), sharedMaterial('darkSteel'), sx * 4, 2, z);
        const globe = mesh(g, new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe2a0, emissiveIntensity: 0 }), sx * 4, 3.8, z);
        ctx.nightMaterials.push({ material: globe.material, intensity: 1.4 });
      }
    }

    g.userData.treeSpots = [[-23, -18], [23, -18], [-23, 4], [23, 4], [-12, 19.5], [12, 19.5]];
    g.userData.height = 33;
    return g;
  },
});
