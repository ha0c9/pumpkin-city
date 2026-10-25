// Global world settings. Tweak islands, colors and render quality here.

export const SEA_LEVEL = 0;
export const CITY_GROUND = 2.0; // default plateau height; each island can set its own `ground` (roads and lots are flat)

export const TERRAIN = {
  size: 1800,         // world units (meters), centered on origin; islands must stay inside
  seabed: -18,        // open-sea floor depth
  shore: 22,          // meters from the coastline inland until the plateau height is reached
  heightCell: 1.5,    // resolution of the baked height grid used by everything that queries the ground
};

/**
 * Islands are a smooth union of circles ("blobs": [x, z, radius]) with a noisy coastline,
 * which gives irregular bays and headlands. `coast` is the coastline noise amplitude in meters.
 * `ground` is the island's plateau height (roads, lots and bridge ends sit on it).
 * `hills`: [x, z, radius, height] bumps, kept away from the shore. Roads/lots must avoid hills.
 * (x, z) is the label / focus point of the island.
 */
export const ISLANDS = [
  {
    id: 'central', name: '南瓜中心岛', nameEn: 'Pumpkin Central', x: -10, z: 10, seed: 11, coast: 22, ground: 2,
    blobs: [[0, 0, 178], [120, -95, 92], [-128, 92, 92], [100, 118, 82], [-125, -108, 80], [205, 8, 62], [150, 62, 62], [-212, -6, 58], [8, 188, 58], [-8, -196, 56]],
    hills: [],
  },
  {
    id: 'east', name: '东林岛', nameEn: 'East Grove', x: 510, z: 55, seed: 23, coast: 26, ground: 5.5,
    blobs: [[480, 60, 118], [560, -15, 80], [560, 135, 78], [440, 150, 66], [435, -40, 60], [650, 75, 40], [510, 195, 42]],
    hills: [[608, -7, 62, 16], [600, 115, 55, 11], [640, 55, 40, 8]],
  },
  {
    id: 'north', name: '北原岛', nameEn: 'North Meadow', x: -50, z: -520, seed: 37, coast: 24, ground: 10,
    blobs: [[-60, -505, 112], [-150, -550, 72], [35, -540, 70], [-50, -610, 62], [-100, -435, 50], [0, -445, 62], [-210, -520, 40], [90, -490, 36]],
    hills: [[-195, -570, 48, 13], [58, -612, 34, 8]],
  },
  {
    id: 'west', name: '西岭岛', nameEn: 'West Ridge', x: -530, z: -70, seed: 41, coast: 26, ground: 7,
    blobs: [[-500, -65, 116], [-590, -130, 84], [-580, 20, 76], [-445, -155, 70], [-445, 25, 66], [-670, -60, 42], [-520, -200, 40], [-428, -85, 66], [-485, -140, 40]],
    hills: [[-610, -120, 70, 24], [-595, 15, 55, 15], [-650, -50, 45, 12]],
  },
  {
    id: 'south', name: '南湾岛', nameEn: 'South Cove', x: 120, z: 510, seed: 53, coast: 22, ground: 3.5,
    blobs: [[100, 490, 104], [190, 510, 74], [10, 525, 62], [120, 580, 56], [80, 425, 50], [30, 450, 52], [255, 470, 34], [-50, 560, 34]],
    hills: [[-15, 550, 38, 7]],
  },
  {
    id: 'pearl', name: '东方明珠岛', nameEn: 'Pearl Isle', x: 520, z: -360, seed: 67, coast: 20, ground: 4,
    blobs: [[520, -365, 98], [598, -418, 60], [448, -412, 60], [528, -280, 54], [610, -332, 46], [490, -468, 46], [555, -440, 55], [620, -450, 48], [655, -510, 90], [590, -530, 62], [710, -470, 55]],
    hills: [],
  },
  {
    // Reserved for a future airport: long and flat, no hills, southwest of the central island.
    id: 'airport', name: '机场岛', nameEn: 'Airport Isle', x: -500, z: 580, seed: 79, coast: 16, ground: 2.4,
    blobs: [[-630, 560, 115], [-500, 555, 170], [-350, 560, 135], [-560, 650, 85], [-400, 645, 80], [-530, 450, 75]],
    hills: [],
  },
];

export const WATER = {
  size: 16000,
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
