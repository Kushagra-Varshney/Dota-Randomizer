import {
  buildStack,
  DEFAULT_DRAFT_SETTINGS,
  MAX_AVOID_RECENT,
  MAX_CHOICES,
  MODES,
  type Draft,
  type DraftMode,
  type DraftSettings,
  type Player,
} from '@dota-picker/core';
import type { APIActionRowComponent, APIComponentInMessageActionRow } from 'discord-api-types/v10';
import { describe, expect, it } from 'vitest';
import { COMMANDS, LAYOUT_CHOICES, MODE_CHOICES } from '../../scripts/commands.mjs';
import { parsePositions } from './commands';
import { applyLock, applyPanel, applyReroll, applyRerollAll, freshDraft, historyCopy } from './components';
import { encodeId, parseId, PANEL_CONTROLS, type ComponentAction } from './ids';
import { handleDiscord, type DiscordEnv } from './handler';
import { MAX_SELECT_OPTIONS, MAX_URL, renderDraft, renderPanel, type MessageData } from './render';
import { LAYOUTS, type LiveChange, type LiveDraft } from './store';
import { verifyDiscordRequest } from './verify';

const ORIGIN = 'https://dota-picker.example.workers.dev';
const UUID = '0b6a3c3e-9a51-4c8e-8f43-2f1d5c0a7e11';

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function keypair() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = toHex((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const sign = async (timestamp: string, body: string) =>
    toHex(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(timestamp + body)));
  return { publicKey, sign };
}

const player = (n: number, extra: Partial<Player> = {}): Player => ({
  id: `p${n}`,
  name: `Player ${n}`,
  color: '#3375ff',
  roles: [],
  bans: [],
  createdAt: n,
  ...extra,
});
const squad = (n: number) => Array.from({ length: n }, (_, i) => player(i + 1));
const settings = (patch: Partial<DraftSettings> = {}): DraftSettings => ({ ...DEFAULT_DRAFT_SETTINGS, ...patch });

function liveFor(n: number, patch: Partial<DraftSettings> = {}) {
  const players = squad(n);
  const s = settings({ selected: players.map((p) => p.id), ...patch });
  const stack = buildStack(s, players, []);
  const draft = freshDraft(stack, s)!;
  const live: LiveDraft = { id: UUID, guildId: 'g', draft, saved: false, version: 0 };
  return { players, s, stack, live };
}
const next = (live: LiveDraft, change: LiveChange | string): LiveDraft => {
  if (typeof change === 'string') throw new Error(change);
  return { ...live, ...change, version: live.version + 1 };
};

describe('verifyDiscordRequest', () => {
  it('accepts a valid signature and rejects anything else', async () => {
    const { publicKey, sign } = await keypair();
    const other = await keypair();
    const body = '{"type":1}';
    const sig = await sign('123', body);
    expect(await verifyDiscordRequest(publicKey, sig, '123', body)).toBe(true);
    expect(await verifyDiscordRequest(publicKey, sig, '124', body)).toBe(false);
    expect(await verifyDiscordRequest(publicKey, sig, '123', body + ' ')).toBe(false);
    expect(await verifyDiscordRequest(other.publicKey, sig, '123', body)).toBe(false);
  });

  it('never throws on malformed input', async () => {
    const { publicKey, sign } = await keypair();
    const sig = await sign('1', 'x');
    for (const [key, s, ts] of [
      ['zz', sig, '1'],
      ['', sig, '1'],
      [publicKey, 'not-hex', '1'],
      [publicKey, sig.slice(2), '1'],
      [publicKey, null, '1'],
      [publicKey, sig, null],
    ] as const) {
      expect(await verifyDiscordRequest(key, s, ts, 'x')).toBe(false);
    }
  });
});

