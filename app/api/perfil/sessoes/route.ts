import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mesmaOrigem } from "@/lib/seguranca/acessos";

export const dynamic = "force-dynamic";

// "Encerrar outras sessões" do Perfil: desconecta a conta de todos os
// outros aparelhos e navegadores. Este aparelho continua conectado.
export async function POST(request: Request) {
  if (!mesmaOrigem(request)) {
    return NextResponse.json({ erro: "Pedido recusado." }, { status: 403 });
  }
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

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("[perfil/sessoes] Falha ao encerrar outras sessões:", error.status, error.message);
    return NextResponse.json(
      { erro: "Não foi possível encerrar as outras sessões agora. Tente de novo em instantes." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
