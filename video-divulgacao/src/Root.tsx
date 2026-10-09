import React from "react";
import { Composition } from "remotion";
import { DURACAO, FPS } from "./marca";
import { Video } from "./Video";

// Registra o vídeo: 1080 x 1920 (vertical), 30 quadros por segundo, 30 segundos.
export const RemotionRoot: React.FC = () => (
  <Composition id="Divulgacao" component={Video} durationInFrames={DURACAO} fps={FPS} width={1080} height={1920} />
);
