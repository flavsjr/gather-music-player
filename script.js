const vinyl  = document.getElementById("vinyl");
const eq     = document.getElementById("eq");
const bar    = document.getElementById("bar");
const toggle = document.getElementById("toggleBtn");
const prevB  = document.getElementById("prevBtn");
const nextB  = document.getElementById("nextBtn");
const titleEl   = document.getElementById("title");
const artistEl  = document.getElementById("artist");
const cover     = document.getElementById("cover");
const coverFall = document.getElementById("coverFallback");
const vol       = document.getElementById("vol");
const volIcon   = document.getElementById("volIcon");
const avisoMudo = document.getElementById("avisoMudo");

// ===== PLAYLIST =====
// Configuracao vem de playlist.json (ver o "_ajuda" la dentro).
// Se o fetch falhar — abrir via file:// bloqueia — cai neste PADRAO.
// Pra testar sem servidor, e so preencher aqui.
const PADRAO = {
  list: "",
  shuffle: true,
  videos: [],
};

let cfg        = PADRAO;
let modoLista  = false;   // true = playlist do YouTube, false = lista na mao
let faixas     = [];      // modo B
let meta       = {};      // modo B: id -> {title, artist} vindos do json
let idx        = 0;
let player;
let pronto     = false;
let videoAtual = "";
let errosSeguidos = 0;
let esperaMeta = null, tentativasMeta = 0, esperandoId = "";   // metadata do YouTube chega atrasada
let aguardandoGesto = false, tGesto = 0;   // autoplay barrado: tocando mudo ate o 1o clique
let erroConfig = "";
let emAnuncio = false;
let tentativasPular = 0;
let estadoAnterior = -1;
let videoOriginalId = "";
let contadorTempoAnuncio = 0;

// ===== NOME DA FAIXA =====
// Titulo do YouTube vem sujo: "Artista - Musica (Official Video) [4K]".
// Tira o lixo de producao mas preserva "(prod. fulano)", que e credito.
const LIXO = /\s*[\(\[][^)\]]*(?:official|oficial|video|v[ií]deo|clipe|audio|[áa]udio|lyric|letra|legendado|visualizer|hd|4k|mv|explicit)[^)\]]*[\)\]]/gi;

function limpar(s){
  return (s || "").replace(LIXO, "").replace(/\s{2,}/g, " ").trim();
}

// YouTube usa "Artista - Musica" — ordem inversa dos arquivos locais.
function parseTitulo(rawTitle, rawAuthor){
  const base  = limpar(rawTitle);
  const prod  = base.match(/\(([^)]*prod[^)]*)\)/i);
  const parts = base.split(" - ").map(s => s.trim()).filter(Boolean);
  const canal = (rawAuthor || "").replace(/\s*-\s*Topic$/i, "").trim();

  if(parts.length > 1){
    return { title: parts.slice(1).join(" - "), artist: prod ? prod[1] : parts[0] };
  }
  return { title: base, artist: prod ? prod[1] : canal };
}

// ===== CORES =====
// Sorteia uma matiz nova por faixa e deriva a paleta dela (+20 e +40), entao
// as 3 cores sempre combinam. O verde-amarelado (60-160) fica ruim no fundo
// escuro, e nao basta desviar a matiz base: as derivadas cairiam nele do
// mesmo jeito. Sorteia direto no espaco que mantem as tres fora — [0,20] e
// [160,359], que dao vermelho, laranja, ciano, azul, roxo, magenta e rosa.
let corParticula = "rgba(160,110,255,.6)";

function sortearCores(){
  const n = Math.floor(Math.random() * 221);
  const h = n <= 20 ? n : n - 21 + 160;
  const raiz = document.documentElement.style;
  raiz.setProperty("--c1",   `hsl(${h} 90% 74%)`);
  raiz.setProperty("--c2",   `hsl(${(h + 40) % 360} 85% 68%)`);
  raiz.setProperty("--c3",   `hsl(${(h + 20) % 360} 78% 56%)`);
  raiz.setProperty("--glow", `hsla(${h}, 85%, 55%, .55)`);
  corParticula = `hsla(${h}, 80%, 72%, .6)`;
}

// ===== CAPA =====
// maxresdefault nao existe pra todo video; cai pro hqdefault, que sempre existe.
function setCover(id){
  cover.dataset.tentativa = "max";
  cover.style.display = "";
  coverFall.style.display = "none";
  cover.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}
