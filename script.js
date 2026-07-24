const audio  = document.getElementById("audio");
const button = document.getElementById("playButton");
const vinyl  = document.getElementById("vinyl");
const eq     = document.getElementById("eq");
const bar    = document.getElementById("bar");
const toggle = document.getElementById("toggleBtn");

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

// tenta autoplay
audio.play().then(play).catch(() => {
  // navegador bloqueou -> mostra botao
  button.classList.remove("hidden");
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
    ctx.fillStyle = "rgba(160,110,255,.6)";
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();
