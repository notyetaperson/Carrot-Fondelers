export const move = {
  speed: 9,
  yaw: 0,
  vy: 0,
  onGround: true,
  /** True until landing: last ground jump was with Shift held (sprint-jump chain for melee mult). */
  sprintJumpCarry: false,
  /** Jump presses since last landing (1 = left ground, 3 = ground + 2 air = “triple jump” chain). */
  jumpsSinceLand: 0,
  /** Extra jumps while airborne; refills to `MID_AIR_JUMP_COUNT` + `bonusMidAirJumps` on landing. */
  airJumpsRemaining: 2,
  /** From jump pickups; cleared on knockout respawn. */
  bonusMidAirJumps: 0,
  /** Horizontal knockback velocity from pig hits (XZ, m/s). */
  knockX: 0,
  knockZ: 0,
  /** Unit XZ away from the strongest contacted wall (from `getWallMomentumPushFromLevel`). */
  wallPushX: 0,
  wallPushZ: 0,
  /** 0–1 how strongly level geometry reads as a wall at the probe height (not grounded). */
  wallPushStr: 0,
};

export const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};

export const camOrbit = { yaw: 0, pitch: 0 };

/**
 * Allied pig feet positions for the current frame (filled in `updateEnemies`).
 * Used by `updatePickups` so allies can collect drops for the party.
 * @type {{ x: number, y: number, z: number }[]}
 */
export const allyPickupGatherers = [];

