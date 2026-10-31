// 幽灵博物馆 — a gloomy two-storey cabin: porch, balcony, warm windows, dead branches, a swing.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, mulberry32 } from '../core/Utils.js';
import { colorMat, box } from './materials.js';
import { porchCat, secretRoom, crystalBall, markInterior } from './easterEggs.js';

const THREE = window.THREE;
const CJK = '"WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';

function ghostTexture() {
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 54, 6, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(225,240,255,0.85)');
  g.addColorStop(1, 'rgba(200,230,255,0.0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

function ghostGeometry() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = 2.4 - t * 2.6;
    const r = t < 0.45 ? Math.sin(t / 0.45 * Math.PI / 2) * 0.85 : 0.85 + (t - 0.45) * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts.reverse(), 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0.1) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, y + Math.sin(a * 6) * 0.18);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function plankMaterial(base, seed) {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  const rng = mulberry32(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 28) {
    const n = Math.floor((rng() - 0.5) * 28);
    x.fillStyle = `rgba(${40 + n},${28 + n},${18 + n},0.45)`;
    x.fillRect(0, y, 256, 26);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(0, y + 25, 256, 3);
  }
  const map = canvasTexture(c, { anisotropy: 4 });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.02 });
}

function gable(g, w, depth, rise, x, y, z, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function limb(g, len, radius, x, y, z, rx, ry, rz, mat) {
  const geo = new THREE.CylinderGeometry(radius * 0.35, radius, len, 5);
  geo.translate(0, len / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}

registerBuilding('ghostMuseum', {
  label: '博物馆 Museum',
  footprint: [46, 46],
  create(ctx, spec) {
    const g = new THREE.Group();
    const rng = mulberry32(666);
    const wood = plankMaterial('#6a4b32', 3);
    const darkWood = plankMaterial('#3d2b22', 9);
    const shingle = plankMaterial('#1a1614', 17);
    const yardMat = new THREE.MeshStandardMaterial({ color: 0x2c261f, roughness: 1 });
    const glow = new THREE.MeshStandardMaterial({
      color: 0xff8a1a, emissive: 0xff6a00, emissiveIntensity: 2.4, roughness: 0.35,
    });
    const dim = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.85, emissive: 0x4a2810, emissiveIntensity: 0.12 });
    ctx.nightMaterials.push({ material: glow, intensity: 0.9, base: 2.4 });
    const frame = colorMat(0x1c1612, { roughness: 0.85 });
    const recess = colorMat(0x100c0a, { roughness: 0.95 });

    box(g, 44, 0.32, 42, 0, 0.2, 0, yardMat, { cast: false });
    box(g, 7, 0.08, 10, 0, 0.2, 12, darkWood, { cast: false });

    // Ground floor shell. The front is open where the seance room sits.
    const wallT = 0.28;
    box(g, 16, 0.2, 12, 0, 0.35, -1, darkWood, { cast: false });
    box(g, 16, 3.5, wallT, 0, 2.15, -7, wood);
    box(g, wallT, 3.5, 12, -8, 2.15, -1, wood);
    box(g, wallT, 3.5, 12, 8, 2.15, -1, wood);
    box(g, 5.1, 3.5, wallT, -5.45, 2.15, 5, wood);
    box(g, 5.1, 3.5, wallT, 5.45, 2.15, 5, wood);
    box(g, 5.8, 0.7, wallT, 0, 3.55, 5, wood);
    // Hides the seance-room ceiling from the street. The door underneath stays open.
    box(g, 5.5, 0.85, 0.22, 0, 3.05, 5.32, wood);

    const win = (x, y, z, ry, lit) => {
      const host = new THREE.Group();
      host.position.set(x, y, z);
      host.rotation.y = ry;
      g.add(host);
      box(host, 1.2, 1.4, 0.08, 0, 0, -0.02, recess, { cast: false });
      box(host, 1.05, 1.22, 0.06, 0, 0, 0.06, lit ? glow : dim, { cast: false });
      box(host, 1.55, 0.12, 0.1, 0, 0.78, 0.1, frame, { cast: false });
      box(host, 1.55, 0.12, 0.1, 0, -0.78, 0.1, frame, { cast: false });
      box(host, 0.12, 1.68, 0.1, -0.72, 0, 0.1, frame, { cast: false });
      box(host, 0.12, 1.68, 0.1, 0.72, 0, 0.1, frame, { cast: false });
      box(host, 0.08, 1.45, 0.08, 0, 0, 0.12, frame, { cast: false });
    };
    win(-5.2, 2.05, 5.16, 0, true);
    win(5.2, 2.05, 5.16, 0, false);
    win(-8.16, 2.05, -2, -Math.PI / 2, true);
    win(8.16, 2.05, 1, Math.PI / 2, true);

    // Porch, stairs, rails.
    box(g, 18, 0.16, 6.2, 0, 0.48, 8.2, darkWood);
    for (const [x, z] of [[-8.4, 5.4], [8.4, 5.4], [-8.4, 11], [8.4, 11], [-3.2, 11], [3.2, 11]]) {
      box(g, 0.22, 2.7, 0.22, x, 1.85, z, darkWood);
    }
    box(g, 18, 0.12, 0.12, 0, 2.55, 11, darkWood);
    box(g, 0.12, 0.12, 6, -8.4, 1.35, 8.2, darkWood);
    box(g, 0.12, 0.12, 6, 8.4, 1.35, 8.2, darkWood);
    box(g, 16.6, 0.12, 0.12, 0, 1.35, 11, darkWood);
    for (let i = 0; i < 4; i++) box(g, 4.2, 0.26, 0.82, 0, 0.18 + i * 0.16, 11.5 + i * 0.95, wood);
    box(g, 0.14, 0.16, 3.5, -2.15, 0.62, 12.85, darkWood);
    box(g, 0.14, 0.16, 3.5, 2.15, 0.62, 12.85, darkWood);

    const shed = box(g, 18.4, 0.2, 7.4, 0, 3.45, 8.3, shingle);
    shed.rotation.x = 0.22;

    // Upper storey, balcony and a dark gable roof.
    box(g, 15.2, 3.2, 11, 0, 5.5, -1.2, wood);
    box(g, 15.6, 0.16, 3.4, 0, 3.95, 6.2, darkWood);
    for (const x of [-7.2, -2.4, 2.4, 7.2]) box(g, 0.14, 1.05, 0.14, x, 4.55, 7.7, darkWood);
    box(g, 15.2, 0.1, 0.1, 0, 5.05, 7.7, darkWood);
    win(-4.2, 5.5, 4.35, 0, true);
    win(0.2, 5.5, 4.35, 0, true);
    win(4.4, 5.5, 4.35, 0, true);
    win(0, 5.5, -6.75, Math.PI, false);

    const leftSlope = box(g, 9.4, 0.22, 14.2, -4.15, 8.85, -1.2, shingle);
    leftSlope.rotation.z = 0.48;
    const rightSlope = box(g, 9.4, 0.22, 14.2, 4.15, 8.85, -1.2, shingle);
    rightSlope.rotation.z = -0.48;
    gable(g, 15.4, 0.2, 3.3, 0, 7.15, 5.7, wood);
    gable(g, 15.4, 0.2, 3.3, 0, 7.15, -8.1, wood);
    for (let i = -6; i <= 6; i += 2) box(g, 0.1, 0.45, 0.1, i, 6.85, 6.3, shingle, { cast: false });

    box(g, 1.15, 2.5, 1.15, 4.8, 9.9, 0.6, colorMat(0x8d8880, { roughness: 0.92 }));
    box(g, 1.4, 0.18, 1.4, 4.8, 11.2, 0.6, colorMat(0x4a453f, { roughness: 0.85 }));

    const bark = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.96 });
    // In front of the gable face, so the dead crown silhouettes against the sky.
    limb(g, 3.6, 0.4, -1.4, 10.55, 6.15, 0.18, 0.1, -1.05, bark);
    limb(g, 3.3, 0.32, 1.5, 10.65, 6.05, 0.14, -0.05, 1.0, bark);
    limb(g, 2.4, 0.16, -2.2, 12.4, 6.5, -0.12, 0.15, -0.45, bark);
    limb(g, 2.2, 0.15, 2.0, 12.2, 6.35, -0.08, 0.1, 0.6, bark);
    limb(g, 2.0, 0.13, 0.05, 12.6, 6.7, 0.22, 0.1, 0.05, bark);

    // One A-frame facing the street, with a seat hung under the apex.
    const lean = 0.46;
    const legH = 3.5;
    const sx0 = 12.6;
    const sz0 = 12.6;
    const spread = (legH / 2) * Math.sin(lean);
    const left = box(g, 0.22, legH, 0.22, sx0 - spread, legH / 2, sz0, darkWood);
    left.rotation.z = -lean;
    const right = box(g, 0.22, legH, 0.22, sx0 + spread, legH / 2, sz0, darkWood);
    right.rotation.z = lean;
    const brace = box(g, 0.16, legH * 0.9, 0.16, sx0, legH * 0.38, sz0 - 1.15, darkWood);
    brace.rotation.x = 0.5;
    box(g, 1.35, 0.12, 0.48, sx0, 1.05, sz0 + 0.2, darkWood);
    box(g, 0.06, 1.85, 0.06, sx0 - 0.42, 2.0, sz0 + 0.2, frame, { cast: false });
    box(g, 0.06, 1.85, 0.06, sx0 + 0.42, 2.0, sz0 + 0.2, frame, { cast: false });

    const signC = makeCanvas(1024, 280);
    const sx = signC.getContext('2d');
    sx.fillStyle = '#2a211c';
    sx.fillRect(0, 0, 1024, 280);
    sx.fillStyle = '#e7d7bf';
    sx.textAlign = 'center';
    sx.textBaseline = 'middle';
    sx.font = `bold 132px ${CJK}`;
    sx.fillText('幽灵博物馆', 512, 110);
    sx.fillStyle = '#c4b39a';
    sx.font = 'bold 52px Arial, sans-serif';
    sx.fillText('GHOST MUSEUM', 512, 210);
    const signTex = canvasTexture(signC, { anisotropy: 4 });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, emissive: 0xffe6c8, emissiveMap: signTex, emissiveIntensity: 0.12 });
    ctx.nightMaterials.push({ material: signMat, intensity: 0.45, base: 0.12 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.7, 0.16), [frame, frame, frame, frame, signMat, frame]);
    board.position.set(-8.2, 2.45, 14.4);
    g.add(board);
    box(g, 0.16, 2.3, 0.16, -11.1, 1.2, 14.4, darkWood);
    box(g, 0.16, 2.3, 0.16, -5.3, 1.2, 14.4, darkWood);

    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0xeef6ff, map: ghostTexture(), transparent: true, opacity: 0.28, depthWrite: false,
      emissive: 0xbfe6ff, emissiveIntensity: 0.15, roughness: 0.6, side: THREE.DoubleSide,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101018 });
    const ghostGeo = ghostGeometry();
    const ghosts = [];
    for (let i = 0; i < 4; i++) {
      const gh = new THREE.Group();
      gh.userData.dynamic = true;
      const body = new THREE.Mesh(ghostGeo, ghostMat);
      body.renderOrder = 5;
      gh.add(body);
      for (const ex of [-0.28, 0.28]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
        eye.position.set(ex, 1.55, 0.7);
        eye.scale.set(1, 1.4, 0.5);
        gh.add(eye);
      }
      gh.scale.setScalar(0.7 + rng() * 0.35);
      g.add(gh);
      ghosts.push({ g: gh, a: rng() * Math.PI * 2, r: 8 + rng() * 6, h: 1.2 + rng() * 4, sp: (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.15), ph: rng() * 10 });
    }
    const uNight = ctx.uniforms.uNight;
    g.userData.animate = (t) => {
      const n = uNight.value;
      ghostMat.opacity = 0.34 + n * 0.4;
      ghostMat.emissiveIntensity = 0.1 + n * 0.8;
      for (const gh of ghosts) {
        const a = gh.a + t * gh.sp;
        const r = gh.r + Math.sin(t * 0.5 + gh.ph) * 1.2;
        gh.g.position.set(Math.cos(a) * r, gh.h + Math.sin(t * 1.1 + gh.ph) * 0.5, Math.sin(a) * r - 1);
        gh.g.rotation.y = -a + (gh.sp > 0 ? 0 : Math.PI);
        gh.g.rotation.z = Math.sin(t * 1.5 + gh.ph) * 0.12;
      }
    };

    porchCat(g, 6.2, 0.58, 9.2).scale.setScalar(1.6);
    secretRoom(g, 0, 0.48, 5.15, 0, {
      wall: 0x3a2c24, floor: 0x2a211c, trim: 0x6a4b32,
      width: 5.6, depth: 4.2, height: 2.65,
      sign: ['降灵室', 'SEANCE'],
      furnish(room, spot) { crystalBall(room, spot.x, spot.y, spot.z).scale.setScalar(1.15); },
    });
    markInterior(ctx, spec, [
      [0, 9.2, 16, 8],
      [0, 3.0, 5.2, 4],
    ]);
    g.userData.height = 14;
    g.userData.treeSpots = [[-18, -16], [18, -16], [-20, -2], [20, -4]];
    return g;
  },
});
