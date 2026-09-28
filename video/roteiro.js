/* Ártemis Prospect — vídeo de apresentação 9:16 (Reels e TikTok).
 *
 * Roteiro: a linha do tempo de todo o vídeo, em segundos. As cenas
 * (cenas.js) e o som (som.js) leem os mesmos números daqui, então a
 * imagem e os efeitos sonoros ficam sempre sincronizados.
 *
 * Música a 120 BPM: 1 batida = 0,5 s e 1 compasso = 2 s. As trocas de
 * cena caem sempre no começo de um compasso.
 */
(function () {
  "use strict";

  const AP = (window.AP = window.AP || {});

  AP.W = 1080;
  AP.H = 1920;
  AP.FPS = 30;
  AP.DURACAO = 40;
  AP.BPM = 120;

  // Cenas: [início, fim) em segundos.
  AP.CENAS = [
    { id: "gancho", a: 0, b: 4 }, // "Você faz sites? Mas cadê os clientes?"
    { id: "problema", a: 4, b: 8 }, // mapa: negócios perto de você sem site
    { id: "logo", a: 8, b: 12 }, // revelação da marca
    { id: "busca", a: 12, b: 18 }, // passo 1: busque por nicho e bairro
    { id: "lista", a: 18, b: 24 }, // passo 2: veja quem precisa de site
    { id: "whats", a: 24, b: 30 }, // passo 3: chame no WhatsApp
    { id: "extras", a: 30, b: 34 }, // e tem mais
    { id: "cta", a: 34, b: 40 }, // comece grátis
  ];

  // Transições entre cenas. "wipe" = cortina diagonal com faixa amarela;
  // "corte" = corte seco (a cena anterior já termina no preto).
  AP.TRANSICOES = [
    { t: 4, tipo: "wipe", dir: 1 },
    { t: 8, tipo: "corte" },
    { t: 12, tipo: "wipe", dir: -1 },
    { t: 18, tipo: "wipe", dir: 1 },
    { t: 24, tipo: "wipe", dir: -1 },
    { t: 30, tipo: "wipe", dir: 1 },
    { t: 34, tipo: "wipe", dir: -1 },
  ];
  AP.MEIA_TRANSICAO = 0.22;

  // Gerador de números "aleatórios" com semente: o mesmo número sempre
  // devolve a mesma sequência (mulberry32).
  AP.rng = function (semente) {
    let s = semente >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Horário de cada tecla digitada, com um ritmo levemente irregular
  // (parece gente digitando, não máquina).
  function digitacao(texto, t0, t1, semente) {
    const r = AP.rng(semente);
    const n = texto.length;
    const passo = (t1 - t0) / Math.max(1, n - 1);
    const tempos = [];
    for (let i = 0; i < n; i++) {
      const jitter = i === 0 || i === n - 1 ? 0 : (r() - 0.5) * passo * 0.7;
      tempos.push(t0 + passo * i + jitter);
    }
    return tempos;
  }

  // Momentos-chave (tempo absoluto, em segundos).
  const K = (AP.K = {
    // Cena 1
    rotulo1: -0.5, // já aparece inteiro no primeiro quadro
    palavrasA: [-0.12, 0.25, 0.5], // "VOCÊ" já está na tela no quadro 0
    saidaA: 1.85,
    palavrasB: [2.0, 2.25, 2.5],
    mascotePensando: 3.0,
    interrogacoes: [3.25, 3.5, 3.75],
    // Cena 2
    tituloProblema: [4.1, 4.35, 4.6],
    pinoInicio: 4.8,
    pinoPasso: 0.08,
    varreduraA: 5.9,
    varreduraB: 7.0,
    mergulho: 7.2,
    // Cena 3
    impacto: 8.0,
    tagline: [9.5, 9.75, 10.0],
    // Cena 4
    celularSobe: 12.0,
    toqueBuscar: 16.0,
    radarA: 16.1,
    radarB: 18.0,
    // Cena 5
    cartoes: [18.4, 18.75, 19.1, 19.45],
    miraA: 21.2,
    miraTrava: 21.8,
    // Cena 6
    toqueDesbloquear: 24.8,
    toqueWhats: 26.0,
    painelChat: 26.1,
    msgEnviada: 26.6,
    digitandoA: 27.1,
    msgRecebida: 27.9,
    vendaFechada: 28.6,
    // Cena 7
    extras: [30.25, 30.75, 31.25, 31.75],
    // Cena 8
    mascoteCta: 34.1,
    ctaTitulo: [35.0, 35.25],
    ctaSub: 35.5,
    ctaBotao: 36.0,
    ctaToque: 37.0,
    final: 38.0,
  });

  AP.TEXTOS = {
    nicho: "barbearia, pousada, manicure",
    regiao: "Palhoça SC",
  };
  AP.DIG = {
    nicho: digitacao(AP.TEXTOS.nicho, 12.8, 14.3, 7),
    regiao: digitacao(AP.TEXTOS.regiao, 14.6, 15.3, 11),
  };

  // Mapa da cena 2 (coordenadas dentro do mapa). s = "sem site".
  AP.MAPA = { x: 110, y: 700, w: 860, h: 740 };
  AP.PINOS = [
    { x: 130, y: 170, s: 1 },
    { x: 310, y: 110, s: 0 },
    { x: 530, y: 200, s: 1, tag: 1 },
    { x: 730, y: 130, s: 0 },
    { x: 200, y: 370, s: 0 },
    { x: 420, y: 330, s: 1 },
    { x: 650, y: 400, s: 1 },
    { x: 790, y: 300, s: 0 },
    { x: 160, y: 580, s: 1, tag: 1 },
    { x: 390, y: 560, s: 0 },
    { x: 570, y: 620, s: 1 },
    { x: 760, y: 590, s: 1, tag: 1 },
  ];
  AP.PINO_ALVO = 6; // o mapa mergulha neste pino antes da logo
  AP.tempoPino = (i) => K.pinoInicio + i * K.pinoPasso;
  AP.tempoConversao = (i) =>
    K.varreduraA + ((K.varreduraB - K.varreduraA) * AP.PINOS[i].y) / AP.MAPA.h;

  // Radar da cena 4: pontinhos que aparecem durante a busca.
  AP.BLIPS = [
    { a: 0.6, r: 0.55, t: 16.45 },
    { a: 2.2, r: 0.8, t: 16.7 },
    { a: 3.6, r: 0.4, t: 16.95 },
    { a: 4.7, r: 0.7, t: 17.2 },
    { a: 5.6, r: 0.5, t: 17.4 },
    { a: 1.4, r: 0.9, t: 17.6 },
  ];

  // Lista de efeitos sonoros (tempo absoluto). O som.js toca um por um.
  AP.efeitos = function () {
    const e = [];
    const add = (t, tipo, v = 1, extra = {}) => e.push({ t, tipo, v, ...extra });

    // Transições
    for (const tr of AP.TRANSICOES) {
      if (tr.tipo === "wipe") add(tr.t - AP.MEIA_TRANSICAO, "whoosh", 0.9, { dir: tr.dir });
    }

    // Cena 1
    add(K.palavrasA[0], "pop", 0.7, { f: 520 });
    add(K.palavrasA[1], "pop", 0.7, { f: 620 });
    add(K.palavrasA[2], "slam", 1);
    add(0.85, "whooshCurto", 0.5);
    add(K.saidaA, "whooshCurto", 0.6);
    add(K.palavrasB[0], "pop", 0.7, { f: 520 });
    add(K.palavrasB[1], "pop", 0.7, { f: 620 });
    add(K.palavrasB[2], "slam", 1);
    add(K.mascotePensando, "bolha", 0.9);
    K.interrogacoes.forEach((t, i) => add(t, "pop", 0.45, { f: 900 + i * 180 }));

    // Cena 2
    K.tituloProblema.forEach((t, i) => add(t, i === 2 ? "slam" : "pop", i === 2 ? 0.9 : 0.6, { f: 560 + i * 90 }));
    AP.PINOS.forEach((_, i) => add(AP.tempoPino(i), "pino", 0.35, { f: 700 + (i % 4) * 110 }));
    add(K.varreduraA, "varredura", 0.6, { dur: K.varreduraB - K.varreduraA });
    AP.PINOS.forEach((p, i) => {
      if (p.s) add(AP.tempoConversao(i), "blip", 0.55, { f: 1400 + (i % 3) * 200 });
    });
    add(6.3, "riser", 1, { dur: 8.0 - 6.3 });

    // Cena 3
    add(K.impacto, "impacto", 1);
    add(8.05, "clack", 0.7);
    add(8.45, "brilho", 0.6);
    add(8.55, "whooshCurto", 0.45);
    K.tagline.forEach((t, i) => add(t, i === 2 ? "slam" : "pop", i === 2 ? 0.8 : 0.55, { f: 600 + i * 80 }));

    // Cena 4
    add(K.celularSobe, "whooshCurto", 0.6);
    AP.DIG.nicho.forEach((t) => add(t, "tecla", 0.5));
    AP.DIG.regiao.forEach((t) => add(t, "tecla", 0.5));
    add(K.toqueBuscar, "clique", 1);
    for (let t = K.radarA + 0.1; t < K.radarB - 0.2; t += 0.5) add(t, "sonar", 0.45);
    AP.BLIPS.forEach((b, i) => add(b.t, "blip", 0.45, { f: 1200 + i * 120 }));

    // Cena 5
    K.cartoes.forEach((t, i) => add(t, "whooshCurto", 0.5, { f: i }));
    K.cartoes.forEach((t, i) => add(t + 0.55, "pop", 0.5, { f: 700 + i * 120 }));
    add(K.miraA, "whooshCurto", 0.6);
    add(K.miraTrava, "trava", 0.9);

    // Cena 6
    add(K.toqueDesbloquear, "clique", 1);
    add(K.toqueDesbloquear + 0.12, "cadeado", 0.9);
    add(K.toqueDesbloquear + 0.35, "brilho", 0.5);
    add(K.toqueWhats, "clique", 1);
    add(K.painelChat, "whooshCurto", 0.6);
    add(K.msgEnviada, "enviada", 0.9);
    add(K.msgRecebida, "recebida", 0.9);
    add(K.vendaFechada, "slam", 1);
    add(K.vendaFechada + 0.05, "caixa", 1);

    // Cena 7
    K.extras.forEach((t, i) => add(t, "pop", 0.6, { f: 600 + i * 100 }));

    // Cena 8
    add(K.mascoteCta, "bolha", 0.9);
    add(K.ctaTitulo[0], "pop", 0.6, { f: 560 });
    add(K.ctaTitulo[1], "slam", 1);
    add(K.ctaSub, "whooshCurto", 0.35);
    add(K.ctaBotao, "pop", 0.7, { f: 820 });
    add(K.ctaToque, "clique", 1);

    return e.sort((a, b) => a.t - b.t);
  };
})();
