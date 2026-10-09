import React from "react";
import { COR, FONTE_TEXTO } from "../marca";

// Peças da tela de conversa (um app de mensagens genérico, no tema escuro).

export const Avatar: React.FC<{ iniciais: string; tamanho?: number }> = ({ iniciais, tamanho = 64 }) => (
  <div
    style={{
      width: tamanho,
      height: tamanho,
      flexShrink: 0,
      borderRadius: "50%",
      background: "#2A2A2A",
      color: COR.texto2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONTE_TEXTO,
      fontWeight: 800,
      fontSize: tamanho * 0.36,
    }}
  >
    {iniciais}
  </div>
);

export const Cabecalho: React.FC<{ nome: string; status: React.ReactNode; iniciais: string }> = ({
  nome,
  status,
  iniciais,
}) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 76,
      paddingBottom: 18,
      paddingLeft: 26,
      paddingRight: 26,
      display: "flex",
      alignItems: "center",
      gap: 18,
      background: "#141414",
      borderBottom: `1px solid ${COR.divisoria}`,
      fontFamily: FONTE_TEXTO,
    }}
  >
    <Seta />
    <Avatar iniciais={iniciais} />
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ color: COR.branco, fontWeight: 700, fontSize: 28 }}>{nome}</span>
      <span style={{ color: COR.texto2, fontWeight: 500, fontSize: 20, height: 26 }}>{status}</span>
    </div>
  </div>
);

const Seta: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M15 5l-7 7 7 7" stroke={COR.branco} strokeWidth="2.5" strokeLinecap="square" />
  </svg>
);

// Tracinhos de "enviada" (1 tracinho), "entregue" (2) e "lida" (2 em amarelo).
export type Estado = "enviada" | "entregue" | "lida";

export const Tracinhos: React.FC<{ estado: Estado }> = ({ estado }) => {
  const cor = estado === "lida" ? COR.amarelo : COR.texto3;
  return (
    <svg width={estado === "enviada" ? 18 : 26} height="14" viewBox={`0 0 ${estado === "enviada" ? 18 : 26} 14`}>
      <path d="M1 7l5 5L17 1" stroke={cor} strokeWidth="2.2" fill="none" />
      {estado === "enviada" ? null : <path d="M9 12L21 1" stroke={cor} strokeWidth="2.2" fill="none" />}
    </svg>
  );
};

export const Balao: React.FC<{
  lado: "eu" | "ele";
  hora: string;
  estado?: Estado;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ lado, hora, estado, children, style }) => (
  <div
    style={{
      alignSelf: lado === "eu" ? "flex-end" : "flex-start",
      maxWidth: "82%",
      padding: "14px 18px 10px",
      borderRadius: 22,
      borderTopRightRadius: lado === "eu" ? 6 : 22,
      borderTopLeftRadius: lado === "eu" ? 22 : 6,
      background: lado === "eu" ? "#2A2A2A" : "#1B1B1B",
      border: lado === "eu" ? "none" : `1px solid ${COR.borda}`,
      fontFamily: FONTE_TEXTO,
      fontWeight: 500,
      fontSize: 28,
      lineHeight: 1.35,
      color: "#ECECEC",
      ...style,
    }}
  >
    {children}
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
        fontSize: 17,
        color: COR.texto3,
      }}
    >
      {hora}
      {lado === "eu" && estado ? <Tracinhos estado={estado} /> : null}
    </div>
  </div>
);

export const Divisor: React.FC<{ texto: string; style?: React.CSSProperties }> = ({ texto, style }) => (
  <div
    style={{
      alignSelf: "center",
      padding: "6px 16px",
      borderRadius: 10,
      background: "#1B1B1B",
      color: COR.texto2,
      fontFamily: FONTE_TEXTO,
      fontWeight: 600,
      fontSize: 18,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      ...style,
    }}
  >
    {texto}
  </div>
);
