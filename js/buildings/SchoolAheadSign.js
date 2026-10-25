// 前方学校 — the roadside warning at each end of the block in front of 江苏路第二小学.
// Same kit as the other signs: a canvas face on a thin board, a steel pole, a concrete foot.
import { registerBuilding } from '../core/Registry.js';
import { makeCanvas, canvasTexture } from '../core/Utils.js';
import { sharedMaterial, colorMat, box, mesh } from './materials.js';

const THREE = window.THREE;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function triangle(ctx, apex, left, right) {
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(left[0], left[1]);
  ctx.lineTo(right[0], right[1]);
  ctx.closePath();
}

/** Black walking figures: a taller child and a smaller one with a ponytail, holding hands. */
function figures(ctx) {
  const walker = (x, y, s, child) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.arc(0, -86, child ? 20 : 24, 0, Math.PI * 2);
    ctx.fill();
    if (child) {
      ctx.beginPath();
      ctx.ellipse(16, -78, 8, 18, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-18, -58);
    ctx.lineTo(16, -54);
    ctx.lineTo(child ? 22 : 12, 6);
    ctx.lineTo(child ? -22 : -16, 4);
    ctx.closePath();
    ctx.fill();
    // Forward arm, reaching toward the other child.
    ctx.beginPath();
    ctx.moveTo(6, -46);
    ctx.lineTo(48, -18);
    ctx.lineTo(44, -8);
    ctx.lineTo(2, -34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.lineTo(-30, -16);
    ctx.lineTo(-20, -10);
    ctx.lineTo(-4, -36);
    ctx.closePath();
    ctx.fill();
    // Stride.
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.quadraticCurveTo(8, 8, 26, 58);
    ctx.lineTo(10, 62);
    ctx.lineTo(-2, 18);
    ctx.lineTo(-16, 60);
    ctx.lineTo(-30, 54);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  walker(250, 340, 1.05, false);
  walker(390, 358, 0.82, true);
}

function signTexture() {
  const c = makeCanvas(640, 900);
  const x = c.getContext('2d');
  const apex = [320, 28], left = [36, 520], right = [604, 520];
  x.fillStyle = '#f5c518';
  triangle(x, apex, left, right);
  x.fill();
  x.save();
  x.clip();
  x.strokeStyle = '#141414';
  x.lineWidth = 54;
  x.stroke();
  x.restore();
  // Inner yellow field, inset from the black band.
  const k = 0.78;
  const mid = [(apex[0] + left[0] + right[0]) / 3, (apex[1] + left[1] + right[1]) / 3];
  const pull = (p) => [mid[0] + (p[0] - mid[0]) * k, mid[1] + (p[1] - mid[1]) * k];
  x.fillStyle = '#f5c518';
  triangle(x, pull(apex), pull(left), pull(right));
  x.fill();
  figures(x);

  x.fillStyle = '#141414';
  roundRect(x, 28, 548, 584, 300, 36);
  x.fill();
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 132px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillText('前方学校', 320, 700);
  return canvasTexture(c, { anisotropy: 8 });
}

export function buildSchoolAheadSign(ctx) {
  const g = new THREE.Group();
  const tex = signTexture();
  const face = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.35, roughness: 0.55,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12,
  });
  ctx.nightMaterials.push({ material: face, intensity: 0.45, base: 0.12 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 2.42), face);
  board.position.set(0, 2.42, 0.05);
  board.castShadow = true;
  g.add(board);
  mesh(g, new THREE.CylinderGeometry(0.045, 0.055, 2.15, 8), sharedMaterial('darkSteel'), 0, 1.1, -0.02);
  box(g, 0.55, 0.12, 0.4, 0, 0.06, 0, colorMat(0xb7b1a6, { roughness: 0.9 }), { cast: false });
  g.userData.height = 3.7;
  g.userData.treeSpots = [];
  return g;
}

registerBuilding('schoolAheadSign', {
  label: '前方学校 School Ahead',
  footprint: [0.8, 0.8],
  create(ctx) { return buildSchoolAheadSign(ctx); },
  info() {
    return {
      category: '路牌 Street Sign',
      name: '前方学校', nameEn: 'School Ahead',
      description: '江苏路第二小学门口的警告牌。立在校门前这段江苏路两端的斑马线旁，牌面朝来车方向。',
    };
  },
});
