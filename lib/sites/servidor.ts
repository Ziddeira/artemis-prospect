import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/erros/registrar";
import { ErroIA, MSG_IA_INDISPONIVEL, iaConfigurada, type ResultadoIA } from "./ia";
import { MSG_FALTA_ETAPA23, MSG_LIBERACAO_SITES, faltaEtapa23 } from "./dados";
import { lerGeracaoAtiva } from "./interruptor";

type ClienteServidor = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface ContextoSites {
  supabase: ClienteServidor;
  admin: ClienteAdmin;
  user: User;
}

export function erro(mensagem: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ erro: mensagem, ...extra }, { status });
}

// Resposta de "liberação em andamento": não é erro, a tela mostra como
// aviso (emLiberacao: true).
export function respostaLiberacao(mensagem = MSG_LIBERACAO_SITES) {
  return NextResponse.json({ erro: mensagem, emLiberacao: true }, { status: 409 });
}

// Confere login, o interruptor (etapa 24) e a configuração ANTES de
// reservar qualquer geração. Com o interruptor desligado, a chave da IA
// nem é olhada e nenhuma chamada à Anthropic acontece.
export async function prepararContextoSites(): Promise<ContextoSites | NextResponse> {
  const supabase = await createClient();
  if (!supabase) return erro("Não foi possível falar com o servidor agora. Tente de novo em instantes.", 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);

  // Desligado (ou etapa 24 não rodada): para aqui. As funções SQL de
  // reserva conferem de novo.
  if (!(await lerGeracaoAtiva(supabase))) {
    // Quem não é Platina vê o convite, não a mensagem de liberação.
    const { data: plano } = await supabase.rpc("meu_plano").maybeSingle<{ plano: string }>();
    if (plano && plano.plano !== "platina") {
      return erro("A geração de site com IA é do plano Platina.", 402, { precisaPlatina: true });
    }
    return respostaLiberacao();
  }

  const admin = createAdminClient();
  if (!admin || !iaConfigurada()) {
    const falta = !admin ? "SUPABASE_SERVICE_ROLE_KEY" : "ANTHROPIC_API_KEY";
    console.error(`[sites] Geração ligada, mas falta ${falta} no servidor.`);
    await registrarErro("sites_ia", `Geração de sites ligada, mas falta ${falta} no servidor. Nada foi cobrado.`, {}, user.id);
    return erro(`${MSG_IA_INDISPONIVEL} Nada foi descontado do seu saldo.`, 503);
  }

  return { supabase, admin, user };
}

// Cinto de segurança das rotas: qualquer erro não previsto vira uma
// mensagem amigável em JSON (a tela nunca recebe uma página de erro).
export async function falhaInesperada(contexto: string, e: unknown) {
  console.error(`[sites/${contexto}] erro inesperado:`, e);
  await registrarErro("sites_ia", `Erro inesperado em /api/sites (${contexto}): ${e instanceof Error ? e.message : String(e)}`);
  return erro("Não foi possível concluir agora. Se uma geração tinha sido descontada, ela volta sozinha em até 15 minutos.", 500);
}

// Erro de uma função SQL de reserva (plano, saldo, limites).
export function respostaErroReserva(error: { code?: string; message: string }, contexto: string) {
  if (faltaEtapa23(error.code)) {
    console.error(`[sites/${contexto}]`, error.code, error.message);
    return erro(MSG_FALTA_ETAPA23, 500);
  }
  if (error.code === "AP402") return erro(error.message, 402, { precisaPlatina: true });
  if (error.code === "AP503") return respostaLiberacao(error.message.replace(/^ERROR:\s*/i, ""));
  if (error.code === "P0001") return erro(error.message.replace(/^ERROR:\s*/i, ""), 400);
  console.error(`[sites/${contexto}]`, error.code, error.message);
  return erro("Não foi possível falar com o banco agora. Tente de novo.", 500);
}

// Roda a IA para uma geração já reservada e grava o resultado (ou a
// falha, que devolve o saldo). O custo é gravado nos dois casos.
export async function executarGeracao(
  ctx: ContextoSites,
  geracaoId: number,
  tarefa: () => Promise<ResultadoIA>,
): Promise<{ ok: true; resultado: ResultadoIA } | { ok: false; mensagem: string }> {
  const inicio = Date.now();
  let r: ResultadoIA | null = null;
  try {
    r = await tarefa();
    const { error } = await ctx.admin.rpc("concluir_geracao_site", {
      p_geracao_id: geracaoId,
      p_html: r.html,
      p_modelo: r.modelo,
      p_tokens_entrada: r.entrada,
      p_tokens_saida: r.saida,
      p_tokens_cache_leitura: r.cacheLeitura,
      p_tokens_cache_escrita: r.cacheEscrita,
      p_custo_usd: r.custo,
      p_duracao_ms: r.duracaoMs,
    });
    if (error) throw new Error(`concluir_geracao_site: ${error.message}`);
    return { ok: true, resultado: r };
  } catch (e) {
    const ia = e instanceof ErroIA ? e : null;
    // A IA respondeu, mas a gravação falhou: o custo existiu e é gravado.
    const uso = ia?.uso ?? (r ? { modelo: r.modelo, entrada: r.entrada, saida: r.saida, custo: r.custo } : null);
    const mensagem = ia ? ia.message : "Não foi possível gerar o site agora. Seu saldo foi devolvido; tente de novo.";
    const tecnica = ia ? ia.tecnica : e instanceof Error ? e.message : String(e);
    const { error } = await ctx.admin.rpc("falhar_geracao_site", {
      p_geracao_id: geracaoId,
      p_erro: tecnica,
      p_modelo: uso?.modelo ?? null,
      p_tokens_entrada: uso?.entrada ?? null,
      p_tokens_saida: uso?.saida ?? null,
      p_custo_usd: uso?.custo ?? null,
      p_duracao_ms: Date.now() - inicio,
    });
    if (error) console.error("[sites] falhar_geracao_site:", error.code, error.message);
    if (!ia) console.error("[sites] geração falhou:", e);
    await registrarErro("sites_ia", `Geração de site falhou: ${tecnica}`, { geracao: geracaoId }, ctx.user.id);
    return { ok: false, mensagem: ia ? `${mensagem} Seu saldo foi devolvido.` : mensagem };
  }
}
