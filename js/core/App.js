// Application bootstrap: renderer, world assembly, render loop.
import { QUALITY } from '../config/world.config.js';
import { OccupancyMask } from './Mask.js';
import { CameraControls } from './CameraControls.js';
import { Interaction } from './Interaction.js';
import { GamepadInput } from './Gamepad.js';
import { lerp, clamp } from './Utils.js';
import { Terrain } from '../world/Terrain.js';
import { Water, LAYER_DETAIL } from '../world/Water.js';
import { Sky } from '../world/Sky.js';
import { Environment } from '../world/Environment.js';
import { Bridges } from '../world/Bridges.js';
import { RoadNetwork } from '../world/Roads.js';
import { StreetFurniture } from '../world/StreetFurniture.js';
import { City } from '../world/City.js';
import { Traffic } from '../world/Traffic.js';
import { GroundMap } from '../nature/GroundMap.js';
import { Grass } from '../nature/Grass.js';
import { Trees } from '../nature/Trees.js';
import { Animals } from '../nature/Animals.js';

const THREE = window.THREE;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class App {
  constructor(container, ui) {
    this.container = container;
    this.ui = ui;
  }

  async init() {
    const ui = this.ui;
    ui.progress(0.05, '初始化渲染器…');
    const renderer = new THREE.WebGLRenderer({ antialias: QUALITY.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(QUALITY.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.container.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.showContextLost(); });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 7000);
    camera.layers.enable(LAYER_DETAIL);

    const ctx = this.ctx = {
      renderer, scene, camera,
      mask: new OccupancyMask(),
      pickables: [], nightMaterials: [], wetMaterials: [], animators: [],
      uniforms: {
        uTime: { value: 0 }, uRain: { value: 0 }, uStorm: { value: 0 }, uDaylight: { value: 1 }, uSunset: { value: 0 }, uNight: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uSunColor: { value: new THREE.Vector3(1, 1, 1) }, uAmbient: { value: new THREE.Vector3(0.3, 0.35, 0.4) },
        uSimTex: { value: null }, uSimBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
        uWaterTint: { value: new THREE.Vector3(0.5, 0.8, 0.9) },
      },
    };

    ui.progress(0.12, '生成岛屿地形…'); await nextFrame();
    this.terrain = new Terrain(ctx);
    ui.progress(0.25, '模拟海水…'); await nextFrame();
    this.water = new Water(ctx, this.terrain);
    this.sky = new Sky(ctx);
    this.env = new Environment(ctx, this.sky);

    ui.progress(0.35, '架设桥梁…'); await nextFrame();
    this.bridges = new Bridges(ctx, this.terrain);
    this.terrain.bridges = this.bridges;
    ui.progress(0.45, '规划道路…'); await nextFrame();
    this.roads = new RoadNetwork(ctx, this.terrain, this.bridges.connectorRoads());
    ui.progress(0.55, '建造城市…'); await nextFrame();
    this.city = new City(ctx, this.terrain);
    this.furniture = new StreetFurniture(ctx, [...this.roads.lamps, ...this.bridges.lamps], this.roads.signals);
    this.traffic = new Traffic(ctx, this.roads, this.bridges, QUALITY.carCount);

    ui.progress(0.68, '种植草地与树木…'); await nextFrame();
    this.ground = new GroundMap(this.terrain, ctx.mask, QUALITY.groundRes);
    this.grass = new Grass(ctx, this.ground);
    this.trees = new Trees(ctx, this.terrain, this.ground, ctx.mask, [...this.city.treeSpots, ...this.roads.streetTrees]);
    ui.progress(0.82, '小动物入住…'); await nextFrame();
    this.animals = new Animals(ctx, this.terrain, this.ground, ctx.mask, this.water);

    this.controls = new CameraControls(camera, renderer.domElement, {
      groundHeight: (x, z) => {
        const b = this.bridges.heightAt(x, z);
        return Math.max(this.terrain.heightAt(x, z), b === null ? -Infinity : b, 0);
      },
      walkable: (x, z) => (this.terrain.heightAt(x, z) > 0.6 || this.bridges.heightAt(x, z) !== null)
        && this.ctx.mask.hit(x, z, 2, 'building') === null,
      limit: 780,
    });
    this.controls.target.set(0, 6, -40);
    this.controls.goalTarget.copy(this.controls.target);
    this.controls.radius = 1100; this.controls.goalRadius = 340;
    this.controls.theta = 0.1; this.controls.goalTheta = 0.55;
    this.controls.phi = 0.45; this.controls.goalPhi = 1.0;

    this.interaction = new Interaction(ctx, { terrain: this.terrain, bridges: this.bridges, water: this.water, controls: this.controls, ui });
    this._labelsAndPlaces();

    ui.progress(0.92, '编译着色器…'); await nextFrame();
    this.env.apply(0, true, camera, this.controls.focus);
    this.controls.update(0);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.clock = new THREE.Clock();
    this.time = 0;
    this._frame();
    ui.bind(this);
    this.gamepad = new GamepadInput({ controls: this.controls, interaction: this.interaction, env: this.env, ui, places: this.places });
    ui.progress(1, '欢迎来到南瓜岛');
    await nextFrame();
    ui.done();
  }

  _labelsAndPlaces() {
    const it = this.interaction;
    const places = [];
    for (const b of this.city.buildings) {
      const info = b.info;
      if (!info.landmark) continue;
      const top = new THREE.Vector3(b.object.position.x, b.object.position.y + info.height + 3, b.object.position.z);
      it.addLabel(info.name, info.nameEn, top, info.featured && !info.minor ? 'featured' : 'minor');
      if (info.featured) places.push({ name: info.name, tag: info.category.split(' ')[0], info });
    }
    const islandText = {
      central: '南瓜岛的城市中心：5×5 街区路网，美国大厦 1 号楼（办公）与 2 号楼（酒店）、美国博物馆、世界遗产博物馆、江苏路第二小学、如家酒店、南瓜大道意面馆与建筑工地都在这里。西南的机场大桥通往机场岛。',
      east: '东林岛：四季酒店与它的游乐园（摩天轮、旋转木马、过山车），东侧是起伏的林地和松鼠，北端的明珠大桥一路下坡通往东方明珠岛。',
      north: '北原岛：群岛中地势最高的台地，北原斜拉桥一路上坡通到这里。雾林路边的幽灵博物馆、北原路旁的天文馆，以及大片草原、松林、野兔与松鼠。',
      pearl: '东方明珠岛：粉红明珠串起的东方明珠电视塔与香槟金色的福来大厦隔陆家嘴路相望，南侧是明珠马术训练场，草地上有孔雀，经明珠大桥与东林岛相连。',
      west: '西岭岛：高出海面的台地，科技馆坐落在西岭路旁，西侧山岭上松林茂密，常有小鹿和孔雀出没，近海有海豚。',
      south: '南湾岛：海边停泊着巨轮造型的海洋博物馆，旁边是贝壳屋顶的海洋美术馆，南湾路上是南湾机械厂；沙滩上有螃蟹，浅水里有海龟，外海常有海豚跃出水面。',
      airport: '机场岛：南瓜机场占着岛的中部。1 号、2 号航站楼是圆弧顶的两层玻璃幕墙，下层开门，上层接廊桥，西端有电梯。塔台在楼侧面的空地上。南北各有一组跑道。经机场大桥与南瓜中心岛相连。',
    };
    for (const isl of this.terrain.islands) {
      const h = Math.max(this.terrain.heightAt(isl.x, isl.z), 2);
      it.addLabel(isl.name, isl.nameEn, new THREE.Vector3(isl.x, h + 26, isl.z), 'island');
      places.push({ name: isl.name, tag: '岛屿', info: {
        name: isl.name, nameEn: isl.nameEn, category: '岛屿 Island',
        description: islandText[isl.id] || '草地、树林和小动物，预留未来扩建。',
        focus: [isl.x, h, isl.z], radius: Math.min(520, isl.radius * 2.0),
      } });
    }
    for (const b of this.bridges.items) {
      const mid = b.point(0.5, 0, 6);
      it.addLabel(b.cfg.name, '', mid, 'bridge');
      const info = b.group.userData.pick;
      places.push({ name: b.cfg.name, tag: '桥梁', info });
    }
    this.places = places;
    this.ui.setPlaces(places, (p) => {
      it.focusOn(p.info);
      this.ui.showInfo(p.info, () => it.focusOn(p.info));
    });
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const { renderer, camera } = this.ctx;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    this.water.setSize(w, h, renderer.getPixelRatio());
  }

  _frame() {
    requestAnimationFrame(() => this._frame());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    const { ctx } = this;
    const u = ctx.uniforms;
    u.uTime.value = this.time;

    this.gamepad?.update(dt);
    this.controls.update(dt);
    if (this.interaction.followTarget && this.controls.mode === 'orbit' && !this.controls.anim) {
      this.controls.goalTarget.lerp(this.interaction.followTarget.position, Math.min(1, dt * 2));
    }
    const focus = this.controls.focus;
    this.env.update(dt, ctx.camera, focus);
    this.ui.syncTime?.();
    this._updateShadowFrustum();
    this.water.follow(focus, ctx.camera);
    this.env.feedRain(this.water, focus);
    this.traffic.update(dt, this.time);
    this.grass.update(ctx.camera);
    this.animals.update(dt, this.time);
    const night = u.uNight.value;
    this.furniture.update(this.time, night, focus);
    for (const n of ctx.nightMaterials) {
      let v = (n.base || 0) + (n.always ? n.intensity : night * n.intensity);
      if (n.blink) v *= Math.sin(this.time * 3.2) > 0.2 ? 1 : 0.04;
      n.material.emissiveIntensity = v;
    }
    const rain = u.uRain.value;
    for (const w of ctx.wetMaterials) w.material.roughness = lerp(w.dry, w.wet, rain);
    for (const fn of ctx.animators) fn(this.time);

    this.water.update(dt);
    this.water.renderPasses(ctx.scene, ctx.camera, this.sky.mesh);
    this.sky.follow(ctx.camera);
    // Shadows are rendered in the main pass only: global clip planes from the water passes would cut the shadow map.
    ctx.renderer.shadowMap.needsUpdate = true;
    ctx.renderer.render(ctx.scene, ctx.camera);
    this.interaction.update(this.time);
  }

  _updateShadowFrustum() {
    const cam = this.env.sun.shadow.camera;
    const r = this.controls.mode === 'orbit' ? this.controls.radius : 40 + this.controls.flyHeight;
    const ext = clamp(r * 0.75, 45, 190);
    if (Math.abs(cam.right - ext) > 2) {
      cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
      cam.updateProjectionMatrix();
    }
  }
}
