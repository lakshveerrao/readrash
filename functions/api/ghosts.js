// Rash GP ghosts: real players' best runs (lap splits) to race against. D1 binding: DB.
const VMAX = { rookie: 1, pro: 1, legend: 1 }, LAPS = new Set([2, 3, 5]);
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const league = u.searchParams.get("league") || "pro", laps = parseInt(u.searchParams.get("laps") || "3", 10);
  if (!VMAX[league] || !LAPS.has(laps)) return json({ error: "Unknown race" }, 400);
  // each rider's best run from the last 30 days; send the top 3 plus 3 random others so the grid changes
  const { results } = await env.DB.prepare(
    `SELECT g.name, g.splits, g.total_ms FROM gp_runs g JOIN (SELECT name, MIN(total_ms) AS t FROM gp_runs WHERE league = ?1 AND laps = ?2 AND created_at >= ?3 GROUP BY name) b
     ON g.name = b.name AND g.total_ms = b.t WHERE g.league = ?1 AND g.laps = ?2 GROUP BY g.name ORDER BY g.total_ms ASC LIMIT 40`
  ).bind(league, laps, Date.now() - 30 * 864e5).all();
  const rows = (results || []).map(r => ({ name: r.name, splits: JSON.parse(r.splits) }));
  const top = rows.slice(0, 3), rest = rows.slice(3).sort(() => Math.random() - .5).slice(0, 3);
  return json({ league, laps, rows: [...top, ...rest] });
}
