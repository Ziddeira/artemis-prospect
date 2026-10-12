import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mesmaOrigem } from "@/lib/seguranca/acessos";
import { erroSenha } from "@/lib/seguranca/senha";

export const dynamic = "force-dynamic";

// Grava a senha nova do "Esqueci minha senha". A pessoa chega aqui com a
// sessão aberta pelo link do e-mail (/auth/callback); o servidor confere
// as regras da senha antes de gravar.
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
    return NextResponse.json(
      { erro: "O link expirou ou já foi usado. Peça um link novo em \"Esqueci minha senha\"." },
      { status: 401 },
    );
  }

  const corpo = await request.json().catch(() => null);
  const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
  const confirmacao = typeof corpo?.confirmacao === "string" ? corpo.confirmacao : "";

  const problema = erroSenha(senha, user.email);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });
  if (senha !== confirmacao) {
    return NextResponse.json({ erro: "As duas senhas não são iguais." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.message.includes("different from the old password")) {
      return NextResponse.json({ erro: "A nova senha precisa ser diferente da anterior." }, { status: 400 });
    }
    console.error("[auth/redefinir-senha] Falha ao salvar senha:", error.status, error.message);
    return NextResponse.json(
      { erro: "Não foi possível salvar a senha. Peça um link novo e tente de novo." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
