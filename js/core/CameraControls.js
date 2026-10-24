// Camera controls for orbit and walk modes.
//
// Orbit (map-style):
//   mouse  — left drag rotates, right/middle/Shift drag pans (the ground follows the cursor), wheel zooms to the cursor
//   touch  — one finger pans (the ground point under the finger stays under it), two fingers pinch-zoom towards
//            their midpoint, twist rotates, and a parallel vertical drag tilts
//   keys   — WASD / arrows move, Q/E zoom, arrow left/right rotate
// Walk (first person):
//   touch  — a floating joystick appears wherever the left half of the screen is touched; dragging elsewhere looks
//            around (the view turns the way the finger moves); pinch zooms the lens
//   mouse  — drag to look, wheel zooms the lens; keys WASD move, Shift runs, E/Q (Space/C) fly up/down
// Gamepad (see Gamepad.js): left stick moves, right stick turns / tilts (looks in walk), triggers zoom (fly in walk).
// Hold-buttons (zoom / rotate / vertical) are driven through `hold` and `vertical` by the UI.
const THREE = window.THREE;
const { clamp } = THREE.MathUtils;

const ORBIT_FOV = 55;
const WALK_FOV = 70;

export class CameraControls {
  constructor(camera, dom, { groundHeight, walkable = () => true, limit = 800 }) {
    this.camera = camera;
    this.dom = dom;
    this.groundHeight = groundHeight;
    this.walkable = walkable;
    this.limit = limit;
    this.mode = 'orbit';
    this.enabled = true;

    this.target = new THREE.Vector3(0, 10, 0);
    this.goalTarget = this.target.clone();
    this.radius = 260; this.goalRadius = this.radius;
    this.theta = 0.75; this.goalTheta = this.theta;   // azimuth
    this.phi = 1.0; this.goalPhi = this.phi;          // polar angle from +Y
    this.minRadius = 6; this.maxRadius = 1600;
    this.minPhi = 0.08; this.maxPhi = 1.48;

    this.walkPos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eyeHeight = 1.7;
    this.flyHeight = 0;
    this.walkFov = WALK_FOV;

    this.keys = new Set();
    this.pointers = new Map();
    this.multiTouch = false;     // true once a second finger joined the current gesture (suppresses taps)
    this.joystick = { x: 0, y: 0 };
    this.vertical = 0;
    this.hold = { zoom: 0, rotate: 0 };
    this.pad = { lx: 0, ly: 0, rx: 0, ry: 0, zoom: 0, lens: 0, run: false };   // written by GamepadInput
    this.anim = null;
    this.listeners = [];
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._makeJoystick();
    this._bind();
  }

  onChange(fn) { this.listeners.push(fn); }

  // ---------------------------------------------------------------- input wiring

  _bind() {
    const d = this.dom;
    d.style.touchAction = 'none';
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    d.addEventListener('lostpointercapture', (e) => this._up(e));
    d.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    // iOS Safari: block page pinch-zoom and double-tap zoom, which would otherwise steal the gesture.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    d.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    d.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.resetInput());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.resetInput(); });
  }

  /** Drop every tracked pointer / key / stick; used when the page loses focus or input gets out of sync. */
  resetInput() {
    this.keys.clear();
    this.pointers.clear();
    this._gesture = null;
    this._releaseStick();
    this.vertical = 0;
    this.hold.zoom = 0; this.hold.rotate = 0;
  }

  _makeJoystick() {
    const el = document.createElement('div');
    el.className = 'float-joy';
    el.innerHTML = '<div class="knob"></div>';
    el.hidden = true;
    document.body.appendChild(el);
    this.joyEl = el;
    this.joyKnob = el.firstChild;
    this.stick = null; // { id, x0, y0 }
  }

  _releaseStick() {
    this.stick = null;
    this.joystick.x = 0; this.joystick.y = 0;
    if (this.joyEl) { this.joyEl.hidden = true; this.joyKnob.style.transform = ''; }
  }

