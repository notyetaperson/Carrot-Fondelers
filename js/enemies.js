import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  ALLY_FOLLOW_RADIUS,
  ALLY_SLOT_DRIFT,
  ALLY_SPAWN_RING,
  BOW_COOLDOWN_SEC,
  BOW_PROJECTILE_FEET_Y,
  BOW_PROJECTILE_MAX_RANGE,
  BOW_PROJECTILE_SCALE,
  BOW_PROJECTILE_SPEED,
  BOW_SPAWN_FORWARD,
  DEAGLE_COOLDOWN_SEC,
  DEAGLE_PROJECTILE_MAX_RANGE,
  DEAGLE_PROJECTILE_SCALE,
  DEAGLE_PROJECTILE_SPEED,
  getBowDamageForLevel,
  getCarrotMeleeDamageForLevel,
  getDeagleDamageForLevel,
  getEnemyContactDamage,
  getPowerfulMeleeDamageForLevel,
  FB_BOSS_CONTACT_DAMAGE,
  FB_BOSS_KNOCKBACK_MULT,
  FB_BOSS_MAX_HEALTH,
  FB_BOSS_COMBAT_REACH_MULT,
  FB_BOSS_CONTACT_RADIUS_CAP,
  FB_BOSS_HITBOX_RADIUS_MULT,
  FB_BOSS_MODEL_SCALE,
  FB_BOSS_MODEL_YAW,
  FB_BOSS_URL,
  CRYSTAL_ENEMY_MAX_HEALTH,
  CRYSTAL_ENEMY_MODEL_SCALE,
  ENEMY_COLLIDER_RADIUS,
  ENEMY_COUNT,
  ENEMY_CRYSTAL_URL,
  ENEMY_DEATH_FADE_PER_SEC,
  ENEMY_HIT_COOLDOWN,
  ENEMY_MAX_HEALTH,
  ENEMY_MODEL_HEIGHT,
  ENEMY_SPEED,
  ENEMY_SPAWN_CLEAR_RADIUS,
  ENEMY_VS_ENEMY_COOLDOWN,
  ENEMY_VS_ENEMY_DAMAGE,
  CRYSTAL_ENEMY_COUNT,
  ENEMY_SUPPORT_FEET_RAY_INTERVAL_FRAMES,
  INTER_SQUAD_PVP_MIN_PLAYER_DIST,
  PIG_FRIENDS_MAX,
  PIG_FRIENDS_MIN,
  ENEMY_KNOCKBACK_DECAY,
  ENEMY_KNOCKBACK_MAX_SPEED,
  ENEMY_URL,
  LEVEL_INNER_MARGIN,
  NEGOTIATE_COOLDOWN_SEC,
  NEGOTIATE_EYE_HEIGHT,
  NEGOTIATE_LOS_SKIN,
  NEGOTIATE_MIN_DOT,
  NEGOTIATE_PIG_AIM_Y,
  NEGOTIATE_RANGE,
  PLAYER_HITBOX_RADIUS,
  PLAYER_MELEE_COOLDOWN,
  PLAYER_MELEE_DAMAGE,
  MELEE_AIR_HIT_DAMAGE_MULT,
  MELEE_SPRINT_JUMP_HIT_DAMAGE_MULT,
  MELEE_SPRINT_TRIPLE_JUMP_HIT_DAMAGE_MULT,
  MELEE_KNOCKBACK_IMPULSE,
  SHOCKWAVE_KNOCKBACK_IMPULSE,
  SHOCKWAVE_KNOCKBACK_MAX_SPEED,
  PLAYER_HIT_KNOCKBACK_IMPULSE,
  PLAYER_KNOCKBACK_MAX_SPEED,
  PLAYER_MELEE_MIN_DOT,
  PLAYER_MELEE_RANGE,
} from "./config.js";
import {
  applyDamage,
  applyFinalBossStatDrop,
  triggerPlayerLandHitFlash,
} from "./health.js";
import {
  negotiatePigAlliance,
  rollAllyRecruitAttempt,
  showNegotiationToast,
} from "./negotiation.js";
import { upgradeGltfScene } from "./materialUpgrade.js";
import { disposeObject3D } from "./level.js";
import { getSupportFeetY, hasLineOfSight } from "./levelCollision.js";
import {
  forfeitBestWeaponPerAllyBond,
  getHotbarSelectedWeaponId,
  loadCarrotGltf,
  trySpawnBowPickup,
  trySpawnCarrotPickup,
  trySpawnDeaglePickup,
  trySpawnExtraAirJumpPickup,
  trySpawnHpBoostPickup,
  trySpawnFoodPickup,
  trySpawnPotionPickup,
  spawnHomohandsDevUnlockPickup,
} from "./pickups.js";
import { alignModelToGround } from "./player.js";
import {
  getBloodlustDamageMult,
  getGildedMeleeRangeMult,
  getSwiftBowCooldownMult,
} from "./potions.js";
import { playPigDeathSfx } from "./sfx.js";
import { allyPickupGatherers, camOrbit, game, move } from "./state.js";

/** Hostile pig that can fight, deal contact damage, or be negotiated with. */
function isLivingHostile(e) {
  return !e.ally && !e.dying && e.health > 0;
}

/** @type {HTMLElement | null} */
let killCountEl = null;

function syncKillCounterDisplay() {
  killCountEl ??= document.getElementById("kill-counter-value");
  if (killCountEl) killCountEl.textContent = String(game.enemyKills);
}

function syncHostileRemaining() {
  game.enemiesRemaining = enemies.filter(isLivingHostile).length;
}

/**
 * @param {THREE.Scene} scene
 * @param {import("three").GLTF} gltf
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[]} collisionMeshes
 * @param {number} x
 * @param {number} z
 * @param {boolean} ally
 * @param {number} [maxHealth]
 * @param {number} [visualScale] uniform scale for model + collider radius (Crystal = smaller).
 * @param {boolean} [isFbBoss]
 * @param {string} [pigGltfUrl] GLB URL used to load this pig (carry-over across levels for allies).
 * @param {number} [modelYawExtra] added to mesh `rotation.y` after ground align (not used for FB boss).
 */
function pushPig(
  scene,
  gltf,
  box,
  floorY,
  collisionMeshes,
  x,
  z,
  ally,
  maxHealth = ENEMY_MAX_HEALTH,
  visualScale = 1,
  isFbBoss = false,
  pigGltfUrl = ENEMY_URL,
  modelYawExtra = 0,
) {
  const model = cloneSkinned(gltf.scene);
  upgradeGltfScene(model);
  const pigCastShadow = game.levelIndex === 0;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = pigCastShadow;
      o.receiveShadow = true;
      o.frustumCulled = true;
    }
  });
  alignModelToGround(model, ENEMY_MODEL_HEIGHT);
  if (isFbBoss) {
    model.rotation.y = FB_BOSS_MODEL_YAW;
  } else if (modelYawExtra !== 0) {
    model.rotation.y += modelYawExtra;
  }

  const group = new THREE.Group();
  group.add(model);
  group.scale.setScalar(visualScale);

  let deckY = floorY;
  if (collisionMeshes?.length) {
    const footProbeR = ENEMY_COLLIDER_RADIUS * visualScale;
    const s = getSupportFeetY(
      x,
      floorY + 0.5,
      z,
      collisionMeshes,
      box,
      footProbeR,
    );
    if (s != null) deckY = s;
  }
  group.position.set(x, deckY, z);

  const anim = setupEnemyAnimations(gltf, model);
  const radius = enemyFootRadius(group);

  scene.add(group);

  enemies.push({
    group,
    model,
    mixer: anim.mixer,
    walk: anim.walk,
    idle: anim.idle,
    death: anim.death,
    walkWeight: anim.walkWeight,
    radius,
    health: maxHealth,
    dying: false,
    deathFadeOpacity: 1,
    ally,
    /** @type {EnemyInst[]} who join if this pig is convinced */
    friendGroup: [],
    squadId: 0,
    pigBrawlReadyAt: 0,
    allyContactReadyAt: 0,
    allyRecruitReadyAt: 0,
    negotiationGlowActive: false,
    knockVx: 0,
    knockVz: 0,
    isFbBoss,
    pigGltfUrl,
    modelYawExtra,
  });
}

