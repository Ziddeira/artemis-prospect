"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALERTA_ERRO, BOTAO, BOTAO_SECUNDARIO, CARTAO } from "@/components/ui";

// Botão que liga e desliga a geração de sites com IA (etapa 24). Vale na
// hora para todos os assinantes Platina, sem novo deploy.
export default function Interruptor({
  ativa: ativaInicial,
  aguardando,
  chaveConfigurada,
}: {
  ativa: boolean;
  aguardando: number;
  chaveConfigurada: boolean;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(ativaInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    const nova = !ativa;
    const pergunta = nova
      ? `Ligar a geração de sites? Ela passa a funcionar na hora para todos os assinantes Platina${
          aguardando ? ` (${aguardando} hoje), e cada um recebe um aviso no sino` : ""
        }. A partir daqui, cada geração gasta créditos da Anthropic.`
      : "Desligar a geração de sites? Os assinantes Platina passam a ver a mensagem de liberação em andamento, e nenhuma chamada à IA é feita.";
    if (!confirm(pergunta)) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa: nova }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível salvar agora.");
        return;
      }
      setAtiva(corpo.ativa === true);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`${CARTAO} p-4 sm:p-5 ${ativa ? "" : "border-destaque!"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">Geração de sites com IA</p>
          <p className={`mt-1 font-display text-2xl font-bold ${ativa ? "text-ink" : "text-destaque"}`}>
            {ativa ? "Ligada" : "Desligada"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {ativa
              ? "Todos os assinantes Platina podem gerar e ajustar sites."
              : "O Platina continua à venda e funciona na hora (desbloqueios, buscas e tudo do Pro). Só a geração de site espera: o assinante vê a mensagem de liberação em até 24 horas e nada é enviado à IA."}
          </p>
          {!chaveConfigurada && (
            <p className="mt-2 text-sm text-danger">
              Atenção: a variável ANTHROPIC_API_KEY não está configurada neste servidor. Ligada assim, a geração mostra
              &quot;indisponível no momento&quot; ao assinante (sem descontar nada). Cadastre a chave na Vercel antes de ligar.
            </p>
          )}
        </div>
        <button type="button" onClick={alternar} disabled={salvando} className={ativa ? BOTAO_SECUNDARIO : BOTAO}>
          {salvando ? "Salvando..." : ativa ? "Desligar" : "Ligar a geração"}
        </button>
      </div>
      {erro && (
        <p role="alert" className={`mt-3 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}
    </div>
  );
}
