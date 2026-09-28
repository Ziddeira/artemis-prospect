// Renderiza o vídeo em MP4 (1080x1920, 30 fps, H.264 + AAC).
// Abre a página num Chromium sem janela, pede cada quadro ao canvas,
// gera a trilha em WAV e junta tudo com o ffmpeg.
//
//   npm run render                 -> out/studio-supremo-9x16.mp4
//   npm run render -- --from 20 --to 26   (renderiza só um trecho, em segundos)
//   npm run render -- --stills 2,7,12      (salva PNGs desses instantes)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { serve } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
fs.mkdirSync(OUT, { recursive: true });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const server = await serve(0);
const url = `http://127.0.0.1:${server.address().port}/index.html?render=1`;
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("pageerror", (e) => console.error("Erro na página:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const info = await page.evaluate(() => ({ fps: __video.fps, frames: __video.frames, duration: __video.duration }));

const grab = () =>
  page.evaluate(() => document.getElementById("stage").toDataURL("image/jpeg", 0.96).split(",")[1]);

const stills = arg("stills");
if (stills) {
  for (const s of stills.split(",").map(Number)) {
    const i = Math.round(s * info.fps);
    await page.evaluate((i) => __video.renderFrame(i), i);
    const png = await page.evaluate(() => document.getElementById("stage").toDataURL("image/png").split(",")[1]);
    const f = path.join(OUT, `still-${String(s).replace(".", "_")}s.png`);
    fs.writeFileSync(f, Buffer.from(png, "base64"));
    console.log("salvo", f);
  }
  await browser.close();
  server.close();
  process.exit(0);
}

const from = Math.round((Number(arg("from")) || 0) * info.fps);
const to = Math.min(info.frames, Math.round((Number(arg("to")) || info.duration) * info.fps));
const partial = from > 0 || to < info.frames;

console.log("Gerando trilha sonora…");
const wavPath = path.join(OUT, "trilha.wav");
fs.writeFileSync(wavPath, Buffer.from(await page.evaluate(() => __video.audioWavBase64()), "base64"));

const outFile = path.join(OUT, partial ? `trecho-${from}-${to}.mp4` : "studio-supremo-9x16.mp4");
const ff = spawn(ffmpegPath, [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(info.fps), "-c:v", "mjpeg", "-i", "-",
  "-ss", String(from / info.fps), "-i", wavPath,
  "-map", "0:v", "-map", "1:a",
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "7M", "-bufsize", "14M", "-pix_fmt", "yuv420p", "-profile:v", "high",
  "-r", String(info.fps), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
  outFile,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg saiu com código " + c)))));

const t0 = Date.now();
for (let i = from; i < to; i++) {
  await page.evaluate((i) => __video.renderFrame(i), i);
  const jpg = Buffer.from(await grab(), "base64");
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((i - from) % 30 === 0) {
    const done = i - from + 1, total = to - from;
    const eta = ((Date.now() - t0) / done) * (total - done) / 1000;
    process.stdout.write(`\rQuadro ${done}/${total}  (faltam ~${Math.ceil(eta)} s)   `);
  }
}
ff.stdin.end();
await ffDone;
console.log(`\nPronto: ${outFile}`);
await browser.close();
server.close();
