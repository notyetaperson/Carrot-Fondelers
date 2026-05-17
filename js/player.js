import * as THREE from "three";
import { disposeObject3D } from "./level.js";
import { upgradeGltfScene } from "./materialUpgrade.js";
import { game } from "./state.js";

/** Kept when swapping GLB skins — see `potions.js`. */
export const POTION_LIQUID_BLOB_NAME = "PotionLiquidBlob";

/** First-person-style held prop; never stripped on skin swap. */
export const PLAYER_HELD_WEAPON_ROOT_NAME = "PlayerHeldWeaponRoot";

/**
 * Remove loaded character mesh(es) so a new skin can be attached.
 * @param {THREE.Group} player
 */
export function clearPlayerModelForReskin(player) {
  for (const c of [...player.children]) {
    if (c.name === POTION_LIQUID_BLOB_NAME) continue;
    if (c.name === PLAYER_HELD_WEAPON_ROOT_NAME) continue;
    player.remove(c);
    disposeObject3D(c);
  }
  if (game.playerAnim?.mixer) {
    game.playerAnim.mixer.stopAllAction();
  }
  game.playerAnim = null;
}

export function alignModelToGround(model, targetHeight = 1.85) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.y < 1e-6) return;
  const scale = targetHeight / size.y;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.y -= box2.min.y;
}

export function setupPlayerAnimations(gltf, modelRoot) {
  const clips = gltf.animations;
  if (!clips?.length) return null;

  const mixer = new THREE.AnimationMixer(modelRoot);
  const L = (s) => s.toLowerCase();

  let walkClip = clips.find((c) =>
    /walk|strut|jog|march|locomot|run|armature|action\./.test(L(c.name)),
  );
  let idleClip = clips.find((c) =>
    /\bidle\b|stand|rest|breathe|breathing|default|neutral|t[\s_-]?pose/.test(
      L(c.name),
    ),
  );

  if (!walkClip) walkClip = clips.find((c) => c !== idleClip) ?? clips[0];
  if (!idleClip) idleClip = clips.find((c) => c !== walkClip) ?? null;

  const walkAction = mixer.clipAction(walkClip);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);

  if (idleClip && idleClip !== walkClip) {
    const idleAction = mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.play();
    walkAction.play();
    walkAction.setEffectiveWeight(0);
    return { mixer, walk: walkAction, idle: idleAction, walkWeight: 0 };
  }

  walkAction.play();
  walkAction.paused = true;
  return { mixer, walk: walkAction, idle: null, walkWeight: 0 };
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Group} player
 * @param {string} url
 * @param {{ replace?: boolean }} [opts] `replace` — dispose previous skin meshes first (pause menu).
 */
export function loadPlayer(loader, player, url, opts = {}) {
  const { replace = false } = opts;
  if (replace) clearPlayerModelForReskin(player);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = true;
          }
        });
        upgradeGltfScene(model);
        alignModelToGround(model);
        player.add(model);
        game.playerAnim = setupPlayerAnimations(gltf, model);
        resolve(model);
      },
      undefined,
      reject,
    );
  });
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Group} player
 * @param {string} url
 */
export function swapPlayerModel(loader, player, url) {
  return loadPlayer(loader, player, url, { replace: true });
}
