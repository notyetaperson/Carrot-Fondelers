import * as THREE from "three";
import {
  ARENA_WALL_THICKNESS,
  LEVEL_INNER_MARGIN,
  PLAYER_COLLISION_RADIUS,
} from "./config.js";
import { upgradeGltfScene } from "./materialUpgrade.js";
import { getSupportFeetY } from "./levelCollision.js";

/**
 * Dispose mesh GPU resources under `root` (safe for shared materials via Set).
 * @param {THREE.Object3D} root
 */
export function disposeObject3D(root) {
  /** @type {Set<import("three").Material>} */
  const mats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) {
        for (const x of m) if (x) mats.add(x);
      } else if (m) {
        mats.add(m);
      }
    }
  });
  for (const m of mats) m.dispose();
}

/**
 * Deck height for spawn / physics. BBox `min.y` often sits under decorative geometry below the walkable floor.
 * @param {THREE.Object3D} root
 * @param {THREE.Box3} box
 */
export function estimateWalkableFloorY(root, box) {
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  if (meshes.length === 0) return box.min.y;

  const spanY = Math.max(box.max.y - box.min.y, 0.01);
  const startY = box.max.y - Math.min(1.2, spanY * 0.08);
  const origin = new THREE.Vector3(cx, startY, cz);
  const ray = new THREE.Raycaster(
    origin,
    new THREE.Vector3(0, -1, 0),
    0,
    spanY + 200,
  );
  const hits = ray.intersectObjects(meshes, false);
  if (hits.length > 0) {
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0].point.y;
  }

  return box.min.y + Math.min(spanY * 0.22, 18);
}

/**
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {THREE.Scene} scene
 * @param {string} url
 */
export function loadArena(loader, scene, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.frustumCulled = true;
        root.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = true;
            o.frustumCulled = true;
            const mats = Array.isArray(o.material)
              ? o.material
              : [o.material];
            for (const m of mats) {
              if (!m) continue;
              m.side = THREE.DoubleSide;
              m.needsUpdate = true;
            }
          }
        });
        upgradeGltfScene(root);
        scene.add(root);
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const floorY = estimateWalkableFloorY(root, box);
        resolve({ root, box, floorY });
      },
      undefined,
      reject,
    );
  });
}

/**
 * Opaque shells just outside the arena AABB so you can’t walk through gaps.
 * @param {THREE.Scene} scene
 * @param {THREE.Box3} box
 * @returns {THREE.Group} group to remove when swapping levels
 */
export function createBoundaryWalls(scene, box) {
  const group = new THREE.Group();
  group.name = "BoundaryWalls";

  const t = ARENA_WALL_THICKNESS;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x353542,
    roughness: 0.88,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });

  const minX = box.min.x;
  const maxX = box.max.x;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const floorY = box.min.y;
  const topY = box.max.y;
  const h = Math.max(topY - floorY, 5) + 4;
  const midY = floorY + h / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;

  function addWall(px, py, pz, sx, sy, sz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  addWall((minX + maxX) / 2, midY, maxZ + t / 2, w + t * 2, h, t);
  addWall((minX + maxX) / 2, midY, minZ - t / 2, w + t * 2, h, t);
  addWall(maxX + t / 2, midY, (minZ + maxZ) / 2, t, h, d + t * 2);
  addWall(minX - t / 2, midY, (minZ + maxZ) / 2, t, h, d + t * 2);

  scene.add(group);
  return group;
}

/**
 * @param {THREE.Group} player
 * @param {THREE.Box3} box
 * @param {number} floorY fallback world Y when mesh rays miss
 * @param {number} yOffset added above detected ground (feet clearance)
 * @param {THREE.Mesh[] | undefined} collisionMeshes level GLB meshes; if set, spawn on mesh tops
 * @param {{ u?: number, v?: number }} [spawnFrac] optional XZ offset from center as fraction of half-extents (Crystal).
 */
export function spawnPlayerInArena(
  player,
  box,
  floorY,
  yOffset,
  collisionMeshes,
  spawnFrac,
) {
  const halfW = (box.max.x - box.min.x) * 0.5;
  const halfD = (box.max.z - box.min.z) * 0.5;
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  const u = spawnFrac?.u ?? 0;
  const v = spawnFrac?.v ?? 0;
  const m = LEVEL_INNER_MARGIN;
  const cx = THREE.MathUtils.clamp(
    centerX + u * halfW,
    box.min.x + m,
    box.max.x - m,
  );
  const cz = THREE.MathUtils.clamp(
    centerZ + v * halfD,
    box.min.z + m,
    box.max.z - m,
  );
  let feetY = floorY;
  if (collisionMeshes?.length) {
    const probeFeet = floorY + yOffset;
    const s = getSupportFeetY(
      cx,
      probeFeet,
      cz,
      collisionMeshes,
      box,
      PLAYER_COLLISION_RADIUS,
    );
    if (s != null) feetY = s;
  }
  player.position.set(cx, feetY + yOffset, cz);
}
