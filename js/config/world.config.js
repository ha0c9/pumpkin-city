// Global world settings. Tweak islands, colors and render quality here.

export const SEA_LEVEL = 0;
export const CITY_GROUND = 2.0; // plateau height of the city island

export const TERRAIN = {
  size: 900,          // world units (meters), centered on origin
  seabed: -18,        // open-sea floor depth
};

/**
 * Islands. `hills` adds noisy relief inside the island (0 = perfectly flat plateau).
 * `flat` is the fraction of the radius that stays at plateau height before the beach.
 */
export const ISLANDS = [
  { id: 'central', name: '南瓜中心岛', nameEn: 'Pumpkin Central', x: 0, z: 0, radius: 108, height: CITY_GROUND, hills: 0, flat: 0.84, shape: 0.07, seed: 11 },
  { id: 'east', name: '东林岛', nameEn: 'East Grove', x: 228, z: 18, radius: 70, height: 2.2, hills: 9, flat: 0.8, shape: 0.14, seed: 23 },
  { id: 'north', name: '北原岛', nameEn: 'North Meadow', x: -12, z: -222, radius: 64, height: 2.0, hills: 5, flat: 0.8, shape: 0.13, seed: 37 },
  { id: 'west', name: '西岭岛', nameEn: 'West Ridge', x: -232, z: -14, radius: 76, height: 2.4, hills: 18, flat: 0.78, shape: 0.15, seed: 41 },
  { id: 'south', name: '南湾岛', nameEn: 'South Cove', x: 28, z: 200, radius: 50, height: 1.8, hills: 3, flat: 0.8, shape: 0.12, seed: 53 },
];

export const WATER = {
  size: 2400,
  shallowColor: [0.10, 0.78, 0.74],  // turquoise near the beach
  midColor: [0.03, 0.42, 0.62],
  deepColor: [0.012, 0.075, 0.26],   // sapphire offshore
  simSize: 520,     // the GPU ripple simulation covers [-simSize/2, simSize/2]
  maxDepth: 16,
};

export const SKY = {
  dayZenith: [0.16, 0.38, 0.78],
  dayHorizon: [0.62, 0.78, 0.95],
  sunsetHorizon: [0.98, 0.55, 0.28],
  nightZenith: [0.005, 0.01, 0.03],
  nightHorizon: [0.03, 0.05, 0.10],
};

export const START_TIME = 15.5; // hour of day when the page loads

function detectMobile() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}

export const IS_MOBILE = detectMobile();

export const QUALITY = IS_MOBILE ? {
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  shadowMapSize: 1024,
  terrainSegments: 240,
  waterSegments: 220,
  simResolution: 256,
  reflectionScale: 0.35,
  refractionScale: 0.4,
  grassCount: 14000,
  grassRadius: 55,
  treeCount: 900,
  rainCount: 4000,
  antialias: false,
} : {
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  shadowMapSize: 2048,
  terrainSegments: 380,
  waterSegments: 360,
  simResolution: 512,
  reflectionScale: 0.5,
  refractionScale: 0.6,
  grassCount: 45000,
  grassRadius: 80,
  treeCount: 1900,
  rainCount: 12000,
  antialias: true,
};
