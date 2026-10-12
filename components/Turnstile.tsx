"use client";

import { useEffect, useRef } from "react";

// Captcha da Cloudflare (Turnstile) da criação de conta. Na maioria das
// vezes a pessoa não precisa clicar em nada: a Cloudflare confere sozinha
// e devolve um código de uso único, que o servidor valida
// (app/api/auth/cadastro). Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY o widget
// não aparece (o servidor também desliga a checagem sem a chave secreta).
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface OpcoesTurnstile {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opcoes: OpcoesTurnstile) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

let carregando: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      carregando = null;
      reject(new Error("Falha ao carregar o Turnstile"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

export default function Turnstile({
  acao,
  aoMudar,
  reiniciar,
}: {
  acao: string;
  // Recebe o código quando a verificação passa e null quando ele vence
  // ou dá erro.
  aoMudar: (token: string | null) => void;
  // Mude este número para pedir um código novo (cada código vale uma vez).
  reiniciar: number;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const aviso = useRef(aoMudar);
  useEffect(() => {
    aviso.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelado = false;
    carregarScript()
      .then(() => {
        if (cancelado || !caixa.current || !window.turnstile) return;
        const escuro = document.documentElement.getAttribute("data-tema") !== "claro";
        widget.current = window.turnstile.render(caixa.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: acao,
          theme: escuro ? "dark" : "light",
          language: "pt-br",
          size: "flexible",
          callback: (token) => aviso.current(token),
          "expired-callback": () => aviso.current(null),
          "error-callback": () => aviso.current(null),
        });
      })
      .catch(() => aviso.current(null));
    return () => {
      cancelado = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [acao]);

  useEffect(() => {
    if (reiniciar > 0 && widget.current && window.turnstile) {
      aviso.current(null);
      window.turnstile.reset(widget.current);
    }
  }, [reiniciar]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={caixa} className="min-h-[65px]" />;
}
