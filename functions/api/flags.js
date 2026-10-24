// Owner view of fair-play flags (watch-only). GET ?key= lists the last 100; POST {key, id} marks one as a false alarm.
import { json, ENFORCE } from "../_lib/rr.js";
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.STATS_KEY || key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  const { results } = await env.DB.prepare(`SELECT id, name, mode, ref, reasons, detail, cleared, created_at FROM flags ORDER BY created_at DESC LIMIT 100`).all();
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(cleared) AS c FROM flags`).first();
  return json({ enforce: ENFORCE, total: total?.n || 0, cleared: total?.c || 0, rows: (results || []).map(r => ({ ...r, reasons: JSON.parse(r.reasons), detail: JSON.parse(r.detail) })) });
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  if (!env.STATS_KEY || b.key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  await env.DB.prepare(`UPDATE flags SET cleared = 1 WHERE id = ?1`).bind(b.id | 0).run();
  return json({ ok: true });
}
