import React from "react";
import { Html5Audio, Sequence, measureSpring, spring, staticFile } from "remotion";
import { INICIO_LOGO, INICIO_NOME, MOLA_TRAVA } from "../cenas/CenaArtemis";
import { ENTRADA_CARTAO, TELEFONE_APARECE, WHATSAPP_ENTRA } from "../cenas/CenaLeads";
import { POUSO } from "../cenas/PinoQueda";
import { CORTES_CAMERA, INICIO_ONDAS, INICIO_PINOS_CINZAS, MOLA_QUEDA } from "../cenas/Pinos";
import { MOMENTOS_BALOES } from "../cenas/TelaConversaParada";
import { MOMENTOS_RISCOS } from "../cenas/TelaListaRiscada";
import { ARQUIVOS, VOLUMES } from "../config";
import { APROXIMA, INICIO_LISTA, QUEDA_PINO } from "../momentos";
import { CENAS, FPS } from "../tempo";

// Efeitos sonoros: cada um toca no quadro exato da animação. Como os
// momentos vêm das próprias cenas, tudo continua batendo se você mudar
// as durações no config.ts.

export const NOMES_EFEITOS = [
  "queda",
  "impacto",
  "sonar",
  "chuva",
  "corte",
  "enviar",
  "risco",
  "brilho",
  "deslizar",
  "desbloquear",
  "ding",
  "trava",
  "bolha",
] as const;
export type NomeEfeito = (typeof NOMES_EFEITOS)[number];

type Evento = { som: NomeEfeito; quadro: number; volume?: number };

// Primeiro quadro em que uma mola chega ao destino (o "pouso").
const pouso = (config: Parameters<typeof spring>[0]["config"]) => {
  for (let f = 0; f < 120; f++) if (spring({ frame: f, fps: FPS, config }) >= 1) return f;
  return measureSpring({ fps: FPS, config });
};

const eventos = (): Evento[] => {
  const { pinos, dificil, leads, artemis, comenta } = CENAS;
  const r = Math.round;
  const lista: Evento[] = [
    // Cena 1: o pino cai, bate no chão e pulsa; os cinzas chovem; dois cortes.
    { som: "queda", quadro: pinos.de, volume: 0.8 },
    { som: "impacto", quadro: pinos.de + pouso(MOLA_QUEDA) },
    { som: "sonar", quadro: pinos.de + INICIO_ONDAS, volume: 0.7 },
    { som: "chuva", quadro: pinos.de + r(pinos.duracao * INICIO_PINOS_CINZAS) },
    ...CORTES_CAMERA.map((f) => ({ som: "corte" as const, quadro: pinos.de + r(pinos.duracao * f), volume: 0.7 })),

    // Cena 2: o celular estala, mensagens saem sem resposta, cortes e riscos.
    { som: "corte", quadro: dificil.de },
    ...MOMENTOS_BALOES(dificil.duracao).map((q) => ({ som: "enviar" as const, quadro: dificil.de + q, volume: 0.8 })),
    { som: "corte", quadro: APROXIMA, volume: 0.7 },
    { som: "corte", quadro: INICIO_LISTA, volume: 0.7 },
    ...MOMENTOS_RISCOS.map((q) => ({ som: "risco" as const, quadro: INICIO_LISTA + q, volume: 0.8 })),

    // Passagem para a cena 3: o pino cai no celular e a tela acende.
    { som: "queda", quadro: QUEDA_PINO, volume: 0.6 },
    { som: "impacto", quadro: QUEDA_PINO + POUSO, volume: 0.5 },
    { som: "brilho", quadro: QUEDA_PINO + POUSO },

    // Cena 4: cartões deslizando, telefone desbloqueado e o WhatsApp.
    ...ENTRADA_CARTAO.map((f) => ({ som: "deslizar" as const, quadro: leads.de + r(leads.duracao * f), volume: 0.7 })),
    { som: "desbloquear", quadro: leads.de + r(leads.duracao * TELEFONE_APARECE) },
    { som: "ding", quadro: leads.de + r(leads.duracao * WHATSAPP_ENTRA) },

    // Cena 5: a cabeça entra, a mira trava e a logo brilha.
    { som: "deslizar", quadro: artemis.de },
    { som: "trava", quadro: artemis.de + r(artemis.duracao * INICIO_LOGO) + pouso(MOLA_TRAVA) },
    { som: "brilho", quadro: artemis.de + r(artemis.duracao * INICIO_LOGO) + 12, volume: 0.8 },
    { som: "deslizar", quadro: artemis.de + r(artemis.duracao * INICIO_NOME), volume: 0.5 },

    // Cena 6: pancada no corte e o balão aparecendo.
    { som: "impacto", quadro: comenta.de },
    { som: "corte", quadro: comenta.de, volume: 0.8 },
    { som: "bolha", quadro: comenta.de + 4 },
  ];
  return lista;
};

export const Efeitos: React.FC<{ disponiveis: string[] }> = ({ disponiveis }) => (
  <>
    {eventos()
      .filter((e) => disponiveis.includes(e.som))
      .map((e, i) => (
        <Sequence key={i} from={e.quadro} durationInFrames={FPS * 3} layout="none">
          <Html5Audio
            src={staticFile(`${ARQUIVOS.pastaDosEfeitos}/${e.som}.wav`)}
            volume={VOLUMES.efeitos * (e.volume ?? 1)}
          />
        </Sequence>
      ))}
  </>
);
