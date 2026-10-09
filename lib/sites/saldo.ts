import "server-only";
import { createClient } from "@/lib/supabase/server";
import { faltaEtapa23 } from "./dados";

type Cliente = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface SaldoSites {
  plano: string;
  platinaAtivo: boolean;
  sitesRestantes: number;
  sitesExtras: number;
  geracoesUltimaHora: number;
  proximaLiberacao: string | null;
  gerando: boolean;
}

// Saldo de gerações e limites, lidos do banco (meu_saldo_sites). null =
// script da etapa 23 ainda não rodado.
export async function lerSaldoSites(supabase: Cliente): Promise<SaldoSites | null> {
  const { data, error } = await supabase.rpc("meu_saldo_sites").maybeSingle<{
    plano: string;
    platina_ativo: boolean;
    sites_restantes: number;
    sites_extras: number;
    geracoes_ultima_hora: number;
    proxima_liberacao: string | null;
    gerando: boolean;
  }>();
  if (error || !data) {
    if (error && !faltaEtapa23(error.code)) console.error("[sites] meu_saldo_sites:", error.code, error.message);
    return null;
  }
  return {
    plano: data.plano,
    platinaAtivo: data.platina_ativo,
    sitesRestantes: data.sites_restantes,
    sitesExtras: data.sites_extras,
    geracoesUltimaHora: data.geracoes_ultima_hora,
    proximaLiberacao: data.proxima_liberacao,
    gerando: data.gerando,
  };
}
