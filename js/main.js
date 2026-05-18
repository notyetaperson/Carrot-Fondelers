import {
  ARENA_COLLISION_MESH_MIN_WORLD_EXTENT,
  ARENA_SPAWN_Y_OFFSET,
  CRYSTAL_COLLISION_MESH_MIN_WORLD_EXTENT,
  CRYSTAL_LEVEL_WORLD_SCALE,
  CRYSTAL_SPAWN_FRAC_U,
  CRYSTAL_SPAWN_FRAC_V,
  DUNGEON_COLLISION_MESH_MIN_WORLD_EXTENT,
  ENABLE_POSTFX,
  FB_ARENA_LEVEL_INDEX,
  FB_ARENA_LEVEL_WORLD_SCALE,
  LEVEL_ARENA_URL,
  LEVEL_CRYSTAL_URL,
  LEVEL_FB_ARENA_URL,
  DUNGEON_STAGES,
  FIRST_DUNGEON_LEVEL_INDEX,
  LAST_DUNGEON_LEVEL_INDEX,
  MOON_DUNGEON_LEVEL_INDEX,
  MOON_DUNGEON_LEVEL_WORLD_SCALE,
  PROGRESSIVE_RENDER_BLEND_SEC,
  PROGRESSIVE_RENDER_ENABLED,
  PROGRESSIVE_RENDER_START_MULT,
  INTERNAL_RENDER_PIXEL_SCALE,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  PLAYER_URL,
  RENDERER_SHADOWS,
  SKYBOX_URL,
  MID_AIR_JUMP_COUNT,
} from "./config.js";
import * as THREE from "three";
import { gltfLoader } from "./gltfLoader.js";
import { setMaterialUpgradeRenderer } from "./materialUpgrade.js";
import { createWorld, setWorldShadowsEnabled } from "./scene.js";
import { attachSceneEnvironment } from "./sceneEnvironment.js";
import { fitSkyboxToLevelBounds, loadSkybox } from "./skybox.js";
import {
  createBoundaryWalls,
  disposeObject3D,
  estimateWalkableFloorY,
  loadArena,
  spawnPlayerInArena,
} from "./level.js";
import {
  buildLevelCollisionProxy,
  collectCollisionMeshes,
  disposeLevelCollisionProxy,
} from "./levelCollision.js";
import { applyLevelVisualPerformanceStrip } from "./levelRenderDowngrade.js";
import { loadPlayer } from "./player.js";
import { updatePlayerHeldWeapon } from "./playerHeldWeapon.js";
import { getInitialPlayerUrl, initPlayerSkinSelector } from "./playerSkin.js";
import { setGamePaused, setupInput } from "./input.js";
import {
  initMobileControls,
  releaseMobileControlsInput,
  syncMobileControlsVisibility,
} from "./mobileControls.js";
import {
  closeEmoteBar,
  initEmotes,
  updateEmotePop,
} from "./emotes.js";
import { initMainUiTheme } from "./mainUiTheme.js";
import { initMedalDisplay, syncMedalBadgeUi } from "./medalDisplay.js";
import { initProgressionHudMode } from "./progressionHudMode.js";
import { initRankDisplay, syncRankBadgeUi } from "./rankDisplay.js";
import { initMouseEffects } from "./mouseEffects.js";
import { updateCamera } from "./cameraRig.js";
import { updatePlayer } from "./movement.js";
import { updateLocomotionAnimations } from "./locomotion.js";
import {
  clearBowBolts,
  clearEnemies,
  createCrystalHostileWave,
  createDungeonHostileWave,
  createEnemies,
  createFbBossWave,
  hasHostilesDying,
  syncGameHostilePresence,
  snapshotAlliesForCarryOver,
  spawnAlliedPigsNearPlayer,
  updateEnemies,
} from "./enemies.js";
import {
  initHealthHud,
  markSpawnProtection,
  restoreFullHealth,
  updateHealthRegen,
} from "./health.js";
import {
  clearPickups,
  tryDrinkSelectedPotion,
  updatePickups,
} from "./pickups.js";
import {
  clearAllPotionEffects,
  getEffectiveSimDt,
  tickPotionsAfterPhysics,
  tickPotionsBeforePhysics,
} from "./potions.js";
import { initBgm, updateBgmReactiveSaturation } from "./bgm.js";
import {
  disposeShockwave,
  tryConsumeShockwaveRequest,
  updateShockwave,
} from "./shockwave.js";
import { initDevConsole } from "./devConsole.js";
import {
  readLevelIndexFromUrl,
  writeLevelIndexToUrl,
} from "./levelUrlSync.js";
import { syncParleyPrompt } from "./negotiation.js";
import { game, keys, move } from "./state.js";
import {
  createPostFX,
  resizePostFX,
  updatePostFX,
} from "./postfx.js";
import { initPostfxGradePauseMenu } from "./postfxGradePresets.js";
import {
  createProceduralCloudLayer,
  updateProceduralCloudLayer,
} from "./proceduralClouds.js";