describe('handleDiscord', () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}/api/discord/interactions`, { method: 'POST', body, headers });
  const ctx = {} as ExecutionContext;
  const env = (patch: Partial<DiscordEnv> = {}): DiscordEnv => ({
    DB: {} as D1Database,
    DISCORD_GUILD_IDS: 'g1, g2',
    ...patch,
  });

  it('is off (404) without a public key', async () => {
    expect((await handleDiscord(post('{}'), env(), ctx)).status).toBe(404);
  });

  it('rejects bad signatures with 401', async () => {
    const { publicKey } = await keypair();
    const res = await handleDiscord(post('{"type":1}', { 'x-signature-ed25519': '00'.repeat(64), 'x-signature-timestamp': '1' }), env({ DISCORD_PUBLIC_KEY: publicKey }), ctx);
    expect(res.status).toBe(401);
    expect((await handleDiscord(post('{"type":1}'), env({ DISCORD_PUBLIC_KEY: publicKey }), ctx)).status).toBe(401);
  });

  const signed = async (payload: object) => {
    const { publicKey, sign } = await keypair();
    const body = JSON.stringify(payload);
    const res = await handleDiscord(
      post(body, { 'x-signature-ed25519': await sign('42', body), 'x-signature-timestamp': '42' }),
      env({ DISCORD_PUBLIC_KEY: publicKey }),
      ctx,
    );
    return { status: res.status, body: (await res.json()) as { type: number; data?: MessageData } };
  };

  it('answers PING with PONG', async () => {
    expect(await signed({ type: 1 })).toEqual({ status: 200, body: { type: 1 } });
  });

  it('refuses servers outside the allowlist', async () => {
    const { body } = await signed({ type: 2, guild_id: 'g3', data: { name: 'draft' } });
    expect(body.type).toBe(4);
    expect(body.data?.flags).toBe(64);
    expect(body.data?.content).toMatch(/not enabled/);
  });
});

describe('custom ids', () => {
  const actions: ComponentAction[] = [
    ...PANEL_CONTROLS.map((control) => ({ action: 'panel' as const, control })),
    { action: 'reroll', draftId: UUID, slot: 0 },
    { action: 'lock', draftId: UUID, slot: 4 },
    { action: 'rerollAll', draftId: UUID },
    { action: 'save', draftId: UUID },
  ];

  it('round-trips and fits in 100 chars', () => {
    for (const a of actions) {
      const id = encodeId(a);
      expect(id.length).toBeLessThanOrEqual(100);
      expect(parseId(id)).toEqual(a);
    }
  });

  it('rejects junk', () => {
    for (const id of ['', 'dp', 'xx:p:mode', 'dp:p:nope', 'dp:p:mode:1', `dp:rr:${UUID}`, `dp:rr:${UUID}:5`, `dp:rr:${UUID}:01`, `dp:rr:${UUID}:-1`, `dp:sv:${UUID}:1`, 'dp:sv:bad id', `dp:zz:${UUID}`, `dp:ra:${UUID}:x:y`]) {
      expect(parseId(id), id).toBeNull();
    }
  });
});

type Row = APIActionRowComponent<APIComponentInMessageActionRow>;

/** Checks a message against Discord's limits. */
function expectWithinLimits(msg: MessageData) {
  expect((msg.content ?? '').length).toBeLessThanOrEqual(2000);
  expect(msg.allowed_mentions).toEqual({ parse: [] });
  const embeds = msg.embeds ?? [];
  expect(embeds.length).toBeLessThanOrEqual(10);
  for (const e of embeds) {
    expect((e.description ?? '').length).toBeLessThanOrEqual(4096);
    expect((e.title ?? '').length).toBeLessThanOrEqual(256);
  }
  const rows = (msg.components ?? []) as Row[];
  expect(rows.length).toBeLessThanOrEqual(5);
  const ids = new Set<string>();
  for (const row of rows) {
    expect(row.type).toBe(1);
    expect(row.components.length).toBeGreaterThanOrEqual(1);
    const selects = row.components.filter((c) => c.type === 3);
    if (selects.length) expect(row.components).toHaveLength(1);
    else expect(row.components.length).toBeLessThanOrEqual(5);
    for (const c of row.components) {
      if ('custom_id' in c) {
        expect(c.custom_id.length).toBeLessThanOrEqual(100);
        expect(parseId(c.custom_id), c.custom_id).not.toBeNull();
        expect(ids.has(c.custom_id), `duplicate ${c.custom_id}`).toBe(false);
        ids.add(c.custom_id);
      }
      if ('label' in c && c.label) expect(c.label.length).toBeLessThanOrEqual(80);
      if ('url' in c) expect(c.url.length).toBeLessThanOrEqual(MAX_URL);
      if (c.type === 3) {
        expect(c.options.length).toBeGreaterThanOrEqual(1);
        expect(c.options.length).toBeLessThanOrEqual(MAX_SELECT_OPTIONS);
        expect(c.options.filter((o) => o.default).length).toBeLessThanOrEqual(c.max_values ?? 1);
        for (const o of c.options) {
          expect(o.label.length).toBeLessThanOrEqual(100);
          expect((o.description ?? '').length).toBeLessThanOrEqual(100);
        }
      }
    }
  }
}

describe('render', () => {
  const modes = MODES.map((m) => m.id);

  it('keeps every draft message within Discord limits', () => {
    for (const mode of modes)
      for (let n = 1; n <= 5; n++)
        for (const choices of [1, 3])
          for (const layout of LAYOUTS) {
            const { live } = liveFor(n, { mode, choices });
            const msg = renderDraft(live, layout, ORIGIN);
            expectWithinLimits(msg);
            expect(msg.components).toHaveLength(3);
          }
  });

  it('keeps the link under the URL cap, dropping it rather than breaking', () => {
    const long = (n: number) => player(n, { name: '𝓛𝓸𝓷𝓰 𝓷𝓪𝓶𝓮 𝓯𝓸𝓻 𝓽𝓮𝓼𝓽𝓲𝓷𝓰 𝓲𝓽' });
    const players = [1, 2, 3, 4, 5].map(long);
    const s = settings({ selected: players.map((p) => p.id), choices: 3 });
    const draft = freshDraft(buildStack(s, players, []), s)!;
    const msg = renderDraft({ id: UUID, draft, saved: false }, 'compact', ORIGIN);
    expectWithinLimits(msg);
    expect((msg.components as Row[])[2]!.components).toHaveLength(2);
    // Typical names keep the link.
    const typical = renderDraft(liveFor(5, { choices: 3 }).live, 'compact', ORIGIN);
    expect((typical.components as Row[])[2]!.components).toHaveLength(3);
  });

  it('shows locks, disables rerolling locked slots, and marks saved', () => {
    const { live } = liveFor(3);
    const locked = next(live, applyLock(live, 1));
    const rows = renderDraft({ ...locked, saved: true }, 'compact', ORIGIN).components as Row[];
    const find = (row: number, id: string) => rows[row]!.components.find((c) => 'custom_id' in c && c.custom_id === id)!;
    expect(find(0, encodeId({ action: 'reroll', draftId: UUID, slot: 1 }))).toMatchObject({ disabled: true });
    expect(find(0, encodeId({ action: 'reroll', draftId: UUID, slot: 0 }))).toMatchObject({ disabled: false });
    expect(find(1, encodeId({ action: 'lock', draftId: UUID, slot: 1 }))).toMatchObject({ style: 3, emoji: { name: '🔒' } });
    expect(find(2, encodeId({ action: 'save', draftId: UUID }))).toMatchObject({ disabled: true, label: 'Saved ✓' });
  });

  it('keeps the panel within limits for any squad size and mode', () => {
    for (const mode of modes as DraftMode[])
      for (const n of [0, 1, 3, 5, 25, 30]) {
        const players = squad(n);
        const msg = renderPanel(settings({ mode, selected: players.slice(0, 5).map((p) => p.id), guests: 0 }), players, ORIGIN);
        expectWithinLimits(msg);
      }
  });

  it('only shows the detail row for Themed and Wombo', () => {
    const rows = (mode: DraftMode) => renderPanel(settings({ mode }), squad(2), ORIGIN).components!.length;
    expect(rows('standard')).toBe(3);
    expect(rows('theme')).toBe(4);
    expect(rows('wombo')).toBe(4);
  });
});

describe('panel', () => {
  const players = squad(30);

  it('selects players in order, keeping ones beyond the first 25', () => {
    const s = settings({ selected: ['p2', 'p28'] });
    expect(applyPanel(s, 'players', ['p1', 'p2'], players).selected).toEqual(['p2', 'p28', 'p1']);
    expect(applyPanel(s, 'players', [], players).selected).toEqual(['p28']);
  });

  it('drops deleted players and lets real players push guests out', () => {
    const s = settings({ selected: ['gone', 'p1'], guests: 4 });
    expect(applyPanel(s, 'players', ['p1', 'p2'], players)).toMatchObject({ selected: ['p1', 'p2'], guests: 3 });
  });

  it('adds and removes guests within the stack cap', () => {
    const s = settings({ selected: ['p1', 'p2', 'p3', 'p4'], guests: 0 });
    const plus = applyPanel(s, 'guest+', [], players);
    expect(plus).toMatchObject({ guests: 1 });
    expect(applyPanel(plus, 'guest+', [], players)).toMatchObject({ guests: 1, selected: s.selected });
    expect(applyPanel(plus, 'guest-', [], players)).toMatchObject({ guests: 0, selected: s.selected });
    expect(applyPanel(s, 'guest-', [], players)).toEqual(s);
  });

  it('validates select values and toggles roles', () => {
    expect(applyPanel(settings(), 'mode', ['wombo'], players).mode).toBe('wombo');
    expect(applyPanel(settings({ mode: 'chaos' }), 'mode', ['nope'], players).mode).toBe('standard');
    expect(applyPanel(settings(), 'theme', ['invis'], players).theme).toBe('invis');
    expect(applyPanel(settings(), 'combo', ['meme'], players).comboStyle).toBe('meme');
    expect(applyPanel(settings(), 'roles', [], players).roles).toBe('preferred');
    expect(applyPanel(settings({ roles: 'preferred' }), 'roles', [], players).roles).toBe('random');
  });
});

describe('draft transitions', () => {
  it('rerolling a slot keeps every other slot', () => {
    const { live, stack, s } = liveFor(5);
    const after = next(live, applyReroll(live, 2, stack, s));
    after.draft.slots.forEach((slot, i) => {
      if (i === 2) expect(slot.position).toBe(live.draft.slots[2]!.position);
      else expect(slot).toEqual(live.draft.slots[i]);
    });
    expect(after.draft.id).toBe(live.draft.id);
  });

  it('does not reroll a locked slot', () => {
    const { live, stack, s } = liveFor(3);
    const locked = next(live, applyLock(live, 0));
    expect(next(locked, applyReroll(locked, 0, stack, s)).draft).toEqual(locked.draft);
  });

  it('locks survive "Reroll unlocked", which starts a new draft id', () => {
    const { live, stack, s } = liveFor(5, { mode: 'wombo' });
    const one = next(live, applyLock(live, 1));
    const locked = next(one, applyLock(one, 3));
    for (let k = 0; k < 5; k++) {
      const after = next(locked, applyRerollAll(locked, stack, s));
      expect(after.draft.slots[1]).toEqual(locked.draft.slots[1]);
      expect(after.draft.slots[3]).toEqual(locked.draft.slots[3]);
      expect(after.draft.id).not.toBe(locked.draft.id);
    }
  });

  it('"Reroll unlocked" with an empty stack asks who is playing', () => {
    const { live, s } = liveFor(2);
    expect(applyRerollAll(live, [], s)).toMatch(/who's playing/);
  });

  it('any edit after saving clears saved', () => {
    const { live, stack, s } = liveFor(3);
    const saved = { ...live, saved: true };
    expect(applyLock(saved, 0).saved).toBe(false);
    expect(applyReroll(saved, 0, stack, s).saved).toBe(false);
    expect((applyRerollAll(saved, stack, s) as LiveChange).saved).toBe(false);
  });

  it('saves to history without lock flags', () => {
    const { live } = liveFor(2);
    const locked = next(live, applyLock(live, 0));
    const copy: Draft = historyCopy(locked.draft);
    expect(copy.slots.some((sl) => 'locked' in sl)).toBe(false);
    expect(copy.id).toBe(locked.draft.id);
  });
});

describe('commands', () => {
  it('mode choices match the app modes', () => {
    expect(MODE_CHOICES).toEqual(MODES.map((m) => ({ name: m.name, value: m.id })));
  });

  it('layout and rule limits match the app', () => {
    expect(LAYOUT_CHOICES.map((c) => c.value)).toEqual(LAYOUTS);
    const rules = COMMANDS.find((c) => c.name === 'rules')!;
    const opt = (name: string) => rules.options.find((o) => o.name === name) as { max_value?: number };
    expect(opt('choices').max_value).toBe(MAX_CHOICES);
    expect(opt('avoid_recent').max_value).toBe(MAX_AVOID_RECENT);
  });

  it('are valid command definitions', () => {
    for (const c of COMMANDS) {
      expect(c.name).toMatch(/^[a-z_]{1,32}$/);
      expect(c.description.length).toBeLessThanOrEqual(100);
      for (const o of c.options) {
        expect(o.name).toMatch(/^[a-z_]{1,32}$/);
        expect(o.description.length).toBeLessThanOrEqual(100);
      }
    }
  });

  it('parses positions', () => {
    expect(parsePositions('1235')).toEqual([1, 2, 3, 5]);
    expect(parsePositions('5, 1 1')).toEqual([1, 5]);
    expect(parsePositions('16')).toBeNull();
    expect(parsePositions('')).toBeNull();
  });
});
