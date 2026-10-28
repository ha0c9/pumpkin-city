// 科技馆 Science & Technology Museum — a mirrored dome theatre floating over a ring hall wrapped in parametric fins,
// orbited by LED rings, with a rocket and solar trees on the plaza.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, mergeSimple } from '../core/Utils.js';
import { curtainWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';
import { atomMobile } from './easterEggs.js';

const THREE = window.THREE;

registerBuilding('scienceMuseum', {
  label: '科技馆 Science Museum',
  footprint: [60, 60],
  create(ctx) {
    const g = new THREE.Group();
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 1, roughness: 0.08, envMapIntensity: 1.6 });
    const led = new THREE.MeshStandardMaterial({ color: 0x0b2a3a, emissive: 0x38d9ff, emissiveIntensity: 0.6, roughness: 0.3 });
    const ledViolet = new THREE.MeshStandardMaterial({ color: 0x1a0b3a, emissive: 0x8a6bff, emissiveIntensity: 0.5, roughness: 0.3 });
    ctx.nightMaterials.push({ material: led, intensity: 2.0, base: 0.6 });
    ctx.nightMaterials.push({ material: ledViolet, intensity: 1.6, base: 0.5 });
    const white = sharedMaterial('white');

    tiledBox(g, 60, 0.3, 60, 0, 0.15, 0, sharedMaterial('paving'), 0.5);
    // Light lines radiating across the plaza.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const strip = mesh(g, new THREE.BoxGeometry(0.25, 0.04, 9), led, Math.cos(a) * 24, 0.32, Math.sin(a) * 24, { cast: false });
      strip.rotation.y = -a + Math.PI / 2;
    }

    // Ring hall: glass drum with white parametric fins whose height follows a wave.
    const R = 20, hallH = 9;
    const glass = curtainWallMaterial(ctx, { cols: 48, rows: 3, seed: 101, tint: [38, 62, 84], mullion: '#e5eef4', litRatio: 0.55, repeatX: 2 });
    mesh(g, new THREE.CylinderGeometry(R, R, hallH, 64, 1, true), glass, 0, 0.3 + hallH / 2, 0);
    mesh(g, new THREE.CylinderGeometry(R + 0.6, R + 0.6, 0.8, 64), white, 0, 0.3 + hallH + 0.4, 0);
    const finParts = [];
    const N = 72;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      const h = hallH + 2 + Math.sin(a * 3) * 2.5 + Math.sin(a * 5 + 1) * 1.2;
      const fin = new THREE.BoxGeometry(0.35, h, 2.4);
      fin.rotateY(-a);
      fin.translate(Math.cos(a) * (R + 1.4), 0.3 + h / 2, Math.sin(a) * (R + 1.4));
      finParts.push(fin);
    }
    mesh(g, mergeSimple(finParts), white);
    // Entrance cut into the fins (front, +Z).
    box(g, 10, 4.5, 4, 0, 2.55, R + 1.2, colorMat(0x1b2733, { roughness: 0.3, metalness: 0.6 }));
    box(g, 11, 0.5, 6, 0, 5, R + 2.2, white);
    box(g, 9.6, 0.15, 0.1, 0, 4.6, R + 3.2, led, { cast: false });

    // Floating chrome sphere (dome theatre) on a slim tripod, ringed by LED orbits.
    const sphereY = hallH + 14;
    mesh(g, new THREE.SphereGeometry(10, 48, 32), chrome, 0, sphereY, 0);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      rod(g, new THREE.Vector3(Math.cos(a) * 9, 0.3 + hallH + 0.8, Math.sin(a) * 9), new THREE.Vector3(Math.cos(a) * 4, sphereY - 8.6, Math.sin(a) * 4), 0.45, white, 12);
    }
    const orbits = new THREE.Group();
    orbits.userData.dynamic = true;
    orbits.position.y = sphereY;
    const rings = [];
    for (const [r, tilt, mat] of [[13, 0.35, led], [14.5, -0.5, ledViolet], [16, 0.15, led]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 96), mat);
      ring.rotation.x = Math.PI / 2 + tilt;
      const pivot = new THREE.Group();
      pivot.add(ring);
      // A small satellite on each ring.
      const sat = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), mat);
      sat.position.set(r, 0, 0);
      ring.add(sat);
      orbits.add(pivot);
      rings.push(pivot);
    }
    g.add(orbits);
    // Antenna on top.
    rod(g, new THREE.Vector3(0, sphereY + 9.8, 0), new THREE.Vector3(0, sphereY + 15, 0), 0.12, sharedMaterial('steel'), 6);
    const beacon = mesh(g, new THREE.SphereGeometry(0.35, 10, 8), led, 0, sphereY + 15.2, 0, { cast: false });
    beacon.castShadow = false;

    // Sign wall.
    const signTex = textTexture(['科技馆', 'SCIENCE & TECHNOLOGY MUSEUM'], { width: 1024, height: 256, color: '#dff7ff', glow: '#38d9ff',
      font: 'bold 120px "PingFang SC","Microsoft YaHei",sans-serif', subFont: '600 48px "Helvetica Neue",Arial,sans-serif' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.5 });
    ctx.nightMaterials.push({ material: signMat, intensity: 1.2, base: 0.5 });
    box(g, 16, 3.4, 0.8, -14, 2, 27, colorMat(0x1b2733, { roughness: 0.3, metalness: 0.6 }));
    mesh(g, new THREE.PlaneGeometry(15, 3.2), signMat, -14, 2, 27.45, { cast: false });

    // Rocket exhibit.
    const rocket = new THREE.Group();
    mesh(rocket, new THREE.CylinderGeometry(1.2, 1.2, 14, 24), white, 0, 9, 0);
    mesh(rocket, new THREE.ConeGeometry(1.2, 4, 24), colorMat(0xe23b3b, { roughness: 0.4 }), 0, 18, 0);
    mesh(rocket, new THREE.CylinderGeometry(1.25, 1.25, 1, 24), colorMat(0x1b2733, { roughness: 0.4 }), 0, 13, 0);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      const fin = mesh(rocket, new THREE.BoxGeometry(0.2, 3.5, 2), colorMat(0xe23b3b, { roughness: 0.4 }), Math.cos(a) * 1.6, 3.5, Math.sin(a) * 1.6);
      fin.rotation.y = -a;
      mesh(rocket, new THREE.CylinderGeometry(0.6, 0.9, 1.6, 12), sharedMaterial('darkSteel'), Math.cos(a) * 0.5, 1.3, Math.sin(a) * 0.5);
    }
    rocket.position.set(21, 0.3, 21);
    g.add(rocket);

    // Solar trees: steel trunks with tilted photovoltaic leaves.
    const pv = new THREE.MeshStandardMaterial({ color: 0x1b2f5a, metalness: 0.7, roughness: 0.2 });
    for (const [x, z] of [[-24, -22], [24, -22], [-24, 14], [10, 26]]) {
      rod(g, new THREE.Vector3(x, 0.3, z), new THREE.Vector3(x, 6, z), 0.18, sharedMaterial('steel'), 8);
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + 0.4;
        const leaf = mesh(g, new THREE.BoxGeometry(2.4, 0.08, 1.6), pv, x + Math.cos(a) * 1.3, 5.6 + k * 0.4, z + Math.sin(a) * 1.3);
        leaf.rotation.set(0.35, -a, 0);
      }
    }

    const atom = atomMobile(g, 0, 1.7, 24.7);
    atom.scale.setScalar(1.25);
    g.userData.animate = (t) => {
      rings[0].rotation.y = t * 0.25;
      rings[1].rotation.y = -t * 0.18;
      rings[2].rotation.y = t * 0.12;
      atom.userData.tick(t);
    };
    g.userData.treeSpots = [[-27, -27], [27, -27], [-27, 27], [-27, 0], [27, 0]];
    g.userData.height = sphereY + 15;
    return g;
  },
});
