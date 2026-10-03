import { getCombo } from './combos';
import { pickedHeroId, type DraftResult } from './draft';
import { getHero } from './heroes';
import { getMode, getTheme } from './modes';
import { POSITION_INFO } from './positions';
import { sanitizeDraft } from './validate';

type PackedSlot = [name: string, color: string, position: number, heroes: number[], pick: number | null];
type Packed = [version: 1, mode: string, theme: string, combo: string, slots: PackedSlot[]];

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Packs a draft into a short URL-safe string, so a link alone can show it. */
export function encodeDraft(draft: DraftResult): string {
  const packed: Packed = [
    1,
    draft.mode,
    draft.theme ?? '',
    draft.comboId ?? '',
    draft.slots.map((s) => [s.name, s.color, s.position, s.heroes, s.pick]),
  ];
  return toBase64Url(JSON.stringify(packed));
}

export function decodeDraft(code: string): DraftResult | null {
  try {
    const packed = JSON.parse(fromBase64Url(code)) as Packed;
    if (!Array.isArray(packed) || packed[0] !== 1 || !Array.isArray(packed[4])) return null;
    const draft = sanitizeDraft({
      id: 'shared',
      createdAt: Date.now(),
      mode: packed[1],
      theme: packed[2] || undefined,
      comboId: packed[3] || undefined,
      slots: packed[4].map(([name, color, position, heroes, pick]) => ({ playerId: null, name, color, position, heroes, pick })),
    });
    if (!draft) return null;
    const { id: _id, createdAt: _createdAt, ...result } = draft;
    return result;
  } catch {
    return null;
  }
}

const heroName = (id: number | undefined) => (id === undefined ? '?' : (getHero(id)?.name ?? `Hero #${id}`));

/** Plain-text summary that renders nicely when pasted into Discord. */
export function draftToText(draft: DraftResult, url?: string): string {
  const extra =
    draft.mode === 'theme' ? getTheme(draft.theme)?.name : draft.mode === 'wombo' ? getCombo(draft.comboId)?.name : undefined;
  const rows = [...draft.slots]
    .sort((a, b) => a.position - b.position)
    .map((s) => [
      `Pos ${s.position} ${POSITION_INFO[s.position].short}`,
      s.name,
      s.pick === null ? s.heroes.map(heroName).join(' / ') : heroName(pickedHeroId(s)),
    ]);
  const w0 = Math.max(...rows.map((r) => r[0]!.length));
  const w1 = Math.max(...rows.map((r) => r[1]!.length));
  return [
    `**Dota draft · ${getMode(draft.mode).name}${extra ? ` · ${extra}` : ''}**`,
    '```',
    ...rows.map(([pos, name, hero]) => `${pos!.padEnd(w0)}  ${name!.padEnd(w1)}  ${hero}`),
    '```',
    ...(url ? [url] : []),
  ].join('\n');
}