  _down(e) {
    if (!this.enabled) return;
    // A primary pointer starts a new gesture: anything still tracked is stale (a lost pointerup).
    if (e.isPrimary) {
      this.pointers.clear();
      this._gesture = null;
      this.multiTouch = false;
      if (this.stick) this._releaseStick();
    }
    try { this.dom.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
    this.anim = null;
    const touch = e.pointerType !== 'mouse';
    const w = this.dom.clientWidth || window.innerWidth;
    if (this.mode === 'walk' && touch && !this.stick && e.clientX < w * 0.45) {
      this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      this.joyEl.style.left = `${e.clientX}px`;
      this.joyEl.style.top = `${e.clientY}px`;
      this.joyEl.hidden = false;
      return;
    }
    this.pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, touch,
      button: e.button, pan: e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey,
    });
    if (this.pointers.size >= 2) {
      this.multiTouch = true;
      this._gesture = { mode: null, acc: 0, start: this._pair() };
    }
  }

  _pair() {
    const [a, b] = [...this.pointers.values()];
    return {
      a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y },
      dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  _move(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      const R = 56;
      let x = (e.clientX - this.stick.x0) / R, y = (e.clientY - this.stick.y0) / R;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.joystick.x = x; this.joystick.y = y;
      this.joyKnob.style.transform = `translate(${x * R}px, ${y * R}px)`;
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { this._up(e); return; }
    const px = p.x, py = p.y;
    p.x = e.clientX; p.y = e.clientY;
    const dx = p.x - px, dy = p.y - py;
    if (!dx && !dy) return;
    if (this.pointers.size >= 2) { this._twoFinger(); return; }
    const h = this.dom.clientHeight || 1;
    if (this.mode === 'orbit') {
      if (p.touch || p.pan) this._grabPan(px, py, p.x, p.y);
      else {
        this.goalTheta -= dx / h * Math.PI * 1.4;
        this.goalPhi = clamp(this.goalPhi - dy / h * Math.PI, this.minPhi, this.maxPhi);
      }
    } else {
      // The view turns the way the finger/mouse moves: drag left -> look left, drag up -> look up.
      const k = (this.walkFov / WALK_FOV);
      this.yaw -= dx / h * Math.PI * 1.15 * k;
      this.pitch = clamp(this.pitch - dy / h * Math.PI * 0.9 * k, -1.45, 1.45);
    }
  }

  _twoFinger() {
    const g = this._gesture;
    if (!g) return;
    const now = this._pair();
    const prev = g.prev || g.start;
    g.prev = now;
    if (!g.mode) {
      // Decide once: parallel vertical drag = tilt, anything else = pinch/rotate/pan.
      const da = { x: now.a.x - g.start.a.x, y: now.a.y - g.start.a.y };
      const db = { x: now.b.x - g.start.b.x, y: now.b.y - g.start.b.y };
      const moved = Math.max(Math.hypot(da.x, da.y), Math.hypot(db.x, db.y));
      if (moved < 10) return;
      const parallelV = da.y * db.y > 0 && Math.abs(da.y) > Math.abs(da.x) * 1.4 && Math.abs(db.y) > Math.abs(db.x) * 1.4;
      g.mode = this.mode === 'walk' ? 'lens' : parallelV && Math.abs(now.dist - g.start.dist) < 30 ? 'tilt' : 'pinch';
    }
    const h = this.dom.clientHeight || 1;
    if (g.mode === 'lens') {
      const s = prev.dist / Math.max(1, now.dist);
      this.walkFov = clamp(this.walkFov * s, 18, 80);
      return;
    }
    if (g.mode === 'tilt') {
      this.goalPhi = this.phi = clamp(this.phi - (now.my - prev.my) / h * Math.PI * 0.9, this.minPhi, this.maxPhi);
      this._applyOrbit();
      return;
    }
    // Pinch: pan with the midpoint, zoom about it, twist to rotate.
    this._grabPan(prev.mx, prev.my, now.mx, now.my);
    const scale = prev.dist / Math.max(1, now.dist);
    const G = this._groundPoint(now.mx, now.my);
    const newR = clamp(this.radius * scale, this.minRadius, this.maxRadius);
    if (G) {
      const f = newR / this.radius;
      this.target.x = G.x + (this.target.x - G.x) * f;
      this.target.z = G.z + (this.target.z - G.z) * f;
    }
    this.radius = newR;
    let da = now.angle - prev.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    this.theta += da;
    this._syncGoals();
    this._applyOrbit();
  }

  _up(e) {
    if (this.stick && e.pointerId === this.stick.id) { this._releaseStick(); return; }
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this._gesture = null;
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const k = Math.exp(clamp(e.deltaY, -120, 120) * 0.0015);
    if (this.mode === 'orbit') {
      const newR = clamp(this.goalRadius * k, this.minRadius, this.maxRadius);
      const G = this._groundPoint(e.clientX, e.clientY);
      if (G) {
        const f = newR / this.goalRadius;
        this.goalTarget.x = G.x + (this.goalTarget.x - G.x) * f;
        this.goalTarget.z = G.z + (this.goalTarget.z - G.z) * f;
      }
      this.goalRadius = newR;
    } else {
      this.walkFov = clamp(this.walkFov * k, 18, 80);
    }
  }

  // ---------------------------------------------------------------- orbit helpers

  /** Intersection of the screen ray with the horizontal plane through the orbit target. */
  _groundPoint(x, y) {
    const r = this.dom.getBoundingClientRect();
    this._ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this._ray.setFromCamera(this._ndc, this.camera);
    this._plane.constant = -this.target.y;
    const out = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._plane, out)) return null;
    // Near the horizon the hit runs off to infinity; cap how far a grab can reach.
    if (out.distanceTo(this.camera.position) > this.radius * 6) return null;
    return out;
  }

  /** Move the target so that the ground point under (x0, y0) ends up under (x1, y1). */
  _grabPan(x0, y0, x1, y1) {
    const a = this._groundPoint(x0, y0), b = this._groundPoint(x1, y1);
    let dx, dz;
    if (a && b) { dx = a.x - b.x; dz = a.z - b.z; } else {
      const h = this.dom.clientHeight || 1;
      const s = this.radius * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / h;
      const ex = x1 - x0, ey = y1 - y0;
      dx = -(Math.cos(this.theta) * ex + Math.sin(this.theta) * ey) * s;
      dz = -(-Math.sin(this.theta) * ex + Math.cos(this.theta) * ey) * s;
    }
    this.target.x += dx; this.target.z += dz;
    this._clampTarget(this.target);
    this._syncGoals();
    this._applyOrbit();
  }

  _syncGoals() {
    this.goalTarget.copy(this.target);
    this.goalRadius = this.radius;
    this.goalTheta = this.theta;
    this.goalPhi = this.phi;
  }

  _clampTarget(v) {
    v.x = clamp(v.x, -this.limit, this.limit);
    v.z = clamp(v.z, -this.limit, this.limit);
  }

  /** Place the camera from the current orbit state. */
  _applyOrbit() {
    const sinPhi = Math.sin(this.phi);
    const pos = this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta),
    );
    const minY = Math.max(0.6, this.groundHeight(pos.x, pos.z) + 1.2);
    if (pos.y < minY) pos.y = minY;
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- modes

  setMode(mode) {
    if (mode === this.mode) return;
    this.resetInput();
    if (mode === 'walk') {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this._placeWalker(this.goalTarget, this.yaw);
      this.pitch = 0;
      this.flyHeight = 0;
      this.walkFov = WALK_FOV;
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
    const bx = Math.sin(yaw), bz = Math.cos(yaw);
    for (let d = 0; d <= 120; d += 3) {
      for (const a of [0, 0.6, -0.6, 1.3, -1.3]) {
        if (d === 0 && a !== 0) continue;
        const c = Math.cos(a), s = Math.sin(a);
        const ux = bx * c - bz * s, uz = bx * s + bz * c;
        const x = point.x + ux * d, z = point.z + uz * d;
        if (this.walkable(x, z) && this.walkable(x + ux * 6, z + uz * 6)) {
          this.walkPos.set(x + ux * 6, this.walkPos.y, z + uz * 6);
          return;
        }
      }
    }
    this.walkPos.set(point.x, this.walkPos.y, point.z);
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

  /** Rotate back to north-up with a comfortable tilt. */
  resetView() {
    if (this.mode === 'walk') { this.pitch = 0; this.walkFov = WALK_FOV; return; }
    this.flyTo(this.target.clone(), this.goalRadius, { theta: 0, phi: 1.0, duration: 0.8 });
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
    turn += this.hold.rotate;
    const stickRun = Math.hypot(this.joystick.x, this.joystick.y) > 0.92;
    const pad = this.pad;
    fwd -= pad.ly;
    strafe += pad.lx;
    up += pad.zoom;
    this._padLook(dt);

    if (this.mode === 'orbit') this._updateOrbit(dt, fwd, strafe, up, turn, run || pad.run);
    else this._updateWalk(dt, fwd, strafe, up, turn, run || stickRun || pad.run);
  }

  /** Right stick: squared response for fine aim near the centre, full deflection turns quickly. */
  _padLook(dt) {
    const { rx, ry, lens } = this.pad;
    const cx = rx * Math.abs(rx), cy = ry * Math.abs(ry);
    if (this.mode === 'orbit') {
      if (cx) this.goalTheta -= cx * dt * 2.2;
      if (cy) this.goalPhi = clamp(this.goalPhi - cy * dt * 1.3, this.minPhi, this.maxPhi);
    } else {
      const k = this.walkFov / WALK_FOV;
      if (cx) this.yaw -= cx * dt * 2.6 * k;
      if (cy) this.pitch = clamp(this.pitch - cy * dt * 1.8 * k, -1.45, 1.45);
      if (lens) this.walkFov = clamp(this.walkFov * Math.exp(-lens * dt * 1.2), 18, 80);
    }
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
      const zoom = up + this.hold.zoom;
      if (zoom) this.goalRadius = clamp(this.goalRadius * Math.exp(-zoom * dt * 1.6), this.minRadius, this.maxRadius);
      const k = 1 - Math.exp(-dt * 8);
      this.target.lerp(this.goalTarget, k);
      this.radius += (this.goalRadius - this.radius) * k;
      this.theta += (this.goalTheta - this.theta) * k;
      this.phi += (this.goalPhi - this.phi) * k;
    }
    this._clampTarget(this.goalTarget);
    this._clampTarget(this.target);
    const groundAtTarget = Math.max(0, this.groundHeight(this.target.x, this.target.z));
    if (!this.anim) this.goalTarget.y += (groundAtTarget + 1 - this.goalTarget.y) * Math.min(1, dt * 2) * (this.goalTarget.y < groundAtTarget + 1 ? 1 : 0.15);
    if (this.camera.fov !== ORBIT_FOV) {
      this.camera.fov += (ORBIT_FOV - this.camera.fov) * Math.min(1, dt * 8);
      if (Math.abs(this.camera.fov - ORBIT_FOV) < 0.05) this.camera.fov = ORBIT_FOV;
      this.camera.updateProjectionMatrix();
    }
    this._applyOrbit();
  }

  _updateWalk(dt, fwd, strafe, up, turn, run) {
    const speed = (run ? 12 : 4.5) * (1 + this.flyHeight / 15) * dt;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.walkPos.addScaledVector(f, fwd * speed).addScaledVector(r, strafe * speed);
    this.walkPos.x = clamp(this.walkPos.x, -this.limit, this.limit);
    this.walkPos.z = clamp(this.walkPos.z, -this.limit, this.limit);
    if (turn) this.yaw += turn * dt * 1.5;
    if (this.hold.zoom) this.walkFov = clamp(this.walkFov * Math.exp(-this.hold.zoom * dt * 1.2), 18, 80);
    if (up) this.flyHeight = clamp(this.flyHeight + up * dt * (run ? 30 : 10), 0, 250);
    const ground = Math.max(0.15, this.groundHeight(this.walkPos.x, this.walkPos.z));
    const targetY = ground + this.eyeHeight + this.flyHeight;
    this.walkPos.y += (targetY - this.walkPos.y) * Math.min(1, dt * 10);
    this.camera.position.copy(this.walkPos);
    if (fwd && this.flyHeight === 0) this.camera.position.y += Math.sin(performance.now() * 0.012) * 0.03;
    const look = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(look));
    if (Math.abs(this.camera.fov - this.walkFov) > 0.01) {
      this.camera.fov += (this.walkFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
  }

  get focus() { return this.mode === 'orbit' ? this.target : this.walkPos; }
}
