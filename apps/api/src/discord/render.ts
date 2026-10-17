import {
  getCombo,
  getHero,
  getMode,
  getTheme,
  heroImages,
  MAX_STACK,
  MODES,
  POSITION_INFO,
  POSITIONS,
  THEMES,
  type ComboChoice,
  type DraftResult,
  type DraftSettings,
  type DraftSlot,
  type Player,
} from '@dota-picker/core';
import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIComponentInMessageActionRow,
  APIEmbed,
  APIInteractionResponseCallbackData,
} from 'discord-api-types/v10';
import { Component, EPHEMERAL, Style } from './constants';
import { encodeId } from './ids';
import type { Layout, LiveDraft } from './store';

export type MessageData = APIInteractionResponseCallbackData;
type Row = APIActionRowComponent<APIComponentInMessageActionRow>;

/** Never ping anyone, even if a player is named "@everyone". */
const NO_MENTIONS = { parse: [] };
/** Discord caps a select at 25 options. */
export const MAX_SELECT_OPTIONS = 25;
const BRAND_COLOR = 0xc23c2a;

export const COMBO_STYLE_LABEL: Record<ComboChoice, string> = { all: 'Classics + memes', classic: 'Classics', meme: 'Memes' };

export const ephemeral = (content: string): MessageData => ({ content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS });

const row = (...components: APIComponentInMessageActionRow[]): Row => ({ type: Component.ActionRow, components });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Squad players in the stack, in selection order (deleted players are skipped). */
const stackPlayers = (settings: DraftSettings, players: readonly Player[]) =>
  settings.selected.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);

/** "Wombo Combo (Classics)", "Themed (Stun Lock)", "Standard". */
export function modeLabel(settings: Pick<DraftSettings, 'mode' | 'theme' | 'comboStyle'>): string {
  const name = getMode(settings.mode).name;
  if (settings.mode === 'theme') return `${name} (${settings.theme === 'surprise' ? 'Surprise' : getTheme(settings.theme)?.name})`;
  if (settings.mode === 'wombo') return `${name} (${COMBO_STYLE_LABEL[settings.comboStyle]})`;
  return name;
}

/** "Kush, Ani + 1 guest", or "nobody yet". */
export function playingText(settings: DraftSettings, players: readonly Player[]): string {
  const names = stackPlayers(settings, players).map((p) => p.name);
  const guests = Math.min(settings.guests, MAX_STACK - names.length);
  const playing = [names.join(', '), guests && `${names.length ? '+ ' : ''}${plural(guests, 'guest')}`]
    .filter(Boolean)
    .join(' ');
  return playing || 'nobody yet';
}

