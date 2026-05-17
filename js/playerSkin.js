import {
  PLAYER_SKIN_DEFAULT_ID,
  PLAYER_SKIN_SPECS,
} from "./config.js";
import { swapPlayerModel } from "./player.js";

const STORAGE_KEY = "carrotFondelers_playerSkinId";

/**
 * @param {string} id
 */
function getSkinSpecById(id) {
  return PLAYER_SKIN_SPECS.find((s) => s.id === id) ?? null;
}

/**
 * Full URL for boot (`?v=` cache bust).
 */
export function getInitialPlayerUrl() {
  let id = PLAYER_SKIN_DEFAULT_ID;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getSkinSpecById(stored)) id = stored;
  } catch {
    /* ignore */
  }
  const spec = getSkinSpecById(id);
  if (!spec) return null;
  return `${spec.path}?v=${spec.revision}`;
}

/**
 * Populate pause menu & persist choice. Call after DOM + first `loadPlayer`.
 * @param {import("three/addons/loaders/GLTFLoader.js").GLTFLoader} loader
 * @param {import("three").Group} player
 */
export function initPlayerSkinSelector(loader, player) {
  const sel = document.getElementById("pause-player-skin");
  if (!(sel instanceof HTMLSelectElement)) return;

  sel.replaceChildren();
  const lead = PLAYER_SKIN_SPECS.filter(
    (s) => !s.id.startsWith("blocky_") && !s.id.startsWith("mini_"),
  );
  const blocky = PLAYER_SKIN_SPECS.filter((s) => s.id.startsWith("blocky_"));
  const mini = PLAYER_SKIN_SPECS.filter((s) => s.id.startsWith("mini_"));

  for (const spec of lead) {
    const opt = document.createElement("option");
    opt.value = spec.id;
    opt.textContent = spec.label;
    sel.appendChild(opt);
  }
  const ogBlocky = document.createElement("optgroup");
  ogBlocky.label = "Blocky pack";
  for (const spec of blocky) {
    const opt = document.createElement("option");
    opt.value = spec.id;
    opt.textContent = spec.label.replace(/^Blocky — /, "");
    ogBlocky.appendChild(opt);
  }
  sel.appendChild(ogBlocky);
  const ogMini = document.createElement("optgroup");
  ogMini.label = "Mini pack";
  for (const spec of mini) {
    const opt = document.createElement("option");
    opt.value = spec.id;
    opt.textContent = spec.label.replace(/^Mini — /, "");
    ogMini.appendChild(opt);
  }
  sel.appendChild(ogMini);

  let currentId = PLAYER_SKIN_DEFAULT_ID;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getSkinSpecById(stored)) currentId = stored;
  } catch {
    /* ignore */
  }
  sel.value = currentId;

  sel.addEventListener("change", () => {
    const spec = getSkinSpecById(sel.value);
    if (!spec) return;
    try {
      localStorage.setItem(STORAGE_KEY, spec.id);
    } catch {
      /* ignore */
    }
    const url = `${spec.path}?v=${spec.revision}`;
    void swapPlayerModel(loader, player, url).catch((err) => {
      console.warn("Skin load failed:", spec.path, err);
    });
  });
}
