import { Hono } from 'hono';
import { isId, sanitizeDraft, sanitizePlayer, type Player } from '@dota-picker/core';
import { requirePin } from './pin';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Optional. When set, every write needs the `x-squad-pin` header. */
  SQUAD_PIN?: string;
}

interface PlayerRow {
  id: string;
  name: string;
  color: string;
  roles: string;
  bans: string;
  created_at: number;
}

const MAX_DRAFTS = 200;

const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  name: row.name,
  color: row.color,
  roles: JSON.parse(row.roles),
  bans: JSON.parse(row.bans),
  createdAt: row.created_at,
});

const api = new Hono<{ Bindings: Env }>().basePath('/api');

api.use('*', requirePin);

api.get('/health', (c) => c.json({ ok: true, pinRequired: Boolean(c.env.SQUAD_PIN) }));

// Lets the UI check a PIN: the middleware already rejected it if it's wrong.
api.post('/pin', (c) => c.json({ ok: true }));

api.get('/players', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM players ORDER BY created_at').all<PlayerRow>();
  return c.json(results.map(toPlayer));
});

api.put('/players/:id', async (c) => {
  const player = sanitizePlayer({ ...(await c.req.json().catch(() => ({}))), id: c.req.param('id') });
  if (!player) return c.json({ error: 'Invalid player' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO players (id, name, color, roles, bans, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (id) DO UPDATE SET name = ?2, color = ?3, roles = ?4, bans = ?5`,
  )
    .bind(player.id, player.name, player.color, JSON.stringify(player.roles), JSON.stringify(player.bans), player.createdAt)
    .run();
  return c.json(player);
});

api.delete('/players/:id', async (c) => {
  const id = c.req.param('id');
  if (!isId(id)) return c.json({ error: 'Invalid id' }, 400);
  await c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
  return c.body(null, 204);
});

api.get('/drafts', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), MAX_DRAFTS);
  const { results } = await c.env.DB.prepare('SELECT data FROM drafts ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<{ data: string }>();
  return c.json(results.map((r) => JSON.parse(r.data)));
});

api.put('/drafts/:id', async (c) => {
  const draft = sanitizeDraft({ ...(await c.req.json().catch(() => ({}))), id: c.req.param('id') });
  if (!draft) return c.json({ error: 'Invalid draft' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR REPLACE INTO drafts (id, created_at, data) VALUES (?, ?, ?)').bind(
      draft.id,
      draft.createdAt,
      JSON.stringify(draft),
    ),
    // Keep the table small: history only needs the most recent drafts.
    c.env.DB.prepare(
      'DELETE FROM drafts WHERE id NOT IN (SELECT id FROM drafts ORDER BY created_at DESC LIMIT ?)',
    ).bind(MAX_DRAFTS),
  ]);
  return c.json(draft);
});

api.delete('/drafts/:id', async (c) => {
  const id = c.req.param('id');
  if (!isId(id)) return c.json({ error: 'Invalid id' }, 400);
  await c.env.DB.prepare('DELETE FROM drafts WHERE id = ?').bind(id).run();
  return c.body(null, 204);
});

api.notFound((c) => c.json({ error: 'Not found' }, 404));
api.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong' }, 500);
});

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
