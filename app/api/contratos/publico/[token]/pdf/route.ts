import { createAdminClient } from "@/lib/supabase/admin";
import { contratoPorToken } from "@/lib/contratos/publico";
import { baixarArquivo, erro, garantirPdfAssinado, nomePdf, respostaPdf } from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

// PDF pelo link público: o enviado para assinatura ou, depois de
// assinado, o final com a página de registro (?versao=original baixa o
// PDF enviado, para conferir o hash). Só enquanto o link vale.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const achado = await contratoPorToken(token);
  if (!achado) return erro("Link inválido ou contrato cancelado.", 404);
  if (achado.expirado) return erro("Este link expirou. Peça um link novo a quem enviou o contrato.", 410);
  const admin = createAdminClient();
  if (!admin) return erro("Serviço indisponível.", 500);

  const c = achado.contrato;
  const versao = new URL(request.url).searchParams.get("versao");
  if (c.status === "assinado" && versao !== "original") {
    const bytes = await garantirPdfAssinado(admin, c);
    if (!bytes) return erro("Não foi possível montar o PDF assinado agora. Tente de novo.", 500);
    return respostaPdf(bytes, nomePdf(c.numero, "-assinado"));
  }

  const original = c.pdf_original_path ? await baixarArquivo(admin, c.pdf_original_path) : null;
  if (!original) return erro("Não foi possível abrir o PDF agora. Tente de novo.", 500);
  return respostaPdf(original, nomePdf(c.numero, c.status === "assinado" ? "-original" : ""));
}
