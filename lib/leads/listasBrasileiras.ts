// Listas editáveis do "provável negócio brasileiro" (aba Internacional),
// guardadas no banco (supabase/etapa22-negocios-brasileiros.sql) e
// editáveis em Gestão > Negócio brasileiro:
//   - palavras_brasileiras: palavras do nome que contam como sinal;
//   - regioes_brasileiras: atalhos de região com grande comunidade
//     brasileira, por país.
// Sem o SQL da etapa 22 (tabelas não existem), valem as listas iniciais
// do código, para tudo já funcionar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PALAVRAS_BRASILEIRAS_PADRAO } from "./brasileiro";
import { PAISES, PAISES_INTERNACIONAIS, type CodigoPais } from "./paises";

export const LIMITE_PALAVRA = 40;
export const LIMITE_REGIAO = 80;

export async function palavrasBrasileiras(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("palavras_brasileiras")
    .select("palavra")
    .order("palavra")
    .returns<{ palavra: string }[]>();
  if (error) return PALAVRAS_BRASILEIRAS_PADRAO;
  return (data ?? []).map((d) => d.palavra);
}

export type RegioesPorPais = Partial<Record<CodigoPais, string[]>>;

function regioesPadrao(): RegioesPorPais {
  return Object.fromEntries(PAISES_INTERNACIONAIS.map((c) => [c, PAISES[c].regioesBrasileirasPadrao]));
}

// Atalhos de cada país, na ordem em que foram incluídos.
export async function regioesBrasileiras(supabase: SupabaseClient): Promise<RegioesPorPais> {
  const { data, error } = await supabase
    .from("regioes_brasileiras")
    .select("pais, regiao")
    .order("criado_em")
    .order("regiao")
    .returns<{ pais: string; regiao: string }[]>();
  if (error) return regioesPadrao();
  const porPais: RegioesPorPais = {};
  for (const codigo of PAISES_INTERNACIONAIS) {
    porPais[codigo] = (data ?? []).filter((d) => d.pais === codigo).map((d) => d.regiao);
  }
  return porPais;
}

// Espaços repetidos viram um só. Nulo se vazio ou longo demais.
export function limparItem(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.replace(/\s+/g, " ").trim();
  if (texto.length < 2 || texto.length > limite) return null;
  return texto;
}
