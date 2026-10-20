// Orbit + walk camera controls with mouse, keyboard and touch (pinch / two-finger pan / virtual joystick).
const THREE = window.THREE;

export class CameraControls {
  constructor(camera, dom, { groundHeight, walkable = () => true }) {
    this.camera = camera;
    this.dom = dom;
    this.groundHeight = groundHeight; // (x, z) => walkable height
    this.walkable = walkable;         // (x, z) => true if a walker may stand there
    this.mode = 'orbit';
    this.enabled = true;

    this.target = new THREE.Vector3(0, 10, 0);
    this.goalTarget = this.target.clone();
    this.radius = 260; this.goalRadius = this.radius;
    this.theta = 0.75; this.goalTheta = this.theta;   // azimuth
    this.phi = 1.0; this.goalPhi = this.phi;          // polar angle from +Y
    this.minRadius = 4; this.maxRadius = 1100;

    // Walk state.
    this.walkPos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eyeHeight = 1.7;
    this.flyHeight = 0; // extra height above ground in walk mode

    this.keys = new Set();
    this.pointers = new Map();
    this.joystick = { x: 0, y: 0 };
    this.vertical = 0;
    this.anim = null;
    this.listeners = [];

    this._bind();
  }

  onChange(fn) { this.listeners.push(fn); }

