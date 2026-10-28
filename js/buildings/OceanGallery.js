// 海洋美术馆 Ocean Art Gallery — white shell vaults unfolding like breaking waves over a glass pavilion.
import { registerBuilding } from '../core/Registry.js';
import { textTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';
import { galleryEasel } from './easterEggs.js';

const THREE = window.THREE;

/** A curved shell: a slice of a sphere, tilted so it rises like a wave crest. */
function shell(radius, width) {
  const geo = new THREE.SphereGeometry(radius, 36, 18, Math.PI / 2 - width / 2, width, 0, Math.PI * 0.5);
  geo.scale(1, 1.25, 0.55);
  return geo;
}

registerBuilding('oceanGallery', {
  label: '美术馆 Art Gallery',
  footprint: [40, 34],
  create(ctx) {
    const g = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide });
    const glass = new THREE.MeshStandardMaterial({ color: 0x7fb6cf, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.5,
      emissive: 0xffe2b8, emissiveIntensity: 0, envMapIntensity: 1.4 });
    ctx.nightMaterials.push({ material: glass, intensity: 0.45 });

    // Podium of pale granite with a wave-patterned blue terrace.
    tiledBox(g, 40, 0.4, 34, 0, 0.2, 0, sharedMaterial('paving'), 0.5);
    tiledBox(g, 34, 1.2, 22, 0, 1.0, -3, sharedMaterial('stone'), 0.25);
    for (let i = 0; i < 4; i++) tiledBox(g, 14, 0.3 * (i + 1), 0.6, 0, 0.4 + 0.15 * (i + 1), 10.3 - i * 0.6, sharedMaterial('stone'), 0.25);

    // Glass gallery hall under the shells.
    box(g, 26, 6, 14, 0, 1.6 + 3, -4, glass, { cast: false });
    const frame = sharedMaterial('darkSteel');
    for (let i = 0; i <= 10; i++) box(g, 0.14, 6, 0.14, -13 + i * 2.6, 4.6, 3, frame, { cast: false });
    // Inner artworks (seen through the glass).
    const art = textTexture(['海 · 浪 · 光'], { width: 512, height: 256, bg: '#1d4f73', color: '#e6f4ff', font: 'bold 80px "PingFang SC",serif' });
    const artMat = new THREE.MeshStandardMaterial({ map: art, emissive: 0xffffff, emissiveMap: art, emissiveIntensity: 0.1 });
    ctx.nightMaterials.push({ material: artMat, intensity: 0.6, base: 0.1 });
    for (const x of [-7, 0, 7]) box(g, 4.5, 2.6, 0.1, x, 4.4, -10.8, artMat, { cast: false });

    // Shell vaults, largest in the middle, fanning out like a crest of waves.
    const shells = [
      { x: 0, z: -2, r: 13, w: 1.2, ry: 0, s: 1 },
      { x: -10, z: -3, r: 10, w: 1.1, ry: 0.55, s: 0.95 },
      { x: 10, z: -3, r: 10, w: 1.1, ry: -0.55, s: 0.95 },
      { x: -15, z: -6, r: 7, w: 1.0, ry: 0.95, s: 0.9 },
      { x: 15, z: -6, r: 7, w: 1.0, ry: -0.95, s: 0.9 },
    ];
    for (const sh of shells) {
      const m = mesh(g, shell(sh.r, sh.w), shellMat, sh.x, 1.6, sh.z);
      m.rotation.y = sh.ry;
      m.rotation.x = -0.18;
      m.scale.setScalar(sh.s);
      // Rib along the crest.
      const rib = mesh(g, new THREE.TorusGeometry(sh.r, 0.18, 8, 40, Math.PI / 2), colorMat(0xdfe4e6, { roughness: 0.4 }), 0, 0, 0);
      rib.rotation.set(0, -Math.PI / 2, 0);
      rib.scale.set(0.55, 1.25, 1);
      m.add(rib);
    }

    // Sign on the terrace and a pool with a fish sculpture.
    const signTex = textTexture(['海洋美术馆', 'OCEAN ART GALLERY'], { width: 1024, height: 256, bg: '#ffffff', color: '#1c5a86',
      font: 'bold 100px "PingFang SC","Microsoft YaHei",sans-serif', subFont: '600 54px sans-serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.4), [sharedMaterial('white'), sharedMaterial('white'), sharedMaterial('white'), sharedMaterial('white'), signMat, sharedMaterial('white')]);
    sign.position.set(-12, 1.5, 14.2);
    sign.castShadow = true;
    g.add(sign);
    box(g, 12, 0.3, 6, 10, 0.5, 12.5, sharedMaterial('water'), { cast: false });
    tiledBox(g, 12.6, 0.6, 0.3, 10, 0.5, 15.6, sharedMaterial('stone'));
    tiledBox(g, 12.6, 0.6, 0.3, 10, 0.5, 9.4, sharedMaterial('stone'));
    const fish = new THREE.Group();
    const steel = colorMat(0x8fb7cf, { roughness: 0.15, metalness: 1 });
    mesh(fish, new THREE.SphereGeometry(1.4, 20, 12), steel).scale.set(1.8, 1, 0.6);
    const fin = mesh(fish, new THREE.ConeGeometry(1.1, 1.8, 4), steel, -2.9, 0, 0);
    fin.rotation.z = Math.PI / 2; fin.scale.set(1, 1, 0.3);
    fish.position.set(10, 3.2, 12.5);
    fish.rotation.z = 0.35;
    g.add(fish);
    for (const x of [8.8, 11.2]) mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), sharedMaterial('steel'), x, 1.6, 12.5);

    galleryEasel(g, 6.2, 1.64, 6.4, 0.2).scale.setScalar(1.7);
    g.userData.treeSpots = [[-18, -15], [18, -15], [-18, 6], [18, 6]];
    g.userData.height = 18;
    return g;
  },
});
