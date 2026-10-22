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
    const {live,rows}=await fetchRows(league,period,o.limit||10);
    if(!rows.length){ o.body.innerHTML=`<tr><td colspan="5" class="note">No rides yet in this league. Be the first on the board.</td></tr>`; }
    else o.body.innerHTML=rows.map((r,i)=>`<tr class="${live&&me&&r.name===me?"me":""}"><td class="rk">${i+1}</td><td class="nm">${esc(r.name)}${live?"":' <span class="tag">Example</span>'}</td><td class="r sc">${r.score|0}</td><td class="r">${r.wpm|0}</td><td class="r">${r.acc|0}%</td></tr>`).join("");
    if(o.note) o.note.textContent = live ? "Score = words per minute × accuracy. Best ride per rider." : "These are example rows. The live board switches on when ReadRash launches on its own site.";
  }
  (o.tabs||[]).forEach(t=>t.addEventListener("click",()=>{ league=t.dataset.lg; o.tabs.forEach(x=>x.setAttribute("aria-selected",String(x===t))); render(); }));
  (o.periodTabs||[]).forEach(t=>t.addEventListener("click",()=>{ period=t.dataset.p; o.periodTabs.forEach(x=>x.setAttribute("aria-selected",String(x===t))); render(); }));
  render();
  return {render,setLeague:l=>{ league=l; (o.tabs||[]).forEach(x=>x.setAttribute("aria-selected",String(x.dataset.lg===l))); render(); }};
}
window.Board={mount,fetchRows,submit};
})();
