// Challenge from any finished Rash GP race: the same signs (same seed) with the rider's run as the ghost. Open to every rider from race 1.
import { json, getRider, RACE_LIMITS, circuitFor } from "../../_lib/rr.js";
const LAP_LEN = 1000 * 200, SIGNS_PER_LAP = 10, VMAX = { rookie: 6000, pro: 9500, legend: 14000 };
const MIN_LAP_MS = l => Math.floor(LAP_LEN / (VMAX[l] * 1.46) * 1000 * 0.97);
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPHA[x % ALPHA.length]).join("");
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  const { league, laps, seed, splits, correct, wrong, missed, track } = b;
  if (!VMAX[league] || ![2, 3, 5].includes(laps)) return json({ error: "Unknown race" }, 400);
  if (typeof seed !== "string" || !/^[a-z0-9]{4,16}$/.test(seed)) return json({ error: "Bad race" }, 400);
  if (!Array.isArray(splits) || splits.length !== laps || !splits.every(Number.isInteger)) return json({ error: "Bad lap times" }, 400);
  if (![correct, wrong, missed].every(Number.isInteger) || correct < 0 || missed < 0 || correct + missed !== laps * SIGNS_PER_LAP) return json({ error: "Bad counts" }, 400);
  let prev = 0; for (const t of splits) { const lt = t - prev; if (lt < MIN_LAP_MS(league) || lt > 600000) return json({ error: "Lap time out of range" }, 400); prev = t; }
  if (!Array.isArray(track) || track.length > 6000 || !track.every(Number.isInteger)) return json({ error: "Bad track" }, 400);
  const now = Date.now();
  const day = await env.DB.prepare(`SELECT COUNT(*) AS n FROM races WHERE maker_id = ?1 AND created_at > ?2`).bind(r.id, now - 864e5).first();
  if ((day?.n || 0) >= 15) return json({ error: "That's a lot of challenges today. Come back tomorrow" }, 429);
  const lim = RACE_LIMITS(r.rp), total = splits[splits.length - 1];
  const LG = { rookie: "Rookie", pro: "Pro", legend: "Legend" }[league];
  const title = `${r.name}'s Rash GP · ${LG} · ${laps} laps`;
  let c = code(); for (let i = 0; i < 4 && await env.DB.prepare(`SELECT 1 FROM races WHERE code = ?1`).bind(c).first(); i++) c = code();
  await env.DB.prepare(`INSERT INTO races (code, maker_id, maker_name, title, words, league, laps, max_riders, status, maker_ms, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'live', ?9, ?10, ?11)`)
    .bind(c, r.id, r.name, title, JSON.stringify({ seed, circuit: circuitFor(b.circuit, r.rp) }), league, laps, lim.riders, total, now, now + lim.days * 864e5).run();
  await env.DB.prepare(`INSERT INTO race_runs (code, rider_id, name, time_ms, correct, missed, track, created_at) VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6, ?7)`)
    .bind(c, r.id, r.name, total, correct, JSON.stringify(track), now).run();
  await env.DB.prepare(`DELETE FROM races WHERE maker_id = ?1 AND code NOT IN (SELECT code FROM races WHERE maker_id = ?1 ORDER BY created_at DESC LIMIT 30)`).bind(r.id).run();
  return json({ code: c, title, maker_ms: total, max_riders: lim.riders });
}
