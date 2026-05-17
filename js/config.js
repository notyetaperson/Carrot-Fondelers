/**
 * Dungeon stage row. Optional `enemyModelYawExtra`: radians added to pig mesh Y after ground align
 * (e.g. `Math.PI` if the GLB faces backward vs gameplay).
 * @typedef {{
 *   levelUrl: string,
 *   enemyUrl: string,
 *   enemyCount: number,
 *   enemyMaxHealth: number,
 *   displayName: string,
 *   enemyModelYawExtra?: number,
 * }} DungeonStage
 */

export const SKYBOX_URL = "Assets/Skybox.glb";

/** Bump `revision` after replacing the .glb so browsers fetch the new file. */
export const PLAYER_MODEL = {
  path: "Assets/Models/Avatar/avatar2.glb",
  revision: "1",
};
export const PLAYER_URL = `${PLAYER_MODEL.path}?v=${PLAYER_MODEL.revision}`;

/** `localStorage` skin id when unset — matches first entry in {@link PLAYER_SKIN_SPECS}. */
export const PLAYER_SKIN_DEFAULT_ID = "classic_avatar";

const PLAYER_SKIN_PACK_REVISION = "1";
const PLAYER_SKIN_BLOCKY_MINI_LETTERS = "abcdefghijklmnopqr";

/**
 * Pause menu skins: avatars live under `Assets/Models/Avatar/`; blocky/mini packs under `Players/`.
 * @type {{ id: string, label: string, path: string, revision: string }[]}
 */
export const PLAYER_SKIN_SPECS = (() => {
  /** @type {{ id: string, label: string, path: string, revision: string }[]} */
  const specs = [
    {
      id: "classic_avatar",
      label: "Classic",
      path: PLAYER_MODEL.path,
      revision: PLAYER_MODEL.revision,
    },
    {
      id: "players_default",
      label: "Players — Default",
      path: "Assets/Models/Avatar/Default.glb",
      revision: PLAYER_SKIN_PACK_REVISION,
    },
    {
      id: "players_avatar2",
      label: "Players — Avatar 2",
      path: "Assets/Models/Avatar/avatar2.glb",
      revision: PLAYER_SKIN_PACK_REVISION,
    },
  ];
  for (let i = 0; i < PLAYER_SKIN_BLOCKY_MINI_LETTERS.length; i++) {
    const ch = PLAYER_SKIN_BLOCKY_MINI_LETTERS[i];
    specs.push({
      id: `blocky_${ch}`,
      label: `Blocky — ${ch.toUpperCase()}`,
      path: `Assets/Models/Players/Blocky/character-${ch}.glb`,
      revision: PLAYER_SKIN_PACK_REVISION,
    });
  }
  for (let i = 0; i < PLAYER_SKIN_BLOCKY_MINI_LETTERS.length; i++) {
    const ch = PLAYER_SKIN_BLOCKY_MINI_LETTERS[i];
    specs.push({
      id: `mini_${ch}`,
      label: `Mini — ${ch.toUpperCase()}`,
      path: `Assets/Models/Players/Mini/character-${ch}.glb`,
      revision: PLAYER_SKIN_PACK_REVISION,
    });
  }
  return specs;
})();

/**
 * Arena → Crystal → every entry in `DUNGEON_STAGES` (actual `*_Dungeon.glb` in Assets) → loop to arena.
 * Bump `?v=` / `revision` when files change.
 */
export const LEVEL_ARENA_URL = "Assets/Models/Levels/Arena.glb?v=1";
export const LEVEL_CRYSTAL_URL = "Assets/Models/Levels/Crystal.glb?v=1";

/** Post-Crystal dungeons in play order. Each stage uses `Pig (3).glb` … `Pig (8).glb` respectively. */
/** @type {DungeonStage[]} */
export const DUNGEON_STAGES = [
  {
    levelUrl: "Assets/Models/Levels/Fire_Dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(3).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 18,
    displayName: "Fire Dungeon",
  },
  {
    levelUrl: "Assets/Models/Levels/Light_Dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(4).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 20,
    displayName: "Light Dungeon",
  },
  {
    levelUrl: "Assets/Models/Levels/Moon_dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(5).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 22,
    displayName: "Moon Dungeon",
  },
  {
    levelUrl: "Assets/Models/Levels/Poison_Dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(6).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 24,
    displayName: "Poison Dungeon",
  },
  {
    levelUrl: "Assets/Models/Levels/Rock_dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(7).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 26,
    displayName: "Rock Dungeon",
    enemyModelYawExtra: Math.PI,
  },
  {
    levelUrl: "Assets/Models/Levels/Water_Dungeon.glb?v=1",
    enemyUrl: "Assets/Models/Enemy/Pig%20(8).glb?v=1",
    enemyCount: 12,
    enemyMaxHealth: 28,
    displayName: "Water Dungeon",
  },
];

/** `game.levelIndex` for the first dungeon (after Arena=0 and Crystal=1). */
export const FIRST_DUNGEON_LEVEL_INDEX = 2;

/**
 * Moon dungeon — `game.levelIndex` 4 (Arena 0, Crystal 1, Fire 2, Light 3, Moon 4).
 * Uniform scale on the loaded GLB; `1` = default size.
 */
export const MOON_DUNGEON_LEVEL_INDEX = FIRST_DUNGEON_LEVEL_INDEX + 2;
export const MOON_DUNGEON_LEVEL_WORLD_SCALE = 3;

