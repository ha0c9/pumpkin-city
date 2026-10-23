// City layout: roads, bridges, landmark buildings and random facility lots.
// Positions are [x, z] in world meters (x = east, z = south). Rotation is around Y; a building's
// front faces local +Z, so rotation 0 faces +Z (south), PI faces -Z (north), PI/2 faces +X (east),
// -PI/2 faces -X (west). Run `node tools/check-layout.mjs` after editing to validate and draw a map.

const PI = Math.PI;

export const ROAD_STYLE = {
  laneWidth: 3.5,
  sidewalk: 2.6,
  curbHeight: 0.16,
  lampSpacing: 26,
};

/**
 * Roads must be axis-aligned segments. Intersections, crosswalks, sidewalks, lamps, traffic lights
 * and road-name signs are generated automatically wherever segments meet or cross.
 */
export const ROADS = [
  // --- 南瓜中心岛: 5 x 5 downtown grid ---
  { id: 'changning', name: '长宁路', nameEn: 'Changning Rd', from: [-75, -130], to: [150, -130], lanes: 2 },
  { id: 'yuyuan', name: '愚园路', nameEn: 'Yuyuan Rd', from: [-150, -65], to: [150, -65], lanes: 2 },
  { id: 'pumpkin-ave', name: '南瓜大道', nameEn: 'Pumpkin Ave', from: [-150, 0], to: [150, 0], lanes: 4 },
  { id: 'wuyi', name: '武夷路', nameEn: 'Wuyi Rd', from: [-150, 65], to: [150, 65], lanes: 2 },
  { id: 'yanan', name: '延安西路', nameEn: "W. Yan'an Rd", from: [-150, 130], to: [75, 130], lanes: 2 },
  { id: 'dingxi', name: '定西路', nameEn: 'Dingxi Rd', from: [-150, -65], to: [-150, 130], lanes: 2 },
  { id: 'jiangsu', name: '江苏路', nameEn: 'Jiangsu Rd', from: [-75, -130], to: [-75, 130], lanes: 2 },
  { id: 'zhongshan', name: '中山路', nameEn: 'Zhongshan Rd', from: [0, -130], to: [0, 130], lanes: 4 },
  { id: 'huashan', name: '华山路', nameEn: 'Huashan Rd', from: [75, -130], to: [75, 130], lanes: 2 },
  { id: 'panyu', name: '番禺路', nameEn: 'Panyu Rd', from: [150, -130], to: [150, 65], lanes: 2 },

  // --- 东林岛 ---
  { id: 'donglin', name: '东林大道', nameEn: 'Donglin Ave', from: [362, 0], to: [520, 0], lanes: 4 },
  { id: 'siji', name: '四季路', nameEn: 'Siji Rd', from: [450, -85], to: [450, 130], lanes: 2 },
  { id: 'linhai', name: '临海路', nameEn: 'Linhai Rd', from: [365, -60], to: [450, -60], lanes: 2 },

  // --- 北原岛 ---
  { id: 'beiyuan', name: '北原路', nameEn: 'Beiyuan Rd', from: [0, -375], to: [0, -530], lanes: 2 },
  { id: 'wulin', name: '雾林路', nameEn: 'Wulin Rd', from: [-85, -440], to: [95, -440], lanes: 2 },

  // --- 西岭岛 ---
  { id: 'xiling', name: '西岭路', nameEn: 'Xiling Rd', from: [-360, 0], to: [-480, 0], lanes: 4 },
  { id: 'keji', name: '科技路', nameEn: 'Keji Rd', from: [-430, -100], to: [-430, 105], lanes: 2 },

  // --- 南湾岛 ---
  { id: 'haiyang', name: '海洋路', nameEn: 'Haiyang Rd', from: [0, 368], to: [0, 535], lanes: 2 },
  { id: 'nanwan', name: '南湾路', nameEn: 'Nanwan Rd', from: [-85, 450], to: [125, 450], lanes: 2 },
];

