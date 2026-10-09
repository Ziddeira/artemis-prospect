import React from "react";
import { Composition } from "remotion";
import { RECURSOS_VAZIOS, prepararVideo } from "./arquivos";
import { DURACAO_TOTAL, FPS } from "./tempo";
import { Video } from "./Video";

// Registra o vídeo: 1080 x 1920 (vertical), 30 quadros por segundo.
// A duração é a soma das cenas do config.ts. Antes de começar, o
// "prepararVideo" confere quais arquivos seus existem.
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Divulgacao"
    component={Video}
    durationInFrames={DURACAO_TOTAL}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={RECURSOS_VAZIOS}
    calculateMetadata={async () => ({ props: await prepararVideo(), durationInFrames: DURACAO_TOTAL })}
  />
);
