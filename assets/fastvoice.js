/* Fast voice (beta): speech recognition that runs inside the page (Vosk, Apache-2.0) instead of Chrome's speech service.
   No network round trip and no session restarts, so words land in about a fifth of a second, and it works in any
   modern browser, iPhone included. It listens only for the words of the current race (plus a "something else" slot),
   which makes it quick and accurate. One-time download of about 41 MB, kept in the browser's cache afterwards.
   It feeds the game exactly like Chrome's recogniser does: live (partial) text that grows, then a final at a pause. */
(() => {
const RR = window.ReadRash, Voice = RR.Voice;
const BASE = "assets/voice/", PARTS = ["en-small-v1.part0", "en-small-v1.part1"], CACHE = "rr-fastvoice-v1";
const COMMANDS = ["let's go", "lets go", "go", "ready", "start", "race", "ride"];
// everyday words the recogniser can choose instead, so a word read wrongly isn't pulled onto the word on screen
const OTHER = "the a an and of to in is it you that he she was for on are with as i his they be at one have this from or had by but some what there we can out other were all your when up use word how said each which do their time if will way about many then them would write like so these her long make thing see him two has look more day could come did my sound no most number who over know water than call first people may down side been now find any new work part take get place made live where after back little only round man year came show every good me give our under name very through just form much great think say help low line before turn cause same mean differ move right boy old too does tell set three want air well also play small end put home read hand port large spell add even land here must big high such follow act why ask men change went light kind off need house picture try us again animal point mother world near build self earth father head stand own page should country found answer school grow study still learn plant cover food sun four thought let keep eye never last door between city tree cross since hard start might story saw far sea draw left late run don't while press close night real life few stop open seem together next white children begin got walk example ease paper often always music those both mark book letter until mile river car feet care second group carry took rain eat room friend began idea fish mountain north once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song measure state product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass farm top whole king size heard best hour better true during hundred am remember step early hold west ground interest reach fast five sing listen six seven eight nine zero table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map science rule govern pull cold notice voice fall power town fine certain fly unit lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop sleep warm free minute strong special mind behind clear tail produce fact street inch lot nothing course stay wheel full force blue object decide surface deep moon island foot yet busy test record boat common gold possible plane age dry wonder laugh thousand ago ran check game shape yes hot miss brought heat snow bed bring sit perhaps fill east weight language among".split(" ");
let model = null, loading = null, vocab = null, rec = null, grammarKey = "", phrases = [], oov = new Set();
let stream = null, ac = null, node = null, src = null, results = [], cur = 0, handler = null, wantOn = false, gain = null;

const absolute = p => new URL(p, location.href).href;
async function cached(url, onBytes){
  let cache = null; try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) { const b = await hit.arrayBuffer(); onBytes(b.byteLength); return b; } } catch (e) {}
  const r = await fetch(url); if (!r.ok) throw new Error("download failed");
  const reader = r.body.getReader(), chunks = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; onBytes(value.length); }
  const b = await new Blob(chunks).arrayBuffer();
  try { if (cache) await cache.put(url, new Response(b)); } catch (e) {}
  return b;
}
function loadScript(src){ return new Promise((ok, no) => { if (window.Vosk) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }

/* download (or read from cache) and start the model; progress goes to Voice.onLoad(0..1) */
function load(){
  if (loading) return loading;
  loading = (async () => {
    const TOTAL = 41184862 + 1307236; let got = 0; const tick = n => { got += n; Voice.onLoad && Voice.onLoad(Math.min(.99, got / TOTAL)); };
    await loadScript(BASE + "vosk-0.0.8.js");
    const [a, b, v] = await Promise.all([cached(absolute(BASE + PARTS[0]), tick), cached(absolute(BASE + PARTS[1]), tick), cached(absolute(BASE + "vocab-v1.txt"), tick)]);
    vocab = new Set(new TextDecoder().decode(v).split("\n"));
    const url = URL.createObjectURL(new Blob([a, b], { type: "application/gzip" }));
    model = await window.Vosk.createModel(url, -1);
    Voice.onLoad && Voice.onLoad(1);
    return model;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/* the words the recogniser listens for: every word of this race that it knows, a few start words, and [unk] */
function grammarFor(list){
  const known = new Set(COMMANDS), miss = new Set();
  for (const raw of list) { const w = String(raw).toLowerCase().replace(/[^a-z' -]/g, "").trim(); if (!w) continue;
    for (const part of w.split(/[\s-]+/)) { if (!part) continue; const p = part.replace(/^'+|'+$/g, ""); if (vocab && vocab.has(p)) known.add(p); else miss.add(p.replace(/'/g, "")); } }
  oov = miss; const extra = OTHER.filter(w => !known.has(w) && vocab && vocab.has(w)); return JSON.stringify([...known, ...extra, "[unk]"]);
}
function newRecognizer(){
  if (!model || !ac) return;
  const g = grammarFor(phrases.length ? phrases : COMMANDS);
  if (rec && g === grammarKey) return; grammarKey = g;
  if (rec) { try { rec.remove(); } catch (e) {} }
  results = []; cur = 0; handler && handler({ reset: true });
  rec = new model.KaldiRecognizer(ac.sampleRate, g);
  rec.on("partialresult", m => { const t = (m.result.partial || "").trim(); if (!t) return; Voice.heard = true; Voice.speechAt = performance.now(); emit(t, false); });
  rec.on("result", m => { const t = (m.result.text || "").trim(); if (!t) return; Voice.finals++; emit(t, true); cur++; });
}
// the game reads Chrome-style events; [unk] stands in for a race word the recogniser doesn't know (some place names)
function emit(text, final){
  const shown = text.replace(/\[unk\]/g, "…");
  const res = [{ transcript: text.replace(/\[unk\]/g, "unk") }]; res.isFinal = final; results[cur] = res;
  if (handler) handler({ resultIndex: cur, results, fast: true, shown });
}
async function startMic(){
  if (stream) return;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
  catch (e) { Voice._set(e && (e.name === "NotFoundError" || e.name === "OverconstrainedError") ? "nomic" : "blocked"); throw e; }
  ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") await ac.resume();
  src = ac.createMediaStreamSource(stream);
  node = ac.createScriptProcessor(2048, 1, 1); gain = ac.createGain(); gain.gain.value = 0;   // ~43 ms chunks; the node must reach the output to run, silently
  node.onaudioprocess = e => { if (rec && wantOn) { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} } };
  src.connect(node); node.connect(gain); gain.connect(ac.destination);
  stream.getAudioTracks().forEach(t => t.onended = () => { stream = null; if (wantOn) Voice._set("nomic"); });
}
const Fast = {
  oov: () => oov,
  async start(h){ handler = h; wantOn = true; Voice.want = true; Voice._set("starting");
    try { await load(); await startMic(); newRecognizer(); if (!wantOn) return; Voice.live = true; Voice._set("listening"); handler && handler({ reset: true }); }
    catch (e) { if (Voice.status === "starting") Voice._set("offline"); } },
  use(h){ handler = h; if (rec) { results = []; cur = 0; } h && h({ reset: true }); },
  stop(){ wantOn = false; Voice.want = false; Voice.live = false; try { rec && rec.retrieveFinalResult(); } catch (e) {} Voice._set("off"); },
  restart(){ this.stop(); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } try { ac && ac.close(); } catch (e) {} ac = null; rec = null; grammarKey = ""; this.start(handler); },
  setPhrases(list){ phrases = list || []; if (model && ac) newRecognizer(); },
  load
};
window.RRFast = Fast;
})();
