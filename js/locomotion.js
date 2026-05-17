import * as THREE from "three";
import { SPRINT_ANIM_MULTIPLIER } from "./config.js";
import { isLiquidFormActive } from "./potions.js";
import { game, keys, move } from "./state.js";

/**
 * @param {number} dt
 */
export function updateLocomotionAnimations(dt) {
  const playerAnim = game.playerAnim;
  if (!playerAnim?.mixer) return;

  const tWall = performance.now() * 0.001;
  if (isLiquidFormActive(tWall)) {
    playerAnim.walk.paused = true;
    if (playerAnim.idle) {
      playerAnim.walk.setEffectiveWeight(0);
      playerAnim.idle.setEffectiveWeight(1);
    }
    playerAnim.mixer.update(0);
    return;
  }

  if (game.playerDead) {
    playerAnim.walk.paused = true;
    if (playerAnim.idle) {
      playerAnim.walk.setEffectiveWeight(0);
      playerAnim.idle.setEffectiveWeight(1);
    }
    playerAnim.mixer.update(dt);
    return;
  }

  const moving = (keys.forward || keys.back) && move.onGround;
  const walkBackward = keys.back && !keys.forward;
  const sprintMul =
    keys.sprint && move.onGround && moving ? SPRINT_ANIM_MULTIPLIER : 1;
  playerAnim.walk.timeScale = (walkBackward ? -1 : 1) * sprintMul;

  if (playerAnim.idle) {
    const target = moving ? 1 : 0;
    playerAnim.walkWeight = THREE.MathUtils.lerp(
      playerAnim.walkWeight,
      target,
      1 - Math.exp(-14 * dt),
    );
    playerAnim.walk.setEffectiveWeight(playerAnim.walkWeight);
    playerAnim.idle.setEffectiveWeight(1 - playerAnim.walkWeight);
  } else {
    playerAnim.walk.paused = !moving;
  }

  playerAnim.mixer.update(dt);
}
