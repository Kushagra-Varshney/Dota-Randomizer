import type { Draft, Player } from '@dota-picker/core';

/** History only needs the most recent drafts. */
export const MAX_DRAFTS = 200;

interface PlayerRow {
  id: string;
  name: string;
  color: string;
  roles: string;
  bans: string;
  created_at: number;
}

const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  name: row.name,
  color: row.color,
  roles: JSON.parse(row.roles),
  bans: JSON.parse(row.bans),
  createdAt: row.created_at,
});

export async function listPlayers(db: D1Database): Promise<Player[]> {
  const { results } = await db.prepare('SELECT * FROM players ORDER BY created_at').all<PlayerRow>();
  return results.map(toPlayer);
}

/** Saved drafts, newest first. */
export async function listDrafts(db: D1Database, limit: number): Promise<Draft[]> {
  const { results } = await db
    .prepare('SELECT data FROM drafts ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data));
}

/** Saves (or replaces) a draft in history and prunes the oldest beyond MAX_DRAFTS. */
export async function saveDraft(db: D1Database, draft: Draft): Promise<void> {
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO drafts (id, created_at, data) VALUES (?, ?, ?)').bind(
      draft.id,
      draft.createdAt,
      JSON.stringify(draft),
    ),
    db.prepare('DELETE FROM drafts WHERE id NOT IN (SELECT id FROM drafts ORDER BY created_at DESC LIMIT ?)').bind(
      MAX_DRAFTS,
    ),
  ]);
}
