import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

/**
 * GLTF `Object3D.clone(true)` (and some loaders) can leave morph influences out of sync
 * with `geometry.morphAttributes`, which throws inside the renderer.
 */
export function sanitizeClonedPickupModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (!g) {
      o.parent?.remove(o);
      return;
    }
    const morphKeys = g.morphAttributes
      ? Object.keys(g.morphAttributes)
      : [];
    let morphCount = 0;
    for (const key of morphKeys) {
      const arr = g.morphAttributes[key];
      if (Array.isArray(arr)) morphCount = Math.max(morphCount, arr.length);
    }
    if (morphCount === 0) {
      if (o.morphTargetInfluences?.length) o.morphTargetInfluences = [];
      return;
    }
    if (
      !o.morphTargetInfluences ||
      o.morphTargetInfluences.length !== morphCount
    ) {
      o.morphTargetInfluences = new Array(morphCount).fill(0);
    }
  });
}
import {
  BOW_PICKUP_RADIUS,
  DEAGLE_PICKUP_RADIUS,
  CARROT_MODEL_HEIGHT,
  CARROT_PICKUP_RADIUS,
  CARROT_URL,
  CRYSTAL_CARROT_PICKUP_SCALE,
  EXTRA_AIR_JUMP_DROP_CHANCE,
  EXTRA_AIR_JUMP_PICKUP_RADIUS,
  HP_BOOST_DROP_CHANCE,
  HP_BOOST_HEAL_AMOUNT,
  HP_BOOST_PICKUP_RADIUS,
  FOOD_DROP_GATE_CHANCE,
  FOOD_DROP_ITEM_CHANCE,
  FOOD_PICKUP_HEAL_AMOUNT,
  FOOD_PICKUP_MODEL_SCALE,
  FOOD_PICKUP_RADIUS,
  FIRST_DUNGEON_LEVEL_INDEX,
  LAST_DUNGEON_LEVEL_INDEX,
  MID_AIR_JUMP_COUNT,
  getBowDamageForLevel,
  getBowDropChance,
  getCarrotDropChance,
  getCarrotMeleeDamageForLevel,
  getDeagleDamageForLevel,
  getDeagleDropChance,
  getPowerfulMeleeDamageForLevel,
  HOMOHANDS_PICKUP,
  HOMOHANDS_URL,
  PLAYER_MELEE_DAMAGE,
  POWERFUL_DROP_MIN_LEVEL_INDEX,
  POWERFUL_MELEE_PICKUP_RARITY_MULT,
  POWERFUL_PICKUP_DISPLAY_HEIGHT,
  POWERFUL_PICKUP_RADIUS,
  POWERFUL_WEAPON_PICKUPS,
  PICKUP_BOB_AMPLITUDE,
  PICKUP_BOB_SPEED,
  POTION_DROP_CHANCE,
  POTION_INVENTORY_MAX_PER_TYPE,
  POTION_PICKUP_RADIUS,
  POTION_SECOND_WIND_HEAL,
  POTION_SPECS,
} from "./config.js";
import { FOOD_PICKUP_URLS } from "./foodPickupManifest.js";
import { upgradeGltfScene } from "./materialUpgrade.js";
import { disposeObject3D } from "./level.js";
import { getSupportFeetY } from "./levelCollision.js";
import { alignModelToGround } from "./player.js";
import { getPotionPickupReachMult, startPotionEffect } from "./potions.js";
import { allyPickupGatherers, game, move } from "./state.js";

/**
 * Dungeons (levelIndex 2…LAST_DUNGEON): pig weapon drops are powerful melee only (no carrot / bow / deagle).
 * @param {number} levelIndex
 */
function isDungeonPowerfulWeaponDropOnlyLevel(levelIndex) {
  return (
    levelIndex >= FIRST_DUNGEON_LEVEL_INDEX &&
    levelIndex <= LAST_DUNGEON_LEVEL_INDEX
  );
}

/** Short labels for potion hotbar cells (weapon row uses `abbr`). */
const POTION_HOTBAR_ABBR = /** @type {Record<string, string>} */ ({
  slow_motion: "SLOMO",
  liquid_form: "LIQUID",
  air_swim: "SWIM",
  blinding_light: "BLIND",
  electricity: "SHOCK",
  bloodlust: "RAGE",
  magnet_pull: "MAG",
  afterburn: "HEAT",
  mending: "MEND",
  stone_skin: "STONE",
  gilded_reach: "GILD",
  second_wind: "2WIND",
  swift_syrup: "SWIFT",
});

function potionHotbarAbbr(id) {
  return POTION_HOTBAR_ABBR[id] ?? id.slice(0, 5).toUpperCase();
}

function potionKindTitle(id) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string} w
 * @param {number} lv
 */