const canvas = document.querySelector("#game");
const { renderer, scene, camera, player } = createWorld(canvas);
setMaterialUpgradeRenderer(renderer);
attachSceneEnvironment(renderer, scene);
const proceduralClouds = createProceduralCloudLayer(scene);
/** @type {ReturnType<typeof createPostFX> | null} */
const postFX = ENABLE_POSTFX ? createPostFX(renderer, scene, camera) : null;
initPostfxGradePauseMenu(postFX?.gradePass);
/** @type {HTMLDivElement | null} */
const gameStartSeqEl = document.getElementById("game-start-seq");
const GAME_START_SEQ_TOTAL_MS = 6400;
/** @type {HTMLDivElement | null} */
const endingSeqEl = document.getElementById("ending-seq");
const ENDING_SEQ_TOTAL_MS = 8200;
/** @type {HTMLDivElement | null} */
const levelCutsceneEl = document.getElementById("level-cutscene");
/** @type {HTMLParagraphElement | null} */
const levelCutsceneKickerEl = document.getElementById("level-cutscene-kicker");
/** @type {HTMLHeadingElement | null} */
const levelCutsceneTitleEl = document.getElementById("level-cutscene-title");
/** @type {HTMLParagraphElement | null} */
const levelCutsceneSubEl = document.getElementById("level-cutscene-sub");
/** @type {HTMLParagraphElement | null} */
const levelCutsceneOmenEl = document.getElementById("level-cutscene-omen");
const LEVEL_CUTSCENE_TOTAL_MS = 2250;
/** FB arena (level 8): full chaos timing — keep in sync with boss cutscene CSS (~8.8s). */
const LEVEL_BOSS_CUTSCENE_TOTAL_MS = 8800;
let endingSequenceActive = false;
let interLevelCutsceneActive = false;

function playGameStartSequence() {
  if (!(gameStartSeqEl instanceof HTMLDivElement)) return Promise.resolve();
  document.body.classList.add("startup-seq-active");

  return new Promise((resolve) => {
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      gameStartSeqEl.classList.add("game-start-seq--out");
      const finish = () => {
        gameStartSeqEl.classList.add("game-start-seq--hidden");
        gameStartSeqEl.removeEventListener("animationend", onAnimEnd);
        window.removeEventListener("keydown", onKeyDown, true);
        gameStartSeqEl.removeEventListener("pointerdown", onPointerDown, true);
        document.body.classList.remove("startup-seq-active");
        resolve();
      };
      const onAnimEnd = (e) => {
        if (e.target === gameStartSeqEl) finish();
      };
      gameStartSeqEl.addEventListener("animationend", onAnimEnd);
      window.setTimeout(finish, 780);
    };

    const timer = window.setTimeout(complete, GAME_START_SEQ_TOTAL_MS);
    const onKeyDown = (e) => {
      if (
        e.code === "Escape" ||
        e.code === "Enter" ||
        e.code === "Space"
      ) {
        window.clearTimeout(timer);
        e.preventDefault();
        complete();
      }
    };
    const onPointerDown = () => {
      window.clearTimeout(timer);
      complete();
    };

    window.addEventListener("keydown", onKeyDown, true);
    gameStartSeqEl.addEventListener("pointerdown", onPointerDown, true);
  });
}

