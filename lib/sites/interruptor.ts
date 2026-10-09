import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Interruptor geral da geração de sites com IA (etapa 24), guardado no
// banco (configuracoes_sistema). Liga e desliga em Gestão > Sites IA, sem
// novo deploy. Qualquer falha na leitura (inclusive a etapa 24 ainda não
// rodada) conta como DESLIGADO: na dúvida, nada é gasto com a IA.
export async function lerGeracaoAtiva(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("geracao_sites_ativa");
    if (error) {
      if (!["PGRST202", "42883"].includes(error.code ?? "")) {
        console.error("[sites] geracao_sites_ativa:", error.code, error.message);
      }
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[sites] geracao_sites_ativa:", e);
    return false;
  }
}
