import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TituloPagina, BOTAO_NEUTRO } from "@/components/ui";
import { AvisosContrato, ConviteContratos, EtiquetaStatusContrato, TextoContrato } from "@/components/contratos/Pecas";
import { MSG_FALTA_ETAPA24, faltaEtapa24, pendencias, validarDadosContrato } from "@/lib/contratos/dados";
import { ehDocumentoContrato, montarContrato } from "@/lib/contratos/texto";
import { URL_SITE } from "@/lib/site";
import type { DadosLead } from "@/lib/leads/dadosLead";
import ContratoClient, { type ContratoTela } from "./ContratoClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contrato" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Linha {
  id: string;
  place_id: string;
  numero: string;
  titulo: string;
  dados: unknown;
  status: "rascunho" | "enviado" | "assinado";
  conteudo: unknown;
  token: string | null;
  link_expira_em: string | null;
  pdf_original_hash: string | null;
  pdf_assinado_hash: string | null;
  enviado_em: string | null;
  prestador_nome: string | null;
  prestador_email: string | null;
  prestador_ip: string | null;
  prestador_assinou_em: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_ip: string | null;
  cliente_assinou_em: string | null;
  criado_em: string;
}

// Endereço do site para montar o link público (o mesmo em que a pessoa
// está; em produção, o domínio oficial).
async function origem() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return URL_SITE;
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  // O RLS só devolve o contrato se for do usuário logado.
  const { data: c, error } = await supabase
    .from("contratos")
    .select(
      "id, place_id, numero, titulo, dados, status, conteudo, token, link_expira_em, pdf_original_hash, pdf_assinado_hash, enviado_em, prestador_nome, prestador_email, prestador_ip, prestador_assinou_em, cliente_nome, cliente_email, cliente_ip, cliente_assinou_em, criado_em",
    )
    .eq("id", id)
    .maybeSingle<Linha>();
  if (error) {
    return (
      <div>
        <TituloPagina titulo="Contrato" />
        <p className="mt-4 text-ink-2">{faltaEtapa24(error.code) ? MSG_FALTA_ETAPA24 : "Não foi possível abrir o contrato agora."}</p>
      </div>
    );
  }
  if (!c) notFound();

  const validado = validarDadosContrato(c.dados);
  const dados = "dados" in validado ? validado.dados : null;
  const doc = ehDocumentoContrato(c.conteudo)
    ? c.conteudo
    : dados
      ? montarContrato(dados, { numero: c.numero, data: new Date() })
      : null;

  const [{ data: liberado }, { data: perfil }, { data: lead }] = await Promise.all([
    supabase.rpc("meu_acesso_contratos"),
    supabase.from("profiles").select("assinatura_path").maybeSingle<{ assinatura_path: string | null }>(),
    supabase
      .from("leads_desbloqueados")
      .select("dados")
      .eq("place_id", c.place_id)
      .maybeSingle<{ dados: DadosLead | null }>(),
  ]);

  const tela: ContratoTela = {
    id: c.id,
    numero: c.numero,
    status: c.status,
    link: c.token ? `${await origem()}/contrato/${c.token}` : null,
    linkExpiraEm: c.link_expira_em,
    hashOriginal: c.pdf_original_hash,
    hashAssinado: c.pdf_assinado_hash,
    enviadoEm: c.enviado_em,
    prestador: c.prestador_assinou_em
      ? { nome: c.prestador_nome ?? "", email: c.prestador_email ?? "", ip: c.prestador_ip ?? "", quando: c.prestador_assinou_em }
      : null,
    cliente: c.cliente_assinou_em
      ? { nome: c.cliente_nome ?? "", email: c.cliente_email ?? "", ip: c.cliente_ip ?? "", quando: c.cliente_assinou_em }
      : null,
    pendencias: dados ? pendencias(dados) : ["Respostas do questionário"],
    liberado: liberado === true,
    temAssinaturaPerfil: !!perfil?.assinatura_path,
    whatsappCliente: lead?.dados?.whatsapp ?? null,
  };

  return (
    <div className="max-w-4xl">
      <p className="mb-3">
        <Link href="/painel/contratos" className="text-sm font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          ← Todos os contratos
        </Link>
      </p>
      <TituloPagina titulo={c.titulo} descricao={`Contrato nº ${c.numero} · criado em ${new Date(c.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}>
        <EtiquetaStatusContrato status={c.status} />
      </TituloPagina>

      <div className="mt-6 flex flex-col gap-4">
        {!tela.liberado && c.status === "rascunho" && <ConviteContratos />}
        <AvisosContrato />
      </div>

      <ContratoClient contrato={tela} />

      {doc && (
        <section className="mt-10" aria-labelledby="titulo-texto">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 id="titulo-texto" className="text-2xl text-ink">
              {c.status === "rascunho" ? "Prévia do contrato" : "Texto enviado ao cliente"}
            </h2>
            {c.status === "rascunho" && (
              <Link href={`/painel/contratos/${c.id}/editar`} className={BOTAO_NEUTRO}>
                Editar respostas
              </Link>
            )}
          </div>
          <TextoContrato doc={doc} />
        </section>
      )}
    </div>
  );
}
