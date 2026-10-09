// Gera a trilha e os efeitos sonoros do vídeo do zero, só com matemática
// (osciladores, ruído e filtros). Nada é baixado da internet, então não há
// problema de direitos autorais.
//
// Uso:  npm run gerar-sons
//
// A música acompanha as durações das cenas do src/config.ts. Se você mudar
// as durações, rode o comando de novo para a música mudar junto.
// Saída: public/audio/gerado/ (musica.mp3 e os efeitos em .wav).

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "public", "audio", "gerado");
const TAXA = 44100;

// ------------------------------------------------------------
// Durações das cenas (lidas do src/config.ts)
// ------------------------------------------------------------
const config = readFileSync(join(RAIZ, "src", "config.ts"), "utf8");
const lerDuracao = (nome) => {
  const achou = config.match(new RegExp(`\\b${nome}:\\s*([0-9.]+)`));
  if (!achou) throw new Error(`Não achei a duração "${nome}" em src/config.ts`);
  return Number(achou[1]);
};
const NOMES = ["pinos", "dificil", "busca", "leads", "artemis", "comenta"];
const CENA = {};
{
  let t = 0;
  for (const n of NOMES) {
    const d = lerDuracao(n);
    CENA[n] = { de: t, ate: t + d };
    t += d;
  }
}
const TOTAL = CENA.comenta.ate;

// ------------------------------------------------------------
// Ferramentas de som
// ------------------------------------------------------------
// Sorteio com semente: o som sai igual toda vez que você gerar.
let semente = 7;
const sorteio = () => {
  semente = (semente * 1664525 + 1013904223) >>> 0;
  return semente / 4294967296;
};
const ruido = () => sorteio() * 2 - 1;
const PI2 = Math.PI * 2;
const nota = (n) => 440 * Math.pow(2, (n - 69) / 12); // número MIDI -> Hz

const novoBuffer = (segundos) => ({
  e: new Float32Array(Math.ceil(segundos * TAXA)),
  d: new Float32Array(Math.ceil(segundos * TAXA)),
});

// Soma um som mono (array) no buffer estéreo, a partir de "t" segundos.
const mixar = (buf, som, t, ganho = 1, pan = 0) => {
  const i0 = Math.round(t * TAXA);
  const ge = ganho * Math.cos(((pan + 1) * Math.PI) / 4);
  const gd = ganho * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < som.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= buf.e.length) continue;
    buf.e[j] += som[i] * ge;
    buf.d[j] += som[i] * gd;
  }
};

