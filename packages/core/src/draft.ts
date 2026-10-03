import { COMBOS, getCombo, type Combo } from './combos';
import { HEROES } from './heroes';
import { getTheme, THEMES } from './modes';
import { createRng, pickOne, shuffle, weightedPick, weightedShuffle, type Rng } from './rng';
import { POSITIONS, type Draft, type DraftMode, type DraftSlot, type Hero, type Position, type ThemeId } from './types';

export const MAX_STACK = 5;
export const MAX_CHOICES = 3;

/** One person (or guest) in the stack, as the engine sees them. */
export interface SlotInput {
  playerId: string | null;
  name: string;
  color: string;
  /** Force this slot onto a position. */
  fixedPosition?: Position | null;
  /** Preferred positions, favourite first. Used when roles = 'preferred'. */
  preferred?: readonly Position[];
  /** Heroes this player never wants. */
  bans?: readonly number[];
  /** Heroes to steer away from when possible, e.g. recently played. */
  avoid?: readonly number[];
}

export type RoleMode = 'random' | 'preferred';
export type ThemeChoice = ThemeId | 'surprise';

export interface DraftOptions {
  mode: DraftMode;
  theme?: ThemeChoice;
  roles?: RoleMode;
  /** Positions that may be handed out. Extra positions are only used if there are more players. */
  positions?: readonly Position[];
  /** Heroes offered per player (1 = straight assignment, 2–3 = pick one). */
  choices?: number;
  /** Heroes nobody gets. */
  bans?: readonly number[];
  seed?: string | number;
  /** Slots to carry over untouched, aligned with the inputs (locked cards). */
  keep?: readonly (DraftSlot | null | undefined)[];
  /** The draft being rerolled, so a surprise theme or a fully kept combo survives. */
  previous?: Pick<DraftResult, 'theme' | 'comboId'>;
  heroes?: readonly Hero[];
}

export type DraftResult = Omit<Draft, 'id' | 'createdAt'>;

interface Ctx {
  rng: Rng;
  heroes: readonly Hero[];
  mode: DraftMode;
  theme?: ThemeId;
  choices: number;
  bans: ReadonlySet<number>;
  used: Set<number>;
}

function createCtx(rng: Rng, options: Pick<DraftOptions, 'mode' | 'heroes' | 'choices' | 'bans'>, theme?: ThemeId): Ctx {
  return {
    rng,
    heroes: options.heroes ?? HEROES,
    mode: options.mode,
    theme,
    choices: Math.min(Math.max(Math.round(options.choices ?? 1), 1), MAX_CHOICES),
    bans: new Set(options.bans ?? []),
    used: new Set(),
  };
}

const identity = (input: SlotInput) => ({ playerId: input.playerId, name: input.name, color: input.color });

/** "Opposite" heroes for Off-Role: supports on cores, cores on supports. */
const isOpposite = (hero: Hero, position: Position) =>
  position <= 3 ? hero.positions.every((p) => p >= 4) : hero.positions.every((p) => p <= 2);

/** Candidate pools for a slot, strictest first. */
function tiersFor(ctx: Ctx, position: Position): readonly (readonly Hero[])[] {
  const all = ctx.heroes;
  const fit = all.filter((h) => h.positions.includes(position));
  switch (ctx.mode) {
    case 'standard':
      return [fit];
    case 'random':
      return [all];
    case 'chaos': {
      const off = all.filter((h) => !h.positions.includes(position));
      return [off.filter((h) => isOpposite(h, position)), off];
    }
    case 'wombo':
      return [fit.filter((h) => h.tags.includes('teamfight')), fit];
    case 'theme': {
      const theme = getTheme(ctx.theme);
      if (!theme) return [fit];
      const themed = all.filter(theme.match);
      return [themed.filter((h) => h.positions.includes(position)), themed, fit];
    }
  }
}

/**
 * Picks `ctx.choices` heroes for one slot. Each tier is tried without the player's
 * avoid list first, then with it, so role and theme fit beat "recently played".
 * Bans are only ignored if literally nothing else is left.
 */
