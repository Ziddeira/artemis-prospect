import Image from "next/image";
import type { ReactNode } from "react";
import { CARTAO, ROTULO_SECAO } from "@/components/ui";
import { PROVA, type Depoimento, type PrintProva } from "@/conteudo/vendas";

// Seção de prova da página de vendas: número em destaque, prints e
// depoimentos, todos vindos de conteudo/vendas.ts. Cada parte só aparece
// quando tem conteúdo. Fora do site oficial (no computador e nas prévias
// da Vercel), o que estiver vazio vira uma caixa tracejada mostrando o
// que falta preencher.
export const MOSTRAR_MOLDES = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV !== "production"
  : process.env.NODE_ENV !== "production";

export const TEM_PROVA = Boolean(PROVA.numero) || PROVA.prints.length > 0 || PROVA.depoimentos.length > 0;

export default function Prova({ id }: { id: string }) {
  if (!TEM_PROVA && !MOSTRAR_MOLDES) return null;
  const { numero, prints, depoimentos } = PROVA;

  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="px-seguro scroll-mt-4 border-t border-line sm:px-6">
      <div className="mx-auto max-w-6xl py-16 sm:py-20">
        <p className={ROTULO_SECAO}>{PROVA.rotulo}</p>
        <h2 id={`${id}-titulo`} className="mt-3 max-w-3xl text-3xl text-ink sm:text-4xl">
          {PROVA.titulo}
        </h2>

        {numero ? (
          <p className="mt-10 flex flex-col gap-2 border-l-4 border-destaque pl-5 sm:flex-row sm:items-baseline sm:gap-5">
            <span className="font-display text-6xl font-bold leading-none text-destaque sm:text-7xl">{numero.valor}</span>
            <span className="max-w-md text-lg text-ink-2">{numero.texto}</span>
          </p>
        ) : (
          MOSTRAR_MOLDES && (
            <Molde className="mt-10">
              Número em destaque (ex.: “1.240 negócios sem site encontrados no último mês”).
            </Molde>
          )
        )}

        {prints.length > 0 ? (
          <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {prints.map((print) => (
              <CartaoPrint key={print.arquivo} print={print} />
            ))}
          </ul>
        ) : (
          MOSTRAR_MOLDES && (
            <Molde className="mt-10">
              Prints reais (conversas, vendas fechadas). Coloque as imagens em public/vendas/provas/.
            </Molde>
          )
        )}

        {depoimentos.length > 0 ? (
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {depoimentos.map((d) => (
              <CartaoDepoimento key={d.nome + d.texto} depoimento={d} />
            ))}
          </ul>
        ) : (
          MOSTRAR_MOLDES && <Molde className="mt-10">Depoimentos (texto, nome, cidade e foto opcional).</Molde>
        )}
      </div>
    </section>
  );
}

function CartaoPrint({ print }: { print: PrintProva }) {
  const celular = print.formato === "celular";
  return (
    <li className={celular ? "" : "col-span-2"}>
      <figure>
        <div
          className={`relative overflow-hidden border border-line bg-[var(--ap-black)] ${celular ? "aspect-[9/16]" : "aspect-[16/10]"}`}
        >
          <Image
            src={print.arquivo}
            alt={print.legenda}
            fill
            sizes={celular ? "(min-width: 1024px) 270px, 46vw" : "(min-width: 1024px) 560px, 92vw"}
            className="object-contain"
          />
        </div>
        <figcaption className="mt-2 text-sm text-ink-2">{print.legenda}</figcaption>
      </figure>
    </li>
  );
}

function CartaoDepoimento({ depoimento }: { depoimento: Depoimento }) {
  const iniciais = depoimento.nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
  return (
    <li className={`${CARTAO} flex flex-col p-6`}>
      <figure className="flex flex-1 flex-col">
        <blockquote className="flex-1 text-lg leading-[1.55] text-ink">
          <span aria-hidden="true" className="font-display text-3xl leading-none text-destaque">
            “
          </span>
          {depoimento.texto}
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3">
          {depoimento.foto ? (
            <Image
              src={depoimento.foto}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display font-bold text-destaque"
            >
              {iniciais}
            </span>
          )}
          <span className="min-w-0">
            <span className="block font-bold text-ink">{depoimento.nome}</span>
            <span className="block text-sm text-ink-2">{depoimento.detalhe}</span>
          </span>
        </figcaption>
      </figure>
    </li>
  );
}

// Caixa tracejada no lugar de um conteúdo que ainda falta. Só aparece
// fora do site oficial.
function Molde({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={`border-2 border-dashed border-line-strong px-5 py-8 text-center text-ink-2 ${className}`}
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-destaque">
        Espaço reservado · edite conteudo/vendas.ts
      </p>
      <p className="mt-2">{children}</p>
    </div>
  );
}
