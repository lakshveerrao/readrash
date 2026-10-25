// Paused races (3 reports) for the owner: GET ?key= lists them with their text; POST {key, code, action: "unpause"|"remove"}.
import { json, raceData } from "../_lib/rr.js";
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.STATS_KEY || key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  const { results } = await env.DB.prepare(`SELECT * FROM races WHERE reports >= 3 ORDER BY created_at DESC LIMIT 50`).all();
  return json({ rows: (results || []).map(r => { const d = raceData(r); return { code: r.code, maker: r.maker_name, title: r.title, reports: r.reports, text: d.passage || d.words.join(" ") }; }) });
}
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { b = null; } if (!b || typeof b !== "object") return json({ error: "Bad JSON" }, 400);
  if (!env.STATS_KEY || b.key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  const c = String(b.code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (b.action === "unpause") { await env.DB.prepare(`UPDATE races SET reports = 0 WHERE code = ?1`).bind(c).run(); await env.DB.prepare(`DELETE FROM race_reports WHERE code = ?1`).bind(c).run(); }
  else if (b.action === "remove") { await env.DB.prepare(`DELETE FROM races WHERE code = ?1`).bind(c).run(); await env.DB.prepare(`DELETE FROM race_runs WHERE code = ?1`).bind(c).run(); await env.DB.prepare(`DELETE FROM race_reports WHERE code = ?1`).bind(c).run(); }
  else return json({ error: "Unknown action" }, 400);
  return json({ ok: true });
}
