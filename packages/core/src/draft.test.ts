import { describe, expect, it } from 'vitest';
import { BASE_HEROES } from './data/heroes.generated';
import { HERO_META } from './data/hero-meta';
import { ABILITIES_PATCH, HERO_ABILITIES } from './data/hero-abilities.generated';
import {
  COMBOS,
  comboOffRoleAllowance,
  HERO_BY_ID,
  HERO_BY_KEY,
  THEMES,
  decodeDraft,
  draftToText,
  encodeDraft,
  generateDraft,
  getTheme,
  movePosition,
  rerollSlot,
  sanitizeDraft,
  sanitizePlayer,
  type DraftOptions,
  type DraftResult,
  type Position,
  type SlotInput,
} from './index';

const stack = (n: number, extra: Partial<SlotInput> = {}): SlotInput[] =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, name: `Player ${i + 1}`, color: '#3375ff', ...extra }));

const hero = (id: number) => HERO_BY_ID.get(id)!;
const allHeroIds = (d: DraftResult) => d.slots.flatMap((s) => s.heroes);
const seeds = (n: number) => Array.from({ length: n }, (_, i) => `seed-${i}`);

function expectValid(d: DraftResult, players: number, choices = 1) {
  expect(d.slots).toHaveLength(players);
  const positions = d.slots.map((s) => s.position);
  expect(new Set(positions).size).toBe(players);
  const ids = allHeroIds(d);
  expect(new Set(ids).size).toBe(ids.length);
  for (const s of d.slots) {
    expect(s.heroes.length).toBeGreaterThanOrEqual(1);
    expect(s.heroes.length).toBeLessThanOrEqual(choices);
  }
}

