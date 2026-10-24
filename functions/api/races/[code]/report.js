// Report a made race: one report per rider; 3 reports pause it (it stops loading for anyone) until checked.
import { json, getRider } from "../../../_lib/rr.js";
export async function onRequestPost({ request, env, params }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const c = String(params.code || "").toLowerCase();
  const race = await env.DB.prepare(`SELECT code FROM races WHERE code = ?1`).bind(c).first();
  if (!race) return json({ error: "This race doesn't exist" }, 404);
  const r = await getRider(env, b.key, b.name, true); if (!r) return json({ error: "Unknown rider" }, 400);
  const reason = ["rude", "hurtful", "personal", "other"].includes(b.reason) ? b.reason : "other";
  const done = await env.DB.prepare(`SELECT 1 FROM race_reports WHERE code = ?1 AND rider_id = ?2`).bind(c, r.id).first();
  if (!done) {
    await env.DB.prepare(`INSERT INTO race_reports (code, rider_id, reason, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(c, r.id, reason, Date.now()).run();
    await env.DB.prepare(`UPDATE races SET reports = reports + 1 WHERE code = ?1`).bind(c).run();
  }
  return json({ ok: true });
}
