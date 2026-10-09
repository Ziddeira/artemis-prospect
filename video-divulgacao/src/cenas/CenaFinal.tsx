import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Assinatura, Simbolo } from "../componentes/Logo";
import { progresso } from "../componentes/util";
import { COR, FONTE_TEXTO, FONTE_TITULO, corte } from "../marca";

// Cena 6 (25s–30s): logo vertical, a promessa e a chamada para criar conta.
// Os números do plano grátis são os de lib/planos.ts (3 buscas e 5 desbloqueios).
export const CenaFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sobe = (inicio: number) => {
    const e = spring({ frame: frame - inicio, fps, config: { damping: 200 }, durationInFrames: 16 });
    return { opacity: e, transform: `translateY(${(1 - e) * 40}px)` };
  };
  const simbolo = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 120 } });
  // Depois que tudo aparece, o botão "respira" para puxar o olho.
  const respira = frame > 70 ? 1 + 0.03 * Math.sin(((frame - 70) / 20) * Math.PI) : 1;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        paddingTop: 360,
        // Grade de fundo da marca (manual 6.6), só aqui no fechamento.
        backgroundColor: COR.preto,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
        opacity: progresso(frame, 0, 12),
      }}
    >
      <div style={{ transform: `scale(${simbolo})`, opacity: Math.min(1, simbolo * 1.5) }}>
        <Simbolo tamanho={260} />
      </div>

      <div style={{ marginTop: 44, ...sobe(18) }}>
        <Assinatura tamanho={124} centralizada />
      </div>

      <p
        style={{
          margin: "84px 110px 0",
          textAlign: "center",
          fontFamily: FONTE_TITULO,
          fontWeight: 700,
          fontStyle: "italic",
          textTransform: "uppercase",
          fontSize: 60,
          lineHeight: 1.04,
          color: COR.branco,
          textWrap: "balance",
          ...sobe(32),
        }}
      >
        Ache clientes que <span style={{ color: COR.amarelo }}>ainda não têm site</span>.
      </p>

      <div style={{ marginTop: 64, ...sobe(46) }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "30px 48px",
            background: COR.amarelo,
            color: COR.preto,
            clipPath: corte(16),
            fontFamily: FONTE_TITULO,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "0.08em",
            transform: `scale(${respira})`,
          }}
        >
          CRIE SUA CONTA GRÁTIS
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M4 12h14M12 5l7 7-7 7" stroke={COR.preto} strokeWidth="2.6" strokeLinecap="square" />
          </svg>
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          textAlign: "center",
          fontFamily: FONTE_TEXTO,
          ...sobe(56),
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 40, color: COR.branco }}>artemisprospect.com.br</div>
        <div style={{ marginTop: 10, fontWeight: 500, fontSize: 28, color: COR.texto2 }}>
          3 buscas e 5 desbloqueios grátis, sem cartão.
        </div>
      </div>
    </AbsoluteFill>
  );
};
