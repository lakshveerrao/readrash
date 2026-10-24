// Rematch: after racing someone's link, send it back. Same signs (or words), your best run becomes the ghost,
// and the two of you play a best of 3. POST {key, name} → a new one-on-one race code.
import { json, getRider, RACE_LIMITS, raceData } from "../../../_lib/rr.js";
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPHA[x % ALPHA.length]).join("");
export async function onRequestPost({ request, env, params }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const src = String(params.code || "").toLowerCase();
  const race = await env.DB.prepare(`SELECT * FROM races WHERE code = ?1`).bind(src).first();
  if (!race || race.reports >= 3) return json({ error: "This race can't be rematched" }, 404);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  if (r.id === race.maker_id) return json({ error: "Wait for your friend to race it first" }, 409);
  const run = await env.DB.prepare(`SELECT time_ms, correct, missed, track FROM race_runs WHERE code = ?1 AND rider_id = ?2 ORDER BY time_ms ASC LIMIT 1`).bind(src, r.id).first();
  if (!run) return json({ error: "Race it first" }, 409);
  const now = Date.now();
  const day = await env.DB.prepare(`SELECT COUNT(*) AS n FROM races WHERE maker_id = ?1 AND created_at > ?2`).bind(r.id, now - 864e5).first();
  if ((day?.n || 0) >= 15) return json({ error: "That's a lot of races today. Come back tomorrow" }, 429);
  // one rematch per rider per race: send the same link again instead of making a new one
  const d = raceData(race), them = race.maker_name;
  const again = await env.DB.prepare(`SELECT code, title FROM races WHERE maker_id = ?1 AND words LIKE ?2 LIMIT 1`).bind(r.id, `%"from":"${src}"%`).first();
  if (again) return json({ code: again.code, title: again.title, again: true });
  // the series so far: wins before this game, plus this game's result
  let s = d.series && Array.isArray(d.series.names) && d.series.names.includes(r.name) && d.series.names.includes(them) ? d.series : { g: 1, names: [them, r.name], w: {} };
  const w = { ...s.w }; if (race.maker_ms && run.time_ms < race.maker_ms) w[r.name] = (w[r.name] || 0) + 1; else if (race.maker_ms && run.time_ms > race.maker_ms) w[them] = (w[them] || 0) + 1;
  const over = s.g >= 3 || Object.values(w).some(n => n >= 2);
  const next = over ? { g: 1, names: [r.name, them], w: {} } : { g: s.g + 1, names: s.names, w };
  const data = { from: src, series: next, circuit: d.circuit };
  if (d.kind === "gp") data.seed = d.seed; else if (d.kind === "story") data.passage = d.passage; else data.words = d.words;
  const title = `${r.name} vs ${them} · Game ${next.g} of 3`;
  const lim = RACE_LIMITS(r.rp);
  let c = code(); for (let i = 0; i < 4 && await env.DB.prepare(`SELECT 1 FROM races WHERE code = ?1`).bind(c).first(); i++) c = code();
  await env.DB.prepare(`INSERT INTO races (code, maker_id, maker_name, title, words, league, laps, max_riders, status, maker_ms, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 'live', ?8, ?9, ?10)`)
    .bind(c, r.id, r.name, title, JSON.stringify(data), race.league, race.laps, run.time_ms, now, now + lim.days * 864e5).run();
  await env.DB.prepare(`INSERT INTO race_runs (code, rider_id, name, time_ms, correct, missed, track, created_at) VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6, ?7)`)
    .bind(c, r.id, r.name, run.time_ms, run.correct, run.track, now).run();
  return json({ code: c, title, maker_ms: run.time_ms, series: next, wasOver: over, result: w });
}
