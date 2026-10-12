import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/erros/registrar";
import { COOKIE_INDICACAO, faltaEtapa27, normalizarCodigo } from "./regras";

// Liga a conta que acabou de nascer a quem indicou, pelo código guardado
// no cookie do link /convite/<código>. Chamado logo depois do cadastro
// com e-mail e senha e na volta do login com o Google.
//
// Quem confere tudo é a função SQL "vincular_indicacao" (etapa 27): conta
// nova (até 1 hora), não indicar a si mesmo, uma indicação por conta. As
// recompensas só saem quando o e-mail da pessoa indicada for confirmado.
// Nunca derruba quem chamou: se der errado, o cadastro segue normal.
export async function vincularIndicacao(userId: string) {
  const loja = await cookies();
  const codigo = normalizarCodigo(loja.get(COOKIE_INDICACAO)?.value);
  if (!codigo) return;
  // O cookie vale para uma tentativa só (a função só aceita conta nova).
  loja.delete(COOKIE_INDICACAO);

  const admin = createAdminClient();
  if (!admin) {
    console.error("[indicacao] Falta SUPABASE_SERVICE_ROLE_KEY: a indicação não foi registrada.");
    return;
  }
  const { data, error } = await admin.rpc("vincular_indicacao", { p_indicado: userId, p_codigo: codigo });
  if (error) {
    if (faltaEtapa27(error.code)) {
      console.error("[indicacao] Etapa 27 não encontrada no banco:", error.code, error.message);
      return;
    }
    console.error("[indicacao]", error.code, error.message);
    await registrarErro("indicacao", `vincular_indicacao falhou: ${error.message}`, { codigo: error.code }, userId);
    return;
  }
  if (data !== "ok") console.log(`[indicacao] não vinculada: ${data}`);
}
