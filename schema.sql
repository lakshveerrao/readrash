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

-- Riders: progress lives on a secret device key (only its SHA-256 is stored). RP is worked out on the server.
CREATE TABLE IF NOT EXISTS riders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rp INTEGER NOT NULL DEFAULT 0,
  races INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  bonus_day TEXT,
  bonus_rp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
-- every finished race a rider posts, with the RP it earned
CREATE TABLE IF NOT EXISTS rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  league TEXT,
  laps INTEGER,
  race_code TEXT,
  time_ms INTEGER,
  correct INTEGER NOT NULL,
  place INTEGER,
  rp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rides_rider ON rides (rider_id, created_at);
-- races riders make from their own words; status draft until the maker finishes it once
CREATE TABLE IF NOT EXISTS races (
  code TEXT PRIMARY KEY,
  maker_id INTEGER NOT NULL,
  maker_name TEXT NOT NULL,
  title TEXT NOT NULL,
  words TEXT NOT NULL,
  league TEXT NOT NULL,
  laps INTEGER NOT NULL,
  max_riders INTEGER NOT NULL,
  status TEXT NOT NULL,
  maker_ms INTEGER,
  reports INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_races_maker ON races (maker_id, created_at);
CREATE TABLE IF NOT EXISTS race_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  rider_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  missed TEXT NOT NULL,
  track TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_race_runs ON race_runs (code, time_ms);
