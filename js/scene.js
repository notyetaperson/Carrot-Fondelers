import * as THREE from "three";
import {
  CAM_FAR,
  CAM_FOV_BASE,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  RENDERER_ANTIALIAS,
  RENDERER_SHADOWS,
  RENDERER_SHADOW_SOFT,
  RENDERER_SIMPLE_TONE_MAPPING,
  RENDERER_USE_MEDIUMP_PRECISION,
  SCENE_FOG_COLOR,
  SCENE_FOG_DENSITY,
  SHADOW_MAP_SIZE,
} from "./config.js";

/** @type {THREE.WebGLRenderer | null} */
let worldRenderer = null;
/** @type {THREE.DirectionalLight | null} */
let worldSun = null;

/**
 * Toggle real-time shadows (arena only by default — many skinned pigs + shadow maps are costly).
 * @param {boolean} enabled
 */
export function setWorldShadowsEnabled(enabled) {
  if (worldRenderer) worldRenderer.shadowMap.enabled = enabled;
  if (worldSun) worldSun.castShadow = enabled;
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createWorld(canvas) {
  canvas.tabIndex = 0;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: RENDERER_ANTIALIAS,
    alpha: false,
    powerPreference: "high-performance",
    ...(RENDERER_USE_MEDIUMP_PRECISION ? { precision: "mediump" } : {}),
  });
  renderer.setPixelRatio(1);
  /** `false` = do not set canvas inline width/height (CSS fullscreen scales the bitmap). */
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = RENDERER_SHADOWS;
  renderer.shadowMap.type = RENDERER_SHADOW_SOFT
    ? THREE.PCFSoftShadowMap
    : THREE.BasicShadowMap;
  if (RENDERER_SIMPLE_TONE_MAPPING) {
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1;
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5ff);
  scene.fog = new THREE.FogExp2(SCENE_FOG_COLOR, SCENE_FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(
    CAM_FOV_BASE,
    RENDER_WIDTH / RENDER_HEIGHT,
    0.1,
    CAM_FAR,
  );

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3d2f1a, 0.85);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 40, 12);
  sun.castShadow = RENDERER_SHADOWS;
  sun.shadow.mapSize.setScalar(SHADOW_MAP_SIZE);
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.022;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  worldRenderer = renderer;
  worldSun = sun;

  const player = new THREE.Group();
  player.position.set(0, 2, 0);
  scene.add(player);

  return { renderer, scene, camera, canvas, player };
}
