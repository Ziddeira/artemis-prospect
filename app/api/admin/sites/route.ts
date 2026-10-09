import { NextResponse } from "next/server";
import { exigirAdminApi, respostaErroAdmin } from "@/lib/admin/acesso";
import { MSG_FALTA_ETAPA24, faltaEtapa23 } from "@/lib/sites/dados";

export const dynamic = "force-dynamic";

// Gestão > Sites IA: liga ou desliga a geração de sites com IA para todos
// os assinantes Platina (etapa 24). Vale na hora, sem novo deploy. A
// conferência de administrador e a auditoria ficam na função SQL.
export async function POST(request: Request) {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const corpo = await request.json().catch(() => null);
  if (typeof corpo?.ativa !== "boolean") {
    return NextResponse.json({ erro: "Escolha ligar ou desligar." }, { status: 400 });
  }

  const { data, error } = await acesso.supabase.rpc("admin_definir_geracao_sites", { p_ativa: corpo.ativa });
  if (error) {
    if (faltaEtapa23(error.code)) return NextResponse.json({ erro: MSG_FALTA_ETAPA24 }, { status: 503 });
    return respostaErroAdmin(error, "admin/sites");
  }
  return NextResponse.json({ ativa: data === true });
}
