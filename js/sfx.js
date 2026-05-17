import {
  SFX_PIG_DEATH_URL,
  SFX_PIG_DEATH_VOLUME,
  SFX_PLAYER_DEATH_URL,
  SFX_PLAYER_DEATH_VOLUME,
} from "./config.js";

export function playPigDeathSfx() {
  if (!SFX_PIG_DEATH_URL) return;
  const a = new Audio(SFX_PIG_DEATH_URL);
  a.volume = SFX_PIG_DEATH_VOLUME;
  void a.play().catch(() => {});
}

export function playPlayerDeathSfx() {
  if (!SFX_PLAYER_DEATH_URL) return;
  const a = new Audio(SFX_PLAYER_DEATH_URL);
  a.volume = SFX_PLAYER_DEATH_VOLUME;
  void a.play().catch(() => {});
}
