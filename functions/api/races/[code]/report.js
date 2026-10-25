// Report a made race: one report per rider; 3 reports pause it (it stops loading for anyone) until checked.
import { json, getRider, raceData } from "../../../_lib/rr.js";
export async function onRequestPost({ request, env, params }) {
  let b; try { b = await request.json(); } catch { b = null; } if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "Bad JSON" }, 400);
  const c = String(params.code || "").toLowerCase();
  const race = await env.DB.prepare(`SELECT * FROM races WHERE code = ?1`).bind(c).first();
  if (!race) return json({ error: "This race doesn't exist" }, 404);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  // only reports that can mean something count: from a rider who has raced at least once (not a key made up a second
  // ago), not the maker, and only on races with text a person typed (Rash GP and Redline challenges carry none)
  const kind = raceData(race).kind;
  if (r.id === race.maker_id || (r.races | 0) < 1 || kind === "gp" || kind === "redline") return json({ ok: true });
  const reason = ["rude", "hurtful", "personal", "other"].includes(b.reason) ? b.reason : "other";
  const done = await env.DB.prepare(`SELECT 1 FROM race_reports WHERE code = ?1 AND rider_id = ?2`).bind(c, r.id).first();
  if (!done) {
    await env.DB.prepare(`INSERT INTO race_reports (code, rider_id, reason, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(c, r.id, reason, Date.now()).run();
    await env.DB.prepare(`UPDATE races SET reports = reports + 1 WHERE code = ?1`).bind(c).run();
  }
  return json({ ok: true });
}
