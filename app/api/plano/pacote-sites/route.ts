import { NextResponse } from "next/server";
import { PACOTE_SITES, ehFormaPagamento } from "@/lib/planos";
import { criarCobranca, hojeBrasil } from "@/lib/pagamentos/asaas";
import { erro, garantirClienteAsaas, mensagemDeErro, prepararContexto } from "@/lib/pagamentos/contexto";

export const dynamic = "force-dynamic";

// Compra avulsa do pacote de sites (+3 gerações), só para quem está no
// Platina. As gerações só entram quando o webhook do Asaas confirmar o
// pagamento (processar_evento_asaas, etapa 23).
export async function POST(request: Request) {
  const ctx = await prepararContexto();
  if (ctx instanceof NextResponse) return ctx;

  let corpo: { forma?: unknown; nome?: unknown; cpfCnpj?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return erro("Corpo da requisição inválido.");
  }
  if (!ehFormaPagamento(corpo.forma)) return erro("Escolha Pix ou cartão de crédito.");

  const { data: atual } = await ctx.supabase.rpc("meu_plano").single<{ plano: string }>();
  if (atual?.plano !== "platina") return erro("O pacote de sites é para quem está no plano Platina.");

  try {
    const cliente = await garantirClienteAsaas(ctx, corpo);
    const cobranca = await criarCobranca({
      cliente,
      forma: corpo.forma,
      valor: PACOTE_SITES.preco,
      vencimento: hojeBrasil(),
      descricao: `Ártemis Prospect — pacote de sites (+${PACOTE_SITES.sites} gerações de site com IA)`,
      referencia: `pacote_sites:${ctx.user.id}`,
    });

    const { error } = await ctx.admin.rpc("registrar_cobranca_pacote_sites", {
      p_user_id: ctx.user.id,
      p_payment_id: cobranca.id,
      p_valor: PACOTE_SITES.preco,
      p_forma: corpo.forma,
      p_link: cobranca.invoiceUrl,
    });
    // Mesmo se este registro falhar, o webhook reconhece o pacote pela
    // referência "pacote_sites:<id do usuário>".
    if (error) console.error("registrar_cobranca_pacote_sites falhou:", error.message);

    return NextResponse.json({ link: cobranca.invoiceUrl });
  } catch (e) {
    return erro(mensagemDeErro(e), 502);
  }
}
