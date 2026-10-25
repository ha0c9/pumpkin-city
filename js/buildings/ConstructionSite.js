// 建筑工地 Construction site — hoarding, excavation, a half-built concrete frame with scaffolding,
// a rotating tower crane, site offices and material piles. Sized to its lot (spec.size).
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, rodMatrix, instancedFrom } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, tiledBox, mesh } from './materials.js';
import { isFactoryLot, buildFactory } from './Factory.js';

const THREE = window.THREE;

let hoardingTex = null;
function hoardingTexture() {
  if (hoardingTex) return hoardingTex;
  const c = makeCanvas(512, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#1f5fae'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#ffffff'; x.fillRect(0, 96, 512, 32);
  x.fillStyle = '#1f5fae';
  x.font = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif';
  x.textAlign = 'center';
  x.fillText('南瓜岛城市建设 · 安全文明施工', 256, 118);
  x.fillStyle = '#ffffff';
  x.font = 'bold 44px "PingFang SC","Microsoft YaHei",sans-serif';
  x.fillText('建 设 美 好 家 园', 256, 62);
  hoardingTex = canvasTexture(c);
  hoardingTex.wrapS = THREE.RepeatWrapping;
  return hoardingTex;
}

/** Lattice mast/jib from rods: four chords plus zig-zag bracing between p0 and p1 (axis-aligned). */
function lattice(mats, p0, p1, w, axis) {
  const len = p0.distanceTo(p1);
  const n = Math.max(1, Math.round(len / w));
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  const u = axis === 'y' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => u.clone().multiplyScalar(a * w / 2).addScaledVector(v, b * w / 2));
  for (const c of corners) mats.push(rodMatrix(p0.clone().add(c), p1.clone().add(c), 0.09));
  for (let i = 0; i < n; i++) {
    const a = p0.clone().addScaledVector(dir, len * i / n), b = p0.clone().addScaledVector(dir, len * (i + 1) / n);
    for (let k = 0; k < 4; k++) {
      const c0 = corners[k], c1 = corners[(k + 1) % 4];
      mats.push(rodMatrix(a.clone().add(i % 2 ? c0 : c1), b.clone().add(i % 2 ? c1 : c0), 0.05));
    }
  }
}

