// 天文馆 Planetarium — a streamlined silver hall whose west end lifts into a pointed prow, a geodesic dome
// theater resting on its roof, and a truss sky bridge (廊桥) to a second sphere, the observatory.
// At night both spheres light up with star maps.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture, textTexture, mulberry32 } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, tiledBox, box, mesh, rod } from './materials.js';

const THREE = window.THREE;

// Hall profile along local x: [x, top, bottom, halfDepth]. The bottom lifts off the ground at the prow.
const PROFILE = [
  [-57, 21.5, 21.5, 0], [-55, 21.5, 19.5, 2.5], [-50, 20.5, 13, 6.5], [-44, 19, 6, 10], [-38, 17.5, 1.5, 12.5],
  [-33, 16.5, 0, 14], [-24, 15.5, 0, 15], [-10, 15.6, 0, 15], [2, 15.2, 0, 15], [10, 14, 0, 14.4],
  [15, 12.2, 0, 13], [19, 9.4, 0, 10.6], [21.5, 6, 0, 7.2], [23, 0, 0, 0],
];

function sampleProfile(x) {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1], b = PROFILE[i];
    if (x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      const s = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
      return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
    }
  }
  const l = PROFILE[PROFILE.length - 1];
  return [l[1], l[2], l[3]];
}

/** Lofted superellipse sections along the profile. */
function hallGeometry(segX = 90, segR = 40, e = 0.55) {
  const x0 = PROFILE[0][0], x1 = PROFILE[PROFILE.length - 1][0];
  const pos = [], uv = [], idx = [];
  const sp = (v, k) => Math.sign(v) * Math.pow(Math.abs(v), k);
  for (let i = 0; i <= segX; i++) {
    const x = x0 + (x1 - x0) * i / segX;
    const [top, bot0, w] = sampleProfile(x);
    const bot = bot0 <= 0.01 ? -0.6 : bot0;
    const mid = (top + bot) / 2, hh = (top - bot) / 2;
    for (let j = 0; j <= segR; j++) {
      const th = j / segR * Math.PI * 2;
      pos.push(x, mid + hh * sp(Math.sin(th), e), w * sp(Math.cos(th), e));
      uv.push(i / segX, j / segR);
    }
  }
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < segR; j++) {
      const a = i * (segR + 1) + j, b = a + segR + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hall skin over the loft UVs (u = along the hall, v = around the section): longitudinal panel seams and
 * a glazed ribbon low on the front and back walls, lit at night through the emissive map.
 */
function hallTextures() {
  const w = 2048, h = 512;
  const color = makeCanvas(w, h), emis = makeCanvas(w, h);
  const c = color.getContext('2d'), e = emis.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#dfe5eb'); g.addColorStop(0.5, '#f1f4f7'); g.addColorStop(1, '#dfe5eb');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(70,80,95,0.4)'; c.lineWidth = 2;
  for (let j = 0; j <= 48; j++) { c.beginPath(); c.moveTo(0, j * h / 48); c.lineTo(w, j * h / 48); c.stroke(); }
  c.strokeStyle = 'rgba(70,80,95,0.18)';
  for (let i = 0; i <= 40; i++) { c.beginPath(); c.moveTo(i * w / 40, 0); c.lineTo(i * w / 40, h); c.stroke(); }
  const x0 = PROFILE[0][0], x1 = PROFILE[PROFILE.length - 1][0];
  const u = (x) => (x - x0) / (x1 - x0) * w;
  // Canvas rows run top-down while v runs bottom-up (flipY).
  for (const [v0, v1] of [[0.915, 0.972], [0.528, 0.585]]) {
    const ra = u(-32), rb = u(14), y0 = (1 - v1) * h, hh = (v1 - v0) * h;
    c.fillStyle = '#2a3b4c'; c.fillRect(ra, y0, rb - ra, hh);
    c.fillStyle = '#cfd6de';
    for (let x = ra; x < rb; x += 22) c.fillRect(x, y0, 3, hh);
    e.fillStyle = 'rgb(255,214,150)'; e.fillRect(ra, y0, rb - ra, hh);
  }
  return { map: canvasTexture(color, { anisotropy: 8 }), emissiveMap: canvasTexture(emis) };
}

function starTexture(seed) {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  const rng = mulberry32(seed);
  for (let i = 0; i < 900; i++) {
    const r = rng() < 0.08 ? 2.2 : 1.1;
    x.fillStyle = `rgba(${200 + rng() * 55},${215 + rng() * 40},255,${0.5 + rng() * 0.5})`;
    x.beginPath(); x.arc(rng() * w, h * 0.08 + rng() * h * 0.84, r, 0, Math.PI * 2); x.fill();
  }
  // A few constellation lines.
  x.strokeStyle = 'rgba(120,180,255,0.55)'; x.lineWidth = 1.5;
  for (let k = 0; k < 10; k++) {
    let px = rng() * w, py = h * 0.2 + rng() * h * 0.6;
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 4; s++) { px += (rng() - 0.5) * 90; py += (rng() - 0.5) * 60; x.lineTo(px, py); }
    x.stroke();
  }
  return canvasTexture(c);
}

