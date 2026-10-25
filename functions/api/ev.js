// Count a growth moment for today (link opened, shared, challenge made). Only known keys; no personal data.
import { json, dayOf } from "../_lib/rr.js";
const KEYS = new Set(["open_link", "share_link", "share_copy", "share_whatsapp", "share_image", "challenge_gp", "challenge_rl", "rematch", "visit_redline", "save_video", "share_video", "visit_home", "visit_gp", "visit_make"]);
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { b = null; } if (!b || typeof b !== "object" || Array.isArray(b)) return json({ ok: false }, 400);
  if (!KEYS.has(b && b.k)) return json({ ok: false }, 400);
  try { await env.DB.prepare(`INSERT INTO events (day, k, n) VALUES (?1, ?2, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1`).bind(dayOf(Date.now()), b.k).run(); } catch (e) {}
  return json({ ok: true });
}
