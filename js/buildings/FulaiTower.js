// 福来大厦 Fulai Tower — champagne-gold octagonal supertall in three twisting setback tiers, crowned by an
// open golden cage around a glowing red "福" lantern.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, textTexture } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, tiledBox, box, mesh, rod } from './materials.js';

const THREE = window.THREE;

function lanternTexture() {
  const w = 512, h = 256;
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8e0f12'); g.addColorStop(0.5, '#e0251f'); g.addColorStop(1, '#8e0f12');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#f2c14e';
  x.fillRect(0, 18, w, 10); x.fillRect(0, h - 28, w, 10);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 118px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",serif';
  for (let i = 0; i < 4; i++) x.fillText('福', (i + 0.5) * w / 4, h / 2 + 4);
  return canvasTexture(c);
}

/** Flat-shaded octagonal prism rotated by `twist`. */
function octPrism(g, r, h, y, twist, wall, roof) {
  let geo = new THREE.CylinderGeometry(r, r, h, 8, 1);
  geo.rotateY(Math.PI / 8 + twist);
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  return mesh(g, geo, [wall, roof, roof], 0, y + h / 2, 0);
}

registerBuilding('fulaiTower', {
  label: '超高层 Skyscraper',
  footprint: [40, 40],
  create(ctx) {
    const g = new THREE.Group();
    const gold = colorMat(0xc9a14a, { roughness: 0.28, metalness: 0.9 });
    const roof = sharedMaterial('roof');
    tiledBox(g, 40, 0.3, 40, 0, 0.15, 0, sharedMaterial('paving'), 0.5);

    // Podium.
    const lobby = curtainWallMaterial(ctx, { cols: 14, rows: 2, seed: 91, tint: [110, 92, 60], mullion: '#d8bf7a', litRatio: 0.9 });
    const pod = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 30), [lobby, lobby, roof, roof, lobby, lobby]);
    pod.position.y = 3.3; pod.castShadow = pod.receiveShadow = true; g.add(pod);
    tiledBox(g, 34.6, 4, 30.6, 0, 8.3, 0, sharedMaterial('stone'), 0.3);
    box(g, 35.2, 0.6, 31.2, 0, 10.5, 0, gold);
    const signTex = textTexture(['福来大厦', 'FULAI TOWER'], { color: '#f6d27a', glow: 'rgba(255,200,100,0.6)' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.2 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.3, base: 0.2 });
    mesh(g, new THREE.PlaneGeometry(14, 3.5), signMat, 0, 8.3, 15.33, { cast: false });
    // Entrance canopy.
    box(g, 12, 0.5, 4, 0, 5.2, 17, gold);
    for (const sx of [-5.5, 5.5]) box(g, 0.3, 5, 0.3, sx, 2.7, 18.7, gold);

    // Three twisting octagonal tiers.
    const tiers = [[15, 48, 0], [13, 36, Math.PI / 24], [10.5, 26, Math.PI / 12]];
    let y = 10.8;
    tiers.forEach(([r, h, twist], i) => {
      const glass = curtainWallMaterial(ctx, { cols: 6, rows: Math.round(h / 4), seed: 92 + i, tint: [118, 98, 60], mullion: '#e0c98e', litRatio: 0.45, repeatX: 8 });
      octPrism(g, r, h, y, twist, glass, roof);
      // Golden fins on the corners.
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + twist + k * Math.PI / 4;
        const fin = box(g, 0.5, h, 1.4, Math.sin(a) * (r + 0.1), y + h / 2, Math.cos(a) * (r + 0.1), gold, { receive: false });
        fin.rotation.y = a;
      }
      y += h;
      octPrism(g, r + 0.6, 1.0, y, twist, gold, gold);
      y += 1.0;
    });

    // Crown: eight curved golden ribs meeting above a red 福 lantern.
    const yc = y, rc = 10.5, peak = yc + 20;
    const ribPts = [];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + Math.PI / 12 + k * Math.PI / 4;
      let prev = null;
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        const r = rc * Math.sin(Math.PI * (0.5 + 0.5 * t)) * (1 - 0.15 * t) + 0.4 * (1 - t);
        const p = new THREE.Vector3(Math.sin(a) * r, yc + (peak - yc) * Math.pow(t, 0.8), Math.cos(a) * r);
        if (prev) rod(g, prev, p, 0.35, gold, 6);
        prev = p;
      }
      ribPts.push(prev);
    }
    const lanternMap = lanternTexture();
    const lantern = new THREE.MeshStandardMaterial({ map: lanternMap, emissive: 0xff5a2a, emissiveMap: lanternMap, emissiveIntensity: 0.25, roughness: 0.5 });
    ctx.nightMaterials.push({ material: lantern, intensity: 1.6, base: 0.25 });
    const lan = mesh(g, new THREE.SphereGeometry(5, 32, 20), lantern, 0, yc + 8, 0);
    lan.scale.set(1, 1.15, 1);
    mesh(g, new THREE.CylinderGeometry(2.4, 2.4, 1, 16), gold, 0, yc + 2.4, 0);
    mesh(g, new THREE.CylinderGeometry(2.4, 2.4, 1, 16), gold, 0, yc + 13.7, 0);
    // Spire.
    mesh(g, new THREE.CylinderGeometry(0.15, 0.6, 14, 10), gold, 0, peak + 7, 0);
    mesh(g, new THREE.SphereGeometry(0.9, 16, 12), gold, 0, peak + 1.2, 0);
    const beacon = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: beacon, intensity: 6, blink: true, always: true });
    mesh(g, new THREE.SphereGeometry(0.4, 10, 8), beacon, 0, peak + 14.3, 0, { cast: false });

    g.userData.treeSpots = [[-18, -18], [18, -18], [-18, 4], [18, 4], [-17, 18], [17, 18]];
    g.userData.height = peak + 14;
    return g;
  },
});
