import React from "react";
import { COR } from "../marca";

// Formato de gota de pino de mapa (caixa de 100 x 130; a ponta fica embaixo, no meio).
const GOTA = "M50 0C22.4 0 0 22.4 0 50c0 35 50 80 50 80s50-45 50-80C100 22.4 77.6 0 50 0Z";

// Pino amarelo da Ártemis: a gota amarela com o "A" da marca dentro
// (versão do símbolo sobre amarelo: "A" e losango pretos, manual 2.4).
export const PinoArtemis: React.FC<{ largura: number }> = ({ largura }) => (
  <svg width={largura} height={largura * 1.3} viewBox="0 0 100 130" style={{ display: "block" }}>
    <path d={GOTA} fill={COR.amarelo} />
    <g transform="translate(22 18) scale(0.875)">
      <polygon points="32,10 54,54 43,54 32,31 21,54 10,54" fill={COR.preto} />
      <polygon points="32,40 36,45 32,50 28,45" fill={COR.preto} />
    </g>
  </svg>
);

// Pino cinza: as empresas da cidade, ainda sem destaque.
export const PinoCinza: React.FC<{ largura: number }> = ({ largura }) => (
  <svg width={largura} height={largura * 1.3} viewBox="0 0 100 130" style={{ display: "block" }}>
    <path d={GOTA} fill={COR.cinza} />
    <circle cx="50" cy="48" r="17" fill={COR.preto} />
  </svg>
);
