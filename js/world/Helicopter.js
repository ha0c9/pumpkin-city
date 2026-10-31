// Medical helicopter. Origin is the bottom of the skids; local +Z is forward.
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { box, mesh } from '../buildings/materials.js';

const THREE = window.THREE;

function crossMap() {
  const s = 128;
  const c = makeCanvas(s, s);
  const x = c.getContext('2d');
  x.fillStyle = '#f4f7f6';
  x.fillRect(0, 0, s, s);
  x.fillStyle = '#d0121a';
  const arm = s * 0.3;
  x.fillRect((s - arm) / 2, s * 0.1, arm, s * 0.8);
  x.fillRect(s * 0.1, (s - arm) / 2, s * 0.8, arm);
  return canvasTexture(c, { anisotropy: 4 });
}

export function createHelicopter() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f7f6, roughness: 0.45, metalness: 0.25 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd0121a, roughness: 0.4, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.4, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ec9dc, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.55 });
  const map = crossMap();
  const cross = new THREE.MeshStandardMaterial({ map, roughness: 0.45 });

  box(g, 1.7, 1.45, 3.4, 0, 1.55, 0.35, white);
  box(g, 1.55, 0.9, 1.15, 0, 1.7, 2.15, glass, { cast: false });
  box(g, 1.75, 0.16, 3.6, 0, 1.15, 0.2, red);
  box(g, 0.55, 0.42, 4.1, 0, 1.55, -3.5, white);
  box(g, 0.12, 1.15, 0.7, 0, 2.15, -5.4, white);
  box(g, 1.15, 0.1, 0.35, 0, 1.7, -5.45, white);
  for (const x of [-0.7, 0.7]) {
    box(g, 0.08, 0.45, 0.08, x, 0.55, 1.3, dark);
    box(g, 0.08, 0.45, 0.08, x, 0.55, -0.7, dark);
    box(g, 0.08, 0.08, 3.1, x, 0.28, 0.3, dark);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), cross);
  door.position.set(0.87, 1.6, 0.15);
  door.rotation.y = Math.PI / 2;
  g.add(door);

  const rotor = new THREE.Group();
  rotor.position.set(0, 2.4, 0.2);
  mesh(rotor, new THREE.CylinderGeometry(0.12, 0.16, 0.35, 8), dark, 0, 0.1, 0);
  const bladeGeo = new THREE.BoxGeometry(0.22, 0.05, 4.4);
  bladeGeo.translate(0, 0, 2.2);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.position.y = 0.28;
    blade.rotation.y = (i / 4) * Math.PI * 2;
    blade.castShadow = true;
    rotor.add(blade);
  }
  g.add(rotor);

  const tail = new THREE.Group();
  tail.position.set(0.28, 1.7, -5.45);
  for (let i = 0; i < 2; i++) {
    const blade = box(tail, 0.08, 0.9, 0.08, 0, 0, 0, dark);
    blade.rotation.z = i * Math.PI / 2;
  }
  g.add(tail);

  const beacon = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 0.4 });
  mesh(g, new THREE.SphereGeometry(0.12, 8, 6), beacon, 0, 2.15, -5.35, { cast: false });
  g.userData.rotor = rotor;
  g.userData.tailRotor = tail;
  g.userData.beacon = beacon;
  return g;
}