cover.onerror = () => {
  if(cover.dataset.tentativa === "max"){
    cover.dataset.tentativa = "hq";
    cover.src = cover.src.replace("maxresdefault", "hqdefault");
    return;
  }
  cover.style.display = "none";
  coverFall.style.display = "flex";
};

// ===== UI =====
function play(){
  vinyl.classList.add("playing");
  eq.classList.add("playing");
  toggle.textContent = "⏸";
}
function pause(){
  vinyl.classList.remove("playing");
  eq.classList.remove("playing");
  toggle.textContent = "▶";
}

function avisar(msg){
  titleEl.textContent  = msg;
  artistEl.textContent = "";
}

// So mexe na tela quando o video muda de verdade — onStateChange dispara varias
// vezes por faixa e nao queremos re-sortear a cor a cada pause/play.
function atualizarFaixa(){
  if(!player || !player.getVideoData) return;
  const d = player.getVideoData();
  if(!d || !d.video_id || d.video_id === videoAtual) return;

  // contador e por faixa: uma que estourou o limite nao pode cegar a proxima
  if(d.video_id !== esperandoId){ esperandoId = d.video_id; tentativasMeta = 0; }

  // Na troca de faixa o video_id chega antes do title/author. Fechar o guard
  // aqui perderia a metadata pra sempre — ela so chega no proximo tick, e o
  // proximo tick veria id igual e sairia. Entao espera o titulo aparecer.
  if(!d.title && tentativasMeta < 40){
    tentativasMeta++;
    clearTimeout(esperaMeta);
    esperaMeta = setTimeout(atualizarFaixa, 120);
    return;
  }
  clearTimeout(esperaMeta);
  tentativasMeta = 0;

  videoAtual = d.video_id;
  errosSeguidos = 0;

  const over = meta[d.video_id] || {};
  const p    = parseTitulo(d.title, d.author);
  titleEl.textContent  = over.title  || p.title  || "—";
  artistEl.textContent = over.artist || p.artist || "";
  bar.style.width = "0%";
  setCover(d.video_id);
  sortearCores();
}


function detectarAnuncio() {
  if(!pronto || !player) return false;
  
  try {
    const estado = player.getPlayerState();
    const duracao = player.getDuration();
    const videoData = player.getVideoData();
    
    if(estado !== 1) return false;
    
    if(duracao > 0 && duracao < 10) {
      return true;
    }
    
    if(videoData && videoData.title) {
      const titulo = videoData.title.toLowerCase();
      const palavrasAnuncio = [
        'advertisement', 'commercial', 'sponsored content',
        'pular anúncio', 'skip ad'
      ];
      if(palavrasAnuncio.some(palavra => titulo.includes(palavra))) {
        return true;
      }
    }
    
    return false;
    
  } catch(e) {
    return false;
  }
}

function pularAnuncio() {
  if(!pronto || !player || !emAnuncio) return;
  
  try {
    tentativasPular++;
    
    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    if(skipBtn && skipBtn.style.display !== 'none' && skipBtn.offsetParent !== null) {
      skipBtn.click();
      emAnuncio = false;
      tentativasPular = 0;
      return;
    }
    
    if(tentativasPular === 1) {
      const videoId = player.getVideoData().video_id;
      if(videoId) {
        player.loadVideoById(videoId);
        setTimeout(() => {
          if(emAnuncio) {
            player.playVideo();
          }
        }, 1000);
        return;
      }
    }
    
    if(tentativasPular >= 2) {
      player.playVideo();
      if(tentativasPular >= 3) {
        emAnuncio = false;
        tentativasPular = 0;
      }
      return;
    }
    
  } catch(e) {
    emAnuncio = false;
    tentativasPular = 0;
  }
}

function verificarAnuncioReal() {
  if(!pronto || !player) return false;
  
  try {
    const temBotaoPular = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
    if(temBotaoPular && temBotaoPular.offsetParent !== null) {
      return true;
    }
    
    const temOverlay = document.querySelector('.ytp-ad-overlay-container');
    if(temOverlay && temOverlay.offsetParent !== null) {
      return true;
    }
    
    const videoData = player.getVideoData();
    if(videoData && videoData.title) {
      const titulo = videoData.title.toLowerCase();
      if(titulo.includes('anúncio') || titulo.includes('anuncio') || 
         titulo.includes('ad') || titulo.includes('commercial')) {
        return true;
      }
    }
    
    return false;
    
  } catch(e) {
    return false;
  }
}

