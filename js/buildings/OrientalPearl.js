// 东方明珠 Oriental Pearl Tower — three columns carrying eleven pink "pearls": the big lower sphere, five
// small spheres, the upper sphere and the space module, topped by an antenna mast. Lights cycle at night.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, textTexture } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, tiledBox, box, mesh, rod } from './materials.js';

const THREE = window.THREE;

/** Equirectangular panel texture for the pearls (color + night emissive). */
function pearlTextures() {
  const w = 512, h = 256;
  const color = makeCanvas(w, h), emis = makeCanvas(w, h);
  const c = color.getContext('2d'), e = emis.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6a7c8'); g.addColorStop(0.5, '#d9467f'); g.addColorStop(1, '#a8285c');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(80,20,45,0.55)'; c.lineWidth = 2;
  for (let j = 1; j < 12; j++) { c.beginPath(); c.moveTo(0, j * h / 12); c.lineTo(w, j * h / 12); c.stroke(); }
  for (let i = 0; i < 32; i++) { c.beginPath(); c.moveTo(i * w / 32, 0); c.lineTo(i * w / 32, h); c.stroke(); }
  // Lit seams for the night show.
  e.strokeStyle = 'rgba(255,255,255,0.9)'; e.lineWidth = 3;
  for (let j = 2; j < 11; j += 2) { e.beginPath(); e.moveTo(0, j * h / 12); e.lineTo(w, j * h / 12); e.stroke(); }
  for (let i = 0; i < 32; i += 2) { e.beginPath(); e.moveTo(i * w / 32, h * 0.12); e.lineTo(i * w / 32, h * 0.88); e.stroke(); }
  return { map: canvasTexture(color), emissiveMap: canvasTexture(emis) };
}

registerBuilding('orientalPearl', {
  label: '电视塔 TV Tower',
  footprint: [70, 70],
  create(ctx) {
    const g = new THREE.Group();
    const concrete = colorMat(0xe9e6e1, { roughness: 0.55, metalness: 0.15 });
    const steel = sharedMaterial('steel');
    tiledBox(g, 70, 0.3, 70, 0, 0.15, 0, sharedMaterial('paving'), 0.4);

    const { map, emissiveMap } = pearlTextures();
    const pearl = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xff4fa0, emissiveIntensity: 0, metalness: 0.55, roughness: 0.28, envMapIntensity: 1.3 });
    ctx.nightMaterials.push({ material: pearl, intensity: 1.6, base: 0.05 });
    const deckGlass = new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.8, roughness: 0.12, emissive: 0xffd9a8, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: deckGlass, intensity: 1.2 });
    const strip = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x7fd4ff, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: strip, intensity: 2.0 });

    // Round base hall.
    const hall = curtainWallMaterial(ctx, { cols: 24, rows: 2, seed: 81, tint: [60, 78, 96], litRatio: 0.9, repeatX: 2 });
    mesh(g, new THREE.CylinderGeometry(17, 18, 7, 40, 1), [hall, concrete, concrete], 0, 3.8, 0);
    mesh(g, new THREE.CylinderGeometry(18.6, 18.6, 0.8, 40), concrete, 0, 7.6, 0);

    // Three vertical columns up to the upper sphere, three raked legs to the lower sphere.
    const colTop = 118;
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + i * Math.PI * 2 / 3;
      const cx = Math.cos(a) * 5.6, cz = Math.sin(a) * 5.6;
      mesh(g, new THREE.CylinderGeometry(2.5, 2.7, colTop, 20), concrete, cx, colTop / 2, cz);
      mesh(g, new THREE.BoxGeometry(0.25, colTop - 12, 0.25), strip, Math.cos(a) * 8.15, colTop / 2 + 4, Math.sin(a) * 8.15, { cast: false });
      const b = a + Math.PI / 3;
      const foot = new THREE.Vector3(Math.cos(b) * 30, 0, Math.sin(b) * 30);
      const top = new THREE.Vector3(Math.cos(b) * 7, 30, Math.sin(b) * 7);
      rod(g, foot, top, 2.0, concrete, 16);
      mesh(g, new THREE.CylinderGeometry(3, 3.4, 1.6, 16), concrete, foot.x, 0.8, foot.z);
    }

    const sphere = (r, y, seg = 40) => mesh(g, new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6)), pearl, 0, y, 0);
    const band = (r, y, hgt) => mesh(g, new THREE.CylinderGeometry(r, r, hgt, 48, 1, true), deckGlass, 0, y, 0, { cast: false });

    // Lower pearl with two observation bands.
    sphere(12.5, 38, 48);
    band(12.62, 38, 2.2);
    band(11.6, 43.2, 1.6);
    // Five small pearls between the columns.
    for (let k = 0; k < 5; k++) sphere(3.7, 58 + k * 8, 24);
    // Upper pearl with the revolving restaurant band.
    sphere(10, 110, 44);
    band(10.1, 110, 2.4);
    band(9.2, 105, 1.4);
    // Space module, mast and beacon.
    mesh(g, new THREE.CylinderGeometry(2.0, 2.3, 24, 16), concrete, 0, colTop + 10, 0);
    sphere(4.6, 143, 28);
    band(4.65, 143, 1.0);
    mesh(g, new THREE.CylinderGeometry(0.28, 1.5, 42, 12), steel, 0, 147 + 21, 0);
    for (const [y, r] of [[152, 2.2], [160, 1.7], [168, 1.3], [176, 0.9]]) {
      const ring = mesh(g, new THREE.TorusGeometry(r, 0.18, 6, 24), steel, 0, y, 0, { cast: false });
      ring.rotation.x = Math.PI / 2;
    }
    const beacon = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: beacon, intensity: 6, blink: true, always: true });
    mesh(g, new THREE.SphereGeometry(0.5, 10, 8), beacon, 0, 189, 0, { cast: false });

    // Monument sign at the front of the plaza.
    box(g, 9, 1.8, 1, 0, 1.2, 31, sharedMaterial('stoneDark'));
    const signTex = textTexture(['东方明珠', 'ORIENTAL PEARL TOWER'], { color: '#7a1d42' });
    mesh(g, new THREE.PlaneGeometry(8.4, 1.6), new THREE.MeshStandardMaterial({ map: signTex, transparent: true }), 0, 1.25, 31.52, { cast: false });

    // Night show: the pearls slowly cycle through pink, violet and gold.
    const hsl = new THREE.Color();
    g.userData.animate = (t) => {
      const k = (Math.sin(t * 0.35) * 0.5 + 0.5);
      hsl.setHSL(0.92 - k * 0.12 + (Math.sin(t * 0.13) > 0.6 ? 0.2 : 0), 0.85, 0.55);
      pearl.emissive.copy(hsl);
      strip.emissive.setHSL((t * 0.05) % 1, 0.7, 0.6);
    };

    g.userData.treeSpots = [[-30, -30], [30, -30], [-30, 30], [30, 30], [-24, 33], [24, 33], [-33, 0], [33, 0], [0, -33]];
    g.userData.height = 190;
    return g;
  },
});
