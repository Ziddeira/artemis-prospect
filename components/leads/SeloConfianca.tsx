import { ROTULO_CONFIANCA, type Confianca, type NivelConfianca } from "@/lib/leads/confianca";

// Selo de confiança do lead (lib/leads/confianca.ts): uma bolinha com a
// cor, o rótulo e o motivo em uma frase. A cor nunca é a única pista: o
// rótulo vem escrito ao lado.
const ESTILO: Record<NivelConfianca, { caixa: string; bolinha: string }> = {
  verde: { caixa: "border-conf-verde/40 bg-conf-verde-soft text-conf-verde", bolinha: "bg-conf-verde" },
  amarelo: { caixa: "border-conf-amarelo/40 bg-conf-amarelo-soft text-conf-amarelo", bolinha: "bg-conf-amarelo" },
  vermelho: { caixa: "border-danger/40 bg-danger-soft text-danger", bolinha: "bg-danger" },
};

export default function SeloConfianca({ confianca }: { confianca: Confianca }) {
  const estilo = ESTILO[confianca.nivel];
  return (
    <p
      className={`inline-flex max-w-full items-start gap-1.5 border px-2 py-1 text-xs leading-snug ${estilo.caixa}`}
    >
      <span aria-hidden="true" className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${estilo.bolinha}`} />
      <span className="min-w-0 break-words">
        <strong className="font-semibold">{ROTULO_CONFIANCA[confianca.nivel]}:</strong> {confianca.motivo}
      </span>
    </p>
  );
}