// ===== CONTROLES =====
function carregarManual(i){
  if(!faixas.length) return;
  idx = (i + faixas.length) % faixas.length;
  player.loadVideoById(faixas[idx].id);
}
function next(){ 
  if(modoLista) {
    player.nextVideo();
  } else {
    carregarManual(idx + 1);
  }
}
function prev(){ 
  if(modoLista) {
    player.previousVideo();
  } else {
    carregarManual(idx - 1);
  }
}

function gestoDoSom(){ return Date.now() - tGesto < 400; }

toggle.onclick = () => {
  if(!pronto || gestoDoSom()) return;
  if(player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
};
nextB.onclick = () => pronto && !gestoDoSom() && next();
prevB.onclick = () => pronto && !gestoDoSom() && prev();

// ===== VOLUME =====
let lastVol = 1;

function updIcon(v){
  const mudo = v === 0 || aguardandoGesto;
  volIcon.classList.toggle("mute", mudo);
  volIcon.classList.toggle("baixo", !mudo && v < 0.5);
  volIcon.setAttribute("aria-label", mudo ? "Tirar do mudo" : "Mudo");
}
function aplicarVolume(v){
  vol.value = v;
  if(pronto){
    player.setVolume(v * 100);
    // enquanto espera o gesto o player segue mudo, senao o browser pausa tudo
    if(aguardandoGesto) player.mute();
    else v > 0 ? player.unMute() : player.mute();   // so setVolume(0) nao tira do mute
  }
  updIcon(v);
}
vol.oninput = () => {
  const v = +vol.value;
  if(v > 0) lastVol = v;
  aplicarVolume(v);
};
volIcon.onclick = () => {
  if(gestoDoSom()) return;   // esse clique so ligou o som
  const v = +vol.value;
  if(v > 0){ lastVol = v; aplicarVolume(0); }
  else aplicarVolume(lastVol || 1);
};

// ===== YOUTUBE =====
// Sem timeupdate: o iframe nao emite progresso, entao consulta em intervalo.
setInterval(() => {
  if(!pronto || !player.getDuration) return;
  const d = player.getDuration();
  if(d > 0) bar.style.width = (player.getCurrentTime() / d * 100) + "%";
}, 250);

// ===== AUTOPLAY =====
// Autoplay COM som so passa se o browser ja confia na origem (no Chrome, o
// Media Engagement Index sobe conforme voce ouve audio no site). Autoplay MUDO
// passa sempre. Entao: tenta com som e, se em 1s nao engatou, toca mudo e liga
// o som no primeiro gesto real. Clique sintetico nao serve — `isTrusted:false`
// nao conta como gesto pra nenhum browser.
const GESTOS = ["pointerdown", "keydown", "touchstart"];

function acordarSom(){
  if(!aguardandoGesto) return;
  aguardandoGesto = false;
  tGesto = Date.now();
  for(const ev of GESTOS) document.removeEventListener(ev, acordarSom, true);
  avisoMudo.classList.remove("on");
  const v = +vol.value;
  aplicarVolume(v > 0 ? v : (lastVol || 1));
  if(player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
}

function tocarMudo(){
  aguardandoGesto = true;
  player.mute();
  player.playVideo();
  updIcon(+vol.value);
  avisoMudo.classList.add("on");
  // captura: precisa rodar antes do onclick dos controles
  for(const ev of GESTOS) document.addEventListener(ev, acordarSom, true);
}

function onReady(){
  pronto = true;
  aplicarVolume(+vol.value);
  if(modoLista && cfg.shuffle !== false) player.setShuffle(true);
  player.playVideo();

  setTimeout(() => {
    if(player.getPlayerState() !== YT.PlayerState.PLAYING) tocarMudo();
  }, 1000);
}

function onState(e){
  estadoAnterior = e.data;
  
  if(e.data === YT.PlayerState.PLAYING) {
    play();
    
    setTimeout(() => {
      if(verificarAnuncioReal()) {
        if(!emAnuncio) {
          emAnuncio = true;
          tentativasPular = 0;
          pularAnuncio();
        }
      } else {
        if(emAnuncio) {
          emAnuncio = false;
          tentativasPular = 0;
        }
      }
    }, 1500);
    
  } else if(e.data === YT.PlayerState.PAUSED) {
    pause();
    if(e.data === 2 && estadoAnterior === 1 && !gestoDoSom()) {
      setTimeout(() => {
        if(verificarAnuncioReal()) {
          emAnuncio = true;
          tentativasPular = 0;
          pularAnuncio();
        }
      }, 500);
    }
    
  } else if(e.data === YT.PlayerState.ENDED){
    pause();
    if(!modoLista) next();
  }
  
  atualizarFaixa();
}

// 2 id invalido | 5 incompativel | 100 removido/privado | 101,150 embed bloqueado
function onErro(e){
  const limite = modoLista ? 5 : Math.max(faixas.length, 1);
  if(++errosSeguidos > limite){ avisar("nenhuma faixa disponivel"); return; }
  artistEl.textContent = `faixa indisponivel (erro ${e.data}) — pulando`;
  setTimeout(next, 1200);
}

// JSON nao aceita virgula sobrando antes de ] ou }, e esse arquivo e editado na
// mao o tempo todo — e o erro mais comum. Tenta o parse limpo; falhando, tira as
// virgulas orfas, avisa no console e segue.
function parseTolerante(txt){
  try{
    return JSON.parse(txt);
  }catch(e){
    const obj = JSON.parse(txt.replace(/,(\s*[}\]])/g, "$1"));
    console.warn("playlist.json: virgula sobrando antes de ] ou }. Funciona, mas corrija.");
    return obj;
  }
}