function weaponHudDescription(w, lv) {
  if (w === "deagle") {
    const d = getDeagleDamageForLevel(lv);
    return `Weapon: Desert Eagle — fast carrot bolt ${d} dmg, straight shot (click)`;
  }
  if (w === "bow") {
    const d = getBowDamageForLevel(lv);
    return `Weapon: Cool Bow — carrot bolt ${d} dmg, straight shot (click)`;
  }
  if (w === "power") {
    const d = getPowerfulMeleeDamageForLevel(lv);
    const name = game.powerfulWeaponLabel || "Power weapon";
    return `Weapon: ${name} — ${d} dmg (click)`;
  }
  if (w === "carrot") {
    const carrotDmg = getCarrotMeleeDamageForLevel(lv);
    return `Weapon: Carrot — ${carrotDmg} dmg (click)`;
  }
  return `Weapon: Fists — ${PLAYER_MELEE_DAMAGE} dmg (click)`;
}

/** @type {import("three").GLTF | null} */
let carrotGltf = null;

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number }} CarrotPickup
 */

/** @type {CarrotPickup[]} */
let carrotPickups = [];

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number, label: string, unlocksDev?: boolean }} PowerfulMeleePickup
 */

/** @type {PowerfulMeleePickup[]} */
let powerfulMeleePickups = [];

/** @type {Map<string, Promise<import("three/addons/loaders/GLTFLoader.js").GLTF>>} */
const powerfulGltfCache = new Map();

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {string} url
 */
export function loadPowerfulGltf(loader, url) {
  let p = powerfulGltfCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    powerfulGltfCache.set(url, p);
  }
  return p;
}

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number }} BowPickup
 */

/** @type {BowPickup[]} */
let bowPickups = [];

/** @type {BowPickup[]} */
let deaglePickups = [];

/** @type {BowPickup[]} */
let airJumpPickups = [];

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number }} HpBoostPickup
 */

/** @type {HpBoostPickup[]} */
let hpBoostPickups = [];

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number, kind: string }} PotionPickup
 */

/** @type {PotionPickup[]} */
let potionPickups = [];

/**
 * @typedef {{ group: THREE.Group, baseY: number, phase: number, pickupR2: number, url: string }} FoodPickup
 */

/** @type {FoodPickup[]} */
let foodPickups = [];

/** @type {Map<string, Promise<import("three/addons/loaders/GLTFLoader.js").GLTF>>} */
const potionGltfCache = new Map();

/** @type {Map<string, Promise<import("three/addons/loaders/GLTFLoader.js").GLTF>>} */
const foodGltfCache = new Map();

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {string} url
 */
function loadPotionGltf(loader, url) {
  let p = potionGltfCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    potionGltfCache.set(url, p);
  }
  return p;
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {string} url
 */
function loadFoodGltf(loader, url) {
  let p = foodGltfCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    foodGltfCache.set(url, p);
  }
  return p;
}

/**
 * @param {{ id: string }} spec
 */
function createProceduralPotionMesh(spec) {
  const geo = new THREE.OctahedronGeometry(0.29, 0);
  let color = 0xaa44ff;
  let emissive = 0x441166;
  if (spec.id === "bloodlust") {
    color = 0xcc2233;
    emissive = 0x660011;
  } else if (spec.id === "afterburn") {
    color = 0xffaa33;
    emissive = 0x884400;
  } else if (spec.id === "mending") {
    color = 0x44c878;
    emissive = 0x116633;
  } else if (spec.id === "stone_skin") {
    color = 0x8a8a9e;
    emissive = 0x333344;
  } else if (spec.id === "gilded_reach") {
    color = 0xd4af37;
    emissive = 0x6a5020;
  } else if (spec.id === "second_wind") {
    color = 0xa8e8ff;
    emissive = 0x4488cc;
  } else if (spec.id === "swift_syrup") {
    color = 0x66ccff;
    emissive = 0x2266aa;
  }
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.85,
    metalness: 0.35,
    roughness: 0.28,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createProceduralAirJumpPickupMesh() {
  const geo = new THREE.OctahedronGeometry(0.22, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7ee8d0,
    emissive: 0x1a8866,
    emissiveIntensity: 0.75,
    metalness: 0.2,
    roughness: 0.35,
  });
  return new THREE.Mesh(geo, mat);
}

