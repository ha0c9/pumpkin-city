# assets/models

Put `.glb` / `.gltf` models here (Y-up, meters, front facing +Z) and place them from
`js/config/city.layout.js` with the generic `gltf` building type:

```js
{ type: 'gltf', id: 'lighthouse', name: '灯塔', nameEn: 'Lighthouse',
  url: 'assets/models/lighthouse.glb', position: [60, 80], rotation: 0, scale: 1, footprint: [8, 8] }
```
