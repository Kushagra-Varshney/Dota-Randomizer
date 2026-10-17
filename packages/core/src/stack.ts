import { generateDraft, MAX_CHOICES, MAX_STACK, pickedHeroId, type ComboChoice, type DraftResult, type RoleMode, type SlotInput, type ThemeChoice } from './draft';
import { MODES, THEMES } from './modes';
import { isPosition } from './positions';
import { POSITIONS, type Draft, type DraftMode, type DraftSlot, type Player, type Position } from './types';

/** The settings that shape a draft. Shared by the web app and the Discord bot. */
export interface DraftSettings {
  mode: DraftMode;
  theme: ThemeChoice;
  comboStyle: ComboChoice;
  roles: RoleMode;
  positions: Position[];
  choices: number;
  /** How many recent saved drafts to steer away from (0 = off). */
  avoidRecent: number;
  /** Heroes nobody gets. */
  bans: number[];
  /** Selected squad player ids, in selection order. */
  selected: string[];
  guests: number;
  /** Position locks for this session, keyed by slot key. */
  fixedRoles: Record<string, Position>;
}

export const DEFAULT_DRAFT_SETTINGS: DraftSettings = {
  mode: 'standard',
  theme: 'surprise',
  comboStyle: 'all',
  roles: 'random',
  positions: [...POSITIONS],
  choices: 1,
  avoidRecent: 0,
  bans: [],
  selected: [],
  guests: 0,
  fixedRoles: {},
};

export const MAX_AVOID_RECENT = 10;
export const GUEST_COLOR = '#8b96a8';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const uniq = <T>(items: T[]) => [...new Set(items)];
const intIn = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;
const COMBO_CHOICES: readonly ComboChoice[] = ['all', 'classic', 'meme'];

/** Settings from storage (D1 JSON, localStorage) are untrusted: keep what's valid, default the rest. */
export function sanitizeDraftSettings(raw: unknown): DraftSettings {
  const d = DEFAULT_DRAFT_SETTINGS;
  if (!isObj(raw)) return { ...d, positions: [...d.positions] };
  const positions = uniq(arr(raw.positions).filter(isPosition));
  const fixedRoles = isObj(raw.fixedRoles)
    ? Object.fromEntries(
        Object.entries(raw.fixedRoles)
          .filter((e): e is [string, Position] => e[0].length <= 100 && isPosition(e[1]))
          .slice(0, MAX_STACK),
      )
    : {};
  return {
    mode: MODES.find((m) => m.id === raw.mode)?.id ?? d.mode,
    theme: raw.theme === 'surprise' ? 'surprise' : (THEMES.find((t) => t.id === raw.theme)?.id ?? d.theme),
    comboStyle: COMBO_CHOICES.find((c) => c === raw.comboStyle) ?? d.comboStyle,
    roles: raw.roles === 'preferred' ? 'preferred' : 'random',
    positions: positions.length ? positions : [...d.positions],
    choices: intIn(raw.choices, 1, MAX_CHOICES, d.choices),
    avoidRecent: intIn(raw.avoidRecent, 0, MAX_AVOID_RECENT, d.avoidRecent),
    bans: uniq(arr(raw.bans).filter((v): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < 1000)).slice(0, 200),
    selected: uniq(arr(raw.selected).filter((v): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v))).slice(0, MAX_STACK),
    guests: intIn(raw.guests, 0, MAX_STACK, d.guests),
    fixedRoles,
  };
}

export interface StackMember extends SlotInput {
  /** Stable identity used to match locked cards and position locks across rolls. */
  key: string;
}

export const slotKey = (slot: Pick<DraftSlot, 'playerId' | 'name'>) => slot.playerId ?? `guest:${slot.name}`;
export const guestName = (n: number) => `Guest ${n}`;

/** Heroes each player had in their most recent saved drafts (newest first). */
export function recentPicks(drafts: readonly Draft[], playerId: string, count: number): number[] {
  if (!count) return [];
  return drafts
    .slice(0, count)
    .flatMap((d) => d.slots.filter((s) => s.playerId === playerId).map(pickedHeroId))
    .filter((id): id is number => id !== undefined);
}

/** Turns settings plus the squad into the engine's inputs, guests last, capped at 5. */
export function buildStack(settings: DraftSettings, players: readonly Player[], drafts: readonly Draft[]): StackMember[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const members: StackMember[] = settings.selected
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({
      key: p.id,
      playerId: p.id,
      name: p.name,
      color: p.color,
      preferred: p.roles,
      bans: p.bans,
      avoid: recentPicks(drafts, p.id, settings.avoidRecent),
    }));
  for (let n = 1; n <= settings.guests; n++) {
    const name = guestName(n);
    members.push({ key: `guest:${name}`, playerId: null, name, color: GUEST_COLOR });
  }
  return members.slice(0, MAX_STACK).map((m) => ({ ...m, fixedPosition: settings.fixedRoles[m.key] ?? null }));
}

/**
 * Rolls a fresh draft for the stack, carrying over the locked cards of players still in it.
 * Returns the result plus which slot indexes were newly rolled (the ones to animate).
 */
export function rollKeepingLocks(
  stack: readonly StackMember[],
  settings: DraftSettings,
  current: (DraftResult & Partial<Pick<Draft, 'id'>>) | null | undefined,
  seed?: string | number,
): { draft: DraftResult; rolled: number[] } {
  const keep = stack.map((m) => current?.slots.find((slot) => slot.locked && slotKey(slot) === m.key));
  const draft = generateDraft(stack, {
    mode: settings.mode,
    theme: settings.theme,
    comboStyle: settings.comboStyle,
    roles: settings.roles,
    positions: settings.positions,
    choices: settings.choices,
    bans: settings.bans,
    keep,
    previous: current ?? undefined,
    seed,
  });
  return { draft, rolled: draft.slots.map((_, i) => i).filter((i) => !keep[i]) };
}

/** Stack size toggles, mirroring the web Squad panel: guests make way for real players. */
export function togglePlayer(settings: Pick<DraftSettings, 'selected' | 'guests'>, id: string): Pick<DraftSettings, 'selected' | 'guests'> {
  const { selected, guests } = settings;
  if (selected.includes(id)) return { selected: selected.filter((x) => x !== id), guests };
  if (selected.length + guests < MAX_STACK) return { selected: [...selected, id], guests };
  // Stack is full of guests: a real player replaces one.
  if (guests > 0) return { selected: [...selected, id], guests: guests - 1 };
  return { selected, guests };
}

export function setStackSize(settings: Pick<DraftSettings, 'selected' | 'guests'>, size: number): Pick<DraftSettings, 'selected' | 'guests'> {
  const { selected } = settings;
  const n = Math.min(Math.max(Math.round(size), 0), MAX_STACK);
  if (n >= selected.length) return { selected, guests: n - selected.length };
  return { selected: selected.slice(0, n), guests: 0 };
}
