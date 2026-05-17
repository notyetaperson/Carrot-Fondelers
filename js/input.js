import * as THREE from "three";
import {
  CAM_PITCH_MAX,
  CAM_PITCH_MIN,
  MOUSE_LOOK_SENS,
} from "./config.js";
import {
  loadBgmMutePreference,
  setBgmPaused,
  setBgmUserMuted,
} from "./bgm.js";
import { closeDevConsole, toggleDevConsole } from "./devConsole.js";
import { tryApplyJumpAction } from "./jumpAction.js";
import { closeEmoteBar, triggerEmoteSlot, toggleEmoteBar } from "./emotes.js";
import { releaseMobileControlsInput } from "./mobileControls.js";
import { cycleWeaponHotbar } from "./pickups.js";
import { isLiquidFormActive } from "./potions.js";
import { camOrbit, game, keys, move } from "./state.js";

/** @type {HTMLCanvasElement | null} */
let inputCanvas = null;

/**
 * `setGamePaused(true)` exits pointer lock programmatically — ignore that unlock
 * so we do not treat it like the user pressed Esc (browser unlock → pause).
 */
let ignoreNextPointerUnlockForPause = false;

/**
 * After pausing because the browser released pointer lock (Esc), some browsers
 * still deliver an Escape keydown — ignore Esc briefly so it does not resume immediately.
 * Cleared when unpausing from the menu.
 */
let pauseMenuEscIgnoreUntil = 0;

const PIG_OINKISH_STORAGE_KEY = "carrotFondelers_pigOinkish";

