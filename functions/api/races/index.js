// Make a race: POST {key, name, words[], league, laps} → a draft race code. The maker races it once to open it.
import { json, getRider, checkWords, RACE_LIMITS, ADJ, NOUN, dayOf } from "../../_lib/rr.js";
const LG = new Set(["rookie", "pro", "legend"]);
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPHA[x % ALPHA.length]).join("");
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const r = await getRider(env, b.key, b.name, true);
  if (!r) return json({ error: "Unknown rider" }, 400);
  const lim = RACE_LIMITS(r.rp);
  if (!lim.make) return json({ error: "Make a race unlocks at 150 Rash Points", need: 150 - r.rp }, 403);
  if (!LG.has(b.league) || ![2, 3].includes(b.laps)) return json({ error: "Pick a level and 2 or 3 laps" }, 400);
  if (!Array.isArray(b.words)) return json({ error: "Add your words" }, 400);
  const { ok, bad } = checkWords(b.words.slice(0, 60));
  if (bad.length) return json({ error: "Some words can't be used", bad }, 400);
  if (ok.length < 10) return json({ error: "Add at least 10 different words" }, 400);
  if (ok.length > lim.words) return json({ error: `Up to ${lim.words} words for now` }, 400);
  const now = Date.now(), since = now - 864e5;
  const day = await env.DB.prepare(`SELECT COUNT(*) AS n FROM races WHERE maker_id = ?1 AND created_at > ?2`).bind(r.id, since).first();
  if ((day?.n || 0) >= 5) return json({ error: "5 new races a day. Come back tomorrow" }, 429);
  const pick = a => a[crypto.getRandomValues(new Uint8Array(1))[0] % a.length];
  const title = `${pick(ADJ)} ${pick(NOUN)} ${pick(["Sprint", "Dash", "Rally", "Run", "Cup", "Derby"])}`;
  let c = code();
  for (let i = 0; i < 4 && await env.DB.prepare(`SELECT 1 FROM races WHERE code = ?1`).bind(c).first(); i++) c = code();
  await env.DB.prepare(`INSERT INTO races (code, maker_id, maker_name, title, words, league, laps, max_riders, status, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9, ?10)`)
    .bind(c, r.id, r.name, title, JSON.stringify(ok), b.league, b.laps, lim.riders, now, now + lim.days * 864e5).run();
  // keep at most 20 races per maker
  await env.DB.prepare(`DELETE FROM races WHERE maker_id = ?1 AND code NOT IN (SELECT code FROM races WHERE maker_id = ?1 ORDER BY created_at DESC LIMIT 20)`).bind(r.id).run();
  return json({ code: c, title, words: ok });
}
