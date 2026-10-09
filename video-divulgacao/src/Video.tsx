import React from "react";
import { AbsoluteFill, Sequence, getRemotionEnvironment, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Recursos } from "./arquivos";
import { CenaArtemis } from "./cenas/CenaArtemis";
import { CenaComenta } from "./cenas/CenaComenta";
import { CenaLeads, ENTRADA_ETIQUETA } from "./cenas/CenaLeads";
import { PinoQueda, POUSO } from "./cenas/PinoQueda";
import { Pinos } from "./cenas/Pinos";
import { TelaConversaParada } from "./cenas/TelaConversaParada";
import { TelaGravacao } from "./cenas/TelaGravacao";
import { TelaListaRiscada } from "./cenas/TelaListaRiscada";
import { Celular } from "./componentes/Celular";
import { Legenda } from "./componentes/Legenda";
import { Trilha } from "./componentes/Trilha";
import { progresso } from "./componentes/util";
import { ARQUIVOS, LEGENDAS } from "./config";
import { COR, FONTE_TEXTO } from "./marca";
import { CENAS, DURACAO_TOTAL, FPS, ORDEM_DAS_CENAS } from "./tempo";

// Linha do tempo do vídeo inteiro. Os tempos vêm do config.ts.
// Cada <Sequence> diz em que quadro um pedaço começa ("from") e por
// quantos quadros ele fica na tela ("durationInFrames").

const { pinos, dificil, busca, leads, artemis, comenta } = CENAS;

// Dentro da cena 2: primeiro a conversa, depois (corte seco) a lista.
const INICIO_LISTA = dificil.de + Math.round(dificil.duracao * 0.42);
// O pino amarelo cai no celular um pouco antes da cena 3 e abre a gravação.
const QUEDA_PINO = busca.de - 12;
const INICIO_GRAVACAO = QUEDA_PINO + POUSO;

export const Video: React.FC<Recursos> = (recursos) => {
  const momentosDoPop = ENTRADA_ETIQUETA(leads.duracao).map((q) => leads.de + q);

  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      {/* 1. Pinos (somem rapidinho no começo da cena 2) */}
      <Sequence durationInFrames={pinos.ate + 12}>
        <Pinos duracao={pinos.duracao} />
      </Sequence>

      {/* 2 e 3. O celular */}
      <CelularNaTela recursos={recursos} />
      <Sequence from={QUEDA_PINO} durationInFrames={32}>
        <PinoQueda />
      </Sequence>

      {/* 4. Cartões de lead */}
      <Sequence from={leads.de} durationInFrames={leads.duracao + 8}>
        <Entrada quadros={10}>
          <CenaLeads duracao={leads.duracao} />
        </Entrada>
      </Sequence>

      {/* 5. Ártemis e logo */}
      <Sequence from={artemis.de} durationInFrames={artemis.duracao}>
        <Entrada quadros={8}>
          <CenaArtemis duracao={artemis.duracao} temCabeca={recursos.temCabeca} temLogo={recursos.temLogo} />
        </Entrada>
      </Sequence>

      {/* 6. Comenta ÁRTEMIS (corte seco) */}
      <Sequence from={comenta.de} durationInFrames={comenta.duracao}>
        <CenaComenta />
      </Sequence>

      {/* Legendas */}
      {ORDEM_DAS_CENAS.map((nome) => {
        const legenda = LEGENDAS[nome];
        if (!legenda) return null;
        const cena = CENAS[nome];
        // Na cena 1 a legenda espera o pino cair; nas outras entra logo.
        const atraso = nome === "pinos" ? Math.round(cena.duracao * 0.15) : 6;
        const duracao = cena.duracao - atraso;
        return (
          <Sequence key={nome} from={cena.de + atraso} durationInFrames={duracao}>
            <Legenda texto={legenda.texto} destaque={legenda.destaque} duracao={duracao} />
          </Sequence>
        );
      })}

      <Trilha recursos={recursos} momentosDoPop={momentosDoPop} />
      {getRemotionEnvironment().isStudio ? <AvisosDoEditor recursos={recursos} /> : null}
    </AbsoluteFill>
  );
};

