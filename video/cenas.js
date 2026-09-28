/* Ártemis Prospect — as cenas do vídeo, desenhadas em canvas.
 *
 * AP.desenhar(ctx, t) pinta o quadro do segundo t. É uma função pura do
 * tempo: nada depende do quadro anterior, então dá para pular para
 * qualquer ponto e exportar quadro a quadro.
 *
 * Cores, fontes e formas seguem brand/MANUAL.md.
 */
(function () {
  "use strict";

  const AP = (window.AP = window.AP || {});
  const { W, H, K } = AP;

  // ---------------------------------------------------------------
  // Marca
  // ---------------------------------------------------------------
  const C = {
    amarelo: "#FFD60A",
    preto: "#0A0A0A",
    branco: "#FFFFFF",
    superficie: "#121212",
    sidebar: "#0F0F0F",
    divisoria: "#1F1F1F",
    borda: "#262626",
    bordaInput: "#2E2E2E",
    bordaForte: "#3D3D3D",
    cinza600: "#525252",
    texto3: "#737373",
    texto2: "#A3A3A3",
    campo: "#D4D4D4",
    amareloSuave: "rgba(255,214,10,0.09)",
  };
  const FD = "'Chakra Petch', 'Arial Narrow', sans-serif";
  const FT = "'Manrope', 'Helvetica Neue', sans-serif";

  // Imagens da mascote (carregadas pelo app.js).
  AP.IMG = AP.IMG || {};

  // ---------------------------------------------------------------
  // Utilidades de tempo e movimento
  // ---------------------------------------------------------------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inCubic: (p) => p * p * p,
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inExpo: (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    outBack: (p) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
  };

  // Tremidinha de câmera depois de uma "pancada" (determinística).
  function tremor(t, t0, forca = 14) {
    const p = prog(t, t0, t0 + 0.35);
    if (p <= 0 || p >= 1) return [0, 0];
    const amp = forca * Math.pow(1 - p, 2);
    return [Math.sin(t * 91) * amp, Math.cos(t * 73) * amp];
  }

  // ---------------------------------------------------------------
  // Texto
  // ---------------------------------------------------------------
  function fonte(ctx, o) {
    const fam = o.fam === "t" ? FT : FD;
    ctx.font = `${o.italico ? "italic " : ""}${o.peso || 700} ${o.tam}px ${fam}`;
  }

  function medir(ctx, s, o) {
    fonte(ctx, o);
    const esp = (o.esp || 0) * o.tam;
    if (!esp) return ctx.measureText(s).width;
    let w = 0;
    const cs = Array.from(s);
    for (const ch of cs) w += ctx.measureText(ch).width;
    return w + esp * (cs.length - 1);
  }

  // Escreve s em (x, y) — y é a linha de base. o: tam, fam ("d"/"t"),
  // peso, italico, cor, alinhar ("esq"/"centro"/"dir"), esp (em).
  function texto(ctx, s, x, y, o) {
    const w = medir(ctx, s, o);
    let x0 = x;
    if (o.alinhar === "centro") x0 = x - w / 2;
    else if (o.alinhar === "dir") x0 = x - w;
    ctx.fillStyle = o.cor || C.branco;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const esp = (o.esp || 0) * o.tam;
    if (!esp) ctx.fillText(s, x0, y);
    else {
      let cx = x0;
      for (const ch of Array.from(s)) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + esp;
      }
    }
    return w;
  }

  // Diminui a fonte até o texto caber em maxW.
  function caber(ctx, s, o, maxW) {
    let tam = o.tam;
    while (tam > 12 && medir(ctx, s, { ...o, tam }) > maxW) tam -= 2;
    return { ...o, tam };
  }

  function quebrar(ctx, s, o, maxW) {
    const palavras = s.split(" ");
    const linhas = [];
    let atual = "";
    for (const p of palavras) {
      const teste = atual ? atual + " " + p : p;
      if (medir(ctx, teste, o) > maxW && atual) {
        linhas.push(atual);
        atual = p;
      } else atual = teste;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  // Rótulo que aparece letra a letra, sem "andar" enquanto digita.
  function rotuloDigitado(ctx, s, cx, y, o, p) {
    const w = medir(ctx, s, o);
    const n = Math.floor(clamp(p) * Array.from(s).length);
    if (n <= 0) return;
    texto(ctx, Array.from(s).slice(0, n).join(""), cx - w / 2, y, { ...o, alinhar: "esq" });
  }

  // Linha de palavras centralizada; cada palavra "pula" na tela no seu
  // tempo. lista: [{ s, t, cor }]
  function palavras(ctx, lista, cx, y, o, t) {
    const espaco = medir(ctx, " ", o) + (o.esp || 0) * o.tam;
    const larguras = lista.map((p) => medir(ctx, p.s, o));
    const total = larguras.reduce((a, b) => a + b, 0) + espaco * (lista.length - 1);
    let x = cx - total / 2;
    lista.forEach((p, i) => {
      const w = larguras[i];
      const q = prog(t, p.t, p.t + 0.32);
      if (q > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp(q * 4);
        ctx.translate(x + w / 2, y);
        const esc = lerp(1.55, 1, E.outExpo(q));
        ctx.scale(esc, esc);
        texto(ctx, p.s, 0, 0, { ...o, cor: p.cor || o.cor, alinhar: "centro" });
        ctx.restore();
      }
      x += w + espaco;
    });
  }

  // ---------------------------------------------------------------
  // Formas da marca
  // ---------------------------------------------------------------
  // Canto cortado (superior direito e inferior esquerdo), manual 6.1.
  function corte(ctx, x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.closePath();
  }

  function cartao(ctx, x, y, w, h, o = {}) {
    corte(ctx, x, y, w, h, o.c ?? 22);
    ctx.fillStyle = o.fundo || C.superficie;
    ctx.fill();
    ctx.lineWidth = o.lw || 2.5;
    ctx.strokeStyle = o.borda || C.borda;
    ctx.stroke();
  }

  // Ícones em grade 24x24, traço 2, pontas retas (manual 5.2).
  const ICONES = {
    busca: "M10.5 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15M16 16l5 5",
    cadeado: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    cadeadoAberto: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.6-1.8",
    zap: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c0 3.5 3 6.5 6.5 6.5",
    mapa: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 6.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
    telefone: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2",
    funil: "M3 4h18l-7 8.5V19l-4 2v-8.5z",
    calendario: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M12 13.5v4M10 15.5h4",
    trofeu: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6v3H9z",
    chat: "M4 4h16v12H9l-5 4zM8 9h8M8 12h5",
    check: "M5 12.5l4.5 4.5L20 6.5",
    estrela: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    seta: "M4 12h15M13 6l6 6-6 6",
    mira: "M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10",
  };
  const cacheP = {};
  function icone(ctx, nome, x, y, tam, cor, o = {}) {
    const p = cacheP[nome] || (cacheP[nome] = new Path2D(ICONES[nome]));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(tam / 24, tam / 24);
    if (o.preencher) {
      ctx.fillStyle = cor;
      ctx.fill(p);
    }
    ctx.lineWidth = o.lw || 2;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = cor;
    if (!o.soPreencher) ctx.stroke(p);
    ctx.restore();
  }

  // Símbolo da marca (public/brand/simbolo.svg), com controles de
  // animação: pc = cantoneiras, pa = "A", pl = losango (0 a 1).
  const P_CANTOS = [
    [[4, 14], [4, 4], [14, 4]],
    [[50, 4], [60, 4], [60, 14]],
    [[4, 50], [4, 60], [14, 60]],
    [[60, 50], [60, 60], [50, 60]],
  ];
  const DIR_CANTOS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function simbolo(ctx, cx, cy, tam, o = {}) {
    const pc = o.pc ?? 1, pa = o.pa ?? 1, pl = o.pl ?? 1;
    const cores = o.cores || { a: C.amarelo, l: C.branco, c: C.bordaForte };
    ctx.save();
    ctx.translate(cx - tam / 2, cy - tam / 2);
    ctx.scale(tam / 64, tam / 64);
    if (pc > 0 && o.cantos !== false) {
      const af = (1 - E.outExpo(pc)) * 22;
      ctx.save();
      ctx.globalAlpha *= clamp(pc * 3);
      ctx.strokeStyle = cores.c;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "square";
      P_CANTOS.forEach((pts, i) => {
        const [dx, dy] = DIR_CANTOS[i];
        ctx.beginPath();
        pts.forEach(([x, y], j) => {
          const px = x + dx * af, py = y + dy * af;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      ctx.restore();
    }
    if (pa > 0) {
      ctx.save();
      const e = E.outBack(pa);
      ctx.translate(32, 54);
      ctx.scale(e, e);
      ctx.translate(-32, -54);
      ctx.beginPath();
      [[32, 10], [54, 54], [43, 54], [32, 31], [21, 54], [10, 54]].forEach(([x, y], j) =>
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      );
      ctx.closePath();
      ctx.fillStyle = cores.a;
      ctx.fill();
      ctx.restore();
    }
    if (pl > 0) {
      ctx.save();
      const e = E.outBack(pl);
      ctx.translate(32, 45);
      ctx.scale(e, e);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fillStyle = cores.l;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Assinatura "ÁRTEMIS / — PROSPECT" (manual 2.2). x = esquerda,
  // yTopo = topo do bloco. S = tamanho de ÁRTEMIS. Devolve a largura.
  function assinatura(ctx, x, yTopo, S, o = {}) {
    const pNome = o.pNome ?? 1, pSub = o.pSub ?? 1;
    const oNome = { tam: S, peso: 700, italico: true, esp: 0.02 };
    const oSub = { tam: S * 0.24, peso: 600, esp: 0.55 };
    const wNome = medir(ctx, "ÁRTEMIS", oNome);
    const barra = S * 0.48, gap = S * 0.15;
    const wSub = barra + gap + medir(ctx, "PROSPECT", oSub);
    const w = Math.max(wNome, wSub);
    const x0 = o.centro ? x - w / 2 : x;
    const baseNome = yTopo + S * 0.8;
    if (pNome > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - S, yTopo - S * 0.4, (wNome + S * 1.3) * E.outCubic(pNome) + S * 0.2, S * 1.4);
      ctx.clip();
      texto(ctx, "ÁRTEMIS", o.centro ? x - wNome / 2 : x0, baseNome, { ...oNome, cor: C.branco });
      ctx.restore();
    }
    if (pSub > 0) {
      const ySub = yTopo + S * 0.9 + S * 0.11;
      const xs = o.centro ? x - wSub / 2 : x0;
      const hb = Math.max(2, S * 0.043);
      ctx.fillStyle = C.amarelo;
      ctx.fillRect(xs, ySub + S * 0.12 - hb / 2, barra * E.outCubic(prog(pSub, 0, 0.5)), hb);
      // PROSPECT letra a letra
      const letras = Array.from("PROSPECT");
      fonte(ctx, oSub);
      let cx = xs + barra + gap;
      letras.forEach((ch, i) => {
        const q = prog(pSub, 0.15 + i * 0.07, 0.35 + i * 0.07);
        ctx.save();
        ctx.globalAlpha *= q;
        ctx.fillStyle = C.amarelo;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(ch, cx, ySub + S * 0.215 + (1 - q) * S * 0.12);
        ctx.restore();
        cx += ctx.measureText(ch).width + oSub.esp * oSub.tam;
      });
    }
    return w;
  }

  // Logo horizontal (manual 2.3). x = esquerda, yc = centro vertical.
  function logoHorizontal(ctx, x, yc, S) {
    const tamSimb = S * 1.6;
    simbolo(ctx, x + tamSimb / 2, yc, tamSimb);
    assinatura(ctx, x + tamSimb + S * 0.35, yc - S * 0.64, S);
    return tamSimb + S * 0.35 + medir(ctx, "ÁRTEMIS", { tam: S, peso: 700, italico: true, esp: 0.02 });
  }

  function etiqueta(ctx, s, x, y, estilo, tam = 24) {
    const o = { tam, peso: 600, esp: 0.08 };
    const px = tam * 0.62, h = tam * 1.7;
    const w = medir(ctx, s, o) + px * 2;
    if (estilo === "cheia") {
      ctx.fillStyle = C.amarelo;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = estilo === "amarela" ? C.amarelo : C.branco;
      ctx.strokeRect(x + 1.25, y + 1.25, w - 2.5, h - 2.5);
    }
    texto(ctx, s, x + px, y + h / 2 + tam * 0.36, {
      ...o,
      cor: estilo === "cheia" ? C.preto : estilo === "amarela" ? C.amarelo : C.branco,
    });
    return w;
  }

  // Badge de score (manual 6.4). Faixas: 80+ cheio, 70-79 contorno
  // amarelo, abaixo de 70 contorno cinza.
  function badgeScore(ctx, x, y, tam, valor) {
    const c = tam * 0.16;
    corte(ctx, x, y, tam, tam, c);
    let corNum = C.branco;
    if (valor >= 80) {
      ctx.fillStyle = C.amarelo;
      ctx.fill();
      corNum = C.preto;
    } else {
      ctx.fillStyle = C.preto;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = valor >= 70 ? C.amarelo : C.cinza600;
      corte(ctx, x + 2.5, y + 2.5, tam - 5, tam - 5, c - 1);
      ctx.stroke();
      corNum = valor >= 70 ? C.amarelo : C.branco;
    }
    texto(ctx, String(valor), x + tam / 2, y + tam / 2 + tam * 0.16, {
      tam: tam * 0.42, peso: 700, cor: corNum, alinhar: "centro",
    });
  }

  // Cantoneiras de mira (manual 6.5).
  function mira(ctx, x, y, w, h, braco, lw, cor) {
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = lw;
    ctx.lineCap = "square";
    const o = lw / 2;
    ctx.beginPath();
    ctx.moveTo(x + o, y + braco); ctx.lineTo(x + o, y + o); ctx.lineTo(x + braco, y + o);
    ctx.moveTo(x + w - braco, y + o); ctx.lineTo(x + w - o, y + o); ctx.lineTo(x + w - o, y + braco);
    ctx.moveTo(x + o, y + h - braco); ctx.lineTo(x + o, y + h - o); ctx.lineTo(x + braco, y + h - o);
    ctx.moveTo(x + w - braco, y + h - o); ctx.lineTo(x + w - o, y + h - o); ctx.lineTo(x + w - o, y + h - braco);
    ctx.stroke();
    ctx.restore();
  }

  // Botão primário amarelo (manual 6.2).
  function botaoPrimario(ctx, x, y, w, h, s, tam, o = {}) {
    corte(ctx, x, y, w, h, h * 0.24);
    ctx.fillStyle = C.amarelo;
    ctx.fill();
    const ot = { tam, peso: 700, esp: 0.08, cor: C.preto };
    const wt = medir(ctx, s, ot);
    const wi = o.icone ? tam * 1.1 + tam * 0.5 : 0;
    const x0 = x + w / 2 - (wt + wi) / 2;
    const xt = o.icone === "busca" ? x0 + wi : x0;
    if (o.icone === "busca") icone(ctx, "busca", x0, y + h / 2 - tam * 0.55, tam * 1.1, C.preto, { lw: 2.6 });
    texto(ctx, s, xt, y + h / 2 + tam * 0.36, ot);
    if (o.icone === "seta") icone(ctx, "seta", x0 + wt + tam * 0.5, y + h / 2 - tam * 0.55, tam * 1.1, C.preto, { lw: 2.6 });
  }

  // Mascote dentro de um círculo branco (manual 7: sempre sobre claro).
  function mascote(ctx, img, cx, cy, d, o = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = C.branco;
    ctx.fill();
    if (img && img.complete && img.naturalWidth) {
      ctx.clip();
      const fit = o.fit || 0.82;
      const esc = Math.min((d * fit) / img.naturalWidth, (d * fit) / img.naturalHeight);
      const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
      ctx.drawImage(img, cx - w / 2 + (o.dx || 0) * d, cy - h / 2 + (o.dy || 0) * d, w, h);
    }
    ctx.restore();
    if (o.anel) {
      ctx.save();
      ctx.globalAlpha *= o.anel;
      ctx.strokeStyle = C.amarelo;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2 + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Dedo tocando a tela: chega, aperta e solta uma onda.
  function toque(ctx, x, y, t, t0, de = [W * 0.75, H * 0.95]) {
    const chegada = prog(t, t0 - 0.55, t0 - 0.08);
    const saida = prog(t, t0 + 0.3, t0 + 0.55);
    if (chegada <= 0 || saida >= 1) return;
    const e = E.inOutCubic(chegada);
    const px = lerp(de[0], x, e), py = lerp(de[1], y, e);
    const aperto = t >= t0 && t < t0 + 0.14 ? 0.82 : 1;
    ctx.save();
    ctx.globalAlpha *= clamp(chegada * 3) * (1 - saida);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px, py, 38 * aperto, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const r = prog(t, t0, t0 + 0.45);
    if (r > 0 && r < 1) {
      ctx.globalAlpha *= 1 - r;
      ctx.beginPath();
      ctx.arc(px, py, 38 + 70 * E.outCubic(r), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Fundo, moldura e acabamento
  // ---------------------------------------------------------------
  function fundo(ctx, t, brilho) {
    ctx.fillStyle = C.preto;
    ctx.fillRect(0, 0, W, H);
    const g = 72, off = (t * 9) % g;
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -g + off; x < W + g; x += g) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -g + off; y < H + g; y += g) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    if (brilho) {
      const gr = ctx.createRadialGradient(brilho.x, brilho.y, 0, brilho.x, brilho.y, brilho.r || 700);
      gr.addColorStop(0, `rgba(255,214,10,${brilho.a ?? 0.07})`);
      gr.addColorStop(1, "rgba(255,214,10,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let vinhetaCache = null;
  function vinheta(ctx) {
    if (!vinhetaCache) {
      const gr = ctx.createRadialGradient(W / 2, H * 0.48, W * 0.45, W / 2, H * 0.48, H * 0.72);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, "rgba(0,0,0,0.6)");
      vinhetaCache = gr;
    }
    ctx.fillStyle = vinhetaCache;
    ctx.fillRect(0, 0, W, H);
  }

  // Granulado de filme: 4 texturas de ruído pré-geradas, sorteadas por quadro.
  const graos = [];
  function grao(ctx, t) {
    if (!graos.length) {
      const r = AP.rng(99);
      for (let k = 0; k < 4; k++) {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        const im = g.createImageData(256, 256);
        for (let i = 0; i < im.data.length; i += 4) {
          const v = Math.floor(r() * 255);
          im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
          im.data[i + 3] = 7;
        }
        g.putImageData(im, 0, 0);
        graos.push(ctx.createPattern(c, "repeat"));
      }
    }
    const q = Math.floor(t * AP.FPS);
    ctx.save();
    ctx.translate((q * 37) % 256, (q * 91) % 256);
    ctx.fillStyle = graos[q % 4];
    ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();
  }

  // Cantoneiras de HUD nas bordas do vídeo (a moldura da marca).
  function moldura(ctx, t) {
    const p = E.outExpo(prog(t, 0, 0.6));
    const ins = 40 + (1 - p) * 40, b = 64;
    ctx.save();
    ctx.globalAlpha = p;
    mira(ctx, ins, ins, W - ins * 2, H - ins * 2, b, 5, C.bordaForte);
    ctx.restore();
  }

  // Rótulo "PASSO N" + título + subtítulo, padrão das cenas 4 a 7.
  function cabecalho(ctx, t, t0, rotulo, titulo, sub) {
    const p1 = prog(t, t0, t0 + 0.45);
    const p2 = prog(t, t0 + 0.12, t0 + 0.6);
    const p3 = prog(t, t0 + 0.3, t0 + 0.8);
    ctx.save();
    ctx.globalAlpha *= E.outCubic(p1);
    const or = { tam: 32, peso: 600, esp: 0.3, cor: C.amarelo };
    const wr = medir(ctx, rotulo, or);
    ctx.fillStyle = C.amarelo;
    ctx.fillRect(W / 2 - wr / 2 - 64, 298, 40, 5);
    ctx.fillRect(W / 2 + wr / 2 + 24, 298, 40, 5);
    texto(ctx, rotulo, W / 2, 312, { ...or, alinhar: "centro" });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= E.outCubic(p2);
    ctx.translate(0, (1 - E.outExpo(p2)) * 40);
    const ot = caber(ctx, titulo, { tam: 84, peso: 700, alinhar: "centro" }, 880);
    texto(ctx, titulo, W / 2, 410, ot);
    ctx.restore();

    if (sub) {
      ctx.save();
      ctx.globalAlpha *= E.outCubic(p3);
      const os = caber(ctx, sub, { fam: "t", tam: 36, peso: 400, cor: C.texto2, alinhar: "centro" }, 860);
      texto(ctx, sub, W / 2, 470, os);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------
  // Cena 1 — gancho (0 a 4 s)
  // ---------------------------------------------------------------
  function cenaGancho(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 820, r: 800, a: 0.06 });
    const [sx, sy] = tremor(t, K.palavrasA[2], 16);
    const [bx, by] = tremor(t, K.palavrasB[2], 16);
    ctx.save();
    ctx.translate(sx + bx, sy + by);

    rotuloDigitado(ctx, "PARA WEB DESIGNERS", W / 2, 520, { tam: 36, peso: 600, esp: 0.3, cor: C.amarelo }, prog(t, K.rotulo1, K.rotulo1 + 0.45));

    // Parte A: "VOCÊ FAZ / SITES?"
    const saida = E.inCubic(prog(t, K.saidaA, K.saidaA + 0.25));
    if (saida < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - saida;
      ctx.translate(0, -saida * 120);
      const oA = { tam: 150, peso: 700, italico: true };
      palavras(ctx, [{ s: "VOCÊ", t: K.palavrasA[0] }, { s: "FAZ", t: K.palavrasA[1] }], W / 2, 720, oA, t);
      palavras(ctx, [{ s: "SITES?", t: K.palavrasA[2], cor: C.amarelo }], W / 2, 920, { ...oA, tam: 220 }, t);

      // Janela de navegador desenhando-se (os sites que ele faz)
      const pj = prog(t, 0.85, 1.35);
      if (pj > 0) {
        const x = 260, y = 1070, w = 560, h = 380;
        ctx.save();
        ctx.globalAlpha *= E.outCubic(pj);
        ctx.translate(0, (1 - E.outExpo(pj)) * 60);
        cartao(ctx, x, y, w, h, { c: 20 });
        ctx.fillStyle = C.divisoria;
        ctx.fillRect(x + 2, y + 2, w - 24, 50);
        [0, 1, 2].forEach((i) => {
          ctx.beginPath();
          ctx.arc(x + 34 + i * 30, y + 27, 8, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? C.amarelo : C.bordaForte;
          ctx.fill();
        });
        const blocos = [
          [x + 36, y + 90, 300, 30, C.branco],
          [x + 36, y + 140, 420, 16, C.bordaForte],
          [x + 36, y + 170, 360, 16, C.bordaForte],
          [x + 36, y + 225, 170, 50, C.amarelo],
          [x + 36, y + 305, 150, 40, C.borda],
          [x + 205, y + 305, 150, 40, C.borda],
          [x + 374, y + 305, 150, 40, C.borda],
        ];
        blocos.forEach((b, i) => {
          const q = E.outCubic(prog(t, 0.95 + i * 0.05, 1.2 + i * 0.05));
          ctx.fillStyle = b[4];
          ctx.fillRect(b[0], b[1], b[2] * q, b[3]);
        });
        ctx.restore();
      }
      ctx.restore();
    }

    // Parte B: "MAS CADÊ / OS CLIENTES?"
    const oB = { tam: 150, peso: 700, italico: true };
    palavras(ctx, [{ s: "MAS", t: K.palavrasB[0] }, { s: "CADÊ", t: K.palavrasB[1] }], W / 2, 720, oB, t);
    const oB2 = caber(ctx, "OS CLIENTES?", { ...oB, tam: 150 }, 900);
    palavras(ctx, [{ s: "OS CLIENTES?", t: K.palavrasB[2], cor: C.amarelo }], W / 2, 890, oB2, t);

    // Ártemis pensando
    const pm = prog(t, K.mascotePensando, K.mascotePensando + 0.45);
    if (pm > 0) {
      const e = E.outBack(pm);
      const bob = Math.sin((t - K.mascotePensando) * 3.2) * 8;
      ctx.save();
      ctx.translate(W / 2, 1245 + bob);
      ctx.scale(e, e);
      mascote(ctx, AP.IMG.pensando, 0, 0, 420, { fit: 0.84, dy: 0.02 });
      ctx.restore();
      const pos = [[270, 1100, -0.25], [800, 1080, 0.2], [835, 1330, 0.3]];
      K.interrogacoes.forEach((ti, i) => {
        const q = prog(t, ti, ti + 0.3);
        if (q <= 0) return;
        ctx.save();
        ctx.translate(pos[i][0], pos[i][1] + Math.sin(t * 4 + i) * 6);
        ctx.rotate(pos[i][2] + Math.sin(t * 3 + i * 2) * 0.08);
        const s = E.outBack(q);
        ctx.scale(s, s);
        texto(ctx, "?", 0, 0, { tam: 110, peso: 700, italico: true, cor: C.amarelo, alinhar: "centro" });
        ctx.restore();
      });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Cena 2 — o problema / a oportunidade (4 a 8 s)
  // ---------------------------------------------------------------
  const RUAS = (() => {
    const r = AP.rng(21);
    const ruas = [];
    for (let i = 0; i < 9; i++) ruas.push({ tipo: "h", y: 40 + i * 85 + (r() - 0.5) * 30, a: (r() - 0.5) * 0.12, w: 14 });
    for (let i = 0; i < 8; i++) ruas.push({ tipo: "v", x: 30 + i * 115 + (r() - 0.5) * 40, a: (r() - 0.5) * 0.15, w: 14 });
    return ruas;
  })();

  function pino(ctx, x, y, s, cor, corPonto) {
    const r = s * 0.55;
    ctx.beginPath();
    ctx.arc(x, y - s, r, Math.PI * 0.78, Math.PI * 0.22);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - s, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = corPonto;
    ctx.fill();
  }

  function cenaProblema(ctx, t) {
    const M = AP.MAPA;
    fundo(ctx, t, { x: W / 2, y: 1050, r: 800, a: 0.05 });

    // Mergulho no pino-alvo antes da logo.
    const alvo = AP.PINOS[AP.PINO_ALVO];
    const pz = E.inExpo(prog(t, K.mergulho, 8.0));
    const zx = M.x + alvo.x, zy = M.y + alvo.y - 40;
    ctx.save();
    ctx.translate(zx, zy);
    ctx.scale(1 + pz * 5, 1 + pz * 5);
    ctx.translate(-zx, -zy);
    const [sx, sy] = tremor(t, K.tituloProblema[2], 12);
    ctx.translate(sx, sy);

    // Título
    const oR = { tam: 32, peso: 600, esp: 0.3, cor: C.amarelo };
    rotuloDigitado(ctx, "A OPORTUNIDADE", W / 2, 300, oR, prog(t, 4.0, 4.35));
    const oT = { tam: 96, peso: 700, italico: true };
    palavras(ctx, [{ s: "TEM NEGÓCIO BOM", t: K.tituloProblema[0] }], W / 2, 410, caber(ctx, "TEM NEGÓCIO BOM", oT, 900), t);
    palavras(ctx, [{ s: "PERTO DE VOCÊ", t: K.tituloProblema[1] }], W / 2, 510, caber(ctx, "PERTO DE VOCÊ", oT, 900), t);
    palavras(ctx, [{ s: "SEM SITE.", t: K.tituloProblema[2], cor: C.amarelo }], W / 2, 650, { ...oT, tam: 150 }, t);

    // Mapa
    const pm = E.outCubic(prog(t, 4.55, 4.95));
    ctx.save();
    ctx.globalAlpha *= pm;
    ctx.translate(0, (1 - pm) * 80);
    corte(ctx, M.x, M.y, M.w, M.h, 26);
    ctx.fillStyle = C.sidebar;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.translate(M.x, M.y);
    // quarteirões
    ctx.lineCap = "butt";
    RUAS.forEach((r) => {
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = r.w;
      ctx.beginPath();
      if (r.tipo === "h") {
        ctx.moveTo(-20, r.y - Math.tan(r.a) * 20);
        ctx.lineTo(M.w + 20, r.y + Math.tan(r.a) * (M.w + 20));
      } else {
        ctx.moveTo(r.x - Math.tan(r.a) * 20, -20);
        ctx.lineTo(r.x + Math.tan(r.a) * (M.h + 20), M.h + 20);
      }
      ctx.stroke();
    });
    // avenidas
    ctx.strokeStyle = C.borda;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(-40, 520);
    ctx.bezierCurveTo(260, 420, 520, 520, M.w + 40, 250);
    ctx.moveTo(300, -40);
    ctx.bezierCurveTo(360, 260, 250, 460, 330, M.h + 40);
    ctx.stroke();

    // varredura
    const pv = prog(t, K.varreduraA, K.varreduraB);
    if (pv > 0 && pv < 1) {
      const vy = pv * M.h;
      const gr = ctx.createLinearGradient(0, vy - 160, 0, vy);
      gr.addColorStop(0, "rgba(255,214,10,0)");
      gr.addColorStop(1, "rgba(255,214,10,0.16)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, vy - 160, M.w, 160);
      ctx.fillStyle = C.amarelo;
      ctx.fillRect(0, vy - 2, M.w, 4);
    }

    // pinos
    let convertidos = 0;
    AP.PINOS.forEach((p, i) => {
      const t0 = AP.tempoPino(i);
      const q = prog(t, t0, t0 + 0.35);
      if (q <= 0) return;
      const conv = p.s && t >= AP.tempoConversao(i);
      if (conv) convertidos++;
      const queda = (1 - E.outBack(q)) * -90;
      ctx.save();
      ctx.globalAlpha *= clamp(q * 3);
      // onda ao converter
      if (conv) {
        const r = prog(t, AP.tempoConversao(i), AP.tempoConversao(i) + 0.6);
        if (r < 1) {
          ctx.strokeStyle = `rgba(255,214,10,${1 - r})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 30, 20 + r * 70, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const pulo = conv ? E.outBack(prog(t, AP.tempoConversao(i), AP.tempoConversao(i) + 0.25)) : 1;
      const esc = conv ? lerp(1.4, 1, pulo) : 1;
      ctx.translate(p.x, p.y + queda);
      ctx.scale(esc, esc);
      pino(ctx, 0, 0, 52, conv ? C.amarelo : p.s || t < K.varreduraA ? C.branco : C.bordaForte, C.preto);
      ctx.restore();
      if (conv && p.tag) {
        const qt = prog(t, AP.tempoConversao(i) + 0.08, AP.tempoConversao(i) + 0.35);
        if (qt > 0) {
          ctx.save();
          ctx.globalAlpha *= qt;
          const tx = p.x + 30, ty = p.y - 104 - (1 - E.outBack(qt)) * 20;
          etiqueta(ctx, "SEM SITE", Math.min(tx, M.w - 170), ty, "cheia", 22);
          ctx.restore();
        }
      }
    });

    // contador
    const pc = prog(t, K.varreduraA - 0.2, K.varreduraA + 0.1);
    if (pc > 0) {
      ctx.save();
      ctx.globalAlpha *= pc;
      const s = `${convertidos} LEADS SEM SITE`;
      const o = { tam: 28, peso: 700, esp: 0.08 };
      const w = medir(ctx, s, o) + 40;
      ctx.fillStyle = C.amarelo;
      ctx.fillRect(M.w - w - 24, M.h - 76, w, 52);
      texto(ctx, s, M.w - w - 4, M.h - 40, { ...o, cor: C.preto });
      ctx.restore();
    }
    ctx.restore();
    corte(ctx, M.x, M.y, M.w, M.h, 26);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.borda;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    // escurece no fim do mergulho
    const pf = prog(t, 7.7, 8.0);
    if (pf > 0) {
      ctx.fillStyle = `rgba(10,10,10,${pf})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------
  // Cena 3 — a marca (8 a 12 s)
  // ---------------------------------------------------------------
  function cenaLogo(ctx, t) {
    const lt = t - 8;
    fundo(ctx, t, { x: W / 2, y: 820, r: 760, a: 0.05 * prog(lt, 0, 0.5) });
    const zoom = 1 + lt * 0.012;
    const [sx, sy] = tremor(t, K.impacto, 22);
    ctx.save();
    ctx.translate(W / 2 + sx, 900 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -900);

    // onda de choque (fora da logo)
    const po = prog(lt, 0, 0.7);
    if (po > 0 && po < 1) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,214,10,${0.5 * (1 - po)})`;
      ctx.lineWidth = 10 * (1 - po) + 1;
      ctx.beginPath();
      ctx.arc(W / 2, 720, 120 + E.outCubic(po) * 700, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    simbolo(ctx, W / 2, 720, 330, {
      pc: prog(lt, 0.02, 0.5),
      pa: prog(lt, 0.08, 0.5),
      pl: prog(lt, 0.42, 0.62),
    });
    assinatura(ctx, W / 2, 935, 150, {
      centro: true,
      pNome: prog(lt, 0.5, 0.95),
      pSub: prog(lt, 0.8, 1.5),
    });

    const oT = { tam: 76, peso: 700, italico: true };
    palavras(ctx, [{ s: "ACHE CLIENTES", t: K.tagline[0] }], W / 2, 1300, caber(ctx, "ACHE CLIENTES QUE", oT, 880), t);
    palavras(ctx, [{ s: "QUE", t: K.tagline[1] }, { s: "AINDA NÃO", t: K.tagline[1], cor: C.amarelo }], W / 2, 1390, oT, t);
    palavras(ctx, [{ s: "TÊM SITE.", t: K.tagline[2], cor: C.amarelo }], W / 2, 1480, oT, t);
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Cena 4 — passo 1: busque (12 a 18 s)
  // ---------------------------------------------------------------
  function digitado(str, tempos, t) {
    let n = 0;
    while (n < tempos.length && t >= tempos[n]) n++;
    return str.slice(0, n);
  }

  // Tela do celular em coordenadas de 390 px de largura (como no site).
  function telaBusca(ctx, t) {
    ctx.fillStyle = C.preto;
    ctx.fillRect(0, 0, 390, 900);
    // cabeçalho
    ctx.fillStyle = C.sidebar;
    ctx.fillRect(0, 0, 390, 62);
    ctx.fillStyle = C.divisoria;
    ctx.fillRect(0, 61, 390, 1);
    logoHorizontal(ctx, 16, 31, 17);
    icone(ctx, "mira", 330, 19, 24, C.amarelo, { lw: 2 });

    texto(ctx, "Buscar leads", 16, 106, { tam: 30, peso: 700 });
    texto(ctx, "Busca no Google Maps e separa quem não tem site.", 16, 132, { fam: "t", tam: 13, peso: 400, cor: C.texto2 });
    // pílulas
    ctx.lineWidth = 1;
    ctx.fillStyle = C.amareloSuave;
    ctx.fillRect(16, 146, 88, 30);
    ctx.strokeStyle = C.amarelo;
    ctx.strokeRect(16.5, 146.5, 87, 29);
    texto(ctx, "Plano Pro", 60, 166, { fam: "t", tam: 13, peso: 600, cor: C.amarelo, alinhar: "centro" });
    ctx.fillStyle = C.superficie;
    ctx.fillRect(112, 146, 170, 30);
    ctx.strokeStyle = C.bordaInput;
    ctx.strokeRect(112.5, 146.5, 169, 29);
    texto(ctx, "41 buscas restantes", 197, 166, { fam: "t", tam: 13, peso: 600, cor: C.campo, alinhar: "centro" });

    // formulário
    ctx.fillStyle = C.superficie;
    ctx.fillRect(16, 190, 358, 320);
    ctx.strokeStyle = C.borda;
    ctx.strokeRect(16.5, 190.5, 357, 319);
    ctx.fillStyle = C.preto;
    ctx.fillRect(32, 206, 326, 44);
    ctx.fillStyle = C.amareloSuave;
    ctx.fillRect(36, 210, 157, 36);
    ctx.fillStyle = C.amarelo;
    ctx.fillRect(40, 244, 149, 2);
    texto(ctx, "NEGÓCIOS", 114, 234, { tam: 13, peso: 700, esp: 0.12, cor: C.amarelo, alinhar: "centro" });
    texto(ctx, "HOSPEDAGEM", 275, 234, { tam: 13, peso: 700, esp: 0.12, cor: C.texto2, alinhar: "centro" });

    const cursor = Math.floor(t * 2.4) % 2 === 0;
    const campo = (rotulo, y, valor, foco) => {
      texto(ctx, rotulo, 32, y, { fam: "t", tam: 13, peso: 600, cor: C.campo });
      ctx.fillStyle = C.preto;
      ctx.fillRect(32, y + 10, 326, 42);
      ctx.strokeStyle = foco ? C.amarelo : C.bordaInput;
      ctx.lineWidth = foco ? 1.5 : 1;
      ctx.strokeRect(32.5, y + 10.5, 325, 41);
      const w = texto(ctx, valor, 44, y + 37, { fam: "t", tam: 15, peso: 500, cor: C.campo });
      if (foco && cursor) {
        ctx.fillStyle = C.amarelo;
        ctx.fillRect(46 + w, y + 20, 1.5, 22);
      }
    };
    const nicho = digitado(AP.TEXTOS.nicho, AP.DIG.nicho, t);
    const regiao = digitado(AP.TEXTOS.regiao, AP.DIG.regiao, t);
    const focoNicho = t >= 12.55 && t < AP.DIG.nicho[AP.DIG.nicho.length - 1] + 0.2;
    const focoRegiao = t >= AP.DIG.nicho[AP.DIG.nicho.length - 1] + 0.2 && t < K.toqueBuscar;
    campo("Nicho (pode separar por vírgula)", 276, nicho, focoNicho);
    campo("Regiões (separe por vírgula)", 350, regiao, focoRegiao);

    const pd = prog(t, 15.35, 15.6);
    if (pd > 0) {
      ctx.save();
      ctx.globalAlpha *= pd;
      texto(ctx, "3 termo(s) × 1 região: vai gastar 3 buscas.", 32, 432, { fam: "t", tam: 12, peso: 400, cor: C.texto3 });
      ctx.restore();
    }

    // botão
    const ap = t >= K.toqueBuscar && t < K.toqueBuscar + 0.14 ? 0.96 : 1;
    ctx.save();
    ctx.translate(195, 470);
    ctx.scale(ap, ap);
    botaoPrimario(ctx, -163, -22, 326, 46, "BUSCAR LEADS", 15, { icone: "busca" });
    ctx.restore();

    // radar
    const pr = prog(t, K.radarA, K.radarA + 0.3);
    if (pr > 0) {
      const cx = 195, cy = 660, R = 88;
      ctx.save();
      ctx.globalAlpha *= pr;
      ctx.strokeStyle = C.borda;
      ctx.lineWidth = 1;
      [1, 0.66, 0.33].forEach((k) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
      ctx.stroke();
      const ang = (t - K.radarA) * 4.2;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, ang - (i + 1) * 0.07, ang - i * 0.07);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,214,10,${0.32 * (1 - i / 14)})`;
        ctx.fill();
      }
      ctx.strokeStyle = C.amarelo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      ctx.stroke();
      let achados = 0;
      AP.BLIPS.forEach((b) => {
        const q = prog(t, b.t, b.t + 0.25);
        if (q <= 0) return;
        achados++;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(b.a) * R * b.r, cy + Math.sin(b.a) * R * b.r, 5 * E.outBack(q), 0, Math.PI * 2);
        ctx.fillStyle = C.amarelo;
        ctx.fill();
      });
      const pontos = ".".repeat(1 + (Math.floor(t * 3) % 3));
      texto(ctx, "Buscando no Google Maps" + pontos, 195, 548, { fam: "t", tam: 14, peso: 600, cor: C.texto2, alinhar: "centro" });
      if (achados) texto(ctx, `${achados * 8} leads encontrados`, 195, 782, { tam: 16, peso: 700, esp: 0.06, cor: C.amarelo, alinhar: "centro" });
      ctx.restore();
    }
  }

  function celular(ctx, x, y, w, h, desenharTela) {
    const r = 86, borda = 20;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = "#050505";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.bordaInput;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x + borda, y + borda, w - borda * 2, h - borda * 2, r - borda);
    ctx.clip();
    ctx.translate(x + borda, y + borda);
    const k = (w - borda * 2) / 390;
    ctx.scale(k, k);
    desenharTela(ctx);
    ctx.restore();
    // entalhe da câmera
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 70, y + borda + 12, 140, 34, 17);
    ctx.fillStyle = "#050505";
    ctx.fill();
  }

  function cenaBusca(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 1100, r: 800, a: 0.05 });
    cabecalho(ctx, t, 12.05, "PASSO 1", "Busque por nicho e bairro", "Vários termos e regiões de uma vez.");
    const ps = E.outCubic(prog(t, K.celularSobe, K.celularSobe + 0.6));
    const zoom = 1 + 0.05 * E.inOutCubic(prog(t, 12.6, 15.8));
    ctx.save();
    ctx.translate(W / 2, 1000);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -1000 + (1 - ps) * 900);
    celular(ctx, 180, 545, 720, 1500, (c) => telaBusca(c, t));
    ctx.restore();
    // botão BUSCAR LEADS: centro em (195, 470) na tela do celular
    const k = 680 / 390;
    const bx = W / 2 + (200 + 195 * k - W / 2) * zoom;
    const by = 1000 + (565 + 470 * k - 1000) * zoom;
    toque(ctx, bx, by, t, K.toqueBuscar);
  }

  // ---------------------------------------------------------------
  // Cena 5 — passo 2: a lista de leads (18 a 24 s)
  // ---------------------------------------------------------------
  const LEADS = [
    { nome: "Barbearia Navalha de Ouro", score: 86, tag: "SEM SITE", est: "cheia", cat: "Barbearia", bairro: "Centro", nota: "4,8", av: 212, zap: true },
    { nome: "Pousada Maré Mansa", score: 81, tag: "DEPENDE DO BOOKING", est: "amarela", cat: "Pousada", bairro: "Pinheira", nota: "4,7", av: 158, zap: true },
    { nome: "Studio Unhas da Bia", score: 72, tag: "SÓ INSTAGRAM", est: "branca", cat: "Manicure", bairro: "Pagani", nota: "4,9", av: 96 },
    { nome: "Auto Center Dois Irmãos", score: 58, tag: "SEM SITE", est: "cheia", cat: "Oficina", bairro: "Ponte do Imaruim", nota: "4,5", av: 64 },
  ];
  const CART = { x: 110, y: 540, w: 860, h: 196, gap: 26 };

  function cartaoLead(ctx, L, x, y, w, h, t, tEntrada) {
    cartao(ctx, x, y, w, h);
    const contagem = E.outCubic(prog(t, tEntrada + 0.1, tEntrada + 0.65));
    badgeScore(ctx, x + 30, y + 42, 112, Math.round(L.score * contagem));
    const on = caber(ctx, L.nome, { fam: "t", tam: 38, peso: 800 }, 560);
    texto(ctx, L.nome, x + 172, y + 78, on);
    const wt = etiqueta(ctx, L.tag, x + 172, y + 96, L.est, 22);
    texto(ctx, L.cat, x + 172 + wt + 16, y + 126, { fam: "t", tam: 26, peso: 400, cor: C.texto2 });
    const wb = texto(ctx, L.bairro, x + 172, y + 172, { fam: "t", tam: 26, peso: 400, cor: C.texto2 });
    icone(ctx, "estrela", x + 172 + wb + 18, y + 150, 26, C.texto2, { lw: 2 });
    texto(ctx, `${L.nota} (${L.av})`, x + 172 + wb + 52, y + 172, { fam: "t", tam: 26, peso: 600, cor: C.texto2 });
    // ação à direita
    const bx = x + w - 96, by = y + h / 2 - 34;
    if (L.zap) {
      corte(ctx, bx, by, 68, 68, 12);
      ctx.fillStyle = C.amarelo;
      ctx.fill();
      icone(ctx, "zap", bx + 16, by + 16, 36, C.preto, { lw: 2.4 });
    } else {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.bordaForte;
      ctx.strokeRect(bx + 1, by + 1, 66, 66);
      icone(ctx, "cadeado", bx + 18, by + 16, 32, C.campo, { lw: 2.4 });
    }
  }

  function cenaLista(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 900, r: 800, a: 0.05 });
    cabecalho(ctx, t, 18.05, "PASSO 2", "Veja quem precisa de site", "Etiqueta e score: do mais quente ao mais frio.");
    const trava = prog(t, K.miraTrava, K.miraTrava + 0.35);
    LEADS.forEach((L, i) => {
      const t0 = K.cartoes[i];
      const q = prog(t, t0, t0 + 0.5);
      if (q <= 0) return;
      const y = CART.y + i * (CART.h + CART.gap);
      ctx.save();
      ctx.globalAlpha *= clamp(q * 2.5) * (i === 0 ? 1 : 1 - 0.6 * trava);
      ctx.translate((1 - E.outExpo(q)) * 900 * (i % 2 ? -1 : 1), 0);
      cartaoLead(ctx, L, CART.x, y, CART.w, CART.h, t, t0);
      ctx.restore();
    });

    // A mira sai das bordas e trava no primeiro lead.
    const pm = prog(t, K.miraA, K.miraTrava);
    if (pm > 0) {
      const e = E.inOutCubic(pm);
      const pad = 22;
      const alvo = [CART.x - pad, CART.y - pad, CART.w + pad * 2, CART.h + pad * 2];
      const de = [60, 150, W - 120, H - 300];
      const x = lerp(de[0], alvo[0], e), y = lerp(de[1], alvo[1], e);
      const w = lerp(de[2], alvo[2], e), h = lerp(de[3], alvo[3], e);
      const pulso = trava > 0 && trava < 1 ? Math.sin(trava * Math.PI) * 10 : 0;
      ctx.save();
      ctx.globalAlpha *= clamp(pm * 3);
      mira(ctx, x - pulso, y - pulso, w + pulso * 2, h + pulso * 2, 64, 8, C.amarelo);
      ctx.restore();
      if (trava > 0) {
        ctx.save();
        ctx.globalAlpha *= trava;
        const s = "LEAD NA MIRA";
        const o = { tam: 26, peso: 700, esp: 0.12 };
        const wl = medir(ctx, s, o) + 36;
        const ly = CART.y - pad - 23 + (1 - E.outBack(trava)) * 16;
        ctx.fillStyle = C.amarelo;
        ctx.fillRect(W / 2 - wl / 2, ly, wl, 46);
        texto(ctx, s, W / 2, ly + 33, { ...o, cor: C.preto, alinhar: "centro" });
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------
  // Cena 6 — passo 3: chame no WhatsApp (24 a 30 s)
  // ---------------------------------------------------------------
  const MSG = "Oi, pessoal da Barbearia Navalha de Ouro! Vi que vocês ainda não têm site. Posso mostrar uma ideia?";
  const RESPOSTA = "Opa! Quanto fica um site?";
  const CONFETE = (() => {
    const r = AP.rng(5);
    return Array.from({ length: 70 }, () => ({
      a: -Math.PI / 2 + (r() - 0.5) * 2.6,
      v: 600 + r() * 900,
      rot: r() * 6,
      vr: (r() - 0.5) * 14,
      w: 10 + r() * 14,
      h: 6 + r() * 8,
      cor: r() < 0.65 ? C.amarelo : C.branco,
    }));
  })();

  function cenaWhats(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 1000, r: 800, a: 0.05 });
    cabecalho(ctx, t, 24.05, "PASSO 3", "Chame no WhatsApp", "Mensagem pronta, com o nome do negócio.");
    const [sx, sy] = tremor(t, K.vendaFechada, 18);
    ctx.save();
    ctx.translate(sx, sy);

    const L = LEADS[0];
    const x = 110, y = 560, w = 860, h = 400;
    const pe = E.outCubic(prog(t, 24.1, 24.5));
    const desbloq = t >= K.toqueDesbloquear + 0.3;
    ctx.save();
    ctx.globalAlpha *= pe;
    ctx.translate(0, (1 - pe) * 60);

    // créditos
    const creditos = t >= K.toqueDesbloquear + 0.2 ? 17 : 18;
    const pulo = E.outBack(prog(t, K.toqueDesbloquear + 0.2, K.toqueDesbloquear + 0.45));
    ctx.save();
    const sc = t >= K.toqueDesbloquear + 0.2 ? lerp(1.25, 1, pulo) : 1;
    ctx.translate(x + w, y - 34);
    ctx.scale(sc, sc);
    const sCred = `${creditos} CRÉDITOS`;
    const wc = medir(ctx, sCred, { tam: 22, peso: 600, esp: 0.08 }) + 28;
    etiqueta(ctx, sCred, -wc, -18, "amarela", 22);
    ctx.restore();

    cartao(ctx, x, y, w, h);
    ctx.fillStyle = C.borda;
    ctx.fillRect(x + 36, y + 36, 100, 100);
    texto(ctx, "BN", x + 86, y + 100, { tam: 38, peso: 700, alinhar: "centro" });
    texto(ctx, L.nome, x + 164, y + 80, caber(ctx, L.nome, { fam: "t", tam: 40, peso: 800 }, 650));
    texto(ctx, "Centro", x + 164, y + 124, { fam: "t", tam: 28, peso: 400, cor: C.texto2 });
    const wt = etiqueta(ctx, "SEM SITE", x + 36, y + 162, "cheia", 24);
    icone(ctx, "estrela", x + 36 + wt + 20, y + 168, 28, C.texto2);
    texto(ctx, "4,8 (212 avaliações)", x + 36 + wt + 58, y + 192, { fam: "t", tam: 28, peso: 600, cor: C.texto2 });

    // telefone: escondido até desbloquear, depois "rola" os números
    icone(ctx, "telefone", x + 36, y + 226, 30, C.texto2);
    const numero = "(48) 99999-1234";
    let mostra;
    if (!desbloq) mostra = "(48) •••••-••••";
    else {
      const pr = prog(t, K.toqueDesbloquear + 0.3, K.toqueDesbloquear + 0.75);
      const n = Math.floor(pr * numero.length);
      const r = AP.rng(Math.floor(t * 30));
      mostra = numero.slice(0, n) + numero.slice(n).replace(/\d/g, () => String(Math.floor(r() * 10)));
    }
    texto(ctx, mostra, x + 84, y + 252, { fam: "t", tam: 32, peso: 700, cor: desbloq ? C.branco : C.texto3 });

    // botões
    const by = y + 290, bh = 80;
    if (!desbloq) {
      const aperto = t >= K.toqueDesbloquear && t < K.toqueDesbloquear + 0.14 ? 0.97 : 1;
      ctx.save();
      ctx.translate(x + w / 2, by + bh / 2);
      ctx.scale(aperto, aperto);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.bordaForte;
      ctx.strokeRect(-(w - 72) / 2, -bh / 2, w - 72, bh);
      const aberto = t >= K.toqueDesbloquear + 0.12;
      const s = "DESBLOQUEAR (1 CRÉDITO)";
      const o = { tam: 30, peso: 600, esp: 0.06, cor: C.campo };
      const ws = medir(ctx, s, o);
      icone(ctx, aberto ? "cadeadoAberto" : "cadeado", -ws / 2 - 30, -18, 34, aberto ? C.amarelo : C.campo, { lw: 2.4 });
      texto(ctx, s, -ws / 2 + 22, 11, o);
      ctx.restore();
    } else {
      const q = E.outBack(prog(t, K.toqueDesbloquear + 0.3, K.toqueDesbloquear + 0.6));
      const apertoZ = t >= K.toqueWhats && t < K.toqueWhats + 0.14 ? 0.96 : 1;
      ctx.save();
      ctx.translate(x + 36 + 230, by + bh / 2);
      ctx.scale(q * apertoZ, q * apertoZ);
      corte(ctx, -230, -bh / 2, 460, bh, 16);
      ctx.fillStyle = C.amarelo;
      ctx.fill();
      icone(ctx, "zap", -120, -20, 40, C.preto, { lw: 2.4 });
      texto(ctx, "WHATSAPP", 30, 12, { tam: 32, peso: 700, esp: 0.06, cor: C.preto, alinhar: "centro" });
      ctx.restore();
      ctx.save();
      ctx.translate(x + 36 + 480 + 154, by + bh / 2);
      ctx.scale(q, q);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.bordaForte;
      ctx.strokeRect(-154, -bh / 2, 308, bh);
      icone(ctx, "mapa", -78, -18, 36, C.campo, { lw: 2.2 });
      texto(ctx, "MAPS", 20, 11, { tam: 30, peso: 600, esp: 0.06, cor: C.campo, alinhar: "centro" });
      ctx.restore();
    }
    ctx.restore();

    toque(ctx, x + w / 2 + 60, by + bh / 2, t, K.toqueDesbloquear);
    toque(ctx, x + 36 + 230, by + bh / 2, t, K.toqueWhats, [W * 0.8, H * 0.9]);

    // conversa
    const pp = prog(t, K.painelChat, K.painelChat + 0.45);
    if (pp > 0) {
      const py = lerp(H + 40, 1000, E.outExpo(pp));
      const ph = 500;
      ctx.save();
      cartao(ctx, x, py, w, ph, { fundo: C.sidebar });
      ctx.beginPath();
      ctx.arc(x + 70, py + 62, 34, 0, Math.PI * 2);
      ctx.fillStyle = C.borda;
      ctx.fill();
      texto(ctx, "BN", x + 70, py + 74, { tam: 26, peso: 700, alinhar: "centro" });
      texto(ctx, L.nome, x + 122, py + 58, { fam: "t", tam: 30, peso: 800 });
      texto(ctx, "online", x + 122, py + 92, { fam: "t", tam: 22, peso: 400, cor: C.texto3 });
      ctx.fillStyle = C.divisoria;
      ctx.fillRect(x + 2, py + 124, w - 4, 2);

      // mensagem enviada (amarela, à direita)
      const pm = prog(t, K.msgEnviada, K.msgEnviada + 0.3);
      if (pm > 0) {
        const om = { fam: "t", tam: 30, peso: 600, cor: C.preto };
        const linhas = quebrar(ctx, MSG, om, 560);
        const bw = Math.max(...linhas.map((l) => medir(ctx, l, om))) + 56;
        const bh2 = linhas.length * 42 + 64;
        const bx = x + w - 36 - bw, byy = py + 150;
        ctx.save();
        ctx.globalAlpha *= clamp(pm * 3);
        const e = E.outBack(pm);
        ctx.translate(bx + bw, byy + bh2);
        ctx.scale(e, e);
        ctx.translate(-bx - bw, -byy - bh2);
        corte(ctx, bx, byy, bw, bh2, 18);
        ctx.fillStyle = C.amarelo;
        ctx.fill();
        linhas.forEach((l, i) => texto(ctx, l, bx + 28, byy + 52 + i * 42, om));
        texto(ctx, "10:02", bx + bw - 86, byy + bh2 - 16, { fam: "t", tam: 20, peso: 600, cor: "rgba(10,10,10,0.6)", alinhar: "dir" });
        icone(ctx, "check", bx + bw - 78, byy + bh2 - 36, 22, C.preto, { lw: 2.6 });
        icone(ctx, "check", bx + bw - 66, byy + bh2 - 36, 22, C.preto, { lw: 2.6 });
        ctx.restore();

        // digitando… e resposta (à esquerda)
        const yr = byy + bh2 + 26;
        if (t >= K.digitandoA && t < K.msgRecebida) {
          ctx.fillStyle = C.borda;
          corte(ctx, x + 36, yr, 130, 64, 14);
          ctx.fill();
          for (let i = 0; i < 3; i++) {
            const pul = Math.max(0, Math.sin((t - K.digitandoA) * 9 - i * 0.9));
            ctx.beginPath();
            ctx.arc(x + 36 + 38 + i * 27, yr + 34 - pul * 8, 7, 0, Math.PI * 2);
            ctx.fillStyle = C.texto2;
            ctx.fill();
          }
        }
        const pr = prog(t, K.msgRecebida, K.msgRecebida + 0.3);
        if (pr > 0) {
          const or = { fam: "t", tam: 30, peso: 600, cor: C.branco };
          const rw = medir(ctx, RESPOSTA, or) + 56;
          ctx.save();
          ctx.globalAlpha *= clamp(pr * 3);
          const e2 = E.outBack(pr);
          ctx.translate(x + 36, yr + 80);
          ctx.scale(e2, e2);
          ctx.translate(-x - 36, -yr - 80);
          corte(ctx, x + 36, yr, rw, 80, 16);
          ctx.fillStyle = C.borda;
          ctx.fill();
          texto(ctx, RESPOSTA, x + 64, yr + 51, or);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // VENDA FECHADA
    const pv = prog(t, K.vendaFechada, K.vendaFechada + 0.2);
    if (pv > 0) {
      const cx = W / 2, cy = 1225;
      // confete
      const tc = t - K.vendaFechada;
      if (tc < 2.2) {
        CONFETE.forEach((c) => {
          const px = cx + Math.cos(c.a) * c.v * tc;
          const py = cy + Math.sin(c.a) * c.v * tc + 1400 * tc * tc;
          ctx.save();
          ctx.globalAlpha *= clamp(1 - tc / 2.2);
          ctx.translate(px, py);
          ctx.rotate(c.rot + c.vr * tc);
          ctx.fillStyle = c.cor;
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.restore();
        });
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.07);
      const esc = lerp(2.4, 1, E.outCubic(pv));
      ctx.scale(esc, esc);
      ctx.globalAlpha *= clamp(pv * 2);
      const o = { tam: 76, peso: 700, italico: true, esp: 0.02 };
      const ws = medir(ctx, "VENDA FECHADA", o);
      const bw = ws + 150, bh = 150;
      ctx.fillStyle = "rgba(10,10,10,0.92)";
      corte(ctx, -bw / 2, -bh / 2, bw, bh, 24);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.amarelo;
      ctx.stroke();
      icone(ctx, "check", -bw / 2 + 34, -30, 60, C.amarelo, { lw: 3.2 });
      texto(ctx, "VENDA FECHADA", -bw / 2 + 112, 27, { ...o, cor: C.amarelo });
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------
  // Cena 7 — e tem mais (30 a 34 s)
  // ---------------------------------------------------------------
  const EXTRAS = [
    { ic: "funil", t: "Funil de leads", d: "Anotações e em que pé está cada conversa." },
    { ic: "calendario", t: "Lembrete de retorno", d: "O sino avisa no dia de chamar de novo." },
    { ic: "trofeu", t: "Rank do mês", d: "Venda verificada vira pontos e prêmio." },
    { ic: "chat", t: "Comunidade", d: "Troque ideia com outros web designers." },
  ];

  function cenaExtras(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 950, r: 800, a: 0.05 });
    cabecalho(ctx, t, 30.02, "E TEM MAIS", "Tudo num lugar só", null);
    EXTRAS.forEach((it, i) => {
      const t0 = K.extras[i];
      const q = prog(t, t0 - 0.1, t0 + 0.35);
      if (q <= 0) return;
      const y = 540 + i * 212, x = 110, w = 860, h = 184;
      ctx.save();
      ctx.globalAlpha *= clamp(q * 2.5);
      ctx.translate((1 - E.outExpo(q)) * -700, 0);
      cartao(ctx, x, y, w, h);
      const ib = 116;
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.amarelo;
      corte(ctx, x + 34, y + (h - ib) / 2, ib, ib, 16);
      ctx.fillStyle = C.amareloSuave;
      ctx.fill();
      ctx.stroke();
      icone(ctx, it.ic, x + 34 + (ib - 64) / 2, y + (h - 64) / 2, 64, C.amarelo, { lw: 2 });
      texto(ctx, it.t, x + 184, y + 82, { fam: "t", tam: 42, peso: 800 });
      texto(ctx, it.d, x + 184, y + 132, caber(ctx, it.d, { fam: "t", tam: 29, peso: 400, cor: C.texto2 }, 640));
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------
  // Cena 8 — chamada final (34 a 40 s)
  // ---------------------------------------------------------------
  function cenaCta(ctx, t) {
    fundo(ctx, t, { x: W / 2, y: 560, r: 700, a: 0.08 });
    const [sx, sy] = tremor(t, K.ctaTitulo[1], 14);
    ctx.save();
    ctx.translate(sx, sy);

    const pm = prog(t, K.mascoteCta, K.mascoteCta + 0.5);
    if (pm > 0) {
      const e = E.outBack(pm);
      const bob = Math.sin((t - K.mascoteCta) * 2.6) * 10;
      ctx.save();
      ctx.translate(W / 2, 560 + bob);
      ctx.scale(e, e);
      mascote(ctx, AP.IMG.mascote, 0, 0, 470, { fit: 0.9, dy: 0.02, anel: prog(t, K.mascoteCta + 0.3, K.mascoteCta + 0.7) });
      ctx.restore();
    }

    const oT = { tam: 150, peso: 700, italico: true };
    palavras(ctx, [{ s: "COMECE", t: K.ctaTitulo[0] }], W / 2, 1000, oT, t);
    palavras(ctx, [{ s: "GRÁTIS", t: K.ctaTitulo[1], cor: C.amarelo }], W / 2, 1150, { ...oT, tam: 190 }, t);

    const ps = prog(t, K.ctaSub, K.ctaSub + 0.4);
    if (ps > 0) {
      ctx.save();
      ctx.globalAlpha *= ps;
      ctx.translate(0, (1 - E.outCubic(ps)) * 30);
      texto(ctx, "3 buscas + 5 desbloqueios. Sem cartão.", W / 2, 1230, caber(ctx, "3 buscas + 5 desbloqueios. Sem cartão.", { fam: "t", tam: 38, peso: 600, cor: C.campo, alinhar: "centro" }, 860));
      ctx.restore();
    }

    const pb = prog(t, K.ctaBotao, K.ctaBotao + 0.4);
    if (pb > 0) {
      const pulso = t > K.ctaBotao + 0.5 ? 1 + Math.sin((t - K.ctaBotao) * 5) * 0.015 : 1;
      const aperto = t >= K.ctaToque && t < K.ctaToque + 0.14 ? 0.95 : 1;
      const e = E.outBack(pb) * pulso * aperto;
      ctx.save();
      ctx.translate(W / 2, 1335);
      ctx.scale(e, e);
      botaoPrimario(ctx, -380, -62, 760, 124, "CRIAR CONTA GRÁTIS", 42, { icone: "seta" });
      ctx.restore();
      toque(ctx, W / 2 + 180, 1335, t, K.ctaToque);
    }

    const pu = prog(t, K.ctaBotao + 0.3, K.ctaBotao + 0.7);
    if (pu > 0) {
      ctx.save();
      ctx.globalAlpha *= pu;
      texto(ctx, "artemisprospect.com.br", W / 2, 1462, { tam: 40, peso: 600, esp: 0.04, cor: C.branco, alinhar: "centro" });
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // Montagem do quadro
  // ---------------------------------------------------------------
  const FUNCOES = {
    gancho: cenaGancho,
    problema: cenaProblema,
    logo: cenaLogo,
    busca: cenaBusca,
    lista: cenaLista,
    whats: cenaWhats,
    extras: cenaExtras,
    cta: cenaCta,
  };

  function cenaEm(t) {
    for (let i = AP.CENAS.length - 1; i >= 0; i--) if (t >= AP.CENAS[i].a) return i;
    return 0;
  }

  function pintarCena(ctx, i, t) {
    ctx.save();
    FUNCOES[AP.CENAS[i].id](ctx, t);
    ctx.restore();
  }

  // Cortina diagonal com faixa amarela na frente.
  function wipe(ctx, t, tr, iAnt, iNova) {
    const m = AP.MEIA_TRANSICAO;
    const p = E.inOutCubic(prog(t, tr.t - m, tr.t + m));
    pintarCena(ctx, iAnt, t);
    const inc = 260, faixa = 34;
    // borda: x no topo e na base; dir 1 = da direita para a esquerda
    const X = tr.dir > 0 ? lerp(W + inc + faixa, -inc - faixa, p) : lerp(-inc - faixa, W + inc + faixa, p);
    const topo = X + inc, base = X - inc;
    ctx.save();
    ctx.beginPath();
    if (tr.dir > 0) {
      ctx.moveTo(topo, 0); ctx.lineTo(W + 600, 0); ctx.lineTo(W + 600, H); ctx.lineTo(base, H);
    } else {
      ctx.moveTo(topo, 0); ctx.lineTo(-600, 0); ctx.lineTo(-600, H); ctx.lineTo(base, H);
    }
    ctx.closePath();
    ctx.clip();
    pintarCena(ctx, iNova, t);
    ctx.restore();
    // faixa amarela na borda
    const d = tr.dir > 0 ? -faixa : faixa;
    ctx.beginPath();
    ctx.moveTo(topo, 0);
    ctx.lineTo(topo + d, 0);
    ctx.lineTo(base + d, H);
    ctx.lineTo(base, H);
    ctx.closePath();
    ctx.fillStyle = C.amarelo;
    ctx.fill();
  }

  AP.desenhar = function (ctx, t) {
    t = clamp(t, 0, AP.DURACAO - 1e-6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const m = AP.MEIA_TRANSICAO;
    const tr = AP.TRANSICOES.find((x) => x.tipo === "wipe" && Math.abs(t - x.t) < m);
    if (tr) {
      const iNova = cenaEm(tr.t);
      wipe(ctx, t, tr, iNova - 1, iNova);
    } else {
      pintarCena(ctx, cenaEm(t), t);
    }
    vinheta(ctx);
    moldura(ctx, t);
    grao(ctx, t);
    const pf = prog(t, AP.DURACAO - 0.6, AP.DURACAO);
    if (pf > 0) {
      ctx.fillStyle = `rgba(10,10,10,${pf})`;
      ctx.fillRect(0, 0, W, H);
    }
  };
})();
