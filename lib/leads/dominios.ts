// Lista extra de sites de terceiros de cada país (Yelp, Square, Vagaro...),
// guardada na tabela dominios_terceiro (supabase/etapa21-1) e editável em
// Gestão > Sites de terceiros. Um lead cujo site é de um desses domínios
// conta como "Só app ou rede social", não como site próprio.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAISES, type CodigoPais } from "./paises";

// Lista do país. Sem o SQL da etapa 21 (tabela não existe), usa a lista
// inicial de lib/leads/paises.ts, para a classificação já funcionar.
export async function dominiosDoPais(supabase: SupabaseClient, pais: CodigoPais): Promise<string[]> {
  const { data, error } = await supabase
    .from("dominios_terceiro")
    .select("dominio")
    .eq("pais", pais)
    .returns<{ dominio: string }[]>();
  if (error) return PAISES[pais].dominiosTerceiroPadrao;
  return (data ?? []).map((d) => d.dominio);
}

// Aceita "yelp.com", "www.yelp.com" ou "https://www.yelp.com/biz/x" e
// devolve "yelp.com". Null se não parecer um domínio.
export function normalizarDominio(valor: string): string | null {
  let texto = valor.trim().toLowerCase();
  if (!texto) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(texto)) texto = `https://${texto}`;
  let host: string;
  try {
    host = new URL(texto).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  return /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) && host.length <= 253 ? host : null;
}
