CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT '[]',
  bans TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS drafts_created_at ON drafts (created_at DESC);