describe('hero data', () => {
  it('has curated meta for every hero', () => {
    const missing = BASE_HEROES.filter((h) => !HERO_META[h.key]).map((h) => h.key);
    expect(missing, `Add these heroes to src/data/hero-meta.ts`).toEqual([]);
  });

  it('only references real heroes in combos', () => {
    for (const combo of COMBOS) for (const key of combo.heroes) expect(HERO_BY_KEY.has(key), key).toBe(true);
  });

  it('has enough heroes in every theme for a full stack', () => {
    for (const theme of THEMES) {
      const count = [...HERO_BY_ID.values()].filter(theme.match).length;
      expect(count, theme.id).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('generateDraft', () => {
  it('is deterministic for a seed', () => {
    const opts: DraftOptions = { mode: 'standard', seed: 'gg' };
    expect(generateDraft(stack(5), opts)).toEqual(generateDraft(stack(5), opts));
  });

  it('gives a 5-stack every position with role-fitting heroes in standard mode', () => {
    for (const seed of seeds(200)) {
      const d = generateDraft(stack(5), { mode: 'standard', seed });
      expectValid(d, 5);
      expect(d.slots.map((s) => s.position).sort()).toEqual([1, 2, 3, 4, 5]);
      for (const s of d.slots) expect(hero(s.heroes[0]!).positions).toContain(s.position);
    }
  });

  it('only uses positions in play for smaller stacks', () => {
    for (const seed of seeds(100)) {
      const d = generateDraft(stack(3), { mode: 'standard', positions: [1, 2, 3], seed });
      expect(d.slots.map((s) => s.position).sort()).toEqual([1, 2, 3]);
    }
  });

  it('borrows extra positions only when there are more players than positions in play', () => {
    for (const seed of seeds(50)) {
      const d = generateDraft(stack(3), { mode: 'standard', positions: [2], seed });
      expectValid(d, 3);
      expect(d.slots.map((s) => s.position)).toContain(2);
    }
  });

  it('respects fixed positions', () => {
    const inputs = stack(5);
    inputs[0]!.fixedPosition = 5;
    inputs[3]!.fixedPosition = 2;
    for (const seed of seeds(50)) {
      const d = generateDraft(inputs, { mode: 'random', seed });
      expect(d.slots[0]!.position).toBe(5);
      expect(d.slots[3]!.position).toBe(2);
    }
  });

  it('leans on preferred roles when enabled', () => {
    const inputs = stack(5);
    inputs[0]!.preferred = [2];
    let mid = 0;
    for (const seed of seeds(300)) {
      if (generateDraft(inputs, { mode: 'standard', roles: 'preferred', seed }).slots[0]!.position === 2) mid++;
    }
    expect(mid / 300).toBeGreaterThan(0.6);
  });

  it('offers distinct choices per player and leaves the pick open', () => {
    for (const seed of seeds(100)) {
      const d = generateDraft(stack(5), { mode: 'standard', choices: 3, seed });
      expectValid(d, 5, 3);
      for (const s of d.slots) {
        expect(s.heroes).toHaveLength(3);
        expect(s.pick).toBeNull();
      }
    }
  });

  it('never drafts globally or personally banned heroes', () => {
    const am = HERO_BY_KEY.get('antimage')!.id;
    const pudge = HERO_BY_KEY.get('pudge')!.id;
    const inputs = stack(5, { bans: [pudge] });
    for (const seed of seeds(300)) {
      const ids = allHeroIds(generateDraft(inputs, { mode: 'random', bans: [am], choices: 3, seed }));
      expect(ids).not.toContain(am);
      expect(ids).not.toContain(pudge);
    }
  });

  it('avoids recently played heroes when it can', () => {
    const carries = [...HERO_BY_ID.values()].filter((h) => h.positions.includes(1)).map((h) => h.id);
    const avoid = carries.slice(0, -1);
    const inputs: SlotInput[] = [{ playerId: 'a', name: 'A', color: '#3375ff', fixedPosition: 1, avoid }];
    for (const seed of seeds(30)) {
      expect(generateDraft(inputs, { mode: 'standard', seed }).slots[0]!.heroes[0]).toBe(carries.at(-1));
    }
  });

  it('puts heroes off their roles in off-role mode', () => {
    for (const seed of seeds(200)) {
      const d = generateDraft(stack(5), { mode: 'chaos', seed });
      expectValid(d, 5);
      for (const s of d.slots) expect(hero(s.heroes[0]!).positions).not.toContain(s.position);
    }
  });

  it('keeps every pick on theme', () => {
    for (const theme of THEMES) {
      for (const seed of seeds(20)) {
        const d = generateDraft(stack(5), { mode: 'theme', theme: theme.id, seed });
        expectValid(d, 5);
        expect(d.theme).toBe(theme.id);
        for (const id of allHeroIds(d)) expect(theme.match(hero(id)), `${theme.id}: ${hero(id).name}`).toBe(true);
      }
    }
  });

  it('resolves a surprise theme', () => {
    const d = generateDraft(stack(5), { mode: 'theme', theme: 'surprise', seed: 'x' });
    expect(getTheme(d.theme)).toBeDefined();
  });

  it('still fills a small theme pool with many choices without duplicates', () => {
    for (const seed of seeds(30)) expectValid(generateDraft(stack(5), { mode: 'theme', theme: 'global', choices: 3, seed }), 5, 3);
  });

  it('places a full combo in wombo mode', () => {
    for (const n of [2, 3, 4, 5]) {
      for (const seed of seeds(100)) {
        const d = generateDraft(stack(n), { mode: 'wombo', seed });
        expectValid(d, n);
        const combo = COMBOS.find((c) => c.id === d.comboId);
        expect(combo, `stack ${n} seed ${seed}`).toBeDefined();
        const keys = allHeroIds(d).map((id) => hero(id).key);
        for (const key of combo!.heroes) expect(keys).toContain(key);
      }
    }
  });

  it('keeps locked slots and keeps a combo whose heroes are all locked', () => {
    const first = generateDraft(stack(5), { mode: 'wombo', seed: 'lock' });
    const combo = COMBOS.find((c) => c.id === first.comboId)!;
    const keep = first.slots.map((s) => (combo.heroes.includes(hero(s.heroes[0]!).key) ? { ...s, locked: true } : null));
    for (const seed of seeds(30)) {
      const next = generateDraft(stack(5), { mode: 'wombo', seed, keep, previous: first });
      expectValid(next, 5);
      expect(next.comboId).toBe(first.comboId);
      keep.forEach((k, i) => k && expect(next.slots[i]).toEqual(k));
    }
  });

  it('rejects empty and oversized stacks', () => {
    expect(() => generateDraft([], { mode: 'standard' })).toThrow(RangeError);
    expect(() => generateDraft(stack(6), { mode: 'standard' })).toThrow(RangeError);
  });
});

describe('combos', () => {
  it('have unique ids and unique hero sets', () => {
    expect(new Set(COMBOS.map((c) => c.id)).size).toBe(COMBOS.length);
    const sets = COMBOS.map((c) => [...c.heroes].sort().join('+'));
    expect(sets.filter((s, i) => sets.indexOf(s) !== i), 'duplicate combos').toEqual([]);
  });

  it('have 2–5 distinct heroes, text and a style', () => {
    for (const c of COMBOS) {
      expect(c.heroes.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.heroes.length, c.id).toBeLessThanOrEqual(5);
      expect(new Set(c.heroes).size, c.id).toBe(c.heroes.length);
      expect(c.name.length, c.id).toBeLessThanOrEqual(32);
      expect(c.how.length, c.id).toBeGreaterThan(10);
      expect(['classic', 'meme'], c.id).toContain(c.style);
      if (c.source) expect(c.source, c.id).toMatch(/^https:\/\//);
    }
  });

  it("only rely on abilities that are in the heroes' current kits", () => {
    for (const c of COMBOS) {
      expect(c.abilities.length, c.id).toBeGreaterThanOrEqual(1);
      for (const ability of c.abilities) {
        const owner = c.heroes.find((h) => HERO_ABILITIES[h]?.includes(ability));
        expect(owner, `${c.id}: "${ability}" is not in the current kit of ${c.heroes.join(', ')}`).toBeDefined();
      }
    }
  });

  it('were verified on a real patch no newer than the hero snapshot', () => {
    const parse = (p: string) => /^(\d+)\.(\d+)([a-z]?)$/.exec(p)!;
    const [, major, minor] = parse(ABILITIES_PATCH);
    for (const c of COMBOS) {
      const m = parse(c.verifiedPatch);
      expect(m, `${c.id}: bad verifiedPatch "${c.verifiedPatch}"`).toBeTruthy();
      expect(Number(m[1]) * 1000 + Number(m[2]), c.id).toBeLessThanOrEqual(Number(major) * 1000 + Number(minor));
    }
  });

  it('can put every classic combo on its heroes\' real roles (one flex pick for 4–5 heroes)', () => {
    // Most heroes that can land on a distinct position they actually play.
    const maxFit = (keys: string[], used: Set<Position> = new Set()): number => {
      const [first, ...rest] = keys;
      if (!first) return 0;
      let best = maxFit(rest, used); // this hero goes off-role
      for (const p of HERO_BY_KEY.get(first)!.positions) {
        if (!used.has(p)) best = Math.max(best, 1 + maxFit(rest, new Set([...used, p])));
      }
      return best;
    };
    const misfits = COMBOS.filter(
      (c) => c.style === 'classic' && c.heroes.length - maxFit(c.heroes) > comboOffRoleAllowance(c),
    ).map((c) => c.id);
    expect(misfits).toEqual([]);
  });

  it('only draws combos of the chosen style', () => {
    for (const style of ['classic', 'meme'] as const) {
      for (const seed of seeds(60)) {
        const d = generateDraft(stack(5), { mode: 'wombo', comboStyle: style, seed });
        expect(COMBOS.find((c) => c.id === d.comboId)?.style, `${style} ${seed}`).toBe(style);
      }
    }
  });
});

describe('draft edits', () => {
  it('rerolls one slot to a different hero and leaves the rest alone', () => {
    const d = generateDraft(stack(5), { mode: 'standard', seed: 'r' });
    for (const seed of seeds(30)) {
      const next = rerollSlot(d, 2, stack(5)[2]!, { seed });
      expect(next.slots[2]!.heroes[0]).not.toBe(d.slots[2]!.heroes[0]);
      expect(next.slots[2]!.position).toBe(d.slots[2]!.position);
      expectValid(next, 5);
      [0, 1, 3, 4].forEach((i) => expect(next.slots[i]).toEqual(d.slots[i]));
    }
  });

  it('swaps positions between two slots', () => {
    const d = generateDraft(stack(5), { mode: 'standard', seed: 's' });
    const target = d.slots[1]!.position;
    const next = movePosition(d, 0, target);
    expect(next.slots[0]!.position).toBe(target);
    expect(next.slots[1]!.position).toBe(d.slots[0]!.position);
  });
});

describe('sharing', () => {
  it('round-trips a draft through a share code', () => {
    const d = generateDraft(stack(4), { mode: 'wombo', choices: 2, seed: 'share' });
    const named = { ...d, slots: d.slots.map((s, i) => ({ ...s, name: i === 0 ? 'Kuşh 🐸' : s.name, playerId: null })) };
    expect(decodeDraft(encodeDraft(named))).toEqual(named);
  });

  it('rejects garbage share codes', () => {
    expect(decodeDraft('not-a-draft')).toBeNull();
    expect(decodeDraft('')).toBeNull();
  });

  it('formats a Discord message with every player', () => {
    const d = generateDraft(stack(3), { mode: 'standard', seed: 'text' });
    const text = draftToText(d, 'https://example.com');
    for (const s of d.slots) {
      expect(text).toContain(s.name);
      expect(text).toContain(hero(s.heroes[0]!).name);
    }
    expect(text).toContain('https://example.com');
  });
});

describe('validation', () => {
  it('cleans player input', () => {
    expect(
      sanitizePlayer({ id: 'abc', name: '  Kush   V ', color: 'red', roles: [2, 2, 9, 1], bans: [1, 'x', 1], createdAt: 5 }),
    ).toEqual({ id: 'abc', name: 'Kush V', color: '#3375ff', roles: [2, 1], bans: [1], createdAt: 5 });
    expect(sanitizePlayer({ id: 'abc', name: '   ' })).toBeNull();
    expect(sanitizePlayer({ id: 'bad id!', name: 'x' })).toBeNull();
  });

  it('accepts real drafts and rejects broken ones', () => {
    const d = { id: 'd1', createdAt: 1, ...generateDraft(stack(2), { mode: 'standard', seed: 'v' }) };
    expect(sanitizeDraft(d)).toEqual(d);
    expect(sanitizeDraft({ ...d, mode: 'turbo' })).toBeNull();
    expect(sanitizeDraft({ ...d, slots: [] })).toBeNull();
    const position: Position = 7 as Position;
    expect(sanitizeDraft({ ...d, slots: [{ ...d.slots[0], position }] })).toBeNull();
  });
});
