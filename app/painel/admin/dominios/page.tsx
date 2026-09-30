import { exigirAdminPagina } from "@/lib/admin/acesso";
import { DOMINIOS_RESERVA, DOMINIOS_TERCEIRO } from "@/lib/leads/classificacao";
import { PAISES, PAIS_PADRAO, PAISES_INTERNACIONAIS, type CodigoPais } from "@/lib/leads/paises";
import DominiosClient from "./DominiosClient";

export const dynamic = "force-dynamic";

// Gestão > Sites de terceiros: a lista extra de cada país (Yelp, Square,
// Vagaro...). Site de lead nesses domínios conta como "Só app ou rede
// social", não como site próprio.
export default async function DominiosPage() {
  const supabase = await exigirAdminPagina();
  const { data, error } = await supabase
    .from("dominios_terceiro")
    .select("pais, dominio")
    .order("dominio")
    .returns<{ pais: string; dominio: string }[]>();

  const ordem: CodigoPais[] = [...PAISES_INTERNACIONAIS, PAIS_PADRAO];
  const listas = Object.fromEntries(
    ordem.map((codigo) => [codigo, (data ?? []).filter((d) => d.pais === codigo).map((d) => d.dominio)]),
  ) as Record<CodigoPais, string[]>;

  return (
    <DominiosClient
      paises={ordem.map((codigo) => ({ codigo, nome: PAISES[codigo].nome, bandeira: PAISES[codigo].bandeira }))}
      listas={listas}
      ativo={!error}
      fixos={[...DOMINIOS_RESERVA, ...DOMINIOS_TERCEIRO]}
    />
  );
}
