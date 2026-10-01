import { exigirAdminPagina } from "@/lib/admin/acesso";
import { PALAVRAS_BRASILEIRAS_PADRAO } from "@/lib/leads/brasileiro";
import { PAISES, PAISES_INTERNACIONAIS, type CodigoPais } from "@/lib/leads/paises";
import BrasileirosClient from "./BrasileirosClient";

export const dynamic = "force-dynamic";

// Gestão > Negócio brasileiro: as palavras do nome que contam como sinal
// de "Provável negócio brasileiro" e os atalhos de região com grande
// comunidade brasileira (aba Internacional). Etapa 22.
export default async function BrasileirosPage() {
  const supabase = await exigirAdminPagina();
  const [palavras, regioes] = await Promise.all([
    supabase.from("palavras_brasileiras").select("palavra").order("palavra").returns<{ palavra: string }[]>(),
    supabase
      .from("regioes_brasileiras")
      .select("pais, regiao")
      .order("criado_em")
      .order("regiao")
      .returns<{ pais: string; regiao: string }[]>(),
  ]);
  const ativo = !palavras.error && !regioes.error;

  // Sem o SQL da etapa 22, mostra as listas iniciais do código (as que
  // estão valendo), só para leitura.
  const listaPalavras = ativo ? (palavras.data ?? []).map((p) => p.palavra) : PALAVRAS_BRASILEIRAS_PADRAO;
  const regioesPorPais = Object.fromEntries(
    PAISES_INTERNACIONAIS.map((codigo) => [
      codigo,
      ativo
        ? (regioes.data ?? []).filter((r) => r.pais === codigo).map((r) => r.regiao)
        : PAISES[codigo].regioesBrasileirasPadrao,
    ]),
  ) as Record<CodigoPais, string[]>;

  return (
    <BrasileirosClient
      ativo={ativo}
      palavras={listaPalavras}
      paises={PAISES_INTERNACIONAIS.map((codigo) => ({
        codigo,
        nome: PAISES[codigo].nome,
        bandeira: PAISES[codigo].bandeira,
      }))}
      regioes={regioesPorPais}
    />
  );
}
