import { exigirAdminPagina } from "@/lib/admin/acesso";
import type { PainelLaura } from "@/lib/laura/painel";
import { FalhaCarregar } from "../comum";
import LauraPainel from "./LauraPainel";

export const dynamic = "force-dynamic";

// Gestão > Laura: produção da vendedora autônoma (schema "vendedor",
// supabase/vendedor-*.sql). Os dados vêm da função laura_painel(), que
// só responde para administrador.
export default async function LauraPage() {
  const supabase = await exigirAdminPagina();
  const { data, error } = await supabase.rpc("laura_painel");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return <p className="text-ink-2">O painel da Laura ainda não foi ativado no banco: rode supabase/vendedor-2-painel-laura.sql no Supabase.</p>;
    }
    return <FalhaCarregar error={error} />;
  }
  return <LauraPainel dados={data as PainelLaura} />;
}
