// DOM UI: settings panel, info card, places list, loader, hints and touch joystick.
import { IS_MOBILE } from '../config/world.config.js';

const $ = (sel, root = document) => root.querySelector(sel);

function fmtTime(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export class UI {
  constructor() {
    this.labelLayer = $('#labels');
    this.info = $('#info');
    this.panel = $('#panel');
    this.loader = $('#loader');
    this.isTouch = IS_MOBILE || matchMedia('(pointer: coarse)').matches;
    if (window.innerWidth <= 760) this.panel.classList.add('collapsed');
    $('#panel-toggle').addEventListener('click', () => this.panel.classList.toggle('collapsed'));
    $('.close', this.info).addEventListener('click', () => { this.hideInfo(); this.onCloseInfo?.(); });
  }

  progress(fraction, text) {
    $('.fill', this.loader).style.width = `${Math.round(fraction * 100)}%`;
    if (text) $('.status', this.loader).textContent = text;
  }

  error(text) {
    const s = $('.status', this.loader);
    s.textContent = text;
    s.classList.add('error');
  }

  done() {
    this.loader.classList.add('done');
    setTimeout(() => this.loader.remove(), 800);
  }

  bind(app) {
    const { env, controls, interaction } = app;
    const seg = (group, fn) => {
      const root = document.querySelector(`.seg[data-group="${group}"]`);
      root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        fn(b.dataset.value);
      }));
      return (value) => root.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.value === value));
    };
    seg('weather', (v) => env.setWeather(v));
    this.setModeButton = seg('mode', (v) => controls.setMode(v));
    controls.onChange((mode) => { this.setModeButton(mode); this._updateMode(mode); });

    const slider = $('#time-slider');
    const timeText = $('#time-text');
    const auto = $('#auto-time');
    slider.addEventListener('input', () => { env.setTime(parseFloat(slider.value)); auto.checked = false; env.autoTime = false; });
    document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
      env.setTime(parseFloat(b.dataset.time)); auto.checked = false; env.autoTime = false;
    }));
    auto.addEventListener('change', () => { env.autoTime = auto.checked; });
    this.syncTime = () => {
      if (document.activeElement !== slider) slider.value = env.time.toFixed(2);
      timeText.textContent = fmtTime(env.time);
    };
    $('#show-labels').addEventListener('change', (e) => interaction.setLabelsVisible(e.target.checked));

    this.onCloseInfo = () => interaction.clearSelection();
    this._setupJoystick(controls);
    this._updateMode('orbit');
  }

  setPlaces(places, onPick) {
    const root = $('#places');
    root.innerHTML = '';
    for (const p of places) {
      const b = document.createElement('button');
      b.innerHTML = `${p.name}${p.tag ? `<small>${p.tag}</small>` : ''}`;
      b.addEventListener('click', () => {
        onPick(p);
        if (window.innerWidth <= 760) this.panel.classList.add('collapsed');
      });
      root.appendChild(b);
    }
  }

  showInfo(info, onFocus) {
    const el = this.info;
    $('.cat', el).textContent = info.category || '';
    $('.name', el).textContent = info.name || '';
    $('.en', el).textContent = info.nameEn || '';
    $('.desc', el).textContent = info.description || '';
    $('.coords', el).textContent = info.coords || '';
    const btn = $('.focus-btn', el);
    btn.onclick = onFocus;
    btn.style.display = onFocus ? '' : 'none';
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  hideInfo() { this.info.hidden = true; }

  _updateMode(mode) {
    const walk = mode === 'walk';
    $('#joystick').hidden = !(walk && this.isTouch);
    $('#vbtns').hidden = !(walk && this.isTouch);
    this.info.classList.toggle('with-joystick', walk && this.isTouch);
    const hint = $('#hint');
    hint.textContent = walk
      ? 'WASD / 方向键 前进后退 · 拖动环视 · E/Q 升降 · Shift 加速 · 双击传送'
      : '拖动旋转 360° · 滚轮缩放 · 右键/Shift 平移 · WASD 前进后退 · 点击查看名称 · 双击飞到该处';
  }

  _setupJoystick(controls) {
    const pad = $('#joystick'), knob = $('.knob', pad);
    let id = null;
    const set = (e) => {
      const r = pad.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      controls.joystick.x = x; controls.joystick.y = y;
      knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    };
    pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); set(e); e.stopPropagation(); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; controls.joystick.x = 0; controls.joystick.y = 0; knob.style.transform = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    document.querySelectorAll('#vbtns button').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { controls.vertical = parseFloat(b.dataset.v); b.setPointerCapture(e.pointerId); });
      const stop = () => { controls.vertical = 0; };
      b.addEventListener('pointerup', stop);
      b.addEventListener('pointercancel', stop);
    });
  }
}
