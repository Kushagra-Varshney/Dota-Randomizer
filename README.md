# Dota Picker

Random Dota 2 drafts for your stack. Pick who's playing, choose a mode, hit **Space**. Everyone gets a role and a hero, revealed slot-machine style, ready to paste into Discord.

## Features

- **Squad.** Add your friends once, with preferred roles (ranked) and heroes they never want. Tap who's playing; the stack size follows (1–5). Guests fill empty slots.
- **Modes**
  - **Standard**: random heroes that fit their position.
  - **All Random**: any hero, any role.
  - **Wombo Combo**: a classic ult combo (Ravage → Black Hole, RP → Echo Slam, Chrono + Death Ward…) placed on fitting roles, plus teamfight filler.
  - **Off-Role**: supports on cores, cores on support.
  - **Themed**: Knife Fight (melee), Artillery (ranged), one attribute, Global Presence, Now You See Me (invis), Tower Rush, Stun Lock, Micro Madness, or Surprise me.
- **Rules.** Random or preference-weighted roles, 1–3 hero choices per player (Single Draft style), positions in play, avoid heroes from recent saved drafts, global hero bans.
- **At the table.** Lock a card and reroll the rest, reroll one card, swap positions, lock a player to a position for the session, copy a Discord-formatted lineup, and share a link that contains the whole draft.
- **Keyboard.** `Space` draft · `1–5` reroll card · `Shift+1–5` lock · `C` copy for Discord · `L` share link · `S` save · `Esc` skip animation · `?` help.
- **History.** Save drafts; "Avoid repeats" uses them so nobody gets the same hero every night.
- **Works offline-ish.** If the API is unreachable, the app runs in *Local* mode (browser storage) with no setup at all.

## How it's built

```
dota-picker/
├─ packages/core   Hero data + draft engine. Pure TypeScript, seeded RNG, unit-tested.
├─ apps/web        Vite + React 19 + Tailwind 4 SPA. The draft runs in the browser, so it's instant.
└─ apps/api        Hono on a Cloudflare Worker + D1 (SQLite). Stores the squad and history,
                   and serves the built web app as static assets. One deploy, one URL.
```

- Hero list comes from the OpenDota API (`npm run heroes:sync`). Role, position and theme data for every hero is curated by hand in [packages/core/src/data/hero-meta.ts](packages/core/src/data/hero-meta.ts).
- Hero art is loaded from Valve's Steam CDN, so nothing large lives in the repo.
- Everything fits Cloudflare's free tier (100k requests/day, 5 GB D1).

## Run it locally

Needs Node 20+.

```sh
npm install
npm run dev        # API on :8787 (local D1) + web on http://localhost:5173
```

`npm run dev:web` alone also works. The app notices the API is missing and switches to Local mode.

Other scripts: `npm test` (engine tests), `npm run typecheck`, `npm run build`.

## Deploy (free, ~2 minutes)

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. Run:
   ```sh
   npx wrangler login
   npm run deploy
   ```
   The first deploy creates the D1 database automatically, then applies the migrations. You get a URL like `https://dota-picker.<you>.workers.dev`. Send that to your friends.
3. Recommended once the URL is shared: protect the squad with a PIN (see below).

### Squad PIN

Without a PIN anyone with the link can edit the squad and history. With one, anyone can still draft and view, but adding/editing players and saving or deleting drafts needs the PIN (each friend enters it once per device via the key icon).

```sh
cd apps/api
npx wrangler secret put SQUAD_PIN      # set it, or run again to change it (takes effect immediately)
npx wrangler secret delete SQUAD_PIN   # remove protection
```

Brute-force protection: every PIN attempt is counted per client IP (per /64 for IPv6) *before* the PIN is checked, so parallel guessing doesn't help. 10 wrong tries in an hour locks that client out of writes for an hour; a correct PIN resets the count. Still, prefer a passphrase like `tidehunter-ravage-2am` over a 4-digit PIN — the lockout slows a single attacker down, a long passphrase makes guessing hopeless even from many IPs.

If a friend locks themselves out:

```sh
cd apps/api && npx wrangler d1 execute DB --remote --command "DELETE FROM pin_attempts"
```

### Auto-deploy from GitHub

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) deploys on every push to `main`. Add two repository secrets: `CLOUDFLARE_API_TOKEN` (a token from the "Edit Cloudflare Workers" template, plus D1 edit permission) and `CLOUDFLARE_ACCOUNT_ID`.

## When Valve adds a hero

```sh
npm run heroes:sync   # pulls the new hero list from OpenDota
npm test              # fails and names any hero missing from hero-meta.ts
```

Add the hero's positions and tags to `hero-meta.ts`, then deploy. Until you do, the app still works: it guesses positions from OpenDota's role tags.

## API

All under `/api`. Writes need an `x-squad-pin` header when `SQUAD_PIN` is set (401 = missing/wrong, 429 = locked out).

| Method | Path | |
| --- | --- | --- |
| GET | `/health` | `{ ok, pinRequired }` |
| GET | `/players` | Squad |
| PUT / DELETE | `/players/:id` | Upsert / remove a player |
| GET | `/drafts?limit=50` | Saved drafts, newest first (keeps the last 200) |
| PUT / DELETE | `/drafts/:id` | Save / remove a draft |