/**
 * @param {THREE.Group} player
 * @param {number} ex
 * @param {number} ez
 * @param {number} [impulseMult] scales impulse and knock speed cap (FB boss = `FB_BOSS_KNOCKBACK_MULT`).
 */
function knockPlayerFromPig(player, ex, ez, impulseMult = 1) {
  let nx = player.position.x - ex;
  let nz = player.position.z - ez;
  const len = Math.hypot(nx, nz);
  if (len < 1e-4) {
    nx = Math.sin(camOrbit.yaw);
    nz = Math.cos(camOrbit.yaw);
  } else {
    nx /= len;
    nz /= len;
  }
  const imp = PLAYER_HIT_KNOCKBACK_IMPULSE * impulseMult;
  const cap = PLAYER_KNOCKBACK_MAX_SPEED * impulseMult;
  move.knockX += nx * imp;
  move.knockZ += nz * imp;
  const kn = Math.hypot(move.knockX, move.knockZ);
  if (kn > cap) {
    const s = cap / kn;
    move.knockX *= s;
    move.knockZ *= s;
  }
}

/**
 * @param {unknown[]} arr
 */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
}

function assignRandomFriendGroups() {
  const list = enemies.filter((e) => !e.ally);
  const n = list.length;
  if (n === 0) return;
  for (const e of list) {
    const others = list.filter((o) => o !== e);
    shuffleInPlace(others);
    const cap = Math.min(PIG_FRIENDS_MAX, others.length);
    const low = Math.min(PIG_FRIENDS_MIN, cap);
    const k =
      cap === 0 ? 0 : low + ((Math.random() * (cap - low + 1)) | 0);
    e.friendGroup = others.slice(0, k);
  }
}

/**
 * Union-find connected components from mutual friend links (hostiles only).
 * @param {EnemyInst[]} hostiles
 */
function computeSquadIds(hostiles) {
  /** @type {Map<EnemyInst, EnemyInst>} */
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x);
    if (p !== x) {
      parent.set(x, find(p));
    }
    return /** @type {EnemyInst} */ (parent.get(x));
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const e of hostiles) parent.set(e, e);

  for (const e of hostiles) {
    for (const f of e.friendGroup) {
      if (
        f &&
        !f.dying &&
        !f.ally &&
        f !== e &&
        hostiles.includes(f)
      ) {
        union(e, f);
      }
    }
  }

  /** @type {Map<EnemyInst, number>} */
  const rootToId = new Map();
  let next = 0;
  for (const e of hostiles) {
    const r = find(e);
    if (!rootToId.has(r)) rootToId.set(r, next++);
    e.squadId = /** @type {number} */ (rootToId.get(r));
  }
}

/**
 * The squad whose closest member is nearest the player is the only one that may engage the player.
 * @param {EnemyInst[]} hostiles
 * @param {number} px
 * @param {number} pz
 */
function pickActiveSquadId(hostiles, px, pz) {
  if (!hostiles.length) return -1;
  /** @type {Map<number, number>} */
  const bestD = new Map();
  for (const e of hostiles) {
    const d = Math.hypot(e.group.position.x - px, e.group.position.z - pz);
    const cur = bestD.get(e.squadId);
    if (cur == null || d < cur) bestD.set(e.squadId, d);
  }
  let active = -1;
  let minD = Infinity;
  for (const [sid, d] of bestD) {
    if (d < minD) {
      minD = d;
      active = sid;
    }
  }
  return active;
}

/**
 * @param {number} squadId
 * @param {EnemyInst[]} hostiles
 */
function squadCentroidXZ(squadId, hostiles) {
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const e of hostiles) {
    if (e.squadId !== squadId) continue;
    sx += e.group.position.x;
    sz += e.group.position.z;
    n += 1;
  }
  if (!n) return { x: 0, z: 0 };
  return { x: sx / n, z: sz / n };
}

/**
 * @param {EnemyInst} e
 * @param {EnemyInst[]} hostiles
 * @returns {EnemyInst | null}
 */
