import {
  ENEMY_HIT_COOLDOWN,
  FB_BOSS_DROP_BONUS_MID_AIR_JUMPS,
  FB_BOSS_DROP_MAX_HEALTH_BONUS,
  FB_BOSS_DROP_OUTGOING_DAMAGE_MULT,
  MID_AIR_JUMP_COUNT,
  PLAYER_HEALTH_REGEN_PER_SEC,
  PLAYER_MAX_HEALTH,
  SPAWN_PROTECTION_DURATION,
} from "./config.js";
import { closeEmoteBar } from "./emotes.js";
import { releaseMobileControlsInput } from "./mobileControls.js";
import { syncWeaponHud } from "./pickups.js";
import {
  getMendingRegenMult,
  getStoneSkinDamageTakenMult,
  isLiquidFormActive,
} from "./potions.js";
import { playPlayerDeathSfx } from "./sfx.js";
import { game, move } from "./state.js";

/** @type {HTMLElement | null} */
let fillEl = null;
/** @type {HTMLElement | null} */
let labelEl = null;
/** @type {HTMLElement | null} */
let knockoutOverlayEl = null;
/** @type {HTMLElement | null} */
let damageFlashEl = null;
/** @type {HTMLElement | null} */
let hitFlashEl = null;
let lastLandHitFlashAt = 0;
/** @type {HTMLElement | null} */
let lowHealthVignetteEl = null;

/** Full-screen tint when your damage connects (melee tiers / default ranged). */
const LAND_HIT_FLASH_BG = {
  blue: "rgb(55 130 255 / 55%)",
  green: "rgb(45 200 95 / 55%)",
  yellow: "rgb(235 205 55 / 55%)",
  purple: "rgb(155 75 215 / 55%)",
};

/** Show red edge vignette when current health is strictly below this fraction of max. */
const LOW_HEALTH_VIGNETTE_RATIO = 0.2;

function triggerDamageFlash() {
  const el = damageFlashEl ?? document.getElementById("damage-flash");
  if (!el) return;
  damageFlashEl = el;
  el.classList.remove("damage-flash--run");
  void el.offsetWidth;
  el.classList.add("damage-flash--run");
}

/**
 * Full-screen pulse when the player lands damage on a hostile.
 * @param {"blue" | "green" | "yellow" | "purple"} [tone] default blue (ranged / potion / grounded melee)
 */
export function triggerPlayerLandHitFlash(tone = "blue") {
  const t = performance.now();
  if (t - lastLandHitFlashAt < 45) return;
  lastLandHitFlashAt = t;
  const el = hitFlashEl ?? document.getElementById("hit-flash");
  if (!el) return;
  hitFlashEl = el;
  const bg = LAND_HIT_FLASH_BG[tone] ?? LAND_HIT_FLASH_BG.blue;
  el.style.background = bg;
  el.classList.remove("hit-flash--run");
  void el.offsetWidth;
  el.classList.add("hit-flash--run");
}

function showKnockoutOverlay() {
  const el = knockoutOverlayEl ?? document.getElementById("knockout-overlay");
  if (!el) return;
  knockoutOverlayEl = el;
  el.removeAttribute("hidden");
  el.setAttribute("aria-hidden", "false");
  el.classList.remove("knockout-overlay--run");
  void el.offsetWidth;
  el.classList.add("knockout-overlay--run");
}

function hideKnockoutOverlay() {
  const el = knockoutOverlayEl ?? document.getElementById("knockout-overlay");
  if (!el) return;
  knockoutOverlayEl = el;
  el.classList.remove("knockout-overlay--run");
  el.setAttribute("hidden", "");
  el.setAttribute("aria-hidden", "true");
}

export function initHealthHud() {
  game.maxHealth = PLAYER_MAX_HEALTH;
  game.health = PLAYER_MAX_HEALTH;
  game.playerDead = false;
  move.knockX = 0;
  move.knockZ = 0;
  move.wallPushX = 0;
  move.wallPushZ = 0;
  move.wallPushStr = 0;
  game.enemyDamageInvulnUntil = 0;
  game.spawnProtectionUntil = 0;
  game.hasCarrotWeapon = false;
  game.hasPowerfulMeleeWeapon = false;
  game.powerfulWeaponLabel = "";
  game.hasBowWeapon = false;
  game.hasDeagleWeapon = false;
  game.playerBowReadyAt = 0;
  game.weaponHotbarIndex = 0;
  game.potionInventory = {};
  game.lastWeaponForAttack = "fists";
  game.requestDrinkPotion = false;
  game.playerWallJumpReadyAt = 0;
  document.body.classList.remove("player-dead");
  document.body.classList.remove("low-health-danger");
  knockoutOverlayEl = document.getElementById("knockout-overlay");
  hideKnockoutOverlay();
  damageFlashEl = document.getElementById("damage-flash");
  damageFlashEl?.classList.remove("damage-flash--run");
  hitFlashEl = document.getElementById("hit-flash");
  if (hitFlashEl) {
    hitFlashEl.classList.remove("hit-flash--run");
    hitFlashEl.style.background = "";
  }
  lowHealthVignetteEl = document.getElementById("low-health-vignette");

  fillEl = document.getElementById("health-bar-fill");
  labelEl = document.getElementById("health-bar-label");

  syncHealthHud();
  syncWeaponHud();
}

