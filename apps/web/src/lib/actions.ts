import {
  draftToText,
  encodeDraft,
  generateDraft,
  getHero,
  heroImages,
  movePosition,
  pickedHeroId,
  rerollSlot,
  updateSlot,
  type Draft,
  type DraftSlot,
  type Player,
  type Position,
  type SlotInput,
} from '@dota-picker/core';
import { useDraftStore } from './draftStore';
import { useSettings, type Settings } from './settings';
import { useSquad } from './squad';
import { toast } from './toast';
import { copyText, GUEST_COLOR, newId, preload } from './ui';

export interface StackMember extends SlotInput {
  /** Stable identity used to match locked cards and position locks across rolls. */
  key: string;
}

export const slotKey = (slot: Pick<DraftSlot, 'playerId' | 'name'>) => slot.playerId ?? `guest:${slot.name}`;
export const guestName = (n: number) => `Guest ${n}`;

/** Heroes each player had in their most recent saved drafts. */
function recentPicks(drafts: Draft[], playerId: string, count: number): number[] {
  if (!count) return [];
  return drafts
    .slice(0, count)
    .flatMap((d) => d.slots.filter((s) => s.playerId === playerId).map(pickedHeroId))
    .filter((id): id is number => id !== undefined);
}

export function buildStack(settings: Settings, players: Player[], drafts: Draft[]): StackMember[] {
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
  return members.slice(0, 5).map((m) => ({ ...m, fixedPosition: settings.fixedRoles[m.key] ?? null }));
}

const currentStack = () => {
  const { players, drafts } = useSquad.getState();
  return buildStack(useSettings.getState(), players, drafts);
};

function preloadDraft(draft: Draft, indexes: number[]) {
  const heroes = indexes.flatMap((i) => draft.slots[i]?.heroes ?? []).map(getHero);
  preload(heroes.flatMap((h) => (h ? [heroImages.portrait(h), heroImages.crop(h)] : [])));
}

/** Rolls a fresh draft, keeping any locked cards of players still in the stack. */
export function rollDraft(): void {
  const stack = currentStack();
  if (!stack.length) {
    toast.info("Pick who's playing first");
    return;
  }
  const s = useSettings.getState();
  const current = useDraftStore.getState().draft;
  const keep = stack.map((m) => current?.slots.find((slot) => slot.locked && slotKey(slot) === m.key));
  const result = generateDraft(stack, {
    mode: s.mode,
    theme: s.theme,
    roles: s.roles,
    positions: s.positions,
    choices: s.choices,
    bans: s.bans,
    keep,
    previous: current ?? undefined,
  });
  const draft: Draft = { ...result, id: newId(), createdAt: Date.now() };
  const spin = draft.slots.map((_, i) => i).filter((i) => !keep[i]);
  preloadDraft(draft, spin);
  useDraftStore.getState().show(draft, spin);
  if (location.search) history.replaceState(null, '', '/');
}

export function rerollOne(index: number): void {
  const { draft, edit } = useDraftStore.getState();
  const slot = draft?.slots[index];
  if (!draft || !slot) return;
  if (slot.locked) {
    toast.info(`${slot.name}'s card is locked`);
    return;
  }
  const s = useSettings.getState();
  const member = currentStack().find((m) => m.key === slotKey(slot)) ?? slot;
  const next = rerollSlot(draft, index, member, { choices: s.choices, bans: s.bans });
  preloadDraft(next, [index]);
  edit(() => next, [index]);
}

export const toggleLock = (index: number) =>
  useDraftStore.getState().edit((d) => updateSlot(d, index, { locked: !d.slots[index]?.locked }));

export const choosePick = (index: number, pick: number | null) =>
  useDraftStore.getState().edit((d) => updateSlot(d, index, { pick }));

export const moveToPosition = (index: number, position: Position) =>
  useDraftStore.getState().edit((d) => movePosition(d, index, position));

export const shareUrl = (draft: Draft) => `${location.origin}/?d=${encodeDraft(draft)}`;

export async function copyForDiscord(): Promise<void> {
  const { draft } = useDraftStore.getState();
  if (!draft) return;
  const ok = await copyText(draftToText(draft, shareUrl(draft)));
  if (ok) toast.success('Copied. Paste it in Discord');
  else toast.error("Couldn't copy to clipboard");
}

export async function shareDraft(): Promise<void> {
  const { draft } = useDraftStore.getState();
  if (!draft) return;
  const url = shareUrl(draft);
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    await navigator.share({ title: 'Dota draft', url }).catch(() => undefined);
    return;
  }
  if (await copyText(url)) toast.success('Share link copied');
  else toast.error("Couldn't copy the link");
}

export async function saveCurrentDraft(): Promise<void> {
  const { draft, saved, markSaved } = useDraftStore.getState();
  if (!draft || saved) return;
  if (await useSquad.getState().saveDraft({ ...draft, slots: draft.slots.map(({ locked: _, ...s }) => s) })) {
    markSaved();
    toast.success('Saved to history');
  }
}

/** Shows an existing draft (from history or a share link) without the reveal. */
export function openDraft(draft: Draft, { shared = false, saved = false } = {}): void {
  preloadDraft(draft, draft.slots.map((_, i) => i));
  useDraftStore.getState().show(draft, [], shared);
  if (saved) useDraftStore.getState().markSaved();
}
