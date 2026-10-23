// Capture fixed water views (overview, low over-water angles, shoreline) for before/after comparisons.
// Requires a local server (`npm run serve`) and puppeteer-core with a Chrome binary:
//   npm i --no-save puppeteer-core && node tools/capture-water.mjs out-dir [http://localhost:8080] [chrome-path]
import { mkdirSync } from 'fs';
import puppeteer from 'puppeteer-core';

const outDir = process.argv[2] || 'water-shots';
const url = process.argv[3] || 'http://localhost:8080/';
const chrome = process.argv[4] || process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

// target [x, y, z], orbit radius, theta (azimuth), phi (polar angle from +Y), hour of day.
// theta ≈ 1.12 looks into the afternoon sun; +π puts the sun behind the camera.
const SHOTS = [
  { name: 'overview', target: [230, 2, 10], radius: 560, theta: 0.55, phi: 1.0, hour: 14 },
  { name: 'low-into-sun', target: [320, 2, 300], radius: 60, theta: 1.12, phi: 1.42, hour: 15.5 },
  { name: 'low-sun-behind', target: [320, 2, 300], radius: 60, theta: 4.26, phi: 1.42, hour: 15.5 },
  { name: 'low-side', target: [320, 2, 300], radius: 45, theta: 2.69, phi: 1.40, hour: 15.5 },
  { name: 'shore', target: [265, 2, 80], radius: 110, theta: 1.2, phi: 1.2, hour: 13 },
  { name: 'sunset', target: [320, 2, 300], radius: 140, theta: 1.2, phi: 1.38, hour: 17.6 },
  { name: 'rain', target: [320, 2, 300], radius: 60, theta: 1.12, phi: 1.3, hour: 14, weather: 'rain' },
  { name: 'night', target: [265, 2, 80], radius: 160, theta: 1.2, phi: 1.25, hour: 22 },
];

mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.pumpkin && window.pumpkin.clock, { timeout: 300000, polling: 500 });
await page.addStyleTag({ content: '#title, #labels, #panel, #panel-toggle, #tips, #nav, #hint, #info { display: none !important; }' });

// Optional: ONLY=overview,shore limits the shots; EVAL="js" runs in the page before capturing.
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const s of SHOTS.filter((x) => !only || only.includes(x.name))) {
  await page.evaluate((s) => {
    const app = window.pumpkin;
    const c = app.controls;
    c.anim = null;
    c.target.set(...s.target); c.goalTarget.set(...s.target);
    c.radius = c.goalRadius = s.radius;
    c.theta = c.goalTheta = s.theta;
    c.phi = c.goalPhi = s.phi;
    app.env.autoTime = false;
    app.env.setTime(s.hour);
    app.env.setWeather(s.weather || 'sunny');
    app.env.rain = s.weather === 'rain' ? 1 : 0;
  }, s);
  // Let the ripple simulation, shadows and reflections settle.
  await new Promise((r) => setTimeout(r, 6000));
  await page.screenshot({ path: `${outDir}/${s.name}.png` });
  console.log('saved', `${outDir}/${s.name}.png`);
}
await browser.close();
