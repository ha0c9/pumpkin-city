// Global world settings. Tweak islands, colors and render quality here.

export const SEA_LEVEL = 0;
export const CITY_GROUND = 2.0; // plateau height shared by every island (roads and lots are flat)

export const TERRAIN = {
  size: 1600,         // world units (meters), centered on origin; islands must stay inside
  seabed: -18,        // open-sea floor depth
  shore: 22,          // meters from the coastline inland until the plateau height is reached
  heightCell: 1.5,    // resolution of the baked height grid used by everything that queries the ground
};

/**
 * Islands are a smooth union of circles ("blobs": [x, z, radius]) with a noisy coastline,
 * which gives irregular bays and headlands. `coast` is the coastline noise amplitude in meters.
 * `hills`: [x, z, radius, height] bumps, kept away from the shore. Roads/lots must avoid hills.
 * (x, z) is the label / focus point of the island.
 */
export const ISLANDS = [
  {
    id: 'central', name: '南瓜中心岛', nameEn: 'Pumpkin Central', x: -10, z: 10, seed: 11, coast: 22,
    blobs: [[0, 0, 178], [120, -95, 92], [-128, 92, 92], [100, 118, 82], [-125, -108, 80], [205, 8, 62], [150, 62, 62], [-212, -6, 58], [8, 188, 58], [-8, -196, 56]],
    hills: [],
  },
  {
    id: 'east', name: '东林岛', nameEn: 'East Grove', x: 470, z: 10, seed: 23, coast: 26,
    blobs: [[440, 15, 118], [520, -60, 80], [520, 90, 78], [400, 105, 66], [395, -85, 60], [610, 30, 40], [470, 150, 42]],
    hills: [[568, -52, 62, 16], [560, 70, 55, 11], [600, 10, 40, 8]],
  },
  {
    id: 'north', name: '北原岛', nameEn: 'North Meadow', x: 10, z: -470, seed: 37, coast: 24,
    blobs: [[0, -455, 112], [-90, -500, 72], [95, -490, 70], [10, -560, 62], [-40, -385, 50], [60, -395, 62], [-150, -470, 40], [150, -440, 36]],
    hills: [[-135, -520, 48, 13], [118, -562, 34, 8]],
  },
  {
    id: 'west', name: '西岭岛', nameEn: 'West Ridge', x: -480, z: -10, seed: 41, coast: 26,
    blobs: [[-450, -5, 116], [-540, -70, 84], [-530, 80, 76], [-395, -95, 70], [-395, 85, 66], [-620, 0, 42], [-470, -140, 40]],
    hills: [[-560, -60, 70, 24], [-545, 75, 55, 15], [-600, 10, 45, 12]],
  },
  {
    id: 'south', name: '南湾岛', nameEn: 'South Cove', x: 40, z: 470, seed: 53, coast: 22,
    blobs: [[20, 450, 104], [110, 470, 74], [-70, 485, 62], [40, 540, 56], [0, 385, 50], [-50, 410, 52], [175, 430, 34], [-130, 520, 34]],
    hills: [[-95, 510, 38, 7]],
  },
  {
    id: 'pearl', name: '东方明珠岛', nameEn: 'Pearl Isle', x: 470, z: -350, seed: 67, coast: 20,
    blobs: [[470, -355, 98], [548, -408, 60], [398, -402, 60], [478, -270, 54], [560, -322, 46], [440, -458, 46]],
    hills: [],
  },
];

export const WATER = {
  size: 7000,
  shallowColor: [0.12, 0.80, 0.68],  // turquoise near the beach
  midColor: [0.03, 0.42, 0.62],
  deepColor: [0.010, 0.060, 0.20],   // sapphire offshore
  simSize: 560,     // the GPU ripple simulation follows the camera and covers simSize x simSize meters
  maxDepth: 16,
};

/**
 * Detail waves (js/world/WaveSpectrum.js): two tileable spectra re-baked on the GPU every frame,
 * each wave moving at its deep-water speed sqrt(g k). Slope variances follow Cox-Munk for a
 * ~5 m/s breeze (total mean squared slope ≈ 0.003 + 0.00512 · U ≈ 0.029).
 */
export const WAVES = {
  tileA: 72,          // meters per chop tile (wavelengths 24 m .. 2.4 m)
  tileB: 9,           // meters per ripple tile (wavelengths 3 m .. 0.3 m)
  count: 48,          // waves per tile
  windAngle: 0.53,    // radians from +X
  slopeVarA: 0.016,   // mean squared slope of each tile; raise both for a rougher sea
  slopeVarB: 0.010,
  slope: 1.0,         // global multiplier on the detail slopes (rain adds up to +35%)
  microRough: 0.0015, // sub-pixel capillary roughness: sets how sharp the closest sun sparkles are
  specular: 0.8,      // sun glitter intensity
  reflDistort: [0.02, 0.07], // reflection offset per unit slope in screen uv: [horizontal, vertical]
  absorb: [0.45, 0.075, 0.055], // per-meter absorption (r, g, b): shallow water over sand turns turquoise
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
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}

export const IS_MOBILE = detectMobile();

export const QUALITY = IS_MOBILE ? {
  pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1,
  shadowMapSize: 1024,
  terrainCell: 3,
  waterSegments: 200,
  simResolution: 256,
  waveTexSize: 256,
  reflectionScale: 0.35,
  refractionScale: 0.4,
  grassCount: 14000,
  grassRadius: 55,
  treeCount: 1500,
  rainCount: 4000,
  carCount: 24,
  groundRes: 900,
  antialias: false,
} : {
  pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
  shadowMapSize: 2048,
  terrainCell: 2,
  waterSegments: 340,
  simResolution: 512,
  waveTexSize: 512,
  reflectionScale: 0.5,
  refractionScale: 0.6,
  grassCount: 45000,
  grassRadius: 80,
  treeCount: 3600,
  rainCount: 12000,
  carCount: 46,
  groundRes: 1200,
  antialias: true,
};
