// Roteiro do vídeo: cada cena é uma função que desenha o quadro a partir
// do tempo local `t` (segundos desde o início da cena).
// Andamento da trilha: 100 BPM, 1 compasso = 2,4 s. Os cortes caem
// sempre no começo de um compasso para a imagem "bater" com a música.
import {
  W, H, C, SERIF, SANS, DISPLAY,
  clamp, lerp, prog, ep, ease,
  fill, drawCover, text, rich, maskUp, hairline, strokeRect, linearV, stars, vignette,
  transitions,
} from "./engine.js";
import { drawLogo } from "./logo.draw.js";

export const BAR = 2.4;
const M = 90; // margem lateral

// ---------- peças reutilizáveis ----------
function eyebrow(ctx, str, x, y, t, t0, o = {}) {
  const p = ep(t, t0, t0 + 0.7);
  const align = o.align || "left";
  text(ctx, str.toUpperCase(), x + (align === "left" ? (1 - p) * -24 : 0), y, {
    family: SANS, size: o.size || 26, weight: 600, spacing: o.spacing ?? 7,
    color: o.color || C.steel2, alpha: p, align,
  });
  if (o.line) {
    const lw = 70 * ep(t, t0 + 0.1, t0 + 0.8);
    const ly = y - (o.size || 26) * 0.36;
    if (align === "left") hairline(ctx, x - 20 - lw, ly, x - 20, ly, o.color || C.steel2, 2);
  }
}

// Título em várias linhas, cada linha revelada por máscara.
function headline(ctx, lines, x, y, t, t0, o = {}) {
  const size = o.size || 110;
  const lh = o.lh || size * 1.12;
  const stagger = o.stagger ?? 0.12;
  lines.forEach((segs, i) => {
    const p = ep(t, t0 + i * stagger, t0 + i * stagger + 0.8, ease.outQuart);
    const top = y + i * lh - size * 0.95;
    maskUp(ctx, [0, top, W, size * 1.28], p, () => {
      rich(ctx, segs, x, y + i * lh, { size, align: o.align || "left", color: o.color, emColor: o.emColor, weight: o.weight });
    });
  });
}

function bigMark(ctx, t, color, x = W * 0.62, y = H * 0.52) {
  text(ctx, "S", x + t * 8, y, {
    family: SERIF, size: 1500, weight: 300, style: "italic", color, align: "center", baseline: "middle",
  });
}

// ---------- cenas ----------

// 1 · Abertura: fio de luz, cortina e símbolo sendo traçado.
function intro(ctx, t) {
  fill(ctx, C.ink);
  const open = ep(t, 0.55, 1.35, ease.inOutExpo);
  const lineW = 760 * ep(t, 0.05, 0.75, ease.outExpo);
  if (open < 1) hairline(ctx, W / 2 - lineW / 2, H / 2, W / 2 + lineW / 2, H / 2, C.steel2, 2);
  if (open <= 0) return;
  const hh = (H / 2) * open;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H / 2 - hh, W, hh * 2);
  ctx.clip();
  fill(ctx, C.paper);
  bigMark(ctx, t, "rgba(24,22,20,0.035)", W * 0.5, H * 0.5);
  // leve aproximação contínua da câmera
  const z = lerp(1, 1.035, ep(t, 0.6, 4.8, ease.linear));
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  drawLogo(ctx, W / 2, 770, 380, {
    stroke: ep(t, 0.9, 2.4, ease.inOutCubic),
    fillA: ep(t, 2.0, 2.7),
    color: C.charcoal,
    lineWidth: 2.6,
  });
  const ps = ep(t, 2.35, 3.4);
  text(ctx, "STUDIO", W / 2, 1115, {
    family: DISPLAY, size: 44, spacing: lerp(60, 26, ps), color: C.charcoal, align: "center", alpha: ps,
  });
  maskUp(ctx, [0, 1140, W, 180], ep(t, 2.55, 3.45, ease.outQuart), () => {
    text(ctx, "SUPREMO", W / 2, 1275, { family: DISPLAY, size: 158, spacing: 16, color: C.charcoal, align: "center" });
  });
  const lw = 340 * ep(t, 3.2, 3.9, ease.inOutCubic);
  hairline(ctx, W / 2 - lw / 2, 1345, W / 2 + lw / 2, 1345, C.steel, 2);
  text(ctx, "BARBEARIA  ·  VISAGISMO  ·  SPA", W / 2, 1425, {
    family: SANS, size: 26, weight: 500, spacing: 8, color: C.charcoalDim, align: "center", alpha: ep(t, 3.45, 4.1),
  });
  ctx.restore();
}

