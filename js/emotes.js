import * as THREE from "three";
import { CAM_RIG } from "./config.js";
import { game } from "./state.js";

const STORAGE_KEY = "carrotFondelers_emoteStyle";

const EMOTE_DIR = "Assets/UI/Emote";

/**
 * Four curated sets of eight — pick in pause (`Emote set`).
 * Files must exist under ${EMOTE_DIR}/.
 */
export const EMOTE_STYLE_OPTIONS = [
  {
    id: "classic",
    label: "Classic",
    files: [
      "emote_faceHappy.png",
      "emote_laugh.png",
      "emote_heart.png",
      "emote_music.png",
      "emote_idea.png",
      "emote_alert.png",
      "emote_question.png",
      "emote_sleep.png",
    ],
  },
  {
    id: "expressions",
    label: "Expressions",
    files: [
      "emote_faceHappy.png",
      "emote_faceSad.png",
      "emote_faceAngry.png",
      "emote_laugh.png",
      "emote_sleep.png",
      "emote_sleeps.png",
      "emote_heart.png",
      "emote_heartBroken.png",
    ],
  },
  {
    id: "battle",
    label: "Battle",
    files: [
      "emote_alert.png",
      "emote_anger.png",
      "emote_cross.png",
      "emote_exclamation.png",
      "emote_exclamations.png",
      "emote_question.png",
      "emote_idea.png",
      "emote_cash.png",
    ],
  },
  {
    id: "sparkle",
    label: "Sparkle",
    files: [
      "emote_star.png",
      "emote_stars.png",
      "emote_swirl.png",
      "emote_hearts.png",
      "emote_heart.png",
      "emote_cloud.png",
      "emote_drop.png",
      "emote_drops.png",
    ],
  },
];

const POP_DURATION_MS = 2200;

/** @type {string} */
let currentStyleId = "classic";

/** @type {number} */
let popUntilMs = 0;
/** @type {string | null} */
let popSrc = null;

const headWorld = new THREE.Vector3();
const camForward = new THREE.Vector3();
const toHead = new THREE.Vector3();

function emoteUrl(file) {
  return encodeURI(`${EMOTE_DIR}/${file}`);
}

function loadStyleId() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && EMOTE_STYLE_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "classic";
}

function saveStyleId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function currentFiles() {
  return (
    EMOTE_STYLE_OPTIONS.find((o) => o.id === currentStyleId)?.files ??
    EMOTE_STYLE_OPTIONS[0].files
  );
}

export function syncEmoteBarFaces() {
  const files = currentFiles();
  const buttons = document.querySelectorAll("[data-emote-slot]");
  buttons.forEach((btn, i) => {
    const file = files[i];
    const img = btn.querySelector(".emote-bar__icon");
    if (file && img instanceof HTMLImageElement) {
      img.src = emoteUrl(file);
      img.alt = "";
    }
  });
}

export function toggleEmoteBar() {
  const bar = document.getElementById("emote-bar");
  if (!(bar instanceof HTMLElement)) return;
  game.emoteBarOpen = !game.emoteBarOpen;
  bar.classList.toggle("emote-bar--open", game.emoteBarOpen);
  bar.setAttribute("aria-hidden", game.emoteBarOpen ? "false" : "true");
}

export function closeEmoteBar() {
  const bar = document.getElementById("emote-bar");
  if (!(bar instanceof HTMLElement)) return;
  game.emoteBarOpen = false;
  bar.classList.remove("emote-bar--open");
  bar.setAttribute("aria-hidden", "true");
}

/**
 * @param {number} slot 0…7
 */
export function triggerEmoteSlot(slot) {
  const files = currentFiles();
  const file = files[slot];
  if (!file) return;
  popSrc = emoteUrl(file);
  popUntilMs = performance.now() + POP_DURATION_MS;
  const pop = document.getElementById("emote-pop");
  if (pop instanceof HTMLImageElement) {
    pop.src = popSrc;
    pop.classList.add("emote-pop--visible");
  }
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Object3D} player
 */
export function updateEmotePop(camera, player) {
  const pop = document.getElementById("emote-pop");
  const canvas = document.getElementById("game");
  if (!(pop instanceof HTMLImageElement) || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  if (game.paused || game.playerDead || game.levelTransitioning) {
    pop.classList.remove("emote-pop--visible");
    return;
  }

  const now = performance.now();
  if (now >= popUntilMs || !popSrc) {
    pop.classList.remove("emote-pop--visible");
    pop.removeAttribute("src");
    return;
  }

  headWorld.set(
    player.position.x,
    player.position.y + CAM_RIG.lookHeight + 0.85,
    player.position.z,
  );

  camera.getWorldDirection(camForward);
  toHead.subVectors(headWorld, camera.position);
  if (toHead.dot(camForward) <= 0.08) {
    pop.classList.remove("emote-pop--visible");
    return;
  }

  const projected = headWorld.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
  const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;

  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.classList.add("emote-pop--visible");
}

export function initEmotes() {
  currentStyleId = loadStyleId();
  const sel = document.getElementById("pause-emote-style");
  if (sel instanceof HTMLSelectElement) {
    sel.innerHTML = EMOTE_STYLE_OPTIONS.map(
      (o) => `<option value="${o.id}">${o.label}</option>`,
    ).join("");
    if (EMOTE_STYLE_OPTIONS.some((o) => o.id === currentStyleId)) {
      sel.value = currentStyleId;
    }
    sel.addEventListener("change", () => {
      currentStyleId = sel.value;
      saveStyleId(currentStyleId);
      syncEmoteBarFaces();
    });
  }

  syncEmoteBarFaces();

  const bar = document.getElementById("emote-bar");
  if (bar instanceof HTMLElement) {
    bar.querySelectorAll("[data-emote-slot]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const raw = btn.getAttribute("data-emote-slot");
        const slot = raw != null ? parseInt(raw, 10) : NaN;
        if (!Number.isFinite(slot)) return;
        triggerEmoteSlot(slot);
      });
    });
  }
}
