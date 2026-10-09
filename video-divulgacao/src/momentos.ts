// Momentos que mais de uma peça precisa saber (imagem e som).
import { POUSO } from "./cenas/PinoQueda";
import { CENAS } from "./tempo";

const { dificil, busca } = CENAS;

// Cena 2: corte seco aproximando do balão e, depois, corte para a lista.
export const APROXIMA = dificil.de + Math.round(dificil.duracao * 0.18);
export const INICIO_LISTA = dificil.de + Math.round(dificil.duracao * 0.42);
// O pino amarelo cai no celular um pouco antes da cena 3 e abre a gravação.
export const QUEDA_PINO = busca.de - 12;
export const INICIO_GRAVACAO = QUEDA_PINO + POUSO;
