// 如家酒店 Home Inn — simple budget chain hotel: bright yellow facade, white window grid, blue house-shaped logo sign.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';

const THREE = window.THREE;

function homeInnSign(width, height) {
  const c = makeCanvas(width, height);
  const x = c.getContext('2d');
  x.fillStyle = '#1b4fa0'; x.fillRect(0, 0, width, height);
  const s = height / 256;
  // House-shaped logo: roof chevron over a square with a window.
  x.fillStyle = '#ffd200';
  x.beginPath(); x.moveTo(40 * s, 128 * s); x.lineTo(128 * s, 40 * s); x.lineTo(216 * s, 128 * s); x.lineTo(186 * s, 128 * s);
  x.lineTo(128 * s, 70 * s); x.lineTo(70 * s, 128 * s); x.closePath(); x.fill();
  x.fillRect(80 * s, 128 * s, 96 * s, 86 * s);
  x.fillStyle = '#1b4fa0'; x.fillRect(112 * s, 150 * s, 32 * s, 64 * s);
  x.fillStyle = '#ffffff';
  x.textBaseline = 'middle';
  x.font = `bold ${120 * s}px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif`;
  x.fillText('如家酒店', 250 * s, 100 * s);
  x.font = `bold ${64 * s}px Arial, sans-serif`;
  x.fillStyle = '#ffd200';
  x.fillText('HOME INN', 254 * s, 196 * s);
  return canvasTexture(c, { anisotropy: 8 });
}

registerBuilding('homeInn', {
  label: '酒店 Hotel',
  footprint: [40, 22],
  create(ctx) {
    const g = new THREE.Group();
    const floors = 6, floorH = 3.2, W = 34, D = 14;
    const H = floors * floorH;
    tiledBox(g, 40, 0.25, 22, 0, 0.125, 0, sharedMaterial('paving'), 0.5);

    const front = windowWallMaterial(ctx, { cols: 14, rows: floors - 1, wall: 'concrete', frame: '#ffffff', glass: '#3a5970', seed: 91, winW: 0.62, winH: 0.58, litRatio: 0.6 });
    const side = windowWallMaterial(ctx, { cols: 5, rows: floors - 1, wall: 'concrete', frame: '#ffffff', glass: '#3a5970', seed: 92, winW: 0.62, winH: 0.58, litRatio: 0.6 });
    for (const m of [front, side]) m.color.set(0xffcf2e);
    const roof = sharedMaterial('roof');
    const upper = new THREE.Mesh(new THREE.BoxGeometry(W, H - floorH, D), [side, side, roof, roof, front, front]);
    upper.position.set(0, floorH + (H - floorH) / 2 + 0.25, -1);
    upper.castShadow = true; upper.receiveShadow = true;
    g.add(upper);

    // Ground floor: white base with a glass lobby.
    const white = sharedMaterial('white');
    box(g, W, floorH, D, 0, floorH / 2 + 0.25, -1, white);
    const lobby = new THREE.MeshStandardMaterial({ color: 0x9cc3d8, metalness: 0.8, roughness: 0.08, emissive: 0xfff0c8, emissiveIntensity: 0.1 });
    ctx.nightMaterials.push({ material: lobby, intensity: 0.9, base: 0.1 });
    box(g, 12, floorH - 0.6, 0.2, 0, floorH / 2 + 0.1, 6.05, lobby, { cast: false });
    // White vertical fins and a blue stripe that runs up the stair core.
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) box(g, 0.8, H + 0.6, D + 0.4, x, (H + 0.6) / 2 + 0.25, -1, white);
    box(g, 2.6, H - floorH, 0.3, -W / 2 + 4.5, floorH + (H - floorH) / 2 + 0.25, 6.1, colorMat(0x1b4fa0, { roughness: 0.5 }));
    box(g, W + 0.6, 0.7, D + 0.6, 0, H + 0.6, -1, white);

    // Roof sign + entrance canopy sign, lit at night.
    const signTex = homeInnSign(1024, 256);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.2, roughness: 0.5 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.2, base: 0.2 });
    const steel = sharedMaterial('darkSteel');
    const roofSign = new THREE.Mesh(new THREE.BoxGeometry(14, 3.5, 0.4), [steel, steel, steel, steel, signMat, steel]);
    roofSign.position.set(4, H + 3, 4.5);
    roofSign.castShadow = true;
    g.add(roofSign);
    for (const x of [-2, 10]) box(g, 0.2, 2.2, 0.2, x, H + 1.1, 4.3, steel);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.9, 4), [steel, steel, white, white, signMat, steel]);
    canopy.position.set(0, floorH + 0.1, 8);
    canopy.castShadow = true;
    g.add(canopy);
    for (const x of [-6.6, 6.6]) mesh(g, new THREE.CylinderGeometry(0.15, 0.15, floorH, 10), white, x, floorH / 2, 9.7);

    // Rooftop water tank and AC units; a couple of parking bays out front.
    mesh(g, new THREE.CylinderGeometry(1.3, 1.3, 2.4, 16), sharedMaterial('concrete'), -11, H + 2.1, -4);
    for (const x of [-4, -1]) box(g, 1.8, 1, 1.4, x, H + 1.45, -5, sharedMaterial('concrete'));
    for (let i = 0; i < 5; i++) box(g, 0.12, 0.02, 4.6, 8 + i * 2.6, 0.27, 8.6, white, { cast: false });

    g.userData.treeSpots = [[-18, 8.5], [-12, 8.5]];
    g.userData.height = H + 5;
    return g;
  },
});
