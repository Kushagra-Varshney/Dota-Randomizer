import { Hono } from 'hono';
import { isId, sanitizeDraft, sanitizePlayer } from '@dota-picker/core';
import { listDrafts, listPlayers, MAX_DRAFTS, saveDraft } from './db';
import { handleDiscord, type DiscordEnv } from './discord/handler';
import { requirePin } from './pin';

interface Env extends DiscordEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Optional. When set, every write needs the `x-squad-pin` header. */
  SQUAD_PIN?: string;
}

const api = new Hono<{ Bindings: Env }>().basePath('/api');

api.use('*', requirePin);

api.get('/health', (c) => c.json({ ok: true, pinRequired: Boolean(c.env.SQUAD_PIN) }));

// Lets the UI check a PIN: the middleware already rejected it if it's wrong.
api.post('/pin', (c) => c.json({ ok: true }));

api.get('/players', async (c) => c.json(await listPlayers(c.env.DB)));

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
  return c.json(await listDrafts(c.env.DB, limit));
});

api.put('/drafts/:id', async (c) => {
  const draft = sanitizeDraft({ ...(await c.req.json().catch(() => ({}))), id: c.req.param('id') });
  if (!draft) return c.json({ error: 'Invalid draft' }, 400);
  await saveDraft(c.env.DB, draft);
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
    // Ahead of the Hono app: Discord signs its requests and can't send the squad PIN.
    if (pathname === '/api/discord/interactions') return handleDiscord(request, env, ctx);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
