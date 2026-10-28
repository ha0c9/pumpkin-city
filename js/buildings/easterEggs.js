// Small cartoon props for the larger buildings. Porch pieces sit where the street
// can see them. secretRoom is the other kind: an opaque room with a real door,
// and the prop tucked into a side alcove so it stays hidden until you walk in.
import { textTexture } from '../core/Utils.js';
import { colorMat, box, mesh } from './materials.js';

const THREE = window.THREE;

function at(parent, x, y, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (ry) g.rotation.y = ry;
  parent.add(g);
  return g;
}

/** Pink box of donuts on the police reception desk. */
export function donutBox(parent, x, y, z, ry = 0) {
  const g = at(parent, x, y, z, ry);
  const card = colorMat(0xf7efe4, { roughness: 0.7 });
  const pink = colorMat(0xf4b6c8, { roughness: 0.5 });
  const icing = colorMat(0xff8fb8, { roughness: 0.4, emissive: 0x5a2030 });
  box(g, 0.62, 0.14, 0.46, 0, 0.07, 0, card);
  box(g, 0.58, 0.2, 0.04, 0, 0.18, -0.21, pink);
  box(g, 0.04, 0.2, 0.42, -0.29, 0.18, 0, pink);
  box(g, 0.04, 0.2, 0.42, 0.29, 0.18, 0, pink);
  const sprinkles = [0xe24b32, 0xf0c14d, 0x3d9a4a, 0x3a6fd0, 0xf7f4ee];
  for (let i = 0; i < 2; i++) {
    const dx = i === 0 ? -0.13 : 0.15;
    mesh(g, new THREE.TorusGeometry(0.1, 0.042, 6, 12), icing, dx, 0.2, 0.02, { cast: false });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      mesh(
        g, new THREE.SphereGeometry(0.012, 4, 3),
        colorMat(sprinkles[k], { roughness: 0.4 }),
        dx + Math.cos(a) * 0.09, 0.24, 0.02 + Math.sin(a) * 0.04,
        { cast: false },
      );
    }
  }
  return g;
}

/** Copper torch standing in the museum portico. */
export function libertyTorch(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const copper = colorMat(0x3f8f62, { roughness: 0.45, metalness: 0.35 });
  const gold = colorMat(0xf0c14d, { roughness: 0.32, metalness: 0.7 });
  const flame = colorMat(0xfff1c2, { roughness: 0.4, emissive: 0xffb347 });
  box(g, 0.36, 0.08, 0.36, 0, 0.04, 0, gold);
  mesh(g, new THREE.CylinderGeometry(0.14, 0.2, 0.95, 8), copper, 0, 0.52, 0);
  mesh(g, new THREE.CylinderGeometry(0.26, 0.14, 0.2, 8), gold, 0, 1.08, 0);
  mesh(g, new THREE.ConeGeometry(0.2, 0.5, 8), flame, 0, 1.4, 0, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.09, 8, 6), flame, 0, 1.58, 0, { cast: false });
  return g;
}

/** Blue-and-white porcelain on the heritage porch. */
export function porcelainVase(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const blue = colorMat(0x1d4e89, { roughness: 0.32 });
  const white = colorMat(0xf4f7fb, { roughness: 0.3 });
  mesh(g, new THREE.CylinderGeometry(0.22, 0.28, 0.12, 12), blue, 0, 0.06, 0);
  mesh(g, new THREE.SphereGeometry(0.36, 14, 12), white, 0, 0.46, 0).scale.set(1, 0.85, 1);
  mesh(g, new THREE.CylinderGeometry(0.09, 0.15, 0.28, 10), white, 0, 0.9, 0);
  mesh(g, new THREE.TorusGeometry(0.11, 0.03, 6, 12), blue, 0, 1.06, 0, { cast: false }).rotation.x = Math.PI / 2;
  for (const [dx, dy, dz, s] of [[0.2, 0.48, 0.26, 1], [-0.16, 0.4, 0.28, 0.85], [0.04, 0.56, 0.3, 0.7]]) {
    mesh(g, new THREE.SphereGeometry(0.065, 6, 5), blue, dx, dy, dz, { cast: false }).scale.setScalar(s);
  }
  return g;
}

/** Spinning atom. Caller runs userData.tick(t). The group is left dynamic. */
export function atomMobile(parent, x, y, z) {
  const g = at(parent, x, y, z);
  g.userData.dynamic = true;
  const nuc = colorMat(0xe23b3b, { roughness: 0.4, emissive: 0xff5533 });
  const glow = colorMat(0x9be7ff, { roughness: 0.3, emissive: 0x38d9ff });
  const ringMat = colorMat(0x7fd4ff, { roughness: 0.3, metalness: 0.45, emissive: 0x123040 });
  const stand = colorMat(0xd5dbe2, { roughness: 0.4, metalness: 0.4 });
  mesh(g, new THREE.CylinderGeometry(0.3, 0.34, 0.08, 10), stand, 0, -1.05, 0);
  mesh(g, new THREE.CylinderGeometry(0.07, 0.1, 0.7, 8), stand, 0, -0.68, 0);
  mesh(g, new THREE.SphereGeometry(0.26, 12, 10), nuc, 0, 0, 0, { cast: false });
  const spinners = [];
  [0.35, 1.15, 2.05].forEach((tilt, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.x = tilt;
    pivot.rotation.y = i * 0.8;
    g.add(pivot);
    mesh(pivot, new THREE.TorusGeometry(0.82, 0.022, 6, 20), ringMat, 0, 0, 0, { cast: false });
    const spin = new THREE.Group();
    pivot.add(spin);
    mesh(spin, new THREE.SphereGeometry(0.08, 8, 6), glow, 0.82, 0, 0, { cast: false });
    spinners.push(spin);
  });
  g.userData.tick = (t) => {
    g.rotation.y = t * 0.35;
    spinners.forEach((s, i) => { s.rotation.z = t * (1.15 + i * 0.4); });
  };
  return g;
}