/**
 * Bridges start at a road end and head in `dir` until they reach the `to` island. A connecting road
 * from `from` to the bridge abutment is created automatically, and on the far side the bridge joins
 * the first road found straight ahead (or ends in a short dead-end road).
 * style: 'arch' | 'cable' | 'beam'
 */
export const BRIDGES = [
  { id: 'bridge-east', name: '东林拱桥', nameEn: 'East Grove Arch Bridge', from: [150, 0], dir: [1, 0], to: 'east', lanes: 4, style: 'arch' },
  { id: 'bridge-north', name: '北原斜拉桥', nameEn: 'North Meadow Cable Bridge', from: [0, -130], dir: [0, -1], to: 'north', lanes: 2, style: 'cable' },
  { id: 'bridge-west', name: '西岭大桥', nameEn: 'West Ridge Bridge', from: [-150, 0], dir: [-1, 0], to: 'west', lanes: 4, style: 'beam' },
  { id: 'bridge-south', name: '南湾拱桥', nameEn: 'South Cove Arch Bridge', from: [0, 130], dir: [0, 1], to: 'south', lanes: 2, style: 'arch' },
];

/** Landmark buildings with fixed positions. `type` must be registered in js/buildings/index.js. */
export const LANDMARKS = [
  {
    type: 'americaTower', id: 'america-tower',
    name: '美国大厦', nameEn: 'America Tower',
    description: '南瓜岛最高的玻璃幕墙超高层建筑，高约 146 米，三段退台式造型，顶部设观景冠与航空障碍灯。',
    position: [39, -33], rotation: 0,
  },
  {
    type: 'americaMuseum', id: 'america-museum',
    name: '美国博物馆', nameEn: 'Museum of America',
    description: '典型的美国联邦风格建筑：红砖立面、白色科林斯柱廊与三角山花，中央钟楼顶着白色尖塔，门前是草坪与旗杆。',
    position: [-39, -33], rotation: 0,
  },
  {
    type: 'heritageMuseum', id: 'heritage-museum',
    name: '世界遗产博物馆', nameEn: 'World Heritage Museum',
    description: '新古典主义柱廊立面搭配玻璃穹顶，收藏来自世界各地的文化与自然遗产展品。',
    position: [39, -98], rotation: 0,
  },
  {
    type: 'school', id: 'jiangsu-road-no2',
    name: '江苏路第二小学', nameEn: 'Jiangsu Road No.2 Primary School',
    description: '校门朝向江苏路，设有传达室。三层教学楼、钟楼、200 米环形跑道、足球场与升旗台。',
    position: [-112.5, 34.2], rotation: PI / 2,
  },
  {
    type: 'homeInn', id: 'home-inn',
    name: '如家酒店', nameEn: 'Home Inn',
    description: '简约舒适的经济型连锁酒店，明黄色立面与蓝色招牌，共 6 层 120 间客房。',
    position: [112, -40], rotation: 0,
  },
  {
    type: 'fourSeasons', id: 'four-seasons',
    name: '四季酒店', nameEn: 'Four Seasons Hotel',
    description: '东林岛上的豪华度假酒店：双塔客房楼、空中连廊、无边泳池，园区内设有摩天轮、旋转木马和过山车的游乐场。',
    position: [406, 66], rotation: 0,
  },
  {
    type: 'ghostMuseum', id: 'ghost-museum',
    name: '幽灵博物馆', nameEn: 'Ghost Museum',
    description: '扭转的暗色塔身、悬浮的碎片与幽幽发光的裂缝，夜晚有幽灵在建筑周围游荡。展出世界各地的鬼怪传说。',
    position: [-44, -400], rotation: PI,
  },
  {
    type: 'oceanMuseum', id: 'ocean-museum',
    name: '海洋博物馆', nameEn: 'Ocean Museum',
    description: '一艘停靠在海边的巨轮造型建筑，船身内展出珊瑚礁、鲸类骨架与深海生物，甲板是观景平台。',
    position: [110, 492], rotation: 0,
  },
  {
    type: 'oceanGallery', id: 'ocean-gallery',
    name: '海洋美术馆', nameEn: 'Ocean Art Gallery',
    description: '像浪花与贝壳一样层层展开的白色曲面屋顶，展出以海洋为主题的绘画与雕塑。',
    position: [40, 498], rotation: 0,
  },
  {
    type: 'scienceMuseum', id: 'science-museum',
    name: '科技馆', nameEn: 'Science & Technology Museum',
    description: '悬浮的银色球幕影院、环形光带与参数化幕墙，展示航天、人工智能与新能源科技。',
    position: [-385, -48], rotation: 0,
  },
];

