import { isId } from '@dota-picker/core';

/** Controls on the panel message. */
export const PANEL_CONTROLS = ['players', 'mode', 'theme', 'combo', 'guest-', 'guest+', 'roles', 'draft'] as const;
export type PanelControl = (typeof PANEL_CONTROLS)[number];
/** Controls on the /squad picker: only who's playing, plus Draft. */
export const SQUAD_CONTROLS = ['players', 'guest-', 'guest+', 'draft'] as const;
export type SquadControl = (typeof SQUAD_CONTROLS)[number];

/** What a button or select does, encoded in its custom_id as `dp:<action>:<arg>[:<slot>]`. */
export type ComponentAction =
  | { action: 'panel'; control: PanelControl }
  | { action: 'squad'; control: SquadControl }
  | { action: 'reroll'; draftId: string; slot: number }
  | { action: 'lock'; draftId: string; slot: number }
  | { action: 'rerollAll'; draftId: string }
  | { action: 'save'; draftId: string };

const CODES = { panel: 'p', reroll: 'rr', lock: 'lk', rerollAll: 'ra', save: 'sv' } as const;

export function encodeId(a: ComponentAction): string {
  switch (a.action) {
    case 'panel':
      return `dp:p:${a.control}`;
    case 'squad':
      return `dp:s:${a.control}`;
    case 'reroll':
    case 'lock':
      return `dp:${CODES[a.action]}:${a.draftId}:${a.slot}`;
    case 'rerollAll':
    case 'save':
      return `dp:${CODES[a.action]}:${a.draftId}`;
  }
}

export function parseId(customId: string): ComponentAction | null {
  const [prefix, code, arg = '', slotText, ...rest] = customId.split(':');
  if (prefix !== 'dp' || rest.length) return null;
  if (code === 'p') {
    const control = PANEL_CONTROLS.find((c) => c === arg);
    return control && slotText === undefined ? { action: 'panel', control } : null;
  }
  if (code === 's') {
    const control = SQUAD_CONTROLS.find((c) => c === arg);
    return control && slotText === undefined ? { action: 'squad', control } : null;
  }
  if (!isId(arg)) return null;
  if (code === 'rr' || code === 'lk') {
    const slot = Number(slotText);
    if (!Number.isInteger(slot) || slot < 0 || slot > 4 || String(slot) !== slotText) return null;
    return { action: code === 'rr' ? 'reroll' : 'lock', draftId: arg, slot };
  }
  if (slotText !== undefined) return null;
  if (code === 'ra') return { action: 'rerollAll', draftId: arg };
  if (code === 'sv') return { action: 'save', draftId: arg };
  return null;
}