/** Desk orrery. Caller runs userData.tick(t). */
export function orrery(parent, x, y, z) {
  const g = at(parent, x, y, z);
  g.userData.dynamic = true;
  const brass = colorMat(0xc9a36a, { roughness: 0.32, metalness: 0.75 });
  const sun = colorMat(0xffd36a, { roughness: 0.4, emissive: 0xffaa33 });
  mesh(g, new THREE.CylinderGeometry(0.38, 0.44, 0.1, 10), brass, 0, 0.05, 0);
  mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), brass, 0, 0.5, 0);
  mesh(g, new THREE.SphereGeometry(0.26, 12, 10), sun, 0, 1.02, 0, { cast: false });
  const arms = new THREE.Group();
  arms.position.y = 1.02;
  g.add(arms);
  const planets = [[0.55, 0.09, 0x3d7fd1], [0.95, 0.13, 0xc1502e], [1.35, 0.16, 0xe0c38a]];
  for (const [r, pr, col] of planets) {
    const ring = mesh(arms, new THREE.TorusGeometry(r, 0.012, 4, 18), brass, 0, 0, 0, { cast: false });
    ring.rotation.x = Math.PI / 2;
    mesh(arms, new THREE.SphereGeometry(pr, 8, 6), colorMat(col, { roughness: 0.5 }), r, 0, 0, { cast: false });
  }
  g.userData.tick = (t) => { arms.rotation.y = t * 0.55; };
  return g;
}

/** Brass diving helmet on the liner's foredeck. */
export function divingHelmet(parent, x, y, z, ry = 0.5) {
  const g = at(parent, x, y, z, ry);
  const brass = colorMat(0xc9a36a, { roughness: 0.3, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x16324a, roughness: 0.08, metalness: 0.4, emissive: 0x1a4a66 });
  mesh(g, new THREE.CylinderGeometry(0.26, 0.32, 0.32, 10), brass, 0, 0.16, 0);
  mesh(g, new THREE.SphereGeometry(0.4, 14, 12), brass, 0, 0.58, 0);
  mesh(g, new THREE.CircleGeometry(0.18, 12), glass, 0, 0.62, 0.34, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.19, 0.028, 6, 12), brass, 0, 0.62, 0.33, { cast: false });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    mesh(g, new THREE.SphereGeometry(0.032, 5, 4), brass, Math.cos(a) * 0.28, 0.78, Math.sin(a) * 0.28, { cast: false });
  }
  return g;
}

/** Easel, a wave painting, and a tiny painter inside the glass gallery. */
export function galleryEasel(parent, x, y, z, ry = 0.45) {
  const g = at(parent, x, y, z, ry);
  const wood = colorMat(0x8d5a32, { roughness: 0.7 });
  const canvas = colorMat(0xe8f4fb, { roughness: 0.55 });
  const wave = colorMat(0x1c6ea4, { roughness: 0.5 });
  const foam = colorMat(0xf7f4ee, { roughness: 0.5 });
  const shirt = colorMat(0x2f6f9f, { roughness: 0.55 });
  const skin = colorMat(0xf0c9a0, { roughness: 0.6 });
  const beret = colorMat(0x1a1a1a, { roughness: 0.5 });
  box(g, 0.08, 1.45, 0.08, -0.28, 0.72, 0.05, wood).rotation.z = 0.12;
  box(g, 0.08, 1.45, 0.08, 0.28, 0.72, 0.05, wood).rotation.z = -0.12;
  box(g, 0.08, 1.35, 0.08, 0, 0.68, -0.22, wood).rotation.x = -0.18;
  box(g, 0.72, 0.95, 0.05, 0, 1.15, 0, canvas);
  box(g, 0.6, 0.16, 0.02, 0, 0.95, 0.04, wave, { cast: false });
  box(g, 0.38, 0.1, 0.02, 0.08, 1.12, 0.05, foam, { cast: false });
  box(g, 0.36, 0.48, 0.22, 0.55, 0.7, 0.38, shirt);
  mesh(g, new THREE.SphereGeometry(0.15, 8, 6), skin, 0.55, 1.1, 0.4);
  mesh(g, new THREE.SphereGeometry(0.17, 8, 6), beret, 0.55, 1.24, 0.36).scale.set(1, 0.4, 1);
  box(g, 0.08, 0.26, 0.08, 0.32, 0.95, 0.28, skin);
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), wood, 0.2, 1.05, 0.16, { cast: false }).rotation.z = 0.9;
  return g;
}

