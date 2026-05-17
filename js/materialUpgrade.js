import * as THREE from "three";
import {
  MATERIAL_ENV_INTENSITY_MULT,
  MATERIAL_ROUGHNESS_MULT,
  MODEL_MATERIAL_SIMPLIFY,
  MODEL_TEXTURE_COARSEN,
  TEXTURE_ANISOTROPY_CAP,
} from "./config.js";
import {
  coarsenAllMeshTextures,
  downgradeAllMeshMaterialsToBasic,
} from "./levelRenderDowngrade.js";
import { applyMeshGeometrySimplification } from "./modelGeometrySimplify.js";

/** @type {THREE.WebGLRenderer | null} */
let _renderer = null;

/**
 * Call once after `createWorld` so texture anisotropy can use GPU caps.
 * @param {THREE.WebGLRenderer} renderer
 */
export function setMaterialUpgradeRenderer(renderer) {
  _renderer = renderer;
}

const TEX_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "aoMap",
  "alphaMap",
  "lightMap",
  "bumpMap",
  "displacementMap",
];

/**
 * Improve glTF / skinned clones: IBL response, slightly punchier PBR, sharper sampling.
 * When {@link MODEL_MATERIAL_SIMPLIFY} is on, skips PBR and flattens every mesh to unlit basics instead.
 * @param {THREE.Object3D} root
 */
export function upgradeGltfScene(root) {
  applyMeshGeometrySimplification(root);
  if (MODEL_MATERIAL_SIMPLIFY) {
    downgradeAllMeshMaterialsToBasic(root);
    if (MODEL_TEXTURE_COARSEN) coarsenAllMeshTextures(root);
    return;
  }

  const maxA = Math.min(
    TEXTURE_ANISOTROPY_CAP,
    _renderer?.capabilities?.getMaxAnisotropy?.() ?? TEXTURE_ANISOTROPY_CAP,
  );

  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const matRec = /** @type {THREE.Material & Record<string, unknown>} */ (m);
      for (const key of TEX_KEYS) {
        const t = matRec[key];
        if (t && /** @type {THREE.Texture} */ (t).isTexture) {
          const tex = /** @type {THREE.Texture & { userData?: Record<string, unknown> }} */ (t);
          if (!tex.userData._cfAnisoDone) {
            tex.userData._cfAnisoDone = true;
            tex.anisotropy = maxA;
          }
        }
      }
      if (
        m.isMeshPhysicalMaterial === true ||
        m.isMeshStandardMaterial === true
      ) {
        if (m.userData._cfPbrUpgraded) continue;
        m.userData._cfPbrUpgraded = true;
        const base = m.envMapIntensity ?? 1;
        m.envMapIntensity = base * MATERIAL_ENV_INTENSITY_MULT;
        m.roughness = THREE.MathUtils.clamp(
          (m.roughness ?? 0.5) * MATERIAL_ROUGHNESS_MULT,
          0.035,
          1,
        );
        m.needsUpdate = true;
      }
    }
  });
}
