import {
  encodeDraft,
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
/** Discord's caps: options per select, URL length of a link button. */
export const MAX_SELECT_OPTIONS = 25;
export const MAX_URL = 512;
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

/** One line summing up who's playing and the rules, shown on the panel. */
export function panelSummary(settings: DraftSettings, players: readonly Player[]): string {
  const names = stackPlayers(settings, players).map((p) => p.name);
  const guests = Math.min(settings.guests, MAX_STACK - names.length);
  const playing = [names.join(', '), guests && `${names.length ? '+ ' : ''}${plural(guests, 'guest')}`]
    .filter(Boolean)
    .join(' ');
  const parts = [
    '**Dota Picker**',
    `Playing: ${playing || 'nobody yet'}`,
    modeLabel(settings),
    `Roles: ${settings.roles}`,
    settings.positions.length < POSITIONS.length && `Positions ${[...settings.positions].sort().join('')}`,
    settings.choices > 1 && `Pick from ${settings.choices}`,
    settings.avoidRecent > 0 && `Avoid last ${settings.avoidRecent}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** The control panel: who's playing, mode, guests, roles and the Draft button. */
export function renderPanel(settings: DraftSettings, players: readonly Player[], origin: string): MessageData {
  const lines = [panelSummary(settings, players)];
  const rows: Row[] = [];

  const shown = players.slice(0, MAX_SELECT_OPTIONS);
  if (shown.length) {
    rows.push(
      row({
        type: Component.StringSelect,
        custom_id: encodeId({ action: 'panel', control: 'players' }),
        placeholder: "Who's playing?",
        min_values: 0,
        max_values: Math.min(MAX_STACK, shown.length),
        options: shown.map((p) => ({ label: p.name, value: p.id, default: settings.selected.includes(p.id) })),
      }),
    );
    if (players.length > shown.length) lines.push(`-# Only the first ${MAX_SELECT_OPTIONS} squad players are listed.`);
  } else {
    lines.push(`No squad yet. Add players at ${origin}/squad, or play with guests.`);
  }

  rows.push(
    row({
      type: Component.StringSelect,
      custom_id: encodeId({ action: 'panel', control: 'mode' }),
      options: MODES.map((m) => ({ label: m.name, value: m.id, description: m.blurb, default: m.id === settings.mode })),
    }),
  );

  if (settings.mode === 'theme') {
    rows.push(
      row({
        type: Component.StringSelect,
        custom_id: encodeId({ action: 'panel', control: 'theme' }),
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
        custom_id: encodeId({ action: 'panel', control: 'combo' }),
        options: (Object.keys(COMBO_STYLE_LABEL) as ComboChoice[]).map((c) => ({
          label: COMBO_STYLE_LABEL[c],
          value: c,
          default: c === settings.comboStyle,
        })),
      }),
    );
  }

  const size = Math.min(stackPlayers(settings, players).length + settings.guests, MAX_STACK);
  rows.push(
    row(
      {
        type: Component.Button,
        style: Style.Secondary,
        custom_id: encodeId({ action: 'panel', control: 'guest-' }),
        label: 'Guest',
        emoji: { name: '➖' },
        disabled: settings.guests === 0,
      },
      {
        type: Component.Button,
        style: Style.Secondary,
        custom_id: encodeId({ action: 'panel', control: 'guest+' }),
        label: 'Guest',
        emoji: { name: '➕' },
        disabled: size >= MAX_STACK,
      },
      {
        type: Component.Button,
        style: Style.Secondary,
        custom_id: encodeId({ action: 'panel', control: 'roles' }),
        label: `Roles: ${settings.roles === 'preferred' ? 'Preferred' : 'Random'}`,
      },
      {
        type: Component.Button,
        style: Style.Primary,
        custom_id: encodeId({ action: 'panel', control: 'draft' }),
        label: 'Draft',
        emoji: { name: '🎲' },
      },
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
        title: `${s.locked ? '🔒 ' : ''}${slotHeroes(s)}`,
        description: `${positionTag(s)} · ${s.name}`,
        ...(hero && { thumbnail: { url: heroImages.portrait(hero) } }),
      };
    });
  }
  return [
    {
      color: BRAND_COLOR,
      description: slots.map((s) => `${s.locked ? '🔒 ' : ''}${positionTag(s)} **${slotHeroes(s)}** · ${s.name}`).join('\n'),
    },
  ];
}

/** A posted draft: lineup plus reroll, lock, reroll-unlocked, save and open buttons. */
export function renderDraft(live: Pick<LiveDraft, 'id' | 'draft' | 'saved'>, layout: Layout, origin: string): MessageData {
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
  const locks: APIButtonComponent[] = order.map(({ s, i }) => ({
    type: Component.Button,
    style: s.locked ? Style.Success : Style.Secondary,
    custom_id: encodeId({ action: 'lock', draftId: live.id, slot: i }),
    label: s.name,
    emoji: { name: s.locked ? '🔒' : '🔓' },
  }));
  const actions: APIButtonComponent[] = [
    {
      type: Component.Button,
      style: Style.Primary,
      custom_id: encodeId({ action: 'rerollAll', draftId: live.id }),
      label: 'Reroll unlocked',
      emoji: { name: '🎲' },
    },
    {
      type: Component.Button,
      style: live.saved ? Style.Success : Style.Secondary,
      custom_id: encodeId({ action: 'save', draftId: live.id }),
      label: live.saved ? 'Saved ✓' : 'Save',
      ...(!live.saved && { emoji: { name: '💾' } }),
      disabled: live.saved,
    },
  ];
  const url = `${origin}/?d=${encodeDraft(draft)}`;
  // Link buttons cap the URL; a stack of long unicode names could pass it, so just leave the link out.
  if (url.length <= MAX_URL) actions.push({ type: Component.Button, style: Style.Link, url, label: '↗ Open' });

  return {
    content: draftHeader(draft),
    embeds: draftEmbeds(draft, layout),
    components: [row(...rerolls), row(...locks), row(...actions)],
    allowed_mentions: NO_MENTIONS,
  };
}
