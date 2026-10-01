import { NextResponse } from "next/server";
import { exigirAdminApi, respostaErroAdmin } from "@/lib/admin/acesso";
import { LIMITE_PALAVRA, LIMITE_REGIAO, limparItem } from "@/lib/leads/listasBrasileiras";
import { ehPaisInternacional } from "@/lib/leads/paises";

export const dynamic = "force-dynamic";

const MSG_FALTA_ETAPA22 =
  "As listas de negócio brasileiro ainda não foram ativadas no banco. Rode o script supabase/etapa22-negocios-brasileiros.sql no Supabase.";

// Função inexistente = etapa 22 não rodada.
function faltaEtapa22(codigo: string | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(codigo ?? "");
}

type Pedido =
  | { erro: string }
  | { erro?: never; lista: "palavra"; valor: string }
  | { erro?: never; lista: "regiao"; valor: string; pais: string };

async function lerPedido(request: Request): Promise<Pedido> {
  const corpo = await request.json().catch(() => null);
  if (corpo?.lista === "palavra") {
    const valor = limparItem(corpo.valor, LIMITE_PALAVRA);
    if (!valor) return { erro: `A palavra precisa ter de 2 a ${LIMITE_PALAVRA} caracteres.` };
    return { lista: "palavra", valor };
  }
  if (corpo?.lista === "regiao") {
    if (!ehPaisInternacional(corpo.pais)) return { erro: "País inválido." };
    const valor = limparItem(corpo.valor, LIMITE_REGIAO);
    if (!valor) return { erro: `A região precisa ter de 2 a ${LIMITE_REGIAO} caracteres.` };
    if (valor.includes(",")) return { erro: "Uma região por vez, sem vírgula: ex.: Pompano Beach FL" };
    return { lista: "regiao", valor, pais: corpo.pais };
  }
  return { erro: "Lista inválida." };
}

// Gestão > Negócio brasileiro: incluir (POST) ou tirar (DELETE) uma
// palavra do nome ou um atalho de região. A conferência de administrador
// e a auditoria ficam nas funções SQL.
async function aplicar(request: Request, acao: "adicionar" | "remover") {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const pedido = await lerPedido(request);
  if (pedido.erro !== undefined) return NextResponse.json({ erro: pedido.erro }, { status: 400 });

  const { error } =
    pedido.lista === "palavra"
      ? await acesso.supabase.rpc(`admin_${acao}_palavra_brasileira`, { p_palavra: pedido.valor })
      : await acesso.supabase.rpc(`admin_${acao}_regiao_brasileira`, { p_pais: pedido.pais, p_regiao: pedido.valor });
  if (error) {
    if (faltaEtapa22(error.code)) return NextResponse.json({ erro: MSG_FALTA_ETAPA22 }, { status: 503 });
    return respostaErroAdmin(error, "admin/brasileiros");
  }
  return NextResponse.json({ ok: true, valor: pedido.valor });
}

export async function POST(request: Request) {
  return aplicar(request, "adicionar");
}

export async function DELETE(request: Request) {
  return aplicar(request, "remover");
}
