import * as THREE from "three";
import {
  POTION_AIR_SWIM_GRAVITY_MULT,
  POTION_BLOODLUST_DAMAGE_MULT,
  POTION_EFFECT_DURATION_SEC,
  POTION_ELECTRIC_DAMAGE,
  POTION_ELECTRIC_PULSE_SEC,
  POTION_ELECTRIC_RADIUS,
  POTION_GILDED_MELEE_RANGE_MULT,
  POTION_MAGNET_PICKUP_RADIUS_MULT,
  POTION_MENDING_REGEN_MULT,
  POTION_SLOW_MOTION_SCALE,
  POTION_STONE_SKIN_INCOMING_MULT,
  POTION_SWIFT_BOW_COOLDOWN_MULT,
} from "./config.js";
import { game } from "./state.js";

/** @type {HTMLDivElement | null} */
let blindOverlayEl = null;
let lastElectricPulseWall = 0;

/** @type {THREE.Group | null} */
let liquidBlobGroup = null;

/**
 * @param {THREE.Group} player
 */
function ensureLiquidBlob(player) {
  if (liquidBlobGroup) return;
  const g = new THREE.Group();
  g.name = "PotionLiquidBlob";
  const geo = new THREE.SphereGeometry(0.44, 28, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a8ce8,
    emissive: 0x1a4a90,
    emissiveIntensity: 0.55,
    metalness: 0.12,
    roughness: 0.22,
    transparent: true,
    opacity: 0.94,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.44;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  g.visible = false;
  player.add(g);
  liquidBlobGroup = g;
}

/**
 * @param {THREE.Group} player
 */
function showLiquidBlob(player) {
  ensureLiquidBlob(player);
  for (const c of player.children) {
    if (c === liquidBlobGroup) c.visible = true;
    else c.visible = false;
  }
}

/**
 * @param {THREE.Group} player
 */
function hideLiquidBlob(player) {
  if (liquidBlobGroup) liquidBlobGroup.visible = false;
  for (const c of player.children) {
    if (c !== liquidBlobGroup) c.visible = true;
  }
}

function ensureBlindOverlay() {
  if (blindOverlayEl) return;
  const d = document.createElement("div");
  d.id = "potion-blind-overlay";
  d.setAttribute("aria-hidden", "true");
  d.style.cssText =
    "position:fixed;inset:0;pointer-events:none;background:#fff;z-index:48;opacity:0;mix-blend-mode:screen;";
  document.body.appendChild(d);
  blindOverlayEl = d;
}

function showBlindOverlay() {
  ensureBlindOverlay();
}

/**
 * @param {number} tWall
 */
function syncBlindOverlay(tWall) {
  if (!blindOverlayEl) return;
  const pulse = 0.38 + 0.2 * Math.sin(tWall * 1.8);
  blindOverlayEl.style.opacity = String(Math.min(0.58, pulse));
}

function hideBlindOverlay() {
  if (blindOverlayEl) blindOverlayEl.style.opacity = "0";
}

/**
 * @param {THREE.Group} player
 */
function endPotionVisuals(player) {
  hideLiquidBlob(player);
  hideBlindOverlay();
}

/**
 * @param {number} tWall
 */
export function isLiquidFormActive(tWall) {
  return (
    game.activePotionKind === "liquid_form" && tWall < game.activePotionEndsAt
  );
}

/**
 * @param {number} tWall
 */
export function isPotionActive(tWall) {
  return (
    !!game.activePotionKind && tWall < game.activePotionEndsAt
  );
}

/**
 * @param {number} tWall
 */
export function isAfterburnActive(tWall) {
  return (
    game.activePotionKind === "afterburn" && tWall < game.activePotionEndsAt
  );
}

/**
 * Melee and carrot bolts — not environmental / electric pulses.
 * @param {number} tWall
 */
export function getBloodlustDamageMult(tWall) {
  if (
    game.activePotionKind === "bloodlust" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_BLOODLUST_DAMAGE_MULT;
  }
  return 1;
}

/**
 * Scales pickup collection radius (multiply base r² by this squared).
 * @param {number} tWall
 */
export function getPotionPickupReachMult(tWall) {
  if (
    game.activePotionKind === "magnet_pull" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_MAGNET_PICKUP_RADIUS_MULT;
  }
  return 1;
}

/**
 * @param {number} tWall
 */
export function getMendingRegenMult(tWall) {
  if (
    game.activePotionKind === "mending" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_MENDING_REGEN_MULT;
  }
  return 1;
}

/**
 * Multiplier on damage taken from enemies (1 = normal).
 * @param {number} tWall
 */
export function getStoneSkinDamageTakenMult(tWall) {
  if (
    game.activePotionKind === "stone_skin" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_STONE_SKIN_INCOMING_MULT;
  }
  return 1;
}

/**
 * @param {number} tWall
 */
export function getGildedMeleeRangeMult(tWall) {
  if (
    game.activePotionKind === "gilded_reach" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_GILDED_MELEE_RANGE_MULT;
  }
  return 1;
}

/**
 * @param {number} tWall
 */
export function getSwiftBowCooldownMult(tWall) {
  if (
    game.activePotionKind === "swift_syrup" &&
    tWall < game.activePotionEndsAt
  ) {
    return POTION_SWIFT_BOW_COOLDOWN_MULT;
  }
  return 1;
}

/**
 * @param {number} rawDt
 * @param {number} tWall
 */
export function getEffectiveSimDt(rawDt, tWall) {
  if (!game.activePotionKind || tWall >= game.activePotionEndsAt) return rawDt;
  if (game.activePotionKind === "slow_motion")
    return rawDt * POTION_SLOW_MOTION_SCALE;
  return rawDt;
}

/**
 * @param {number} tWall
 */
export function getAirSwimGravityMult(tWall) {
  if (
    game.activePotionKind !== "air_swim" ||
    tWall >= game.activePotionEndsAt
  ) {
    return 1;
  }
  return POTION_AIR_SWIM_GRAVITY_MULT;
}

/**
 * @param {THREE.Group} player
 */
export function startPotionEffect(kind, player) {
  const tWall = performance.now() * 0.001;
  if (game.activePotionKind) endPotionEffect(player);
  lastElectricPulseWall = tWall;
  if (kind === "second_wind") {
    hideLiquidBlob(player);
    hideBlindOverlay();
    game.activePotionKind = null;
    game.activePotionEndsAt = 0;
    return;
  }
  game.activePotionKind = kind;
  game.activePotionEndsAt = tWall + POTION_EFFECT_DURATION_SEC;
  if (kind === "liquid_form") {
    showLiquidBlob(player);
    hideBlindOverlay();
  } else if (kind === "blinding_light") {
    hideLiquidBlob(player);
    showBlindOverlay();
  } else {
    hideLiquidBlob(player);
    hideBlindOverlay();
  }
}

/**
 * @param {THREE.Group} player
 */
export function endPotionEffect(player) {
  game.activePotionKind = null;
  game.activePotionEndsAt = 0;
  endPotionVisuals(player);
}

/**
 * @param {THREE.Group} player
 */
export function clearAllPotionEffects(player) {
  endPotionEffect(player);
}

/**
 * Call before physics: expire potions by wall clock.
 * @param {number} tWall
 * @param {THREE.Group} player
 */
export function tickPotionsBeforePhysics(tWall, player) {
  if (game.activePotionKind && tWall >= game.activePotionEndsAt) {
    endPotionEffect(player);
  }
}

/**
 * @param {number} tWall
 * @param {THREE.Group} player
 * @param {THREE.Scene} scene
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 */
export function tickPotionsAfterPhysics(tWall, player, scene, loader) {
  if (!game.activePotionKind || tWall >= game.activePotionEndsAt) return;
  if (game.activePotionKind === "blinding_light") syncBlindOverlay(tWall);
  if (
    game.activePotionKind === "electricity" &&
    tWall - lastElectricPulseWall >= POTION_ELECTRIC_PULSE_SEC
  ) {
    lastElectricPulseWall = tWall;
    void import("./enemies.js").then((m) =>
      m.damageHostilesInRadius(
        player,
        POTION_ELECTRIC_RADIUS,
        POTION_ELECTRIC_DAMAGE,
        scene,
        loader,
      ),
    );
  }
}