/** A bowl of pumpkin-colored pasta on a dining table. */
export function pastaBowl(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const bowl = colorMat(0xf7f1e6, { roughness: 0.4 });
  const noodle = colorMat(0xf0c14d, { roughness: 0.45, emissive: 0x6a4a10 });
  const sauce = colorMat(0xc23b2e, { roughness: 0.45 });
  const steel = colorMat(0xc8ced4, { roughness: 0.25, metalness: 0.8 });
  mesh(g, new THREE.CylinderGeometry(0.16, 0.1, 0.1, 12), bowl, 0, 0.05, 0);
  mesh(g, new THREE.TorusGeometry(0.14, 0.025, 6, 14), bowl, 0, 0.1, 0, { cast: false }).rotation.x = Math.PI / 2;
  mesh(g, new THREE.TorusGeometry(0.065, 0.026, 5, 10), noodle, 0, 0.13, 0, { cast: false }).rotation.x = 1.15;
  mesh(g, new THREE.SphereGeometry(0.05, 8, 6), sauce, 0.03, 0.16, 0.02, { cast: false });
  mesh(g, new THREE.BoxGeometry(0.02, 0.22, 0.02), steel, 0.12, 0.22, 0.04, { cast: false }).rotation.z = -0.45;
  return g;
}

/** Yellow duck and a do-not-disturb tag under the hotel canopy. */
export function lobbyDuck(parent, x, y, z) {
  const g = at(parent, x, y, z, 0.4);
  const yellow = colorMat(0xffe14a, { roughness: 0.45, emissive: 0x6a5510 });
  const orange = colorMat(0xf08a1e, { roughness: 0.45 });
  const dark = colorMat(0x241810, { roughness: 0.4 });
  const red = colorMat(0xb8322a, { roughness: 0.5 });
  mesh(g, new THREE.SphereGeometry(0.22, 12, 10), yellow, 0, 0.2, 0).scale.set(1.15, 0.85, 1.25);
  mesh(g, new THREE.SphereGeometry(0.13, 10, 8), yellow, 0, 0.4, 0.14);
  mesh(g, new THREE.SphereGeometry(0.045, 6, 5), orange, 0, 0.38, 0.26, { cast: false }).scale.set(1.2, 0.65, 1.3);
  mesh(g, new THREE.SphereGeometry(0.022, 5, 4), dark, 0.045, 0.44, 0.24, { cast: false });
  box(g, 0.14, 0.2, 0.02, 0.32, 0.22, 0.02, red, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.04, 0.01, 4, 8), red, 0.32, 0.34, 0.02, { cast: false });
  return g;
}

/** Grand piano under the porte-cochère. */
export function grandPiano(parent, x, y, z, ry = 0.6) {
  const g = at(parent, x, y, z, ry);
  const black = colorMat(0x1c1e22, { roughness: 0.32, metalness: 0.45 });
  const white = colorMat(0xf7f4ee, { roughness: 0.4 });
  const wood = colorMat(0x6b4228, { roughness: 0.6 });
  for (const [lx, lz] of [[-0.55, 0.35], [0.7, 0.35], [0.1, -0.55]]) {
    mesh(g, new THREE.CylinderGeometry(0.06, 0.07, 0.72, 6), wood, lx, 0.36, lz);
  }
  box(g, 1.7, 0.28, 1.4, 0.15, 0.86, 0, black);
  box(g, 0.9, 0.22, 1.15, -0.55, 0.8, -0.05, black);
  const lid = box(g, 1.5, 0.06, 1.1, 0.2, 1.35, -0.2, black);
  lid.rotation.x = -0.65;
  box(g, 1.2, 0.08, 0.22, 0.35, 0.78, 0.82, white);
  box(g, 1.2, 0.035, 0.04, 0.35, 0.84, 0.74, black, { cast: false });
  box(g, 0.7, 0.08, 0.32, 0.4, 0.48, 1.3, wood);
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.44, 5), wood, 0.15, 0.22, 1.3);
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.44, 5), wood, 0.65, 0.22, 1.3);
  return g;
}

/** Stacked gold and a coin on the lobby step. */
export function goldIngot(parent, x, y, z) {
  const g = at(parent, x, y, z, 0.35);
  const gold = colorMat(0xf0c14d, { roughness: 0.28, metalness: 0.85, emissive: 0x6a4e10 });
  box(g, 0.55, 0.14, 0.26, 0, 0.07, 0, gold);
  box(g, 0.38, 0.12, 0.2, 0.04, 0.2, 0.02, gold);
  mesh(g, new THREE.CylinderGeometry(0.14, 0.14, 0.035, 14), gold, -0.02, 0.28, 0.06, { cast: false });
  return g;
}