/** Inclusive last dungeon level index (Arena=0, Crystal=1, then `DUNGEON_STAGES.length` dungeons). */
export const LAST_DUNGEON_LEVEL_INDEX = 1 + DUNGEON_STAGES.length;
/** Final boss arena after all dungeons — then loops to Arena (0). */
export const LEVEL_FB_ARENA_URL = "Assets/Models/Levels/FBfight.glb?v=2";
/** Final boss for FB arena (`FBfight.glb`) — bump `revision` if you replace the .glb. */
export const FB_BOSS_MODEL = {
  path: "Assets/Models/Enemy/Final_boss.glb",
  revision: "1",
};
export const FB_BOSS_URL = `${FB_BOSS_MODEL.path}?v=${FB_BOSS_MODEL.revision}`;
/** Final boss on `FBfight.glb` — single spawn; drops Homohands. */
export const FB_BOSS_MAX_HEALTH = 250;
/** One-time player bonuses when FB dies (same moment as Homohands spawn). */
export const FB_BOSS_DROP_MAX_HEALTH_BONUS = 4400;
export const FB_BOSS_DROP_BONUS_MID_AIR_JUMPS = 77;
/** Multiplier on player-sourced damage to hostiles (melee, bolts, potion pulse, shockwave). */
export const FB_BOSS_DROP_OUTGOING_DAMAGE_MULT = 10;
export const FB_BOSS_CONTACT_DAMAGE = 20;
/** Multiplier on `PLAYER_HIT_KNOCKBACK_IMPULSE` / knock cap when the FB boss hits you. */
export const FB_BOSS_KNOCKBACK_MULT = 10;
/** Uniform scale for `Final_boss.glb` (visual + foot radius / contact sizing). */
export const FB_BOSS_MODEL_SCALE = 13;
/**
 * FB boss only: multiplies combat XZ radius (`e.radius`) for bolts, melee reach, contact vs player, potion AoE.
 * `1` = same as scaled model footprint (was `13` for a huge forgiving hit disc).
 */
export const FB_BOSS_HITBOX_RADIUS_MULT = 1;
/**
 * FB boss only: shrinks combat reach vs full footprint — bolts, your melee range to hit it, potion pulses (not contact; see `FB_BOSS_CONTACT_RADIUS_CAP`).
 * Does not change movement clamp / foot probe (`e.radius`).
 */
export const FB_BOSS_COMBAT_REACH_MULT = 0.35;
/**
 * FB boss **contact damage** only (m): max horizontal radius from the boss anchor so the hurt zone stays near the body, not the whole scaled bbox.
 * Melee/bolt targeting still uses `enemyHitRadius` (larger).
 */
export const FB_BOSS_CONTACT_RADIUS_CAP = 1.5;
/** Extra Y rotation on the boss mesh only (rad). `Math.PI` = 180° — parent group still handles movement facing. */
export const FB_BOSS_MODEL_YAW = Math.PI;
export const FB_ARENA_LEVEL_INDEX = LAST_DUNGEON_LEVEL_INDEX + 1;
/** Uniform scale for `FBfight.glb` in world space (original GLB stays unchanged). */
export const FB_ARENA_LEVEL_WORLD_SCALE = 300;
/**
 * Uniform scale for Crystal mesh in world space (original GLB stays unchanged).
 * Level index 1 — `8/1.5` makes the arena ~1.5× smaller in each axis than the previous `8` scale.
 */
export const CRYSTAL_LEVEL_WORLD_SCALE = 8 / 1.5;
/**
 * Crystal perf: when building the merged collision mesh, skip static meshes whose
 * world AABB max edge length is below this (filters tiny decorative geometry → faster raycasts).
 * If too many meshes are dropped, main.js falls back to an unfiltered collect.
 */
export const CRYSTAL_COLLISION_MESH_MIN_WORLD_EXTENT = 2.0;
/**
 * Dungeon GLBs (Fire, etc.): same idea as Crystal — skip tiny meshes in the merged collision proxy.
 * World units (not scaled like Crystal). Too few surfaces → main.js falls back to unfiltered collect.
 */
export const DUNGEON_COLLISION_MESH_MIN_WORLD_EXTENT = 1.0;
/**
 * Arena (level 0): skip tiny static meshes when building the merged collision proxy (smaller BVH).
 * If too few surfaces remain, main.js falls back to an unfiltered collect.
 */
export const ARENA_COLLISION_MESH_MIN_WORLD_EXTENT = 0.55;
/**
 * Each pig runs `getSupportFeetY` (5 downward rays vs the merged level mesh) when updating position.
 * `2` = half as many ray bundles per pig per second (noticeable +FPS with many hostiles).
 */
export const ENEMY_SUPPORT_FEET_RAY_INTERVAL_FRAMES = 2;
/**
 * Build a BVH on the merged static collision geometry so raycasts scale with log(n) instead of triangle count.
 */
export const LEVEL_COLLISION_BVH = true;
/** Crystal: tighter canvas DPR cap than `MAX_PIXEL_RATIO` (big level + fill rate). */
export const CRYSTAL_MAX_PIXEL_RATIO = 1;

/** Pig enemy model — arena (level 1). Spaces encoded for fetch. */
export const ENEMY_MODEL = {
  path: "Assets/Models/Enemy/Pig%20(1).glb",
  revision: "1",
};
export const ENEMY_URL = `${ENEMY_MODEL.path}?v=${ENEMY_MODEL.revision}`;

