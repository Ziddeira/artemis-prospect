import { createClient } from "@/lib/supabase/server";
import { TituloPagina } from "@/components/ui";
import { juntarLinks } from "@/lib/dominios/regras";
import DominiosClient from "./DominiosClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Domínios" };

// Aba Domínios: confere se um nome está livre em várias extensões e leva
// ao site do registrador. O Ártemis não vende domínio.
// ?nome=...&cidade=... chega preenchido pelo atalho do lead.
export default async function DominiosPage({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string | string[]; cidade?: string | string[] }>;
}) {
  const { nome, cidade } = await searchParams;
  const supabase = await createClient();

  // Links do botão "Registrar" (Gestão > Registradores). Sem o SQL da
  // etapa 26, valem os links padrão do código.
  const { data } = supabase
    ? await supabase
        .from("registradores_links")
        .select("extensao, registrador, url")
        .returns<{ extensao: string; registrador: string; url: string }[]>()
    : { data: null };

  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 200) : "");

  return (
    <div>
      <TituloPagina
        titulo="Domínios"
        descricao="Veja se o nome que você quer para o site está livre e vá direto ao registrador para registrar."
      />
      <DominiosClient links={juntarLinks(data)} nomeInicial={texto(nome)} cidadeInicial={texto(cidade)} />
    </div>
  );
}