function createProceduralHpBoostPickupMesh() {
  const geo = new THREE.IcosahedronGeometry(0.24, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x55ee99,
    emissive: 0x118844,
    emissiveIntensity: 0.82,
    metalness: 0.18,
    roughness: 0.32,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} _loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnHpBoostPickup(_loader, scene, pigPosition) {
  if (Math.random() >= HP_BOOST_DROP_CHANCE) return;
  try {
    const model = createProceduralHpBoostPickupMesh();
    upgradeGltfScene(model);
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(1.08);
    const x = pigPosition.x;
    const z = pigPosition.z;
    let groundY = pigPosition.y;
    const lb = game.levelBounds;
    const meshes = game.levelCollisionMeshes;
    if (meshes.length && lb) {
      const s = getSupportFeetY(
        x,
        pigPosition.y + 1.2,
        z,
        meshes,
        lb,
        0.35,
      );
      if (s != null) groundY = s;
    }
    const baseY = groundY + 0.24;
    group.position.set(x, baseY, z);
    scene.add(group);
    const pr = HP_BOOST_PICKUP_RADIUS;
    hpBoostPickups.push({
      group,
      baseY,
      phase: Math.random() * Math.PI * 2,
      pickupR2: pr * pr,
    });
  } catch (err) {
    console.warn("HP boost pickup failed:", err);
  }
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} _loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnExtraAirJumpPickup(_loader, scene, pigPosition) {
  if (Math.random() >= EXTRA_AIR_JUMP_DROP_CHANCE) return;
  try {
    const model = createProceduralAirJumpPickupMesh();
    upgradeGltfScene(model);
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(1.05);
    const x = pigPosition.x;
    const z = pigPosition.z;
    let groundY = pigPosition.y;
    const lb = game.levelBounds;
    const meshes = game.levelCollisionMeshes;
    if (meshes.length && lb) {
      const s = getSupportFeetY(
        x,
        pigPosition.y + 1.2,
        z,
        meshes,
        lb,
        0.35,
      );
      if (s != null) groundY = s;
    }
    const baseY = groundY + 0.22;
    group.position.set(x, baseY, z);
    scene.add(group);
    const pr = EXTRA_AIR_JUMP_PICKUP_RADIUS;
    airJumpPickups.push({
      group,
      baseY,
      phase: Math.random() * Math.PI * 2,
      pickupR2: pr * pr,
    });
  } catch (err) {
    console.warn("Air jump pickup failed:", err);
  }
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
/**
 * Random food GLB from `FOOD_PICKUP_URLS` (non–FB-boss hostiles only — caller skips boss).
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnFoodPickup(loader, scene, pigPosition) {
  if (!FOOD_PICKUP_URLS.length) return;
  if (Math.random() >= FOOD_DROP_GATE_CHANCE) return;
  if (FOOD_DROP_ITEM_CHANCE < 1 && Math.random() >= FOOD_DROP_ITEM_CHANCE) {
    return;
  }
  const url = FOOD_PICKUP_URLS[(Math.random() * FOOD_PICKUP_URLS.length) | 0];
  loadFoodGltf(loader, url)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(model);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
      alignModelToGround(model, 0.48);
      const group = new THREE.Group();
      group.add(model);
      group.scale.setScalar(FOOD_PICKUP_MODEL_SCALE);
      const x = pigPosition.x;
      const z = pigPosition.z;
      let groundY = pigPosition.y;
      const lb = game.levelBounds;
      const meshes = game.levelCollisionMeshes;
      if (meshes.length && lb) {
        const s = getSupportFeetY(
          x,
          pigPosition.y + 1.2,
          z,
          meshes,
          lb,
          0.35,
        );
        if (s != null) groundY = s;
      }
      const baseY = groundY + 0.14;
      group.position.set(x, baseY, z);
      scene.add(group);
      const pr = FOOD_PICKUP_RADIUS;
      foodPickups.push({
        group,
        baseY,
        phase: Math.random() * Math.PI * 2,
        pickupR2: pr * pr,
        url,
      });
    })
    .catch((err) => console.warn("Food pickup failed:", url, err));
}

export function trySpawnPotionPickup(loader, scene, pigPosition) {
  if (Math.random() >= POTION_DROP_CHANCE) return;
  const spec = POTION_SPECS[(Math.random() * POTION_SPECS.length) | 0];

  const placePotionGroup = (group, kind) => {
    group.scale.setScalar(spec.procedural ? 1 : 0.85);
    const x = pigPosition.x;
    const z = pigPosition.z;
    let groundY = pigPosition.y;
    const lb = game.levelBounds;
    const meshes = game.levelCollisionMeshes;
    if (meshes.length && lb) {
      const s = getSupportFeetY(
        x,
        pigPosition.y + 1.2,
        z,
        meshes,
        lb,
        0.35,
      );
      if (s != null) groundY = s;
    }
    const baseY = groundY + 0.16;
    group.position.set(x, baseY, z);
    scene.add(group);
    const pr = POTION_PICKUP_RADIUS;
    potionPickups.push({
      group,
      baseY,
      phase: Math.random() * Math.PI * 2,
      pickupR2: pr * pr,
      kind,
    });
  };

  if (spec.procedural) {
    try {
      const model = createProceduralPotionMesh(spec);
      upgradeGltfScene(model);
      const group = new THREE.Group();
      group.add(model);
      placePotionGroup(group, spec.id);
    } catch (err) {
      console.warn("Procedural potion pickup failed:", err);
    }
    return;
  }

  const url = `${spec.path}?v=${spec.revision}`;
  loadPotionGltf(loader, url)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(model);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
      alignModelToGround(model, 0.52);
      const group = new THREE.Group();
      group.add(model);
      placePotionGroup(group, spec.id);
    })
    .catch((err) => console.warn("Potion pickup failed:", err));
}

/**
 * Stylized bow (no separate .glb required).
 */
export function createProceduralBowPickupMesh() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({
    color: 0x5c3d2e,
    emissive: 0x224466,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.55,
  });
  const limb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.06), wood);
  limb.position.set(-0.22, 0.08, 0);
  limb.rotation.z = 0.35;
  g.add(limb);
  const limbR = limb.clone();
  limbR.position.set(0.22, 0.08, 0);
  limbR.rotation.z = -0.35;
  g.add(limbR);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6), wood);
  grip.rotation.z = Math.PI / 2;
  g.add(grip);
  const stringMat = new THREE.MeshStandardMaterial({
    color: 0xccddee,
    emissive: 0x66aaff,
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.35,
  });
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.92, 5),
    stringMat,
  );
  string.rotation.z = Math.PI / 2;
  string.position.y = 0.32;
  g.add(string);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/**
 * Blocky chrome pistol (no .glb).
 */