// 2 · Hero: frase principal do site sobre o vídeo do salão.
function hero(ctx, t, d, { A }) {
  fill(ctx, C.ink);
  drawCover(ctx, A.v.visagismo, 0, 0, W, H, { zoom: lerp(1.12, 1.02, ep(t, 0, d, ease.linear)), fy: -0.1 });
  linearV(ctx, 0, 0, W, H, [
    [0, "rgba(13,13,12,0.55)"], [0.3, "rgba(13,13,12,0.15)"], [0.5, "rgba(13,13,12,0.35)"], [0.78, "rgba(13,13,12,0.88)"], [1, "rgba(13,13,12,0.96)"],
  ]);
  vignette(ctx, 0.35);
  // barra superior
  const pt = ep(t, 0.3, 1.0);
  text(ctx, "PALHOÇA · SC", M, 250, { family: SANS, size: 24, weight: 600, spacing: 6, color: C.inkText, alpha: pt });
  text(ctx, "4,8  ★★★★★  GOOGLE", W - M, 250, { family: SANS, size: 24, weight: 600, spacing: 4, color: C.steel2, alpha: pt, align: "right" });
  hairline(ctx, M, 285, M + (W - 2 * M) * ep(t, 0.3, 1.3, ease.inOutCubic), 285, C.hairInk, 2);

  eyebrow(ctx, "Barbearia · Visagismo · Spa", M + 90, 975, t, 0.35, { line: true });
  headline(ctx, [
    [{ t: "Transforme" }],
    [{ t: "seu visual." }],
    [{ t: "Relaxe", it: true }],
    [{ t: "em um só lugar." }],
  ], M, 1105, t, 0.5, { size: 116, lh: 128 });
  text(ctx, "Corte, barba, coloração e spa", M, 1660, {
    family: SANS, size: 34, weight: 300, color: C.inkTextDim, alpha: ep(t, 1.6, 2.3),
  });
  text(ctx, "com leitura visagista.", M, 1708, {
    family: SANS, size: 34, weight: 300, color: C.inkTextDim, alpha: ep(t, 1.75, 2.45),
  });
}

// 3 · A casa: salão + os quatro diferenciais.
function casa(ctx, t, d, { A }) {
  fill(ctx, C.paper);
  eyebrow(ctx, "A casa", M + 90, 250, t, 0.2, { color: C.steel, line: true });
  headline(ctx, [
    [{ t: "Visagismo e spa," }],
    [{ t: "no mesmo lugar.", it: true }],
  ], M, 370, t, 0.3, { size: 92, lh: 104, color: C.charcoal, emColor: C.steel });

  const y0 = 525, ih = 740;
  const rev = ep(t, 0.35, 1.2, ease.inOutExpo);
  ctx.save();
  ctx.beginPath();
  ctx.rect(M, y0, W - 2 * M, ih * rev);
  ctx.clip();
  drawCover(ctx, A.img.salao, M, y0, W - 2 * M, ih, { zoom: lerp(1.25, 1.05, ep(t, 0.3, d + 0.4, ease.outCubic)), fy: 0.1 });
  linearV(ctx, M, y0 + ih * 0.55, W - 2 * M, ih * 0.45, [[0, "rgba(13,13,12,0)"], [1, "rgba(13,13,12,0.7)"]]);
  text(ctx, "O SALÃO · LUZ NATURAL E ESTAÇÕES ORGANIZADAS", M + 32, y0 + ih - 36, {
    family: SANS, size: 21, weight: 600, spacing: 3, color: C.inkText, alpha: ep(t, 1.1, 1.7),
  });
  ctx.restore();
  strokeRect(ctx, M, y0, W - 2 * M, ih * rev, C.hairPaper, 2);

  const feats = [
    ["Visagismo", "personalizado"],
    ["Momentos", "de spa"],
    ["Equipamentos", "de ponta"],
    ["Atendimento", "individual"],
  ];
  const gy = 1320, cw = (W - 2 * M) / 2, chh = 170;
  hairline(ctx, M, gy, M + (W - 2 * M) * ep(t, 1.0, 1.8, ease.inOutCubic), gy, C.hairPaper, 2);
  hairline(ctx, M, gy + chh, M + (W - 2 * M) * ep(t, 1.1, 1.9, ease.inOutCubic), gy + chh, C.hairPaper, 2);
  hairline(ctx, M, gy + chh * 2, M + (W - 2 * M) * ep(t, 1.2, 2.0, ease.inOutCubic), gy + chh * 2, C.hairPaper, 2);
  hairline(ctx, W / 2, gy, W / 2, gy + chh * 2 * ep(t, 1.1, 1.9, ease.inOutCubic), C.hairPaper, 2);
  feats.forEach(([a, b], i) => {
    const x = M + (i % 2) * cw + 28, y = gy + Math.floor(i / 2) * chh;
    const p = ep(t, 1.25 + i * 0.14, 1.95 + i * 0.14);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 26);
    text(ctx, `0${i + 1}`, x, y + 62, { family: SERIF, size: 34, style: "italic", weight: 400, color: C.steel });
    text(ctx, a, x + 70, y + 64, { family: SANS, size: 34, weight: 500, color: C.charcoal });
    text(ctx, b, x + 70, y + 110, { family: SANS, size: 34, weight: 300, color: C.charcoalDim });
    ctx.restore();
  });
}

