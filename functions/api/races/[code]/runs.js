// A finished run on a made race: checks it, opens the race on the maker's first run, awards Rash Points.
import { json, getRider, award, makerBonus, profile, noteFairPlay, raceData, checkRedline, checkWords } from "../../../_lib/rr.js";
const LAP_LEN = 1000 * 200, SIGNS_PER_LAP = 10, VMAX = { rookie: 6000, pro: 9500, legend: 14000 };
const MIN_LAP_MS = l => Math.floor(LAP_LEN / (VMAX[l] * 1.46) * 1000 * 0.97);
export async function onRequestPost({ request, env, params }) {
  let b; try { b = await request.json(); } catch { b = null; } if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "Bad JSON" }, 400);
  const c = String(params.code || "").toLowerCase();
  const race = await env.DB.prepare(`SELECT * FROM races WHERE code = ?1`).bind(c).first();
  if (!race) return json({ error: "This race doesn't exist" }, 404);
  if (Date.now() > race.expires_at) return json({ error: "This race has ended" }, 410);
  if (race.reports >= 3) return json({ error: "This race is paused" }, 423);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  const isMaker = r.id === race.maker_id;
  if (race.status === "draft" && !isMaker) return json({ error: "This race isn't open yet" }, 409);
  if (!isMaker) {
    const already = await env.DB.prepare(`SELECT 1 FROM race_runs WHERE code = ?1 AND rider_id = ?2 LIMIT 1`).bind(c, r.id).first();
    if (!already) { const n = await env.DB.prepare(`SELECT COUNT(DISTINCT rider_id) AS n FROM race_runs WHERE code = ?1 AND rider_id != ?2`).bind(c, race.maker_id).first();
      if ((n?.n || 0) >= race.max_riders) return json({ error: race.max_riders === 1 ? "This duel already has its challenger" : "This race is full", full: true }, 409); }
  }
  const { splits, correct, wrong, missed, place, missedWords } = b, laps = race.laps, signs = laps * SIGNS_PER_LAP, d = raceData(race);
  let track = b.track, total;
  if (d.kind === "redline") { // a drag run: time, and the distance trace for the ghost
    const err = checkRedline(b); if (err) return json({ error: err }, 400);
    total = b.timeMs; track = b.trace;
  } else if (d.kind === "story") { // a passage: one read-through, timed
    const n = d.passage.split(" ").length, { timeMs, attempts } = b;
    if (!Number.isInteger(correct) || correct < 0 || correct > n || !Number.isInteger(attempts) || attempts < correct || attempts > n * 4) return json({ error: "Bad counts" }, 400);
    if (!Number.isFinite(timeMs) || timeMs < n * 150 || timeMs > 15 * 60 * 1000) return json({ error: "Time out of range" }, 400);
    total = Math.round(timeMs); track = [];
  } else {
    if (!Array.isArray(splits) || splits.length !== laps || !splits.every(Number.isInteger)) return json({ error: "Bad lap times" }, 400);
    if (![correct, wrong, missed].every(Number.isInteger) || correct < 0 || missed < 0 || correct + missed !== signs) return json({ error: "Bad counts" }, 400);
    let prev = 0; for (const t of splits) { const lt = t - prev; if (lt < MIN_LAP_MS(race.league) || lt > 600000) return json({ error: "Lap time out of range" }, 400); prev = t; }
    if (!Array.isArray(track) || track.length > 6000 || !track.every(Number.isInteger)) return json({ error: "Bad track" }, 400);
    total = splits[splits.length - 1];
  }
  const now = Date.now();
  const recent = await env.DB.prepare(`SELECT 1 FROM race_runs WHERE rider_id = ?1 AND created_at > ?2 LIMIT 1`).bind(r.id, now - 10000).first();
  if (recent) return json({ error: "Slow down, rider" }, 429);
  // the words a friend missed are shown to the maker, so only keep words that are in this race (or, for Rash GP and
  // Redline, whose signs aren't stored, words that pass the same dictionary and blocklist check as made races)
  const raceWords = new Set((d.passage ? d.passage.split(" ") : d.words).map(w => String(w).toLowerCase().replace(/[^a-z]/g, "")));
  const raw = Array.isArray(missedWords) ? missedWords.filter(w => typeof w === "string").slice(0, 30).map(w => w.toLowerCase().replace(/[^a-z]/g, "").slice(0, 18)).filter(Boolean) : [];
  const mw = raceWords.size > 1 ? raw.filter(w => raceWords.has(w)) : checkWords(raw).ok;
  await env.DB.prepare(`INSERT INTO race_runs (code, rider_id, name, time_ms, correct, missed, track, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
    .bind(c, r.id, r.name, total, correct, JSON.stringify(mw), JSON.stringify(track), now).run();
  if (isMaker) { if (race.status === "draft" || !race.maker_ms || total < race.maker_ms) await env.DB.prepare(`UPDATE races SET status = 'live', maker_ms = ?1 WHERE code = ?2`).bind(Math.min(total, race.maker_ms || total), c).run(); }
  else await makerBonus(env, race.maker_id);
  await noteFairPlay(env, r, "race", c, b.chk);
  const rp = await award(env, r, { mode: "race", code: c, league: race.league, laps, timeMs: total, correct, finished: true, place: Number.isInteger(place) ? place : null, clean: d.kind === "redline" ? (b.missed | 0) === 0 && b.attempts === correct : d.kind === "story" ? b.attempts === b.correct && b.correct === d.passage.split(" ").length : missed === 0 && wrong === 0, rate: isMaker ? 0.5 : 1 });
  const { results } = await env.DB.prepare(`SELECT rider_id, name, MIN(time_ms) AS time_ms FROM race_runs WHERE code = ?1 GROUP BY rider_id ORDER BY time_ms ASC LIMIT 50`).bind(c).all();
  const board = (results || []).map(x => ({ name: x.name, time_ms: x.time_ms, maker: x.rider_id === race.maker_id, me: x.rider_id === r.id }));
  return json({ ok: true, time_ms: total, rank: board.findIndex(x => x.me) + 1, board, maker_ms: isMaker ? Math.min(total, race.maker_ms || total) : race.maker_ms, opened: isMaker && race.status === "draft", rp, rider: profile(r) });
}
