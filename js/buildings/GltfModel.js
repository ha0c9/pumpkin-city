// Generic glTF/GLB building: lets new assets in assets/models/ be placed purely from config.
// Example LANDMARKS entry:
//   { type: 'gltf', id: 'lighthouse', name: '灯塔', nameEn: 'Lighthouse', url: 'assets/models/lighthouse.glb',
//     position: [60, 80], rotation: 0, scale: 1, footprint: [8, 8] }
import { registerBuilding } from '../core/Registry.js';

const THREE = window.THREE;
const LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
let loaderPromise = null;

function loadGltfLoader() {
  if (THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LOADER_URL;
      s.onload = () => resolve(THREE.GLTFLoader);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return loaderPromise;
}

registerBuilding('gltf', {
  label: '模型 Model',
  footprint: [10, 10],
  create(ctx, spec) {
    const g = new THREE.Group();
    loadGltfLoader().then((Loader) => {
      new Loader().load(spec.url, (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(spec.scale || 1);
        model.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.pick = g.userData.pick; }
        });
        g.add(model);
      }, undefined, (err) => console.error(`Failed to load ${spec.url}`, err));
    }).catch((err) => console.error('GLTFLoader unavailable', err));
    return g;
  },
});
