import * as THREE from "three";
import {
  CAM_PITCH_MAX,
  CAM_PITCH_MIN,
  MOUSE_LOOK_SENS,
} from "./config.js";
import { tryApplyJumpAction } from "./jumpAction.js";
import { cycleWeaponHotbar } from "./pickups.js";
import { isLiquidFormActive } from "./potions.js";
import { camOrbit, game, keys } from "./state.js";

const MODE_STORAGE_KEY = "carrotFondelers_mobileControlsMode";
const STYLE_STORAGE_KEY = "carrotFondelers_mobileUiStyle";

/** @type {"auto" | "on" | "off"} */
let touchMode = "auto";
/** @type {string} */
let styleId = "a";

/** @type {number | null} */
let stickPointerId = null;
/** @type {number | null} */
let lookPointerId = null;
/** @type {number | null} */
let lookLastX = null;
/** @type {number | null} */
let lookLastY = null;

const STYLE_FOLDERS = {
  a: "Style A",
  b: "Style B",
  c: "Style C",
  d: "Style D",
  e: "Style E",
  f: "Style F",
  g: "Style G",
  h: "Style H",
};

/**
 * @param {string} sid
 * @param {string} file
 */
function styleAsset(sid, file) {
  const folder = STYLE_FOLDERS[/** @type {keyof typeof STYLE_FOLDERS} */ (sid)];
  if (!folder) return "";
  return encodeURI(`Assets/UI/Mobile/${folder}/Default/${file}`);
}

const ICON = (name) => encodeURI(`Assets/UI/Mobile/Icons/Default/${name}`);

function loadTouchMode() {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

function saveTouchMode() {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, touchMode);
  } catch {
    /* ignore */
  }
}

function loadStyleId() {
  try {
    const v = (localStorage.getItem(STYLE_STORAGE_KEY) || "a").toLowerCase();
    if (v in STYLE_FOLDERS) return v;
  } catch {
    /* ignore */
  }
  return "a";
}

function saveStyleId() {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, styleId);
  } catch {
    /* ignore */
  }
}

export function shouldUserWantMobileUi() {
  if (touchMode === "off") return false;
  if (touchMode === "on") return true;
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return navigator.maxTouchPoints > 0;
}

function sequencesBlockHud() {
  return (
    document.body.classList.contains("startup-seq-active") ||
    document.body.classList.contains("ending-seq-active") ||
    document.body.classList.contains("level-cutscene-active")
  );
}

/** Previous frame: touch HUD was wanted — only release stick keys when turning off (not every tick). */
let prevMobileHudWanted;

export function syncMobileControlsVisibility() {
  const root = document.getElementById("mobile-controls");
  if (!root) return;
  const want = shouldUserWantMobileUi() && !sequencesBlockHud();
  const hidden = !want;
  root.classList.toggle("mobile-controls--hidden", hidden);
  root.setAttribute("aria-hidden", hidden ? "true" : "false");
  game.mobileTouchOverlayActive = want;
  if (prevMobileHudWanted === true && !want) {
    releaseMobileControlsInput();
  }
  prevMobileHudWanted = want;
}

function applyStyleImages() {
  const root = document.getElementById("mobile-controls");
  if (!root) return;
  root.querySelectorAll("[data-mc-style]").forEach((el) => {
    if (!(el instanceof HTMLImageElement)) return;
    const file = el.getAttribute("data-mc-style");
    if (!file) return;
    el.src = styleAsset(styleId, file);
  });
}

function bindStyleImg(el, file) {
  if (!(el instanceof HTMLImageElement)) return;
  el.setAttribute("data-mc-style", file);
  el.src = styleAsset(styleId, file);
}

/**
 * @param {PointerEvent} e
 * @param {HTMLElement} stick
 */
