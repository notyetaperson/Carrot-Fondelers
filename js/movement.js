import * as THREE from "three";
import {
  FLOOR_Y,
  GRAVITY,
  GROUND_BAND,
  LEVEL_CEILING_PROBE_Y,
  LEVEL_COLLISION_MAX_STEP_UP,
  LEVEL_INNER_MARGIN,
  PLAYER_COLLISION_RADIUS,
  PLAYER_KNOCKBACK_DECAY,
  PLAYER_PHASE_DASH_COOLDOWN_SEC,
  PLAYER_PHASE_DASH_I_FRAMES_SEC,
  PLAYER_PHASE_DASH_IMPULSE,
  POTION_AFTERBURN_MOVE_MULT,
  POTION_LIQUID_MOVE_SPEED,
  SPRINT_SPEED_MULTIPLIER,
  MID_AIR_JUMP_COUNT,
} from "./config.js";
import {
  getSupportFeetY,
  getWallMomentumPushFromLevel,
  raycastCeilingY,
  resolveHorizontalCollisions,
} from "./levelCollision.js";
import {
  getAirSwimGravityMult,
  isAfterburnActive,
  isLiquidFormActive,
} from "./potions.js";
import { camOrbit, game, keys, move } from "./state.js";

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpMove = new THREE.Vector3();

const FEET_CLEAR = 0.02;

/**
 * @param {number} dt
 * @param {THREE.Group} player
 */
