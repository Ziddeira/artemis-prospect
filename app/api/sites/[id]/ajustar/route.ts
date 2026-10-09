import { NextResponse } from "next/server";
import { ehEstilo, validarDadosSite } from "@/lib/sites/dados";
import { ajustarSite } from "@/lib/sites/ia";
import { erro, executarGeracao, falhaInesperada, prepararContextoSites, respostaErroReserva } from "@/lib/sites/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pedido de ajuste num site já gerado. Os 2 primeiros de cada site são
// grátis; do 3º em diante conta como geração nova. Quem decide é o banco
// (reservar_ajuste_site).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await ajustar(request, (await params).id);
  } catch (e) {
    return falhaInesperada("ajustar", e);
  }
}

async function ajustar(request: Request, id: string) {
  if (!UUID.test(id)) return erro("Site não encontrado.", 404);

  const ctx = await prepararContextoSites();
  if (ctx instanceof NextResponse) return ctx;

  let corpo: { pedido?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return erro("Corpo da requisição inválido.");
  }
  const pedido = typeof corpo.pedido === "string" ? corpo.pedido.trim().slice(0, 1000) : "";
  if (pedido.length < 5) return erro("Escreva o que você quer mudar no site.");

  // O RLS só devolve o site se ele for de quem está logado.
  const { data: site, error: erroSite } = await ctx.supabase
    .from("sites_gerados")
    .select("id, html, dados, estilo")
    .eq("id", id)
    .maybeSingle<{ id: string; html: string | null; dados: unknown; estilo: string }>();
  if (erroSite) return respostaErroReserva(erroSite, "ajustar");
  if (!site) return erro("Site não encontrado.", 404);
  if (!site.html) return erro("Este site não está disponível para ajustes.");
  const v = validarDadosSite(site.dados);
  if ("erro" in v || !ehEstilo(site.estilo)) return erro("Os dados deste site estão incompletos. Gere um novo.");

  const { data, error } = await ctx.supabase
    .rpc("reservar_ajuste_site", { p_site_id: id, p_pedido: pedido })
    .single<{ geracao_id: number; cobrado: boolean; ajustes_gratis_restantes: number }>();
  if (error) return respostaErroReserva(error, "ajustar");

  const html = site.html;
  const estilo = site.estilo;
  const r = await executarGeracao(ctx, data.geracao_id, () => ajustarSite(html, pedido, v.dados, estilo));
  if (!r.ok) return erro(r.mensagem, 502);

  return NextResponse.json({ ok: true, cobrado: data.cobrado });
}
