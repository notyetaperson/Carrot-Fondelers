import { game } from "./state.js";

const STORAGE_KEY = "carrotFondelers_rankBadgeStyle";

/** Highest rank index shipped under each tier (`rank000.png` … `rank077.png`). */
const RANK_IMAGE_INDEX_CAP = 77;

/**
 * Color tier folders under `Assets/UI/Ranks/` — selectable in the pause menu (same pattern as mobile UI packs).
 * @type {{ id: string; label: string; folder: string }[]}
 */
export const RANK_BADGE_STYLE_OPTIONS = [
  { id: "black", label: "Black", folder: "Black" },
  { id: "bronze", label: "Bronze", folder: "Bronze" },
  { id: "silver", label: "Silver", folder: "Silver" },
  { id: "gold", label: "Gold", folder: "Gold" },
];

/** @type {string} */
let currentStyleId = "black";

function loadStyleId() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && RANK_BADGE_STYLE_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "black";
}

function saveStyleId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} folderName e.g. `"Gold"`
 * @param {number} levelIndex `game.levelIndex` — one badge per stage (Arena → … → Final Arena).
 */
export function rankBadgeImageUrl(folderName, levelIndex) {
  const clamped = Math.min(
    Math.max(0, Math.floor(levelIndex)),
    RANK_IMAGE_INDEX_CAP,
  );
  const idx = String(clamped).padStart(3, "0");
  return encodeURI(`Assets/UI/Ranks/${folderName}/rank${idx}.png`);
}

export function syncRankBadgeUi() {
  const img = document.getElementById("rank-badge-img");
  const stepEl = document.getElementById("rank-badge-step");
  if (!(img instanceof HTMLImageElement)) return;

  const folder =
    RANK_BADGE_STYLE_OPTIONS.find((o) => o.id === currentStyleId)?.folder ??
    "Black";
  img.src = rankBadgeImageUrl(folder, game.levelIndex);
  img.alt = `Rank ${game.levelIndex + 1}`;

  if (stepEl) {
    stepEl.textContent = `Rank ${game.levelIndex + 1}`;
  }
}

export function initRankDisplay() {
  currentStyleId = loadStyleId();
  const sel = document.getElementById("pause-rank-style");
  if (sel instanceof HTMLSelectElement) {
    if (RANK_BADGE_STYLE_OPTIONS.some((o) => o.id === currentStyleId)) {
      sel.value = currentStyleId;
    }
    sel.addEventListener("change", () => {
      currentStyleId = sel.value;
      saveStyleId(currentStyleId);
      syncRankBadgeUi();
    });
  }
  syncRankBadgeUi();
}