function pickHeroes(ctx: Ctx, input: SlotInput, position: Position): number[] {
  const playerBans = new Set(input.bans ?? []);
  const avoid = new Set(input.avoid ?? []);
  const blocked = (h: Hero) => ctx.used.has(h.id) || ctx.bans.has(h.id) || playerBans.has(h.id);
  const tiers = tiersFor(ctx, position);
  const picked: Hero[] = [];

  for (let n = 0; n < ctx.choices; n++) {
    // Offer different attributes when there are several choices, like Single Draft.
    const attrs = new Set(picked.map((h) => h.attr));
    const weight = (h: Hero) => (attrs.has(h.attr) ? 1 : 3);
    let hero: Hero | undefined;
    for (const tier of tiers) {
      const pool = tier.filter((h) => !blocked(h));
      const fresh = pool.filter((h) => !avoid.has(h.id));
      hero = weightedPick(ctx.rng, fresh.length ? fresh : pool, weight);
      if (hero) break;
    }
    hero ??= weightedPick(ctx.rng, ctx.heroes.filter((h) => !blocked(h)), weight);
    hero ??= pickOne(ctx.rng, ctx.heroes.filter((h) => !ctx.used.has(h.id)));
    if (!hero) break;
    picked.push(hero);
    ctx.used.add(hero.id);
  }
  return picked.map((h) => h.id);
}

function preferenceWeight(input: SlotInput, position: Position): number {
  const prefs = input.preferred ?? [];
  if (!prefs.length) return 1;
  const rank = prefs.indexOf(position);
  if (rank === -1) return 0.15;
  return rank === 0 ? 6 : rank === 1 ? 4 : 2.5;
}

/**
 * Hands out distinct positions. Kept and fixed slots claim theirs first, the rest is
 * sampled over every possible assignment, weighted by preferences when enabled.
 */
function assignPositions(
  rng: Rng,
  inputs: readonly SlotInput[],
  keep: readonly (DraftSlot | undefined)[],
  options: DraftOptions,
): Position[] {
  const result: (Position | undefined)[] = inputs.map(() => undefined);
  const taken = new Set<Position>();
  const claim = (i: number, position: Position | null | undefined) => {
    if (position && result[i] === undefined && !taken.has(position)) {
      result[i] = position;
      taken.add(position);
    }
  };
  inputs.forEach((_, i) => claim(i, keep[i]?.position));
  inputs.forEach((input, i) => claim(i, input.fixedPosition));

  const free = inputs.map((_, i) => i).filter((i) => result[i] === undefined);
  const inPlay = (options.positions?.length ? options.positions : POSITIONS).filter((p) => !taken.has(p));
  // Only reach outside the chosen positions when there are more players than positions.
  const available =
    inPlay.length >= free.length ? inPlay : [...inPlay, ...POSITIONS.filter((p) => !taken.has(p) && !inPlay.includes(p))];

  const weightOf = (i: number, p: Position) =>
    (options.roles === 'preferred' ? preferenceWeight(inputs[i]!, p) : 1) * (inPlay.includes(p) ? 1 : 1e-6);

  const assignments: { positions: Position[]; weight: number }[] = [];
  const walk = (k: number, acc: Position[], weight: number) => {
    if (k === free.length) {
      assignments.push({ positions: [...acc], weight });
      return;
    }
    for (const p of available) {
      if (acc.includes(p)) continue;
      acc.push(p);
      walk(k + 1, acc, weight * weightOf(free[k]!, p));
      acc.pop();
    }
  };
  walk(0, [], 1);

  const chosen = weightedPick(rng, assignments, (a) => a.weight);
  free.forEach((slot, k) => {
    result[slot] = chosen?.positions[k];
  });
  return result as Position[];
}

/** Backtracking match of combo heroes onto distinct slots. */
function matchHeroes(
  rng: Rng,
  heroes: readonly Hero[],
  slots: readonly number[],
  ok: (hero: Hero, slot: number) => boolean,
): [number, Hero][] | null {
  const order = shuffle(rng, slots);
  const taken = new Set<number>();
  const out: [number, Hero][] = [];
  const walk = (k: number): boolean => {
    const hero = heroes[k];
    if (!hero) return true;
    for (const slot of order) {
      if (taken.has(slot) || !ok(hero, slot)) continue;
      taken.add(slot);
      out.push([slot, hero]);
      if (walk(k + 1)) return true;
      taken.delete(slot);
      out.pop();
    }
    return false;
  };
  return walk(0) ? out : null;
}

function placeCombo(
  ctx: Ctx,
  inputs: readonly SlotInput[],
  positions: readonly Position[],
  free: readonly number[],
): { combo: Combo; placement: [number, Hero][] } | null {
  const usable: { combo: Combo; heroes: Hero[] }[] = [];
  for (const combo of COMBOS) {
    if (combo.heroes.length > free.length) continue;
    const heroes = combo.heroes.map((key) => ctx.heroes.find((h) => h.key === key));
    if (heroes.every((h): h is Hero => !!h && !ctx.used.has(h.id) && !ctx.bans.has(h.id))) {
      usable.push({ combo, heroes });
    }
  }
  // Bigger combos are rarer but more fun, so weight them up.
  const ordered = weightedShuffle(ctx.rng, usable, (c) => c.heroes.length ** 2);
  for (const strict of [true, false]) {
    for (const { combo, heroes } of ordered) {
      const placement = matchHeroes(
        ctx.rng,
        heroes,
        free,
        (hero, slot) =>
          !(inputs[slot]!.bans ?? []).includes(hero.id) && (!strict || hero.positions.includes(positions[slot]!)),
      );
      if (placement) return { combo, placement };
    }
  }
  return null;
}