function findNearestOtherSquadFoe(e, hostiles) {
  /** @type {EnemyInst | null} */
  let best = null;
  let bestD = Infinity;
  for (const o of hostiles) {
    if (o === e || o.squadId === e.squadId) continue;
    const d = Math.hypot(
      o.group.position.x - e.group.position.x,
      o.group.position.z - e.group.position.z,
    );
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/**
 * Death from pig-on-pig fight — no kill credit or carrot.
 * @param {EnemyInst} e
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function beginHostileDeathNoLoot(e, scene, loader) {
  if (e.dying) return;
  playPigDeathSfx();
  e.dying = true;
  e.deathFadeOpacity = 1;
  syncHostileRemaining();
  trySpawnExtraAirJumpPickup(loader, scene, e.group.position);
  trySpawnHpBoostPickup(loader, scene, e.group.position);
  if (!e.isFbBoss) trySpawnFoodPickup(loader, scene, e.group.position);
  trySpawnPotionPickup(loader, scene, e.group.position);
  if (e.death) {
    e.walk?.fadeOut(0.1);
    e.idle?.fadeOut(0.1);
    e.death.enabled = true;
    e.death.reset().setEffectiveWeight(1).fadeIn(0.12).play();
  } else {
    e.walk?.stop();
    e.idle?.stop();
  }
}

export function getAlliedLivingCount() {
  return enemies.filter((e) => e.ally && !e.dying).length;
}

/**
 * Insta-kill every living hostile (dev). One death SFX; carrot drops roll per pig.
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function devInstaKillAllHostiles(scene, loader) {
  const victims = enemies.filter(isLivingHostile);
  if (victims.length === 0) return 0;
  playPigDeathSfx();
  for (const e of victims) {
    if (e.dying) continue;
    e.health = 0;
    e.dying = true;
    e.deathFadeOpacity = 1;
    game.enemyKills += 1;
    if (e.isFbBoss) {
      spawnHomohandsDevUnlockPickup(loader, scene, e.group.position);
      applyFinalBossStatDrop();
    } else {
      trySpawnCarrotPickup(loader, scene, e.group.position);
      trySpawnBowPickup(loader, scene, e.group.position);
      trySpawnDeaglePickup(loader, scene, e.group.position);
    }
    trySpawnExtraAirJumpPickup(loader, scene, e.group.position);
    trySpawnHpBoostPickup(loader, scene, e.group.position);
    if (!e.isFbBoss) trySpawnFoodPickup(loader, scene, e.group.position);
    trySpawnPotionPickup(loader, scene, e.group.position);
    if (e.death) {
      e.walk?.fadeOut(0.1);
      e.idle?.fadeOut(0.1);
      e.death.enabled = true;
      e.death.reset().setEffectiveWeight(1).fadeIn(0.12).play();
    } else {
      e.walk?.stop();
      e.idle?.stop();
    }
  }
  syncKillCounterDisplay();
  syncHostileRemaining();
  return victims.length;
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Group} player
 */
async function runNegotiation(scene, player) {
  const t = performance.now() * 0.001;
  if (t < game.negotiateReadyAt) return;
  if (game.negotiating) return;

  const speaker = game.negotiationHighlight;
  if (!speaker) {
    showNegotiationToast(
      "No pig in parley range with clear line of sight — get closer or move so you can see one.",
      "info",
    );
    game.negotiateReadyAt = t + 1;
    return;
  }
  if (speaker.isFbBoss) {
    showNegotiationToast("FB didn’t come here to parley.", "info");
    game.negotiateReadyAt = t + 1;
    return;
  }
  if (!isLivingHostile(speaker)) {
    showNegotiationToast("That pig isn't available to parley with.", "info");
    return;
  }

  game.negotiating = true;
  showNegotiationToast("This pig is thinking…", "info");

  const result = await negotiatePigAlliance();

  game.negotiating = false;
  game.negotiateReadyAt = performance.now() * 0.001 + NEGOTIATE_COOLDOWN_SEC;

  if (!result.ok) {
    showNegotiationToast(
      result.error ?? "Negotiation failed.",
      "err",
    );
    return;
  }

  if (!isLivingHostile(speaker)) {
    showNegotiationToast("That pig is gone.", "info");
    return;
  }

  if (result.convinced) {
    const joined = applyRecruitedCliqueFromSpeaker(speaker);
    showNegotiationToast(
      result.reply ||
        (joined > 1
          ? `Squeal! Us ${joined} are with you!`
          : "Fine — I'm in."),
      "ok",
    );
  } else {
    showNegotiationToast(
      result.reply || "This pig isn't buying it.",
      "info",
    );
  }
}

/**
 * @typedef {{
 *   group: THREE.Group,
 *   model: THREE.Object3D,
 *   mixer: THREE.AnimationMixer | null,
 *   walk: THREE.AnimationAction | null,
 *   idle: THREE.AnimationAction | null,
 *   death: THREE.AnimationAction | null,
 *   walkWeight: number,
 *   radius: number,
 *   health: number,
 *   dying: boolean,
 *   deathFadeOpacity: number,
 *   fadeMaterials?: import("three").Material[],
 *   ally: boolean,
 *   friendGroup: EnemyInst[],
 *   squadId: number,
 *   pigBrawlReadyAt: number,
 *   allyContactReadyAt: number,
 *   allyRecruitReadyAt: number,
 *   negotiationGlowActive: boolean,
 *   knockVx: number,
 *   knockVz: number,
 *   isFbBoss: boolean,
 *   pigGltfUrl: string,
 *   modelYawExtra: number,
 * }}
 */

/** @type {EnemyInst[]} */
let enemies = [];

/** @type {Map<string, import("three").GLTF>} */
const enemyGltfByUrl = new Map();

/** Min seconds between ally→pig parley rolls per allied pig. */
const ALLY_RECRUIT_TRY_COOLDOWN = 3.8;

/** Throttle toast spam when several allies recruit close together. */
let lastAutoAllyRecruitToastAt = -999;

/**
 * @param {EnemyInst} speaker still-hostile pig who was convinced (clique root).
 * @returns {number} how many pigs joined (clique size)
 */
function applyRecruitedCliqueFromSpeaker(speaker) {
  /** @type {Set<EnemyInst>} */
  const clique = new Set([speaker]);
  for (const f of speaker.friendGroup) {
    if (f && isLivingHostile(f)) clique.add(f);
  }
  for (const e of clique) {
    if (isLivingHostile(e)) e.ally = true;
  }
  syncHostileRemaining();
  const joined = clique.size;
  for (let i = 0; i < joined; i++) forfeitBestWeaponPerAllyBond();
  return joined;
}

/**
 * @param {EnemyInst} ally
 * @param {EnemyInst} target
 */
function isAllyRecruitEligible(ally, target) {
  if (!ally.ally || ally.dying || ally.health <= 0) return false;
  if (!isLivingHostile(target) || target.isFbBoss) return false;
  const meshes = game.levelCollisionMeshes;
  const ax = ally.group.position.x;
  const az = ally.group.position.z;
  const ay = ally.group.position.y + pigNegotiateAimY(ally) + 0.48;
  const tx = target.group.position.x;
  const tz = target.group.position.z;
  const ty = target.group.position.y + pigNegotiateAimY(target);
  const dist = Math.hypot(tx - ax, tz - az);
  if (dist > NEGOTIATE_RANGE || dist < 1e-4) return false;
  return hasLineOfSight(
    ax,
    ay,
    az,
    tx,
    ty,
    tz,
    meshes,
    NEGOTIATE_LOS_SKIN,
  );
}

/**
 * @param {EnemyInst} ally
 * @returns {EnemyInst | null}
 */
function pickAllyRecruitTarget(ally) {
  /** @type {EnemyInst | null} */
  let best = null;
  let bestD = Infinity;
  for (const h of enemies) {
    if (h === ally || !isAllyRecruitEligible(ally, h)) continue;
    const d = Math.hypot(
      h.group.position.x - ally.group.position.x,
      h.group.position.z - ally.group.position.z,
    );
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/**
 * Allied pigs periodically parley with nearby hostiles (same odds as F).
 */
function tryAllyAutoRecruits() {
  if (game.playerDead || game.negotiating) return;
  const t = performance.now() * 0.001;
  for (const ally of enemies) {
    if (!ally.ally || ally.dying || ally.health <= 0) continue;
    if (ally.allyRecruitReadyAt > t) continue;
    const target = pickAllyRecruitTarget(ally);
    ally.allyRecruitReadyAt = t + ALLY_RECRUIT_TRY_COOLDOWN;
    if (!target) continue;
    if (!rollAllyRecruitAttempt()) continue;
    if (!isLivingHostile(target)) continue;
    const joined = applyRecruitedCliqueFromSpeaker(target);
    if (t - lastAutoAllyRecruitToastAt > 2.4) {
      lastAutoAllyRecruitToastAt = t;
      showNegotiationToast(
        joined > 1
          ? `${joined} pigs joined — your allies talked them round.`
          : "An ally talked a pig into joining.",
        "ok",
      );
    }
  }
}

const tmpFwd = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
const tmpEye = new THREE.Vector3();
const bowRaycaster = new THREE.Raycaster();
const bowRayOrigin = new THREE.Vector3();
const bowRayDir = new THREE.Vector3();

/** @type {import("three").GLTF | null} */
let bowBoltGltf = null;

/**
 * @typedef {{
 *   group: THREE.Group,
 *   vx: number,
 *   vz: number,
 *   dist: number,
 *   speed: number,
 *   damage: number,
 *   maxRange: number,
 * }} BowBoltInst
 */

/** @type {BowBoltInst[]} */
let bowBolts = [];

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function ensureBowBoltGltf(loader) {
  if (bowBoltGltf) return Promise.resolve(bowBoltGltf);
  return loadCarrotGltf(loader).then((g) => {
    bowBoltGltf = g;
    return g;
  });
}

/**
 * Earliest intersection of XZ segment (x0,z0)→(x1,z1) with circle (px,pz), radius r.
 * @returns {number | null} t in [0,1] along segment, or null
 */
function segmentCircleHitXZ(x0, z0, x1, z1, px, pz, r) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const fx = x0 - px;
  const fz = z0 - pz;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Math.hypot(fx, fz) <= r ? 0 : null;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / (2 * a);
  const t1 = (-b + s) / (2 * a);
  /** @type {number | null} */
  let best = null;
  for (const t of [t0, t1]) {
    if (t >= 0 && t <= 1 && (best === null || t < best)) best = t;
  }
  return best;
}

/**
 * @param {THREE.Scene} scene
 */
export function clearBowBolts(scene) {
  for (const b of bowBolts) {
    scene.remove(b.group);
    disposeObject3D(b.group);
  }
  bowBolts = [];
}

/**
 * @param {EnemyInst} best
 * @param {number} dmg
 * @param {number} knockDirX horizontal push on pig (normalized or zero)
 * @param {number} knockDirZ
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {false | "blue" | "green" | "yellow" | "purple"} [landHitFlash] player-sourced hit → screen flash
 * @param {number} [knockImpulse] default `MELEE_KNOCKBACK_IMPULSE`
 * @param {number | null} [knockMaxSpeed] cap on `hypot(knockVx,knockVz)` after impulse; `null` = `ENEMY_KNOCKBACK_MAX_SPEED`
 * @param {boolean} [applyOutgoingDamageMult] multiply by `game.playerOutgoingDamageMult` (false for ally assists)
 */
function damageHostileFromPlayer(
  best,
  dmg,
  knockDirX,
  knockDirZ,
  scene,
  loader,
  landHitFlash = false,
  knockImpulse = MELEE_KNOCKBACK_IMPULSE,
  knockMaxSpeed = null,
  applyOutgoingDamageMult = true,
) {
  const mult =
    applyOutgoingDamageMult &&
    game.playerOutgoingDamageMult > 0 &&
    Number.isFinite(game.playerOutgoingDamageMult)
      ? game.playerOutgoingDamageMult
      : 1;
  const appliedDmg =
    mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));

  if (landHitFlash && appliedDmg > 0) {
    triggerPlayerLandHitFlash(landHitFlash);
  }

  const kd = Math.hypot(knockDirX, knockDirZ);
  if (kd > 1e-4) {
    const inv = 1 / kd;
    const nx = knockDirX * inv;
    const nz = knockDirZ * inv;
    best.knockVx += nx * knockImpulse;
    best.knockVz += nz * knockImpulse;
    const kn = Math.hypot(best.knockVx, best.knockVz);
    const cap = knockMaxSpeed != null ? knockMaxSpeed : ENEMY_KNOCKBACK_MAX_SPEED;
    if (kn > cap) {
      const s = cap / kn;
      best.knockVx *= s;
      best.knockVz *= s;
    }
  }

  best.health -= appliedDmg;
  if (best.health > 0) return;

  if (!best.dying) {
    playPigDeathSfx();
    best.dying = true;
    best.deathFadeOpacity = 1;
    game.enemyKills += 1;
    syncKillCounterDisplay();
    syncHostileRemaining();
    if (best.isFbBoss) {
      spawnHomohandsDevUnlockPickup(loader, scene, best.group.position);
      applyFinalBossStatDrop();
    } else {
      trySpawnCarrotPickup(loader, scene, best.group.position);
      trySpawnBowPickup(loader, scene, best.group.position);
      trySpawnDeaglePickup(loader, scene, best.group.position);
    }
    trySpawnExtraAirJumpPickup(loader, scene, best.group.position);
    trySpawnHpBoostPickup(loader, scene, best.group.position);
    if (!best.isFbBoss) trySpawnFoodPickup(loader, scene, best.group.position);
    trySpawnPotionPickup(loader, scene, best.group.position);
  }

  if (best.death) {
    best.walk?.fadeOut(0.1);
    best.idle?.fadeOut(0.1);
    best.death.enabled = true;
    best.death.reset().setEffectiveWeight(1).fadeIn(0.12).play();
  } else {
    best.walk?.stop();
    best.idle?.stop();
  }
}

/**
 * Potion / environmental pulse — damage living hostiles in XZ radius (knock from player).
 * @param {THREE.Group} player
 * @param {number} radius
 * @param {number} damage
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function damageHostilesInRadius(
  player,
  radius,
  damage,
  scene,
  loader,
) {
  const px = player.position.x;
  const pz = player.position.z;
  for (const e of enemies) {
    if (!isLivingHostile(e)) continue;
    const dx = e.group.position.x - px;
    const dz = e.group.position.z - pz;
    const maxD = radius + enemyHitRadius(e);
    if (dx * dx + dz * dz > maxD * maxD) continue;
    damageHostileFromPlayer(e, damage, dx, dz, scene, loader, "blue");
  }
}

/**
 * Living hostiles whose XZ footprint overlaps the planar ring [innerR, outerR] from the player.
 * Each enemy is damaged at most once per cast (track with `hitOnce`).
 * @param {THREE.Group} player
 * @param {number} innerR
 * @param {number} outerR
 * @param {number} damage
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {Set<object>} hitOnce enemy instances already damaged this cast
 */
export function damageHostilesInPlanarRing(
  player,
  innerR,
  outerR,
  damage,
  scene,
  loader,
  hitOnce,
) {
  const px = player.position.x;
  const pz = player.position.z;
  for (const e of enemies) {
    if (!isLivingHostile(e)) continue;
    if (hitOnce.has(e)) continue;
    const dx = e.group.position.x - px;
    const dz = e.group.position.z - pz;
    const d = Math.hypot(dx, dz);
    const r = enemyHitRadius(e);
    const minPig = Math.max(0, d - r);
    const maxPig = d + r;
    if (minPig > outerR || maxPig < innerR) continue;
    damageHostileFromPlayer(
      e,
      damage,
      dx,
      dz,
      scene,
      loader,
      "blue",
      SHOCKWAVE_KNOCKBACK_IMPULSE,
      SHOCKWAVE_KNOCKBACK_MAX_SPEED,
    );
    hitOnce.add(e);
  }
}

/**
 * @param {number} dt
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function updateBowBolts(dt, scene, loader) {
  if (bowBolts.length === 0) return;
  const proxy = game.collisionProxy;
  const eps = 0.02;

  for (let i = bowBolts.length - 1; i >= 0; i--) {
    const p = bowBolts[i];
    const step = p.speed * dt;
    const x0 = p.group.position.x;
    const z0 = p.group.position.z;
    const y = p.group.position.y;
    const x1 = x0 + p.vx * step;
    const z1 = z0 + p.vz * step;

    let wallD = step + 1;
    if (proxy) {
      bowRayOrigin.set(x0, y, z0);
      bowRayDir.set(p.vx, 0, p.vz);
      if (bowRayDir.lengthSq() > 1e-8) bowRayDir.normalize();
      bowRaycaster.set(bowRayOrigin, bowRayDir);
      bowRaycaster.far = step;
      const wh = bowRaycaster.intersectObject(proxy, false);
      if (wh.length) wallD = wh[0].distance;
    }

    /** @type {EnemyInst | null} */
    let hitPig = null;
    let pigT = Infinity;
    for (const e of enemies) {
      if (!isLivingHostile(e)) continue;
      const hitR = enemyHitRadius(e) + 0.1;
      const tSeg = segmentCircleHitXZ(
        x0,
        z0,
        x1,
        z1,
        e.group.position.x,
        e.group.position.z,
        hitR,
      );
      if (tSeg == null) continue;
      if (tSeg < pigT) {
        pigT = tSeg;
        hitPig = e;
      }
    }
    const pigD = pigT <= 1 ? pigT * step : Infinity;

    const disposeBolt = () => {
      scene.remove(p.group);
      disposeObject3D(p.group);
      bowBolts.splice(i, 1);
    };

    if (hitPig && pigD <= wallD + eps && pigD <= step + eps) {
      const u = step > 1e-8 ? pigD / step : 0;
      p.group.position.x = x0 + (x1 - x0) * u;
      p.group.position.z = z0 + (z1 - z0) * u;
      damageHostileFromPlayer(hitPig, p.damage, p.vx, p.vz, scene, loader, "blue");
      disposeBolt();
      continue;
    }

    if (wallD <= step + eps) {
      const u = step > 1e-8 ? wallD / step : 0;
      p.group.position.x = x0 + (x1 - x0) * u;
      p.group.position.z = z0 + (z1 - z0) * u;
      disposeBolt();
      continue;
    }

    p.group.position.x = x1;
    p.group.position.z = z1;
    p.dist += step;
    if (p.dist >= p.maxRange) disposeBolt();
  }
}

