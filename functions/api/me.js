// Your rider: POST {key, name} → level, RP, unlock limits, recent races and the races you made.
import { json, getRider, profile } from "../_lib/rr.js";
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const r = await getRider(env, b.key, b.name, true);
  if (!r) return json({ error: "Unknown rider" }, 400);
  const { results: recent } = await env.DB.prepare(`SELECT mode, league, laps, race_code, time_ms, correct, place, rp, created_at FROM rides WHERE rider_id = ?1 ORDER BY created_at DESC LIMIT 8`).bind(r.id).all();
  const { results: made } = await env.DB.prepare(
    `SELECT r.code, r.title, CASE WHEN r.words LIKE '%"passage":%' THEN 'story' WHEN r.words LIKE '%"seed":%' THEN 'gp' ELSE 'words' END AS kind, r.league, r.laps, r.status, r.maker_ms, r.expires_at, r.max_riders, (SELECT COUNT(DISTINCT rider_id) FROM race_runs x WHERE x.code = r.code AND x.rider_id != r.maker_id) AS riders,
     (SELECT MIN(time_ms) FROM race_runs x WHERE x.code = r.code) AS best_ms FROM races r WHERE r.maker_id = ?1 ORDER BY r.created_at DESC LIMIT 20`).bind(r.id).all();
  // the words friends missed most on each of your races (shown from Level 3)
  const codes = (made || []).filter(m => m.riders > 0).map(m => m.code);
  if (codes.length) {
    const { results: runs } = await env.DB.prepare(`SELECT x.code, x.missed FROM race_runs x JOIN races r ON r.code = x.code WHERE r.maker_id = ?1 AND x.rider_id != ?1 AND x.code IN (${codes.map((_, i) => "?" + (i + 2)).join(",")})`).bind(r.id, ...codes).all();
    const by = {}; for (const x of runs || []) { let m; try { m = JSON.parse(x.missed); } catch { m = []; } const c = by[x.code] || (by[x.code] = {}); for (const w of new Set(m)) c[w] = (c[w] || 0) + 1; }
    for (const m of made) if (by[m.code]) m.missed = Object.entries(by[m.code]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }
  return json({ ...profile(r), recent: recent || [], made: made || [] });
}
