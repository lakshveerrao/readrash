import { getRider, award, profile, noteFairPlay } from "../_lib/rr.js";
// Cloudflare Pages Function: GET/POST /api/scores, backed by a D1 database bound as `DB`.
const ADJ = ["Turbo","Rapid","Zippy","Mighty","Swift","Blazing","Cosmic","Thunder","Rocket","Nitro","Lucky","Brave","Jolly","Speedy","Golden","Silver","Super","Hyper","Flying","Daring","Clever","Funky","Jumbo","Fearless"];
const NOUN = ["Mango","Tiger","Falcon","Cheetah","Coconut","Comet","Panther","Crab","Turtle","Monsoon","Pepper","Lassi","Samosa","Dolphin","Eagle","Bolt","Wheelie","Kite","Lion","Peacock","Jalebi","Cyclone","Gecko","Rider"];
const NAME_RE = new RegExp(`^(${ADJ.join("|")})(${NOUN.join("|")})\\d{2}$`);
const LEAGUES = new Set(["rookie","pro","legend"]);
// word counts of each race's passage per league (anti-tamper: must match exactly)
const WORDS = { rookie:[29,26,27,24,29], pro:[32,36,30,30,34], legend:[37,36,38,37,40] }; // keep in sync with RACES in assets/game.js
const IST = 5.5 * 3600 * 1000;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function since(period, now) {
  if (period === "all") return 0;
  if (period === "week") return now - 7 * 864e5;
  const d = new Date(now + IST); d.setUTCHours(0, 0, 0, 0); return d.getTime() - IST; // midnight in India
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const league = u.searchParams.get("league") || "pro";
  const period = u.searchParams.get("period") || "today";
  const limit = Math.min(100, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10)));
  if (!LEAGUES.has(league)) return json({ error: "Unknown league" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT name, MAX(score) AS score, wpm, acc FROM scores WHERE league = ?1 AND created_at >= ?2 GROUP BY name ORDER BY score DESC LIMIT ?3`
  ).bind(league, since(period, Date.now()), limit).all();
  return json({ league, period, rows: results || [] });
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const { name, league, race, words, correct, attempts, timeMs } = b || {};
  if (typeof name !== "string" || !NAME_RE.test(name)) return json({ error: "Pick a ReadRash rider name" }, 400);
  if (!LEAGUES.has(league)) return json({ error: "Unknown league" }, 400);
  if (!Number.isInteger(race) || race < 0 || race > 4) return json({ error: "Unknown race" }, 400);
  if (words !== WORDS[league][race]) return json({ error: "Race doesn't match" }, 400);
  if (!Number.isInteger(correct) || !Number.isInteger(attempts) || correct < 0 || correct > words || attempts < correct || attempts > words * 4) return json({ error: "Bad counts" }, 400);
  if (!Number.isFinite(timeMs) || timeMs < words * 150 || timeMs > 15 * 60 * 1000) return json({ error: "Time out of range" }, 400); // faster than 400 wpm is not a human reading aloud
  const wpm = Math.round(correct / (timeMs / 60000));
  const acc = attempts ? Math.round(correct / attempts * 100) : 0;
  const score = Math.round(wpm * acc / 100);
  const now = Date.now();
  // light rate limit: one post per name every 10 seconds
  const recent = await env.DB.prepare(`SELECT 1 FROM scores WHERE name = ?1 AND created_at > ?2 LIMIT 1`).bind(name, now - 10000).first();
  if (recent) return json({ error: "Slow down, rider" }, 429);
  await env.DB.prepare(`INSERT INTO scores (name, league, race, wpm, acc, score, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(name, league, race, wpm, acc, score, now).run();
  const better = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (SELECT name, MAX(score) AS s FROM scores WHERE league = ?1 AND created_at >= ?2 GROUP BY name) WHERE s > ?3`
  ).bind(league, since("today", now), score).first();
  let rp = null, rider = null; const rr = await getRider(env, b.key, name, true);
  if (rr) { const pl = Number.isInteger(b.place) && b.place >= 1 && b.place <= 4 ? b.place : null;
    await noteFairPlay(env, rr, "story", `${league}/${race}`, b.chk);
    rp = await award(env, rr, { mode: "story", league, timeMs, correct, finished: true, place: pl, clean: attempts === correct && correct === words }); rider = profile(rr); }
  return json({ ok: true, wpm, acc, score, rank: (better?.n || 0) + 1, rp, rider });
}
