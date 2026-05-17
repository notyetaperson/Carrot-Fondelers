import * as THREE from "three";
import {
  LEVEL_VISUAL_DISABLE_FOG,
  LEVEL_VISUAL_DROP_MESH_MAX_EXTENT_M,
  LEVEL_VISUAL_FORCE_BASIC_MATERIAL,
  LEVEL_VISUAL_PERF_STRIP_ENABLED,
} from "./config.js";

const _box = new THREE.Box3();
const _sz = new THREE.Vector3();

/**
 * @param {THREE.Material | null} m
 * @returns {THREE.MeshBasicMaterial | null}
 */
export function downgradeMaterialToBasic(m) {
  if (!m) return null;
  if (m.isMeshBasicMaterial) return m;

  const side = m.side != null ? m.side : THREE.FrontSide;
  const nm = new THREE.MeshBasicMaterial({
    fog: true,
    side,
    transparent: !!m.transparent,
    opacity: m.opacity ?? 1,
    depthWrite: m.depthWrite !== false,
    toneMapped: m.toneMapped !== false,
  });
  if ("vertexColors" in m && m.vertexColors) nm.vertexColors = true;
  if (m.map) nm.map = m.map;
  else if ("emissiveMap" in m && m.emissiveMap) nm.map = m.emissiveMap;
  if (!nm.map && "color" in m && m.color) nm.color.copy(/** @type {THREE.Color} */ (m.color));
  else if (!nm.map) nm.color.setHex(0x8f97a3);
  if ("alphaMap" in m && m.alphaMap) nm.alphaMap = m.alphaMap;

  nm.needsUpdate = true;
  m.dispose();
  return nm;
}

/**
 * Swap all mesh materials under `root` (including `SkinnedMesh`) to unlit basics — one pass for
 * characters, pickups, and props. Skips `InstancedMesh` (different shader path).
 * @param {THREE.Object3D} root
 */
export function downgradeAllMeshMaterialsToBasic(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) return;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => downgradeMaterialToBasic(m));
    o.material = next.length === 1 ? next[0] : next;
  });
}

/**
 * After unlit flattening: turn off mipmaps + trilinear so the GPU samples textures more cheaply.
 * @param {THREE.Object3D} root
 */
export function coarsenAllMeshTextures(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) return;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const rec = /** @type {Record<string, unknown>} */ (m);
      for (const key of Object.keys(rec)) {
        const v = rec[key];
        if (v && /** @type {THREE.Texture} */ (v).isTexture) {
          const tex = /** @type {THREE.Texture} */ (v);
          tex.generateMipmaps = false;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = 1;
          tex.needsUpdate = true;
        }
      }
    }
  });
}

/**
 * Brutal draw-cost cuts on static level geometry: optional culling of tiny meshes (only when a merged
 * collision proxy already baked their triangles) and unlit `MeshBasicMaterial` swaps.
 *
 * @param {THREE.Object3D} root Level root from `loadArena`.
 * @param {THREE.Scene | null} scene Pass to strip fog when configured.
 * @param {boolean} hasCollisionProxy When true, tiny meshes may be removed from the graph only.
 */
export function applyLevelVisualPerformanceStrip(root, scene, hasCollisionProxy) {
  if (!LEVEL_VISUAL_PERF_STRIP_ENABLED) return;

  if (LEVEL_VISUAL_DISABLE_FOG && scene) {
    scene.fog = null;
  }

  root.updateMatrixWorld(true);
  /** @type {THREE.Mesh[]} */
  const toRemove = [];

  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;

    if (
      hasCollisionProxy &&
      LEVEL_VISUAL_DROP_MESH_MAX_EXTENT_M > 0
    ) {
      _box.setFromObject(o);
      _box.getSize(_sz);
      const maxDim = Math.max(_sz.x, _sz.y, _sz.z);
      if (maxDim < LEVEL_VISUAL_DROP_MESH_MAX_EXTENT_M) {
        toRemove.push(o);
        return;
      }
    }

    if (!LEVEL_VISUAL_FORCE_BASIC_MATERIAL) return;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => downgradeMaterialToBasic(m));
    o.material = next.length === 1 ? next[0] : next;
  });

  if (!hasCollisionProxy || toRemove.length === 0) return;

  for (const mesh of toRemove) {
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m?.dispose();
  }
}
