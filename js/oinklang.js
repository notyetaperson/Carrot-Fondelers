/**
 * Pig cipher: each English letter maps to a token built from “oink” syllables.
 * Letters in a word are separated by a single space; English words by two spaces.
 * (Agreeability multiplier: pigs roll persuasion as if winChance were this much higher.)
 */
export const OINK_AGREEABILITY_MULT = 1.7;

/** @type {readonly string[]} a–z */
const LETTER_TO_OINK = [
  "oink", // a
  "oinkie", // b
  "oinkeroink", // c
  "oinkeroinkie", // d
  "onk", // e
  "onkie", // f
  "onkeroink", // g
  "onkeroinkie", // h
  "nik", // i
  "nikie", // j
  "nikeroink", // k
  "nikeroinkie", // l
  "ink", // m
  "inkie", // n
  "inkeroink", // o
  "inkeroinkie", // p
  "oinkoi", // q
  "oinkonk", // r
  "oinknik", // s
  "onkonk", // t
  "onknik", // u
  "nikonk", // v
  "niknik", // w
  "inkoi", // x
  "inkonk", // y
  "onkoi", // z
];

/** @type {Record<string, string>} */
const OINK_TO_LETTER = Object.fromEntries(
  LETTER_TO_OINK.map((token, i) => [token, String.fromCharCode(97 + i)]),
);

/**
 * Encode readable English into space-oink tokens (lowercase letters only; punctuation dropped).
 * @param {string} text
 */
export function englishToOink(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (const word of words) {
    const letters = [];
    for (const ch of word) {
      if (ch === "'") continue;
      const code = ch.charCodeAt(0) - 97;
      if (code >= 0 && code < 26) letters.push(LETTER_TO_OINK[code]);
    }
    if (letters.length) out.push(letters.join(" "));
  }
  return out.join("  ") || "oink";
}

/**
 * Decode pig cipher back to English (letters only; words separated by double space in cipher).
 * @param {string} cipher
 */
export function oinkToEnglish(cipher) {
  const words = cipher.trim().split(/\s{2,}/);
  const out = [];
  for (const w of words) {
    const tokens = w.trim().split(/\s+/).filter(Boolean);
    const chars = [];
    for (const t of tokens) {
      const L = OINK_TO_LETTER[t];
      if (L) chars.push(L);
    }
    if (chars.length) out.push(chars.join(""));
  }
  return out.join(" ");
}
