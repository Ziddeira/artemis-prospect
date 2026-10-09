"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PadAssinatura from "@/components/contratos/PadAssinatura";
import { ALERTA_ERRO, BOTAO, CAMPO, CARTAO, ROTULO } from "@/components/ui";

// Formulário de assinatura do cliente (link público, sem conta).
export default function AssinarClient({ token }: { token: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aoAssinar = useCallback((png: string | null) => setAssinatura(png), []);

  async function assinar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 3) return setErro("Escreva seu nome completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErro("Confira o e-mail.");
    if (!assinatura) return setErro("Faça sua assinatura no quadro (ou envie uma imagem).");
    if (!aceite) return setErro("Marque que leu o contrato e concorda com ele.");

    setEnviando(true);
    try {
      const res = await fetch(`/api/contratos/publico/${token}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, assinatura, aceite }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível registrar a assinatura agora. Tente de novo.");
        return;
      }
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErro("A conexão caiu. Confira sua internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={assinar} className={`${CARTAO} mt-8 p-5 sm:p-6`} noValidate>
      <h2 className="text-xl text-ink">Assinar</h2>
      <p className="mt-1 text-sm text-ink-2">
        Ao assinar, registramos a data e a hora, o seu endereço IP e o nome e o e-mail que você informar. Esses dados
        entram numa página de registro no final do PDF.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assinante-nome" className={ROTULO}>
            Seu nome completo
          </label>
          <input
            id="assinante-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="assinante-email" className={ROTULO}>
            Seu e-mail
          </label>
          <input
            id="assinante-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
            inputMode="email"
            className={CAMPO}
          />
        </div>
      </div>

      <div className="mt-5">
        <p className={ROTULO}>Sua assinatura</p>
        <PadAssinatura onChange={aoAssinar} id="assinatura-cliente" />
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 border border-line p-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-destaque)]"
        />
        <span>Li o contrato inteiro e concordo com todas as cláusulas. Aceito assinar de forma eletrônica.</span>
      </label>

      {erro && (
        <p role="alert" className={`mt-4 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}

      <button type="submit" disabled={enviando} className={`${BOTAO} mt-5 w-full sm:w-auto`}>
        {enviando ? "Registrando a assinatura..." : "Assinar contrato"}
      </button>
    </form>
  );
}
