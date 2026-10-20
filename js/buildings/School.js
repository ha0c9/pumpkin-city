// 学校 School — L-shaped brick building, clock tower, running track, flagpole, gate and fence.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, rodMatrix, instancedFrom } from '../core/Utils.js';
import { trackTexture } from '../core/Textures.js';
import { windowWallMaterial, sharedMaterial, box, tiledBox } from './materials.js';

const THREE = window.THREE;

function clockTexture() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f7f3e8'; x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.fill();
  x.lineWidth = 10; x.strokeStyle = '#2b2b2b'; x.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    x.fillStyle = '#2b2b2b';
    x.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 10, 8, 20);
  }
  x.lineCap = 'round';
  x.lineWidth = 9; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 50, 128 - 30); x.stroke();
  x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 - 10, 128 - 90); x.stroke();
  return canvasTexture(c);
}

function wing(ctx, g, w, h, d, x, z, floors, seed) {
  const front = windowWallMaterial(ctx, { cols: Math.round(w / 3), rows: floors, seed, winW: 0.62, winH: 0.5 });
  const side = windowWallMaterial(ctx, { cols: Math.round(d / 3), rows: floors, seed: seed + 1, winW: 0.62, winH: 0.5 });
  const roof = sharedMaterial('roof');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, front, front]);
  m.position.set(x, h / 2 + 0.05, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  const white = sharedMaterial('white');
  for (let f = 1; f < floors; f++) box(g, w + 0.3, 0.25, d + 0.3, x, f * (h / floors), z, white);
  box(g, w + 0.4, 0.8, d + 0.4, x, h + 0.4, z, white);
  return m;
}

registerBuilding('school', {
  label: '学校 School',
  footprint: [36, 32],
  create(ctx) {
    const g = new THREE.Group();
    const floorH = 3.6;
    wing(ctx, g, 30, floorH * 3, 10, 0, -10, 3, 50);
    wing(ctx, g, 10, floorH * 2, 13, -10, 1.5, 2, 52);

    // Entrance canopy.
    box(g, 6, 0.35, 3, 4, 3.4, -3.5, sharedMaterial('white'));
    for (const x of [1.3, 6.7]) box(g, 0.25, 3.3, 0.25, x, 1.7, -2.2, sharedMaterial('white'));

    // Clock tower.
    tiledBox(g, 4.4, 17, 4.4, -10, 8.5, -10, sharedMaterial('white'), 0.3);
    const roofCap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3, 4), new THREE.MeshStandardMaterial({ color: 0x9c3b2a, roughness: 0.7 }));
    roofCap.rotation.y = Math.PI / 4;
    roofCap.position.set(-10, 18.5, -10);
    roofCap.castShadow = true;
    g.add(roofCap);
    const clockMat = new THREE.MeshStandardMaterial({ map: clockTexture(), transparent: true, emissive: 0xfff2d0, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: clockMat, intensity: 0.6 });
    for (let i = 0; i < 4; i++) {
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), clockMat);
      const a = i * Math.PI / 2;
      clock.position.set(-10 + Math.sin(a) * 2.22, 14.5, -10 + Math.cos(a) * 2.22);
      clock.rotation.y = a;
      g.add(clock);
    }

    // Running track and field.
    const trackShape = (w, d, r) => {
      const s = new THREE.Shape();
      s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
      return s;
    };
    const outer = trackShape(21, 14, 7);
    const innerPath = trackShape(15.4, 8.4, 4.2);
    outer.holes.push(innerPath);
    const trackGeo = new THREE.ShapeGeometry(outer, 24);
    trackGeo.rotateX(-Math.PI / 2);
    const tTex = trackTexture().clone();
    tTex.needsUpdate = true;
    tTex.wrapS = tTex.wrapT = THREE.RepeatWrapping;
    tTex.repeat.set(0.1, 0.15);
    const track = new THREE.Mesh(trackGeo, new THREE.MeshStandardMaterial({ map: tTex, roughness: 0.9 }));
    track.position.set(6.5, 0.08, 7.5);
    track.receiveShadow = true;
    g.add(track);
    const fieldGeo = new THREE.ShapeGeometry(trackShape(15.4, 8.4, 4.2), 24);
    fieldGeo.rotateX(-Math.PI / 2);
    const field = new THREE.Mesh(fieldGeo, new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.95 }));
    field.position.set(6.5, 0.07, 7.5);
    field.receiveShadow = true;
    g.add(field);
    box(g, 0.15, 0.02, 8.2, 6.5, 0.1, 7.5, sharedMaterial('white'), { cast: false });
    for (const x of [-1, 14]) {
      box(g, 0.1, 2.2, 0.1, x, 1.2, 6.2, sharedMaterial('white'));
      box(g, 0.1, 2.2, 0.1, x, 1.2, 8.8, sharedMaterial('white'));
      box(g, 0.1, 0.1, 2.7, x, 2.3, 7.5, sharedMaterial('white'));
    }

    // Flagpole with a pumpkin flag.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 12, 10), sharedMaterial('steel'));
    pole.position.set(-4, 6, 13);
    pole.castShadow = true;
    g.add(pole);
    const fc = makeCanvas(256, 170);
    const fx = fc.getContext('2d');
    fx.fillStyle = '#f08a1c'; fx.fillRect(0, 0, 256, 170);
    fx.fillStyle = '#fff3d6'; fx.beginPath(); fx.ellipse(128, 92, 46, 38, 0, 0, Math.PI * 2); fx.fill();
    fx.fillStyle = '#2f7d32'; fx.fillRect(122, 40, 12, 18);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.6, 10, 2);
    const fp = flagGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin((fp.getX(i) + 1.2) * 2.4) * 0.15 * (fp.getX(i) + 1.2) / 2.4);
    flagGeo.computeVertexNormals();
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: canvasTexture(fc), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(-4 + 1.25, 11, 13);
    flag.castShadow = true;
    g.add(flag);
    g.userData.flag = flag;

    // Gate with name board.
    const gx = -9;
    for (const dx of [-3.4, 3.4]) tiledBox(g, 0.9, 3.6, 0.9, gx + dx, 1.8, 15.4, sharedMaterial('white'), 0.3);
    const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.1, 0.4), [
      sharedMaterial('white'), sharedMaterial('white'), sharedMaterial('white'), sharedMaterial('white'),
      new THREE.MeshStandardMaterial({ map: textTexture(['南瓜岛小学', 'PUMPKIN ISLAND SCHOOL'], { bg: '#b8322a', color: '#ffe9b0', width: 1024, height: 160 }) }),
      sharedMaterial('white'),
    ]);
    board.position.set(gx, 3.9, 15.4);
    board.castShadow = true;
    g.add(board);

    // Perimeter fence (gap for the gate).
    const posts = [];
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    const W = 18, D = 16;
    const edges = [[[-W, -D], [W, -D]], [[W, -D], [W, D]], [[W, D], [gx + 4, D]], [[gx - 4, D], [-W, D]], [[-W, D], [-W, -D]]];
    for (const [a, b] of edges) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        posts.push(rodMatrix(p1.set(x, 0, z), p2.set(x, 1.5, z), 0.05));
      }
      for (const y of [0.5, 1.4]) posts.push(rodMatrix(p1.set(a[0], y, a[1]), p2.set(b[0], y, b[1]), 0.035));
    }
    g.add(instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 6), sharedMaterial('darkSteel'), posts, { castShadow: false }));

    g.userData.treeSpots = [[-16, 4], [-16, 10], [16.5, -4], [16.5, -12], [-2, -2], [12, -2]];
    g.userData.height = 20;
    return g;
  },
});
