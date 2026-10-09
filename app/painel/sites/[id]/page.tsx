import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TituloPagina } from "@/components/ui";
import { AvisoHospedagem, AvisoLiberacao } from "@/components/sites/Pecas";
import { lerGeracaoAtiva } from "@/lib/sites/interruptor";
import { ESTILOS } from "@/lib/sites/dados";
import { lerSaldoSites } from "@/lib/sites/saldo";
import SiteClient from "./SiteClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Site gerado" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Um site gerado: prévia, download (.html ou .zip) e pedidos de ajuste.
export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  if (!supabase) notFound();

  // O RLS só devolve o site de quem está logado.
  const { data: site } = await supabase
    .from("sites_gerados")
    .select("id, nome, estilo, status, html, versao, ajustes_gratis, ajustes_feitos, html_expira_em, atualizado_em")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      nome: string;
      estilo: string;
      status: string;
      html: string | null;
      versao: number;
      ajustes_gratis: number;
      ajustes_feitos: number;
      html_expira_em: string | null;
      atualizado_em: string;
    }>();
  if (!site) notFound();

  const [saldo, geracaoAtiva] = await Promise.all([lerSaldoSites(supabase), lerGeracaoAtiva(supabase)]);
  const expirado = !site.html || (!!site.html_expira_em && new Date(site.html_expira_em) <= new Date());
  const estilo = ESTILOS.find((e) => e.id === site.estilo)?.nome ?? site.estilo;
  const expiraEm = site.html_expira_em
    ? new Date(site.html_expira_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;

  return (
    <div className="max-w-6xl">
      <p className="text-sm">
        <Link href="/painel/sites" className="font-semibold text-ink-2 underline-offset-2 hover:underline">
          ← Meus sites
        </Link>
      </p>
      <TituloPagina
        titulo={site.nome}
        descricao={`Estilo ${estilo} · versão ${site.versao}${expiraEm && !expirado ? ` · guardado até ${expiraEm}` : ""}`}
      />
      <AvisoHospedagem className="mt-5" />
      {saldo?.platinaAtivo && !geracaoAtiva && <AvisoLiberacao className="mt-3" />}

      {site.status !== "pronto" || expirado ? (
        <p className="mt-6 text-ink-2">
          {site.status === "gerando"
            ? "Este site ainda está sendo gerado. Recarregue a página em instantes."
            : site.status === "falhou"
              ? "Este site não foi gerado e a geração voltou para o seu saldo."
              : "Este site passou de 30 dias e não fica mais guardado. Gere um novo a partir do lead."}
        </p>
      ) : (
        <SiteClient
          id={site.id}
          html={site.html!}
          ajustesGratis={site.ajustes_gratis}
          podeAjustar={!!saldo?.platinaAtivo && geracaoAtiva}
          temSaldo={!!saldo && saldo.sitesRestantes + saldo.sitesExtras > 0}
        />
      )}
    </div>
  );
}
