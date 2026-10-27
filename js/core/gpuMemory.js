// Approximate GPU memory for the ?perf=1 overlay, plus CPU-image release after upload.
// Sizes are width * height * bytes-per-pixel * mipmap factor. They match what WebGL stores
// for these formats; they do not include the browser's MSAA resolve buffer.
const THREE = window.THREE;

function channels(tex) {
  const f = tex.format;
  if (f === THREE.RGBFormat) return 3;
  if (f === THREE.RGFormat || f === THREE.LuminanceAlphaFormat) return 2;
  if (f === THREE.RedFormat || f === THREE.LuminanceFormat || f === THREE.AlphaFormat || f === THREE.DepthFormat) return 1;
  return 4;
}

function bytesPerPixel(tex) {
  let bpc = 1;
  if (tex.type === THREE.FloatType) bpc = 4;
  else if (tex.type === THREE.HalfFloatType || tex.type === THREE.UnsignedShortType) bpc = 2;
  return channels(tex) * bpc;
}

function mipFactor(tex) {
  const m = tex.minFilter;
  const mip = m === THREE.LinearMipmapLinearFilter || m === THREE.LinearMipmapNearestFilter
    || m === THREE.NearestMipmapLinearFilter || m === THREE.NearestMipmapNearestFilter;
  return mip && tex.generateMipmaps !== false ? 4 / 3 : 1;
}

export function textureBytes(tex) {
  if (!tex || !tex.isTexture) return 0;
  const img = tex.image || {};
  const w = img.width || 0;
  const h = img.height || 0;
  if (!w || !h) return 0;
  return w * h * bytesPerPixel(tex) * mipFactor(tex);
}

function addTex(set, tex) {
  if (tex && tex.isTexture) set.add(tex);
}

export function collectTextures(app) {
  const set = new Set();
  app.ctx.scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k in m) addTex(set, m[k]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) addTex(set, u && u.value);
    }
  });
  addTex(set, app.ground && app.ground.texture);
  addTex(set, app.terrain && app.terrain.depthTexture);
  const sim = app.water && app.water.sim;
  addTex(set, sim && sim.rtA && sim.rtA.texture);
  addTex(set, sim && sim.rtB && sim.rtB.texture);
  addTex(set, sim && sim.texture);
  addTex(set, app.water && app.water.reflRT && app.water.reflRT.texture);
  addTex(set, app.water && app.water.refrRT && app.water.refrRT.texture);
  addTex(set, app.water && app.water.spectrum && app.water.spectrum.texture);
  addTex(set, app.sky && app.sky.envRT && app.sky.envRT.texture);
  addTex(set, app.ctx.scene.environment);
  const shadow = app.env && app.env.sun && app.env.sun.shadow && app.env.sun.shadow.map;
  addTex(set, shadow && shadow.texture);
  return set;
}

function labelOf(app, tex) {
  if (app.ground && tex === app.ground.texture) return 'ground';
  if (app.terrain && tex === app.terrain.depthTexture) return 'depth';
  if (app.water && app.water.reflRT && tex === app.water.reflRT.texture) return 'refl';
  if (app.water && app.water.refrRT && tex === app.water.refrRT.texture) return 'refr';
  if (app.water && app.water.spectrum && tex === app.water.spectrum.texture) return 'wave';
  if (app.water && app.water.sim && (tex === app.water.sim.rtA?.texture || tex === app.water.sim.rtB?.texture)) return 'ripple';
  if (app.sky && app.sky.envRT && tex === app.sky.envRT.texture) return 'env';
  const shadow = app.env && app.env.sun && app.env.sun.shadow && app.env.sun.shadow.map;
  if (shadow && tex === shadow.texture) return 'shadow';
  if (tex.isCanvasTexture) return 'facade';
  return 'other';
}

function rtDepthBytes(rt) {
  if (!rt || rt.depthBuffer === false) return 0;
  return (rt.width || 0) * (rt.height || 0) * 4;
}