async function carregarConfig(){
  try{
    const r = await fetch("playlist.json");
    if(!r.ok) throw new Error(`HTTP ${r.status} — playlist.json nao encontrado`);
    return Object.assign({}, PADRAO, parseTolerante(await r.text()));
  }catch(e){
        // sem isso o erro real some e a tela mente dizendo que o arquivo esta vazio
    erroConfig = e.message;
    console.error("playlist.json:", e);
    return PADRAO;
  }
}

// embaralha (Fisher-Yates) — ordem nova a cada refresh
function embaralhar(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== MONITOR SUAVE ANTI-ANÚNCIO =====
function iniciarMonitorAntiAnuncio() {
  setInterval(() => {
    if(!pronto || !player) return;
    
    try {
      const estado = player.getPlayerState();
      
      // Só verifica se estiver tocando
      if(estado === 1) {
        // Verifica se realmente tem um anúncio
        if(verificarAnuncioReal()) {
          if(!emAnuncio) {
            emAnuncio = true;
            tentativasPular = 0;
            pularAnuncio();
          }
        } else {
          // Se não tiver anúncio, reseta estado
          if(emAnuncio) {
            emAnuncio = false;
            tentativasPular = 0;
          }
        }
      }
      
    } catch(e) {
      // Silencia erros para não poluir o console
    }
  }, 3000); // Verifica a cada 3 segundos
}

window.onYouTubeIframeAPIReady = async () => {
  cfg = await carregarConfig();
  modoLista = !!(cfg.list || "").trim();

  const vars = {
    // Parâmetros principais
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    enablejsapi: 1,
    iv_load_policy: 3,        // Remove anotações
    cc_load_policy: 0,        // Desativa legendas automáticas
    fs: 0,                    // Remove botão de tela cheia
    showinfo: 0,              // Remove informações do vídeo
    autohide: 1,              // Esconde controles automaticamente

    // Parâmetros adicionais para melhor experiência
    color: 'white',           // Cor do player
    theme: 'dark',            // Tema escuro
    wmode: 'opaque',          // Modo de renderização
    loop: modoLista ? 1 : 0,  // Loop apenas se for playlist

    origin: location.origin.startsWith("http") ? location.origin : "https://www.youtube.com",
    widget_referrer: location.href
  };

  // Adiciona parâmetros específicos se for playlist
  if(modoLista){
    vars.listType = "playlist";
    vars.list = cfg.list.trim();
    vars.loop = 1;
  }else{
    faixas = (cfg.videos || []).filter(v => v && (v.id || "").trim());
    if(!faixas.length){
      avisar(erroConfig ? "erro em playlist.json" : "configure playlist.json");
      artistEl.textContent = erroConfig || "sem 'list' nem 'videos'";
      return;
    }
    for(const v of faixas) meta[v.id] = v;
    if(cfg.shuffle !== false) embaralhar(faixas);
    vars.videoId = faixas[0].id;
  }

  player = new YT.Player("yt", {
    width: 200,
    height: 200,
    videoId: vars.videoId,
    playerVars: vars,
    events: { 
      onReady, 
      onStateChange: onState, 
      onError: onErro 
    },
    host: 'https://www.youtube.com',
    origin: location.origin
  });

  iniciarMonitorAntiAnuncio();
};

// ===== FUNDO ANIMADO (particulas) =====
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
