import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Assinatura, Simbolo } from "../componentes/Logo";
import { progresso } from "../componentes/util";
import { ARQUIVOS } from "../config";
import { COR } from "../marca";

// Cena 5: a cabeça da Ártemis entra pela lateral e a logo se forma no centro.
// A cabeça fica dentro de um círculo branco, como pede o manual da marca
// para a mascote sobre fundo escuro.

const LOGO = { tamanho: 300, centroY: 1000 };
// Frações da cena em que a logo começa a se formar e o nome aparece
// (exportadas para os efeitos sonoros baterem com a imagem).
export const INICIO_LOGO = 0.14;
export const INICIO_NOME = 0.36;
export const MOLA_TRAVA = { damping: 16, stiffness: 120 };

export const CenaArtemis: React.FC<{ duracao: number; temCabeca: boolean; temLogo: boolean }> = ({
  duracao,
  temCabeca,
  temLogo,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cabeça: entra pela direita, com um quique e uma inclinação que se desfaz.
  const cabeca = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 90 } });
  // Logo: as quatro cantoneiras amarelas vêm dos cantos da tela e "travam";
  // o símbolo aparece de baixo para cima; depois o nome.
  const inicioLogo = Math.round(duracao * INICIO_LOGO);
  const trava = spring({ frame: frame - inicioLogo, fps, config: MOLA_TRAVA });
  const simbolo = spring({ frame: frame - inicioLogo - 10, fps, config: { damping: 200 }, durationInFrames: 16 });
  const cantoneirasSomem = progresso(frame, inicioLogo + 26, inicioLogo + 40);
  const nome = Math.round(duracao * INICIO_NOME);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COR.fundo,
        // Grade de fundo da marca (manual 6.6).
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      {temCabeca ? (
        <div
          style={{
            position: "absolute",
            left: 540 - 180,
            top: 280,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: COR.branco,
            overflow: "hidden",
            transform: `translateX(${(1 - cabeca) * 900}px) rotate(${(1 - cabeca) * 25}deg)`,
          }}
        >
          <Img
            src={staticFile(ARQUIVOS.cabecaArtemis)}
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 28, boxSizing: "border-box" }}
          />
        </div>
      ) : null}

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          left: 540 - LOGO.tamanho / 2,
          top: LOGO.centroY - LOGO.tamanho / 2,
          width: LOGO.tamanho,
          height: LOGO.tamanho,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            clipPath: `inset(${(1 - simbolo) * 100}% 0 0 0)`,
            transform: `scale(${interpolate(simbolo, [0, 1], [1.25, 1])})`,
          }}
        >
          {temLogo ? (
            <Img src={staticFile(ARQUIVOS.logo)} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Simbolo tamanho={LOGO.tamanho} />
          )}
        </div>
        <CantoneirasDeMira trava={trava} opacidade={1 - cantoneirasSomem} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: LOGO.centroY + LOGO.tamanho / 2 + 40,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <NomeRevelado frame={frame - nome} />
      </div>
    </AbsoluteFill>
  );
};

// As cantoneiras do símbolo ficam em 4..14 e 50..60 numa caixa de 64.
// As amarelas param exatamente ali e depois somem, deixando as cinzas.
const CantoneirasDeMira: React.FC<{ trava: number; opacidade: number }> = ({ trava, opacidade }) => {
  if (trava <= 0) return null;
  const escala = LOGO.tamanho / 64;
  const pos = 4 * escala;
  const lado = 10 * escala;
  const linha = `${Math.max(3, 2.5 * escala)}px solid ${COR.amarelo}`;
  // Começam longe (perto das bordas da tela) e vêm até o lugar.
  const longe = interpolate(trava, [0, 1], [380, 0]);
  const canto = (dx: number, dy: number, estilo: React.CSSProperties) => (
    <i
      style={{
        position: "absolute",
        width: lado,
        height: lado,
        transform: `translate(${dx * longe}px, ${dy * longe}px)`,
        ...estilo,
      }}
    />
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, trava * 2) * opacidade }}>
      {canto(-1, -1, { left: pos, top: pos, borderLeft: linha, borderTop: linha })}
      {canto(1, -1, { right: pos, top: pos, borderRight: linha, borderTop: linha })}
      {canto(-1, 1, { left: pos, bottom: pos, borderLeft: linha, borderBottom: linha })}
      {canto(1, 1, { right: pos, bottom: pos, borderRight: linha, borderBottom: linha })}
    </div>
  );
};

// "ÁRTEMIS / — PROSPECT" sendo revelado da esquerda para a direita.
const NomeRevelado: React.FC<{ frame: number }> = ({ frame }) => {
  const revela = progresso(frame, 0, 16);
  return (
    <div style={{ clipPath: `inset(-20% ${(1 - revela) * 100}% -20% 0)` }}>
      <Assinatura tamanho={130} centralizada />
    </div>
  );
};
