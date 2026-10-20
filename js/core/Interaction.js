// Picking (click / tap), selection highlight, location marker and floating name labels.
const THREE = window.THREE;

export class Interaction {
  constructor(ctx, { terrain, bridges, water, controls, ui }) {
    this.ctx = ctx;
    this.terrain = terrain;
    this.bridges = bridges;
    this.water = water;
    this.controls = controls;
    this.ui = ui;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(0);
    this.ndc = new THREE.Vector2();
    this.labels = [];
    this.labelsVisible = true;
    this.selection = null;
    this.followTarget = null;

    this.marker = this._makeMarker();
    ctx.scene.add(this.marker);
    this.highlight = new THREE.Box3Helper(new THREE.Box3(), 0xffc94a);
    this.highlight.visible = false;
    this.highlight.material.depthTest = false;
    this.highlight.material.transparent = true;
    this.highlight.renderOrder = 999;
    ctx.scene.add(this.highlight);

    this.markerLabel = document.createElement('div');
    this.markerLabel.className = 'pick-label';
    this.markerLabel.style.display = 'none';
    ui.labelLayer.appendChild(this.markerLabel);

    const dom = ctx.renderer.domElement;
    let down = null;
    let lastClick = 0;
    dom.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), multi: false };
      if (e.isPrimary === false && down) down.multi = true;
    });
    dom.addEventListener('pointermove', (e) => {
      this._hoverPos = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointerup', (e) => {
      if (!down || !e.isPrimary) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      down = null;
      if (moved > 7 || dt > 600 || controls.pointers.size > 1) return;
      const now = performance.now();
      const dbl = now - lastClick < 320;
      lastClick = now;
      this.click(e.clientX, e.clientY, dbl);
    });
    // Track the cursor's ground point for zoom-to-cursor.
    dom.addEventListener('wheel', (e) => {
      const hit = this._groundHit(e.clientX, e.clientY);
      controls.cursorPoint = hit ? hit.point : null;
    }, { passive: true });
  }

  _makeMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 998;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffb02e, depthTest: false, transparent: true }));
    pin.position.y = 2;
    pin.renderOrder = 998;
    g.add(ring, pin);
    g.visible = false;
    g.userData.ring = ring;
    return g;
  }

  _setRay(x, y) {
    const r = this.ctx.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.ctx.camera);
  }

  /** Ray-march the analytic terrain + water plane (fast, no triangle tests). */
  _groundHit(x, y) {
    this._setRay(x, y);
    const { origin, direction } = this.raycaster.ray;
    const p = new THREE.Vector3();
    let prev = 0;
    for (let t = 0.5; t < 2500; t += Math.max(0.5, t * 0.01)) {
      p.copy(origin).addScaledVector(direction, t);
      const ground = Math.max(this.terrain.heightAt(p.x, p.z), 0);
      if (p.y <= ground) {
        // Refine with bisection.
        let a = prev, b = t;
        for (let i = 0; i < 12; i++) {
          const m = (a + b) / 2;
          p.copy(origin).addScaledVector(direction, m);
          if (p.y <= Math.max(this.terrain.heightAt(p.x, p.z), 0)) b = m; else a = m;
        }
        p.copy(origin).addScaledVector(direction, b);
        const h = this.terrain.heightAt(p.x, p.z);
        return { point: p.clone(), distance: b, water: h < 0 };
      }
      prev = t;
    }
    return null;
  }

  click(x, y, dbl) {
    this._setRay(x, y);
    const hits = this.raycaster.intersectObjects(this.ctx.pickables, true);
    const objHit = hits.find((h) => h.object.visible !== false && h.object.userData.pick);
    const ground = this._groundHit(x, y);
    if (objHit && (!ground || objHit.distance <= ground.distance + 0.5)) {
      this.select(objHit.object.userData.pick, objHit);
      if (dbl) this.focusOn(objHit.object.userData.pick);
      return;
    }
    if (ground) {
      this.selectLocation(ground);
      if (dbl) {
        if (this.controls.mode === 'walk') this.controls.walkPos.set(ground.point.x, this.controls.walkPos.y, ground.point.z);
        else this.controls.flyTo(ground.point.clone().setY(Math.max(ground.point.y, 0) + 1), Math.min(this.controls.goalRadius, 90), { duration: 1.2 });
      }
    }
  }

  select(info, hit) {
    this.selection = info;
    this.followTarget = info.follow || null;
    const box = new THREE.Box3();
    if (hit && hit.object.isInstancedMesh && hit.instanceId !== undefined) {
      const m = new THREE.Matrix4();
      hit.object.getMatrixAt(hit.instanceId, m);
      if (!hit.object.geometry.boundingBox) hit.object.geometry.computeBoundingBox();
      box.copy(hit.object.geometry.boundingBox).applyMatrix4(m).applyMatrix4(hit.object.matrixWorld);
    } else {
      let root = hit ? hit.object : null;
      while (root && root.parent && root.parent.userData.pick === info) root = root.parent;
      if (root) box.setFromObject(root);
      this._followRoot = info.follow ? root : null;
    }
    this.highlight.box.copy(box);
    this.highlight.visible = !box.isEmpty();
    this.marker.visible = false;
    this.markerLabel.style.display = 'none';
    const p = hit ? hit.point : null;
    this.ui.showInfo({
      ...info,
      coords: p ? `X ${p.x.toFixed(1)}  Z ${p.z.toFixed(1)}  高度 ${p.y.toFixed(1)} m` : '',
    }, () => this.focusOn(info));
  }

  selectLocation(g) {
    this.selection = null;
    this.followTarget = null;
    this.highlight.visible = false;
    const p = g.point;
    const h = this.terrain.heightAt(p.x, p.z);
    const isl = this.terrain.islandAt(p.x, p.z);
    const onBridge = this.bridges.heightAt(p.x, p.z);
    let name, desc;
    if (g.water) {
      const depth = -h;
      name = depth < 3 ? '浅海 Shallows' : '海域 Open Sea';
      desc = `水深约 ${depth.toFixed(1)} 米。点击水面会激起波纹。`;
      this.water.addDrop(p.x, p.z, 3.5, 0.35);
    } else {
      const surface = this.terrain.surfaceAt(p.x, p.z);
      const surfaceName = { sand: '沙滩 Beach', grass: '草地 Meadow', rock: '岩石 Rock' }[surface] || '陆地';
      name = isl ? `${isl.name} · ${surfaceName}` : surfaceName;
      desc = `海拔 ${h.toFixed(1)} 米。${isl && isl.id !== 'central' ? '此处暂为自然植被，预留未来开发。' : ''}`;
    }
    if (onBridge !== null) name = '桥面 Bridge deck';
    this.marker.position.set(p.x, Math.max(h, 0) + 0.15, p.z);
    this.marker.visible = true;
    this.markerLabel.textContent = name.split(' ')[0];
    this.markerLabel.style.display = '';
    this._markerAnchor = this.marker.position.clone().setY(this.marker.position.y + 4.3);
    this.ui.showInfo({
      name, nameEn: isl ? isl.nameEn : 'Pumpkin Sea', category: '位置 Location', description: desc,
      coords: `X ${p.x.toFixed(1)}  Z ${p.z.toFixed(1)}`,
    }, () => this.controls.flyTo(p.clone().setY(Math.max(h, 0) + 1), 45));
  }

  focusOn(info) {
    if (!info.focus) return;
    const f = new THREE.Vector3(...info.focus);
    if (info.follow) f.copy(info.follow.position);
    if (this.controls.mode === 'walk') this.controls.setMode('orbit');
    this.controls.flyTo(f, info.radius || 40, { phi: 1.2 });
  }

  clearSelection() {
    this.selection = null;
    this.followTarget = null;
    this.highlight.visible = false;
    this.marker.visible = false;
    this.markerLabel.style.display = 'none';
  }

  addLabel(text, sub, position, cls = '') {
    const el = document.createElement('div');
    el.className = `world-label ${cls}`;
    el.innerHTML = `<span>${text}</span>${sub ? `<small>${sub}</small>` : ''}`;
    this.ui.labelLayer.appendChild(el);
    this.labels.push({ el, position: position.clone(), island: cls.includes('island'), minor: cls.includes('minor') });
    return el;
  }

  setLabelsVisible(v) { this.labelsVisible = v; }

  update(t) {
    const cam = this.ctx.camera;
    const w = this.ctx.renderer.domElement.clientWidth, h = this.ctx.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.position).project(cam);
      const dist = cam.position.distanceTo(l.position);
      const show = this.labelsVisible && v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && (l.island ? dist < 1400 && dist > 220 : dist < (l.minor ? 320 : 700));
      l.el.style.display = show ? '' : 'none';
      if (show) {
        l.el.style.transform = `translate(-50%, -100%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
        l.el.style.opacity = String(Math.max(0.35, 1 - dist / (l.island ? 1800 : 900)));
      }
    }
    if (this.marker.visible) {
      const s = 1 + Math.sin(t * 4) * 0.12;
      this.marker.userData.ring.scale.set(s, s, s);
      v.copy(this._markerAnchor).project(cam);
      if (v.z < 1) {
        this.markerLabel.style.transform = `translate(-50%, -100%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      }
    }
    if (this._followRoot && this.highlight.visible) {
      this.highlight.box.setFromObject(this._followRoot);
    }
  }
}
