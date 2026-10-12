import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Limite de tentativas de login (supabase/etapa25-1-seguranca-tentativas.sql).
// As regras ficam no banco, nas funções login_situacao e
// login_registrar_tentativa:
//   * por conta: 5 senhas erradas seguidas pausam o login daquele e-mail
//     por 15 minutos; cada erro depois disso pausa de novo, por mais tempo
//     (até 1 hora). Um login certo zera a contagem;
//   * por origem (IP): 20 erros em 15 minutos, em qualquer conta, pausam
//     o login daquele endereço por 15 minutos.
// O banco guarda só um resumo (hash) do e-mail e do IP, nunca o valor.
//
// Se a service_role ou o script não existirem, o login segue sem limite
// (e o erro vai para o log), para o site não parar de vez.

export type MotivoBloqueio = "conta" | "origem";

function resumo(tipo: string, valor: string) {
  return createHash("sha256").update(`${tipo}:${valor}`).digest("hex");
}

function chaves(email: string, ip: string | null) {
  return {
    p_conta: resumo("conta", email.trim().toLowerCase()),
    p_origem: ip ? resumo("origem", ip) : null,
  };
}

export async function situacaoLogin(
  email: string,
  ip: string | null,
): Promise<{ segundos: number; motivo: MotivoBloqueio | null }> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("[seguranca/limite] SUPABASE_SERVICE_ROLE_KEY ausente: login sem limite de tentativas.");
    return { segundos: 0, motivo: null };
  }
  const { data, error } = await admin
    .rpc("login_situacao", chaves(email, ip))
    .maybeSingle<{ segundos: number; motivo: MotivoBloqueio | null }>();
  if (error) {
    console.error("[seguranca/limite] login_situacao:", error.code, error.message);
    return { segundos: 0, motivo: null };
  }
  return { segundos: Math.max(0, data?.segundos ?? 0), motivo: data?.motivo ?? null };
}

// Registra o resultado de uma tentativa. Devolve quantos erros ainda
// cabem antes da pausa (null se não deu para saber).
export async function registrarTentativa(email: string, ip: string | null, sucesso: boolean): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("login_registrar_tentativa", { ...chaves(email, ip), p_sucesso: sucesso });
  if (error) {
    console.error("[seguranca/limite] login_registrar_tentativa:", error.code, error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

export function textoEspera(segundos: number) {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}