// 4a · Transformação real: vídeo de antes e depois acelerado.
function transformacao(ctx, t, d, { A }) {
  fill(ctx, C.ink);
  // zoom e foco para baixo escondem a etiqueta que já vem gravada no vídeo original
  drawCover(ctx, A.v.transformacao, 0, 0, W, H, { zoom: lerp(1.2, 1.14, ep(t, 0, d, ease.linear)), fy: -0.65 });
  linearV(ctx, 0, 0, W, 420, [[0, "rgba(13,13,12,0.6)"], [1, "rgba(13,13,12,0)"]]);
  linearV(ctx, 0, H * 0.45, W, H * 0.55, [[0, "rgba(13,13,12,0)"], [0.55, "rgba(13,13,12,0.8)"], [1, "rgba(13,13,12,0.95)"]]);
  eyebrow(ctx, "Antes & Depois", M + 90, 1290, t, 0.25, { line: true });
  headline(ctx, [[{ t: "Transformação" }], [{ t: "real.", it: true }]], M, 1430, t, 0.35, { size: 128, lh: 136 });
}

// 4b · Carrossel de antes/depois com cortina deslizante.
const PAIRS = [
  ["antes1", "depois1", "Corte e barba, com leitura visagista"],
  ["antes2", "depois2", "Coloração e styling"],
  ["antes3", "depois3", "Transformação completa de corte"],
];
function antesDepois(ctx, t, d, { A }) {
  fill(ctx, C.paper);
  const step = d / 3;
  eyebrow(ctx, "Transformações de clientes", M, 250, t, 0.15, { color: C.steel });
  // índice contínuo do carrossel (troca com easing entre os pares)
  let k = 0;
  for (let i = 1; i < 3; i++) k += ep(t, i * step - 0.12, i * step + 0.38, ease.inOutExpo);
  const cur = Math.min(2, Math.round(k));
  text(ctx, `0${cur + 1} / 03`, W - M, 250, { family: SERIF, size: 32, style: "italic", color: C.steel, align: "right", alpha: ep(t, 0.2, 0.8) });

  const bx = M, by = 320, bw = W - 2 * M, bh = 1200;
  PAIRS.forEach(([a, b, cap], i) => {
    const off = (i - k) * (bw + 60);
    if (Math.abs(off) > W) return;
    const lt = t - i * step;
    ctx.save();
    ctx.translate(off, 0);
    drawCover(ctx, A.img[a], bx, by, bw, bh, { zoom: lerp(1.06, 1.0, ep(lt, 0, step, ease.linear)) });
    // cortina: "depois" entra da direita para a esquerda
    const sw = ep(lt, 0.3, 1.1, ease.inOutCubic);
    const dx = bx + bw * (1 - sw);
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, by, bx + bw - dx, bh);
    ctx.clip();
    drawCover(ctx, A.img[b], bx, by, bw, bh, { zoom: lerp(1.06, 1.0, ep(lt, 0, step, ease.linear)) });
    ctx.restore();
    if (sw > 0 && sw < 1) {
      hairline(ctx, dx, by, dx, by + bh, C.paper, 5);
      ctx.save();
      ctx.fillStyle = C.paper;
      ctx.beginPath();
      ctx.arc(dx, by + bh / 2, 38, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, "‹ ›", dx, by + bh / 2 + 12, { family: SANS, size: 34, weight: 600, color: C.charcoal, align: "center" });
      ctx.restore();
    }
    const tag = (s, x, y, al) => {
      ctx.save();
      ctx.globalAlpha = al;
      ctx.fillStyle = "rgba(13,13,12,0.78)";
      const tw = s.length * 17 + 44;
      ctx.fillRect(x, y, tw, 52);
      text(ctx, s, x + 22, y + 35, { family: SANS, size: 21, weight: 600, spacing: 4, color: C.inkText });
      ctx.restore();
      return tw;
    };
    tag("ANTES", bx + 24, by + bh - 76, 1 - sw);
    tag("DEPOIS", bx + bw - 24 - (6 * 17 + 44), by + bh - 76, ep(lt, 0.9, 1.2));
    strokeRect(ctx, bx, by, bw, bh, C.hairPaper, 2);
    text(ctx, `Cliente ${i + 1}`, W / 2, by + bh + 90, { family: SERIF, size: 46, weight: 500, color: C.charcoal, align: "center" });
    text(ctx, cap, W / 2, by + bh + 146, { family: SANS, size: 32, weight: 300, color: C.charcoalDim, align: "center" });
    ctx.restore();
  });
}

