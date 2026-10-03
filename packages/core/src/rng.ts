export type Rng = () => number;

/** Hash any string into a 32-bit seed (xmur3). */
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Small, fast, seedable PRNG (mulberry32). Same seed, same draft. */
export function createRng(seed: string | number = randomSeed()): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = (): string => Math.random().toString(36).slice(2, 10);

export function pickOne<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return pickOne(rng, items);
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Random order where heavier items tend to come first (Efraimidis–Spirakis). */
export function weightedShuffle<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, key: rng() ** (1 / Math.max(weight(item), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}
