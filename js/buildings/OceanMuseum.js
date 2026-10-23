// 海洋博物馆 Ocean Museum — a great ocean liner moored in a reflecting basin; the bow points along local +X.
import { registerBuilding } from '../core/Registry.js';
import { textTexture, makeCanvas, canvasTexture } from '../core/Utils.js';
import { windowWallMaterial, sharedMaterial, colorMat, box, tiledBox, mesh, rod } from './materials.js';

const THREE = window.THREE;

/** Top-down hull outline (x along the ship, y across), pointed bow at +x, rounded stern at -x. */
function hullShape(L, B) {
  const s = new THREE.Shape();
  const h = L / 2, b = B / 2;
  s.moveTo(-h + b * 0.6, -b);
  s.lineTo(h * 0.45, -b);
  s.bezierCurveTo(h * 0.8, -b, h * 0.97, -b * 0.45, h, 0);
  s.bezierCurveTo(h * 0.97, b * 0.45, h * 0.8, b, h * 0.45, b);
  s.lineTo(-h + b * 0.6, b);
  s.bezierCurveTo(-h - b * 0.1, b, -h - b * 0.1, -b, -h + b * 0.6, -b);
  return s;
}

function hullGeometry(L, B, H, shrinkBottom = 0.82) {
  const geo = new THREE.ExtrudeGeometry(hullShape(L, B), { depth: H, bevelEnabled: false, curveSegments: 18 });
  geo.rotateX(-Math.PI / 2);
  // Flare: narrower at the keel, full beam at the deck.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = shrinkBottom + (1 - shrinkBottom) * (p.getY(i) / H);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function hullTexture(name) {
  const c = makeCanvas(2048, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#16324f'; x.fillRect(0, 0, 2048, 256);
  x.fillStyle = '#b22f2a'; x.fillRect(0, 214, 2048, 42);
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 2048, 10);
  x.fillStyle = '#d7e7f2';
  for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(40 + i * 33.5, 70, 7, 0, Math.PI * 2); x.fill(); }
  x.font = 'bold 76px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(name, 1024, 150);
  return canvasTexture(c, { anisotropy: 8 });
}