/** One line summing up who's playing and the rules, shown on the panel. */
export function panelSummary(settings: DraftSettings, players: readonly Player[]): string {
  const parts = [
    '**Dota Picker**',
    `Playing: ${playingText(settings, players)}`,
    modeLabel(settings),
    `Roles: ${settings.roles}`,
    settings.positions.length < POSITIONS.length && `Positions ${[...settings.positions].sort().join('')}`,
    settings.choices > 1 && `Pick from ${settings.choices}`,
    settings.avoidRecent > 0 && `Avoid last ${settings.avoidRecent}`,
    settings.bans.length > 0 && `Banned: ${settings.bans.map(heroName).join(', ')}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * The same controls appear on the panel, the /squad picker and under each draft; each host gives
 * them its own custom_ids. 'draft' is the Draft / New draft button.
 */
type IdFor = (control: 'players' | 'mode' | 'theme' | 'combo' | 'guest-' | 'guest+' | 'draft') => string;
const panelIds: IdFor = (control) => encodeId({ action: 'panel', control });
const squadIds: IdFor = (control) =>
  encodeId({ action: 'squad', control: control as 'players' | 'guest-' | 'guest+' | 'draft' });
const draftIds = (draftId: string): IdFor => (control) => encodeId({ action: 'draftControl', draftId, control });

/** The "Who's playing?" select (plus notes for an empty or oversized squad). */
function playersSelect(settings: DraftSettings, players: readonly Player[], origin: string, idFor: IdFor) {
  const shown = players.slice(0, MAX_SELECT_OPTIONS);
  if (!shown.length) return { rows: [], notes: [`No squad yet. Add players at ${origin}/squad, or play with guests.`] };
  const select = row({
    type: Component.StringSelect,
    custom_id: idFor('players'),
    placeholder: "Who's playing?",
    min_values: 0,
    max_values: Math.min(MAX_STACK, shown.length),
    options: shown.map((p) => ({ label: p.name, value: p.id, default: settings.selected.includes(p.id) })),
  });
  const notes = players.length > shown.length ? [`-# Only the first ${MAX_SELECT_OPTIONS} squad players are listed.`] : [];
  return { rows: [select], notes };
}

/** The mode select, plus the theme or combo-style select when the mode has one. */
function modeRows(settings: DraftSettings, idFor: IdFor): Row[] {
  const rows = [
    row({
      type: Component.StringSelect,
      custom_id: idFor('mode'),
      options: MODES.map((m) => ({ label: m.name, value: m.id, description: m.blurb, default: m.id === settings.mode })),
    }),
  ];
  if (settings.mode === 'theme') {
    rows.push(
      row({
        type: Component.StringSelect,
        custom_id: idFor('theme'),
        options: [
          { label: 'Surprise me', value: 'surprise', description: 'A random theme each draft', default: settings.theme === 'surprise' },
          ...THEMES.map((t) => ({ label: t.name, value: t.id, description: t.blurb, default: t.id === settings.theme })),
        ],
      }),
    );
  } else if (settings.mode === 'wombo') {
    rows.push(
      row({
        type: Component.StringSelect,
        custom_id: idFor('combo'),
        options: (Object.keys(COMBO_STYLE_LABEL) as ComboChoice[]).map((c) => ({
          label: COMBO_STYLE_LABEL[c],
          value: c,
          default: c === settings.comboStyle,
        })),
      }),
    );
  }
  return rows;
}

function guestButtons(settings: DraftSettings, players: readonly Player[], idFor: IdFor): APIButtonComponent[] {
  const size = Math.min(stackPlayers(settings, players).length + settings.guests, MAX_STACK);
  return [
    {
      type: Component.Button,
      style: Style.Secondary,
      custom_id: idFor('guest-'),
      label: 'Guest',
      emoji: { name: '➖' },
      disabled: settings.guests === 0,
    },
    {
      type: Component.Button,
      style: Style.Secondary,
      custom_id: idFor('guest+'),
      label: 'Guest',
      emoji: { name: '➕' },
      disabled: size >= MAX_STACK,
    },
  ];
}

const draftButton = (idFor: IdFor, label = 'Draft'): APIButtonComponent => ({
  type: Component.Button,
  style: Style.Primary,
  custom_id: idFor('draft'),
  label,
  emoji: { name: '🎲' },
});

/** The /squad picker (only the person who ran it sees it): who's playing, guests, Draft. Nothing else changes. */
export function renderSquadPicker(settings: DraftSettings, players: readonly Player[], origin: string): MessageData {
  const { rows, notes } = playersSelect(settings, players, origin, squadIds);
  return {
    content: [`**Playing:** ${playingText(settings, players)}`, ...notes].join('\n'),
    components: [...rows, row(...guestButtons(settings, players, squadIds), draftButton(squadIds))],
    flags: EPHEMERAL,
    allowed_mentions: NO_MENTIONS,
  };
}

/** The control panel: who's playing, mode, guests, roles and the Draft button. */
export function renderPanel(settings: DraftSettings, players: readonly Player[], origin: string): MessageData {
  const { rows, notes } = playersSelect(settings, players, origin, panelIds);
  const lines = [panelSummary(settings, players), ...notes];
  rows.push(...modeRows(settings, panelIds));

  rows.push(
    row(
      ...guestButtons(settings, players, panelIds),
      {
        type: Component.Button,
        style: Style.Secondary,
        custom_id: encodeId({ action: 'panel', control: 'roles' }),
        label: `Roles: ${settings.roles === 'preferred' ? 'Preferred' : 'Random'}`,
      },
      draftButton(panelIds),
    ),
  );

  return { content: lines.join('\n'), components: rows, allowed_mentions: NO_MENTIONS };
}

const heroName = (id: number | undefined) => (id === undefined ? '?' : (getHero(id)?.name ?? `Hero #${id}`));
const slotHeroes = (s: DraftSlot) => (s.pick === null ? s.heroes.map(heroName).join(' / ') : heroName(s.heroes[s.pick]));
const positionTag = (s: DraftSlot) => `\`${s.position} ${POSITION_INFO[s.position].short}\``;
const colorInt = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : BRAND_COLOR);

