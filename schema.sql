-- ReadRash leaderboard (Cloudflare D1)
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  race INTEGER NOT NULL,
  wpm INTEGER NOT NULL,
  acc INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (league, created_at, score);
CREATE INDEX IF NOT EXISTS idx_scores_name ON scores (name, created_at);
