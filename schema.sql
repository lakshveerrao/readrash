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

-- Rash GP: one row per finished lap race; splits = JSON array of cumulative lap times (ms)
CREATE TABLE IF NOT EXISTS gp_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  laps INTEGER NOT NULL,
  total_ms INTEGER NOT NULL,
  best_lap_ms INTEGER NOT NULL,
  splits TEXT NOT NULL,
  acc INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gp_board ON gp_runs (league, laps, created_at, total_ms);
CREATE INDEX IF NOT EXISTS idx_gp_name ON gp_runs (name, created_at);
