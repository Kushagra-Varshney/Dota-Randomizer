import type { Draft, Player } from '@dota-picker/core';
import { create } from 'zustand';
import { api, ApiError } from './api';
import { readJson, writeJson } from './storage';
import { toast } from './toast';

/**
 * Squad + history store. Talks to the Worker API when it's reachable ("cloud"),
 * otherwise keeps everything in this browser ("local"). Either way the last known
 * data is cached locally so the app paints instantly on load.
 */
export type SyncMode = 'loading' | 'cloud' | 'local';

interface SquadStore {
  sync: SyncMode;
  pinRequired: boolean;
  pinPrompt: boolean;
  players: Player[];
  drafts: Draft[];
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  savePlayer: (player: Player) => Promise<boolean>;
  removePlayer: (id: string) => Promise<boolean>;
  saveDraft: (draft: Draft) => Promise<boolean>;
  removeDraft: (id: string) => Promise<boolean>;
  setPinPrompt: (open: boolean) => void;
}

const CACHE_PLAYERS = 'dp.players';
const CACHE_DRAFTS = 'dp.drafts';
const MAX_LOCAL_DRAFTS = 100;

const byNewest = (a: Draft, b: Draft) => b.createdAt - a.createdAt;
const upsert = <T extends { id: string }>(items: T[], item: T) =>
  items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];

export const useSquad = create<SquadStore>()((set, get) => {
  const cache = () => {
    writeJson(CACHE_PLAYERS, get().players);
    writeJson(CACHE_DRAFTS, get().drafts);
  };

  /** Applies a change immediately, then syncs it; rolls back if the server says no. */
  async function mutate(next: Partial<SquadStore>, remote: () => Promise<unknown>): Promise<boolean> {
    const before = { players: get().players, drafts: get().drafts };
    set(next);
    cache();
    if (get().sync !== 'cloud') return true;
    try {
      await remote();
      return true;
    } catch (err) {
      set(before);
      cache();
      if (err instanceof ApiError && err.status === 401) {
        set({ pinRequired: true, pinPrompt: true });
        toast.error('This squad is PIN-protected. Enter the PIN, then try again.');
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error(err.message);
      } else {
        toast.error("Couldn't sync that change. Check your connection.");
      }
      return false;
    }
  }

  return {
    sync: 'loading',
    pinRequired: false,
    pinPrompt: false,
    players: readJson<Player[]>(CACHE_PLAYERS, []),
    drafts: readJson<Draft[]>(CACHE_DRAFTS, []),

    init: async () => {
      try {
        const health = await api.health();
        set({ sync: 'cloud', pinRequired: health.pinRequired });
        await get().refresh();
      } catch {
        set({ sync: 'local' });
      }
    },

    refresh: async () => {
      if (get().sync !== 'cloud') return;
      try {
        const [players, drafts] = await Promise.all([api.players(), api.drafts()]);
        set({ players, drafts: drafts.sort(byNewest) });
        cache();
      } catch {
        toast.error("Couldn't load the squad from the server. Showing cached data.");
      }
    },

    savePlayer: (player) => mutate({ players: upsert(get().players, player) }, () => api.savePlayer(player)),

    removePlayer: (id) =>
      mutate({ players: get().players.filter((p) => p.id !== id) }, () => api.deletePlayer(id)),

    saveDraft: (draft) =>
      mutate({ drafts: upsert(get().drafts, draft).sort(byNewest).slice(0, MAX_LOCAL_DRAFTS) }, () =>
        api.saveDraft(draft),
      ),

    removeDraft: (id) => mutate({ drafts: get().drafts.filter((d) => d.id !== id) }, () => api.deleteDraft(id)),

    setPinPrompt: (open) => set({ pinPrompt: open }),
  };
});
