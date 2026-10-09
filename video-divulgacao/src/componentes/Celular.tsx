import React from "react";
import { COR, FONTE_TEXTO } from "../marca";

// Medidas do celular dentro do vídeo de 1080 x 1920.
export const CELULAR = { largura: 560, altura: 1120, topo: 130, borda: 16 } as const;
export const TELA = {
  largura: CELULAR.largura - CELULAR.borda * 2,
  altura: CELULAR.altura - CELULAR.borda * 2,
} as const;

// Moldura de celular genérico com barra de status. O conteúdo da tela vem
// em "children" e é trocado a cada cena.
// "semBarraDeStatus" serve para a gravação de tela, que já traz a sua.
export const Celular: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  semBarraDeStatus?: boolean;
}> = ({ children, style, semBarraDeStatus }) => (
  <div
    style={{
      position: "absolute",
      left: (1080 - CELULAR.largura) / 2,
      top: CELULAR.topo,
      width: CELULAR.largura,
      height: CELULAR.altura,
      borderRadius: 74,
      background: "#1A1A1A",
      border: `3px solid ${COR.bordaForte}`,
      padding: CELULAR.borda - 3,
      boxSizing: "border-box",
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 58,
        overflow: "hidden",
        background: COR.preto,
      }}
    >
      {children}
      {semBarraDeStatus ? null : <BarraDeStatus />}
    </div>
  </div>
);

const BarraDeStatus: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 46px",
      fontFamily: FONTE_TEXTO,
      fontWeight: 700,
      fontSize: 22,
      color: COR.branco,
      pointerEvents: "none",
    }}
  >
    <span>9:41</span>
    {/* "Ilha" da câmera */}
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 16,
        width: 150,
        height: 40,
        marginLeft: -75,
        borderRadius: 20,
        background: "#000",
      }}
    />
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      {[8, 12, 16, 20].map((h) => (
        <i key={h} style={{ display: "block", width: 5, height: h, background: COR.branco }} />
      ))}
      <i
        style={{
          display: "block",
          width: 36,
          height: 18,
          marginLeft: 10,
          border: `2px solid ${COR.branco}`,
          borderRadius: 5,
          boxSizing: "border-box",
          padding: 2,
        }}
      >
        <i style={{ display: "block", width: "70%", height: "100%", background: COR.branco, borderRadius: 2 }} />
      </i>
    </div>
  </div>
);