/**
 * @param {THREE.Group} player
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function applyRangedCarrotShot(player, scene, loader) {
  const t = performance.now() / 1000;
  if (t < game.playerBowReadyAt) return;
  const w = getHotbarSelectedWeaponId();
  const deagle = w === "deagle" && game.hasDeagleWeapon;
  const speed = deagle ? DEAGLE_PROJECTILE_SPEED : BOW_PROJECTILE_SPEED;
  const cdBase = deagle ? DEAGLE_COOLDOWN_SEC : BOW_COOLDOWN_SEC;
  const cd = cdBase * getSwiftBowCooldownMult(t);
  const dmgBase = deagle
    ? getDeagleDamageForLevel(game.levelIndex)
    : getBowDamageForLevel(game.levelIndex);
  const dmg = Math.max(
    1,
    Math.round(dmgBase * getBloodlustDamageMult(t)),
  );
  const scale = deagle ? DEAGLE_PROJECTILE_SCALE : BOW_PROJECTILE_SCALE;
  const maxRange = deagle
    ? DEAGLE_PROJECTILE_MAX_RANGE
    : BOW_PROJECTILE_MAX_RANGE;
  game.playerBowReadyAt = t + cd;

  tmpFwd.set(Math.sin(camOrbit.yaw), 0, Math.cos(camOrbit.yaw)).normalize();
  const vx = tmpFwd.x;
  const vz = tmpFwd.z;
  const px = player.position.x + vx * BOW_SPAWN_FORWARD;
  const pz = player.position.z + vz * BOW_SPAWN_FORWARD;
  const py = player.position.y + BOW_PROJECTILE_FEET_Y;

  ensureBowBoltGltf(loader)
    .then((gltf) => {
      const model = gltf.scene.clone(true);
      upgradeGltfScene(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const root = new THREE.Group();
      root.add(model);
      root.scale.setScalar(scale);
      root.position.set(px, py, pz);
      root.rotation.y = Math.atan2(vx, vz);
      scene.add(root);
      bowBolts.push({
        group: root,
        vx,
        vz,
        dist: 0,
        speed,
        damage: dmg,
        maxRange,
      });
    })
    .catch((err) => console.warn("Ranged carrot bolt load failed:", err));
}

/**
 * @param {EnemyInst} e
 * @param {boolean} on
 * @param {number} pulseT world time (s) for emissive pulse when on
 */
