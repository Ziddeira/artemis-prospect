"use client";

import { useSyncExternalStore } from "react";
import { horaNoFuso, textoDiferencaBrasilia, type PeriodoLigacao } from "@/lib/leads/fuso";
import { IconeRelogio } from "@/components/Icones";

// Hora local da empresa (aba Internacional), para o usuário não ligar de
// madrugada. Atualiza sozinha a cada 30 segundos. A cor nunca é a única
// pista: o período vem escrito ao lado.
const ESTILO: Record<PeriodoLigacao, { caixa: string; texto: string }> = {
  comercial: { caixa: "border-conf-verde/40 bg-conf-verde-soft text-conf-verde", texto: "horário comercial" },
  limite: { caixa: "border-conf-amarelo/40 bg-conf-amarelo-soft text-conf-amarelo", texto: "fora do horário comercial" },
  evitar: { caixa: "border-danger/40 bg-danger-soft text-danger", texto: "madrugada ou noite: não ligue agora" },
};

const INTERVALO_MS = 30_000;

function assinarRelogio(avisar: () => void) {
  const t = setInterval(avisar, INTERVALO_MS);
  return () => clearInterval(t);
}

// Arredondado ao intervalo, para o valor não mudar a cada leitura.
const relogioAgora = () => Math.floor(Date.now() / INTERVALO_MS) * INTERVALO_MS;
// No servidor (e na hidratação) não mostra nada: a hora só aparece no
// navegador, sem risco de o texto do servidor ficar diferente.
const relogioServidor = () => null;

export default function HoraLocal({ fuso }: { fuso: string }) {
  const agora = useSyncExternalStore(assinarRelogio, relogioAgora, relogioServidor);
  if (agora === null) return null;

  const info = horaNoFuso(fuso, new Date(agora));
  if (!info) return null;
  const estilo = ESTILO[info.periodo];
  return (
    <p
      className={`inline-flex max-w-full items-start gap-1.5 border px-2 py-1 text-xs leading-snug ${estilo.caixa}`}
    >
      <IconeRelogio width={14} height={14} className="mt-px shrink-0" />
      <span className="min-w-0 break-words">
        <strong className="font-semibold">Lá são {info.hora}</strong> ({estilo.texto})
        {info.diferencaBrasilia !== null && (
          <span className="opacity-80"> · {textoDiferencaBrasilia(info.diferencaBrasilia)}</span>
        )}
      </span>
    </p>
  );
}