/** Header like the web app's "Copy for Discord": mode, theme or combo, and how the combo goes. */
export function draftHeader(draft: DraftResult): string {
  const combo = draft.mode === 'wombo' ? getCombo(draft.comboId) : undefined;
  const extra = draft.mode === 'theme' ? getTheme(draft.theme)?.name : combo?.name;
  return [
    `**Dota draft · ${getMode(draft.mode).name}${extra ? ` · ${extra}` : ''}**`,
    ...(combo ? [`> ${combo.how}`] : []),
    ...(combo?.moment ? [`> 🏆 ${combo.moment}`] : []),
  ].join('\n');
}

function draftEmbeds(draft: DraftResult, layout: Layout): APIEmbed[] {
  const slots = [...draft.slots].sort((a, b) => a.position - b.position);
  if (layout === 'cards') {
    return slots.map((s) => {
      const hero = getHero(s.heroes[s.pick ?? 0] ?? 0);
      return {
        color: colorInt(s.color),
        title: `${s.locked ? '🔒 ' : ''}${s.name}`,
        description: `${positionTag(s)} · ${slotHeroes(s)}`,
        ...(hero && { thumbnail: { url: heroImages.portrait(hero) } }),
      };
    });
  }
  return [
    {
      color: BRAND_COLOR,
      // Player first and bold: who plays what is what people scan for; the hero name follows.
      description: slots.map((s) => `${s.locked ? '🔒 ' : ''}**${s.name}** · ${positionTag(s)} ${slotHeroes(s)}`).join('\n'),
    },
  ];
}

/**
 * A posted draft: the lineup, one 🎲 reroll button per player (in position order), then the panel's
 * squad and mode controls and 🎲 New draft, so the newest draft is all you need in the overlay.
 * Changing squad or mode only affects the next draft. (Lock, reroll-unlocked and save still work
 * for older messages; they're just not shown any more.)
 */
export function renderDraft(
  live: Pick<LiveDraft, 'id' | 'draft'>,
  layout: Layout,
  settings: DraftSettings,
  players: readonly Player[],
  origin: string,
): MessageData {
  const idFor = draftIds(live.id);
  const { draft } = live;
  const order = draft.slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.position - b.s.position);
  const rerolls: APIButtonComponent[] = order.map(({ s, i }) => ({
    type: Component.Button,
    style: Style.Secondary,
    custom_id: encodeId({ action: 'reroll', draftId: live.id, slot: i }),
    label: s.name,
    emoji: { name: '🎲' },
    disabled: !!s.locked,
  }));
  return {
    content: draftHeader(draft),
    embeds: draftEmbeds(draft, layout),
    // At most 5 rows: rerolls, squad, mode, theme/combo, buttons.
    components: [
      row(...rerolls),
      ...playersSelect(settings, players, origin, idFor).rows,
      ...modeRows(settings, idFor),
      row(...guestButtons(settings, players, idFor), draftButton(idFor, 'New draft')),
    ],
    allowed_mentions: NO_MENTIONS,
  };
}
