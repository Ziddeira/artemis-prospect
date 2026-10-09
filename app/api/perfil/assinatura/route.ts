import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MSG_FALTA_ETAPA24, faltaEtapa24 } from "@/lib/contratos/dados";
import { BUCKET_CONTRATOS, baixarArquivo, codigoArquivo, enviarArquivo, erro, lerPngAssinatura } from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

// Assinatura salva no perfil (para reutilizar nos contratos):
//   GET    → a imagem PNG (só para o próprio usuário)
//   POST   { imagem: "data:image/png;base64,..." } → salva ou troca
//   DELETE → remove
// O arquivo fica no bucket privado "contratos"; quem grava é o servidor.
async function contexto() {
  const supabase = await createClient();
  if (!supabase) return erro("Supabase não configurado neste ambiente.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);
  return { supabase, user };
}

export async function GET() {
  const ctx = await contexto();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("assinatura_path")
    .eq("id", ctx.user.id)
    .maybeSingle<{ assinatura_path: string | null }>();
  if (error) return erro(faltaEtapa24(error.code) ? MSG_FALTA_ETAPA24 : "Não foi possível ler sua assinatura.", 503);
  if (!data?.assinatura_path) return erro("Nenhuma assinatura salva.", 404);
  const bytes = await baixarArquivo(createAdminClient() ?? ctx.supabase, data.assinatura_path);
  if (!bytes) return erro("Não foi possível abrir sua assinatura.", 500);
  return new NextResponse(new Blob([bytes as BlobPart], { type: "image/png" }), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}

async function definir(ctx: Exclude<Awaited<ReturnType<typeof contexto>>, NextResponse>, caminho: string | null) {
  const admin = createAdminClient();
  const { data: antiga, error } = await ctx.supabase.rpc("definir_assinatura_perfil", { p_path: caminho });
  if (error) {
    if (caminho && admin) await admin.storage.from(BUCKET_CONTRATOS).remove([caminho]);
    if (faltaEtapa24(error.code)) return erro(MSG_FALTA_ETAPA24, 503);
    console.error("[perfil/assinatura]", error.code, error.message);
    return erro("Não foi possível salvar sua assinatura agora.", 500);
  }
  if (typeof antiga === "string" && antiga && antiga !== caminho) {
    const { error: erroRemover } = await (admin ?? ctx.supabase).storage.from(BUCKET_CONTRATOS).remove([antiga]);
    if (erroRemover) console.error("[perfil/assinatura] apagar antiga:", erroRemover.message);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const ctx = await contexto();
  if (ctx instanceof NextResponse) return ctx;
  const admin = createAdminClient();
  if (!admin) return erro("Falta SUPABASE_SERVICE_ROLE_KEY no servidor.", 500);

  const corpo = await request.json().catch(() => null);
  const png = lerPngAssinatura(corpo?.imagem);
  if (!png) return erro("Assinatura inválida. Desenhe de novo ou envie outra imagem.");

  const caminho = `${ctx.user.id}/assinatura-${codigoArquivo()}.png`;
  try {
    await enviarArquivo(admin, caminho, png, "image/png");
  } catch (e) {
    console.error("[perfil/assinatura] upload:", e);
    return erro("Não foi possível salvar sua assinatura agora.", 500);
  }
  return definir(ctx, caminho);
}

export async function DELETE() {
  const ctx = await contexto();
  if (ctx instanceof NextResponse) return ctx;
  return definir(ctx, null);
}
