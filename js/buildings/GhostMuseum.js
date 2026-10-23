// 幽灵博物馆 Ghost Museum — twisted obsidian tower with glowing seams, orbiting shards and ghosts that drift at night.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture, mulberry32 } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, mesh } from './materials.js';

const THREE = window.THREE;

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

/** Sheet-ghost body: lathe profile with a wavy hem. */
function ghostGeometry() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = 2.4 - t * 2.6;
    const r = t < 0.45 ? Math.sin(t / 0.45 * Math.PI / 2) * 0.85 : 0.85 + (t - 0.45) * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts.reverse(), 20);
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

registerBuilding('ghostMuseum', {
  label: '博物馆 Museum',
  footprint: [46, 46],
  create(ctx, spec) {
    const g = new THREE.Group();
    const rng = mulberry32(666);
    const obsidian = new THREE.MeshStandardMaterial({ color: 0x0d0b12, metalness: 0.4, roughness: 0.32, envMapIntensity: 0.55 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x2a0f3a, emissive: 0x9b4dff, emissiveIntensity: 0.6, roughness: 0.4 });
    const glowGreen = new THREE.MeshStandardMaterial({ color: 0x0d2a20, emissive: 0x3dffb0, emissiveIntensity: 0.5, roughness: 0.4 });
    ctx.nightMaterials.push({ material: glow, intensity: 1.8, base: 0.6 });
    ctx.nightMaterials.push({ material: glowGreen, intensity: 1.6, base: 0.5 });

    // Black plaza with glowing rune rings.
    box(g, 46, 0.3, 46, 0, 0.15, 0, colorMat(0x1d1b22, { roughness: 0.6, metalness: 0.05 }), { cast: false });
    for (const r of [19, 21.5]) {
      const ring = mesh(g, new THREE.RingGeometry(r, r + 0.35, 96), glowGreen, 0, 0.33, 0, { cast: false });
      ring.rotation.x = -Math.PI / 2;
    }

    // Twisted tower: stacked slabs rotating and tapering, separated by glowing seams.
    const floors = 16, slabH = 2.3;
    let y = 0.3;
    for (let i = 0; i < floors; i++) {
      const t = i / (floors - 1);
      const s = 17 * (1 - t * 0.45) * (1 + Math.sin(t * Math.PI) * 0.12);
      const rot = t * Math.PI * 0.75;
      const slab = mesh(g, new THREE.BoxGeometry(s, slabH, s), obsidian, 0, y + slabH / 2, 0);
      slab.rotation.y = rot;
      const seam = mesh(g, new THREE.BoxGeometry(s * 0.96, 0.32, s * 0.96), i % 4 === 3 ? glowGreen : glow, 0, y + slabH + 0.16, 0, { cast: false });
      seam.rotation.y = rot + 0.03;
      y += slabH + 0.32;
    }
    // Crown: shattered spire.
    const spire = mesh(g, new THREE.ConeGeometry(4.2, 14, 4, 1), obsidian, 0, y + 7, 0);
    spire.rotation.y = Math.PI * 0.8;
    const core = mesh(g, new THREE.OctahedronGeometry(1.6), glow, 0, y + 16.5, 0, { cast: false });
    core.userData.dynamic = true;
    const top = y + 18;

    // Leaning blades around the base (the "claws" of the building).
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      const blade = mesh(g, new THREE.BoxGeometry(1.2, 22, 4.5), obsidian, Math.cos(a) * 13.5, 9, Math.sin(a) * 13.5);
      blade.rotation.set(0, -a, 0);
      blade.rotateZ(0.32);
      const edge = mesh(g, new THREE.BoxGeometry(0.25, 21, 0.25), glow, 0, 0, 2.3, { cast: false });
      blade.add(edge);
    }

    // Entrance: a crooked gothic arch with a glowing sign.
    const arch = new THREE.Shape();
    arch.moveTo(-4, 0); arch.lineTo(-4, 6); arch.quadraticCurveTo(-3.2, 10.5, 0, 12.5); arch.quadraticCurveTo(3.2, 10.5, 4, 6); arch.lineTo(4, 0);
    arch.lineTo(2.6, 0); arch.lineTo(2.6, 6); arch.quadraticCurveTo(2, 9, 0, 10.6); arch.quadraticCurveTo(-2, 9, -2.6, 6); arch.lineTo(-2.6, 0);
    const archMesh = mesh(g, new THREE.ExtrudeGeometry(arch, { depth: 1.4, bevelEnabled: false }), obsidian, 0, 0.3, 14);
    archMesh.rotation.z = 0.04;
    const doorGlow = mesh(g, new THREE.PlaneGeometry(5.2, 6), glowGreen, 0, 3.3, 14.1, { cast: false });
    doorGlow.castShadow = false;
    const signTex = textTexture(['幽灵博物馆', 'GHOST MUSEUM'], { width: 1024, height: 256, color: '#c8ffe6', glow: '#3dffb0',
      font: 'bold 110px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",serif', subFont: '600 60px Georgia,serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.6 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.4, base: 0.6 });
    const sign = mesh(g, new THREE.PlaneGeometry(12, 3), signMat, 0, 1.8, 20.5, { cast: false });
    sign.position.y = 2.2;
    box(g, 12.6, 0.6, 1.2, 0, 0.6, 20.3, obsidian);

    // Graveyard-style lanterns around the plaza.
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.31;
      const r = 20.2;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      if (pz > 15 && Math.abs(px) < 7) continue;
      mesh(g, new THREE.BoxGeometry(0.5, 2.4, 0.5), sharedMaterial('darkSteel'), px, 1.5, pz);
      mesh(g, new THREE.OctahedronGeometry(0.42), glowGreen, px, 3.0, pz, { cast: false });
    }

    // Floating shards orbiting the tower.
    const shardGroup = new THREE.Group();
    shardGroup.userData.dynamic = true;
    const shards = [];
    for (let i = 0; i < 22; i++) {
      const s = mesh(shardGroup, new THREE.TetrahedronGeometry(0.6 + rng() * 1.4), rng() < 0.3 ? glow : obsidian, 0, 0, 0);
      shards.push({ m: s, a: rng() * Math.PI * 2, r: 13 + rng() * 9, h: 6 + rng() * (top - 10), sp: 0.08 + rng() * 0.12, ph: rng() * 10 });
    }
    g.add(shardGroup);

    // Ghosts: translucent sheets with eyes, faint by day and luminous at night.
    const ghostMat = new THREE.MeshStandardMaterial({ color: 0xeef6ff, map: ghostTexture(), transparent: true, opacity: 0.35, depthWrite: false,
      emissive: 0xbfe6ff, emissiveIntensity: 0.2, roughness: 0.6, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101018 });
    const ghostGeo = ghostGeometry();
    const ghosts = [];
    for (let i = 0; i < 7; i++) {
      const gh = new THREE.Group();
      gh.userData.dynamic = true;
      const body = new THREE.Mesh(ghostGeo, ghostMat);
      body.renderOrder = 5;
      gh.add(body);
      for (const ex of [-0.28, 0.28]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), eyeMat);
        eye.position.set(ex, 1.75, 0.74);
        eye.scale.set(1, 1.5, 0.5);
        gh.add(eye);
      }
      gh.scale.setScalar(1.2 + rng() * 0.8);
      g.add(gh);
      ghosts.push({ g: gh, a: rng() * Math.PI * 2, r: 15 + rng() * 10, h: 2 + rng() * 26, sp: (rng() < 0.5 ? -1 : 1) * (0.15 + rng() * 0.2), ph: rng() * 10 });
    }

    const uNight = ctx.uniforms.uNight;
    g.userData.animate = (t) => {
      core.rotation.y = t * 0.8; core.rotation.x = t * 0.5;
      core.position.y = top - 1.5 + Math.sin(t * 1.3) * 0.6;
      for (const s of shards) {
        const a = s.a + t * s.sp;
        s.m.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 0.7 + s.ph) * 1.2, Math.sin(a) * s.r);
        s.m.rotation.set(t * 0.4 + s.ph, t * 0.3, 0);
      }
      const n = uNight.value;
      ghostMat.opacity = 0.18 + n * 0.55;
      ghostMat.emissiveIntensity = 0.15 + n * 0.9;
      for (const gh of ghosts) {
        const a = gh.a + t * gh.sp;
        const r = gh.r + Math.sin(t * 0.5 + gh.ph) * 3;
        gh.g.position.set(Math.cos(a) * r, gh.h + Math.sin(t * 1.1 + gh.ph) * 1.4, Math.sin(a) * r);
        gh.g.rotation.y = -a + (gh.sp > 0 ? 0 : Math.PI);
        gh.g.rotation.z = Math.sin(t * 1.7 + gh.ph) * 0.15;
      }
    };

    g.userData.height = top;
    g.userData.treeSpots = [[-21, -21], [21, -21], [-21, 8], [21, 8]];
    return g;
  },
});