/**
 * @param {number} amount
 * @param {"enemy" | "dev"} source `dev` skips spawn protection and i-frames (test kills).
 * @returns {boolean} true if HP changed (damage applied)
 */
export function applyDamage(amount, source = "enemy") {
  if (game.playerDead || amount <= 0) return false;
  if (game.devGodMode && source === "enemy") return false;

  const t = performance.now() * 0.001;
  if (source === "enemy" && isLiquidFormActive(t)) return false;
  if (source !== "dev") {
    if (
      Number.isFinite(game.spawnProtectionUntil) &&
      t < game.spawnProtectionUntil
    ) {
      return false;
    }
    if (source === "enemy" && t < game.enemyDamageInvulnUntil) return false;
  }

  const taken =
    source === "enemy" ? amount * getStoneSkinDamageTakenMult(t) : amount;
  game.health = Math.max(0, game.health - taken);
  if (source === "enemy") {
    game.enemyDamageInvulnUntil = t + ENEMY_HIT_COOLDOWN;
  }

  syncHealthHud();
  triggerDamageFlash();

  if (game.health <= 0) {
    game.playerDead = true;
    closeEmoteBar();
    releaseMobileControlsInput();
    move.knockX = 0;
    move.knockZ = 0;
    document.body.classList.add("player-dead");
    playPlayerDeathSfx();
    showKnockoutOverlay();
  }
  return true;
}

/**
 * Passive regeneration while alive and not at max.
 * @param {number} dt delta time in seconds
 */
export function updateHealthRegen(dt) {
  if (game.playerDead || dt <= 0) return;
  if (game.health >= game.maxHealth) return;
  const t = performance.now() * 0.001;
  const next = Math.min(
    game.maxHealth,
    game.health +
      PLAYER_HEALTH_REGEN_PER_SEC * getMendingRegenMult(t) * dt,
  );
  if (next === game.health) return;
  game.health = next;
  syncHealthHud();
}

export function syncHealthHud() {
  const ratio = game.maxHealth > 0 ? game.health / game.maxHealth : 0;
  const lowHealthActive =
    game.maxHealth > 0 &&
    game.health > 0 &&
    ratio < LOW_HEALTH_VIGNETTE_RATIO &&
    !game.playerDead;
  document.body.classList.toggle("low-health-danger", lowHealthActive);
  if (lowHealthVignetteEl) {
    lowHealthVignetteEl.setAttribute(
      "aria-hidden",
      lowHealthActive ? "false" : "true",
    );
  }

  if (!fillEl || !labelEl) return;
  fillEl.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  labelEl.textContent = `${Math.ceil(game.health)} / ${game.maxHealth}`;
}

/** Full heal and clear knocked-out state (e.g. after loading a new level). */
/** Call after placing the player so pig overlap cannot hurt on the first frames. */
export function markSpawnProtection(
  durationSec = SPAWN_PROTECTION_DURATION,
) {
  game.spawnProtectionUntil = performance.now() * 0.001 + durationSec;
}

/**
 * One-shot heal (e.g. Second Wind potion). Does not bypass god mode for enemy damage.
 * @param {number} amount
 */
export function applyBurstHeal(amount) {
  if (game.playerDead || amount <= 0) return;
  game.health = Math.min(game.maxHealth, game.health + amount);
  syncHealthHud();
}

/** When FB dies (same tick as Homohands spawn): raise max HP, heal, air jumps, 10× outgoing damage, no shockwave CD. */
export function applyFinalBossStatDrop() {
  if (game.playerDead) return;
  game.maxHealth += FB_BOSS_DROP_MAX_HEALTH_BONUS;
  game.health = Math.min(
    game.maxHealth,
    game.health + FB_BOSS_DROP_MAX_HEALTH_BONUS,
  );
  game.bonusMidAirJumps += FB_BOSS_DROP_BONUS_MID_AIR_JUMPS;
  move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
  game.playerOutgoingDamageMult = FB_BOSS_DROP_OUTGOING_DAMAGE_MULT;
  game.shockwaveCooldownDisabled = true;
  syncHealthHud();
}

export function restoreFullHealth() {
  game.health = game.maxHealth;
  game.playerDead = false;
  move.knockX = 0;
  move.knockZ = 0;
  game.enemyDamageInvulnUntil = 0;
  document.body.classList.remove("player-dead");
  hideKnockoutOverlay();
  syncHealthHud();
  syncWeaponHud();
}