function setNegotiationGlow(e, on, pulseT = 0) {
  e.negotiationGlowActive = on;
  e.model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !("emissive" in m) || !m.emissive) continue;
      if (!m.userData._pigGlowSaved) {
        m.userData._pigGlowSaved = true;
        m.userData._pigOrigEmissive = m.emissive.clone();
        m.userData._pigOrigEmissiveIntensity =
          "emissiveIntensity" in m && typeof m.emissiveIntensity === "number"
            ? m.emissiveIntensity
            : 1;
      }
      if (on) {
        m.emissive.setHex(0xff1a3d);
        if ("emissiveIntensity" in m) {
          const base = 1.05;
          const amp = 0.62;
          m.emissiveIntensity =
            base + amp * (0.5 + 0.5 * Math.sin(pulseT * 6.0));
        }
      } else {
        m.emissive.copy(m.userData._pigOrigEmissive);
        if ("emissiveIntensity" in m)
          m.emissiveIntensity = m.userData._pigOrigEmissiveIntensity;
      }
    }
  });
}

/**
 * Hostile in negotiate range with clear LOS (any direction — not view-cone limited).
 * @param {THREE.Group} player
 * @param {EnemyInst} e
 */
function isNegotiationEligible(player, e) {
  if (!isLivingHostile(e)) return false;
  const meshes = game.levelCollisionMeshes;
  tmpEye.set(
    player.position.x,
    player.position.y + NEGOTIATE_EYE_HEIGHT,
    player.position.z,
  );
  const ex = e.group.position.x;
  const ez = e.group.position.z;
  const ey = e.group.position.y + pigNegotiateAimY(e);
  const dist = Math.hypot(
    ex - player.position.x,
    ez - player.position.z,
  );
  if (dist > NEGOTIATE_RANGE || dist < 1e-4) return false;
  return hasLineOfSight(
    tmpEye.x,
    tmpEye.y,
    tmpEye.z,
    ex,
    ey,
    ez,
    meshes,
    NEGOTIATE_LOS_SKIN,
  );
}

/**
 * Closest eligible hostile — primary speaker for F / negotiation dialogue.
 * @param {THREE.Group} player
 * @returns {EnemyInst | null}
 */
function pickNegotiationSpeakerPig(player) {
  /** @type {EnemyInst | null} */
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (!isNegotiationEligible(player, e)) continue;
    const d = Math.hypot(
      e.group.position.x - player.position.x,
      e.group.position.z - player.position.z,
    );
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * @param {THREE.Group | null} player
 */
function syncNegotiationGlow(player) {
  const hasHostile = enemies.some(isLivingHostile);
  const h =
    player && hasHostile ? pickNegotiationSpeakerPig(player) : null;
  game.negotiationHighlight = h;

  for (const e of enemies) {
    if (e.negotiationGlowActive) setNegotiationGlow(e, false, 0);
  }
}

/**
 * Hostile pig can deal contact damage only if the player is looking at it with clear LOS.
 * @param {THREE.Group} player
 * @param {EnemyInst} e
 */
function playerSeesPig(player, e) {
  if (!isLivingHostile(e)) return false;
  const meshes = game.levelCollisionMeshes;
  tmpFwd.set(Math.sin(camOrbit.yaw), 0, Math.cos(camOrbit.yaw)).normalize();
  tmpEye.set(
    player.position.x,
    player.position.y + NEGOTIATE_EYE_HEIGHT,
    player.position.z,
  );
  const ex = e.group.position.x;
  const ez = e.group.position.z;
  const ey = e.group.position.y + pigNegotiateAimY(e);
  tmpTo.set(ex - player.position.x, 0, ez - player.position.z);
  const dist = tmpTo.length();
  if (dist < 1e-4) return true;
  tmpTo.multiplyScalar(1 / dist);
  if (tmpFwd.dot(tmpTo) < NEGOTIATE_MIN_DOT) return false;
  return hasLineOfSight(
    tmpEye.x,
    tmpEye.y,
    tmpEye.z,
    ex,
    ey,
    ez,
    meshes,
    NEGOTIATE_LOS_SKIN,
  );
}

/**
 * @param {import("three").GLTF} gltf
 * @param {THREE.Object3D} modelRoot
 */
function setupEnemyAnimations(gltf, modelRoot) {
  const clips = gltf.animations;
  if (!clips?.length) {
    return {
      mixer: null,
      walk: null,
      idle: null,
      death: null,
      walkWeight: 0,
    };
  }

  const mixer = new THREE.AnimationMixer(modelRoot);
  const L = (s) => s.toLowerCase();

  let walkClip = clips.find((c) =>
    /walk|run|trot|gallop|locomot|move/.test(L(c.name)),
  );
  let idleClip = clips.find((c) =>
    /\bidle\b|stand|rest|breathe|default|neutral/.test(L(c.name)),
  );
  const deathClip = clips.find((c) =>
    /die|death|dead|ko|defeat|fall|rag|crumple|collapse|downed|knockdown/.test(
      L(c.name),
    ),
  );

  if (!walkClip) {
    walkClip =
      clips.find((c) => c !== idleClip && c !== deathClip) ?? clips[0];
  }
  if (!idleClip) {
    idleClip =
      clips.find((c) => c !== walkClip && c !== deathClip) ?? null;
  }

  const walk = mixer.clipAction(walkClip);
  walk.setLoop(THREE.LoopRepeat, Infinity);
  walk.play();

  let idle = null;
  if (idleClip && idleClip !== walkClip) {
    idle = mixer.clipAction(idleClip);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.play();
    walk.setEffectiveWeight(0);
    idle.setEffectiveWeight(1);
  } else {
    walk.paused = true;
  }

  let death = null;
  if (deathClip) {
    death = mixer.clipAction(deathClip);
    death.setLoop(THREE.LoopOnce, 1);
    death.clampWhenFinished = true;
    death.enabled = false;
  }

  return {
    mixer,
    walk,
    idle,
    death,
    walkWeight: idle ? 0 : 0,
  };
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {string} url
 */
function loadEnemyGltf(loader, url) {
  const hit = enemyGltfByUrl.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  }).then((gltf) => {
    enemyGltfByUrl.set(url, gltf);
    return gltf;
  });
}

function loadPigGltf(loader) {
  return loadEnemyGltf(loader, ENEMY_URL);
}

/**
 * Scatter hostile pigs from an already-loaded GLTF (arena layout: ring clear of center).
 * @param {THREE.Scene} scene
 * @param {import("three").GLTF} gltf
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[] | undefined} collisionMeshes
 * @param {number} count
 * @param {number} [hostileMaxHealth]
 * @param {number} [visualScale]
 * @param {string} [pigGltfUrl] must match the URL used to load `gltf` (stored on each enemy for carry-over).
 * @param {number} [modelYawExtra]
 */
