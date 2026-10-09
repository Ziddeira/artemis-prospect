import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarDadosContrato } from "@/lib/contratos/dados";
import { UUID, apagarArquivosContrato, erro, respostaErroBanco } from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

async function contexto(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!UUID.test(id)) return erro("Contrato não encontrado.", 404);
  const supabase = await createClient();
  if (!supabase) return erro("Supabase não configurado neste ambiente.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);
  return { id, supabase, user };
}

// Salva as respostas do questionário (só rascunho; o banco confere).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto(params);
  if (ctx instanceof NextResponse) return ctx;

  const corpo = await request.json().catch(() => null);
  const validado = validarDadosContrato(corpo?.dados);
  if ("erro" in validado) return erro(validado.erro);

  const { error } = await ctx.supabase.rpc("salvar_contrato", {
    p_id: ctx.id,
    p_modo: corpo?.modo === "padrao" ? "padrao" : "questionario",
    p_dados: validado.dados,
  });
  if (error) return respostaErroBanco(error, "salvar");
  return NextResponse.json({ ok: true });
}

// Apaga o contrato DEFINITIVAMENTE (LGPD): primeiro os arquivos (PDFs e
// imagens de assinatura), depois a linha do banco. Se algum arquivo não
// sair, a linha fica, para a pessoa tentar de novo e nada sobrar.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contexto(params);
  if (ctx instanceof NextResponse) return ctx;

  // O RLS só devolve o contrato se for do usuário logado.
  const { data: contrato, error: erroLeitura } = await ctx.supabase
    .from("contratos")
    .select("id, user_id")
    .eq("id", ctx.id)
    .maybeSingle<{ id: string; user_id: string }>();
  if (erroLeitura) return respostaErroBanco(erroLeitura, "apagar");
  if (!contrato) return erro("Contrato não encontrado.", 404);

  const arquivos = createAdminClient() ?? ctx.supabase;
  const ok = await apagarArquivosContrato(arquivos, contrato.user_id, contrato.id);
  if (!ok) return erro("Não foi possível apagar os arquivos do contrato agora. Tente de novo.", 500);

  const { data, error } = await ctx.supabase.rpc("apagar_contrato", { p_id: ctx.id });
  if (error) return respostaErroBanco(error, "apagar");
  if (data !== true) return erro("Contrato não encontrado.", 404);
  return NextResponse.json({ ok: true });
}
