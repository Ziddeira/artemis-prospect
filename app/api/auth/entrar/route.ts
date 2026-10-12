import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerOrigem, mesmaOrigem, registrarEntrada } from "@/lib/seguranca/acessos";
import { registrarTentativa, situacaoLogin, textoEspera } from "@/lib/seguranca/limite";

export const dynamic = "force-dynamic";

// Login com e-mail e senha. Passa pelo servidor (em vez de ir direto do
// navegador para o Supabase) para aplicar o limite de tentativas
// (lib/seguranca/limite.ts) e registrar o acesso (lib/seguranca/acessos.ts).
// A sessão é gravada nos cookies pelo cliente do Supabase do servidor.
export async function POST(request: Request) {
  if (!mesmaOrigem(request)) {
    return NextResponse.json({ erro: "Pedido recusado." }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { erro: "O sistema de login ainda não foi configurado neste ambiente. Tente novamente mais tarde." },
      { status: 500 },
    );
  }

  const corpo = await request.json().catch(() => null);
  const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
  if (!email || !senha) {
    return NextResponse.json({ erro: "Preencha o e-mail e a senha." }, { status: 400 });
  }
  if (email.length > 254 || senha.length > 200) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 400 });
  }

  const { ip } = await lerOrigem();
  const bloqueio = await situacaoLogin(email, ip);
  if (bloqueio.segundos > 0) {
    const quem = bloqueio.motivo === "origem" ? "a partir desta conexão" : "nesta conta";
    return NextResponse.json(
      {
        erro:
          `Muitas tentativas erradas ${quem}. Por segurança, o login está pausado. ` +
          `Tente de novo em ${textoEspera(bloqueio.segundos)} ou use "Esqueci minha senha".`,
      },
      { status: 429, headers: { "Retry-After": String(bloqueio.segundos) } },
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    if (error.code === "invalid_credentials" || error.message.includes("Invalid login credentials")) {
      const restantes = await registrarTentativa(email, ip, false);
      let aviso = "";
      if (restantes !== null && restantes > 0 && restantes <= 2) {
        const quantas = restantes === 1 ? "1 tentativa errada" : `${restantes} tentativas erradas`;
        aviso = ` Depois de mais ${quantas}, o login fica pausado por alguns minutos.`;
      } else if (restantes === 0) {
        const { segundos } = await situacaoLogin(email, ip);
        if (segundos > 0) {
          aviso =
            ` Por segurança, o login desta conta está pausado por ${textoEspera(segundos)}.` +
            ' Se esqueceu a senha, use "Esqueci minha senha".';
        }
      }
      return NextResponse.json({ erro: `E-mail ou senha incorretos.${aviso}` }, { status: 401 });
    }
    if (error.code === "email_not_confirmed" || error.message.includes("Email not confirmed")) {
      return NextResponse.json(
        { erro: "Confirme seu e-mail antes de entrar: abra o link que enviamos no cadastro." },
        { status: 403 },
      );
    }
    if (error.status === 429) {
      return NextResponse.json(
        { erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." },
        { status: 429 },
      );
    }
    console.error("[auth/entrar] Falha no login:", error.status, error.code, error.message);
    return NextResponse.json({ erro: "Não foi possível entrar agora. Tente de novo em instantes." }, { status: 500 });
  }

  await registrarTentativa(email, ip, true);
  await registrarEntrada(data.user.id, "senha");
  return NextResponse.json({ ok: true });
}
