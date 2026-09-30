import type { SupabaseClient } from "@supabase/supabase-js";
import { IDIOMAS_MODELO, modelosDoIdioma, type IdiomaModelo, type ModelosMensagem } from "@/lib/leads/mensagens";

export type ModelosPorIdioma = Record<IdiomaModelo, ModelosMensagem>;

// Modelos de mensagem (aba Internacional) do usuário logado, já com os
// padrões no que ele não editou. "ativo" = false quando o SQL da etapa 21
// ainda não foi rodado: valem os padrões e o Perfil avisa.
export async function lerModelosMensagem(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ modelos: ModelosPorIdioma; ativo: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("modelos_mensagem")
    .eq("id", userId)
    .maybeSingle<{ modelos_mensagem: unknown }>();
  const salvos = error ? null : data?.modelos_mensagem;
  const modelos = Object.fromEntries(
    IDIOMAS_MODELO.map((idioma) => [idioma, modelosDoIdioma(salvos, idioma)]),
  ) as ModelosPorIdioma;
  return { modelos, ativo: !error };
}
