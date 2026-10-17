import {
  buildStack,
  MAX_STACK,
  rerollSlot,
  rollKeepingLocks,
  sanitizeDraftSettings,
  setStackSize,
  slotKey,
  updateSlot,
  type Draft,
  type DraftSettings,
  type Player,
  type StackMember,
} from '@dota-picker/core';
import type { APIMessageComponentInteraction } from 'discord-api-types/v10';
import { listDrafts, listPlayers, saveDraft } from '../db';
import type { BotContext, InteractionReply } from './handler';
import { parseId, type PanelControl } from './ids';
import { ephemeral, MAX_SELECT_OPTIONS, renderDraft, renderPanel } from './render';
import {
  createLiveDraft,
  getGuild,
  getLiveDraft,
  mutateLiveDraft,
  saveSettings,
  writeLiveDraft,
  type GuildConfig,
  type LiveChange,
  type LiveDraft,
} from './store';

export const EMPTY_STACK = "Pick who's playing first.";
export const EXPIRED = 'That draft has expired. Hit 🎲 Draft on the panel.';
const NOT_SET_UP = 'Run `/setup` in a channel first.';

const newDraftId = () => crypto.randomUUID();

// Pure state transitions, shared by the handlers below and the tests.

/** Settings after a panel select or button. `values` are the select's chosen values. */
export function applyPanel(
  settings: DraftSettings,
  control: Exclude<PanelControl, 'draft'>,
  values: readonly string[],
  players: readonly Player[],
): DraftSettings {
  const size = () => settings.selected.length + settings.guests;
  switch (control) {
    case 'players': {
      // Keep the existing order; players not listed in the select (beyond the first 25) stay selected.
      const shown = new Set(players.slice(0, MAX_SELECT_OPTIONS).map((p) => p.id));
      const exists = new Set(players.map((p) => p.id));
      const kept = settings.selected.filter((id) => exists.has(id) && (values.includes(id) || !shown.has(id)));
      const added = values.filter((id) => shown.has(id) && !kept.includes(id));
      const selected = [...kept, ...added].slice(0, MAX_STACK);
      // Real players push guests out when the stack is full, like the web app.
      return { ...settings, selected, guests: Math.min(settings.guests, MAX_STACK - selected.length) };
    }
    case 'mode':
      return sanitizeDraftSettings({ ...settings, mode: values[0] });
    case 'theme':
      return sanitizeDraftSettings({ ...settings, theme: values[0] });
    case 'combo':
      return sanitizeDraftSettings({ ...settings, comboStyle: values[0] });
    case 'guest-':
      return settings.guests > 0 ? { ...settings, ...setStackSize(settings, size() - 1) } : settings;
    case 'guest+':
      return { ...settings, ...setStackSize(settings, size() + 1) };
    case 'roles':
      return { ...settings, roles: settings.roles === 'preferred' ? 'random' : 'preferred' };
  }
}

/** A brand new draft for the stack, or null when nobody is playing. */
export function freshDraft(stack: readonly StackMember[], settings: DraftSettings): Draft | null {
  if (!stack.length) return null;
  const { draft } = rollKeepingLocks(stack, settings, null);
  return { ...draft, id: newDraftId(), createdAt: Date.now() };
}

/** New heroes for one slot. Locked slots are left alone. */
export function applyReroll(live: LiveDraft, index: number, stack: readonly StackMember[], settings: DraftSettings): LiveChange {
  const slot = live.draft.slots[index];
  if (!slot || slot.locked) return { draft: live.draft, saved: live.saved };
  const member = stack.find((m) => m.key === slotKey(slot)) ?? slot;
  return { draft: rerollSlot(live.draft, index, member, { choices: settings.choices, bans: settings.bans }), saved: false };
}

export function applyLock(live: LiveDraft, index: number): LiveChange {
  const slot = live.draft.slots[index];
  if (!slot) return { draft: live.draft, saved: live.saved };
  return { draft: updateSlot(live.draft, index, { locked: !slot.locked }), saved: false };
}

