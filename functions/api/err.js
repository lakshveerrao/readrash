// Game errors from players' devices: POST {w, m, s, p, ua}. Kept per day and grouped, so the same error counts up.
import { json, dayOf } from "../_lib/rr.js";
const cut = (v, n) => String(v || "").slice(0, n);
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const now = Date.now(), day = dayOf(now), w = cut(b.w, 30), m = cut(b.m, 200);
  if (!w || !m) return json({ ok: false }, 400);
  try {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM errors WHERE day = ?1`).bind(day).first();
    if ((c?.n || 0) > 300) return json({ ok: true });
    await env.DB.prepare(`INSERT INTO errors (day, w, m, s, p, ua, n, last_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7) ON CONFLICT(day, w, m) DO UPDATE SET n = n + 1, last_at = ?7, ua = ?6, s = ?4`)
      .bind(day, w, m, cut(b.s, 600), cut(b.p, 60), cut(b.ua, 160), now).run();
  } catch (e) {}
  return json({ ok: true });
}
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.STATS_KEY || key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  const { results } = await env.DB.prepare(`SELECT * FROM errors ORDER BY last_at DESC LIMIT 50`).all();
  return json({ rows: results || [] });
}
