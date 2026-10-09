import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN, type LinhaContrato } from "./servidor";

// Contrato pelo link público (cliente sem conta). O visitante nunca fala
// com o banco: quem lê é o servidor, com a service_role, e só aquele
// contrato do link. null = link inválido, cancelado ou apagado.
export async function contratoPorToken(token: string): Promise<{ contrato: LinhaContrato; expirado: boolean } | null> {
  if (!TOKEN.test(token)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("contratos").select("*").eq("token", token).maybeSingle<LinhaContrato>();
  if (error) {
    console.error("[contratos/publico]", error.code, error.message);
    return null;
  }
  if (!data || data.status === "rascunho") return null;
  const expirado = !data.link_expira_em || new Date(data.link_expira_em) < new Date();
  return { contrato: data, expirado };
}