/** Horseshoe and prize ribbons on an open stall door. */
export function prizeRibbon(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const gold = colorMat(0xf0c14d, { roughness: 0.3, metalness: 0.7 });
  const blue = colorMat(0x2f6f9f, { roughness: 0.5 });
  const red = colorMat(0xb8322a, { roughness: 0.5 });
  const shoe = mesh(g, new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI * 1.3), gold, 0, 0.12, 0, { cast: false });
  shoe.rotation.z = Math.PI * 0.85;
  box(g, 0.14, 0.26, 0.02, -0.1, -0.12, 0.02, blue, { cast: false });
  box(g, 0.14, 0.26, 0.02, 0.1, -0.12, 0.02, red, { cast: false });
  mesh(g, new THREE.CircleGeometry(0.08, 10), gold, 0, 0.02, 0.03, { cast: false });
  return g;
}

/** Apple on a book, left on the gatehouse ledge. */
export function teachersApple(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const red = colorMat(0xc0392b, { roughness: 0.45, emissive: 0x4a1008 });
  const leaf = colorMat(0x3d7a45, { roughness: 0.6 });
  const book = colorMat(0x1d4e89, { roughness: 0.55 });
  box(g, 0.26, 0.05, 0.18, 0, 0.025, 0, book);
  mesh(g, new THREE.SphereGeometry(0.1, 10, 8), red, 0.01, 0.14, 0);
  mesh(g, new THREE.CylinderGeometry(0.01, 0.01, 0.05, 4), leaf, 0.01, 0.25, 0, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.035, 5, 4), leaf, 0.06, 0.26, 0, { cast: false }).scale.set(1.4, 0.45, 0.6);
  return g;
}

/** Black cat and a candle beside the museum arch. */
export function porchCat(parent, x, y, z) {
  const g = at(parent, x, y, z, -0.5);
  const fur = colorMat(0x161616, { roughness: 0.7 });
  const eye = colorMat(0xffe14a, { roughness: 0.3, emissive: 0xffcc33 });
  const wax = colorMat(0xf4efe6, { roughness: 0.55 });
  const flame = colorMat(0xfff1c2, { roughness: 0.4, emissive: 0xffaa33 });
  mesh(g, new THREE.SphereGeometry(0.2, 10, 8), fur, 0, 0.18, 0).scale.set(1.1, 0.8, 1.35);
  mesh(g, new THREE.SphereGeometry(0.12, 8, 6), fur, 0, 0.36, 0.14);
  for (const s of [-1, 1]) {
    mesh(g, new THREE.SphereGeometry(0.025, 5, 4), eye, s * 0.045, 0.4, 0.24, { cast: false });
    mesh(g, new THREE.ConeGeometry(0.035, 0.07, 4), fur, s * 0.06, 0.5, 0.1, { cast: false });
  }
  mesh(g, new THREE.TorusGeometry(0.09, 0.02, 5, 10, Math.PI), fur, -0.02, 0.22, -0.18, { cast: false }).rotation.y = 0.7;
  mesh(g, new THREE.CylinderGeometry(0.045, 0.045, 0.26, 8), wax, 0.36, 0.16, 0.02);
  mesh(g, new THREE.ConeGeometry(0.028, 0.07, 6), flame, 0.36, 0.32, 0.02, { cast: false });
  return g;
}

/** Forgotten coffee and a desk plant under the office canopy. */
export function coffeeAndPlant(parent, x, y, z) {
  const g = at(parent, x, y, z, -0.4);
  const cup = colorMat(0xf7f4ee, { roughness: 0.4 });
  const coffee = colorMat(0x4a2c1a, { roughness: 0.45 });
  const leaf = colorMat(0x2f7a3a, { roughness: 0.6 });
  const pot = colorMat(0xe8d7c3, { roughness: 0.55 });
  mesh(g, new THREE.CylinderGeometry(0.11, 0.08, 0.18, 10), cup, 0, 0.09, 0);
  mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.015, 10), coffee, 0, 0.18, 0, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.07, 0.012, 5, 8), cup, 0.12, 0.1, 0, { cast: false }).rotation.y = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(0.13, 0.1, 0.14, 8), pot, 0.42, 0.07, 0);
  mesh(g, new THREE.SphereGeometry(0.15, 8, 6), leaf, 0.42, 0.28, 0);
  return g;
}

/** One extra pearl, sitting on a cushion in the plaza. */
export function pearlOnCushion(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const velvet = colorMat(0x7a1d42, { roughness: 0.7 });
  const pearl = colorMat(0xf6a7c8, { roughness: 0.22, metalness: 0.4, emissive: 0x6a2040 });
  const gold = colorMat(0xf0c14d, { roughness: 0.3, metalness: 0.8 });
  mesh(g, new THREE.SphereGeometry(0.42, 12, 8), velvet, 0, 0.1, 0).scale.set(1.35, 0.32, 1.35);
  mesh(g, new THREE.SphereGeometry(0.3, 14, 12), pearl, 0, 0.38, 0);
  mesh(g, new THREE.TorusGeometry(0.14, 0.025, 6, 12), gold, 0, 0.38, 0, { cast: false }).rotation.x = Math.PI / 2;
  return g;
}

