// readrash.com/r/<code>: a page link previews can read (WhatsApp, iMessage, X…), then straight on to the race.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LG = { rookie: "Rookie", pro: "Pro", legend: "Legend" };
export async function onRequestGet({ params, request, env }) {
  const c = String(params.code || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const origin = new URL(request.url).origin, to = `/gp.html?r=${c}`;
  let title = "You've been challenged on ReadRash", desc = "Race my ghost: read the signs out loud to ride. Free, no signup.";
  try {
    const r = await env.DB.prepare(`SELECT maker_name, words, league, laps, maker_ms, reports, expires_at FROM races WHERE code = ?1`).bind(c).first();
    if (r && r.reports < 3 && Date.now() < r.expires_at) {
      const w = JSON.parse(r.words), t = r.maker_ms ? (r.maker_ms / 1000).toFixed(1) + "s" : null;
      title = `${r.maker_name} challenges you on ReadRash`;
      desc = Array.isArray(w)
        ? `${w.length} words, ${r.laps} laps.${t ? ` Beat ${t}.` : ""} Read them out loud to ride. Free, no signup.`
        : `Rash GP · ${LG[r.league]} · ${r.laps} laps.${t ? ` Beat ${t} on the same signs.` : ""} Free, no signup.`;
    }
  } catch (e) {}
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:site_name" content="ReadRash">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${origin}/r/${c}"><meta property="og:image" content="${origin}/assets/og/og-challenge.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#121016">
<meta http-equiv="refresh" content="0;url=${to}">
<script>location.replace(${JSON.stringify(to)})</script>
<style>body{margin:0;background:#121016;color:#fff4e2;font:18px Verdana,sans-serif;display:grid;place-items:center;height:100vh}a{color:#ffd23f}</style>
</head><body><p><a href="${to}">Tap to race →</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}
