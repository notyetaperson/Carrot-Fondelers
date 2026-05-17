import {
  BGM_REACTIVE_ANALYSER_SMOOTHING,
  BGM_REACTIVE_SAT_ENABLED,
  BGM_REACTIVE_SAT_MAX,
  BGM_REACTIVE_SAT_MIN,
  BGM_REACTIVE_VISUAL_SMOOTH,
  BGM_TRACKS,
  BGM_VOLUME,
} from "./config.js";
import { game } from "./state.js";

const BGM_MUTED_STORAGE_KEY = "carrotFondelers_bgmMuted";

/** @type {HTMLAudioElement | null} */
let bgmAudio = null;
/** User turned off music in pause menu — do not autoplay or resume after pause. */
let bgmUserMuted = false;
/** @type {AudioContext | null} */
let bgmAudioContext = null;
/** @type {AnalyserNode | null} */
let bgmAnalyser = null;
/** @type {Uint8Array | null} */
let bgmFreqData = null;
/** @type {Uint8Array | null} */
let bgmTimeData = null;
let bgmAnalyserConnected = false;
/** Smoothed 0–1 “energy” driving saturation. */
let bgmSatSmoothed = 1;

/**
 * @template T
 * @param {T[]} arr
 */
function pickRandom(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

export function loadBgmMutePreference() {
  try {
    return localStorage.getItem(BGM_MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveBgmMutePreference(muted) {
  try {
    localStorage.setItem(BGM_MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Pause-menu “music off” — persists in localStorage.
 * @param {boolean} muted
 */
export function setBgmUserMuted(muted) {
  bgmUserMuted = muted;
  saveBgmMutePreference(muted);
  if (!bgmAudio) return;
  if (muted) {
    bgmAudio.pause();
  } else {
    bgmAudio.volume = BGM_VOLUME;
    if (!game.paused) void bgmAudio.play().catch(() => {});
  }
}

function tryConnectBgmAnalyser() {
  if (!BGM_REACTIVE_SAT_ENABLED || bgmAnalyserConnected || !bgmAudio) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    bgmAudioContext = new AC();
    const src = bgmAudioContext.createMediaElementSource(bgmAudio);
    bgmAnalyser = bgmAudioContext.createAnalyser();
    bgmAnalyser.fftSize = 1024;
    bgmAnalyser.smoothingTimeConstant = BGM_REACTIVE_ANALYSER_SMOOTHING;
    src.connect(bgmAnalyser);
    bgmAnalyser.connect(bgmAudioContext.destination);
    bgmFreqData = new Uint8Array(bgmAnalyser.frequencyBinCount);
    bgmTimeData = new Uint8Array(bgmAnalyser.fftSize);
    bgmAnalyserConnected = true;
  } catch (err) {
    console.warn("BGM reactive saturation disabled:", err);
    bgmAudioContext = null;
    bgmAnalyser = null;
  }
}

function resumeBgmAudioContext() {
  if (bgmAudioContext?.state === "suspended") {
    void bgmAudioContext.resume().catch(() => {});
  }
}

/**
 * @param {HTMLCanvasElement | null} canvas
 * @param {number} dt
 */
export function updateBgmReactiveSaturation(canvas, dt) {
  if (!BGM_REACTIVE_SAT_ENABLED || !canvas) {
    return;
  }
  if (!bgmAnalyser || !bgmFreqData || !bgmTimeData) {
    canvas.style.filter = "";
    return;
  }

  const playing = bgmAudio && !bgmAudio.paused && bgmAudioContext?.state === "running";
  let energy = 0;

  if (playing) {
    bgmAnalyser.getByteFrequencyData(bgmFreqData);
    bgmAnalyser.getByteTimeDomainData(bgmTimeData);

    const n = bgmFreqData.length;
    const bassEnd = Math.max(8, Math.floor(n * 0.08));
    let bass = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += bgmFreqData[i];
      if (i < bassEnd) bass += bgmFreqData[i];
    }
    const bassN = bass / (bassEnd * 255 + 1e-6);
    const totalN = total / (n * 255 + 1e-6);

    let peak = 0;
    for (let i = 0; i < bgmTimeData.length; i++) {
      const v = Math.abs((bgmTimeData[i] - 128) / 128);
      if (v > peak) peak = v;
    }

    energy = Math.min(
      1,
      bassN * 1.15 + totalN * 0.55 + Math.pow(peak, 0.85) * 0.65,
    );
  } else {
    energy = 0;
  }

  const targetSat =
    BGM_REACTIVE_SAT_MIN +
    energy * (BGM_REACTIVE_SAT_MAX - BGM_REACTIVE_SAT_MIN);
  const k = 1 - Math.exp(-BGM_REACTIVE_VISUAL_SMOOTH * Math.max(0, dt));
  bgmSatSmoothed += (targetSat - bgmSatSmoothed) * k;

  if (Math.abs(bgmSatSmoothed - 1) < 0.02 && energy < 0.04) {
    canvas.style.filter = "";
  } else {
    canvas.style.filter = `saturate(${bgmSatSmoothed.toFixed(3)})`;
  }
}

/**
 * Create looping BGM from a random `BGM_TRACKS` entry. Call once after load.
 * Browsers may block autoplay until a user gesture; we retry on first pointerdown.
 */
export function initBgm() {
  if (bgmAudio || !BGM_TRACKS.length) return;

  bgmUserMuted = loadBgmMutePreference();

  const url = pickRandom(BGM_TRACKS);
  const a = new Audio(url);
  a.loop = true;
  a.volume = BGM_VOLUME;
  bgmAudio = a;

  const tryPlay = () => {
    if (bgmUserMuted) return;
    a.play().catch(() => {});
  };

  a.addEventListener("canplay", tryPlay, { once: true });
  tryPlay();

  const unlock = () => {
    if (!bgmUserMuted) tryPlay();
    tryConnectBgmAnalyser();
    resumeBgmAudioContext();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });

  a.addEventListener("playing", () => {
    tryConnectBgmAnalyser();
    resumeBgmAudioContext();
  });
}

/**
 * Pause / resume with the game pause menu.
 * @param {boolean} paused
 */
export function setBgmPaused(paused) {
  if (!bgmAudio) return;
  if (paused) bgmAudio.pause();
  else if (!bgmUserMuted) bgmAudio.play().catch(() => {});
}
