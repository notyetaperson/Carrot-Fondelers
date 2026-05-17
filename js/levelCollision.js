import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import {
  LEVEL_CEILING_PROBE_Y,
  LEVEL_COLLISION_RAY_START_ABOVE_FEET,
  LEVEL_WALL_PROBE_Y,
  LEVEL_WALL_RESOLVE_ITERS,
  LEVEL_COLLISION_BVH,
  PLAYER_COLLISION_RADIUS,
} from "./config.js";

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const dir = new THREE.Vector3();
const normal = new THREE.Vector3();

const _collBox = new THREE.Box3();
const _collSize = new THREE.Vector3();

/**
 * @param {THREE.Object3D} root
 * @param {{ minWorldExtent?: number }} [opts] If set, skip meshes smaller than this (world units).
 * @returns {THREE.Mesh[]}
 */
export function collectCollisionMeshes(root, opts = {}) {
  const minExt = opts.minWorldExtent;
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (minExt != null && minExt > 0) {
      _collBox.setFromObject(o);
      _collBox.getSize(_collSize);
      const maxDim = Math.max(_collSize.x, _collSize.y, _collSize.z);
      if (maxDim < minExt) return;
    }
    meshes.push(o);
  });
  return meshes;
}

/**
 * One world-space mesh for raycasts (avoids testing every level triangle batch per query).
 * @param {THREE.Mesh[]} meshes
 * @returns {THREE.Mesh | null}
 */
export function buildLevelCollisionProxy(meshes) {
  /** @type {THREE.BufferGeometry[]} */
  const parts = [];
  for (const mesh of meshes) {
    if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry) continue;
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    parts.push(g);
  }
  if (!parts.length) return null;
  let merged;
  try {
    merged = mergeGeometries(parts, false);
  } catch {
    for (const g of parts) g.dispose();
    return null;
  }
  for (const g of parts) g.dispose();
  const m = new THREE.Mesh(merged);
  m.matrixAutoUpdate = false;
  m.visible = false;
  return m;
}

/**
 * @param {{ collisionProxy: THREE.Mesh | null }} game
 */
export function disposeLevelCollisionProxy(game) {
  if (game.collisionProxy) {
    const geom = game.collisionProxy.geometry;
    if (geom.boundsTree) geom.boundsTree = null;
    geom.dispose();
    game.collisionProxy = null;
  }
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} rayOriginY
 * @param {THREE.Mesh[]} meshes
 * @param {number} far
 * @returns {number | null}
 */
export function raycastGroundY(x, z, rayOriginY, meshes, far) {
  if (!meshes.length) return null;
  origin.set(x, rayOriginY, z);
  dir.set(0, -1, 0);
  raycaster.set(origin, dir);
  raycaster.near = 0;
  raycaster.far = far;
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.distance - b.distance);
  return hits[0].point.y;
}

/**
 * Highest ground under the foot footprint (max of samples so small props register).
 * @param {number} px
 * @param {number} feetY
 * @param {number} pz
 * @param {THREE.Mesh[]} meshes
 * @param {THREE.Box3} bounds
 * @param {number} [radius]
 */
export function getSupportFeetY(px, feetY, pz, meshes, bounds, radius) {
  if (!meshes.length) return null;
  const fromY = feetY + LEVEL_COLLISION_RAY_START_ABOVE_FEET;
  const maxDown = Math.max(feetY - bounds.min.y + 10, 80);
  const r = radius ?? PLAYER_COLLISION_RADIUS;
  const spread = Math.min(r * 1.2, 0.5);
  const samples = [
    [0, 0],
    [spread, 0],
    [-spread, 0],
    [0, spread],
    [0, -spread],
  ];
  let best = -Infinity;
  let any = false;
  for (const [ox, oz] of samples) {
    const y = raycastGroundY(px + ox, pz + oz, fromY, meshes, maxDown);
    if (y != null && y > best) {
      best = y;
      any = true;
    }
  }
  return any ? best : null;
}

/**
 * Push player XZ out of level triangles (approximate cylinder vs mesh).
 * @param {number} px
 * @param {number} pz
 * @param {number} feetY
 * @param {THREE.Mesh[]} meshes
 * @param {number} [radius]
 */
