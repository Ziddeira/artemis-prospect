// Motor do vídeo: matemática de animação, carregamento de mídia e
// utilitários de desenho em canvas. Tudo determinístico: o mesmo tempo
// sempre gera o mesmo quadro (é isso que permite renderizar o MP4).

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Cores do site da Studio Supremo.
export const C = {
  ink: "#0d0d0c",
  ink2: "#161615",
  paper: "#f3f2ef",
  paper2: "#e6e3de",
  steel: "#8e8a82",
  steel2: "#c9c4b9",
  graphite: "#2a2927",
  inkText: "#f1efec",
  inkTextDim: "#a49f97",
  charcoal: "#181614",
  charcoalDim: "#635f59",
  hairInk: "rgba(241,239,236,0.16)",
  hairPaper: "rgba(24,22,20,0.14)",
};

export const SERIF = "Fraunces";
export const SANS = "Work Sans";
export const DISPLAY = "Italiana";

// ---------- matemática ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Progresso 0..1 de t entre a e b.
export const prog = (t, a, b) => clamp((t - a) / (b - a));

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // Curva "premium": sai rápido e assenta devagar.
  smooth: (t) => 1 - Math.pow(1 - t, 3.2),
};

// Atalho: progresso já com easing.
export const ep = (t, a, b, fn = ease.smooth) => fn(prog(t, a, b));

// Gerador pseudoaleatório com semente (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- carregamento ----------
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar " + src));
    img.src = src;
  });
}

export function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.loop = false;
    v.crossOrigin = "anonymous";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Falha ao carregar " + src));
    v.src = src;
    v.load();
  });
}

export async function loadFonts(base) {
  const list = [
    [SERIF, "fraunces-latin-300-normal", "300", "normal"],
    [SERIF, "fraunces-latin-400-normal", "400", "normal"],
    [SERIF, "fraunces-latin-500-normal", "500", "normal"],
    [SERIF, "fraunces-latin-300-italic", "300", "italic"],
    [SERIF, "fraunces-latin-400-italic", "400", "italic"],
    [SANS, "work-sans-latin-300-normal", "300", "normal"],
    [SANS, "work-sans-latin-400-normal", "400", "normal"],
    [SANS, "work-sans-latin-500-normal", "500", "normal"],
    [SANS, "work-sans-latin-600-normal", "600", "normal"],
    [DISPLAY, "italiana-latin-400-normal", "400", "normal"],
  ];
  await Promise.all(
    list.map(async ([family, file, weight, style]) => {
      const f = new FontFace(family, `url(${base}${file}.woff2)`, { weight, style });
      await f.load();
      document.fonts.add(f);
    }),
  );
}

