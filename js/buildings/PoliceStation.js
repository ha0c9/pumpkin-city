// 祖托皮亚警察局 — a round sandstone hall with vertical ribs, a grass roof and a glass geodesic dome,
// in the manner of the Zootopia police headquarters. The street sign reads "Zootopia Police Station".
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, mergeColored } from '../core/Utils.js';
import { colorMat, sharedMaterial, box, mesh, tiledBox } from './materials.js';

const THREE = window.THREE;

function stationSign() {
  const c = makeCanvas(1024, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#c98545';
  x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = '#8a4e22';
  x.lineWidth = 14;
  x.strokeRect(12, 12, 1000, 232);
  x.fillStyle = '#f6efe4';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 78px "Helvetica Neue",Arial,sans-serif';
  x.fillText('Zootopia Police Station', 512, 128);
  return canvasTexture(c, { anisotropy: 8 });
}

/** Upper-hemisphere icosahedron edges, packed into one strut mesh. */
function domeStruts(radius) {
  // r128 builds this geometry non-indexed, three vertices per face.
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const seen = new Set();
  const parts = [];
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 5);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const keyOf = (v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  const edge = (i, j) => {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j);
    if (a.y < 0.2 && b.y < 0.2) return;
    const ka = keyOf(a), kb = keyOf(b);
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (seen.has(key)) return;
    seen.add(key);
    const len = a.distanceTo(b);
    if (len < 1e-4) return;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    q.setFromUnitVectors(up, b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.09, len, 0.09));
    parts.push({ geometry: cyl, matrix: m, color: 0xf7f4ee });
  };
  for (let i = 0; i < pos.count; i += 3) {
    edge(i, i + 1); edge(i + 1, i + 2); edge(i + 2, i);
  }
  geo.dispose();
  const out = mergeColored(parts);
  cyl.dispose();
  return out;
}

function sandstoneMaterial() {
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#e09a58';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    const g = 150 + ((i * 37) % 50);
    x.fillStyle = `rgba(${g},${70 + (i % 30)},28,0.07)`;
    x.fillRect((i * 53) % 512, (i * 97) % 512, 14, 4);
  }
  x.strokeStyle = 'rgba(110,55,20,0.28)';
  x.lineWidth = 2;
  for (let y = 16; y < 512; y += 36) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(512, y);
    x.stroke();
  }
  const map = canvasTexture(c, { anisotropy: 4 });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 2);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0.02 });
}

