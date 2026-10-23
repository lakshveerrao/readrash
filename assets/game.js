/* ReadRash engine — voice-powered pseudo-3D bike racing. One file, no dependencies. */
(function(){
"use strict";

/* ================= shared data ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IN_VIEWER = !!(window.claude && typeof window.claude.use === "function");
const VOICE_OK = !!SR && !IN_VIEWER;

const LEAGUES = {
  rookie: { name:"Rookie", paces:[34,42,50],  demo:70,  blurb:"Short words, friendly rivals" },
  pro:    { name:"Pro",    paces:[60,72,84],  demo:106, blurb:"Longer lines, faster riders" },
  legend: { name:"Legend", paces:[90,104,118],demo:140, blurb:"Big words, no mercy" }
};

const RACES = [
  { t:"Harbour Run", bridge:false,
    rookie:"The sun is up. The sea is blue. A small boat goes out to fish. The man in the boat waves at me. I wave back and ride on.",
    pro:"Every morning, the fishing boats leave the harbour before sunrise. By noon they return with silver fish, and the whole beach becomes a busy market full of shouting sellers and hungry seagulls.",
    legend:"The Konkan coastline stretches for hundreds of kilometres, where rocky cliffs give way to quiet beaches and ancient forts guard the harbours. Centuries ago, powerful navies sailed these waters, defending the coast against ships from distant kingdoms." },
  { t:"Backwater Bend", bridge:true,
    rookie:"I see a big crab on the sand. It runs to the side. Click, click go its claws. It hides in a hole and I laugh.",
    pro:"Our grandmother lives in a small house with a red tiled roof near the backwaters. When the tide comes in, the water rises right up to her garden, and tiny fish swim between the coconut trees.",
    legend:"Mangrove forests grow where rivers meet the sea, their tangled roots rising from the water like the legs of enormous spiders. These forests protect the shore from storms and shelter countless crabs, fish, and migrating birds." },
  { t:"Ferry Crossing", bridge:true,
    rookie:"We ride onto the big ferry. A goat stands next to me. The ferry goes slow on the river. The goat eats my map! I just laugh.",
    pro:"The ferry across the river only leaves when it is completely full. People squeeze in with bicycles, baskets of vegetables, and sometimes even a goat that refuses to stand still.",
    legend:"Engineers who built the railway along this coast faced extraordinary challenges, digging dozens of tunnels through solid rock and constructing towering bridges across deep valleys. Today, trains glide past waterfalls and rivers that once seemed impossible to cross." },
  { t:"Monsoon Ghat", bridge:false,
    rookie:"The rain comes fast. Drip, drop, splash! The road is wet and the palm trees dance. I put on my coat and ride home.",
    pro:"During the monsoon, the hills turn bright green and waterfalls appear everywhere. Riders slow down on the slippery roads, but nobody can resist stopping for hot tea and spicy bhajis.",
    legend:"When the monsoon arrives, dark clouds roll in from the Arabian Sea and the first heavy raindrops strike the dusty ground. Within weeks, rivers swell, paddy fields shimmer with water, and the entire landscape explodes with life." },
  { t:"Turtle Beach", bridge:true,
    rookie:"A baby turtle comes out of the sand. It is so small. It walks to the sea, step by step. A big wave comes and the turtle swims away.",
    pro:"Rohan found an old map inside a bottle that washed up on the beach. It showed a lighthouse, three palm trees, and a large red cross marked beside a rock shaped like a turtle.",
    legend:"Olive ridley turtles return to certain beaches every winter, crawling ashore at night to bury their eggs in the warm sand. Weeks later, thousands of hatchlings scramble toward the waves, guided only by the shimmer of moonlight on the water." }
];

const ADJ = ["Turbo","Rapid","Zippy","Mighty","Swift","Blazing","Cosmic","Thunder","Rocket","Nitro","Lucky","Brave","Jolly","Speedy","Golden","Silver","Super","Hyper","Flying","Daring","Clever","Funky","Jumbo","Fearless"];
const NOUN = ["Mango","Tiger","Falcon","Cheetah","Coconut","Comet","Panther","Crab","Turtle","Monsoon","Pepper","Lassi","Samosa","Dolphin","Eagle","Bolt","Wheelie","Kite","Lion","Peacock","Jalebi","Cyclone","Gecko","Rider"];
function randomName(){ const r=a=>a[Math.floor(Math.random()*a.length)]; return r(ADJ)+r(NOUN)+String(10+Math.floor(Math.random()*90)); }

const RIVALS = [
  {name:"ZIPPY",jacket:"#2f9bf0",helmet:"#0d4f96",paint:"#ffd23f",lane:-.66},
  {name:"TARA", jacket:"#ff4f9a",helmet:"#fff4e2",paint:"#7a2cbf",lane:.66},
  {name:"BABLU",jacket:"#36b862",helmet:"#1b1b22",paint:"#e0392b",lane:-.66}];
const ME = {jacket:"#ff6a1a",helmet:"#ffd23f",paint:"#1b1b22",accent:"#ff6a1a",num:7};

const TH = { // Konkan Coast, bright morning
  sky:["#3d9be0","#9fd6f4","#e6f6fa"], fog:"#d6eef2", sun:"#fffbe6",
  ridge:["#a7c7cf","#7fa98b","#5d8f5a"],
  grass:["#86b84a","#7cad44"], shoulder:"#b5603e", sand:["#ecd9a8","#e6d19c"], sea:["#2a8dbd","#2f97c6"], foam:"#f4fbfb",
  road:["#5a5962","#56555e"], rumble:["#fff6e8","#d7402f"], lane:"#f7f2e6", deck:["#8d8a86","#878480"]
};

/* ================= matching ================= */
const ONES=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function n2w(n){ if(n<20) return ONES[n]; if(n<100) return TENS[Math.floor(n/10)]+(n%10?ONES[n%10]:""); if(n<1000) return ONES[Math.floor(n/100)]+"hundred"+(n%100?n2w(n%100):""); return String(n); }
const HOMO=[["their","there","theyre"],["to","two","too"],["for","four","fore"],["sun","son"],["see","sea"],["by","buy","bye"],["no","know"],["right","write"],["hear","here"],["ate","eight"],["one","won"],["blue","blew"],["new","knew"],["road","rode"],["tail","tale"],["sail","sale"],["whole","hole"],["night","knight"],["red","read"],["meet","meat"],["week","weak"],["grey","gray"],["ok","okay"],["harbour","harbor"],["kilometres","kilometers"],["claws","clause"],["tide","tied"],["waves","waives"],["ferry","fairy"],["bhajis","bhaji","bhajji","bajji","bhajjis","bajjis"],["olive","olives"],["ridley","ridleys","riddle"]];
const FILLER=new Set(["um","uh","umm","erm","hmm","ah","er","uhh","mm"]);
const norm=s=>{ s=String(s).toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]/g,""); return /^\d+$/.test(s)?n2w(+s):s; };
function lev(a,b){ const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let p=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
const homo=(a,b)=>HOMO.some(g=>g.includes(a)&&g.includes(b));
function sim(h,w){ if(h===w||homo(h,w)) return 1; return 1-lev(h,w)/Math.max(h.length,w.length); }
const OK=.7, UNCLEAR=.4;
function isMatch(h,w){ if(sim(h,w)>=OK) return true; return w.length<=4&&h[0]===w[0]&&lev(h,w)<=1&&h.length>1; }

/* ================= voice (one recogniser for the whole page) ================= */
const Voice = {
  ok: VOICE_OK, rec:null, handler:null, want:false, onDenied:null, onState:null, live:false,
  _setup(){
    if(this.rec) return;
    const r=new SR(); r.lang="en-IN"; r.continuous=true; r.interimResults=true; r.maxAlternatives=1;
    r.onstart=()=>{ this.live=true; this.onState&&this.onState(true); this.handler&&this.handler({reset:true}); };
    r.onend=()=>{ this.live=false; this.onState&&this.onState(false); if(this.want){ try{ r.start(); }catch(e){} } };
    r.onerror=e=>{ if(["not-allowed","service-not-allowed","audio-capture"].includes(e.error)){ this.want=false; this.onDenied&&this.onDenied(e.error); } };
    r.onresult=e=>{ this.handler&&this.handler(e); };
    this.rec=r;
  },
  start(handler){ if(!this.ok) return; this._setup(); this.handler=handler; this.want=true; if(!this.live){ try{ this.rec.start(); }catch(e){} } else handler({reset:true}); },
  use(handler){ this.handler=handler; if(this.live&&handler) handler({reset:true}); },
  stop(){ this.want=false; if(this.rec){ try{ this.rec.stop(); }catch(e){} } }
};

/* ================= sound ================= */
const Sound = { ac:null, on:true, eng:null,
  wake(){ if(!this.ac){ try{ this.ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(this.ac&&this.ac.state==="suspended") this.ac.resume(); },
  tone(f,dur,type="square",vol=.07,slide=0){ const ac=this.ac; if(!this.on||!ac) return; const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t+dur+.02); },
  noise(dur,vol=.25){ const ac=this.ac; if(!this.on||!ac) return; const len=Math.floor(ac.sampleRate*dur),b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2); const s=ac.createBufferSource(),g=ac.createGain(); g.gain.value=vol; s.buffer=b; s.connect(g).connect(ac.destination); s.start(); },
  engineOn(){ const ac=this.ac; if(!ac||this.eng) return; const o=ac.createOscillator(),o2=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();
    o.type="sawtooth"; o2.type="square"; o.frequency.value=45; o2.frequency.value=22; f.type="lowpass"; f.frequency.value=420; g.gain.value=this.on?.02:0;
    o.connect(f); o2.connect(f); f.connect(g).connect(ac.destination); o.start(); o2.start(); this.eng={o,o2,g}; },
  engineOff(){ if(this.eng){ try{ this.eng.o.stop(); this.eng.o2.stop(); }catch(e){} this.eng=null; } },
  setOn(v){ this.on=v; if(this.eng) this.eng.g.gain.value=v?.02:0; }
};

/* ================= sprite cache (painted once, drawn as images) ================= */
const CACHE={};
function mk(w,h){ const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }
function shade(hex,amt){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255;
  const f=amt<0?0:255, t=Math.abs(amt); r=Math.round(r+(f-r)*t); g=Math.round(g+(f-g)*t); b=Math.round(b+(f-b)*t); return "#"+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
function rr(g,x,y,w,h,r){ g.beginPath(); if(g.roundRect&&r) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h); }
function sprite(key,aspect,size,paint){
  if(CACHE[key]) return CACHE[key];
  const h=size, w=Math.round(h*aspect), c=mk(w,h), g=c.getContext("2d");
  g.translate(w/2,h); paint(g,h/100,w,h);
  return CACHE[key]={c,aspect};
}
function tools(g,u){
  return {
    P:(pts,col)=>{g.fillStyle=col;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x*u,y*u):g.moveTo(x*u,y*u));g.closePath();g.fill();},
    R:(x,y,w,h,col,r=0)=>{g.fillStyle=col;rr(g,x*u,y*u,w*u,h*u,r*u);g.fill();},
    E:(x,y,rx,ry,col)=>{g.fillStyle=col;g.beginPath();g.ellipse(x*u,y*u,Math.max(.5,rx*u),Math.max(.5,ry*u),0,0,7);g.fill();},
    L:(pts,col,wd)=>{g.strokeStyle=col;g.lineWidth=wd*u;g.lineCap="round";g.lineJoin="round";g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x*u,y*u):g.moveTo(x*u,y*u));g.stroke();},
    T:(txt,x,y,sz,col,font="'Racing Sans One','Arial Black',sans-serif")=>{g.fillStyle=col;g.font=`${sz*u}px ${font}`;g.textAlign="center";g.textBaseline="middle";g.fillText(txt,x*u,y*u);}
  };
}
// sport bike and rider are separate sprites so a crash can throw the rider off the bike. Same frame: origin at the rear tyre's contact point, 130 units tall
// Sport bike seen from behind and a rider in a racing tuck. Separate sprites (crashes throw the rider off), one frame:
// origin at the rear tyre's contact patch, 130 units tall, everything kept inside it.
function bikeOnly(o){
  return sprite("bk3"+o.paint+(o.accent||""),1.05,300,(g,u0)=>{
    const u=u0*100/130, {P,R,E,L}=tools(g,u), paint=o.paint, acc=o.accent||"#fff4e2";
    // swingarm arms and the chain run (behind the tyre)
    P([[-15,-26],[-11,-26],[-15,-42],[-19,-42]],"#2a2a31"); P([[15,-26],[11,-26],[15,-42],[19,-42]],"#33333b");
    // fat rear tyre (rounded profile), contact patch flat on the road
    const tg=g.createLinearGradient(-16*u,0,16*u,0); tg.addColorStop(0,"#040405"); tg.addColorStop(.3,"#25252b"); tg.addColorStop(.55,"#3b3b43"); tg.addColorStop(.8,"#1c1c21"); tg.addColorStop(1,"#040405");
    g.fillStyle=tg; rr(g,-14.5*u,-42*u,29*u,42*u,12*u); g.fill();
    g.fillStyle="rgba(255,255,255,.07)"; rr(g,-6*u,-40*u,4*u,38*u,2*u); g.fill();
    // hugger
    P([[-17,-38],[17,-38],[14,-46],[-14,-46]],shade(paint,-.55));
    // underslung exhaust can, angled up on the right
    g.save(); g.translate(17*u,-44*u); g.rotate(-.45); g.scale(.72,.72);
    const eg=g.createLinearGradient(0,-6*u,0,6*u); eg.addColorStop(0,"#6b717a"); eg.addColorStop(.45,"#f4f6f9"); eg.addColorStop(1,"#4d525a");
    g.fillStyle=eg; rr(g,-4*u,-6*u,26*u,12*u,5*u); g.fill(); g.fillStyle="#141418"; g.beginPath(); g.ellipse(22*u,0,3*u,5.5*u,0,0,7); g.fill(); g.restore();
    // number-plate hanger with indicators
    R(-2,-60,4,12,"#1b1b22"); R(-10,-52,20,7,"#ffd23f",1); g.fillStyle="#1b1b22"; g.font=`bold ${3.4*u}px Verdana`; g.textAlign="center"; g.textBaseline="middle"; g.fillText("MH 07",0,-48.4*u);
    L([[-9,-55],[-17,-56]],"#1b1b22",1.6); L([[9,-55],[17,-56]],"#1b1b22",1.6); E(-18,-56,2.8,2,"#ffb000"); E(18,-56,2.8,2,"#ffb000");
    // side fairings either side of the rider's knees
    P([[-34,-60],[-22,-60],[-19,-90],[-28,-92]],shade(paint,-.35)); P([[22,-60],[34,-60],[28,-92],[19,-90]],shade(paint,.12));
    P([[-34,-66],[-30,-66],[-26,-86],[-29,-86]],acc);
    // high, narrow tail with the LED light underneath
    P([[-15,-60],[15,-60],[11,-76],[-11,-76]],paint); P([[-15,-60],[-9,-60],[-7,-76],[-11,-76]],shade(paint,-.3)); P([[10,-60],[15,-60],[11,-76],[8,-76]],shade(paint,.3));
    P([[-3,-60],[3,-60],[2,-76],[-2,-76]],acc);
    g.save(); g.shadowColor="#ff2020"; g.shadowBlur=9*u; R(-10,-63,20,3.6,"#ff3030",2); g.restore(); R(-7,-62.4,14,1.2,"#ffc0b0",1);
    // wing mirrors on the fairing and a sliver of screen
    E(-37,-96,6,3.2,"#1b1b22"); E(37,-96,6,3.2,"#1b1b22"); E(-38,-97,2.6,1,"rgba(255,255,255,.55)"); E(36,-97,2.6,1,"rgba(255,255,255,.55)");
    L([[-30,-93],[-34,-95]],"#1b1b22",1.8); L([[30,-93],[34,-95]],"#1b1b22",1.8);
    g.fillStyle="rgba(40,60,80,.55)"; g.beginPath(); g.ellipse(0,-100*u,20*u,7*u,0,Math.PI,0); g.fill();
  });
}
function riderOnly(o,look=0){
  return sprite("rd3"+o.jacket+o.helmet+(o.num||"")+look,1.05,300,(g,u0)=>{
    const u=u0*100/130, {P,R,E}=tools(g,u), jk=o.jacket, leg="#1d2436";
    // boots on high rear-sets: we see heels and soles
    R(-31,-58,10,11,"#0c0c0f",3); R(21,-58,10,11,"#0c0c0f",3); R(-31,-49,10,2.4,"#3a3a42",1); R(21,-49,10,2.4,"#3a3a42",1);
    // shins rise forward to knees tucked against the tank
    P([[-29,-57],[-22,-57],[-24,-74],[-31,-73]],leg); P([[22,-57],[29,-57],[31,-73],[24,-74]],shade(leg,-.2));
    E(-29,-71,3.4,3,"#e8e4dc"); E(29,-71,3.4,3,"#e8e4dc");
    // thighs back to the hips (foreshortened), seat of the leathers on the tail
    P([[-30,-76],[-14,-74],[-16,-82],[-28,-82]],shade(leg,.1)); P([[30,-76],[14,-74],[16,-82],[28,-82]],shade(leg,-.12));
    g.fillStyle=shade(leg,-.05); g.beginPath(); g.ellipse(0,-79*u,17*u,7*u,0,0,7); g.fill();
    R(-16,-80,4,7,jk); R(12,-80,4,7,jk);
    // leaned-forward back: short and wide from behind
    const jg=g.createLinearGradient(-26*u,0,26*u,0); jg.addColorStop(0,shade(jk,-.4)); jg.addColorStop(.3,jk); jg.addColorStop(.62,shade(jk,.16)); jg.addColorStop(1,shade(jk,-.45));
    g.fillStyle=jg; g.beginPath(); g.moveTo(-17*u,-82*u); g.lineTo(17*u,-82*u); g.quadraticCurveTo(26*u,-90*u,25*u,-99*u); g.quadraticCurveTo(14*u,-104*u,0,-104*u); g.quadraticCurveTo(-14*u,-104*u,-25*u,-99*u); g.quadraticCurveTo(-26*u,-90*u,-17*u,-82*u); g.closePath(); g.fill();
    g.strokeStyle="rgba(0,0,0,.55)"; g.lineWidth=1.1*u; g.stroke();
    R(-17,-85,34,2.4,shade(jk,-.45));
    // helmet tucked low between the shoulders: lower half hidden behind the back hump
    const hy=-105-Math.abs(look)*2, hx=look*4;
    g.save(); g.translate(hx*u,0);
    const hg=g.createRadialGradient(-5*u,(hy-7)*u,2*u,0,hy*u,15*u); hg.addColorStop(0,shade(o.helmet,.5)); hg.addColorStop(.55,o.helmet); hg.addColorStop(1,shade(o.helmet,-.5));
    g.fillStyle=hg; g.beginPath(); g.ellipse(0,hy*u,13*u,12*u,0,0,7); g.fill(); g.strokeStyle="#111"; g.lineWidth=1.2*u; g.stroke();
    g.save(); g.beginPath(); g.ellipse(0,hy*u,13*u,12*u,0,0,7); g.clip(); R(-2.6-look*3,hy-14,5.2,28,o.jacket===o.helmet?"#fff":jk);
    if(look){ const vg=g.createLinearGradient(look*4*u,0,look*14*u,0); vg.addColorStop(0,"#1a2230"); vg.addColorStop(1,"#3d6a8c"); g.fillStyle=vg; g.beginPath(); g.ellipse(look*12*u,(hy+1)*u,6*u,6.5*u,0,0,7); g.fill(); g.fillStyle="rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(look*12.5*u,(hy-2)*u,1.6*u,3*u,0,0,7); g.fill(); }
    g.restore();
    P([[-5,hy-10],[5,hy-10],[3,hy-14],[-3,hy-14]],shade(o.helmet,-.35));
    g.strokeStyle="rgba(255,255,255,.65)"; g.lineWidth=1.7*u; g.beginPath(); g.ellipse(0,hy*u,9.5*u,8.5*u,0,Math.PI*1.12,Math.PI*1.45); g.stroke();
    g.restore();
    // back protector hump in front of the helmet's lower half, shoulders, number
    g.fillStyle=shade(jk,-.14); g.beginPath(); g.ellipse(0,-94*u,13*u,10*u,0,0,7); g.fill();
    g.fillStyle="rgba(255,255,255,.12)"; g.beginPath(); g.ellipse(-4*u,-97*u,4.5*u,4*u,-.2,0,7); g.fill();
    E(-21,-98,7.5,5.5,shade(jk,.22)); E(21,-98,7.5,5.5,shade(jk,-.12));
    R(-7.5,-94,15,10,"#fff4e2",3); g.fillStyle="#1b1b22"; g.font=`bold ${7.5*u}px 'Racing Sans One','Arial Black',sans-serif`; g.textAlign="center"; g.textBaseline="middle"; g.fillText(String(o.num||"7"),0,-88.6*u);
  });
}
function drawWeapon(c,type,u){ // drawn in hand space: hand at 0,0, weapon points along +x
  if(type==="book"){ c.fillStyle="#1d2f5a"; rr(c,-4*u,-11*u,26*u,22*u,2*u); c.fill(); c.fillStyle="#f3ead6"; c.fillRect(20*u,-9*u,3*u,18*u); c.fillStyle="#d9a520"; c.fillRect(2*u,-11*u,3*u,22*u); c.fillRect(8*u,-3*u,9*u,2.5*u); }
  else if(type==="coconut"){ c.fillStyle="#6b4423"; c.beginPath(); c.arc(6*u,0,8.5*u,0,7); c.fill(); c.strokeStyle="#4a2e16"; c.lineWidth=1.2*u; for(let i=0;i<5;i++){ c.beginPath(); c.moveTo(1*u,(-6+i*3)*u); c.lineTo(11*u,(-5+i*3)*u); c.stroke(); } }
  else { c.fillStyle="#f2ede2"; rr(c,-2*u,-4.5*u,36*u,9*u,3*u); c.fill(); c.fillStyle="#a8a2b0"; for(let i=1;i<5;i++) c.fillRect((2+i*6)*u,-4.5*u,1.4*u,9*u); c.fillStyle="#e0392b"; c.fillRect(27*u,-4.5*u,5*u,9*u); }
}
const PAINT={
  palm:[.9,260,(g,u)=>{ const {E}=tools(g,u); g.strokeStyle="#7a5532"; g.lineWidth=5*u; g.lineCap="round"; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(10*u,-50*u,3*u,-88*u); g.stroke();
    g.strokeStyle="#5e4026"; g.lineWidth=1.2*u; for(let i=1;i<9;i++){ const t=i/9, x=2*(1-t)*t*10+t*t*3, y=-88*t; g.beginPath(); g.moveTo((x-2.6)*u,y*u); g.lineTo((x+2.6)*u,(y-1)*u); g.stroke(); }
    const leaf=(a,len,col)=>{ g.save(); g.translate(3*u,-88*u); g.rotate(a); g.fillStyle=col; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(len*.45*u,-12*u,len*u,6*u); g.quadraticCurveTo(len*.5*u,-3*u,0,2*u); g.fill(); g.restore(); };
    [-2.9,-2.3,-1.7,-.9,-.3,.4].forEach((a,i)=>leaf(a,38,i%2?"#2f6b2f":"#3f8a3a")); [-2.6,-1.3,0].forEach(a=>leaf(a,30,"#4d9f45"));
    E(1,-86,3,3,"#6b4a22"); E(6,-85,3,3,"#5c3f1c"); }],
  palm2:[.8,260,(g,u)=>{ g.scale(-1,1); PAINT.palm[2](g,u); }],
  mango:[1.25,200,(g,u)=>{ const {E,R}=tools(g,u); R(-5,-40,10,40,"#6b4a2e"); E(0,-62,50,30,"#2a5f2a"); E(-24,-72,28,22,"#336f30"); E(22,-74,30,22,"#336f30"); E(0,-86,30,16,"#3f8238");
    [[-30,-58],[-12,-50],[14,-56],[30,-64],[-4,-70],[20,-80],[-22,-80]].forEach(([x,y])=>E(x,y,3.4,4.2,"#f6b81f")); }],
  house:[1.55,170,(g,u)=>{ const {R,P,E}=tools(g,u); E(0,0,72,5,"rgba(0,0,0,.18)");
    R(-62,-10,124,10,"#a8553a"); R(-58,-56,116,48,"#f3e6c9"); R(-58,-56,116,6,"rgba(0,0,0,.06)");
    P([[-72,-54],[72,-54],[46,-92],[-46,-92]],"#b8432b"); for(let i=0;i<9;i++){ const y=-56-i*4.2; g.strokeStyle="rgba(80,20,10,.35)"; g.lineWidth=1*u; g.beginPath(); g.moveTo((-70+i*2.8)*u,y*u); g.lineTo((70-i*2.8)*u,y*u); g.stroke(); }
    P([[-46,-92],[46,-92],[40,-96],[-40,-96]],"#8e2f1d");
    [-44,-16,16,44].forEach(x=>R(x-3,-52,6,44,"#e6d6b4")); R(-12,-40,24,32,"#6b3b22",2); R(-46,-40,18,14,"#3a7ca5",2); R(28,-40,18,14,"#3a7ca5",2); R(-1,-40,2,32,"#4c2a18"); }],
  boat:[1.8,90,(g,u)=>{ const {P,R,L}=tools(g,u); P([[-80,-30],[80,-30],[62,0],[-62,0]],"#2f6fa8"); P([[-80,-30],[80,-30],[78,-24],[-78,-24]],"#e0392b"); P([[-62,0],[62,0],[70,-10],[-70,-10]],"#1d4f7c");
    R(-20,-52,40,22,"#f3e6c9",2); R(-20,-56,40,6,"#b8432b"); L([[0,-56],[0,-98]],"#5a3a22",3); P([[0,-98],[34,-90],[0,-82]],"#ff7a1a"); P([[0,-80],[-22,-74],[0,-68]],"#ffd23f"); }],
  lighthouse:[.6,300,(g,u)=>{ const {P,R,E}=tools(g,u); P([[-40,0],[-30,-14],[30,-18],[44,0]],"#6d6457"); P([[-16,-14],[16,-14],[10,-82],[-10,-82]],"#f6f3ec");
    [-28,-52].forEach(y=>P([[-15+(-y-14)*.07,y],[15-(-y-14)*.07,y],[14-(-y-4)*.07,y-10],[-14+(-y-4)*.07,y-10]],"#e0392b"));
    R(-13,-90,26,8,"#2b2a33"); R(-9,-98,18,8,"#fff2b0"); P([[-12,-98],[12,-98],[0,-106]],"#e0392b"); }],
  fort:[2.6,150,(g,u)=>{ const {R,P}=tools(g,u); R(-120,-50,240,50,"#a9573b"); for(let x=-120;x<120;x+=16) R(x,-58,10,8,"#a9573b");
    R(-40,-80,80,80,"#9c4f34"); for(let x=-40;x<40;x+=14) R(x,-88,9,8,"#9c4f34"); R(-10,-40,20,40,"#4a2a1c",8);
    for(let y=-46;y<0;y+=9) for(let x=-118+((y/9)%2?8:0);x<118;x+=16) R(x,y,14,1,"rgba(60,20,10,.25)"); P([[30,-80],[46,-80],[46,-96]],"#ff7a1a"); }],
  banyan:[1.3,240,(g,u)=>{ const {E,R}=tools(g,u); R(-6,-45,12,45,"#6b4a2e"); for(let i=-3;i<=3;i++){ g.strokeStyle="#5c3f26"; g.lineWidth=1.2*u; g.beginPath(); g.moveTo(i*9*u,-48*u); g.lineTo(i*10*u,0); g.stroke(); }
    E(0,-62,58,26,"#2f6b2f"); E(-28,-72,30,22,"#3a7d36"); E(26,-74,32,22,"#3a7d36"); E(0,-84,34,18,"#4a9443"); }],
  bush:[1.6,120,(g,u)=>{ const {E}=tools(g,u); E(-40,-30,40,30,"#4f7f35"); E(30,-36,44,36,"#5e9440"); E(0,-24,70,24,"#466f30"); E(10,-50,20,12,"#6fa94c"); }],
  rock:[1.5,90,(g,u)=>{ const {P}=tools(g,u); P([[-60,0],[-52,-60],[-10,-90],[40,-80],[62,-30],[58,0]],"#f4efe6"); P([[-30,-75],[-10,-90],[14,-86],[-8,-70]],"#1b1b22"); P([[30,-82],[40,-80],[62,-30],[48,-36]],"#1b1b22"); }],
  laterite:[1.7,80,(g,u)=>{ const {P}=tools(g,u); P([[-70,0],[-60,-50],[-20,-80],[30,-74],[66,-36],[70,0]],"#9c4a2f"); P([[-60,-50],[-20,-80],[0,-60],[-40,-34]],"#b85d3d"); }],
  post:[.28,64,(g,u)=>{ const {R}=tools(g,u); R(-12,-100,24,100,"#f4f1ea"); R(-12,-100,24,26,"#1b1b22"); R(-7,-64,14,12,"#ff3b2f",2); R(4,-100,8,100,"rgba(0,0,0,.12)"); }],
  rail:[1.3,60,(g,u)=>{ const {R}=tools(g,u); R(-65,-100,130,16,"#e8e4dc"); R(-65,-60,130,10,"#e8e4dc"); R(-62,-100,12,100,"#d4cfc4"); R(50,-100,12,100,"#d4cfc4"); R(-65,-86,130,4,"rgba(0,0,0,.12)"); }],
  pole:[.55,260,(g,u)=>{ const {R,E}=tools(g,u); R(-3,-100,6,100,"#6b5440"); R(-26,-92,52,4,"#5a4634"); [-22,-8,8,22].forEach(x=>E(x,-94,2.2,3,"#e7e2d6")); }],
  mile:[.55,110,(g,u)=>{ const {R,E}=tools(g,u); E(0,0,24,4,"rgba(0,0,0,.25)"); R(-20,-70,40,70,"#f6f3ec"); E(0,-70,20,22,"#ffd23f"); R(-20,-74,40,8,"#ffd23f"); R(10,-70,10,70,"rgba(0,0,0,.08)"); }],
  stall:[1.5,190,(g,u)=>{ const {R,P,T,E}=tools(g,u); E(0,0,64,5,"rgba(0,0,0,.2)"); R(-56,-44,112,44,"#3e7c4a",3); R(-50,-40,100,30,"#ffcf7a",2);
    P([[-66,-50],[66,-50],[56,-74],[-56,-74]],"#e0392b"); for(let i=-60;i<60;i+=16) P([[i,-50],[i+8,-50],[i+6,-74],[i-2,-74]],"#fff4e2");
    R(-46,-94,92,20,"#1b1b22",3); T("CHAI ₹10",0,-84,13,"#ffd23f"); [-30,-10,10,30].forEach(x=>E(x,-26,6,8,"#f6b81f")); }],
  auto:[.95,190,(g,u)=>{ const {R,E,T}=tools(g,u); E(0,0,46,5,"rgba(0,0,0,.28)"); R(-40,-16,10,16,"#0d0d10",3); R(30,-16,10,16,"#0d0d10",3);
    R(-42,-56,84,42,"#1e1e22",4); R(-42,-26,84,6,"#111"); g.fillStyle="#ffd23f"; g.beginPath(); g.moveTo(-44*u,-56*u); g.lineTo(44*u,-56*u); g.quadraticCurveTo(46*u,-96*u,0,-98*u); g.quadraticCurveTo(-46*u,-96*u,-44*u,-56*u); g.fill();
    R(-34,-88,68,22,"#2a2a30",6); R(-30,-85,60,6,"rgba(255,255,255,.12)",3); R(-36,-38,12,7,"#ff3030",2); R(24,-38,12,7,"#ff3030",2); R(-14,-50,28,10,"#f6f3ec",2); T("MH 08",0,-45,7,"#1b1b22","bold Verdana,sans-serif"); T("SOUND HORN",0,-31,5,"#ffd23f","bold Verdana,sans-serif"); }],
  cow:[1.05,160,(g,u)=>{ const {R,E,L}=tools(g,u); E(0,0,42,5,"rgba(0,0,0,.25)"); [-28,-12,6,20].forEach(x=>{ R(x,-36,9,36,"#ece6da",3); R(x,-6,9,6,"#3a3335"); });
    E(0,-58,40,30,"#f4efe4"); E(-16,-62,11,9,"#3a3335"); E(18,-50,9,8,"#3a3335"); E(0,-94,13,11,"#f4efe4");
    L([[-8,-101],[-20,-112]],"#c9b48a",3.5); L([[8,-101],[20,-112]],"#c9b48a",3.5); L([[0,-42],[6,-22],[8,-10]],"#3a3335",2.2); E(8,-9,3,4,"#3a3335"); }],
  truck:[.95,300,(g,u)=>{ const {R,T,E}=tools(g,u); E(0,0,50,4,"rgba(0,0,0,.28)"); R(-46,-14,14,14,"#0d0d10",3); R(32,-14,14,14,"#0d0d10",3);
    R(-48,-100,96,90,"#e8732c",3); R(-44,-96,88,8,"#2f9e5b"); R(-44,-28,88,8,"#2f9e5b"); R(-44,-86,88,56,"#ffd23f");
    for(let i=0;i<6;i++) R(-44+i*16,-28,8,8,"#e0392b"); R(-42,-20,12,6,"#ff3030",2); R(30,-20,12,6,"#ff3030",2);
    T("HORN",0,-74,12,"#c0262d"); T("OK",0,-60,12,"#1f6fb0"); T("PLEASE",0,-46,12,"#c0262d"); }],
  bus:[.95,280,(g,u)=>{ const {R,E,T}=tools(g,u); E(0,0,50,4,"rgba(0,0,0,.28)"); R(-46,-12,14,12,"#0d0d10",3); R(32,-12,14,12,"#0d0d10",3);
    R(-48,-100,96,90,"#c7362b",5); R(-48,-60,96,8,"#ffd23f"); R(-42,-94,84,28,"#26303a",3); R(-38,-90,76,6,"rgba(255,255,255,.15)",2);
    R(-42,-24,14,7,"#ff3030",2); R(28,-24,14,7,"#ff3030",2); T("KONKAN EXPRESS",0,-42,7.5,"#fff4e2","bold Verdana,sans-serif"); }],
  nitro:[.8,120,(g,u)=>{ const {R,E,T}=tools(g,u); E(0,0,34,5,"rgba(0,0,0,.25)"); const bg=g.createLinearGradient(-30*u,0,30*u,0); bg.addColorStop(0,"#0d5fa8"); bg.addColorStop(.45,"#3ec1d3"); bg.addColorStop(1,"#0d4f96");
    g.fillStyle=bg; rr(g,-30*u,-92*u,60*u,88*u,14*u); g.fill(); R(-30,-62,60,14,"#ffd23f"); R(-12,-100,24,10,"#1b1b22",3); T("N",0,-30,30,"#fff4e2"); }],
  bookpick:[1,110,(g,u)=>{ const {R,E}=tools(g,u); E(0,0,40,5,"rgba(0,0,0,.25)"); R(-36,-34,72,30,"#1d2f5a",4); R(-34,-30,68,4,"#f3ead6"); R(-36,-62,64,28,"#7a2cbf",4); R(-32,-58,58,4,"#f3ead6"); R(-30,-88,60,26,"#e0392b",4); R(-26,-84,52,4,"#f3ead6"); R(-10,-80,4,14,"#ffd23f"); }],
  coco:[1,110,(g,u)=>{ const {E}=tools(g,u); E(0,0,34,5,"rgba(0,0,0,.25)"); E(-14,-26,24,24,"#6b4423"); E(16,-30,26,26,"#7a4f29"); E(0,-60,26,26,"#5c3a1d"); E(4,-66,5,4,"#3a2412"); E(-6,-62,4,3,"#3a2412"); }],
  barrel:[.6,110,(g,u)=>{ const {R,E}=tools(g,u); E(0,0,30,4,"rgba(0,0,0,.25)"); const bg=g.createLinearGradient(-28*u,0,28*u,0); bg.addColorStop(0,"#c84f12"); bg.addColorStop(.4,"#ff7a2a"); bg.addColorStop(1,"#a83e0c");
    g.fillStyle=bg; rr(g,-28*u,-96*u,56*u,96*u,8*u); g.fill(); R(-28,-72,56,14,"rgba(255,244,226,.92)"); R(-28,-40,56,14,"rgba(255,244,226,.92)"); E(0,-96,28,6,"#e05a12"); }]
};
function boardSprite(text){ return sprite("board"+text,1.7,170,(g,u)=>{ const {R,T}=tools(g,u); R(-56,-58,5,58,"#3a3640"); R(51,-58,5,58,"#3a3640"); R(-82,-100,164,46,"#1b1b22",3);
  const hot=text==="READRASH"||text==="RIDE RASH"; R(-79,-97,158,40,hot?"#ff6a1a":"#ffd23f",2);
  T(text,0,-77,text.length>12?11:text.length>9?14:18,hot?"#fff4e2":"#1b1b22"); }); }
function getSprite(t,sp){ if(t==="board") return boardSprite(sp.text); const d=PAINT[t]; return sprite(t,d[0],d[1],d[2]); }
const WH={bookpick:240,coco:220,nitro:260,post:150,rail:200,palm:2000,palm2:1900,mango:1300,house:900,boat:520,lighthouse:2600,fort:1500,banyan:1600,bush:300,rock:170,laterite:220,pole:1600,mile:240,board:1100,stall:800,auto:440,cow:340,truck:900,bus:900,barrel:220,bike:440};

/* ================= road geometry ================= */
const SEG=200, RW=2000, CAMH=900, camDepth=1/Math.tan(50*Math.PI/180), playerZ=CAMH*camDepth;
const START_Z=20*SEG, RACE_LEN=320*SEG, FINISH_Z=START_Z+RACE_LEN;
function buildRoad(seed,withBridge,drawN){
  const segs=[]; let s0=seed*7919+13; const rnd=()=>(s0=(s0*16807)%2147483647)/2147483647; rnd(); rnd();
  const lastY=()=>segs.length?segs[segs.length-1].p2.wy:0;
  const add=(c,y)=>{ const n=segs.length; segs.push({i:n,curve:c,p1:{wz:n*SEG,wy:lastY()},p2:{wz:(n+1)*SEG,wy:y},sprites:[],band:Math.floor(n/3)%2,clip:0,bridge:false}); };
  const easeIn=(a,b,p)=>a+(b-a)*p*p, easeIO=(a,b,p)=>a+(b-a)*(-Math.cos(p*Math.PI)/2+.5);
  const road=(e,h,l,c,rise)=>{ const y0=lastY(), y1=y0+rise*SEG, tot=e+h+l;
    for(let i=0;i<e;i++) add(easeIn(0,c,i/e),easeIO(y0,y1,i/tot));
    for(let i=0;i<h;i++) add(c,easeIO(y0,y1,(e+i)/tot));
    for(let i=0;i<l;i++) add(easeIO(c,0,i/l),easeIO(y0,y1,(e+h+i)/tot)); };
  road(0,40,0,0,0);
  const need=FINISH_Z/SEG+drawN+60;
  while(segs.length<need){ const e=10+Math.floor(rnd()*20), h=15+Math.floor(rnd()*35), l=10+Math.floor(rnd()*20);
    const c=rnd()<.25?0:(rnd()<.5?-1:1)*(1.5+rnd()*3.5), rise=(rnd()<.5?-1:1)*(4+rnd()*10); road(e,h,l,c,rise); }
  // bridge set piece (flat, straight-ish, water both sides)
  const bStart=withBridge?Math.floor((START_Z+RACE_LEN*(.35+rnd()*.3))/SEG):-1, bLen=46;
  if(withBridge){ const y=segs[bStart].p1.wy; for(let i=bStart;i<bStart+bLen;i++){ const s=segs[i]; s.bridge=true; s.curve*=.25; s.p1.wy=y; s.p2.wy=y; } }
  const ads=["READRASH","RIDE RASH","READ FAST","GOA 120 KM","RATNAGIRI 45","NO WORD LEFT BEHIND","HORN OK PLEASE"];
  segs.forEach((s,i)=>{
    if(s.bridge){ s.sprites.push({t:"rail",off:-1.16}); s.sprites.push({t:"rail",off:1.16}); if(i%14===0) s.sprites.push({t:"boat",off:(i%28?-1:1)*(2.6+rnd()*2.5)}); return; }
    const nearBridge=withBridge&&i>bStart-3&&i<bStart+bLen+3;
    if(i%2===0){ s.sprites.push({t:"post",off:-1.13}); s.sprites.push({t:"post",off:1.13}); }
    if(nearBridge) return;
    // sea side (left): beach palms + boats on the water
    if(i%4===0) s.sprites.push({t:rnd()<.5?"palm":"palm2",off:-(1.45+rnd()*.5)});
    if(i%11===7) s.sprites.push({t:"boat",off:-(2.9+rnd()*3.2)});
    if(i%23===11) s.sprites.push({t:"rock",off:-(1.35+rnd()*.3)});
    // land side (right)
    if(i%3===0) s.sprites.push({t:["palm","palm2","mango","palm","banyan"][Math.floor(rnd()*5)],off:1.55+rnd()*1.6});
    if(i%7===3) s.sprites.push({t:["bush","laterite","bush"][Math.floor(rnd()*3)],off:1.32+rnd()*.4});
    if(i%13===5) s.sprites.push({t:"pole",off:1.42});
    if(i%29===14) s.sprites.push({t:"house",off:2.2+rnd()*.9});
    if(i%47===20) s.sprites.push({t:"board",off:1.95,text:ads[Math.floor(i/47)%ads.length]});
    if(i%61===40) s.sprites.push({t:"stall",off:1.85});
    if(i%137===90) s.sprites.push({t:"fort",off:4.2});
    if(i%173===60) s.sprites.push({t:"lighthouse",off:-2.6});
  });
  for(let k=1;k<10;k++){ const i=Math.floor((START_Z+RACE_LEN*k/10)/SEG); if(!segs[i].bridge) segs[i].sprites.push({t:"mile",off:1.25,text:String(10-k)}); }
  segs[Math.floor(START_Z/SEG)+14].gantry="START";
  segs[Math.floor(FINISH_Z/SEG)].gantry="FINISH";
  return segs;
}
const ridges=[0,1,2].map(l=>Array.from({length:64},(_,i)=>.32+.28*Math.sin(i*.7+l*2.1)+.22*Math.sin(i*1.9+l)+.09*Math.sin(i*4.1+l*3)));

/* ================= Rash GP: lap racing on a circuit, words on overhead signs ================= */
const GP = {
  ROWS:10, ROW_GAP:95, FIRST:45, OPEN:.74, LANES:[-.66,0,.66], LAP_SEGS:1000, START:40*SEG, LAPS:[2,3,5],
  lg:{ rookie:{vMax:8333}, pro:{vMax:13333}, legend:{vMax:18333} } // full-speed = one sign every 1.2s / 0.75s / 0.55s
};
GP.LAP_LEN=GP.LAP_SEGS*SEG;
Object.values(GP.lg).forEach(l=>l.vMin=l.vMax*.32);
// Sprint words, three tiers per level: lap 1 uses tier 1, the final lap tier 3 (words get tougher every lap)
const WORDPOOL = {
  rookie:[
    "cat dog bat hat map cup bus box fox pig hen egg jam bag bed pen mud bug log pot mop fan van jet net wig cap kit lid lip hop hug jug rug fun gum bun cub tub web yak zip ram ant ox owl cow toy zoo hut nut pin tin fin rat cot dot tap pan sad leg peg kid fig gas hot wet big six ten jog dig sip wax rib cab pop mix sock hit nod",
    "fish frog duck milk ball kite tree leaf rock sand ship boat star moon rain snow wind fire cake rice corn lamp drum bell kick jump swim clap spin sing gift shoe ring tent lake pond goat lion bird nest crab shell desk book door hand foot bread grape lemon apple mango park farm hill bike train truck chair table clock smile happy funny jelly candy pizza juice horse sheep chick mouse cheese cloud storm grass plant beach wave brush paint glass spoon green black white brown queen",
    "rabbit puppy kitten monkey tiger zebra rocket robot cookie window garden yellow purple orange teacher pencil basket button carrot doctor farmer turtle parrot jacket helmet ladder hammer candle bucket muffin pancake popcorn rainbow dragon pirate castle wizard planet magnet picnic pocket puddle bubble giggle cupcake football balloon sister brother tickle penguin spider dinner jungle river forest pillow",
  ],
  pro:[
    "whisper pencil garden blanket dolphin pumpkin thunder ladder candle bucket basket button pirate castle comet marble jacket engine tunnel island cricket racket trophy circus pebble puzzle riddle sandwich cupboard sailor captain monster shadow mirror lantern camel beetle mountain ocean biscuit juggle wobble gallop whistle twinkle zigzag hammock suitcase backpack keyboard scooter seashell starfish treasure compass cabbage noodle waffle yogurt goggles",
    "lightning chocolate butterfly sunflower elephant octopus giraffe lighthouse waterfall skateboard helicopter battery spaceship motorbike cereal banana coconut tomato volcano kangaroo dinosaur umbrella telephone computer hospital library gorilla bicycle cucumber detective vegetable potato magician newspaper hamburger crocodile photograph holiday adventure tornado medicine alphabet carnival skeleton gymnastics instrument dentist dragonfly ladybug snowflake fireworks sunglasses playground toothbrush cardboard highway",
    "caterpillar watermelon calculator alligator avocado macaroni harmonica escalator thermometer motorcycle binoculars accordion ambulance astronaut submarine parachute xylophone microphone pineapple strawberry grasshopper porcupine dictionary cauliflower marshmallow trampoline octagon pyramid telescope hurricane mosquito tambourine chimpanzee flamingo armadillo dandelion lollipop stethoscope cinnamon broccoli spaghetti buffalo saxophone kaleidoscope",
  ],
  legend:[
    "enormous dangerous beautiful curious gigantic remarkable adventure telescope microscope hurricane avalanche crocodile alligator satellite champion tournament volunteer marathon parachute submarine symphony atmosphere migration wilderness generous delicious ambitious courageous mischievous fortunate tremendous important library galaxy cathedral comedian volcano festival molecule orchestra calendar elegant ferocious hilarious horizon passenger energy gravity oxygen history mystery pyramid skeleton cinema detective inventor explorer skyscraper",
    "mysterious incredible magnificent invisible impossible necessary particular spectacular temperature celebration exploration conversation caterpillar rhinoceros photographer geography technology thermometer accelerate fascinating ridiculous independent interesting navigation constellation tarantula environment helicopter calculator observation astronomy biography democracy diameter anaconda harmonica binoculars hibernation evaporate electronic ingredient original material delivery discovery emergency",
    "extraordinary electricity hippopotamus encyclopedia responsibility opportunity civilization determination unbelievable enthusiastic architecture engineering mathematics laboratory phenomenon refrigerator personality anniversary curiosity university veterinarian pronunciation consideration communication imagination vocabulary investigation biodiversity international photosynthesis accidentally sophisticated revolutionary microorganism appreciation extraterrestrial multiplication cooperation mathematician disappointment abbreviation circumference",
  ],
};
Object.keys(WORDPOOL).forEach(k=>WORDPOOL[k]=WORDPOOL[k].map(t=>t.split(/\s+/).filter(Boolean)));
const CHARS=[ // in-game characters fill the grid when there aren't enough real ghost runs yet
  {name:"ZIPPY",jacket:"#2f9bf0",helmet:"#0d4f96",paint:"#ffd23f"},{name:"TARA",jacket:"#ff4f9a",helmet:"#fff4e2",paint:"#7a2cbf"},
  {name:"BABLU",jacket:"#36b862",helmet:"#1b1b22",paint:"#e0392b"},{name:"MEENA",jacket:"#9b59ff",helmet:"#ffd23f",paint:"#1b1b22"},
  {name:"CHOTU",jacket:"#ffb000",helmet:"#e0392b",paint:"#2f6fa8"},{name:"RAJU",jacket:"#00b8a9",helmet:"#fff4e2",paint:"#1b1b22"},
  {name:"PINKY",jacket:"#ff7ab8",helmet:"#7a2cbf",paint:"#fff4e2"},{name:"SONU",jacket:"#5d6bff",helmet:"#1b1b22",paint:"#ffd23f"},
  {name:"GUDDU",jacket:"#8bc34a",helmet:"#2f6fa8",paint:"#e0392b"},{name:"BUNTY",jacket:"#ff5a36",helmet:"#1b1b22",paint:"#fff4e2"},
  {name:"MOTU",jacket:"#c0a060",helmet:"#fff4e2",paint:"#2f9e5b"}];
const GHOST_KIT=[{jacket:"#e8e4dc",helmet:"#3ec1d3",paint:"#3ec1d3"},{jacket:"#d6f3f7",helmet:"#1b1b22",paint:"#3ec1d3"}];
function buildGPRoad(laps,drawN){
  // one lap of curves, hills and landmarks; every lap repeats it so the circuit is recognisable
  let s0=4242; const rnd=()=>(s0=(s0*16807)%2147483647)/2147483647; rnd();
  const lap=[]; const add=(c,y)=>lap.push({curve:c,y});
  const easeIn=(a,b,p)=>a+(b-a)*p*p, easeIO=(a,b,p)=>a+(b-a)*(-Math.cos(p*Math.PI)/2+.5);
  let yNow=0;
  const road=(e,h,l,c,rise)=>{ const y0=yNow, y1=y0+rise*SEG, tot=e+h+l;
    for(let i=0;i<e;i++) add(easeIn(0,c,i/e),easeIO(y0,y1,(i+1)/tot));
    for(let i=0;i<h;i++) add(c,easeIO(y0,y1,(e+i+1)/tot));
    for(let i=0;i<l;i++) add(easeIO(c,0,i/l),easeIO(y0,y1,(e+h+i+1)/tot)); yNow=y1; };
  road(0,40,0,0,0);
  while(lap.length<GP.LAP_SEGS-300){ const e=12+Math.floor(rnd()*20), h=20+Math.floor(rnd()*40), l=12+Math.floor(rnd()*20);
    const c=rnd()<.2?0:(rnd()<.5?-1:1)*(1.8+rnd()*3.6); let rise=(rnd()<.5?-1:1)*(5+rnd()*12); if(yNow>1600) rise=-Math.abs(rise); if(yNow<-1600) rise=Math.abs(rise); road(e,h,l,c,rise); }
  road(30,0,30,0,-yNow/SEG); // come back down to level
  while(lap.length<GP.LAP_SEGS) add(0,0); // flat home straight
  lap.length=GP.LAP_SEGS;
  for(let i=GP.LAP_SEGS-120;i<GP.LAP_SEGS-55;i++) lap[i].bridge=true; // backwater bridge on the home straight
  const pre=Math.floor(GP.START/SEG), total=pre+laps*GP.LAP_SEGS+drawN+80, segs=[];
  const ads=["READRASH","RASH GP","READ FAST","GOA 120 KM","RATNAGIRI 45","CHAI ₹10","HORN OK PLEASE"];
  for(let n=0;n<total;n++){
    const k=n<pre?-1:(n-pre)%GP.LAP_SEGS, L=k<0?{curve:0,y:0}:lap[k], prevY=n?segs[n-1].p2.wy:0;
    const s={i:n,curve:L.curve,p1:{wz:n*SEG,wy:prevY},p2:{wz:(n+1)*SEG,wy:L.y},sprites:[],band:Math.floor(n/3)%2,clip:0,bridge:!!L.bridge};
    const kk=k<0?n+997:k, r=((kk*2654435761)>>>0)/4294967296, r2=((kk*40503+7)>>>0)%1000/1000;
    if(s.bridge){ s.sprites.push({t:"rail",off:-1.16},{t:"rail",off:1.16}); if(kk%14===0) s.sprites.push({t:"boat",off:(kk%28?-1:1)*(2.6+r*2.5)}); }
    else {
      if(n%2===0) s.sprites.push({t:"post",off:-1.13},{t:"post",off:1.13});
      if(kk%4===0) s.sprites.push({t:r<.5?"palm":"palm2",off:-(1.45+r2*.5)});
      if(kk%11===7) s.sprites.push({t:"boat",off:-(2.9+r*3.2)});
      if(kk%3===0) s.sprites.push({t:["palm","palm2","mango","palm","banyan"][Math.floor(r*5)],off:1.55+r2*1.6});
      if(kk%7===3) s.sprites.push({t:["bush","laterite","bush"][Math.floor(r2*3)],off:1.32+r*.4});
      if(kk%13===5) s.sprites.push({t:"pole",off:1.42});
      if(kk%37===14) s.sprites.push({t:"house",off:2.2+r*.9});
      if(kk%53===20) s.sprites.push({t:"board",off:1.95,text:ads[Math.floor(kk/53)%ads.length]});
      if(k===200||k===720) s.sprites.push({t:"stall",off:1.85});
      if(k===300) s.sprites.push({t:"lighthouse",off:-2.6});
      if(k===850) s.sprites.push({t:"fort",off:4.2});
    }
    segs.push(s);
  }
  const startSeg=pre;
  segs[startSeg].gantry="START";
  for(let L=1;L<laps;L++) segs[startSeg+L*GP.LAP_SEGS].gantry=L===laps-1?"FINAL LAP":"LAP "+(L+1);
  segs[startSeg+laps*GP.LAP_SEGS].gantry="FINISH";
  return segs;
}
function shuffled(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function botSplits(lg,laps,h){ const L=GP.lg[lg], out=[]; let t=1400; for(let i=0;i<laps;i++){ const v=(L.vMin+(L.vMax-L.vMin)*h)*(.96+Math.random()*.08); t+=GP.LAP_LEN/v*1000; out.push(Math.round(t)); } return out; }

/* ================= the race ================= */
function create(o){
  const cv=o.canvas, ctx=cv.getContext("2d",{alpha:false});
  const ui=o.ui||{}; const $u=k=>ui[k]||null;
  const attract=!!o.attract;
  let league=o.league||"pro", raceIdx=o.race||0, autopilot=attract, apWpm=LEAGUES[league].demo;
  let DRAW=attract?130:160, quality=1;
  let segs=[], words=[], keys=[], idx=0, fails=0, status=[], spans=[], trouble=new Set(), acts=[];
  let phase="idle", t0=0, now=0, finishT=null, lights=0, apNext=0, running=true, raf=0;
  let correctCount=0, attemptCount=0, streak=0, lastProgressT=0, swipes=0, dodges=0;
  const P={z:START_Z,target:START_Z,v:0,x:0,lean:0,state:"ride",until:0,boostUntil:0,swipeT:-9999,swipeDir:1,copUntil:0,crashT:0};
  let riders=[], obstacles=[], skyOff=0, lastSwipeIdx=-9, lastSwipeT=-9999, tilt=0, shakeAmt=0, parts=[], bursts=[];
  let W=900,H=450,HY=180,CX=450,dpr=1,skyC=null,vignC=null;
  const listeners={};
  const emit=(k,v)=>{ (listeners[k]||[]).forEach(f=>f(v)); };

  /* ---------- Rash GP: word lanes + a pack that fights back ---------- */
  const gp=o.mode==="gp";
  let gpLaps=3, rows=[], gpObs=[], gpNitro=[], rivals=[], heat=.4, lapIdx=0, splits=[], gpMissed=0, gpWrong=0, lastPlace=12;
  let playerAtkCD=0, shieldCharge=0, kos=0, hitsTaken=0, blocks=0, atkTarget=null, projs=[], comment=null, lastRivalAtk=-9999, leaderName="";
  let posCand={p:12,t:0}, draft=0, slingUntil=-99999, blockedMsgT=-9999, duelT=-9999, posFlash=null, crashes=0, duelsWon=0, duelsLost=0;
  let VREF=RACE_LEN/4.6, HUD0=START_Z, HUDLEN=RACE_LEN, FINZ=FINISH_Z;
  const LANE_X=GP.LANES;
  const SAY_PASS=["See ya!","Catch me!","Too slow!","Bye bye!"], SAY_LOSE=["Nooo!","Hey!","No way!","Come back!"];
  function nextPending(){ for(const r of rows){ if(r.state===0&&r.z>P.z+80) return r; } return null; }
  function curRow(){ const r=nextPending(); return r&&r.z-P.z<=GP.ROW_GAP*SEG*GP.OPEN?r:null; }
  function nextRow(r){ const i=rows.indexOf(r); return i>=0?rows[i+1]||null:null; }
  function laneCenterOf(x){ let b=0; LANE_X.forEach((lx,i)=>{ if(Math.abs(x-lx)<Math.abs(x-LANE_X[b])) b=i; }); return b; }
  function loadGP(lg,laps){
    league=lg; gpLaps=laps; apWpm=LEAGUES[lg].demo; const L=GP.lg[lg]; VREF=L.vMax; HUD0=GP.START; HUDLEN=laps*GP.LAP_LEN; FINZ=GP.START+HUDLEN;
    segs=buildGPRoad(laps,DRAW);
    // words: three per gantry (easy / medium / hard), getting tougher lap by lap; no repeats in a race
    const tiers=WORDPOOL[lg], bags=tiers.map(t=>shuffled(t)), used=new Set();
    const draw=t=>{ t=Math.max(0,Math.min(2,t)); for(const d of [0,-1,1,-2,2]){ const b=bags[Math.max(0,Math.min(2,t+d))]; while(b.length){ const w=b.pop(); if(!used.has(w)){ used.add(w); return w; } } } return shuffled(tiers[t])[0]; };
    rows=[]; gpObs=[]; gpNitro=[];
    const traffic=["auto","barrel","cow","truck","auto","barrel","bus"];
    for(let lap=0;lap<laps;lap++){ const f=laps===1?0:lap/(laps-1)*(laps===2?1.5:2);
      for(let k=0;k<GP.ROWS;k++){ const base=Math.min(2,Math.floor(f)+(Math.random()<f-Math.floor(f)?1:0));
        const ws=[draw(base-1),draw(base),draw(base+1)].sort((a,b)=>a.length-b.length); // easy, medium, hard
        const perm=shuffled([0,1,2]), words3=[], content=["clear","clear","clear"];
        perm.forEach((lane,d)=>{ words3[lane]=ws[d]; });
        const easyLane=perm[0], hardLane=perm[2], midLane=perm[1];
        if(k>0||lap>0){ if(Math.random()<.7) content[easyLane]="traffic"; if(Math.random()<.65) content[hardLane]="nitro"; if(content[easyLane]!=="traffic"&&Math.random()<.35) content[midLane]="traffic"; else if(Math.random()<.32) content[midLane]=Math.random()<.55?"book":"coconut"; }
        const z=GP.START+lap*GP.LAP_LEN+(GP.FIRST+k*GP.ROW_GAP)*SEG;
        const r={z,lap,k,words:words3,keys:words3.map(norm),content,state:0,chosen:-1,t:0}; rows.push(r);
        content.forEach((c,lane)=>{ if(c==="traffic") gpObs.push({z:z+GP.ROW_GAP*SEG*.18,lane,type:traffic[(k+lane+lap)%traffic.length],hit:false});
                                  if(c==="nitro"||c==="book"||c==="coconut") gpNitro.push({z:z+GP.ROW_GAP*SEG*.1,lane,kind:c,taken:false}); });
      } }
    words=rows.flatMap(r=>r.words); keys=words.map(norm); status=[]; trouble=new Set(); acts=[]; idx=0;
    correctCount=0; attemptCount=0; streak=0; gpMissed=0; gpWrong=0; crashes=0; kos=0; hitsTaken=0; blocks=0; shieldCharge=0; atkTarget=null; projs=[]; comment=null; lastRivalAtk=-9999; leaderName=""; heat=.4; lapIdx=0; splits=[]; finishT=null; lights=0; draft=0; slingUntil=0; posFlash=null;
    Object.assign(P,{z:GP.START-2800,target:0,v:0,x:0,vx:0,lane:1,lean:0,state:"ride",until:0,boostUntil:0,swipeT:-9999,copUntil:0,shield:1,shieldFlashT:-9999,weapon:{type:"paper",uses:Infinity},downT:-9999,downDir:1});
    // the pack: in-game riders with personalities; everyone lines up ahead of you
    const crew=shuffled(CHARS), styles=["sprinter","closer","blocker","steady"];
    const skills=shuffled([1,.97,.93,.88,.84,.8,.76,.72,.68,.62,.56]);
    const NUMS=[2,3,4,5,6,8,9,11,12,14,21];
    rivals=crew.slice(0,11).map((c,k)=>({name:c.name,kit:{...c,num:NUMS[k],accent:c.helmet},style:skills[k]>=.97?"closer":styles[k%4],skill:skills[k],
      pack:k<6, base:k<6?[-900,-350,250,700,1200,1700][k]:(k%2?-1:1)*(2600+Math.random()*5000), ph:Math.random()*6,
      z:GP.START-2800+(Math.floor(k/2)+1)*540, v:0, lane:k%3, x:LANE_X[k%3], lastRow:-1, side:0, sayT:-9999, say:null, knockT:-99999, knockDir:1, swipeT:-9999, lean:0, vx:0, attack:null, atkCD:4000+Math.random()*6000, down:null, slowUntil:0}));
    rivals.forEach(r=>{ r.maxShield=1+(r.skill>.9?2:r.skill>.75?1:0); r.shield=r.maxShield; r.shieldT=0; r.weapon=r.style==="blocker"||r.style==="closer"?"book":"paper"; });
    riders=[]; obstacles=[]; skyOff=0; parts=[]; bursts=[]; shakeAmt=0; phase="idle"; lastPlace=12;
    setText("timeChip","0.0s"); setText("wpmChip","0 wpm"); setText("posTxt","12th / 12"); gpUI(true);
  }
  function gpPlace(){ let p=1; rivals.forEach(r=>{ if(r.finishT!=null?(finishT==null||r.finishT<finishT):r.z>P.z) p++; }); return p; }
  let uiKey="", barTick=0;
  function laneTag(r,lane){ const c=r.content[lane]; if(c==="nitro") return ["NITRO","n"]; if(c==="traffic") return ["TRAFFIC","t"]; if(c==="book") return ["DICTIONARY","w"]; if(c==="coconut") return ["COCONUT","w"];
    const rv=rivals.find(v=>v.lane===lane&&v.z>r.z&&v.z<r.z+GP.ROW_GAP*SEG*.8&&v.finishT==null); return rv?[rv.name,"r"]:["CLEAR","c"]; }
  function gpUI(force){
    const r=phase==="race"?nextPending():null, open=!!(r&&r===curRow()), box=$u("lanes");
    if(box){ box.classList.toggle("locked",!!r&&!open); const key=(r?r.z+"|"+r.state+"|"+open:"none")+"|"+P.lane+"|"+phase;
      if(force||key!==uiKey){ uiKey=key; const kids=box.children;
        for(let i=0;i<3;i++){ const el=kids[i]; if(!el) continue; const wEl=el.querySelector("b"), tEl=el.querySelector("i");
          if(r){ wEl.textContent=r.words[i]; wEl.style.fontSize=""; const cw=el.clientWidth-10; if(cw>0&&wEl.scrollWidth>cw){ const f=parseFloat(getComputedStyle(wEl).fontSize); wEl.style.fontSize=Math.max(11,f*cw/wEl.scrollWidth)+"px"; } const [tg,cl]=laneTag(r,i); tEl.textContent=tg; tEl.className="tag-"+cl; }
          else { wEl.textContent=phase==="done"?"FINISH!":phase==="race"?"…":i===1?"Get ready":"·"; tEl.textContent=""; tEl.className=""; }
          el.classList.toggle("here",i===P.lane); } } }
    const bar=$u("signBar"); if(bar&&(force||++barTick%3===0)){ const f=r&&open?Math.max(0,Math.min(1,(r.z-P.z)/(GP.ROW_GAP*SEG*GP.OPEN))):0; bar.style.width=(f*100).toFixed(1)+"%"; }
    setText("lapTxt",`${Math.min(gpLaps,lapIdx+1)}/${gpLaps}`);
    const sh=$u("shield"); if(sh&&sh._v!==P.shield){ sh._v=P.shield; [...sh.children].forEach((c,i)=>c.classList.toggle("on",i<P.shield)); }
    setText("weaponTxt",P.weapon.type==="book"?`Dictionary ×${P.weapon.uses}`:P.weapon.type==="coconut"?"Coconut":"Newspaper");
  }
  function say(rv,list){ if(now-rv.sayT<3500) return; rv.sayT=now; rv.say=list[Math.floor(Math.random()*list.length)]; }
  function chooseLane(r,lane){
    const early=Math.max(0,Math.min(1,(r.z-P.z)/(GP.ROW_GAP*SEG*GP.OPEN)));
    r.state=1; r.chosen=lane; r.t=now; P.lane=lane; correctCount++; attemptCount++; streak++; chargeShield();
    heat=Math.min(1,heat+.12+.16*early);
    if(draft>=1.2&&now>slingUntil+5000){ slingUntil=now+1300; draft=0; pop("SLINGSHOT!",650,"go"); Sound.tone(300,.35,"sawtooth",.05,600); }
    Sound.tone(620+Math.min(8,streak%10)*40,.07,"square",.035);
    if(streak%10===0){ P.boostUntil=now+2200; shakeAmt=5; pop("NITRO!",700,"go"); Sound.tone(220,.5,"sawtooth",.05,500); }
    gpUI(true);
  }
  function talk(t){ comment={txt:t,t:now}; }
  function chargeShield(){ shieldCharge++; if(shieldCharge>=2){ shieldCharge=0; if(P.shield<3){ P.shield++; Sound.tone(1040,.08,"triangle",.05,200); if(P.shield===3) talk("Shield full. Bring it on!"); } } }
  function crackShield(){ shieldCharge=0; if(P.shield>0){ P.shield--; P.shieldFlashT=now; } }
  function playerDown(dir,why){ if(P.state==="down") return; P.state="down"; P.downT=now; P.until=now+2000; P.downDir=dir||1; P.v*=.3; heat*=.6; streak=0; shakeAmt=18; P.bump=4;
    Sound.noise(.4,.35); sparks(26,CX,H-12); atkTarget=null; talk(why||"Down! Back on the bike!"); }
  function knockRider(rv,dir){ rv.down={t:now,dir}; rv.attack=null; rv.v*=.3; rv.slowUntil=now+6000; if(atkTarget===rv) atkTarget=null; }
  function hitPower(){ const w=P.weapon.type; return (w==="book"?2:1)+(P.v>GP.lg[league].vMax*.9?1:0)+(streak>=8?1:0); }
  function landHit(rv,power){
    if(rv.down) return;
    const dir=Math.sign(rv.x-P.x)||1;
    shakeAmt=10; bursts.push({x:rv._sx!=null?rv._sx:CX+dir*W*.22,y:rv._sy!=null?rv._sy:H*.6,t:0,dir});
    if(power>rv.shield){ knockRider(rv,dir); kos++; pop("KNOCKOUT!",700,"go"); Sound.noise(.18,.4); Sound.tone(140,.2,"square",.07,-60); talk(`${rv.name} is down!`); say(rv,["Aaargh!","Noooo!","Not again!"]); heat=Math.min(1,heat+.08); }
    else { rv.shield=Math.max(0,rv.shield-1); rv.shieldT=now; rv.v*=.8; rv.knockT=now; rv.knockDir=dir; pop("HIT!",500,"go"); Sound.tone(220,.12,"square",.06,-60); say(rv,["Ouch!","Is that all?","Hey!"]); }
  }
  function playerAttack(rv){
    const w=P.weapon.type, dir=Math.sign(rv.x-P.x)||1; P.swipeT=now; P.swipeDir=dir; rv.attack=null; chargeShield();
    if(w==="coconut"){ projs.push({rv,t0:now,dur:520}); P.swipeDir=rv.x>=P.x?1:-1; Sound.tone(500,.12,"triangle",.05,-200); }
    else landHit(rv,hitPower());
    if(P.weapon.uses!==Infinity&&--P.weapon.uses<=0){ P.weapon={type:"paper",uses:Infinity}; }
    rv.atkWord=null; atkTarget=null; playerAtkCD=now+2600;
  }
  function rivalStrike(rv){
    rv.swipeT=now; rv.attack=null; rv.atkCD=now+6500+Math.random()*4500;
    const dz=rv.z-P.z, dx=Math.abs(rv.x-P.x);
    if(P.state==="down"||Math.abs(dz)>560||dx>1.3){ say(rv,["Missed!","Grr!"]); return; }
    const power=(rv.weapon==="book"?2:1)+(rv.v>P.v*1.08?1:0), dir=Math.sign(P.x-rv.x)||1;
    if(P.shield>0){ P.shield=Math.max(0,P.shield-(power>=2?2:1)); P.shieldFlashT=now; blocks++; rv.knockT=now; rv.knockDir=-dir; rv.v*=.72; rv.stunUntil=now+900;
      pop("BLOCKED!",600,"go"); Sound.tone(1300,.1,"square",.05,-500); Sound.noise(.08,.15); shakeAmt=6; say(rv,["What?!","Bounced!","No way!"]); talk(`Shield blocks ${rv.name}!`); }
    else { hitsTaken++; P.bump=3; bursts.push({x:CX+dir*-W*.06,y:H*.62,t:0,dir});
      if(power>=2) playerDown(dir,`${rv.name} knocks you down!`);
      else { P.state="skid"; P.until=now+650; P.v*=.72; heat=Math.max(0,heat-.12); shakeAmt=10; pop("HIT!",500); Sound.noise(.15,.3); }
      say(rv,["Gotcha!","Take that!","Ha!"]); }
  }
  function gpJudge(h,final,last){
    if(phase!=="race") return 0;
    if(!h||FILLER.has(h)) return 1;
    const hit=k=>isMatch(h,k)||(!final&&last&&k.length>=5&&h.length>=Math.max(4,Math.ceil(k.length*.6))&&k.startsWith(h));
    if(atkTarget&&atkTarget.atkKey&&hit(atkTarget.atkKey)){ playerAttack(atkTarget); return 1; }
    const r=curRow(); if(!r) return 1;
    for(let i=0;i<3;i++) if(hit(r.keys[i])){ chooseLane(r,i); return 1; }
    let lastOk=null; for(const x of rows) if(x.state===1) lastOk=x; if(lastOk&&lastOk.chosen>=0&&sim(h,lastOk.keys[lastOk.chosen])>=.8) return 1; // repeating the last word
    if(!final) return 0;
    gpWrong++; attemptCount++; heat=Math.max(0,heat-.12); streak=0; crackShield();
    P.state="skid"; P.until=now+420; shakeAmt=6; pop("WRONG!",450); Sound.tone(300,.18,"triangle",.05,-120);
    return 1;
  }
  function updateGP(dt){
    const L=GP.lg[league], finalLap=lapIdx>=gpLaps-1;
    if(phase==="race"||phase==="done") now=performance.now()-t0;
    if(phase==="race"){
      // demo rider: picks the best lane like a good player would
      if(autopilot){ const r=curRow(); if(r&&now>=apNext){ const score=i=>(r.content[i]==="nitro"?3:r.content[i]==="traffic"?-9:1)-(rivals.some(v=>v.lane===i&&v.z>P.z&&v.z<r.z+3000)?1.5:0)+Math.random()*.5;
          if(Math.random()<.05) gpJudge("zzzz",true,false); else { let b=0; for(let i=1;i<3;i++) if(score(i)>score(b)) b=i; chooseLane(r,b); } apNext=now+(60000/apWpm)*(.8+Math.random()*.5); }
        if(atkTarget&&atkTarget.atkWord&&now-atkTarget.atkT>700&&Math.random()<dt*1.5) playerAttack(atkTarget); }
      heat=Math.max(0,heat-.028*dt);
      let tv=L.vMin+(L.vMax-L.vMin)*heat; if(P.boostUntil>now) tv*=1.3; if(slingUntil>now) tv*=1.12;
      if(P.state==="skid"){ if(now<P.until) tv*=.55; else P.state="ride"; }
      if(P.state==="crash"){ if(now<P.until) tv*=.25; else P.state="ride"; }
      if(P.state==="down"){ if(now<P.until) tv=now-P.downT<1500?0:L.vMin*.4; else { P.state="ride"; talk("Back in the race!"); } }
      // stuck behind a rider in your lane: you can't ride through them, switch lanes to pass
      let blockedBy=null, draftOn=false;
      for(const rv of rivals){ if(rv.finishT!=null) continue; const dz=rv.z-P.z, same=Math.abs(rv.x-P.x)<.34;
        if(same&&dz>0&&dz<1500) draftOn=true;
        if(same&&dz>0&&dz<420&&rv.v<tv) blockedBy=rv; }
      if(blockedBy){ tv=Math.min(tv,blockedBy.v*.98); P.blockedFor=(P.blockedFor||0)+dt; if(P.blockedFor>.7&&now-blockedMsgT>7000){ blockedMsgT=now; talk("Blocked! Read another lane to pass"); say(blockedBy,["Ha ha!","My lane!","Go around!"]); } }
      if(!blockedBy) P.blockedFor=0;
      draft=draftOn&&now>slingUntil+5000?Math.min(1.2,draft+dt*.8):Math.max(0,draft-dt*.6);
      P.v+=(tv-P.v)*Math.min(1,dt*(tv>P.v?1.8:2.8)); if(blockedBy) P.z=Math.min(P.z+P.v*dt,blockedBy.z-300); else P.z+=P.v*dt;
      // gantry passed without reading: stay in your lane, lose speed
      for(const r of rows){ if(r.z>P.z+80) break; if(r.state===0){ r.state=-1; r.t=now; gpMissed++; streak=0; crackShield(); heat=Math.max(0,heat-.22); r.words.forEach(w=>trouble.add(words.indexOf(w))); pop("MISSED!",450,"small"); Sound.tone(180,.2,"sawtooth",.04,-60); } }
      const myLane=laneCenterOf(P.x);
      for(const ob of gpObs){ if(ob.hit) continue; const dz=ob.z-P.z; if(dz<-300) { ob.hit=true; continue; }
        if(dz<160&&dz>-120&&Math.abs(P.x-LANE_X[ob.lane])<.3){ ob.hit=true; crashes++; P.z=Math.max(P.z,ob.z+260); pop("BONK!",650); playerDown(P.x>=LANE_X[ob.lane]?1:-1,`Smashed into the ${ob.type==="cow"?"cow":ob.type==="auto"?"auto":ob.type==="bus"?"bus":ob.type==="truck"?"truck":"barrel"}!`); } }
      for(const nz of gpNitro){ if(nz.taken) continue; const dz=nz.z-P.z; if(dz<-300){ nz.taken=true; continue; }
        if(dz<200&&dz>-150&&Math.abs(P.x-LANE_X[nz.lane])<.32&&P.state!=="down"){ nz.taken=true;
          if(nz.kind==="book"){ P.weapon={type:"book",uses:3}; pop("DICTIONARY!",650,"go"); talk("Dictionary in hand: heavy hits!"); Sound.tone(330,.2,"square",.05,200); }
          else if(nz.kind==="coconut"){ P.weapon={type:"coconut",uses:1}; pop("COCONUT!",650,"go"); talk("Coconut ready: hit the rider ahead!"); Sound.tone(330,.2,"square",.05,200); }
          else { P.boostUntil=now+2400; heat=Math.min(1,heat+.1); shakeAmt=4; pop("NITRO!",600,"go"); Sound.tone(260,.45,"sawtooth",.05,520); } } }
      const d=P.z-GP.START, lapNow=Math.floor(d/GP.LAP_LEN);
      while(lapNow>lapIdx&&lapIdx<gpLaps){ splits.push(Math.round(now)); lapIdx++;
        if(lapIdx===gpLaps-1) talk("Final lap. It's tight!");
        if(lapIdx<gpLaps){ pop(lapIdx===gpLaps-1?"FINAL LAP! TOUGHEST WORDS":"LAP "+(lapIdx+1)+" · TOUGHER WORDS",1400,"go lap"); Sound.tone(880,.2,"square",.05); } }
      if(d>=gpLaps*GP.LAP_LEN&&finishT==null){ finishT=Math.round(now); finish(false); }
      setText("timeChip",(now/1000).toFixed(1)+"s");
      const mins=now/60000; setText("wpmChip",(mins>.05?Math.round(correctCount/mins):0)+" wpm");
      // your attack: a rider alongside (or, with a coconut, the rider ahead) carries a word; read it to strike
      const coco=P.weapon.type==="coconut";
      const valid=rv=>rv&&!rv.down&&rv.finishT==null&&(coco?(rv.z-P.z>250&&rv.z-P.z<3200):(Math.abs(rv.z-P.z)<460&&Math.abs(rv.x-P.x)>.28&&Math.abs(rv.x-P.x)<1.3));
      if(atkTarget&&!valid(atkTarget)){ if(now-atkTarget.atkT>900){ atkTarget.atkWord=null; atkTarget=null; } }
      if(!atkTarget&&P.state!=="down"&&now>playerAtkCD){ let best=null; for(const rv of rivals) if(valid(rv)&&(!best||Math.abs(rv.z-P.z)<Math.abs(best.z-P.z))) best=rv;
        if(best){ const cr=curRow(), tier=WORDPOOL[league][Math.max(0,Math.min(2,lapIdx-1))], cands=tier.filter(w=>w.length<=7&&!(cr&&cr.words.includes(w)));
          const w=cands[Math.floor(Math.random()*cands.length)]||"go"; best.atkWord=w; best.atkKey=norm(w); best.atkT=now; atkTarget=best; } }
      // rivals attack: wind up (red !) then strike; your shield decides what happens
      for(const rv of rivals){
        if(rv.attack){ if(rv.down||rv.finishT!=null){ rv.attack=null; continue; } if(now-rv.attack.t0>1300) rivalStrike(rv); continue; }
        if(rv.down||rv.finishT!=null||P.state==="down"||now<rv.atkCD||now<4000) continue;
        const dz=rv.z-P.z, dx=Math.abs(rv.x-P.x), aggr={blocker:.9,closer:finalLap?1.1:.45,sprinter:.55,steady:.3}[rv.style]||.4;
        if(!rv.hunt&&Math.abs(dz)<2400&&now-lastRivalAtk>2500&&!rivals.some(o=>o.hunt)&&Math.random()<aggr*dt*.7){ rv.hunt=now+5500; say(rv,["Coming for you!","Hey, wait up!","Gotcha soon!"]); }
        if(rv.hunt&&now>rv.hunt){ rv.hunt=0; rv.atkCD=now+5000; }
        if(Math.abs(dz)>400||dx<.28||dx>1.25||now-lastRivalAtk<2500) continue;
        if(Math.random()<(rv.hunt?3:aggr)*dt){ rv.hunt=0; rv.attack={t0:now}; lastRivalAtk=now; say(rv,["Take this!","Watch out!","Here I come!","You're mine!"]); Sound.tone(440,.08,"square",.04); }
      }
      projs=projs.filter(pr=>{ if(now-pr.t0<pr.dur) return true; if(!pr.rv.down) landHit(pr.rv,9); return false; });
      // who's leading: the commentator calls lead changes
      { let lead=P, lz=P.z; for(const rv of rivals) if(rv.finishT==null&&rv.z>lz){ lead=rv; lz=rv.z; } const nm=lead===P?"YOU":lead.name;
        if(nm!==leaderName&&now>3000){ talk(nm==="YOU"?"You take the lead!":`${nm} leads!`); } leaderName=nm; }
    } else if(phase==="done"){ const stopZ=FINZ+60*SEG, room=stopZ-P.z; P.v+=((room>0?Math.min(L.vMin*.8,room*1.2):0)-P.v)*Math.min(1,dt*1.5); P.z=Math.min(stopZ,P.z+P.v*dt); }
    if(phase==="race"||phase==="done"){
      for(const rv of rivals){
        const vs=L.vMin+(L.vMax-L.vMin)*rv.skill;
        let vt;
        if(phase==="done"){ vt=vs; }
        else if(finalLap){ const err=(P.z+rv.base*.6)-rv.z, band=Math.max(-.15*L.vMax,Math.min(.15*L.vMax,err*.25)); vt=vs*(rv.style==="closer"?1.06:1)*.7+(P.v+band)*.3; }
        else { const off=rv.base+(rv.pack?650*Math.sin(now/6500+rv.ph):1200*Math.sin(now/9000+rv.ph));
          const err=(P.z+off)-rv.z, band=Math.max(-.4*L.vMax,Math.min(.4*L.vMax,err*(rv.pack?.9:.45)));
          vt=(P.v+band)*.78+vs*.22; if(rv.style==="sprinter"&&lapIdx===0) vt*=1.04; }
        if((rv.hunt||rv.attack)&&!rv.down&&phase==="race"&&P.state!=="down"){ const want=P.z+(rv.z>P.z?140:-140); vt=P.v+Math.max(-.35*L.vMax,Math.min(.35*L.vMax,(want-rv.z)*1.3));
          const adj=[P.lane-1,P.lane+1].filter(i=>i>=0&&i<3&&!gpObs.some(ob=>ob.lane===i&&ob.z>rv.z&&ob.z-rv.z<1500)); if(adj.length&&!adj.includes(rv.lane)) rv.lane=adj[0]; }
        if(now<(rv.stunUntil||0)) vt*=.55;
        if(rv.down){ if(now-rv.down.t<1900) vt=now-rv.down.t<1300?0:L.vMin*.4; else rv.down=null; }
        else if(now<rv.slowUntil&&!finalLap) vt=Math.min(vt,(vs+P.v)*.5);
        if(rv.maxShield&&rv.shield<rv.maxShield&&now-rv.shieldT>6000){ rv.shield++; rv.shieldT=now; }
        // riders can't pass through you either: stuck behind you in your lane
        if(Math.abs(rv.x-P.x)<.34&&P.z-rv.z>0&&P.z-rv.z<380&&vt>P.v) vt=P.v*.98;
        const lead=rivals.find(o=>o!==rv&&o.lane===rv.lane&&o.z>rv.z&&o.z-rv.z<300);
        if(lead){ const free=[0,1,2].filter(i=>i!==rv.lane&&!rivals.some(o=>o!==rv&&o.lane===i&&Math.abs(o.z-rv.z)<320)&&!gpObs.some(ob=>ob.lane===i&&ob.z>rv.z&&ob.z-rv.z<1400));
          if(free.length&&Math.random()<dt*3) rv.lane=free[Math.floor(Math.random()*free.length)]; else vt=Math.min(vt,lead.v); }
        rv.v+=((rv.down?vt:Math.max(L.vMin*.5,vt))-rv.v)*Math.min(1,dt*(rv.down?4:1.6)); rv.z=Math.min(FINZ+70*SEG,rv.z+rv.v*dt);
        if(lead&&rv.lane===lead.lane&&rv.z>lead.z-260) rv.z=lead.z-260;
        if(rv.finishT==null&&rv.z-GP.START>=gpLaps*GP.LAP_LEN) rv.finishT=Math.round(now);
        // lane choice at each gantry: dodge traffic, like nitro, blockers cut in front of you
        const ri=rows.findIndex(r=>r.z>rv.z); const rowIdx=ri<0?rows.length:ri;
        if(rowIdx!==rv.lastRow){ rv.lastRow=rowIdx; const r=rows[rowIdx]; if(r){ const sc=i=>(r.content[i]==="traffic"?-9:r.content[i]==="nitro"?1.2:0)+Math.random()*1.4;
            let b=rv.lane; for(let i=0;i<3;i++) if(sc(i)>sc(b)) b=i;
            if(rv.style==="blocker"&&rv.z>P.z&&rv.z-P.z<1600&&r.content[P.lane]!=="traffic") b=P.lane;
            rv.lane=b; } }
        // traffic sitting in its lane: riders swerve around it
        for(const ob of gpObs){ const dz=ob.z-rv.z; if(dz>0&&dz<1200&&ob.lane===rv.lane){ rv.lane=[0,1,2].find(i=>i!==ob.lane&&!gpObs.some(o=>o.lane===i&&Math.abs(o.z-ob.z)<200))??rv.lane; } }
        if(!rv.down){ rv.vx+=((LANE_X[rv.lane]-rv.x)*22-rv.vx*8.5)*Math.min(dt,.05); rv.x+=rv.vx*Math.min(dt,.05); }
        rv.lean+=((Math.max(-.45,Math.min(.45,rv.vx*.42)))-rv.lean)*Math.min(1,dt*8);
        if(!rv.down&&phase==="race"){ const lz=rv.z-P.z, lx=rv.x-P.x; if(lz>-700&&lz<120&&Math.abs(lx)>.35&&Math.abs(lx)<1.5){ P.lookDir=Math.sign(lx); P.lookUntil=now+500; } }
        // side by side contact: bikes bump and bounce apart
        if(!rv.down&&P.state!=="down"&&phase==="race"){ const dz=rv.z-P.z, dx=rv.x-P.x; if(Math.abs(dz)<230&&Math.abs(dx)<.3){ const d=Math.sign(dx)||1; rv.vx+=d*2.2; P.vx-=d*1.4; P.bump=2; shakeAmt=Math.max(shakeAmt,5); if(now-(rv.bumpT||0)>700){ rv.bumpT=now; Sound.noise(.06,.18); say(rv,["Oi!","Watch it!","Move!"]); } } }
        // overtakes trigger taunts
        const side=Math.sign(rv.z-P.z); if(phase==="race"&&rv.side&&side!==rv.side&&Math.abs(rv.z-P.z)<1500){ if(side>0) say(rv,SAY_PASS); else { say(rv,SAY_LOSE); Sound.noise(.08,.06); } }
        rv.side=side; if(rv.say&&now-rv.sayT>1300) rv.say=null;
      }
      if(phase==="race"){ const pl=gpPlace(); setText("posTxt",ord(pl)+" / 12");
        if(pl!==posCand.p){ posCand={p:pl,t:now}; }
        else if(pl!==lastPlace&&now-posCand.t>450&&now>2500){ posFlash={txt:`P${lastPlace} → P${pl}`,good:pl<lastPlace,t:now}; Sound.tone(pl<lastPlace?990:330,.07,"square",.035); lastPlace=pl; } }
    }
    gpUI();
  }
  function drawRow(x,y,w,S,r,isNow){
    const ht=S*1350*W/2; if(ht<4) return;
    const pw=Math.max(1.5,w*.03), top=y-ht, bh=ht*.24;
    ctx.fillStyle="#2b2a33"; ctx.fillRect(x-w*1.2-pw/2,top,pw,ht); ctx.fillRect(x+w*1.2-pw/2,top,pw,ht); ctx.fillRect(x-w*1.2,top-bh*.18,w*2.4,bh*.18);
    for(let i=0;i<3;i++){
      const cx=x+LANE_X[i]*w, bw=w*.6;
      const chosen=r.state===1&&r.chosen===i, faded=r.state===1&&!chosen, missed=r.state===-1;
      const col=chosen?"#36b862":missed?"#e0392b":faded?"#8f8a96":isNow?"#fff4e2":"#d8d2c6";
      ctx.fillStyle="#1b1b22"; rr(ctx,cx-bw/2-2,top-2,bw+4,bh+4,5); ctx.fill();
      ctx.fillStyle=col; rr(ctx,cx-bw/2,top,bw,bh,4); ctx.fill();
      const tg=r.content[i]; if(isNow&&bh>10){ ctx.fillStyle=tg==="nitro"?"#ffd23f":tg==="traffic"?"#e0392b":"#3ec1d3"; ctx.fillRect(cx-bw/2,top+bh-bh*.14,bw,bh*.14); }
      const txt=(chosen?"✓ ":"")+r.words[i];
      let fs=bh*.56; ctx.font=`bold ${fs}px 'Atkinson Hyperlegible', Verdana, sans-serif`; const tw=ctx.measureText(txt).width; if(tw>bw*.92){ fs*=bw*.92/tw; ctx.font=`bold ${fs}px 'Atkinson Hyperlegible', Verdana, sans-serif`; }
      if(fs>=4){ ctx.fillStyle=chosen||missed?"#fff":faded?"#d8d2c6":"#1b1b22"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,cx,top+bh*.47); }
      if(isNow&&i===P.lane&&bh>12){ ctx.strokeStyle="#ffd23f"; ctx.lineWidth=3; rr(ctx,cx-bw/2-6,top-6,bw+12,bh+12,8); ctx.stroke(); }
    }
  }
  function bubble(x,y,txt,h){ const fs=Math.max(11,Math.min(18,h*.13)); ctx.font=`bold ${fs}px 'Atkinson Hyperlegible', Verdana, sans-serif`; const tw=ctx.measureText(txt).width+14;
    x=Math.max(tw/2+4,Math.min(W-tw/2-4,x)); ctx.fillStyle="#fff"; ctx.strokeStyle="#1b1b22"; ctx.lineWidth=2; rr(ctx,x-tw/2,y-fs*1.7,tw,fs*1.7,8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-5,y); ctx.lineTo(x+5,y); ctx.lineTo(x,y+7); ctx.closePath(); ctx.fill(); ctx.fillStyle="#1b1b22"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(txt,x,y-fs*.85); }
  function drawGPHud(){
    for(const pr of projs){ const k=Math.min(1,(now-pr.t0)/pr.dur), sx=CX+(P.swipeDir||1)*20, sy=H*.62, tx=pr.rv._sx!=null?pr.rv._sx:CX, ty=pr.rv._sy!=null?pr.rv._sy:H*.5;
      const x=sx+(tx-sx)*k, y=sy+(ty-sy)*k-Math.sin(k*Math.PI)*H*.18, r=Math.max(5,18*(1-k*.7));
      ctx.fillStyle="#6b4423"; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.strokeStyle="#3a2412"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r*.6,k*12,k*12+2); ctx.stroke(); }
    if(comment&&now-comment.t<2300&&phase==="race"){ const a=Math.min(1,(2300-(now-comment.t))/300); ctx.globalAlpha=a; const f=Math.round(Math.max(13,Math.min(18,W*.02)));
      ctx.font=`bold ${f}px 'Atkinson Hyperlegible', Verdana, sans-serif`; const tw=ctx.measureText(comment.txt).width+26, cy2=H-f-30;
      ctx.fillStyle="rgba(15,13,20,.8)"; rr(ctx,W/2-tw/2,cy2,tw,f+14,10); ctx.fill(); ctx.fillStyle="#ff6a1a"; ctx.fillRect(W/2-tw/2+8,cy2+5,3,f+4);
      ctx.fillStyle="#fff4e2"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(comment.txt,W/2+4,cy2+(f+14)/2); ctx.globalAlpha=1; }
    // gaps to the riders around you
    const ahead=rivals.filter(r=>r.z>P.z&&r.finishT==null).sort((a,b)=>a.z-b.z)[0], behind=rivals.filter(r=>r.z<=P.z&&r.finishT==null).sort((a,b)=>b.z-a.z)[0];
    const v=Math.max(P.v,1500); const fs=Math.round(Math.max(12,Math.min(16,W*.018)));
    ctx.font=`bold ${fs}px 'Atkinson Hyperlegible', Verdana, sans-serif`; ctx.textBaseline="middle";
    const cy=W<600?36+Math.round(Math.max(28,W*.05))+34:34;
    const chip=(txt,x,col,align)=>{ const tw=ctx.measureText(txt).width+16; const x0=align==="right"?x-tw:x; ctx.fillStyle="rgba(15,13,20,.72)"; rr(ctx,x0,cy,tw,fs+12,8); ctx.fill(); ctx.fillStyle=col; ctx.textAlign="left"; ctx.fillText(txt,x0+8,cy+(fs+12)/2); };
    const gapTxt=dz=>{ const t=dz/v; return t<.1?"side by side":t.toFixed(1)+"s"; };
    if(phase==="race"&&W>=600){ if(ahead) chip(`▲ ${ahead.name} ${gapTxt(ahead.z-P.z)}`,W/2+6,"#ffd23f","left"); if(behind) chip(`▼ ${behind.name} ${gapTxt(P.z-behind.z)}`,W/2-6,"#fff4e2","right"); }
    if(draft>=1.2&&phase==="race"&&W>=600){ const t="SLIPSTREAM · READ TO SLINGSHOT"; const tw=ctx.measureText(t).width+16; ctx.fillStyle=draft>=1.2?"#3ec1d3":"rgba(15,13,20,.72)"; rr(ctx,W/2-tw/2,cy+fs+18,tw,fs+10,8); ctx.fill(); ctx.fillStyle=draft>=1.2?"#1b1b22":"#9fe6ef"; ctx.textAlign="center"; ctx.fillText(t,W/2,cy+fs+18+(fs+10)/2); }
    if(posFlash&&now-posFlash.t<1100){ const k=(now-posFlash.t)/1100; ctx.globalAlpha=1-k*k; ctx.font=`italic ${Math.round(Math.max(22,W*.034))}px 'Racing Sans One','Arial Black',sans-serif`; ctx.textAlign="left"; ctx.textBaseline="top";
      const yy=W<600?cy+fs+20:36+Math.round(Math.max(28,W*.05))+6; ctx.lineWidth=5; ctx.strokeStyle="#1b1b22"; ctx.strokeText(posFlash.txt,16,yy); ctx.fillStyle=posFlash.good?"#3cff6a":"#ff6a5a"; ctx.fillText(posFlash.txt,16,yy); ctx.globalAlpha=1; }
  }

  /* ---------- text + UI ---------- */
  const lastTxt={};
  function setText(k,v){ const el=$u(k); if(!el) return; if(lastTxt[k]!==v){ lastTxt[k]=v; el.textContent=v; } }
  let popTimer=null;
  function pop(txt,ms=800,cls=""){ const p=$u("pop"); if(!p) return; p.className="pop "+cls; p.textContent=txt; clearTimeout(popTimer); if(ms) popTimer=setTimeout(()=>{p.textContent="";},ms); }
  function renderVeil(){ const p=$u("para"); if(!p) return; p.innerHTML=""; const v=document.createElement("span"); v.className="veil";
    words.slice(0,40).forEach(w=>{const i=document.createElement("i"); i.style.width=Math.min(140,w.length*12+10)+"px"; v.appendChild(i);}); p.appendChild(v); }
  function renderPara(){ const p=$u("para"); if(!p) return; p.innerHTML=""; spans=[];
    words.forEach(w=>{const s=document.createElement("span"); s.className="w"; s.textContent=w; spans.push(s); p.appendChild(s); p.appendChild(document.createTextNode(" "));}); paintWords(); }
  function paintWords(from=0){ for(let i=Math.max(0,from);i<spans.length;i++){ let c="w";
    if(i<idx) c+=status[i]==="miss"?" done miss":" done"; else if(i===idx){ c+=" cur"; if(acts[i]) c+=" act-"+acts[i].type; } if(spans[i].className!==c) spans[i].className=c; } }
  function shakeWord(i){ const s=spans[i]; if(!s) return; s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake"); }
  const zOfWord=k=>START_Z+(k/words.length)*RACE_LEN;
  let lastArc=-1,lastNitro=-1;
  function dashUpdate(kmh){
    setText("kmh",String(kmh));
    const arc=$u("arc"); if(arc){ const a=Math.round(Math.min(100,kmh/260*100)); if(a!==lastArc){ lastArc=a; arc.setAttribute("stroke-dasharray",a+" 100"); } }
    const nb=$u("nitroBar"); if(nb){ const n=phase==="race"?streak%10:0; if(n!==lastNitro){ lastNitro=n; nb.style.width=(n*10)+"%"; setText("streakTxt",n+"/10"); } }
    const nw=$u("nitroWrap"); if(nw) nw.classList.toggle("full",P.boostUntil>now&&phase==="race");
  }

  /* ---------- judging ---------- */
  function advance(asMiss){
    status[idx]=asMiss?"miss":"ok"; if(asMiss||fails>0) trouble.add(idx); if(!asMiss) correctCount++;
    const a=acts[idx]; if(a&&a.type==="dodge") a.ob.cleared=true; if(a&&a.type==="swipe") a.r.bound=-1;
    const was=idx; idx++; fails=0; lastProgressT=now; P.target=zOfWord(idx); paintWords(was);
  }
  function sparks(n,x,y){ for(let i=0;i<n;i++) parts.push({x,y,vx:(Math.random()-.5)*520,vy:-Math.random()*380-60,life:1,k:"spark"}); }
  function dust(n,x,y){ for(let i=0;i<n;i++) parts.push({x,y,vx:(Math.random()-.5)*160,vy:-Math.random()*60,life:1,k:"dust",r:4+Math.random()*8}); }
  function crash(label){ P.state="crash"; P.until=now+950; P.crashT=now; P.v*=.15; streak=0; shakeAmt=16; pop(label,700); Sound.noise(.35,.32); sparks(26,CX,H-12); }
  function skid(label){ P.state="skid"; P.until=now+520; P.z=Math.max(START_Z,P.z-260); P.v*=.4; streak=0; shakeAmt=7; pop(label,600); Sound.tone(500,.2,"triangle",.05,-300); dust(10,CX,H-8); }
  function siren(){ [0,300,600].forEach(d=>setTimeout(()=>{Sound.tone(880,.14,"triangle",.04); setTimeout(()=>Sound.tone(660,.14,"triangle",.04),150);},d)); }
  function cop(){ P.copUntil=now+3500; pop("GRAMMAR COP!",800,"small"); siren(); }
  function judge(h,next,final,last){
    if(phase!=="race"||idx>=words.length) return 0;
    if(!h||FILLER.has(h)) return 1;
    const w=keys[idx];
    if(isMatch(h,w)){ ok(); return 1; }
    if(next&&sim(h+next,w)>=.75){ ok(); return 2; }
    if(!final&&last&&w.length>=5&&h.length>=Math.max(4,Math.ceil(w.length*.6))&&w.startsWith(h)){ ok(); return 1; }
    if(idx>0&&sim(h,keys[idx-1])>=.8) return 1;
    for(let k=1;k<=2&&idx+k<words.length;k++){
      if(sim(h,keys[idx+k])>=.8&&keys[idx+k].length>=2){
        const allShort=keys.slice(idx,idx+k).every(s=>s.length<=3);
        if(!final&&!allShort) return 0;
        for(let j=0;j<k;j++) advance(!allShort);
        if(!allShort) cop();
        ok(); return 1;
      }
    }
    if(!final) return 0;
    attemptCount++; fails++; shakeWord(idx);
    const a=acts[idx];
    if(fails>=3){ advance(true); cop(); return 1; }
    if(a&&a.type==="dodge"){ crash("BONK!"); Sound.tone(440,.12,"square",.05); setTimeout(()=>Sound.tone(440,.18,"square",.05),160); }
    else if(a&&a.type==="swipe") skid("SWIPED!");
    else sim(h,w)>=UNCLEAR ? skid("SKID!") : crash("CRASH!");
    return 1;
    function ok(){
      attemptCount++; const a=acts[idx], fixed=fails>0; advance(false); streak++;
      if(a&&a.type==="swipe") doSwipe(a.r);
      else if(a&&a.type==="dodge"){ dodges++; Sound.tone(700,.08,"square",.04,200); Sound.noise(.15,.08); }
      if(fixed){ P.boostUntil=now+1100; if(!a) pop("NICE SAVE!",600); }
      else if(streak%10===0){ P.boostUntil=now+2000; shakeAmt=5; pop("NITRO!",700,"go"); Sound.tone(220,.5,"sawtooth",.05,500); }
    }
  }
  function doSwipe(r){ swipes++; P.swipeT=now; lastSwipeIdx=idx; lastSwipeT=now; r.knockDir=Math.sign(r.x)||1; P.swipeDir=r.knockDir; r.stunUntil=now+1700; r.knockT=now; r.penalty+=3;
    shakeAmt=9; bursts.push({x:CX+r.knockDir*W*.26,y:H*.6,t:0,dir:r.knockDir}); pop("SWIPE!",600,"go"); Sound.noise(.12,.35); Sound.tone(160,.15,"square",.06,-80); }

  /* ---------- voice hookup for the race ---------- */
  let consumed=[];
  function voiceHandler(e){
    if(e.reset){ consumed=[]; return; }
    let shown="";
    for(let r=e.resultIndex;r<e.results.length;r++){ const res=e.results[r], txt=res[0].transcript; shown=txt;
      const toks=txt.trim().split(/\s+/).map(norm).filter(Boolean);
      if(phase!=="race"){ consumed[r]=toks.length; continue; }
      let c=consumed[r]||0;
      while(c<toks.length){ const lastTok=!res.isFinal&&c===toks.length-1; const used=gp?gpJudge(toks[c],res.isFinal,lastTok):judge(toks[c],toks[c+1],res.isFinal,lastTok); if(!used) break; c+=used; }
      consumed[r]=c; }
    if(shown) setText("heard","Heard: "+shown);
  }

  /* ---------- race setup ---------- */
  function placeObstacles(){
    obstacles=[]; const types=["auto","cow","truck","bus","barrel","auto","cow"]; let k=4, n=0;
    while(k<words.length-2){ const side=n%2?-.68:.68, z=zOfWord(k)+(RACE_LEN/words.length)*.62;
      const s=segs[Math.floor(z/SEG)]; const type=s&&s.bridge&&types[n%types.length]==="cow"?"auto":types[n%types.length];
      const ob={k,type,z,side,cleared:false}; obstacles.push(ob); acts[k]={type:"dodge",ob}; n++; k+=5+((k*7)%4); }
  }
  function load(lg,ri){
    league=lg; raceIdx=ri; apWpm=LEAGUES[league].demo;
    const R=RACES[raceIdx]; segs=buildRoad(raceIdx+1,R.bridge,DRAW);
    const text=o.text||R[league]; words=text.split(/\s+/).filter(Boolean); keys=words.map(norm);
    status=words.map(()=>"todo"); trouble=new Set(); acts=new Array(words.length).fill(null);
    idx=0; fails=0; correctCount=0; attemptCount=0; streak=0; swipes=0; dodges=0; finishT=null; lights=0;
    Object.assign(P,{z:START_Z,target:START_Z,v:0,x:0,lean:0,state:"ride",until:0,boostUntil:0,swipeT:-9999,copUntil:0});
    const paces=LEAGUES[league].paces; lastSwipeIdx=-9; lastSwipeT=-9999;
    riders=RIVALS.map((r,i)=>({...r,z:START_Z+(i===2?520:260),z0:(i===2?520:260),x:r.lane,pace:paces[i],penalty:0,stunUntil:0,knockT:-99999,knockDir:1,bound:-1,finishT:null,wob:Math.random()*6}));
    placeObstacles(); skyOff=0; parts=[]; bursts=[]; shakeAmt=0; phase="idle";
    setText("heard",""); setText("timeChip","0.0s"); setText("wpmChip","0 wpm"); setText("posTxt","–");
    renderVeil();
  }
  function countdown(){
    Sound.wake(); Sound.engineOn(); phase="countdown";
    ["3","2","1"].forEach((t,i)=>setTimeout(()=>{ if(phase!=="countdown") return; lights=i+1; pop(t,0); Sound.tone(440,.15,"square",.06); },i*700));
    setTimeout(()=>{ if(phase!=="countdown") return; lights=4; pop("RASH!",650,"go"); Sound.tone(880,.35,"square",.07); go(); },2100);
  }
  function go(){ phase="race"; t0=performance.now(); now=0; lastProgressT=0; apNext=600; renderPara(); if(gp) gpUI(true); emit("go"); }
  function placeOf(){ let p=1; riders.forEach(r=>{ if(r.finishT!=null ? (finishT==null||r.finishT<finishT) : r.z>P.z) p++; }); return p; }
  function finish(stopped){
    if(phase==="done") return;
    phase="done"; if(!stopped&&finishT!=null) P.target=FINZ+3000;
    if(gp){ gpUI(true); const tot=finishT??Math.round(now), lapTimes=splits.map((t,i)=>t-(i?splits[i-1]:0)), place=finishT!=null?gpPlace():null;
      const missedRows=rows.filter(r=>r.state===-1), signsN=rows.length;
      const res={mode:"gp",stopped:!!stopped,place,timeMs:tot,splits:splits.slice(),lapTimes,best:lapTimes.length?Math.min(...lapTimes):null,signs:signsN,correct:correctCount,wrong:gpWrong,missed:gpMissed,
        crashes,kos,blocks,hitsTaken,acc:signsN?Math.round(correctCount/signsN*100):0,wpm:Math.round(correctCount/(tot/60000)||0),
        trouble:[...new Set(missedRows.map(r=>r.words[r.content.indexOf("nitro")>=0?r.content.indexOf("nitro"):1]))].slice(0,12),league,laps:gpLaps,
        podium:[{name:"YOU",t:finishT,me:true},...rivals.map(r=>({name:r.name,t:r.finishT??(Math.round(now)+Math.round((GP.START+gpLaps*GP.LAP_LEN-r.z)/Math.max(r.v,1)*1000))}))].sort((a,b)=>(a.t??1e12)-(b.t??1e12))};
      if(place&&place<=3) [523,659,784,1046].forEach((f,i)=>setTimeout(()=>Sound.tone(f,.18,"square",.06),i*110));
      setTimeout(()=>Sound.engineOff(),1500); emit("finish",res); return; }
    const secs=(finishT??now)/1000, place=finishT!=null?placeOf():null;
    const res={ stopped:!!stopped, place, timeMs:Math.round(finishT??now), words:words.length, correct:correctCount, attempts:attemptCount,
      wpm:Math.round(correctCount/(secs/60)||0), acc:attemptCount?Math.round(correctCount/attemptCount*100):0, swipes, dodges,
      trouble:[...new Set(words.filter((w,i)=>trouble.has(i)).map(w=>w.replace(/[^A-Za-z0-9'’-]/g,"")))],
      podium:[{name:"YOU",t:finishT,me:true},...riders.map(r=>({name:r.name,t:r.finishT}))].sort((a,b)=>(a.t??1e12)-(b.t??1e12)),
      league, race:raceIdx };
    if(place===1) [523,659,784,1046].forEach((f,i)=>setTimeout(()=>Sound.tone(f,.18,"square",.06),i*110));
    else if(place) [392,330].forEach((f,i)=>setTimeout(()=>Sound.tone(f,.22,"triangle",.07),i*180));
    setTimeout(()=>Sound.engineOff(),1500);
    emit("finish",res);
    if(attract) setTimeout(()=>{ if(!running) return; load(league,(raceIdx+1)%RACES.length); lights=4; go(); },2600);
  }

  /* ---------- simulation ---------- */
  const segAt=z=>segs[Math.max(0,Math.min(segs.length-1,Math.floor(z/SEG)))];
  const roadY=z=>{ const s=segAt(z), p=(z%SEG)/SEG; return s.p1.wy+(s.p2.wy-s.p1.wy)*p; };
  function update(dt){
    if(gp){ updateGP(dt); }
    else if(phase==="race"){
      now=performance.now()-t0; const total=words.length;
      if(autopilot&&idx<total&&now>=apNext){ const w=keys[idx]; judge(w,null,true,false); apNext=now+(60000/apWpm)*(.55+Math.random()*.7)*(w.length>6?1.25:1); }
      riders.forEach(r=>{
        if(r.finishT!=null) return;
        const prog=Math.max(0,(r.pace/60*(now/1000)-r.penalty+Math.sin(now/1300+r.wob)*.6)/total);
        const tz=START_Z+r.z0+prog*RACE_LEN;
        if(now-r.knockT<1000){ const k=(now-r.knockT)/1000; r.z=P.z+600-k*520; }
        else if(r.bound>=0&&r.bound===idx){ const bz=P.z+600; r.z+=(bz-r.z)*Math.min(1,dt*3); }
        else if(now>r.stunUntil){ const nv=Math.max(0,tz-r.z); r.z+=Math.min(nv,RACE_LEN/4*dt); }
        if(r.z>=FINISH_Z) r.finishT=now;
        const want=r.bound>=0?Math.sign(r.lane)*.34:r.lane;
        if(now-r.knockT>1000) r.x+=(want-r.x)*Math.min(1,dt*2.5);
      });
      if(idx<total-1&&idx>=2&&!acts[idx]&&idx-lastSwipeIdx>=4&&now-lastSwipeT>2000){
        const r=riders.find(r=>r.bound<0&&r.finishT==null&&now>r.stunUntil+600&&r.z-P.z>-300&&r.z-P.z<2600);
        if(r){ acts[idx]={type:"swipe",r}; r.bound=idx; paintWords(idx); if(autopilot) apNext=Math.max(apNext,now+900); }
      }
      { const a=acts[idx]; if(autopilot&&a&&a.type==="dodge"&&a.ob.z-P.z>2600) apNext=Math.max(apNext,now+120); }
      if((P.state==="crash"||P.state==="skid")&&now>P.until) P.state="ride";
      if(P.state==="ride"){
        const vmax=RACE_LEN/(P.boostUntil>now?3:4.6), gap=P.target-P.z, want=Math.min(vmax,Math.max(0,gap*3.4));
        P.v+=(want-P.v)*Math.min(1,dt*7.5); P.z=Math.min(P.target,P.z+P.v*dt);
      } else P.v*=Math.pow(.2,dt);
      if(idx>=total&&P.z>=FINISH_Z-1&&finishT==null){ finishT=now; finish(false); }
      setText("timeChip",(now/1000).toFixed(1)+"s");
      const mins=now/60000; setText("wpmChip",(mins>.05?Math.round(correctCount/mins):0)+" wpm");
      setText("posTxt",ord(placeOf())+" / 4");
    } else if(phase==="done"&&finishT!=null){
      P.v=Math.max(0,P.v-P.v*dt*.8); if(P.z<FINZ+2500) P.z+=Math.max(600,P.v)*dt;
    } else if(phase==="countdown"||phase==="idle"){ now=0; }
    if(gp&&(phase==="countdown"||phase==="idle")) now=0;
    let tx=gp?LANE_X[P.lane]:0; obstacles.forEach(ob=>{ const d=ob.z-P.z; if(ob.cleared&&d<1500&&d>-500) tx=ob.side; });
    // steering has weight: a spring pulls the bike to its line, the rider leans with sideways speed and with the curve
    P.vx=P.vx||0; P.vx+=((tx-P.x)*34-P.vx*10.5)*Math.min(dt,.05); P.x+=P.vx*Math.min(dt,.05);
    const s=segAt(P.z), sp=P.v/VREF;
    const leanT=Math.max(-.55,Math.min(.55,P.vx*.42+s.curve*sp*.075));
    P.lean+=(leanT-P.lean)*Math.min(1,dt*9);
    P.bump=(P.bump||0)*Math.pow(.02,dt); P.bob=Math.sin(performance.now()/38)*Math.min(1,sp)*1.1+P.bump*Math.sin(performance.now()/22);
    tilt+=((-s.curve*sp*.013)-tilt)*Math.min(1,dt*4);
    skyOff+=s.curve*sp*dt*.012; skyOff=Math.max(-1.2,Math.min(1.2,skyOff));
    shakeAmt*=Math.pow(.02,dt);
    if(phase==="race"&&P.state==="ride"&&P.v>VREF*.55&&Math.random()<dt*28) dust(1,CX+(Math.random()-.5)*20,H-6);
    parts.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=(p.k==="spark"?900:-20)*dt; p.life-=dt*(p.k==="spark"?1.6:1.4); if(p.k==="dust") p.r+=dt*14; });
    parts=parts.filter(p=>p.life>0);
    bursts.forEach(b=>b.t+=dt); bursts=bursts.filter(b=>b.t<.5);
    dashUpdate(gp?Math.round(P.v/VREF*210):Math.min(260,Math.round(P.v*.03)));
    if(Sound.eng){ const f=40+P.v*.011; Sound.eng.o.frequency.value=f; Sound.eng.o2.frequency.value=f*.5; }
  }

  /* ---------- rendering ---------- */
  function resize(){
    const r=cv.getBoundingClientRect(); W=Math.max(280,Math.round(r.width));
    if(o.fill){ H=Math.max(200,Math.round(r.height)); } else { H=Math.round(Math.max(230,Math.min(480,W*.53))); cv.style.height=H+"px"; }
    const maxPx=attract?1.25:1.75; dpr=Math.min(quality>0?maxPx:1,window.devicePixelRatio||1);
    if(attract&&W*dpr>1600) dpr=1600/W;
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); HY=Math.round(H*(o.horizon||.4)); CX=Math.round(W*(o.cx&&W>760?o.cx:.5));
    buildSky(); buildVignette();
  }
  function buildSky(){
    const w=Math.round(W*1.6), h=Math.round(HY+H*.25); skyC=mk(w,h); const g=skyC.getContext("2d");
    const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,TH.sky[0]); gr.addColorStop(.6,TH.sky[1]); gr.addColorStop(1,TH.sky[2]); g.fillStyle=gr; g.fillRect(0,0,w,h);
    let s=9; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
    for(let i=0;i<10;i++){ const x=rnd()*w, y=h*(.1+rnd()*.38), sc=22+rnd()*34; g.fillStyle="rgba(255,255,255,.8)";
      for(let j=0;j<5;j++){ g.beginPath(); g.ellipse(x+(j-2)*sc*.8,y+Math.sin(j)*sc*.2,sc,sc*.45,0,0,7); g.fill(); } g.fillStyle="rgba(200,225,240,.5)"; g.beginPath(); g.ellipse(x,y+sc*.25,sc*2,sc*.22,0,0,7); g.fill(); }
  }
  function buildVignette(){ vignC=mk(W,H); const g=vignC.getContext("2d"); const gr=g.createRadialGradient(W/2,H*.55,Math.min(W,H)*.35,W/2,H*.55,Math.max(W,H)*.75);
    gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(10,20,30,.28)"); g.fillStyle=gr; g.fillRect(0,0,W,H); }
  const fogCache=new Map();
  function fogC(hex,f){ const lv=Math.min(15,Math.floor(f*16)); const key=hex+lv; let v=fogCache.get(key); if(v) return v;
    const a=parseInt(hex.slice(1),16), b=parseInt(TH.fog.slice(1),16), t=lv/16*.9;
    const m=(x,y)=>Math.round(x+(y-x)*t); v=`rgb(${m(a>>16,b>>16)},${m((a>>8)&255,(b>>8)&255)},${m(a&255,b&255)})`; fogCache.set(key,v); return v; }
  function project(p,camX,camY,camZ){ const cz=p.wz-camZ; p.cz=cz; p.s=camDepth/cz; p.x=CX+p.s*(-camX)*W/2; p.y=HY+p.s*(camY-p.wy)*(H-HY); p.w=p.s*RW*W/2; }
  function quad(x1,y1,w1,x2,y2,w2,c){ y1+=1; ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(x1-w1,y1); ctx.lineTo(x2-w2,y2); ctx.lineTo(x2+w2,y2); ctx.lineTo(x1+w1,y1); ctx.closePath(); ctx.fill(); }
  function band(a1,b1,y1,a2,b2,y2,c){ y1+=1; ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(a1,y1); ctx.lineTo(a2,y2); ctx.lineTo(b2,y2); ctx.lineTo(b1,y1); ctx.closePath(); ctx.fill(); }
  function drawSky(){
    ctx.drawImage(skyC,-W*.3-skyOff*W*.25,-H*.12,skyC.width,skyC.height);
    const sx=W*.72-skyOff*W*.2, sy=HY*.32, sr=HY*.12;
    const gl=ctx.createRadialGradient(sx,sy,sr*.5,sx,sy,sr*3.5); gl.addColorStop(0,hexA(TH.sun,.6)); gl.addColorStop(1,hexA(TH.sun,0)); ctx.fillStyle=gl; ctx.fillRect(sx-sr*4,sy-sr*4,sr*8,sr*8);
    ctx.fillStyle=TH.sun; ctx.beginPath(); ctx.arc(sx,sy,sr,0,7); ctx.fill();
    // sea to the horizon on the left, Sahyadri hills on the right
    const edge=Math.max(-W*.1,Math.min(W*.75,W*.42-skyOff*W*.6));
    ctx.fillStyle=TH.sea[1]; ctx.fillRect(-W,HY-3,W*3,6);
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.fillRect(-W,HY-3,W*3,1);
    [[.25,.5],[.5,.38],[.85,.24]].forEach(([par,hgt],l)=>{
      ctx.fillStyle=TH.ridge[l]; ctx.beginPath(); const x0=edge+l*W*.04; ctx.moveTo(x0,HY+2); const step=W/18, off=skyOff*W*par;
      for(let i=0;i<30;i++){ const xx=x0+i*step-((off%step)+step)%step; if(xx<x0) continue; const k=(((Math.floor((i*step+off)/step))%64)+64)%64; const ramp=Math.min(1,(xx-x0)/(W*.18)); ctx.lineTo(xx,HY-ridges[l][k]*HY*hgt*ramp); }
      ctx.lineTo(W*1.4,HY+2); ctx.closePath(); ctx.fill(); });
  }
  let maxyRoad=0;
  function drawRoad(){
    const camZ=P.z-playerZ, camY=CAMH+roadY(P.z), camXw=P.x*RW;
    const base=Math.max(0,Math.min(segs.length-DRAW-1,Math.floor(camZ/SEG))), pct=(camZ%SEG)/SEG; let dx=-(segs[base].curve*pct), x=0, maxy=H;
    const L0=-W*.5, R0=W*1.5;
    for(let n=0;n<DRAW;n++){ const s=segs[base+n]; if(!s) break;
      project(s.p1,camXw-x,camY,camZ); project(s.p2,camXw-x-dx,camY,camZ); x+=dx; dx+=s.curve; s.clip=maxy;
      s.vis=!(s.p1.cz<=camDepth||s.p2.y>=s.p1.y||s.p2.y>=maxy);
      if(!s.vis) continue;
      const {x:x1,y:y1,w:w1}=s.p1, {x:x2,y:y2,w:w2}=s.p2, b=s.band, f=Math.pow(n/DRAW,1.5);
      if(s.bridge){
        ctx.fillStyle=fogC(TH.sea[b],f); ctx.fillRect(L0,y2,R0-L0,y1-y2+1);
        if(n%4===0){ ctx.fillStyle="rgba(255,255,255,.25)"; ctx.fillRect(x1-w1*3.2,y1-1,w1*.7,1.5); ctx.fillRect(x1+w1*2.4,y1-1,w1*.6,1.5); }
        quad(x1,y1,w1*1.22,x2,y2,w2*1.22,fogC(TH.deck[b],f));
      } else {
        ctx.fillStyle=fogC(TH.grass[b],f); ctx.fillRect(L0,y2,R0-L0,y1-y2+1);
        band(L0,x1-w1*2.25,y1,L0,x2-w2*2.25,y2,fogC(TH.sea[b],f));
        band(x1-w1*2.25,x1-w1*1.3,y1,x2-w2*2.25,x2-w2*1.3,y2,fogC(TH.sand[b],f));
        band(x1-w1*2.25,x1-w1*2.12,y1,x2-w2*2.25,x2-w2*2.12,y2,fogC(TH.foam,f));
        if(n%5===0){ ctx.fillStyle="rgba(255,255,255,.22)"; ctx.fillRect(x1-w1*(3.2+(s.i%3)*.6),y1-1,w1*.5,1.5); }
        quad(x1,y1,w1*1.32,x2,y2,w2*1.32,fogC(TH.shoulder,f));
      }
      quad(x1,y1,w1*1.12,x2,y2,w2*1.12,fogC(TH.rumble[b],f));
      quad(x1,y1,w1,x2,y2,w2,fogC(TH.road[b],f));
      if(b){ const l1=w1/42,l2=w2/42, lc=fogC(TH.lane,f); quad(x1-w1/3,y1,l1,x2-w2/3,y2,l2,lc); quad(x1+w1/3,y1,l1,x2+w2/3,y2,l2,lc); }
      quad(x1-w1*.97,y1,w1/60,x2-w2*.97,y2,w2/60,fogC(TH.lane,f)); quad(x1+w1*.97,y1,w1/60,x2+w2*.97,y2,w2/60,fogC(TH.lane,f));
      if(s.gantry){ const hgt=Math.max(2,(y1-y2)*.6); for(let c=0;c<10;c++){ const cw=(w1*2)/10; ctx.fillStyle=c%2?"#1b1b22":"#fff4e2"; ctx.fillRect(x1-w1+c*cw,y1-hgt,cw+1,hgt); } }
      maxy=y2;
    }
    maxyRoad=maxy; return base;
  }
  function clipBelow(y){ ctx.save(); ctx.beginPath(); ctx.rect(-W,-H,W*3,y+H); ctx.clip(); }
  function drawSprites(base){
    const dyn={};
    const put=(z,d)=>{ const i=Math.floor(z/SEG); (dyn[i]=dyn[i]||[]).push(Object.assign(d,{pct:(z%SEG)/SEG})); };
    obstacles.forEach(ob=>put(ob.z,{t:ob.type,ob}));
    riders.forEach(r=>put(r.z,{t:"rider",r}));
    if(gp){ const cr=nextPending(), crOpen=cr&&cr===curRow(), far=P.z+DRAW*SEG, near=P.z-500;
      rows.forEach(r=>{ if(r.z>near&&r.z<far) put(r.z,{t:"row",r,isNow:r===cr&&crOpen}); });
      gpObs.forEach(ob=>{ if(ob.z>near&&ob.z<far) put(ob.z,{t:ob.type,gob:ob}); });
      gpNitro.forEach(nz=>{ if(!nz.taken&&nz.z>near&&nz.z<far) put(nz.z,{t:nz.kind==="book"?"bookpick":nz.kind==="coconut"?"coco":"nitro",nz}); });
      rivals.forEach(rv=>{ if(rv.z>P.z-700&&rv.z<far) put(rv.z,{t:"rival",rv}); }); }
    for(let n=DRAW-1;n>=1;n--){ const s=segs[base+n]; if(!s||s.p1.cz<=camDepth) continue;
      const sc=s.p1.s, far=n/DRAW, alpha=far>.7?1-(far-.7)/.3*.8:1;
      if(alpha<1) ctx.globalAlpha=alpha;
      if(s.gantry) drawGantry(s,s.gantry);
      for(const sp of s.sprites){
        const h=sc*WH[sp.t]*W/2; if(h<1.5) continue;
        const S=getSprite(sp.t,sp), w=h*S.aspect, X=s.p1.x+sc*sp.off*RW*W/2, Y=s.p1.y;
        if(X+w<-W*.3||X-w>W*1.3) continue;
        const clip=Y>s.clip; if(clip) clipBelow(s.clip);
        ctx.drawImage(S.c,X-w/2,Y-h,w,h);
        if(sp.t==="mile"&&h>22){ ctx.fillStyle="#1b1b22"; ctx.font=`bold ${Math.round(h*.24)}px Verdana,sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(sp.text,X,Y-h*.4); }
        if(clip) ctx.restore();
      }
      const list=dyn[s.i]; if(list) for(const d of list){
        const X0=s.p1.x+(s.p2.x-s.p1.x)*d.pct, Y=s.p1.y+(s.p2.y-s.p1.y)*d.pct, S=s.p1.s+(s.p2.s-s.p1.s)*d.pct, wpx=S*RW*W/2;
        const clip=Y>s.clip; if(clip) clipBelow(s.clip);
        if(d.t==="row"){ drawRow(X0,Y,wpx,S,d.r,d.isNow); }
        else if(d.gob||d.nz){ const lx=d.gob?d.gob.lane:d.nz.lane, h=S*WH[d.t]*W/2; if(h>=1.5){ const Sp=getSprite(d.t,{}), w=h*Sp.aspect, xx=X0+LANE_X[lx]*wpx;
            if(d.nz){ const pulse=1+.08*Math.sin(performance.now()/120); glow(xx,Y-h*.5,h*1.1*pulse,d.nz.kind==="nitro"?"rgba(62,193,211,.45)":"rgba(255,210,63,.45)"); }
            ctx.drawImage(Sp.c,xx-w/2,Y-h,w,h); } }
        else if(d.t==="rival"){ const rv=d.rv, h=S*WH.bike*W/2; if(h>2){ let rot=0; const kt=now-rv.knockT;
            if(kt<600){ rot=Math.sin(kt/600*Math.PI)*.35*rv.knockDir; }
            const sk=now-rv.swipeT, swing=sk<420?sk/420:0, xx=X0+rv.x*wpx, sdir=Math.sign(P.x-rv.x)||1;
            const windup=rv.attack?Math.min(1,(now-rv.attack.t0)/1300):0;
            const down=rv.down?{k:(now-rv.down.t)/1900,dir:rv.down.dir}:null;
            rv._sx=xx; rv._sy=Y-h*.6;
            const isTarget=rv===atkTarget&&rv.atkWord&&phase==="race";
            drawRider(xx,Y,h,rv.kit,rot,{name:rv.name,lean:rv.lean||0,word:isTarget?rv.atkWord:null,wordColor:P.weapon.type==="coconut"?"#a0632d":"#ff6a1a",swing,sdir,windup,weapon:rv.weapon,
              spin:Math.min(2.4,rv.v/VREF*2),tuck:Math.min(1,rv.v/VREF*.9),bob:Math.sin(performance.now()/40+rv.ph)*1.2,down,shield:0,look:(rv.hunt||rv.attack)&&!windup?(Math.sign(P.x-rv.x)||0):0});
            if(rv.say&&!isTarget&&!windup&&h>(W<600?40:26)) bubble(xx,Y-h*1.32,rv.say,h); } }
        else if(d.t==="rider"){ const r=d.r; let xo=r.x, rot=0; const kt=now-r.knockT;
          if(kt<1000){ const k=Math.sin(kt/1000*Math.PI/2); xo=r.x+k*.24*r.knockDir; rot=k*1.25*r.knockDir; }
          else if(kt<1700){ const k=1-(kt-1000)/700; xo=r.x+k*.24*r.knockDir; rot=k*1.25*r.knockDir; }
          const h=S*WH.bike*W/2;
          drawRider(X0+xo*wpx,Y,h,r,rot,{name:r.name,word:r.bound>=0&&r.bound===idx&&phase==="race"?words[idx]:null,knock:kt<1700,lean:(r.lane-r.x)*.3});
        } else { const ob=d.ob, h=S*WH[d.t]*W/2; if(h>=1.5){ const Sp=getSprite(d.t,{}), w=h*Sp.aspect; ctx.drawImage(Sp.c,X0+ob.side*0-w/2,Y-h,w,h);
            if(!ob.cleared&&acts[ob.k]&&ob.k===idx&&phase==="race") wordSign(X0,Y-h*1.08,h,words[ob.k],"#3ec1d3"); } }
        if(clip) ctx.restore();
      }
      if(alpha<1) ctx.globalAlpha=1;
    }
  }
  function glow(x,y,r,col){ const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,col); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=g; ctx.fillRect(x-r,y-r,r*2,r*2); ctx.globalCompositeOperation="source-over"; }
  function wordSign(x,y,h,text,col){
    const fs=Math.max(14,Math.min(32,h*.24)); ctx.font=`bold ${fs}px 'Atkinson Hyperlegible', Verdana, sans-serif`; const tw=ctx.measureText(text).width+fs*.9;
    const ax=x; x=Math.max(tw/2+6,Math.min(W-tw/2-6,x)); y=Math.max(fs*1.5+8,y)+Math.sin(performance.now()/160)*2;
    ctx.fillStyle="#1b1b22"; rr(ctx,x-tw/2-3,y-fs*1.5-3,tw+6,fs*1.5+6,8); ctx.fill();
    ctx.fillStyle=col; rr(ctx,x-tw/2,y-fs*1.5,tw,fs*1.5,6); ctx.fill();
    ctx.fillStyle="#1b1b22"; ctx.beginPath(); ctx.moveTo(x-7,y+2); ctx.lineTo(x+7,y+2); ctx.lineTo(Math.max(x-20,Math.min(x+20,ax)),y+11); ctx.fill();
    ctx.fillStyle=col==="#ff6a1a"?"#fff":"#1b1b22"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(text,x,y-fs*.73);
  }
  function drawGantry(s,label){
    const {x,y,w}=s.p1, ht=s.p1.s*1700*W/2, pw=Math.max(2,w*.045);
    ctx.fillStyle="#2b2a33"; ctx.fillRect(x-w*1.25-pw/2,y-ht,pw,ht); ctx.fillRect(x+w*1.25-pw/2,y-ht,pw,ht);
    const bh=ht*.2; ctx.fillStyle=label==="FINISH"?"#ff6a1a":"#1b1b22"; ctx.fillRect(x-w*1.25,y-ht,w*2.5,bh);
    ctx.fillStyle="#fff4e2"; for(let c=0;c<16;c++) if(c%2) ctx.fillRect(x-w*1.25+c*w*2.5/16,y-ht+bh,w*2.5/16,bh*.18);
    ctx.fillStyle=label==="FINISH"?"#fff4e2":"#ffd23f"; ctx.font=`${Math.max(8,bh*.7)}px 'Racing Sans One', 'Arial Black', sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(label==="START"?"READRASH":label,x,y-ht+bh*.52);
    if(label==="START"&&lights>0&&(phase!=="race"||now<900)){ const lr=bh*.32;
      for(let i=0;i<3;i++){ const lx=x+(i-1)*lr*3, ly=y-ht-lr*1.6; ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(lx,ly,lr*1.2,0,7); ctx.fill();
        const on=lights===4?"#3cff6a":(i<lights?"#ff2d2d":"#3a1010"); ctx.fillStyle=on; ctx.beginPath(); ctx.arc(lx,ly,lr,0,7); ctx.fill(); if(lights===4||i<lights) glow(lx,ly,lr*3,lights===4?"rgba(60,255,106,.5)":"rgba(255,45,45,.5)"); } }
  }
  function drawRider(x,y,h,ro,rot,opt){
    const B=bikeOnly(ro), RD=riderOnly(ro,opt.look||0), w=h*B.aspect, u=h/130, tn=performance.now();
    ctx.fillStyle="rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x,y,28*u,5.5*u,0,0,7); ctx.fill();
    if(opt.down){ drawDown(x,y,h,ro,opt.down); return; }
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot+(opt.lean||0));
    const bob=(opt.bob||0)*u, tk=(opt.tuck||0)*6*u;
    ctx.drawImage(B.c,-w/2,-h+bob*.3,w,h);
    if(opt.spin){ ctx.save(); rr(ctx,-11.5*u,-39.5*u,23*u,39*u,9*u); ctx.clip(); ctx.fillStyle="rgba(0,0,0,.5)"; const off=(tn*opt.spin*.03)%7; for(let i=-1;i<7;i++) ctx.fillRect(-11.5*u,(-39+i*7+off)*u,23*u,2*u); ctx.restore(); }
    const ln=Math.max(-.5,Math.min(.5,(opt.lean||0)+(opt.down?0:rot))), ho=ln*22*u;
    // knee out on the inside of a hard corner
    if(Math.abs(ln)>.16){ const kd=Math.sign(ln), ke=Math.min(1,(Math.abs(ln)-.16)/.2), kx=kd*(30+ke*13)*u+ho, ky=-66*u+bob;
      ctx.fillStyle="#1d2436"; ctx.beginPath(); ctx.moveTo(kd*22*u+ho,-78*u+bob); ctx.lineTo(kx,ky-4*u); ctx.lineTo(kx,ky+4*u); ctx.lineTo(kd*24*u+ho,-60*u+bob); ctx.fill();
      ctx.fillStyle="#f4f1ea"; ctx.strokeStyle="#111"; ctx.lineWidth=1*u; ctx.beginPath(); ctx.ellipse(kx,ky,4.6*u,5.4*u,0,0,7); ctx.fill(); ctx.stroke(); }
    ctx.drawImage(RD.c,-w/2+ho,-h+tk+bob,w,h);
    // arms: both hands on the clip-ons unless winding up or swinging
    const sy=(-98*u)+tk+bob, grip=-90*u+bob*.3;
    const arm=(sx,ex,ey,mx,my)=>{ ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111"; ctx.lineWidth=9.5*u; ctx.beginPath(); ctx.moveTo(sx*u+ho,sy); ctx.lineTo(mx+ho*.5,my); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.strokeStyle=ro.jacket; ctx.lineWidth=7*u; ctx.stroke(); ctx.fillStyle="#141418"; ctx.beginPath(); ctx.arc(ex,ey,4.6*u,0,7); ctx.fill(); };
    const sd=opt.sdir||1, sw=opt.swing||0, wu=opt.windup||0, wpn=opt.weapon||"paper";
    if(sw>0||wu>0){
      // free arm stays on the bar
      arm(-sd*22,-sd*29*u,grip,-sd*29*u,sy+7*u);
      let hx,hy,ang;
      if(sw>0){ const k=sw; hx=sd*(16+k*48)*u; hy=sy+(-26+k*30)*u; ang=sd>0?(-1.9+k*2.1):(Math.PI+1.9-k*2.1); }
      else { hx=sd*(12-wu*2)*u; hy=sy-(18+wu*10)*u; ang=sd>0?(-2.2-wu*.4):(Math.PI+2.2+wu*.4); }
      arm(sd*20,hx,hy,sd*30*u,(sy+hy)/2-4*u);
      ctx.save(); ctx.translate(hx,hy); ctx.rotate(ang); drawWeapon(ctx,wpn,u); ctx.restore();
      if(sw>.2&&sw<.9){ ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=3*u; ctx.beginPath(); ctx.arc(sd*10*u,sy-6*u,44*u,sd>0?-1.6:Math.PI-0.6,sd>0?-1.6+sw*1.2:Math.PI-0.6+sw*1.2); ctx.stroke(); }
    } else { arm(-22,-29*u,grip,-29*u,sy+7*u); arm(22,29*u,grip,29*u,sy+7*u); }
    if(opt.nitro){ const fl=8+Math.random()*14; const fx=26*u, fy=-17*u; const fg=ctx.createLinearGradient(fx,fy,fx,fy+fl*1.8*u); fg.addColorStop(0,"#fff6c0"); fg.addColorStop(.4,"#ffb020"); fg.addColorStop(1,"rgba(255,80,20,0)");
      ctx.fillStyle=fg; ctx.beginPath(); ctx.moveTo(fx-6*u,fy); ctx.lineTo(fx+6*u,fy); ctx.lineTo(fx+1*u,fy+fl*1.8*u); ctx.fill(); }
    if(opt.shield>0){ const fl=opt.shieldFlash||0, a=.18+opt.shield*.12+fl*.5;
      ctx.strokeStyle=`rgba(${fl>0?"255,255,255":"62,193,211"},${Math.min(1,a+.25)})`; ctx.lineWidth=(1.5+opt.shield*1.2+fl*4)*u;
      ctx.beginPath(); ctx.ellipse(0,-70*u,52*u,76*u,0,0,7); ctx.stroke();
      ctx.fillStyle=`rgba(62,193,211,${.04+opt.shield*.03+fl*.25})`; ctx.fill();
      ctx.strokeStyle=`rgba(255,255,255,${.25+fl*.5})`; ctx.lineWidth=1.2*u; ctx.beginPath(); ctx.ellipse(0,-70*u,52*u,76*u,0,Math.PI*1.1+((tn/600)%(Math.PI*2)),Math.PI*1.45+((tn/600)%(Math.PI*2))); ctx.stroke(); }
    ctx.restore();
    if(opt.knock){ const hx=x+Math.sin(rot)*120*u, hy=y-Math.cos(rot)*120*u; ctx.fillStyle="#ffd23f"; ctx.font=`${Math.max(10,16*u)}px sans-serif`; ctx.textAlign="center"; ctx.fillText("★ ★",hx,hy-16*u); }
    if(opt.windup>0&&h>18){ const r=Math.max(8,12*u), bx=x, by=y-h*1.16; ctx.fillStyle="#e0392b"; ctx.beginPath(); ctx.arc(bx,by,r*(1+.15*Math.sin(tn/60)),0,7); ctx.fill(); ctx.fillStyle="#fff"; ctx.font=`bold ${r*1.4}px Verdana,sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("!",bx,by+1); }
    else if(opt.name&&h>30&&!opt.word&&!opt.knock){ ctx.font=`${Math.max(9,Math.min(14,11*u))}px 'Racing Sans One','Arial Black',sans-serif`; const tw=ctx.measureText(opt.name).width+10;
      ctx.fillStyle=ro.jacket; rr(ctx,x-tw/2,y-h*1.12-8,tw,16,8); ctx.fill(); ctx.fillStyle="#1b1b22"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(opt.name,x,y-h*1.12); }
    if(opt.word) wordSign(x,y-h*1.08,Math.max(h,70),opt.word,opt.wordColor||"#ff6a1a");
  }
  // crash: the bike slides on its side, the rider tumbles away, then runs back and remounts
  function drawDown(x,y,h,ro,d){
    const B=bikeOnly(ro), RD=riderOnly(ro), w=h*B.aspect, u=h/130, k=Math.max(0,Math.min(1,d.k)), dir=d.dir||1;
    let bRot, bx; if(k<.55){ const e=k/.55; bRot=dir*1.4*Math.min(1,e*3); bx=dir*e*24*u; } else { const e=(k-.55)/.45; const ee=e*e*(3-2*e); bRot=dir*1.4*(1-ee); bx=dir*24*u*(1-ee); }
    ctx.save(); ctx.translate(x+bx,y); ctx.rotate(bRot); ctx.drawImage(B.c,-w/2,-h,w,h); ctx.restore();
    let rx,ry,rr2,sc=1;
    if(k<.55){ const e=k/.55; rx=dir*(30+e*95)*u; ry=-Math.sin(e*Math.PI)*45*u; rr2=dir*e*7.5; sc=.92; }
    else { const e=(k-.55)/.45; rx=dir*125*u*(1-e); ry=-Math.abs(Math.sin(e*Math.PI*4))*5*u; rr2=0; sc=.92+.08*e; }
    ctx.save(); ctx.translate(x+bx+rx,y+ry-60*u); ctx.rotate(rr2); ctx.scale(sc,sc); ctx.drawImage(RD.c,-w/2,-h+60*u,w,h); ctx.restore();
    if(k<.5){ ctx.fillStyle="#ffd23f"; ctx.font=`${Math.max(10,16*u)}px sans-serif`; ctx.textAlign="center"; ctx.fillText("★ ★",x+bx+rx,y+ry-110*u); }
  }
  function drawPlayer(){
    const h=camDepth/playerZ*WH.bike*W/2*(o.fill?.7:.84)*(H<300&&o.fill?H/300:1), x=CX, y=H-4;
    let rot=P.lean;
    if(P.state==="crash"){ const k=Math.min(1,(now-P.crashT)/220); rot=1.2*k*(P.crashT%2?1:-1); }
    if(P.state==="skid") rot+=Math.sin(now/40)*.3;
    const sk=now-P.swipeT, swing=sk<420?sk/420:0, sp=Math.min(1.3,P.v/VREF);
    const down=P.state==="down"?{k:(now-P.downT)/2000,dir:P.downDir||1}:null;
    if(down&&down.k<.45&&Math.random()<.6) sparks(1,x+(P.downDir||1)*20,H-8);
    drawRider(x,y,h,ME,rot,{nitro:P.boostUntil>now&&phase==="race",swing,sdir:P.swipeDir,weapon:gp?P.weapon.type:"paper",
      shield:gp&&phase==="race"?P.shield:0,shieldFlash:Math.max(0,1-(now-(P.shieldFlashT||-9999))/380),look:gp&&P.lookUntil>now&&!swing&&P.state==="ride"?P.lookDir:0,tuck:Math.min(1,sp*.9),spin:phase==="idle"||phase==="countdown"?0:sp*2,bob:P.bob||0,down});
    if(P.state==="crash"){ ctx.fillStyle="#ffd23f"; ctx.font="22px sans-serif"; ctx.textAlign="center"; ctx.fillText("★  ★",x+Math.sin(now/120)*10,y-h*.9); }
    if(P.copUntil>now&&phase==="race"){ const cx=W*.84, ch=h*.95;
      drawRider(cx,H-6,ch,{jacket:"#26355a",helmet:"#fff4e2",paint:"#fff4e2"},Math.sin(now/200)*.05,{});
      const on=Math.floor(now/120)%2; glow(cx-10,H-ch*1.02,ch*.25,on?"rgba(255,40,40,.7)":"rgba(40,110,255,.7)"); glow(cx+10,H-ch*1.02,ch*.25,on?"rgba(40,110,255,.7)":"rgba(255,40,40,.7)");
      ctx.font=`${Math.max(11,ch*.1)}px 'Racing Sans One','Arial Black',sans-serif`; ctx.fillStyle="#fff4e2"; ctx.textAlign="center"; ctx.fillText("GRAMMAR COP",cx,H-ch*1.18); }
  }
  function drawFX(){
    const sp=P.v/VREF, boost=P.boostUntil>now&&phase==="race";
    if(sp>.55&&phase!=="idle"){ const n=boost?26:14, a0=boost?.55:.28*Math.min(1,(sp-.55)*3);
      ctx.strokeStyle=`rgba(255,250,235,${a0})`; ctx.lineWidth=boost?2.2:1.4; ctx.beginPath();
      const t=performance.now()/1000;
      for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2+i*1.7, ph=((t*(boost?3.2:2)+i*.37)%1), r0=W*(.18+ph*.55), r1=r0+W*(.05+ph*.12)*(boost?1.6:1);
        const cx=CX, cy=HY+(H-HY)*.15, ca=Math.cos(a), sa=Math.sin(a)*.6; if(cy+sa*r0<HY-10) continue;
        ctx.moveTo(cx+ca*r0,cy+sa*r0); ctx.lineTo(cx+ca*r1,cy+sa*r1); }
      ctx.stroke(); }
    for(const p of parts){ if(p.k==="spark"){ ctx.strokeStyle=`rgba(255,${200},60,${p.life})`; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx*.03,p.y-p.vy*.03); ctx.stroke(); }
      else { ctx.fillStyle=`rgba(230,205,160,${p.life*.45})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); } }
    for(const b of bursts){ const k=b.t/.5, r=30+k*60; ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(-.2*b.dir); ctx.globalAlpha=1-k;
      ctx.fillStyle="#ffd23f"; ctx.strokeStyle="#1b1b22"; ctx.lineWidth=4; ctx.beginPath(); for(let i=0;i<16;i++){ const rr2=i%2?r*.55:r, an=i/16*Math.PI*2; ctx.lineTo(Math.cos(an)*rr2,Math.sin(an)*rr2*.75); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#e0392b"; ctx.font=`${Math.round(r*.55)}px 'Racing Sans One','Arial Black',sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("WHAP!",0,2); ctx.restore(); }
    if(boost){ ctx.fillStyle="rgba(255,120,30,.07)"; ctx.fillRect(-W,-H,W*3,H*3); }
  }
  function drawHUD(){
    if(o.hud===false) return;
    const x0=18, x1=W-18, y=18;
    ctx.fillStyle="rgba(15,13,20,.55)"; rr(ctx,x0-8,y-10,x1-x0+16,20,10); ctx.fill();
    ctx.fillStyle="rgba(255,244,226,.35)"; ctx.fillRect(x0,y-1.5,x1-x0-14,3);
    for(let i=0;i<3;i++) for(let j=0;j<2;j++){ ctx.fillStyle=(i+j)%2?"#1b1b22":"#fff4e2"; ctx.fillRect(x1-12+i*4,y-4+j*4,4,4); }
    const px=z=>x0+Math.max(0,Math.min(1,(z-HUD0)/HUDLEN))*(x1-x0-14);
    riders.forEach(r=>{ ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(px(r.z),y,6.5,0,7); ctx.fill(); ctx.fillStyle=r.jacket; ctx.beginPath(); ctx.arc(px(r.z),y,4.6,0,7); ctx.fill(); });
    if(gp) rivals.forEach(g=>{ ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(px(g.z),y,5,0,7); ctx.fill(); ctx.fillStyle=g.kit.jacket; ctx.beginPath(); ctx.arc(px(g.z),y,3.4,0,7); ctx.fill(); });
    if(gp) for(let L=1;L<gpLaps;L++){ ctx.fillStyle="rgba(255,244,226,.7)"; ctx.fillRect(px(GP.START+L*GP.LAP_LEN)-1,y-6,2,12); }
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(px(P.z),y,8.5,0,7); ctx.fill(); ctx.fillStyle="#ff6a1a"; ctx.beginPath(); ctx.arc(px(P.z),y,6.5,0,7); ctx.fill();
    if(phase==="race"||phase==="done"){ const p=gp?gpPlace():placeOf(), fs=Math.round(Math.max(28,W*.05));
      ctx.font=`italic ${fs}px 'Racing Sans One','Arial Black',sans-serif`; ctx.textAlign="left"; ctx.textBaseline="top";
      ctx.lineWidth=5; ctx.strokeStyle="#1b1b22"; ctx.strokeText(ord(p),16,36); ctx.fillStyle=p===1?"#ffd23f":"#fff4e2"; ctx.fillText(ord(p),16,36);
      const bw=ctx.measureText(ord(p)).width; ctx.font=`${Math.round(fs*.42)}px 'Racing Sans One','Arial Black',sans-serif`; const tot=gp?"/ 12":"/ 4"; ctx.strokeText(tot,22+bw,36+fs*.48); ctx.fillStyle="#fff4e2"; ctx.fillText(tot,22+bw,36+fs*.48);
      if(gp){ const lt=`LAP ${Math.min(gpLaps,lapIdx+1)}/${gpLaps}`; ctx.font=`italic ${Math.round(fs*.8)}px 'Racing Sans One','Arial Black',sans-serif`; ctx.textAlign="right"; ctx.lineWidth=5; ctx.strokeText(lt,W-16,36); ctx.fillStyle=lapIdx>=gpLaps-1?"#ffd23f":"#fff4e2"; ctx.fillText(lt,W-16,36); } }
  }
  let last=performance.now(), ema=16, frames=0;
  function loop(t){
    raf=0; if(!running) return;
    const raw=t-last, dt=Math.min(.05,raw/1000); last=t; update(dt);
    if(phase==="race"){ ema=ema*.95+raw*.05; frames++; } if(quality>0&&frames>150&&ema>26){ quality=0; DRAW=attract?90:110; resize(); }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const shx=(Math.random()-.5)*shakeAmt, shy=(Math.random()-.5)*shakeAmt*.6;
    ctx.save(); ctx.translate(CX+shx,H+shy); ctx.rotate(tilt); ctx.translate(-CX,-H);
    drawSky(); const base=drawRoad(); drawSprites(base); drawPlayer(); drawFX();
    ctx.restore();
    ctx.drawImage(vignC,0,0,W,H);
    drawHUD(); if(gp&&o.hud!==false) drawGPHud();
    raf=requestAnimationFrame(loop);
  }
  function resume(){ if(running&&raf) return; running=true; last=performance.now(); if(phase==="race") t0=performance.now()-now; raf=requestAnimationFrame(loop); }
  function pause(){ running=false; if(raf) cancelAnimationFrame(raf); raf=0; }

  const onResize=()=>resize(); window.addEventListener("resize",onResize);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ for(const k in CACHE) delete CACHE[k]; });
  if(gp) loadGP(league,o.laps||3,[]); else load(league,raceIdx); resize(); raf=requestAnimationFrame(loop);
  if(attract){ lights=4; go(); }

  return {
    load:(lg,ri)=>load(lg,ri), loadGP, countdown, finish:()=>{ finishT=null; finish(true); },
    listen:()=>Voice.use(voiceHandler), voiceHandler,
    setAutopilot:(on,wpm)=>{ autopilot=on; if(wpm) apWpm=wpm; },
    on:(k,f)=>{ (listeners[k]=listeners[k]||[]).push(f); },
    pause, resume, resize,
    state:()=>({gp:gp?{shield:P.shield,weapon:P.weapon.type,kos,blocks,hitsTaken,pstate:P.state,atk:atkTarget&&atkTarget.atkWord?{word:atkTarget.atkWord,name:atkTarget.name}:null,attacks:rivals.filter(r=>r.attack).length,downs:rivals.filter(r=>r.down).length,rows:rows.map(r=>({words:r.words,content:r.content,st:r.state,chosen:r.chosen,lap:r.lap,z:r.z})),lane:P.lane,lap:lapIdx,place:gpPlace(),heat,missed:gpMissed,wrong:gpWrong,crashes,v:P.v,z:P.z,draft,rivals:rivals.map(r=>({n:r.name,z:Math.round(r.z),lane:r.lane}))}:null,phase,idx,total:words.length,P:{...P},place:placeOf(),swipes,dodges,ema,quality,acts:acts.map(a=>a?a.type:null),riders:riders.map(r=>({name:r.name,z:Math.round(r.z),bound:r.bound})),words:[...words]}),
    judgeWord:(w,final=true,last=false)=>judge(norm(w),null,final,last)
  };
}
const ord=n=>n+(["th","st","nd","rd"][(n%100-20)%10]||["th","st","nd","rd"][n%100]||"th");

/* ================= progress (stored on this device) ================= */
const Store = {
  get(k,d){ try{ const v=localStorage.getItem("rr."+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem("rr."+k,JSON.stringify(v)); }catch(e){} }
};
function stars(lg){ const s=Store.get("stars."+lg,null); return Array.isArray(s)&&s.length===RACES.length?s:RACES.map(()=>0); }
function saveStars(lg,ri,n){ const s=stars(lg); if(n>s[ri]){ s[ri]=n; Store.set("stars."+lg,s); } return s; }
function nickname(){ let n=Store.get("name",null); if(!n||!/^[A-Za-z]+\d{2}$/.test(n)){ n=randomName(); Store.set("name",n); } return n; }

window.ReadRash = { create, Voice, Sound, LEAGUES, RACES, ADJ, NOUN, randomName, VOICE_OK, IN_VIEWER, Store, stars, saveStars, nickname, norm, sim, ord,
  paintSprite(canvas,t,opt={}){ const g=canvas.getContext("2d"), h=canvas.height; g.clearRect(0,0,canvas.width,canvas.height); const list=t==="bike"?[bikeOnly(opt.rider||ME),riderOnly(opt.rider||ME)]:[getSprite(t,opt)]; for(const S of list){ const w=h*S.aspect; g.drawImage(S.c,(canvas.width-w)/2,0,w,h); } } };
})();
