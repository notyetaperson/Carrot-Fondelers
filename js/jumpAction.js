import {
  JUMP_SPEED,
  WALL_JUMP_CONTACT_THRESHOLD,
  WALL_JUMP_COOLDOWN_SEC,
  WALL_JUMP_ENABLED,
  WALL_JUMP_HORIZONTAL_SPEED,
  WALL_JUMP_VERTICAL_MULT,
} from "./config.js";
import { isLiquidFormActive } from "./potions.js";
import { game, keys, move } from "./state.js";

/** Shared Space / mobile jump (ground, air, wall). */
export function tryApplyJumpAction(nowSec) {
  if (isLiquidFormActive(nowSec)) return;
  if (move.onGround) {
    move.sprintJumpCarry = keys.sprint;
    move.jumpsSinceLand = 1;
    move.vy = JUMP_SPEED;
    move.onGround = false;
  } else if (move.airJumpsRemaining > 0) {
    move.jumpsSinceLand += 1;
    move.vy = JUMP_SPEED;
    move.airJumpsRemaining -= 1;
  } else if (
    WALL_JUMP_ENABLED &&
    move.wallPushStr >= WALL_JUMP_CONTACT_THRESHOLD &&
    nowSec >= game.playerWallJumpReadyAt
  ) {
    move.sprintJumpCarry = keys.sprint;
    move.jumpsSinceLand += 1;
    move.vy = JUMP_SPEED * WALL_JUMP_VERTICAL_MULT;
    move.knockX += move.wallPushX * WALL_JUMP_HORIZONTAL_SPEED;
    move.knockZ += move.wallPushZ * WALL_JUMP_HORIZONTAL_SPEED;
    game.playerWallJumpReadyAt = nowSec + WALL_JUMP_COOLDOWN_SEC;
  }
}