// 5 · Serviços (o ritual).
const SERVICOS = [
  ["Cortes", "Clássicos e contemporâneos, com leitura visagista"],
  ["Barba & Navalha", "Toalha quente e acabamento tradicional"],
  ["Coloração", "Disfarce de fios brancos, acabamento natural"],
  ["Tratamentos estéticos", "Cuidados faciais e capilares"],
  ["Spa & Massagem", "Massagem relaxante e cuidados com a pele"],
  ["Visagismo", "Consultoria completa de imagem"],
];
function servicos(ctx, t) {
  fill(ctx, C.ink);
  bigMark(ctx, t, "rgba(241,239,236,0.04)", W * 0.78, H * 0.42);
  eyebrow(ctx, "O ritual", M + 90, 250, t, 0.2, { line: true });
  headline(ctx, [[{ t: "Tudo no" }], [{ t: "mesmo horário.", it: true }]], M, 370, t, 0.3, { size: 96, lh: 108 });
  const y0 = 530, rh = 150;
  SERVICOS.forEach(([name, desc], i) => {
    const y = y0 + i * rh;
    const p = ep(t, 0.55 + i * 0.12, 1.25 + i * 0.12);
    hairline(ctx, M, y + rh, M + (W - 2 * M) * ep(t, 0.5 + i * 0.12, 1.3 + i * 0.12, ease.inOutCubic), y + rh, C.hairInk, 2);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate((1 - p) * -40, 0);
    text(ctx, `0${i + 1}`, M, y + 70, { family: SERIF, size: 34, style: "italic", color: C.steel2 });
    text(ctx, name, M + 100, y + 72, { family: SERIF, size: 54, weight: 400, color: C.inkText });
    text(ctx, desc, M + 100, y + 118, { family: SANS, size: 27, weight: 300, color: C.inkTextDim });
    ctx.restore();
  });
  const by = 1470, bw = (W - 2 * M - 30) / 2, bh = 170;
  [["Cortes a partir de", "R$ 40"], ["Planos mensais desde", "R$ 90/mês"]].forEach(([k, v], i) => {
    const p = ep(t, 1.5 + i * 0.18, 2.2 + i * 0.18);
    const x = M + i * (bw + 30);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 30);
    ctx.fillStyle = C.graphite;
    ctx.fillRect(x, by, bw, bh);
    strokeRect(ctx, x, by, bw, bh, C.hairInk, 2);
    text(ctx, k.toUpperCase(), x + 32, by + 58, { family: SANS, size: 20, weight: 600, spacing: 3, color: C.steel2 });
    text(ctx, v, x + 32, by + 130, { family: SERIF, size: 60, weight: 400, color: C.inkText });
    ctx.restore();
  });
}

