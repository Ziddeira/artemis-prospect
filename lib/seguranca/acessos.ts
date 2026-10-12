import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { descreverAparelho } from "./aparelho";

// Registro de acessos (supabase/etapa25-2 e etapa25-3): cada login
// guarda data, origem (IP e cidade aproximada) e aparelho, para a pessoa
// ver no Perfil. Login num aparelho que a conta nunca usou gera um aviso
// no sino.
//
// "Aparelho" = navegador: no primeiro login, ele ganha um código
// aleatório num cookie (só o servidor lê). Limpar os cookies ou usar
// outro navegador conta como aparelho novo.

export const COOKIE_APARELHO = "ap_aparelho";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type MetodoAcesso = "senha" | "google" | "link" | "cadastro";

export interface Origem {
  ip: string | null;
  // Cidade, estado e país aproximados (pelo IP), quando a Vercel informa.
  local: string | null;
  navegador: string;
}

// Na Vercel, x-real-ip e x-forwarded-for são preenchidos pela própria
// plataforma (o que o visitante manda nesses cabeçalhos é substituído).
export async function lerOrigem(): Promise<Origem> {
  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return {
    ip: ip ? ip.slice(0, 64) : null,
    local: localAproximado(h),
    navegador: (h.get("user-agent") ?? "").slice(0, 400),
  };
}

function localAproximado(h: Headers): string | null {
  const decodificar = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const cidade = decodificar(h.get("x-vercel-ip-city"));
  const estado = h.get("x-vercel-ip-country-region");
  const codigoPais = h.get("x-vercel-ip-country");
  let pais = codigoPais;
  if (codigoPais) {
    try {
      pais = new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(codigoPais) ?? codigoPais;
    } catch {
      // Código desconhecido: fica a sigla.
    }
  }
  const partes = [cidade, estado, pais].filter((p): p is string => !!p);
  return partes.length ? partes.join(", ").slice(0, 120) : null;
}

// Código do aparelho atual (do cookie), ou null se ainda não tem.
export async function idDoAparelho(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_APARELHO)?.value ?? "";
  return UUID.test(valor) ? valor : null;
}

// Chamado logo depois de um login bem-sucedido (rotas de login, cadastro
// e /auth/callback). Nunca derruba o login: se algo falhar, só registra
// o erro no log.
export async function registrarEntrada(userId: string, metodo: MetodoAcesso): Promise<void> {
  try {
    const loja = await cookies();
    const aparelhoId = (await idDoAparelho()) ?? randomUUID();
    // Renova o cookie a cada login (400 dias é o máximo aceito pelo Chrome).
    loja.set(COOKIE_APARELHO, aparelhoId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    });

    const admin = createAdminClient();
    if (!admin) {
      console.error("[seguranca/acessos] SUPABASE_SERVICE_ROLE_KEY ausente: acesso não registrado.");
      return;
    }
    const origem = await lerOrigem();
    const { error } = await admin.rpc("registrar_acesso", {
      p_user_id: userId,
      p_metodo: metodo,
      p_aparelho_id: aparelhoId,
      p_aparelho: descreverAparelho(origem.navegador),
      p_ip: origem.ip,
      p_local: origem.local,
      p_navegador: origem.navegador,
    });
    if (error) console.error("[seguranca/acessos] registrar_acesso:", error.code, error.message);
  } catch (e) {
    console.error("[seguranca/acessos] Falha ao registrar acesso:", e);
  }
}

// Recusa POST vindo de outro site (o navegador sempre manda "Origin" em
// POST). Evita que uma página de fora faça login ou encerre sessões em
// nome de quem a visita.
export function mesmaOrigem(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return [new URL(request.url).host, request.headers.get("x-forwarded-host"), request.headers.get("host")].includes(host);
  } catch {
    return false;
  }
}
