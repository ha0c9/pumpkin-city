// Game controller input (Xbox layout, browser "standard" mapping), polled once per frame.
//
// Sticks / triggers are written into `controls.pad`; buttons fire on press:
//   A pick what is at the screen centre (double-press flies there) · B close the card · X face north · Y orbit / walk
//   LB / RB previous / next place (walk: lens wide / tele) · L3 sprint until the stick is released
//   D-pad ← → time of day (hold) · ↑ ↓ weather · View guide card · Menu settings panel
const DEAD = 0.16;
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const WEATHER = ['sunny', 'rain', 'typhoon'];

/** Radial dead zone, rescaled so the response starts at 0 just outside it. */
function stick(x, y) {
  const len = Math.hypot(x, y);
  if (len < DEAD) return [0, 0];
  const k = Math.min(1, (len - DEAD) / (1 - DEAD)) / len;
  return [x * k, y * k];
}

export class GamepadInput {
  constructor({ controls, interaction, env, ui, places }) {
    this.controls = controls;
    this.interaction = interaction;
    this.env = env;
    this.ui = ui;
    this.places = places;
    this.placeIndex = -1;
    this.prev = [];
    this.sprint = false;
    this.lastA = 0;
    this.index = null;
    window.addEventListener('gamepadconnected', (e) => {
      this.index = e.gamepad.index;
      ui.gamepad = true;
      ui.showTips(controls.mode);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index !== this.index) return;
      this.index = null;
      ui.gamepad = false;
      this._release();
    });
  }

  _pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.index !== null && pads[this.index]?.connected) return pads[this.index];
    for (const p of pads) {
      if (p && p.connected && p.mapping === 'standard') { this.index = p.index; this.ui.gamepad = true; return p; }
    }
    return null;
  }

  _release() {
    const p = this.controls.pad;
    p.lx = p.ly = p.rx = p.ry = p.zoom = p.lens = 0;
    p.run = false;
    this.prev = [];
  }

  update(dt) {
    const gp = this._pad();
    if (!gp) return;
    if (document.hidden || !this.controls.enabled) { this._release(); return; }
    const c = this.controls, p = c.pad;
    const down = gp.buttons.map((b) => b.pressed);
    const val = (i) => gp.buttons[i]?.value ?? 0;
    const prev = this.prev;
    const pressed = (i) => down[i] && !prev[i];
    this.prev = down;

    [p.lx, p.ly] = stick(gp.axes[0] || 0, gp.axes[1] || 0);
    [p.rx, p.ry] = stick(gp.axes[2] || 0, gp.axes[3] || 0);
    const lt = val(BTN.LT), rt = val(BTN.RT);
    p.zoom = (rt > 0.05 ? rt : 0) - (lt > 0.05 ? lt : 0);
    const walk = c.mode === 'walk';
    p.lens = walk ? (down[BTN.RB] ? 1 : 0) - (down[BTN.LB] ? 1 : 0) : 0;
    if (pressed(BTN.L3)) this.sprint = true;
    if (Math.hypot(p.lx, p.ly) < 0.2) this.sprint = false;
    p.run = this.sprint;
    if (p.lx || p.ly || p.rx || p.ry || p.zoom) c.anim = null;

    const tips = document.getElementById('tips');
    if (pressed(BTN.A)) {
      if (!tips.hidden) tips.querySelector('.ok').click();
      else {
        const r = c.dom.getBoundingClientRect();
        const now = performance.now();
        this.interaction.click(r.left + r.width / 2, r.top + r.height / 2, now - this.lastA < 400);
        this.lastA = now;
      }
    }
    if (pressed(BTN.B)) {
      if (!tips.hidden) tips.querySelector('.ok').click();
      else if (!this.ui.info.hidden) document.querySelector('#info .close').click();
    }
    if (pressed(BTN.X)) c.resetView();
    if (pressed(BTN.Y)) this._click(`.seg[data-group="mode"] button[data-value="${walk ? 'orbit' : 'walk'}"]`);
    if (!walk && (pressed(BTN.LB) || pressed(BTN.RB))) this._cyclePlace(pressed(BTN.RB) ? 1 : -1);
    if (pressed(BTN.UP) || pressed(BTN.DOWN)) {
      const i = WEATHER.indexOf(this.env.weather);
      const next = WEATHER[(i + (pressed(BTN.UP) ? 1 : WEATHER.length - 1)) % WEATHER.length];
      this._click(`.seg[data-group="weather"] button[data-value="${next}"]`);
    }
    const dTime = (down[BTN.RIGHT] ? 1 : 0) - (down[BTN.LEFT] ? 1 : 0);
    if (dTime) {
      this.env.autoTime = false;
      document.getElementById('auto-time').checked = false;
      this.env.setTime(this.env.time + dTime * dt * 2.5);
    }
    if (pressed(BTN.VIEW)) {
      if (tips.hidden) this.ui.showTips(c.mode, true);
      else tips.querySelector('.ok').click();
    }
    if (pressed(BTN.MENU)) this._click('#panel-toggle');
  }

  _click(sel) { document.querySelector(sel)?.click(); }

  _cyclePlace(step) {
    const n = this.places.length;
    if (!n) return;
    this.placeIndex = ((this.placeIndex + step) % n + n) % n;
    const place = this.places[this.placeIndex];
    this.interaction.focusOn(place.info);
    this.ui.showInfo(place.info, () => this.interaction.focusOn(place.info));
  }
}
