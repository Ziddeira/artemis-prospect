/* Ártemis Prospect — player do vídeo e ponte para a exportação.
 *
 * Abrindo video/index.html (por um servidor local), o vídeo toca com
 * som e dá para gravar direto do navegador. Com ?render=1 a página vira
 * só o canvas em 1080x1920 e expõe window.REELS para o render.mjs
 * exportar quadro a quadro.
 */
(function () {
  "use strict";

  const AP = window.AP;
  const tela = document.getElementById("tela");
  const ctx = tela.getContext("2d");
  const modoRender = new URLSearchParams(location.search).has("render");
  if (modoRender) document.body.classList.add("render");

  function carregarImagem(src) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => {
        console.warn("Não carregou a imagem", src);
        ok(img);
      };
      img.src = src;
    });
  }

  const FONTES = [
    "600 20px 'Chakra Petch'",
    "700 20px 'Chakra Petch'",
    "italic 700 20px 'Chakra Petch'",
    "400 20px Manrope",
    "600 20px Manrope",
    "700 20px Manrope",
    "800 20px Manrope",
  ];

  const pronto = (async () => {
    const [pensando, mascote] = await Promise.all([
      carregarImagem("../public/artemis/artemis-pensando.jpeg"),
      carregarImagem("../public/brand/artemis-mascote.png"),
      ...FONTES.map((f) => document.fonts.load(f, "ÁRTEMIS Ãçê")),
    ]);
    AP.IMG.pensando = pensando;
    AP.IMG.mascote = mascote;
    await document.fonts.ready;
    AP.desenhar(ctx, 0);
  })();

  let somPromessa = null;
  const som = () => (somPromessa = somPromessa || AP.gerarSom());

  function base64(ab) {
    const bytes = new Uint8Array(ab);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  // API usada pelo render.mjs
  window.REELS = {
    pronto,
    W: AP.W,
    H: AP.H,
    FPS: AP.FPS,
    DURACAO: AP.DURACAO,
    quadro(i, tipo = "image/png", qualidade) {
      AP.desenhar(ctx, i / AP.FPS);
      return tela.toDataURL(tipo, qualidade);
    },
    async somWavBase64() {
      return base64(AP.wav(await som()));
    },
  };

  if (modoRender) return;

  // -----------------------------------------------------------------
  // Player
  // -----------------------------------------------------------------
  const el = (id) => document.getElementById(id);
  const barra = el("barra"), bPlay = el("play"), bReinicia = el("reinicia");
  const bGrava = el("grava"), bSom = el("baixaSom"), capa = el("capa"), rotTempo = el("tempo"), aviso = el("aviso");

  let audio = null; // AudioContext
  let fonte = null; // AudioBufferSourceNode tocando
  let inicio = 0; // audio.currentTime correspondente a t = 0
  let pos = 0; // posição quando pausado
  let tocando = false;
  let gravador = null;

  const fmt = (t) => t.toFixed(1).replace(".", ",");

  function mostrar(t) {
    AP.desenhar(ctx, t);
    barra.value = String(t);
    rotTempo.textContent = `${fmt(t)} / ${fmt(AP.DURACAO)} s`;
  }

  async function tocar(de, destinoExtra) {
    await pronto;
    if (!audio) audio = new AudioContext();
    await audio.resume();
    const buffer = await som();
    parar();
    fonte = audio.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(audio.destination);
    if (destinoExtra) fonte.connect(destinoExtra);
    inicio = audio.currentTime + 0.05 - de;
    fonte.start(audio.currentTime + 0.05, de);
    tocando = true;
    bPlay.textContent = "Pausar";
    capa.hidden = true;
    requestAnimationFrame(quadro);
  }

  function parar() {
    if (fonte) {
      fonte.onended = null;
      try { fonte.stop(); } catch { /* já parou */ }
      fonte.disconnect();
      fonte = null;
    }
    tocando = false;
    bPlay.textContent = "Play";
  }

  function quadro() {
    if (!tocando) return;
    const t = Math.max(0, audio.currentTime - inicio);
    if (t >= AP.DURACAO) {
      mostrar(AP.DURACAO - 1e-3);
      pos = 0;
      parar();
      if (gravador && gravador.state === "recording") gravador.stop();
      return;
    }
    mostrar(t);
    requestAnimationFrame(quadro);
  }

  bPlay.addEventListener("click", () => {
    if (tocando) {
      pos = Math.max(0, audio.currentTime - inicio);
      parar();
    } else tocar(pos >= AP.DURACAO - 0.05 ? 0 : pos);
  });
  capa.addEventListener("click", () => tocar(0));
  bReinicia.addEventListener("click", () => {
    pos = 0;
    if (tocando) tocar(0);
    else mostrar(0);
  });
  barra.addEventListener("input", () => {
    pos = Number(barra.value);
    if (tocando) tocar(pos);
    else mostrar(pos);
  });

  function baixar(blob, nome) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  bSom.addEventListener("click", async () => {
    bSom.disabled = true;
    const buf = await som();
    baixar(new Blob([AP.wav(buf)], { type: "audio/wav" }), "artemis-prospect-reels.wav");
    bSom.disabled = false;
  });

  // Gravação em tempo real pelo navegador (MP4 no Chrome/Safari recentes,
  // WebM nos demais). Para qualidade máxima, use o render.mjs.
  bGrava.addEventListener("click", async () => {
    if (gravador && gravador.state === "recording") return;
    await pronto;
    if (!audio) audio = new AudioContext();
    const tipos = [
      "video/mp4;codecs=avc1.640028,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm",
    ];
    const tipo = tipos.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!tipo) {
      aviso.textContent = "Este navegador não grava vídeo. Use o render.mjs (video/README.md).";
      return;
    }
    const destino = audio.createMediaStreamDestination();
    const stream = new MediaStream([
      ...tela.captureStream(AP.FPS).getVideoTracks(),
      ...destino.stream.getAudioTracks(),
    ]);
    const partes = [];
    gravador = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
    gravador.ondataavailable = (e) => e.data.size && partes.push(e.data);
    gravador.onstop = () => {
      const ext = tipo.startsWith("video/mp4") ? "mp4" : "webm";
      baixar(new Blob(partes, { type: tipo }), `artemis-prospect-reels.${ext}`);
      bGrava.disabled = false;
      bGrava.textContent = "Gravar vídeo";
      aviso.textContent = `Pronto: vídeo salvo (.${ext}).`;
    };
    bGrava.disabled = true;
    bGrava.textContent = "Gravando…";
    aviso.textContent = "Gravando em tempo real (40 s). Deixe esta aba aberta e visível.";
    gravador.start(250);
    pos = 0;
    tocar(0, destino);
  });

  // O som é gerado uma vez ao abrir (leva alguns segundos). Até lá, os
  // botões que tocam ficam desligados e a capa avisa.
  const tocaveis = [bPlay, bGrava, bSom, capa];
  const rotuloCapa = capa.querySelector("span");
  tocaveis.forEach((b) => (b.disabled = true));
  rotuloCapa.textContent = "PREPARANDO O SOM…";
  pronto
    .then(() => {
      mostrar(0);
      return som();
    })
    .then(() => {
      tocaveis.forEach((b) => (b.disabled = false));
      rotuloCapa.textContent = "▶ ASSISTIR COM SOM";
    });
})();