function playEndingSequence() {
  if (!(endingSeqEl instanceof HTMLDivElement)) return Promise.resolve();
  endingSeqEl.classList.remove("ending-seq--hidden");
  endingSeqEl.classList.remove("ending-seq--out");
  document.body.classList.add("ending-seq-active");
  if (canvas instanceof HTMLCanvasElement && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }

  return new Promise((resolve) => {
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      endingSeqEl.classList.add("ending-seq--out");
      const finish = () => {
        endingSeqEl.classList.add("ending-seq--hidden");
        endingSeqEl.removeEventListener("animationend", onAnimEnd);
        window.removeEventListener("keydown", onKeyDown, true);
        endingSeqEl.removeEventListener("pointerdown", onPointerDown, true);
        document.body.classList.remove("ending-seq-active");
        resolve();
      };
      const onAnimEnd = (e) => {
        if (e.target === endingSeqEl) finish();
      };
      endingSeqEl.addEventListener("animationend", onAnimEnd);
      window.setTimeout(finish, 980);
    };

    const timer = window.setTimeout(complete, ENDING_SEQ_TOTAL_MS);
    const onKeyDown = (e) => {
      if (
        e.code === "Escape" ||
        e.code === "Enter" ||
        e.code === "Space"
      ) {
        window.clearTimeout(timer);
        e.preventDefault();
        complete();
      }
    };
    const onPointerDown = () => {
      window.clearTimeout(timer);
      complete();
    };

    window.addEventListener("keydown", onKeyDown, true);
    endingSeqEl.addEventListener("pointerdown", onPointerDown, true);
  });
}

function levelNameByIndex(levelIndex) {
  if (levelIndex === 0) return "Arena";
  if (levelIndex === 1) return "Crystal";
  if (levelIndex >= FIRST_DUNGEON_LEVEL_INDEX && levelIndex <= LAST_DUNGEON_LEVEL_INDEX) {
    return (
      DUNGEON_STAGES[levelIndex - FIRST_DUNGEON_LEVEL_INDEX]?.displayName ??
      "Dungeon"
    );
  }
  if (levelIndex === FB_ARENA_LEVEL_INDEX) return "Final Arena";
  return "Unknown";
}

function levelTransitionSubtitle(fromIndex, toIndex) {
  if (toIndex === 1) return "Past the dust, the crystal calls.";
  if (toIndex >= FIRST_DUNGEON_LEVEL_INDEX && toIndex <= LAST_DUNGEON_LEVEL_INDEX) {
    const stage = DUNGEON_STAGES[toIndex - FIRST_DUNGEON_LEVEL_INDEX];
    if (stage?.displayName?.toLowerCase().includes("fire")) {
      return "Now were cooking!";
    }
    if (stage?.displayName?.toLowerCase().includes("light")) {
      return "No blacks left.";
    }
    if (stage?.displayName?.toLowerCase().includes("moon")) {
      return "Even in the fog of war, a tank is still visible.";
    }
    if (stage?.displayName?.toLowerCase().includes("poison")) {
      return "It... gave me herpes.";
    }
    if (stage?.displayName?.toLowerCase().includes("rock")) {
      return "Im rock hard.";
    }
    if (stage?.displayName?.toLowerCase().includes("water")) {
      return "Oceans of sperm.";
    }
    return "Another gate, another trial.";
  }
  if (toIndex === FB_ARENA_LEVEL_INDEX) return "One last roar before silence.";
  if (toIndex === 0 && fromIndex === FB_ARENA_LEVEL_INDEX) return "The cycle begins again.";
  return "The path opens.";
}

