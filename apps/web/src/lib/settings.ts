import {
  MAX_STACK,
  POSITIONS,
  type ComboChoice,
  type DraftMode,
  type Position,
  type RoleMode,
  type ThemeChoice,
} from '@dota-picker/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  mode: DraftMode;
  theme: ThemeChoice;
  comboStyle: ComboChoice;
  roles: RoleMode;
  positions: Position[];
  choices: number;
  /** How many recent saved drafts to steer away from (0 = off). */
  avoidRecent: number;
  /** Heroes nobody gets. */
  bans: number[];
  animate: boolean;
  /** Selected squad player ids, in selection order. */
  selected: string[];
  guests: number;
  /** Position locks for this session, keyed by slot key. */
  fixedRoles: Record<string, Position>;
  rulesOpen: boolean;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  togglePlayer: (id: string) => void;
  setStackSize: (size: number) => void;
  setFixedRole: (key: string, position: Position | null) => void;
}

const DEFAULTS: Settings = {
  mode: 'standard',
  theme: 'surprise',
  comboStyle: 'all',
  roles: 'random',
  positions: [...POSITIONS],
  choices: 1,
  avoidRecent: 0,
  bans: [],
  animate: true,
  selected: [],
  guests: 0,
  fixedRoles: {},
  rulesOpen: true,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      togglePlayer: (id) => {
        const { selected, guests } = get();
        if (selected.includes(id)) {
          set({ selected: selected.filter((x) => x !== id) });
        } else if (selected.length + guests < MAX_STACK) {
          set({ selected: [...selected, id] });
        } else if (guests > 0) {
          // Stack is full of guests: a real player replaces one.
          set({ selected: [...selected, id], guests: guests - 1 });
        }
      },
      setStackSize: (size) => {
        const { selected } = get();
        if (size >= selected.length) set({ guests: size - selected.length });
        else set({ selected: selected.slice(0, size), guests: 0 });
      },
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
