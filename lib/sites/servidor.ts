import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/erros/registrar";
import { ErroIA, iaConfigurada, type ResultadoIA } from "./ia";
import { MSG_FALTA_ETAPA23, faltaEtapa23 } from "./dados";

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

// Confere configuração e login ANTES de reservar qualquer geração: sem a
// chave da IA ou a service_role, nada é gasto.
export async function prepararContextoSites(): Promise<ContextoSites | NextResponse> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return erro("Supabase não configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY?).", 500);
  if (!iaConfigurada()) return erro("A geração de sites ainda não está configurada (falta ANTHROPIC_API_KEY no servidor).", 500);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);
  return { supabase, admin, user };
}

// Erro de uma função SQL de reserva (plano, saldo, limites).
export function respostaErroReserva(error: { code?: string; message: string }, contexto: string) {
  if (faltaEtapa23(error.code)) {
    console.error(`[sites/${contexto}]`, error.code, error.message);
    return erro(MSG_FALTA_ETAPA23, 500);
  }
  if (error.code === "AP402") return erro(error.message, 402, { precisaPlatina: true });
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
    const tecnica = e instanceof Error ? e.message : String(e);
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
