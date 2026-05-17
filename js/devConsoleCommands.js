import {
  DUNGEON_STAGES,
  HOMOHANDS_PICKUP,
  MID_AIR_JUMP_COUNT,
  POTION_SPECS,
  POWERFUL_WEAPON_PICKUPS,
} from "./config.js";
import { devInstaKillAllHostiles } from "./enemies.js";
import { applyDamage, restoreFullHealth, syncHealthHud } from "./health.js";
import { addPotionToInventory, syncWeaponHud } from "./pickups.js";
import { game, move } from "./state.js";

const POTION_IDS = new Set(POTION_SPECS.map((s) => s.id));

function refreshDevConsoleGateFromGive() {
  void import("./devConsole.js").then((m) => m.syncDevConsoleHomohandsGate());
}

/** @param {string} name */
function resolvePotionId(name) {
  const n = name.toLowerCase().replace(/[\s-]+/g, "_");
  if (POTION_IDS.has(n)) return n;
  const c = n.replace(/_/g, "");
  for (const spec of POTION_SPECS) {
    if (spec.id.replace(/_/g, "") === c) return spec.id;
  }
  return null;
}

/** @param {string} q */
function findPowerfulPick(q) {
  const qn = q.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!qn || qn === "power" || qn === "powerful" || qn === "random")
    return null;
  for (const p of POWERFUL_WEAPON_PICKUPS) {
    const slug = p.label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (slug === qn || slug.includes(qn) || qn.includes(slug)) return p;
  }
  return null;
}

/** @param {{ log: (s: string) => void }} inv */
function giveUsage(inv) {
  inv.log("  usage: give <item> [count]");
  inv.log(
    "  weapons: fists | carrot | bow | deagle | homohands | power (random) | <substring of powerful name>",
  );
  inv.log("  other: airjump | devunlock | allpotions");
  inv.log(`  potions: ${[...POTION_IDS].sort().join(", ")}`);
}

/**
 * @typedef {{
 *   scene: import("three").Scene,
 *   loader: import("three/addons/loaders/GLTFLoader.js").GLTFLoader,
 *   advanceLevel: () => Promise<void>,
 *   togglePause?: () => void,
 *   getPlayer?: () => import("three").Group,
 * }} DevConsoleContext
 */

/**
 * @typedef {{
 *   log: (s: string) => void,
 *   clearLog: () => void,
 *   ctx: DevConsoleContext | null,
 * }} DevInvoke
 */


const TIPS = [
  "Carrot Fondelers tip: F parleys — orange bottom sign when a hostile in view is in range.",
  "Tip: Triple jump — three Space presses before you land.",
  "Tip: Allied pigs follow you after a successful parley.",
  "Tip: Crystal wave uses Pig (2).glb — bump ENEMY_CRYSTAL revision after edits.",
  "Tip: Dev `god` blocks pig contact; `hurt` / `die` still work.",
  "Tip: Spawn protection fades — use `hurt` to test damage.",
  "Tip: Shift sprints; camera FOV widens while sprinting.",
  "Tip: Kill counter tracks melee kills this wave.",
  "Tip: BGM picks a random track from BGM_TRACKS on load.",
  "Tip: `level` cycles Arena → Crystal → all dungeons in DUNGEON_STAGES (dev).",
  "Tip: Pigs in different squads may brawl when you're far away.",
  "Tip: Carrot / bow / Eagle drops scale up on later levels; bolt & carrot dmg scale too; pigs bump harder each stage.",
  "Tip: Procedural potions include mending (regen), stone skin (less hurt), gilded reach (melee range), second wind (big instant heal, no long buff slot), swift syrup (faster bolts).",
  "Tip: Extra parley pitches live in negotiationDialogueExtra.js — merged into the main table at runtime.",
  "Tip: Esc closes the dev console if it's open.",
  "Tip: Dev console only works after Homohands (FB drop); Y toggles it (also when paused).",
  "Tip: `clear` wipes the dev log only.",
  "Tip: `stats` prints a quick state dump.",
  "Tip: `refill` tops jumps mid-air for testing.",
  "Tip: `carrot` / `fists` swap melee without a pickup.",
  "Tip: `pausecmd` toggles the pause menu.",
  "Tip: `rise` / `sink` nudge your Y for stuck tests.",
  "Tip: Negotiation uses local dialogue tables (no network).",
  "Tip: PostFX (bloom/fog) lives in postfx.js + config.",
  "Tip: ENEMY_DEATH_FADE_PER_SEC controls corpse fade speed.",
  "Tip: `kill` and its 30+ synonyms insta-clear hostiles.",
  "Tip: `talk` has many synonyms — all queue negotiation.",
  "Tip: Player regen ticks in health.js when alive.",
  "Tip: Level bounds clamp pigs and player on XZ.",
  "Tip: Merged collision proxy speeds up ground raycasts.",
  "Tip: `echo` repeats your words back.",
  "Tip: `respawncmd` sets requestRespawn if you're down.",
  "Tip: `heal` / `patch` partial heal; `fullheal` max HP.",
  "Tip: `mortal` turns god mode off.",
  "Tip: Oink.",
  "Tip: The carrot is also a fondeler.",
  "Tip: levelIndex 0–1 = Arena & Crystal; 2+ = each dungeon in order (see config DUNGEON_STAGES).",
  "Tip: `wave` prints enemiesRemaining + waveSpawned.",
  "Tip: `coords` logs rough player position.",
  "Tip: Try `tip17` through `tip40` for more crumbs.",
  "Tip: Command count is huge on purpose.",
  "Tip: Many commands are jokes; some do real work.",
];