/** Toy robot waiting at the works office. */
export function toyRobot(parent, x, y, z, ry = 0.2) {
  const g = at(parent, x, y, z, ry);
  const body = colorMat(0xe07a2f, { roughness: 0.45, metalness: 0.3 });
  const dark = colorMat(0x1a3344, { roughness: 0.4, metalness: 0.45 });
  const eye = colorMat(0x9be7ff, { roughness: 0.3, emissive: 0x38d9ff });
  box(g, 0.42, 0.08, 0.3, 0, 0.04, 0, dark);
  box(g, 0.32, 0.38, 0.24, 0, 0.28, 0, body);
  box(g, 0.26, 0.22, 0.22, 0, 0.6, 0, body);
  mesh(g, new THREE.SphereGeometry(0.045, 6, 5), eye, 0.06, 0.64, 0.1, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.045, 6, 5), eye, -0.06, 0.64, 0.1, { cast: false });
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), dark, 0, 0.78, 0, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.035, 6, 5), eye, 0, 0.88, 0, { cast: false });
  box(g, 0.07, 0.26, 0.07, -0.24, 0.42, 0.02, body).rotation.z = 0.7;
  box(g, 0.07, 0.26, 0.07, 0.22, 0.32, 0, body);
  return g;
}

/** Bellhop cart with two suitcases. */
export function luggageCart(parent, x, y, z, ry = 0.4) {
  const g = at(parent, x, y, z, ry);
  const brass = colorMat(0xc9a36a, { roughness: 0.3, metalness: 0.75 });
  const red = colorMat(0xb8322a, { roughness: 0.5 });
  const navy = colorMat(0x1d4c6e, { roughness: 0.5 });
  box(g, 0.9, 0.05, 0.48, 0, 0.28, 0, brass);
  for (const [dx, dz] of [[-0.32, 0.16], [0.32, 0.16], [-0.32, -0.16], [0.32, -0.16]]) {
    mesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), brass, dx, 0.1, dz).rotation.z = Math.PI / 2;
  }
  box(g, 0.05, 0.7, 0.05, 0, 0.6, -0.2, brass);
  box(g, 0.55, 0.05, 0.05, 0, 0.92, -0.2, brass);
  box(g, 0.38, 0.26, 0.26, -0.12, 0.46, 0.02, red);
  box(g, 0.28, 0.2, 0.2, 0.16, 0.68, 0.02, navy);
  return g;
}

function teddy(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const fur = colorMat(0xc47a3a, { roughness: 0.7 });
  const dark = colorMat(0x3a2a22, { roughness: 0.5 });
  const bow = colorMat(0xb8322a, { roughness: 0.5 });
  mesh(g, new THREE.SphereGeometry(0.26, 10, 8), fur, 0, 0.26, 0);
  mesh(g, new THREE.SphereGeometry(0.18, 10, 8), fur, 0, 0.6, 0.02);
  mesh(g, new THREE.SphereGeometry(0.06, 6, 5), fur, 0, 0.56, 0.16, { cast: false }).scale.set(1.3, 0.75, 0.8);
  for (const s of [-1, 1]) {
    mesh(g, new THREE.SphereGeometry(0.06, 6, 5), fur, s * 0.14, 0.76, 0);
    mesh(g, new THREE.SphereGeometry(0.03, 5, 4), dark, s * 0.06, 0.64, 0.15, { cast: false });
    mesh(g, new THREE.SphereGeometry(0.07, 6, 5), fur, s * 0.18, 0.16, 0.1);
  }
  mesh(g, new THREE.SphereGeometry(0.04, 5, 4), dark, 0, 0.54, 0.18, { cast: false });
  box(g, 0.09, 0.05, 0.03, 0, 0.46, 0.18, bow, { cast: false });
  return g;
}

/**
 * Glass arrivals nook in front of a terminal door: a teddy and a suitcase
 * under a lost-and-found sign. Open toward +Z.
 */
export function arrivalNook(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc5e4f2, roughness: 0.08, metalness: 0.35,
    transparent: true, opacity: 0.22, side: THREE.DoubleSide,
  });
  const frame = colorMat(0xd5dbe2, { roughness: 0.45, metalness: 0.35 });
  const floor = colorMat(0xe7e1d6, { roughness: 0.7 });
  const caseMat = colorMat(0xc45a2a, { roughness: 0.5 });
  box(g, 4.2, 0.08, 3.1, 0, 0.04, 1.55, floor, { cast: false });
  box(g, 0.08, 2.7, 3.1, -2.05, 1.4, 1.55, glass, { cast: false });
  box(g, 0.08, 2.7, 3.1, 2.05, 1.4, 1.55, glass, { cast: false });
  box(g, 4.2, 0.1, 0.12, 0, 2.75, 1.55, frame);
  const sign = textTexture(['失物招领', 'LOST & FOUND'], {
    width: 512, height: 160, bg: '#1d4c6e', color: '#f4f7f8',
    font: 'bold 64px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
    subFont: 'bold 32px Arial, sans-serif',
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.25, roughness: 0.5,
  });
  mesh(g, new THREE.PlaneGeometry(2.2, 0.7), signMat, 0, 2.35, 3.12, { cast: false });
  teddy(g, 0.4, 0.08, 1.65);
  box(g, 0.42, 0.28, 0.24, -0.65, 0.22, 1.4, caseMat);
  box(g, 0.44, 0.035, 0.26, -0.65, 0.38, 1.4, frame, { cast: false });
  return g;
}

