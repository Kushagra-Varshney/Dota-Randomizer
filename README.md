# Dota Picker

Random Dota 2 drafts for your stack. Pick who's playing, choose a mode, hit **Space**. Everyone gets a role and a hero, revealed slot-machine style, ready to paste into Discord.

## Features

- **Squad.** Add your friends once, with preferred roles (ranked) and heroes they never want. Tap who's playing; the stack size follows (1–5). Guests fill empty slots.
- **Modes**
  - **Standard**: random heroes that fit their position.
  - **All Random**: any hero, any role.
  - **Wombo Combo**: 110 hand-checked combos: real ult chains (Vacuum → RP → Echo Slam, Ravage → Black Hole…) and pub/Turbo tricks (Tiny tosses Earthshaker in, Lycan bites a sprinting Crystal Maiden, Huskar Can't Die…), some with the famous pro moment they come from. Pick Classics, Memes or both.
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

Other scripts: `npm test` (engine + API tests), `npm run typecheck`, `npm run build`.

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

## Discord bot

Draft and reroll from Discord's in-game overlay without alt-tabbing. The bot posts the lineup in a `#draft` channel with buttons (reroll a slot, lock, reroll unlocked, save), and everyone sees the same lineup. It runs inside the same Worker over Discord's HTTP interactions, uses the same squad, and drafts saved from Discord show up in History. Design notes: [docs/discord-bot-plan.md](docs/discord-bot-plan.md).

**Commands.** `/setup [layout]` (Manage Server) makes the current channel the draft channel and posts the control panel: who's playing, mode, guests, roles and a 🎲 Draft button. `/draft [mode]` rolls a new draft. `/rules` changes roles, choices, avoid-recent and positions. Mid-game, use only the buttons: the overlay can't send slash commands.

**Set up** (once):

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**. From **General Information**, copy the **Application ID** and **Public Key**; from **Bot**, reset and copy the token.
2. Put them in `apps/api/.dev.vars` (see [.dev.vars.example](apps/api/.dev.vars.example)), plus your server id in `DISCORD_GUILD_IDS` (Discord → Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID). The token is only used by the register script; never commit it.
3. Invite it: `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands`. No `bot` scope is needed.
4. For production, also put `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY` and `DISCORD_GUILD_IDS` in the `vars` of [wrangler.jsonc](apps/api/wrangler.jsonc) and deploy. While the public key is empty the bot is off and its route returns 404.
5. **General Information → Interactions Endpoint URL**: `https://dota-picker.<you>.workers.dev/api/discord/interactions`. Discord checks it when you save.
6. `npm run discord:register` registers the slash commands. With `DISCORD_DEV_GUILD_ID` set it registers to that one server instead, where changes show up instantly. If you used both, each command shows twice in that server: `npm run discord:register -- --clear` removes the set it targets.
7. Make a `#draft` channel, run `/setup` there. In Dota use **Borderless Window** (the overlay doesn't show over fullscreen), open the overlay (Shift+` by default) and pin `#draft`. Don't mute the channel, or it won't show in the overlay.

**Local testing.** Discord needs a public HTTPS URL. Run `npm run dev`, then `cloudflared tunnel --url http://localhost:8787` (`winget install Cloudflare.cloudflared`; no account needed) and point the Interactions Endpoint URL at `https://<random>.trycloudflare.com/api/discord/interactions`. Local mode uses the local D1, so add players in the local web app first.

## Keeping combos current

Every Wombo combo in [combos.ts](packages/core/src/combos.ts) lists the exact abilities it relies on (e.g. `tidehunter_ravage`, `enigma_black_hole`) and the patch it was last checked on (`verifiedPatch`). Three things keep the list honest:

1. **Tests.** `npm test` fails if a combo uses an ability that isn't in its hero's current kit (from the snapshot `npm run heroes:sync` saves). A removed mechanic like Chen's old Test of Faith teleport can't sneak back in.
2. **Patch check.** [.github/workflows/combo-check.yml](.github/workflows/combo-check.yml) runs every Monday and whenever combos change. It reads Valve's official patch notes (including lettered patches like 7.41f) and opens or updates a GitHub issue listing every combo whose abilities changed since it was verified, quoting the actual notes. When everything is clear again it closes the issue itself. No secrets needed. Run it locally with `npm run combos:check` (exit code 10 means something needs a look).
3. **Re-verify.** For each flagged combo: confirm it still works (Liquipedia hero page, patch notes, a recent clip), fix the `how` text or delete the combo, set `verifiedPatch` to the current patch, then `npm run heroes:sync && npm test` and deploy.

Adding a combo: append it with `style: 'classic'` (a real ult chain: setup → payoff) or `style: 'meme'` (pub/Turbo trick), its `abilities`, `verifiedPatch`, and ideally a `source` link.

## When Valve adds a hero

```sh
npm run heroes:sync   # pulls the hero list (OpenDota) and every hero's current abilities (Valve)
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
| POST | `/discord/interactions` | Discord bot. Signed by Discord instead of the PIN; only answers servers in `DISCORD_GUILD_IDS` |
