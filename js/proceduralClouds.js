import * as THREE from "three";

const CLOUD_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CLOUD_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uCloudLight;
uniform vec3 uCloudShadow;
uniform float uCoverage;
uniform float uScale;
varying vec3 vWorldPos;
varying vec3 vNormalW;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = p * 2.03 + vec2(19.1, -13.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vWorldPos.xz * uScale;
  p += vec2(uTime * 0.006, uTime * 0.0025);
  float n = fbm(p);
  float n2 = fbm(p * 1.9 + vec2(8.2, -5.4));
  float cloud = mix(n, n2, 0.35);

  float edge = smoothstep(uCoverage - 0.08, uCoverage + 0.09, cloud);
  if (edge < 0.01) discard;

  float sunAmt = clamp(dot(normalize(vNormalW), normalize(uSunDir)), 0.0, 1.0);
  vec3 cloudCol = mix(uCloudShadow, uCloudLight, 0.25 + 0.75 * sunAmt);

  float alpha = edge * 0.7;
  gl_FragColor = vec4(cloudCol, alpha);
}
`;

/**
 * WebGL-friendly procedural cloud layer inspired by procedural-clouds-threejs fallback style.
 * @param {THREE.Scene} scene
 */
export function createProceduralCloudLayer(scene) {
  const geo = new THREE.SphereGeometry(720, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.55, 0.8, 0.25).normalize() },
      uCloudLight: { value: new THREE.Color(0xfafcff) },
      uCloudShadow: { value: new THREE.Color(0xb7c4de) },
      uCoverage: { value: 0.56 },
      uScale: { value: 0.0019 },
    },
    vertexShader: CLOUD_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ProceduralCloudLayer";
  mesh.frustumCulled = false;
  mesh.renderOrder = -0.5;
  scene.add(mesh);

  return { mesh, material: mat };
}

/**
 * @param {{ mesh: THREE.Mesh, material: THREE.ShaderMaterial }} clouds
 * @param {THREE.Object3D} followTarget
 * @param {number} timeSec
 */
export function updateProceduralCloudLayer(clouds, followTarget, timeSec) {
  clouds.mesh.position.copy(followTarget.position);
  clouds.material.uniforms.uTime.value = timeSec;
}

