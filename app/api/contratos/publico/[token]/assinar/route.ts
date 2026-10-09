import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contratoPorToken } from "@/lib/contratos/publico";
import {
  BUCKET_CONTRATOS,
  baixarArquivo,
  codigoArquivo,
  enviarArquivo,
  erro,
  garantirPdfAssinado,
  ipDoPedido,
  lerPngAssinatura,
  navegadorDoPedido,
  sha256,
  type LinhaContrato,
} from "@/lib/contratos/servidor";
import { registrarErro } from "@/lib/erros/registrar";

export const dynamic = "force-dynamic";

// O cliente assina pelo link público, sem conta. O servidor registra
// data e hora (do banco), IP, navegador, nome e e-mail informados, e
// monta o PDF final com a página "Registro de assinatura".
// Corpo: { nome, email, assinatura: "data:image/png;base64,...", aceite: true }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return erro("Serviço indisponível no momento.", 500);

  const achado = await contratoPorToken(token);
  if (!achado) return erro("Link inválido ou contrato cancelado.", 404);
  const c = achado.contrato;
  if (c.status === "assinado") return erro("Este contrato já foi assinado.", 409);
  if (achado.expirado) return erro("Este link expirou. Peça um link novo a quem enviou o contrato.", 410);

  const corpo = await request.json().catch(() => null);
  if (corpo?.aceite !== true) return erro("Marque que leu o contrato e concorda com ele.");
  const nome = typeof corpo?.nome === "string" ? corpo.nome.replace(/\s+/g, " ").trim() : "";
  const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
  if (nome.length < 3 || nome.length > 120) return erro("Escreva seu nome completo.");
  if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("Confira o e-mail.");
  const assinatura = lerPngAssinatura(corpo?.assinatura);
  if (!assinatura) return erro("Faça sua assinatura (desenhe ou envie uma imagem).");

  // O PDF que o cliente leu tem de ser o mesmo do hash gravado no envio.
  const original = c.pdf_original_path ? await baixarArquivo(admin, c.pdf_original_path) : null;
  if (!original) return erro("Não foi possível abrir o contrato agora. Tente de novo em instantes.", 500);
  if (!c.pdf_original_hash || sha256(original) !== c.pdf_original_hash) {
    await registrarErro("contratos", "PDF original não confere com o hash na assinatura.", { contrato: c.id }, c.user_id);
    return erro("O arquivo do contrato não confere com o que foi enviado. Peça um link novo a quem enviou.", 409);
  }

  const caminho = `${c.user_id}/${c.id}/cliente-${codigoArquivo()}.png`;
  try {
    await enviarArquivo(admin, caminho, assinatura, "image/png");
  } catch (e) {
    console.error("[contratos/assinar] imagem:", e);
    return erro("Não foi possível guardar sua assinatura agora. Tente de novo.", 500);
  }

  const { data, error } = await admin.rpc("registrar_assinatura_cliente", {
    p_token: token,
    p_nome: nome,
    p_email: email,
    p_ip: ipDoPedido(request),
    p_navegador: navegadorDoPedido(request),
    p_assinatura_path: caminho,
  });
  const assinado = (Array.isArray(data) ? data[0] : data) as LinhaContrato | null;
  if (error || !assinado) {
    await admin.storage.from(BUCKET_CONTRATOS).remove([caminho]);
    if (error?.code === "P0001") return erro(error.message.replace(/^ERROR:\s*/i, ""), 400);
    console.error("[contratos/assinar]", error?.code, error?.message);
    return erro("Não foi possível registrar a assinatura agora. Tente de novo.", 500);
  }

  // Monta e guarda o PDF final. Se falhar aqui, a assinatura já está
  // registrada e o PDF é montado de novo no primeiro download.
  await garantirPdfAssinado(admin, assinado).catch((e) => console.error("[contratos/assinar] PDF final:", e));

  return NextResponse.json({ ok: true, assinadoEm: assinado.cliente_assinou_em });
}