export function resolveHorizontalCollisions(px, pz, feetY, meshes, radius) {
  if (!meshes.length) return { x: px, z: pz };

  const r = radius ?? PLAYER_COLLISION_RADIUS;
  const cy = feetY + LEVEL_WALL_PROBE_Y;
  const skin = 0.1;
  const castLen = r + skin;

  for (let iter = 0; iter < LEVEL_WALL_RESOLVE_ITERS; iter++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rdx = Math.cos(a);
      const rdz = Math.sin(a);
      origin.set(px + rdx * r * 0.12, cy, pz + rdz * r * 0.12);
      dir.set(rdx, 0, rdz);
      raycaster.set(origin, dir);
      raycaster.near = 0;
      raycaster.far = castLen;
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) continue;
      const hit = hits[0];
      if (hit.distance >= castLen - 1e-4) continue;

      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      normal.y = 0;
      if (normal.lengthSq() < 1e-6) continue;
      normal.normalize();

      const pen = Math.max(0, castLen - hit.distance) * 0.72;
      px -= normal.x * pen;
      pz -= normal.z * pen;
    }
  }

  return { x: px, z: pz };
}

/**
 * @param {number} px
 * @param {number} feetY
 * @param {number} pz
 * @param {THREE.Mesh[]} meshes
 * @param {number} [headProbeY]
 * @param {number} [maxUp]
 * @returns {number | null} world Y of first ceiling above the probe
 */
export function raycastCeilingY(
  px,
  feetY,
  pz,
  meshes,
  headProbeY = LEVEL_CEILING_PROBE_Y,
  maxUp = 16,
) {
  if (!meshes.length) return null;
  origin.set(px, feetY + headProbeY, pz);
  dir.set(0, 1, 0);
  raycaster.set(origin, dir);
  raycaster.near = 0;
  raycaster.far = maxUp;
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.distance - b.distance);
  return hits[0].point.y;
}

/**
 * True if a ray from observer to target is not blocked by level meshes before the target.
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @param {THREE.Mesh[]} meshes
 * @param {number} [skin] Shorten ray end so grazing hits still count as visible (m).
 */
export function hasLineOfSight(
  ox,
  oy,
  oz,
  tx,
  ty,
  tz,
  meshes,
  skin = 0.32,
) {
  if (!meshes.length) return true;
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= skin + 0.02) return true;
  dir.set(dx / dist, dy / dist, dz / dist);
  origin.set(ox, oy, oz);
  raycaster.set(origin, dir);
  raycaster.near = 0.04;
  raycaster.far = dist - skin;
  if (raycaster.far <= raycaster.near) return true;
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length === 0;
}

/**
 * Short outward XZ rays at torso height — deepest penetration picks push-away direction for wall jumps.
 * @param {number} px
 * @param {number} feetY
 * @param {number} pz
 * @param {THREE.Mesh[]} meshes
 * @param {number} [radius]
 * @returns {{ x: number, z: number, mag: number }} `mag` in ~0–1, strength of wall contact.
 */
export function getWallMomentumPushFromLevel(
  px,
  feetY,
  pz,
  meshes,
  radius = PLAYER_COLLISION_RADIUS,
) {
  if (!meshes.length) return { x: 0, z: 0, mag: 0 };
  const r = radius ?? PLAYER_COLLISION_RADIUS;
  const cy = feetY + LEVEL_WALL_PROBE_Y;
  const skin = 0.11;
  const far = r + skin;
  let bestDist = Infinity;
  let pushX = 0;
  let pushZ = 0;

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rdx = Math.cos(a);
    const rdz = Math.sin(a);
    origin.set(px + rdx * r * 0.14, cy, pz + rdz * r * 0.14);
    dir.set(rdx, 0, rdz);
    raycaster.set(origin, dir);
    raycaster.near = 0;
    raycaster.far = far;
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) continue;
    const hit = hits[0];
    if (hit.distance >= far - 1e-3) continue;
    if (hit.distance >= bestDist) continue;
    bestDist = hit.distance;
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    normal.y = 0;
    if (normal.lengthSq() < 1e-6) continue;
    normal.normalize();
    pushX = -normal.x;
    pushZ = -normal.z;
  }

  if (bestDist === Infinity) return { x: 0, z: 0, mag: 0 };
  const len = Math.hypot(pushX, pushZ);
  if (len < 1e-4) return { x: 0, z: 0, mag: 0 };
  const mag = Math.min(1, (far - bestDist) / (skin + 0.04));
  return { x: pushX / len, z: pushZ / len, mag };
}
