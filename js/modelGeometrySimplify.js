import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import {
  MODEL_MESH_GEOMETRY_SIMPLIFY,
  MODEL_MESH_SIMPLIFY_MAX_COLLAPSES,
  MODEL_MESH_SIMPLIFY_MIN_VERTICES,
  MODEL_MESH_SIMPLIFY_VERTEX_COLLAPSE_FRACTION,
} from "./config.js";

const simplifyModifier = new SimplifyModifier();

/**
 * Progressive mesh reduction on plain `Mesh` only (skips `SkinnedMesh` / `InstancedMesh`).
 * Skips multi-material `geometry.groups` so draw calls stay consistent.
 * @param {import("three").Object3D} root
 */
export function applyMeshGeometrySimplification(root) {
  if (!MODEL_MESH_GEOMETRY_SIMPLIFY) return;

  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
    const g = o.geometry;
    if (!g?.attributes?.position) return;

    const pos = g.attributes.position;
    const vertCount = pos.count;
    if (vertCount < MODEL_MESH_SIMPLIFY_MIN_VERTICES) return;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length > 1 && g.groups?.length) return;

    let collapses = Math.floor(
      vertCount * MODEL_MESH_SIMPLIFY_VERTEX_COLLAPSE_FRACTION,
    );
    collapses = Math.min(collapses, MODEL_MESH_SIMPLIFY_MAX_COLLAPSES);
    if (collapses < 8) return;

    try {
      const newG = simplifyModifier.modify(g, collapses);
      newG.computeBoundingBox();
      newG.computeBoundingSphere();
      g.dispose();
      o.geometry = newG;
    } catch (err) {
      console.warn("applyMeshGeometrySimplification:", err);
    }
  });
}
