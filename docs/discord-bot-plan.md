# Discord bot: implementation plan

Status: **built, waiting on the Discord test** (written and implemented 2026-10-17). Milestones 1–6 are done and tested locally with signed fake interactions; Milestone 0 (overlay clicks) and 7 (real server) need Discord. Work happens on the `discord-bot` branch; merging to `main` auto-deploys.

To pick this up in a new Claude Code session: `git switch discord-bot`, then ask Claude to read this file and start at [Milestones](#milestones).

## Why

We play Dota on Windows while in Discord voice. Today, rerolling means alt-tabbing out of Dota to the web app, then pasting the lineup into Discord. The goal is to draft and reroll **without leaving the game**, and to have one shared lineup everyone sees.

## What we decided

- **A Discord bot with buttons.** The lineup is posted in a dedicated channel, with buttons to reroll one slot, lock a slot, reroll everything unlocked, and save. Anyone in the channel can click them.
- **Discord's in-game overlay** (Windows only) shows that channel over Dota. The overlay can't *send* slash commands, so everything you do mid-game must be a button or select menu. Slash commands are only for setup, done from the normal Discord window.
- **`/setup`**: create a channel (e.g. `#draft`), run `/setup` in it, and the bot binds to that channel and posts a **control panel** message (who's playing, mode, Draft button).
- **Runs in the existing Cloudflare Worker** over Discord's HTTP interactions. Discord POSTs every command or click to our URL and we answer in the HTTP response. No gateway websocket and no always-on process, so it stays on the free tier.
- **Reuses everything.** The draft engine is `packages/core`, and the squad (players, roles, bans) and saved history are the same D1 tables the web app uses. A draft saved from Discord shows up in the web History page, and "avoid repeats" sees it.
- **No heavy dependencies.** No discord.js. Use raw `fetch` and JSON, plus `discord-api-types` as a types-only devDependency.

Out of scope for v1: detecting who's in the voice channel, linking Discord accounts to squad players, swapping positions, picking between hero choices in Discord, and Discord Activities (an embedded app in the voice call; still needs alt-tab, so not worth it now).

## Overlay facts (from research, partly unverified)

- The Discord overlay works on **Windows only**. It does **not** show over true fullscreen, so Dota must use **Settings → Video → Display Mode → Borderless Window**. (Discord has a "legacy overlay" setting that works in fullscreen but says it may be removed.)
- The overlay is made of widgets. You can **pin a text channel** so it stays visible. The default key to unlock it and interact is **Shift+`** (check Discord → Settings → Keybinds).
- Muted channels don't show in the overlay, so don't mute `#draft`.
- **Unverified: whether bot buttons and select menus can be clicked inside the overlay.** Test this first (Milestone 0). If they can't, see [Fallback](#fallback-if-overlay-clicks-dont-work).

Sources: [Discord: Game Overlay 101](https://support.discord.com/hc/en-us/articles/217659737-Game-Overlay-101), [Discord: Known Issue, Game Overlay](https://support.discord.com/hc/en-us/articles/25289844838551--Known-Issue-Game-Overlay), [OneStream overlay guide](https://onestream.live/blog/how-to-turn-on-discord-overlay/), [OWN3D overlay tutorial](https://www.own3d.tv/en/blog/discord/discord-overlay/).

## How it fits the codebase

```
apps/api/src/index.ts            default fetch(): route /api/discord/interactions to the bot BEFORE the Hono `api`
                                 app, because `api.use('*', requirePin)` would reject Discord's POSTs.
                                 The path is under /api/*, so wrangler's run_worker_first already sends it to the Worker.
apps/api/src/discord/
  verify.ts                      Ed25519 signature check (crypto.subtle, no deps)
  handler.ts                     handleDiscord(request, env, ctx): verify, then switch on interaction type
  commands.ts                    /setup, /draft, /rules handlers
  components.ts                  button/select handlers, routed by custom_id
  render.ts                      pure functions: state -> Discord message JSON (panel + draft message)
  ids.ts                         custom_id encode/parse
  store.ts                       D1 access for guild config and live drafts
apps/api/scripts/
  commands.mjs                   command definitions (plain JS so plain `node` can run the script)
  register-commands.mjs          PUTs the commands to Discord
apps/api/migrations/0003_discord.sql
```

### Refactors to do first

1. **Move stack building into core.** `buildStack`, `recentPicks`, `slotKey`, `guestName` and `GUEST_COLOR` live in [apps/web/src/lib/actions.ts](../apps/web/src/lib/actions.ts) and [ui.ts](../apps/web/src/lib/ui.ts), but the bot needs the same logic. Create `packages/core/src/stack.ts` with:
   - a `DraftSettings` type: the draft-relevant part of the web `Settings` (`mode, theme, comboStyle, roles, positions, choices, avoidRecent, bans, selected, guests, fixedRoles`),
   - `DEFAULT_DRAFT_SETTINGS`,
   - `sanitizeDraftSettings(raw)` (D1 JSON is untrusted; follow the style of [validate.ts](../packages/core/src/validate.ts)),
   - `buildStack(settings, players, drafts)`, `slotKey`, `guestName`, `recentPicks`, `GUEST_COLOR`.

   Web `Settings` then becomes `DraftSettings & { animate, rulesOpen }`, and web imports from core. Behaviour must not change. Add core tests for `buildStack`.
2. **Share the "roll with locks kept" logic.** `rollDraft` in web builds `keep` from locked slots by `slotKey`, then calls `generateDraft`. Put a pure helper in core, e.g. `rollKeepingLocks(stack, settings, current)`, so the web and the bot behave identically.
3. **Extract `saveDraft(db, draft)`** in the API (the insert plus prune-to-200 batch in `PUT /drafts/:id`) so the REST route and the bot's Save button share it.
4. **Make the root `npm test` run API tests too** (`npm run test --workspaces --if-present`), and add vitest to `apps/api`. CI ([deploy.yml](../.github/workflows/deploy.yml)) already runs `npm test` and `npm run typecheck`.

### Env and config

Add to `Env` in [apps/api/src/index.ts](../apps/api/src/index.ts) and to `vars` in [wrangler.jsonc](../apps/api/wrangler.jsonc). These are public values, not secrets:

| Var | What |
| --- | --- |
| `DISCORD_APPLICATION_ID` | Developer Portal → General Information. Needed for follow-up webhook edits. |
| `DISCORD_PUBLIC_KEY` | Developer Portal → General Information. Used to verify signatures. **If empty, the bot route returns 404** (bot disabled), so the web app works without Discord set up. |
| `DISCORD_GUILD_IDS` | Comma-separated allowlist of servers. Interactions from other servers get an ephemeral "not enabled here". This is the real guard, because the bot writes to the shared squad history without the PIN. |

`DISCORD_BOT_TOKEN` is needed **only** by the register script on a dev machine. Keep it in `apps/api/.dev.vars` (already gitignored) and never in wrangler config. Add all four to [.dev.vars.example](../apps/api/.dev.vars.example) with comments.

### D1 migration `0003_discord.sql`

```sql
-- One row per server that ran /setup: which channel the bot lives in, plus its draft settings.
CREATE TABLE IF NOT EXISTS discord_guilds (
  guild_id   TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  settings   TEXT NOT NULL DEFAULT '{}',   -- DraftSettings JSON
  updated_at INTEGER NOT NULL
);

-- Live drafts posted in Discord, so buttons know what they act on. `version` guards concurrent clicks.
CREATE TABLE IF NOT EXISTS discord_drafts (
  id         TEXT PRIMARY KEY,             -- Draft id (uuid), also used in custom_ids
  guild_id   TEXT NOT NULL,
  data       TEXT NOT NULL,                -- Draft JSON, including `locked` flags
  saved      INTEGER NOT NULL DEFAULT 0,
  version    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS discord_drafts_updated_at ON discord_drafts (updated_at);
```

Prune `discord_drafts` older than ~30 days whenever a new draft is created (same pattern as the drafts prune).

## The bot

### Commands

Defined in `apps/api/scripts/commands.mjs`. Register them with `npm run discord:register` (root script) → `node --env-file=.dev.vars scripts/register-commands.mjs`, which does `PUT https://discord.com/api/v10/applications/{APP_ID}/commands` with `Authorization: Bot <token>`. If `DISCORD_DEV_GUILD_ID` is set, register to `/guilds/{id}/commands` instead; guild commands update instantly, which is handy while iterating.

All commands: `type: 1`, `contexts: [0]` (servers only), `integration_types: [0]` (installed to a server).

| Command | Who | Does |
| --- | --- | --- |
| `/setup` | `default_member_permissions: "32"` (Manage Server). **Also check the `member.permissions` bit server-side**, since admins can override command permissions. | Binds the bot to the current channel (upsert `discord_guilds`), keeps existing settings, and replies with the **panel** message (non-ephemeral). Running it again re-binds and posts a fresh panel; old panels keep working because state is per server, not per message. |
| `/draft [mode]` | everyone | Same as the panel's Draft button: posts a new draft message. `mode` is an optional string choice of the 5 modes. Used outside the bound channel → ephemeral "Drafts live in <#channel>". |
| `/rules` (v1.1) | everyone | Options: `roles` (random/preferred), `choices` (1–3), `avoid_recent` (0–10), `positions` (string like `1235`). Updates server settings and replies ephemerally with the new rules. Rarely changed, so a slash command is fine. |

`commands.mjs` is plain JS (no core imports, so plain `node` can run it). Add a vitest test that its mode choices match `MODES` from core.

### Message 1: the control panel (from `/setup`, edited in place)

Content: one summary line, e.g. **Dota Picker** · Playing: Kush, Ani, Raj + 1 guest · Wombo Combo (Classics) · Roles: preferred · Avoid last 3.

Rows (max 5):
1. **Who's playing**: string select, multi. Options = squad players from D1 (max 25; if the squad is bigger, show the first 25 and say so). `default: true` on currently selected players. `min_values: 0`, `max_values: min(5, players)`.
2. **Mode**: string select of `MODES`.
3. **Mode detail**, only when relevant: the theme select (Surprise + `THEMES`) for Themed, or the combo style select (Both / Classics / Memes) for Wombo. Leave the row out for other modes.
4. Buttons: `➖ Guest`, `➕ Guest` (stack still capped at 5; mirror `togglePlayer` / `setStackSize` in [settings.ts](../apps/web/src/lib/settings.ts)), `Roles: Random|Preferred` toggle, **`🎲 Draft`** (primary).

Every panel interaction saves settings and replies with `UPDATE_MESSAGE` (type 7), re-rendering the panel. **Draft** replies with `CHANNEL_MESSAGE_WITH_SOURCE` (type 4): a new draft message. An empty stack gets an ephemeral "Pick who's playing first".

### Message 2: a draft (new message per Draft; rerolls edit it in place)

- **Content**: header like `draftToText` in [share.ts](../packages/core/src/share.ts): `**Dota draft · Wombo Combo · <combo name>**`, then `> how` and `> 🏆 moment` when there's a combo.
- **Embed**: one compact embed. One line per slot, sorted by position, e.g. ``🔒 `1 Carry` **Anti-Mage** · Kush``. Choices (when `choices > 1`) show as `Anti-Mage / Juggernaut / Medusa`, and players pick in game. Keep the renderer pure so we can try **one embed per slot with `thumbnail` = `heroImages.portrait(hero)`** and colour = player colour, then pick whichever reads better in the overlay.
- **Row 1**: `🎲 <name>` per slot: reroll that slot (`rerollSlot`). Disabled when the slot is locked.
- **Row 2**: `🔓 <name>` / `🔒 <name>` per slot: toggle lock (`updateSlot`). Locked uses Success style (green).
- **Row 3**: **`🎲 Reroll unlocked`** (primary; same as web Space: new roll keeping locked slots, using the server's *current* settings, so panel changes apply), `💾 Save` (becomes disabled "Saved ✓"; any edit after saving clears it, like web), and a link button `↗ Open` → `https://<host>/?d=${encodeDraft(draft)}` (share link format from web `shareUrl`).
- Every button answers with `UPDATE_MESSAGE` (type 7).
- Set `allowed_mentions: { parse: [] }` on every message so a player named `@everyone` can't ping anyone.

Save writes `{ ...draft, slots without locked }` through the shared `saveDraft(db, draft)`, exactly as `saveCurrentDraft` does in web.

### custom_id scheme (max 100 chars)

`dp:<action>:<arg>[:<slot>]`. Draft ids are UUIDs (36 chars), so the longest is about 45.

| custom_id | Action |
| --- | --- |
| `dp:p:players` / `dp:p:mode` / `dp:p:theme` / `dp:p:combo` | panel selects |
| `dp:p:guest-` / `dp:p:guest+` / `dp:p:roles` / `dp:p:draft` | panel buttons |
| `dp:rr:<draftId>:<i>` | reroll slot i |
| `dp:lk:<draftId>:<i>` | toggle lock on slot i |
| `dp:ra:<draftId>` | reroll unlocked |
| `dp:sv:<draftId>` | save |

Buttons on old messages keep working forever. If the draft row was pruned, reply ephemerally: "That draft has expired. Hit 🎲 Draft on the panel."

### Concurrency

Two friends clicking at once: read row + `version`, compute, then `UPDATE … SET data=?, version=version+1 WHERE id=? AND version=?`. If 0 rows changed, re-read and apply once more. Last write wins after that, which is fine for this.

### Handler flow

```ts
// handler.ts (sketch)
if (!env.DISCORD_PUBLIC_KEY) return 404
const body = await request.text()            // raw text: the signature covers the exact bytes
if (!(await verify(env.DISCORD_PUBLIC_KEY, sig, ts, body))) return 401
const i = JSON.parse(body)
switch (i.type) {
  case 1: return json({ type: 1 })           // PING -> PONG
  case 2: return commands(i, env, ctx)       // APPLICATION_COMMAND
  case 3: return components(i, env, ctx)     // MESSAGE_COMPONENT (buttons + selects; values in i.data.values)
}
```

```ts
// verify.ts: no deps; Workers support Ed25519 in WebCrypto
const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, ['verify'])
return crypto.subtle.verify('Ed25519', key, hexToBytes(signature), new TextEncoder().encode(timestamp + body))
// headers: X-Signature-Ed25519, X-Signature-Timestamp. Malformed hex -> false, never throw.
```

Discord constants we need: interaction types 1 PING, 2 APPLICATION_COMMAND, 3 MESSAGE_COMPONENT. Response types 1 PONG, 4 CHANNEL_MESSAGE_WITH_SOURCE, 6 DEFERRED_UPDATE_MESSAGE, 7 UPDATE_MESSAGE. Component types 1 action row, 2 button, 3 string select. Button styles 1 primary, 2 secondary, 3 success, 4 danger, 5 link. Flag 64 = ephemeral. Use `discord-api-types` (types only) instead of hand-typing these.

### Discord limits to respect

- Answer within **3 seconds**. Engine plus D1 is well under that. Anything slow goes in `ctx.waitUntil`, followed by `PATCH /webhooks/{app_id}/{token}/messages/@original` (token valid 15 min).
- At most 5 action rows; 5 buttons per row; a select takes a whole row; 25 select options; button label 80 chars (names are max 24); custom_id 100 chars; 10 embeds.

### Optional polish (v1.1)

- **Spin animation**: reply with `🎰 …` placeholders for the rerolled slots, then edit in the result ~700 ms later via `ctx.waitUntil` + the webhook PATCH. Only keep it if it doesn't make rerolls feel slower; speed comes first.
- `/rules` (above).
- A README section "Discord bot" with the setup steps below, and the new route in the API table.

## One-time setup (manual, by Kushagra)

1. https://discord.com/developers/applications → **New Application** → "Dota Picker".
2. **General Information**: copy **Application ID** and **Public Key** into `apps/api/.dev.vars` and `wrangler.jsonc` vars.
3. **Bot** → Reset Token → copy into `apps/api/.dev.vars` as `DISCORD_BOT_TOKEN` (only for registering commands; never commit it).
4. **Installation**: Guild Install only, scope `applications.commands` (no `bot` scope needed; we only answer interactions). Install via `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands` and pick our server. Put the server id in `DISCORD_GUILD_IDS` (Discord → Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID).
5. Deploy, then set **General Information → Interactions Endpoint URL** to `https://dota-picker.<account>.workers.dev/api/discord/interactions`. Discord validates it on save by sending a signed PING **and** a request with a bad signature, which **must get a 401**, or the URL is rejected.
6. `npm run discord:register`.
7. Create `#draft` → `/setup` → in Dota (borderless), open the overlay and pin `#draft`.

### Local development

Discord needs a public HTTPS URL. Run `npm run dev:api` (port 8787), then `cloudflared tunnel --url http://localhost:8787` (free quick tunnel, no account; install with `brew install cloudflared` or `winget install Cloudflare.cloudflared`). Point the Interactions Endpoint URL at `https://<random>.trycloudflare.com/api/discord/interactions`. Use `DISCORD_DEV_GUILD_ID` so command changes appear instantly. Once the bot is live, make a second "Dota Picker (dev)" application for local work so prod keeps its URL.

## Milestones

0. **Overlay smoke test (Kushagra, 5 min, can run in parallel).** Dota in Borderless Window → overlay → pin a channel that has any bot message with buttons → Shift+` → try a click. Write the result in this doc. This decides between the plan and the fallback.
1. **Refactors**: core `stack.ts` and the shared roll helper, web switched over, `saveDraft` extracted, API vitest wired into root `npm test`. Everything green, web behaves the same.
2. **Plumbing**: env vars, migration 0003, `verify.ts` with tests (generate an Ed25519 keypair in the test), route ahead of `requirePin`, PING/PONG, 404 when disabled, 401 on bad signature. Deploy or tunnel; Discord accepts the endpoint URL.
3. **Commands**: `commands.mjs`, register script, root `discord:register`, `/setup` (permission check, guild allowlist, upsert, panel), `/draft`.
4. **Panel**: players, mode, detail, guests, roles, Draft → new draft message.
5. **Draft message**: reroll slot, lock, reroll unlocked, save, open link; versioned D1 updates; expired-draft handling; prune.
6. **Tests**: custom_id round-trip; renderer stays within Discord limits for 1–5 players and every mode; state transitions (reroll keeps other slots, lock survives reroll unlocked, save then edit clears saved); command choices match `MODES`.
7. **Real-world check**: run a full session in our server through the overlay. Then README, merge to `main` (auto-deploys), and run the migration (`npm run deploy` applies it).

Done means: in game, without alt-tab, anyone can roll, reroll a slot, lock and save, and everyone sees the same lineup. `npm test` and `npm run typecheck` pass, and nothing new costs money.

## Implementation notes (where the build differs from the plan above)

- **Layout A/B is a `/setup` option**: `/setup layout:Compact list|Hero cards`, stored in a `layout` column on `discord_guilds`. Cards are one embed per slot with the hero portrait and player colour.
- **`/draft mode:` changes the server mode**, so 🎲 Reroll unlocked keeps using it. The panel shows the change on its next click (we don't keep panel message ids, so we can't edit old panels).
- **Row id vs draft id**: `discord_drafts.id` is the message key in custom_ids and never changes. The `Draft` inside gets a new `id` on 🎲 Reroll unlocked (a new roll, like web), so saving after a full reroll adds a new history entry instead of overwriting.
- **`/rules` shipped in v1** (replies ephemerally). The spin animation did not.
- **Pure logic for tests**: `applyPanel`, `applyReroll`, `applyLock`, `applyRerollAll` in `components.ts`; core gained `togglePlayer`/`setStackSize` so web and bot share the guest rules.
- discord-api-types is imported as types only; the handful of enum values live in `discord/constants.ts`.

## Fallback if overlay clicks don't work

The bot is still worth having: one shared lineup in the channel, and clicks from a phone or the Discord window. To make it work from inside the overlay we'd need **typed messages** (e.g. `r 3`, `go`), because sending text is something the overlay can do. Reading messages needs a **gateway** connection (a websocket held open, with the privileged Message Content intent). A plain Worker can't hold one. Options to weigh then: a Durable Object keeping the gateway socket open (check free-tier limits), or a tiny gateway relay on a free always-on host that forwards to the same Worker logic. The **Steam overlay browser** (Shift+Tab → web browser → pin the picker URL) also works with zero changes.
