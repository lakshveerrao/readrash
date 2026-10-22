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
const ME = {jacket:"#ff6a1a",helmet:"#ffd23f",paint:"#1b1b22"};

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
function bikeSprite(o){
  return sprite("bike"+o.jacket+o.paint,.95,300,(g,u0)=>{
    const u=u0*100/130, {P,R,E,L}=tools(g,u);
    const tg=g.createLinearGradient(-11*u,0,11*u,0); tg.addColorStop(0,"#08080a"); tg.addColorStop(.5,"#34343c"); tg.addColorStop(1,"#08080a");
    g.fillStyle=tg; rr(g,-11*u,-36*u,22*u,36*u,7*u); g.fill();
    for(let i=0;i<4;i++) R(-6,-31+i*7,12,2,"rgba(255,255,255,.07)");
    P([[-15,-30],[15,-30],[13,-41],[-13,-41]],"#1c1b21");
    const eg=g.createLinearGradient(13*u,0,25*u,0); eg.addColorStop(0,"#f4f6f9"); eg.addColorStop(.5,"#a2a8b2"); eg.addColorStop(1,"#5a606a");
    g.fillStyle=eg; rr(g,13*u,-40*u,12*u,24*u,5*u); g.fill(); E(19,-17,5,3,"#1a1a1f");
    P([[-17,-40],[17,-40],[23,-58],[-23,-58]],o.paint); P([[-17,-40],[-11,-40],[-15,-58],[-23,-58]],shade(o.paint,-.25)); P([[14,-42],[17,-40],[21,-55],[19,-56]],shade(o.paint,.35));
    g.save(); g.shadowColor="#ff2020"; g.shadowBlur=10*u; R(-10,-52,20,6,"#ff3030",3); g.restore(); R(-7,-50,14,2,"#ffb0a0",1);
    R(-8,-45,16,5,"#ffd23f",1); g.fillStyle="#1b1b22"; g.font=`bold ${3.8*u}px Verdana`; g.textAlign="center"; g.textBaseline="middle"; g.fillText("MH 07",0,-42.4*u);
    R(-16,-64,32,7,"#141418",3);
    const leg="#232a3d";
    P([[-14,-63],[-6,-63],[-12,-45],[-23,-39],[-27,-42],[-22,-54]],leg); P([[14,-63],[6,-63],[12,-45],[23,-39],[27,-42],[22,-54]],leg);
    P([[-13,-62],[-9,-62],[-20,-46],[-24,-48]],shade(leg,.18)); P([[13,-62],[9,-62],[20,-46],[24,-48]],shade(leg,-.25));
    R(-31,-43,11,9,"#0f0f12",2); R(20,-43,11,9,"#0f0f12",2);
    const jg=g.createLinearGradient(-23*u,0,23*u,0); jg.addColorStop(0,shade(o.jacket,-.32)); jg.addColorStop(.35,o.jacket); jg.addColorStop(.7,shade(o.jacket,.12)); jg.addColorStop(1,shade(o.jacket,-.4));
    g.fillStyle=jg; g.beginPath(); g.moveTo(-15*u,-61*u); g.lineTo(15*u,-61*u); g.lineTo(22*u,-90*u); g.quadraticCurveTo(22*u,-98*u,12*u,-99*u); g.lineTo(-12*u,-99*u); g.quadraticCurveTo(-22*u,-98*u,-22*u,-90*u); g.closePath(); g.fill();
    g.strokeStyle="#111"; g.lineWidth=1.4*u; g.stroke();
    R(-3,-97,6,34,o.paint==="#1b1b22"?"#ffd23f":o.paint); R(-15,-66,30,4,shade(o.jacket,-.35));
    R(-5,-104,10,7,"#1a1a1f");
    const hg=g.createRadialGradient(-5*u,-118*u,2*u,0,-112*u,16*u); hg.addColorStop(0,shade(o.helmet,.45)); hg.addColorStop(.6,o.helmet); hg.addColorStop(1,shade(o.helmet,-.45));
    g.fillStyle=hg; g.beginPath(); g.arc(0,-112*u,15*u,0,7); g.fill(); g.strokeStyle="#111"; g.lineWidth=1.4*u; g.stroke();
    g.save(); g.beginPath(); g.arc(0,-112*u,15*u,0,7); g.clip(); R(-2.5,-128,5,30,o.jacket===o.helmet?"#fff":o.jacket); g.restore();
    g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=2*u; g.beginPath(); g.arc(0,-112*u,11*u,Math.PI*1.15,Math.PI*1.45); g.stroke();
    L([[-24,-71],[-34,-71]],"#1b1b22",3); L([[24,-71],[34,-71]],"#1b1b22",3);
    L([[-31,-71],[-36,-83]],"#1b1b22",1.6); L([[31,-71],[36,-83]],"#1b1b22",1.6);
    E(-37,-85,5,3.4,"#1b1b22"); E(37,-85,5,3.4,"#1b1b22"); E(-38,-86,2,1,"rgba(255,255,255,.5)"); E(36,-86,2,1,"rgba(255,255,255,.5)");
  });
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
  barrel:[.6,110,(g,u)=>{ const {R,E}=tools(g,u); E(0,0,30,4,"rgba(0,0,0,.25)"); const bg=g.createLinearGradient(-28*u,0,28*u,0); bg.addColorStop(0,"#c84f12"); bg.addColorStop(.4,"#ff7a2a"); bg.addColorStop(1,"#a83e0c");
    g.fillStyle=bg; rr(g,-28*u,-96*u,56*u,96*u,8*u); g.fill(); R(-28,-72,56,14,"rgba(255,244,226,.92)"); R(-28,-40,56,14,"rgba(255,244,226,.92)"); E(0,-96,28,6,"#e05a12"); }]
};
function boardSprite(text){ return sprite("board"+text,1.7,170,(g,u)=>{ const {R,T}=tools(g,u); R(-56,-58,5,58,"#3a3640"); R(51,-58,5,58,"#3a3640"); R(-82,-100,164,46,"#1b1b22",3);
  const hot=text==="READRASH"||text==="RIDE RASH"; R(-79,-97,158,40,hot?"#ff6a1a":"#ffd23f",2);
  T(text,0,-77,text.length>12?11:text.length>9?14:18,hot?"#fff4e2":"#1b1b22"); }); }
