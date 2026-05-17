import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  POSTFX_BLOOM_RADIUS,
  POSTFX_BLOOM_STRENGTH,
  POSTFX_BLOOM_THRESHOLD,
  RENDER_HEIGHT,
  RENDER_WIDTH,
} from "./config.js";
import {
  applyGradePreset,
  loadGradePresetIndex,
} from "./postfxGradePresets.js";

/**
 * Ghibli-inspired color grading pass:
 * - soft posterization
 * - warm/cool split tint
 * - subtle vignette
 */
const GHIBLI_GRADE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GHIBLI_GRADE_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime;
uniform float uBands;
uniform float uPosterizeMix;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uToneEdge0;
uniform float uToneEdge1;
uniform float uGamma;
uniform float uVignetteMin;
uniform float uVignetteK;
uniform float uBreath;
varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(tDiffuse, uv).rgb;

  vec3 poster = floor(col * uBands) / uBands;
  col = mix(col, poster, clamp(uPosterizeMix, 0.0, 1.0));

  float y = luma(col);
  col *= mix(uCool, uWarm, smoothstep(uToneEdge0, uToneEdge1, y));

  col = pow(max(col, vec3(0.0)), vec3(uGamma));

  vec2 centered = uv - 0.5;
  float vig = smoothstep(0.95, 0.2, dot(centered, centered) * uVignetteK);
  col *= mix(uVignetteMin, 1.0, vig);

  col *= (1.0 - uBreath) + uBreath * sin(uTime * 0.35);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 */
export function createPostFX(renderer, scene, camera) {
  const gradePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(RENDER_WIDTH, RENDER_HEIGHT) },
      uTime: { value: 0 },
      uBands: { value: 6 },
      uPosterizeMix: { value: 1 },
      uWarm: { value: new THREE.Vector3(1.06, 1.0, 0.92) },
      uCool: { value: new THREE.Vector3(0.92, 0.98, 1.05) },
      uToneEdge0: { value: 0.24 },
      uToneEdge1: { value: 0.76 },
      uGamma: { value: 0.92 },
      uVignetteMin: { value: 0.88 },
      uVignetteK: { value: 1.7 },
      uBreath: { value: 0.005 },
    },
    vertexShader: GHIBLI_GRADE_VERT,
    fragmentShader: GHIBLI_GRADE_FRAG,
  });
  applyGradePreset(gradePass, loadGradePresetIndex());

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(RENDER_WIDTH, RENDER_HEIGHT),
    POSTFX_BLOOM_STRENGTH,
    POSTFX_BLOOM_RADIUS,
    POSTFX_BLOOM_THRESHOLD,
  );
  composer.addPass(bloomPass);
  composer.addPass(gradePass);

  composer.addPass(new OutputPass());

  return { composer, gradePass };
}

/**
 * @param {{ composer: EffectComposer; gradePass: ShaderPass }} fx
 * @param {number} timeSec
 */
export function updatePostFX(fx, timeSec) {
  fx.gradePass.uniforms.uTime.value = timeSec;
}

/**
 * @param {{ composer: EffectComposer; gradePass: ShaderPass }} fx
 * @param {number} width
 * @param {number} height
 * @param {number} dpr
 */
export function resizePostFX(fx, width, height, dpr) {
  fx.composer.setPixelRatio(dpr);
  fx.composer.setSize(width, height);
  fx.gradePass.material.uniforms.uRes.value.set(width, height);
}