registerBuilding('policeStation', {
  label: '警察局 Police Station',
  footprint: [54, 50],
  info: () => ({ featured: true, category: '警察局 Police Station' }),
  create(ctx) {
    const g = new THREE.Group();
    const sand = sandstoneMaterial();
    const rib = colorMat(0xc56d38, { roughness: 0.74 });
    const ribLight = colorMat(0xe2a15c, { roughness: 0.7 });
    const grass = colorMat(0x4f9a38, { roughness: 0.95 });
    const grassDark = colorMat(0x3d7a2c, { roughness: 0.95 });
    const stone = sharedMaterial('stone');
    const white = sharedMaterial('white');
    const steel = sharedMaterial('darkSteel');

    tiledBox(g, 54, 0.16, 50, 0, 0.08, 0, sharedMaterial('paving'), 0.45);

    // Round hall, set back so the stairs and crest sit on the street side (+Z).
    const R = 13.5;
    const hallH = 9.2;
    const hall = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.4, hallH, 40), sand);
    hall.position.set(0, hallH / 2 + 0.2, -3);
    hall.castShadow = true;
    hall.receiveShadow = true;
    g.add(hall);
    mesh(g, new THREE.CylinderGeometry(R + 0.7, R + 0.9, 0.7, 40), rib, 0, 0.55, -3);

    const fin = new THREE.BoxGeometry(1.05, hallH + 1.4, 2.6);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const a = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(a) < 0.34) continue;
      const m = new THREE.Mesh(fin, rib);
      m.position.set(Math.sin(ang) * (R - 0.15), hallH / 2 + 0.55, Math.cos(ang) * (R - 0.15) - 3);
      m.rotation.y = ang;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    // Narrow windows between ribs, lit at night.
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8eb6c9, metalness: 0.65, roughness: 0.12, emissive: 0xffe2b0, emissiveIntensity: 0.05,
    });
    ctx.nightMaterials.push({ material: glass, intensity: 0.85, base: 0.05 });
    const win = new THREE.BoxGeometry(0.55, 5.2, 0.18);
    for (let i = 0; i < 22; i++) {
      const ang = ((i + 0.5) / 22) * Math.PI * 2;
      if (Math.cos(ang) > 0.55) continue;
      const m = new THREE.Mesh(win, glass);
      m.position.set(Math.sin(ang) * (R + 0.55), 4.6, Math.cos(ang) * (R + 0.55) - 3);
      m.rotation.y = ang;
      m.castShadow = false;
      g.add(m);
    }

    // Grass roof and the geodesic dome.
    mesh(g, new THREE.CylinderGeometry(R + 1.1, R + 0.6, 0.55, 40), grass, 0, hallH + 0.45, -3);
    mesh(g, new THREE.TorusGeometry(7.4, 0.45, 8, 28), grassDark, 0, hallH + 0.7, -3);
    const domeY = hallH + 0.75;
    const domeGlass = new THREE.Mesh(
      new THREE.SphereGeometry(6.15, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xb7dce8, metalness: 0.55, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 1.2,
      }),
    );
    domeGlass.position.set(0, domeY, -3);
    domeGlass.castShadow = false;
    g.add(domeGlass);
    const struts = new THREE.Mesh(domeStruts(6.35), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.08 }));
    struts.position.set(0, domeY, -3);
    struts.castShadow = true;
    g.add(struts);

    // Crystalline crest over the entrance, the same warm stone as the ribs.
    const shards = [
      [0, 9.4, 12.4, 1.7, 8.4, 1.8, 0],
      [-3.6, 8.2, 12.8, 1.45, 6.2, 1.6, 0.38],
      [3.6, 8.2, 12.8, 1.45, 6.2, 1.6, -0.38],
      [-6.4, 6.4, 13.1, 1.3, 4.6, 1.5, 0.62],
      [6.4, 6.4, 13.1, 1.3, 4.6, 1.5, -0.62],
      [-8.6, 4.8, 13.3, 1.15, 3.2, 1.4, 0.85],
      [8.6, 4.8, 13.3, 1.15, 3.2, 1.4, -0.85],
      [-2.1, 4.6, 13.4, 1.05, 2.6, 1.3, 0.18],
      [2.1, 4.6, 13.4, 1.05, 2.6, 1.3, -0.18],
    ];
    for (const [x, y, z, w, h, d, rz] of shards) {
      const m = box(g, w, h, d, x, y, z, x === 0 ? ribLight : rib);
      m.rotation.z = rz;
    }

    // Door and the name plaque. Front faces +Z.
    box(g, 4.2, 3.4, 0.35, 0, 2.1, 13.55, colorMat(0x1c242c, { roughness: 0.4, metalness: 0.4 }));
    box(g, 4.6, 0.18, 0.5, 0, 3.9, 13.6, white);
    const signTex = stationSign();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.18, roughness: 0.55,
    });
    ctx.nightMaterials.push({ material: signMat, intensity: 0.9, base: 0.18 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.5, 0.28), [steel, steel, steel, steel, signMat, steel]);
    plaque.position.set(0, 6.15, 13.7);
    plaque.castShadow = true;
    g.add(plaque);

    // Steps down toward the street, widest at the bottom.
    for (let i = 0; i < 7; i++) {
      const w = 12 + i * 2.1;
      box(g, w, 0.24, 1.45, 0, 0.16 + (6 - i) * 0.2, 14.6 + i * 1.35, i % 2 ? stone : white, { cast: false });
    }
    for (const x of [-8.5, 8.5]) {
      mesh(g, new THREE.CylinderGeometry(0.28, 0.34, 1.15, 10), white, x, 0.7, 20.5);
      mesh(g, new THREE.SphereGeometry(0.22, 10, 8), colorMat(0x1d4e89, { roughness: 0.4, metalness: 0.2 }), x, 1.35, 20.5);
    }

    g.userData.treeSpots = [[-20, 16], [20, 16], [-18, -16], [18, -16]];
    g.userData.height = hallH + 8;
    return g;
  },
});
