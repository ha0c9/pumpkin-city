// Import every building module here so it registers itself.
// To add a new building: create js/buildings/MyBuilding.js that calls registerBuilding('myType', {...}),
// import it below, then place it in js/config/city.layout.js (LANDMARKS or RANDOM_FACILITIES).
import './AmericaTower.js';
import './HeritageMuseum.js';
import './ConvenienceStore.js';
import './School.js';
import './Park.js';
import './GltfModel.js';
