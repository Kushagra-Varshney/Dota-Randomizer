import { isPosition, sanitizeDraftSettings, type DraftSettings } from '@dota-picker/core';
import type {
  APIApplicationCommandInteractionDataBasicOption,
  APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { listPlayers } from '../db';
import { postNewDraft } from './components';
import { ADMINISTRATOR, MANAGE_GUILD } from './constants';
import type { BotContext, InteractionReply } from './handler';
import { ephemeral, panelSummary, renderPanel } from './render';
import { bindGuild, getGuild, LAYOUTS, saveSettings } from './store';

type Option = APIApplicationCommandInteractionDataBasicOption;

const option = (i: APIChatInputApplicationCommandInteraction, name: string): Option['value'] | undefined =>
  (i.data.options as Option[] | undefined)?.find((o) => o.name === name)?.value;

const channelOf = (i: APIChatInputApplicationCommandInteraction) => i.channel?.id ?? i.channel_id;

/** Admins can override who sees a command, so check Manage Server here too. */
const canManage = (i: APIChatInputApplicationCommandInteraction) => {
  const perms = BigInt(i.member?.permissions ?? '0');
  return (perms & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n;
};

const message = (content: string): InteractionReply => ({ kind: 'message', data: ephemeral(content) });

/** Parses "1235" into positions. Returns null if it isn't only digits 1–5. */
export function parsePositions(text: string): DraftSettings['positions'] | null {
  const digits = [...text.replace(/[\s,]/g, '')].map(Number);
  if (!digits.length || !digits.every(isPosition)) return null;
  return [...new Set(digits)].sort();
}

export async function handleCommand(i: APIChatInputApplicationCommandInteraction, ctx: BotContext): Promise<InteractionReply> {
  switch (i.data.name) {
    case 'setup': {
      if (!canManage(i)) return message('You need the **Manage Server** permission to run `/setup`.');
      const layout = LAYOUTS.find((l) => l === option(i, 'layout'));
      const [guild, players] = await Promise.all([bindGuild(ctx.db, ctx.guildId, channelOf(i), layout), listPlayers(ctx.db)]);
      return { kind: 'message', data: renderPanel(guild.settings, players, ctx.origin) };
    }

    case 'draft': {
      const guild = await getGuild(ctx.db, ctx.guildId);
      // Settings can exist before /setup (e.g. bans set up ahead), but without a channel.
      if (!guild?.channelId) return message('Run `/setup` in a channel first.');
      if (channelOf(i) !== guild.channelId) return message(`Drafts live in <#${guild.channelId}>.`);
      const mode = option(i, 'mode');
      if (mode === undefined) return postNewDraft(ctx, guild);
      // Picking a mode here changes the server's mode, so "Reroll unlocked" keeps using it.
      const settings = sanitizeDraftSettings({ ...guild.settings, mode });
      await saveSettings(ctx.db, guild.guildId, settings);
      return postNewDraft(ctx, { ...guild, settings });
    }

    case 'rules': {
      const guild = await getGuild(ctx.db, ctx.guildId);
      if (!guild) return message('Run `/setup` in a channel first.');
      const positionsText = option(i, 'positions');
      const positions = typeof positionsText === 'string' ? parsePositions(positionsText) : undefined;
      if (positions === null) return message('Positions should be digits 1 to 5, like `1235`.');
      const settings = sanitizeDraftSettings({
        ...guild.settings,
        ...(option(i, 'roles') !== undefined && { roles: option(i, 'roles') }),
        ...(option(i, 'choices') !== undefined && { choices: option(i, 'choices') }),
        ...(option(i, 'avoid_recent') !== undefined && { avoidRecent: option(i, 'avoid_recent') }),
        ...(positions && { positions }),
      });
      const [players] = await Promise.all([listPlayers(ctx.db), saveSettings(ctx.db, guild.guildId, settings)]);
      return message(`Rules saved. The panel shows them after its next click.\n${panelSummary(settings, players)}`);
    }

    default:
      return message('Unknown command. It may have been removed; try again in a minute.');
  }
}
