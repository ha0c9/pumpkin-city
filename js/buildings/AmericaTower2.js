// 美国大厦 2号楼 America Tower 2 — hotel tower: champagne glass with rounded ends, porte-cochère,
// sky bar crown with a helipad, and a sky bridge back to tower 1 (spec.skyBridge = span in meters towards -X).
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';

const THREE = window.THREE;

function helipadTexture() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#2f3a33'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#f2f2f2'; x.lineWidth = 12;
  x.beginPath(); x.arc(128, 128, 104, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#f2f2f2';
  x.fillRect(84, 70, 22, 116); x.fillRect(150, 70, 22, 116); x.fillRect(84, 117, 88, 22);
  return canvasTexture(c);
}

/** Stadium-plan prism (box + two half cylinders) of width w (x), depth d (z), from y0 to y0 + h. */
function stadium(g, w, d, h, y0, wallFlat, wallRound, roof) {
  const r = d / 2, core = w - d;
  const flat = new THREE.Mesh(new THREE.BoxGeometry(core, h, d), [wallFlat, wallFlat, roof, roof, wallFlat, wallFlat]);
  flat.position.y = y0 + h / 2;
  flat.castShadow = flat.receiveShadow = true;
  g.add(flat);
  for (const s of [-1, 1]) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, false, s > 0 ? 0 : Math.PI, Math.PI), [wallRound, roof, roof]);
    cyl.position.set(s * core / 2, y0 + h / 2, 0);
    cyl.castShadow = cyl.receiveShadow = true;
    g.add(cyl);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 28, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), roof);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(s * core / 2, y0 + h + 0.01, 0);
    g.add(cap);
  }
}

