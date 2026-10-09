import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_CONTRATOS, UUID, erro, respostaErroBanco } from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

// Cancela o envio (antes de o cliente assinar): o link para de funcionar,
// o contrato volta a rascunho e o PDF congelado é apagado.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return erro("Contrato não encontrado.", 404);
  const supabase = await createClient();
  if (!supabase) return erro("Supabase não configurado neste ambiente.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);

  const { data: antigo, error } = await supabase.rpc("cancelar_envio_contrato", { p_id: id });
  if (error) return respostaErroBanco(error, "cancelar-envio");

  if (typeof antigo === "string" && antigo) {
    const { error: erroRemover } = await (createAdminClient() ?? supabase).storage.from(BUCKET_CONTRATOS).remove([antigo]);
    if (erroRemover) console.error("[contratos/cancelar-envio] apagar PDF:", erroRemover.message);
  }
  return NextResponse.json({ ok: true });
}
