// City layout: roads, bridges, landmark buildings and random facility lots.
// Positions are [x, z] in world meters. Rotation is around Y; a building's front faces local +Z,
// so rotation 0 faces +Z (south), PI faces -Z (north), PI/2 faces +X (east), -PI/2 faces -X (west).

const PI = Math.PI;

export const ROAD_STYLE = {
  laneWidth: 3.5,
  sidewalk: 2.6,
  curbHeight: 0.16,
  lampSpacing: 24,
};

/**
 * Roads must be axis-aligned segments. Intersections, crosswalks, sidewalks and lamps are
 * generated automatically wherever segments meet or cross.
 */
export const ROADS = [
  { id: 'ring-north', name: '北环路', nameEn: 'North Ring Road', from: [-50, -50], to: [50, -50], lanes: 2 },
  { id: 'pumpkin-ave', name: '南瓜大道', nameEn: 'Pumpkin Avenue', from: [-50, 0], to: [50, 0], lanes: 4 },
  { id: 'ring-south', name: '南环路', nameEn: 'South Ring Road', from: [-50, 50], to: [50, 50], lanes: 2 },
  { id: 'ring-west', name: '西环路', nameEn: 'West Ring Road', from: [-50, -50], to: [-50, 50], lanes: 2 },
  { id: 'main-street', name: '中央街', nameEn: 'Central Street', from: [0, -50], to: [0, 50], lanes: 2 },
  { id: 'ring-east', name: '东环路', nameEn: 'East Ring Road', from: [50, -50], to: [50, 50], lanes: 2 },
];

/**
 * Bridges start at a road end on the city island and head in `dir` until they reach `to` island.
 * A connecting road from `from` to the bridge abutment is created automatically.
 * style: 'arch' | 'cable' | 'beam'
 */
export const BRIDGES = [
  { id: 'bridge-east', name: '东林拱桥', nameEn: 'East Grove Arch Bridge', from: [50, 0], dir: [1, 0], to: 'east', lanes: 4, style: 'arch' },
  { id: 'bridge-north', name: '北原斜拉桥', nameEn: 'North Meadow Cable Bridge', from: [0, -50], dir: [0, -1], to: 'north', lanes: 2, style: 'cable' },
  { id: 'bridge-west', name: '西岭大桥', nameEn: 'West Ridge Bridge', from: [-50, 0], dir: [-1, 0], to: 'west', lanes: 4, style: 'beam' },
  { id: 'bridge-south', name: '南湾步行桥', nameEn: 'South Cove Bridge', from: [0, 50], dir: [0, 1], to: 'south', lanes: 2, style: 'arch' },
];

/** Landmark buildings with fixed positions. `type` must be registered in js/buildings/index.js. */
export const LANDMARKS = [
  {
    type: 'americaTower', id: 'america-tower',
    name: '美国大厦', nameEn: 'America Tower',
    description: '南瓜岛最高的玻璃幕墙超高层建筑，高约 128 米，三段退台式造型，顶部设观景冠与航空障碍灯。',
    position: [25, -27], rotation: 0,
  },
  {
    type: 'heritageMuseum', id: 'heritage-museum',
    name: '世界遗产博物馆', nameEn: 'World Heritage Museum',
    description: '新古典主义柱廊立面搭配玻璃穹顶，收藏来自世界各地的文化与自然遗产展品。',
    position: [-25, -27], rotation: PI / 2,
  },
];

/**
 * Random facilities are placed on lots with a seeded RNG, so the city is stable across reloads.
 * Change `seed` to reshuffle. Unused large lots become pocket parks, unused small lots become gardens.
 */
export const RANDOM_FACILITIES = {
  seed: 20261020,
  picks: [
    { type: 'school', lot: 'large', count: 1 },
    { type: 'convenienceStore', lot: 'small', count: 3 },
  ],
};

export const LOTS = {
  large: [
    { position: [-25, 27], rotation: PI, size: [36, 32] },
    { position: [25, 27], rotation: PI, size: [36, 32] },
  ],
  small: [
    { position: [-24, -63], rotation: 0, size: [14, 11] },
    { position: [24, -63], rotation: 0, size: [14, 11] },
    { position: [-24, 63], rotation: PI, size: [14, 11] },
    { position: [24, 63], rotation: PI, size: [14, 11] },
    { position: [-63, -25], rotation: PI / 2, size: [14, 11] },
    { position: [-63, 25], rotation: PI / 2, size: [14, 11] },
    { position: [63, -25], rotation: -PI / 2, size: [14, 11] },
    { position: [63, 25], rotation: -PI / 2, size: [14, 11] },
  ],
};

/** Animals roam inside these islands. */
export const ANIMALS = [
  { type: 'deer', count: 3, island: 'west' },
  { type: 'deer', count: 2, island: 'east' },
  { type: 'rabbit', count: 4, island: 'north' },
  { type: 'rabbit', count: 2, island: 'central' },
  { type: 'duck', count: 4, near: 'south' },
  { type: 'duck', count: 3, near: 'central' },
  { type: 'gull', count: 7 },
];
