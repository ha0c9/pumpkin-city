// 罗森便利店 Lawson convenience store — white box with the blue LAWSON band, milk-can logo, blue stripes,
// a glass storefront with visible shelves, and rooftop units.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox } from './materials.js';
import { isRestaurantLot, buildRestaurant } from './Restaurant.js';

const THREE = window.THREE;

const LAWSON_BLUE = '#0b6ab8';
const BRANCHES = ['南瓜大道店', '中山路店', '东林店', '北原店', '西岭店', '南湾店', '江苏路店', '华山路店', '武夷路店', '愚园路店'];

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

/** Lawson's milk can: a white can with a blue lid band, drawn at (cx, cy) with height h. */
function milkCan(x, cx, cy, h, fg, bg) {
  const w = h * 0.62;
  x.fillStyle = fg;
  x.beginPath();
  x.moveTo(cx - w * 0.28, cy - h / 2);
  x.lineTo(cx + w * 0.28, cy - h / 2);
  x.lineTo(cx + w * 0.3, cy - h * 0.36);
  x.quadraticCurveTo(cx + w * 0.5, cy - h * 0.25, cx + w * 0.5, cy - h * 0.05);
  x.lineTo(cx + w * 0.5, cy + h / 2);
  x.lineTo(cx - w * 0.5, cy + h / 2);
  x.lineTo(cx - w * 0.5, cy - h * 0.05);
  x.quadraticCurveTo(cx - w * 0.5, cy - h * 0.25, cx - w * 0.3, cy - h * 0.36);
  x.closePath(); x.fill();
  x.fillStyle = bg;
  x.fillRect(cx - w * 0.36, cy - h * 0.33, w * 0.72, h * 0.07);
  // Handle.
  x.strokeStyle = fg; x.lineWidth = h * 0.06;
  x.beginPath(); x.arc(cx + w * 0.5, cy + h * 0.05, w * 0.22, -Math.PI / 2, Math.PI / 2); x.stroke();
}

function lawsonSignTexture(branch) {
  const c = makeCanvas(1024, 192);
  const x = c.getContext('2d');
  x.fillStyle = LAWSON_BLUE; x.fillRect(0, 0, 1024, 192);
  // Logo box: white rounded square with a blue milk can.
  x.fillStyle = '#ffffff';
  x.beginPath(); x.roundRect ? x.roundRect(36, 22, 148, 148, 18) : x.rect(36, 22, 148, 148); x.fill();
  milkCan(x, 110, 98, 116, LAWSON_BLUE, '#ffffff');
  x.fillStyle = '#ffffff';
  x.textBaseline = 'middle';
  x.font = 'bold 112px "Arial Black","Helvetica Neue",Arial,sans-serif';
  x.fillText('LAWSON', 214, 82);
  x.font = 'bold 44px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillText(`罗森  ${branch}`, 220, 158);
  return canvasTexture(c, { anisotropy: 8 });
}

function stripeWallTexture() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f6f6f3'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = LAWSON_BLUE;
  x.fillRect(0, 30, 256, 22);
  x.fillStyle = '#7fb8e6';
  x.fillRect(0, 60, 256, 8);
  return canvasTexture(c);
}