const OINKS = [
  "oink",
  "oinK",
  "OINK",
  "oink!",
  "oink?",
  "o i n k",
  "snort",
  "squeal (polite)",
  "grunt (porcine)",
];

const FLAVOR_LINES = [
  "The console appreciates your curiosity.",
  "Carrot telemetry nominal.",
  "Pig pipeline idle. Oink buffer warm.",
  "Negotiation daemon says hi.",
  "No shaders were harmed.",
  "Bloom intensity emotionally stable.",
  "Skybox is judging your jumps.",
  "Collision proxy sends regards.",
  "Melee cooldown respects you.",
  "Regen tick thinks you're neat.",
];

/**
 * @param {DevInvoke} inv
 * @param {string} msg
 */
function needCtx(inv, msg) {
  if (!inv.ctx) inv.log(`  ${msg}`);
}

/**
 * @param {string[]} parts
 */
function numArg(parts, fallback) {
  const n = parseFloat(parts[1] ?? "");
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @returns {Map<string, (parts: string[], raw: string, inv: DevInvoke) => void | Promise<void>>}
 */
function buildRegistry() {
  const R = new Map();
  /** @param {(parts: string[], raw: string, inv: DevInvoke) => void | Promise<void>} fn */
  const add = (fn, ...names) => {
    for (const n of names) {
      if (R.has(n)) {
        console.warn(`[dev] duplicate command ignored: ${n}`);
        continue;
      }
      R.set(n, fn);
    }
  };

  const cmdDie = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    applyDamage(game.maxHealth + 99, "dev");
    inv.log("  player down");
  };

  const cmdKill = async (parts, raw, inv) => {
    needCtx(inv, "(no context)");
    if (!inv.ctx) return;
    inv.log(`> ${raw}`);
    const n = devInstaKillAllHostiles(inv.ctx.scene, inv.ctx.loader);
    inv.log(n ? `  killed ${n} hostile(s)` : "  no living hostiles");
  };

  const cmdTalk = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    if (game.playerDead) {
      inv.log("  player dead");
      return;
    }
    game.requestNegotiate = true;
    inv.log("  requestNegotiate set");
  };

  const cmdLevel = async (parts, raw, inv) => {
    needCtx(inv, "(no context)");
    if (!inv.ctx) return;
    inv.log(`> ${raw}`);
    if (game.levelTransitioning) {
      inv.log("  level transition in progress");
      return;
    }
    try {
      await inv.ctx.advanceLevel();
      const levelNames = [
        "Arena",
        "Crystal",
        ...DUNGEON_STAGES.map((s) => s.displayName),
        "FB Arena",
      ];
      inv.log(
        `  loaded ${levelNames[game.levelIndex] ?? "?"} (index ${game.levelIndex})`,
      );
    } catch (err) {
      console.error(err);
      inv.log(`  error: ${err}`);
    }
  };

  const cmdHelp = (parts, raw, inv) => {
    inv.log(
      `> help\n  ${R.size} registered names (each synonym counts once). Examples: die kill give help talk level heal hurt god carrot stats clear pausecmd refill rise sink wave coords echo respawncmd fullheal mortal fists tip17 oink7 fluff12 — try anything food or pig related. Type lall for the full sorted list.`,
    );
  };

  const cmdListAll = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    const names = Array.from(R.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    inv.log(`  ${names.length} names (alphabetical, multiple lines):`);
    const perLine = 14;
    for (let i = 0; i < names.length; i += perLine) {
      inv.log(`  ${names.slice(i, i + perLine).join(" · ")}`);
    }
  };

  const cmdClear = (parts, raw, inv) => {
    inv.clearLog();
    inv.log("  log cleared");
  };

  const cmdHeal = (parts, raw, inv) => {
    const amt = numArg(parts, 25);
    inv.log(`> ${raw}`);
    if (game.playerDead) {
      inv.log("  player dead — try respawncmd / R");
      return;
    }
    game.health = Math.min(game.maxHealth, game.health + amt);
    syncHealthHud();
    inv.log(`  +${amt} hp → ${Math.ceil(game.health)}`);
  };

  const cmdFullHeal = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    if (game.playerDead) {
      inv.log("  player dead");
      return;
    }
    restoreFullHealth();
    inv.log("  full heal");
  };

  const cmdHurt = (parts, raw, inv) => {
    const amt = numArg(parts, 10);
    inv.log(`> ${raw}`);
    applyDamage(amt, "dev");
    inv.log(`  -${amt} hp (dev) → ${Math.ceil(game.health)}`);
  };

  const cmdGod = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.devGodMode = true;
    inv.log("  god on (pig contact ignored)");
  };

  const cmdMortal = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.devGodMode = false;
    inv.log("  god off");
  };

  const cmdCarrot = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.hasCarrotWeapon = true;
    game.hasPowerfulMeleeWeapon = false;
    game.powerfulWeaponLabel = "";
    syncWeaponHud();
    inv.log("  carrot equipped");
  };

  const cmdBow = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.hasBowWeapon = true;
    syncWeaponHud();
    inv.log("  cool bow equipped");
  };

  const cmdDeagle = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.hasDeagleWeapon = true;
    syncWeaponHud();
    inv.log("  Desert Eagle equipped");
  };

  const cmdFists = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    game.hasCarrotWeapon = false;
    game.hasPowerfulMeleeWeapon = false;
    game.powerfulWeaponLabel = "";
    game.hasBowWeapon = false;
    game.hasDeagleWeapon = false;
    syncWeaponHud();
    inv.log("  fists");
  };

  const GIVE_CANON = {
    fist: "fists",
    homo: "homohands",
    homohands: "homohands",
    devhands: "homohands",
    eagle: "deagle",
    pistol: "deagle",
    jumps: "airjump",
    airjumps: "airjump",
    extrajump: "airjump",
    air_jump: "airjump",
    console: "devunlock",
    devunlock: "devunlock",
    devkey: "devunlock",
    yunlock: "devunlock",
    powerful: "power",
    melee: "power",
    randompower: "power",
  };

  const cmdGive = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    const t = raw.trim().toLowerCase().split(/\s+/);
    const verb = t[0] ?? "";
    if (
      t.length < 2 ||
      !/^(give|grant|loot|spawnitem)$/.test(verb)
    ) {
      giveUsage(inv);
      return;
    }
    let hi = t.length;
    let count = 1;
    if (hi >= 3 && /^\d+$/.test(t[hi - 1] ?? "")) {
      count = Math.min(999, Math.max(1, parseInt(t[hi - 1], 10)));
      hi--;
    }
    const itemSlug = t.slice(1, hi).join("_");
    if (!itemSlug || itemSlug === "help" || itemSlug === "?" || itemSlug === "list") {
      giveUsage(inv);
      return;
    }

    const key = GIVE_CANON[itemSlug] ?? itemSlug;

    if (key === "allpotions") {
      for (let r = 0; r < count; r++) {
        for (const spec of POTION_SPECS) {
          addPotionToInventory(spec.id);
        }
      }
      inv.log(
        `  ran ${count} pass(es) over all potion ids (each add respects per-type cap)`,
      );
      syncWeaponHud();
      return;
    }

    if (key === "devunlock") {
      game.devConsoleUnlocked = true;
      refreshDevConsoleGateFromGive();
      inv.log("  dev console unlocked — press Y (no weapon granted)");
      return;
    }

    if (key === "airjump") {
      game.bonusMidAirJumps += count;
      move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
      inv.log(
        `  bonusMidAirJumps=${game.bonusMidAirJumps} airJumpsRemaining=${move.airJumpsRemaining}`,
      );
      return;
    }

    if (key === "fists") {
      game.hasCarrotWeapon = false;
      game.hasPowerfulMeleeWeapon = false;
      game.powerfulWeaponLabel = "";
      game.hasBowWeapon = false;
      game.hasDeagleWeapon = false;
      syncWeaponHud();
      inv.log("  fists");
      return;
    }
    if (key === "carrot") {
      game.hasCarrotWeapon = true;
      game.hasPowerfulMeleeWeapon = false;
      game.powerfulWeaponLabel = "";
      syncWeaponHud();
      inv.log("  carrot equipped");
      return;
    }
    if (key === "bow") {
      game.hasBowWeapon = true;
      syncWeaponHud();
      inv.log("  cool bow equipped");
      return;
    }
    if (key === "deagle") {
      game.hasDeagleWeapon = true;
      syncWeaponHud();
      inv.log("  Desert Eagle equipped");
      return;
    }

    if (key === "homohands") {
      game.hasPowerfulMeleeWeapon = true;
      game.hasCarrotWeapon = false;
      game.powerfulWeaponLabel = HOMOHANDS_PICKUP.label;
      game.devConsoleUnlocked = true;
      syncWeaponHud();
      void import("./devConsole.js").then((m) => m.onHomohandsDevUnlock());
      return;
    }

    if (key === "power") {
      const pick =
        POWERFUL_WEAPON_PICKUPS[
          (Math.random() * POWERFUL_WEAPON_PICKUPS.length) | 0
        ];
      game.hasPowerfulMeleeWeapon = true;
      game.hasCarrotWeapon = false;
      game.powerfulWeaponLabel = pick.label;
      syncWeaponHud();
      inv.log(`  powerful melee: ${pick.label}`);
      return;
    }

    const powPick = findPowerfulPick(itemSlug);
    if (powPick) {
      game.hasPowerfulMeleeWeapon = true;
      game.hasCarrotWeapon = false;
      game.powerfulWeaponLabel = powPick.label;
      syncWeaponHud();
      inv.log(`  powerful melee: ${powPick.label}`);
      return;
    }

    const pid = resolvePotionId(itemSlug) ?? resolvePotionId(key);
    if (pid) {
      let added = 0;
      for (let i = 0; i < count; i++) {
        if (!addPotionToInventory(pid)) break;
        added++;
      }
      inv.log(`  +${added}× ${pid} (hotbar inventory, per-type cap)`);
      return;
    }

    inv.log('  unknown item — type "give help" for ids');
  };

  const cmdStats = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.log(
      `  lv ${game.levelIndex} | hp ${Math.ceil(game.health)}/${game.maxHealth} | dead ${game.playerDead} | god ${game.devGodMode} | deagle ${game.hasDeagleWeapon} | bow ${game.hasBowWeapon} | pow ${game.hasPowerfulMeleeWeapon} | carrot ${game.hasCarrotWeapon} | allies ${game.alliedPigCount} | kills ${game.enemyKills} | remain ${game.enemiesRemaining} | airJumps ${move.airJumpsRemaining} (+${game.bonusMidAirJumps} bonus) | potion ${game.activePotionKind ?? "—"}`,
    );
  };

  const cmdWave = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.log(
      `  enemiesRemaining=${game.enemiesRemaining} waveSpawned=${game.waveSpawned} transitioning=${game.levelTransitioning}`,
    );
  };

  const cmdRefill = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    move.airJumpsRemaining = MID_AIR_JUMP_COUNT + game.bonusMidAirJumps;
    inv.log(`  airJumps=${move.airJumpsRemaining}`);
  };

  const cmdPause = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.ctx?.togglePause?.();
    inv.log(`  pause toggled → ${game.paused}`);
  };

  const cmdRise = (parts, raw, inv) => {
    const p = inv.ctx?.getPlayer?.();
    inv.log(`> ${raw}`);
    if (!p) {
      inv.log("  no player ref");
      return;
    }
    p.position.y += 1.25;
    inv.log("  +Y");
  };

  const cmdSink = (parts, raw, inv) => {
    const p = inv.ctx?.getPlayer?.();
    inv.log(`> ${raw}`);
    if (!p) {
      inv.log("  no player ref");
      return;
    }
    p.position.y -= 1.25;
    inv.log("  -Y");
  };

  const cmdCoords = (parts, raw, inv) => {
    const p = inv.ctx?.getPlayer?.();
    inv.log(`> ${raw}`);
    if (!p) {
      inv.log("  no player ref");
      return;
    }
    inv.log(
      `  x ${p.position.x.toFixed(2)} y ${p.position.y.toFixed(2)} z ${p.position.z.toFixed(2)}`,
    );
  };

  const cmdEcho = (parts, raw, inv) => {
    const rest = raw.replace(/^\s*\S+\s*/, "").trim();
    inv.log(`> ${raw}`);
    inv.log(rest ? `  ${rest}` : "  (nothing to echo)");
  };

  const cmdRespawn = (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    if (!game.playerDead) {
      inv.log("  not down");
      return;
    }
    game.requestRespawn = true;
    inv.log("  requestRespawn set");
  };

  const cmdFlavor = (ix) => (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.log(`  ${FLAVOR_LINES[ix % FLAVOR_LINES.length]}`);
  };

  const cmdTip = (ix) => (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.log(`  ${TIPS[ix % TIPS.length]}`);
  };

  const cmdOink = (ix) => (parts, raw, inv) => {
    inv.log(`> ${raw}`);
    inv.log(`  ${OINKS[ix % OINKS.length]}`);
  };

  // --- register: death / suicide (40+) ---
  add(cmdDie, "die", "death", "dying", "down", "ko", "koed", "fatality", "gameover", "gg", "rip", "perish", "expire", "succumb", "faint", "drop", "wipedout", "fail", "ded", "deaded", "unalive", "sleep", "nap", "rest", "bye", "later", "ouch", "ow", "boom", "blast", "yeetself", "selfdestruct", "abort", "haltlife", "endme", "endrun", "bonk", "facetile", "loser", "timeout", "tapout", "forfeit", "concede", "eliminated", "terminated", "shutdown", "bluecreen", "ragequit", "altf4", "disconnect", "desync", "oof", "wah", "wahhh", "deded", "squish", "crunch", "thud", "thump", "splat", "faceplant", "eatdirt", "kneel", "collapse", "falldown", "trip", "stumble", "hurtmeplenty", "hurtrealbad", "ouchies", "hospital", "knockout", "ko_me", "iamdead", "playdead", "pretenddead", "actuallydead");

  // --- kill pigs (45+) ---
  add(cmdKill, "kill", "killing", "slay", "slaughter", "cull", "purge", "exterminate", "annihilate", "erasepigs", "nopigs", "bacon", "ham", "pork", "sausage", "bbq", "smokehouse", "deli", "breakfast", "brunch", "lard", "rinds", "chop", "mince", "tenderize", "filet", "shank", "snout", "trotter", "oinkstorm", "pigclear", "hostileclear", "waveclear", "clearenemies", "killall", "killhostiles", "murder", "destroy", "obliterate", "squash", "stomp", "deletepigs", "despawnpigs", "removepigs", "thanos", "snap", "dust", "vaporize", "liquidate", "neutralize", "pacify", "silence", "shush", "quiet", "nukesite", "airstrike", "orbital", "laser", "pewpew", "pew", "zap", "fry", "crisp", "carbonize", "void", "sendtothefarm", "upstate", "cornfield", "tractorpull", "combine", "harvest", "reap", "mow");

  // --- talk / negotiate (40+) ---
  add(cmdTalk, "talk", "talking", "negotiate", "negotiation", "parley", "parlay", "diplomacy", "debate", "discuss", "chat", "converse", "dialogue", "speak", "hail", "address", "plead", "reason", "bargain", "deal", "treaty", "truce", "ceasefire", "summit", "forum", "deliberate", "mediate", "arbitrate", "schmooze", "sweettalk", "flatter", "cajole", "woo", "befriend", "ally", "recruit", "convince", "persuade", "charm", "charisma", "rollpersuasion", "diplomacycheck", "pigchat", "pigtalk", "oinktalk", "gruntchat", "squealchat", "pressf", "fkey", "usef", "negotiate_now", "talktothem", "talktothehand", "usewords", "verbal", "nonviolent", "peace", "peaceoffer", "olivebranch", "carrotoffer", "carrotstick", "diplomatic", "embassy", "envoy", "herald", "heraldry", "proposal", "motion", "amendment", "clause", "fineprint");

  // --- level warp (35+) ---
  add(cmdLevel, "level", "levelup", "up", "next", "warp", "map", "travel", "goto", "crystallize", "crystal", "arena", "stage", "stager", "scene", "loadnext", "loadprev", "swapmap", "togglemap", "fliplevel", "dimension", "rift", "portal", "wormhole", "stairs", "elevator", "escalator", "progress", "advance", "continue", "proceed", "mission", "objective", "chapter", "book", "folio", "leaf", "slice", "tier", "plank", "deck", "zone", "biome", "instance", "queue", "matchmake", "lobby", "rotatelevel", "pingpongmap", "backandforth");

  // --- heal / restore (18+) ---
  add(cmdHeal, "heal", "patch", "bandage", "medkit", "potion", "sip", "gulp", "snack", "regenburst", "secondwind", "pickmeup", "tonic", "elixir", "doc", "nurse", "stim", "stimpak", "repairhp");
  add(cmdFullHeal, "fullheal", "maxhp", "restore", "revitalize", "renew", "refresh", "full", "tophp", "overcharge", "greenbar", "vitality", "wellness", "spa", "massage", "detox", "cleanse");

  // --- hurt (12+) ---
  add(cmdHurt, "hurt", "damage", "hitme", "punchme", "scratch", "bite", "sting", "burn", "shock", "bleed", "chip", "ticklehurt");

  // --- god / mortal (14+) ---
  add(cmdGod, "god", "godmode", "invuln", "invulnerable", "immortal", "tank", "bulletsproof", "ironpig", "steel", "diamond", "shield", "bubble", "ward");
  add(cmdMortal, "mortal", "ungod", "nogod", "vulnerable", "soft", "squishy", "glass", "paper", "offgod", "reality", "nerfme", "fair", "honestmode");

  // --- weapons (16+) ---
  add(cmdCarrot, "carrot", "weapon", "orange", "veg", "veggie", "crunchy", "beta", "vitamina", "root", "taproot", "snackstick", "salad", "roastcarrot", "glazed", "honeyglaze");
  add(
    cmdBow,
    "bow",
    "coolbow",
    "longbow",
    "shortbow",
    "crossbow",
    "arrow",
    "bolt",
    "ranged",
    "archery",
    "quiver",
    "projectile",
  );
  add(
    cmdDeagle,
    "deagle",
    "deserteagle",
    "eagle",
    "pistol",
    "handgun",
    "magnum",
    "fiftyae",
    "sidearm",
    "piece",
    "nine",
  );
  add(cmdFists, "fists", "fist", "unarmed", "barehand", "brass", "knuckle", "punchy", "boxing", "mma", "brawl", "meleeonly", "nofunallowed", "vanilla");
  add(cmdGive, "give", "grant", "loot", "spawnitem");

  // --- meta (12+) ---
  add(cmdHelp, "help", "?", "commands", "list", "halp", "how", "manual", "readme", "docs", "usage", "syntax");
  add(
    cmdListAll,
    "lall",
    "listall",
    "cmdlist",
    "allcmds",
    "everycmd",
    "dumpcmds",
    "who",
  );
  add(cmdClear, "clear", "cls", "resetlog", "empty", "wipe", "clean", "scrub", "erase", "fresh");
  add(cmdStats, "stats", "stat", "status", "info", "dump", "snapshot", "debugstate", "whoami", "inspect", "telemetry");
  add(cmdWave, "wave", "remaining", "enemies", "hostiles", "count", "tally", "scoreboard");
  add(cmdRefill, "refill", "refilljumps", "jumps", "triple", "trampo", "spring", "bouncebank", "aircharges", "charges");
  add(cmdPause, "pausecmd", "pausegame", "menutoggle", "break", "coffee", "brb", "afk");
  add(cmdRise, "rise", "uppy", "float", "levitate", "elevate", "boosty", "jet", "hopup", "sky", "moon");
  add(cmdSink, "sink", "downy", "burrow", "dig", "lower", "dropy", "gravitypls", "crouchhard", "basement");
  add(cmdCoords, "coords", "pos", "position", "where", "loc", "xyz", "gps", "nav", "fixposition");
  add(cmdEcho, "echo", "say", "print", "repeat", "parrot", "copy", "mirror", "type", "shout");
  add(cmdRespawn, "respawncmd", "respawn", "stand", "getup", "riseagain", "undie", "unrip", "retry", "checkpoint");

  // --- numbered tips 40 (tip1..tip40, hint1..hint40) ---
  for (let i = 0; i < 40; i++) {
    add(cmdTip(i), `tip${i + 1}`, `hint${i + 1}`);
  }

  // --- oink bank 24 ---
  for (let i = 0; i < 24; i++) {
    add(cmdOink(i), `oink${i + 1}`, `snort${i + 1}`);
  }

  // --- fluff lines 32 ---
  for (let i = 0; i < 32; i++) {
    add(cmdFlavor(i), `fluff${i + 1}`, `vibe${i + 1}`, `lore${i + 1}`);
  }

  // --- micro-variations: kill01..kill15 (same as kill) ---
  for (let i = 1; i <= 15; i++) {
    add(cmdKill, `kill${i}`, `slay${i}`, `cull${i}`);
  }

  // --- die01..die12 ---
  for (let i = 1; i <= 12; i++) {
    add(cmdDie, `die${i}`, `death${i}`, `rip${i}`);
  }

  // --- talk01..talk10 ---
  for (let i = 1; i <= 10; i++) {
    add(cmdTalk, `talk${i}`, `parley${i}`, `f${i}`);
  }

  // --- level01..level08 ---
  for (let i = 1; i <= 8; i++) {
    add(cmdLevel, `level${i}`, `warp${i}`, `map${i}`);
  }

  // --- heal01..heal06 with numeric suffix still use cmdHeal (arg optional) ---
  for (let i = 1; i <= 6; i++) {
    add(cmdHeal, `heal${i}`, `patch${i}`);
  }

  return R;
}

const devCommandRegistry = buildRegistry();
export const DEV_COMMAND_COUNT = devCommandRegistry.size;

/**
 * @param {DevConsoleContext | null} ctx
 * @param {string} line
 * @param {(s: string) => void} log
 * @param {() => void} clearLog
 */
export async function runDevConsoleLine(ctx, line, log, clearLog) {
  const raw = line.trim();
  if (!raw) return;
  const parts = raw.toLowerCase().split(/\s+/);
  const cmd = parts[0] ?? "";

  const fn = devCommandRegistry.get(cmd);
  const inv = { log, clearLog, ctx };
  if (fn) {
    await fn(parts, raw, inv);
    return;
  }

  log(`> ${raw}\n  unknown command (try help) — ${DEV_COMMAND_COUNT} cmds`);
}
