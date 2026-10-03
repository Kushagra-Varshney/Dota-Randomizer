import { MAX_CHOICES, MAX_STACK } from './draft';
import { MODES, THEMES } from './modes';
import { isPosition } from './positions';
import type { Draft, DraftSlot, Player } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ID = /^[\w-]{1,64}$/;
export const MAX_NAME = 24;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isHeroId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < 1000;
const isTime = (v: unknown): v is number => Number.isFinite(v) && (v as number) > 0;
const uniq = <T>(items: T[]) => [...new Set(items)];
const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : '');

export const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

export function sanitizePlayer(raw: unknown): Player | null {
  if (!isObj(raw) || !isId(raw.id)) return null;
  const name = cleanName(raw.name);
  if (!name) return null;
  return {
    id: raw.id,
    name,
    color: typeof raw.color === 'string' && HEX_COLOR.test(raw.color) ? raw.color : '#3375ff',
    roles: uniq(arr(raw.roles).filter(isPosition)),
    bans: uniq(arr(raw.bans).filter(isHeroId)).slice(0, 200),
    createdAt: isTime(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

function sanitizeSlot(raw: unknown): DraftSlot | null {
  if (!isObj(raw) || !isPosition(raw.position)) return null;
  const name = cleanName(raw.name);
  const heroes = arr(raw.heroes).filter(isHeroId).slice(0, MAX_CHOICES);
  if (!name || !heroes.length) return null;
  const pick = Number.isInteger(raw.pick) && (raw.pick as number) >= 0 && (raw.pick as number) < heroes.length ? (raw.pick as number) : null;
  return {
    playerId: isId(raw.playerId) ? raw.playerId : null,
    name,
    color: typeof raw.color === 'string' && HEX_COLOR.test(raw.color) ? raw.color : '#8b93a1',
    position: raw.position,
    heroes,
    pick,
    ...(raw.locked === true && { locked: true }),
  };
}

export function sanitizeDraft(raw: unknown): Draft | null {
  if (!isObj(raw) || !isId(raw.id) || !isTime(raw.createdAt)) return null;
  const mode = MODES.find((m) => m.id === raw.mode)?.id;
  if (!mode) return null;
  const rawSlots = arr(raw.slots);
  if (rawSlots.length < 1 || rawSlots.length > MAX_STACK) return null;
  const slots = rawSlots.map(sanitizeSlot);
  if (slots.some((s) => !s)) return null;
  const theme = THEMES.find((t) => t.id === raw.theme)?.id;
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    mode,
    ...(theme && { theme }),
    ...(typeof raw.comboId === 'string' && ID.test(raw.comboId) && { comboId: raw.comboId }),
    slots: slots as DraftSlot[],
  };
}
