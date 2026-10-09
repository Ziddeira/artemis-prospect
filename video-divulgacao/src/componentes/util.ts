import { interpolate } from "remotion";

// Valor que vai de 0 a 1 entre dois quadros (e fica parado fora deles).
export const progresso = (frame: number, de: number, ate: number) =>
  interpolate(frame, [de, ate], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// Texto aparecendo letra por letra, como se alguém estivesse digitando.
export const digitado = (texto: string, frame: number, inicio: number, letrasPorQuadro = 0.6) =>
  texto.slice(0, Math.max(0, Math.floor((frame - inicio) * letrasPorQuadro)));
