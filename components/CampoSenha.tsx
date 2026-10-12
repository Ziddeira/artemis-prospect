"use client";

import { useState, type InputHTMLAttributes } from "react";
import { CAMPO } from "@/components/ui";
import { IconeOlho, IconeOlhoRiscado } from "@/components/Icones";

// Campo de senha com o botão de olho para mostrar e esconder o que foi
// digitado. Usado no login, no cadastro, na troca e na redefinição de senha.
export default function CampoSenha({
  id,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={visivel ? "text" : "password"}
        // Senha à mostra não deve ser corrigida nem guardada pelo teclado.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${CAMPO} pr-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visivel}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex min-h-11 w-11 items-center justify-center text-ink-2 transition hover:text-ink focus-visible:text-destaque"
      >
        {visivel ? <IconeOlhoRiscado /> : <IconeOlho />}
      </button>
    </div>
  );
}
