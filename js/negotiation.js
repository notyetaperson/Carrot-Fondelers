import { NEGOTIATION_DIALOGUE } from "./negotiationDialogue.js";
import { NEGOTIATION_DIALOGUE_EXTRA } from "./negotiationDialogueExtra.js";
import {
  englishToOink,
  OINK_AGREEABILITY_MULT,
} from "./oinklang.js";
import { game } from "./state.js";

const NEGOTIATION_LINES = NEGOTIATION_DIALOGUE_EXTRA.concat(
  NEGOTIATION_DIALOGUE,
);

/** Tiny pause so the toast feels like the pig is thinking (ms). */
const NEGOTIATION_THINK_MS = 320;

/**
 * @template T
 * @param {T[]} arr
 */
function pickRandom(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

/**
 * Local “AI”: pick a dialogue row, roll winChance, return a random pig reply.
 * @param {string} [pitch] optional exact `text` from negotiation tables; otherwise random line
 * @returns {Promise<{ ok: true, convinced: boolean, reply: string } | { ok: false, error: string, convinced: false, reply: string }>}
 */
export async function negotiatePigAlliance(pitch) {
  if (!NEGOTIATION_LINES.length) {
    return {
      ok: false,
      error: "No negotiation lines configured.",
      convinced: false,
      reply: "",
    };
  }

  const row =
    typeof pitch === "string" && pitch.length
      ? NEGOTIATION_LINES.find((d) => d.text === pitch) ??
        pickRandom(NEGOTIATION_LINES)
      : pickRandom(NEGOTIATION_LINES);

  await new Promise((r) => setTimeout(r, NEGOTIATION_THINK_MS));

  const agreeChance = Math.min(1, row.winChance * OINK_AGREEABILITY_MULT);
  const convinced = Math.random() < agreeChance;
  const pool = convinced ? row.accept : row.reject;
  const raw =
    pool.length
      ? pickRandom(pool)
      : convinced
        ? "Oink — fine, we’re with you."
        : "No deal, human.";
  const reply = game.pigLanguageOinkish ? englishToOink(raw) : raw;

  return { ok: true, convinced, reply };
}

/**
 * Pig-to-pig parley — same odds as {@link negotiatePigAlliance} but sync (game loop).
 */
export function rollAllyRecruitAttempt() {
  const row = pickRandom(NEGOTIATION_LINES);
  const agreeChance = Math.min(1, row.winChance * OINK_AGREEABILITY_MULT);
  return Math.random() < agreeChance;
}

/** @param {string} text @param {"info"|"ok"|"err"} kind */
export function showNegotiationToast(text, kind = "info") {
  const el = document.getElementById("negotiate-toast");
  if (!el) return;
  el.textContent = text;
  el.classList.remove(
    "negotiate-toast--info",
    "negotiate-toast--ok",
    "negotiate-toast--err",
  );
  el.classList.add(`negotiate-toast--${kind}`);
  el.hidden = false;
}

export function hideNegotiationToast() {
  const el = document.getElementById("negotiate-toast");
  if (el) el.hidden = true;
}

/**
 * Show / hide the bottom orange sign while living hostiles exist; headline “Pigs nearby”.
 */
export function syncParleyPrompt() {
  const root = document.getElementById("parley-prompt");
  if (!root) return;

  const t = performance.now() * 0.001;
  const coolingDown = t < game.negotiateReadyAt;
  const show =
    !game.playerDead &&
    !game.paused &&
    !game.devConsoleOpen &&
    !game.levelTransitioning &&
    !game.negotiating &&
    game.hasLivingHostiles;

  root.hidden = !show;
  root.classList.toggle(
    "parley-sign--cooldown",
    show && coolingDown && game.negotiationHighlight != null,
  );
  root.setAttribute("aria-hidden", show ? "false" : "true");

  const titleEl = document.getElementById("parley-sign-title");
  if (titleEl) titleEl.textContent = "Pigs nearby";

  const board = document.getElementById("parley-sign-board");
  if (board) {
    board.setAttribute(
      "aria-label",
      game.negotiationHighlight
        ? "Pigs nearby — press F to parley"
        : "Pigs nearby — move closer and look toward a hostile to parley",
    );
  }

  const sub = document.getElementById("parley-prompt-sub");
  if (sub) {
    if (!show) {
      sub.textContent = "";
    } else if (coolingDown && game.negotiationHighlight) {
      sub.textContent = "Brief pause before you can try again…";
    } else if (game.negotiationHighlight) {
      sub.textContent = "Hostile in view — press F";
    } else {
      sub.textContent = "Get closer or face them to parley";
    }
  }
}