function getSprite(t,sp){ if(t==="board") return boardSprite(sp.text); const d=PAINT[t]; return sprite(t,d[0],d[1],d[2]); }
const WH={post:150,rail:200,palm:2000,palm2:1900,mango:1300,house:900,boat:520,lighthouse:2600,fort:1500,banyan:1600,bush:300,rock:170,laterite:220,pole:1600,mile:240,board:1100,stall:800,auto:440,cow:340,truck:900,bus:900,barrel:220,bike:440};

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
      while(c<toks.length){ const used=judge(toks[c],toks[c+1],res.isFinal,!res.isFinal&&c===toks.length-1); if(!used) break; c+=used; }
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
  function go(){ phase="race"; t0=performance.now(); now=0; lastProgressT=0; apNext=600; renderPara(); emit("go"); }
  function placeOf(){ let p=1; riders.forEach(r=>{ if(r.finishT!=null ? (finishT==null||r.finishT<finishT) : r.z>P.z) p++; }); return p; }
  function finish(stopped){
    if(phase==="done") return;
    phase="done"; if(!stopped&&finishT!=null) P.target=FINISH_Z+3000;
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
    if(phase==="race"){
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
      P.v=Math.max(0,P.v-P.v*dt*.8); if(P.z<FINISH_Z+2500) P.z+=Math.max(600,P.v)*dt;
    } else if(phase==="countdown"||phase==="idle"){ now=0; }
    let tx=0; obstacles.forEach(ob=>{ const d=ob.z-P.z; if(ob.cleared&&d<1500&&d>-500) tx=ob.side; });
    const px=P.x; P.x+=(tx-P.x)*Math.min(1,dt*5);
    const s=segAt(P.z), sp=P.v/(RACE_LEN/4.6);
    P.lean=Math.max(-.5,Math.min(.5,(P.x-px)/Math.max(dt,.001)*.6+s.curve*sp*.07));
    tilt+=((-s.curve*sp*.013)-tilt)*Math.min(1,dt*4);
    skyOff+=s.curve*sp*dt*.012; skyOff=Math.max(-1.2,Math.min(1.2,skyOff));
    shakeAmt*=Math.pow(.02,dt);
    if(phase==="race"&&P.state==="ride"&&P.v>RACE_LEN/9&&Math.random()<dt*28) dust(1,CX+(Math.random()-.5)*20,H-6);
    parts.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=(p.k==="spark"?900:-20)*dt; p.life-=dt*(p.k==="spark"?1.6:1.4); if(p.k==="dust") p.r+=dt*14; });
    parts=parts.filter(p=>p.life>0);
    bursts.forEach(b=>b.t+=dt); bursts=bursts.filter(b=>b.t<.5);
    dashUpdate(Math.min(260,Math.round(P.v*.03)));
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
    const base=Math.floor(camZ/SEG), pct=(camZ%SEG)/SEG; let dx=-(segs[base].curve*pct), x=0, maxy=H;
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
        if(d.t==="rider"){ const r=d.r; let xo=r.x, rot=0; const kt=now-r.knockT;
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
    const S=bikeSprite(ro), w=h*S.aspect, u=h/130;
    ctx.fillStyle="rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x,y,26*u,5*u,0,0,7); ctx.fill();
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot+(opt.lean||0));
    ctx.drawImage(S.c,-w/2,-h,w,h);
    const arm=(sx,sy,ex,ey,mx,my)=>{ ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111"; ctx.lineWidth=9*u; ctx.beginPath(); ctx.moveTo(sx*u,sy*u); ctx.lineTo(mx*u,my*u); ctx.lineTo(ex*u,ey*u); ctx.stroke();
      ctx.strokeStyle=ro.jacket; ctx.lineWidth=6.4*u; ctx.stroke(); ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(ex*u,ey*u,4*u,0,7); ctx.fill(); };
    const sw=opt.swipe||0, sd=opt.sdir||1;
    if(sw>0){ const ax=sd*(32+sw*42), ay=-84-sw*20;
      arm(-sd*19,-91,-sd*31,-71,-sd*27,-80); arm(sd*19,-91,ax,ay,sd*(26+sw*14),-90-sw*8);
      ctx.save(); ctx.translate(ax*u,ay*u); ctx.rotate(sd>0?(-.9+sw*.7):(Math.PI+.9-sw*.7)); ctx.fillStyle="#f2ede2"; ctx.fillRect(0,-4.5*u,34*u,9*u); ctx.fillStyle="#9a93a6"; for(let i=1;i<5;i++) ctx.fillRect(i*7*u,-4.5*u,1.5*u,9*u); ctx.fillStyle="#e0392b"; ctx.fillRect(28*u,-4.5*u,6*u,9*u); ctx.restore();
    } else { arm(-19,-91,-31,-71,-27,-80); arm(19,-91,31,-71,27,-80); }
    if(opt.nitro){ const fl=8+Math.random()*12; const fg=ctx.createLinearGradient(0,-24*u,0,(-14+fl)*u); fg.addColorStop(0,"#fff6c0"); fg.addColorStop(.4,"#ffb020"); fg.addColorStop(1,"rgba(255,80,20,0)");
      ctx.fillStyle=fg; ctx.beginPath(); ctx.moveTo(14*u,-20*u); ctx.lineTo(24*u,-20*u); ctx.lineTo(19*u,(-14+fl*1.6)*u); ctx.fill(); }
    ctx.restore();
    if(opt.knock){ const hx=x+Math.sin(rot)*110*u, hy=y-Math.cos(rot)*110*u; ctx.fillStyle="#ffd23f"; ctx.font=`${Math.max(10,16*u)}px sans-serif`; ctx.textAlign="center"; ctx.fillText("★ ★",hx,hy-16*u); }
    if(opt.name&&h>30&&!opt.word&&!opt.knock){ ctx.font=`${Math.max(9,Math.min(14,11*u))}px 'Racing Sans One','Arial Black',sans-serif`; const tw=ctx.measureText(opt.name).width+10;
      ctx.fillStyle=ro.jacket; rr(ctx,x-tw/2,y-h*1.08-8,tw,16,8); ctx.fill(); ctx.fillStyle="#1b1b22"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(opt.name,x,y-h*1.08); }
    if(opt.word) wordSign(x,y-h*1.04,Math.max(h,70),opt.word,"#ff6a1a");
  }
  function drawPlayer(){
    const h=camDepth/playerZ*WH.bike*W/2*(o.fill?.7:.84)*(H<300&&o.fill?H/300:1), x=CX, y=H-4;
    let rot=P.lean;
    if(P.state==="crash"){ const k=Math.min(1,(now-P.crashT)/220); rot=1.2*k*(P.crashT%2?1:-1); }
    if(P.state==="skid") rot=Math.sin(now/40)*.32;
    const sk=now-P.swipeT, swipe=sk<380?Math.sin(sk/380*Math.PI):0;
    drawRider(x,y,h,ME,rot,{nitro:P.boostUntil>now&&phase==="race",swipe,sdir:P.swipeDir});
    if(P.state==="crash"){ ctx.fillStyle="#ffd23f"; ctx.font="22px sans-serif"; ctx.textAlign="center"; ctx.fillText("★  ★",x+Math.sin(now/120)*10,y-h*.9); }
    if(P.copUntil>now&&phase==="race"){ const cx=W*.84, ch=h*.95;
      drawRider(cx,H-6,ch,{jacket:"#26355a",helmet:"#fff4e2",paint:"#fff4e2"},Math.sin(now/200)*.05,{});
      const on=Math.floor(now/120)%2; glow(cx-10,H-ch*1.02,ch*.25,on?"rgba(255,40,40,.7)":"rgba(40,110,255,.7)"); glow(cx+10,H-ch*1.02,ch*.25,on?"rgba(40,110,255,.7)":"rgba(255,40,40,.7)");
      ctx.font=`${Math.max(11,ch*.1)}px 'Racing Sans One','Arial Black',sans-serif`; ctx.fillStyle="#fff4e2"; ctx.textAlign="center"; ctx.fillText("GRAMMAR COP",cx,H-ch*1.18); }
  }
  function drawFX(){
    const sp=P.v/(RACE_LEN/4.6), boost=P.boostUntil>now&&phase==="race";
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
    const px=z=>x0+Math.max(0,Math.min(1,(z-START_Z)/RACE_LEN))*(x1-x0-14);
    riders.forEach(r=>{ ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(px(r.z),y,6.5,0,7); ctx.fill(); ctx.fillStyle=r.jacket; ctx.beginPath(); ctx.arc(px(r.z),y,4.6,0,7); ctx.fill(); });
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(px(P.z),y,8.5,0,7); ctx.fill(); ctx.fillStyle="#ff6a1a"; ctx.beginPath(); ctx.arc(px(P.z),y,6.5,0,7); ctx.fill();
    if(phase==="race"||phase==="done"){ const p=placeOf(), fs=Math.round(Math.max(28,W*.05));
      ctx.font=`italic ${fs}px 'Racing Sans One','Arial Black',sans-serif`; ctx.textAlign="left"; ctx.textBaseline="top";
      ctx.lineWidth=5; ctx.strokeStyle="#1b1b22"; ctx.strokeText(ord(p),16,36); ctx.fillStyle=p===1?"#ffd23f":"#fff4e2"; ctx.fillText(ord(p),16,36);
      const bw=ctx.measureText(ord(p)).width; ctx.font=`${Math.round(fs*.42)}px 'Racing Sans One','Arial Black',sans-serif`; ctx.strokeText("/ 4",22+bw,36+fs*.48); ctx.fillStyle="#fff4e2"; ctx.fillText("/ 4",22+bw,36+fs*.48); }
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
    drawHUD();
    raf=requestAnimationFrame(loop);
  }
  function resume(){ if(running&&raf) return; running=true; last=performance.now(); if(phase==="race") t0=performance.now()-now; raf=requestAnimationFrame(loop); }
  function pause(){ running=false; if(raf) cancelAnimationFrame(raf); raf=0; }

  const onResize=()=>resize(); window.addEventListener("resize",onResize);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ for(const k in CACHE) delete CACHE[k]; });
  load(league,raceIdx); resize(); raf=requestAnimationFrame(loop);
  if(attract){ lights=4; go(); }

  return {
    load:(lg,ri)=>load(lg,ri), countdown, finish:()=>{ finishT=null; finish(true); },
    listen:()=>Voice.use(voiceHandler), voiceHandler,
    setAutopilot:(on,wpm)=>{ autopilot=on; if(wpm) apWpm=wpm; },
    on:(k,f)=>{ (listeners[k]=listeners[k]||[]).push(f); },
    pause, resume, resize,
    state:()=>({phase,idx,total:words.length,P:{...P},place:placeOf(),swipes,dodges,ema,quality,acts:acts.map(a=>a?a.type:null),riders:riders.map(r=>({name:r.name,z:Math.round(r.z),bound:r.bound})),words:[...words]}),
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
  paintSprite(canvas,t,opt={}){ const S=t==="bike"?bikeSprite(opt.rider||ME):getSprite(t,opt); const g=canvas.getContext("2d"); const h=canvas.height, w=h*S.aspect; g.clearRect(0,0,canvas.width,canvas.height); g.drawImage(S.c,(canvas.width-w)/2,0,w,h); } };
})();
