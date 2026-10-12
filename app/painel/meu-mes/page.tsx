import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { faltaEtapa27 } from "@/lib/indicacoes/regras";
import AbasScore from "@/components/score/AbasScore";
import { IconeTrofeu, IconeSeta } from "@/components/Icones";
import { BOTAO, EstadoVazio, TituloPagina } from "@/components/ui";

export const dynamic = "force-dynamic";

// "Meu mês" sem mês escolhido: abre o relatório mais recente. Quem ainda
// não tem nenhum vê o aviso de quando o primeiro chega.
export default async function MeuMesPage() {
  const supabase = await createClient();
  if (!supabase) return <Vazio texto="Supabase não configurado neste ambiente." />;

  // O RLS só devolve os relatórios do usuário logado.
  const { data, error } = await supabase
    .from("relatorios_mensais")
    .select("mes")
    .order("mes", { ascending: false })
    .limit(1)
    .maybeSingle<{ mes: string }>();
  if (error) {
    if (!faltaEtapa27(error.code)) console.error("[meu-mes]", error.code, error.message);
    return (
      <Vazio
        texto={
          faltaEtapa27(error.code)
            ? "O relatório mensal ainda não foi ativado no banco. Rode as 3 partes supabase/etapa27-1, etapa27-2 e etapa27-3 no Supabase, nessa ordem."
            : "Não foi possível carregar seus relatórios agora."
        }
      />
    );
  }
  if (data) redirect(`/painel/meu-mes/${data.mes.slice(0, 7)}`);

  return (
    <div>
      <TituloPagina titulo="Meu mês" descricao="Seu resumo de cada mês, comparado com o mês anterior." />
      <div className="mt-6">
        <AbasScore atual="meu-mes" />
      </div>
      <EstadoVazio
        icone={<IconeTrofeu width={26} height={26} />}
        titulo="Seu primeiro resumo chega no dia 1º"
        texto="Todo dia 1º, a Ártemis fecha o mês que acabou: leads desbloqueados, contatos, negociações, vendas, pontos e sua posição no rank. O aviso chega no sino."
      >
        <Link href="/painel/buscar" className={BOTAO}>
          Buscar leads <IconeSeta width={18} height={18} />
        </Link>
      </EstadoVazio>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div>
      <TituloPagina titulo="Meu mês" />
      <div className="mt-6">
        <AbasScore atual="meu-mes" />
      </div>
      <p className="text-ink-2">{texto}</p>
    </div>
  );
}