function resolveTheme(rng: Rng, theme: ThemeChoice | undefined): ThemeId {
  if (theme && theme !== 'surprise' && getTheme(theme)) return theme;
  return pickOne(rng, THEMES)!.id;
}

/** Rolls positions and heroes for the whole stack. */
export function generateDraft(inputs: readonly SlotInput[], options: DraftOptions): DraftResult {
  if (inputs.length < 1 || inputs.length > MAX_STACK) {
    throw new RangeError(`A draft needs 1 to ${MAX_STACK} players, got ${inputs.length}`);
  }
  const rng = createRng(options.seed);
  const keep = inputs.map((_, i) => options.keep?.[i] ?? undefined);
  const hasKept = keep.some(Boolean);

  let theme: ThemeId | undefined;
  if (options.mode === 'theme') {
    theme =
      options.theme === 'surprise' && hasKept && options.previous?.theme
        ? options.previous.theme
        : resolveTheme(rng, options.theme);
  }

  const ctx = createCtx(rng, options, theme);
  for (const slot of keep) slot?.heroes.forEach((id) => ctx.used.add(id));

  const positions = assignPositions(rng, inputs, keep, options);
  const slots: (DraftSlot | undefined)[] = keep.map(
    (kept, i) => kept && { ...kept, ...identity(inputs[i]!), position: positions[i]! },
  );
  const open = () => slots.map((_, i) => i).filter((i) => !slots[i]);

  let comboId: string | undefined;
  if (options.mode === 'wombo') {
    const previous = getCombo(options.previous?.comboId);
    const keptKeys = new Set(
      keep.flatMap((k) => k?.heroes ?? []).map((id) => ctx.heroes.find((h) => h.id === id)?.key),
    );
    if (previous && previous.heroes.every((key) => keptKeys.has(key))) {
      comboId = previous.id;
    } else {
      const placed = placeCombo(ctx, inputs, positions, open());
      if (placed) {
        comboId = placed.combo.id;
        for (const [i, hero] of placed.placement) {
          ctx.used.add(hero.id);
          slots[i] = { ...identity(inputs[i]!), position: positions[i]!, heroes: [hero.id], pick: 0 };
        }
      }
    }
  }

  // Random order so no slot always gets first dibs on a scarce pool.
  for (const i of shuffle(rng, open())) {
    const heroes = pickHeroes(ctx, inputs[i]!, positions[i]!);
    slots[i] = { ...identity(inputs[i]!), position: positions[i]!, heroes, pick: heroes.length === 1 ? 0 : null };
  }

  return {
    mode: options.mode,
    ...(theme && { theme }),
    ...(comboId && { comboId }),
    slots: slots as DraftSlot[],
  };
}

/** New hero(es) for one slot, keeping its position and every other slot. */
export function rerollSlot<T extends DraftResult>(
  draft: T,
  index: number,
  input: SlotInput,
  options: Pick<DraftOptions, 'choices' | 'bans' | 'seed' | 'heroes'> = {},
): T {
  const slot = draft.slots[index];
  if (!slot) return draft;
  const ctx = createCtx(createRng(options.seed), { ...options, mode: draft.mode }, draft.theme);
  for (const s of draft.slots) s.heroes.forEach((id) => ctx.used.add(id));
  const heroes = pickHeroes(ctx, input, slot.position);
  if (!heroes.length) return draft;
  return {
    ...draft,
    slots: draft.slots.map((s, i) => (i === index ? { ...s, heroes, pick: heroes.length === 1 ? 0 : null } : s)),
  };
}

/** Moves a slot to another position, swapping with whoever had it. */
export function movePosition<T extends DraftResult>(draft: T, index: number, position: Position): T {
  const current = draft.slots[index];
  if (!current || current.position === position) return draft;
  return {
    ...draft,
    slots: draft.slots.map((s, i) =>
      i === index ? { ...s, position } : s.position === position ? { ...s, position: current.position } : s,
    ),
  };
}

export function updateSlot<T extends DraftResult>(draft: T, index: number, patch: Partial<DraftSlot>): T {
  return { ...draft, slots: draft.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) };
}

/** The chosen hero id of a slot, if one is decided. */
export const pickedHeroId = (slot: DraftSlot): number | undefined =>
  slot.pick === null ? undefined : slot.heroes[slot.pick];