/** A new roll with the current settings, keeping locked slots. It's a new draft, so it gets a new id. */
export function applyRerollAll(live: LiveDraft, stack: readonly StackMember[], settings: DraftSettings): LiveChange | string {
  if (!stack.length) return EMPTY_STACK;
  const { draft } = rollKeepingLocks(stack, settings, live.draft);
  return { draft: { ...draft, id: newDraftId(), createdAt: Date.now() }, saved: false };
}

/** What goes into history: the draft without lock flags, same as the web app saves. */
export const historyCopy = (draft: Draft): Draft => ({ ...draft, slots: draft.slots.map(({ locked: _, ...s }) => s) });

// Handlers

async function loadStack(ctx: BotContext, guild: GuildConfig) {
  const [players, drafts] = await Promise.all([
    listPlayers(ctx.db),
    guild.settings.avoidRecent ? listDrafts(ctx.db, guild.settings.avoidRecent) : Promise.resolve([]),
  ]);
  return { players, stack: buildStack(guild.settings, players, drafts) };
}

/** Rolls and posts a new draft message (panel Draft button and /draft). */
export async function postNewDraft(ctx: BotContext, guild: GuildConfig): Promise<InteractionReply> {
  const { stack } = await loadStack(ctx, guild);
  const draft = freshDraft(stack, guild.settings);
  if (!draft) return { kind: 'message', data: ephemeral(EMPTY_STACK) };
  const live = await createLiveDraft(ctx.db, guild.guildId, draft);
  return { kind: 'message', data: renderDraft(live, guild.layout) };
}

const values = (i: APIMessageComponentInteraction): string[] => ('values' in i.data ? i.data.values : []);

export async function handleComponent(i: APIMessageComponentInteraction, ctx: BotContext): Promise<InteractionReply> {
  const action = parseId(i.data.custom_id);
  if (!action) return { kind: 'message', data: ephemeral('That button is from an older version of the bot.') };

  const guild = await getGuild(ctx.db, ctx.guildId);
  if (!guild) return { kind: 'message', data: ephemeral(NOT_SET_UP) };

  if (action.action === 'panel') {
    if (action.control === 'draft') return postNewDraft(ctx, guild);
    const players = await listPlayers(ctx.db);
    const settings = applyPanel(guild.settings, action.control, values(i), players);
    await saveSettings(ctx.db, guild.guildId, settings);
    return { kind: 'update', data: renderPanel(settings, players, ctx.origin) };
  }

  const draftId = action.draftId;
  const render = (live: LiveDraft): InteractionReply => ({ kind: 'update', data: renderDraft(live, guild.layout) });

  if (action.action === 'save') {
    const live = await getLiveDraft(ctx.db, draftId);
    if (!live || live.guildId !== guild.guildId) return { kind: 'message', data: ephemeral(EXPIRED) };
    if (live.saved) return render(live);
    await saveDraft(ctx.db, historyCopy(live.draft));
    // If someone changed the draft meanwhile, show their version; it can be saved again.
    const written = await writeLiveDraft(ctx.db, live, { draft: live.draft, saved: true });
    const latest = written ?? (await getLiveDraft(ctx.db, draftId));
    return latest ? render(latest) : { kind: 'message', data: ephemeral(EXPIRED) };
  }

  const { stack } = action.action === 'lock' ? { stack: [] } : await loadStack(ctx, guild);
  const result = await mutateLiveDraft(ctx.db, draftId, (live) => {
    if (live.guildId !== guild.guildId) return EXPIRED;
    switch (action.action) {
      case 'reroll':
        return applyReroll(live, action.slot, stack, guild.settings);
      case 'lock':
        return applyLock(live, action.slot);
      case 'rerollAll':
        return applyRerollAll(live, stack, guild.settings);
    }
  });
  if (result === null) return { kind: 'message', data: ephemeral(EXPIRED) };
  if (typeof result === 'string') return { kind: 'message', data: ephemeral(result) };
  return render(result);
}
