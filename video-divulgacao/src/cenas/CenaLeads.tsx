import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { progresso } from "../componentes/util";
import { COR, FONTE_TEXTO, FONTE_TITULO, corte } from "../marca";

// Cena 4: três cartões de lead entrando um depois do outro, com calma.
// No último, o telefone é desbloqueado e entra o botão verde de WhatsApp.
// Os nomes e o telefone são inventados.

type Etiqueta = "SEM SITE" | "SÓ INSTAGRAM" | "DEPENDE DO AIRBNB";

const LEADS: {
  nome: string;
  tipo: string;
  local: string;
  etiqueta: Etiqueta;
  nota: number;
  estrelas: string;
  avaliacoes: number;
}[] = [
  {
    nome: "Barbearia do Zé",
    tipo: "Barbearia",
    local: "Centro, Palhoça SC",
    etiqueta: "SEM SITE",
    nota: 94,
    estrelas: "4,8",
    avaliacoes: 127,
  },
  {
    nome: "Studio Bella Unhas",
    tipo: "Manicure",
    local: "Pagani, Palhoça SC",
    etiqueta: "SÓ INSTAGRAM",
    nota: 88,
    estrelas: "4,9",
    avaliacoes: 86,
  },
  {
    nome: "Pousada Mar Azul",
    tipo: "Pousada",
    local: "Pinheira, Palhoça SC",
    etiqueta: "DEPENDE DO AIRBNB",
    nota: 91,
    estrelas: "4,7",
    avaliacoes: 203,
  },
];

const TELEFONE = "(48) 99123-4567";

// Momentos da cena, em frações da duração (0 = começo, 1 = fim).
// O Video.tsx usa ENTRADA_ETIQUETA para tocar o "pop" na hora certa.
const ENTRADA_CARTAO = [0.05, 0.25, 0.45];
const ATRASO_ETIQUETA = 0.07;
const TELEFONE_APARECE = 0.68;
const WHATSAPP_ENTRA = 0.78;

export const ENTRADA_ETIQUETA = (duracao: number) =>
  ENTRADA_CARTAO.map((f) => Math.round((f + ATRASO_ETIQUETA) * duracao));