/**
 * Mark walkable rectangles in building-local space (x right, z toward the
 * front door). They stay walkable even where the building footprint's pad
 * would otherwise push the walker back outside.
 */
export function markInterior(ctx, spec, rects) {
  if (!ctx?.mask || !spec?.position) return;
  const [px, pz] = spec.position;
  const rot = spec.rotation || 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const [lx, lz, w, d] of rects) {
    ctx.mask.addRect(px + lx * c + lz * s, pz - lx * s + lz * c, w, d, rot, 'interior');
  }
}

/**
 * Opaque room. The door faces local +Z and the room runs toward -Z.
 * The prop goes in the -X alcove, behind a return wall, so a straight look
 * through the doorway hits the back wall and misses the prop.
 * Floors sit near local y = 0 so a walking camera (eye ~1.7) can see them.
 * `furnish(group, {x, y, z})` places the prop; the point is the alcove floor.
 */
export function secretRoom(parent, x, y, z, ry, opts = {}) {
  const width = opts.width ?? 4.6;
  const depth = opts.depth ?? 3.6;
  const height = opts.height ?? 3.1;
  const g = at(parent, x, y, z, ry);
  const wallMat = new THREE.MeshStandardMaterial({ color: opts.wall ?? 0xf4efe6, roughness: 0.82, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: opts.floor ?? 0xcbb892, roughness: 0.72, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: opts.trim ?? 0x6e3b2a, roughness: 0.55, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xfff6ea, emissive: 0xffe2b8, emissiveIntensity: 0.32, roughness: 0.9, side: THREE.DoubleSide,
  });
  const T = 0.16;
  const hw = width / 2;
  const doorW = Math.min(1.65, Math.max(1.15, width - 1.2));
  const doorH = Math.min(2.35, height - 0.55);
  box(g, width, 0.08, depth, 0, 0.04, -depth / 2, floorMat, { cast: false });
  box(g, width - 0.12, 0.08, depth - 0.12, 0, height - 0.12, -depth / 2, ceilMat, { cast: false });
  box(g, width + T, height, T, 0, height / 2, -depth, wallMat);
  box(g, T, height, depth, -hw, height / 2, -depth / 2, wallMat);
  box(g, T, height, depth, hw, height / 2, -depth / 2, wallMat);
  const sideW = (width - doorW) / 2;
  box(g, sideW, height, T, -hw + sideW / 2, height / 2, 0, wallMat);
  box(g, sideW, height, T, hw - sideW / 2, height / 2, 0, wallMat);
  box(g, doorW + 0.02, height - doorH, T, 0, doorH + (height - doorH) / 2, 0, wallMat);
  box(g, 0.07, doorH, 0.1, -doorW / 2, doorH / 2, 0.05, trimMat, { cast: false });
  box(g, 0.07, doorH, 0.1, doorW / 2, doorH / 2, 0.05, trimMat, { cast: false });
  box(g, doorW + 0.14, 0.08, 0.1, 0, doorH, 0.05, trimMat, { cast: false });
  const leaf = box(g, doorW * 0.88, doorH - 0.08, 0.05, doorW / 2 - 0.08, (doorH - 0.08) / 2, -0.55, trimMat);
  leaf.rotation.y = -0.8;
  const returnX = -(doorW / 2 + 0.28);
  const returnLen = Math.min(depth - 0.4, Math.max(1.3, depth * 0.7));
  box(g, T, height, returnLen, returnX, height / 2, -0.05 - returnLen / 2, wallMat);
  const alcoveX = ((-hw + 0.36) + (returnX - 0.28)) / 2;
  const alcoveZ = -Math.min(returnLen * 0.55, depth - 0.5);
  if (opts.sign) {
    const lines = Array.isArray(opts.sign) ? opts.sign : [opts.sign];
    const tex = textTexture(lines, {
      width: 512, height: 160, bg: '#5c3318', color: '#fff6e4',
      font: 'bold 72px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","WenQuanYi Micro Hei",sans-serif',
      subFont: 'bold 36px Arial, sans-serif',
    });
    const signMat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.5,
    });
    mesh(g, new THREE.PlaneGeometry(1.2, 0.38), signMat, 0, Math.min(doorH + 0.26, height - 0.24), 0.1, { cast: false });
  }
  mesh(g, new THREE.SphereGeometry(0.07, 8, 6), ceilMat, alcoveX, height - 0.28, alcoveZ, { cast: false });
  if (opts.furnish) opts.furnish(g, { x: alcoveX, y: 0.08, z: alcoveZ });
  return g;
}