export function updatePlayer(dt, player) {
  if (game.playerDead) {
    move.wallPushX = 0;
    move.wallPushZ = 0;
    move.wallPushStr = 0;
    move.vy += GRAVITY * dt;
    player.position.y += move.vy * dt;
    const lbDead = game.levelBounds;
    if (lbDead) {
      const meshes = game.levelCollisionMeshes;
      const md = LEVEL_INNER_MARGIN;
      let px = THREE.MathUtils.clamp(
        player.position.x,
        lbDead.min.x + md,
        lbDead.max.x - md,
      );
      let pz = THREE.MathUtils.clamp(
        player.position.z,
        lbDead.min.z + md,
        lbDead.max.z - md,
      );
      let py = player.position.y;
      if (meshes.length) {
        const w = resolveHorizontalCollisions(
          px,
          pz,
          py,
          meshes,
          PLAYER_COLLISION_RADIUS,
        );
        px = w.x;
        pz = w.z;
      }
      const deck =
        game.arenaFloorY != null ? game.arenaFloorY : lbDead.min.y;
      const support = meshes.length
        ? getSupportFeetY(px, py, pz, meshes, lbDead, PLAYER_COLLISION_RADIUS)
        : null;
      const snapY =
        support !== null ? support + FEET_CLEAR : deck + FEET_CLEAR;
      if (py < snapY && move.vy <= 0) {
        if (support !== null || py < deck + FEET_CLEAR) {
          py = snapY;
          if (move.vy < 0) move.vy = 0;
        }
      }
      player.position.set(px, py, pz);
    } else if (player.position.y < FLOOR_Y) {
      player.position.y = FLOOR_Y;
      if (move.vy < 0) move.vy = 0;
    }
    return;
  }

  const tLiq = performance.now() * 0.001;
  if (isLiquidFormActive(tLiq)) {
    move.wallPushX = 0;
    move.wallPushZ = 0;
    move.wallPushStr = 0;
    updateLiquidBlobPlayer(dt, player);
    return;
  }

  tmpForward.set(Math.sin(camOrbit.yaw), 0, Math.cos(camOrbit.yaw));
  tmpRight.set(tmpForward.z, 0, -tmpForward.x);

  tmpMove.set(0, 0, 0);
  if (keys.forward) tmpMove.add(tmpForward);
  if (keys.back) tmpMove.sub(tmpForward);
  if (keys.left) tmpMove.add(tmpRight);
  if (keys.right) tmpMove.sub(tmpRight);

  if (tmpMove.lengthSq() > 1e-8) {
    tmpMove.normalize();
    const afterMult = isAfterburnActive(tLiq) ? POTION_AFTERBURN_MOVE_MULT : 1;
    const speed =
      move.speed *
      (keys.sprint ? SPRINT_SPEED_MULTIPLIER : 1) *
      afterMult;
    player.position.addScaledVector(tmpMove, speed * dt);
    move.yaw = Math.atan2(tmpMove.x, tmpMove.z);
  }

  const kbDec = Math.exp(-PLAYER_KNOCKBACK_DECAY * dt);
  move.knockX *= kbDec;
  move.knockZ *= kbDec;
  if (Math.abs(move.knockX) + Math.abs(move.knockZ) > 0.002) {
    player.position.x += move.knockX * dt;
    player.position.z += move.knockZ * dt;
  }

  player.rotation.y = move.yaw + Math.PI + Math.PI / 2;

  const gravMult = getAirSwimGravityMult(performance.now() * 0.001);
  move.vy += GRAVITY * gravMult * dt;
  player.position.y += move.vy * dt;

  const lb = game.levelBounds;
  const m = LEVEL_INNER_MARGIN;
  const meshes = game.levelCollisionMeshes;
  const hasMesh = meshes.length > 0;

  if (lb) {
    player.position.x = THREE.MathUtils.clamp(
      player.position.x,
      lb.min.x + m,
      lb.max.x - m,
    );
    player.position.z = THREE.MathUtils.clamp(
      player.position.z,
      lb.min.z + m,
      lb.max.z - m,
    );

    let px = player.position.x;
    let pz = player.position.z;
    let py = player.position.y;

    if (hasMesh) {
      const w = resolveHorizontalCollisions(
        px,
        pz,
        py,
        meshes,
        PLAYER_COLLISION_RADIUS,
      );
      px = w.x;
      pz = w.z;
    }

    if (hasMesh && move.vy > 0) {
      const ceil = raycastCeilingY(px, py, pz, meshes);
      if (ceil !== null && py + LEVEL_CEILING_PROBE_Y > ceil - 0.14) {
        py = ceil - LEVEL_CEILING_PROBE_Y - 0.14;
        move.vy = Math.min(0, move.vy);
      }
    }

    const deckFallback =
      game.arenaFloorY != null ? game.arenaFloorY : lb.min.y;
    const support = hasMesh
      ? getSupportFeetY(px, py, pz, meshes, lb, PLAYER_COLLISION_RADIUS)
      : null;

    const feetSnapMesh = support !== null ? support + FEET_CLEAR : null;
    const feetSnapFallback = deckFallback + FEET_CLEAR;

    if (move.vy <= 0) {
      if (feetSnapMesh !== null && py < feetSnapMesh) {
        py = feetSnapMesh;
        move.vy = 0;
      } else if (
        feetSnapMesh === null &&
        py < feetSnapFallback
      ) {
        py = feetSnapFallback;
        move.vy = 0;
      } else if (
        hasMesh &&
        move.vy >= -0.4 &&
        support !== null
      ) {
        const step = support + FEET_CLEAR - py;
        if (step > 0.004 && step <= LEVEL_COLLISION_MAX_STEP_UP) {
          py += step;
          move.vy = Math.max(0, move.vy);
        }
      }
    }

    player.position.set(px, py, pz);

    const { x: gx, z: gz } = player.position;
    const insideXZ =
      gx >= lb.min.x + m &&
      gx <= lb.max.x - m &&
      gz >= lb.min.z + m &&
      gz <= lb.max.z - m;
    const refY = support !== null ? support : deckFallback;
    const inFeetBand =
      insideXZ &&
      py >= refY - GROUND_BAND &&
      py <= refY + FEET_CLEAR + GROUND_BAND * 2;
    /**
     * Old check used `abs(vy) < 0.45`, so at jump apex (vy ≈ 0) you could still count as “ground” while
     * feet were in the slack band — Space then took the ground-jump path and never spent `airJumpsRemaining`.
     */
    const fallingIntoFloor = move.vy < -0.12;
    /** `vy <= 0` only — small upward velocity must not read as ground (eats mid-air jumps). */
    const restingOnFloor =
      py <= refY + FEET_CLEAR + 0.07 && move.vy <= 0;
    move.onGround = inFeetBand && (fallingIntoFloor || restingOnFloor);
    if (move.onGround) {
      move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
      move.sprintJumpCarry = false;
      move.jumpsSinceLand = 0;
      game.playerWallJumpReadyAt = 0;
    }
    if (hasMesh) {
      const wc = getWallMomentumPushFromLevel(px, py, pz, meshes);
      if (move.onGround) {
        move.wallPushX = 0;
        move.wallPushZ = 0;
        move.wallPushStr = 0;
      } else {
        move.wallPushX = wc.x;
        move.wallPushZ = wc.z;
        move.wallPushStr = wc.mag;
      }
    } else {
      move.wallPushX = 0;
      move.wallPushZ = 0;
      move.wallPushStr = 0;
    }
  } else {
    if (player.position.y < FLOOR_Y) {
      player.position.y = FLOOR_Y;
      if (move.vy < 0) move.vy = 0;
    }
    const onMainPlane =
      player.position.y >= -GROUND_BAND &&
      player.position.y <= GROUND_BAND;
    const onLowerFloor =
      player.position.y >= FLOOR_Y - GROUND_BAND &&
      player.position.y <= FLOOR_Y + GROUND_BAND;
    move.onGround =
      (onMainPlane || onLowerFloor) &&
      (move.vy < -0.12 ||
        (Math.abs(player.position.y) <= GROUND_BAND * 2 &&
          move.vy <= 0));
    if (move.onGround) {
      move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
      move.sprintJumpCarry = false;
      move.jumpsSinceLand = 0;
      game.playerWallJumpReadyAt = 0;
    }
    move.wallPushX = 0;
    move.wallPushZ = 0;
    move.wallPushStr = 0;
  }
}