// Posiciona um vídeo exatamente num instante (modo renderização).
export function seekVideo(v, time) {
  // Fica um pouco antes do fim: pedir o último quadro exato pode voltar preto.
  const t = clamp(time, 0, Math.max(0, v.duration - 0.2));
  if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

// ---------- desenho ----------
export function fill(ctx, color, x = 0, y = 0, w = W, h = H) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Desenha imagem/vídeo cobrindo a caixa (como object-fit: cover), com
// zoom e deslocamento do foco (fx, fy de -1 a 1) para o efeito Ken Burns.
export function drawCover(ctx, media, x, y, w, h, { zoom = 1, fx = 0, fy = 0 } = {}) {
  const mw = media.videoWidth || media.naturalWidth || media.width;
  const mh = media.videoHeight || media.naturalHeight || media.height;
  if (!mw || !mh) return;
  const s = Math.max(w / mw, h / mh) * zoom;
  const dw = mw * s, dh = mh * s;
  const dx = x + (w - dw) / 2 + ((dw - w) / 2) * fx;
  const dy = y + (h - dh) / 2 + ((dh - h) / 2) * fy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(media, dx, dy, dw, dh);
  ctx.restore();
}

export function setFont(ctx, { family = SANS, size = 40, weight = 400, style = "normal", spacing = 0 }) {
  ctx.font = `${style} ${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${spacing}px`;
}

// Texto simples. `spacing` é o espaçamento entre letras (em px).
export function text(ctx, str, x, y, o = {}) {
  const { color = C.inkText, align = "left", baseline = "alphabetic", alpha = 1, spacing = 0 } = o;
  ctx.save();
  setFont(ctx, o);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  // O letterSpacing do canvas adiciona espaço também depois da última letra;
  // compensamos para o texto centralizado ficar realmente no centro.
  const dx = align === "center" ? spacing / 2 : align === "right" ? spacing : 0;
  ctx.fillText(str, x + dx, y);
  ctx.restore();
}

export function measure(ctx, str, o = {}) {
  ctx.save();
  setFont(ctx, o);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Texto com trechos em itálico (como o <em> do site).
// segs: [{ t: "Relaxe", it: true }, { t: " em um só lugar." }]
export function rich(ctx, segs, x, y, o = {}) {
  const { size = 100, align = "left", color = C.inkText, emColor = C.steel2, weight = 500, alpha = 1 } = o;
  const fmt = (s) => ({
    family: SERIF,
    size,
    weight: s.it ? 400 : weight,
    style: s.it ? "italic" : "normal",
    spacing: o.spacing || 0,
  });
  const widths = segs.map((s) => measure(ctx, s.t, fmt(s)));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  segs.forEach((s, i) => {
    text(ctx, s.t, cx, y, { ...fmt(s), color: s.it ? emColor : color, alpha });
    cx += widths[i];
  });
  return total;
}

// Revela o conteúdo "subindo" de dentro de uma máscara (efeito de linha).
// box = [x, y, w, h]; p = progresso 0..1.
export function maskUp(ctx, box, p, draw) {
  if (p <= 0) return;
  const [x, y, w, h] = box;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(0, (1 - p) * h * 1.05);
  draw();
  ctx.restore();
}

export function hairline(ctx, x1, y1, x2, y2, color, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function strokeRect(ctx, x, y, w, h, color, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
  ctx.restore();
}

export function linearV(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// Estrelas de avaliação; p controla o preenchimento da esquerda p/ direita.
export function stars(ctx, cx, cy, size, p, color, dim) {
  const n = 5, gap = size * 0.28;
  const total = n * size + (n - 1) * gap;
  const x0 = cx - total / 2;
  const star = (x) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size / 2 : size / 4.6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(x + size / 2 + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.save();
  for (let i = 0; i < n; i++) {
    star(x0 + i * (size + gap));
    ctx.fillStyle = dim;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.rect(x0 - 2, cy - size, total * p + 4, size * 2);
  ctx.clip();
  for (let i = 0; i < n; i++) {
    star(x0 + i * (size + gap));
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

// ---------- acabamento: granulação de filme e vinheta ----------
let grainTiles = null;
function makeGrain() {
  grainTiles = [];
  const r = rng(7);
  for (let k = 0; k < 6; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
}

export function grain(ctx, frame, amount = 0.045) {
  if (!grainTiles) makeGrain();
  const tile = grainTiles[frame % grainTiles.length];
  const r = rng(frame * 131 + 3);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "overlay";
  const pat = ctx.createPattern(tile, "repeat");
  ctx.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

export function vignette(ctx, strength = 0.42) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------- linha do tempo ----------
// Cada cena ocupa [start, end]. Nas junções há uma transição de `dur`
// segundos centrada no corte; durante ela as duas cenas são desenhadas
// em telas separadas e combinadas pela função de transição.
export class Timeline {
  constructor(scenes, transitions) {
    this.scenes = scenes;
    this.transitions = transitions; // transitions[i] = entre cena i e i+1
    this.duration = scenes[scenes.length - 1].end;
    this.bufA = document.createElement("canvas");
    this.bufB = document.createElement("canvas");
    for (const b of [this.bufA, this.bufB]) {
      b.width = W;
      b.height = H;
    }
  }

  // Quais cenas precisam ser desenhadas no instante t.
  active(t) {
    const out = [];
    this.scenes.forEach((s, i) => {
      const tin = i > 0 ? this.transitions[i - 1].dur / 2 : 0;
      const tout = i < this.scenes.length - 1 ? this.transitions[i].dur / 2 : 0;
      if (t >= s.start - tin && t < s.end + tout) out.push(i);
    });
    return out;
  }

  // Tempos dos vídeos necessários no instante t: { nome: segundos }.
  videoTimes(t) {
    const need = {};
    for (const i of this.active(t)) {
      const s = this.scenes[i];
      if (s.videos) Object.assign(need, s.videos(t - s.start, s.end - s.start));
    }
    return need;
  }

  drawScene(ctx, i, t, env) {
    const s = this.scenes[i];
    ctx.save();
    s.draw(ctx, t - s.start, s.end - s.start, env);
    ctx.restore();
  }

  render(ctx, t, env) {
    const act = this.active(t);
    if (act.length === 1) {
      this.drawScene(ctx, act[0], t, env);
    } else {
      const [a, b] = act;
      const tr = this.transitions[a];
      const cut = this.scenes[a].end;
      const p = clamp((t - (cut - tr.dur / 2)) / tr.dur);
      const ca = this.bufA.getContext("2d");
      const cb = this.bufB.getContext("2d");
      ca.clearRect(0, 0, W, H);
      cb.clearRect(0, 0, W, H);
      this.drawScene(ca, a, t, env);
      this.drawScene(cb, b, t, env);
      tr.fn(ctx, this.bufA, this.bufB, p);
    }
    grain(ctx, env.frame);
  }
}

// ---------- transições ----------
export const transitions = {
  // Dissolve com leve zoom.
  fade: (ctx, a, b, p) => {
    const e = ease.inOutCubic(p);
    ctx.drawImage(a, 0, 0);
    ctx.save();
    ctx.globalAlpha = e;
    const s = lerp(1.04, 1, e);
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.drawImage(b, -W / 2, -H / 2);
    ctx.restore();
  },
  // A cena nova sobe como uma cortina, com um fio de luz na borda.
  wipeUp: (ctx, a, b, p) => {
    const e = ease.inOutExpo(p);
    const edge = H * (1 - e);
    ctx.save();
    ctx.translate(0, -H * 0.18 * e);
    ctx.drawImage(a, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, edge, W, H - edge);
    ctx.clip();
    ctx.translate(0, H * 0.12 * (1 - e));
    ctx.drawImage(b, 0, 0);
    ctx.restore();
    if (p > 0 && p < 1) hairline(ctx, 0, edge, W, edge, C.steel2, 3);
  },
  // Empurra a cena para a esquerda.
  push: (ctx, a, b, p) => {
    const e = ease.inOutExpo(p);
    ctx.save();
    ctx.translate(-W * 0.35 * e, 0);
    ctx.globalAlpha = 1 - e * 0.6;
    ctx.drawImage(a, 0, 0);
    ctx.restore();
    ctx.save();
    const x = W * (1 - e);
    ctx.beginPath();
    ctx.rect(x, 0, W - x, H);
    ctx.clip();
    ctx.translate(W * 0.25 * (1 - e), 0);
    ctx.drawImage(b, 0, 0);
    ctx.restore();
    if (p > 0 && p < 1) hairline(ctx, x, 0, x, H, C.steel2, 3);
  },
  // Abre a cena nova a partir do centro, como uma íris retangular.
  iris: (ctx, a, b, p) => {
    const e = ease.inOutExpo(p);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    const s = lerp(1, 0.92, e);
    ctx.scale(s, s);
    ctx.drawImage(a, -W / 2, -H / 2);
    ctx.restore();
    const hw = (W / 2) * e, hh = (H / 2) * e;
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - hw, H / 2 - hh, hw * 2, hh * 2);
    ctx.clip();
    ctx.drawImage(b, 0, 0);
    ctx.restore();
    if (p > 0 && p < 1) strokeRect(ctx, W / 2 - hw, H / 2 - hh, hw * 2, hh * 2, C.steel2, 3);
  },
  // Corte seco com um flash curto (para momentos de impacto).
  flash: (ctx, a, b, p) => {
    ctx.drawImage(p < 0.5 ? a : b, 0, 0);
    const f = 1 - Math.abs(p - 0.5) * 2;
    ctx.save();
    ctx.globalAlpha = Math.pow(f, 2) * 0.85;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
