import * as THREE from "three";
import {
  SHOCKWAVE_COOLDOWN_SEC,
  SHOCKWAVE_DAMAGE,
  SHOCKWAVE_DURATION_SEC,
  SHOCKWAVE_SCALE_END,
  SHOCKWAVE_SCALE_START,
  SHOCKWAVE_TORUS_MAJOR,
  SHOCKWAVE_TORUS_TUBE,
} from "./config.js";
import { damageHostilesInPlanarRing } from "./enemies.js";
import { disposeObject3D } from "./level.js";
import { game } from "./state.js";

/** @type {THREE.Group | null} */
let shockRoot = null;
/** @type {THREE.Mesh | null} */
let shockMesh = null;
let shockElapsed = 0;
/** @type {Set<object>} */
const shockHitOnce = new Set();

/**
 * Remove shockwave mesh from the scene and clear hit tracking.
 * @param {THREE.Scene} scene
 */
export function disposeShockwave(scene) {
  shockElapsed = 0;
  shockHitOnce.clear();
  if (shockRoot) {
    scene.remove(shockRoot);
    disposeObject3D(shockRoot);
    shockRoot = null;
    shockMesh = null;
  }
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Group} player
 * @param {number} tWall
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function tryConsumeShockwaveRequest(scene, player, tWall, loader) {
  if (!game.requestShockwave) return;
  game.requestShockwave = false;
  if (game.playerDead || game.paused || game.levelTransitioning) return;
  if (tWall < game.shockwaveReadyAt) return;
  beginShockwave(scene, player, tWall, loader);
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Group} player
 * @param {number} tWall
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function beginShockwave(scene, player, tWall, loader) {
  disposeShockwave(scene);
  game.shockwaveReadyAt =
    tWall +
    (game.shockwaveCooldownDisabled ? 0 : SHOCKWAVE_COOLDOWN_SEC);
  shockElapsed = 0;
  shockHitOnce.clear();

  const geo = new THREE.TorusGeometry(
    SHOCKWAVE_TORUS_MAJOR,
    SHOCKWAVE_TORUS_TUBE,
    40,
    128,
  );
  const mat = new THREE.MeshBasicMaterial({
    color: 0x55ccff,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI * 0.5;
  mesh.renderOrder = 50;
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.add(mesh);
  root.position.copy(player.position);
  /** Above feet so the XZ ring is not buried in floor geometry / z-fighting. */
  root.position.y = player.position.y + 0.62;
  scene.add(root);
  shockRoot = root;
  shockMesh = mesh;
  shockMesh.scale.setScalar(SHOCKWAVE_SCALE_START);

  const s0 = SHOCKWAVE_SCALE_START;
  const inner0 = s0 * (SHOCKWAVE_TORUS_MAJOR - SHOCKWAVE_TORUS_TUBE);
  const outer0 = s0 * (SHOCKWAVE_TORUS_MAJOR + SHOCKWAVE_TORUS_TUBE);
  damageHostilesInPlanarRing(
    player,
    inner0,
    outer0,
    SHOCKWAVE_DAMAGE,
    scene,
    loader,
    shockHitOnce,
  );
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Group} player
 * @param {number} simDt
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function updateShockwave(scene, player, simDt, loader) {
  if (!shockRoot || !shockMesh) return;
  if (game.playerDead) {
    disposeShockwave(scene);
    return;
  }

  shockElapsed += simDt;
  if (shockElapsed >= SHOCKWAVE_DURATION_SEC) {
    disposeShockwave(scene);
    return;
  }

  const u = shockElapsed / SHOCKWAVE_DURATION_SEC;
  const scale = THREE.MathUtils.lerp(
    SHOCKWAVE_SCALE_START,
    SHOCKWAVE_SCALE_END,
    u,
  );
  shockMesh.scale.setScalar(scale);
  shockRoot.position.x = player.position.x;
  shockRoot.position.z = player.position.z;
  shockRoot.position.y = player.position.y + 0.62;

  const innerR = scale * (SHOCKWAVE_TORUS_MAJOR - SHOCKWAVE_TORUS_TUBE);
  const outerR = scale * (SHOCKWAVE_TORUS_MAJOR + SHOCKWAVE_TORUS_TUBE);
  damageHostilesInPlanarRing(
    player,
    innerR,
    outerR,
    SHOCKWAVE_DAMAGE,
    scene,
    loader,
    shockHitOnce,
  );
}