function playLevelCutscene(fromIndex, toIndex) {
  if (!(levelCutsceneEl instanceof HTMLDivElement)) return Promise.resolve();
  if (
    !(levelCutsceneKickerEl instanceof HTMLParagraphElement) ||
    !(levelCutsceneTitleEl instanceof HTMLHeadingElement) ||
    !(levelCutsceneSubEl instanceof HTMLParagraphElement) ||
    !(levelCutsceneOmenEl instanceof HTMLParagraphElement)
  ) {
    return Promise.resolve();
  }

  const toName = levelNameByIndex(toIndex);
  const isBossPrelude = toIndex === FB_ARENA_LEVEL_INDEX;
  levelCutsceneKickerEl.textContent = `Transition ${fromIndex} → ${toIndex}`;
  levelCutsceneTitleEl.textContent = toName;
  levelCutsceneSubEl.textContent = levelTransitionSubtitle(fromIndex, toIndex);
  if (isBossPrelude) {
    levelCutsceneKickerEl.textContent = "⚠ THREAT LEVEL: OMEGA — ARENA 8 ⚠";
    levelCutsceneTitleEl.textContent = "TOTAL PIG WAR";
    levelCutsceneSubEl.textContent =
      "Every carrot you fondled led here. The final boss does not parley. Gravity is a suggestion.";
    levelCutsceneOmenEl.hidden = false;
    levelCutsceneOmenEl.textContent =
      "NO CHECKPOINTS. NO MERCY. NO TIME.\nRUN · JUMP · OINK · OR GET ERASED.";
    levelCutsceneEl.classList.add("level-cutscene--boss");
  } else {
    levelCutsceneOmenEl.hidden = true;
    levelCutsceneOmenEl.textContent = "";
    levelCutsceneEl.classList.remove("level-cutscene--boss");
  }
  levelCutsceneEl.classList.remove("level-cutscene--hidden", "level-cutscene--out");
  document.body.classList.add("level-cutscene-active");
  if (canvas instanceof HTMLCanvasElement && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
  const totalMs = isBossPrelude
    ? LEVEL_BOSS_CUTSCENE_TOTAL_MS
    : LEVEL_CUTSCENE_TOTAL_MS;

  return new Promise((resolve) => {
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      levelCutsceneEl.classList.add("level-cutscene--out");
      const finish = () => {
        levelCutsceneEl.classList.add("level-cutscene--hidden");
        levelCutsceneEl.removeEventListener("animationend", onAnimEnd);
        window.removeEventListener("keydown", onKeyDown, true);
        levelCutsceneEl.removeEventListener("pointerdown", onPointerDown, true);
        document.body.classList.remove("level-cutscene-active");
        resolve();
      };
      const onAnimEnd = (e) => {
        if (e.target === levelCutsceneEl) finish();
      };
      levelCutsceneEl.addEventListener("animationend", onAnimEnd);
      window.setTimeout(finish, isBossPrelude ? 560 : 420);
    };

    const timer = window.setTimeout(complete, totalMs);
    const onKeyDown = (e) => {
      if (
        e.code === "Escape" ||
        e.code === "Enter" ||
        e.code === "Space"
      ) {
        window.clearTimeout(timer);
        e.preventDefault();
        complete();
      }
    };
    const onPointerDown = () => {
      window.clearTimeout(timer);
      complete();
    };

    window.addEventListener("keydown", onKeyDown, true);
    levelCutsceneEl.addEventListener("pointerdown", onPointerDown, true);
  });
}

async function transitionToLevel(nextIndex, withCutscene = true) {
  if (game.levelTransitioning || interLevelCutsceneActive || endingSequenceActive) return;
  closeEmoteBar();
  const fromIndex = game.levelIndex;
  snapshotAlliesForCarryOver();
  if (withCutscene && nextIndex !== fromIndex) {
    interLevelCutsceneActive = true;
    try {
      await playLevelCutscene(fromIndex, nextIndex);
    } finally {
      interLevelCutsceneActive = false;
    }
  }
  await mountLevel(nextIndex);
}

