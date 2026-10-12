import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarErro } from "@/lib/erros/registrar";
import { faltaEtapa27 } from "@/lib/indicacoes/regras";

// Gera o resumo do mês que acabou para cada usuário ativo (função SQL
// "gerar_relatorios_mensais", etapa 27). Sem mês: só age nos dias 1º a 3
// e nunca repete quem já recebeu. Devolve quantos relatórios foram
// criados, ou null se falhou / o script ainda não foi rodado.
export async function gerarRelatoriosMensais(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin.rpc("gerar_relatorios_mensais");
  if (error) {
    if (faltaEtapa27(error.code)) {
      console.error("[relatorio] Etapa 27 não encontrada no banco:", error.code, error.message);
      return null;
    }
    console.error("[relatorio]", error.code, error.message);
    await registrarErro("relatorio", `gerar_relatorios_mensais falhou: ${error.message}`, { codigo: error.code });
    return null;
  }
  return typeof data === "number" ? data : null;
}