registerBuilding('convenienceStore', {
  label: '便利店 Convenience Store',
  footprint: [14, 11],
  create(ctx, spec, rng) {
    // One existing Lawson lot is the restaurant. Burn the same rng draws the shelves would,
    // so the other stores keep their branch names and shelf layouts.
    if (isRestaurantLot(spec)) {
      BRANCHES[Math.floor(rng() * BRANCHES.length)];
      shelvesTexture(rng);
      return buildRestaurant(ctx, spec);
    }
    const g = new THREE.Group();
    const branch = spec.branch || BRANCHES[Math.floor(rng() * BRANCHES.length)];
    spec.branchName = branch;
    const W = 12, D = 8.5, H = 4.4;

    tiledBox(g, 14, 0.2, 11, 0, 0.1, 0, sharedMaterial('paving'), 0.5);
    // Shell: white panels with Lawson's blue stripes running around the sides and back.
    const wallTex = stripeWallTexture();
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.55 });
    box(g, W, H, 0.3, 0, H / 2 + 0.2, -D / 2, wall);
    box(g, 0.3, H, D, -W / 2, H / 2 + 0.2, 0, wall);
    box(g, 0.3, H, D, W / 2, H / 2 + 0.2, 0, wall);
    box(g, W + 0.4, 0.5, D + 0.4, 0, H + 0.45, 0, sharedMaterial('roof'));
    box(g, W - 0.3, 0.1, D - 0.3, 0, 0.25, 0, colorMat(0xdedad2, { roughness: 0.3 }));

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
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H - 1.2), glass);
    front.position.set(0, (H - 1.2) / 2 + 0.25, D / 2);
    g.add(front);
    const frame = colorMat(0xe9ecef, { roughness: 0.4, metalness: 0.5 });
    for (let i = 0; i <= 4; i++) box(g, 0.12, H - 1.1, 0.15, -W / 2 + 0.15 + i * (W - 0.3) / 4, (H - 1.1) / 2 + 0.2, D / 2, frame);

    // The blue LAWSON fascia wraps the front and both front corners.
    const blue = colorMat(0x0b6ab8, { roughness: 0.45 });
    const signTex = lawsonSignTexture(branch);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3, roughness: 0.4 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.3, base: 0.3 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 1.25, 0.3), [blue, blue, blue, blue, signMat, blue]);
    sign.position.set(0, H - 0.35, D / 2 + 0.1);
    g.add(sign);
    for (const sx of [-1, 1]) box(g, 0.3, 1.25, 2.6, sx * (W / 2 + 0.05), H - 0.35, D / 2 - 1.2, blue);
    box(g, W + 0.4, 0.1, 0.32, 0, H - 1.02, D / 2 + 0.1, colorMat(0x7fb8e6, { roughness: 0.5 }));

    // Pole sign with the milk-can logo by the entrance.
    const poleSign = makeCanvas(256, 256);
    const px = poleSign.getContext('2d');
    px.fillStyle = LAWSON_BLUE; px.fillRect(0, 0, 256, 256);
    milkCan(px, 128, 112, 150, '#ffffff', LAWSON_BLUE);
    px.fillStyle = '#ffffff'; px.font = 'bold 40px "Arial Black",Arial,sans-serif'; px.textAlign = 'center';
    px.fillText('LAWSON', 128, 232);
    const logoTex = canvasTexture(poleSign);
    const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.3 });
    ctx.nightMaterials.push({ material: logoMat, intensity: 1.2, base: 0.3 });
    box(g, 0.18, 4.2, 0.18, W / 2 + 0.3, 2.3, D / 2 + 1.6, sharedMaterial('darkSteel'));
    const logo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.25), [blue, blue, blue, blue, logoMat, logoMat]);
    logo.position.set(W / 2 + 0.3, 4.8, D / 2 + 1.6);
    logo.castShadow = true;
    g.add(logo);

    // Automatic door mat, ice-cream freezer, bike rack and rooftop AC units.
    box(g, 2.2, 0.04, 1.2, -3, 0.23, D / 2 + 0.7, colorMat(0x333a40, { roughness: 1 }), { cast: false });
    box(g, 1.6, 0.9, 0.7, 3.6, 0.65, D / 2 + 0.6, colorMat(0xffffff, { roughness: 0.4 }));
    for (let i = 0; i < 4; i++) box(g, 0.06, 0.7, 1.0, -W / 2 + 0.6 + i * 0.7, 0.55, D / 2 + 1.6, sharedMaterial('steel'));
    for (const x of [-3, 0.5, 3.5]) box(g, 1.6, 0.9, 1.1, x, H + 1.15, -1.5, sharedMaterial('concrete'));

    g.userData.height = 6.5;
    return g;
  },
  info(spec) {
    if (isRestaurantLot(spec)) {
      return {
        category: '餐馆 Restaurant',
        name: '南瓜大道餐馆', nameEn: 'Pumpkin Avenue Bistro',
        description: '两层小餐馆。一楼和二楼都摆着餐桌，左墙的楼梯通到二楼，临街两面是玻璃，从外面就能看见里面。',
      };
    }
    return {
      name: `罗森便利店 ${spec.branchName}`, nameEn: 'LAWSON Convenience Store',
      description: '24 小时营业的罗森便利店：关东煮、饭团便当、甜品咖啡与日用品，标志性的蓝色牛奶罐招牌。',
    };
  },
});
