// 江苏路第二小学 Jiangsu Road No.2 Primary School — L-shaped brick teaching building, clock tower,
// 200 m running track with football pitch, basketball court, flag plaza, gate with a gatehouse (传达室) and fence.
// The gate is at local +Z.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, rodMatrix, instancedFrom } from '../core/Utils.js';
import { trackTexture } from '../core/Textures.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';
import { teachersApple, classHamster, markInterior } from './easterEggs.js';

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

/** School flag: white field, green border, a ribbed pumpkin with stem, leaf and curly vine, and the school name. */
function pumpkinFlagTexture() {
  const W = 512, H = 340;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2f8f4a'; x.fillRect(0, 0, W, 18); x.fillRect(0, H - 18, W, 18);
  const cx = 256, cy = 150;
  // Ribs: back lobes first (darker), then front lobes, each with a radial gradient.
  const lobes = [[-78, 52, 0.75], [78, 52, 0.75], [-48, 60, 0.9], [48, 60, 0.9], [0, 64, 1]];
  for (const [dx, rx, k] of lobes) {
    const gr = x.createRadialGradient(cx + dx - rx * 0.3, cy - 30, 8, cx + dx, cy, rx * 1.6);
    gr.addColorStop(0, `rgb(255,${Math.round(178 * k)},${Math.round(70 * k)})`);
    gr.addColorStop(0.6, `rgb(${Math.round(240 * k + 10)},${Math.round(122 * k)},20)`);
    gr.addColorStop(1, `rgb(${Math.round(180 * k)},${Math.round(76 * k)},12)`);
    x.fillStyle = gr;
    x.beginPath(); x.ellipse(cx + dx, cy, rx, 84, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(150,60,8,0.55)'; x.lineWidth = 3; x.stroke();
  }
  // Highlight streaks along the ribs.
  x.strokeStyle = 'rgba(255,230,170,0.55)'; x.lineWidth = 5; x.lineCap = 'round';
  for (const dx of [-50, 0, 50]) { x.beginPath(); x.ellipse(cx + dx - 14, cy - 8, 10, 58, 0, Math.PI * 1.15, Math.PI * 1.55); x.stroke(); }
  // Stem.
  x.fillStyle = '#6b4a1e';
  x.beginPath();
  x.moveTo(cx - 12, cy - 78); x.quadraticCurveTo(cx - 10, cy - 112, cx + 6, cy - 124);
  x.lineTo(cx + 18, cy - 116); x.quadraticCurveTo(cx + 6, cy - 102, cx + 12, cy - 78); x.closePath(); x.fill();
  // Leaf.
  x.fillStyle = '#3f9a3a';
  x.beginPath();
  x.moveTo(cx + 10, cy - 96);
  x.bezierCurveTo(cx + 40, cy - 140, cx + 96, cy - 130, cx + 112, cy - 104);
  x.bezierCurveTo(cx + 86, cy - 84, cx + 40, cy - 78, cx + 10, cy - 96);
  x.fill();
  x.strokeStyle = '#2a6b27'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx + 14, cy - 96); x.quadraticCurveTo(cx + 60, cy - 110, cx + 108, cy - 104); x.stroke();
  // Curly vine.
  x.strokeStyle = '#3f9a3a'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(cx - 8, cy - 100);
  x.bezierCurveTo(cx - 40, cy - 130, cx - 70, cy - 96, cx - 50, cy - 86);
  x.bezierCurveTo(cx - 36, cy - 80, cx - 34, cy - 100, cx - 46, cy - 100); x.stroke();
  // Name.
  x.fillStyle = '#2f8f4a';
  x.font = 'bold 40px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.textAlign = 'center';
  x.fillText('江苏路第二小学', cx, H - 36);
  return canvasTexture(c, { anisotropy: 8 });
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

function trackShape(w, r) {
  const s = new THREE.Shape();
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  return s;
}

registerBuilding('school', {
  label: '学校 School',
  footprint: [46, 58],
  create(ctx, spec) {
    const g = new THREE.Group();
    const white = sharedMaterial('white');
    const floorH = 3.6;
    const W = 23, D = 29;          // half extents
    const gateX = -12, gateW = 8;  // gate opening in the front fence

    // Grounds: light paving, a central path from the gate to the entrance.
    tiledBox(g, 46, 0.1, 58, 0, 0.05, 0, colorMat(0xcfc8bb, { roughness: 0.9 }), 0.5);
    tiledBox(g, 4.5, 0.06, 46, gateX, 0.12, 6, sharedMaterial('paving'), 0.5);

    // Teaching building: 4-storey main wing along the back, 2-storey wing on the east.
    wing(ctx, g, 40, floorH * 4, 11, 0, -22.5, 4, 50);
    wing(ctx, g, 11, floorH * 2, 14, 17.5, -10, 2, 52);
    // Entrance canopy where the path meets the building, plus a red school motto band.
    box(g, 7, 0.35, 3.4, gateX, 3.5, -15.4, white);
    for (const dx of [-3, 3]) box(g, 0.28, 3.4, 0.28, gateX + dx, 1.75, -14, white);
    const motto = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.3), new THREE.MeshStandardMaterial({
      map: textTexture(['好好学习  天天向上'], { width: 1536, height: 112, bg: '#b8322a', color: '#ffe9b0', font: 'bold 80px "PingFang SC","Microsoft YaHei",sans-serif' }), roughness: 0.7,
    }));
    motto.position.set(4, floorH * 4 - 1.4, -16.93);
    g.add(motto);

    // Clock tower at the west end.
    tiledBox(g, 4.6, 20, 4.6, -17, 10, -22.5, white, 0.3);
    const roofCap = mesh(g, new THREE.ConeGeometry(3.8, 3.4, 4), colorMat(0x9c3b2a, { roughness: 0.7 }), -17, 21.7, -22.5);
    roofCap.rotation.y = Math.PI / 4;
    const clockMat = new THREE.MeshStandardMaterial({ map: clockTexture(), transparent: true, emissive: 0xfff2d0, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: clockMat, intensity: 0.6 });
    for (let i = 0; i < 4; i++) {
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), clockMat);
      const a = i * Math.PI / 2;
      clock.position.set(-17 + Math.sin(a) * 2.32, 17.2, -22.5 + Math.cos(a) * 2.32);
      clock.rotation.y = a;
      g.add(clock);
    }

    // 200 m track with a football pitch inside.
    const tx = 6, tz = 10;
    const outer = trackShape(30, 9);
    outer.holes.push(trackShape(22, 5.2));
    const trackGeo = new THREE.ShapeGeometry(outer, 32);
    trackGeo.rotateX(-Math.PI / 2);
    const tTex = trackTexture().clone();
    tTex.needsUpdate = true;
    tTex.wrapS = tTex.wrapT = THREE.RepeatWrapping;
    tTex.repeat.set(0.1, 0.15);
    const track = mesh(g, trackGeo, new THREE.MeshStandardMaterial({ map: tTex, roughness: 0.9 }), tx, 0.14, tz, { cast: false });
    track.receiveShadow = true;
    const fieldGeo = new THREE.ShapeGeometry(trackShape(22, 5.2), 32);
    fieldGeo.rotateX(-Math.PI / 2);
    mesh(g, fieldGeo, colorMat(0x3f8f3a, { roughness: 0.95 }), tx, 0.13, tz, { cast: false });
    box(g, 0.15, 0.02, 10, tx, 0.16, tz, white, { cast: false });
    const circle = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.95, 32), white);
    circle.rotation.x = -Math.PI / 2; circle.position.set(tx, 0.16, tz);
    g.add(circle);
    for (const dx of [-11.5, 11.5]) {
      box(g, 0.1, 2.2, 0.1, tx + dx, 1.2, tz - 1.6, white);
      box(g, 0.1, 2.2, 0.1, tx + dx, 1.2, tz + 1.6, white);
      box(g, 0.1, 0.1, 3.3, tx + dx, 2.3, tz, white);
    }

    // Basketball court on the west side.
    const court = colorMat(0x3a6fa0, { roughness: 0.8 });
    box(g, 8, 0.06, 15, -18.5, 0.13, -1, court, { cast: false });
    box(g, 7.4, 0.02, 0.1, -18.5, 0.17, -1, white, { cast: false });
    for (const sz of [-1, 1]) {
      box(g, 0.15, 3.2, 0.15, -18.5, 1.6, -1 + sz * 7.6, sharedMaterial('darkSteel'));
      box(g, 1.8, 1.1, 0.08, -18.5, 3.3, -1 + sz * 7.2, white);
    }

    // Flag plaza with a stepped base, tall pole and a waving pumpkin flag.
    const plazaX = -18, plazaZ = 17;
    tiledBox(g, 6, 0.3, 6, plazaX, 0.2, plazaZ, sharedMaterial('stone'), 0.5);
    tiledBox(g, 3.6, 0.3, 3.6, plazaX, 0.5, plazaZ, sharedMaterial('stone'), 0.5);
    mesh(g, new THREE.CylinderGeometry(0.09, 0.12, 14, 10), sharedMaterial('steel'), plazaX, 7.6, plazaZ);
    mesh(g, new THREE.SphereGeometry(0.2, 10, 8), colorMat(0xd4af37, { metalness: 1, roughness: 0.3 }), plazaX, 14.7, plazaZ);
    const flagGeo = new THREE.PlaneGeometry(3.6, 2.4, 14, 3);
    flagGeo.translate(1.8, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: pumpkinFlagTexture(), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(plazaX + 0.1, 13.2, plazaZ);
    flag.castShadow = true;
    flag.userData.dynamic = true;
    g.add(flag);
    const fp = flagGeo.attributes.position;
    const base = Float32Array.from(fp.array);
    g.userData.animate = (t) => {
      for (let i = 0; i < fp.count; i++) {
        const u = base[i * 3], v = base[i * 3 + 1];
        fp.setZ(i, Math.sin(u * 1.9 - t * 4.2 + v * 0.4) * 0.2 * (u / 3.6));
      }
      fp.needsUpdate = true;
      flagGeo.computeVertexNormals();
    };

    // Gate: two pillars with the school name board and a retractable gate.
    for (const dx of [-gateW / 2 - 0.5, gateW / 2 + 0.5]) tiledBox(g, 1, 3.8, 1, gateX + dx, 1.9, D - 0.4, white, 0.3);
    const board = new THREE.Mesh(new THREE.BoxGeometry(gateW + 2, 1.2, 0.4), [white, white, white, white,
      new THREE.MeshStandardMaterial({ map: textTexture(['江苏路第二小学', 'JIANGSU ROAD NO.2 PRIMARY SCHOOL'], { bg: '#b8322a', color: '#ffe9b0', width: 1024, height: 192,
        font: 'bold 84px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif', subFont: '600 36px sans-serif' }) }),
      white]);
    board.position.set(gateX, 4.3, D - 0.4);
    board.castShadow = true;
    g.add(board);
    const rail = sharedMaterial('steel');
    for (let i = 0; i < 9; i++) {
      const bar = box(g, 0.08, 1.4, 0.6, gateX + gateW / 2 - 0.4 - i * 0.32, 0.8, D - 0.4, rail);
      bar.rotation.y = i % 2 ? 0.6 : -0.6;
    }
    box(g, 3, 0.08, 0.12, gateX + gateW / 2 - 1.7, 1.5, D - 0.4, rail);

    // 传达室 Gatehouse: small white lodge with a reception window, door, sign and a little roof light.
    const gh = new THREE.Group();
    const ghW = 6, ghD = 4, ghH = 3.2;
    const ghWall = colorMat(0xf2efe6, { roughness: 0.6 });
    const shell = ghWall.clone();
    shell.side = THREE.DoubleSide;
    const y0 = 0.1;
    const mid = y0 + ghH / 2;
    const t = 0.16;
    const doorW = 1.2;
    const doorH = 2.3;
    const doorX = -1.6;
    box(gh, ghW - 0.08, 0.08, ghD - 0.08, 0, y0 + 0.04, 0, shell, { cast: false });
    box(gh, ghW - 0.2, 0.08, ghD - 0.2, 0, y0 + ghH - 0.1, 0, shell, { cast: false });
    box(gh, ghW, ghH, t, 0, mid, ghD / 2, shell);
    box(gh, t, ghH, ghD, -ghW / 2, mid, 0, shell);
    box(gh, t, ghH, ghD, ghW / 2, mid, 0, shell);
    const gapL = doorX - doorW / 2;
    const gapR = doorX + doorW / 2;
    box(gh, gapL - (-ghW / 2), ghH, t, (-ghW / 2 + gapL) / 2, mid, -ghD / 2, shell);
    box(gh, ghW / 2 - gapR, ghH, t, (ghW / 2 + gapR) / 2, mid, -ghD / 2, shell);
    box(gh, doorW, ghH - doorH, t, doorX, y0 + doorH + (ghH - doorH) / 2, -ghD / 2, shell);
    // Screen so the campus door does not look straight at the cage.
    box(gh, t, ghH - 0.2, 1.15, 0.45, mid, -0.95, shell);
    const hamster = classHamster(gh, 1.65, y0 + 0.02, 0.55);
    hamster.scale.setScalar(2.3);
    hamster.userData.secretPet = true;
    box(gh, ghW + 0.6, 0.3, ghD + 0.6, 0, ghH + 0.25, 0, colorMat(0x9c3b2a, { roughness: 0.7 }));
    const win = new THREE.MeshStandardMaterial({ color: 0x5f86a3, metalness: 0.6, roughness: 0.1, emissive: 0xffe0a8, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: win, intensity: 0.8 });
    box(gh, 0.1, 1.2, 2.2, -ghW / 2 - 0.02, 1.8, 0.2, win, { cast: false }); // reception window facing the gate
    box(gh, 2.4, 1.2, 0.1, 0.8, 1.8, ghD / 2 + 0.02, win, { cast: false });
    box(gh, 0.6, 0.08, 2.4, -ghW / 2 - 0.3, 1.15, 0.2, white);              // window ledge
    const lodgeDoor = box(gh, 0.95, 2.15, 0.08, -1.05, 1.25, -ghD / 2 + 0.55, colorMat(0x6b4a2b, { roughness: 0.6 }));
    lodgeDoor.rotation.y = 0.9;
    const ghSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshStandardMaterial({
      map: textTexture(['传达室'], { width: 256, height: 72, bg: '#ffffff', color: '#b8322a', font: 'bold 54px "PingFang SC","Microsoft YaHei",sans-serif' }),
    }));
    ghSign.position.set(-1.0, ghH - 0.4, ghD / 2 + 0.03);
    gh.add(ghSign);
    const ghSign2 = ghSign.clone();
    ghSign2.rotation.y = -Math.PI / 2;
    ghSign2.position.set(-ghW / 2 - 0.03, ghH - 0.4, 0.2);
    gh.add(ghSign2);
    box(gh, 0.8, 0.6, 0.6, 1.6, ghH + 0.7, -0.6, sharedMaterial('concrete')); // AC unit
    const ghX = gateX + gateW / 2 + 1 + ghW / 2 + 0.3;
    const ghZ = D - 0.6 - ghD / 2 - 0.4;
    gh.position.set(ghX, 0, ghZ);
    g.add(gh);
    markInterior(ctx, spec, [
      [-8, 27, 20, 14],
      [ghX, ghZ, 7, 6],
    ]);

    // Perimeter fence with the gate opening.
    const posts = [];
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    const gx0 = gateX - gateW / 2 - 1, gx1 = gateX + gateW / 2 + 1;
    const edges = [[[-W, -D], [W, -D]], [[W, -D], [W, D]], [[W, D], [gx1, D]], [[gx0, D], [-W, D]], [[-W, D], [-W, -D]]];
    for (const [a, b] of edges) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        posts.push(rodMatrix(p1.set(x, 0, z), p2.set(x, 1.6, z), 0.05));
      }
      for (const y of [0.5, 1.5]) posts.push(rodMatrix(p1.set(a[0], y, a[1]), p2.set(b[0], y, b[1]), 0.035));
    }
    g.add(instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 6), sharedMaterial('darkSteel'), posts, { castShadow: false }));

    teachersApple(g, -7.0, 1.19, 26.2).scale.setScalar(1.8);
    g.userData.treeSpots = [[-21, -12], [-21, 9], [-21, 24], [21, 0], [21, 24], [12, 26], [-5, -13.5], [3, -13.5], [-21, -26.5], [21, -26.5]];
    g.userData.height = 24;
    return g;
  },
});
