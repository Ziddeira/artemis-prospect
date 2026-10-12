import "server-only";

// Confere no servidor o código do captcha (Cloudflare Turnstile) enviado
// pela tela de cadastro (components/Turnstile.tsx). Cada código vale uma
// vez e por 5 minutos.
//
// Ligado quando TURNSTILE_SECRET_KEY está cadastrada. Sem ela, a checagem
// fica desligada (e o log avisa), para o cadastro não parar em ambientes
// sem as chaves (ex.: desenvolvimento local).

const VERIFICAR = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaAtivo() {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

export type ResultadoCaptcha = "ok" | "faltou" | "recusado" | "indisponivel";

export async function verificarCaptcha(token: string, ip: string | null, acao: string): Promise<ResultadoCaptcha> {
  const segredo = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!segredo) {
    console.warn("[seguranca/captcha] TURNSTILE_SECRET_KEY ausente: cadastro sem captcha.");
    return "ok";
  }
  if (!token || token.length > 2048) return "faltou";

  const corpo = new URLSearchParams({ secret: segredo, response: token });
  if (ip) corpo.set("remoteip", ip);

  try {
    const res = await fetch(VERIFICAR, { method: "POST", body: corpo, signal: AbortSignal.timeout(8000) });
    const dados = (await res.json().catch(() => null)) as {
      success?: boolean;
      action?: string;
      "error-codes"?: string[];
    } | null;
    if (!dados) return "indisponivel";
    if (!dados.success) {
      const codigos = dados["error-codes"] ?? [];
      // Chave secreta errada ou erro da Cloudflare: não é culpa de quem
      // está se cadastrando.
      if (codigos.some((c) => c === "invalid-input-secret" || c === "missing-input-secret" || c === "internal-error")) {
        console.error("[seguranca/captcha] Falha na configuração do Turnstile:", codigos.join(", "));
        return "indisponivel";
      }
      return "recusado";
    }
    // O código precisa ter sido gerado para esta ação (não serve um
    // código de outro formulário).
    if (dados.action && dados.action !== acao) return "recusado";
    return "ok";
  } catch (e) {
    console.error("[seguranca/captcha] Turnstile fora do ar:", e);
    return "indisponivel";
  }
}