/** Shared mutable session state (pause, animation mixer handle, camera snap). */
export const game = {
  paused: false,
  /** True when touch HUD is visible — skip pointer lock on canvas tap (see `mobileControls.js`). */
  mobileTouchOverlayActive: false,
  /** @type {{ mixer: import("three").AnimationMixer; walk: import("three").AnimationAction; idle: import("three").AnimationAction | null; walkWeight: number } | null} */
  playerAnim: null,
  cameraSnapped: false,
  /** World-space AABB of the loaded arena (for floor + XZ clamp). */
  /** @type {import("three").Box3 | null} */
  levelBounds: null,
  /** Walkable deck height (raycast); not the same as `levelBounds.min.y` when the mesh has underhangs. */
  arenaFloorY: /** @type {number | null} */ (null),
  /** Triangle meshes from the level GLB used for stand-on and bump collision. */
  /** @type {import("three").Mesh[]} */
  levelCollisionMeshes: [],
  /** Single merged world-space mesh for raycasts (GPU memory tradeoff, much faster than N meshes). */
  /** @type {import("three").Mesh | null} */
  collisionProxy: null,

  /** @type {import("three").Object3D | null} */
  levelRoot: null,
  /** @type {import("three").Group | null} */
  boundaryGroup: null,
  /** 0 = arena, 1 = Crystal, 2…LAST = dungeons (`config.DUNGEON_STAGES`) */
  levelIndex: 0,
  /**
   * Top-right progression widget: `rank` = Ranks art only; `level` = Medals art only.
   * Pause menu default is rank — see `progressionHudMode.js`.
   * @type {"rank" | "level"}
   */
  progressionHudMode: "rank",
  /** Incremented each live sim tick (for staggered physics / ray work). */
  physicsTick: 0,
  /** ms (`performance.now()`): internal res ramps up until blend ends — see `config.PROGRESSIVE_RENDER_*`. */
  progressiveRenderStartAt: /** @type {number | null} */ (null),
  levelTransitioning: false,
  /** Arena wave: starts at ENEMY_COUNT, decremented on each kill. */
  enemiesRemaining: 0,
  /** Pigs killed this wave (reset when arena pigs spawn). */
  enemyKills: 0,
  /** True after pigs spawn on arena; avoids win check before load. */
  waveSpawned: false,
  /** Updated each frame in `updateEnemies` — any living hostile pig. */
  hasLivingHostiles: false,

  requestMelee: false,
  /** Right-click while pointer-locked: try to drink selected hotbar potion. */
  requestDrinkPotion: false,
  /** Press Q: short camera-forward phase dash (cooldown in `playerPhaseDashReadyAt`). */
  requestPhaseDash: false,
  /** Seconds (`performance.now()/1000`) when phase dash can be used again. */
  playerPhaseDashReadyAt: 0,
  /** Press U: expanding shockwave torus (`SHOCKWAVE_*` in config). */
  requestShockwave: false,
  /** Wall seconds: shockwave can start when `performance.now()/1000 >=` this (0 = ready). */
  shockwaveReadyAt: 0,
  /** After FB kill: `beginShockwave` does not add `SHOCKWAVE_COOLDOWN_SEC`. */
  shockwaveCooldownDisabled: false,
  /** Press F: negotiate with pigs (scripted dialogue). */
  requestNegotiate: false,
  /** Negotiation resolution in flight. */
  negotiating: false,
  /** Seconds (`performance.now()/1000`) when another negotiate is allowed. */
  negotiateReadyAt: 0,
  /** How many living allied pigs (snapshot before level load for respawn). */
  alliedPigCount: 0,
  /**
   * Per-ally model URL + uniform scale, filled by `snapshotAlliesForCarryOver` before a level change
   * so respawned allies match Crystal / dungeon pigs instead of defaulting to arena Pig (1).
   * @type {{ url: string, visualScale: number, modelYawExtra?: number }[]}
   */
  alliedPigCarryover: [],
  /** Hostile pig you can negotiate with (closest in view + LOS); red glow. */
  negotiationHighlight: null,
  /** Set true to respawn at level start (clears carrot & pickups). */
  requestRespawn: false,
  /** Seconds (`performance.now()/1000`) when melee can fire again. */
  playerMeleeReadyAt: 0,
  /** Seconds (`performance.now()/1000`) when another wall jump is allowed. */
  playerWallJumpReadyAt: 0,
  /** Picked up Carrot.glb — melee uses `CARROT_MELEE_DAMAGE`. */
  hasCarrotWeapon: false,
  /** Stage 5+ carrot-class drops: GLB from `Powerful` folder; melee uses `getPowerfulMeleeDamageForLevel`. */
  hasPowerfulMeleeWeapon: false,
  /** Short label for HUD (from `POWERFUL_WEAPON_PICKUPS`). */
  powerfulWeaponLabel: "",
  /** Cool bow pickup — primary click fires a straight carrot bolt (`BOW_DAMAGE`). */
  hasBowWeapon: false,
  /** Desert Eagle — faster carrot bolt (`DEAGLE_DAMAGE`); wins over bow if you have both. */
  hasDeagleWeapon: false,
  /** Seconds (`performance.now()/1000`) when bow / deagle can fire again. */
  playerBowReadyAt: 0,
  /**
   * Index into the combined hotbar (`buildWeaponHotbarSlots` in pickups.js):
   * weapons (strongest first), then potion stacks. Wheel cycles. LMB uses the
   * selected weapon, or `lastWeaponForAttack` when a potion row is highlighted.
   */
  weaponHotbarIndex: 0,
  /**
   * Counts per `POTION_SPECS.id` (hotbar stacks; drink with right-click when that slot is selected).
   * @type {Record<string, number>}
   */
  potionInventory: {},
  /** Last non-potion weapon id — used for LMB damage while a potion stack is highlighted. */
  lastWeaponForAttack: "fists",

  maxHealth: 100,
  health: 100,
  playerDead: false,
  /** Time in seconds (`performance.now() / 1000`) until enemy contact can hurt again. */
  enemyDamageInvulnUntil: 0,
  /** Until this time (sec), `applyDamage` ignores enemy hits (spawn / respawn). */
  spawnProtectionUntil: 0,

  /** E — emote quick-bar open (1–8 triggers); see `emotes.js`. */
  emoteBarOpen: false,

  /** Y — dev command panel (blocks gameplay keys while open). */
  devConsoleOpen: false,
  /** Dev: ignore enemy contact damage while true. */
  devGodMode: false,
  /**
   * Pig parley toast lines: `false` = English (default), `true` = Oinkish cipher — toggle in pause menu.
   * @type {boolean}
   */
  pigLanguageOinkish: false,
  /**
   * Set only when you pick up Homohands (FB drop). No other path — not saved across reloads.
   * Required to open the dev console (Y).
   */
  devConsoleUnlocked: false,

  /**
   * @type {string | null} `POTION_SPECS.id` while a potion is active (procedural + GLB kinds).
   */
  activePotionKind: null,
  /** Wall-clock seconds (`performance.now()/1000`) when the current potion ends. */
  activePotionEndsAt: 0,

  /**
   * Multiplier applied in `damageHostileFromPlayer` for player-sourced hits (not ally assists).
   * Set to `FB_BOSS_DROP_OUTGOING_DAMAGE_MULT` when FB dies.
   */
  playerOutgoingDamageMult: 1,
};