const CelularNaTela: React.FC<{ recursos: Recursos }> = ({ recursos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inicio = dificil.de;
  const fim = leads.de;
  if (frame < inicio || frame > fim + 14) return null;

  // Cena 2, ritmo rápido: o celular "estala" na tela em poucos quadros...
  const entra = spring({ frame: frame - inicio, fps, config: { damping: 200 }, durationInFrames: 7 });
  // ...e há um corte seco aproximando do balão sem resposta.
  const aproxima = frame >= inicio + dificil.duracao * 0.18 && frame < INICIO_LISTA ? 1.3 : 1;
  // Cena 3 para a 4, com calma: o celular encolhe e some.
  const sai = progresso(frame, fim, fim + 14);

  return (
    <Celular
      semBarraDeStatus={recursos.temGravacao && frame >= INICIO_GRAVACAO}
      style={{
        transform: `scale(${(0.85 + 0.15 * entra) * aproxima * (1 - 0.08 * sai)})`,
        // Aproxima a partir de baixo (o celular cresce para cima e não
        // invade a legenda); o balão "oi, tudo bem?" fica bem no meio.
        transformOrigin: "75% 95%",
        opacity: Math.min(1, entra * 2) * (1 - sai),
      }}
    >
      <Trecho de={dificil.de} ate={INICIO_LISTA + 1}>
        <TelaConversaParada duracao={dificil.duracao} />
      </Trecho>
      <Trecho de={INICIO_LISTA} ate={INICIO_GRAVACAO + 1}>
        <TelaListaRiscada />
      </Trecho>
      <Trecho de={INICIO_GRAVACAO} ate={fim + 15}>
        <Revela>
          <TelaGravacao temGravacao={recursos.temGravacao} duracaoGravacao={recursos.duracaoGravacao} />
        </Revela>
      </Trecho>
    </Celular>
  );
};

// Uma tela do celular entre dois quadros (a de baixo some quando a de cima chega).
const Trecho: React.FC<{ de: number; ate: number; children: React.ReactNode }> = ({ de, ate, children }) => (
  <Sequence from={de} durationInFrames={ate - de} layout="none">
    <AbsoluteFill>{children}</AbsoluteFill>
  </Sequence>
);

// Círculo que se abre a partir de onde o pino amarelo caiu.
const Revela: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const raio = progresso(frame, 0, 16) * 140;
  return <AbsoluteFill style={{ clipPath: `circle(${raio}% at 50% 38%)` }}>{children}</AbsoluteFill>;
};

// Entrada suave (cenas 4 e 5).
const Entrada: React.FC<{ quadros: number; children: React.ReactNode }> = ({ quadros, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: progresso(frame, 0, quadros) }}>{children}</AbsoluteFill>;
};

// Avisos que aparecem SÓ no editor (npm run previa), nunca no MP4:
// arquivos seus que ainda faltam e narração maior que o vídeo.
const AvisosDoEditor: React.FC<{ recursos: Recursos }> = ({ recursos }) => {
  const faltando = [
    !recursos.temNarracao && ARQUIVOS.narracao,
    !recursos.temMusica && ARQUIVOS.musica,
    !recursos.temPop && ARQUIVOS.pop,
    !recursos.temGravacao && ARQUIVOS.gravacaoDeTela,
    !recursos.temCabeca && ARQUIVOS.cabecaArtemis,
    !recursos.temLogo && ARQUIVOS.logo,
  ].filter(Boolean);
  const duracaoVideo = DURACAO_TOTAL / FPS;
  const narracaoSobra = recursos.duracaoNarracao > duracaoVideo;
  if (faltando.length === 0 && !narracaoSobra) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        right: 24,
        padding: "12px 16px",
        background: "rgba(255,138,128,0.95)",
        color: COR.preto,
        fontFamily: FONTE_TEXTO,
        fontWeight: 700,
        fontSize: 22,
        lineHeight: 1.35,
      }}
    >
      {narracaoSobra ? (
        <div style={{ marginBottom: faltando.length ? 10 : 0 }}>
          A narração tem {recursos.duracaoNarracao.toFixed(1).replace(".", ",")}s e o vídeo{" "}
          {duracaoVideo.toFixed(1).replace(".", ",")}s: aumente as durações em src/config.ts.
        </div>
      ) : null}
      {faltando.length ? "Arquivos vazios ou faltando (aviso só no editor):" : null}
      {faltando.map((f) => (
        <div key={String(f)} style={{ fontWeight: 500 }}>
          public/{f}
        </div>
      ))}
    </div>
  );
};
