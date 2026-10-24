// Redline boards: GET best time per rider for a pack + level; POST a finished drag run (awards Rash Points).
import { json, getRider, award, profile, noteFairPlay, RL_PACKS, checkRedline } from "../_lib/rr.js";
const LG = new Set(["rookie", "pro", "legend"]), IST = 5.5 * 3600 * 1000;
function since(p, now) { if (p === "all") return 0; if (p === "week") return now - 7 * 864e5; const d = new Date(now + IST); d.setUTCHours(0, 0, 0, 0); return d.getTime() - IST; }
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), pack = u.searchParams.get("pack") || "animals", league = u.searchParams.get("league") || "pro", period = u.searchParams.get("period") || "today";
  const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10)));
  if (!RL_PACKS.has(pack) || !LG.has(league)) return json({ error: "Unknown board" }, 400);
  const { results } = await env.DB.prepare(`SELECT name, MIN(time_ms) AS time_ms, MAX(top_kmh) AS top_kmh FROM redline_runs WHERE pack = ?1 AND league = ?2 AND created_at >= ?3 GROUP BY rider_id ORDER BY time_ms ASC LIMIT ?4`)
    .bind(pack, league, since(period, Date.now()), limit).all();
  return json({ pack, league, period, rows: results || [] });
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  if (!RL_PACKS.has(b.pack) || !LG.has(b.league)) return json({ error: "Unknown board" }, 400);
  const err = checkRedline(b); if (err) return json({ error: err }, 400);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  const now = Date.now();
  const recent = await env.DB.prepare(`SELECT 1 FROM redline_runs WHERE rider_id = ?1 AND created_at > ?2 LIMIT 1`).bind(r.id, now - 6000).first();
  if (recent) return json({ error: "Slow down, rider" }, 429);
  await env.DB.prepare(`INSERT INTO redline_runs (rider_id, name, pack, league, time_ms, top_kmh, correct, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
    .bind(r.id, r.name, b.pack, b.league, b.timeMs, b.top, b.correct, now).run();
  const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (SELECT rider_id, MIN(time_ms) AS t FROM redline_runs WHERE pack = ?1 AND league = ?2 AND created_at >= ?3 GROUP BY rider_id) WHERE t < ?4`)
    .bind(b.pack, b.league, since("today", now), b.timeMs).first();
  await noteFairPlay(env, r, "redline", `${b.pack}/${b.league}`, b.chk);
  const rp = await award(env, r, { mode: "redline", league: b.league, timeMs: b.timeMs, correct: b.correct, finished: true, clean: (b.missed | 0) === 0 && b.attempts === b.correct });
  return json({ ok: true, time_ms: b.timeMs, rank: (ahead?.n || 0) + 1, rp, rider: profile(r) });
}
