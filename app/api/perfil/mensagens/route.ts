import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { faltaEtapa5 } from "@/lib/perfil/dados";
import { LIMITES_MODELO, ehIdiomaModelo, type ModelosMensagem } from "@/lib/leads/mensagens";

export const dynamic = "force-dynamic";

const MSG_FALTA_ETAPA21 =
  "Os modelos em inglês ainda não foram ativados no banco. Rode os scripts supabase/etapa21-1 e etapa21-2 no Supabase.";

// Salva os modelos de mensagem de um idioma (aba Internacional) do
// usuário logado. { idioma, modelos: null } volta aos modelos padrão.
// Quem grava é a função SQL "salvar_modelos_mensagem", que só mexe nessa
// coluna e sempre no perfil de quem está logado.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado neste ambiente." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  if (!ehIdiomaModelo(corpo?.idioma)) {
    return NextResponse.json({ erro: "Idioma inválido." }, { status: 400 });
  }

  let modelos: ModelosMensagem | null = null;
  if (corpo.modelos !== null) {
    const m = corpo.modelos ?? {};
    const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    modelos = { emailAssunto: texto(m.emailAssunto), emailCorpo: texto(m.emailCorpo), curta: texto(m.curta) };
    if (!modelos.emailAssunto || !modelos.emailCorpo || !modelos.curta) {
      return NextResponse.json({ erro: "Preencha o assunto, o texto do e-mail e a mensagem curta." }, { status: 400 });
    }
    for (const [campo, limite] of Object.entries(LIMITES_MODELO) as [keyof ModelosMensagem, number][]) {
      if (modelos[campo].length > limite) {
        return NextResponse.json({ erro: `Texto longo demais (máximo de ${limite} caracteres).` }, { status: 400 });
      }
    }
  }

  const { error } = await supabase.rpc("salvar_modelos_mensagem", { p_idioma: corpo.idioma, p_modelos: modelos });
  if (error) {
    if (faltaEtapa5(error.code)) {
      return NextResponse.json({ erro: MSG_FALTA_ETAPA21 }, { status: 503 });
    }
    if (error.code === "P0001") {
      return NextResponse.json({ erro: error.message }, { status: 400 });
    }
    console.error("[perfil/mensagens] Falha ao salvar:", error.code, error.message);
    return NextResponse.json({ erro: "Não foi possível salvar agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