/** Hostile wave on Crystal (level 2) after clearing the arena. */
export const ENEMY_CRYSTAL_MODEL = {
  path: "Assets/Models/Enemy/Pig%20(2).glb",
  revision: "1",
};
export const ENEMY_CRYSTAL_URL = `${ENEMY_CRYSTAL_MODEL.path}?v=${ENEMY_CRYSTAL_MODEL.revision}`;
export const CRYSTAL_ENEMY_COUNT = 15;
/** Crystal hostiles (Pig 2 wave). */
export const CRYSTAL_ENEMY_MAX_HEALTH = 20;
/** Visual/collision scale for Crystal wave pigs vs arena (`1` = arena default; Crystal uses `2`). */
export const CRYSTAL_ENEMY_MODEL_SCALE = 2.0;
/** Crystal: smaller carrot pickups; weaker carrot hits. */
export const CRYSTAL_CARROT_PICKUP_SCALE = 0.55;
export const CRYSTAL_CARROT_MELEE_DAMAGE = 10;
/**
 * Level 1 (Crystal): spawn away from the AABB center — offset as a fraction of half-width (U) and
 * half-depth (V). Range about ±0.45 keeps you inside the inner clamp margin.
 */
export const CRYSTAL_SPAWN_FRAC_U = -0.36;
export const CRYSTAL_SPAWN_FRAC_V = 0.4;

/** Melee weapon pickup (20% drop from pigs). */
export const CARROT_MODEL = {
  path: "Assets/Models/Weapons/Carrot.glb",
  revision: "1",
};
export const CARROT_URL = `${CARROT_MODEL.path}?v=${CARROT_MODEL.revision}`;
export const CARROT_MODEL_HEIGHT = 0.38;
export const CARROT_DROP_CHANCE = 0.2;
export const CARROT_PICKUP_RADIUS = 1.05;

/**
 * When `game.levelIndex` is **greater** than this (non-dungeon high indices e.g. FB arena), carrot-class
 * pig drops use a random GLB from `POWERFUL_WEAPON_PICKUPS`. Dungeons `FIRST_DUNGEON_LEVEL_INDEX`…`LAST_DUNGEON_LEVEL_INDEX`
 * always use powerful-only weapon drops (see `pickups.js`).
 */
export const POWERFUL_DROP_MIN_LEVEL_INDEX = 4;

/**
 * @typedef {{ path: string, revision: string, label: string }} PowerfulWeaponPick
 * @type {PowerfulWeaponPick[]}
 */
export const POWERFUL_WEAPON_PICKUPS = [
  {
    path: "Assets/Models/Weapons/Powerful/brs_cannon.glb",
    revision: "1",
    label: "BRS Cannon",
  },
  {
    path: "Assets/Models/Weapons/Powerful/kama_dagger.glb",
    revision: "1",
    label: "Kama Dagger",
  },
  {
    path: "Assets/Models/Weapons/Powerful/megatron_sword.glb",
    revision: "1",
    label: "Megatron Sword",
  },
  {
    path: "Assets/Models/Weapons/Powerful/new_empire_blaster.glb",
    revision: "1",
    label: "New Empire Blaster",
  },
  {
    path: "Assets/Models/Weapons/Powerful/Orbital_strike.glb",
    revision: "1",
    label: "Orbital Strike",
  },
];

/** Dropped only by FB — equips powerful melee and unlocks the dev terminal (Y). */
export const HOMOHANDS_PICKUP = {
  path: "Assets/Models/Weapons/Powerful/OP/Homohands.glb",
  revision: "1",
  label: "Homohands",
};
export const HOMOHANDS_URL = `${HOMOHANDS_PICKUP.path}?v=${HOMOHANDS_PICKUP.revision}`;

export const POWERFUL_PICKUP_DISPLAY_HEIGHT = 0.52;
export const POWERFUL_PICKUP_RADIUS = 1.12;

/** Rare drop: ranged carrot bolts, straight line, 20 damage. */
export const BOW_DROP_CHANCE = 0.1;
export const BOW_PICKUP_RADIUS = 1.08;
export const BOW_PROJECTILE_SPEED = 40;
/** Max ground distance (XZ) a bolt travels before vanishing. */
export const BOW_PROJECTILE_MAX_RANGE = 95;
export const BOW_COOLDOWN_SEC = 0.38;
export const BOW_DAMAGE = 20;
/** Spawn bolt this far in front of the player on XZ. */
export const BOW_SPAWN_FORWARD = 0.72;
/** Bolt height above player root (feet). */
export const BOW_PROJECTILE_FEET_Y = 1.32;
export const BOW_PROJECTILE_SCALE = 0.084 / 20;

/** Rarer drop: same straight carrot bolt, but faster and 30 damage (“Desert Eagle”). */
export const DEAGLE_DROP_CHANCE = 0.05;
export const DEAGLE_PICKUP_RADIUS = 1.05;
export const DEAGLE_PROJECTILE_SPEED = 62;
export const DEAGLE_PROJECTILE_MAX_RANGE = 110;
export const DEAGLE_COOLDOWN_SEC = 0.3;
export const DEAGLE_DAMAGE = 30;
export const DEAGLE_PROJECTILE_SCALE = 0.34 / 20;

export const PICKUP_BOB_SPEED = 4;
export const PICKUP_BOB_AMPLITUDE = 0.07;

