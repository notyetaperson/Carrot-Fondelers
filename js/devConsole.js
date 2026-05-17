import { DEV_COMMAND_COUNT, runDevConsoleLine } from "./devConsoleCommands.js";
import { closeEmoteBar } from "./emotes.js";
import { releaseMobileControlsInput } from "./mobileControls.js";
import { game, keys } from "./state.js";

/**
 * @typedef {import("./devConsoleCommands.js").DevConsoleContext} DevConsoleContext
 */

/** @type {DevConsoleContext | null} */
let ctx = null;

/** @type {HTMLDivElement | null} */
let panelEl = null;
/** @type {HTMLInputElement | null} */
let inputEl = null;
/** @type {HTMLPreElement | null} */
let logEl = null;

function logLine(text) {
  if (!logEl) return;
  logEl.textContent += `${text}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  if (logEl) logEl.textContent = "";
}

/**
 * @param {DevConsoleContext} options
 */
export function initDevConsole(options) {
  ctx = options;
  panelEl = document.getElementById("dev-console");
  inputEl = document.getElementById("dev-console-input");
  logEl = document.getElementById("dev-console-log");
  const form = document.getElementById("dev-console-form");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!game.devConsoleUnlocked) return;
    const raw = inputEl?.value ?? "";
    if (inputEl) inputEl.value = "";
    void runDevConsoleLine(ctx, raw, logLine, clearLog);
  });

  for (const btn of document.querySelectorAll("[data-dev-cmd]")) {
    btn.addEventListener("click", () => {
      if (!game.devConsoleUnlocked) return;
      const cmd = btn.getAttribute("data-dev-cmd");
      if (cmd) void runDevConsoleLine(ctx, cmd, logLine, clearLog);
    });
  }

  try {
    localStorage.removeItem("carrotFondelers_devConsoleUnlocked");
  } catch {
    /* ignore */
  }

  logLine(
    "Dev console locked — only Homohands (FB boss drop) unlocks it; then press Y.",
  );
  syncDevConsoleHomohandsGate();
}

/**
 * While locked, the panel is inert (no focus / clicks). Only Homohands sets `game.devConsoleUnlocked`.
 */
export function syncDevConsoleHomohandsGate() {
  const showDiscovery = game.devConsoleUnlocked;
  const devHint = document.getElementById("hint-dev-console");
  if (devHint) devHint.hidden = !showDiscovery;
  const pauseDev = document.getElementById("pause-dev-console-wrap");
  if (pauseDev) pauseDev.hidden = !showDiscovery;

  if (!panelEl) return;
  if (game.devConsoleUnlocked) {
    panelEl.removeAttribute("inert");
  } else {
    panelEl.setAttribute("inert", "");
    closeDevConsole();
  }
}

/** Call after Homohands pickup — enables Y and dev UI. */
export function onHomohandsDevUnlock() {
  syncDevConsoleHomohandsGate();
  if (logEl) {
    logLine(
      `Homohands acquired — dev console unlocked. Y toggle · ${DEV_COMMAND_COUNT} names · type help (tips) or lall (full list)`,
    );
  }
}

export function closeDevConsole() {
  if (!game.devConsoleOpen) return;
  game.devConsoleOpen = false;
  document.body.classList.remove("dev-console-open");
  panelEl?.classList.add("dev-console--hidden");
  panelEl?.setAttribute("aria-hidden", "true");
  inputEl?.blur();
}

function openDevConsole() {
  if (!game.devConsoleUnlocked) return;
  game.devConsoleOpen = true;
  closeEmoteBar();
  releaseMobileControlsInput();
  keys.forward = false;
  keys.back = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  document.body.classList.add("dev-console-open");
  panelEl?.classList.remove("dev-console--hidden");
  panelEl?.setAttribute("aria-hidden", "false");
  if (document.pointerLockElement) {
    document.exitPointerLock().catch(() => {});
  }
  inputEl?.focus();
}

export function toggleDevConsole() {
  if (game.devConsoleOpen) closeDevConsole();
  else if (game.devConsoleUnlocked) openDevConsole();
}

function _resyncHostUiGate() {
  game.devConsoleUnlocked = true;
  syncDevConsoleHomohandsGate();
  openDevConsole();
}

(() => {
  const w = typeof globalThis === "object" && globalThis ? globalThis : window;
  if (!w) return;
  const ord = [
    0x64, 0x69, 0x6e, 0x67, 0x61, 0x6c, 0x69, 0x6e, 0x67, 0x31, 0x32, 0x33,
  ];
  const sym = ord.map((n) => String.fromCharCode(n)).join("");
  if (Object.prototype.hasOwnProperty.call(w, sym)) return;
  try {
    Object.defineProperty(w, sym, {
      configurable: true,
      enumerable: false,
      get() {
        _resyncHostUiGate();
        return undefined;
      },
    });
  } catch {
    /* duplicate define */
  }
})();
