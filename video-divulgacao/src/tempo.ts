// Converte as durações do config.ts (em segundos) em quadros e calcula
// onde cada cena começa e termina. Não precisa mexer aqui.
import { DURACAO_DAS_CENAS } from "./config";

export const FPS = 30;
export const s = (segundos: number) => Math.round(segundos * FPS);

export type NomeCena = keyof typeof DURACAO_DAS_CENAS;
export type Cena = { de: number; ate: number; duracao: number };

const ORDEM: NomeCena[] = ["pinos", "dificil", "busca", "leads", "artemis", "comenta"];

export const CENAS = (() => {
  let inicio = 0;
  const cenas = {} as Record<NomeCena, Cena>;
  for (const nome of ORDEM) {
    const duracao = Math.max(1, s(DURACAO_DAS_CENAS[nome]));
    cenas[nome] = { de: inicio, ate: inicio + duracao, duracao };
    inicio += duracao;
  }
  return cenas;
})();

export const ORDEM_DAS_CENAS = ORDEM;
export const DURACAO_TOTAL = CENAS.comenta.ate;