/** Keep player this far inside the arena AABB on XZ (clear of boundary walls). */
export const LEVEL_INNER_MARGIN = 0.55;
export const ARENA_WALL_THICKNESS = 0.45;
/** Feet slightly above the arena floor (world units). */
export const ARENA_SPAWN_Y_OFFSET = 0.1;
/** Seconds after spawn / level load with no enemy contact damage (avoids instant death). */
export const SPAWN_PROTECTION_DURATION = 3.25;
/** Pigs spawn at least this far from arena center (player spawn). */
export const ENEMY_SPAWN_CLEAR_RADIUS = 3.6;

export const GRAVITY = -32;
export const JUMP_SPEED = 11;
/** Space while sliding on a wall: horizontal push away + vertical boost. */
export const WALL_JUMP_ENABLED = true;
/** Horizontal impulse (m/s) added to `move.knockX/Z` (decays like pig knockback). */
export const WALL_JUMP_HORIZONTAL_SPEED = 7.8;
/** Vertical speed is `JUMP_SPEED *` this (often <1 so wall jump is slightly lower than ground jump). */
export const WALL_JUMP_VERTICAL_MULT = 0.92;
/** `getWallMomentumPushFromLevel` strength (0–1) needed to allow a wall jump. */
export const WALL_JUMP_CONTACT_THRESHOLD = 0.2;
/** Seconds before another wall jump (prevents spam on the same surface). */
export const WALL_JUMP_COOLDOWN_SEC = 0.3;
/** Mid-air Space presses after leaving the ground; refills when you land. Ground jump is separate. */
export const MID_AIR_JUMP_COUNT = 2;
/** Hostile death: chance to spawn a pickup that adds +1 permanent mid-air jump (until respawn). */
export const EXTRA_AIR_JUMP_DROP_CHANCE = 0.1;
export const EXTRA_AIR_JUMP_PICKUP_RADIUS = 0.88;

/** Hostile death: chance to spawn a +HP pickup (`HP_BOOST_HEAL_AMOUNT`, clamped to max HP). */
export const HP_BOOST_DROP_CHANCE = 0.5;
export const HP_BOOST_HEAL_AMOUNT = 20;
export const HP_BOOST_PICKUP_RADIUS = 0.9;

/**
 * Non–final-boss hostile death: first roll `FOOD_DROP_GATE_CHANCE`; if it passes, second roll
 * `FOOD_DROP_ITEM_CHANCE`; on success spawn one random GLB from `FOOD_PICKUP_URLS` (`foodPickupManifest.js`).
 */
export const FOOD_DROP_GATE_CHANCE = 0.2;
export const FOOD_DROP_ITEM_CHANCE = 1;
export const FOOD_PICKUP_RADIUS = 0.92;
/** Heal when walking over a food pickup (clamped to max HP). */
export const FOOD_PICKUP_HEAL_AMOUNT = 10;
/** Uniform scale for varied food GLBs at drop site. */
export const FOOD_PICKUP_MODEL_SCALE = 0.44;

/** Hostile death: chance to spawn a random potion pickup. */
export const POTION_DROP_CHANCE = 0.05;
/** Max copies of one potion id storable for hotbar drinking. */
export const POTION_INVENTORY_MAX_PER_TYPE = 8;
export const POTION_EFFECT_DURATION_SEC = 60;
export const POTION_PICKUP_RADIUS = 0.88;
/** Simulation dt multiplier while slow-motion potion is active (lower = slower world). */
export const POTION_SLOW_MOTION_SCALE = 0.28;
/** Gravity multiplier while Air Swim potion is active. */
export const POTION_AIR_SWIM_GRAVITY_MULT = 0.36;
export const POTION_LIQUID_MOVE_SPEED = 2.85;
export const POTION_ELECTRIC_PULSE_SEC = 0.52;
export const POTION_ELECTRIC_DAMAGE = 7;
export const POTION_ELECTRIC_RADIUS = 6;
/** Melee and carrot-bolt damage multiplier while Bloodlust potion is active. */
export const POTION_BLOODLUST_DAMAGE_MULT = 1.7;
/** Pickup collection radius multiplier (applied as √(r²) scale) while Magnet potion is active. */
export const POTION_MAGNET_PICKUP_RADIUS_MULT = 2.35;
/** Ground move speed multiplier while Afterburn potion is active. */
export const POTION_AFTERBURN_MOVE_MULT = 1.32;
/** Multiplier on passive HP regen while Mending potion is active. */
export const POTION_MENDING_REGEN_MULT = 3.6;
/** Fraction of incoming enemy damage applied while Stone Skin potion is active. */
export const POTION_STONE_SKIN_INCOMING_MULT = 0.72;
/** Melee reach multiplier while Gilded Reach potion is active. */
export const POTION_GILDED_MELEE_RANGE_MULT = 1.28;
/** Instant heal on drinking Second Wind (clamped to max HP). */
export const POTION_SECOND_WIND_HEAL = 32;
/** Bow / Deagle cooldown multiplier while Swift Syrup is active (<1 = faster shots). */
export const POTION_SWIFT_BOW_COOLDOWN_MULT = 0.78;

/** Camera-forward impulse (m/s) added to knock decay — phase dash (Q). */
export const PLAYER_PHASE_DASH_IMPULSE = 16;
export const PLAYER_PHASE_DASH_COOLDOWN_SEC = 1.15;
export const PLAYER_PHASE_DASH_I_FRAMES_SEC = 0.32;

