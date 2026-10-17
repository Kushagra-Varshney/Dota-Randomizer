import { describe, expect, it } from 'vitest';
import {
  buildStack,
  DEFAULT_DRAFT_SETTINGS,
  GUEST_COLOR,
  recentPicks,
  rollKeepingLocks,
  sanitizeDraftSettings,
  setStackSize,
  slotKey,
  togglePlayer,
  updateSlot,
  type Draft,
  type DraftSettings,
  type Player,
} from './index';

const player = (id: string, extra: Partial<Player> = {}): Player => ({
  id,
  name: id.toUpperCase(),
  color: '#3375ff',
  roles: [],
  bans: [],
  createdAt: 1,
  ...extra,
});

const settings = (patch: Partial<DraftSettings> = {}): DraftSettings => ({ ...DEFAULT_DRAFT_SETTINGS, ...patch });

const saved = (id: string, picks: Record<string, number>): Draft => ({
  id,
  createdAt: 1,
  mode: 'standard',
  slots: Object.entries(picks).map(([playerId, hero], i) => ({
    playerId,
    name: playerId,
    color: '#3375ff',
    position: (i + 1) as 1,
    heroes: [hero],
    pick: 0,
  })),
});

describe('buildStack', () => {
  const players = [player('a', { roles: [1], bans: [5] }), player('b'), player('c')];

  it('keeps selection order, skips unknown ids and adds guests last', () => {
    const stack = buildStack(settings({ selected: ['c', 'gone', 'a'], guests: 2 }), players, []);
    expect(stack.map((m) => m.key)).toEqual(['c', 'a', 'guest:Guest 1', 'guest:Guest 2']);
    expect(stack[1]).toMatchObject({ playerId: 'a', name: 'A', preferred: [1], bans: [5] });
    expect(stack[2]).toMatchObject({ playerId: null, name: 'Guest 1', color: GUEST_COLOR });
  });

  it('caps the stack at 5', () => {
    expect(buildStack(settings({ selected: ['a', 'b', 'c'], guests: 5 }), players, [])).toHaveLength(5);
  });

  it('applies position locks by slot key', () => {
    const stack = buildStack(settings({ selected: ['a'], guests: 1, fixedRoles: { a: 2, 'guest:Guest 1': 5 } }), players, []);
    expect(stack.map((m) => m.fixedPosition)).toEqual([2, 5]);
  });

  it('avoids heroes from the most recent saved drafts only', () => {
    const drafts = [saved('d1', { a: 10, b: 11 }), saved('d2', { a: 12 }), saved('d3', { a: 13 })];
    expect(recentPicks(drafts, 'a', 2)).toEqual([10, 12]);
    expect(buildStack(settings({ selected: ['a'], avoidRecent: 0 }), players, drafts)[0]!.avoid).toEqual([]);
    expect(buildStack(settings({ selected: ['a'], avoidRecent: 3 }), players, drafts)[0]!.avoid).toEqual([10, 12, 13]);
  });
});

describe('rollKeepingLocks', () => {
  const players = [player('a'), player('b'), player('c')];
  const s = settings({ selected: ['a', 'b', 'c'] });
  const stack = buildStack(s, players, []);

  it('rolls every slot when nothing is locked', () => {
    const { draft, rolled } = rollKeepingLocks(stack, s, null, 'x');
    expect(draft.slots.map(slotKey)).toEqual(['a', 'b', 'c']);
    expect(rolled).toEqual([0, 1, 2]);
  });

  it('keeps locked slots of players still in the stack', () => {
    const first = rollKeepingLocks(stack, s, null, 'x').draft;
    const locked = updateSlot(first, 1, { locked: true });
    for (const seed of ['1', '2', '3', '4']) {
      const { draft, rolled } = rollKeepingLocks(stack, s, locked, seed);
      expect(draft.slots[1]).toEqual(locked.slots[1]);
      expect(rolled).toEqual([0, 2]);
    }
  });

  it('drops locks of players who left the stack', () => {
    const first = rollKeepingLocks(stack, s, null, 'x').draft;
    const locked = updateSlot(first, 1, { locked: true });
    const smaller = settings({ selected: ['a', 'c'] });
    const { draft, rolled } = rollKeepingLocks(buildStack(smaller, players, []), smaller, locked, 'y');
    expect(draft.slots.map(slotKey)).toEqual(['a', 'c']);
    expect(rolled).toEqual([0, 1]);
  });
});

describe('stack size', () => {
  it('toggles players, with real players replacing guests when full', () => {
    expect(togglePlayer({ selected: ['a'], guests: 0 }, 'b')).toEqual({ selected: ['a', 'b'], guests: 0 });
    expect(togglePlayer({ selected: ['a', 'b'], guests: 0 }, 'a')).toEqual({ selected: ['b'], guests: 0 });
    expect(togglePlayer({ selected: ['a'], guests: 4 }, 'b')).toEqual({ selected: ['a', 'b'], guests: 3 });
    expect(togglePlayer({ selected: ['a', 'b', 'c', 'd', 'e'], guests: 0 }, 'f').selected).toHaveLength(5);
  });

  it('grows with guests and shrinks by trimming players', () => {
    expect(setStackSize({ selected: ['a'], guests: 0 }, 3)).toEqual({ selected: ['a'], guests: 2 });
    expect(setStackSize({ selected: ['a', 'b', 'c'], guests: 1 }, 2)).toEqual({ selected: ['a', 'b'], guests: 0 });
    expect(setStackSize({ selected: [], guests: 0 }, 9)).toEqual({ selected: [], guests: 5 });
  });
});

describe('sanitizeDraftSettings', () => {
  it('defaults junk', () => {
    expect(sanitizeDraftSettings(null)).toEqual(DEFAULT_DRAFT_SETTINGS);
    expect(sanitizeDraftSettings('{}')).toEqual(DEFAULT_DRAFT_SETTINGS);
  });

  it('keeps valid values and drops invalid ones', () => {
    const s = sanitizeDraftSettings({
      mode: 'wombo',
      theme: 'nope',
      comboStyle: 'meme',
      roles: 'preferred',
      positions: [1, 3, 3, 9],
      choices: 7,
      avoidRecent: 3,
      bans: [1, 1, -2, 'x'],
      selected: ['a', 'a', 'bad id!', 'b'],
      guests: 2,
      fixedRoles: { a: 1, b: 8 },
    });
    expect(s).toEqual({
      ...DEFAULT_DRAFT_SETTINGS,
      mode: 'wombo',
      comboStyle: 'meme',
      roles: 'preferred',
      positions: [1, 3],
      choices: 1,
      avoidRecent: 3,
      bans: [1],
      selected: ['a', 'b'],
      guests: 2,
      fixedRoles: { a: 1 },
    });
  });

  it('round-trips through JSON', () => {
    const s = settings({ mode: 'theme', theme: 'invis', selected: ['a'], guests: 1, fixedRoles: { a: 4 } });
    expect(sanitizeDraftSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
