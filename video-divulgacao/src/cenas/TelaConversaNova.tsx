import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Balao, Cabecalho, Divisor, Estado } from "../componentes/Conversa";
import { progresso } from "../componentes/util";
import { COR, FONTE_TEXTO, FONTE_TITULO } from "../marca";

// Cenas 4 e 5 dentro do celular: a conversa abre com a mensagem pronta,
// ela é enviada e, desta vez, o cliente responde.
// Os quadros contam a partir do começo desta tela (15,7s do vídeo).

export const TEMPO_CONVERSA = {
  enviar: 40,
  entregue: 60,
  lida: 96,
  digitando: 146,
  resposta1: 180,
  resposta2: 208,
} as const;

const MENSAGEM =
  "Oi, Zé! Vi que a Barbearia do Zé ainda não tem site. Posso te mostrar uma ideia de como ficaria?";

export const TelaConversaNova: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = TEMPO_CONVERSA;

  const enviada = frame >= t.enviar + 4;
  const estado: Estado = frame >= t.lida ? "lida" : frame >= t.entregue ? "entregue" : "enviada";
  const surge = (inicio: number, origem: string) => {
    const e = spring({ frame: frame - inicio, fps, config: { damping: 15, stiffness: 180 } });
    return {
      opacity: Math.min(1, e * 1.4),
      transform: `translateY(${(1 - e) * 30}px) scale(${0.9 + 0.1 * e})`,
      transformOrigin: origem,
    };
  };
  const digitando = frame >= t.digitando && frame < t.resposta1;
  const status = digitando ? (
    <span style={{ color: COR.amarelo }}>digitando…</span>
  ) : frame >= t.lida ? (
    "online"
  ) : (
    ""
  );

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
        <Divisor texto="Hoje" />
        {enviada ? (
          <Balao lado="eu" hora="10:02" estado={estado} style={surge(t.enviar + 4, "100% 100%")}>
            {MENSAGEM}
          </Balao>
        ) : null}
        {digitando ? <Digitando frame={frame - t.digitando} /> : null}
        {frame >= t.resposta1 ? (
          <Balao lado="ele" hora="10:04" style={surge(t.resposta1, "0 100%")}>
            Opa! Faz tempo que eu quero um site.
          </Balao>
        ) : null}
        {frame >= t.resposta2 ? (
          <Balao lado="ele" hora="10:04" style={surge(t.resposta2, "0 100%")}>
            Quanto fica? Bora conversar!
          </Balao>
        ) : null}
      </div>

      <Cabecalho nome="Barbearia do Zé" iniciais="BZ" status={status} />
      <BarraComMensagemPronta frame={frame} enviada={enviada} />
    </AbsoluteFill>
  );
};

const Digitando: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      alignSelf: "flex-start",
      display: "flex",
      gap: 8,
      padding: "22px 24px",
      borderRadius: 22,
      borderTopLeftRadius: 6,
      background: "#1B1B1B",
      border: `1px solid ${COR.borda}`,
    }}
  >
    {[0, 1, 2].map((i) => (
      <i
        key={i}
        style={{
          display: "block",
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: COR.texto2,
          transform: `translateY(${Math.sin(((frame - i * 4) / 12) * Math.PI * 2) * -5}px)`,
        }}
      />
    ))}
  </div>
);

// Barra de digitar com a mensagem pronta do Ártemis já preenchida e o
// botão de enviar em amarelo. Depois do envio ela volta a ficar vazia.
const BarraComMensagemPronta: React.FC<{ frame: number; enviada: boolean }> = ({ frame, enviada }) => {
  const { fps } = useVideoConfig();
  const t = TEMPO_CONVERSA;
  const etiqueta = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 160 } });
  const toque = progresso(frame, t.enviar, t.enviar + 14);
  const afunda = frame >= t.enviar && frame < t.enviar + 6 ? 0.88 : 1;

  return (
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
      {enviada ? null : (
        <span
          style={{
            display: "inline-block",
            marginBottom: 12,
            marginLeft: 4,
            padding: "5px 10px",
            background: COR.amarelo,
            color: COR.preto,
            fontFamily: FONTE_TITULO,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "0.08em",
            opacity: etiqueta,
            transform: `scale(${0.7 + 0.3 * etiqueta})`,
            transformOrigin: "0 100%",
          }}
        >
          MENSAGEM PRONTA DO ÁRTEMIS
        </span>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        <div
          style={{
            flex: 1,
            minHeight: 64,
            padding: "14px 20px",
            boxSizing: "border-box",
            borderRadius: 28,
            background: "#1F1F1F",
            border: `2px solid ${enviada ? "transparent" : COR.amarelo}`,
            fontFamily: FONTE_TEXTO,
            fontWeight: 500,
            fontSize: 23,
            lineHeight: 1.35,
            color: enviada ? COR.texto3 : "#ECECEC",
          }}
        >
          {enviada ? "Mensagem" : MENSAGEM}
        </div>
        <div
          style={{
            position: "relative",
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: "50%",
            background: COR.amarelo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${afunda})`,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M4 12h14M12 5l7 7-7 7" stroke={COR.preto} strokeWidth="2.6" strokeLinecap="square" />
          </svg>
          {toque > 0 && toque < 1 ? (
            <i
              style={{
                position: "absolute",
                left: 32 - 70 * toque,
                top: 32 - 70 * toque,
                width: 140 * toque,
                height: 140 * toque,
                borderRadius: "50%",
                border: `3px solid ${COR.branco}`,
                opacity: 1 - toque,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