function spawnHostilePigsSpread(
  scene,
  gltf,
  pigGltfUrl,
  box,
  floorY,
  collisionMeshes,
  count,
  hostileMaxHealth = ENEMY_MAX_HEALTH,
  visualScale = 1,
  modelYawExtra = 0,
) {
  const margin = LEVEL_INNER_MARGIN + ENEMY_COLLIDER_RADIUS + 0.35;
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const clearR = ENEMY_SPAWN_CLEAR_RADIUS;
  const n = Math.min(count, 32);

  for (let i = 0; i < n; i++) {
    let x = cx;
    let z = cz;
    let placed = false;
    for (let attempt = 0; attempt < 48; attempt++) {
      const tx = THREE.MathUtils.lerp(
        box.min.x + margin,
        box.max.x - margin,
        Math.random(),
      );
      const tz = THREE.MathUtils.lerp(
        box.min.z + margin,
        box.max.z - margin,
        Math.random(),
      );
      if (Math.hypot(tx - cx, tz - cz) >= clearR) {
        x = tx;
        z = tz;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const half = Math.min(
        (box.max.x - box.min.x) * 0.5 - margin,
        (box.max.z - box.min.z) * 0.5 - margin,
      );
      const r = Math.min(
        Math.max(clearR + 0.35, clearR),
        Math.max(clearR, half - 0.2),
      );
      const ang = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.4;
      x = THREE.MathUtils.clamp(
        cx + Math.cos(ang) * r,
        box.min.x + margin,
        box.max.x - margin,
      );
      z = THREE.MathUtils.clamp(
        cz + Math.sin(ang) * r,
        box.min.z + margin,
        box.max.z - margin,
      );
    }
    pushPig(
      scene,
      gltf,
      box,
      floorY,
      collisionMeshes,
      x,
      z,
      false,
      hostileMaxHealth,
      visualScale,
      false,
      pigGltfUrl,
      modelYawExtra,
    );
  }
}

/**
 * @param {THREE.Object3D} group
 */
function enemyFootRadius(group) {
  const box = new THREE.Box3().setFromObject(group);
  const sx = box.max.x - box.min.x;
  const sz = box.max.z - box.min.z;
  const r = 0.5 * Math.max(sx, sz);
  const s = group.scale.x > 0 ? group.scale.x : 1;
  return Math.max(ENEMY_COLLIDER_RADIUS * s, r * 0.55);
}

/** XZ disc for weapons / contact / AoE (FB boss applies reach + optional hitbox mult). */
function enemyHitRadius(e) {
  let r = e.radius;
  if (e.isFbBoss) {
    r *= FB_BOSS_COMBAT_REACH_MULT;
    if (FB_BOSS_HITBOX_RADIUS_MULT !== 1) {
      r *= FB_BOSS_HITBOX_RADIUS_MULT;
    }
  }
  return r;
}

/** Contact damage only — FB boss capped so huge GLB bbox doesn’t create a city-sized hurt ring. */
function enemyContactHitRadius(e) {
  const r = enemyHitRadius(e);
  if (e.isFbBoss) {
    return Math.min(r, FB_BOSS_CONTACT_RADIUS_CAP);
  }
  return r;
}

/** LOS / negotiate aim height scales with pig model scale (Crystal = smaller). */
function pigNegotiateAimY(e) {
  const s = e.group.scale.x > 0 ? e.group.scale.x : 1;
  return NEGOTIATE_PIG_AIM_Y * s;
}

/**
 * @param {THREE.Scene} scene
 */
/** Delay arena→Crystal until fades finish so the last kill is visible. */
export function hasHostilesDying() {
  return enemies.some((e) => !e.ally && e.dying);
}

export function clearEnemies(scene) {
  for (const e of enemies) {
    setNegotiationGlow(e, false);
    scene.remove(e.group);
    e.mixer?.stopAllAction();
  }
  enemies = [];
  game.negotiationHighlight = null;
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[] | undefined} collisionMeshes
 */
export async function createEnemies(
  loader,
  scene,
  box,
  floorY,
  collisionMeshes,
) {
  clearEnemies(scene);
  game.alliedPigCount = 0;
  game.alliedPigCarryover = [];
  game.enemyKills = 0;
  syncKillCounterDisplay();
  const gltf = await loadPigGltf(loader);
  spawnHostilePigsSpread(
    scene,
    gltf,
    ENEMY_URL,
    box,
    floorY,
    collisionMeshes,
    ENEMY_COUNT,
  );

  assignRandomFriendGroups();
  syncHostileRemaining();
  game.waveSpawned = enemies.length > 0;
}

/**
 * Crystal level hostile wave (`Pig (2).glb`). Call after `clearEnemies`; does not reset allied count.
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[] | undefined} collisionMeshes
 */
export async function createCrystalHostileWave(
  loader,
  scene,
  box,
  floorY,
  collisionMeshes,
) {
  const gltf = await loadEnemyGltf(loader, ENEMY_CRYSTAL_URL);
  game.enemyKills = 0;
  syncKillCounterDisplay();
  spawnHostilePigsSpread(
    scene,
    gltf,
    ENEMY_CRYSTAL_URL,
    box,
    floorY,
    collisionMeshes,
    CRYSTAL_ENEMY_COUNT,
    CRYSTAL_ENEMY_MAX_HEALTH,
    CRYSTAL_ENEMY_MODEL_SCALE,
  );
  assignRandomFriendGroups();
  syncHostileRemaining();
  game.waveSpawned = enemies.length > 0;
}

/**
 * Standard full-scale dungeon wave (`config.DUNGEON_STAGES`); does not reset allied count.
 * @param {import("./config.js").DungeonStage} stage
 */
export async function createDungeonHostileWave(
  loader,
  scene,
  box,
  floorY,
  collisionMeshes,
  stage,
) {
  const gltf = await loadEnemyGltf(loader, stage.enemyUrl);
  game.enemyKills = 0;
  syncKillCounterDisplay();
  spawnHostilePigsSpread(
    scene,
    gltf,
    stage.enemyUrl,
    box,
    floorY,
    collisionMeshes,
    stage.enemyCount,
    stage.enemyMaxHealth,
    1,
    stage.enemyModelYawExtra ?? 0,
  );
  assignRandomFriendGroups();
  syncHostileRemaining();
  game.waveSpawned = enemies.length > 0;
}

/**
 * Final boss FB on `FBfight.glb` — one high-HP pig; drops Homohands + HP / jumps / 10× damage / shockwave CD off.
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[] | undefined} collisionMeshes
 */
export async function createFbBossWave(
  loader,
  scene,
  box,
  floorY,
  collisionMeshes,
) {
  clearEnemies(scene);
  game.alliedPigCount = 0;
  game.alliedPigCarryover = [];
  const gltf = await loadEnemyGltf(loader, FB_BOSS_URL);
  game.enemyKills = 0;
  syncKillCounterDisplay();
  const margin =
    LEVEL_INNER_MARGIN + ENEMY_COLLIDER_RADIUS * FB_BOSS_MODEL_SCALE + 0.35;
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const spanX = box.max.x - box.min.x;
  const x = THREE.MathUtils.clamp(
    cx + spanX * 0.2,
    box.min.x + margin,
    box.max.x - margin,
  );
  const z = THREE.MathUtils.clamp(
    cz,
    box.min.z + margin,
    box.max.z - margin,
  );
  pushPig(
    scene,
    gltf,
    box,
    floorY,
    collisionMeshes,
    x,
    z,
    false,
    FB_BOSS_MAX_HEALTH,
    FB_BOSS_MODEL_SCALE,
    true,
    FB_BOSS_URL,
    0,
  );
  assignRandomFriendGroups();
  syncHostileRemaining();
  game.waveSpawned = enemies.length > 0;
}

/**
 * Respawn allied pigs after a level transition (e.g. Crystal).
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {THREE.Box3} box
 * @param {number} floorY
 * @param {THREE.Mesh[]} collisionMeshes
 * @param {THREE.Group} player
 */
export async function spawnAlliedPigsNearPlayer(
  loader,
  scene,
  box,
  floorY,
  collisionMeshes,
  player,
) {
  const n = game.alliedPigCount;
  if (n <= 0) return;

  const margin = LEVEL_INNER_MARGIN + ENEMY_COLLIDER_RADIUS + 0.35;
  const cx = player.position.x;
  const cz = player.position.z;

  for (let i = 0; i < n; i++) {
    const spec = game.alliedPigCarryover[i];
    const url = spec?.url ?? ENEMY_URL;
    const visualScale = spec?.visualScale ?? 1;
    const modelYawExtra = spec?.modelYawExtra ?? 0;
    const gltf = await loadEnemyGltf(loader, url);
    const ang = (i / Math.max(1, n)) * Math.PI * 2;
    let x = cx + Math.cos(ang) * ALLY_SPAWN_RING;
    let z = cz + Math.sin(ang) * ALLY_SPAWN_RING;
    x = THREE.MathUtils.clamp(x, box.min.x + margin, box.max.x - margin);
    z = THREE.MathUtils.clamp(z, box.min.z + margin, box.max.z - margin);
    pushPig(
      scene,
      gltf,
      box,
      floorY,
      collisionMeshes,
      x,
      z,
      true,
      ENEMY_MAX_HEALTH,
      visualScale,
      false,
      url,
      modelYawExtra,
    );
  }

  syncHostileRemaining();
}

/**
 * Call before `mountLevel` / `clearEnemies` so allied pigs respawn with the same GLB + scale
 * as on the level where they were recruited.
 */
export function snapshotAlliesForCarryOver() {
  const allies = enemies.filter((e) => e.ally && !e.dying && e.health > 0);
  game.alliedPigCount = allies.length;
  game.alliedPigCarryover = allies.map((e) => ({
    url: e.pigGltfUrl,
    visualScale: e.group.scale.x > 0 ? e.group.scale.x : 1,
    modelYawExtra: e.modelYawExtra ?? 0,
  }));
}

/**
 * @param {THREE.Group} player
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
function applyMelee(player, scene, loader) {
  const t = performance.now() / 1000;
  if (t < game.playerMeleeReadyAt) return;
  game.playerMeleeReadyAt = t + PLAYER_MELEE_COOLDOWN;

  tmpFwd.set(Math.sin(camOrbit.yaw), 0, Math.cos(camOrbit.yaw)).normalize();

  const reachMult = getGildedMeleeRangeMult(t);
  const meleeReach = PLAYER_MELEE_RANGE * reachMult;

  /** @type {EnemyInst | null} */
  let best = null;
  let bestD = meleeReach + 1;

  for (const e of enemies) {
    if (!isLivingHostile(e)) continue;
    tmpTo.set(
      e.group.position.x - player.position.x,
      0,
      e.group.position.z - player.position.z,
    );
    const dist = tmpTo.length();
    const reach = meleeReach + enemyHitRadius(e);
    if (dist > reach || dist < 1e-4) continue;
    tmpTo.multiplyScalar(1 / dist);
    if (tmpFwd.dot(tmpTo) < PLAYER_MELEE_MIN_DOT) continue;
    if (dist < bestD) {
      bestD = dist;
      best = e;
    }
  }

  if (!best) return;

  tmpTo.set(
    best.group.position.x - player.position.x,
    0,
    best.group.position.z - player.position.z,
  );
  const kd = tmpTo.length();
  if (kd > 1e-4) tmpTo.multiplyScalar(1 / kd);
  else tmpTo.set(0, 0, 1);

  const carrotDmg = getCarrotMeleeDamageForLevel(game.levelIndex);
  const powDmg = getPowerfulMeleeDamageForLevel(game.levelIndex);
  const sel = getHotbarSelectedWeaponId();
  const dmg =
    sel === "power" && game.hasPowerfulMeleeWeapon
      ? powDmg
      : sel === "carrot" && game.hasCarrotWeapon
        ? carrotDmg
        : PLAYER_MELEE_DAMAGE;
  const airMult = move.onGround
    ? 1
    : move.sprintJumpCarry && move.jumpsSinceLand >= 3
      ? MELEE_SPRINT_TRIPLE_JUMP_HIT_DAMAGE_MULT
      : move.sprintJumpCarry
        ? MELEE_SPRINT_JUMP_HIT_DAMAGE_MULT
        : MELEE_AIR_HIT_DAMAGE_MULT;
  const lustMult = getBloodlustDamageMult(t);
  const finalDmg = Math.max(1, Math.round(dmg * airMult * lustMult));
  /** @type {"blue" | "green" | "yellow" | "purple"} */
  let hitFlash =
    airMult === MELEE_AIR_HIT_DAMAGE_MULT
      ? "green"
      : airMult === MELEE_SPRINT_JUMP_HIT_DAMAGE_MULT
        ? "yellow"
        : airMult === MELEE_SPRINT_TRIPLE_JUMP_HIT_DAMAGE_MULT
          ? "purple"
          : "blue";
  damageHostileFromPlayer(best, finalDmg, tmpTo.x, tmpTo.z, scene, loader, hitFlash);
}