function smoothstep01(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** @param {number} nowMs */
function internalRenderScale(nowMs) {
  if (!PROGRESSIVE_RENDER_ENABLED) return 1;
  const t0 = game.progressiveRenderStartAt;
  if (t0 == null) return 1;
  const elapsed = (nowMs - t0) * 0.001;
  if (elapsed >= PROGRESSIVE_RENDER_BLEND_SEC) {
    game.progressiveRenderStartAt = null;
    return 1;
  }
  const u = smoothstep01(elapsed / PROGRESSIVE_RENDER_BLEND_SEC);
  return PROGRESSIVE_RENDER_START_MULT + (1 - PROGRESSIVE_RENDER_START_MULT) * u;
}

function applyInternalRenderSize() {
  const now = performance.now();
  const s =
    internalRenderScale(now) *
    Math.min(1, Math.max(0.5, INTERNAL_RENDER_PIXEL_SCALE));
  const w = Math.max(160, Math.round(RENDER_WIDTH * s));
  const h = Math.max(90, Math.round(RENDER_HEIGHT * s));
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (postFX) resizePostFX(postFX, w, h, 1);
}

setupInput(canvas);
initMainUiTheme();
initMobileControls();
initRankDisplay();
initMedalDisplay();
initProgressionHudMode();
initEmotes();
initMouseEffects(canvas);
initHealthHud();

let last = performance.now();

const LEVEL_URLS = [
  LEVEL_ARENA_URL,
  LEVEL_CRYSTAL_URL,
  ...DUNGEON_STAGES.map((s) => s.levelUrl),
  LEVEL_FB_ARENA_URL,
];

const initialLevelIndex = readLevelIndexFromUrl(LEVEL_URLS.length);

/** Filled when Skybox.glb finishes loading (may be after first mountLevel). */
let skyboxRoot = null;

function refreshSkyboxForCurrentLevel() {
  if (skyboxRoot && game.levelBounds) {
    fitSkyboxToLevelBounds(skyboxRoot, game.levelBounds, camera);
  }
}

function doRespawn() {
  if (!game.playerDead || !game.levelBounds || game.arenaFloorY == null) {
    return;
  }
  setGamePaused(false);
  keys.forward = false;
  keys.back = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  releaseMobileControlsInput();
  game.hasCarrotWeapon = false;
  game.hasPowerfulMeleeWeapon = false;
  game.powerfulWeaponLabel = "";
  game.hasBowWeapon = false;
  game.hasDeagleWeapon = false;
  game.playerBowReadyAt = 0;
  game.weaponHotbarIndex = 0;
  game.potionInventory = {};
  game.lastWeaponForAttack = "fists";
  game.bonusMidAirJumps = 0;
  game.playerOutgoingDamageMult = 1;
  game.shockwaveCooldownDisabled = false;
  game.shockwaveReadyAt = 0;
  clearAllPotionEffects(player);
  clearBowBolts(scene);
  clearPickups(scene);
  spawnPlayerInArena(
    player,
    game.levelBounds,
    game.arenaFloorY,
    ARENA_SPAWN_Y_OFFSET,
    game.levelCollisionMeshes,
    game.levelIndex === 1
      ? { u: CRYSTAL_SPAWN_FRAC_U, v: CRYSTAL_SPAWN_FRAC_V }
      : undefined,
  );
  move.vy = 0;
  move.onGround = true;
  move.sprintJumpCarry = false;
  move.jumpsSinceLand = 0;
  move.wallPushX = 0;
  move.wallPushZ = 0;
  move.wallPushStr = 0;
  game.playerWallJumpReadyAt = 0;
  move.airJumpsRemaining = MID_AIR_JUMP_COUNT;
  move.knockX = 0;
  move.knockZ = 0;
  game.cameraSnapped = false;
  game.playerMeleeReadyAt = 0;
  game.requestMelee = false;
  game.requestDrinkPotion = false;
  game.requestPhaseDash = false;
  game.playerPhaseDashReadyAt = 0;
  game.requestShockwave = false;
  game.requestNegotiate = false;
  disposeShockwave(scene);
  restoreFullHealth();
  markSpawnProtection();
}

/**
 * @param {number} levelIndex 0 = arena, 1 = Crystal, 2…LAST = dungeons, then FB arena (`FB_ARENA_LEVEL_INDEX`)
 */
async function mountLevel(levelIndex) {
  if (game.levelTransitioning) return;
  if (levelIndex < 0 || levelIndex >= LEVEL_URLS.length) return;
  game.levelTransitioning = true;
  game.waveSpawned = false;
  game.enemiesRemaining = 0;
  disposeShockwave(scene);

  const url = LEVEL_URLS[levelIndex];

  try {
    game.progressiveRenderStartAt = null;
    disposeLevelCollisionProxy(game);
    clearPickups(scene);
    clearBowBolts(scene);
    clearEnemies(scene);
    if (game.boundaryGroup) {
      scene.remove(game.boundaryGroup);
      disposeObject3D(game.boundaryGroup);
      game.boundaryGroup = null;
    }
    if (game.levelRoot) {
      scene.remove(game.levelRoot);
      disposeObject3D(game.levelRoot);
      game.levelRoot = null;
    }
    game.levelCollisionMeshes = [];
    game.levelBounds = null;
    game.arenaFloorY = null;

    let { root, box, floorY } = await loadArena(gltfLoader, scene, url);
    if (levelIndex === 1 && CRYSTAL_LEVEL_WORLD_SCALE !== 1) {
      root.scale.setScalar(CRYSTAL_LEVEL_WORLD_SCALE);
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      floorY = estimateWalkableFloorY(root, box);
    }
    if (
      levelIndex === MOON_DUNGEON_LEVEL_INDEX &&
      MOON_DUNGEON_LEVEL_WORLD_SCALE !== 1
    ) {
      root.scale.setScalar(MOON_DUNGEON_LEVEL_WORLD_SCALE);
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      floorY = estimateWalkableFloorY(root, box);
    }
    if (
      levelIndex === FB_ARENA_LEVEL_INDEX &&
      FB_ARENA_LEVEL_WORLD_SCALE !== 1
    ) {
      root.scale.setScalar(FB_ARENA_LEVEL_WORLD_SCALE);
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      floorY = estimateWalkableFloorY(root, box);
    }
    game.levelRoot = root;
    game.levelBounds = box.clone();
    game.arenaFloorY = floorY;
    root.updateMatrixWorld(true);
    const dungeonLikeCollision =
      (levelIndex >= FIRST_DUNGEON_LEVEL_INDEX &&
        levelIndex <= LAST_DUNGEON_LEVEL_INDEX) ||
      levelIndex === FB_ARENA_LEVEL_INDEX;
    let levelMeshes;
    if (levelIndex === 1) {
      levelMeshes = collectCollisionMeshes(root, {
        minWorldExtent: CRYSTAL_COLLISION_MESH_MIN_WORLD_EXTENT,
      });
    } else if (dungeonLikeCollision) {
      levelMeshes = collectCollisionMeshes(root, {
        minWorldExtent: DUNGEON_COLLISION_MESH_MIN_WORLD_EXTENT,
      });
    } else {
      levelMeshes = collectCollisionMeshes(root, {
        minWorldExtent: ARENA_COLLISION_MESH_MIN_WORLD_EXTENT,
      });
    }
    if (levelIndex === 0 && levelMeshes.length < 22) {
      levelMeshes = collectCollisionMeshes(root);
    }
    if (levelIndex === 1 && levelMeshes.length < 5) {
      levelMeshes = collectCollisionMeshes(root);
    }
    if (dungeonLikeCollision && levelMeshes.length < 8) {
      levelMeshes = collectCollisionMeshes(root);
    }
    const collisionProxy = buildLevelCollisionProxy(levelMeshes);
    game.collisionProxy = collisionProxy;
    game.levelCollisionMeshes = collisionProxy ? [collisionProxy] : levelMeshes;
    applyLevelVisualPerformanceStrip(root, scene, collisionProxy != null);
    game.boundaryGroup = createBoundaryWalls(scene, box);
    spawnPlayerInArena(
      player,
      box,
      floorY,
      ARENA_SPAWN_Y_OFFSET,
      game.levelCollisionMeshes,
      levelIndex === 1
        ? { u: CRYSTAL_SPAWN_FRAC_U, v: CRYSTAL_SPAWN_FRAC_V }
        : undefined,
    );
    move.vy = 0;
    move.onGround = true;
    move.sprintJumpCarry = false;
    move.jumpsSinceLand = 0;
    move.wallPushX = 0;
    move.wallPushZ = 0;
    move.wallPushStr = 0;
    game.playerWallJumpReadyAt = 0;
    move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
    game.levelIndex = levelIndex;
    syncRankBadgeUi();
    syncMedalBadgeUi();
    restoreFullHealth();
    markSpawnProtection();
    if (levelIndex === 0) {
      await createEnemies(
        gltfLoader,
        scene,
        box,
        floorY,
        game.levelCollisionMeshes,
      );
    } else if (levelIndex === 1) {
      await createCrystalHostileWave(
        gltfLoader,
        scene,
        box,
        floorY,
        game.levelCollisionMeshes,
      );
      if (game.alliedPigCount > 0) {
        await spawnAlliedPigsNearPlayer(
          gltfLoader,
          scene,
          box,
          floorY,
          game.levelCollisionMeshes,
          player,
        );
      }
    } else if (
      levelIndex >= FIRST_DUNGEON_LEVEL_INDEX &&
      levelIndex <= LAST_DUNGEON_LEVEL_INDEX
    ) {
      const stage = DUNGEON_STAGES[levelIndex - FIRST_DUNGEON_LEVEL_INDEX];
      await createDungeonHostileWave(
        gltfLoader,
        scene,
        box,
        floorY,
        game.levelCollisionMeshes,
        stage,
      );
      if (game.alliedPigCount > 0) {
        await spawnAlliedPigsNearPlayer(
          gltfLoader,
          scene,
          box,
          floorY,
          game.levelCollisionMeshes,
          player,
        );
      }
    } else if (levelIndex === FB_ARENA_LEVEL_INDEX) {
      await createFbBossWave(
        gltfLoader,
        scene,
        box,
        floorY,
        game.levelCollisionMeshes,
      );
    }
    game.playerMeleeReadyAt = 0;
    refreshSkyboxForCurrentLevel();
    writeLevelIndexToUrl(levelIndex);
    if (PROGRESSIVE_RENDER_ENABLED) {
      game.progressiveRenderStartAt = performance.now();
    }
  } finally {
    game.levelTransitioning = false;
    /** Arena only: skinned pig shadows tank FPS on Crystal + dungeon-sized fights. */
    setWorldShadowsEnabled(RENDERER_SHADOWS && levelIndex === 0);
    applyInternalRenderSize();
  }
}

function tick(now) {
  syncMobileControlsVisibility();
  const frameDt = Math.min((now - last) / 1000, 0.08);
  const rawDt = game.paused ? 0 : Math.min(frameDt, 0.05);
  last = now;
  const tWall = performance.now() * 0.001;
  updateProceduralCloudLayer(proceduralClouds, player, tWall);
  tickPotionsBeforePhysics(tWall, player);

  if (game.requestDrinkPotion) {
    game.requestDrinkPotion = false;
    if (!game.paused && !game.levelTransitioning && !game.playerDead) {
      tryDrinkSelectedPotion(player);
    }
  }

  if (game.requestRespawn) {
    game.requestRespawn = false;
    doRespawn();
  }

  const simDt =
    game.paused || game.levelTransitioning || endingSequenceActive || interLevelCutsceneActive
      ? 0
      : getEffectiveSimDt(rawDt, tWall);

  if (!game.paused && !game.levelTransitioning && !endingSequenceActive && !interLevelCutsceneActive) {
    game.physicsTick = (game.physicsTick + 1) >>> 0;
    updatePlayer(simDt, player);
    updateEnemies(simDt, player, scene, gltfLoader);
    tryConsumeShockwaveRequest(scene, player, tWall, gltfLoader);
    updateShockwave(scene, player, simDt, gltfLoader);
    updatePickups(simDt, player, scene);
    if (
      game.levelIndex === 0 &&
      game.waveSpawned &&
      game.enemiesRemaining <= 0 &&
      !hasHostilesDying() &&
      !game.playerDead
    ) {
      transitionToLevel(1).catch((err) => console.error(err));
    }
    if (
      game.levelIndex === 1 &&
      game.waveSpawned &&
      game.enemiesRemaining <= 0 &&
      !hasHostilesDying() &&
      !game.playerDead
    ) {
      transitionToLevel(2).catch((err) => console.error(err));
    }
    if (
      game.levelIndex >= FIRST_DUNGEON_LEVEL_INDEX &&
      game.levelIndex <= LAST_DUNGEON_LEVEL_INDEX &&
      game.waveSpawned &&
      game.enemiesRemaining <= 0 &&
      !hasHostilesDying() &&
      !game.playerDead
    ) {
      const nextIndex =
        game.levelIndex === LAST_DUNGEON_LEVEL_INDEX
          ? FB_ARENA_LEVEL_INDEX
          : game.levelIndex + 1;
      transitionToLevel(nextIndex).catch((err) => console.error(err));
    }
    if (
      game.levelIndex === FB_ARENA_LEVEL_INDEX &&
      game.waveSpawned &&
      game.enemiesRemaining <= 0 &&
      !hasHostilesDying() &&
      !game.playerDead
    ) {
      endingSequenceActive = true;
      void (async () => {
        try {
          snapshotAlliesForCarryOver();
          await playEndingSequence();
          await mountLevel(0);
        } catch (err) {
          console.error(err);
        } finally {
          endingSequenceActive = false;
        }
      })();
    }
    updateCamera(simDt, camera, player);
    updateLocomotionAnimations(simDt);
    tickPotionsAfterPhysics(tWall, player, scene, gltfLoader);
  }

  syncGameHostilePresence();
  syncParleyPrompt();

  updateHealthRegen(rawDt);

  if (game.progressiveRenderStartAt != null) {
    applyInternalRenderSize();
  }

  if (postFX) {
    updatePostFX(postFX, performance.now() * 0.001);
    postFX.composer.render();
  } else {
    renderer.render(scene, camera);
  }
  if (canvas instanceof HTMLCanvasElement) {
    updateBgmReactiveSaturation(canvas, frameDt);
  }
  updatePlayerHeldWeapon(gltfLoader, player);
  updateEmotePop(camera, player);
  requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  game.progressiveRenderStartAt = null;
  applyInternalRenderSize();
});

