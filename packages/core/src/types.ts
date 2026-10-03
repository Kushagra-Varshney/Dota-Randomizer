export type Position = 1 | 2 | 3 | 4 | 5;
export const POSITIONS: readonly Position[] = [1, 2, 3, 4, 5];

export type Attr = 'str' | 'agi' | 'int' | 'all';
export type AttackType = 'Melee' | 'Ranged';

/** Hand-curated tags used by themed drafts and the wombo filler. */
export type HeroTag = 'global' | 'invis' | 'push' | 'lockdown' | 'teamfight' | 'summons';

/** Hero as it comes from OpenDota. */
export interface BaseHero {
  id: number;
  /** Internal name without the `npc_dota_hero_` prefix, also used for CDN image paths. */
  key: string;
  name: string;
  attr: Attr;
  attack: AttackType;
  roles: string[];
}

export interface Hero extends BaseHero {
  /** Positions the hero is commonly played in, best first. */
  positions: Position[];
  tags: HeroTag[];
}

export interface Player {
  id: string;
  name: string;
  color: string;
  /** Preferred positions, favourite first. Empty means "anything". */
  roles: Position[];
  /** Heroes this player never wants to be drafted. */
  bans: number[];
  createdAt: number;
}

export type DraftMode = 'standard' | 'random' | 'wombo' | 'chaos' | 'theme';

export type ThemeId =
  | 'melee'
  | 'ranged'
  | 'str'
  | 'agi'
  | 'int'
  | 'all'
  | 'global'
  | 'invis'
  | 'push'
  | 'lockdown'
  | 'summons';

export interface DraftSlot {
  playerId: string | null;
  name: string;
  color: string;
  position: Position;
  /** One hero, or several to choose from when the draft offers choices. */
  heroes: number[];
  /** Index into `heroes` of the chosen hero, or null while undecided. */
  pick: number | null;
  locked?: boolean;
}

export interface Draft {
  id: string;
  createdAt: number;
  mode: DraftMode;
  theme?: ThemeId;
  comboId?: string;
  slots: DraftSlot[];
}