function loadPigLanguagePreference() {
  try {
    return localStorage.getItem(PIG_OINKISH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePigLanguagePreference(oinkish) {
  try {
    localStorage.setItem(PIG_OINKISH_STORAGE_KEY, oinkish ? "1" : "0");
  } catch {
    /* ignore (private mode, quota) */
  }
}

export function setGamePaused(value) {
  const pauseMenu = document.getElementById("pause-menu");
  const pauseResumeBtn = document.getElementById("pause-resume");
  if (!pauseMenu) return;
  game.paused = value;
  pauseMenu.classList.toggle("pause-menu--hidden", !value);
  pauseMenu.setAttribute("aria-hidden", value ? "false" : "true");
  document.body.classList.toggle("game-paused", value);
  setBgmPaused(value);

  if (value) {
    closeEmoteBar();
    releaseMobileControlsInput();
    if (inputCanvas && document.pointerLockElement === inputCanvas) {
      ignoreNextPointerUnlockForPause = true;
      document.exitPointerLock();
    }
    keys.forward = false;
    keys.back = false;
    keys.left = false;
    keys.right = false;
    keys.sprint = false;
    if (game.playerAnim?.mixer) game.playerAnim.mixer.timeScale = 0;
    pauseResumeBtn?.focus();
  } else {
    if (game.playerAnim?.mixer) game.playerAnim.mixer.timeScale = 1;
    inputCanvas?.focus();
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function setupInput(canvas) {
  inputCanvas = canvas;
  const pauseResumeBtn = document.getElementById("pause-resume");
  const pigOinkishInput = document.getElementById("pause-pig-oinkish");
  const pauseBgmEnabled = document.getElementById("pause-bgm-enabled");

  game.pigLanguageOinkish = loadPigLanguagePreference();
  if (pigOinkishInput instanceof HTMLInputElement) {
    pigOinkishInput.checked = game.pigLanguageOinkish;
    pigOinkishInput.addEventListener("change", () => {
      game.pigLanguageOinkish = pigOinkishInput.checked;
      savePigLanguagePreference(game.pigLanguageOinkish);
    });
  }

  if (pauseBgmEnabled instanceof HTMLInputElement) {
    pauseBgmEnabled.checked = !loadBgmMutePreference();
    pauseBgmEnabled.addEventListener("change", () => {
      setBgmUserMuted(!pauseBgmEnabled.checked);
    });
  }

  pauseResumeBtn.addEventListener("click", () => setGamePaused(false));

  const pauseOpenDevBtn = document.getElementById("pause-open-dev-console");
  pauseOpenDevBtn?.addEventListener("click", () => {
    if (!game.devConsoleUnlocked) return;
    setGamePaused(false);
    if (!game.devConsoleOpen) toggleDevConsole();
  });

  canvas.addEventListener("click", () => {
    if (
      !game.paused &&
      !game.devConsoleOpen &&
      document.pointerLockElement !== canvas
    ) {
      canvas.focus();
      if (game.mobileTouchOverlayActive) {
        return;
      }
      canvas.requestPointerLock().catch(() => {});
    }
  });

  canvas.addEventListener("contextmenu", (e) => {
    if (document.pointerLockElement === canvas) e.preventDefault();
  });

  canvas.addEventListener("mousedown", (e) => {
    if (game.paused || game.playerDead || game.devConsoleOpen) return;
    if (document.pointerLockElement !== canvas) return;
    if (e.button === 2) {
      e.preventDefault();
      game.requestDrinkPotion = true;
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    game.requestMelee = true;
  });

  /** `passive: false` so we can preventDefault and use wheel as weapon cycle (not page scroll). */
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (game.paused || game.playerDead || game.devConsoleOpen) return;
      if (document.pointerLockElement !== canvas) return;
      if (e.deltaY === 0) return;
      cycleWeaponHotbar(e.deltaY);
      e.preventDefault();
    },
    { passive: false },
  );

  /**
   * Esc often exits pointer lock without a keydown reaching JS. Pausing here
   * matches player intent; flags above avoid fighting programmatic unlock / stray Esc.
   */
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) return;
    if (ignoreNextPointerUnlockForPause) {
      ignoreNextPointerUnlockForPause = false;
      return;
    }
    if (game.devConsoleOpen || game.playerDead || game.paused) return;
    pauseMenuEscIgnoreUntil = performance.now() + 180;
    setGamePaused(true);
  });

  document.addEventListener("mousemove", (e) => {
    if (
      game.paused ||
      game.devConsoleOpen ||
      document.pointerLockElement !== canvas
    ) {
      return;
    }
    camOrbit.yaw -= e.movementX * MOUSE_LOOK_SENS;
    camOrbit.pitch = THREE.MathUtils.clamp(
      camOrbit.pitch - e.movementY * MOUSE_LOOK_SENS,
      CAM_PITCH_MIN,
      CAM_PITCH_MAX,
    );
  });

  const onKeyDown = (e) => {
    if (e.code === "KeyY" && !e.repeat) {
      toggleDevConsole();
      e.preventDefault();
      return;
    }
    const isEsc = e.code === "Escape" || e.key === "Escape";
    if (isEsc) {
      if (game.devConsoleOpen) {
        closeDevConsole();
        e.preventDefault();
        return;
      }
      if (game.paused) {
        if (performance.now() < pauseMenuEscIgnoreUntil) {
          e.preventDefault();
          return;
        }
        if (!e.repeat) setGamePaused(false);
        e.preventDefault();
        return;
      }
      // Playing: open pause on Esc. While pointer-locked, calling preventDefault only and
      // returning breaks some browsers (they never release lock → pointerlockchange never
      // fires). Opening pause here runs exitPointerLock with ignoreNextPointerUnlockForPause.
      if (!e.repeat) setGamePaused(true);
      e.preventDefault();
      return;
    }
    if (e.code === "KeyR" && !e.repeat && game.playerDead) {
      game.requestRespawn = true;
      e.preventDefault();
      return;
    }
    if (game.devConsoleOpen) {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t?.closest?.("#dev-console")) return;
    }
    if (game.paused || game.playerDead) return;

    if (game.emoteBarOpen && !e.repeat) {
      const digitSlots = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3,
        Digit5: 4,
        Digit6: 5,
        Digit7: 6,
        Digit8: 7,
      };
      const slot = digitSlots[/** @type {keyof typeof digitSlots} */ (e.code)];
      if (slot !== undefined) {
        triggerEmoteSlot(slot);
        e.preventDefault();
        return;
      }
    }

    switch (e.code) {
      case "KeyE":
        if (!e.repeat) toggleEmoteBar();
        e.preventDefault();
        break;
      case "KeyW":
        keys.forward = true;
        break;
      case "KeyS":
        keys.back = true;
        break;
      case "KeyA":
        keys.left = true;
        break;
      case "KeyD":
        keys.right = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = true;
        break;
      case "Space":
        if (!e.repeat) {
          tryApplyJumpAction(performance.now() * 0.001);
        }
        e.preventDefault();
        break;
      case "KeyF":
        if (!e.repeat) game.requestNegotiate = true;
        break;
      case "KeyQ":
        if (!e.repeat && !isLiquidFormActive(performance.now() * 0.001)) {
          game.requestPhaseDash = true;
        }
        break;
      case "KeyU":
        if (!e.repeat && !isLiquidFormActive(performance.now() * 0.001)) {
          game.requestShockwave = true;
        }
        break;
      default:
        break;
    }
  };

  window.addEventListener("keydown", onKeyDown, true);

  window.addEventListener("keyup", (e) => {
    if (game.devConsoleOpen) {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t?.closest?.("#dev-console")) return;
    }
    const isEscUp = e.code === "Escape" || e.key === "Escape";
    if (game.paused && !isEscUp) return;

    switch (e.code) {
      case "KeyW":
        keys.forward = false;
        break;
      case "KeyS":
        keys.back = false;
        break;
      case "KeyA":
        keys.left = false;
        break;
      case "KeyD":
        keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = false;
        break;
      default:
        break;
    }
  });
}