/**
 * @param {EnemyInst} e
 * @param {THREE.Scene} scene
 */
function removeEnemyInstance(e, scene) {
  const ix = enemies.indexOf(e);
  if (ix >= 0) enemies.splice(ix, 1);
  scene.remove(e.group);
  e.mixer?.stopAllAction();
}

function ensureEnemyFadeMaterials(e) {
  if (e.fadeMaterials) return;
  /** @type {import("three").Material[]} */
  const list = [];
  e.model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) list.push(m);
  });
  e.fadeMaterials = list;
}

/**
 * @param {EnemyInst} e
 * @param {number} opacity
 */
function setEnemyModelOpacity(e, opacity) {
  ensureEnemyFadeMaterials(e);
  const a = Math.max(0, Math.min(1, opacity));
  const mats = e.fadeMaterials;
  if (!mats) return;
  for (const m of mats) {
    const wasT = m.transparent;
    m.transparent = a < 1;
    m.opacity = a;
    m.depthWrite = a >= 1;
    if (m.transparent !== wasT) m.needsUpdate = true;
  }
}

/**
 * @param {number} dt
 */
function updateEnemyAnimations(dt, scene) {
  /** @type {EnemyInst[]} */
  const toRemove = [];

  for (const e of enemies) {
    if (e.dying) {
      const ekd = Math.exp(-ENEMY_KNOCKBACK_DECAY * dt);
      e.knockVx *= ekd;
      e.knockVz *= ekd;
      e.group.position.x += e.knockVx * dt;
      e.group.position.z += e.knockVz * dt;

      e.deathFadeOpacity -= ENEMY_DEATH_FADE_PER_SEC * dt;
      setEnemyModelOpacity(e, e.deathFadeOpacity);

      if (e.mixer) {
        if (e.death?.enabled) {
          e.mixer.update(dt);
          const clip = e.death.getClip();
          if (e.death.time >= clip.duration - 0.04) {
            e.death.paused = true;
          }
        } else {
          e.mixer.update(dt);
        }
      }

      if (e.deathFadeOpacity <= 0) toRemove.push(e);
      continue;
    }

    if (!e.mixer) continue;

    const moving = e.group.userData._speed > 0.06;
    if (e.idle && e.walk) {
      const target = moving ? 1 : 0;
      e.walkWeight = THREE.MathUtils.lerp(
        e.walkWeight,
        target,
        1 - Math.exp(-12 * dt),
      );
      e.walk.setEffectiveWeight(e.walkWeight);
      e.idle.setEffectiveWeight(1 - e.walkWeight);
      e.walk.paused = false;
    } else if (e.walk) {
      e.walk.paused = !moving;
    }
    e.mixer.update(dt);
  }

  for (const e of toRemove) removeEnemyInstance(e, scene);
}

/**
 * @param {number} dt
 * @param {THREE.Group} player
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
/** Call each frame (e.g. before `syncParleyPrompt`) so HUD stays correct while paused. */
export function syncGameHostilePresence() {
  game.hasLivingHostiles = enemies.some(isLivingHostile);
}

