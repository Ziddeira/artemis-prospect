"use client";

// Parte do cartão de "Meus leads" para marcar o lead como inválido
// ("empresa não existe mais" ou "telefone não atende"). O banco registra
// a marcação e, dentro das regras, devolve 1 crédito na hora
// (supabase/etapa20-1-leads-invalidos.sql). Depois de marcado, só mostra
// o resultado: não dá para desmarcar.
import { useState } from "react";
import {
  LIMITE_DEVOLUCOES_MES,
  MOTIVOS_INVALIDO,
  PRAZO_DEVOLUCAO_DIAS,
  ROTULO_MOTIVO,
  ROTULO_SEM_DEVOLUCAO,
  type MarcacaoInvalido,
  type MotivoInvalido,
  type SemDevolucao,
} from "@/lib/leads/invalido";
import { BOTAO_NEUTRO } from "@/components/ui";
import { IconeBandeira } from "@/components/Icones";

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline";

export default function MarcarInvalido({
  placeId,
  nomeLead,
  marcacao,
  onMarcado,
}: {
  placeId: string;
  nomeLead: string;
  marcacao: MarcacaoInvalido | null;
  onMarcado: (m: MarcacaoInvalido) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Resultado da marcação feita agora (mensagem mais completa que a fixa).
  const [resultado, setResultado] = useState<string | null>(null);

  if (marcacao) {
    return (
      <div className="mt-3 border border-line bg-canvas px-3 py-2 text-sm text-ink-2">
        <p>
          <strong className="font-semibold text-ink">Marcado como inválido:</strong>{" "}
          {ROTULO_MOTIVO[marcacao.motivo].toLowerCase()}.{" "}
          {marcacao.devolvido
            ? "O crédito foi devolvido."
            : `Sem devolução de crédito${marcacao.semDevolucao ? ` (${ROTULO_SEM_DEVOLUCAO[marcacao.semDevolucao]})` : ""}.`}
        </p>
        {resultado && <p className="mt-1 text-xs text-muted" role="status">{resultado}</p>}
      </div>
    );
  }

  async function marcar(motivo: MotivoInvalido) {
    const ok = window.confirm(
      `Marcar “${nomeLead}” como “${ROTULO_MOTIVO[motivo].toLowerCase()}”? Não dá para desfazer.`,
    );
    if (!ok) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/leads/invalido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, motivo }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível marcar agora.");
        return;
      }
      const semDevolucao = (corpo.semDevolucao ?? null) as SemDevolucao | null;
      setResultado(
        corpo.devolvido
          ? `Você tem ${corpo.creditosRestantes} crédito(s) agora. Devoluções neste mês: ${corpo.devolucoesNoMes} de ${corpo.limiteMes}.`
          : "A marcação foi registrada e ajuda a melhorar os leads.",
      );
      onMarcado({ motivo, devolvido: !!corpo.devolvido, semDevolucao });
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={`${LINK} mt-1`}>
        <IconeBandeira width={16} height={16} />
        Lead inválido?
      </button>
    );
  }

  return (
    <div className="mt-3 border border-line bg-canvas p-3">
      <p className="text-sm font-semibold text-ink">O que aconteceu com este lead?</p>
      <p className="mt-0.5 text-xs text-muted">
        Devolvemos 1 crédito na hora, até {LIMITE_DEVOLUCOES_MES} vezes por mês, para leads desbloqueados há até{" "}
        {PRAZO_DEVOLUCAO_DIAS} dias.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
        {MOTIVOS_INVALIDO.map((m) => (
          <button key={m} type="button" disabled={enviando} onClick={() => marcar(m)} className={BOTAO_NEUTRO}>
            {ROTULO_MOTIVO[m]}
          </button>
        ))}
        <button type="button" disabled={enviando} onClick={() => setAberto(false)} className={LINK}>
          Cancelar
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
