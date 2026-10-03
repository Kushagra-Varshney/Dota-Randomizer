import type { Draft } from '@dota-picker/core';
import { create } from 'zustand';
import { useSettings } from './settings';

interface Reveal {
  /** Bumps on every roll so cards know to spin again. */
  token: number;
  /** Slot indexes still spinning for this token. */
  slots: number[];
}

interface DraftStore {
  draft: Draft | null;
  reveal: Reveal;
  saved: boolean;
  /** Opened from a share link rather than rolled here. */
  shared: boolean;
  show: (draft: Draft, spin: number[], shared?: boolean) => void;
  edit: (update: (draft: Draft) => Draft, spin?: number[]) => void;
  markSaved: () => void;
  finishSpin: (index: number, token: number) => void;
  skipReveal: () => void;
}

const spinning = (slots: number[]) => (useSettings.getState().animate ? slots : []);

export const useDraftStore = create<DraftStore>()((set, get) => ({
  draft: null,
  reveal: { token: 0, slots: [] },
  saved: false,
  shared: false,
  show: (draft, spin, shared = false) =>
    set({ draft, saved: false, shared, reveal: { token: get().reveal.token + 1, slots: spinning(spin) } }),
  edit: (update, spin) => {
    const { draft, reveal } = get();
    if (!draft) return;
    set({
      draft: update(draft),
      saved: false,
      ...(spin && { reveal: { token: reveal.token + 1, slots: spinning(spin) } }),
    });
  },
  markSaved: () => set({ saved: true }),
  finishSpin: (index, token) => {
    const { reveal } = get();
    if (reveal.token === token) set({ reveal: { token, slots: reveal.slots.filter((i) => i !== index) } });
  },
  skipReveal: () => set({ reveal: { token: get().reveal.token, slots: [] } }),
}));
