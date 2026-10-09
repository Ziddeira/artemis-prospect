import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Balao, Cabecalho, Divisor } from "../componentes/Conversa";
import { COR, FONTE_TEXTO } from "../marca";

// Cena 2, primeira parte: a conversa parada em "oi, tudo bem?", sem resposta.
export const TelaConversaParada: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const surge = (inicio: number) => {
    const e = spring({ frame: frame - inicio, fps, config: { damping: 15, stiffness: 180 } });
    return { opacity: Math.min(1, e * 1.4), transform: `scale(${0.85 + 0.15 * e})` };
  };

  return (
    <AbsoluteFill style={{ background: "#0D0D0D" }}>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Divisor texto="Segunda" />
        <Balao lado="eu" hora="09:12" estado="enviada" style={{ ...surge(6), transformOrigin: "100% 0" }}>
          oi, tudo bem?
        </Balao>
        <Divisor texto="Quinta" style={surge(34)} />
        <Balao lado="eu" hora="16:40" estado="enviada" style={{ ...surge(42), transformOrigin: "100% 0" }}>
          conseguiu ver?
        </Balao>
      </div>
      <Cabecalho nome="Barbearia do Zé" iniciais="BZ" status="visto por último há 3 dias" />
      <BarraMensagem />
    </AbsoluteFill>
  );
};

const BarraMensagem: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: "16px 20px 40px",
      background: "#141414",
      borderTop: `1px solid ${COR.divisoria}`,
    }}
  >
    <div
      style={{
        height: 64,
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        borderRadius: 32,
        background: "#1F1F1F",
        fontFamily: FONTE_TEXTO,
        fontWeight: 500,
        fontSize: 25,
        color: COR.texto3,
      }}
    >
      Mensagem
    </div>
  </div>
);