Promise.all([
  loadSkybox(gltfLoader, scene, SKYBOX_URL).then((root) => {
    skyboxRoot = root;
    refreshSkyboxForCurrentLevel();
    return root;
  }),
  mountLevel(initialLevelIndex),
  loadPlayer(gltfLoader, player, getInitialPlayerUrl() ?? PLAYER_URL),
])
  .then(() => {
    initPlayerSkinSelector(gltfLoader, player);
    initBgm();
    initDevConsole({
      scene,
      loader: gltfLoader,
      advanceLevel: async () => {
        if (game.levelTransitioning) return;
        const i = game.levelIndex;
        if (i === 0) {
          await transitionToLevel(1);
        } else if (i === 1) {
          await transitionToLevel(2);
        } else if (i >= FIRST_DUNGEON_LEVEL_INDEX && i < LAST_DUNGEON_LEVEL_INDEX) {
          await transitionToLevel(i + 1);
        } else if (i === LAST_DUNGEON_LEVEL_INDEX) {
          await transitionToLevel(FB_ARENA_LEVEL_INDEX);
        } else if (i === FB_ARENA_LEVEL_INDEX) {
          await transitionToLevel(0);
        } else {
          await mountLevel(0);
        }
      },
      togglePause: () => setGamePaused(!game.paused),
      getPlayer: () => player,
    });
    playGameStartSequence().finally(() => requestAnimationFrame(tick));
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("hint").textContent =
      "Failed to load assets. Run a local server from the project folder (e.g. python scripts/serve.py).";
  });