function updateStickFromPointer(e, stick) {
  const rect = stick.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const maxR = rect.width * 0.38;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const r = Math.hypot(dx, dy);
  if (r > maxR && r > 1e-6) {
    dx = (dx / r) * maxR;
    dy = (dy / r) * maxR;
  }
  const nub = stick.querySelector(".mobile-controls__stick-nub");
  if (nub instanceof HTMLElement) {
    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  const nx = maxR > 1e-6 ? dx / maxR : 0;
  const ny = maxR > 1e-6 ? dy / maxR : 0;
  keys.forward = ny < -0.22;
  keys.back = ny > 0.22;
  keys.left = nx < -0.22;
  keys.right = nx > 0.22;
}

function resetStickVisual(stick) {
  const nub = stick.querySelector(".mobile-controls__stick-nub");
  if (nub instanceof HTMLElement) {
    nub.style.transform = "translate(-50%, -50%)";
  }
}

export function releaseMobileControlsInput() {
  stickPointerId = null;
  lookPointerId = null;
  lookLastX = null;
  lookLastY = null;
  keys.forward = false;
  keys.back = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  const stick = document.getElementById("mobile-controls-stick");
  if (stick instanceof HTMLElement) resetStickVisual(stick);
}

function simBlocked() {
  return (
    game.paused ||
    game.playerDead ||
    game.devConsoleOpen ||
    game.levelTransitioning
  );
}

export function initMobileControls() {
  touchMode = loadTouchMode();
  styleId = loadStyleId();

  const root = document.getElementById("mobile-controls");
  const stick = document.getElementById("mobile-controls-stick");
  const look = document.getElementById("mobile-controls-look");
  const modeSel = document.getElementById("pause-mobile-touch-mode");
  const styleSel = document.getElementById("pause-mobile-style");

  if (!(root instanceof HTMLElement)) return;

  const pad = stick?.querySelector(".mobile-controls__stick-pad");
  const nub = stick?.querySelector(".mobile-controls__stick-nub");
  if (pad instanceof HTMLImageElement) bindStyleImg(pad, "joystick_circle_pad_b.png");
  if (nub instanceof HTMLImageElement) bindStyleImg(nub, "joystick_circle_nub_b.png");

  document.querySelectorAll("[data-mc-btn]").forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const kind = btn.getAttribute("data-mc-btn");
    const img = btn.querySelector(".mobile-controls__btn-face");
    const map = {
      atk: "button_circle.png",
      jump: "button_hexagon.png",
      sprint: "button_square.png",
      potion: "button_diamond.png",
      parley: "button_circle_wide.png",
      phase: "button_hexagon_wide.png",
      shock: "button_square_wide.png",
      wprev: "direction_left.png",
      wnext: "direction_right.png",
    };
    const file = map[/** @type {string} */ (kind || "")];
    if (file && img instanceof HTMLImageElement) bindStyleImg(img, file);
  });

  document.querySelectorAll("[data-mc-icon]").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    const name = img.getAttribute("data-mc-icon");
    const paths = {
      jump: "icon_jump.png",
      sprint: "icon_pedal.png",
      potion: "icon_hand.png",
      parley: "icon_talk.png",
      phase: "icon_arrow_curved.png",
      shock: "icon_burst.png",
      atk: "icon_fire.png",
    };
    const p = paths[/** @type {keyof typeof paths} */ (name || "")];
    if (p) img.src = ICON(p);
  });

  if (modeSel instanceof HTMLSelectElement) {
    modeSel.value = touchMode;
    modeSel.addEventListener("change", () => {
      const v = modeSel.value;
      if (v === "on" || v === "off" || v === "auto") {
        touchMode = v;
        saveTouchMode();
        syncMobileControlsVisibility();
      }
    });
  }

  if (styleSel instanceof HTMLSelectElement) {
    styleSel.value = styleId;
    styleSel.addEventListener("change", () => {
      const v = styleSel.value.toLowerCase();
      if (v in STYLE_FOLDERS) {
        styleId = v;
        saveStyleId();
        applyStyleImages();
      }
    });
  }

  if (stick instanceof HTMLElement) {
    stick.addEventListener("pointerdown", (e) => {
      if (!game.mobileTouchOverlayActive || simBlocked()) return;
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        stick.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stickPointerId = e.pointerId;
      updateStickFromPointer(e, stick);
    });
    stick.addEventListener("pointermove", (e) => {
      if (e.pointerId !== stickPointerId) return;
      if (!game.mobileTouchOverlayActive || simBlocked()) {
        keys.forward = false;
        keys.back = false;
        keys.left = false;
        keys.right = false;
        return;
      }
      e.preventDefault();
      updateStickFromPointer(e, stick);
    });
    const endStick = (e) => {
      if (e.pointerId !== stickPointerId) return;
      try {
        stick.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stickPointerId = null;
      keys.forward = false;
      keys.back = false;
      keys.left = false;
      keys.right = false;
      resetStickVisual(stick);
    };
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);
  }

  if (look instanceof HTMLElement) {
    const sens = MOUSE_LOOK_SENS * 1.05;
    look.addEventListener("pointerdown", (e) => {
      if (!game.mobileTouchOverlayActive || simBlocked()) return;
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        look.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      lookPointerId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
    });
    look.addEventListener("pointermove", (e) => {
      if (e.pointerId !== lookPointerId) return;
      if (!game.mobileTouchOverlayActive || simBlocked()) {
        lookLastX = e.clientX;
        lookLastY = e.clientY;
        return;
      }
      if (lookLastX == null || lookLastY == null) return;
      e.preventDefault();
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      camOrbit.yaw -= dx * sens;
      camOrbit.pitch = THREE.MathUtils.clamp(
        camOrbit.pitch - dy * sens,
        CAM_PITCH_MIN,
        CAM_PITCH_MAX,
      );
    });
    const endLook = (e) => {
      if (e.pointerId !== lookPointerId) return;
      try {
        look.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      lookPointerId = null;
      lookLastX = null;
      lookLastY = null;
    };
    look.addEventListener("pointerup", endLook);
    look.addEventListener("pointercancel", endLook);
  }

  const tWall = () => performance.now() * 0.001;

  function onActionDown(kind) {
    if (!game.mobileTouchOverlayActive || simBlocked()) return;
    const tw = tWall();
    switch (kind) {
      case "atk":
        game.requestMelee = true;
        break;
      case "jump":
        tryApplyJumpAction(tw);
        break;
      case "sprint":
        keys.sprint = true;
        break;
      case "potion":
        game.requestDrinkPotion = true;
        break;
      case "parley":
        game.requestNegotiate = true;
        break;
      case "phase":
        if (!isLiquidFormActive(tw)) game.requestPhaseDash = true;
        break;
      case "shock":
        if (!isLiquidFormActive(tw)) game.requestShockwave = true;
        break;
      case "wprev":
        cycleWeaponHotbar(-120);
        break;
      case "wnext":
        cycleWeaponHotbar(120);
        break;
      default:
        break;
    }
  }

  root.querySelectorAll("[data-mc-btn]").forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const kind = btn.getAttribute("data-mc-btn") || "";
    btn.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onActionDown(kind);
      },
      { passive: false },
    );
    if (kind === "sprint") {
      btn.addEventListener(
        "pointerup",
        (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          keys.sprint = false;
        },
        { passive: false },
      );
      btn.addEventListener(
        "pointercancel",
        () => {
          keys.sprint = false;
        },
        { passive: false },
      );
    }
  });

  window.addEventListener("blur", () => releaseMobileControlsInput());

  syncMobileControlsVisibility();
}