/** U — expanding blue torus shockwave (XZ ring damage). */
export const SHOCKWAVE_DURATION_SEC = 10;
export const SHOCKWAVE_COOLDOWN_SEC = 60;
export const SHOCKWAVE_DAMAGE = 4;
/** Shockwave ring: outward knock impulse (XZ, m/s per tick) and combined-velocity cap. */
export const SHOCKWAVE_KNOCKBACK_IMPULSE = 20;
export const SHOCKWAVE_KNOCKBACK_MAX_SPEED = 20;
/** Local-space torus radii before uniform scale (mesh rotated flat on XZ). */
export const SHOCKWAVE_TORUS_MAJOR = 2.1;
export const SHOCKWAVE_TORUS_TUBE = 0.38;
/** Scale at start / end of the 10s expansion (uniform). Start high enough to read on camera. */
export const SHOCKWAVE_SCALE_START = 0.55;
export const SHOCKWAVE_SCALE_END = 19;

/**
 * Potion models under `Assets/Models/Potion/` — `id` selects the gameplay effect.
 * Entries with `procedural: true` use a built-in mesh (no GLB).
 * @type {{ id: string, path: string, revision: string, procedural?: boolean }[]}
 */
export const POTION_SPECS = [
  {
    id: "slow_motion",
    path: "Assets/Models/Potion/Slow_motion.glb",
    revision: "1",
  },
  {
    id: "liquid_form",
    path: "Assets/Models/Potion/Liquid_Form.glb",
    revision: "1",
  },
  {
    id: "air_swim",
    path: "Assets/Models/Potion/Air_Swim.glb",
    revision: "1",
  },
  {
    id: "blinding_light",
    path: "Assets/Models/Potion/Blinding%20light.glb",
    revision: "1",
  },
  {
    id: "electricity",
    path: "Assets/Models/Potion/Electricity.glb",
    revision: "1",
  },
  {
    id: "bloodlust",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "magnet_pull",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "afterburn",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "mending",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "stone_skin",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "gilded_reach",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "second_wind",
    path: "",
    revision: "1",
    procedural: true,
  },
  {
    id: "swift_syrup",
    path: "",
    revision: "1",
    procedural: true,
  },
];

/** Horizontal move speed while Shift is held. */
export const SPRINT_SPEED_MULTIPLIER = 2;
/** Locomotion clip `timeScale` while sprinting (matches feel to movement; raise for snappier steps). */
export const SPRINT_ANIM_MULTIPLIER = 2.75;
export const INCH_TO_M = 0.0254;
/** Green ground at y=0; collision floor slightly under (0.5 in → m). */
export const FLOOR_Y = 0.5 * INCH_TO_M;

export const MOUSE_LOOK_SENS = 0.0022;
export const CAM_PITCH_MIN = -0.4;
export const CAM_PITCH_MAX = 0.75;

export const CAM_RIG = {
  distance: 7,
  height: 3.55,
  lookHeight: 1.42,
  smooth: 8,
};

/** Perspective camera far plane (world units). `fitSkyboxToLevelBounds` may raise this on huge levels so the sky shell stays in frustum. */
export const CAM_FAR = 1500;

/** FOV (degrees): widens while sprinting on foot (matches locomotion sprint). */
export const CAM_FOV_BASE = 55;
export const CAM_FOV_SPRINT = 72;
export const CAM_FOV_SMOOTH = 12;

export const GROUND_BAND = 0.08;
export const SKYBOX_FIT_TARGET = 1000;
/** Applied after fitting skybox shell to level AABB (1 = default size). */
export const SKYBOX_WORLD_SCALE_MULT = 1.5;

/** Cap canvas resolution on high-DPR displays (1–2 typical). Unused when `RENDER_WIDTH` / `RENDER_HEIGHT` fixed mode is on. */
export const MAX_PIXEL_RATIO = 1;

/** Internal 3D framebuffer: **16:9 1080p** (1920×1080). Canvas stays CSS-fullscreen. */
export const RENDER_WIDTH = 1920;
export const RENDER_HEIGHT = 1080;
/**
 * Always multiplied with progressive-res easing (1 = full `RENDER_*` after blend).
 */
export const INTERNAL_RENDER_PIXEL_SCALE = 1;

/**
 * After a level finishes loading, internal resolution eases from `PROGRESSIVE_RENDER_START_MULT`× to full over `PROGRESSIVE_RENDER_BLEND_SEC` (smoothstep) to reduce first-frame GPU spikes on large GLBs.
 */
export const PROGRESSIVE_RENDER_ENABLED = true;
export const PROGRESSIVE_RENDER_START_MULT = 0.38;
export const PROGRESSIVE_RENDER_BLEND_SEC = 1.15;

/**
 * Performance (GPU): MSAA is costly at high DPR — off is often +30% FPS.
 * @type {boolean}
 */
export const RENDERER_ANTIALIAS = false;
/** `mediump` fragment precision — often +FPS on integrated GPUs; set false if you see color banding. */
export const RENDERER_USE_MEDIUMP_PRECISION = true;
/** Skinned pig shadows are very expensive; off = large FPS win (flat lighting on characters). */
export const RENDERER_SHADOWS = false;
/** When `RENDERER_SHADOWS` is true: soft PCF shadows vs faster basic maps. */
export const RENDERER_SHADOW_SOFT = false;
/** Shadow map resolution (only if shadows on). 256 is fast; 512 nicer. */
export const SHADOW_MAP_SIZE = 256;
/**
 * Bloom + full-screen grade (EffectComposer). Very heavy; keep off unless profiling OK.
 * @type {boolean}
 */
