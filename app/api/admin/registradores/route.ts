import { NextResponse } from "next/server";
import { exigirAdminApi, respostaErroAdmin } from "@/lib/admin/acesso";
import { ehExtensao, urlRegistradorValida } from "@/lib/dominios/regras";

export const dynamic = "force-dynamic";

const MSG_FALTA_ETAPA26 =
  "Os links dos registradores ainda não foram ativados no banco. Rode o script supabase/etapa26-dominios.sql no Supabase.";

// Gestão > Registradores: salvar o link do botão "Registrar" de uma
// extensão. A conferência de administrador e a auditoria ficam na função SQL.
export async function PUT(request: Request) {
  const acesso = await exigirAdminApi();
  if (acesso.resposta) return acesso.resposta;

  const corpo = await request.json().catch(() => null);
  const extensao = corpo?.extensao;
  const registrador = typeof corpo?.registrador === "string" ? corpo.registrador.trim() : "";
  const url = typeof corpo?.url === "string" ? corpo.url.trim() : "";
  if (!ehExtensao(extensao)) return NextResponse.json({ erro: "Extensão inválida." }, { status: 400 });
  if (!registrador || registrador.length > 60) {
    return NextResponse.json({ erro: "Informe o nome do registrador (até 60 caracteres)." }, { status: 400 });
  }
  if (!urlRegistradorValida(url)) {
    return NextResponse.json({ erro: "O link precisa começar com https:// e não pode ter espaços." }, { status: 400 });
  }

  const { error } = await acesso.supabase.rpc("admin_salvar_registrador", {
    p_extensao: extensao,
    p_registrador: registrador,
    p_url: url,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code ?? "")) {
      return NextResponse.json({ erro: MSG_FALTA_ETAPA26 }, { status: 503 });
    }
    return respostaErroAdmin(error, "admin/registradores");
  }
  return NextResponse.json({ ok: true });
}
