import Link from "next/link";
import { ALERTA_AVISO, BOTAO, CARTAO } from "@/components/ui";
import { ESTILO_STATUS, ROTULO_STATUS, type StatusContrato } from "@/lib/contratos/dados";
import type { DocumentoContrato } from "@/lib/contratos/texto";

// Peças repetidas nas telas do gerador de contratos (etapa 24).

// Avisos obrigatórios: aparecem em toda tela do gerador.
export function AvisosContrato({ className = "" }: { className?: string }) {
  return (
    <div role="note" className={`${ALERTA_AVISO} ${className}`}>
      <p className="font-semibold">Antes de usar, leia:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>
          Este é um <strong>modelo sugerido</strong> de contrato, montado a partir das suas respostas.
        </li>
        <li>
          Ele <strong>não substitui a orientação de um advogado</strong>. Em caso de dúvida, consulte um profissional.
        </li>
        <li>
          <strong>Você é o responsável pelo conteúdo do contrato que emitir</strong>: confira os dados e as cláusulas
          antes de enviar ao cliente.
        </li>
      </ul>
    </div>
  );
}

export function EtiquetaStatusContrato({ status }: { status: StatusContrato }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-[0.08em] ${ESTILO_STATUS[status]}`}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function ConviteContratos() {
  return (
    <div className={`${CARTAO} p-5 sm:p-6`}>
      <p className="font-display text-lg font-bold uppercase tracking-[0.08em] text-ink">Gerador de contratos</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Gere o contrato de criação de site do seu lead em poucos minutos, com cláusulas numeradas, PDF pronto e
        assinatura online do cliente pelo link, sem ele precisar criar conta. Disponível nos planos Solo, Pro e
        Platina.
      </p>
      <Link href="/painel/plano" className={`${BOTAO} mt-4`}>
        Ver planos
      </Link>
    </div>
  );
}

// O contrato para ler na tela (o mesmo texto do PDF).
export function TextoContrato({ doc }: { doc: DocumentoContrato }) {
  return (
    <article className="border border-line bg-surface px-4 py-6 text-[15px] leading-relaxed text-ink sm:px-8">
      <h2 className="text-center font-sans text-base font-extrabold text-ink sm:text-lg">{doc.titulo}</h2>
      <p className="mt-1 text-center text-sm text-muted">Contrato nº {doc.numero}</p>
      <div className="mt-6 space-y-3">
        {doc.partes.map((p) => (
          <p key={p.rotulo}>
            <strong>{p.rotulo}:</strong> {p.texto}
          </p>
        ))}
        <p>{doc.preambulo}</p>
      </div>
      {doc.clausulas.map((c, i) => (
        <section key={c.titulo} className="mt-6">
          <h3 className="font-sans text-[15px] font-extrabold text-ink">{c.titulo}</h3>
          {c.itens.map((item, j) => (
            <div key={j} className="mt-2">
              <p>
                <strong>
                  {i + 1}.{j + 1}.
                </strong>{" "}
                {item.texto}
              </p>
              {item.sub && (
                <ul className="mt-1 space-y-0.5 pl-5">
                  {item.sub.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
      <p className="mt-6">{doc.fecho}</p>
      <p className="mt-2">{doc.localData}</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {[doc.assinaturas.contratante, doc.assinaturas.contratada].map((a) => (
          <div key={a.papel} className="border-t border-ink pt-2 text-sm">
            <p className="font-semibold text-ink">{a.nome}</p>
            {a.detalhe && <p className="text-ink-2">{a.detalhe}</p>}
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted">{a.papel}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
