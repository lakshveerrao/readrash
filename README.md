# ReadRash — site

Static site + one Cloudflare Pages Function for the leaderboard.

```
index.html         home page (live demo ride in the hero)
play.html          the game: pick race → mic check → say GO → race → results
leaderboard.html   full board (league × today / week / all time)
assets/game.js     engine: road, sprites, voice, rivals, scoring
assets/board.js    leaderboard client
assets/site.css    shared styles
functions/api/scores.js   GET/POST /api/scores (D1)
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
