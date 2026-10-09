import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TituloPagina, BOTAO } from "@/components/ui";
import { AvisoHospedagem, ConvitePlatina, SaldoSitesResumo } from "@/components/sites/Pecas";
import { cacheValido, type DadosLead } from "@/lib/leads/dadosLead";
import { MSG_FALTA_ETAPA23, type IdiomaSite } from "@/lib/sites/dados";
import { lerSaldoSites } from "@/lib/sites/saldo";
import NovoSiteClient from "./NovoSiteClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gerar site" };

// Formulário curto que confirma os dados do lead antes de gerar o site.
// Os dados vêm do cache do lead desbloqueado (etapa 4); a pessoa confere,
// completa e escolhe o estilo. Fotos do Google nunca entram no site.
export default async function NovoSitePage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  const saldo = await lerSaldoSites(supabase);
  if (!saldo) {
    return (
      <div>
        <TituloPagina titulo="Gerar site" />
        <p className="mt-4 text-ink-2">{MSG_FALTA_ETAPA23}</p>
      </div>
    );
  }

  const placeId = typeof lead === "string" ? lead.trim().slice(0, 300) : "";
  const { data: linha } = placeId
    ? await supabase
        .from("leads_desbloqueados")
        .select("place_id, dados, dados_atualizados_em")
        .eq("place_id", placeId)
        .maybeSingle<{ place_id: string; dados: DadosLead | null; dados_atualizados_em: string | null }>()
    : { data: null };

  if (!linha) {
    return (
      <div className="max-w-3xl">
        <TituloPagina titulo="Gerar site" />
        <p className="mt-4 text-ink-2">
          Escolha o lead em &quot;Meus leads&quot; e clique em &quot;Gerar site&quot;. Só dá para gerar site de um lead
          que você desbloqueou.
        </p>
        <Link href="/painel/meus-leads" className={`${BOTAO} mt-4`}>
          Ir para Meus leads
        </Link>
      </div>
    );
  }

  const dados = linha.dados && cacheValido(linha.dados_atualizados_em) ? linha.dados : null;
  const idioma: IdiomaSite = dados?.pais && dados.pais !== "BR" && !dados.brasileiro ? "en" : "pt-BR";

  return (
    <div className="max-w-3xl">
      <TituloPagina
        titulo="Gerar site"
        descricao="Confira os dados, escolha o estilo e a IA monta uma landing page de uma página, pronta para baixar."
      />
      <div className="mt-6 flex flex-col gap-4">
        {saldo.platinaAtivo ? (
          <SaldoSitesResumo
            sitesRestantes={saldo.sitesRestantes}
            sitesExtras={saldo.sitesExtras}
            geracoesUltimaHora={saldo.geracoesUltimaHora}
            proximaLiberacao={saldo.proximaLiberacao}
          />
        ) : (
          <ConvitePlatina />
        )}
        <AvisoHospedagem />
      </div>

      {saldo.platinaAtivo && (
        <NovoSiteClient
          placeId={linha.place_id}
          inicial={{
            nome: dados?.nome ?? "",
            cidade: "",
            endereco: dados?.bairro ?? "",
            telefone: dados?.whatsapp ? `+${dados.whatsapp}` : (dados?.telefone ?? ""),
            idioma,
          }}
          semSaldo={saldo.sitesRestantes + saldo.sitesExtras < 1}
          gerando={saldo.gerando}
        />
      )}
    </div>
  );
}
