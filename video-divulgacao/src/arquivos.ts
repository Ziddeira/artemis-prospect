// Antes de renderizar, o Remotion roda "prepararVideo" uma vez: ele confere
// quais dos seus arquivos existem (e não estão vazios) e analisa a narração
// para saber quando abaixar a música. Não precisa mexer aqui.
import { getAudioData, getAudioDurationInSeconds } from "@remotion/media-utils";
import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import { staticFile } from "remotion";
import { ARQUIVOS, VOLUMES } from "./config";
import { DURACAO_TOTAL, FPS } from "./tempo";

export type Recursos = {
  temNarracao: boolean;
  temMusica: boolean;
  temPop: boolean;
  temGravacao: boolean;
  temCabeca: boolean;
  temLogo: boolean;
  // Duração da gravação de tela em segundos (0 se não houver).
  duracaoGravacao: number;
  // Duração da narração em segundos (0 se não houver).
  duracaoNarracao: number;
  // Volume da música em cada quadro do vídeo (com o ducking aplicado).
  volumeMusica: number[];
};

export const RECURSOS_VAZIOS: Recursos = {
  temNarracao: false,
  temMusica: false,
  temPop: false,
  temGravacao: false,
  temCabeca: false,
  temLogo: false,
  duracaoGravacao: 0,
  duracaoNarracao: 0,
  volumeMusica: [],
};

// O arquivo existe e tem conteúdo?
const existe = async (arquivo: string) => {
  try {
    const resposta = await fetch(staticFile(arquivo));
    if (!resposta.ok) return false;
    return (await resposta.arrayBuffer()).byteLength > 0;
  } catch {
    return false;
  }
};

// Existe e o navegador consegue abrir? (um MP3 corrompido conta como ausente)
const abre = async <T>(arquivo: string, abrir: (src: string) => Promise<T>): Promise<T | null> => {
  if (!(await existe(arquivo))) return null;
  try {
    return await abrir(staticFile(arquivo));
  } catch (erro) {
    console.warn(`Não consegui abrir public/${arquivo}; o vídeo segue sem ele.`, erro);
    return null;
  }
};

// Lê a duração do vídeo direto do arquivo (sem depender do navegador
// saber tocar aquele formato).
const duracaoDoVideo = async (src: string) => {
  const entrada = new Input({ formats: ALL_FORMATS, source: new UrlSource(new URL(src, window.location.href).href) });
  if (!(await entrada.getPrimaryVideoTrack())) throw new Error("O arquivo não tem vídeo.");
  return entrada.computeDuration();
};

export const prepararVideo = async (): Promise<Recursos> => {
  const [narracao, musica, pop, gravacao, cabeca, logo] = await Promise.all([
    abre(ARQUIVOS.narracao, (src) => getAudioData(src)),
    abre(ARQUIVOS.musica, getAudioDurationInSeconds),
    abre(ARQUIVOS.pop, getAudioDurationInSeconds),
    abre(ARQUIVOS.gravacaoDeTela, duracaoDoVideo),
    existe(ARQUIVOS.cabecaArtemis),
    existe(ARQUIVOS.logo),
  ]);

  const duracaoNarracao = narracao?.durationInSeconds ?? 0;
  if (duracaoNarracao > DURACAO_TOTAL / FPS) {
    console.warn(
      `A narração tem ${duracaoNarracao.toFixed(1)}s e o vídeo ${(DURACAO_TOTAL / FPS).toFixed(1)}s. ` +
        "Aumente as durações em src/config.ts para ela não ser cortada.",
    );
  }

  return {
    temNarracao: narracao !== null,
    temMusica: musica !== null,
    temPop: pop !== null,
    temGravacao: gravacao !== null,
    temCabeca: cabeca,
    temLogo: logo,
    duracaoGravacao: gravacao ?? 0,
    duracaoNarracao,
    volumeMusica: narracao ? curvaDeDucking(narracao.channelWaveforms, narracao.sampleRate) : [],
  };
};

// Ducking: para cada quadro, mede o "volume" da narração. Quando passa do
// limiar, a música desce para VOLUMES.musicaSobNarracao; quando a voz para,
// ela volta devagar para VOLUMES.musica.
const curvaDeDucking = (canais: Float32Array[], taxa: number): number[] => {
  const amostrasPorQuadro = taxa / FPS;
  const falando: boolean[] = [];
  for (let q = 0; q < DURACAO_TOTAL; q++) {
    const de = Math.floor(q * amostrasPorQuadro);
    const ate = Math.min(Math.floor((q + 1) * amostrasPorQuadro), canais[0].length);
    let soma = 0;
    let n = 0;
    for (const canal of canais) {
      for (let i = de; i < ate; i++) {
        soma += canal[i] * canal[i];
        n++;
      }
    }
    falando.push(n > 0 && Math.sqrt(soma / n) > VOLUMES.limiarDeVoz);
  }

  // Abaixa 4 quadros antes da voz e segura 12 quadros depois, para a música
  // não ficar subindo e descendo entre uma palavra e outra.
  const ANTES = 4;
  const DEPOIS = 12;
  const abaixar = falando.map((_, q) => {
    for (let k = q - DEPOIS; k <= q + ANTES; k++) if (falando[k]) return true;
    return false;
  });

  const curva: number[] = [];
  let atual = VOLUMES.musica;
  for (let q = 0; q < DURACAO_TOTAL; q++) {
    const alvo = abaixar[q] ? VOLUMES.musicaSobNarracao : VOLUMES.musica;
    // Desce rápido, sobe devagar.
    atual += (alvo - atual) * (alvo < atual ? 0.35 : 0.08);
    curva.push(Math.round(atual * 1000) / 1000);
  }
  return curva;
};
