import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EstadoVazio, TituloPagina, BOTAO, BOTAO_NEUTRO, CARTAO } from "@/components/ui";
import { IconeContrato } from "@/components/Icones";
import { AvisosContrato, ConviteContratos, EtiquetaStatusContrato } from "@/components/contratos/Pecas";
import { MSG_FALTA_ETAPA24, ROTULO_STATUS, ehStatusContrato, faltaEtapa24, type StatusContrato } from "@/lib/contratos/dados";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contratos" };

interface LinhaLista {
  id: string;
  numero: string;
  titulo: string;
  status: StatusContrato;
  criado_em: string;
  enviado_em: string | null;
  cliente_assinou_em: string | null;
}

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Aba "Contratos": todos os contratos do usuário (o RLS só devolve os
// dele) e a situação de cada um.
export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  const { status } = await searchParams;
  const filtro = ehStatusContrato(status) ? status : null;

  const { data: linhas, error } = await supabase
    .from("contratos")
    .select("id, numero, titulo, status, criado_em, enviado_em, cliente_assinou_em")
    .order("criado_em", { ascending: false })
    .limit(500)
    .returns<LinhaLista[]>();

  if (error) {
    if (!faltaEtapa24(error.code)) console.error("[contratos]", error.code, error.message);
    return (
      <div>
        <TituloPagina titulo="Contratos" />
        <p className="mt-4 text-ink-2">{faltaEtapa24(error.code) ? MSG_FALTA_ETAPA24 : "Não foi possível carregar seus contratos agora."}</p>
      </div>
    );
  }

  const { data: liberado } = await supabase.rpc("meu_acesso_contratos");
  const todos = linhas ?? [];
  const visiveis = filtro ? todos.filter((c) => c.status === filtro) : todos;
  const contagem = (s: StatusContrato) => todos.filter((c) => c.status === s).length;

  return (
    <div className="max-w-5xl">
      <TituloPagina
        titulo="Contratos"
        descricao="Contratos de criação de site gerados a partir dos seus leads, com assinatura online do cliente."
      />

      <div className="mt-6 flex flex-col gap-4">
        {liberado !== true && <ConviteContratos />}
        <AvisosContrato />
      </div>

      {todos.length > 0 && (
        <nav aria-label="Filtrar por situação" className="-mx-1 mt-8 flex gap-2 overflow-x-auto px-1 pb-1">
          {([null, "rascunho", "enviado", "assinado"] as const).map((s) => {
            const ativo = filtro === s;
            return (
              <Link
                key={s ?? "todos"}
                href={s ? `?status=${s}` : "?"}
                aria-current={ativo ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap border px-4 text-sm font-semibold transition ${
                  ativo ? "border-destaque bg-primary-soft text-destaque" : "border-line bg-surface text-ink-2 hover:text-ink"
                }`}
              >
                {s ? ROTULO_STATUS[s] : "Todos"}{" "}
                <span className="font-normal opacity-80">({s ? contagem(s) : todos.length})</span>
              </Link>
            );
          })}
        </nav>
      )}

      {visiveis.length ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {visiveis.map((c) => (
            <li key={c.id} className={`${CARTAO} flex flex-col gap-3 p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-sans text-base font-extrabold text-ink">{c.titulo}</p>
                  <p className="mt-0.5 text-sm text-ink-2">Contrato nº {c.numero}</p>
                </div>
                <EtiquetaStatusContrato status={c.status} />
              </div>
              <p className="text-sm text-muted">
                {c.status === "assinado" && c.cliente_assinou_em
                  ? `Assinado pelo cliente em ${data(c.cliente_assinou_em)}`
                  : c.status === "enviado" && c.enviado_em
                    ? `Enviado em ${data(c.enviado_em)}, esperando a assinatura do cliente`
                    : `Rascunho criado em ${data(c.criado_em)}`}
              </p>
              <Link href={`/painel/contratos/${c.id}`} className={`${BOTAO_NEUTRO} self-start`}>
                Abrir contrato
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EstadoVazio
            icone={<IconeContrato width={28} height={28} />}
            titulo={filtro ? `Nenhum contrato em “${ROTULO_STATUS[filtro]}”` : "Nenhum contrato ainda"}
            texto='Em "Meus leads", mude a situação do lead para "Em negociação" ou "Fechado" e clique em "Gerar contrato".'
          >
            <Link href="/painel/meus-leads" className={BOTAO}>
              Ir para Meus leads
            </Link>
          </EstadoVazio>
        </div>
      )}
    </div>
  );
}