/**
 * Full-screen bloom + grade + optional realism pass (GLSL bundled in `postfx.js`).
 * Set false on low-end GPUs if frame time spikes.
 */
export const ENABLE_POSTFX = true;

/**
 * Studio-style diffuse+spec probe (`RoomEnvironment` → PMREM) for PBR on glTF. One-time cost at boot.
 * @type {boolean}
 */
export const SCENE_IBL_ENABLED = false;
/** PMREM blur when baking the probe (0 = sharp, ~0.04 softer). */
export const SCENE_IBL_BLUR = 0.035;
/** Applied to `MeshStandardMaterial` / `MeshPhysicalMaterial` `envMapIntensity` after load. */
export const MATERIAL_ENV_INTENSITY_MULT = 1.12;
/** <1 tightens micro-roughness slightly (shinier read without new maps). */
export const MATERIAL_ROUGHNESS_MULT = 0.94;
/** Upper cap for texture `anisotropy` (lower = less texture sampling work). */
export const TEXTURE_ANISOTROPY_CAP = 1;

/**
 * When true, `upgradeGltfScene` replaces every mesh material (including skinned characters) with
 * unlit `MeshBasicMaterial` and skips PBR/anisotropy tuning — much cheaper than full glTF shading.
 * Set `false` for nicer materials at a higher GPU cost.
 * @type {boolean}
 */
export const MODEL_MATERIAL_SIMPLIFY = true;

/**
 * When true (and {@link MODEL_MATERIAL_SIMPLIFY}), after flattening materials we disable mipmaps and
 * force bilinear sampling on every texture slot — less VRAM bandwidth than trilinear+mips.
 * @type {boolean}
 */
export const MODEL_TEXTURE_COARSEN = true;

/**
 * When true, `upgradeGltfScene` runs `SimplifyModifier` on static `Mesh` geometries (not skinned /
 * instanced). Very large per-mesh collapse counts can add noticeable load time — tune caps below.
 */
export const MODEL_MESH_GEOMETRY_SIMPLIFY = true;
/**
 * Each collapse removes roughly one vertex worth of detail; `collapses ≈ verts * this` (capped).
 * 0.65–0.85 removes most triangles on dense props; lower if loads get too slow.
 */
export const MODEL_MESH_SIMPLIFY_VERTEX_COLLAPSE_FRACTION = 0.82;
/** Safety cap per mesh (modifier cost grows with mesh size). */
export const MODEL_MESH_SIMPLIFY_MAX_COLLAPSES = 4500;
/** Meshes smaller than this are left alone (already cheap). */
export const MODEL_MESH_SIMPLIFY_MIN_VERTICES = 40;

/**
 * Cheaper than ACES: linear tone map + neutral exposure (good match for unlit `MeshBasic` scenes).
 * @type {boolean}
 */
export const RENDERER_SIMPLE_TONE_MAPPING = true;

/**
 * Runtime “potato mode” for huge level GLBs: cull tiny draw meshes (when collision proxy exists),
 * swap to unlit materials, optionally disable fog. Does not edit files on disk.
 * @type {boolean}
 */
export const LEVEL_VISUAL_PERF_STRIP_ENABLED = true;
/**
 * When a merged collision proxy exists: remove static meshes smaller than this (world-space AABB max edge, meters).
 * Higher = fewer draws (more props vanish visually; collision unchanged). Try 0.7–1.4.
 */
export const LEVEL_VISUAL_DROP_MESH_MAX_EXTENT_M = 2.05;
/** Replace level mesh materials with `MeshBasicMaterial` (no lighting math). */
export const LEVEL_VISUAL_FORCE_BASIC_MATERIAL = true;
/** Removes `scene.fog` after load for a small GPU win (distant level pops to background color). */
export const LEVEL_VISUAL_DISABLE_FOG = true;

/**
 * Background music: one URL is chosen at random on load and loops.
 * Put extra tracks in `Assets/Audio/BGM/` and append paths here (encode spaces as %20).
 */
export const BGM_VOLUME = 0.35;
/** Drive `#game` CSS `saturate()` from BGM loudness (Web Audio analyser). */
export const BGM_REACTIVE_SAT_ENABLED = true;
/** `filter: saturate()` at silence (still ≥1 = no change vs baseline). */
export const BGM_REACTIVE_SAT_MIN = 0.88;
/** Saturation on loud peaks. */
export const BGM_REACTIVE_SAT_MAX = 1.52;
/** Analyser spectral smoothing 0–1 (higher = smoother spectrum). */
export const BGM_REACTIVE_ANALYSER_SMOOTHING = 0.72;
/** Exponential smoothing toward target saturation (higher = snappier). */
export const BGM_REACTIVE_VISUAL_SMOOTH = 18;
/** One-shot when a hostile pig dies (melee or pig-on-pig). */
export const SFX_PIG_DEATH_URL =
  "Assets/Audio/SFX/Impact/impactBell_heavy_000.ogg";
export const SFX_PIG_DEATH_VOLUME = 0.55;
/** One-shot when the player is knocked out. */
export const SFX_PLAYER_DEATH_URL =
  "Assets/Audio/SFX/Impact/impactMining_001.ogg";
export const SFX_PLAYER_DEATH_VOLUME = 0.65;

