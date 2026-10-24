// Private growth numbers for the owner: /stats.html asks for the STATS_KEY set on the Pages project.
import { json, dayOf } from "../_lib/rr.js";
const IST = 5.5 * 3600 * 1000;
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), key = u.searchParams.get("key") || "";
  if (!env.STATS_KEY) return json({ error: "Set a STATS_KEY secret on the Pages project first" }, 503);
  if (key !== env.STATS_KEY) return json({ error: "Wrong key" }, 403);
  const days = 14, now = Date.now(), from = new Date(dayOf(now - (days - 1) * 864e5) + "T00:00:00Z").getTime() - IST;
  const q = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
  const dayExpr = c => `strftime('%Y-%m-%d', (${c} + ${IST}) / 1000, 'unixepoch')`;
  const [riders, rides, active, made, finishes, viaLink, events, totals] = await Promise.all([
    q(`SELECT ${dayExpr("created_at")} AS d, COUNT(*) AS n FROM riders WHERE created_at >= ?1 GROUP BY d`, from),
    q(`SELECT ${dayExpr("created_at")} AS d, mode, COUNT(*) AS n FROM rides WHERE created_at >= ?1 GROUP BY d, mode`, from),
    q(`SELECT ${dayExpr("created_at")} AS d, COUNT(DISTINCT rider_id) AS n FROM rides WHERE created_at >= ?1 GROUP BY d`, from),
    q(`SELECT ${dayExpr("created_at")} AS d, CASE WHEN words LIKE '%"from":%' THEN 'rematch' WHEN words LIKE '%"redline":%' THEN 'redline' WHEN words LIKE '%"passage":%' THEN 'story' WHEN words LIKE '%"seed":%' THEN 'gp' ELSE 'words' END AS kind, COUNT(*) AS n FROM races WHERE created_at >= ?1 GROUP BY d, kind`, from),
    q(`SELECT ${dayExpr("x.created_at")} AS d, COUNT(*) AS n FROM race_runs x JOIN races r ON r.code = x.code WHERE x.rider_id != r.maker_id AND x.created_at >= ?1 GROUP BY d`, from),
    q(`SELECT ${dayExpr("f.t")} AS d, COUNT(*) AS n FROM (SELECT rider_id, MIN(created_at) AS t FROM rides GROUP BY rider_id) f JOIN rides r1 ON r1.rider_id = f.rider_id AND r1.created_at = f.t WHERE r1.mode = 'race' AND f.t >= ?1 GROUP BY d`, from),
    q(`SELECT day AS d, k, n FROM events WHERE day >= ?1`, dayOf(from + IST)),
    q(`SELECT (SELECT COUNT(*) FROM riders) AS riders, (SELECT COUNT(*) FROM rides) AS rides, (SELECT COUNT(*) FROM races) AS races, (SELECT COUNT(*) FROM race_runs x JOIN races r ON r.code = x.code WHERE x.rider_id != r.maker_id) AS challenges`)
  ]);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayOf(now - i * 864e5), sum = (rows, f = () => true) => rows.filter(r => r.d === d && f(r)).reduce((s, r) => s + r.n, 0);
    out.push({ day: d, new_riders: sum(riders), active_riders: sum(active), races: sum(rides), gp: sum(rides, r => r.mode === "gp"), story: sum(rides, r => r.mode === "story"), link_races: sum(rides, r => r.mode === "race"),
      made_words: sum(made, r => r.kind === "words"), made_gp: sum(made, r => r.kind === "gp"), made_story: sum(made, r => r.kind === "story"), made_redline: sum(made, r => r.kind === "redline"), redline: sum(rides, r => r.mode === "redline"), challenge_finishes: sum(finishes), arrived_by_link: sum(viaLink),
      ...Object.fromEntries(events.filter(e => e.d === d).map(e => [e.k, e.n])) });
  }
  return json({ totals: totals[0] || {}, days: out });
}