export const CenaLeads: React.FC<{ duracao: number }> = ({ duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const etiquetas = ENTRADA_ETIQUETA(duracao);

  return (
    <AbsoluteFill style={{ background: COR.fundo, fontFamily: FONTE_TEXTO }}>
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 100,
          right: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: progresso(frame, 0, 12),
        }}
      >
        <span
          style={{
            fontFamily: FONTE_TITULO,
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: "0.3em",
            color: COR.amarelo,
          }}
        >
          LEADS NA MIRA
        </span>
        <span style={{ fontSize: 26, fontWeight: 600, color: COR.texto2 }}>Palhoça SC</span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 400,
          left: 100,
          right: 100,
          display: "flex",
          flexDirection: "column",
          gap: 34,
        }}
      >
        {LEADS.map((lead, i) => {
          // Entrada calma: sobe um pouco e aparece, sem quique.
          const entrada = spring({
            frame: frame - Math.round(ENTRADA_CARTAO[i] * duracao),
            fps,
            config: { damping: 200 },
            durationInFrames: 22,
          });
          const ultimo = i === LEADS.length - 1;
          return (
            <div key={lead.nome} style={{ opacity: entrada, transform: `translateY(${(1 - entrada) * 70}px)` }}>
              <Cartao
                {...lead}
                quadroEtiqueta={frame - etiquetas[i]}
                quadroTelefone={ultimo ? frame - Math.round(TELEFONE_APARECE * duracao) : null}
                quadroWhatsapp={ultimo ? frame - Math.round(WHATSAPP_ENTRA * duracao) : null}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Cartao: React.FC<{
  nome: string;
  tipo: string;
  local: string;
  etiqueta: Etiqueta;
  nota: number;
  estrelas: string;
  avaliacoes: number;
  quadroEtiqueta: number;
  quadroTelefone: number | null;
  quadroWhatsapp: number | null;
}> = ({ nome, tipo, local, etiqueta, nota, estrelas, avaliacoes, quadroEtiqueta, quadroTelefone, quadroWhatsapp }) => {
  const { fps } = useVideoConfig();
  // A etiqueta "estala": cresce um pouco além do tamanho e volta (junto com o pop).
  const estalo = spring({ frame: quadroEtiqueta, fps, config: { damping: 9, stiffness: 220 } });
  const comContato = quadroTelefone !== null;
  const telefone = comContato ? progresso(quadroTelefone, 0, 10) : 0;
  const whatsapp =
    quadroWhatsapp !== null ? spring({ frame: quadroWhatsapp, fps, config: { damping: 15, stiffness: 140 } }) : 0;

  return (
    <div
      style={{
        padding: "30px 32px",
        background: COR.superficie,
        border: `1px solid ${COR.borda}`,
        clipPath: corte(14),
      }}
    >
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 42, lineHeight: 1.1, color: COR.branco }}>{nome}</div>
          <div style={{ marginTop: 6, fontSize: 26, color: COR.texto2 }}>
            {tipo} · {local}
          </div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                ...estiloEtiqueta(etiqueta),
                opacity: Math.min(1, estalo * 2),
                transform: `scale(${estalo})`,
                transformOrigin: "0 50%",
              }}
            >
              {etiqueta}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 25,
                fontWeight: 600,
                color: COR.textoCampo,
              }}
            >
              <Estrela />
              {estrelas}
              <span style={{ fontWeight: 500, color: COR.texto3 }}>({avaliacoes} avaliações)</span>
            </span>
          </div>
        </div>
        <Nota valor={nota} />
      </div>

      {comContato ? (
        <div style={{ marginTop: 24, paddingTop: 22, borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ position: "relative", height: 50 }}>
            {/* Antes: botão "Desbloquear". Depois: o telefone aparece. */}
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                border: `1px solid ${COR.bordaForte}`,
                color: COR.textoCampo,
                fontFamily: FONTE_TITULO,
                fontWeight: 600,
                fontSize: 22,
                opacity: 1 - telefone,
              }}
            >
              <Cadeado /> DESBLOQUEAR
            </span>
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontFamily: FONTE_TITULO,
                fontWeight: 700,
                fontSize: 40,
                letterSpacing: "0.02em",
                color: COR.branco,
                opacity: telefone,
                transform: `translateY(${(1 - telefone) * 16}px)`,
              }}
            >
              <Telefone /> {TELEFONE}
            </span>
          </div>
          <div style={{ height: 96 * whatsapp, marginTop: 20 * whatsapp, overflow: "hidden" }}>
            <div
              style={{
                height: 84,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                background: COR.whatsapp,
                color: COR.preto,
                clipPath: corte(12),
                fontFamily: FONTE_TITULO,
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: "0.06em",
                transform: `translateY(${(1 - whatsapp) * 60}px) scale(${0.9 + 0.1 * whatsapp})`,
              }}
            >
              <IconeWhatsapp /> CHAMAR NO WHATSAPP
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// Estilos das etiquetas do manual (6.3): cheia = mais urgente; contorno
// amarelo = oportunidade; contorno branco = informativo.
const estiloEtiqueta = (etiqueta: Etiqueta): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: "6px 14px",
    fontFamily: FONTE_TITULO,
    fontWeight: 600,
    fontSize: 22,
    letterSpacing: "0.08em",
  };
  if (etiqueta === "SEM SITE")
    return { ...base, background: COR.amarelo, color: COR.preto, border: `2px solid ${COR.amarelo}` };
  if (etiqueta === "DEPENDE DO AIRBNB") return { ...base, color: COR.amarelo, border: `2px solid ${COR.amarelo}` };
  return { ...base, color: COR.branco, border: `2px solid ${COR.branco}` };
};

// Badge de nota (manual 6.4): 80+ cheio; 70–79 contorno amarelo.
const Nota: React.FC<{ valor: number }> = ({ valor }) => {
  const alto = valor >= 80;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 96,
          height: 96,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          clipPath: corte(10),
          background: alto ? COR.amarelo : "transparent",
          border: alto ? "none" : `3px solid ${COR.amarelo}`,
          color: alto ? COR.preto : COR.amarelo,
          fontFamily: FONTE_TITULO,
          fontWeight: 700,
          fontSize: 42,
        }}
      >
        {valor}
      </div>
      <span
        style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 17, letterSpacing: "0.2em", color: COR.texto3 }}
      >
        NOTA
      </span>
    </div>
  );
};

const Estrela: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill={COR.amarelo} />
  </svg>
);

const Cadeado: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={COR.textoCampo}
    strokeWidth="2"
    strokeLinecap="square"
  >
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const Telefone: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke={COR.amarelo}
    strokeWidth="2"
    strokeLinecap="square"
  >
    <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
  </svg>
);

// Mesmo desenho do ícone de WhatsApp do site (components/Icones.tsx).
const IconeWhatsapp: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COR.preto} strokeWidth="2" strokeLinecap="square">
    <path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" />
  </svg>
);
