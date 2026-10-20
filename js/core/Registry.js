// Registry of building / facility types. Each module calls registerBuilding() once;
// the city layout refers to types by name, so new assets plug in without touching the engine.

const types = new Map();

/**
 * @param {string} type unique key used in js/config/city.layout.js
 * @param {object} def
 * @param {string} def.label      human readable category, e.g. '便利店 Convenience Store'
 * @param {number[]} def.footprint [width, depth] in meters (used by the occupancy mask)
 * @param {(ctx, spec, rng) => THREE.Object3D} def.create  builds the object at the origin, front facing +Z
 * @param {(spec) => object} [def.info] optional extra info fields for the selection panel
 */
export function registerBuilding(type, def) {
  if (types.has(type)) console.warn(`Building type "${type}" registered twice; overriding.`);
  types.set(type, { type, ...def });
}

export function getBuildingType(type) {
  const def = types.get(type);
  if (!def) throw new Error(`Unknown building type "${type}". Did you import it in js/buildings/index.js?`);
  return def;
}

export function listBuildingTypes() { return [...types.values()]; }
