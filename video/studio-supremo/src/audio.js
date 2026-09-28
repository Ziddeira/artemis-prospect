// Trilha sonora original, sintetizada em JavaScript com a Web Audio API
// (OfflineAudioContext). Nenhum arquivo de áudio externo: tudo é gerado
// a partir de osciladores e ruído, então não há problema de direitos.
//
// Estilo: "lo-fi elegante" a 100 BPM, em lá menor.
// Estrutura (1 compasso = 2,4 s):
//   c. 0–1   abertura: pad + subida de ruído
//   c. 2–14  groove completo (bumbo, caixa, chimbal, baixo, arpejo)
//   c. 15–16 respiro (sem bumbo) + subida
//   c. 17–18 groove volta
//   c. 19–20 encerramento: acorde final e fade
import { rng } from "./engine.js";

const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const SR = 48000;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Acordes: baixo + vozes do pad (MIDI).
const CHORDS = [
  { bass: 33, pad: [57, 60, 64, 67, 71] }, // Am9
  { bass: 29, pad: [57, 60, 64, 67] }, // Fmaj9
  { bass: 36, pad: [52, 55, 59, 62] }, // Cmaj9
  { bass: 31, pad: [59, 62, 64, 67] }, // Em7/G
];

function noiseBuffer(ctx, seconds, seed) {
  const r = rng(seed);
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  }
  return buf;
}

