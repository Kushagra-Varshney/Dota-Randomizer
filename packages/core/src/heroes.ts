import { BASE_HEROES } from './data/heroes.generated';
import { HERO_META } from './data/hero-meta';
import type { Attr, Hero, Position } from './types';

/** Fallback for heroes missing curated meta (e.g. right after a new hero ships). */
function derivePositions(roles: string[]): Position[] {
  const positions = new Set<Position>();
  if (roles.includes('Carry')) positions.add(1);
  if (roles.includes('Nuker') && !roles.includes('Support')) positions.add(2);
  if (roles.includes('Initiator') || roles.includes('Durable')) positions.add(3);
  if (roles.includes('Support')) {
    positions.add(4);
    positions.add(5);
  }
  return positions.size ? [...positions] : [1, 2, 3, 4, 5];
}

export const HEROES: readonly Hero[] = BASE_HEROES.map((hero) => {
  const meta = HERO_META[hero.key];
  return {
    ...hero,
    positions: meta?.pos ?? derivePositions(hero.roles),
    tags: meta?.tags ?? [],
  };
});

export const HERO_BY_ID: ReadonlyMap<number, Hero> = new Map(HEROES.map((h) => [h.id, h]));
export const HERO_BY_KEY: ReadonlyMap<string, Hero> = new Map(HEROES.map((h) => [h.key, h]));

export const getHero = (id: number): Hero | undefined => HERO_BY_ID.get(id);

export const fitsPosition = (hero: Hero, position: Position): boolean =>
  hero.positions.includes(position);

export const ATTR_INFO: Record<Attr, { label: string; short: string }> = {
  str: { label: 'Strength', short: 'STR' },
  agi: { label: 'Agility', short: 'AGI' },
  int: { label: 'Intelligence', short: 'INT' },
  all: { label: 'Universal', short: 'UNI' },
};

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2';

export const heroImages = {
  /** 256×144 landscape portrait with painted background. */
  portrait: (hero: Hero) => `${CDN}/images/dota_react/heroes/${hero.key}.png`,
  /** 400×250 transparent cut-out. */
  crop: (hero: Hero) => `${CDN}/images/dota_react/heroes/crops/${hero.key}.png`,
  /** 32×32 minimap icon. */
  icon: (hero: Hero) => `${CDN}/images/dota_react/heroes/icons/${hero.key}.png`,
};
