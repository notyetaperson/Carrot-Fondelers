const COLOR_KEY = "carrotFondelers_mainUiColor";
const DENSITY_KEY = "carrotFondelers_mainUiDensity";

/**
 * @type {{ id: string; label: string; folder: string }[]}
 */
export const MAIN_UI_COLOR_OPTIONS = [
  { id: "blue", label: "Blue", folder: "Blue" },
  { id: "green", label: "Green", folder: "Green" },
  { id: "grey", label: "Grey", folder: "Grey" },
  { id: "red", label: "Red", folder: "Red" },
  { id: "yellow", label: "Yellow", folder: "Yellow" },
];

/**
 * `Default` = 1× art, `Double` = 2× pack folder (`Assets/UI/UI/.../Double/`).
 * @type {{ id: string; label: string; folder: string }[]}
 */
export const MAIN_UI_DENSITY_OPTIONS = [
  { id: "double", label: "Double (2×)", folder: "Double" },
  { id: "default", label: "Default (1×)", folder: "Default" },
];

/** @type {string} */
let colorId = "blue";
/** @type {string} */
let densityId = "double";

function loadColorId() {
  try {
    const v = localStorage.getItem(COLOR_KEY);
    if (v && MAIN_UI_COLOR_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "blue";
}

function loadDensityId() {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v && MAIN_UI_DENSITY_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "double";
}

function saveColorId(id) {
  try {
    localStorage.setItem(COLOR_KEY, id);
  } catch {
    /* ignore */
  }
}

function saveDensityId(id) {
  try {
    localStorage.setItem(DENSITY_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} file
 */
function themeUrl(file) {
  const colorFolder =
    MAIN_UI_COLOR_OPTIONS.find((o) => o.id === colorId)?.folder ?? "Blue";
  const densityFolder =
    MAIN_UI_DENSITY_OPTIONS.find((o) => o.id === densityId)?.folder ?? "Double";
  const rel = `Assets/UI/UI/${colorFolder}/${densityFolder}/${file}`;
  return `url("${encodeURI(rel)}")`;
}

export function applyMainUiTheme() {
  const root = document.documentElement;

  root.style.setProperty("--ui-rgs-l", themeUrl("bar_round_gloss_small_l.png"));
  root.style.setProperty("--ui-rgs-m", themeUrl("bar_round_gloss_small_m.png"));
  root.style.setProperty("--ui-rgs-r", themeUrl("bar_round_gloss_small_r.png"));

  root.style.setProperty(
    "--ui-plate-round-lg",
    themeUrl("bar_round_gloss_large_square.png"),
  );
  root.style.setProperty(
    "--ui-pause-plate",
    themeUrl("bar_square_gloss_large_square.png"),
  );
  root.style.setProperty(
    "--ui-slot-square",
    themeUrl("bar_round_gloss_small_square.png"),
  );
  root.style.setProperty(
    "--ui-btn-rect",
    themeUrl("button_square_header_small_rectangle_screws.png"),
  );
}

export function initMainUiTheme() {
  colorId = loadColorId();
  densityId = loadDensityId();

  const colorSel = document.getElementById("pause-ui-color");
  const densitySel = document.getElementById("pause-ui-density");

  if (colorSel instanceof HTMLSelectElement) {
    colorSel.innerHTML = MAIN_UI_COLOR_OPTIONS.map(
      (o) => `<option value="${o.id}">${o.label}</option>`,
    ).join("");
    if (MAIN_UI_COLOR_OPTIONS.some((o) => o.id === colorId)) {
      colorSel.value = colorId;
    }
    colorSel.addEventListener("change", () => {
      colorId = colorSel.value;
      saveColorId(colorId);
      applyMainUiTheme();
    });
  }

  if (densitySel instanceof HTMLSelectElement) {
    densitySel.innerHTML = MAIN_UI_DENSITY_OPTIONS.map(
      (o) => `<option value="${o.id}">${o.label}</option>`,
    ).join("");
    if (MAIN_UI_DENSITY_OPTIONS.some((o) => o.id === densityId)) {
      densitySel.value = densityId;
    }
    densitySel.addEventListener("change", () => {
      densityId = densitySel.value;
      saveDensityId(densityId);
      applyMainUiTheme();
    });
  }

  applyMainUiTheme();
}
