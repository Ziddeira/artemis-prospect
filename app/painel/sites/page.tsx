import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EstadoVazio, TituloPagina, BOTAO, BOTAO_NEUTRO, CARTAO } from "@/components/ui";
import { IconeSite } from "@/components/Icones";
import { AvisoHospedagem, AvisoLiberacao, ConvitePlatina, SaldoSitesResumo } from "@/components/sites/Pecas";
import { lerGeracaoAtiva } from "@/lib/sites/interruptor";
import { ESTILOS, MSG_FALTA_ETAPA23 } from "@/lib/sites/dados";
import { lerSaldoSites } from "@/lib/sites/saldo";

export const dynamic = "force-dynamic";

export const metadata = { title: "Meus sites" };

interface LinhaSite {
  id: string;
  nome: string;
  estilo: string;
  status: string;
  versao: number;
  ajustes_gratis: number;
  html_expira_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

function jaExpirou(iso: string | null) {
  return !!iso && new Date(iso) <= new Date();
}

// Sites gerados com IA (plano Platina, etapa 23).
export default async function SitesPage() {
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  const [saldo, geracaoAtiva] = await Promise.all([lerSaldoSites(supabase), lerGeracaoAtiva(supabase)]);
  if (!saldo) {
    return (
      <div>
        <TituloPagina titulo="Meus sites" />
        <p className="mt-4 text-ink-2">{MSG_FALTA_ETAPA23}</p>
      </div>
    );
  }

  const { data } = await supabase
    .from("sites_gerados")
    .select("id, nome, estilo, status, versao, ajustes_gratis, html_expira_em, criado_em, atualizado_em")
    .order("criado_em", { ascending: false })
    .limit(100)
    .returns<LinhaSite[]>();
  const sites = data ?? [];

  return (
    <div className="max-w-5xl">
      <TituloPagina
        titulo="Meus sites"
        descricao="Landing pages geradas com IA a partir dos seus leads. Baixe e publique onde quiser."
      />

      <div className="mt-6 flex flex-col gap-4">
        {saldo.platinaAtivo && !geracaoAtiva && <AvisoLiberacao />}
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

      <h2 className="mt-10 text-2xl font-bold text-ink">Sites gerados</h2>
      {sites.length ? (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {sites.map((s) => {
            const expirado = jaExpirou(s.html_expira_em);
            const estilo = ESTILOS.find((e) => e.id === s.estilo)?.nome ?? s.estilo;
            const situacao =
              s.status === "gerando"
                ? "Gerando..."
                : s.status === "falhou"
                  ? "Não foi gerado (saldo devolvido)"
                  : expirado
                    ? "Passou de 30 dias: não fica mais guardado"
                    : `Versão ${s.versao} · ${s.ajustes_gratis} ${s.ajustes_gratis === 1 ? "ajuste grátis" : "ajustes grátis"}`;
            return (
              <li key={s.id} className={`${CARTAO} flex flex-col gap-3 p-4 sm:p-5`}>
                <div>
                  <p className="break-words font-sans text-base font-extrabold text-ink">{s.nome}</p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    Estilo {estilo} · criado em{" "}
                    {new Date(s.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                  <p className="mt-1 text-sm text-muted">{situacao}</p>
                </div>
                {s.status === "pronto" && !expirado && (
                  <Link href={`/painel/sites/${s.id}`} className={`${BOTAO_NEUTRO} self-start`}>
                    Ver, baixar e ajustar
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3">
          <EstadoVazio
            icone={<IconeSite width={28} height={28} />}
            titulo="Nenhum site gerado ainda"
            texto='Abra "Meus leads" e clique em "Gerar site" no lead que você quer apresentar com uma página pronta.'
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
