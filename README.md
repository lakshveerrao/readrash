# ReadRash — site

Static site + one Cloudflare Pages Function for the leaderboard.

```
index.html         home page (live demo ride in the hero)
play.html          story races: pick race → mic check → say GO → race → results
gp.html            Rash GP: 12-rider lap race, words on overhead signs, ghosts of real runs
leaderboard.html   full board (league × today / week / all time)
assets/game.js     engine: road, sprites, voice, rivals, scoring
assets/board.js    leaderboard client
assets/site.css    shared styles
functions/api/scores.js   GET/POST /api/scores (story race board)
functions/api/gp.js       GET/POST /api/gp (Rash GP board)
functions/api/ghosts.js   GET /api/ghosts (real runs to race against)
functions/api/me.js       POST /api/me (your rider: Rash Points, level, races you made)
functions/api/races/      POST make a race · GET /api/races/<code> · POST /api/races/<code>/runs
functions/r/[code].js     readrash.com/r/<code> → the race page
functions/_lib/           shared server code (Rash Points, levels) and the word list for made races
make.html, garage.html    Make a race · your Garage
schema.sql         database table
_headers           allows the microphone on this site
```

## Go live on Cloudflare (one time, ~15 minutes)

1. **Database:** Cloudflare dashboard → Storage & Databases → D1 → Create → name it `readrash`.
   Open it → Console → paste everything in `schema.sql` → Execute.
2. **Site:** Workers & Pages → Create → Pages → Connect to Git → pick the GitHub repo with this folder.
   Build command: *(leave empty)* · Output directory: `/`
3. **Connect the database:** your Pages project → Settings → Bindings → Add → D1 database →
   Variable name `DB` → database `readrash` → Save, then redeploy.
4. **Domain:** Pages project → Custom domains → add `readrash.com` (and `www`).

Voice needs HTTPS, which Cloudflare gives you automatically.

> Drag-and-drop upload works for the pages, but **not** for the leaderboard function — use the Git connection (or `npx wrangler pages deploy .`).

## Changing a passage
If you edit a race text in `assets/game.js`, update its word count in `WORDS` at the top of `functions/api/scores.js`, or posts for that race will be rejected.

## Database updates
`schema.sql` only uses `CREATE ... IF NOT EXISTS`, so it is safe to run again whenever it changes:

```
npx wrangler d1 execute readrash --remote --file=schema.sql
```
Rash GP needs the `gp_runs` table from this file. Rash Points and made races need `riders`, `rides`, `races` and `race_runs`.
If you change the unlock thresholds, change `LEVELS` in `functions/_lib/rr.js` and `LADDER` in `assets/game.js` together.
If you change GP speeds or lap length in `assets/game.js`, update the matching numbers at the top of `functions/api/gp.js`.

## Growth and sharing
- Every page has link-preview tags; preview images live in `assets/og/`. Race links (`/r/<code>`) return their own preview (who challenges you, the time to beat), then jump to the race.
- Any finished Rash GP race can become a challenge: `POST /api/races/gp` stores its seed, so friends get the same signs and traffic, with the rider's ghost.
- Results can be shared as a picture (made in the browser, nothing uploaded).
- Rematch: after racing anyone's link, `POST /api/races/<code>/rematch` makes a one-on-one race back to the maker (same signs or words, the rider's best run as ghost). The best-of-3 score lives in the race's `words` JSON (`series`). Open to every rider.
- Circuits: Konkan Coast, Rajasthan Desert (1,000 RP) and Western Ghats (2,000 RP). Palettes and roadside sets are in `CIRCUITS` in `assets/game.js`; the server's unlock points are `CIRCUIT_RP` in `functions/_lib/rr.js`. A challenge keeps its circuit.
- Story races (Level 5, 2,000 RP): riders write 30 to 150 words on the Make page (Story race tab). Each word is checked like made-race words (`checkPassage` in `functions/_lib/rr.js`); links open on `play.html?r=<code>`.
- Paint shop (Level 3, 450 RP) is in the Garage; the choice is kept on the device.
- `robots.txt` and `sitemap.xml` are in the root. Fonts are self-hosted in `assets/fonts/` (SIL Open Font License).

## Your stats page
`/stats.html` shows new riders, races, links made, links opened, shares and challenges finished, day by day.
It needs a secret key on the Pages project (pick any long password):
```
npx wrangler pages secret put STATS_KEY
```
Then open readrash.com/stats.html and type that key. For page views, switch on Web Analytics for the Pages project in the Cloudflare dashboard (free, no cookies).

## Fair play (watch-only)
Every finished race sends two numbers the server checks: how many words arrived while the speech service had heard no one speak, and how fast each Rash GP sign was answered after it opened. Only things a voice physically can't do are flagged (most words with no speech heard; most signs answered in under 0.12s). Fast, steady or perfect readers are never flagged.
Flags appear on /stats.html and change nothing for players or boards (`ENFORCE = false` in `functions/_lib/rr.js`). If a real reader is ever flagged, tap "Real reader" and loosen the rule before ever turning `ENFORCE` on.
