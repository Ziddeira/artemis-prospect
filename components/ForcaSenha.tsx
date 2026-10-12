"use client";

import { avaliarSenha, type ForcaSenha as Forca } from "@/lib/seguranca/senha";

const ROTULO: Record<Forca, string> = { fraca: "Fraca", media: "Média", forte: "Forte" };
const SEGMENTOS: Record<Forca, number> = { fraca: 1, media: 2, forte: 3 };
// Fraca em vermelho, média em laranja e forte em verde (cores de cada tema
// em app/globals.css).
const COR: Record<Forca, string> = { fraca: "bg-danger", media: "bg-conf-amarelo", forte: "bg-conf-verde" };
const COR_TEXTO: Record<Forca, string> = { fraca: "text-danger", media: "text-conf-amarelo", forte: "text-conf-verde" };

// Indicador de força da senha, com a lista do que falta. Só aparece
// depois que a pessoa começa a digitar.
export default function ForcaSenha({ id, senha, email }: { id: string; senha: string; email?: string }) {
  if (!senha) return null;
  const { forca, requisitos, dica } = avaliarSenha(senha, email);

  return (
    <div id={id} className="mt-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-1.5 flex-1 ${n <= SEGMENTOS[forca] ? COR[forca] : "bg-line-strong"}`} />
          ))}
        </div>
        <p aria-live="polite" className={`text-sm font-semibold ${COR_TEXTO[forca]}`}>
          Senha {ROTULO[forca].toLowerCase()}
        </p>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {requisitos.map((r) => (
          <li key={r.chave} className={`flex items-start gap-2 ${r.ok ? "text-ink-2" : "text-campo"}`}>
            <span aria-hidden="true" className={`w-4 shrink-0 text-center font-bold ${r.ok ? "text-ink" : "text-danger"}`}>
              {r.ok ? "✓" : "✗"}
            </span>
            <span>
              {r.texto}
              <span className="sr-only">{r.ok ? " (ok)" : " (falta)"}</span>
            </span>
          </li>
        ))}
      </ul>
      {dica && <p className="mt-1.5 text-sm text-muted">{dica}</p>}
    </div>
  );
}
