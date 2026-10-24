// One made race: words, maker, the time to beat, the maker's ghost, the race board.
import { json } from "../../_lib/rr.js";
export async function onRequestGet({ env, params }) {
  const c = String(params.code || "").toLowerCase();
  const race = await env.DB.prepare(`SELECT * FROM races WHERE code = ?1`).bind(c).first();
  if (!race) return json({ error: "This race doesn't exist" }, 404);
  const expired = Date.now() > race.expires_at, paused = race.reports >= 3;
  const { results } = await env.DB.prepare(`SELECT rider_id, name, MIN(time_ms) AS time_ms FROM race_runs WHERE code = ?1 GROUP BY rider_id ORDER BY time_ms ASC LIMIT 50`).bind(c).all();
  const ghost = await env.DB.prepare(`SELECT name, time_ms, track FROM race_runs WHERE code = ?1 AND rider_id = ?2 ORDER BY time_ms ASC LIMIT 1`).bind(c, race.maker_id).first();
  const board = (results || []).map(x => ({ name: x.name, time_ms: x.time_ms, maker: x.rider_id === race.maker_id }));
  return json({ code: c, title: race.title, maker: race.maker_name, words: paused ? [] : JSON.parse(race.words), league: race.league, laps: race.laps,
    status: paused ? "paused" : expired ? "expired" : race.status, maker_ms: race.maker_ms, max_riders: race.max_riders,
    riders: board.filter(x => !x.maker).length, expires_at: race.expires_at, board,
    ghost: ghost ? { name: ghost.name, time_ms: ghost.time_ms, track: JSON.parse(ghost.track) } : null });
}
