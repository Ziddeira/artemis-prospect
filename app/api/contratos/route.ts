import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validarDadosContrato } from "@/lib/contratos/dados";
import { erro, respostaErroBanco } from "@/lib/contratos/servidor";

export const dynamic = "force-dynamic";

// Cria um contrato (rascunho) a partir de um lead "em negociação" ou
// "fechado". Plano, dono do lead e limites: função SQL criar_contrato.
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return erro("Supabase não configurado neste ambiente.", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);

  const corpo = await request.json().catch(() => null);
  const placeId = typeof corpo?.placeId === "string" ? corpo.placeId.trim().slice(0, 300) : "";
  const modo = corpo?.modo === "padrao" ? "padrao" : "questionario";
  if (!placeId) return erro("Lead não informado.");

  const validado = validarDadosContrato(corpo?.dados);
  if ("erro" in validado) return erro(validado.erro);

  const { data, error } = await supabase.rpc("criar_contrato", {
    p_place_id: placeId,
    p_modo: modo,
    p_dados: validado.dados,
  });
  if (error) return respostaErroBanco(error, "criar");
  return NextResponse.json({ id: data });
}
