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
    this._setupTitle();
  }

  _store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(`pumpkin.${key}`);
      localStorage.setItem(`pumpkin.${key}`, value);
    } catch (_) { /* storage disabled (private mode) */ }
    return null;
  }

  _setupTitle() {
    const title = $('#title'), box = $('#show-title');
    const apply = (show) => {
      title.classList.toggle('hidden', !show);
      box.checked = show;
      this._store('title', show ? '1' : '0');
    };
    apply(this._store('title') !== '0');
    $('.hide-title', title).addEventListener('click', () => apply(false));
    box.addEventListener('change', () => apply(box.checked));
  }

  showContextLost() { $('#lost').hidden = false; }

  /** Gesture help card. Shown once per mode on first use, or on demand from the panel. */
  showTips(mode, force = false) {
    const key = `tips.${mode}.${this.isTouch ? 'touch' : 'mouse'}`;
    if (!force && this._store(key) === '1') return;
    const touch = this.isTouch;
    const rows = mode === 'walk'
      ? (touch ? [
        ['左半屏', '按住任意位置出现摇杆，向前推前进，推到底奔跑'],
        ['右半屏滑动', '环顾四周：向左滑向左看，向上滑向上看'],
        ['双指捏合', '拉近 / 拉远镜头'],
        ['▲ ▼', '升空 / 下降，俯瞰街道'],
        ['双击', '瞬间移动到该处'],
      ] : [
        ['W A S D', '前进、后退、左右平移（Shift 奔跑）'],
        ['拖动鼠标', '环顾四周：向左拖向左看'],
        ['滚轮', '拉近 / 拉远镜头'],
        ['E / Q', '升空 / 下降'],
        ['双击', '瞬间移动到该处'],
      ])
      : (touch ? [
        ['单指拖动', '平移地图，手指按住的地面会跟着手指走'],
        ['双指捏合', '以双指中心缩放'],
        ['双指旋转', '旋转视角 360°'],
        ['双指上下滑', '调整俯仰角度'],
        ['右侧按钮', '+ / − 缩放，↺ ↻ 旋转，指南针复位朝北'],
        ['点击 / 双击', '查看名称 / 飞到该处'],
      ] : [
        ['左键拖动', '旋转视角 360°（上下拖动调整俯仰）'],
        ['右键拖动', '平移地图（或按住 Shift 拖动）'],
        ['滚轮', '向鼠标所指位置缩放'],
        ['W A S D', '前进后退、左右移动（方向键左右旋转）'],
        ['点击 / 双击', '查看名称 / 飞到该处'],
      ]);
    const card = $('#tips');
    $('h3', card).textContent = mode === 'walk' ? '漫游模式 · 操作说明' : '环绕模式 · 操作说明';
    $('ul', card).innerHTML = rows.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('');
    card.hidden = false;
    $('.ok', card).onclick = () => { card.hidden = true; this._store(key, '1'); };
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
    this._setupButtons(controls);
    this._controls = controls;
    $('#show-help').addEventListener('click', () => this.showTips(controls.mode, true));
    this._updateMode('orbit');
    setTimeout(() => this.showTips('orbit'), 900);
    // Keep the compass pointing north as the view rotates.
    const needle = $('#compass svg');
    const spin = () => {
      const a = controls.mode === 'orbit' ? controls.theta : controls.yaw;
      needle.style.transform = `rotate(${(a * 180 / Math.PI).toFixed(1)}deg)`;
      requestAnimationFrame(spin);
    };
    spin();
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
    $('#vbtns').hidden = !walk;
    this.info.classList.toggle('with-joystick', walk && this.isTouch);
    if (!this.walkZone) {
      this.walkZone = document.createElement('div');
      this.walkZone.className = 'walk-zone';
      this.walkZone.textContent = '按住此区域移动';
      document.body.appendChild(this.walkZone);
    }
    this.walkZone.hidden = !(walk && this.isTouch);
    const hint = $('#hint');
    hint.textContent = walk
      ? 'WASD 移动 · 拖动环视（向左拖向左看）· 滚轮变焦 · E/Q 升降 · Shift 奔跑 · 双击传送'
      : '左键拖动旋转 · 右键拖动平移 · 滚轮缩放 · WASD 移动 · 点击查看名称 · 双击飞到该处';
    if (this._controls) this.showTips(mode);
  }

  /** Press-and-hold buttons: zoom / rotate (both modes) and up / down (walk). */
  _setupButtons(controls) {
    const hold = (b, start, stop) => {
      let id = null;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId;
        try { b.setPointerCapture(id); } catch (_) { /* ignore */ }
        b.classList.add('on');
        start();
      });
      const end = (e) => { if (e.pointerId !== id) return; id = null; b.classList.remove('on'); stop(); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, end);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    document.querySelectorAll('#nav [data-hold]').forEach((b) => {
      const key = b.dataset.hold, v = parseFloat(b.dataset.v);
      hold(b, () => { controls.anim = null; controls.hold[key] = v; }, () => { controls.hold[key] = 0; });
    });
    $('#compass').addEventListener('click', () => controls.resetView());
    document.querySelectorAll('#vbtns button').forEach((b) => {
      hold(b, () => { controls.vertical = parseFloat(b.dataset.v); }, () => { controls.vertical = 0; });
    });
  }
}
