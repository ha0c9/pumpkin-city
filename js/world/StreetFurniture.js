// Street lamps (instanced, glowing at night) and traffic signals.
import { mergeColored, makeCanvas, canvasTexture } from '../core/Utils.js';
import { IS_MOBILE } from '../config/world.config.js';

const THREE = window.THREE;

function lampGeometry() {
  const parts = [];
  const m = (x, y, z, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
  parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.26, 0.6, 10), matrix: m(0, 0.3, 0), color: 0x2f3338 });
  parts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.12, 7.2, 10), matrix: m(0, 3.6, 0), color: 0x3a3f45 });
  parts.push({ geometry: new THREE.CylinderGeometry(0.05, 0.06, 2.0, 8), matrix: m(0, 7.05, 0.95, Math.PI / 2 - 0.15), color: 0x3a3f45 });
  parts.push({ geometry: new THREE.BoxGeometry(0.42, 0.14, 0.9), matrix: m(0, 7.18, 2.05), color: 0x2b2f34 });
  return mergeColored(parts);
}

function poolTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,214,150,0.85)');
  g.addColorStop(0.35, 'rgba(255,190,120,0.35)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

export class StreetFurniture {
  constructor(ctx, lamps, signals) {
    this.ctx = ctx;
    this.lamps = lamps;
    this.group = new THREE.Group();
    this.group.name = 'street-furniture';
    ctx.scene.add(this.group);
    this._buildLamps(lamps);
    this._buildSignals(signals);
    this._buildPointLights();
  }

  _buildLamps(lamps) {
    const n = lamps.length;
    const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45 });
    const poles = new THREE.InstancedMesh(lampGeometry(), poleMat, n);
    poles.castShadow = true;
    const bulbGeo = new THREE.BoxGeometry(0.34, 0.05, 0.75);
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const bulbs = new THREE.InstancedMesh(bulbGeo, this.bulbMat, n);
    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.heads = [];
    lamps.forEach((l, i) => {
      const rot = Math.atan2(l.dirX, l.dirZ);
      q.setFromEuler(e.set(0, rot, 0));
      m.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m);
      const head = new THREE.Vector3(l.x + l.dirX * 2.05, l.y + 7.1, l.z + l.dirZ * 2.05);
      this.heads.push(head);
      m.compose(head, q, new THREE.Vector3(1, 1, 1));
      bulbs.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(head.x, l.y + 0.08, head.z), q, new THREE.Vector3(11, 1, 11));
      pools.setMatrixAt(i, m);
    });
    poles.userData.pick = { id: 'street-lamp', name: '路灯', nameEn: 'Street Lamp', category: '市政设施 Facility',
      description: '高 7 米单臂 LED 路灯，夜间自动点亮。' };
    this.group.add(poles, bulbs, pools);
    this.ctx.pickables.push(poles);
    this.ctx.nightMaterials.push({ material: this.bulbMat, intensity: 4 });
  }

  _buildSignals(signals) {
    if (!signals.length) return;
    const poleParts = (reach) => {
      const q = new THREE.Quaternion();
      const parts = [
        { geometry: new THREE.CylinderGeometry(0.11, 0.14, 6.0, 10), matrix: new THREE.Matrix4().makeTranslation(0, 3, 0), color: 0x4a4f55 },
        { geometry: new THREE.CylinderGeometry(0.07, 0.07, reach, 8),
          matrix: new THREE.Matrix4().compose(new THREE.Vector3(-reach / 2, 5.8, 0), q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), color: 0x4a4f55 },
        { geometry: new THREE.BoxGeometry(0.42, 1.25, 0.32), matrix: new THREE.Matrix4().makeTranslation(-reach, 5.2, 0), color: 0x1d1f22 },
        { geometry: new THREE.BoxGeometry(0.34, 0.95, 0.28), matrix: new THREE.Matrix4().makeTranslation(0, 2.6, 0.12), color: 0x1d1f22 },
      ];
      return mergeColored(parts);
    };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 });
    const colors = { red: 0xff2a1a, yellow: 0xffb000, green: 0x22ff66 };
    this.signalMats = {};
    for (const axis of ['x', 'z']) {
      for (const [name, hex] of Object.entries(colors)) {
        this.signalMats[`${axis}-${name}`] = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: 0.1 });
      }
    }
    const disc = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14);
    disc.rotateX(Math.PI / 2);
    const lightOffsets = { red: 5.58, yellow: 5.2, green: 4.82 };
    const pick = { id: 'traffic-signal', name: '交通信号灯', nameEn: 'Traffic Signal', category: '市政设施 Facility', description: '红黄绿三色信号灯，按方向周期切换。' };
    for (const s of signals) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = Math.atan2(s.face[0], s.face[1]);
      const pole = new THREE.Mesh(poleParts(s.reach), mat);
      pole.castShadow = true;
      g.add(pole);
      for (const [name, y] of Object.entries(lightOffsets)) {
        const l = new THREE.Mesh(disc, this.signalMats[`${s.axis}-${name}`]);
        l.position.set(-s.reach, y, 0.18);
        g.add(l);
        const ped = new THREE.Mesh(disc, this.signalMats[`${s.axis}-${name === 'yellow' ? 'red' : name}`]);
        if (name !== 'yellow') { ped.position.set(0, name === 'red' ? 2.82 : 2.38, 0.27); ped.scale.setScalar(0.9); g.add(ped); }
      }
      g.traverse((o) => { o.userData.pick = pick; });
      this.group.add(g);
      this.ctx.pickables.push(g);
    }
  }

  _buildPointLights() {
    this.pointLights = [];
    const count = IS_MOBILE ? 0 : 6;
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffc88a, 0, 26, 2);
      l.position.set(0, -100, 0);
      this.ctx.scene.add(l);
      this.pointLights.push(l);
    }
  }

  update(time, night, focus) {
    if (this.signalMats) {
      const t = time % 24;
      const xs = t < 10 ? 'green' : t < 12 ? 'yellow' : 'red';
      const zs = t < 12 ? 'red' : t < 22 ? 'green' : 'yellow';
      for (const axis of ['x', 'z']) {
        const on = axis === 'x' ? xs : zs;
        for (const c of ['red', 'yellow', 'green']) {
          this.signalMats[`${axis}-${c}`].emissiveIntensity = c === on ? 3.0 : 0.05;
        }
      }
    }
    this.poolMat.opacity = night * 0.85;
    if (this.pointLights.length) {
      const sorted = this.heads.map((h) => ({ h, d: h.distanceToSquared(focus) })).sort((a, b) => a.d - b.d);
      this.pointLights.forEach((l, i) => {
        const s = sorted[i];
        if (!s) return;
        l.position.set(s.h.x, s.h.y - 0.4, s.h.z);
        l.intensity = night * 3.2;
      });
    }
  }
}
