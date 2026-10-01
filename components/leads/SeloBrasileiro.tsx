import { ROTULO_FORCA_BRASILEIRO, type SinalBrasileiro } from "@/lib/leads/brasileiro";

// Selo "Provável negócio brasileiro" (lib/leads/brasileiro.ts), com a
// força do sinal e o motivo em uma frase. É estimativa: o rótulo sempre
// diz "provável".
export default function SeloBrasileiro({ sinal }: { sinal: SinalBrasileiro }) {
  return (
    <p
      className="inline-flex max-w-full items-start gap-1.5 border border-destaque/40 bg-primary-soft px-2 py-1 text-xs leading-snug text-destaque"
      title="Estimativa feita pelas avaliações em português, pelo tipo do negócio e por palavras do nome."
    >
      <span aria-hidden="true">🇧🇷</span>
      <span className="min-w-0 break-words">
        <strong className="font-semibold">Provável negócio brasileiro</strong>{" "}
        <span className="opacity-90">
          ({ROTULO_FORCA_BRASILEIRO[sinal.forca]}: {sinal.motivo})
        </span>
      </span>
    </p>
  );
}