// 6 · Visagismo: o vídeo com uma "leitura" animada por cima.
function visagismo(ctx, t, d, { A }) {
  fill(ctx, C.paper);
  eyebrow(ctx, "A jornada visagista", M + 90, 230, t, 0.2, { color: C.steel, line: true });
  headline(ctx, [[{ t: "Um bom corte começa" }], [{ t: "antes da tesoura.", it: true }]], M, 340, t, 0.3, {
    size: 76, lh: 90, color: C.charcoal, emColor: C.steel,
  });
  const fw = 580, fh = 1031, fx = (W - fw) / 2, fy = 500;
  const rev = ep(t, 0.3, 1.1, ease.inOutExpo);
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy + fh * (1 - rev), fw, fh * rev);
  ctx.clip();
  drawCover(ctx, A.v.visagismo, fx, fy, fw, fh, { zoom: 1.02 });
  // grade de proporções (terços)
  const gp = ep(t, 1.0, 1.8, ease.inOutCubic);
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 1; i < 3; i++) {
    hairline(ctx, fx, fy + (fh * i) / 3, fx + fw * gp, fy + (fh * i) / 3, "#ffffff", 1.5);
    hairline(ctx, fx + (fw * i) / 3, fy, fx + (fw * i) / 3, fy + fh * gp, "#ffffff", 1.5);
  }
  ctx.restore();
  // linha de leitura varrendo o rosto
  const sp = ((t - 1.2) / 1.6) % 1;
  if (t > 1.2 && t < d) {
    const sy = fy + fh * 0.12 + fh * 0.6 * ease.inOutCubic(sp < 0 ? 0 : sp);
    const g = ctx.createLinearGradient(0, sy - 60, 0, sy);
    g.addColorStop(0, "rgba(201,196,185,0)");
    g.addColorStop(1, "rgba(201,196,185,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(fx, sy - 60, fw, 60);
    hairline(ctx, fx, sy, fx + fw, sy, C.steel2, 2);
  }
  ctx.restore();
  // cantoneiras
  const cl = 60 * ep(t, 0.9, 1.5);
  ctx.save();
  ctx.strokeStyle = C.charcoal;
  ctx.lineWidth = 4;
  [[fx - 16, fy - 16, 1, 1], [fx + fw + 16, fy - 16, -1, 1], [fx - 16, fy + fh + 16, 1, -1], [fx + fw + 16, fy + fh + 16, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * cl);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * cl, y);
    ctx.stroke();
  });
  ctx.restore();
  // etiquetas da leitura
  const tags = [
    ["FORMATO DO ROSTO", fx + fw - 40, fy + 330, "right"],
    ["TEXTURA DO FIO", fx + 40, fy + 160, "left"],
    ["ASSIMETRIAS", fx + 40, fy + 720, "left"],
  ];
  tags.forEach(([s, x, y, al], i) => {
    const p = ep(t, 1.5 + i * 0.3, 1.9 + i * 0.3, ease.outBack);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(p);
    const tw = s.length * 15.5 + 60;
    const x0 = al === "right" ? x - tw : x;
    ctx.translate(0, (1 - p) * 20);
    ctx.fillStyle = "rgba(13,13,12,0.82)";
    ctx.fillRect(x0, y, tw, 54);
    ctx.fillStyle = C.steel2;
    ctx.beginPath();
    ctx.arc(x0 + 26, y + 27, 7, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, s, x0 + 46, y + 36, { family: SANS, size: 20, weight: 600, spacing: 3, color: C.inkText });
    ctx.restore();
  });
  text(ctx, "Leitura de traços  ·  Harmonização  ·  Spa", W / 2, 1660, {
    family: SANS, size: 30, weight: 400, color: C.charcoalDim, align: "center", alpha: ep(t, 2.2, 2.9),
  });
}