// Central grid helpers: lot rectangles between road centerlines, inset by the road half-width.
const roadHalf = (lanes) => (lanes * ROAD_STYLE.laneWidth) / 2 + ROAD_STYLE.sidewalk;
function block(x0, x1, z0, z1, { l = 2, r = 2, t = 2, b = 2 } = {}, inset = 1.5) {
  const ax = x0 + roadHalf(l) + inset, bx = x1 - roadHalf(r) - inset;
  const az = z0 + roadHalf(t) + inset, bz = z1 - roadHalf(b) - inset;
  return { position: [(ax + bx) / 2, (az + bz) / 2], size: [bx - ax, bz - az] };
}
const lot = (b, rotation) => ({ ...b, rotation });

/**
 * Random facilities are placed on lots with a seeded RNG, so the city is stable across reloads.
 * Change `seed` to reshuffle. Unused large lots become parks, unused small lots become gardens.
 */
export const RANDOM_FACILITIES = {
  seed: 20261023,
  picks: [
    { type: 'constructionSite', lot: 'large', count: 4 },
    { type: 'convenienceStore', lot: 'small', count: 5 },
  ],
};

export const LOTS = {
  large: [
    lot(block(-150, -75, -65, 0, { b: 4 }), 0),
    lot(block(-75, 0, -130, -65, { r: 4 }), PI),
    lot(block(-75, 0, 0, 65, { r: 4, t: 4 }), PI),
    lot(block(-75, 0, 65, 130, { r: 4 }), 0),
    lot(block(0, 75, 65, 130, { l: 4 }), 0),
    lot(block(75, 150, 0, 65, { t: 4 }), PI),
    lot(block(-150, -75, 65, 130), 0),
    { position: [112, -98], rotation: PI, size: [58, 50] },
    // 东林岛
    { position: [408, -32], rotation: 0, size: [66, 38] },
    // 北原岛
    { position: [50, -402], rotation: PI, size: [74, 60] },
    { position: [-42, -482], rotation: 0, size: [60, 64] },
    // 西岭岛
    { position: [-390, 52], rotation: PI, size: [56, 56] },
    // 南湾岛
    { position: [-38, 416], rotation: 0, size: [50, 50] },
  ],
  small: [
    { position: [24, 18], rotation: PI, size: [16, 12] },
    { position: [54, 18], rotation: PI, size: [16, 12] },
    { position: [24, 51], rotation: 0, size: [16, 12] },
    { position: [54, 51], rotation: 0, size: [16, 12] },
    { position: [92, -18], rotation: 0, size: [16, 12] },
    { position: [475, 18], rotation: PI, size: [16, 12] },
    { position: [475, -18], rotation: 0, size: [16, 12] },
    { position: [20, -455], rotation: 0, size: [16, 12] },
    { position: [-404, 18], rotation: PI, size: [16, 12] },
    { position: [20, 418], rotation: -PI / 2, size: [16, 12] },
  ],
};

/** Animals roam inside these islands. */
export const ANIMALS = [
  { type: 'deer', count: 4, island: 'west' },
  { type: 'deer', count: 3, island: 'east' },
  { type: 'rabbit', count: 5, island: 'north' },
  { type: 'rabbit', count: 3, island: 'central' },
  { type: 'rabbit', count: 2, island: 'south' },
  { type: 'duck', count: 4, near: 'south' },
  { type: 'duck', count: 4, near: 'central' },
  { type: 'gull', count: 10 },
];