registerBuilding('oceanMuseum', {
  label: '博物馆 Museum',
  footprint: [74, 26],
  create(ctx) {
    const g = new THREE.Group();
    const white = sharedMaterial('white');
    const L = 64, B = 15;

    // Reflecting basin the ship "floats" in, with a stone rim.
    tiledBox(g, 74, 0.5, 26, 0, 0.25, 0, sharedMaterial('stoneDark'), 0.25);
    box(g, 71, 0.2, 23, 0, 0.45, 0, sharedMaterial('water'), { cast: false });

    // Hull: dark lower hull with portholes + red boot top, white upper hull.
    const hullTex = hullTexture('海洋博物馆   OCEAN MUSEUM');
    hullTex.wrapS = THREE.RepeatWrapping;
    const hullMat = new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.5, metalness: 0.2 });
    const lower = new THREE.Mesh(hullGeometry(L, B, 7.5), hullMat);
    // Map the texture around the hull sides by projecting along X.
    const lp = lower.geometry.attributes.position, luv = lower.geometry.attributes.uv;
    for (let i = 0; i < lp.count; i++) luv.setXY(i, (lp.getX(i) / L + 0.5) * (lp.getZ(i) >= 0 ? 1 : -1), lp.getY(i) / 7.5);
    lower.position.y = 0.2;
    lower.castShadow = true; lower.receiveShadow = true;
    g.add(lower);
    const upper = mesh(g, hullGeometry(L * 0.985, B, 2.6, 1), white, 0, 7.7, 0);
    upper.scale.set(1, 1, 1);
    mesh(g, new THREE.ShapeGeometry(hullShape(L * 0.97, B * 0.97)).rotateX(-Math.PI / 2), colorMat(0xb88a5a, { roughness: 0.8 }), 0, 10.32, 0, { cast: false });

    // Superstructure: stepped decks with glass promenades.
    const deckA = windowWallMaterial(ctx, { cols: 16, rows: 2, wall: 'concrete', frame: '#ffffff', glass: '#20435c', seed: 31, winW: 0.8, winH: 0.55, litRatio: 0.7 });
    const deckB = windowWallMaterial(ctx, { cols: 4, rows: 2, wall: 'concrete', frame: '#ffffff', glass: '#20435c', seed: 32, winW: 0.8, winH: 0.55, litRatio: 0.7 });
    for (const m of [deckA, deckB]) m.color.set(0xffffff);
    const decks = [[40, 11, -6, 5], [30, 9.5, -7, 4.2], [18, 8, -8, 3.6]];
    let y = 10.4;
    for (const [w, d, x, h] of decks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [deckB, deckB, white, white, deckA, deckA]);
      m.position.set(x, y + h / 2, 0);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      box(g, w + 1.2, 0.25, d + 1.2, x, y + h, 0, white);
      y += h + 0.25;
    }
    // Bridge with wraparound windows at the front of the top deck.
    const bridgeGlass = new THREE.MeshStandardMaterial({ color: 0x1b3346, metalness: 0.8, roughness: 0.1, emissive: 0x9fd8ff, emissiveIntensity: 0 });
    ctx.nightMaterials.push({ material: bridgeGlass, intensity: 0.5 });
    box(g, 6, 3, 13, 5, y + 1.5, 0, white);
    box(g, 0.3, 1.4, 12.6, 8.05, y + 1.8, 0, bridgeGlass);
    for (const sz of [-1, 1]) box(g, 5.6, 1.4, 0.3, 5, y + 1.8, sz * 6.55, bridgeGlass);
    const bridgeTop = y + 3;

    // Twin funnels: white with a sea-blue band and black top, slightly raked.
    for (const fx of [-6, -15]) {
      const f = mesh(g, new THREE.CylinderGeometry(2.1, 2.6, 8, 24), white, fx, y + 4, 0);
      f.scale.z = 0.7;
      f.rotation.z = 0.12;
      const band = mesh(g, new THREE.CylinderGeometry(2.16, 2.3, 1.6, 24), colorMat(0x1e7fb8, { roughness: 0.5 }), fx + 0.32, y + 6, 0);
      band.scale.z = 0.7; band.rotation.z = 0.12;
      const capM = mesh(g, new THREE.CylinderGeometry(2.08, 2.12, 1.2, 24), colorMat(0x1a1a1a, { roughness: 0.6 }), fx + 0.5, y + 7.6, 0);
      capM.scale.z = 0.7; capM.rotation.z = 0.12;
    }

    // Masts, rigging lines with signal flags, lifeboats, bow railing.
    const steel = sharedMaterial('darkSteel');
    const foreMast = new THREE.Vector3(22, 10.4, 0), aftMast = new THREE.Vector3(-26, 10.4, 0);
    rod(g, foreMast, foreMast.clone().setY(24), 0.18, steel);
    rod(g, new THREE.Vector3(1, bridgeTop, 0), new THREE.Vector3(1, bridgeTop + 9, 0), 0.15, steel);
    rod(g, aftMast, aftMast.clone().setY(20), 0.16, steel);
    rod(g, new THREE.Vector3(31, 10.4, 0), foreMast.clone().setY(24), 0.03, steel, 4);
    rod(g, foreMast.clone().setY(24), new THREE.Vector3(1, bridgeTop + 9, 0), 0.03, steel, 4);
    rod(g, new THREE.Vector3(1, bridgeTop + 9, 0), aftMast.clone().setY(20), 0.03, steel, 4);
    const flagColors = [0xe23b3b, 0xf6c344, 0x2a6fd6, 0xffffff, 0x2e9a4a];
    const flagGeo = new THREE.PlaneGeometry(0.9, 0.7);
    const flagMats = flagColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }));
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14;
      const p = new THREE.Vector3(31, 10.4, 0).lerp(foreMast.clone().setY(24), t);
      mesh(g, flagGeo, flagMats[i % flagMats.length], p.x, p.y - 0.4, 0, { cast: false });
    }
    for (let i = 0; i < 4; i++) {
      for (const sz of [-1, 1]) {
        const boat = mesh(g, new THREE.CylinderGeometry(0.8, 0.8, 4.4, 10), colorMat(0xf07b1f, { roughness: 0.6 }), -20 + i * 7, 13.6, sz * 6.4);
        boat.rotation.z = Math.PI / 2;
        boat.scale.set(1, 1, 0.75);
      }
    }
    for (const sz of [-1, 1]) box(g, L - 8, 0.08, 0.08, -2, 11.4, sz * (B / 2 - 0.3), steel, { cast: false });

    // Anchor on the bow and the museum entrance gangway.
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.18, 8, 16, Math.PI), steel);
    const az = B / 2 * 0.95 + 0.15;
    anchor.position.set(14, 5, az);
    anchor.rotation.z = Math.PI;
    g.add(anchor);
    rod(g, new THREE.Vector3(14, 4.1, az), new THREE.Vector3(14, 7, az), 0.15, steel);
    const ramp = mesh(g, new THREE.BoxGeometry(4, 0.3, 7), white, -4, 2.4, 10);
    ramp.rotation.x = 0.55;
    const portal = new THREE.MeshStandardMaterial({ color: 0x0b2236, emissive: 0x6fd0ff, emissiveIntensity: 0.15 });
    ctx.nightMaterials.push({ material: portal, intensity: 0.8, base: 0.15 });
    box(g, 3.6, 3, 0.2, -4, 5.7, 7.35, portal);

    // Whale-tail sculpture rising from the basin at the stern.
    const tail = new THREE.Shape();
    tail.moveTo(0, 0); tail.bezierCurveTo(-0.6, 2.5, -1, 4.5, -4.2, 6.4); tail.bezierCurveTo(-2.4, 6.2, -1.2, 6.2, 0, 5.4);
    tail.bezierCurveTo(1.2, 6.2, 2.4, 6.2, 4.2, 6.4); tail.bezierCurveTo(1, 4.5, 0.6, 2.5, 0, 0);
    const tailMesh = mesh(g, new THREE.ExtrudeGeometry(tail, { depth: 0.8, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2 }), colorMat(0x3c5a73, { roughness: 0.35, metalness: 0.3 }), -34.5, 0.4, -2);
    tailMesh.rotation.y = Math.PI / 2;

    g.userData.treeSpots = [];
    g.userData.height = 24;
    return g;
  },
});
