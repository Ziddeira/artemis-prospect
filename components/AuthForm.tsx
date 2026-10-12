"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { ALERTA_ERRO, ALERTA_SUCESSO, BOTAO, CAMPO, ROTULO } from "@/components/ui";
import TelaAuth, { LINK_AUTH } from "@/components/TelaAuth";
import BotaoGoogle from "@/components/BotaoGoogle";
import CampoSenha from "@/components/CampoSenha";
import ForcaSenha from "@/components/ForcaSenha";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import { SENHA_MAX, SENHA_MIN, avaliarSenha } from "@/lib/seguranca/senha";

type Mode = "login" | "cadastro";

// Link dentro do texto corrido (Termos e Privacidade): sublinhado e com
// área de toque maior sem quebrar a linha.
const LINK_DOCUMENTO = "font-semibold text-destaque underline underline-offset-4 py-2";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  // Cada código do captcha vale uma vez: muda para pedir outro.
  const [reiniciarCaptcha, setReiniciarCaptcha] = useState(0);
  const aoMudarCaptcha = useCallback((token: string | null) => setCaptcha(token), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (mode !== "login") return null;
    const erro = searchParams.get("erro");
    if (erro === "confirmacao") {
      return "Não foi possível validar o link do e-mail. Ele pode ter expirado ou ter sido aberto em outro navegador — peça um link novo.";
    }
    if (erro === "google") {
      return "Não foi possível entrar com o Google. Tente de novo — e, se o problema continuar, entre com e-mail e senha.";
    }
    return null;
  });
  const [info, setInfo] = useState<string | null>(null);

  const cadastro = mode === "cadastro";
  const senhasDiferentes = cadastro && confirmacao.length > 0 && confirmacao !== password;

  // Login e cadastro passam pelo servidor (app/api/auth/*), que confere
  // tudo de novo, aplica o limite de tentativas e valida o captcha.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (cadastro) {
      if (!avaliarSenha(password, email).ok) {
        setError("A senha ainda não atende a todos os itens da lista abaixo do campo.");
        return;
      }
      if (password !== confirmacao) {
        setError("As duas senhas não são iguais.");
        return;
      }
      if (TURNSTILE_SITE_KEY && !captcha) {
        setError("Aguarde a verificação anti-robô terminar (ou marque a caixa) antes de criar a conta.");
        return;
      }
    }

    setLoading(true);
    let resposta: { ok?: boolean; sessao?: boolean; erro?: string } = {};
    let ok = false;
    try {
      const res = await fetch(cadastro ? "/api/auth/cadastro" : "/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cadastro ? { email, senha: password, confirmacao, captcha: captcha ?? "" } : { email, senha: password },
        ),
      });
      ok = res.ok;
      resposta = await res.json().catch(() => ({}));
    } catch {
      resposta = { erro: "Não foi possível falar com o servidor agora. Confira sua internet e tente de novo." };
    }
    setLoading(false);

    if (!ok) {
      setError(resposta.erro || "Não foi possível concluir agora. Tente de novo em instantes.");
      if (cadastro) setReiniciarCaptcha((n) => n + 1);
      return;
    }
    if (!cadastro || resposta.sessao) {
      router.push("/painel/buscar");
      router.refresh();
      return;
    }
    setInfo("Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.");
  }

  return (
    <TelaAuth
      titulo={mode === "login" ? "Entrar na sua conta" : "Criar conta grátis"}
      descricao={
        mode === "login"
          ? "Use sua conta do Google ou o e-mail e a senha do cadastro."
          : "Leva menos de um minuto."
      }
    >
      {/* Veio pelo link de indicação de alguém (/convite/<código>). */}
      {cadastro && searchParams.get("convite") && (
        <p role="status" className={`${ALERTA_SUCESSO} mb-6`}>
          Você veio pelo convite de um colega. Crie sua conta (com o Google ou com e-mail) e ela fica ligada à
          indicação.
        </p>
      )}

      <BotaoGoogle />

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className={ROTULO}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={CAMPO}
            placeholder="email@gmail.com"
          />
        </div>
        <div>
          <label htmlFor="password" className={ROTULO}>
            Senha
          </label>
          <CampoSenha
            id="password"
            required
            minLength={cadastro ? SENHA_MIN : undefined}
            maxLength={SENHA_MAX}
            autoComplete={cadastro ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={cadastro ? `Mínimo ${SENHA_MIN} caracteres, com letras e números` : undefined}
            aria-describedby={cadastro ? "forca-senha" : undefined}
          />
          {cadastro && <ForcaSenha id="forca-senha" senha={password} email={email} />}
          {mode === "login" && (
            <Link href="/esqueci-senha" className={`${LINK_AUTH} text-sm`}>
              Esqueci minha senha
            </Link>
          )}
        </div>

        {cadastro && (
          <div>
            <label htmlFor="confirmar-senha" className={ROTULO}>
              Confirme a senha
            </label>
            <CampoSenha
              id="confirmar-senha"
              required
              maxLength={SENHA_MAX}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Digite a mesma senha de novo"
              aria-invalid={senhasDiferentes}
              aria-describedby="aviso-confirmacao"
            />
            <p id="aviso-confirmacao" aria-live="polite" className="mt-1.5 text-sm">
              {senhasDiferentes ? (
                <span className="text-danger">As senhas não são iguais.</span>
              ) : confirmacao && confirmacao === password ? (
                <span className="text-ink-2">✓ As senhas são iguais.</span>
              ) : null}
            </p>
          </div>
        )}

        {cadastro && <Turnstile acao="cadastro" aoMudar={aoMudarCaptcha} reiniciar={reiniciarCaptcha} />}

        {error && (
          <div role="alert" className={ALERTA_ERRO}>
            {error}
          </div>
        )}
        {info && (
          <div role="status" className={ALERTA_SUCESSO}>
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${BOTAO} mt-2 w-full text-base!`}
        >
          {loading
            ? "Aguarde..."
            : mode === "login"
              ? "Entrar"
              : "Criar conta"}
        </button>
      </form>

      {/* Vale também para quem cria a conta pelo botão do Google. */}
      {mode === "cadastro" && (
        <p className="mt-4 text-center text-sm leading-relaxed text-ink-2">
          Ao criar a conta, com e-mail ou com o Google, você confirma que tem 18 anos ou mais e
          concorda com os{" "}
          <Link href="/termos" className={LINK_DOCUMENTO}>
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className={LINK_DOCUMENTO}>
            Política de privacidade
          </Link>
          .
        </p>
      )}

      <p className="mt-6 text-center text-sm text-ink-2">
        {mode === "login" ? (
          <>
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className={LINK_AUTH}>
              Criar conta
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/login" className={LINK_AUTH}>
              Entrar
            </Link>
          </>
        )}
      </p>
    </TelaAuth>
  );
}
