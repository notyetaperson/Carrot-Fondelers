/** Query key for `game.levelIndex` (0 = arena, …). Omitted when 0 for a clean URL. */
const LEVEL_PARAM = "lv";

/**
 * @param {number} n
 * @param {number} levelCount `LEVEL_URLS.length`
 */
export function clampLevelIndex(n, levelCount) {
  const max = Math.max(0, levelCount - 1);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

/**
 * @param {number} levelCount
 */
export function readLevelIndexFromUrl(levelCount) {
  const raw = new URLSearchParams(location.search).get(LEVEL_PARAM);
  if (raw == null || raw === "") return 0;
  return clampLevelIndex(parseInt(raw, 10), levelCount);
}

/**
 * Updates `?lv=` via `replaceState` so refresh keeps the same stage (no extra history entries).
 * @param {number} levelIndex
 */
export function writeLevelIndexToUrl(levelIndex) {
  const params = new URLSearchParams(location.search);
  if (levelIndex <= 0) {
    params.delete(LEVEL_PARAM);
  } else {
    params.set(LEVEL_PARAM, String(levelIndex));
  }
  const q = params.toString();
  const path = `${location.pathname}${q ? `?${q}` : ""}${location.hash}`;
  history.replaceState(null, "", path);
}
