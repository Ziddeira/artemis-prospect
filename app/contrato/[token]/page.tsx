import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/marca/Logo";
import { ALERTA_SUCESSO, BOTAO, BOTAO_NEUTRO, CARTAO } from "@/components/ui";
import { IconeBaixar } from "@/components/Icones";
import { TextoContrato } from "@/components/contratos/Pecas";
import { contratoPorToken } from "@/lib/contratos/publico";
import { ehDocumentoContrato } from "@/lib/contratos/texto";
import { SEM_INDEXACAO } from "@/lib/site";
import AssinarClient from "./AssinarClient";

export const dynamic = "force-dynamic";

// Link público do contrato: o cliente lê e assina sem criar conta. Fica
// fora do Google e não manda o endereço (que tem o código do link) para
// nenhum outro site.
export const metadata: Metadata = {
  title: "Contrato para assinatura",
  robots: SEM_INDEXACAO,
  referrer: "no-referrer",
};

function dataHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function ContratoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const achado = await contratoPorToken(token);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="pt-seguro px-seguro border-b border-line-2 sm:px-6">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4">
          <Link href="/" aria-label="Ártemis Prospect — início">
            <Logo tamanho={22} />
          </Link>
          <span className="text-xs text-muted">Assinatura de contrato</span>
        </div>
      </header>

      <main className="px-seguro mx-auto max-w-3xl pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6 sm:px-6">
        {!achado ? (
          <Mensagem titulo="Link inválido" texto="Este link não existe mais: o contrato pode ter sido cancelado ou apagado. Peça um link novo a quem enviou." />
        ) : achado.expirado ? (
          <Mensagem titulo="Link expirado" texto="O prazo deste link acabou. Peça um link novo a quem enviou o contrato." />
        ) : (
          <Conteudo token={token} c={achado.contrato} />
        )}

        <p className="mt-10 text-xs text-muted">
          Privacidade: o nome, o e-mail, o endereço IP e a data e hora da assinatura ficam registrados só como prova
          da assinatura, no próprio contrato, e são vistos apenas por quem o enviou. Quem envia o contrato é o
          responsável pelo conteúdo dele; o Ártemis Prospect só fornece a ferramenta.
        </p>
      </main>
    </div>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className={`${CARTAO} p-6`}>
      <h1 className="text-2xl text-ink">{titulo}</h1>
      <p className="mt-2 text-ink-2">{texto}</p>
    </div>
  );
}

function Conteudo({ token, c }: { token: string; c: NonNullable<Awaited<ReturnType<typeof contratoPorToken>>>["contrato"] }) {
  const doc = ehDocumentoContrato(c.conteudo) ? c.conteudo : null;
  const pdf = `/api/contratos/publico/${token}/pdf`;

  return (
    <>
      <p className="font-display text-[13px] font-semibold uppercase tracking-[0.3em] text-destaque">Contrato nº {c.numero}</p>
      <h1 className="mt-2 text-[1.75rem] leading-tight text-ink sm:text-4xl">
        {c.status === "assinado" ? "Contrato assinado" : "Leia e assine o contrato"}
      </h1>
      <p className="mt-2 text-ink-2">
        Enviado por <strong className="text-ink">{c.prestador_nome}</strong>
        {c.enviado_em && ` em ${dataHora(c.enviado_em)}`}. Você não precisa criar conta para assinar.
      </p>

      {c.status === "assinado" ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className={ALERTA_SUCESSO}>
            Assinado por {c.cliente_nome}
            {c.cliente_assinou_em && ` em ${dataHora(c.cliente_assinou_em)}`}. Baixe sua cópia: a última página traz o
            registro da assinatura. Este link fica disponível por 30 dias.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={pdf} className={BOTAO}>
              <IconeBaixar width={18} height={18} />
              Baixar PDF assinado
            </a>
            <a href={`${pdf}?versao=original`} className={BOTAO_NEUTRO}>
              PDF original (para conferir o hash)
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={pdf} className={BOTAO_NEUTRO}>
            <IconeBaixar width={18} height={18} />
            Baixar o PDF para ler
          </a>
        </div>
      )}

      {doc && (
        <div className="mt-6">
          <TextoContrato doc={doc} />
        </div>
      )}
      {c.pdf_original_hash && (
        <p className="mt-3 break-all text-xs text-muted">
          Hash SHA-256 do PDF: <span className="font-mono">{c.pdf_original_hash}</span>
        </p>
      )}

      {c.status === "enviado" && <AssinarClient token={token} />}
    </>
  );
}
