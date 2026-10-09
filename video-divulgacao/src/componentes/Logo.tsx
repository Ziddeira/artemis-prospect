import React from "react";
import { COR, FONTE_TITULO } from "../marca";

// Símbolo oficial (public/brand/simbolo.svg): "A" amarelo, losango branco e
// as quatro cantoneiras de HUD.
export const Simbolo: React.FC<{ tamanho: number; semCantoneiras?: boolean }> = ({
  tamanho,
  semCantoneiras,
}) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" fill="none" style={{ display: "block" }}>
    {semCantoneiras ? null : (
      <path
        d="M4 14V4h10M50 4h10v10M4 50v10h10M60 50v10H50"
        stroke={COR.bordaForte}
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    )}
    <polygon points="32,10 54,54 43,54 32,31 21,54 10,54" fill={COR.amarelo} />
    <polygon points="32,40 36,45 32,50 28,45" fill={COR.branco} />
  </svg>
);

// Assinatura "ÁRTEMIS / — PROSPECT" com as proporções do manual (2.2):
// PROSPECT = 24% do tamanho de ÁRTEMIS; espaço entre linhas = 11%.
export const Assinatura: React.FC<{ tamanho: number; centralizada?: boolean }> = ({
  tamanho,
  centralizada,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: centralizada ? "center" : "flex-start",
      gap: tamanho * 0.11,
    }}
  >
    <span
      style={{
        fontFamily: FONTE_TITULO,
        fontWeight: 700,
        fontStyle: "italic",
        fontSize: tamanho,
        lineHeight: 0.9,
        letterSpacing: "0.02em",
        color: COR.branco,
      }}
    >
      ÁRTEMIS
    </span>
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: tamanho * 0.15,
        fontFamily: FONTE_TITULO,
        fontWeight: 600,
        fontSize: tamanho * 0.24,
        letterSpacing: "0.55em",
        // O espaçamento largo também entra depois da última letra; a margem
        // negativa compensa para o bloco continuar centralizado.
        marginRight: centralizada ? "-0.55em" : 0,
        color: COR.amarelo,
      }}
    >
      <i
        style={{
          display: "block",
          width: tamanho * 0.48,
          height: Math.max(2, tamanho * 0.043),
          background: COR.amarelo,
        }}
      />
      PROSPECT
    </span>
  </div>
);

// Versão horizontal (símbolo à esquerda), usada no topo do app dentro do celular.
export const LogoHorizontal: React.FC<{ tamanho: number }> = ({ tamanho }) => (
  <div style={{ display: "flex", alignItems: "center", gap: tamanho * 0.35 }}>
    <Simbolo tamanho={tamanho * 1.6} />
    <Assinatura tamanho={tamanho} />
  </div>
);