/**
 * Liquid form: slide on the deck as an invulnerable blob (no jump / gravity).
 * @param {number} dt
 * @param {THREE.Group} player
 */
function updateLiquidBlobPlayer(dt, player) {
  move.vy = 0;
  tmpForward.set(Math.sin(camOrbit.yaw), 0, Math.cos(camOrbit.yaw));
  tmpRight.set(tmpForward.z, 0, -tmpForward.x);

  tmpMove.set(0, 0, 0);
  if (keys.forward) tmpMove.add(tmpForward);
  if (keys.back) tmpMove.sub(tmpForward);
  if (keys.left) tmpMove.add(tmpRight);
  if (keys.right) tmpMove.sub(tmpRight);

  if (tmpMove.lengthSq() > 1e-8) {
    tmpMove.normalize();
    const speed =
      POTION_LIQUID_MOVE_SPEED * (keys.sprint ? SPRINT_SPEED_MULTIPLIER : 1);
    player.position.addScaledVector(tmpMove, speed * dt);
    move.yaw = Math.atan2(tmpMove.x, tmpMove.z);
  }

  const kbDec = Math.exp(-PLAYER_KNOCKBACK_DECAY * dt);
  move.knockX *= kbDec;
  move.knockZ *= kbDec;
  if (Math.abs(move.knockX) + Math.abs(move.knockZ) > 0.002) {
    player.position.x += move.knockX * dt;
    player.position.z += move.knockZ * dt;
  }

  player.rotation.y = move.yaw + Math.PI + Math.PI / 2;

  const lb = game.levelBounds;
  const m = LEVEL_INNER_MARGIN;
  const meshes = game.levelCollisionMeshes;
  const hasMesh = meshes.length > 0;

  if (lb) {
    player.position.x = THREE.MathUtils.clamp(
      player.position.x,
      lb.min.x + m,
      lb.max.x - m,
    );
    player.position.z = THREE.MathUtils.clamp(
      player.position.z,
      lb.min.z + m,
      lb.max.z - m,
    );

    let px = player.position.x;
    let pz = player.position.z;
    let py = player.position.y;

    if (hasMesh) {
      const w = resolveHorizontalCollisions(
        px,
        pz,
        py,
        meshes,
        PLAYER_COLLISION_RADIUS,
      );
      px = w.x;
      pz = w.z;
    }

    const deckFallback =
      game.arenaFloorY != null ? game.arenaFloorY : lb.min.y;
    const support = hasMesh
      ? getSupportFeetY(px, py, pz, meshes, lb, PLAYER_COLLISION_RADIUS)
      : null;
    const feetY =
      support !== null ? support + FEET_CLEAR : deckFallback + FEET_CLEAR;
    py = feetY;
    player.position.set(px, py, pz);
    move.onGround = true;
    move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
    move.sprintJumpCarry = false;
    move.jumpsSinceLand = 0;
  } else {
    if (player.position.y < FLOOR_Y) player.position.y = FLOOR_Y;
    move.onGround = true;
    move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
    move.sprintJumpCarry = false;
    move.jumpsSinceLand = 0;
  }
}
