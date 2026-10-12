import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarCsv, gerarXlsx, type LeadExportacao, type VendaExportacao } from "@/lib/leads/exportar";

export const dynamic = "force-dynamic";

// Exporta a carteira do usuário logado (Meus leads), em CSV ou Excel:
// GET /api/leads/exportar?formato=csv | xlsx
//
// Só os dados da própria pessoa: o login é conferido aqui, a consulta
// filtra pelo id dela e o RLS do banco só devolve as linhas dela de
// qualquer jeito. Não lê a coluna "dados" (cache do Google): nome,
// telefone e endereço não podem sair do Ártemis (ver lib/leads/exportar.ts).
export async function GET(request: Request) {
  const formato = new URL(request.url).searchParams.get("formato");
  if (formato !== "csv" && formato !== "xlsx") {
    return NextResponse.json({ erro: "Formato inválido. Use csv ou xlsx." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado neste ambiente." }, { status: 500 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });

  const [leads, vendas] = await Promise.all([
    supabase
      .from("leads_desbloqueados")
      .select("place_id, desbloqueado_em, situacao, anotacao, ultimo_contato_em, retorno_em, retorno_obs")
      .eq("user_id", user.id)
      .order("desbloqueado_em", { ascending: false })
      .returns<LeadExportacao[]>(),
    supabase
      .from("vendas")
      .select("place_id, site_url, fechado_em, valor, status, pontos")
      .eq("user_id", user.id)
      .returns<VendaExportacao[]>(),
  ]);
  const erro = leads.error ?? vendas.error;
  if (erro) {
    console.error("[leads/exportar]", erro.code, erro.message);
    return NextResponse.json({ erro: "Não foi possível montar o arquivo agora. Tente de novo." }, { status: 500 });
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const nome = `carteira-artemis-${hoje}.${formato}`;
  const cabecalhos = {
    "Content-Disposition": `attachment; filename="${nome}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };

  if (formato === "csv") {
    return new NextResponse(gerarCsv(leads.data ?? [], vendas.data ?? []), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const tipoXlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const bytes = gerarXlsx(leads.data ?? [], vendas.data ?? []);
  return new NextResponse(new Blob([bytes as BlobPart], { type: tipoXlsx }), {
    headers: { ...cabecalhos, "Content-Type": tipoXlsx },
  });
}
