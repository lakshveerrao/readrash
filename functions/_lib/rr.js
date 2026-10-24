// Shared server helpers: riders (secret device key), Rash Points, levels, word checks.
import { DICT, BLOCK } from "./dict.js";
export const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const ADJ = ["Turbo","Rapid","Zippy","Mighty","Swift","Blazing","Cosmic","Thunder","Rocket","Nitro","Lucky","Brave","Jolly","Speedy","Golden","Silver","Super","Hyper","Flying","Daring","Clever","Funky","Jumbo","Fearless"];
export const NOUN = ["Mango","Tiger","Falcon","Cheetah","Coconut","Comet","Panther","Crab","Turtle","Monsoon","Pepper","Lassi","Samosa","Dolphin","Eagle","Bolt","Wheelie","Kite","Lion","Peacock","Jalebi","Cyclone","Gecko","Rider"];
export const NAME_RE = new RegExp(`^(${ADJ.join("|")})(${NOUN.join("|")})\\d{2}$`);
export const KEY_RE = /^[a-z2-7]{20,40}$/;
// keep in sync with LADDER in assets/game.js
export const LEVELS = [0, 150, 450, 1000, 2000, 3500, 5000, 8000];
export const levelOf = rp => { let l = 1; LEVELS.forEach((t, i) => { if (rp >= t) l = i + 1; }); return l; };
// what a level allows for made races
export const RACE_LIMITS = rp => ({ make: rp >= 150, words: rp >= 1000 ? 30 : 20, riders: rp >= 8000 ? 50 : rp >= 1000 ? 10 : 1, days: rp >= 5000 ? 30 : 7 });
const IST = 5.5 * 3600 * 1000;
export const dayOf = t => new Date(t + IST).toISOString().slice(0, 10);
export async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }

export async function getRider(env, key, name, create = true) {
  if (typeof key !== "string" || !KEY_RE.test(key)) return null;
  const h = await sha(key);
  let r = await env.DB.prepare(`SELECT * FROM riders WHERE key_hash = ?1`).bind(h).first();
  if (!r && create && typeof name === "string" && NAME_RE.test(name)) {
    await env.DB.prepare(`INSERT INTO riders (key_hash, name, created_at) VALUES (?1, ?2, ?3)`).bind(h, name, Date.now()).run();
    r = await env.DB.prepare(`SELECT * FROM riders WHERE key_hash = ?1`).bind(h).first();
  } else if (r && typeof name === "string" && NAME_RE.test(name) && name !== r.name) {
    await env.DB.prepare(`UPDATE riders SET name = ?1 WHERE id = ?2`).bind(name, r.id).run(); r.name = name;
  }
  return r;
}

// Rash Points for one finished race. rate < 1 for racing your own made race.
export async function award(env, rider, o) {
  const now = Date.now(), today = dayOf(now), yesterday = dayOf(now - 864e5);
  const parts = [];
  const add = (label, n) => { if (n > 0) parts.push([label, n]); };
  add("Words read right", Math.max(0, Math.min(400, o.correct | 0)));
  if (o.finished) add("Finished", 20);
  if (o.place >= 1 && o.place <= 3) add(o.place === 1 ? "1st place" : o.place === 2 ? "2nd place" : "3rd place", [0, 30, 20, 10][o.place]);
  if (o.clean) add("Clean race", 20);
  let streak = rider.streak || 0;
  if (rider.last_day !== today) {
    streak = rider.last_day === yesterday ? Math.min(7, streak + 1) : 1;
    add("First race today", 25); add(`Day streak ×${streak}`, 5 * streak);
  }
  const rate = o.rate || 1;
  let gained = Math.round(parts.reduce((s, p) => s + p[1], 0) * rate);
  if (rate !== 1) parts.push([`Your own race ×${rate}`, 0]);
  const before = rider.rp | 0, after = before + gained;
  await env.DB.prepare(`UPDATE riders SET rp = ?1, races = races + 1, streak = ?2, last_day = ?3 WHERE id = ?4`).bind(after, streak, today, rider.id).run();
  await env.DB.prepare(`INSERT INTO rides (rider_id, mode, league, laps, race_code, time_ms, correct, place, rp, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
    .bind(rider.id, o.mode, o.league || null, o.laps || null, o.code || null, o.timeMs || null, o.correct | 0, o.place || null, gained, now).run();
  rider.rp = after; rider.streak = streak; rider.last_day = today;
  return { gained, parts, rp: after, level: levelOf(after), levelBefore: levelOf(before), streak };
}

// a maker earns 10 RP whenever someone finishes their race, up to 100 a day
export async function makerBonus(env, makerId) {
  const today = dayOf(Date.now()), m = await env.DB.prepare(`SELECT * FROM riders WHERE id = ?1`).bind(makerId).first(); if (!m) return;
  const used = m.bonus_day === today ? m.bonus_rp : 0; if (used >= 100) return;
  await env.DB.prepare(`UPDATE riders SET rp = rp + 10, bonus_day = ?1, bonus_rp = ?2 WHERE id = ?3`).bind(today, used + 10, makerId).run();
}

let DSET = null, BSET = null;
export function checkWords(list) {
  if (!DSET) { DSET = new Set(DICT.split("\n")); BSET = new Set(BLOCK.split("\n")); }
  const bad = [], ok = [], seen = new Set();
  for (const raw of list) { const w = String(raw || "").trim().toLowerCase();
    if (!w) continue; if (seen.has(w)) continue; seen.add(w);
    if (!/^[a-z]{2,18}$/.test(w) || BSET.has(w) || !DSET.has(w)) bad.push(w); else ok.push(w); }
  return { ok, bad };
}
export function profile(r) {
  const lv = levelOf(r.rp), next = LEVELS[lv] ?? null;
  return { name: r.name, rp: r.rp, level: lv, next, prev: LEVELS[lv - 1], races: r.races, streak: r.streak, limits: RACE_LIMITS(r.rp) };
}

/* Fair play: only things a human voice physically cannot do. Watch-only (ENFORCE = false): flags are recorded for the
   owner to look at and never change anything for the player. Unusual is not proof: fast, steady, perfect readers pass. */
export const ENFORCE = false;
export function fairPlay(chk) {
  const reasons = [], d = {};
  if (!chk || typeof chk !== "object") return { reasons, d };
  const finals = chk.finals | 0, silent = chk.silent | 0;
  const gaps = Array.isArray(chk.gaps) ? chk.gaps.filter(Number.isFinite).slice(0, 80) : [];
  d.finals = finals; d.silent = silent; d.signs = gaps.length;
  // 1. words recognised while the speech service never heard anyone speak: only possible without a voice
  if (finals >= 8 && silent / finals >= 0.8) reasons.push(`${silent} of ${finals} words arrived with no speech heard`);
  // 2. faster than the speech service can answer: below 120 ms from the sign opening, on most signs
  const instant = gaps.filter(g => g < 120).length; d.instant = instant;
  if (gaps.length >= 10 && instant / gaps.length >= 0.7) reasons.push(`${instant} of ${gaps.length} signs answered faster than speech recognition can work`);
  return { reasons, d };
}
export async function noteFairPlay(env, rider, mode, ref, chk) {
  try {
    if (chk && chk.auto) return; // demo races are driven by the computer on purpose
    const { reasons, d } = fairPlay(chk); if (!reasons.length) return;
    await env.DB.prepare(`INSERT INTO flags (rider_id, name, mode, ref, reasons, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(rider ? rider.id : null, rider ? rider.name : null, mode, ref || null, JSON.stringify(reasons), JSON.stringify(d), Date.now()).run();
  } catch (e) {}
}