registerBuilding('constructionSite', {
  label: '建筑工地 Construction Site',
  footprint: [40, 34],
  create(ctx, spec, rng) {
    // The far site on 南湾岛 is the factory. Consume the two rng draws this site would
    // have used, so the other construction sites keep their frames and crane motion.
    if (isFactoryLot(spec)) {
      rng();
      rng();
      return buildFactory(ctx, spec);
    }
    const g = new THREE.Group();
    const [W, D] = spec.size || [40, 34];
    const yellow = colorMat(0xf2b707, { roughness: 0.5, metalness: 0.3 });
    const concrete = sharedMaterial('concrete');
    const dirt = colorMat(0x8a6a4a, { roughness: 1 });

    box(g, W, 0.2, D, 0, 0.1, 0, dirt, { cast: false });

    // Hoarding (2.4 m painted panels) with a gate on the front.
    const tex = hoardingTexture();
    const hoard = (len) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 10)), 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
    };
    const gate = 8;
    const sideLen = (W - gate) / 2;
    for (const sx of [-1, 1]) box(g, sideLen, 2.4, 0.15, sx * (gate / 2 + sideLen / 2), 1.3, D / 2, hoard(sideLen));
    box(g, W, 2.4, 0.15, 0, 1.3, -D / 2, hoard(W));
    for (const sx of [-1, 1]) box(g, 0.15, 2.4, D, sx * W / 2, 1.3, 0, hoard(D));
    const stripe = colorMat(0xe23b3b, { roughness: 0.6 });
    for (const sx of [-1, 1]) box(g, 0.5, 3.2, 0.5, sx * gate / 2, 1.7, D / 2, stripe);
    const signTex = textTexture(['施工重地 闲人免进', 'CONSTRUCTION SITE · NO ENTRY'], { width: 1024, height: 192, bg: '#f2b707', color: '#1b1b1b',
      font: 'bold 84px "PingFang SC","Microsoft YaHei",sans-serif', subFont: 'bold 44px sans-serif' });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(gate + 1, 1.3, 0.2), [stripe, stripe, stripe, stripe, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }), stripe]);
    sign.position.set(0, 3.9, D / 2);
    g.add(sign);

    // Excavation pit on one side, half-built frame on the other.
    const frameW = Math.min(20, W * 0.48), frameD = Math.min(16, D * 0.5);
    const fx = -W / 2 + frameW / 2 + 3, fz = -D / 2 + frameD / 2 + 3;
    const pitW = Math.max(6, W - frameW - 12), pitD = Math.max(6, D * 0.45);
    const px = W / 2 - pitW / 2 - 3, pz = D / 2 - pitD / 2 - 4;
    box(g, pitW, 0.05, pitD, px, 0.22, pz, colorMat(0x5e4630, { roughness: 1 }), { cast: false });
    for (const [x, z, w, d] of [[px, pz - pitD / 2, pitW, 0.4], [px, pz + pitD / 2, pitW, 0.4], [px - pitW / 2, pz, 0.4, pitD], [px + pitW / 2, pz, 0.4, pitD]]) {
      box(g, w, 0.8, d, x, 0.4, z, concrete);
    }
    const rebar = colorMat(0x7a4a2a, { roughness: 0.7, metalness: 0.5 });
    const rebarMats = [];
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      const x = px - pitW / 2 + 1 + i * (pitW - 2) / 7, z = pz - pitD / 2 + 1 + j * (pitD - 2) / 4;
      rebarMats.push(rodMatrix(p1.set(x, 0.2, z), p2.set(x, 2.2, z), 0.05));
    }
    g.add(instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 4), rebar, rebarMats, { castShadow: false }));

    const floors = 3 + Math.floor(rng() * 4);
    const fh = 3.4;
    const colMats = [];
    for (let f = 0; f < floors; f++) {
      box(g, frameW, 0.35, frameD, fx, 0.2 + (f + 1) * fh, fz, concrete);
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) {
        const x = fx - frameW / 2 + 0.4 + i * (frameW - 0.8) / 4, z = fz - frameD / 2 + 0.4 + j * (frameD - 0.8) / 3;
        colMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.2 + f * fh + fh / 2, z), new THREE.Quaternion(), new THREE.Vector3(0.5, fh, 0.5)));
      }
    }
    g.add(instancedFrom(new THREE.BoxGeometry(1, 1, 1), concrete, colMats));
    // Partial walls on the lower floors and green safety netting on two faces.
    box(g, frameW, fh * Math.min(2, floors), 0.25, fx, 0.2 + fh * Math.min(2, floors) / 2, fz - frameD / 2, concrete);
    const net = new THREE.MeshStandardMaterial({ color: 0x2f8f4a, roughness: 0.9, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const netH = floors * fh + 1.5;
    const n1 = mesh(g, new THREE.PlaneGeometry(frameW + 1.2, netH), net, fx, 0.2 + netH / 2, fz + frameD / 2 + 0.6, { cast: false });
    n1.castShadow = false;
    mesh(g, new THREE.PlaneGeometry(frameD + 1.2, netH), net, fx + frameW / 2 + 0.6, 0.2 + netH / 2, fz, { cast: false }).rotation.y = Math.PI / 2;

    // Tower crane: lattice mast, rotating jib + counter-jib, trolley and hook.
    const cx = fx + frameW / 2 + 4, cz = fz + 1;
    const mastH = floors * fh + 16;
    const mastMats = [];
    lattice(mastMats, new THREE.Vector3(cx, 0.2, cz), new THREE.Vector3(cx, mastH, cz), 1.8, 'y');
    g.add(instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 5), yellow, mastMats));
    box(g, 4, 0.6, 4, cx, 0.5, cz, concrete);
    const slew = new THREE.Group();
    slew.userData.dynamic = true;
    slew.position.set(cx, mastH, cz);
    const jibLen = Math.min(32, Math.max(W, D) * 0.8);
    const jibMats = [];
    lattice(jibMats, new THREE.Vector3(-8, 1, 0), new THREE.Vector3(jibLen, 1, 0), 1.4, 'x');
    slew.add(instancedFrom(new THREE.CylinderGeometry(1, 1, 1, 5), yellow, jibMats));
    box(slew, 2.4, 2.2, 2.2, 0.8, -0.4, 1.8, colorMat(0xf4f4f4, { roughness: 0.5 })); // operator cab
    box(slew, 3, 2.4, 2, -7, 0.4, 0, concrete); // counterweight
    const apex = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 4), yellow);
    apex.position.set(0, 4.6, 0);
    slew.add(apex);
    const cable = new THREE.LineBasicMaterial({ color: 0x333333 });
    const tie = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8, 1.8, 0), new THREE.Vector3(0, 7.5, 0), new THREE.Vector3(jibLen * 0.7, 1.8, 0)]);
    slew.add(new THREE.Line(tie, cable));
    const trolley = new THREE.Group();
    box(trolley, 1.4, 0.4, 1.2, 0, 0, 0, sharedMaterial('darkSteel'));
    const hookLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]), cable);
    trolley.add(hookLine);
    const load = new THREE.Group();
    box(load, 4, 0.5, 0.6, 0, -0.5, 0, rebar);
    box(load, 0.5, 0.6, 0.5, 0, 0.1, 0, stripe);
    trolley.add(load);
    trolley.position.set(jibLen * 0.6, 0.4, 0);
    slew.add(trolley);
    g.add(slew);
    const red = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: red, intensity: 2, blink: true, always: true });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), red);
    beacon.position.set(0, 7.7, 0);
    slew.add(beacon);

    // Site offices (stacked containers), sand + gravel piles, a cement mixer.
    const officeColors = [0x2f6fb8, 0xf4f4f4, 0x2f6fb8];
    for (let i = 0; i < 3; i++) {
      const lvl = i === 2 ? 1 : 0;
      box(g, 6, 2.6, 2.4, -W / 2 + 4.5 + (i === 2 ? 0 : i * 6.4), 1.5 + lvl * 2.6, D / 2 - 3, colorMat(officeColors[i], { roughness: 0.6 }));
    }
    for (const [x, z, r, c] of [[px - pitW / 4, -D / 2 + 4, 2.6, 0xd8c08a], [px + pitW / 4, -D / 2 + 4, 2, 0x8f8f8f]]) {
      mesh(g, new THREE.ConeGeometry(r, r * 0.8, 14), colorMat(c, { roughness: 1 }), x, 0.2 + r * 0.4, z);
    }
    const mixer = new THREE.Group();
    box(mixer, 2.2, 1.2, 6, 0, 1.2, 0, colorMat(0xe23b3b, { roughness: 0.5 }));
    const drum = mesh(mixer, new THREE.CylinderGeometry(1.1, 0.8, 3.4, 14), colorMat(0xf2f2f2, { roughness: 0.5 }), 0, 2.6, -1);
    drum.rotation.x = Math.PI / 2 - 0.25;
    for (const z of [-2, 2]) for (const sx of [-1, 1]) {
      const w = mesh(mixer, new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), sharedMaterial('darkSteel'), sx * 1.1, 0.5, z);
      w.rotation.z = Math.PI / 2;
    }
    mixer.position.set(-W / 2 + 4, 0, D / 2 - 9.5);
    g.add(mixer);

    const seed = rng() * 10;
    g.userData.animate = (t) => {
      slew.rotation.y = Math.sin(t * 0.07 + seed) * 1.6;
      const tt = (Math.sin(t * 0.13 + seed) + 1) / 2;
      trolley.position.x = jibLen * (0.25 + tt * 0.65);
      const drop = 4 + (Math.sin(t * 0.21 + seed * 2) + 1) * 0.5 * (mastH - 12);
      load.position.y = -drop;
      hookLine.scale.y = drop;
    };
    g.userData.treeSpots = [];
    g.userData.height = mastH + 8;
    return g;
  },
  info(spec) {
    if (isFactoryLot(spec)) {
      return {
        category: '工厂 Factory',
        name: '南湾机械厂', nameEn: 'Nanwan Works',
        description: '南湾岛上的机械厂，离南瓜中心岛隔着一湾海水。锯齿厂房、两层办公楼、两座筒仓、烟囱和临街的装卸月台。',
      };
    }
    return {
      name: '建筑工地', nameEn: 'Construction Site',
      description: `正在建设中的新项目（地块约 ${Math.round(spec.size?.[0] || 40)}×${Math.round(spec.size?.[1] || 34)} 米），塔吊正在吊运钢筋。后续版本这里会出现新的建筑。`,
    };
  },
});
