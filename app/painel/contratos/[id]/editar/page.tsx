import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TituloPagina, BOTAO } from "@/components/ui";
import { AvisosContrato, ConviteContratos } from "@/components/contratos/Pecas";
import Questionario from "@/components/contratos/Questionario";
import { dadosVazios, validarDadosContrato, type ModoContrato } from "@/lib/contratos/dados";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar contrato" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Editar as respostas de um rascunho (o banco recusa editar depois de enviado).
export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) return <p className="text-ink-2">Supabase não configurado neste ambiente.</p>;

  const { data: c } = await supabase
    .from("contratos")
    .select("id, numero, titulo, modo, dados, status")
    .eq("id", id)
    .maybeSingle<{ id: string; numero: string; titulo: string; modo: ModoContrato; dados: unknown; status: string }>();
  if (!c) notFound();

  if (c.status !== "rascunho") {
    return (
      <div className="max-w-3xl">
        <TituloPagina titulo="Editar contrato" />
        <p className="mt-4 text-ink-2">
          Este contrato já foi enviado ao cliente e o texto está congelado. Para mudar algo, abra o contrato e use
          “Cancelar envio e editar” (só antes de o cliente assinar).
        </p>
        <Link href={`/painel/contratos/${c.id}`} className={`${BOTAO} mt-4`}>
          Abrir o contrato
        </Link>
      </div>
    );
  }

  const { data: liberado } = await supabase.rpc("meu_acesso_contratos");
  const validado = validarDadosContrato(c.dados);
  const dados = "dados" in validado ? validado.dados : { ...dadosVazios(), contratante: { ...dadosVazios().contratante, nome: c.titulo } };

  return (
    <div className="max-w-4xl">
      <p className="mb-3">
        <Link href={`/painel/contratos/${c.id}`} className="text-sm font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          ← Voltar ao contrato
        </Link>
      </p>
      <TituloPagina titulo="Editar contrato" descricao={`Contrato nº ${c.numero} · ${c.titulo}`} />
      <div className="mt-6 flex flex-col gap-4">
        {liberado !== true && <ConviteContratos />}
        <AvisosContrato />
      </div>
      {liberado === true && (
        <Questionario inicial={dados} modoInicial={c.modo === "padrao" ? "padrao" : "questionario"} numero={c.numero} destino={{ tipo: "editar", id: c.id }} />
      )}
    </div>
  );
}
