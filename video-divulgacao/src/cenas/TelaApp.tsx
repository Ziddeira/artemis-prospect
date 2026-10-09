import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoHorizontal } from "../componentes/Logo";
import { digitado, progresso } from "../componentes/util";
import { COR, FONTE_TEXTO, FONTE_TITULO, corte } from "../marca";

// Cenas 3 e 4 dentro do celular: a busca no Ártemis Prospect, a lista de
// leads e o toque no botão de WhatsApp do primeiro lead.
// Os quadros aqui contam a partir do começo desta tela (8s do vídeo).

export const TEMPO_APP = {
  revela: 16, // círculo amarelo abrindo a tela
  nicho: 14,
  cidade: 34,
  botao: 58,
  rolagem: 66,
  cards: 76,
  mira: 176, // 14s: começa a cena 4
  toque: 204,
} as const;

const LEADS = [
  { nome: "Barbearia do Zé", bairro: "Centro", situacao: "SEM SITE", score: 94 },
  { nome: "Navalha de Ouro", bairro: "Pagani", situacao: "SEM SITE", score: 91 },
  { nome: "Barbearia Estilo", bairro: "Ponte do Imaruim", situacao: "SÓ INSTAGRAM", score: 86 },
  { nome: "Corte Fino", bairro: "Pedra Branca", situacao: "SEM SITE", score: 82 },
  { nome: "Dom Barba", bairro: "Bela Vista", situacao: "SÓ INSTAGRAM", score: 74 },
];

export const TelaApp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = TEMPO_APP;

  const revela = progresso(frame, 0, t.revela);
  const rolagem = spring({ frame: frame - t.rolagem, fps, config: { damping: 200 }, durationInFrames: 16 });
  const apertaBotao = frame >= t.botao && frame < t.botao + 6 ? 0.95 : 1;
  const foco = progresso(frame, t.mira, t.mira + 10);

  return (
    <AbsoluteFill
      style={{
        background: COR.preto,
        fontFamily: FONTE_TEXTO,
        clipPath: `circle(${revela * 140}% at 50% 38%)`,
      }}
    >
      {/* Conteúdo que "rola" para cima quando chegam os resultados */}
      <div style={{ position: "absolute", top: 170, left: 24, right: 24, transform: `translateY(${-rolagem * 480}px)` }}>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 17, letterSpacing: "0.3em", color: COR.amarelo }}>
          BUSCAR LEADS
        </div>
        <div style={{ marginTop: 8, fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 40, color: COR.branco, lineHeight: 1.05 }}>
          Quem ainda não tem site?
        </div>

        <Campo
          rotulo="Nicho"
          valor={digitado("barbearia", frame, t.nicho, 0.5)}
          ativo={frame >= t.nicho - 2 && frame < t.cidade}
        />
        <Campo
          rotulo="Cidade"
          valor={digitado("Palhoça, SC", frame, t.cidade, 0.5)}
          ativo={frame >= t.cidade && frame < t.botao + 4}
        />

        <div
          style={{
            marginTop: 26,
            height: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COR.amarelo,
            color: COR.preto,
            clipPath: corte(12),
            fontFamily: FONTE_TITULO,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "0.08em",
            transform: `scale(${apertaBotao})`,
          }}
        >
          BUSCAR
        </div>

        {/* Resultados */}
        <div
          style={{
            marginTop: 50,
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: progresso(frame, t.cards - 6, t.cards + 2),
          }}
        >
          <span
            style={{
              padding: "7px 12px",
              background: COR.amarelo,
              color: COR.preto,
              fontFamily: FONTE_TITULO,
              fontWeight: 600,
              fontSize: 19,
              letterSpacing: "0.08em",
            }}
          >
            48 LEADS
          </span>
          <span style={{ fontSize: 21, fontWeight: 600, color: COR.texto2 }}>barbearia · Palhoça SC</span>
        </div>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {LEADS.map((lead, i) => {
            const entrada = spring({ frame: frame - (t.cards + i * 5), fps, config: { damping: 18, stiffness: 160 } });
            const escolhido = i === 0;
            return (
              <div
                key={lead.nome}
                style={{
                  position: "relative",
                  opacity: Math.min(1, entrada * 1.3) * (escolhido ? 1 : 1 - foco * 0.65),
                  transform: `translateX(${(1 - entrada) * 120}px)`,
                }}
              >
                <CardLead {...lead} toque={escolhido ? frame - t.toque : -1} />
                {escolhido ? <Mira frame={frame - t.mira} /> : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra do app com a logo, fixa no topo */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 150,
          paddingTop: 70,
          paddingLeft: 26,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          background: COR.sidebar,
          borderBottom: `1px solid ${COR.divisoria}`,
        }}
      >
        <LogoHorizontal tamanho={24} />
      </div>
    </AbsoluteFill>
  );
};

const Campo: React.FC<{ rotulo: string; valor: string; ativo: boolean }> = ({ rotulo, valor, ativo }) => {
  const frame = useCurrentFrame();
  const cursor = ativo && Math.floor(frame / 8) % 2 === 0;
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: COR.texto2 }}>{rotulo}</div>
      <div
        style={{
          marginTop: 8,
          height: 72,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          background: COR.preto,
          border: `2px solid ${ativo ? COR.amarelo : COR.bordaInput}`,
          fontSize: 26,
          fontWeight: 600,
          color: COR.textoCampo,
        }}
      >
        {valor}
        <i style={{ display: "block", width: 2, height: 32, marginLeft: 2, background: cursor ? COR.amarelo : "transparent" }} />
      </div>
    </div>
  );
};

