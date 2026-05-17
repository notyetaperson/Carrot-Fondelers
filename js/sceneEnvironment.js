import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SCENE_IBL_BLUR, SCENE_IBL_ENABLED } from "./config.js";

/**
 * PMREM from `RoomEnvironment` → `scene.environment` for specular / diffuse image-based lighting on PBR materials.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 */
export function attachSceneEnvironment(renderer, scene) {
  if (!SCENE_IBL_ENABLED) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const { texture } = pmrem.fromScene(room, SCENE_IBL_BLUR);
  scene.environment = texture;
  room.dispose();
  pmrem.dispose();
}
