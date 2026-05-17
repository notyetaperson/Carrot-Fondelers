/**
 * Pause-menu presets for the full-screen grade pass (`postfx.js`).
 * @typedef {{
 *   id: string,
 *   label: string,
 *   bands: number,
 *   posterizeMix: number,
 *   warm: [number, number, number],
 *   cool: [number, number, number],
 *   toneEdge0: number,
 *   toneEdge1: number,
 *   gamma: number,
 *   vignetteMin: number,
 *   vignetteK: number,
 *   breath: number,
 * }} PostfxGradePreset
 */

const STORAGE_KEY = "carrotFondelers_postfxGradePreset";

/** @type {PostfxGradePreset[]} */
export const POSTFX_GRADE_PRESETS = [
  {
    id: "studio",
    label: "Studio (default)",
    bands: 6,
    posterizeMix: 1,
    warm: [1.06, 1.0, 0.92],
    cool: [0.92, 0.98, 1.05],
    toneEdge0: 0.24,
    toneEdge1: 0.76,
    gamma: 0.92,
    vignetteMin: 0.88,
    vignetteK: 1.7,
    breath: 0.005,
  },
  {
    id: "noon",
    label: "Noon punch",
    bands: 8,
    posterizeMix: 0.45,
    warm: [1.02, 1.0, 0.96],
    cool: [0.94, 0.97, 1.02],
    toneEdge0: 0.2,
    toneEdge1: 0.82,
    gamma: 0.88,
    vignetteMin: 0.92,
    vignetteK: 1.35,
    breath: 0.002,
  },
  {
    id: "twilight",
    label: "Twilight violet",
    bands: 5,
    posterizeMix: 0.95,
    warm: [1.05, 0.95, 1.08],
    cool: [0.78, 0.82, 1.12],
    toneEdge0: 0.18,
    toneEdge1: 0.72,
    gamma: 0.94,
    vignetteMin: 0.78,
    vignetteK: 2.1,
    breath: 0.008,
  },
  {
    id: "ink",
    label: "Ink wash",
    bands: 4,
    posterizeMix: 1,
    warm: [0.95, 0.98, 1.02],
    cool: [0.85, 0.9, 0.95],
    toneEdge0: 0.3,
    toneEdge1: 0.65,
    gamma: 0.98,
    vignetteMin: 0.82,
    vignetteK: 1.9,
    breath: 0.003,
  },
  {
    id: "carrot",
    label: "Carrot gold",
    bands: 7,
    posterizeMix: 0.85,
    warm: [1.12, 0.98, 0.88],
    cool: [0.96, 0.94, 0.9],
    toneEdge0: 0.22,
    toneEdge1: 0.78,
    gamma: 0.9,
    vignetteMin: 0.9,
    vignetteK: 1.5,
    breath: 0.006,
  },
  {
    id: "crystal",
    label: "Crystal chill",
    bands: 9,
    posterizeMix: 0.55,
    warm: [0.98, 1.02, 1.06],
    cool: [0.88, 0.95, 1.1],
    toneEdge0: 0.28,
    toneEdge1: 0.74,
    gamma: 0.93,
    vignetteMin: 0.9,
    vignetteK: 1.45,
    breath: 0.004,
  },
  {
    id: "vintage",
    label: "Vintage print",
    bands: 6,
    posterizeMix: 0.75,
    warm: [1.08, 1.02, 0.92],
    cool: [0.9, 0.88, 0.82],
    toneEdge0: 0.26,
    toneEdge1: 0.7,
    gamma: 0.96,
    vignetteMin: 0.84,
    vignetteK: 1.85,
    breath: 0.002,
  },
  {
    id: "arcade",
    label: "Neon arcade",
    bands: 10,
    posterizeMix: 0.35,
    warm: [1.04, 0.96, 1.06],
    cool: [0.9, 0.94, 1.08],
    toneEdge0: 0.15,
    toneEdge1: 0.85,
    gamma: 0.82,
    vignetteMin: 0.86,
    vignetteK: 1.6,
    breath: 0.012,
  },
  {
    id: "pastel",
    label: "Soft pastel",
    bands: 12,
    posterizeMix: 0.25,
    warm: [1.04, 1.02, 0.98],
    cool: [0.96, 0.98, 1.04],
    toneEdge0: 0.32,
    toneEdge1: 0.68,
    gamma: 0.97,
    vignetteMin: 0.94,
    vignetteK: 1.25,
    breath: 0.003,
  },
  {
    id: "clean",
    label: "Flat clean",
    bands: 16,
    posterizeMix: 0.08,
    warm: [1.01, 1.0, 0.99],
    cool: [0.99, 1.0, 1.01],
    toneEdge0: 0.35,
    toneEdge1: 0.65,
    gamma: 1.0,
    vignetteMin: 0.97,
    vignetteK: 1.1,
    breath: 0.001,
  },
];

/**
 * @returns {number}
 */
export function loadGradePresetIndex() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw == null ? 0 : parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(POSTFX_GRADE_PRESETS.length - 1, n));
  } catch {
    return 0;
  }
}

/**
 * @param {number} index
 */
export function saveGradePresetIndex(index) {
  try {
    const i = Math.max(0, Math.min(POSTFX_GRADE_PRESETS.length - 1, index));
    localStorage.setItem(STORAGE_KEY, String(i));
  } catch {
    /* ignore */
  }
}

/**
 * @param {import("three/addons/postprocessing/ShaderPass.js").ShaderPass} gradePass
 * @param {number} index
 */
export function applyGradePreset(gradePass, index) {
  const u = gradePass?.material?.uniforms;
  if (!u) return;
  const i = Math.max(0, Math.min(POSTFX_GRADE_PRESETS.length - 1, index));
  const p = POSTFX_GRADE_PRESETS[i];
  u.uBands.value = p.bands;
  u.uPosterizeMix.value = p.posterizeMix;
  u.uWarm.value.set(p.warm[0], p.warm[1], p.warm[2]);
  u.uCool.value.set(p.cool[0], p.cool[1], p.cool[2]);
  u.uToneEdge0.value = p.toneEdge0;
  u.uToneEdge1.value = p.toneEdge1;
  u.uGamma.value = p.gamma;
  u.uVignetteMin.value = p.vignetteMin;
  u.uVignetteK.value = p.vignetteK;
  u.uBreath.value = p.breath;
}

/**
 * @param {import("three/addons/postprocessing/ShaderPass.js").ShaderPass | undefined} gradePass
 */
export function initPostfxGradePauseMenu(gradePass) {
  const wrap = document.getElementById("pause-postfx-grade-wrap");
  const hint = document.getElementById("pause-postfx-grade-hint");
  const sel = document.getElementById("pause-postfx-grade");

  if (!gradePass) {
    wrap?.setAttribute("hidden", "");
    hint?.setAttribute("hidden", "");
    return;
  }

  wrap?.removeAttribute("hidden");
  hint?.removeAttribute("hidden");

  if (!(sel instanceof HTMLSelectElement)) return;

  sel.replaceChildren();
  for (let i = 0; i < POSTFX_GRADE_PRESETS.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = POSTFX_GRADE_PRESETS[i].label;
    sel.appendChild(opt);
  }

  const idx = loadGradePresetIndex();
  sel.value = String(idx);
  applyGradePreset(gradePass, idx);

  sel.addEventListener("change", () => {
    const next = parseInt(sel.value, 10);
    if (!Number.isFinite(next)) return;
    applyGradePreset(gradePass, next);
    saveGradePresetIndex(next);
  });
}