const CardLead: React.FC<{ nome: string; bairro: string; situacao: string; score: number; toque: number }> = ({
  nome,
  bairro,
  situacao,
  score,
  toque,
}) => {
  const semSite = situacao === "SEM SITE";
  const alto = score >= 80;
  // Toque no botão: ele afunda um pouco e sai uma onda branca.
  const afunda = toque >= 0 && toque < 8 ? 0.92 : 1;
  const onda = toque >= 0 ? progresso(toque, 0, 14) : 0;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 20,
        background: COR.superficie,
        border: `1px solid ${COR.borda}`,
        clipPath: corte(12),
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 27, color: COR.branco }}>{nome}</div>
        <div style={{ marginTop: 2, fontSize: 20, color: COR.texto2 }}>{bairro}, Palhoça SC</div>
        <span
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "4px 10px",
            fontFamily: FONTE_TITULO,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "0.08em",
            background: semSite ? COR.amarelo : "transparent",
            color: semSite ? COR.preto : COR.branco,
            border: `1px solid ${semSite ? COR.amarelo : COR.branco}`,
          }}
        >
          {situacao}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            width: 62,
            height: 62,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            clipPath: corte(7),
            background: alto ? COR.amarelo : "transparent",
            border: alto ? "none" : `2px solid ${COR.amarelo}`,
            color: alto ? COR.preto : COR.amarelo,
            fontFamily: FONTE_TITULO,
            fontWeight: 700,
            fontSize: 26,
          }}
        >
          {score}
        </div>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "10px 14px",
            background: COR.amarelo,
            color: COR.preto,
            clipPath: corte(7),
            fontFamily: FONTE_TITULO,
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "0.06em",
            transform: `scale(${afunda})`,
          }}
        >
          WHATSAPP
          {onda > 0 && onda < 1 ? (
            <i
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 200 * onda,
                height: 200 * onda,
                marginLeft: -100 * onda,
                marginTop: -100 * onda,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.55)",
                opacity: 1 - onda,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Cantoneiras de mira (manual 6.5) que "travam" no lead escolhido.
const Mira: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const e = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const folga = interpolate(e, [0, 1], [60, 12]);
  const canto = (pos: React.CSSProperties, bordas: React.CSSProperties) => (
    <i style={{ position: "absolute", width: 26, height: 26, ...pos, ...bordas }} />
  );
  const linha = `4px solid ${COR.amarelo}`;
  return (
    <div style={{ position: "absolute", inset: -folga, opacity: Math.min(1, e * 1.5), pointerEvents: "none" }}>
      {canto({ left: 0, top: 0 }, { borderLeft: linha, borderTop: linha })}
      {canto({ right: 0, top: 0 }, { borderRight: linha, borderTop: linha })}
      {canto({ left: 0, bottom: 0 }, { borderLeft: linha, borderBottom: linha })}
      {canto({ right: 0, bottom: 0 }, { borderRight: linha, borderBottom: linha })}
    </div>
  );
};
