# assets/textures

Image textures for new buildings or materials. Load them with `THREE.TextureLoader` inside a
building module's `create()` and set `texture.encoding = THREE.sRGBEncoding` for color maps.
The built-in materials are generated procedurally in `js/core/Textures.js` and
`js/buildings/materials.js`, so the scene works without any files here.
