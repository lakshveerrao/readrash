// Challenge from a Redline run: same pack, same word order (seed), the rider's run as the ghost. Open to every rider.
import { json, getRider, RACE_LIMITS, RL_PACKS, checkRedline } from "../../_lib/rr.js";
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789", LG = { rookie: "Rookie", pro: "Pro", legend: "Legend" };
const NAMES = { animals: "Animals", food: "Food", sport: "Sport", space: "Space", india: "India", colours: "Colours" };
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPHA[x % ALPHA.length]).join("");
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { b = null; } if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "Bad JSON" }, 400);
  if (!RL_PACKS.has(b.pack) || !LG[b.league]) return json({ error: "Unknown race" }, 400);
  if (typeof b.seed !== "string" || !/^[a-z0-9]{1,16}$/.test(b.seed)) return json({ error: "Bad race" }, 400);
  const err = checkRedline(b); if (err) return json({ error: err }, 400);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  const now = Date.now();
  const day = await env.DB.prepare(`SELECT COUNT(*) AS n FROM races WHERE maker_id = ?1 AND created_at > ?2`).bind(r.id, now - 864e5).first();
  if ((day?.n || 0) >= 15) return json({ error: "That's a lot of challenges today. Come back tomorrow" }, 429);
  const lim = RACE_LIMITS(r.rp), title = `${r.name}'s Redline · ${NAMES[b.pack]} · ${LG[b.league]}`;
  let c = code(); for (let i = 0; i < 4 && await env.DB.prepare(`SELECT 1 FROM races WHERE code = ?1`).bind(c).first(); i++) c = code();
  await env.DB.prepare(`INSERT INTO races (code, maker_id, maker_name, title, words, league, laps, max_riders, status, maker_ms, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 'live', ?8, ?9, ?10)`)
    .bind(c, r.id, r.name, title, JSON.stringify({ redline: { pack: b.pack, seed: b.seed } }), b.league, lim.riders, b.timeMs, now, now + lim.days * 864e5).run();
  await env.DB.prepare(`INSERT INTO race_runs (code, rider_id, name, time_ms, correct, missed, track, created_at) VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6, ?7)`)
    .bind(c, r.id, r.name, b.timeMs, b.correct, JSON.stringify(b.trace), now).run();
  // tidy up: only races that have already ended, and never the newest 30 (a shared link keeps working until it expires)
  await env.DB.prepare(`DELETE FROM race_runs WHERE code IN (SELECT code FROM races WHERE maker_id = ?1 AND expires_at < ?2 AND code NOT IN (SELECT code FROM races WHERE maker_id = ?1 ORDER BY created_at DESC LIMIT 30))`).bind(r.id, Date.now()).run();
  await env.DB.prepare(`DELETE FROM races WHERE maker_id = ?1 AND expires_at < ?2 AND code NOT IN (SELECT code FROM races WHERE maker_id = ?1 ORDER BY created_at DESC LIMIT 30)`).bind(r.id, Date.now()).run();
  return json({ code: c, title, maker_ms: b.timeMs, max_riders: lim.riders });
}
