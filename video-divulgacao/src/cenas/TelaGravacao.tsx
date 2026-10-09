import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, getRemotionEnvironment, staticFile, useVideoConfig } from "remotion";
import { ARQUIVOS, GRAVACAO } from "../config";
import { COR, FONTE_TEXTO } from "../marca";
import { TelaApp } from "./TelaApp";

// Cena 3 dentro do celular: a sua gravação de tela. Enquanto ela não
// existir, entra a tela de exemplo (TelaApp) e, só no editor, um aviso.
export const TelaGravacao: React.FC<{ temGravacao: boolean; duracaoGravacao: number }> = ({
  temGravacao,
  duracaoGravacao,
}) => {
  const { fps } = useVideoConfig();

  if (!temGravacao) {
    return (
      <AbsoluteFill>
        <TelaApp />
        {getRemotionEnvironment().isStudio ? <AvisoSoNoEditor /> : null}
      </AbsoluteFill>
    );
  }

  // Se a gravação acabar antes da cena, o último quadro fica parado na tela.
  const ultimoQuadro = Math.max(
    0,
    Math.floor(((duracaoGravacao - GRAVACAO.comecarEm) / GRAVACAO.velocidade) * fps) - 1,
  );

  return (
    <AbsoluteFill style={{ background: COR.preto }}>
      <Freeze frame={ultimoQuadro} active={(f) => f >= ultimoQuadro}>
        <OffthreadVideo
          src={staticFile(ARQUIVOS.gravacaoDeTela)}
          muted
          trimBefore={Math.round(GRAVACAO.comecarEm * fps)}
          playbackRate={GRAVACAO.velocidade}
          // Preenche a tela do celular, cortando as sobras se a proporção for diferente.
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Freeze>
    </AbsoluteFill>
  );
};

const AvisoSoNoEditor: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      padding: "12px 14px",
      background: "rgba(255,138,128,0.95)",
      color: COR.preto,
      fontFamily: FONTE_TEXTO,
      fontWeight: 700,
      fontSize: 18,
      lineHeight: 1.3,
    }}
  >
    Aviso (só no editor): coloque sua gravação em public/{ARQUIVOS.gravacaoDeTela}. Por enquanto entra a tela de
    exemplo.
  </div>
);
