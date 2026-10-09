import Link from "next/link";
import { ALERTA_AVISO, BOTAO, CARTAO } from "@/components/ui";
import { MSG_LIBERACAO_SITES } from "@/lib/sites/dados";
import { PACOTE_SITES, PLANOS, formatarPreco } from "@/lib/planos";

// Peças repetidas nas telas de sites gerados com IA (etapa 23).

// Interruptor desligado (etapa 24): aviso calmo, não é erro.
export function AvisoLiberacao({ className = "" }: { className?: string }) {
  return (
    <div role="status" className={`${ALERTA_AVISO} ${className}`}>
      <strong>Liberação em andamento.</strong> {MSG_LIBERACAO_SITES}
    </div>
  );
}

// Aviso fixo: o Ártemis não hospeda o site.
export function AvisoHospedagem({ className = "" }: { className?: string }) {
  return (
    <div role="note" className={`${ALERTA_AVISO} ${className}`}>
      <strong>O Ártemis não hospeda o site.</strong> Você baixa o arquivo (ou o .zip) e publica onde quiser: Netlify,
      Vercel, GitHub Pages, Cloudflare Pages ou a hospedagem do seu cliente. O site fica guardado aqui por 30 dias
      depois da última versão, só para baixar de novo e pedir ajustes.
    </div>
  );
}

export function SaldoSitesResumo({
  sitesRestantes,
  sitesExtras,
  geracoesUltimaHora,
  proximaLiberacao,
}: {
  sitesRestantes: number;
  sitesExtras: number;
  geracoesUltimaHora: number;
  proximaLiberacao: string | null;
}) {
  const hora = proximaLiberacao
    ? new Date(proximaLiberacao).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className={`${CARTAO} flex flex-wrap gap-6 p-4 sm:p-5`}>
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">Gerações do mês</p>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">
          {sitesRestantes}
          <span className="text-base text-ink-2"> de {PLANOS.platina.sites}</span>
        </p>
      </div>
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">Do pacote</p>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{sitesExtras}</p>
        <p className="mt-0.5 text-xs text-muted">não vencem</p>
      </div>
      <div className="min-w-0 flex-1 basis-56 text-sm text-ink-2">
        <p>
          Limite de 2 gerações por hora.{" "}
          {geracoesUltimaHora >= 2 && hora ? `A próxima fica liberada às ${hora}.` : `Usadas na última hora: ${geracoesUltimaHora}.`}
        </p>
        <p className="mt-1">Cada site tem 2 ajustes grátis; do 3º em diante, cada ajuste conta como uma geração nova.</p>
        <p className="mt-1">
          Precisa de mais? <Link href="/painel/plano" className="font-semibold text-ink underline">Pacote +{PACOTE_SITES.sites} gerações</Link> por{" "}
          {formatarPreco(PACOTE_SITES.preco)}.
        </p>
      </div>
    </div>
  );
}

export function ConvitePlatina() {
  return (
    <div className={`${CARTAO} p-5 sm:p-6`}>
      <p className="font-display text-lg font-bold uppercase tracking-[0.08em] text-ink">Plano Platina</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Gere a landing page do seu lead com IA: uma página só, responsiva, com serviços, sobre, depoimentos,
        localização e botão de WhatsApp, pronta para baixar. São {PLANOS.platina.sites} gerações por mês, além de tudo
        do Pro, por {formatarPreco(PLANOS.platina.preco)}/mês.
      </p>
      <Link href="/painel/plano" className={`${BOTAO} mt-4`}>
        Conhecer o Platina
      </Link>
    </div>
  );
}
