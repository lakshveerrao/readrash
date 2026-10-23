/* ReadRash leaderboard client: reads /api/scores, falls back to clearly-labelled example rows when the API isn't live yet. */
(function(){
"use strict";
const EXAMPLE = {
  rookie:[["SpeedyMango21",92,96,98],["JollyCrab47",88,94,97],["BraveKite12",81,90,96],["LuckyLassi33",77,85,99],["ZippyGecko58",70,82,94],["SuperSamosa16",66,78,95],["FlyingTurtle90",61,74,93],["CleverComet44",58,70,94]],
  pro:[["TurboFalcon77",141,149,97],["NitroPeacock12",133,140,96],["CosmicCheetah05",126,135,95],["RapidJalebi64",118,124,97],["MightyMonsoon29",110,118,95],["GoldenKite83",104,111,96],["SwiftDolphin40",97,104,95],["HyperGecko18",90,98,94]],
  legend:[["FearlessCyclone11",182,188,98],["ThunderPanther56",171,180,96],["BlazingEagle23",163,171,97],["RocketTiger95",155,165,95],["SilverBolt37",148,156,96],["DaringWheelie62",139,148,95],["FunkyLion08",131,140,95],["JumboComet71",124,133,94]]
};
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
async function fetchRows(league,period,limit){
  try{
    const r=await fetch(`/api/scores?league=${encodeURIComponent(league)}&period=${encodeURIComponent(period)}&limit=${limit}`,{headers:{accept:"application/json"}});
    if(!r.ok) throw new Error("http "+r.status);
    const ct=r.headers.get("content-type")||""; if(!ct.includes("json")) throw new Error("not json");
    const j=await r.json(); return {live:true,rows:j.rows||[]};
  }catch(e){
    return {live:false,rows:EXAMPLE[league].slice(0,limit).map(([name,score,wpm,acc])=>({name,score,wpm,acc}))};
  }
}
async function submit(entry){
  const r=await fetch("/api/scores",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(entry)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||("http "+r.status));
  return j;
}
function mount(o){
  let league=o.league||"pro", period=o.period||"today";
  const me=(window.ReadRash&&window.ReadRash.Store.get("name",null))||null;
  async function render(){
    o.body.innerHTML=`<tr><td colspan="5" class="note">Loading…</td></tr>`;
    let {live,rows}=await fetchRows(league,period,o.limit||10), used=period;
    if(live&&!rows.length) for(const p of (period==="today"?["week","all"]:period==="week"?["all"]:[])){ const r=await fetchRows(league,p,o.limit||10); if(r.rows.length){ rows=r.rows; used=p; break; } }
    if(!rows.length){ o.body.innerHTML=`<tr><td colspan="5" class="note">No rides yet in this league. Finish a race and you're on top.</td></tr>`; }
    else o.body.innerHTML=rows.map((r,i)=>`<tr class="${live&&me&&r.name===me?"me":""}"><td class="rk">${i+1}</td><td class="nm">${esc(r.name)}${live?"":' <span class="tag">Example</span>'}</td><td class="r sc">${r.score|0}</td><td class="r">${r.wpm|0}</td><td class="r">${r.acc|0}%</td></tr>`).join("");
    if(o.note) o.note.textContent = live ? (used!==period?`Nobody has raced ${period==="today"?"today":"this week"} yet, so this shows ${used==="week"?"this week":"all time"}. `:"")+"Score = words per minute × accuracy. Every finished race posts itself; best ride per rider." : "These are example rows. The live board switches on when ReadRash launches on its own site.";
  }
  (o.tabs||[]).forEach(t=>t.addEventListener("click",()=>{ league=t.dataset.lg; o.tabs.forEach(x=>x.setAttribute("aria-selected",String(x===t))); render(); }));
  (o.periodTabs||[]).forEach(t=>t.addEventListener("click",()=>{ period=t.dataset.p; o.periodTabs.forEach(x=>x.setAttribute("aria-selected",String(x===t))); render(); }));
  render();
  return {render,setLeague:l=>{ league=l; (o.tabs||[]).forEach(x=>x.setAttribute("aria-selected",String(x.dataset.lg===l))); render(); }};
}
/* Rash GP board: fastest race time. If the chosen period is empty it widens (today → this week → all time) and says so. */
function mountGP(o){
  const st={lg:o.league||"pro",laps:o.laps||3,p:o.period||"today"}, me=(window.ReadRash&&window.ReadRash.Store.get("name",null))||null;
  const fmt=ms=>(ms/1000).toFixed(1)+"s", PN={today:"today",week:"this week",all:"yet"};
  const sel=(list,attr,v)=>(list||[]).forEach(t=>t.setAttribute("aria-selected",String(t.dataset[attr]===String(v))));
  async function get(p){ const r=await fetch(`/api/gp?league=${st.lg}&laps=${st.laps}&period=${p}&limit=${o.limit||20}`,{headers:{accept:"application/json"}}); const ct=r.headers.get("content-type")||""; if(!r.ok||!ct.includes("json")) throw 0; return (await r.json()).rows||[]; }
  async function render(){
    o.body.innerHTML=`<tr><td colspan="5" class="note">Loading…</td></tr>`;
    let rows=[], used=st.p;
    try{ rows=await get(st.p); if(!rows.length&&o.widen!==false){ for(const p of (st.p==="today"?["week","all"]:st.p==="week"?["all"]:[])){ rows=await get(p); if(rows.length){ used=p; break; } } } }
    catch(e){ o.body.innerHTML=`<tr><td colspan="5" class="note">${window.ReadRash&&window.ReadRash.IN_VIEWER?"The board is live on readrash.com.":"Couldn't load the board. Try again in a moment."}</td></tr>`; if(o.note) o.note.textContent=""; return; }
    const LG=(window.ReadRash&&window.ReadRash.LEAGUES[st.lg]||{}).name||st.lg;
    o.body.innerHTML=rows.length?rows.map((r,i)=>`<tr class="${me&&r.name===me?"me":""}"><td class="rk">${i+1}</td><td class="nm">${esc(r.name)}</td><td class="r sc">${fmt(r.total_ms)}</td><td class="r">${fmt(r.best_lap_ms)}</td><td class="r">${r.acc|0}%</td></tr>`).join("")
      :`<tr><td colspan="5" class="note">No ${LG} ${st.laps}-lap races ${o.widen===false?PN[st.p]:"yet"}. Finish one and you're on top.</td></tr>`;
    if(o.note) o.note.textContent = rows.length ? (used!==st.p?`Nobody has raced ${PN[st.p]} yet, so this shows ${used==="week"?"this week":"all time"}. `:"")+"Lower time is better. Every finished race posts itself; best race per rider counts." : "Every finished race posts itself.";
  }
  (o.lgTabs||[]).forEach(t=>t.addEventListener("click",()=>{ st.lg=t.dataset.lg; sel(o.lgTabs,"lg",st.lg); render(); }));
  (o.lapTabs||[]).forEach(t=>t.addEventListener("click",()=>{ st.laps=+t.dataset.l; sel(o.lapTabs,"l",st.laps); render(); }));
  (o.periodTabs||[]).forEach(t=>t.addEventListener("click",()=>{ st.p=t.dataset.p; sel(o.periodTabs,"p",st.p); render(); }));
  sel(o.lgTabs,"lg",st.lg); sel(o.lapTabs,"l",st.laps); sel(o.periodTabs,"p",st.p);
  render(); return {render};
}
window.Board={mount,mountGP,fetchRows,submit};
})();
