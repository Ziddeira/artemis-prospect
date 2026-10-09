import { NextResponse } from "next/server";
import { ehEstilo, validarDadosSite } from "@/lib/sites/dados";
import { gerarSite } from "@/lib/sites/ia";
import { erro, executarGeracao, falhaInesperada, prepararContextoSites, respostaErroReserva } from "@/lib/sites/servidor";

export const dynamic = "force-dynamic";
// A IA leva de 1 a 3 minutos para escrever o site.
export const maxDuration = 300;

// Gera um site novo a partir de um lead desbloqueado (plano Platina).
// 1. o banco confere plano, lead, saldo e o limite de 2 por hora, e já
//    desconta 1 geração (reservar_geracao_site);
// 2. o servidor chama a IA;
// 3. o resultado (ou a falha, que devolve o saldo) é gravado com o custo.
export async function POST(request: Request) {
  try {
    return await gerar(request);
  } catch (e) {
    return falhaInesperada("gerar", e);
  }
}

async function gerar(request: Request) {
  const ctx = await prepararContextoSites();
  if (ctx instanceof NextResponse) return ctx;

  let corpo: { placeId?: unknown; estilo?: unknown; dados?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return erro("Corpo da requisição inválido.");
  }

  const placeId = typeof corpo.placeId === "string" ? corpo.placeId.trim() : "";
  if (!placeId) return erro("Lead inválido.");
  if (!ehEstilo(corpo.estilo)) return erro("Escolha um estilo visual.");
  const v = validarDadosSite(corpo.dados);
  if ("erro" in v) return erro(v.erro);

  const { data, error } = await ctx.supabase
    .rpc("reservar_geracao_site", { p_place_id: placeId, p_dados: v.dados, p_estilo: corpo.estilo })
    .single<{ site_id: string; geracao_id: number }>();
  if (error) return respostaErroReserva(error, "gerar");

  const estilo = corpo.estilo;
  const r = await executarGeracao(ctx, data.geracao_id, () => gerarSite(v.dados, estilo));
  if (!r.ok) return erro(r.mensagem, 502, { siteId: data.site_id });

  return NextResponse.json({ siteId: data.site_id });
}
