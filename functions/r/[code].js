// readrash.com/r/<code> → the race page with that made race loaded
export async function onRequestGet({ params, request }) {
  const c = String(params.code || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return Response.redirect(new URL(`/gp.html?r=${c}`, request.url).toString(), 302);
}
