import {
  DEFAULT_DRAFT_SETTINGS,
  setStackSize,
  togglePlayer,
  type DraftSettings,
  type Position,
} from '@dota-picker/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings extends DraftSettings {
  animate: boolean;
  rulesOpen: boolean;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  togglePlayer: (id: string) => void;
  setStackSize: (size: number) => void;
  setFixedRole: (key: string, position: Position | null) => void;
}

const DEFAULTS: Settings = { ...DEFAULT_DRAFT_SETTINGS, animate: true, rulesOpen: true };

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      togglePlayer: (id) => set(togglePlayer(get(), id)),
      setStackSize: (size) => set(setStackSize(get(), size)),
      setFixedRole: (key, position) => {
        const fixedRoles = Object.fromEntries(
          Object.entries(get().fixedRoles).filter(([k, p]) => k !== key && p !== position),
        );
        if (position) fixedRoles[key] = position;
        set({ fixedRoles });
      },
    }),
    {
      name: 'dp.settings',
      version: 1,
      partialize: ({ set: _set, togglePlayer: _t, setStackSize: _s, setFixedRole: _f, ...settings }) => settings,
    },
  ),
);
