import type { Player } from '@dota-picker/core';
import { PLAYER_COLORS } from './ui';

/** First in-game slot colour nobody in the squad uses yet. */
export function nextColor(players: Player[]): string {
  const used = new Set(players.map((p) => p.color.toLowerCase()));
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length]!;
}
