const audio  = document.getElementById("audio");
const button = document.getElementById("playButton");
const vinyl  = document.getElementById("vinyl");
const eq     = document.getElementById("eq");
const bar    = document.getElementById("bar");
const toggle = document.getElementById("toggleBtn");
const prevB  = document.getElementById("prevBtn");
const nextB  = document.getElementById("nextBtn");
const titleEl  = document.getElementById("title");
const artistEl = document.getElementById("artist");

// ===== PLAYLIST — add sons aqui: {file, title, artist} =====
const playlist = [
  { file:"Glory Days - Trap Beat - 147 BPM (prod. flavs).wav", title:"Glory Days",   artist:"prod. flavs" },
  { file:"Space Travel - Trap Beat - 146 BPM (prod. flavs).wav", title:"Space Travel", artist:"prod. flavs" },
  { file:"Abbot - On The Radar Freestyle - On The Radar.mp3", title:"The Abbot", artist:"On The Radar" },
];
let idx = 0;

function load(i, autoplay=true){
  idx = (i + playlist.length) % playlist.length;   // wrap circular
  const t = playlist[idx];
  audio.src = t.file;
  titleEl.textContent  = t.title;
  artistEl.textContent = t.artist;
  bar.style.width = "0%";
  if(autoplay) audio.play().then(play).catch(() => button.classList.remove("hidden"));
}

function next(){ load(idx + 1); }
function prev(){ load(idx - 1); }

function play(){
  vinyl.classList.add("playing");
  eq.classList.add("playing");
  button.classList.add("hidden");
  toggle.textContent = "⏸";
}
function pause(){
  vinyl.classList.remove("playing");
  eq.classList.remove("playing");
  toggle.textContent = "▶";
}

toggle.onclick = () => audio.paused ? audio.play() : audio.pause();
nextB.onclick  = next;
prevB.onclick  = prev;

// volume
const vol     = document.getElementById("vol");
const volIcon = document.getElementById("volIcon");
let lastVol = 1;

function updIcon(){
  volIcon.textContent = audio.volume === 0 ? "🔇" : audio.volume < 0.5 ? "🔉" : "🔊";
}
vol.oninput = () => { audio.volume = +vol.value; if(audio.volume>0) lastVol = audio.volume; updIcon(); };
volIcon.onclick = () => {
  if(audio.volume > 0){ lastVol = audio.volume; audio.volume = 0; }
  else audio.volume = lastVol || 1;
  vol.value = audio.volume;
  updIcon();
};

// auto-avanca no fim da faixa
audio.addEventListener("ended", next);

// carrega 1a faixa + tenta autoplay
load(0);

button.onclick = () => audio.play().then(play);

audio.addEventListener("play",  play);
audio.addEventListener("pause", pause);

// barra progresso
audio.addEventListener("timeupdate", () => {
  if (audio.duration) bar.style.width = (audio.currentTime/audio.duration*100) + "%";
});

// fundo animado (particulas)
const c = document.getElementById("bg");
const ctx = c.getContext("2d");
let W,H,parts;
function resize(){
  W = c.width  = innerWidth;
  H = c.height = innerHeight;
  parts = Array.from({length:70}, () => ({
    x:Math.random()*W, y:Math.random()*H,
    r:Math.random()*2+.5,
    dx:(Math.random()-.5)*.4, dy:(Math.random()-.5)*.4
  }));
}
resize();
addEventListener("resize", resize);

function loop(){
  ctx.fillStyle = "rgba(5,4,10,.35)";
  ctx.fillRect(0,0,W,H);
  for(const p of parts){
    p.x += p.dx; p.y += p.dy;
    if(p.x<0||p.x>W) p.dx*=-1;
    if(p.y<0||p.y>H) p.dy*=-1;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,7);
    ctx.fillStyle = "rgba(160,110,255,.6)";
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();
