import type {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIMessageComponentInteraction,
} from 'discord-api-types/v10';
import { handleCommand } from './commands';
import { handleComponent } from './components';
import { Callback, Interaction } from './constants';
import { ephemeral, type MessageData } from './render';
import { verifyDiscordRequest } from './verify';

export interface DiscordEnv {
  DB: D1Database;
  /** Developer Portal → General Information. */
  DISCORD_APPLICATION_ID?: string;
  /** Developer Portal → General Information. Empty means the bot is off and its route 404s. */
  DISCORD_PUBLIC_KEY?: string;
  /** Comma-separated servers the bot answers in. The bot writes squad history without the PIN, so this is the guard. */
  DISCORD_GUILD_IDS?: string;
}

export interface BotContext {
  db: D1Database;
  guildId: string;
  /** Where the web app lives, for links. */
  origin: string;
}

/** A new message (CHANNEL_MESSAGE_WITH_SOURCE) or an edit of the clicked message (UPDATE_MESSAGE). */
export type InteractionReply = { kind: 'message' | 'update'; data: MessageData };

const json = (body: APIInteractionResponse) => Response.json(body);

const respond = (reply: InteractionReply) =>
  json(
    reply.kind === 'update'
      ? { type: Callback.UpdateMessage, data: reply.data }
      : { type: Callback.ChannelMessage, data: reply.data },
  );

export const allowedGuilds = (env: DiscordEnv) =>
  new Set((env.DISCORD_GUILD_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean));

export async function handleDiscord(request: Request, env: DiscordEnv, _ctx: ExecutionContext): Promise<Response> {
  if (!env.DISCORD_PUBLIC_KEY || request.method !== 'POST') return Response.json({ error: 'Not found' }, { status: 404 });

  // Raw text: the signature covers the exact bytes.
  const body = await request.text();
  const valid = await verifyDiscordRequest(
    env.DISCORD_PUBLIC_KEY,
    request.headers.get('x-signature-ed25519'),
    request.headers.get('x-signature-timestamp'),
    body,
  );
  if (!valid) return Response.json({ error: 'Bad signature' }, { status: 401 });

  const interaction = JSON.parse(body) as APIInteraction;
  if (interaction.type === Interaction.Ping) return json({ type: Callback.Pong });

  const guildId = interaction.guild_id;
  if (!guildId || !allowedGuilds(env).has(guildId)) {
    return respond({ kind: 'message', data: ephemeral('Dota Picker is not enabled in this server.') });
  }
  const ctx: BotContext = { db: env.DB, guildId, origin: new URL(request.url).origin };

  try {
    if (interaction.type === Interaction.ApplicationCommand) {
      return respond(await handleCommand(interaction as APIChatInputApplicationCommandInteraction, ctx));
    }
    if (interaction.type === Interaction.MessageComponent) {
      return respond(await handleComponent(interaction as APIMessageComponentInteraction, ctx));
    }
  } catch (err) {
    console.error(err);
    return respond({ kind: 'message', data: ephemeral('Something went wrong. Try again in a moment.') });
  }
  return Response.json({ error: 'Unsupported interaction' }, { status: 400 });
}