export const BGM_TRACKS = [
  "Assets/Audio/Background/Music%20(1).mp3",
  "Assets/Audio/Background/Music%20(2).mp3",
  "Assets/Audio/Background/Music%20(3).mp3",
  "Assets/Audio/Background/Music%20(4).mp3",
  "Assets/Audio/Background/Music%20(5).mp3",
  "Assets/Audio/Background/Music%20(6).mp3",
  "Assets/Audio/Background/Music%20(7).mp3",
  "Assets/Audio/Background/Music%20(8).mp3",
];

/** Vitals */
export const PLAYER_MAX_HEALTH = 100;
/** Passive heal while alive (HP per second). */
export const PLAYER_HEALTH_REGEN_PER_SEC = 1;

/** Pig enemies — chase + contact damage; defeat with melee (click). F = negotiate (scripted dialogue). */
export const ENEMY_COUNT = 10;
/** Each pig gets this many random allies (inclusive range) who join if you convince that pig. */
export const PIG_FRIENDS_MIN = 1;
export const PIG_FRIENDS_MAX = 4;
/** Target capsule height after auto-scale (meters). */
export const ENEMY_MODEL_HEIGHT = 0.88;
/** Fallback horizontal collider if bbox tiny. */
export const ENEMY_COLLIDER_RADIUS = 0.48;
export const ENEMY_SPEED = 2.65;
/** One hit from fists (PLAYER_MELEE_DAMAGE) kills. */
export const ENEMY_MAX_HEALTH = 10;
/** Pig contact hit — use `getEnemyContactDamage(levelIndex)` (rises each stage). */
export const ENEMY_CONTACT_DAMAGE_BASE = 5;
export const ENEMY_CONTACT_DAMAGE_PER_LEVEL = 1;
export const ENEMY_HIT_COOLDOWN = 0.85;
/** Hostile squads farther than this from the player (XZ) may brawl each other. */
export const INTER_SQUAD_PVP_MIN_PLAYER_DIST = 11;
/** Damage per brawl tick when two hostile pigs from different squads collide. */
export const ENEMY_VS_ENEMY_DAMAGE = 4;
/** Per-pig cooldown between pig-on-pig brawl damage. */
export const ENEMY_VS_ENEMY_COOLDOWN = 0.55;
/** Opacity lost per second while dying (1 → 0 in 10s at 0.1). */
export const ENEMY_DEATH_FADE_PER_SEC = 0.1;

/** Horizontal impulse (m/s) added to pigs when melee hits; decays with `ENEMY_KNOCKBACK_DECAY`. */
export const MELEE_KNOCKBACK_IMPULSE = 7;
export const ENEMY_KNOCKBACK_MAX_SPEED = 18;
export const ENEMY_KNOCKBACK_DECAY = 10;
/** Player shove away from pig on contact damage (m/s impulse). */
export const PLAYER_HIT_KNOCKBACK_IMPULSE = 6;
export const PLAYER_KNOCKBACK_MAX_SPEED = 14;
export const PLAYER_KNOCKBACK_DECAY = 12;

export const PLAYER_MELEE_RANGE = 2.15;
export const PLAYER_MELEE_DAMAGE = 10;
export const CARROT_MELEE_DAMAGE = 15;
export const PLAYER_MELEE_COOLDOWN = 0.42;
/** Melee damage multiplier while airborne (any jump). */
export const MELEE_AIR_HIT_DAMAGE_MULT = 2;
/** Melee damage multiplier when you left the ground on a sprint jump (Shift held on first jump). */
export const MELEE_SPRINT_JUMP_HIT_DAMAGE_MULT = 3;
/** Melee damage multiplier when sprint-jumping then using all mid-air jumps (3 jumps total) before the hit. */
export const MELEE_SPRINT_TRIPLE_JUMP_HIT_DAMAGE_MULT = 6;
/** Min dot(forward, toEnemy) for melee hit (1 = straight only). ~0.2 ≈ wide arc. */
export const PLAYER_MELEE_MIN_DOT = 0.25;

/** Talk to pigs (local dialogue tables); melee stays on mouse click only. */
export const NEGOTIATE_RANGE = 3.35;
export const NEGOTIATE_MIN_DOT = 0.22;
export const NEGOTIATE_COOLDOWN_SEC = 4;
/** Eye height above feet for “can you see this pig?” line checks. */
export const NEGOTIATE_EYE_HEIGHT = 1.52;
/** Aim point above pig feet for LOS (torso). */
export const NEGOTIATE_PIG_AIM_Y = 0.4;
/** End-of-ray margin for LOS vs merged collision (m). */
export const NEGOTIATE_LOS_SKIN = 0.32;
/** Ring radius for allied pigs to loiter near the player. */
export const ALLY_FOLLOW_RADIUS = 3.15;
/** How fast follow slots orbit (rad/s). */
export const ALLY_SLOT_DRIFT = 0.12;
/** Initial ring when spawning allies after a level load. */
export const ALLY_SPAWN_RING = 2.45;

/** Horizontal hitbox around player root (feet). */
export const PLAYER_HITBOX_RADIUS = 0.48;

/** Capsule-like collision vs level triangles (GLB meshes). */
export const PLAYER_COLLISION_RADIUS = 0.38;
/** Downward rays start this far above the feet to hit tops of props. */
export const LEVEL_COLLISION_RAY_START_ABOVE_FEET = 1.35;
/** Auto step onto small ledges (world units). */
export const LEVEL_COLLISION_MAX_STEP_UP = 0.42;
/** Wall rays from this height above the feet. */
export const LEVEL_WALL_PROBE_Y = 0.72;
export const LEVEL_WALL_RESOLVE_ITERS = 3;
/** Ceiling ray from feet upward (head clearance probe). */
export const LEVEL_CEILING_PROBE_Y = 1.58;

