import { NextResponse } from "next/server";
import { exigirAdminApi, respostaErroAdmin } from "@/lib/admin/acesso";

export const dynamic = "force-dynamic";

// Gestão > Laura: marcar uma venda como paga (Pix manual).
//   { acao: "pago", id: "<uuid do lead>" }
export async function POST(request: Request) {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (corpo?.acao !== "pago" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const { error } = await acesso.supabase.rpc("laura_marcar_pago", { p_lead: id });
  if (error) return respostaErroAdmin(error, "admin/laura");
  return NextResponse.json({ ok: true });
}