/** Sauce, an open recipe book and a pumpkin, for the pasta kitchen. */
export function pantryShelf(parent, x, y, z) {
  const g = at(parent, x, y, z, 0.5);
  const wood = colorMat(0x8d5a32, { roughness: 0.65 });
  const red = colorMat(0xb8322a, { roughness: 0.45 });
  const paper = colorMat(0xfff8ee, { roughness: 0.75 });
  const pumpkin = colorMat(0xe07a2f, { roughness: 0.55 });
  const green = colorMat(0x3d8a3a, { roughness: 0.6 });
  const gold = colorMat(0xf0c14d, { roughness: 0.4, metalness: 0.45 });
  box(g, 0.08, 0.7, 0.32, -0.32, 0.35, 0, wood);
  box(g, 0.08, 0.7, 0.32, 0.32, 0.35, 0, wood);
  box(g, 0.72, 0.06, 0.34, 0, 0.7, 0, wood);
  mesh(g, new THREE.CylinderGeometry(0.09, 0.1, 0.26, 10), red, -0.14, 0.88, 0);
  mesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), gold, -0.14, 1.03, 0, { cast: false });
  const left = box(g, 0.2, 0.02, 0.15, 0.08, 0.76, 0.02, paper, { cast: false });
  left.rotation.z = 0.2;
  left.rotation.y = -0.25;
  const right = box(g, 0.2, 0.02, 0.15, 0.26, 0.76, 0, paper, { cast: false });
  right.rotation.z = -0.12;
  right.rotation.y = 0.3;
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5), wood, 0.02, 0.9, -0.04, { cast: false }).rotation.z = 0.8;
  mesh(g, new THREE.SphereGeometry(0.045, 6, 5), wood, -0.1, 0.78, -0.04, { cast: false }).scale.set(1, 0.4, 1.25);
  mesh(g, new THREE.SphereGeometry(0.14, 10, 8), pumpkin, 0.12, 0.14, 0.22);
  mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.07, 5), green, 0.12, 0.28, 0.22, { cast: false });
  return g;
}

/** Sleeping sloth in a chair — the records clerk. */
export function slothClerk(parent, x, y, z, ry = 0) {
  const g = at(parent, x, y, z, ry);
  const fur = colorMat(0x8d7868, { roughness: 0.78 });
  const faceC = colorMat(0xe6d2ba, { roughness: 0.7 });
  const dark = colorMat(0x2a2420, { roughness: 0.5 });
  const cloth = colorMat(0x2c5ed2, { roughness: 0.55 });
  const wood = colorMat(0x6b3a22, { roughness: 0.7 });
  box(g, 0.58, 0.08, 0.5, 0, 0.42, 0, wood);
  box(g, 0.52, 0.5, 0.08, 0, 0.72, -0.22, wood);
  box(g, 0.08, 0.42, 0.08, -0.22, 0.21, 0.16, wood);
  box(g, 0.08, 0.42, 0.08, 0.22, 0.21, 0.16, wood);
  mesh(g, new THREE.SphereGeometry(0.28, 10, 8), fur, 0, 0.74, 0.02).scale.set(1.15, 1.2, 0.9);
  box(g, 0.32, 0.26, 0.06, 0, 0.72, 0.18, cloth, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.2, 10, 8), faceC, 0, 1.14, 0.05);
  for (const s of [-1, 1]) {
    mesh(g, new THREE.SphereGeometry(0.055, 6, 5), dark, s * 0.07, 1.16, 0.2, { cast: false }).scale.set(1.35, 0.55, 0.35);
    mesh(g, new THREE.SphereGeometry(0.04, 6, 5), fur, s * 0.16, 1.28, 0.02, { cast: false });
  }
  mesh(g, new THREE.TorusGeometry(0.045, 0.01, 4, 8, Math.PI), dark, 0, 1.05, 0.2, { cast: false }).rotation.z = Math.PI;
  box(g, 0.08, 0.5, 0.08, -0.34, 0.52, 0.08, fur).rotation.z = 0.3;
  box(g, 0.08, 0.5, 0.08, 0.34, 0.52, 0.08, fur).rotation.z = -0.22;
  box(g, 0.12, 0.035, 0.06, -0.42, 0.28, 0.1, dark, { cast: false });
  box(g, 0.12, 0.035, 0.06, 0.42, 0.3, 0.1, dark, { cast: false });
  return g;
}

/** A turned-down bed, a pumpkin pillow and the spare room key. */
export function hotelNook(parent, x, y, z) {
  const g = at(parent, x, y, z, 0.35);
  const wood = colorMat(0x8d5a32, { roughness: 0.6 });
  const sheet = colorMat(0xf7f4ee, { roughness: 0.72 });
  const quilt = colorMat(0xffcf2e, { roughness: 0.65 });
  const pumpkin = colorMat(0xe07a2f, { roughness: 0.55 });
  const gold = colorMat(0xf0c14d, { roughness: 0.32, metalness: 0.75 });
  const red = colorMat(0xb8322a, { roughness: 0.5 });
  box(g, 1.2, 0.1, 0.64, 0, 0.28, 0, wood);
  box(g, 0.08, 0.4, 0.64, -0.58, 0.5, 0, wood);
  box(g, 1.05, 0.08, 0.52, 0.04, 0.36, 0, sheet, { cast: false });
  box(g, 0.72, 0.07, 0.48, 0.16, 0.43, 0, quilt, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.12, 8, 6), pumpkin, -0.32, 0.5, 0.02, { cast: false });
  mesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 5), colorMat(0x3d8a3a, { roughness: 0.6 }), -0.32, 0.62, 0.02, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.055, 0.012, 5, 8), gold, 0.42, 0.95, 0.02, { cast: false });
  box(g, 0.07, 0.1, 0.02, 0.42, 0.82, 0.04, red, { cast: false });
  box(g, 0.16, 0.22, 0.03, 0.42, 0.55, 0.2, red, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.045, 0.012, 4, 8), red, 0.42, 0.68, 0.22, { cast: false });
  return g;
}

