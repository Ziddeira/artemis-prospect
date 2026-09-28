// Inicialização: carrega mídia, monta a linha do tempo e liga o player.
// Com ?render=1 a página vira um "renderizador" controlado pelo script
// scripts/render.mjs, que pede quadro a quadro e monta o MP4.
import { W, H, FPS, Timeline, loadImage, loadVideo, loadFonts, seekVideo, clamp } from "./engine.js";
import { buildTimeline } from "./scenes.js";
import { initLogo } from "./logo.draw.js";
import { renderMusic, toWav } from "./audio.js";

const IMAGES = {
  salao: "salao.jpg",
  antes1: "antes-1.jpg", depois1: "depois-1.jpg",
  antes2: "antes-2.jpg", depois2: "depois-2.jpg",
  antes3: "antes-3.jpg", depois3: "depois-3.jpg",
  corteVisagista: "corte-visagista.jpg",
  corteInfantil: "corte-infantil.jpg",
  salaKids: "sala-kids.jpg",
  fachada: "fachada.jpg",
  alfredo: "alfredo.jpg", joaoJp: "joao-jp.jpg", leivys: "leivys.jpg", sebastian: "sebastian.jpg", vitor: "vitor.jpg",
};
const VIDEOS = { visagismo: "visagismo.webm", transformacao: "transformacao.webm" };

const isRender = new URLSearchParams(location.search).has("render");
const canvas = document.getElementById("stage");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const say = (s) => status && (status.textContent = s);

async function load() {
  say("Carregando fontes e imagens…");
  await loadFonts("assets/fonts/");
  const img = {}, v = {};
  await Promise.all([
    ...Object.entries(IMAGES).map(async ([k, f]) => (img[k] = await loadImage("assets/img/" + f))),
    ...Object.entries(VIDEOS).map(async ([k, f]) => (v[k] = await loadVideo("assets/video/" + f))),
  ]);
  initLogo();
  return { img, v };
}

const A = await load();
const { scenes, transitions, cuts } = buildTimeline();
const tl = new Timeline(scenes, transitions);
const DUR = tl.duration;
const FRAMES = Math.round(DUR * FPS);

function draw(t) {
  const frame = Math.floor(t * FPS);
  ctx.clearRect(0, 0, W, H);
  tl.render(ctx, t, { A, frame, t });
}

// Posiciona os vídeos exatamente no tempo pedido (usado ao pausar/arrastar e na renderização).
async function seekAll(t) {
  const need = tl.videoTimes(t);
  await Promise.all(Object.entries(need).map(([k, time]) => seekVideo(A.v[k], time)));
}

let musicPromise = null;
const music = () => (musicPromise ||= renderMusic(DUR, cuts));

if (isRender) {
  // ---------- modo renderização (controlado pelo Playwright) ----------
  window.__video = {
    width: W, height: H, fps: FPS, frames: FRAMES, duration: DUR,
    async renderFrame(i) {
      const t = i / FPS;
      await seekAll(t);
      draw(t);
    },
    async audioWavBase64() {
      const blob = toWav(await music());
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
  window.__ready = true;
  say("Pronto para renderizar.");
} else {
  // ---------- modo player (prévia no navegador) ----------
  const btn = document.getElementById("play");
  const seek = document.getElementById("seek");
  const clock = document.getElementById("clock");
  const recBtn = document.getElementById("rec");
  seek.max = DUR;
  let actx = null, src = null, buffer = null;
  let playing = false, startAt = 0, pos = 0, recorder = null;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const now = () => (playing ? actx.currentTime - startAt : pos);

  async function ensureAudio() {
    if (!actx) actx = new AudioContext({ sampleRate: 48000 });
    if (!buffer) {
      say("Gerando a trilha sonora…");
      const off = await music();
      buffer = actx.createBuffer(off.numberOfChannels, off.length, off.sampleRate);
      for (let c = 0; c < off.numberOfChannels; c++) buffer.copyToChannel(off.getChannelData(c), c);
      say("");
    }
    if (actx.state === "suspended") await actx.resume();
  }

  function stopVideos() {
    Object.values(A.v).forEach((v) => v.pause());
  }

  async function play(from = pos) {
    await ensureAudio();
    if (from >= DUR - 0.05) from = 0;
    src = actx.createBufferSource();
    src.buffer = buffer;
    src.connect(actx.destination);
    if (recorder) src.connect(recorder.dest);
    startAt = actx.currentTime - from;
    src.start(0, from);
    playing = true;
    btn.textContent = "❚❚ Pausar";
    requestAnimationFrame(loop);
  }

  function pause() {
    if (!playing) return;
    pos = now();
    playing = false;
    try { src.stop(); } catch {}
    stopVideos();
    btn.textContent = "▶ Reproduzir";
  }

  // Durante a reprodução os vídeos rodam soltos e são corrigidos se escorregarem.
  function syncVideos(t) {
    const need = tl.videoTimes(t);
    for (const [k, v] of Object.entries(A.v)) {
      if (k in need) {
        const target = clamp(need[k], 0, v.duration - 0.2);
        const rate = k === "transformacao" ? 2.1 : 1;
        if (v.playbackRate !== rate) v.playbackRate = rate;
        if (Math.abs(v.currentTime - target) > 0.2) v.currentTime = target;
        if (v.paused) v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    }
  }

  function loop() {
    if (!playing) return;
    const t = now();
    if (t >= DUR) {
      pause();
      pos = DUR;
      draw(DUR - 1 / FPS);
      if (recorder) recorder.finish();
      return;
    }
    syncVideos(t);
    draw(t);
    seek.value = t;
    clock.textContent = `${fmt(t)} / ${fmt(DUR)}`;
    requestAnimationFrame(loop);
  }

  async function showStill(t) {
    pos = t;
    await seekAll(t);
    draw(t);
    clock.textContent = `${fmt(t)} / ${fmt(DUR)}`;
  }

  btn.onclick = () => (playing ? pause() : play());
  seek.oninput = () => {
    const wasPlaying = playing;
    pause();
    showStill(+seek.value).then(() => wasPlaying && play());
  };

  // Gravação direto no navegador (WebM), para quem não quiser usar o script.
  recBtn.onclick = async () => {
    if (recorder) return;
    pause();
    await ensureAudio();
    const dest = actx.createMediaStreamDestination();
    const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      a.download = "studio-supremo-9x16.webm";
      a.click();
      recorder = null;
      recBtn.textContent = "● Gravar WebM";
    };
    recorder = { dest, finish: () => mr.stop() };
    recBtn.textContent = "Gravando…";
    mr.start();
    await showStill(0);
    play(0);
  };

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      btn.click();
    }
  });

  await showStill(0.0);
  say("");
}
