import { sanitizeDraft, sanitizeDraftSettings, type Draft, type DraftSettings } from '@dota-picker/core';

/** How draft messages look: one compact embed, or one card per slot with a hero portrait. */
export type Layout = 'compact' | 'cards';
export const LAYOUTS: readonly Layout[] = ['compact', 'cards'];

export interface GuildConfig {
  guildId: string;
  channelId: string;
  settings: DraftSettings;
  layout: Layout;
}

/** A draft posted in Discord. `id` is the message key in custom_ids; `draft.id` changes on full rerolls. */
export interface LiveDraft {
  id: string;
  guildId: string;
  draft: Draft;
  saved: boolean;
  version: number;
}

/** Old draft messages stop working after this; their buttons say so. */
const LIVE_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface GuildRow {
  guild_id: string;
  channel_id: string;
  settings: string;
  layout: string;
}

interface DraftRow {
  id: string;
  guild_id: string;
  data: string;
  saved: number;
  version: number;
}

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const toGuild = (row: GuildRow): GuildConfig => ({
  guildId: row.guild_id,
  channelId: row.channel_id,
  settings: sanitizeDraftSettings(parse(row.settings)),
  layout: LAYOUTS.find((l) => l === row.layout) ?? 'compact',
});

export async function getGuild(db: D1Database, guildId: string): Promise<GuildConfig | null> {
  const row = await db.prepare('SELECT * FROM discord_guilds WHERE guild_id = ?').bind(guildId).first<GuildRow>();
  return row ? toGuild(row) : null;
}

/** Binds the bot to a channel, keeping the server's settings (and layout unless one is given). */
export async function bindGuild(db: D1Database, guildId: string, channelId: string, layout?: Layout): Promise<GuildConfig> {
  const row = await db
    .prepare(
      `INSERT INTO discord_guilds (guild_id, channel_id, layout, updated_at) VALUES (?1, ?2, COALESCE(?3, 'compact'), ?4)
       ON CONFLICT (guild_id) DO UPDATE SET channel_id = ?2, layout = COALESCE(?3, layout), updated_at = ?4
       RETURNING *`,
    )
    .bind(guildId, channelId, layout ?? null, Date.now())
    .first<GuildRow>();
  if (!row) throw new Error('Guild was not saved');
  return toGuild(row);
}

export async function saveSettings(db: D1Database, guildId: string, settings: DraftSettings): Promise<void> {
  await db
    .prepare('UPDATE discord_guilds SET settings = ?, updated_at = ? WHERE guild_id = ?')
    .bind(JSON.stringify(settings), Date.now(), guildId)
    .run();
}

export async function getLiveDraft(db: D1Database, id: string): Promise<LiveDraft | null> {
  const row = await db.prepare('SELECT * FROM discord_drafts WHERE id = ?').bind(id).first<DraftRow>();
  const draft = row && sanitizeDraft(parse(row.data));
  if (!row || !draft) return null;
  return { id: row.id, guildId: row.guild_id, draft, saved: row.saved === 1, version: row.version };
}

export async function createLiveDraft(db: D1Database, guildId: string, draft: Draft): Promise<LiveDraft> {
  const live: LiveDraft = { id: crypto.randomUUID(), guildId, draft, saved: false, version: 0 };
  const now = Date.now();
  await db.batch([
    db
      .prepare('INSERT INTO discord_drafts (id, guild_id, data, saved, version, updated_at) VALUES (?, ?, ?, 0, 0, ?)')
      .bind(live.id, guildId, JSON.stringify(draft), now),
    db.prepare('DELETE FROM discord_drafts WHERE updated_at < ?').bind(now - LIVE_DRAFT_TTL_MS),
  ]);
  return live;
}

export interface LiveChange {
  draft: Draft;
  saved: boolean;
}

/**
 * Writes `next` only if nobody changed the draft since `live` was read (optimistic lock).
 * With `force`, writes regardless. Returns the stored draft, or null on a version clash.
 */
export async function writeLiveDraft(
  db: D1Database,
  live: LiveDraft,
  next: LiveChange,
  force = false,
): Promise<LiveDraft | null> {
  const row = await db
    .prepare(
      `UPDATE discord_drafts SET data = ?1, saved = ?2, version = version + 1, updated_at = ?3
       WHERE id = ?4 AND (?5 OR version = ?6) RETURNING version`,
    )
    .bind(JSON.stringify(next.draft), next.saved ? 1 : 0, Date.now(), live.id, force ? 1 : 0, live.version)
    .first<{ version: number }>();
  return row ? { ...live, ...next, version: row.version } : null;
}

/**
 * Applies `change` to the latest stored draft. On a clash with a concurrent click it re-reads and
 * applies once more; after that the last write wins. `change` may return a string to stop with
 * that message instead. Returns null when the draft no longer exists.
 */
export async function mutateLiveDraft(
  db: D1Database,
  id: string,
  change: (live: LiveDraft) => LiveChange | string,
): Promise<LiveDraft | string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const live = await getLiveDraft(db, id);
    if (!live) return null;
    const next = change(live);
    if (typeof next === 'string') return next;
    const written = await writeLiveDraft(db, live, next, attempt === 1);
    if (written) return written;
  }
  return null;
}