/** Class hamster in a wire cage, the gatehouse pet. */
export function classHamster(parent, x, y, z) {
  const g = at(parent, x, y, z, 0.4);
  const metal = colorMat(0xd5dbe2, { roughness: 0.32, metalness: 0.65 });
  const fur = colorMat(0xd7a15a, { roughness: 0.7 });
  const pink = colorMat(0xf0a0b4, { roughness: 0.5 });
  const dark = colorMat(0x2a2420, { roughness: 0.5 });
  box(g, 0.72, 0.04, 0.5, 0, 0.02, 0, metal, { cast: false });
  box(g, 0.72, 0.03, 0.03, 0, 0.58, -0.23, metal, { cast: false });
  box(g, 0.72, 0.03, 0.03, 0, 0.58, 0.23, metal, { cast: false });
  box(g, 0.03, 0.03, 0.44, -0.34, 0.58, 0, metal, { cast: false });
  box(g, 0.03, 0.03, 0.44, 0.34, 0.58, 0, metal, { cast: false });
  for (const [dx, dz] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]]) {
    box(g, 0.03, 0.56, 0.03, dx, 0.3, dz, metal, { cast: false });
  }
  for (const dx of [-0.16, 0, 0.16]) box(g, 0.02, 0.54, 0.02, dx, 0.3, 0.22, metal, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.11, 8, 6), fur, -0.06, 0.16, 0);
  mesh(g, new THREE.SphereGeometry(0.035, 6, 5), pink, -0.02, 0.14, 0.09, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.016, 5, 4), dark, 0, 0.16, 0.11, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.04, 6, 5), pink, -0.14, 0.22, 0, { cast: false });
  mesh(g, new THREE.TorusGeometry(0.09, 0.012, 5, 10), metal, 0.16, 0.26, 0, { cast: false });
  return g;
}

/** Beaker and a little microscope on the lab bench. */
export function labBench(parent, x, y, z) {
  const g = at(parent, x, y, z, -0.35);
  const top = colorMat(0xd5dbe2, { roughness: 0.35, metalness: 0.4 });
  const leg = colorMat(0x1b2733, { roughness: 0.5, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xd7f3ff, transparent: true, opacity: 0.38, roughness: 0.05,
  });
  const liquid = colorMat(0x3dffa0, { roughness: 0.28, emissive: 0x1c8a48 });
  const glow = colorMat(0x9be7ff, { roughness: 0.3, emissive: 0x38d9ff });
  box(g, 0.95, 0.06, 0.48, 0, 0.74, 0, top);
  for (const [dx, dz] of [[-0.4, -0.18], [0.4, -0.18], [-0.4, 0.18], [0.4, 0.18]]) {
    box(g, 0.05, 0.74, 0.05, dx, 0.37, dz, leg);
  }
  mesh(g, new THREE.CylinderGeometry(0.1, 0.11, 0.3, 10), glass, -0.16, 0.96, 0, { cast: false });
  mesh(g, new THREE.CylinderGeometry(0.075, 0.075, 0.14, 10), liquid, -0.16, 0.88, 0, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.028, 6, 5), liquid, -0.12, 1.08, 0.02, { cast: false });
  mesh(g, new THREE.SphereGeometry(0.018, 6, 5), liquid, -0.2, 1.12, -0.02, { cast: false });
  box(g, 0.18, 0.08, 0.24, 0.22, 0.82, 0, leg);
  box(g, 0.06, 0.28, 0.06, 0.22, 1.0, 0, leg);
  mesh(g, new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), glow, 0.22, 1.18, 0.07, { cast: false }).rotation.x = Math.PI / 2;
  return g;
}

/** A pocket Liberty Bell on a stand. */
export function libertyBell(parent, x, y, z) {
  const g = at(parent, x, y, z);
  const gold = colorMat(0xd4af37, { roughness: 0.32, metalness: 0.78 });
  const wood = colorMat(0x6b3a22, { roughness: 0.65 });
  const dark = colorMat(0x3a2a22, { roughness: 0.5 });
  box(g, 0.72, 0.12, 0.72, 0, 0.06, 0, wood);
  mesh(g, new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8), wood, 0, 0.4, 0);
  box(g, 0.5, 0.08, 0.12, 0, 0.72, 0, wood);
  mesh(g, new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold, 0, 1.05, 0);
  mesh(g, new THREE.CylinderGeometry(0.28, 0.3, 0.08, 12), gold, 0, 0.82, 0);
  mesh(g, new THREE.SphereGeometry(0.04, 6, 5), dark, 0, 0.78, 0, { cast: false });
  box(g, 0.025, 0.2, 0.02, 0.1, 0.95, 0.22, dark, { cast: false });
  return g;
}
