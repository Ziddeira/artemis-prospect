import React from "react";
import { Html5Audio, Sequence, interpolate, staticFile } from "remotion";
import { Recursos } from "../arquivos";
import { ARQUIVOS, VOLUMES } from "../config";
import { DURACAO_TOTAL, s } from "../tempo";

// Narração, música (com ducking) e os "pops" das etiquetas.
// Cada som só entra se o arquivo existir e não estiver vazio.
export const Trilha: React.FC<{ recursos: Recursos; momentosDoPop: number[] }> = ({ recursos, momentosDoPop }) => (
  <>
    {recursos.temNarracao ? <Html5Audio src={staticFile(ARQUIVOS.narracao)} volume={VOLUMES.narracao} /> : null}

    {recursos.temMusica ? (
      <Html5Audio
        src={staticFile(ARQUIVOS.musica)}
        loop
        // Se a música for mais curta que o vídeo, ela repete; o "extend" faz o
        // volume seguir o relógio do vídeo, e não recomeçar a cada repetição.
        loopVolumeCurveBehavior="extend"
        volume={(quadro) => {
          // Sem narração, a curva fica vazia e a música fica no volume normal.
          const base = recursos.volumeMusica[quadro] ?? VOLUMES.musica;
          // Entra suave no começo e some no último segundo e meio.
          const fade = interpolate(quadro, [0, s(0.5), DURACAO_TOTAL - s(1.5), DURACAO_TOTAL], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return base * fade;
        }}
      />
    ) : null}

    {recursos.temPop
      ? momentosDoPop.map((quadro) => (
          <Sequence key={quadro} from={quadro} durationInFrames={s(1.5)} layout="none">
            <Html5Audio src={staticFile(ARQUIVOS.pop)} volume={VOLUMES.pop} />
          </Sequence>
        ))
      : null}
  </>
);