export function updateEnemies(dt, player, scene, loader) {
  if (game.playerDead) {
    clearBowBolts(scene);
    syncNegotiationGlow(null);
  } else {
    syncNegotiationGlow(player);
  }

  if (game.requestMelee) {
    game.requestMelee = false;
    if (!game.playerDead) {
      const w = getHotbarSelectedWeaponId();
      const useRanged =
        (w === "deagle" && game.hasDeagleWeapon) ||
        (w === "bow" && game.hasBowWeapon);
      if (useRanged) applyRangedCarrotShot(player, scene, loader);
      else applyMelee(player, scene, loader);
    }
  }

  if (!game.playerDead) updateBowBolts(dt, scene, loader);

  if (game.requestNegotiate) {
    game.requestNegotiate = false;
    if (!game.playerDead) {
      if (enemies.length === 0) {
        showNegotiationToast("No pigs here to parley with.", "info");
      } else if (!enemies.some(isLivingHostile)) {
        showNegotiationToast("No hostile pigs left to parley with.", "info");
      } else {
        void runNegotiation(scene, player);
      }
    }
  }

  if (game.playerDead) {
    updateEnemyAnimations(dt, scene);
    return;
  }

  const lb = game.levelBounds;
  const meshes = game.levelCollisionMeshes;
  const deckFallback =
    game.arenaFloorY != null
      ? game.arenaFloorY
      : lb
        ? lb.min.y
        : 0;

  const px = player.position.x;
  const pz = player.position.z;
  const py = player.position.y;

  const hostiles = enemies.filter(isLivingHostile);
  computeSquadIds(hostiles);
  const activeSquadId = pickActiveSquadId(hostiles, px, pz);

  const allyTotal = enemies.filter((e) => e.ally && !e.dying).length;
  let allySlot = 0;

  const feetInterval = Math.max(1, ENEMY_SUPPORT_FEET_RAY_INTERVAL_FRAMES | 0);
  const phys = game.physicsTick;

  for (let ei = 0; ei < enemies.length; ei++) {
    const e = enemies[ei];
    if (e.dying) {
      e.group.userData._speed = 0;
      continue;
    }

    let tx = px;
    let tz = pz;

    if (e.ally && allyTotal > 0) {
      const ang =
        (allySlot / allyTotal) * Math.PI * 2 +
        performance.now() * 0.001 * ALLY_SLOT_DRIFT;
      allySlot += 1;
      tx = px + Math.cos(ang) * ALLY_FOLLOW_RADIUS;
      tz = pz + Math.sin(ang) * ALLY_FOLLOW_RADIUS;
    } else if (!e.ally) {
      const dPlayer = Math.hypot(
        e.group.position.x - px,
        e.group.position.z - pz,
      );
      if (e.squadId === activeSquadId) {
        tx = px;
        tz = pz;
      } else if (dPlayer >= INTER_SQUAD_PVP_MIN_PLAYER_DIST) {
        const foe = findNearestOtherSquadFoe(e, hostiles);
        if (foe) {
          tx = foe.group.position.x;
          tz = foe.group.position.z;
        } else {
          tx = e.group.position.x;
          tz = e.group.position.z;
        }
      } else {
        const c = squadCentroidXZ(e.squadId, hostiles);
        tx = c.x;
        tz = c.z;
      }
    }

    const dx = tx - e.group.position.x;
    const dz = tz - e.group.position.z;
    const flat = Math.hypot(dx, dz);
    let speed = 0;
    const moveSpeed = e.ally ? ENEMY_SPEED * 0.92 : ENEMY_SPEED;
    if (flat > 1e-4) {
      const step = moveSpeed * dt;
      const t = Math.min(1, step / flat);
      e.group.position.x += dx * t;
      e.group.position.z += dz * t;
      speed = moveSpeed;
      e.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }

    const ekd = Math.exp(-ENEMY_KNOCKBACK_DECAY * dt);
    e.knockVx *= ekd;
    e.knockVz *= ekd;
    e.group.position.x += e.knockVx * dt;
    e.group.position.z += e.knockVz * dt;

    e.group.userData._speed = speed;

    let deckY = deckFallback;
    if (meshes.length && lb) {
      const doFeetRays =
        feetInterval === 1 ||
        e._cachedFeetY == null ||
        (phys + ei) % feetInterval === 0;
      if (doFeetRays) {
        const s = getSupportFeetY(
          e.group.position.x,
          e.group.position.y,
          e.group.position.z,
          meshes,
          lb,
          e.radius,
        );
        if (s != null) {
          deckY = s;
          e._cachedFeetY = s;
        } else {
          e._cachedFeetY = deckFallback;
          deckY = deckFallback;
        }
      } else {
        deckY = e._cachedFeetY ?? deckFallback;
      }
    }
    e.group.position.y = deckY;

    if (lb) {
      const m = LEVEL_INNER_MARGIN + e.radius;
      e.group.position.x = THREE.MathUtils.clamp(
        e.group.position.x,
        lb.min.x + m,
        lb.max.x - m,
      );
      e.group.position.z = THREE.MathUtils.clamp(
        e.group.position.z,
        lb.min.z + m,
        lb.max.z - m,
      );
    }

    if (e.ally) continue;

    const hitR = enemyContactHitRadius(e) + PLAYER_HITBOX_RADIUS;
    const horiz = Math.hypot(e.group.position.x - px, e.group.position.z - pz);
    const vert = Math.abs(e.group.position.y - py);
    const tSec = performance.now() * 0.001;
    const spawnSafe =
      Number.isFinite(game.spawnProtectionUntil) &&
      tSec < game.spawnProtectionUntil;
    if (
      isLivingHostile(e) &&
      !spawnSafe &&
      !game.negotiating &&
      e.squadId === activeSquadId &&
      playerSeesPig(player, e) &&
      horiz < hitR &&
      vert < 1.25
    ) {
      const contactDmg = e.isFbBoss
        ? FB_BOSS_CONTACT_DAMAGE
        : getEnemyContactDamage(game.levelIndex);
      const knockMult = e.isFbBoss ? FB_BOSS_KNOCKBACK_MULT : 1;
      if (applyDamage(contactDmg, "enemy")) {
        knockPlayerFromPig(
          player,
          e.group.position.x,
          e.group.position.z,
          knockMult,
        );
      }
    }
  }

  tryAllyAutoRecruits();

  const tAssist = performance.now() * 0.001;
  const allyAssistBlocked =
    game.negotiating ||
    (Number.isFinite(game.spawnProtectionUntil) &&
      tAssist < game.spawnProtectionUntil);
  if (!allyAssistBlocked) {
    const allyDmg = getEnemyContactDamage(game.levelIndex);
    for (const a of enemies) {
      if (!a.ally || a.dying || a.health <= 0) continue;
      if (a.allyContactReadyAt > tAssist) continue;
      let struck = false;
      for (const h of hostiles) {
        if (!isLivingHostile(h)) continue;
        if (h.squadId !== activeSquadId) continue;
        if (!playerSeesPig(player, h)) continue;
        const hitR = enemyHitRadius(h) + a.radius;
        const horiz = Math.hypot(
          h.group.position.x - a.group.position.x,
          h.group.position.z - a.group.position.z,
        );
        const vert = Math.abs(h.group.position.y - a.group.position.y);
        if (horiz >= hitR || vert >= 1.25) continue;
        const kx = h.group.position.x - a.group.position.x;
        const kz = h.group.position.z - a.group.position.z;
        damageHostileFromPlayer(
          h,
          allyDmg,
          kx,
          kz,
          scene,
          loader,
          false,
          MELEE_KNOCKBACK_IMPULSE,
          null,
          false,
        );
        struck = true;
      }
      if (struck) a.allyContactReadyAt = tAssist + ENEMY_HIT_COOLDOWN;
    }
  }

  const tBrawl = performance.now() * 0.001;
  for (let i = 0; i < hostiles.length; i++) {
    for (let j = i + 1; j < hostiles.length; j++) {
      const a = hostiles[i];
      const b = hostiles[j];
      if (a.squadId === b.squadId) continue;
      const dPlayer = Math.min(
        Math.hypot(a.group.position.x - px, a.group.position.z - pz),
        Math.hypot(b.group.position.x - px, b.group.position.z - pz),
      );
      if (dPlayer < INTER_SQUAD_PVP_MIN_PLAYER_DIST) continue;
      const sep = Math.hypot(
        a.group.position.x - b.group.position.x,
        a.group.position.z - b.group.position.z,
      );
      const vSep = Math.abs(a.group.position.y - b.group.position.y);
      const hitRR = a.radius + b.radius;
      if (sep >= hitRR || vSep >= 1.25) continue;
      if (a.pigBrawlReadyAt > tBrawl || b.pigBrawlReadyAt > tBrawl) continue;
      a.health -= ENEMY_VS_ENEMY_DAMAGE;
      b.health -= ENEMY_VS_ENEMY_DAMAGE;
      const next = tBrawl + ENEMY_VS_ENEMY_COOLDOWN;
      a.pigBrawlReadyAt = next;
      b.pigBrawlReadyAt = next;
      if (a.health <= 0) beginHostileDeathNoLoot(a, scene, loader);
      if (b.health <= 0) beginHostileDeathNoLoot(b, scene, loader);
    }
  }

  allyPickupGatherers.length = 0;
  for (const e of enemies) {
    if (!e.ally || e.dying || e.health <= 0) continue;
    allyPickupGatherers.push({
      x: e.group.position.x,
      y: e.group.position.y,
      z: e.group.position.z,
    });
  }

  updateEnemyAnimations(dt, scene);
}
