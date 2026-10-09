import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE_TITULO } from "../marca";

// Legenda grande de cada cena. O trecho em "destaque" sai em amarelo,
// como no título do site ("ainda não têm site").
// Fica no terço de baixo, mas acima da faixa que o TikTok e o Reels cobrem
// com botões e descrição.
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
        left: 100,
        right: 100,
        top: 1330,
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
          fontSize: 66,
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
