import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MOTIVOS_INVALIDO, type MotivoInvalido } from "@/lib/leads/invalido";

export const dynamic = "force-dynamic";

function limparMensagemPostgres(msg: string): string {
  return msg.replace(/^ERROR:\s*/i, "");
}

// Marca um lead desbloqueado como "empresa não existe mais" ou "telefone
// não atende". A função SQL (etapa 20) registra a marcação e, dentro das
// regras (3 por mês, desbloqueado há até 30 dias), devolve 1 crédito.
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado neste ambiente." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });
  }

  let corpo: { placeId?: string; motivo?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const placeId = corpo.placeId?.trim();
  const motivo = corpo.motivo as MotivoInvalido;
  if (!placeId) {
    return NextResponse.json({ erro: "place_id é obrigatório." }, { status: 400 });
  }
  if (!MOTIVOS_INVALIDO.includes(motivo)) {
    return NextResponse.json({ erro: "Motivo inválido." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("marcar_lead_invalido", {
    p_place_id: placeId,
    p_motivo: motivo,
  });

  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code ?? "")) {
      console.error("[leads/invalido]", error.code, error.message);
      return NextResponse.json(
        { erro: "Esta função ainda não foi ativada. Rode supabase/etapa20-1-leads-invalidos.sql no Supabase." },
        { status: 500 },
      );
    }
    return NextResponse.json({ erro: limparMensagemPostgres(error.message) }, { status: 400 });
  }

  const r = (Array.isArray(data) ? data[0] : data) as {
    devolvido: boolean;
    devolucoes_no_mes: number;
    limite_mes: number;
    creditos_restantes: number;
    sem_devolucao: string | null;
  };

  return NextResponse.json({
    motivo,
    devolvido: r.devolvido,
    devolucoesNoMes: r.devolucoes_no_mes,
    limiteMes: r.limite_mes,
    creditosRestantes: r.creditos_restantes,
    semDevolucao: r.sem_devolucao,
  });
}
