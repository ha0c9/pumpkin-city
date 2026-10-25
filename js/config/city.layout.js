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
  { id: 'donglin', name: '东林大道', nameEn: 'Donglin Ave', from: [402, 45], to: [560, 45], lanes: 4 },
  { id: 'siji', name: '四季路', nameEn: 'Siji Rd', from: [490, -40], to: [490, 175], lanes: 2 },
  { id: 'linhai', name: '临海路', nameEn: 'Linhai Rd', from: [405, -15], to: [490, -15], lanes: 2 },

  // --- 北原岛 ---
  { id: 'beiyuan', name: '北原路', nameEn: 'Beiyuan Rd', from: [-60, -425], to: [-60, -580], lanes: 2 },
  { id: 'wulin', name: '雾林路', nameEn: 'Wulin Rd', from: [-145, -490], to: [35, -490], lanes: 2 },

  // --- 西岭岛 ---
  { id: 'xiling', name: '西岭路', nameEn: 'Xiling Rd', from: [-410, -60], to: [-530, -60], lanes: 4 },
  { id: 'keji', name: '科技路', nameEn: 'Keji Rd', from: [-480, -136], to: [-480, 45], lanes: 2 },

  // --- 南湾岛 ---
  { id: 'haiyang', name: '海洋路', nameEn: 'Haiyang Rd', from: [80, 408], to: [80, 560], lanes: 2 },
  { id: 'nanwan', name: '南湾路', nameEn: 'Nanwan Rd', from: [-5, 490], to: [205, 490], lanes: 2 },

  // --- 东方明珠岛 ---
  { id: 'mingzhu', name: '明珠路', nameEn: 'Mingzhu Rd', from: [500, -275], to: [500, -460], lanes: 2 },
  { id: 'lujiazui', name: '陆家嘴路', nameEn: 'Lujiazui Rd', from: [442, -370], to: [606, -370], lanes: 2 },

  // --- 南瓜中心岛 southwest exit, and the reserved airport island ---
  { id: 'airport-approach', name: '机场路', nameEn: 'Airport Rd', from: [-150, 130], to: [-150, 168], lanes: 2 },
  { id: 'airport-rd', name: '机场路', nameEn: 'Airport Rd', from: [-520, 430], to: [-520, 780], lanes: 2 },
  { id: 'airport-cross', name: '翔云路', nameEn: 'Xiangyun Rd', from: [-680, 660], to: [-360, 660], lanes: 2 },
];

/**
 * Bridges join two road ends: `from` + `dir` (heading out of the first island) and `end` + `endDir`
 * (heading into the `to` island when arriving). The road ends may be offset sideways and sit at
 * different island heights; the deck curves between them and climbs or descends (js/world/BridgePath.js).
 * Abutments are found where each road meets the water; short connector roads are added automatically.
 * style: 'arch' | 'cable' | 'beam'
 */
export const BRIDGES = [
  { id: 'bridge-east', name: '东林拱桥', nameEn: 'East Grove Arch Bridge', from: [150, 0], dir: [1, 0], to: 'east', end: [402, 45], endDir: [1, 0], lanes: 4, style: 'arch' },
  { id: 'bridge-north', name: '北原斜拉桥', nameEn: 'North Meadow Cable Bridge', from: [0, -130], dir: [0, -1], to: 'north', end: [-60, -425], endDir: [0, -1], lanes: 2, style: 'cable' },
  { id: 'bridge-west', name: '西岭大桥', nameEn: 'West Ridge Bridge', from: [-150, 0], dir: [-1, 0], to: 'west', end: [-410, -60], endDir: [-1, 0], lanes: 4, style: 'beam' },
  { id: 'bridge-south', name: '南湾拱桥', nameEn: 'South Cove Arch Bridge', from: [0, 130], dir: [0, 1], to: 'south', end: [80, 408], endDir: [0, 1], lanes: 2, style: 'arch' },
  { id: 'bridge-pearl', name: '明珠大桥', nameEn: 'Pearl Cable Bridge', from: [490, -40], dir: [0, -1], to: 'pearl', end: [500, -275], endDir: [0, -1], lanes: 2, style: 'cable' },
  { id: 'bridge-airport', name: '机场大桥', nameEn: 'Airport Bridge', from: [-150, 168], dir: [0, 1], to: 'airport', end: [-520, 430], endDir: [0, 1], lanes: 2, style: 'cable' },
];