/** Exponential fog (pairs with scene tone in scene.js). */
export const SCENE_FOG_COLOR = 0xc4dcff;
/** Higher = horizon closes in sooner (shorter effective view distance). */
export const SCENE_FOG_DENSITY = 0.015;

/** UnrealBloomPass — emissive highlights & sun. */
export const POSTFX_BLOOM_STRENGTH = 0.36;
export const POSTFX_BLOOM_RADIUS = 0.48;
export const POSTFX_BLOOM_THRESHOLD = 0.72;

/**
 * Extra pass after bloom: luma cavity AO, mild barrel distortion, cool shadow tint.
 * Color-only cavity AO + mild lens warp (no depth MRT).
 */
export const POSTFX_REALISM_ENABLED = true;
/** 0 = off, ~0.35 is noticeable contact darkening without mud. */
export const POSTFX_REALISM_LUMA_AO = 0.32;
/** Barrel strength (negative = pincushion). Keep small (|k| under ~0.08). */
export const POSTFX_REALISM_LENS_K = -0.028;
/** How much to push dark areas toward cool air-light (0–0.25). */
export const POSTFX_REALISM_SHADOW_TINT = 0.12;

/**
 * Canvas overlay: ripples + soft glow under the cursor (`mouseEffects.js`).
 * Disabled when `prefers-reduced-motion: reduce`. Pointer-lock uses accumulated screen position.
 */
export const MOUSE_FX_ENABLED = true;
/** Max simultaneous ripple rings. */
export const MOUSE_FX_RIPPLE_CAP = 18;

// --- Progression: harder pigs & better drops by `game.levelIndex` (0 = arena, 1 = Crystal, …) ---

export const DROP_LEVEL_MULT_CARROT = 0.11;
export const DROP_LEVEL_MULT_BOW = 0.16;
export const DROP_LEVEL_MULT_DEAGLE = 0.24;
export const CARROT_DROP_CHANCE_CAP = 0.55;
export const BOW_DROP_CHANCE_CAP = 0.42;
export const DEAGLE_DROP_CHANCE_CAP = 0.32;

/** Carrot melee: +this per level index; Crystal (1) stays `CRYSTAL_CARROT_MELEE_DAMAGE`. */
export const CARROT_MELEE_DAMAGE_PER_LEVEL = 2;
export const BOW_DAMAGE_PER_LEVEL = 1;
export const DEAGLE_DAMAGE_PER_LEVEL = 1.5;

/**
 * @param {number} levelIndex
 */
export function getEnemyContactDamage(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return ENEMY_CONTACT_DAMAGE_BASE + idx * ENEMY_CONTACT_DAMAGE_PER_LEVEL;
}

/**
 * @param {number} levelIndex
 */
export function getCarrotDropChance(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return Math.min(
    CARROT_DROP_CHANCE_CAP,
    CARROT_DROP_CHANCE * (1 + idx * DROP_LEVEL_MULT_CARROT),
  );
}

/**
 * @param {number} levelIndex
 */
export function getBowDropChance(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return Math.min(
    BOW_DROP_CHANCE_CAP,
    BOW_DROP_CHANCE * (1 + idx * DROP_LEVEL_MULT_BOW),
  );
}

/**
 * @param {number} levelIndex
 */
export function getDeagleDropChance(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return Math.min(
    DEAGLE_DROP_CHANCE_CAP,
    DEAGLE_DROP_CHANCE * (1 + idx * DROP_LEVEL_MULT_DEAGLE),
  );
}

/**
 * @param {number} levelIndex
 */
export function getCarrotMeleeDamageForLevel(levelIndex) {
  if (levelIndex === 1) return CRYSTAL_CARROT_MELEE_DAMAGE;
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return CARROT_MELEE_DAMAGE + idx * CARROT_MELEE_DAMAGE_PER_LEVEL;
}

/**
 * Extra melee damage vs carrot-tier when holding a Powerful-folder pickup.
 * (Was +15 ≈ “double” carrot at arena baseline; ×3 on that uplift → +45.)
 */
export const POWERFUL_MELEE_FLAT_BONUS = 45;

/**
 * Pig drops: powerful-folder melee pickups use `getCarrotDropChance(level) / this`.
 * `3` = triple rarity vs the former same roll as carrot-class.
 */
export const POWERFUL_MELEE_PICKUP_RARITY_MULT = 3;

/**
 * @param {number} levelIndex
 */
export function getPowerfulMeleeDamageForLevel(levelIndex) {
  return getCarrotMeleeDamageForLevel(levelIndex) + POWERFUL_MELEE_FLAT_BONUS;
}

/**
 * @param {number} levelIndex
 */
export function getBowDamageForLevel(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return Math.round(BOW_DAMAGE + idx * BOW_DAMAGE_PER_LEVEL);
}

/**
 * @param {number} levelIndex
 */
export function getDeagleDamageForLevel(levelIndex) {
  const idx = Number.isFinite(levelIndex) ? Math.max(0, levelIndex) : 0;
  return Math.round(DEAGLE_DAMAGE + idx * DEAGLE_DAMAGE_PER_LEVEL);
}
