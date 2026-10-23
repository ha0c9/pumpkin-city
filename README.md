# Pumpkin Island · 南瓜岛

由五座不规则大岛组成的 Three.js r128 WebGL 群岛城市。纯静态页面（原生 ES Modules，无需构建），可直接部署到 GitHub Pages。

在线访问（启用 Pages 后）：<https://ha0c9.github.io/pumpkin-city/>

## 功能

| 模块 | 内容 |
| --- | --- |
| 水域 | GPU 高度场波纹模拟（随镜头移动）、多尺度波谱细节法线（近处细碎波纹、远处涌浪与白浪）、平面反射 + 屏幕空间折射、海床焦散、按水深着色、岸边泡沫、雨滴涟漪 |
| 建筑 | 美国大厦、美国博物馆、世界遗产博物馆、幽灵博物馆、海洋博物馆（巨轮造型）、海洋美术馆、科技馆、四季酒店（含游乐场：摩天轮 / 过山车 / 旋转木马）、如家酒店、江苏路第二小学（含传达室、南瓜校旗）、罗森便利店、建筑工地（塔吊动画）、城市公园；PBR 材质 + 阴影，夜晚亮灯 |
| 道路桥梁 | 每座岛有自己的路网；自动生成路口、斑马线、停止线、人行道、双黄中线、路灯、红绿灯与**路名牌**；拱桥 / 斜拉桥 / 梁桥连接各岛 |
| 交通 | 少量实例化汽车（轿车 / SUV / 出租车 / 公交）沿右侧车道行驶，路口转弯、遵守红绿灯、跟车保持车距，夜间亮车灯 |
| 动植物 | GPU 实例化草地（随风摆动）、阔叶树 / 松树 / 棕榈 / 灌木、礁石；小鹿、兔子、鸭子、海鸥 |
| 天气 | 晴天 / 雨天，昼夜循环（日出、正午、黄昏、夜晚，可自动） |
| 控制 | 环绕视角与漫游视角；地图式触控；缩放 / 旋转按钮与指北针复位；点选显示名称；双击飞到该处；左上角标题可隐藏 |

## 操作

**环绕模式（鼠标）**：左键拖动旋转 · 右键 / Shift+拖动平移 · 滚轮朝光标处缩放 · WASD / 方向键移动 · Q/E 缩放 · 单击查看名称 · 双击飞到该处

**环绕模式（触屏，与地图 App 一致）**：单指拖动平移地图 · 双指捏合缩放 · 双指扭转旋转 · 双指上下拖动调整俯仰 · 右侧按钮缩放 / 旋转（按住连续）· 指北针复位

**漫游模式**：WASD / 方向键前进后退 · 拖动环视（向左滑即向左看）· 滚轮或双指捏合调整视野 · E/Q 升降 · Shift 加速 · 双击传送；触屏时在屏幕左侧任意位置按住即出现摇杆，右侧滑动环视，右下角按钮升降

页面失去焦点、来电或手势被系统打断时会自动重置输入状态，避免出现无法缩放 / 操作的情况。「操作说明」可在设置面板中再次打开。

## 本地运行

ES Modules 需要通过 HTTP 访问：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`，推送到 `main` 后自动发布。首次使用需在
**Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

## 目录结构

```
index.html                 页面骨架 + UI（通过 cdnjs 加载 three r128）
css/style.css              UI 样式（含移动端适配）
assets/models/             glTF/GLB 模型（通过配置即可放置）
assets/textures/           图片纹理
js/
  main.js                  入口
  config/
    world.config.js        岛屿、水体、天空、画质预设
    city.layout.js         道路、桥梁、地标建筑、随机设施地块、动物  ← 日常扩展主要改这里
  core/
    App.js                 构建顺序与渲染循环
    Registry.js            建筑类型注册表
    CameraControls.js      环绕 / 漫游控制（鼠标、键盘、触控）
    Interaction.js         点选、高亮、信息卡、标签
    Mask.js                占地掩码（网格加速，植被避开道路与建筑）
    Textures.js / Utils.js 程序化纹理与几何工具
  world/                   岛屿形状（IslandField）、地形、水体、波纹模拟、天空、天气、道路、桥梁、街道设施、交通、城市布局
  buildings/               每种建筑一个模块，index.js 统一导入
  nature/                  草地、树木、动物
  ui/UI.js                 面板、信息卡、导航按钮、操作说明
tools/check-layout.mjs     布局检查：道路 / 建筑 / 桥梁是否重叠或落水，并输出俯视图 PNG
```

## 扩展指南

### 新增一种建筑

1. 新建 `js/buildings/Lighthouse.js`：

```js
import { registerBuilding } from '../core/Registry.js';
import { box } from './materials.js';
const THREE = window.THREE;

registerBuilding('lighthouse', {
  label: '灯塔 Lighthouse',   // 信息卡中的类别
  footprint: [8, 8],          // 占地 [宽, 深]（米），植被会自动避开
  create(ctx, spec, rng) {
    const g = new THREE.Group();          // 原点为地面中心，正面朝 +Z
    // ... 添加网格（castShadow / receiveShadow）
    g.userData.height = 30;               // 用于聚焦距离
    // 可选：g.userData.treeSpots = [[x, z], ...]  周边种树位置（局部坐标）
    // 可选：g.userData.animate = (time) => {...} 每帧动画（time 为秒）
    // 可选：ctx.nightMaterials.push({ material, intensity }) 夜间按 emissiveIntensity 发光
    return g;
  },
});
```

2. 在 `js/buildings/index.js` 中 `import './Lighthouse.js';`
3. 在 `js/config/city.layout.js` 的 `LANDMARKS` 中放置（固定位置），或加入 `RANDOM_FACILITIES.picks`（随机地块）：

```js
{ type: 'lighthouse', id: 'lighthouse', name: '灯塔', nameEn: 'Lighthouse',
  description: '……', position: [60, 80], rotation: 0 },
```

### 使用 glTF 模型

把模型放入 `assets/models/`，无需写代码，直接在 `LANDMARKS` 中添加：

```js
{ type: 'gltf', id: 'cafe', name: '海边咖啡馆', nameEn: 'Seaside Cafe',
  url: 'assets/models/cafe.glb', position: [70, 30], rotation: 0, scale: 1, footprint: [12, 10] },
```

### 其他

- **道路**：在 `ROADS` 中添加轴对齐线段（含 `name` / `nameEn`），路口、斑马线、路灯、路名牌会自动生成，汽车也会自动使用新道路。
- **桥梁**：在 `BRIDGES` 中指定起点、方向、目标岛屿与样式（`arch` / `cable` / `beam`）。
- **岛屿**：在 `world.config.js` 的 `ISLANDS` 中用若干圆 `blobs: [[x, z, r], ...]` 平滑拼合成不规则岛形。
- **地块**：在 `LOTS` 中添加地块；`RANDOM_FACILITIES.picks` 决定便利店、建筑工地等随机设施的数量，未使用的地块自动变为城市公园 / 花园。
- **汽车数量**：`world.config.js` 中 `QUALITY.carCount`（手机与桌面分别设置）。
- **检查布局**：修改布局后运行 `npm run check-layout`（或 `node tools/check-layout.mjs map.png`），输出 `layout OK` 即无冲突。

## 参考

- [evanw/webgl-water](https://github.com/evanw/webgl-water)：高度场波纹与焦散思路
- [three.js GPGPU water 示例](https://threejs.org/examples/#webgl_gpgpu_water)
- three.js r128 `Reflector` / `Refractor` 实现（平面反射与折射的相机镜像方法）
