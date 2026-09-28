// Desenho animado do símbolo da Studio Supremo: primeiro o contorno é
// "traçado" (como uma navalha desenhando), depois o preenchimento aparece.
import { LOGO_PATHS } from "./logo.js";

let paths = null; // [{ p: Path2D, len }]
let box = null; // caixa do símbolo no espaço 0..900 do SVG original

export function initLogo() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 900 900");
  svg.setAttribute("width", "900");
  svg.setAttribute("height", "900");
  svg.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden";
  const g = document.createElementNS(NS, "g");
  g.setAttribute("transform", "translate(0,900) scale(0.1,-0.1)");
  svg.appendChild(g);
  document.body.appendChild(svg);
  paths = LOGO_PATHS.map((d) => {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", d);
    g.appendChild(el);
    return { p: new Path2D(d), len: el.getTotalLength() };
  });
  const b = g.getBoundingClientRect();
  const s = svg.getBoundingClientRect();
  box = { x: b.left - s.left, y: b.top - s.top, w: b.width, h: b.height };
  svg.remove();
}

// cx, cy: centro; h: altura em px; stroke: 0..1 do traço; fillA: 0..1 do preenchimento.
export function drawLogo(ctx, cx, cy, h, { stroke = 1, fillA = 1, color = "#181614", lineWidth = 2.4 } = {}) {
  if (!paths) initLogo();
  const k = h / box.h;
  ctx.save();
  ctx.translate(cx - (box.x + box.w / 2) * k, cy - (box.y + box.h / 2) * k);
  ctx.scale(k, k);
  ctx.translate(0, 900);
  ctx.scale(0.1, -0.1);
  if (fillA > 0) {
    ctx.globalAlpha = fillA;
    ctx.fillStyle = color;
    for (const { p } of paths) ctx.fill(p);
    ctx.globalAlpha = 1;
  }
  if (stroke > 0 && fillA < 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / (k * 0.1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 1 - fillA * fillA;
    for (const { p, len } of paths) {
      ctx.setLineDash([len, len]);
      ctx.lineDashOffset = len * (1 - stroke);
      ctx.stroke(p);
    }
  }
  ctx.restore();
}
