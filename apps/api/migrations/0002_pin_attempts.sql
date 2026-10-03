-- Counts PIN attempts per client address so guessing gets locked out.
CREATE TABLE IF NOT EXISTS pin_attempts (
  client TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
