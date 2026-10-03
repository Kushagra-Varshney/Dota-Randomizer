import type { Attr, DraftMode, Hero, HeroTag, ThemeId } from './types';

export interface ModeInfo {
  id: DraftMode;
  name: string;
  blurb: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: 'standard', name: 'Standard', blurb: 'Random heroes that actually fit their role' },
  { id: 'random', name: 'All Random', blurb: 'Any hero, any role. Pure chaos of the dice' },
  { id: 'wombo', name: 'Wombo Combo', blurb: 'A legendary ult combo plus teamfight filler' },
  { id: 'chaos', name: 'Off-Role', blurb: 'Supports carry, carries support. Good luck' },
  { id: 'theme', name: 'Themed', blurb: 'Whole stack follows one theme' },
];

export const getMode = (id: DraftMode): ModeInfo => MODES.find((m) => m.id === id) ?? MODES[0]!;

export interface Theme {
  id: ThemeId;
  name: string;
  blurb: string;
  match: (hero: Hero) => boolean;
}

const byAttr = (attr: Attr) => (h: Hero) => h.attr === attr;
const byTag = (tag: HeroTag) => (h: Hero) => h.tags.includes(tag);

export const THEMES: readonly Theme[] = [
  { id: 'melee', name: 'Knife Fight', blurb: 'Melee heroes only', match: (h) => h.attack === 'Melee' },
  { id: 'ranged', name: 'Artillery', blurb: 'Ranged heroes only', match: (h) => h.attack === 'Ranged' },
  { id: 'str', name: 'Strength', blurb: 'Every pick is a Strength hero', match: byAttr('str') },
  { id: 'agi', name: 'Agility', blurb: 'Every pick is an Agility hero', match: byAttr('agi') },
  { id: 'int', name: 'Intelligence', blurb: 'Every pick is an Intelligence hero', match: byAttr('int') },
  { id: 'all', name: 'Universal', blurb: 'Every pick is a Universal hero', match: byAttr('all') },
  { id: 'global', name: 'Global Presence', blurb: 'Heroes that reach across the whole map', match: byTag('global') },
  { id: 'invis', name: 'Now You See Me', blurb: 'Invisibility and stealth heroes', match: byTag('invis') },
  { id: 'push', name: 'Tower Rush', blurb: 'Pushers and deathball. End it by 25', match: byTag('push') },
  { id: 'lockdown', name: 'Stun Lock', blurb: 'Chain disables until they alt-F4', match: byTag('lockdown') },
  { id: 'summons', name: 'Micro Madness', blurb: 'Summons, illusions and units to control', match: byTag('summons') },
];

export const getTheme = (id: ThemeId | undefined): Theme | undefined => THEMES.find((t) => t.id === id);
