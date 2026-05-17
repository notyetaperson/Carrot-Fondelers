import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  HOMOHANDS_PICKUP,
  HOMOHANDS_URL,
  POWERFUL_WEAPON_PICKUPS,
} from "./config.js";
import { disposeObject3D } from "./level.js";
import { upgradeGltfScene } from "./materialUpgrade.js";
import {
  PLAYER_HELD_WEAPON_ROOT_NAME,
  POTION_LIQUID_BLOB_NAME,
} from "./player.js";
import {
  createProceduralBowPickupMesh,
  createProceduralDeaglePickupMesh,
  getHotbarSelectedWeaponId,
  loadCarrotGltf,
  loadPowerfulGltf,
  sanitizeClonedPickupModel,
} from "./pickups.js";
import { game } from "./state.js";

const _mInv = new THREE.Matrix4();
const _mHand = new THREE.Matrix4();
/** Right-hand-ish offset in character local space when no rig bone is found. */
const _fallbackHandLocal = new THREE.Matrix4().makeTranslation(
  0.35,
  1.05,
  0.12,
);

/** @type {THREE.Group | null} */
let pivot = null;
/** @type {THREE.Group | null} */
let visual = null;

let lastSyncKey = "";
let loadSeq = 0;

/**
 * @param {THREE.Group} player
 */
export function ensurePlayerHeldWeaponHierarchy(player) {
  let root = player.getObjectByName(PLAYER_HELD_WEAPON_ROOT_NAME);
  if (!root) {
    root = new THREE.Group();
    root.name = PLAYER_HELD_WEAPON_ROOT_NAME;
    root.matrixAutoUpdate = false;
    root.visible = true;
    player.add(root);
  }
  pivot = /** @type {THREE.Group} */ (root);
  let v = pivot.getObjectByName("HeldWeaponVisual");
  if (!v) {
    v = new THREE.Group();
    v.name = "HeldWeaponVisual";
    pivot.add(v);
  }
  visual = /** @type {THREE.Group} */ (v);
}

/**
 * @param {THREE.Group} player
 * @returns {THREE.Object3D | null}
 */
function getCharacterModelRoot(player) {
  for (const c of player.children) {
    if (
      c.name === POTION_LIQUID_BLOB_NAME ||
      c.name === PLAYER_HELD_WEAPON_ROOT_NAME
    ) {
      continue;
    }
    return c;
  }
  return null;
}

/**
 * @param {THREE.Object3D} root
 * @returns {THREE.Bone | null}
 */
function findRightHandBone(root) {
  /** @type {THREE.Bone | null} */
  let best = null;
  let bestScore = -1;
  const tests = [
    { re: /mixamorig:righthand/i, score: 100 },
    { re: /mixamorigrighthand/i, score: 99 },
    { re: /^(.*_)?righthand$/i, score: 90 },
    { re: /hand_r$/i, score: 85 },
    { re: /_r_hand$/i, score: 85 },
    { re: /right.*hand/i, score: 70 },
    { re: /hand.*right/i, score: 65 },
  ];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name || "";
    for (const t of tests) {
      if (t.re.test(n) && t.score > bestScore) {
        bestScore = t.score;
        best = /** @type {THREE.Bone} */ (o);
        break;
      }
    }
  });
  return best;
}

/**
 * @param {THREE.Object3D} group
 * @param {number} targetMax
 */
function scaleToMaxDimension(group, targetMax) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const m = Math.max(size.x, size.y, size.z, 1e-6);
  group.scale.setScalar(targetMax / m);
}

function clearVisualChildren() {
  if (!visual) return;
  for (const ch of [...visual.children]) {
    visual.remove(ch);
    disposeObject3D(ch);
  }
}

function hotbarWeaponKey() {
  const id = getHotbarSelectedWeaponId();
  const label =
    id === "power" ? (game.powerfulWeaponLabel || "") : "";
  return `${id}|${label}|${game.playerDead ? 1 : 0}`;
}

function powerfulMeleeUrl() {
  if (game.powerfulWeaponLabel === HOMOHANDS_PICKUP.label) {
    return HOMOHANDS_URL;
  }
  const pick = POWERFUL_WEAPON_PICKUPS.find(
    (p) => p.label === game.powerfulWeaponLabel,
  );
  if (!pick) return null;
  return `${pick.path}?v=${pick.revision}`;
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {string} key
 */
function applyHeldWeaponVisual(loader, key) {
  if (!visual) return;
  loadSeq += 1;
  const mySeq = loadSeq;
  clearVisualChildren();
  const id = getHotbarSelectedWeaponId();

  if (id === "fists" || game.playerDead) {
    return;
  }

  if (id === "bow") {
    const g = createProceduralBowPickupMesh();
    upgradeGltfScene(g);
    g.scale.setScalar(0.55);
    g.rotation.set(0, Math.PI * 0.5, 0.12);
    g.position.set(0.02, 0.02, 0.04);
    visual.add(g);
    return;
  }

  if (id === "deagle") {
    const g = createProceduralDeaglePickupMesh();
    upgradeGltfScene(g);
    g.scale.setScalar(0.62);
    g.rotation.set(0, Math.PI * 0.5, 0);
    g.position.set(0.04, 0.06, 0.02);
    visual.add(g);
    return;
  }

  if (id === "carrot") {
    loadCarrotGltf(loader).then((gltf) => {
      if (mySeq !== loadSeq || hotbarWeaponKey() !== key) return;
      const m = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(m);
      upgradeGltfScene(m);
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scaleToMaxDimension(m, 0.42);
      m.rotation.set(Math.PI * 0.5, 0, 0.35);
      m.position.set(0, 0.02, 0.02);
      visual.add(m);
    });
    return;
  }

  if (id === "power") {
    const url = powerfulMeleeUrl();
    if (!url) return;
    loadPowerfulGltf(loader, url).then((gltf) => {
      if (mySeq !== loadSeq || hotbarWeaponKey() !== key) return;
      const m = cloneSkinned(gltf.scene);
      sanitizeClonedPickupModel(m);
      upgradeGltfScene(m);
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scaleToMaxDimension(m, 0.55);
      m.rotation.set(0, Math.PI * 0.5, -0.08);
      m.position.set(0, 0, 0.04);
      visual.add(m);
    });
  }
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Group} player
 */
export function updatePlayerHeldWeapon(loader, player) {
  ensurePlayerHeldWeaponHierarchy(player);
  if (!pivot || !visual) return;

  const key = hotbarWeaponKey();
  if (key !== lastSyncKey) {
    lastSyncKey = key;
    applyHeldWeaponVisual(loader, key);
  }

  const charRoot = getCharacterModelRoot(player);
  const bone = charRoot ? findRightHandBone(charRoot) : null;

  const id = getHotbarSelectedWeaponId();
  const show = !game.playerDead && id !== "fists";
  pivot.visible = show;
  if (!show) return;

  if (bone) {
    bone.updateMatrixWorld(true);
    _mHand.copy(bone.matrixWorld);
  } else if (charRoot) {
    charRoot.updateMatrixWorld(true, false);
    _mHand.multiplyMatrices(charRoot.matrixWorld, _fallbackHandLocal);
  } else {
    player.updateMatrixWorld(true);
    _mHand.multiplyMatrices(player.matrixWorld, _fallbackHandLocal);
  }

  _mInv.copy(player.matrixWorld).invert();
  _mInv.multiply(_mHand);
  pivot.matrix.copy(_mInv);
}
