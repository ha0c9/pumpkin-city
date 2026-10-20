// 便利店 Convenience Store — glass storefront with visible shelves, sign band, awning and rooftop units.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, box, tiledBox } from './materials.js';

const THREE = window.THREE;

export const STORE_BRANDS = [
  { name: '南瓜便利店', en: 'PUMPKIN MART', color: '#e8731a', accent: '#2f7d32' },
  { name: '全天便利店', en: '24H QUICKSTOP', color: '#1f6fb8', accent: '#e23b3b' },
  { name: '鲜果便利店', en: 'FRESH CORNER', color: '#2e9a4a', accent: '#f3c623' },
  { name: '海岛便利店', en: 'ISLAND STORE', color: '#c2304a', accent: '#ffffff' },
];

function shelvesTexture(rng) {
  const c = makeCanvas(512, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 512, 40);
  const palette = ['#e94b3c', '#f6c344', '#3b8bd0', '#3fae5a', '#ff8a3d', '#8e5cc4', '#ffffff', '#222'];
  for (let col = 0; col < 4; col++) {
    const sx = 20 + col * 124;
    x.fillStyle = '#c9c3b8'; x.fillRect(sx, 60, 104, 190);
    for (let row = 0; row < 4; row++) {
      const sy = 70 + row * 45;
      x.fillStyle = '#9c968c'; x.fillRect(sx, sy + 36, 104, 4);
      for (let k = 0; k < 9; k++) {
        x.fillStyle = palette[Math.floor(rng() * palette.length)];
        const h = 18 + rng() * 16;
        x.fillRect(sx + 3 + k * 11.3, sy + 36 - h, 9, h);
      }
    }
  }
  return canvasTexture(c);
}

registerBuilding('convenienceStore', {
  label: '便利店 Convenience Store',
  footprint: [14, 11],
  create(ctx, spec, rng) {
    const g = new THREE.Group();
    const brand = spec.brand ? STORE_BRANDS.find((b) => b.en === spec.brand) : STORE_BRANDS[Math.floor(rng() * STORE_BRANDS.length)];
    spec.brandName = brand.name;
    spec.brandEn = brand.en;
    const W = 12, D = 8.5, H = 4.4;

    tiledBox(g, 14, 0.2, 11, 0, 0.1, 0, sharedMaterial('paving'), 0.5);
    // Shell: white panels on three sides.
    const wall = new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.55 });
    box(g, W, H, 0.3, 0, H / 2 + 0.2, -D / 2, wall);
    box(g, 0.3, H, D, -W / 2, H / 2 + 0.2, 0, wall);
    box(g, 0.3, H, D, W / 2, H / 2 + 0.2, 0, wall);
    box(g, W + 0.4, 0.5, D + 0.4, 0, H + 0.45, 0, sharedMaterial('roof'));
    box(g, W - 0.3, 0.1, D - 0.3, 0, 0.25, 0, new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.3 }));

    // Interior back wall with shelves (seen through glass), glowing at night.
    const shelfTex = shelvesTexture(rng);
    const interior = new THREE.MeshStandardMaterial({ map: shelfTex, emissive: 0xffffff, emissiveMap: shelfTex, emissiveIntensity: 0.15, roughness: 0.8 });
    ctx.nightMaterials.push({ material: interior, intensity: 0.9, base: 0.15 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, H - 0.6), interior);
    back.position.set(0, H / 2 + 0.2, -D / 2 + 0.2);
    g.add(back);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D - 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    ctx.nightMaterials.push({ material: ceiling.material, intensity: 1.2, base: 0.3 });
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H - 0.05, 0);
    g.add(ceiling);

    // Storefront glass + mullions.
    const glass = new THREE.MeshStandardMaterial({ color: 0xbcd6e0, metalness: 0.85, roughness: 0.05, transparent: true, opacity: 0.32, envMapIntensity: 1.5 });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H - 1.1), glass);
    front.position.set(0, (H - 1.1) / 2 + 0.25, D / 2);
    g.add(front);
    const frame = sharedMaterial('darkSteel');
    for (let i = 0; i <= 4; i++) box(g, 0.12, H - 1.0, 0.15, -W / 2 + 0.15 + i * (W - 0.3) / 4, (H - 1.0) / 2 + 0.2, D / 2, frame);
    box(g, W, 0.12, 0.15, 0, H - 0.8, D / 2, frame);

    // Sign band.
    const signTex = textTexture([brand.name, brand.en], { width: 1024, height: 160, bg: brand.color, color: '#ffffff',
      font: 'bold 76px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif', subFont: '700 40px sans-serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3, roughness: 0.4 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.3, base: 0.3 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 1.0, 0.3), [frame, frame, frame, frame, signMat, frame]);
    sign.position.set(0, H - 0.25, D / 2 + 0.1);
    g.add(sign);
    box(g, W + 0.4, 0.12, 0.32, 0, H - 0.8, D / 2 + 0.1, new THREE.MeshStandardMaterial({ color: brand.accent, roughness: 0.5 }));

    // Awning.
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: brand.color, roughness: 0.6 }));
    awning.position.set(-3, H - 1.3, D / 2 + 0.8);
    awning.rotation.x = 0.18;
    awning.castShadow = true;
    g.add(awning);

    // Vending machine + rooftop AC units.
    const vend = new THREE.MeshStandardMaterial({ color: 0xe03a2e, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: vend, intensity: 0.15 });
    box(g, 1.0, 1.9, 0.8, W / 2 - 0.9, 1.15, D / 2 + 0.7, vend);
    for (const x of [-3, 0.5, 3.5]) box(g, 1.6, 0.9, 1.1, x, H + 1.15, -1.5, sharedMaterial('concrete'));

    g.userData.height = 6;
    return g;
  },
  info(spec) {
    return {
      name: spec.brandName, nameEn: `${spec.brandEn} Convenience Store`,
      description: '24 小时营业的社区便利店：零食饮料、鲜食、日用品，门口设自动售货机。',
    };
  },
});
