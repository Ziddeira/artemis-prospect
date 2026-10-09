import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TituloPagina, BOTAO } from "@/components/ui";
import { AvisosContrato, ConviteContratos } from "@/components/contratos/Pecas";
import Questionario from "@/components/contratos/Questionario";
import { cacheValido, type DadosLead } from "@/lib/leads/dadosLead";
import { ROTULO_FUNIL, situacaoFunilValida } from "@/lib/leads/funil";
import { MSG_FALTA_ETAPA24, SITUACOES_CONTRATO, dadosIniciais, faltaEtapa24, type Prestador } from "@/lib/contratos/dados";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gerar contrato" };

// Novo contrato a partir de um lead "em negociação" ou "fechado". Os dados
// do lead (nome e bairro) e os do prestador (último contrato) já vêm
// preenchidos. O banco confere tudo de novo ao salvar (criar_contrato).
export default async function NovoContratoPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: liberado, error: erroAcesso } = await supabase.rpc("meu_acesso_contratos");
  if (erroAcesso) {
    return (
      <div>
        <TituloPagina titulo="Gerar contrato" />
        <p className="mt-4 text-ink-2">{faltaEtapa24(erroAcesso.code) ? MSG_FALTA_ETAPA24 : "Não foi possível abrir o gerador agora."}</p>
      </div>
    );
  }

  const placeId = typeof lead === "string" ? lead.trim().slice(0, 300) : "";
  const { data: linha } = placeId
    ? await supabase
        .from("leads_desbloqueados")
        .select("place_id, dados, dados_atualizados_em, situacao")
        .eq("place_id", placeId)
        .maybeSingle<{ place_id: string; dados: DadosLead | null; dados_atualizados_em: string | null; situacao: string | null }>()
    : { data: null };

  const situacao = linha && situacaoFunilValida(linha.situacao) ? linha.situacao : "desbloqueado";
  const podeGerar = (SITUACOES_CONTRATO as readonly string[]).includes(situacao);

  if (!linha || !podeGerar) {
    return (
      <div className="max-w-3xl">
        <TituloPagina titulo="Gerar contrato" />
        <p className="mt-4 text-ink-2">
          {linha
            ? `Este lead está como “${ROTULO_FUNIL[situacao]}”. O contrato fica liberado quando ele estiver “Em negociação” ou “Fechado”: mude a situação no cartão do lead em Meus leads.`
            : "Escolha o lead em “Meus leads” e clique em “Gerar contrato”. O botão aparece nos leads em negociação ou fechados."}
        </p>
        <Link href="/painel/meus-leads" className={`${BOTAO} mt-4`}>
          Ir para Meus leads
        </Link>
      </div>
    );
  }

  const dadosLead = linha.dados && cacheValido(linha.dados_atualizados_em) ? linha.dados : null;
  const { data: anterior } = await supabase
    .from("contratos")
    .select("dados")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ dados: { prestador?: Partial<Prestador> } | null }>();

  const inicial = dadosIniciais({
    nomeLead: dadosLead?.nome ?? "",
    enderecoLead: dadosLead?.bairro ?? "",
    prestadorAnterior: anterior?.dados?.prestador ?? null,
    email: user?.email ?? "",
  });

  return (
    <div className="max-w-4xl">
      <TituloPagina
        titulo="Gerar contrato"
        descricao={`Contrato de criação de site${dadosLead?.nome ? ` para ${dadosLead.nome}` : ""}. Use o modelo padrão ou responda o questionário.`}
      />
      <div className="mt-6 flex flex-col gap-4">
        {liberado !== true && <ConviteContratos />}
        <AvisosContrato />
      </div>
      {liberado === true && (
        <Questionario inicial={inicial} modoInicial={null} numero="(gerado ao salvar)" destino={{ tipo: "criar", placeId: linha.place_id }} />
      )}
    </div>
  );
}