// 7 · Equipe.
function equipe(ctx, t, d, { A }) {
  fill(ctx, C.ink);
  eyebrow(ctx, "Equipe", M + 90, 250, t, 0.2, { line: true });
  headline(ctx, [[{ t: "Quem cuida" }], [{ t: "do seu visual.", it: true }]], M, 370, t, 0.3, { size: 96, lh: 108 });

  const portrait = (img, cx, cy, r, p, ring) => {
    if (p <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * ease.outCubic(p), 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, img, cx - r, cy - r, r * 2, r * 2, { zoom: lerp(1.35, 1.12, p), fy: -0.55 });
    ctx.restore();
    if (ring) {
      ctx.save();
      ctx.strokeStyle = C.steel2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ep(t, 0.7, 1.7, ease.inOutCubic));
      ctx.stroke();
      ctx.restore();
    }
  };
  portrait(A.img.leivys, W / 2, 790, 220, ep(t, 0.45, 1.25), true);
  const pn = ep(t, 1.0, 1.6);
  text(ctx, "Leivys", W / 2, 1110, { family: SERIF, size: 68, weight: 400, color: C.inkText, align: "center", alpha: pn });
  text(ctx, "MASTER BARBER & VISAGISTA", W / 2, 1165, { family: SANS, size: 23, weight: 600, spacing: 5, color: C.steel2, align: "center", alpha: pn });

  const team = [["alfredo", "Alfredo"], ["joaoJp", "João JP"], ["sebastian", "Sebastian"], ["vitor", "Vitor"]];
  const cw = (W - 2 * M) / 4;
  hairline(ctx, M, 1245, M + (W - 2 * M) * ep(t, 1.1, 1.9, ease.inOutCubic), 1245, C.hairInk, 2);
  team.forEach(([key, name], i) => {
    const cx = M + cw * i + cw / 2;
    const p = ep(t, 1.3 + i * 0.12, 1.95 + i * 0.12);
    portrait(A.img[key], cx, 1405, 92, p, false);
    text(ctx, name, cx, 1560, { family: SANS, size: 30, weight: 500, color: C.inkText, align: "center", alpha: p });
    text(ctx, "Barbeiro", cx, 1600, { family: SANS, size: 23, weight: 300, color: C.inkTextDim, align: "center", alpha: p });
  });
}

// 8 · Avaliações: 4,8 no Google.
function avaliacoes(ctx, t) {
  fill(ctx, C.ink2);
  const g = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 800);
  g.addColorStop(0, "rgba(201,196,185,0.12)");
  g.addColorStop(1, "rgba(201,196,185,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  eyebrow(ctx, "Na voz de quem sentou na cadeira", W / 2, 300, t, 0.15, { align: "center", size: 23, spacing: 5 });
  const n = 4.8 * ep(t, 0.25, 1.5, ease.outExpo);
  text(ctx, n.toFixed(1).replace(".", ","), W / 2, 790, {
    family: SERIF, size: 400, weight: 300, color: C.inkText, align: "center", alpha: ep(t, 0.2, 0.6),
  });
  stars(ctx, W / 2, 900, 66, 0.96 * ep(t, 0.8, 1.8, ease.inOutCubic), C.steel2, "rgba(241,239,236,0.14)");
  text(ctx, "de 5 · mais de 100 avaliações no Google", W / 2, 1010, {
    family: SANS, size: 32, weight: 400, color: C.inkTextDim, align: "center", alpha: ep(t, 1.2, 1.8),
  });
  const quotes = [
    ["“Ambiente agradável, profissional", "qualificado e produtos de primeira.”"],
    ["“O melhor atendimento e serviço de", "estética pro homem é esse lugar!”"],
  ];
  quotes.forEach((q, i) => {
    const y = 1110 + i * 260;
    const p = ep(t, 1.7 + i * 0.4, 2.4 + i * 0.4);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 40);
    ctx.fillStyle = C.ink;
    ctx.fillRect(M, y, W - 2 * M, 230);
    strokeRect(ctx, M, y, W - 2 * M, 230, C.hairInk, 2);
    text(ctx, "★★★★★", M + 44, y + 58, { family: SANS, size: 24, spacing: 4, color: C.steel2 });
    text(ctx, q[0], M + 44, y + 118, { family: SERIF, size: 40, weight: 400, color: C.inkText });
    text(ctx, q[1], M + 44, y + 168, { family: SERIF, size: 40, weight: 400, color: C.inkText });
    text(ctx, "AVALIAÇÃO GOOGLE", W - M - 44, y + 58, { family: SANS, size: 19, weight: 600, spacing: 3, color: C.inkTextDim, align: "right" });
    ctx.restore();
  });
}