// Filtro "biquad" (passa-baixa, passa-alta ou passa-faixa), com a
// frequência de corte podendo mudar ao longo do som.
const filtro = (som, tipo, corte, q = 0.7) => {
  const saida = new Float32Array(som.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2;
  const calcula = (f) => {
    const w = (PI2 * Math.min(Math.max(f, 20), TAXA * 0.45)) / TAXA;
    const alfa = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alfa;
    if (tipo === "baixa") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (tipo === "alta") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [alfa, 0, -alfa];
    [b0, b1, b2, a1, a2] = [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - alfa) / a0];
  };
  for (let i = 0; i < som.length; i++) {
    if (i % 32 === 0) calcula(typeof corte === "function" ? corte(i / TAXA) : corte);
    const y = b0 * som[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = som[i]; y2 = y1; y1 = y;
    saida[i] = y;
  }
  return saida;
};

// Cria um som de "segundos" de duração a partir de uma função do tempo.
const gerar = (segundos, f) => {
  const som = new Float32Array(Math.ceil(segundos * TAXA));
  for (let i = 0; i < som.length; i++) som[i] = f(i / TAXA, i);
  return som;
};

// Oscilador com frequência variável (mantém a fase contínua).
const oscilador = (segundos, freq, forma = "seno") => {
  let fase = 0;
  return gerar(segundos, (t) => {
    fase += (typeof freq === "function" ? freq(t) : freq) / TAXA;
    fase -= Math.floor(fase);
    if (forma === "serra") return 2 * fase - 1;
    if (forma === "quadrada") return fase < 0.5 ? 1 : -1;
    if (forma === "triangulo") return 1 - 4 * Math.abs(fase - 0.5);
    return Math.sin(PI2 * fase);
  });
};

const vezes = (a, f) => a.map((v, i) => v * f(i / TAXA, i));
const somar = (...sons) => {
  const n = Math.max(...sons.map((s) => s.length));
  const r = new Float32Array(n);
  for (const s of sons) for (let i = 0; i < s.length; i++) r[i] += s[i];
  return r;
};
const ganho = (som, g) => som.map((v) => v * g);
// Envelope: sobe em "ataque" segundos e cai exponencialmente.
const env = (ataque, queda) => (t) => (t < ataque ? t / ataque : Math.exp(-(t - ataque) / queda));
const ruidoBranco = (segundos) => gerar(segundos, ruido);

// Reverb simples (Schroeder): dá a sensação de "sala".
const reverb = (som, tamanho = 1, mistura = 0.25) => {
  const combs = [1557, 1617, 1491, 1422].map((n) => Math.round(n * tamanho));
  const saida = new Float32Array(som.length + TAXA);
  const entrada = new Float32Array(saida.length);
  entrada.set(som);
  const molhado = new Float32Array(saida.length);
  for (const atraso of combs) {
    const linha = new Float32Array(atraso);
    let p = 0, lp = 0;
    for (let i = 0; i < entrada.length; i++) {
      const y = linha[p];
      lp = y * 0.8 + lp * 0.2;
      linha[p] = entrada[i] + lp * 0.84;
      p = (p + 1) % atraso;
      molhado[i] += y / combs.length;
    }
  }
  for (const atraso of [225, 556]) {
    const linha = new Float32Array(atraso);
    let p = 0;
    for (let i = 0; i < molhado.length; i++) {
      const b = linha[p];
      const y = -molhado[i] + b;
      linha[p] = molhado[i] + b * 0.5;
      p = (p + 1) % atraso;
      molhado[i] = y;
    }
  }
  for (let i = 0; i < saida.length; i++) saida[i] = entrada[i] * (1 - mistura) + molhado[i] * mistura;
  return saida;
};

// ------------------------------------------------------------
// Arquivos
// ------------------------------------------------------------
const wav = (canais) => {
  const n = canais[0].length;
  const b = Buffer.alloc(44 + n * 2 * canais.length);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2 * canais.length, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(canais.length, 22);
  b.writeUInt32LE(TAXA, 24); b.writeUInt32LE(TAXA * 2 * canais.length, 28); b.writeUInt16LE(2 * canais.length, 32);
  b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2 * canais.length, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (const c of canais) {
      b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, c[i])) * 32767), o);
      o += 2;
    }
  return b;
};

// Deixa o pico em "alvo" (0 a 1) e suaviza os últimos milissegundos.
const normalizar = (canais, alvo) => {
  let pico = 0;
  for (const c of canais) for (const v of c) pico = Math.max(pico, Math.abs(v));
  const g = pico > 0 ? alvo / pico : 1;
  const fim = Math.round(0.005 * TAXA);
  for (const c of canais)
    for (let i = 0; i < c.length; i++) c[i] *= g * Math.min(1, (c.length - 1 - i) / fim);
  return canais;
};

const salvarEfeito = (nome, som, alvo = 0.8) => {
  writeFileSync(join(SAIDA, `${nome}.wav`), wav(normalizar([som], alvo)));
  console.log(`  efeito: ${nome}.wav (${(som.length / TAXA).toFixed(2)}s)`);
};

