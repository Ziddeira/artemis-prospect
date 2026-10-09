import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { montarContrato } from "@/lib/contratos/texto";
import { gerarPdfContrato } from "@/lib/contratos/pdf";
import {
  UUID,
  baixarArquivo,
  dadosDaLinha,
  erro,
  garantirPdfAssinado,
  nomePdf,
  respostaErroBanco,
  respostaPdf,
  type LinhaContrato,
} from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

// PDF para o dono do contrato:
//   rascunho → montado na hora, com a marca "RASCUNHO";
//   enviado  → o PDF congelado no envio (o mesmo do hash);
//   assinado → o PDF final com a página de registro (?versao=original
//              baixa o PDF enviado, para conferir o hash).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return erro("Contrato não encontrado.", 404);
  const supabase = await createClient();
  if (!supabase) return erro("Supabase não configurado neste ambiente.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);

  // O RLS só devolve o contrato se for do usuário logado.
  const { data: c, error } = await supabase.from("contratos").select("*").eq("id", id).maybeSingle<LinhaContrato>();
  if (error) return respostaErroBanco(error, "pdf");
  if (!c) return erro("Contrato não encontrado.", 404);

  const versao = new URL(request.url).searchParams.get("versao");
  const arquivos = createAdminClient() ?? supabase;

  if (c.status === "rascunho") {
    const dados = dadosDaLinha(c);
    if (!dados) return erro("Os dados deste contrato estão incompletos.", 400);
    const { bytes } = await gerarPdfContrato(montarContrato(dados, { numero: c.numero, data: new Date() }), {
      rascunho: true,
    });
    return respostaPdf(bytes, nomePdf(c.numero, "-rascunho"));
  }

  if (c.status === "assinado" && versao !== "original") {
    const admin = createAdminClient();
    if (!admin) return erro("Falta SUPABASE_SERVICE_ROLE_KEY no servidor.", 500);
    const bytes = await garantirPdfAssinado(admin, c);
    if (!bytes) return erro("Não foi possível montar o PDF assinado agora. Tente de novo.", 500);
    return respostaPdf(bytes, nomePdf(c.numero, "-assinado"));
  }

  const original = c.pdf_original_path ? await baixarArquivo(arquivos, c.pdf_original_path) : null;
  if (!original) return erro("Não foi possível abrir o PDF agora. Tente de novo.", 500);
  return respostaPdf(original, nomePdf(c.numero, c.status === "assinado" ? "-original" : ""));
}
