import { syncMedalBadgeUi } from "./medalDisplay.js";
import { syncRankBadgeUi } from "./rankDisplay.js";
import { game } from "./state.js";

const STORAGE_KEY = "carrotFondelers_progressionHudMode";

function loadMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "rank" || v === "level") return v;
  } catch {
    /* ignore */
  }
  return "rank";
}

function saveMode() {
  try {
    localStorage.setItem(STORAGE_KEY, game.progressionHudMode);
  } catch {
    /* ignore */
  }
}

export function applyProgressionHudMode() {
  document.body.classList.remove("progression-hud--rank", "progression-hud--level");
  const rank = game.progressionHudMode === "rank";
  document.body.classList.add(rank ? "progression-hud--rank" : "progression-hud--level");

  document
    .getElementById("medal-badge")
    ?.setAttribute("aria-hidden", rank ? "true" : "false");
  document
    .getElementById("rank-badge")
    ?.setAttribute("aria-hidden", rank ? "false" : "true");
}

export function initProgressionHudMode() {
  game.progressionHudMode = loadMode();

  const sel = document.getElementById("pause-progression-display");
  if (sel instanceof HTMLSelectElement) {
    sel.value = game.progressionHudMode;
    sel.addEventListener("change", () => {
      game.progressionHudMode =
        sel.value === "level" ? "level" : "rank";
      saveMode();
      applyProgressionHudMode();
      syncRankBadgeUi();
      syncMedalBadgeUi();
    });
  }

  applyProgressionHudMode();
  syncRankBadgeUi();
  syncMedalBadgeUi();
}