// ------------------------------------------------------------
// Efeitos sonoros
// ------------------------------------------------------------
const efeitos = () => {
  // Pino caindo: assobio que desce.
  {
    const d = 0.38;
    const sopro = vezes(filtro(ruidoBranco(d), "faixa", (t) => 3200 - (t / d) * 2600, 2.5), (t) => Math.sin((Math.PI * t) / d) ** 2);
    const tom = vezes(oscilador(d, (t) => 1100 - (t / d) * 800), (t) => 0.25 * Math.sin((Math.PI * t) / d));
    salvarEfeito("queda", somar(sopro, tom), 0.7);
  }
  // Impacto: "tum" grave com estalo.
  {
    const d = 0.9;
    const tum = vezes(oscilador(d, (t) => 40 + 90 * Math.exp(-t / 0.05)), env(0.002, 0.22));
    const estalo = vezes(filtro(ruidoBranco(0.05), "baixa", 2500), env(0.001, 0.012));
    salvarEfeito("impacto", somar(tum, ganho(estalo, 0.6)), 0.95);
  }
  // Sonar: o pino pulsando.
  {
    const ping = vezes(somar(oscilador(1.2, 1320), ganho(oscilador(1.2, 2640), 0.2)), env(0.004, 0.18));
    salvarEfeito("sonar", reverb(ping, 1.2, 0.45), 0.6);
  }
  // Chuva de pinos: dezenas de estalinhos espalhados.
  {
    const buf = novoBuffer(1.6);
    for (let k = 0; k < 46; k++) {
      const t = Math.pow(sorteio(), 0.8) * 1.4;
      const f = 1400 + sorteio() * 2200;
      mixar(buf, vezes(oscilador(0.03, f), env(0.001, 0.006)), t, 0.4 + sorteio() * 0.5, sorteio() * 1.6 - 0.8);
    }
    const mono = buf.e.map((v, i) => (v + buf.d[i]) / 2);
    salvarEfeito("chuva", mono, 0.55);
  }
  // Corte seco: "fffp" curto com soco grave.
  {
    const d = 0.2;
    const sopro = vezes(filtro(ruidoBranco(d), "alta", 1500), (t) => (t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) / 0.04)));
    const soco = vezes(oscilador(d, (t) => 60 + 60 * Math.exp(-t / 0.03)), env(0.001, 0.05));
    salvarEfeito("corte", somar(ganho(sopro, 0.5), soco), 0.7);
  }
  // Mensagem enviada: "bloop" que sobe.
  salvarEfeito("enviar", vezes(oscilador(0.12, (t) => 520 + 3000 * t), env(0.005, 0.04)), 0.5);
  // Risco de caneta.
  {
    const d = 0.13;
    const r = vezes(filtro(ruidoBranco(d), "faixa", (t) => 2500 + 1500 * Math.sin(t * 90), 1.5), (t) =>
      Math.sin((Math.PI * t) / d) * (0.7 + 0.3 * Math.sin(t * 380)),
    );
    salvarEfeito("risco", r, 0.45);
  }
  // Brilho: arpejo rápido subindo (lá maior), quando algo "acende".
  {
    const buf = novoBuffer(1.4);
    [69, 73, 76, 81, 85].forEach((n, i) =>
      mixar(buf, vezes(oscilador(0.6, nota(n + 12), "triangulo"), env(0.003, 0.12)), i * 0.045, 0.5, i % 2 ? 0.4 : -0.4),
    );
    const mono = buf.e.map((v, i) => (v + buf.d[i]) / 2);
    salvarEfeito("brilho", reverb(mono, 1.1, 0.4), 0.55);
  }
  // Deslizar: sopro suave que sobe (cartões e cabeça entrando).
  {
    const d = 0.45;
    const s = vezes(filtro(ruidoBranco(d), "faixa", (t) => 400 + (t / d) * 2200, 1.8), (t) => Math.sin((Math.PI * t) / d) ** 2);
    salvarEfeito("deslizar", s, 0.4);
  }
  // Desbloquear: dois cliques + um tom curto.
  {
    const clique = vezes(filtro(ruidoBranco(0.02), "faixa", 3500, 3), env(0.0005, 0.004));
    const buf = novoBuffer(0.5);
    mixar(buf, clique, 0, 1);
    mixar(buf, clique, 0.06, 0.8);
    mixar(buf, vezes(oscilador(0.35, nota(88), "triangulo"), env(0.003, 0.08)), 0.1, 0.35);
    salvarEfeito("desbloquear", buf.e, 0.6);
  }
  // Ding de sino (botão de WhatsApp).
  {
    const f = nota(84);
    const sino = somar(
      vezes(oscilador(1.6, f), env(0.002, 0.45)),
      vezes(oscilador(1.6, f * 2.01), (t) => 0.4 * Math.exp(-t / 0.25)),
      vezes(oscilador(1.6, f * 3.02), (t) => 0.2 * Math.exp(-t / 0.12)),
    );
    salvarEfeito("ding", reverb(sino, 1, 0.3), 0.6);
  }
  // Trava da mira: "clac" metálico duplo.
  {
    const clac = somar(
      vezes(filtro(ruidoBranco(0.08), "faixa", 3000, 4), env(0.0005, 0.015)),
      vezes(oscilador(0.08, 1850, "quadrada"), (t) => 0.15 * Math.exp(-t / 0.01)),
      vezes(oscilador(0.12, 110), env(0.001, 0.03)),
    );
    const buf = novoBuffer(0.3);
    mixar(buf, clac, 0, 1);
    mixar(buf, clac, 0.07, 0.7);
    salvarEfeito("trava", buf.e, 0.65);
  }
  // Bolha: o balão de comentário aparecendo.
  salvarEfeito("bolha", vezes(oscilador(0.12, (t) => 300 + 7000 * t), env(0.003, 0.03)), 0.5);
  // Pop das etiquetas (só usado se public/audio/pop.mp3 estiver vazio).
  {
    const pop = somar(
      vezes(oscilador(0.12, (t) => 380 + 700 * Math.exp(-t / 0.015)), env(0.001, 0.035)),
      vezes(filtro(ruidoBranco(0.02), "alta", 3000), env(0.0005, 0.003)),
    );
    salvarEfeito("pop", pop, 0.7);
  }
};

