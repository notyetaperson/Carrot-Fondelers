import * as THREE from "three";
import { SKYBOX_FIT_TARGET, SKYBOX_WORLD_SCALE_MULT } from "./config.js";

/** Extra slack so the sky shell fully encloses the level AABB. */
const SKYBOX_LEVEL_MARGIN = 1.48;

/**
 * Scale + center the skybox on the level so it stays behind geometry on small and huge maps.
 * @param {THREE.Object3D | null | undefined} root
 * @param {THREE.Box3 | null | undefined} box
 * @param {THREE.PerspectiveCamera | undefined} camera widen far plane if needed
 */
export function fitSkyboxToLevelBounds(root, box, camera) {
  if (!root?.userData?.skyboxNormScale || !box) return;
  const size = box.getSize(new THREE.Vector3());
  const levelMax = Math.max(size.x, size.y, size.z, 1);
  const mult =
    (levelMax * SKYBOX_LEVEL_MARGIN) / SKYBOX_FIT_TARGET;
  root.scale.setScalar(
    root.userData.skyboxNormScale * mult * SKYBOX_WORLD_SCALE_MULT,
  );
  box.getCenter(root.position);
  root.updateMatrixWorld(true);

  if (camera?.isPerspectiveCamera) {
    const needFar =
      levelMax * SKYBOX_LEVEL_MARGIN * 2.5 * SKYBOX_WORLD_SCALE_MULT;
    if (camera.far < needFar) {
      camera.far = needFar;
      camera.updateProjectionMatrix();
    }
  }
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {string} url
 */
export function loadSkybox(loader, scene, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.name = "Skybox";
        root.renderOrder = -1;
        root.frustumCulled = false;
        root.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
            o.frustumCulled = false;
            const mats = Array.isArray(o.material)
              ? o.material
              : [o.material];
            for (const m of mats) {
              if (!m) continue;
              m.depthWrite = false;
              m.depthTest = true;
              m.side = THREE.DoubleSide;
              m.fog = false;
              if ("envMapIntensity" in m && typeof m.envMapIntensity === "number") {
                m.envMapIntensity = 0;
              }
              m.needsUpdate = true;
            }
          }
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const s = SKYBOX_FIT_TARGET / maxDim;
        root.scale.setScalar(s);
        root.userData.skyboxNormScale = s;
        root.updateMatrixWorld(true);
        const center = new THREE.Box3()
          .setFromObject(root)
          .getCenter(new THREE.Vector3());
        root.position.sub(center);
        scene.add(root);
        resolve(root);
      },
      undefined,
      reject,
    );
  });
}
