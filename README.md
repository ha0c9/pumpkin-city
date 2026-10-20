# Pumpkin Island · 南瓜岛

由五座岛屿组成的 Three.js r128 WebGL 城市。纯静态页面（原生 ES Modules，无需构建），可直接部署到 GitHub Pages。

在线访问（启用 Pages 后）：<https://ha0c9.github.io/pumpkin-city/>

## 功能

| 模块 | 内容 |
| --- | --- |
| 水域 | GPU 高度场波纹模拟（ping-pong 半浮点纹理）、平面反射 + 屏幕空间折射、海床移动焦散、按水深着色（浅滩 turquoise → 深海 sapphire）、岸边泡沫、雨滴涟漪 |
| 建筑 | 玻璃幕墙超高层「美国大厦」、「世界遗产博物馆」、随机分布的便利店 / 学校、口袋公园；PBR 材质 + 环境反射 + 实时阴影，夜晚窗户亮灯 |
| 道路桥梁 | 自动生成路口、斑马线、停止线、人行道、路缘石、双黄中线、车道虚线、路灯（夜间点亮）、红绿灯；拱桥 / 斜拉桥 / 梁桥连接各岛 |
| 动植物 | GPU 实例化草地（随风摆动）、阔叶树 / 松树 / 棕榈 / 灌木、礁石；小鹿、兔子、鸭子、海鸥 |
| 天气 | 晴天 / 雨天，昼夜循环（日出、正午、黄昏、夜晚，可自动） |
| 控制 | 环绕视角与漫游视角；缩放、360° 旋转、平移、前进后退；点选建筑 / 设施 / 地点显示名称；双击飞到该处；手机触控与虚拟摇杆 |

## 操作

**环绕模式**：左键拖动旋转 · 右键 / Shift+拖动平移 · 滚轮缩放 · WASD / 方向键移动 · Q/E 缩放 · 单击查看名称 · 双击飞到该处

**漫游模式**：WASD / 方向键前进后退 · 拖动环视 · E/Q 升降 · Shift 加速 · 双击传送

**手机**：单指旋转 · 双指缩放 / 平移 / 旋转 · 漫游模式下使用左下角摇杆与右下角升降按钮

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
    Mask.js                占地掩码（植被避开道路与建筑）
    Textures.js / Utils.js 程序化纹理与几何工具
  world/                   地形、水体、波纹模拟、天空、天气、道路、桥梁、街道设施、城市布局
  buildings/               每种建筑一个模块，index.js 统一导入
  nature/                  草地、树木、动物
  ui/UI.js                 面板、信息卡、摇杆
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

- **道路**：在 `ROADS` 中添加轴对齐线段，路口、斑马线、路灯会自动生成。
- **桥梁**：在 `BRIDGES` 中指定起点、方向、目标岛屿与样式（`arch` / `cable` / `beam`）。
- **岛屿**：在 `world.config.js` 的 `ISLANDS` 中添加中心、半径与地形参数。
- **地块**：在 `LOTS` 中添加地块，未使用的地块自动变为公园 / 花园。

## 参考

- [evanw/webgl-water](https://github.com/evanw/webgl-water)：高度场波纹与焦散思路
- [three.js GPGPU water 示例](https://threejs.org/examples/#webgl_gpgpu_water)
- three.js r128 `Reflector` / `Refractor` 实现（平面反射与折射的相机镜像方法）
