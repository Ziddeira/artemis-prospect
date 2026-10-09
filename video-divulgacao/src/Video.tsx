import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CenaFinal } from "./cenas/CenaFinal";
import { PinoQueda, POUSO } from "./cenas/PinoQueda";
import { Pinos } from "./cenas/Pinos";
import { TelaApp } from "./cenas/TelaApp";
import { TelaConversaNova } from "./cenas/TelaConversaNova";
import { TelaConversaParada } from "./cenas/TelaConversaParada";
import { TelaListaRiscada } from "./cenas/TelaListaRiscada";
import { Celular } from "./componentes/Celular";
import { Legenda } from "./componentes/Legenda";
import { progresso } from "./componentes/util";
import { CENAS, COR } from "./marca";

// Linha do tempo do vídeo inteiro (30s a 30 quadros por segundo).
// Cada <Sequence> diz em que quadro um pedaço começa ("from") e por
// quantos quadros ele fica na tela ("durationInFrames").

// Legendas: texto e trecho em amarelo de cada cena.
const LEGENDAS = [
  { cena: CENAS.pinos, atraso: 14, texto: "Sua cidade tem centenas de empresas sem site.", destaque: "sem site" },
  { cena: CENAS.dificil, atraso: 22, texto: "Achar cliente é a parte difícil.", destaque: "a parte difícil" },
  { cena: CENAS.busca, atraso: 16, texto: "O Ártemis Prospect mostra quem ainda não tem site.", destaque: "ainda não tem site" },
  { cena: CENAS.whatsapp, atraso: 4, texto: "Toque e chame no WhatsApp com a mensagem pronta.", destaque: "mensagem pronta" },
  { cena: CENAS.resposta, atraso: 4, texto: "Menos tempo procurando. Mais tempo vendendo.", destaque: "Mais tempo vendendo." },
];

// Quando cada tela aparece dentro do celular.
const QUEDA_PINO = 228; // 7,6s: o pino amarelo cai no celular
const TELAS = {
  conversaParada: { de: CENAS.dificil.de, ate: 172 },
  listaRiscada: { de: 164, ate: 254 },
  app: { de: QUEDA_PINO + POUSO + 2, ate: 482 },
  conversaNova: { de: 472, ate: 780 },
};

export const Video: React.FC = () => (
  <AbsoluteFill style={{ background: COR.preto }}>
    {/* Cena 1: pinos (ficam até sumirem no começo da cena 2) */}
    <Sequence durationInFrames={CENAS.pinos.ate + 30}>
      <Pinos />
    </Sequence>

    {/* Cenas 2 a 5: o celular */}
    <CelularNaTela />

    <Sequence from={QUEDA_PINO} durationInFrames={32}>
      <PinoQueda />
    </Sequence>

    {/* Cena 6: fechamento */}
    <Sequence from={CENAS.final.de}>
      <CenaFinal />
    </Sequence>

    {LEGENDAS.map(({ cena, atraso, texto, destaque }) => (
      <Sequence key={texto} from={cena.de + atraso} durationInFrames={cena.ate - cena.de - atraso}>
        <Legenda texto={texto} destaque={destaque} duracao={cena.ate - cena.de - atraso} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

const CelularNaTela: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inicio = CENAS.dificil.de + 2;
  const fim = CENAS.final.de;
  if (frame < inicio || frame > fim + 26) return null;

  // Sobe de baixo no começo da cena 2 e desce no começo da cena 6.
  const entra = spring({ frame: frame - inicio, fps, config: { damping: 200 }, durationInFrames: 22 });
  const sai = progresso(frame, fim, fim + 22);
  const y = (1 - entra) * 1500 + interpolate(sai, [0, 1], [0, 1200], { easing: (t) => t * t });

  return (
    <Celular style={{ transform: `translateY(${y}px)`, opacity: 1 - sai * 0.6 }}>
      <Trecho {...TELAS.conversaParada}>
        <TelaConversaParada />
      </Trecho>
      <Trecho {...TELAS.listaRiscada} entrada={8}>
        <TelaListaRiscada />
      </Trecho>
      <Trecho {...TELAS.app}>
        <TelaApp />
      </Trecho>
      <Trecho {...TELAS.conversaNova} entrada={10} desliza>
        <TelaConversaNova />
      </Trecho>
    </Celular>
  );
};

// Uma tela do celular entre dois quadros, com entrada suave opcional
// (a tela nova aparece por cima da anterior).
const Trecho: React.FC<{
  de: number;
  ate: number;
  entrada?: number;
  desliza?: boolean;
  children: React.ReactNode;
}> = ({ de, ate, entrada = 0, desliza, children }) => (
  <Sequence from={de} durationInFrames={ate - de} layout="none">
    <Entrada quadros={entrada} desliza={desliza}>
      {children}
    </Entrada>
  </Sequence>
);

const Entrada: React.FC<{ quadros: number; desliza?: boolean; children: React.ReactNode }> = ({
  quadros,
  desliza,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = quadros > 0 ? progresso(frame, 0, quadros) : 1;
  return (
    <AbsoluteFill style={{ opacity: p, transform: desliza ? `translateX(${(1 - p) * 60}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};