export function createProceduralDeaglePickupMesh() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad,
    metalness: 0.85,
    roughness: 0.22,
    emissive: 0x221100,
    emissiveIntensity: 0.15,
  });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.06), chrome);
  slide.position.set(0.06, 0.05, 0);
  g.add(slide);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.22, 6),
    chrome,
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-0.28, 0.06, 0);
  g.add(barrel);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.2, 0.09),
    new THREE.MeshStandardMaterial({
      color: 0x2a1810,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  grip.position.set(0.12, -0.08, 0);
  grip.rotation.z = -0.12;
  g.add(grip);
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.75,
    roughness: 0.28,
    emissive: 0x553300,
    emissiveIntensity: 0.2,
  });
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.07), gold);
  badge.position.set(0.02, 0.08, 0);
  g.add(badge);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function ensureCarrotLoaded(loader) {
  if (carrotGltf) return Promise.resolve(carrotGltf);
  return new Promise((resolve, reject) => {
    loader.load(CARROT_URL, resolve, undefined, reject);
  }).then((g) => {
    carrotGltf = g;
    return g;
  });
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function loadCarrotGltf(loader) {
  return ensureCarrotLoaded(loader);
}

/**
 * Sorted hotbar entries: weapons strongest-first, then inventory potions in `POTION_SPECS` order.
 * @returns {Array<{ id: string, tier: number, abbr: string, dmg: number, isPotion?: boolean, potionKind?: string, count?: number }>}
 */
export function buildWeaponHotbarSlots() {
  const lv = game.levelIndex;
  /** @type {{ id: string, tier: number, abbr: string, dmg: number, isPotion?: boolean, potionKind?: string, count?: number }[]} */
  const weaponSlots = [];

  if (game.hasDeagleWeapon) {
    weaponSlots.push({
      id: "deagle",
      tier: 42,
      abbr: "EAGLE",
      dmg: Math.round(getDeagleDamageForLevel(lv)),
    });
  }
  if (game.hasBowWeapon) {
    weaponSlots.push({
      id: "bow",
      tier: 32,
      abbr: "BOW",
      dmg: Math.round(getBowDamageForLevel(lv)),
    });
  }
  if (game.hasPowerfulMeleeWeapon) {
    const homo =
      game.powerfulWeaponLabel === HOMOHANDS_PICKUP.label;
    const name = (game.powerfulWeaponLabel || "POWER").slice(0, 7);
    weaponSlots.push({
      id: "power",
      tier: homo ? 55 : 38,
      abbr: homo ? "HANDS" : name.toUpperCase(),
      dmg: Math.round(getPowerfulMeleeDamageForLevel(lv)),
    });
  }
  if (game.hasCarrotWeapon && !game.hasPowerfulMeleeWeapon) {
    weaponSlots.push({
      id: "carrot",
      tier: 22,
      abbr: "CARROT",
      dmg: Math.round(getCarrotMeleeDamageForLevel(lv)),
    });
  }
  weaponSlots.push({
    id: "fists",
    tier: 8,
    abbr: "FISTS",
    dmg: PLAYER_MELEE_DAMAGE,
  });

  weaponSlots.sort((a, b) => b.tier - a.tier);

  /** @type {typeof weaponSlots} */
  const potionSlots = [];
  for (const spec of POTION_SPECS) {
    const raw = game.potionInventory[spec.id] ?? 0;
    if (raw <= 0) continue;
    const count = Math.min(raw, POTION_INVENTORY_MAX_PER_TYPE);
    potionSlots.push({
      id: `potion:${spec.id}`,
      potionKind: spec.id,
      tier: -1,
      abbr: potionHotbarAbbr(spec.id),
      dmg: 0,
      count,
      isPotion: true,
    });
  }
  return weaponSlots.concat(potionSlots);
}

/**
 * @param {{ id: string }[]} slots
 */
function clampWeaponHotbarIndex(slots) {
  const n = slots.length;
  if (n <= 0) return;
  let i = game.weaponHotbarIndex | 0;
  if (i < 0 || i >= n) game.weaponHotbarIndex = n - 1;
  else game.weaponHotbarIndex = i;
}

/**
 * Highlighted hotbar slot: weapon (updates `lastWeaponForAttack`) or potion stack.
 * @returns {{ kind: "weapon", weaponId: string } | { kind: "potion", potionKind: string, count: number }}
 */
export function getHotbarSelectedSlot() {
  const slots = buildWeaponHotbarSlots();
  if (!slots.length) {
    return { kind: "weapon", weaponId: "fists" };
  }
  clampWeaponHotbarIndex(slots);
  const s = slots[game.weaponHotbarIndex];
  if (s.isPotion && s.potionKind != null) {
    return {
      kind: "potion",
      potionKind: s.potionKind,
      count: s.count ?? 0,
    };
  }
  game.lastWeaponForAttack = s.id;
  return { kind: "weapon", weaponId: s.id };
}

/** Weapon id for primary fire / held prop; potion row uses `lastWeaponForAttack`. */
export function getHotbarSelectedWeaponId() {
  const slot = getHotbarSelectedSlot();
  if (slot.kind === "potion") return game.lastWeaponForAttack;
  return slot.weaponId;
}

/**
 * @param {import("three").Group} player
 * @returns {boolean} true if a potion was consumed
 */
export function tryDrinkSelectedPotion(player) {
  const slot = getHotbarSelectedSlot();
  if (slot.kind !== "potion") return false;
  const kind = slot.potionKind;
  const cur = game.potionInventory[kind] ?? 0;
  if (cur <= 0) return false;
  game.potionInventory[kind] = cur - 1;
  if (game.potionInventory[kind] <= 0) delete game.potionInventory[kind];
  startPotionEffect(kind, player);
  if (kind === "second_wind") {
    void import("./health.js").then((m) =>
      m.applyBurstHeal(POTION_SECOND_WIND_HEAL),
    );
  }
  const slots = buildWeaponHotbarSlots();
  clampWeaponHotbarIndex(slots);
  syncWeaponHud();
  return true;
}

/**
 * @param {string} kind `POTION_SPECS.id`
 * @returns {boolean} false if that type is already full (pickup should stay in the world)
 */
export function addPotionToInventory(kind) {
  const cur = game.potionInventory[kind] ?? 0;
  if (cur >= POTION_INVENTORY_MAX_PER_TYPE) return false;
  game.potionInventory[kind] = cur + 1;
  syncWeaponHud();
  return true;
}

/**
 * @param {number} deltaY wheel delta (positive = scroll down → next slot)
 */
export function cycleWeaponHotbar(deltaY) {
  const slots = buildWeaponHotbarSlots();
  const n = slots.length;
  if (n <= 1) return;
  clampWeaponHotbarIndex(slots);
  const dir = deltaY > 0 ? 1 : -1;
  game.weaponHotbarIndex = (game.weaponHotbarIndex + dir + n) % n;
  syncWeaponHud();
}

export function syncWeaponHud() {
  const el = document.getElementById("weapon-hud");
  if (!el) return;
  const slot = getHotbarSelectedSlot();
  const lv = game.levelIndex;

  if (slot.kind === "potion") {
    const pt = potionKindTitle(slot.potionKind);
    const atk = weaponHudDescription(game.lastWeaponForAttack, lv);
    el.textContent = `Potion: ${pt} — ${slot.count}× (right-click). ${atk}`;
  } else {
    el.textContent = weaponHudDescription(slot.weaponId, lv);
  }
  syncWeaponHotbar();
}

/**
 * Bottom hotbar: owned weapons sorted by power (left = strongest).
 * Highlight follows `game.weaponHotbarIndex` (mouse wheel while pointer-locked).
 */
export function syncWeaponHotbar() {
  const bar = document.getElementById("weapon-hotbar");
  const track = document.getElementById("weapon-hotbar-track");
  if (!bar || !track) return;

  const slots = buildWeaponHotbarSlots();
  clampWeaponHotbarIndex(slots);
  const activeIdx = game.weaponHotbarIndex;

  track.replaceChildren();
  slots.forEach((s, i) => {
    const wrap = document.createElement("div");
    wrap.className = "weapon-hotbar__slot";
    if (i === activeIdx) wrap.classList.add("weapon-hotbar__slot--active");

    const abbr = document.createElement("span");
    abbr.className = "weapon-hotbar__abbr";
    abbr.textContent = s.abbr;
    const dmg = document.createElement("span");
    dmg.className = "weapon-hotbar__dmg";
    dmg.textContent = s.isPotion ? `×${s.count ?? 0}` : `${s.dmg} dmg`;
    wrap.appendChild(abbr);
    wrap.appendChild(dmg);
    track.appendChild(wrap);
  });

  bar.setAttribute("aria-hidden", slots.length <= 1 ? "true" : "false");
}

function homohandsEquipped() {
  return (
    game.hasPowerfulMeleeWeapon &&
    game.powerfulWeaponLabel === HOMOHANDS_PICKUP.label
  );
}

/**
 * One step of the ally cost: remove the strongest equipped upgrade (Deagle → Bow → powerful melee → Carrot).
 * Homohands are never stripped. Bare fists cannot be removed.
 */
export function forfeitBestWeaponPerAllyBond() {
  if (game.hasDeagleWeapon) {
    game.hasDeagleWeapon = false;
    syncWeaponHud();
    return;
  }
  if (game.hasBowWeapon) {
    game.hasBowWeapon = false;
    syncWeaponHud();
    return;
  }
  if (game.hasPowerfulMeleeWeapon && !homohandsEquipped()) {
    game.hasPowerfulMeleeWeapon = false;
    game.powerfulWeaponLabel = "";
    syncWeaponHud();
    return;
  }
  if (game.hasCarrotWeapon) {
    game.hasCarrotWeapon = false;
    syncWeaponHud();
    return;
  }
  syncWeaponHud();
}

/**
 * @param {THREE.Scene} scene
 */
export function clearPickups(scene) {
  for (const p of carrotPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  carrotPickups = [];
  for (const p of bowPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  bowPickups = [];
  for (const p of deaglePickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  deaglePickups = [];
  for (const p of powerfulMeleePickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  powerfulMeleePickups = [];
  for (const p of airJumpPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  airJumpPickups = [];
  for (const p of potionPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  potionPickups = [];
  for (const p of foodPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  foodPickups = [];
  for (const p of hpBoostPickups) {
    scene.remove(p.group);
    disposeObject3D(p.group);
  }
  hpBoostPickups = [];
}

/**
 * Carrot-class drop slot on stages after `POWERFUL_DROP_MIN_LEVEL_INDEX` — random GLB from Powerful folder.
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
function trySpawnPowerfulMeleePickup(loader, scene, pigPosition) {
  const pick =
    POWERFUL_WEAPON_PICKUPS[
      (Math.random() * POWERFUL_WEAPON_PICKUPS.length) | 0
    ];
  const url = `${pick.path}?v=${pick.revision}`;
  loadPowerfulGltf(loader, url)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(model);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
      alignModelToGround(model, POWERFUL_PICKUP_DISPLAY_HEIGHT);
      const group = new THREE.Group();
      group.add(model);
      const x = pigPosition.x;
      const z = pigPosition.z;
      let groundY = pigPosition.y;
      const lb = game.levelBounds;
      const meshes = game.levelCollisionMeshes;
      if (meshes.length && lb) {
        const s = getSupportFeetY(
          x,
          pigPosition.y + 1.2,
          z,
          meshes,
          lb,
          0.35,
        );
        if (s != null) groundY = s;
      }
      const baseY = groundY + 0.14;
      group.position.set(x, baseY, z);
      scene.add(group);
      const pr = POWERFUL_PICKUP_RADIUS;
      powerfulMeleePickups.push({
        group,
        baseY,
        phase: Math.random() * Math.PI * 2,
        pickupR2: pr * pr,
        label: pick.label,
        unlocksDev: false,
      });
    })
    .catch((err) => console.warn("Powerful pickup failed:", err));
}

/**
 * FB boss drop — Homohands unlock dev console (Y) and work as a powerful melee.
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function spawnHomohandsDevUnlockPickup(loader, scene, pigPosition) {
  loadPowerfulGltf(loader, HOMOHANDS_URL)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(model);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
      alignModelToGround(model, POWERFUL_PICKUP_DISPLAY_HEIGHT * 1.05);
      const group = new THREE.Group();
      group.add(model);
      const x = pigPosition.x;
      const z = pigPosition.z;
      let groundY = pigPosition.y;
      const lb = game.levelBounds;
      const meshes = game.levelCollisionMeshes;
      if (meshes.length && lb) {
        const s = getSupportFeetY(
          x,
          pigPosition.y + 1.2,
          z,
          meshes,
          lb,
          0.35,
        );
        if (s != null) groundY = s;
      }
      const baseY = groundY + 0.16;
      group.position.set(x, baseY, z);
      scene.add(group);
      const pr = POWERFUL_PICKUP_RADIUS * 1.08;
      powerfulMeleePickups.push({
        group,
        baseY,
        phase: Math.random() * Math.PI * 2,
        pickupR2: pr * pr,
        label: HOMOHANDS_PICKUP.label,
        unlocksDev: true,
      });
    })
    .catch((err) => console.warn("Homohands pickup failed:", err));
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnCarrotPickup(loader, scene, pigPosition) {
  const lv = game.levelIndex;
  const powerfulDropPath =
    isDungeonPowerfulWeaponDropOnlyLevel(lv) ||
    lv > POWERFUL_DROP_MIN_LEVEL_INDEX;
  if (powerfulDropPath) {
    const p =
      getCarrotDropChance(lv) / POWERFUL_MELEE_PICKUP_RARITY_MULT;
    if (Math.random() >= p) return;
    trySpawnPowerfulMeleePickup(loader, scene, pigPosition);
    return;
  }
  if (Math.random() >= getCarrotDropChance(lv)) return;
  ensureCarrotLoaded(loader)
    .then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(model);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = true;
          const mats = Array.isArray(o.material)
            ? o.material
            : [o.material];
          for (const m of mats) {
            if (!m || !("emissive" in m) || !m.emissive) continue;
            if (!m.userData._carrotGlow) {
              m.userData._carrotGlow = true;
              m.emissive.setHex(0xff8830);
              if ("emissiveIntensity" in m) m.emissiveIntensity = 0.55;
            }
          }
        }
      });
      const scale =
        game.levelIndex === 1 ? CRYSTAL_CARROT_PICKUP_SCALE : 1;
      alignModelToGround(model, CARROT_MODEL_HEIGHT);
      const group = new THREE.Group();
      group.add(model);
      group.scale.setScalar(scale);
      const x = pigPosition.x;
      const z = pigPosition.z;
      let groundY = pigPosition.y;
      const lb = game.levelBounds;
      const meshes = game.levelCollisionMeshes;
      if (meshes.length && lb) {
        const s = getSupportFeetY(
          x,
          pigPosition.y + 1.2,
          z,
          meshes,
          lb,
          0.35,
        );
        if (s != null) groundY = s;
      }
      const baseY = groundY + 0.12;
      group.position.set(x, baseY, z);
      scene.add(group);
      const pr = CARROT_PICKUP_RADIUS * scale;
      carrotPickups.push({
        group,
        baseY,
        phase: Math.random() * Math.PI * 2,
        pickupR2: pr * pr,
      });
    })
    .catch((err) => console.warn("Carrot pickup failed:", err));
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnBowPickup(_loader, scene, pigPosition) {
  if (isDungeonPowerfulWeaponDropOnlyLevel(game.levelIndex)) return;
  if (Math.random() >= getBowDropChance(game.levelIndex)) return;
  try {
    const model = createProceduralBowPickupMesh();
    upgradeGltfScene(model);
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(1.15);
    const x = pigPosition.x;
    const z = pigPosition.z;
    let groundY = pigPosition.y;
    const lb = game.levelBounds;
    const meshes = game.levelCollisionMeshes;
    if (meshes.length && lb) {
      const s = getSupportFeetY(
        x,
        pigPosition.y + 1.2,
        z,
        meshes,
        lb,
        0.35,
      );
      if (s != null) groundY = s;
    }
    const baseY = groundY + 0.2;
    group.position.set(x, baseY, z);
    scene.add(group);
    const pr = BOW_PICKUP_RADIUS;
    bowPickups.push({
      group,
      baseY,
      phase: Math.random() * Math.PI * 2,
      pickupR2: pr * pr,
    });
  } catch (err) {
    console.warn("Bow pickup failed:", err);
  }
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} _loader
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3 | { x: number; y: number; z: number }} pigPosition
 */
export function trySpawnDeaglePickup(_loader, scene, pigPosition) {
  if (isDungeonPowerfulWeaponDropOnlyLevel(game.levelIndex)) return;
  if (Math.random() >= getDeagleDropChance(game.levelIndex)) return;
  try {
    const model = createProceduralDeaglePickupMesh();
    upgradeGltfScene(model);
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(1.25);
    const x = pigPosition.x;
    const z = pigPosition.z;
    let groundY = pigPosition.y;
    const lb = game.levelBounds;
    const meshes = game.levelCollisionMeshes;
    if (meshes.length && lb) {
      const s = getSupportFeetY(
        x,
        pigPosition.y + 1.2,
        z,
        meshes,
        lb,
        0.35,
      );
      if (s != null) groundY = s;
    }
    const baseY = groundY + 0.18;
    group.position.set(x, baseY, z);
    scene.add(group);
    const pr = DEAGLE_PICKUP_RADIUS;
    deaglePickups.push({
      group,
      baseY,
      phase: Math.random() * Math.PI * 2,
      pickupR2: pr * pr,
    });
  } catch (err) {
    console.warn("Desert Eagle pickup failed:", err);
  }
}

/**
 * @param {number} gx
 * @param {number} gy
 * @param {number} gz
 * @param {CarrotPickup | PowerfulMeleePickup | BowPickup | PotionPickup | HpBoostPickup | FoodPickup} pick
 * @param {number} r2
 * @param {number} vertTol
 */
function gathererTouchesPickup(gx, gy, gz, pick, r2, vertTol) {
  const dx = gx - pick.group.position.x;
  const dz = gz - pick.group.position.z;
  return dx * dx + dz * dz <= r2 && Math.abs(gy - pick.baseY) < vertTol;
}

/**
 * @param {THREE.Group} player
 * @param {CarrotPickup | PowerfulMeleePickup | BowPickup | PotionPickup | HpBoostPickup | FoodPickup} pick
 * @param {number} r2
 * @param {number} vertTol
 */
function anyGathererTouchesPickup(player, pick, r2, vertTol) {
  if (game.playerDead) return false;
  if (
    gathererTouchesPickup(
      player.position.x,
      player.position.y,
      player.position.z,
      pick,
      r2,
      vertTol,
    )
  ) {
    return true;
  }
  for (let i = 0; i < allyPickupGatherers.length; i++) {
    const a = allyPickupGatherers[i];
    if (gathererTouchesPickup(a.x, a.y, a.z, pick, r2, vertTol)) return true;
  }
  return false;
}

/**
 * @param {number} dt
 * @param {THREE.Group} player
 * @param {THREE.Scene} scene
 */
export function updatePickups(dt, player, scene) {
  const reachMult = getPotionPickupReachMult(performance.now() * 0.001);
  const reach2 = reachMult * reachMult;

  for (let i = carrotPickups.length - 1; i >= 0; i--) {
    const p = carrotPickups[i];
    const r2 =
      (p.pickupR2 ??
        CARROT_PICKUP_RADIUS * CARROT_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.35)) continue;
    game.hasCarrotWeapon = true;
    scene.remove(p.group);
    disposeObject3D(p.group);
    carrotPickups.splice(i, 1);
    syncWeaponHud();
  }

  for (let i = powerfulMeleePickups.length - 1; i >= 0; i--) {
    const p = powerfulMeleePickups[i];
    const r2 =
      (p.pickupR2 ??
        POWERFUL_PICKUP_RADIUS * POWERFUL_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.4)) continue;
    game.hasPowerfulMeleeWeapon = true;
    game.hasCarrotWeapon = false;
    game.powerfulWeaponLabel = p.label;
    if (p.unlocksDev) {
      game.devConsoleUnlocked = true;
      void import("./devConsole.js").then((m) => m.onHomohandsDevUnlock());
    }
    scene.remove(p.group);
    disposeObject3D(p.group);
    powerfulMeleePickups.splice(i, 1);
    syncWeaponHud();
  }

  for (let i = bowPickups.length - 1; i >= 0; i--) {
    const p = bowPickups[i];
    const r2 =
      (p.pickupR2 ?? BOW_PICKUP_RADIUS * BOW_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.45)) continue;
    game.hasBowWeapon = true;
    scene.remove(p.group);
    disposeObject3D(p.group);
    bowPickups.splice(i, 1);
    syncWeaponHud();
  }

  for (let i = deaglePickups.length - 1; i >= 0; i--) {
    const p = deaglePickups[i];
    const r2 =
      (p.pickupR2 ?? DEAGLE_PICKUP_RADIUS * DEAGLE_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.45)) continue;
    game.hasDeagleWeapon = true;
    scene.remove(p.group);
    disposeObject3D(p.group);
    deaglePickups.splice(i, 1);
    syncWeaponHud();
  }

  for (let i = airJumpPickups.length - 1; i >= 0; i--) {
    const p = airJumpPickups[i];
    const r2 =
      (p.pickupR2 ??
        EXTRA_AIR_JUMP_PICKUP_RADIUS * EXTRA_AIR_JUMP_PICKUP_RADIUS) *
      reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.4)) continue;
    game.bonusMidAirJumps += 1;
    if (!move.onGround) move.airJumpsRemaining += 1;
    else
      move.airJumpsRemaining =
        MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
    scene.remove(p.group);
    disposeObject3D(p.group);
    airJumpPickups.splice(i, 1);
  }

  for (let i = hpBoostPickups.length - 1; i >= 0; i--) {
    const p = hpBoostPickups[i];
    const r2 =
      (p.pickupR2 ??
        HP_BOOST_PICKUP_RADIUS * HP_BOOST_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.4)) continue;
    void import("./health.js").then((m) =>
      m.applyBurstHeal(HP_BOOST_HEAL_AMOUNT),
    );
    scene.remove(p.group);
    disposeObject3D(p.group);
    hpBoostPickups.splice(i, 1);
  }

  for (let i = potionPickups.length - 1; i >= 0; i--) {
    const p = potionPickups[i];
    const r2 =
      (p.pickupR2 ?? POTION_PICKUP_RADIUS * POTION_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.45)) continue;
    if (!addPotionToInventory(p.kind)) continue;
    scene.remove(p.group);
    disposeObject3D(p.group);
    potionPickups.splice(i, 1);
  }

  for (let i = foodPickups.length - 1; i >= 0; i--) {
    const p = foodPickups[i];
    const r2 =
      (p.pickupR2 ?? FOOD_PICKUP_RADIUS * FOOD_PICKUP_RADIUS) * reach2;
    p.phase += dt * PICKUP_BOB_SPEED;
    p.group.position.y =
      p.baseY + Math.sin(p.phase) * PICKUP_BOB_AMPLITUDE;

    if (game.playerDead) continue;

    if (!anyGathererTouchesPickup(player, p, r2, 1.45)) continue;
    void import("./health.js").then((m) =>
      m.applyBurstHeal(FOOD_PICKUP_HEAL_AMOUNT),
    );
    scene.remove(p.group);
    disposeObject3D(p.group);
    foodPickups.splice(i, 1);
  }
}
