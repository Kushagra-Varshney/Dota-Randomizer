import {
  buildStack,
  draftToText,
  encodeDraft,
  getHero,
  heroImages,
  movePosition,
  rerollSlot,
  rollKeepingLocks,
  slotKey,
  updateSlot,
  type Draft,
  type Position,
} from '@dota-picker/core';
import { useDraftStore } from './draftStore';
import { useSettings } from './settings';
import { useSquad } from './squad';
import { toast } from './toast';
import { copyText, newId, preload } from './ui';

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
  const current = useDraftStore.getState().draft;
  const { draft: result, rolled: spin } = rollKeepingLocks(stack, useSettings.getState(), current);
  const draft: Draft = { ...result, id: newId(), createdAt: Date.now() };
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
