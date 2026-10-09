import React from "react";
import { AbsoluteFill, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PinoArtemis, PinoCinza } from "../componentes/Pino";
import { progresso } from "../componentes/util";
import { COR } from "../marca";

// Cena 1 e a saída dos pinos no começo da cena 2.
// O pino amarelo cai no centro e pulsa; os cinzas surgem em ondas a partir
// dele até cobrir a tela. Dois cortes secos de "câmera" (aproxima e volta)
// dão o ritmo rápido. Quando a cena acaba ("duracao"), tudo some.

const PONTA = { x: 540, y: 900 }; // onde a ponta do pino amarelo encosta
const LARGURA_AMARELO = 190;
// Exportados para os efeitos sonoros (Efeitos.tsx) baterem com a imagem.
export const MOLA_QUEDA = { damping: 11, stiffness: 120, mass: 0.9 };
export const CORTES_CAMERA = [0.5, 0.78]; // frações da cena 1
export const INICIO_PINOS_CINZAS = 0.2;
export const INICIO_ONDAS = 16;

// Atraso e saída de cada pino são frações da duração da cena (0 a 1),
// para a animação acompanhar se você mudar o tempo no config.ts.
type PinoGerado = { x: number; y: number; largura: number; atraso: number; saida: number };

// Uma grade de 7 x 12 com um sorteio fixo (random com "semente" sempre dá o
// mesmo número), para os pinos ficarem espalhados mas iguais a cada render.
const PINOS: PinoGerado[] = (() => {
  const colunas = 7;
  const linhas = 12;
  const lc = 1080 / colunas;
  const ll = 1920 / linhas;
  const lista: PinoGerado[] = [];
  for (let c = 0; c < colunas; c++) {
    for (let l = 0; l < linhas; l++) {
      const x = (c + 0.5) * lc + (random(`x${c}-${l}`) - 0.5) * lc * 0.75;
      const y = (l + 0.75) * ll + (random(`y${c}-${l}`) - 0.5) * ll * 0.6;
      // Deixa um espaço livre em volta do pino amarelo.
      const distancia = Math.hypot(x - PONTA.x, y - (PONTA.y - 110));
      if (distancia < 250) continue;
      lista.push({
        x,
        y,
        largura: 44 + random(`t${c}-${l}`) * 32,
        atraso: INICIO_PINOS_CINZAS + (distancia / 1100) * 0.45 + random(`a${c}-${l}`) * 0.06,
        saida: random(`s${c}-${l}`) * 4,
      });
    }
  }
  // Quem está mais embaixo é desenhado por cima.
  return lista.sort((a, b) => a.y - b.y);
})();

export const Pinos: React.FC<{ duracao: number }> = ({ duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SAIDA = duracao;
  // Cortes secos: aproxima no meio da cena e volta perto do fim.
  const camera = frame >= duracao * CORTES_CAMERA[0] && frame < duracao * CORTES_CAMERA[1] ? 1.18 : 1;

  // Queda com um quique no final.
  const queda = spring({ frame, fps, config: MOLA_QUEDA });
  // Pulso suave depois que pousa.
  const pulso = frame > 20 ? 1 + 0.05 * Math.sin(((frame - 20) / 15) * Math.PI) : 1;
  const saidaAmarelo = 1 - progresso(frame, SAIDA, SAIDA + 8);
  const alturaAmarelo = LARGURA_AMARELO * 1.3;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${camera})`, transformOrigin: `${PONTA.x}px ${PONTA.y - 120}px` }}>
        {PINOS.map((p, i) => {
          const entrada = spring({ frame: frame - p.atraso * duracao, fps, config: { damping: 14, stiffness: 160 } });
          const saida =
            1 - spring({ frame: frame - SAIDA - p.saida, fps, config: { damping: 200 }, durationInFrames: 6 });
          const escala = entrada * saida;
          if (escala <= 0.001) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x - p.largura / 2,
                top: p.y - p.largura * 1.3,
                transformOrigin: "50% 100%",
                transform: `translateY(${(1 - entrada) * -40}px) scale(${escala})`,
                opacity: Math.min(1, entrada * 1.5) * saida,
              }}
            >
              <PinoCinza largura={p.largura} />
            </div>
          );
        })}

        {/* Ondas que saem do pino amarelo, deitadas no "chão" */}
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: saidaAmarelo }}>
          {[0, 1, 2].map((k) => {
            const inicio = INICIO_ONDAS + k * 12;
            if (frame < inicio) return null;
            const t = ((frame - inicio) % 36) / 36;
            const r = 30 + t * 280;
            return (
              <ellipse
                key={k}
                cx={PONTA.x}
                cy={PONTA.y}
                rx={r}
                ry={r * 0.32}
                fill="none"
                stroke={COR.amarelo}
                strokeWidth={4}
                opacity={(1 - t) * 0.7}
              />
            );
          })}
          <ellipse cx={PONTA.x} cy={PONTA.y} rx={46 * queda} ry={12 * queda} fill={COR.amarelo} opacity={0.25} />
        </svg>

        <div
          style={{
            position: "absolute",
            left: PONTA.x - LARGURA_AMARELO / 2,
            top: PONTA.y - alturaAmarelo,
            transformOrigin: "50% 100%",
            transform: `translateY(${(1 - queda) * -1100}px) scale(${pulso * saidaAmarelo})`,
            opacity: saidaAmarelo,
          }}
        >
          <PinoArtemis largura={LARGURA_AMARELO} />
        </div>
      </AbsoluteFill>

      {/* Escurece a faixa da legenda para o texto ler bem por cima dos pinos */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1180,
          height: 600,
          background: `linear-gradient(to bottom, rgba(13,13,13,0) 0%, rgba(13,13,13,0.92) 30%, rgba(13,13,13,0.92) 75%, rgba(13,13,13,0) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
