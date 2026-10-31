// Shared ambulance: white high-roof van, red stripe, red crosses, twin roof lamps.
// Local +Z is forward. Traffic instances the geometries; the hospital parks full groups.
import { makeCanvas, canvasTexture, mergeColored, mergeSimple } from '../core/Utils.js';

const THREE = window.THREE;

export const AMBULANCE_LENGTH = 5.5;
export const AMBULANCE_WIDTH = 2.1;

const RED = 0xd0121a;
const WHITE = 0xf7f8f6;
const GLASS = 0x26323d;

let crossMap;
let bodyGeo;
let signGeo;
let bodyMat;
let crossMat;
let lampMatL;
let lampMatR;

export function redCrossMap() {
  if (crossMap) return crossMap;
  const s = 256;
  const c = makeCanvas(s, s);
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, s, s);
  x.fillStyle = '#d0121a';
  const arm = s * 0.3;
  x.fillRect((s - arm) / 2, s * 0.1, arm, s * 0.8);
  x.fillRect(s * 0.1, (s - arm) / 2, s * 0.8, arm);
  crossMap = canvasTexture(c, { anisotropy: 4 });
  return crossMap;
}

function addBox(parts, w, h, d, x, y, z, color) {
  parts.push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: new THREE.Matrix4().makeTranslation(x, y, z), color });
}

export function ambulanceBodyGeometry() {
  if (bodyGeo) return bodyGeo;
  const parts = [];
  const L = AMBULANCE_LENGTH, W = AMBULANCE_WIDTH;
  const y0 = 0.38;
  const wheel = (x, z) => {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
    g.rotateZ(Math.PI / 2);
    parts.push({ geometry: g, matrix: new THREE.Matrix4().makeTranslation(x, 0.36, z), color: 0x1a1a1a });
  };
  addBox(parts, W, 0.42, L, 0, y0 + 0.21, 0, WHITE);
  const boxH = 1.45, boxL = 3.25, boxZ = -0.72;
  addBox(parts, W, boxH, boxL, 0, y0 + 0.42 + boxH / 2, boxZ, WHITE);
  const cabH = 0.95, cabL = 1.85, cabZ = 1.35;
  addBox(parts, W - 0.06, cabH, cabL, 0, y0 + 0.42 + cabH / 2, cabZ, WHITE);
  addBox(parts, W - 0.28, 0.62, 0.06, 0, y0 + 0.98, cabZ + cabL / 2 - 0.04, GLASS);
  addBox(parts, 0.05, 0.42, 1.05, W / 2 - 0.02, y0 + 1.05, cabZ + 0.1, GLASS);
  addBox(parts, 0.05, 0.42, 1.05, -W / 2 + 0.02, y0 + 1.05, cabZ + 0.1, GLASS);
  addBox(parts, W + 0.05, 0.16, L - 0.35, 0, y0 + 0.7, -0.05, RED);
  addBox(parts, W + 0.02, 0.12, L + 0.04, 0, y0 + 0.1, 0, 0x2a2e33);
  addBox(parts, 0.72, 0.08, 0.34, 0, y0 + 0.42 + cabH + 0.06, cabZ, 0x1c1c1c);
  const wz = L / 2 - 0.9;
  for (const z of [wz, -wz]) for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) wheel(x, z);
  bodyGeo = mergeColored(parts);
  return bodyGeo;
}

/** Side, rear and roof red-cross boards, in car-local space. */
export function ambulanceSignGeometry() {
  if (signGeo) return signGeo;
  const W = AMBULANCE_WIDTH, L = AMBULANCE_LENGTH;
  const geos = [];
  const quad = (w, h, x, y, z, rx, ry) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    geos.push(g);
  };
  const y = 1.62, z = -0.72;
  quad(1.05, 1.05, W / 2 + 0.03, y, z, 0, Math.PI / 2);
  quad(1.05, 1.05, -W / 2 - 0.03, y, z, 0, -Math.PI / 2);
  quad(1.05, 1.05, 0, y, -L / 2 - 0.03, 0, Math.PI);
  quad(1.15, 1.15, 0, 2.3, z, -Math.PI / 2, 0);
  signGeo = mergeSimple(geos);
  return signGeo;
}

export function ambulanceLampGeometry(left) {
  const g = new THREE.BoxGeometry(0.28, 0.12, 0.2);
  g.translate(left ? -0.22 : 0.22, 1.92, 1.35);
  return g;
}

function parkedMaterials() {
  if (!bodyMat) {
    bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    const map = redCrossMap();
    crossMat = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.05 });
    lampMatL = new THREE.MeshStandardMaterial({ color: RED, emissive: 0xff1a1a, emissiveIntensity: 0.35 });
    lampMatR = new THREE.MeshStandardMaterial({ color: RED, emissive: 0xff1a1a, emissiveIntensity: 0.35 });
  }
  return { bodyMat, crossMat, lampMatL, lampMatR };
}

/** A parked ambulance. Lamp materials are shared, so one pulse lights every bay. */
export function createAmbulance() {
  const mats = parkedMaterials();
  const g = new THREE.Group();
  // Keep the painted body out of the static merge, which drops vertex colors.
  g.userData.dynamic = true;
  const body = new THREE.Mesh(ambulanceBodyGeometry(), mats.bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const sign = new THREE.Mesh(ambulanceSignGeometry(), mats.crossMat);
  g.add(sign);
  const left = new THREE.Mesh(ambulanceLampGeometry(true), mats.lampMatL);
  const right = new THREE.Mesh(ambulanceLampGeometry(false), mats.lampMatR);
  g.add(left, right);
  g.userData.lamps = [mats.lampMatL, mats.lampMatR];
  return g;
}