function geodesic(g, r, x, y, z, material, lineMat) {
  const geo = new THREE.IcosahedronGeometry(r, 3);
  const m = mesh(g, geo, material, x, y, z);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat);
  lines.position.set(x, y, z);
  lines.scale.setScalar(1.003);
  g.add(lines);
  return m;
}

registerBuilding('planetarium', {
  label: '天文馆 Planetarium',
  footprint: [116, 40],
  create(ctx) {
    const g = new THREE.Group();
    const steel = sharedMaterial('steel');
    const darkSteel = sharedMaterial('darkSteel');
    tiledBox(g, 116, 0.3, 40, 0, 0.15, 0, sharedMaterial('paving'), 0.4);

    // Main hall.
    const { map: skinMap, emissiveMap: skinGlow } = hallTextures();
    const skin = new THREE.MeshStandardMaterial({ map: skinMap, emissiveMap: skinGlow, emissive: 0xffffff, emissiveIntensity: 0, metalness: 0.6, roughness: 0.3, envMapIntensity: 1.1 });
    ctx.nightMaterials.push({ material: skin, intensity: 0.9 });
    mesh(g, hallGeometry(), skin);
    // Entrance portal under the dome with the name above it.
    const portalGlass = curtainWallMaterial(ctx, { cols: 4, rows: 1, seed: 102, tint: [50, 70, 90], litRatio: 1 });
    const portal = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 3), [darkSteel, darkSteel, darkSteel, darkSteel, portalGlass, portalGlass]);
    portal.position.set(-18, 2.75, 15.2); portal.castShadow = true; g.add(portal);
    box(g, 10.4, 0.6, 3.8, -18, 5.8, 15.4, steel);
    const nameTex = textTexture(['天 文 馆', 'PLANETARIUM'], { width: 1024, height: 256, color: '#1e2a3a', subFont: '600 54px Arial, sans-serif' });
    box(g, 16, 3, 0.6, -18, 9.2, 15.15, colorMat(0xf4f6f8, { roughness: 0.5 }));
    mesh(g, new THREE.PlaneGeometry(15, 2.8), new THREE.MeshStandardMaterial({ map: nameTex, transparent: true }), -18, 9.2, 15.47, { cast: false });

    // Dome theater on the roof.
    const lineMat = new THREE.LineBasicMaterial({ color: 0x55606e, transparent: true, opacity: 0.6 });
    const starsA = starTexture(7);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.45, roughness: 0.32, emissive: 0x9fc8ff, emissiveMap: starsA, emissiveIntensity: 0, flatShading: true });
    ctx.nightMaterials.push({ material: domeMat, intensity: 2.2 });
    geodesic(g, 14, -18, 23, 0, domeMat, lineMat);
    mesh(g, new THREE.CylinderGeometry(11.5, 12.5, 2, 40), steel, -18, 15.2, 0);

    // 廊桥: glazed truss bridge to the observatory sphere.
    const bx0 = 18.5, bx1 = 33, by = 5.4, L = bx1 - bx0, cx = (bx0 + bx1) / 2;
    const bridgeGlass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, metalness: 0.8, roughness: 0.08, transparent: true, opacity: 0.5, emissive: 0xffe2b0, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: bridgeGlass, intensity: 0.7 });
    box(g, L, 3.4, 3.8, cx, by, 0, bridgeGlass, { cast: false });
    box(g, L, 0.4, 4.4, cx, by - 1.9, 0, steel);
    for (const sz of [-2.2, 2.2]) {
      rod(g, new THREE.Vector3(bx0, by + 1.9, sz), new THREE.Vector3(bx1, by + 1.9, sz), 0.2, steel, 6);
      rod(g, new THREE.Vector3(bx0, by - 1.9, sz), new THREE.Vector3(bx1, by - 1.9, sz), 0.2, steel, 6);
      const n = 4;
      for (let k = 0; k < n; k++) {
        const xa = bx0 + L * k / n, xb = bx0 + L * (k + 0.5) / n, xc = bx0 + L * (k + 1) / n;
        rod(g, new THREE.Vector3(xa, by - 1.9, sz), new THREE.Vector3(xb, by + 1.9, sz), 0.16, steel, 6);
        rod(g, new THREE.Vector3(xb, by + 1.9, sz), new THREE.Vector3(xc, by - 1.9, sz), 0.16, steel, 6);
      }
    }

    // Observatory sphere with a round porthole.
    const starsB = starTexture(13);
    const obsMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.5, roughness: 0.3, emissive: 0xb0d0ff, emissiveMap: starsB, emissiveIntensity: 0, flatShading: true });
    ctx.nightMaterials.push({ material: obsMat, intensity: 1.8 });
    geodesic(g, 13, 45, 12, 0, obsMat, lineMat);
    mesh(g, new THREE.CylinderGeometry(9.5, 10.5, 1.2, 36), sharedMaterial('concrete'), 45, 0.6, 0);
    const porthole = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: 0.7, roughness: 0.1, emissive: 0xffd28a, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: porthole, intensity: 1.6 });
    const pdir = new THREE.Vector3(0.55, 0.25, 0.8).normalize();
    const pc = new THREE.Vector3(45, 12, 0).addScaledVector(pdir, 13.05);
    const disk = mesh(g, new THREE.CircleGeometry(2.4, 32), porthole, pc.x, pc.y, pc.z, { cast: false });
    disk.lookAt(pc.clone().add(pdir));
    const rim = mesh(g, new THREE.TorusGeometry(2.5, 0.28, 8, 32), steel, pc.x, pc.y, pc.z, { cast: false });
    rim.lookAt(pc.clone().add(pdir));
    // Telescope slit on top of the observatory.
    for (const dx of [-0.9, 0.9]) {
      const arc = mesh(g, new THREE.TorusGeometry(13.1, 0.35, 6, 32, Math.PI * 0.7), darkSteel, 45 + dx, 12, 0, { cast: false });
      arc.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
    }

    // Planet walk along the front plaza.
    const planets = [[0.45, 0x9a8f86], [0.7, 0xe0c38a], [0.75, 0x3d7fd1], [0.55, 0xc1502e], [1.5, 0xd8a77a], [1.3, 0xe8d09a], [1.0, 0x8fd3e0], [0.95, 0x4166d5]];
    planets.forEach(([r, col], i) => {
      const x = -50 + i * 8.5, z = 18;
      mesh(g, new THREE.CylinderGeometry(0.5, 0.6, 1.2, 12), sharedMaterial('stoneDark'), x, 0.9, z);
      mesh(g, new THREE.SphereGeometry(r, 20, 14), colorMat(col, { roughness: 0.6 }), x, 1.5 + r, z);
      if (i === 5) {
        const ring = mesh(g, new THREE.RingGeometry(r * 1.4, r * 2.1, 32), new THREE.MeshStandardMaterial({ color: 0xd9c79a, side: THREE.DoubleSide, roughness: 0.7 }), x, 1.5 + r, z, { cast: false });
        ring.rotation.x = -Math.PI / 2 + 0.4;
      }
    });

    // After dark the spheres turn deep navy so their star maps read like a night sky.
    const day = new THREE.Color(0xf2f5f8), night = new THREE.Color(0x101a30), obsDay = new THREE.Color(0xdfe6ee);
    const uNight = ctx.uniforms.uNight;
    g.userData.animate = () => {
      const k = uNight.value;
      domeMat.color.copy(day).lerp(night, k);
      obsMat.color.copy(obsDay).lerp(night, k);
      domeMat.metalness = obsMat.metalness = 0.45 - 0.3 * k;
    };

    g.userData.treeSpots = [[-56, -17], [-40, -18], [-2, -18], [14, -18], [56, -17], [56, 17], [30, 17], [-56, 12]];
    g.userData.height = 38;
    return g;
  },
});
