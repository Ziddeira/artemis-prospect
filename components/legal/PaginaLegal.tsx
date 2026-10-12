import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/marca/Logo";
import Rodape from "@/components/Rodape";
import SeletorTema from "@/components/tema/SeletorTema";
import { ALERTA_AVISO, ROTULO_SECAO } from "@/components/ui";
import { DATA_DOCUMENTOS_LEGAIS, EMAIL_CONTATO } from "@/lib/site";

// Moldura dos documentos públicos (Termos de uso e Política de
// privacidade): topo com a logo, aviso de documento inicial, sumário,
// as seções e o rodapé. Abre sem login, nos dois temas.
export default function PaginaLegal({
  rotulo,
  titulo,
  resumo,
  secoes,
  children,
}: {
  rotulo: string;
  titulo: string;
  resumo: ReactNode;
  // Mesma ordem e mesmos ids das <Secao> do conteúdo, para o sumário.
  secoes: { id: string; titulo: string }[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="pt-seguro px-seguro border-b border-line-2 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 sm:h-20">
          <Link href="/" aria-label="Ártemis Prospect — voltar para o início">
            <Logo tamanho={24} className="sm:hidden" />
            <Logo tamanho={30} className="max-sm:hidden" />
          </Link>
          <div className="flex items-center gap-1">
            <SeletorTema variante="menu" />
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-3 font-display text-sm font-bold uppercase tracking-[0.08em] text-ink-2 transition hover:text-ink sm:px-4"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="px-seguro flex-1 sm:px-6">
        <article className="mx-auto max-w-3xl py-12 sm:py-16">
          <p className={ROTULO_SECAO}>{rotulo}</p>
          <h1 className="mt-3 text-[2rem] leading-tight text-ink sm:text-[2.625rem]">{titulo}</h1>
          <p className="mt-3 text-sm text-muted">Versão de {DATA_DOCUMENTOS_LEGAIS}</p>
          <div className="mt-6 text-lg leading-[1.6] text-ink-2">{resumo}</div>

          <div role="note" className={`${ALERTA_AVISO} mt-8 text-base!`}>
            <strong className="font-bold">Documento inicial.</strong> Este texto é a primeira versão
            e pode ser revisado a qualquer momento, à medida que o Ártemis Prospect cresce. Quando
            houver mudança importante, avisamos no site com antecedência. Dúvidas:{" "}
            <a href={`mailto:${EMAIL_CONTATO}`} className="font-semibold underline underline-offset-4">
              {EMAIL_CONTATO}
            </a>
            .
          </div>

          <nav aria-label="Sumário" className="mt-10 border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">Sumário</h2>
            <ol className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {secoes.map((secao, i) => (
                <li key={secao.id}>
                  <a
                    href={`#${secao.id}`}
                    className="flex min-h-11 items-center gap-2 py-1 text-ink-2 transition hover:text-ink"
                  >
                    <span className="w-6 shrink-0 font-display font-semibold text-destaque">{i + 1}.</span>
                    {secao.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-12">{children}</div>
        </article>
      </main>

      <Rodape />
    </div>
  );
}

// Uma seção numerada do documento. Número e título vêm da mesma lista
// do sumário, para os dois nunca ficarem diferentes.
export function Secao({
  secoes,
  id,
  children,
}: {
  secoes: { id: string; titulo: string }[];
  id: string;
  children: ReactNode;
}) {
  const indice = secoes.findIndex((secao) => secao.id === id);
  if (indice < 0) throw new Error(`Seção "${id}" fora do sumário.`);
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6">
      <h2 id={`${id}-titulo`} className="flex gap-3 text-2xl leading-tight text-ink sm:text-[1.75rem]">
        <span className="text-destaque">{indice + 1}.</span>
        <span>{secoes[indice].titulo}</span>
      </h2>
      <div className={TEXTO_LEGAL}>{children}</div>
    </section>
  );
}

// Subtítulo dentro de uma seção.
export function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-lg font-bold text-ink">{children}</h3>;
}

// Texto corrido dos documentos: listas com marcador, links em destaque e
// negrito na cor do texto principal.
const TEXTO_LEGAL =
  "mt-4 space-y-4 text-base leading-[1.7] text-ink-2 [&_a]:font-semibold [&_a]:text-destaque [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-bold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:marker:text-destaque";