// 9 · Alguns momentos: três fotos em cortes secos no ritmo da batida.
const MOMENTOS = [
  ["corteVisagista", "Corte e barba", 0.1],
  ["corteInfantil", "Para os pequenos também", -0.1],
  ["salaKids", "Sala kids", 0],
];
function momentos(ctx, t, d, { A }) {
  fill(ctx, C.ink);
  const step = d / 3;
  const i = clamp(Math.floor(t / step), 0, 2);
  const lt = t - i * step;
  const [key, cap, fy] = MOMENTOS[i];
  drawCover(ctx, A.img[key], 0, 0, W, H, { zoom: lerp(1.14, 1.02, ep(lt, 0, step, ease.outCubic)), fy });
  linearV(ctx, 0, 0, W, H, [[0, "rgba(13,13,12,0.5)"], [0.25, "rgba(13,13,12,0)"], [0.62, "rgba(13,13,12,0)"], [1, "rgba(13,13,12,0.9)"]]);
  text(ctx, "DIRETO DA STUDIO SUPREMO", M, 250, { family: SANS, size: 24, weight: 600, spacing: 6, color: C.inkText });
  text(ctx, `0${i + 1}`, W - M, 250, { family: SERIF, size: 34, style: "italic", color: C.steel2, align: "right" });
  maskUp(ctx, [0, 1430, W, 130], ep(lt, 0.02, 0.4, ease.outQuart), () => {
    text(ctx, cap, M, 1530, { family: SERIF, size: 76, style: "italic", weight: 400, color: C.inkText });
  });
  // flash curto em cada corte
  if (i > 0 && lt < 0.12) {
    ctx.save();
    ctx.globalAlpha = (1 - lt / 0.12) * 0.55;
    fill(ctx, C.paper);
    ctx.restore();
  }
}

// 10 · Onde estamos: fachada.
function ondeEstamos(ctx, t, d, { A }) {
  fill(ctx, C.ink);
  drawCover(ctx, A.img.fachada, 0, 0, W, H, { zoom: lerp(1.0, 1.12, ep(t, 0, d, ease.linear)), fx: 0.2 });
  linearV(ctx, 0, H * 0.4, W, H * 0.6, [[0, "rgba(13,13,12,0)"], [0.5, "rgba(13,13,12,0.82)"], [1, "rgba(13,13,12,0.96)"]]);
  eyebrow(ctx, "Onde estamos", M + 90, 1230, t, 0.1, { line: true });
  headline(ctx, [[{ t: "Venha nos" }], [{ t: "visitar.", it: true }]], M, 1370, t, 0.2, { size: 128, lh: 136 });
  text(ctx, "Nova Palhoça · Palhoça – SC", M, 1640, { family: SANS, size: 36, weight: 400, color: C.inkTextDim, alpha: ep(t, 0.8, 1.4) });
}

