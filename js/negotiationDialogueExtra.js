/**
 * Extra pig parley lines — merged with `negotiationDialogue.js` in `negotiation.js`.
 * @typedef {{ text: string, winChance: number, accept: string[], reject: string[] }} NegotiationLine
 */

/** @type {NegotiationLine[]} */
export const NEGOTIATION_DIALOGUE_EXTRA = [
  {
    text: "I've cleared harder waves than this — stick with me and we feast on their mistakes.",
    winChance: 0.48,
    accept: [
      "Bold claim. Fine — I will eat my words if you eat theirs first.",
      "Deal. Your confidence is annoying and therefore probably useful.",
      "Yes. If you are lying, I will make sure the arena notices.",
    ],
    reject: [
      "Hard no. You sound like a trailer that spoils the bad ending.",
      "Denied. Come back when your resume is not just vibes.",
    ],
  },
  {
    text: "Split the aggro: I pull heat, you clean up — classic sandwich.",
    winChance: 0.44,
    accept: [
      "Ugh, textbook — but textbooks win. I will be the rude filling.",
      "Fine. I will flank while you cosplay a professional.",
      "Okay, sandwich. Do not let the bread get soggy.",
    ],
    reject: [
      "No. Your sandwich metaphor made me lose appetite for alliance.",
      "Denied. I am not a condiment in your PowerPoint.",
    ],
  },
  {
    text: "I've got potions, carrots, and spite — pick two and let's roll.",
    winChance: 0.52,
    accept: [
      "I pick spite and carrots. Keep the potions; I do not trust your inventory hygiene.",
      "Deal. Spite is renewable; I respect the economy.",
      "Yes. Potions optional — spite mandatory.",
    ],
    reject: [
      "Refused. That inventory sounds like a yard sale in a swamp.",
      "No deal. Spite is fine; your packing list is cursed.",
    ],
  },
];