function impulse(ctx, seconds, decay, seed) {
  const r = rng(seed);
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export async function renderMusic(duration, cuts = []) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const noise = noiseBuffer(ctx, 3, 11);

  // ---- mixagem ----
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.008;
  comp.release.value = 0.22;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // O compressor do navegador já aplica ganho de compensação; este ganho
  // final deixa a trilha em ~-14 LUFS com folga de pico (padrão das redes).
  const out = ctx.createGain();
  out.gain.value = 0.6;
  master.connect(comp).connect(out).connect(ctx.destination);
  // fade de saída
  master.gain.setValueAtTime(0.9, duration - 2.2);
  master.gain.linearRampToValueAtTime(0, duration - 0.05);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.4, 2.6, 5);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.32;
  reverb.connect(revOut).connect(master);

  const delay = ctx.createDelay(2);
  delay.delayTime.value = BEAT * 0.75; // colcheia pontuada
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  const dlp = ctx.createBiquadFilter();
  dlp.type = "lowpass";
  dlp.frequency.value = 2600;
  delay.connect(dlp).connect(fb).connect(delay);
  const delOut = ctx.createGain();
  delOut.gain.value = 0.5;
  dlp.connect(delOut);
  delOut.connect(master);
  delOut.connect(reverb);

  const send = (node, dry = 1, rev = 0.3, del = 0) => {
    const g = ctx.createGain();
    g.gain.value = dry;
    node.connect(g).connect(master);
    if (rev) {
      const r = ctx.createGain();
      r.gain.value = rev;
      node.connect(r).connect(reverb);
    }
    if (del) {
      const d = ctx.createGain();
      d.gain.value = del;
      node.connect(d).connect(delay);
    }
  };

  // ---- pad ----
  const padBus = ctx.createGain();
  padBus.gain.value = 0.11;
  const padLp = ctx.createBiquadFilter();
  padLp.type = "lowpass";
  padLp.Q.value = 0.6;
  padLp.frequency.setValueAtTime(380, 0);
  padLp.frequency.exponentialRampToValueAtTime(1900, BAR * 2);
  padLp.frequency.setValueAtTime(1900, BAR * 14.5);
  padLp.frequency.exponentialRampToValueAtTime(900, BAR * 15.2);
  padLp.frequency.exponentialRampToValueAtTime(2400, BAR * 17);
  padLp.frequency.setValueAtTime(2400, BAR * 19);
  padLp.frequency.exponentialRampToValueAtTime(700, duration);
  padBus.connect(padLp);
  send(padLp, 1, 0.55);

  const padChord = (chord, t0, len) => {
    for (const m of chord.pad) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.5, t0 + 0.7);
        g.gain.setValueAtTime(0.5, t0 + len - 0.1);
        g.gain.linearRampToValueAtTime(0, t0 + len + 1.3);
        const pan = ctx.createStereoPanner();
        pan.pan.value = det < 0 ? -0.35 : 0.35;
        o.connect(g).connect(pan).connect(padBus);
        o.start(t0);
        o.stop(t0 + len + 1.4);
      }
    }
  };

  // ---- arpejo (teclado tipo piano elétrico) ----
  const keys = ctx.createGain();
  keys.gain.value = 0.085;
  send(keys, 1, 0.35, 0.55);
  const pluck = (m, t0, vel = 1) => {
    const f = mtof(m);
    const car = ctx.createOscillator();
    car.type = "sine";
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 2;
    const mi = ctx.createGain();
    mi.gain.setValueAtTime(f * 1.4, t0);
    mi.gain.exponentialRampToValueAtTime(f * 0.05, t0 + 0.4);
    mod.connect(mi).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vel, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    car.connect(g).connect(keys);
    car.start(t0);
    mod.start(t0);
    car.stop(t0 + 1.2);
    mod.stop(t0 + 1.2);
  };
  const ARP = [0, 2, 1, 3, 2, 4, 3, 1];

  // ---- baixo ----
  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.36;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(2.2 * x);
  }
  shaper.curve = curve;
  const bassLp = ctx.createBiquadFilter();
  bassLp.type = "lowpass";
  bassLp.frequency.value = 420;
  bassBus.connect(shaper).connect(bassLp);
  send(bassLp, 1, 0);
  const bassNote = (m, t0, len) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.012);
    g.gain.setValueAtTime(1, t0 + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    o.connect(g).connect(bassBus);
    o.start(t0);
    o.stop(t0 + len + 0.05);
  };

  // ---- bateria ----
  const drums = ctx.createGain();
  drums.gain.value = 0.9;
  send(drums, 1, 0.08);
  const kick = (t0, vel = 1) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(44, t0 + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.95, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
    o.connect(g).connect(drums);
    o.start(t0);
    o.stop(t0 + 0.5);
  };
  const noiseHit = (t0, { type = "highpass", freq = 7000, q = 0.7, len = 0.05, vel = 0.1, dest = drums, pan = 0 }) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    s.connect(f).connect(g).connect(p).connect(dest);
    s.start(t0, (t0 * 7.31) % 2);
    s.stop(t0 + len + 0.02);
  };
  const snare = (t0) => {
    noiseHit(t0, { type: "bandpass", freq: 1900, q: 0.8, len: 0.2, vel: 0.5 });
    noiseHit(t0, { type: "highpass", freq: 5000, len: 0.09, vel: 0.18 });
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(210, t0);
    o.frequency.exponentialRampToValueAtTime(150, t0 + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    o.connect(g).connect(drums);
    o.start(t0);
    o.stop(t0 + 0.12);
    // um pouco de reverb só na caixa
    const r = ctx.createGain();
    r.gain.value = 0.9;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2200;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.12, t0);
    e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    s.connect(f).connect(e).connect(r).connect(reverb);
    s.start(t0, 1.1);
    s.stop(t0 + 0.14);
  };
  const hat = (t0, vel) => noiseHit(t0, { type: "highpass", freq: 7500, len: 0.045, vel, pan: 0.25 });

  // ---- efeitos: subidas, impactos, "whoosh" nos cortes, brilho ----
  const fx = ctx.createGain();
  fx.gain.value = 1;
  send(fx, 1, 0.45);
  const riser = (t0, len, peak = 0.16) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2.2;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(7000, t0 + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + len - 0.02);
    g.gain.linearRampToValueAtTime(0, t0 + len);
    s.connect(f).connect(g).connect(fx);
    s.start(t0);
    s.stop(t0 + len + 0.05);
  };
  const impact = (t0, vel = 1) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7 * vel, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
    o.connect(g).connect(fx);
    o.start(t0);
    o.stop(t0 + 1.9);
    noiseHit(t0, { type: "lowpass", freq: 1400, len: 1.4, vel: 0.35 * vel, dest: fx });
  };
  const whoosh = (tc, dir = 1) => {
    const t0 = tc - 0.38, len = 0.62;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(500, t0);
    f.frequency.exponentialRampToValueAtTime(3800, tc);
    f.frequency.exponentialRampToValueAtTime(900, t0 + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.13, tc - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.6 * dir, t0);
    p.pan.linearRampToValueAtTime(0.6 * dir, t0 + len);
    s.connect(f).connect(g).connect(p).connect(fx);
    s.start(t0, 0.3);
    s.stop(t0 + len + 0.02);
  };
  const shimmer = (t0) => {
    [88, 95, 100, 107].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = mtof(m);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.06);
      g.gain.linearRampToValueAtTime(0.035, t0 + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + 2.4);
      o.connect(g).connect(fx);
      o.start(t0 + i * 0.06);
      o.stop(t0 + i * 0.06 + 2.5);
    });
  };

  // ---- arranjo ----
  const bars = Math.round(duration / BAR);
  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR;
    const outro = b >= 19;
    const chord = outro ? CHORDS[0] : CHORDS[b % 4];
    if (!outro || b === 19) padChord(chord, t0, outro ? BAR * 2 : BAR);

    const groove = (b >= 2 && b <= 14) || (b >= 17 && b <= 18);
    const breakdown = b >= 15 && b <= 16;

    // arpejo (a partir do 2º compasso; no final fica mais espaçado)
    if (b >= 1) {
      const tones = [...chord.pad].sort((x, y) => x - y).map((m) => m + 12);
      for (let s = 0; s < 8; s++) {
        if (b === 1 && s < 4) continue;
        if (outro && s % 2 === 1) continue;
        const m = tones[ARP[s] % tones.length];
        pluck(m, t0 + s * (BEAT / 2), s % 2 === 0 ? 0.9 : 0.6);
      }
    }
    if (groove) {
      bassNote(chord.bass, t0, BEAT * 1.4);
      bassNote(chord.bass, t0 + BEAT * 1.5, BEAT * 0.45);
      bassNote(chord.bass + 12, t0 + BEAT * 2, BEAT * 0.9);
      bassNote(chord.bass, t0 + BEAT * 3, BEAT * 0.9);
      kick(t0);
      kick(t0 + BEAT * 2);
      if (b % 2 === 1) kick(t0 + BEAT * 3.5, 0.7);
      snare(t0 + BEAT);
      snare(t0 + BEAT * 3);
    }
    if (groove || breakdown) {
      for (let s = 0; s < 8; s++) {
        const swing = s % 2 === 1 ? 0.035 : 0;
        hat(t0 + s * (BEAT / 2) + swing, (s % 2 === 1 ? 0.12 : 0.07) * (breakdown ? 0.6 : 1));
      }
    }
    if (breakdown) bassNote(chord.bass, t0, BAR * 0.9);
  }

  riser(BAR * 1, BAR, 0.14);
  riser(BAR * 16, BAR, 0.16);
  impact(BAR * 2, 1);
  impact(BAR * 17, 0.9);
  impact(BAR * 19, 1);
  shimmer(2.05);
  shimmer(BAR * 19 + 1.0);
  for (const c of cuts) {
    if ([BAR * 2, BAR * 17, BAR * 19].some((x) => Math.abs(x - c.time) < 0.01)) continue;
    whoosh(c.time, c.type === "push" ? 1 : -1);
  }

  return ctx.startRendering();
}

// Converte o AudioBuffer em um arquivo WAV (PCM 16 bits).
export function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + len * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: "audio/wav" });
}