/** Landmark buildings with fixed positions. `type` must be registered in js/buildings/index.js. */
export const LANDMARKS = [
  {
    type: 'americaTower', id: 'america-tower',
    name: '美国大厦 1号楼', nameEn: 'America Tower 1 · Offices',
    description: '美国大厦 1 号楼是办公楼：玻璃幕墙超高层，高约 146 米，三段退台式造型，顶部设观景冠与航空障碍灯。一条空中连廊跨过华山路通往 2 号楼。',
    position: [39, -33], rotation: 0,
  },
  {
    type: 'americaTower2', id: 'america-tower-2',
    name: '美国大厦 2号楼', nameEn: 'America Tower 2 · Hotel',
    description: '美国大厦 2 号楼是酒店：香槟色玻璃的圆角塔楼，约 112 米，设落客雨棚、顶层空中酒吧与停机坪，40 米高的空中连廊与 1 号楼相连。',
    position: [113, -33], rotation: 0, skyBridge: 46,
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
    type: 'schoolAheadSign', id: 'school-ahead-north',
    position: [-82.3, 10.4], rotation: PI,
  },
  {
    type: 'schoolAheadSign', id: 'school-ahead-south',
    position: [-67.9, 58.05], rotation: 0,
  },
  {
    type: 'homeInn', id: 'home-inn',
    name: '如家酒店', nameEn: 'Home Inn',
    description: '简约舒适的经济型连锁酒店，明黄色立面与蓝色招牌，共 6 层 120 间客房。',
    position: [112.5, 34.2], rotation: PI,
  },
  {
    type: 'fourSeasons', id: 'four-seasons',
    name: '四季酒店', nameEn: 'Four Seasons Hotel',
    description: '东林岛上的豪华度假酒店：双塔客房楼、空中连廊、无边泳池，园区内设有摩天轮、旋转木马和过山车的游乐场。',
    position: [446, 111], rotation: 0,
  },
  {
    type: 'ghostMuseum', id: 'ghost-museum',
    name: '幽灵博物馆', nameEn: 'Ghost Museum',
    description: '扭转的暗色塔身、悬浮的碎片与幽幽发光的裂缝，夜晚有幽灵在建筑周围游荡。展出世界各地的鬼怪传说。',
    position: [-104, -450], rotation: PI,
  },
  {
    type: 'oceanMuseum', id: 'ocean-museum',
    name: '海洋博物馆', nameEn: 'Ocean Museum',
    description: '一艘停靠在海边的巨轮造型建筑，船身内展出珊瑚礁、鲸类骨架与深海生物，甲板是观景平台。',
    position: [190, 532], rotation: 0,
  },
  {
    type: 'oceanGallery', id: 'ocean-gallery',
    name: '海洋美术馆', nameEn: 'Ocean Art Gallery',
    description: '像浪花与贝壳一样层层展开的白色曲面屋顶，展出以海洋为主题的绘画与雕塑。',
    position: [120, 538], rotation: 0,
  },
  {
    type: 'scienceMuseum', id: 'science-museum',
    name: '科技馆', nameEn: 'Science & Technology Museum',
    description: '悬浮的银色球幕影院、环形光带与参数化幕墙，展示航天、人工智能与新能源科技。',
    position: [-435, -108], rotation: 0,
  },
  {
    type: 'planetarium', id: 'planetarium',
    name: '天文馆', nameEn: 'Planetarium',
    description: '北原岛上的天文馆：流线形的银色主馆前端高高翘起，屋顶托着一颗巨大的球幕影院，右侧通过桁架廊桥连接观星球。夜晚球体会亮起星图。',
    position: [10, -538], rotation: 0,
  },
  {
    type: 'orientalPearl', id: 'oriental-pearl',
    name: '东方明珠', nameEn: 'Oriental Pearl Tower',
    description: '东方明珠岛的地标电视塔：三根擎天立柱托起大小 11 颗粉红色"明珠"，下球体与上球体设观光层，顶部是太空舱与天线桅杆，高约 188 米。夜晚灯光变幻。',
    position: [561, -413], rotation: 0,
  },
  {
    type: 'fulaiTower', id: 'fulai-tower',
    name: '福来大厦', nameEn: 'Fulai Tower',
    description: '香槟金色的八角形超高层，三段逐级扭转退台，顶部是镂空金冠与发光的"福"字灯笼，寓意福气到来。',
    position: [455, -412], rotation: 0,
  },
  {
    type: 'equestrianCenter', id: 'pearl-equestrian',
    name: '明珠马术训练场', nameEn: 'Pearl Equestrian Centre',
    description: '东方明珠岛南侧的马术训练场。一栋马棚、一间两层办公室，旁边是两个椭圆形训练场：一场走盛装舞步，一场摆着障碍和踩杆，场里有小马在绕圈训练。',
    position: [638, -502], rotation: 0, footprint: [74, 52],
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
    lot(block(-150, -75, 65, 130), 0),
    { position: [112, -98], rotation: PI, size: [58, 50] },
    // 东林岛
    { position: [448, 13], rotation: 0, size: [66, 38] },
    // 北原岛
    { position: [-10, -452], rotation: PI, size: [74, 60] },
    { position: [-102, -532], rotation: 0, size: [60, 64] },
    // 西岭岛
    { position: [-440, -8], rotation: PI, size: [56, 56] },
    // 南湾岛
    { position: [42, 456], rotation: 0, size: [50, 50] },
    // 东方明珠岛
    { position: [558, -322], rotation: PI, size: [60, 50] },
  ],
  small: [
    { position: [24, 18], rotation: PI, size: [16, 12] },
    { position: [54, 18], rotation: PI, size: [16, 12] },
    { position: [24, 51], rotation: 0, size: [16, 12] },
    { position: [54, 51], rotation: 0, size: [16, 12] },
    { position: [515, 63], rotation: PI, size: [16, 12] },
    { position: [515, 27], rotation: 0, size: [16, 12] },
    { position: [-40, -505], rotation: 0, size: [16, 12] },
    { position: [-454, -42], rotation: PI, size: [16, 12] },
    { position: [100, 458], rotation: -PI / 2, size: [16, 12] },
    { position: [480, -342], rotation: 0, size: [16, 12] },
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
  { type: 'rabbit', count: 2, island: 'pearl' },
  { type: 'rabbit', count: 3, island: 'airport' },
  { type: 'gull', count: 10 },
  { type: 'squirrel', count: 4, island: 'east' },
  { type: 'squirrel', count: 3, island: 'north' },
  { type: 'peacock', count: 2, island: 'pearl' },
  { type: 'peacock', count: 2, island: 'west' },
  { type: 'crab', count: 6, near: 'south' },
  { type: 'crab', count: 4, near: 'east' },
  { type: 'turtle', count: 3, near: 'south' },
  { type: 'turtle', count: 2, near: 'west' },
  { type: 'swan', count: 3, near: 'north' },
  { type: 'dolphin', count: 3, near: 'south' },
  { type: 'dolphin', count: 3, near: 'west' },
  { type: 'dolphin', count: 3, near: 'pearl' },
];
