import { createRng, HEROES, heroImages, shuffle } from '@dota-picker/core';
import { preload } from './ui';

const POOL_SIZE = 30;
let pool: number[] = [];

/** Picks and preloads a small set of portraits for the spinning reels. */
export function warmReel(): void {
  if (pool.length) return;
  const heroes = shuffle(createRng(), HEROES).slice(0, POOL_SIZE);
  pool = heroes.map((h) => h.id);
  preload(heroes.map(heroImages.portrait));
}

export function reelFrames(finalId: number, count: number): number[] {
  warmReel();
  return shuffle(createRng(), pool.filter((id) => id !== finalId)).slice(0, count);
}
