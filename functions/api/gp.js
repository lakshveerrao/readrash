import { getRider, award, profile } from "../_lib/rr.js";
// Rash GP leaderboard: GET (best time per rider) / POST (a finished race). D1 binding: DB.
const ADJ = ["Turbo","Rapid","Zippy","Mighty","Swift","Blazing","Cosmic","Thunder","Rocket","Nitro","Lucky","Brave","Jolly","Speedy","Golden","Silver","Super","Hyper","Flying","Daring","Clever","Funky","Jumbo","Fearless"];
const NOUN = ["Mango","Tiger","Falcon","Cheetah","Coconut","Comet","Panther","Crab","Turtle","Monsoon","Pepper","Lassi","Samosa","Dolphin","Eagle","Bolt","Wheelie","Kite","Lion","Peacock","Jalebi","Cyclone","Gecko","Rider"];
const NAME_RE = new RegExp(`^(${ADJ.join("|")})(${NOUN.join("|")})\\d{2}$`);
// keep in sync with GP in assets/game.js
const LAP_LEN = 1000 * 200, SIGNS_PER_LAP = 10, VMAX = { rookie: 8333, pro: 13333, legend: 18333 }, LAPS = new Set([2, 3, 5]);
const MIN_LAP_MS = l => Math.floor(LAP_LEN / (VMAX[l] * 1.46) * 1000 * 0.97); // full speed on nitro + slingshot the whole lap
const IST = 5.5 * 3600 * 1000;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
function since(p, now) { if (p === "all") return 0; if (p === "week") return now - 7 * 864e5; const d = new Date(now + IST); d.setUTCHours(0, 0, 0, 0); return d.getTime() - IST; }

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const league = u.searchParams.get("league") || "pro", laps = parseInt(u.searchParams.get("laps") || "3", 10), period = u.searchParams.get("period") || "today";
  const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10)));
  if (!VMAX[league] || !LAPS.has(laps)) return json({ error: "Unknown race" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT name, MIN(total_ms) AS total_ms, best_lap_ms, acc FROM gp_runs WHERE league = ?1 AND laps = ?2 AND created_at >= ?3 GROUP BY name ORDER BY total_ms ASC LIMIT ?4`
  ).bind(league, laps, since(period, Date.now()), limit).all();
  return json({ league, laps, period, rows: results || [] });
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const { name, league, laps, splits, correct, wrong, missed } = b || {};
  if (typeof name !== "string" || !NAME_RE.test(name)) return json({ error: "Pick a ReadRash rider name" }, 400);
  if (!VMAX[league] || !LAPS.has(laps)) return json({ error: "Unknown race" }, 400);
  if (!Array.isArray(splits) || splits.length !== laps || !splits.every(Number.isInteger)) return json({ error: "Bad lap times" }, 400);
  const signs = laps * SIGNS_PER_LAP;
  if (![correct, wrong, missed].every(Number.isInteger) || correct < 0 || missed < 0 || wrong < 0 || wrong > 1000 || correct + missed !== signs) return json({ error: "Bad counts" }, 400);
  let prev = 0; const lapTimes = [];
  for (const t of splits) { const lt = t - prev; if (lt < MIN_LAP_MS(league) || lt > 10 * 60 * 1000) return json({ error: "Lap time out of range" }, 400); lapTimes.push(lt); prev = t; }
  const total = splits[splits.length - 1], best = Math.min(...lapTimes), acc = Math.round(correct / signs * 100), now = Date.now();
  const recent = await env.DB.prepare(`SELECT 1 FROM gp_runs WHERE name = ?1 AND created_at > ?2 LIMIT 1`).bind(name, now - 10000).first();
  if (recent) return json({ error: "Slow down, rider" }, 429);
  await env.DB.prepare(`INSERT INTO gp_runs (name, league, laps, total_ms, best_lap_ms, splits, acc, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
    .bind(name, league, laps, total, best, JSON.stringify(splits), acc, now).run();
  const ahead = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (SELECT name, MIN(total_ms) AS t FROM gp_runs WHERE league = ?1 AND laps = ?2 AND created_at >= ?3 GROUP BY name) WHERE t < ?4`
  ).bind(league, laps, since("today", now), total).first();
  let rp = null, rider = null; const rr = await getRider(env, b.key, name, true);
  if (rr) { const pl = Number.isInteger(b.place) && b.place >= 1 && b.place <= 12 ? b.place : null;
    rp = await award(env, rr, { mode: "gp", league, laps, timeMs: total, correct, finished: true, place: pl, clean: missed === 0 && wrong === 0 }); rider = profile(rr); }
  return json({ ok: true, total_ms: total, best_lap_ms: best, acc, rank: (ahead?.n || 0) + 1, rp, rider });
}
