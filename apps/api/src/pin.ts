import type { Context, Next } from 'hono';

/** Wrong guesses allowed per client within WINDOW_MS before a lockout. */
export const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 60 * 1000;
const LOCKOUT_MS = 60 * 60 * 1000;

interface PinEnv {
  DB: D1Database;
  SQUAD_PIN?: string;
}

/**
 * Rate-limit key for the caller. IPv6 users usually own a whole /64, so key on
 * that prefix — otherwise rotating addresses inside it would dodge the lockout.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/** Constant-time comparison, so response timing can't leak how much of a guess was right. */
async function pinMatches(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function tooMany(c: Context, ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  c.header('Retry-After', String(Math.ceil(ms / 1000)));
  return c.json({ error: `Too many wrong PINs. Try again in ${minutes} min.` }, 429);
}

/**
 * Guards every write when SQUAD_PIN is set. Each attempt is counted atomically
 * *before* the PIN is compared, so firing guesses in parallel can't slip past the
 * limit. A correct PIN resets the count; MAX_ATTEMPTS misses lock the client out.
 */
export async function requirePin(c: Context<{ Bindings: PinEnv }>, next: Next) {
  const pin = c.env.SQUAD_PIN;
  if (!pin || c.req.method === 'GET' || c.req.method === 'HEAD') return next();

  const given = c.req.header('x-squad-pin') ?? '';
  // No PIN sent at all isn't a guess: just ask for one.
  if (!given) return c.json({ error: 'This squad is PIN-protected.' }, 401);

  const db = c.env.DB;
  const client = clientKey(c.req.header('cf-connecting-ip'));
  const now = Date.now();

  const row = await db
    .prepare(
      `INSERT INTO pin_attempts (client, attempts, window_start, locked_until) VALUES (?1, 1, ?2, 0)
       ON CONFLICT (client) DO UPDATE SET
         attempts = CASE WHEN locked_until > ?2 THEN attempts WHEN ?2 - window_start > ?3 THEN 1 ELSE attempts + 1 END,
         window_start = CASE WHEN locked_until > ?2 THEN window_start WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END
       RETURNING attempts, locked_until`,
    )
    .bind(client, now, WINDOW_MS)
    .first<{ attempts: number; locked_until: number }>();
  if (!row) throw new Error('PIN attempt was not recorded');

  if (row.locked_until > now) return tooMany(c, row.locked_until - now);

  const lock = () =>
    db.batch([
      db.prepare('UPDATE pin_attempts SET locked_until = MAX(locked_until, ?2) WHERE client = ?1').bind(client, now + LOCKOUT_MS),
      // Housekeeping: forget clients whose window and lockout have both expired.
      db.prepare('DELETE FROM pin_attempts WHERE locked_until < ?1 AND window_start < ?2').bind(now, now - WINDOW_MS),
    ]);

  // Over the limit (e.g. a burst of parallel guesses): reject without even comparing.
  if (row.attempts > MAX_ATTEMPTS) {
    await lock();
    return tooMany(c, LOCKOUT_MS);
  }

  if (await pinMatches(given, pin)) {
    await db.prepare('DELETE FROM pin_attempts WHERE client = ?').bind(client).run();
    return next();
  }

  console.warn(`Wrong squad PIN from ${client} (${row.attempts}/${MAX_ATTEMPTS})`);
  if (row.attempts >= MAX_ATTEMPTS) {
    await lock();
    return tooMany(c, LOCKOUT_MS);
  }
  const left = MAX_ATTEMPTS - row.attempts;
  return c.json({ error: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a 1-hour lockout.` }, 401);
}
