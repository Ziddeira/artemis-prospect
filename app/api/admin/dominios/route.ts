import { NextResponse } from "next/server";
import { exigirAdminApi, respostaErroAdmin } from "@/lib/admin/acesso";
import { normalizarDominio } from "@/lib/leads/dominios";
import { ehCodigoPais } from "@/lib/leads/paises";

export const dynamic = "force-dynamic";

const MSG_FALTA_ETAPA21 =
  "A lista de sites de terceiros ainda não foi ativada no banco. Rode os scripts supabase/etapa21-1 e etapa21-2 no Supabase.";

// Função inexistente = etapa 21 não rodada.
function faltaEtapa21(codigo: string | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(codigo ?? "");
}

async function lerPedido(request: Request) {
  const corpo = await request.json().catch(() => null);
  const pais = corpo?.pais;
  const dominio = typeof corpo?.dominio === "string" ? normalizarDominio(corpo.dominio) : null;
  if (!ehCodigoPais(pais)) return { erro: "País inválido." };
  if (!dominio) return { erro: "Domínio inválido. Use só o endereço, ex.: yelp.com" };
  return { pais, dominio };
}

// Gestão > Sites de terceiros: incluir um domínio na lista de um país.
// A conferência de administrador e a auditoria ficam na função SQL.
export async function POST(request: Request) {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const pedido = await lerPedido(request);
  if (pedido.erro) return NextResponse.json({ erro: pedido.erro }, { status: 400 });

  const { error } = await acesso.supabase.rpc("admin_adicionar_dominio_terceiro", {
    p_pais: pedido.pais,
    p_dominio: pedido.dominio,
  });
  if (error) {
    if (faltaEtapa21(error.code)) return NextResponse.json({ erro: MSG_FALTA_ETAPA21 }, { status: 503 });
    return respostaErroAdmin(error, "admin/dominios");
  }
  return NextResponse.json({ ok: true, dominio: pedido.dominio });
}

// Tirar um domínio da lista de um país.
export async function DELETE(request: Request) {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const pedido = await lerPedido(request);
  if (pedido.erro) return NextResponse.json({ erro: pedido.erro }, { status: 400 });

  const { error } = await acesso.supabase.rpc("admin_remover_dominio_terceiro", {
    p_pais: pedido.pais,
    p_dominio: pedido.dominio,
  });
  if (error) {
    if (faltaEtapa21(error.code)) return NextResponse.json({ erro: MSG_FALTA_ETAPA21 }, { status: 503 });
    return respostaErroAdmin(error, "admin/dominios");
  }
  return NextResponse.json({ ok: true });
}