  _bind() {
    const d = this.dom;
    d.style.touchAction = 'none';
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    d.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey || e.ctrlKey || e.metaKey });
    this.anim = null;
    if (this.pointers.size === 2) this._pinchStart = this._pinchInfo();
  }

  _pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2) {
      const now = this._pinchInfo();
      const prev = this._pinchStart;
      if (prev && prev.dist > 0) {
        const scale = prev.dist / Math.max(1, now.dist);
        if (this.mode === 'orbit') {
          this.goalRadius = THREE.MathUtils.clamp(this.goalRadius * scale, this.minRadius, this.maxRadius);
          this._pan(now.mx - prev.mx, now.my - prev.my);
          this.goalTheta -= (now.angle - prev.angle);
        } else {
          this.flyHeight = Math.max(0, this.flyHeight + (now.my - prev.my) * 0.08);
        }
      }
      this._pinchStart = now;
      return;
    }
    const h = this.dom.clientHeight || 1;
    if (this.mode === 'orbit') {
      if (p.button === 2 || p.button === 1 || p.shift) this._pan(dx, dy);
      else {
        this.goalTheta -= dx / h * Math.PI * 1.4;
        this.goalPhi = THREE.MathUtils.clamp(this.goalPhi - dy / h * Math.PI, 0.08, 1.5);
      }
    } else {
      this.yaw += dx / h * Math.PI * 1.1;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy / h * Math.PI * 0.9, -1.45, 1.45);
    }
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this._pinchStart = null;
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const k = Math.exp(e.deltaY * 0.0012);
    if (this.mode === 'orbit') {
      const newR = THREE.MathUtils.clamp(this.goalRadius * k, this.minRadius, this.maxRadius);
      // Zoom towards the cursor: shift the target along the cursor ray proportionally.
      if (this.cursorPoint && k < 1) {
        const f = 1 - newR / this.goalRadius;
        this.goalTarget.lerp(this.cursorPoint, f * 0.85);
      }
      this.goalRadius = newR;
    } else {
      this.flyHeight = Math.max(0, this.flyHeight - e.deltaY * 0.02);
    }
  }

  _pan(dx, dy) {
    const h = this.dom.clientHeight || 1;
    const scale = this.goalRadius * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / h;
    const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
    const fwd = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
    this.goalTarget.addScaledVector(right, -dx * scale);
    this.goalTarget.addScaledVector(fwd, dy * scale);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === 'walk') {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this._placeWalker(this.goalTarget, this.yaw);
      this.pitch = 0;
      this.flyHeight = 0;
    } else {
      const dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.goalTarget.copy(this.walkPos).addScaledVector(dir, 20);
      this.goalTarget.y = this.groundHeight(this.goalTarget.x, this.goalTarget.z) + 2;
      this.goalRadius = 60;
      this.goalTheta = this.yaw;
      this.goalPhi = 1.15;
    }
    this.mode = mode;
    this.listeners.forEach((fn) => fn(mode));
  }

  /** Put the walker near `point`, backing away along -view (then spiralling) until the spot is walkable. */
  _placeWalker(point, yaw) {
    const bx = Math.sin(yaw), bz = Math.cos(yaw); // backwards = opposite of view direction
    for (let d = 0; d <= 120; d += 3) {
      for (const a of [0, 0.6, -0.6, 1.3, -1.3]) {
        if (d === 0 && a !== 0) continue;
        const c = Math.cos(a), s = Math.sin(a);
        const ux = bx * c - bz * s, uz = bx * s + bz * c;
        const x = point.x + ux * d, z = point.z + uz * d;
        if (this.walkable(x, z) && this.walkable(x + ux * 6, z + uz * 6)) {
          this.walkPos.set(x + ux * 6, 0, z + uz * 6);
          return;
        }
      }
    }
    this.walkPos.set(point.x, 0, point.z);
  }

  /** Smoothly move the orbit focus to a point. */
  flyTo(point, radius, { theta, phi, duration = 1.6 } = {}) {
    if (this.mode === 'walk') {
      this._placeWalker(point, this.yaw);
      return;
    }
    this.anim = {
      t: 0, duration,
      fromTarget: this.target.clone(), toTarget: point.clone(),
      fromR: this.radius, toR: radius ?? this.goalRadius,
      fromTheta: this.theta, toTheta: theta ?? this.theta,
      fromPhi: this.phi, toPhi: phi ?? this.phi,
    };
    let dt = this.anim.toTheta - this.anim.fromTheta;
    dt = Math.atan2(Math.sin(dt), Math.cos(dt));
    this.anim.toTheta = this.anim.fromTheta + dt;
  }

  update(dt) {
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let fwd = 0, strafe = 0, up = 0, turn = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (this.keys.has('KeyA')) strafe -= 1;
    if (this.keys.has('ArrowLeft')) turn += 1;
    if (this.keys.has('ArrowRight')) turn -= 1;
    if (this.keys.has('KeyE') || this.keys.has('Space')) up += 1;
    if (this.keys.has('KeyQ') || this.keys.has('KeyC')) up -= 1;
    fwd += -this.joystick.y;
    strafe += this.joystick.x;
    up += this.vertical;

    if (this.mode === 'orbit') this._updateOrbit(dt, fwd, strafe, up, turn, run);
    else this._updateWalk(dt, fwd, strafe, up, turn, run);
  }

  _updateOrbit(dt, fwd, strafe, up, turn, run) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.duration;
      const k = a.t >= 1 ? 1 : 1 - Math.pow(1 - a.t, 3);
      this.goalTarget.lerpVectors(a.fromTarget, a.toTarget, k);
      this.goalRadius = THREE.MathUtils.lerp(a.fromR, a.toR, k);
      this.goalTheta = THREE.MathUtils.lerp(a.fromTheta, a.toTheta, k);
      this.goalPhi = THREE.MathUtils.lerp(a.fromPhi, a.toPhi, k);
      this.target.copy(this.goalTarget); this.radius = this.goalRadius; this.theta = this.goalTheta; this.phi = this.goalPhi;
      if (a.t >= 1) this.anim = null;
    } else {
      if (fwd || strafe) {
        const speed = Math.max(8, this.radius * 0.8) * (run ? 2.5 : 1) * dt;
        const f = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
        const r = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
        this.goalTarget.addScaledVector(f, fwd * speed).addScaledVector(r, strafe * speed);
      }
      if (turn) this.goalTheta += turn * dt * 1.2;
      if (up) this.goalRadius = THREE.MathUtils.clamp(this.goalRadius * Math.exp(-up * dt * 1.5), this.minRadius, this.maxRadius);
      const k = 1 - Math.exp(-dt * 8);
      this.target.lerp(this.goalTarget, k);
      this.radius += (this.goalRadius - this.radius) * k;
      this.theta += (this.goalTheta - this.theta) * k;
      this.phi += (this.goalPhi - this.phi) * k;
    }
    const lim = 420;
    this.goalTarget.x = THREE.MathUtils.clamp(this.goalTarget.x, -lim, lim);
    this.goalTarget.z = THREE.MathUtils.clamp(this.goalTarget.z, -lim, lim);
    const groundAtTarget = Math.max(0, this.groundHeight(this.target.x, this.target.z));
    if (!this.anim) this.goalTarget.y += (groundAtTarget + 1 - this.goalTarget.y) * Math.min(1, dt * 2) * (this.goalTarget.y < groundAtTarget + 1 ? 1 : 0.15);

    const sinPhi = Math.sin(this.phi);
    const pos = new THREE.Vector3(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta),
    );
    const minY = Math.max(0.6, this.groundHeight(pos.x, pos.z) + 1.2);
    if (pos.y < minY) pos.y = minY;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  _updateWalk(dt, fwd, strafe, up, turn, run) {
    const speed = (run ? 12 : 4.5) * (1 + this.flyHeight / 15) * dt;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.walkPos.addScaledVector(f, fwd * speed).addScaledVector(r, strafe * speed);
    this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -430, 430);
    this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -430, 430);
    if (turn) this.yaw += turn * dt * 1.5;
    if (up) this.flyHeight = THREE.MathUtils.clamp(this.flyHeight + up * dt * (run ? 30 : 10), 0, 250);
    const ground = Math.max(0.15, this.groundHeight(this.walkPos.x, this.walkPos.z));
    const targetY = ground + this.eyeHeight + this.flyHeight;
    this.walkPos.y += (targetY - this.walkPos.y) * Math.min(1, dt * 10);
    this.camera.position.copy(this.walkPos);
    if (fwd && this.flyHeight === 0) this.camera.position.y += Math.sin(performance.now() * 0.012) * 0.03;
    const look = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(look));
  }

  /** Point the orbit camera focus. */
  get focus() { return this.mode === 'orbit' ? this.target : this.walkPos; }
}
