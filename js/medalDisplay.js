import { game } from "./state.js";

const STORAGE_KEY = "carrotFondelers_medalStyle";

/** `medal1` … `medal9` in each art pack — matches nine campaign stages. */
const MEDAL_NUMBER_MAX = 9;

/**
 * Flat files in `Assets/UI/Medals/`: `flat_medal1.png`, `flatshadow_medal1.png`, `shaded_medal1.png`, …
 * @type {{ id: string; label: string; filePrefix: string }[]}
 */
export const MEDAL_STYLE_OPTIONS = [
  { id: "flat", label: "Flat", filePrefix: "flat" },
  { id: "flatshadow", label: "Flat shadow", filePrefix: "flatshadow" },
  { id: "shaded", label: "Shaded", filePrefix: "shaded" },
];

/** @type {string} */
let currentStyleId = "shaded";

function loadStyleId() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && MEDAL_STYLE_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "shaded";
}

function saveStyleId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} filePrefix e.g. `"shaded"`
 * @param {number} levelIndex `game.levelIndex` — medal number is `levelIndex + 1` (clamped 1–9).
 */
export function medalBadgeImageUrl(filePrefix, levelIndex) {
  const n = Math.min(
    Math.max(Math.floor(levelIndex) + 1, 1),
    MEDAL_NUMBER_MAX,
  );
  return encodeURI(`Assets/UI/Medals/${filePrefix}_medal${n}.png`);
}

export function syncMedalBadgeUi() {
  const img = document.getElementById("medal-badge-img");
  const stepEl = document.getElementById("medal-badge-step");
  const labelEl = document.querySelector("#medal-badge .medal-badge__label");
  if (!(img instanceof HTMLImageElement)) return;

  const prefix =
    MEDAL_STYLE_OPTIONS.find((o) => o.id === currentStyleId)?.filePrefix ??
    "shaded";
  img.src = medalBadgeImageUrl(prefix, game.levelIndex);
  const n = game.levelIndex + 1;
  const levelMode = game.progressionHudMode === "level";
  if (labelEl) {
    labelEl.textContent = levelMode ? "Level" : "Medal";
  }
  img.alt = levelMode ? `Level ${n}` : `Medal ${n}`;
  if (stepEl) {
    stepEl.textContent = levelMode ? `Level ${n}` : `Stage ${n}`;
  }
}

export function initMedalDisplay() {
  currentStyleId = loadStyleId();
  const sel = document.getElementById("pause-medal-style");
  if (sel instanceof HTMLSelectElement) {
    if (MEDAL_STYLE_OPTIONS.some((o) => o.id === currentStyleId)) {
      sel.value = currentStyleId;
    }
    sel.addEventListener("change", () => {
      currentStyleId = sel.value;
      saveStyleId(currentStyleId);
      syncMedalBadgeUi();
    });
  }
  syncMedalBadgeUi();
}
