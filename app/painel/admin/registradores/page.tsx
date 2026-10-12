import { exigirAdminPagina } from "@/lib/admin/acesso";
import { EXTENSOES, juntarLinks } from "@/lib/dominios/regras";
import RegistradoresClient from "./RegistradoresClient";

export const dynamic = "force-dynamic";

// Gestão > Registradores: o link do botão "Registrar" da aba Domínios,
// um por extensão (dá para usar link de afiliado).
export default async function RegistradoresPage() {
  const supabase = await exigirAdminPagina();
  const { data, error } = await supabase
    .from("registradores_links")
    .select("extensao, registrador, url")
    .returns<{ extensao: string; registrador: string; url: string }[]>();

  const links = juntarLinks(data);
  return <RegistradoresClient links={EXTENSOES.map((ext) => links[ext])} ativo={!error} />;
}