// ------------------------------------------------------------
// Música (120 batidas por minuto, em lá menor)
// ------------------------------------------------------------
// Cenas 1 e 2: tensa (zumbido grave, relógio, pulso).
// Subida de tensão até a cena 3, onde entra a batida.
// Cenas 3 e 4: groove calmo; na 4 entra um arpejo.
// Cena 5: tudo junto, mais brilhante. Cena 6: acorde final que se apaga.
const musica = () => {
  const BATIDA = 0.5;
  const buf = novoBuffer(TOTAL + 2);
  const sala = novoBuffer(TOTAL + 2); // o que vai para o reverb
  const eco = novoBuffer(TOTAL + 2); // o que vai para o eco (arpejo)
  const naCena = (t, ...nomes) => nomes.some((n) => t >= CENA[n].de && t < CENA[n].ate);
  const inicioGroove = CENA.busca.de;
  const inicioFinal = CENA.comenta.de;

  // Instrumentos
  const bumbo = vezes(oscilador(0.4, (t) => 45 + 110 * Math.exp(-t / 0.035)), env(0.001, 0.12));
  const palma = (() => {
    const b = novoBuffer(0.3);
    const rajada = vezes(filtro(ruidoBranco(0.25), "faixa", 1400, 1.2), env(0.001, 0.06));
    [0, 0.011, 0.022].forEach((t) => mixar(b, rajada, t, 0.6));
    return b.e;
  })();
  const chimbal = vezes(filtro(ruidoBranco(0.06), "alta", 7000), env(0.001, 0.015));
  const tique = vezes(somar(oscilador(0.03, 2400), ganho(filtro(ruidoBranco(0.03), "alta", 5000), 0.5)), env(0.0005, 0.006));
  const baixo = (freq, d) => {
    const s = somar(oscilador(d, freq, "serra"), ganho(oscilador(d, freq / 2), 0.8));
    return vezes(filtro(s, "baixa", (t) => 250 + 500 * Math.exp(-t / 0.08)), (t) =>
      Math.min(1, t / 0.005) * Math.min(1, (d - t) / 0.03),
    );
  };
  const pad = (freqs, d, brilho) => {
    const s = somar(
      ...freqs.flatMap((f) => [
        oscilador(d, f * 0.997, "serra"),
        oscilador(d, f * 1.003, "serra"),
      ]),
    );
    return vezes(filtro(s, "baixa", brilho), (t) => Math.min(1, t / 0.25) * Math.min(1, (d - t) / 0.4) * 0.12);
  };
  const pluck = (freq) =>
    vezes(filtro(oscilador(0.3, freq, "quadrada"), "baixa", (t) => 600 + 3500 * Math.exp(-t / 0.05)), env(0.002, 0.09));

  // Lá menor - Fá - Dó - Sol (um acorde por compasso de 2 segundos).
  const ACORDES = [
    { baixo: 45, pad: [57, 60, 64], arpejo: [69, 72, 76, 81] },
    { baixo: 41, pad: [53, 57, 60], arpejo: [65, 69, 72, 77] },
    { baixo: 48, pad: [55, 60, 64], arpejo: [67, 72, 76, 79] },
    { baixo: 43, pad: [55, 59, 62], arpejo: [67, 71, 74, 79] },
  ];
  const acordeEm = (t) => ACORDES[Math.floor((t - inicioGroove) / (BATIDA * 4)) & 3];

  // --- Parte tensa (cenas 1 e 2) ---
  {
    const d = inicioGroove;
    const zumbido = vezes(
      somar(oscilador(d, nota(33)), ganho(oscilador(d, nota(45) * 1.002, "serra"), 0.15)),
      (t) => Math.min(1, t / 0.6) * 0.5,
    );
    mixar(buf, filtro(zumbido, "baixa", (t) => 300 + 900 * (t / d)), 0, 0.9);
    // Ruído de "ar" subindo até a virada.
    const ar = vezes(filtro(ruidoBranco(d), "faixa", (t) => 500 + 4000 * (t / d) ** 2, 1.2), (t) => 0.05 + 0.25 * (t / d) ** 3);
    mixar(buf, ar, 0, 0.6);
    for (let t = 0; t < d - 0.01; t += BATIDA / 2) {
      mixar(buf, tique, t, (t / BATIDA) % 2 === 0 ? 0.35 : 0.18, 0.3);
      // Pulso grave em colcheias, ficando mais forte.
      mixar(buf, baixo(nota(33), 0.2), t, 0.25 + 0.35 * (t / d));
    }
    // Batida de "coração" nas cenas 1 e 2.
    for (let t = 0; t < d - 0.01; t += BATIDA * 2) mixar(buf, bumbo, t, 0.55);
    // Virada: tom subindo no último segundo e meio.
    const v = 1.5;
    const virada = vezes(oscilador(v, (t) => 200 * Math.pow(6, t / v), "serra"), (t) => (t / v) ** 2 * 0.15);
    mixar(buf, filtro(virada, "baixa", 2500), d - v, 0.8);
    mixar(sala, virada, d - v, 0.3);
  }

  // --- Groove (cenas 3, 4 e 5) ---
  for (let t = inicioGroove; t < inicioFinal - 0.001; t += BATIDA / 2) {
    const k = Math.round((t - inicioGroove) / (BATIDA / 2)); // colcheia número k
    const acorde = acordeEm(t);
    const cheio = naCena(t, "artemis");
    if (k % 2 === 0) mixar(buf, bumbo, t, 0.9);
    if (k % 4 === 2) {
      mixar(buf, palma, t, naCena(t, "busca") ? 0.25 : 0.4);
      mixar(sala, palma, t, 0.3);
    }
    mixar(buf, chimbal, t, k % 2 ? 0.2 : 0.08, 0.25);
    if (cheio) mixar(buf, chimbal, t + BATIDA / 4, 0.07, -0.25);
    // Baixo: a nota do acorde em colcheias, com a primeira mais forte.
    mixar(buf, baixo(nota(acorde.baixo), BATIDA / 2 - 0.02), t, k % 8 === 0 ? 0.55 : 0.4);
    // Arpejo (semicolcheias) a partir da cena 4.
    if (naCena(t, "leads", "artemis"))
      for (let s = 0; s < 2; s++) {
        const n = acorde.arpejo[(k * 2 + s) % 4] + (cheio ? 12 : 0);
        const p = pluck(nota(n));
        mixar(buf, p, t + s * (BATIDA / 4), 0.14, (k + s) % 2 ? 0.35 : -0.35);
        mixar(eco, p, t + s * (BATIDA / 4), 0.1);
      }
  }
  // Pad: um acorde por compasso.
  for (let t = inicioGroove; t < inicioFinal - 0.001; t += BATIDA * 4) {
    const d = Math.min(BATIDA * 4, inicioFinal - t) + 0.3;
    const p = pad(acordeEm(t).pad.map(nota), d, naCena(t, "artemis") ? 2600 : 1400);
    mixar(buf, p, t, 0.6, -0.15);
    mixar(sala, p, t, 0.5);
  }

  // --- Final (cena 6) ---
  {
    const d = TOTAL - inicioFinal + 1.5;
    const pancada = somar(
      vezes(oscilador(1.2, (t) => 40 + 80 * Math.exp(-t / 0.06)), env(0.002, 0.4)),
      // Prato: ruído filtrado, baixinho, para não ficar estridente.
      ganho(vezes(filtro(filtro(ruidoBranco(2), "alta", 3000), "baixa", 8000), env(0.002, 0.35)), 0.3),
    );
    mixar(buf, pancada, inicioFinal, 0.8);
    mixar(sala, pancada, inicioFinal, 0.4);
    const acordeFinal = vezes(pad([57, 60, 64, 69].map(nota), d, 2200), (t) => Math.exp(-t / 1.4) * 1.5);
    mixar(buf, acordeFinal, inicioFinal, 0.8);
    mixar(sala, acordeFinal, inicioFinal, 0.6);
    mixar(buf, baixo(nota(33), 1.2), inicioFinal, 0.6);
    for (let t = inicioFinal; t < TOTAL - 0.2; t += BATIDA / 2) mixar(buf, tique, t, 0.15, -0.3);
  }

  // Efeitos de estúdio: reverb na "sala" e eco no arpejo.
  for (const lado of ["e", "d"]) {
    const r = reverb(sala[lado], lado === "e" ? 1.3 : 1.36, 1);
    for (let i = 0; i < buf[lado].length; i++) buf[lado][i] += r[i] * 0.35;
    const atraso = Math.round((lado === "e" ? 0.375 : 0.5) * TAXA);
    const ecoLado = new Float32Array(buf[lado].length);
    for (let i = 0; i < ecoLado.length; i++) ecoLado[i] = eco[lado][i] + (i >= atraso ? ecoLado[i - atraso] * 0.35 : 0);
    for (let i = 0; i < buf[lado].length; i++) buf[lado][i] += ecoLado[i] * 0.5;
  }

  // Corta no tamanho do vídeo, com um "limitador" suave para não estourar.
  const n = Math.round(TOTAL * TAXA);
  const canais = [buf.e.slice(0, n), buf.d.slice(0, n)];
  let pico = 0;
  for (const c of canais) for (const v of c) pico = Math.max(pico, Math.abs(v));
  for (const c of canais) for (let i = 0; i < n; i++) c[i] = Math.tanh((c[i] / pico) * 1.4);
  normalizar(canais, 0.89);

  const temp = join(SAIDA, "musica.tmp.wav");
  writeFileSync(temp, wav(canais));
  // Converte para MP3 com o ffmpeg que já vem com o Remotion.
  execFileSync("npx", ["remotion", "ffmpeg", "-v", "error", "-y", "-i", temp, "-c:a", "libmp3lame", "-b:a", "192k", join(SAIDA, "musica.mp3")], {
    cwd: RAIZ,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  rmSync(temp);
  console.log(`  música: musica.mp3 (${TOTAL.toFixed(1)}s)`);
};

mkdirSync(SAIDA, { recursive: true });
console.log(`Gerando sons em public/audio/gerado (vídeo de ${TOTAL}s)...`);
efeitos();
musica();
console.log("Pronto.");
