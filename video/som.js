/* Ártemis Prospect — trilha e efeitos sonoros do vídeo.
 *
 * Tudo é sintetizado com a Web Audio API (nenhum arquivo de áudio,
 * nenhum direito autoral de terceiros): uma batida eletrônica a 120 BPM
 * em lá menor (Am – F – C – G) e os efeitos (whoosh, pop, teclas,
 * clique, radar, cadeado, mensagem, caixa registradora) nos tempos do
 * roteiro.js.
 *
 * AP.gerarSom() renderiza tudo num OfflineAudioContext e devolve um
 * AudioBuffer de 40 s. O mesmo buffer toca no navegador e vira o WAV
 * que o render.mjs junta ao vídeo.
 */
(function () {
  "use strict";

  const AP = (window.AP = window.AP || {});

  const BATIDA = 60 / 120; // 0,5 s
  const COMPASSO = BATIDA * 4; // 2 s

  // Frequência de uma nota MIDI.
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Am – F – C – G (um acorde por compasso)
  const ACORDES = [
    { baixo: 45, notas: [57, 60, 64] }, // Am
    { baixo: 41, notas: [53, 57, 60] }, // F
    { baixo: 48, notas: [55, 60, 64] }, // C
    { baixo: 43, notas: [55, 59, 62] }, // G
  ];

  AP.gerarSom = async function (taxa = 48000) {
    const dur = AP.DURACAO;
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * taxa), taxa);
    const r = AP.rng(2026);

    // --- mixagem --------------------------------------------------
    const mestre = ctx.createGain();
    mestre.gain.value = 0.8;
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -8;
    limitador.knee.value = 4;
    limitador.ratio.value = 12;
    limitador.attack.value = 0.002;
    limitador.release.value = 0.12;
    mestre.connect(limitador).connect(ctx.destination);

    const musica = ctx.createGain();
    musica.gain.value = 0.62;
    musica.connect(mestre);
    const efeitos = ctx.createGain();
    efeitos.gain.value = 0.85;
    efeitos.connect(mestre);

    // "sidechain": pad e baixo abaixam a cada bumbo, dando o balanço
    const duck = ctx.createGain();
    duck.connect(musica);

    // reverb com resposta ao impulso gerada (ruído com decaimento)
    const reverb = ctx.createConvolver();
    {
      const len = Math.floor(taxa * 2.4);
      const ir = ctx.createBuffer(2, len, taxa);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      reverb.buffer = ir;
    }
    const retornoReverb = ctx.createGain();
    retornoReverb.gain.value = 0.32;
    reverb.connect(retornoReverb).connect(mestre);

    // delay (colcheia pontuada) para o arpejo
    const delay = ctx.createDelay(1);
    delay.delayTime.value = BATIDA * 0.75;
    const realimenta = ctx.createGain();
    realimenta.gain.value = 0.32;
    const delayFiltro = ctx.createBiquadFilter();
    delayFiltro.type = "lowpass";
    delayFiltro.frequency.value = 2600;
    delay.connect(delayFiltro).connect(realimenta).connect(delay);
    const retornoDelay = ctx.createGain();
    retornoDelay.gain.value = 0.35;
    delayFiltro.connect(retornoDelay).connect(musica);

    // ruído branco reutilizável
    const ruido = ctx.createBuffer(1, taxa * 2, taxa);
    {
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    }
    function fonteRuido(t, duracao) {
      const s = ctx.createBufferSource();
      s.buffer = ruido;
      s.loop = true;
      s.start(t, r() * 1.5);
      s.stop(t + duracao + 0.05);
      return s;
    }
    function env(t, ataque, decai, pico, destino) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(pico, t + ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + decai);
      if (destino) g.connect(destino);
      return g;
    }
    function panear(valor, destino) {
      const p = ctx.createStereoPanner();
      p.pan.value = valor;
      p.connect(destino);
      return p;
    }

    // --- bateria --------------------------------------------------
    function bumbo(t, v = 1) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      o.connect(env(t, 0.002, 0.42, 0.95 * v, musica));
      o.start(t);
      o.stop(t + 0.5);
      const n = fonteRuido(t, 0.02);
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 2500;
      n.connect(f).connect(env(t, 0.001, 0.015, 0.25 * v, musica));
      // sidechain
      duck.gain.setValueAtTime(1, Math.max(0, t - 0.001));
      duck.gain.linearRampToValueAtTime(0.35, t + 0.01);
      duck.gain.linearRampToValueAtTime(1, t + 0.3);
    }
    function palmas(t, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1400;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.011, 0.022].forEach((d) => {
        g.gain.setValueAtTime(0.55 * v, t + d);
        g.gain.exponentialRampToValueAtTime(0.08 * v, t + d + 0.009);
      });
      g.gain.setValueAtTime(0.5 * v, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      fonteRuido(t, 0.3).connect(f).connect(g);
      g.connect(musica);
      const envio = ctx.createGain();
      envio.gain.value = 0.35;
      g.connect(envio).connect(reverb);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
      o.connect(env(t, 0.001, 0.08, 0.2 * v, musica));
      o.start(t);
      o.stop(t + 0.12);
    }
    function chimbal(t, aberto, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7500;
      const dec = aberto ? 0.22 : 0.035;
      fonteRuido(t, dec + 0.05).connect(f).connect(env(t, 0.001, dec, (aberto ? 0.2 : 0.16) * v, panear(0.25, musica)));
    }
    function prato(t, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 5000;
      const g = env(t, 0.002, 1.6, 0.22 * v, musica);
      fonteRuido(t, 1.8).connect(f).connect(g);
      const envio = ctx.createGain();
      envio.gain.value = 0.3;
      g.connect(envio).connect(reverb);
    }
    function caixa(t, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800;
      f.Q.value = 0.6;
      fonteRuido(t, 0.15).connect(f).connect(env(t, 0.001, 0.11, 0.35 * v, musica));
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 200;
      o.connect(env(t, 0.001, 0.06, 0.18 * v, musica));
      o.start(t);
      o.stop(t + 0.1);
    }

    // --- instrumentos ---------------------------------------------
    function baixo(t, nota, d, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 6;
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(180, t + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.32 * v, t + 0.008);
      g.gain.setValueAtTime(0.32 * v, t + d * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      f.connect(g).connect(duck);
      const o1 = ctx.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.value = hz(nota);
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = hz(nota);
      const g2 = ctx.createGain();
      g2.gain.value = 0.75;
      o1.connect(f);
      o2.connect(g2).connect(g);
      [o1, o2].forEach((o) => {
        o.start(t);
        o.stop(t + d + 0.02);
      });
    }
    function pad(t, notas, d, corte, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = corte;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * v, t + 0.25);
      g.gain.setValueAtTime(0.07 * v, t + d - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + d + 0.3);
      f.connect(g);
      g.connect(duck);
      const envio = ctx.createGain();
      envio.gain.value = 0.4;
      g.connect(envio).connect(reverb);
      notas.forEach((n, i) => {
        [-7, 7].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = hz(n);
          o.detune.value = cents + i;
          const p = ctx.createStereoPanner();
          p.pan.value = cents > 0 ? 0.35 : -0.35;
          o.connect(p).connect(f);
          o.start(t);
          o.stop(t + d + 0.4);
        });
      });
    }
    function pluck(t, nota, v = 1, pan = 0) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = hz(nota);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 4;
      f.frequency.setValueAtTime(4200, t);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.18);
      const g = env(t, 0.002, 0.22, 0.1 * v, null);
      const p = panear(pan, musica);
      o.connect(f).connect(g).connect(p);
      g.connect(delay);
      o.start(t);
      o.stop(t + 0.3);
    }
    function sino(t, nota, v = 1, destino = musica) {
      [1, 2.01, 3.98].forEach((k, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = hz(nota) * k;
        const g = env(t, 0.003, 0.9 / (i + 1), (0.14 / (i + 1)) * v, destino);
        const envio = ctx.createGain();
        envio.gain.value = 0.5;
        g.connect(envio).connect(reverb);
        o.connect(g);
        o.start(t);
        o.stop(t + 1.2);
      });
    }

    // --- efeitos --------------------------------------------------
    function whoosh(t, v, dur = 0.45, dir = 1) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(350, t);
      f.frequency.exponentialRampToValueAtTime(4200, t + dur * 0.7);
      f.frequency.exponentialRampToValueAtTime(1500, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * v, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(0.7 * dir, t);
      p.pan.linearRampToValueAtTime(-0.7 * dir, t + dur);
      fonteRuido(t, dur).connect(f).connect(g).connect(p).connect(efeitos);
    }
    function pop(t, v, freq = 700) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.09);
      o.connect(env(t, 0.002, 0.11, 0.5 * v, efeitos));
      o.start(t);
      o.stop(t + 0.15);
    }
    function slam(t, v) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
      o.connect(env(t, 0.002, 0.55, 0.9 * v, efeitos));
      o.start(t);
      o.stop(t + 0.6);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2200;
      const g = env(t, 0.001, 0.25, 0.45 * v, efeitos);
      fonteRuido(t, 0.3).connect(f).connect(g);
      const envio = ctx.createGain();
      envio.gain.value = 0.4;
      g.connect(envio).connect(reverb);
    }
    function impacto(t, v) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
      o.connect(env(t, 0.003, 1.8, 1.0 * v, efeitos));
      o.start(t);
      o.stop(t + 2);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(5000, t);
      f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
      const g = env(t, 0.002, 1.3, 0.6 * v, efeitos);
      fonteRuido(t, 1.5).connect(f).connect(g);
      const envio = ctx.createGain();
      envio.gain.value = 0.7;
      g.connect(envio).connect(reverb);
      prato(t, 1.2 * v);
    }
    function riser(t, v, dur) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55 * v, t + dur - 0.02);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      fonteRuido(t, dur).connect(f).connect(g).connect(efeitos);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(hz(45), t);
      o.frequency.exponentialRampToValueAtTime(hz(81), t + dur);
      const fo = ctx.createBiquadFilter();
      fo.type = "lowpass";
      fo.frequency.setValueAtTime(400, t);
      fo.frequency.exponentialRampToValueAtTime(5000, t + dur);
      const go = ctx.createGain();
      go.gain.setValueAtTime(0.0001, t);
      go.gain.exponentialRampToValueAtTime(0.12 * v, t + dur - 0.02);
      go.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(fo).connect(go).connect(efeitos);
      o.start(t);
      o.stop(t + dur);
    }
    function tecla(t, v) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2200 + r() * 1800;
      f.Q.value = 1.5;
      fonteRuido(t, 0.04).connect(f).connect(env(t, 0.001, 0.03, 0.4 * v, panear((r() - 0.5) * 0.4, efeitos)));
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 180 + r() * 60;
      o.connect(env(t, 0.001, 0.025, 0.12 * v, efeitos));
      o.start(t);
      o.stop(t + 0.05);
    }
    function clique(t, v) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 2000;
      fonteRuido(t, 0.03).connect(f).connect(env(t, 0.001, 0.02, 0.5 * v, efeitos));
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1800, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
      o.connect(env(t, 0.001, 0.05, 0.3 * v, efeitos));
      o.start(t);
      o.stop(t + 0.08);
    }
    function blip(t, v, freq) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 3500;
      o.connect(f).connect(env(t, 0.002, 0.08, 0.12 * v, panear((r() - 0.5) * 0.6, efeitos)));
      o.start(t);
      o.stop(t + 0.12);
    }
    function sonar(t, v) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 1320;
      const g = env(t, 0.004, 0.5, 0.18 * v, efeitos);
      const envio = ctx.createGain();
      envio.gain.value = 0.8;
      g.connect(envio).connect(reverb);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.6);
    }
    function varredura(t, v, dur) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(1200, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 * v, t + 0.1);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(efeitos);
      o.start(t);
      o.stop(t + dur);
    }
    function trava(t, v) {
      [0, 0.1].forEach((d, i) => {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = i ? 1760 : 1320;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 4000;
        o.connect(f).connect(env(t + d, 0.002, 0.07, 0.14 * v, efeitos));
        o.start(t + d);
        o.stop(t + d + 0.1);
      });
      slam(t + 0.1, 0.45 * v);
    }
    function cadeado(t, v) {
      [0, 0.06].forEach((d) => {
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 3200;
        f.Q.value = 6;
        fonteRuido(t + d, 0.05).connect(f).connect(env(t + d, 0.001, 0.04, 0.9 * v, efeitos));
      });
    }
    function clack(t, v) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 900;
      f.Q.value = 3;
      fonteRuido(t, 0.08).connect(f).connect(env(t, 0.001, 0.07, 0.8 * v, efeitos));
    }
    function bolha(t, v) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
      o.connect(env(t, 0.004, 0.16, 0.45 * v, efeitos));
      o.start(t);
      o.stop(t + 0.2);
      sino(t + 0.08, 84, 0.5 * v, efeitos);
    }
    function enviada(t, v) {
      whoosh(t - 0.05, 0.35 * v, 0.2, -1);
      pop(t + 0.1, 0.6 * v, 900);
    }
    function recebida(t, v) {
      sino(t, 81, 0.9 * v, efeitos);
      sino(t + 0.12, 88, 0.9 * v, efeitos);
    }
    function caixaRegistradora(t, v) {
      // "tchan-tchin": sinos brilhantes + moedas
      [88, 93, 96, 100].forEach((n, i) => sino(t + i * 0.06, n, 0.9 * v, efeitos));
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 6000;
      fonteRuido(t, 0.5).connect(f).connect(env(t, 0.005, 0.45, 0.25 * v, efeitos));
    }

    // --- arranjo --------------------------------------------------
    const FIM_MUSICA = AP.K.final; // 38 s: acorde final
    const nCompassos = Math.ceil(FIM_MUSICA / COMPASSO);
    for (let c = 0; c < nCompassos; c++) {
      const t0 = c * COMPASSO;
      const ac = ACORDES[c % 4];
      const intro = t0 < 8;
      // pad (mais fechado na introdução)
      pad(t0, ac.notas, COMPASSO, intro ? 700 + c * 250 : 2400, intro ? 0.8 : 1);

      for (let b = 0; b < 4; b++) {
        const tb = t0 + b * BATIDA;
        if (tb >= FIM_MUSICA) break;
        // na introdução o bumbo para em 7,75 s (silêncio antes do impacto)
        if (!(tb >= 7.75 && tb < 8)) bumbo(tb, intro ? 0.75 : 1);
        if (!intro && (b === 1 || b === 3)) palmas(tb);
        if (!intro || c >= 2) {
          chimbal(tb + BATIDA / 2, !intro, intro ? 0.6 : 1);
          if (!intro) {
            chimbal(tb + BATIDA / 4, false, 0.5);
            chimbal(tb + (BATIDA * 3) / 4, false, 0.5);
          }
        }
      }
      // baixo em colcheias (a partir da logo)
      if (!intro) {
        for (let k = 0; k < 8; k++) {
          const tk = t0 + k * (BATIDA / 2);
          if (tk >= FIM_MUSICA) break;
          const oitava = k % 4 === 3 ? 12 : 0;
          baixo(tk, ac.baixo - 12 + oitava, BATIDA / 2 - 0.02);
        }
      }
      // arpejo em semicolcheias
      if (c >= 1) {
        const padrao = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let k = 0; k < 16; k++) {
          const tk = t0 + k * (BATIDA / 4);
          if (tk >= FIM_MUSICA || (tk >= 7.75 && tk < 8)) continue;
          const nota = ac.notas[padrao[k % 8]] + 12 + (k >= 12 && !intro ? 12 : 0);
          pluck(tk, nota, intro ? 0.55 : 0.8, k % 2 ? 0.3 : -0.3);
        }
      }
      if (!intro && c % 2 === 0) prato(t0, 0.5);
    }
    // rufar da caixa antes do impacto
    for (let t = 7.0; t < 7.75; t += t < 7.5 ? 0.125 : 0.0625) caixa(t, 0.4 + (t - 7) * 0.8);
    // virada antes do CTA
    for (let t = 33.5; t < 34; t += 0.125) caixa(t, 0.6);
    // acorde final
    pad(FIM_MUSICA, [45, 57, 60, 64, 69], 1.6, 2000, 1.8);
    baixo(FIM_MUSICA, 33, 1.4, 1.2);
    impacto(FIM_MUSICA, 0.8);
    sino(FIM_MUSICA + 0.05, 81, 1, efeitos);

    // --- efeitos do roteiro ---------------------------------------
    for (const e of AP.efeitos()) {
      const t = Math.max(0, e.t);
      switch (e.tipo) {
        case "whoosh": whoosh(t, e.v, 0.45, e.dir || 1); break;
        case "whooshCurto": whoosh(t, e.v, 0.28, e.f % 2 ? -1 : 1); break;
        case "pop": pop(t, e.v, e.f); break;
        case "pino": pop(t, e.v, e.f); break;
        case "slam": slam(t, e.v); break;
        case "impacto": impacto(t, e.v); break;
        case "riser": riser(t, e.v, e.dur); break;
        case "tecla": tecla(t, e.v); break;
        case "clique": clique(t, e.v); break;
        case "blip": blip(t, e.v, e.f); break;
        case "sonar": sonar(t, e.v); break;
        case "varredura": varredura(t, e.v, e.dur); break;
        case "trava": trava(t, e.v); break;
        case "cadeado": cadeado(t, e.v); break;
        case "clack": clack(t, e.v); break;
        case "brilho": sino(t, 93, e.v, efeitos); break;
        case "bolha": bolha(t, e.v); break;
        case "enviada": enviada(t, e.v); break;
        case "recebida": recebida(t, e.v); break;
        case "caixa": caixaRegistradora(t, e.v); break;
      }
    }

    // fade-out no fim
    mestre.gain.setValueAtTime(0.8, dur - 1.2);
    mestre.gain.linearRampToValueAtTime(0.0001, dur);

    const buffer = await ctx.startRendering();

    // normaliza o pico em -1 dBFS
    let pico = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) pico = Math.max(pico, Math.abs(d[i]));
    }
    if (pico > 0) {
      const k = 0.89 / pico;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) d[i] *= k;
      }
    }
    return buffer;
  };

  // AudioBuffer -> WAV 16 bits (para o render.mjs e para baixar).
  AP.wav = function (buffer) {
    const nc = buffer.numberOfChannels, n = buffer.length, taxa = buffer.sampleRate;
    const dados = n * nc * 2;
    const ab = new ArrayBuffer(44 + dados);
    const v = new DataView(ab);
    const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + dados, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, nc, true);
    v.setUint32(24, taxa, true);
    v.setUint32(28, taxa * nc * 2, true);
    v.setUint16(32, nc * 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, dados, true);
    const canais = [];
    for (let c = 0; c < nc; c++) canais.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nc; c++) {
        const s = Math.max(-1, Math.min(1, canais[c][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    return ab;
  };
})();
