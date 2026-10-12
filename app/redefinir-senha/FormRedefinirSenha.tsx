"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALERTA_ERRO, BOTAO, ROTULO } from "@/components/ui";
import CampoSenha from "@/components/CampoSenha";
import ForcaSenha from "@/components/ForcaSenha";
import { SENHA_MAX, SENHA_MIN, avaliarSenha } from "@/lib/seguranca/senha";

// A senha nova é conferida de novo e gravada pelo servidor
// (app/api/auth/redefinir-senha), com as mesmas regras do cadastro.
export default function FormRedefinirSenha({ email }: { email?: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const diferentes = confirmacao.length > 0 && confirmacao !== senha;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!avaliarSenha(senha, email).ok) {
      setErro("A senha ainda não atende a todos os itens da lista abaixo do campo.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, confirmacao }),
      });
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.erro || "Não foi possível salvar a senha. Peça um link novo e tente de novo.");
        return;
      }
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
      return;
    } finally {
      setSalvando(false);
    }
    router.push("/painel/buscar");
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="nova-senha" className={ROTULO}>
          Nova senha
        </label>
        <CampoSenha
          id="nova-senha"
          required
          minLength={SENHA_MIN}
          maxLength={SENHA_MAX}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder={`Mínimo ${SENHA_MIN} caracteres, com letras e números`}
          aria-describedby="forca-nova-senha"
        />
        <ForcaSenha id="forca-nova-senha" senha={senha} email={email} />
      </div>
      <div>
        <label htmlFor="confirmar-senha" className={ROTULO}>
          Repita a nova senha
        </label>
        <CampoSenha
          id="confirmar-senha"
          required
          maxLength={SENHA_MAX}
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          aria-invalid={diferentes}
          aria-describedby="aviso-confirmar-senha"
        />
        <p id="aviso-confirmar-senha" aria-live="polite" className="mt-1.5 text-sm text-danger">
          {diferentes ? "As senhas não são iguais." : null}
        </p>
      </div>
      {erro && (
        <div role="alert" className={ALERTA_ERRO}>
          {erro}
        </div>
      )}
      <button type="submit" disabled={salvando} className={`${BOTAO} mt-2 w-full text-base!`}>
        {salvando ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}
