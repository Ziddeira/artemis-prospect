import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { progresso } from "../componentes/util";
import { CHAMADA_FINAL } from "../config";
import { COR, FONTE_TITULO } from "../marca";

// Cena 6: "Comenta ÁRTEMIS" bem grande, em amarelo, com um balão de
// comentário pulsando em cima.
export const CenaComenta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Corte seco com "soco": o texto chega grande e assenta.
  const chega = spring({ frame, fps, config: { damping: 13, stiffness: 200 } });
  const balao = spring({ frame: frame - 4, fps, config: { damping: 10, stiffness: 160 } });
  // Pulso do balão a cada meio segundo, com uma onda saindo dele.
  const ciclo = (Math.max(0, frame - 10) % 15) / 15;
  const pulso = frame > 10 ? 1 + 0.09 * Math.sin(ciclo * Math.PI) : 1;

  return (
    <AbsoluteFill style={{ background: COR.fundo, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", marginTop: -120, transform: `scale(${balao * pulso})` }}>
        {frame > 10 ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "45%",
              width: 260 + ciclo * 200,
              height: 260 + ciclo * 200,
              marginLeft: -(260 + ciclo * 200) / 2,
              marginTop: -(260 + ciclo * 200) / 2,
              borderRadius: "50%",
              border: `5px solid ${COR.amarelo}`,
              opacity: (1 - ciclo) * 0.6,
            }}
          />
        ) : null}
        <BalaoDeComentario frame={frame} />
      </div>

      <div
        style={{
          marginTop: 70,
          textAlign: "center",
          fontFamily: FONTE_TITULO,
          fontWeight: 700,
          fontStyle: "italic",
          textTransform: "uppercase",
          color: COR.amarelo,
          lineHeight: 0.92,
          opacity: Math.min(1, chega * 1.5),
          transform: `scale(${1.35 - 0.35 * chega})`,
        }}
      >
        <div style={{ fontSize: 150 }}>{CHAMADA_FINAL.linha1}</div>
        <div style={{ fontSize: 190, marginTop: 34 }}>{CHAMADA_FINAL.linha2}</div>
      </div>
    </AbsoluteFill>
  );
};

// Balão de comentário branco com três pontinhos "digitando" (preto sobre
// branco: o manual não usa amarelo em cima de branco).
const BalaoDeComentario: React.FC<{ frame: number }> = ({ frame }) => (
  <svg width="260" height="240" viewBox="0 0 260 240" style={{ display: "block", position: "relative" }}>
    <path
      d="M40 20h180a30 30 0 0 1 30 30v100a30 30 0 0 1-30 30H110l-56 46 8-46H40a30 30 0 0 1-30-30V50a30 30 0 0 1 30-30z"
      fill={COR.branco}
    />
    {[0, 1, 2].map((i) => {
      const sobe = Math.sin(((frame - i * 4) / 10) * Math.PI);
      return (
        <circle
          key={i}
          cx={80 + i * 50}
          cy={100 - Math.max(0, sobe) * 12}
          r={17}
          fill={COR.preto}
          opacity={progresso(frame, 6 + i * 3, 10 + i * 3)}
        />
      );
    })}
  </svg>
);
