// Ártemis Prospect — exporta o vídeo em MP4 (H.264 + AAC), quadro a quadro.
//
// Abre video/index.html?render=1 num Chromium sem janela, pede cada um
// dos 1200 quadros (40 s × 30 fps) em PNG, gera o som em WAV e junta
// tudo com o ffmpeg. Como cada quadro é desenhado pelo seu tempo exato,
// o resultado é perfeito, sem travadas, mesmo em computador lento.
//
// Uso (na raiz do projeto):
//   npm i --no-save playwright-core ffmpeg-static
//   node video/render.mjs                 -> video/saida/artemis-prospect-reels.mp4 + capa.jpg
//   node video/render.mjs --previa 1,9.6  -> só os quadros desses segundos, em PNG
//   node video/render.mjs --servir        -> só abre o player (não precisa instalar nada)
//
// Variáveis opcionais: CHROME_PATH (caminho do Chrome/Chromium) e
// FFMPEG_PATH (caminho do ffmpeg).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SAIDA = path.join(AQUI, "saida");

const args = process.argv.slice(2);
const iPrevia = args.indexOf("--previa");
const previa = iPrevia >= 0 ? args[iPrevia + 1].split(",").map(Number) : null;

// ------------------------------------------------------------------
// Servidor local (as fontes e imagens precisam de http://, não file://)
// ------------------------------------------------------------------
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
const servidor = http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url.endsWith("/")) url += "index.html";
  const arq = path.join(RAIZ, url);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TIPOS[path.extname(arq)] || "application/octet-stream" });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(args.includes("--servir") ? 8787 : 0, "127.0.0.1", ok));
const porta = servidor.address().port;

// Só abrir o player no navegador: node video/render.mjs --servir
if (args.includes("--servir")) {
  console.log(`Abra no navegador: http://127.0.0.1:${porta}/video/`);
  console.log("(Ctrl+C para parar)");
  await new Promise(() => {});
}

// ------------------------------------------------------------------
// Dependências (instaladas sem mexer no package.json)
// ------------------------------------------------------------------
let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error("Falta o playwright-core. Rode: npm i --no-save playwright-core ffmpeg-static");
  process.exit(1);
}
let ffmpeg = process.env.FFMPEG_PATH;
if (!ffmpeg) {
  try {
    ffmpeg = (await import("ffmpeg-static")).default;
  } catch {
    ffmpeg = "ffmpeg"; // o do sistema, se existir
  }
}

// ------------------------------------------------------------------
// Navegador
// ------------------------------------------------------------------
async function abrirNavegador() {
  const tentativas = [];
  if (process.env.CHROME_PATH) tentativas.push({ executablePath: process.env.CHROME_PATH });
  tentativas.push({}, { channel: "chrome" }, { channel: "msedge" });
  for (const opcoes of tentativas) {
    try {
      return await chromium.launch({ ...opcoes, args: ["--autoplay-policy=no-user-gesture-required"] });
    } catch {
      /* tenta o próximo */
    }
  }
  console.error("Não achei um Chrome/Chromium. Defina CHROME_PATH com o caminho do navegador.");
  process.exit(1);
}

const navegador = await abrirNavegador();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
pagina.on("console", (m) => m.type() === "warning" && console.warn("[página]", m.text()));
await pagina.goto(`http://127.0.0.1:${porta}/video/index.html?render=1`);
await pagina.evaluate(() => window.REELS.pronto);
const { FPS, DURACAO } = await pagina.evaluate(() => ({ FPS: window.REELS.FPS, DURACAO: window.REELS.DURACAO }));

fs.mkdirSync(SAIDA, { recursive: true });
const dataUrlParaBuffer = (u) => Buffer.from(u.slice(u.indexOf(",") + 1), "base64");

async function salvarQuadro(t, arquivo, tipo = "image/png", qualidade) {
  const i = Math.round(t * FPS);
  const u = await pagina.evaluate(([i, tipo, q]) => window.REELS.quadro(i, tipo, q), [i, tipo, qualidade]);
  fs.writeFileSync(arquivo, dataUrlParaBuffer(u));
  return arquivo;
}

if (previa) {
  for (const t of previa) {
    const arq = await salvarQuadro(t, path.join(SAIDA, `previa-${String(t).replace(".", "_")}s.png`));
    console.log("ok", path.relative(RAIZ, arq));
  }
  await navegador.close();
  servidor.close();
  process.exit(0);
}

// ------------------------------------------------------------------
// Som
// ------------------------------------------------------------------
console.log("Gerando o som…");
const wav = path.join(SAIDA, "artemis-prospect-reels.wav");
fs.writeFileSync(wav, Buffer.from(await pagina.evaluate(() => window.REELS.somWavBase64()), "base64"));

// ------------------------------------------------------------------
// Imagem + som -> MP4
// ------------------------------------------------------------------
const mp4 = path.join(SAIDA, "artemis-prospect-reels.mp4");
const total = Math.round(DURACAO * FPS);
const ff = spawn(ffmpeg, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-i", wav,
  "-map", "0:v", "-map", "1:a",
  // CRF 18 com teto de 16 Mbps: qualidade alta e arquivo no tamanho que o
  // Instagram e o TikTok aceitam sem recomprimir demais.
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "16M", "-bufsize", "32M", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-level", "4.2", "-r", String(FPS), "-g", String(FPS * 2),
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
  "-shortest", "-movflags", "+faststart",
  mp4,
], { stdio: ["pipe", "inherit", "inherit"] });
const fimFfmpeg = new Promise((ok, erro) => {
  ff.on("error", erro);
  ff.on("close", (c) => (c === 0 ? ok() : erro(new Error("ffmpeg saiu com código " + c))));
});

const inicio = Date.now();
for (let i = 0; i < total; i++) {
  const u = await pagina.evaluate((i) => window.REELS.quadro(i), i);
  if (!ff.stdin.write(dataUrlParaBuffer(u))) await new Promise((ok) => ff.stdin.once("drain", ok));
  if (i % 30 === 0 || i === total - 1) {
    const s = ((Date.now() - inicio) / 1000).toFixed(0);
    process.stdout.write(`\rQuadro ${i + 1}/${total} (${s} s)   `);
  }
}
ff.stdin.end();
await fimFfmpeg;
console.log("\nVídeo pronto:", path.relative(RAIZ, mp4));

// Capa (para escolher como thumbnail no Instagram/TikTok): a logo completa.
const capa = await salvarQuadro(11.2, path.join(SAIDA, "capa.jpg"), "image/jpeg", 0.92);
console.log("Capa:", path.relative(RAIZ, capa));

await navegador.close();
servidor.close();
