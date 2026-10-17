-- One row per server that ran /setup: which channel the bot lives in, plus its draft settings.
CREATE TABLE IF NOT EXISTS discord_guilds (
  guild_id   TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  settings   TEXT NOT NULL DEFAULT '{}',        -- DraftSettings JSON
  layout     TEXT NOT NULL DEFAULT 'compact',   -- how draft messages look: 'compact' or 'cards'
  updated_at INTEGER NOT NULL
);

-- Live drafts posted in Discord, so buttons know what they act on. `version` guards concurrent clicks.
CREATE TABLE IF NOT EXISTS discord_drafts (
  id         TEXT PRIMARY KEY,                  -- message key used in custom_ids (uuid)
  guild_id   TEXT NOT NULL,
  data       TEXT NOT NULL,                     -- Draft JSON, including `locked` flags
  saved      INTEGER NOT NULL DEFAULT 0,
  version    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS discord_drafts_updated_at ON discord_drafts (updated_at);
