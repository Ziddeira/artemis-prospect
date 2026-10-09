import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PinoArtemis } from "../componentes/Pino";
import { progresso } from "../componentes/util";
import { COR } from "../marca";

// Passagem da cena 2 para a 3: o pino amarelo volta, cai em cima do
// celular e "abre" o Ártemis Prospect na tela.
export const ALVO = { x: 540, y: 560 };
export const POUSO = 14; // quadro em que a ponta encosta na tela

export const PinoQueda: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const largura = 130;
  const queda = spring({ frame, fps, config: { damping: 200 }, durationInFrames: POUSO });
  const some = 1 - progresso(frame, POUSO, POUSO + 6);
  const onda = progresso(frame, POUSO, POUSO + 16);

  return (
    <AbsoluteFill>
      {onda > 0 && onda < 1 ? (
        <div
          style={{
            position: "absolute",
            left: ALVO.x - 300 * onda,
            top: ALVO.y - 300 * onda,
            width: 600 * onda,
            height: 600 * onda,
            borderRadius: "50%",
            border: `6px solid ${COR.amarelo}`,
            opacity: 1 - onda,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: ALVO.x - largura / 2,
          top: ALVO.y - largura * 1.3,
          transformOrigin: "50% 100%",
          transform: `translateY(${(1 - queda) * -900}px) scale(${some})`,
          opacity: some,
        }}
      >
        <PinoArtemis largura={largura} />
      </div>
    </AbsoluteFill>
  );
};
