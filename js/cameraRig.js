import * as THREE from "three";
import {
  CAM_FOV_BASE,
  CAM_FOV_SMOOTH,
  CAM_FOV_SPRINT,
  CAM_RIG,
} from "./config.js";
import { camOrbit, game, keys, move } from "./state.js";

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

/**
 * @param {number} dt
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Group} player
 */
export function updateCamera(dt, camera, player) {
  const yaw = camOrbit.yaw;
  const c = Math.cos(camOrbit.pitch);
  const h = CAM_RIG.distance * c;
  const yOff = CAM_RIG.height + CAM_RIG.distance * Math.sin(camOrbit.pitch);
  const target = player.position;
  const desired = new THREE.Vector3(
    target.x - Math.sin(yaw) * h,
    target.y + yOff,
    target.z - Math.cos(yaw) * h,
  );
  if (!game.cameraSnapped) {
    camPos.copy(desired);
    game.cameraSnapped = true;
  } else {
    camPos.lerp(desired, 1 - Math.exp(-CAM_RIG.smooth * dt));
  }
  camera.position.copy(camPos);
  camLook.set(target.x, target.y + CAM_RIG.lookHeight, target.z);
  camera.lookAt(camLook);

  const moving = (keys.forward || keys.back) && move.onGround;
  const sprinting = moving && keys.sprint;
  const targetFov = sprinting ? CAM_FOV_SPRINT : CAM_FOV_BASE;
  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    targetFov,
    1 - Math.exp(-CAM_FOV_SMOOTH * dt),
  );
  camera.updateProjectionMatrix();
}