// 11 · Encerramento: marca, chamada para agendar e contatos.
function encerramento(ctx, t, d) {
  fill(ctx, C.ink);
  bigMark(ctx, t, "rgba(241,239,236,0.035)", W * 0.5, H * 0.5);
  ctx.save();
  ctx.translate(0, 70); // centraliza o bloco na tela
  drawLogo(ctx, W / 2, 440, 300, {
    stroke: ep(t, 0.15, 1.2, ease.inOutCubic), fillA: ep(t, 0.9, 1.5), color: C.inkText, lineWidth: 2.4,
  });
  const pw = ep(t, 0.9, 1.8);
  text(ctx, "STUDIO", W / 2, 700, { family: DISPLAY, size: 36, spacing: lerp(44, 20, pw), color: C.inkText, align: "center", alpha: pw });
  maskUp(ctx, [0, 715, W, 140], ep(t, 1.0, 1.8, ease.outQuart), () => {
    text(ctx, "SUPREMO", W / 2, 825, { family: DISPLAY, size: 124, spacing: 13, color: C.inkText, align: "center" });
  });
  const lw = 300 * ep(t, 1.5, 2.1, ease.inOutCubic);
  hairline(ctx, W / 2 - lw / 2, 885, W / 2 + lw / 2, 885, C.steel2, 2);

  headline(ctx, [[{ t: "Agende seu " }, { t: "horário.", it: true }]], W / 2, 1020, t, 1.6, { size: 84, align: "center" });

  // botão com o mesmo efeito de preenchimento do site
  const bw = 700, bh = 124, bx = (W - bw) / 2, by = 1085;
  const pb = ep(t, 1.9, 2.5);
  const sweep = ep(t, 2.5, 3.1, ease.inOutCubic);
  ctx.save();
  ctx.globalAlpha = pb;
  ctx.translate(0, (1 - pb) * 30);
  ctx.fillStyle = C.inkText;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = C.steel2;
  ctx.fillRect(bx, by, bw * sweep, bh);
  text(ctx, "AGENDAR HORÁRIO", W / 2 - 24, by + 75, { family: SANS, size: 32, weight: 600, spacing: 3, color: C.ink, align: "center" });
  text(ctx, "→", W / 2 + 190 + sweep * 10, by + 74, { family: SANS, size: 34, weight: 600, color: C.ink, align: "center" });
  ctx.restore();

  const rows = [
    ["WhatsApp", "(48) 99903-5159"],
    ["Instagram", "@studiosupremo.oficial"],
    ["Endereço", "Nova Palhoça · Palhoça – SC"],
  ];
  rows.forEach(([k, v], i) => {
    const y = 1330 + i * 120;
    const p = ep(t, 2.3 + i * 0.15, 2.9 + i * 0.15);
    text(ctx, k.toUpperCase(), W / 2, y, { family: SANS, size: 20, weight: 600, spacing: 5, color: C.steel2, align: "center", alpha: p });
    text(ctx, v, W / 2, y + 50, { family: SERIF, size: 42, weight: 400, color: C.inkText, align: "center", alpha: p });
  });
  ctx.restore();
  // fade final para preto
  const out = ep(t, d - 0.6, d, ease.inCubic);
  if (out > 0) {
    ctx.save();
    ctx.globalAlpha = out;
    fill(ctx, "#000");
    ctx.restore();
  }
}

// ---------- montagem da linha do tempo ----------
export function buildTimeline() {
  const seq = [
    // [função, compassos, vídeos usados, transição para a próxima]
    [intro, 2, null, ["wipeUp", 0.8]],
    [hero, 2, (t) => ({ visagismo: Math.max(0, t) }), ["push", 0.7]],
    [casa, 2, null, ["iris", 0.7]],
    [transformacao, 1, (t) => ({ transformacao: 0.4 + Math.max(0, t) * 2.1 }), ["wipeUp", 0.7]],
    [antesDepois, 2, null, ["push", 0.7]],
    [servicos, 2, null, ["wipeUp", 0.7]],
    [visagismo, 2, (t) => ({ visagismo: 4.9 + Math.max(0, t) }), ["iris", 0.7]],
    [equipe, 2, null, ["fade", 0.7]],
    [avaliacoes, 2, null, ["flash", 0.3]],
    [momentos, 1, null, ["flash", 0.3]],
    [ondeEstamos, 1, null, ["wipeUp", 0.8]],
    [encerramento, 2, null, null],
  ];
  let start = 0;
  const scenes = [], trans = [], cuts = [];
  for (const [fn, bars, videos, tr] of seq) {
    const end = start + bars * BAR;
    scenes.push({ name: fn.name, start, end, draw: fn, videos });
    if (tr) {
      trans.push({ fn: transitions[tr[0]], dur: tr[1], type: tr[0] });
      cuts.push({ time: end, type: tr[0] });
    }
    start = end;
  }
  return { scenes, transitions: trans, cuts };
}