registerBuilding('americaTower2', {
  label: '酒店 Hotel',
  footprint: [36, 33],
  create(ctx, spec = {}) {
    const g = new THREE.Group();
    const roof = sharedMaterial('roof');
    const bronze = colorMat(0x8a6a44, { roughness: 0.35, metalness: 0.8 });
    const steel = sharedMaterial('steel');
    tiledBox(g, 36, 0.3, 33, 0, 0.15, 0, sharedMaterial('paving'), 0.5);

    // Podium: glass lobby under a stone band.
    const lobby = curtainWallMaterial(ctx, { cols: 14, rows: 2, seed: 71, tint: [96, 82, 60], mullion: '#cbb48a', litRatio: 0.95 });
    const pod = new THREE.Mesh(new THREE.BoxGeometry(32, 6, 24), [lobby, lobby, roof, roof, lobby, lobby]);
    pod.position.y = 3.3; pod.castShadow = pod.receiveShadow = true; g.add(pod);
    tiledBox(g, 32.6, 6, 24.6, 0, 9.3, 0, sharedMaterial('stone'), 0.3);
    box(g, 33.2, 0.6, 25.2, 0, 12.5, 0, bronze);

    // Tower.
    const floors = 26, floorH = 3.6, y0 = 12.8, H = floors * floorH;
    const flatGlass = curtainWallMaterial(ctx, { cols: 6, rows: floors, seed: 72, tint: [92, 78, 58], mullion: '#cdb68e', litRatio: 0.55 });
    const roundGlass = curtainWallMaterial(ctx, { cols: 9, rows: floors, seed: 73, tint: [92, 78, 58], mullion: '#cdb68e', litRatio: 0.55 });
    stadium(g, 30, 14, H, y0, flatGlass, roundGlass, roof);
    for (let i = -3; i <= 3; i++) {
      for (const sz of [-1, 1]) box(g, 0.35, H, 0.9, i * 2.6, y0 + H / 2, sz * 7.35, bronze, { receive: false });
    }
    // Floor bands every 6 floors.
    for (let f = 6; f < floors; f += 6) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, 14.8), bronze);
      band.position.y = y0 + f * floorH; g.add(band);
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.5, 28, 1, false, s > 0 ? 0 : Math.PI, Math.PI), bronze);
        ring.position.set(s * 8, y0 + f * floorH, 0); g.add(ring);
      }
    }

    // Crown: setback sky bar, bronze cornice and a helipad.
    const yTop = y0 + H;
    const barGlass = curtainWallMaterial(ctx, { cols: 8, rows: 2, seed: 74, tint: [60, 70, 82], mullion: '#cdb68e', litRatio: 1 });
    stadium(g, 24, 10, 6, yTop, barGlass, barGlass, roof);
    box(g, 16.6, 0.8, 14.6, 0, yTop + 0.4, 0, bronze);
    const padMat = new THREE.MeshStandardMaterial({ map: helipadTexture(), roughness: 0.9 });
    const pad = mesh(g, new THREE.CylinderGeometry(6.2, 6.2, 0.5, 32), [steel, padMat, steel], 0, yTop + 6.5, 0);
    pad.rotation.y = Math.PI / 2;
    const padLight = new THREE.MeshStandardMaterial({ color: 0x224422, emissive: 0x4dff6a, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: padLight, intensity: 2.2 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      mesh(g, new THREE.SphereGeometry(0.18, 8, 6), padLight, Math.cos(a) * 6, yTop + 6.85, Math.sin(a) * 6, { cast: false });
    }
    for (const sx of [-4, 4]) for (const sz of [-3, 3]) box(g, 0.4, 0.8, 0.4, sx, yTop + 6.1, sz, steel);

    // Lit "HOTEL" crown sign on the front.
    const hotelTex = textTexture(['HOTEL'], { width: 512, height: 128, color: '#ffe7b0', glow: 'rgba(255,200,120,0.9)', font: 'bold 92px Georgia, serif' });
    const hotelMat = new THREE.MeshStandardMaterial({ map: hotelTex, transparent: true, emissive: 0xffffff, emissiveMap: hotelTex, emissiveIntensity: 0.3 });
    ctx.nightMaterials.push({ material: hotelMat, intensity: 1.8, base: 0.3 });
    mesh(g, new THREE.PlaneGeometry(10, 2.5), hotelMat, 0, yTop - 3, 7.9, { cast: false });

    // Porte-cochère canopy with lit underside and a sign on its fascia.
    const glow = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.15, roughness: 0.5 });
    ctx.nightMaterials.push({ material: glow, intensity: 1.2, base: 0.15 });
    box(g, 18, 0.7, 4.2, 0, 6.2, 14.1, bronze);
    box(g, 17, 0.1, 3.8, 0, 5.82, 14.1, glow, { cast: false });
    for (const sx of [-8, 8]) box(g, 0.4, 5.9, 0.4, sx, 2.95, 15.7, bronze);
    tiledBox(g, 22, 0.08, 4.4, 0, 0.32, 14.2, colorMat(0x3a3d42, { roughness: 0.9 }), 0.5);
    const signLines = spec.sign || ['美国大厦 2号楼 · 酒店', 'AMERICA TOWER 2 · HOTEL'];
    const signTex = textTexture(signLines, { width: 1024, height: 192, color: '#ffeccc', glow: 'rgba(255,210,150,0.7)', font: 'bold 78px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif', subFont: '600 44px "PingFang SC","Microsoft YaHei",sans-serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.4, base: 0.3 });
    mesh(g, new THREE.PlaneGeometry(16, 3), signMat, 0, 8.4, 12.33, { cast: false });

    // Flags along the front of the plaza.
    const flagColors = [0xb22234, 0x3c3b6e, 0xf2c14e];
    flagColors.forEach((col, i) => {
      const x = 11 + i * 2.2;
      mesh(g, new THREE.CylinderGeometry(0.07, 0.09, 9, 8), steel, x, 4.8, 15.4);
      mesh(g, new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.8 }), x + 0.9, 8.6, 15.4, { receive: false });
    });

    // Sky bridge to tower 1.
    const span = spec.skyBridge || 0;
    if (span > 0) {
      const yb = 40, x0 = -15 + 0.5, x1 = -15 - span - 0.8, L = x0 - x1, cx = (x0 + x1) / 2;
      const bridgeGlass = curtainWallMaterial(ctx, { cols: Math.round(L / 2.5), rows: 1, seed: 75, tint: [80, 92, 104], mullion: '#d8d0bc', litRatio: 0.9 });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(L, 4.4, 5), [roof, roof, roof, roof, bridgeGlass, bridgeGlass]);
      tube.position.set(cx, yb, 0); tube.castShadow = true; g.add(tube);
      box(g, L, 0.6, 5.6, cx, yb - 2.5, 0, bronze);
      box(g, L, 0.5, 5.6, cx, yb + 2.45, 0, bronze);
      for (let k = 0; k <= 8; k++) {
        const x = x1 + (k / 8) * L;
        for (const sz of [-2.7, 2.7]) box(g, 0.25, 4.4, 0.25, x, yb, sz, bronze, { receive: false });
      }
    }

    g.userData.treeSpots = [[-16.5, -14], [16.5, -14], [-16.5, -2], [16.5, -2], [-16.5, 9], [-13, 15.6]];
    g.userData.height = yTop + 8;
    return g;
  },
});
