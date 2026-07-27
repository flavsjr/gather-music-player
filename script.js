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

// ===== PLAYLIST =====
// Basta jogar os arquivos de audio dentro da pasta /musicas.
// Nome do arquivo vira titulo/artista: "Titulo - ... (prod. fulano).ext"
const PASTA = "musicas/";
const EXTS  = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i;

// usado so quando abre via file:// (fetch bloqueado) — nao precisa manter
const FALLBACK = [
  "Abbot - On The Radar Freestyle - On The Radar.mp3",
  "Glory Days - Trap Beat - 147 BPM (prod. flavs).wav",
];

let playlist = [];
let idx = 0;

function parseNome(file){
  const base  = file.replace(EXTS, "");
  const parts = base.split(" - ").map(s => s.trim()).filter(Boolean);
  const prod  = base.match(/\(([^)]*prod[^)]*)\)/i);
  return {
    file,
    title:  parts[0] || base,
    artist: prod ? prod[1] : (parts.length > 1 ? parts[parts.length - 1] : ""),
  };
}

// le playlist.json — opcional. So serve pra 2 coisas:
//   a) corrigir titulo/artista quando o nome do arquivo engana
//   b) listar as faixas em host sem listagem de diretorio (ex: GitHub Pages)
async function lerManifesto(){
  try{
    const json  = await (await fetch(PASTA + "playlist.json")).json();
    const files = [], meta = {};
    for(const x of json){
      const f = typeof x === "string" ? x : x.file;
      if(!f) continue;
      files.push(f);
      if(typeof x === "object" && (x.title || x.artist)) meta[f] = x;
    }
    return { files, meta };
  }catch(e){ return { files: [], meta: {} }; }   // sem manifesto
}

// descobre os arquivos: listagem de diretorio > manifesto > FALLBACK
async function listarArquivos(){
  try{
    const html = await (await fetch(PASTA)).text();
    const doc  = new DOMParser().parseFromString(html, "text/html");
    const files = [...doc.querySelectorAll("a[href]")]
      .map(a => decodeURIComponent(a.getAttribute("href").split("/").pop()))
      .filter(n => EXTS.test(n));
    if(files.length) return files;
  }catch(e){ /* sem listagem de diretorio */ }
  return null;
}

async function carregarPlaylist(){
  const [porPasta, manifesto] = await Promise.all([listarArquivos(), lerManifesto()]);
  const files = porPasta || (manifesto.files.length ? manifesto.files : FALLBACK);
  // nome do arquivo manda, manifesto so sobrescreve titulo/artista
  return files.map(f => Object.assign(parseNome(f), manifesto.meta[f]));
}

// ===== CORES =====
// Sorteia uma matiz nova por faixa e deriva a paleta dela, entao as 3 cores
// sempre combinam. Evita o verde-amarelado (60-160), que fica feio no escuro.
let corParticula = "rgba(160,110,255,.6)";

function sortearCores(){
  let h = Math.floor(Math.random() * 360);
  if(h > 60 && h < 160) h = (h + 140) % 360;
  const raiz = document.documentElement.style;
  raiz.setProperty("--c1",   `hsl(${h} 90% 74%)`);
  raiz.setProperty("--c2",   `hsl(${(h + 40) % 360} 85% 68%)`);
  raiz.setProperty("--c3",   `hsl(${(h + 20) % 360} 78% 56%)`);
  raiz.setProperty("--glow", `hsla(${h}, 85%, 55%, .55)`);
  corParticula = `hsla(${h}, 80%, 72%, .6)`;
}

function load(i, autoplay=true){
  if(!playlist.length) return;
  idx = (i + playlist.length) % playlist.length;   // wrap circular
  const t = playlist[idx];
  audio.src = PASTA + encodeURIComponent(t.file);
  titleEl.textContent  = t.title;
  artistEl.textContent = t.artist;
  bar.style.width = "0%";
  sortearCores();
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

// embaralha (Fisher-Yates) — ordem nova a cada refresh
function embaralhar(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// varre a pasta, monta playlist, carrega 1a faixa + tenta autoplay
carregarPlaylist().then(faixas => {
  playlist = embaralhar(faixas);
  load(0);
});

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
    ctx.fillStyle = corParticula;   // acompanha a cor da faixa
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();
