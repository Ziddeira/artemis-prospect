import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AREA_SEGURA } from "../config";
import { COR, FONTE_TITULO } from "../marca";

// Legenda grande de cada cena. O trecho em "destaque" sai em amarelo,
// como no título do site ("ainda não têm site").
// Fica centralizada e sempre dentro da área segura (config.ts): a última
// linha encosta na margem de baixo e, se o texto quebrar em mais linhas,
// ele cresce para cima.
export const Legenda: React.FC<{ texto: string; destaque?: string; duracao: number }> = ({
  texto,
  destaque,
  duracao,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrada = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 14 });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const partes = destaque ? texto.split(destaque) : [texto];

  return (
    <div
      style={{
        position: "absolute",
        left: AREA_SEGURA.lados,
        right: AREA_SEGURA.lados,
        bottom: AREA_SEGURA.base,
        display: "flex",
        justifyContent: "center",
        opacity: entrada * saida,
        transform: `translateY(${(1 - entrada) * 40}px)`,
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontFamily: FONTE_TITULO,
          fontWeight: 700,
          fontStyle: "italic",
          textTransform: "uppercase",
          fontSize: 72,
          lineHeight: 1.04,
          color: COR.branco,
          textWrap: "balance",
        }}
      >
        {partes[0]}
        {destaque && partes.length > 1 ? (
          <>
            <span style={{ color: COR.amarelo }}>{destaque}</span>
            {partes[1]}
          </>
        ) : null}
      </p>
    </div>
  );
};
