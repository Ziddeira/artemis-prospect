import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerOrigem, mesmaOrigem, registrarEntrada } from "@/lib/seguranca/acessos";
import { verificarCaptcha } from "@/lib/seguranca/captcha";
import { erroSenha } from "@/lib/seguranca/senha";
import { vincularIndicacao } from "@/lib/indicacoes/servidor";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Criação de conta com e-mail e senha. O servidor confere tudo de novo
// (e-mail, regras da senha, confirmação e captcha) antes de pedir ao
// Supabase para criar a conta. O link de confirmação do e-mail volta
// para /auth/callback no mesmo endereço em que a pessoa está.
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
  const confirmacao = typeof corpo?.confirmacao === "string" ? corpo.confirmacao : "";
  const captcha = typeof corpo?.captcha === "string" ? corpo.captcha : "";

  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }
  const problemaSenha = erroSenha(senha, email);
  if (problemaSenha) {
    return NextResponse.json({ erro: problemaSenha }, { status: 400 });
  }
  if (senha !== confirmacao) {
    return NextResponse.json({ erro: "As duas senhas não são iguais." }, { status: 400 });
  }

  const { ip } = await lerOrigem();
  const resultado = await verificarCaptcha(captcha, ip, "cadastro");
  if (resultado === "faltou") {
    return NextResponse.json({ erro: "Confirme que você não é um robô antes de criar a conta." }, { status: 400 });
  }
  if (resultado === "recusado") {
    return NextResponse.json(
      { erro: "Não conseguimos confirmar que você não é um robô. Tente de novo." },
      { status: 400 },
    );
  }
  if (resultado === "indisponivel") {
    return NextResponse.json(
      { erro: "A verificação anti-robô está fora do ar. Tente de novo em instantes." },
      { status: 503 },
    );
  }

  const { origin } = new URL(request.url);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return NextResponse.json({ erro: traduzErro(error.message, error.status) }, { status: error.status === 429 ? 429 : 400 });
  }

  // Veio por um link de indicação (cookie do /convite/<código>): liga a
  // conta nova a quem indicou. Se o e-mail já existia, o Supabase devolve
  // um usuário sem identidades e nada é ligado. A recompensa de quem
  // indicou só sai quando este e-mail for confirmado (etapa 27).
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await vincularIndicacao(data.user.id);
  }

  // Com a confirmação de e-mail desligada no Supabase, a conta já entra.
  if (data.session && data.user) {
    await registrarEntrada(data.user.id, "cadastro");
    return NextResponse.json({ sessao: true });
  }
  return NextResponse.json({ sessao: false });
}

function traduzErro(msg: string, status?: number) {
  if (status === 429 || msg.includes("rate limit") || msg.includes("security purposes")) {
    return "Muitos cadastros seguidos. Aguarde alguns minutos e tente de novo.";
  }
  if (msg.includes("User already registered") || msg.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (msg.includes("Password should") || msg.toLowerCase().includes("weak")) {
    return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
  }
  if (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("email")) {
    return "Digite um e-mail válido.";
  }
  console.error("[auth/cadastro] Falha ao criar conta:", status, msg);
  return "Não foi possível criar a conta agora. Tente de novo em instantes.";
}
