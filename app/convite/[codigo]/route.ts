import { NextResponse } from "next/server";
import { COOKIE_INDICACAO, VALIDADE_COOKIE_SEGUNDOS, normalizarCodigo } from "@/lib/indicacoes/regras";

export const dynamic = "force-dynamic";

// Link de indicação: /convite/<código>. Guarda o código num cookie (só o
// servidor lê, vale 30 dias) e leva para a criação de conta. O código é
// usado logo depois do cadastro — com e-mail e senha ou com o Google —
// para ligar a conta nova a quem indicou (lib/indicacoes/servidor.ts).
// Código inválido só leva ao cadastro normal, sem cookie.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: bruto } = await params;
  const codigo = normalizarCodigo(bruto);
  const destino = new URL(codigo ? "/cadastro?convite=1" : "/cadastro", request.url);
  const resposta = NextResponse.redirect(destino);
  if (codigo) {
    resposta.cookies.set(COOKIE_INDICACAO, codigo, {
      httpOnly: true,
      sameSite: "lax",
      secure: destino.protocol === "https:",
      path: "/",
      maxAge: VALIDADE_COOKIE_SEGUNDOS,
    });
  }
  return resposta;
}