/** Rough retained GPU bytes: textures, render-target depth, geometry buffers, and the drawing buffer. */
export function estimateGpu(app) {
  const textures = collectTextures(app);
  const groups = {};
  let texBytes = 0;
  for (const tex of textures) {
    const n = textureBytes(tex);
    texBytes += n;
    const k = labelOf(app, tex);
    groups[k] = (groups[k] || 0) + n;
  }
  let depthBytes = 0;
  const water = app.water;
  if (water) {
    depthBytes += rtDepthBytes(water.reflRT) + rtDepthBytes(water.refrRT);
    depthBytes += rtDepthBytes(water.spectrum && water.spectrum.rt);
    depthBytes += rtDepthBytes(water.sim && water.sim.rtA) + rtDepthBytes(water.sim && water.sim.rtB);
  }
  const shadow = app.env && app.env.sun && app.env.sun.shadow && app.env.sun.shadow.map;
  depthBytes += rtDepthBytes(shadow);
  const gl = app.ctx.renderer.getContext();
  const fbBytes = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
  const seen = new Set();
  let geoBytes = 0;
  let geoCount = 0;
  app.ctx.scene.traverse((o) => {
    const g = o.geometry;
    if (!g || seen.has(g)) return;
    seen.add(g);
    geoCount++;
    for (const a of Object.values(g.attributes || {})) if (a && a.array) geoBytes += a.array.byteLength;
    if (g.index && g.index.array) geoBytes += g.index.array.byteLength;
  });
  const info = app.ctx.renderer.info.memory;
  const mb = (n) => (n / (1024 * 1024));
  const total = texBytes + depthBytes + fbBytes * 2 + geoBytes;
  const line = (k) => `${k} ${mb(groups[k] || 0).toFixed(1)}`;
  return {
    total, texBytes, geoBytes, depthBytes, fbBytes,
    texCount: textures.size, geoCount,
    infoGeometries: info.geometries, infoTextures: info.textures,
    groups,
    text: [
      `gpu ~${mb(total).toFixed(0)} MB   tex ${mb(texBytes).toFixed(0)}  geo ${mb(geoBytes).toFixed(0)}  rt-depth ${mb(depthBytes).toFixed(1)}  fb ${mb(fbBytes * 2).toFixed(1)}`,
      `${line('ground')}  ${line('facade')}  ${line('shadow')}  ${line('depth')}`,
      `${line('refl')}  ${line('refr')}  ${line('wave')}  ${line('ripple')}  ${line('env')}  ${line('other')}`,
      `textures ${textures.size} (${info.textures} uploaded)   geometries ${geoCount} (${info.geometries} uploaded)`,
    ].join('\n'),
  };
}

/**
 * Drop CPU copies of textures WebGL has already uploaded. iOS counts these canvases and
 * typed arrays against the tab limit together with VRAM. Render targets are left alone.
 * A canvas shared by cloned textures is kept until every user has uploaded.
 */
function gpuUploaded(renderer, tex) {
  // Texture.needsUpdate is a setter with no getter in r128, so it cannot be read back.
  const props = renderer.properties.get(tex);
  return !!(props && props.__webglTexture && props.__version === tex.version);
}

export function releaseTextureCpu(textures, renderer) {
  const groups = new Map();
  for (const tex of textures) {
    if (!tex || tex.isRenderTargetTexture) continue;
    if (!tex.userData) tex.userData = {};
    if (tex.userData._cpuReleased) continue;
    const img = tex.image;
    if (!img) continue;
    let key = null;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement && img.width > 1) key = img;
    else if (img.data && img.data.byteLength > 64) key = img.data;
    if (!key) continue;
    let list = groups.get(key);
    if (!list) groups.set(key, list = []);
    list.push(tex);
  }
  for (const [img, list] of groups) {
    // Keep the bitmap until every texture that shares it has a real WebGL upload.
    // needsUpdate cannot be read in r128 (setter only), so this uses the renderer property cache.
    if (list.some((t) => !gpuUploaded(renderer, t))) continue;
    const sample = list[0].image;
    const w = sample.width, h = sample.height;
    const stub = img instanceof HTMLCanvasElement ? { width: w, height: h } : { width: w, height: h, data: null };
    if (img instanceof HTMLCanvasElement) { img.width = 1; img.height = 1; }
    for (const t of list) {
      if (!t.userData) t.userData = {};
      t.image = stub;
      t.needsUpdate = false;
      t.userData._cpuReleased = 1;
    }
  }
}

/** Best-effort release after webglcontextlost, so a following reload does not stack a second copy. */
export function disposeAppGpu(app) {
  if (!app || !app.ctx) return;
  const seenT = new Set();
  const seenG = new Set();
  const tossT = (t) => {
    if (!t || !t.isTexture || seenT.has(t)) return;
    seenT.add(t);
    try { t.dispose(); } catch (_) { /* context already gone */ }
  };
  const tossM = (m) => {
    if (!m || m._gpuDisposed) return;
    m._gpuDisposed = 1;
    for (const k in m) tossT(m[k]);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) tossT(u && u.value);
    try { m.dispose(); } catch (_) { /* context already gone */ }
  };
  try {
    app.ctx.scene.traverse((o) => {
      if (o.geometry && !seenG.has(o.geometry)) {
        seenG.add(o.geometry);
        try { o.geometry.dispose(); } catch (_) { /* context already gone */ }
      }
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(tossM);
      }
    });
  } catch (_) { /* context already gone */ }
  const water = app.water;
  try { water && water.reflRT && water.reflRT.dispose(); } catch (_) {}
  try { water && water.refrRT && water.refrRT.dispose(); } catch (_) {}
  try { water && water.spectrum && water.spectrum.rt && water.spectrum.rt.dispose(); } catch (_) {}
  try { water && water.sim && water.sim.release && water.sim.release(); } catch (_) {}
  try { app.sky && app.sky.envRT && app.sky.envRT.dispose(); } catch (_) {}
  try { app.sky && app.sky.pmrem && app.sky.pmrem.dispose && app.sky.pmrem.dispose(); } catch (_) {}
  const shadow = app.env && app.env.sun && app.env.sun.shadow && app.env.sun.shadow.map;
  try { shadow && shadow.dispose(); } catch (_) {}
  try { app.ctx.renderer.dispose(); } catch (_) {}
}
