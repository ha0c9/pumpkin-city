// 世界遗产博物馆 World Heritage Museum — neoclassical colonnade with a glass dome.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, mergeSimple } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, box, tiledBox } from './materials.js';
import { porcelainVase } from './easterEggs.js';

const THREE = window.THREE;

registerBuilding('heritageMuseum', {
  label: '博物馆 Museum',
  footprint: [33, 36],
  create(ctx) {
    const g = new THREE.Group();
    const stone = sharedMaterial('stone');
    const stoneDark = sharedMaterial('stoneDark');

    tiledBox(g, 33, 0.3, 36, 0, 0.15, 0, sharedMaterial('paving'), 0.5);
    // Stylobate + front steps.
    tiledBox(g, 30, 1.6, 24, 0, 0.3 + 0.8, -3, stoneDark, 0.25);
    for (let i = 0; i < 5; i++) {
      tiledBox(g, 20, 0.32, 0.8, 0, 0.3 + 0.16 + i * 0.32, 9.0 + (4 - i) * 0.8 + 0.4, stoneDark, 0.25);
    }

    // Main hall.
    const sideMat = windowWallMaterial(ctx, { cols: 5, rows: 2, wall: 'stone', winW: 0.42, winH: 0.62, frame: '#d9cfb8', glass: '#2b3a44', seed: 8, litRatio: 0.7 });
    const backMat = windowWallMaterial(ctx, { cols: 8, rows: 2, wall: 'stone', winW: 0.42, winH: 0.62, frame: '#d9cfb8', glass: '#2b3a44', seed: 9, litRatio: 0.6 });
    const hall = new THREE.Mesh(new THREE.BoxGeometry(28, 11, 18), [sideMat, sideMat, sharedMaterial('roof'), stone, stone, backMat]);
    hall.position.set(0, 1.9 + 5.5, -5);
    hall.castShadow = true; hall.receiveShadow = true;
    g.add(hall);
    tiledBox(g, 28.8, 0.7, 18.8, 0, 12.9 + 0.35, -5, stone, 0.25);

    // Bronze door with warm light at night.
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, metalness: 0.7, roughness: 0.35, emissive: 0xffc070, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: doorMat, intensity: 0.5 });
    box(g, 5, 6.5, 0.3, 0, 1.9 + 3.25, 4.05, doorMat);
    for (const x of [-8, 8]) box(g, 2.4, 4.5, 0.3, x, 1.9 + 2.6, 4.05, doorMat);

    // Colonnade (Doric-style, slight entasis).
    const shaft = new THREE.CylinderGeometry(0.6, 0.7, 8.8, 24, 1);
    const colParts = [];
    for (let i = 0; i < 8; i++) {
      const x = -12.25 + i * 3.5;
      const s = shaft.clone(); s.translate(x, 1.9 + 0.6 + 4.4, 7.5); colParts.push(s);
      const b = new THREE.BoxGeometry(1.7, 0.6, 1.7); b.translate(x, 1.9 + 0.3, 7.5); colParts.push(b);
      const c = new THREE.BoxGeometry(1.8, 0.6, 1.8); c.translate(x, 1.9 + 9.7, 7.5); colParts.push(c);
    }
    const cols = new THREE.Mesh(mergeSimple(colParts), stone);
    cols.castShadow = true; cols.receiveShadow = true;
    g.add(cols);

    // Entablature with inscription.
    tiledBox(g, 28, 1.7, 6.6, 0, 12.0 + 0.85, 5.8, stone, 0.25);
    const frieze = new THREE.Mesh(new THREE.PlaneGeometry(24, 1.5), new THREE.MeshStandardMaterial({
      map: textTexture(['世界遗产博物馆 · WORLD HERITAGE MUSEUM'], { width: 2048, height: 128, color: '#5a4630',
        font: 'bold 84px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",serif' }), transparent: true, roughness: 0.8 }));
    frieze.position.set(0, 12.85, 9.12);
    g.add(frieze);

    // Pediment.
    const tri = new THREE.Shape();
    tri.moveTo(-14.2, 0); tri.lineTo(14.2, 0); tri.lineTo(0, 4.4); tri.lineTo(-14.2, 0);
    const ped = new THREE.ExtrudeGeometry(tri, { depth: 6.6, bevelEnabled: false });
    ped.translate(0, 13.7, 2.5);
    const pediment = new THREE.Mesh(ped, stone);
    pediment.castShadow = true;
    g.add(pediment);
    const inner = new THREE.Shape();
    inner.moveTo(-11.5, 0.5); inner.lineTo(11.5, 0.5); inner.lineTo(0, 3.6); inner.lineTo(-11.5, 0.5);
    const tymp = new THREE.Mesh(new THREE.ShapeGeometry(inner), stoneDark);
    tymp.position.set(0, 13.7, 9.12);
    g.add(tymp);

    // Glass dome on a drum.
    const domeY = 13.6;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.6, 2.6, 32), stone);
    drum.position.set(0, domeY + 1.3, -5);
    drum.castShadow = true;
    g.add(drum);
    const domeGlass = sharedMaterial('glassClear').clone();
    domeGlass.emissive = new THREE.Color(0xffd9a0);
    domeGlass.emissiveIntensity = 0;
    ctx.nightMaterials.push({ material: domeGlass, intensity: 0.6 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeGlass);
    dome.position.set(0, domeY + 2.6, -5);
    dome.castShadow = true;
    g.add(dome);
    const ribMat = sharedMaterial('darkSteel');
    for (let i = 0; i < 8; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(6.22, 0.09, 6, 40, Math.PI), ribMat);
      rib.rotation.y = i * Math.PI / 8;
      rib.position.copy(dome.position);
      g.add(rib);
    }
    for (const k of [0.35, 0.7]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.22 * Math.cos(Math.asin(k)), 0.08, 6, 48), ribMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, dome.position.y + 6.22 * k, -5);
      g.add(ring);
    }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 16), stone);
    lantern.position.set(0, dome.position.y + 6.6, -5);
    g.add(lantern);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.25 }));
    finial.position.set(0, dome.position.y + 7.7, -5);
    g.add(finial);

    // Banners between columns.
    const bannerTex = textTexture(['世界遗产', 'HERITAGE'], { width: 256, height: 768, bg: '#8c1d18', color: '#f6e7c1',
      font: 'bold 64px "PingFang SC","Microsoft YaHei",serif', subFont: '600 40px serif' });
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.9 });
    for (const x of [-7, 7]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.8), bannerMat);
      b.position.set(x, 8.2, 7.5);
      g.add(b);
    }

    // Hedges along the plaza.
    for (const x of [-14.5, 14.5]) tiledBox(g, 1.4, 1.0, 6.5, x, 0.8, 13.8, sharedMaterial('hedge'), 0.5);

    porcelainVase(g, 3.6, 1.9, 5.8).scale.setScalar(1.45);
    g.userData.treeSpots = [[-15, -14], [15, -14], [-15, 1], [15, 1], [-10, 16.5], [10, 16.5]];
    g.userData.height = 24;
    return g;
  },
});
