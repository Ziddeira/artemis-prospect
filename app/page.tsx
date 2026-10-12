import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { PACOTE_EXTRA, PACOTE_SITES, PLANOS, formatarPreco, type Plano } from "@/lib/planos";
import { nomesPaisesInternacionais } from "@/lib/leads/paises";
import { EMAIL_CONTATO, NOME_SITE, URL_SITE, metadadosPagina } from "@/lib/site";
import {
  CATEGORIAS,
  CHAMADA_FINAL,
  CHAMADA_MEIO,
  COMO_FUNCIONA,
  PERGUNTAS,
  PLANOS_TEXTO,
  PROBLEMA,
  SEO,
  TOPO,
} from "@/conteudo/vendas";
import EtiquetaSituacao from "@/components/leads/EtiquetaSituacao";
import { BOTAO, BOTAO_GRANDE, BOTAO_SECUNDARIO, CARTAO, ROTULO_SECAO } from "@/components/ui";
import Logo from "@/components/marca/Logo";
import Mira from "@/components/marca/Mira";
import Rodape from "@/components/Rodape";
import SeletorTema from "@/components/tema/SeletorTema";
import ImagemTopo from "@/components/vendas/ImagemTopo";
import Prova, { TEM_PROVA } from "@/components/vendas/Prova";
import { IconeSeta } from "@/components/Icones";
import passoBuscar from "@/public/vendas/passo-buscar.png";
import passoDesbloquear from "@/public/vendas/passo-desbloquear.png";
import passoContatar from "@/public/vendas/passo-contatar.png";

// Página de vendas pública (artemisprospect.com.br). Os textos ficam em
// conteudo/vendas.ts; preços e limites, em lib/planos.ts. A página é
// estática: quem já está logado é mandado ao painel pelo proxy
// (lib/supabase/proxy.ts), antes de ela abrir.

export const metadata = metadadosPagina({
  titulo: SEO.titulo,
  descricao: SEO.descricao,
  caminho: "/",
  absoluto: true,
});

const IMAGENS_PASSOS: StaticImageData[] = [passoBuscar, passoDesbloquear, passoContatar];

export default function Home() {
  const secoes = [
    { id: "como-funciona", rotulo: "Como funciona" },
    { id: "o-que-acha", rotulo: "O que acha" },
    ...(TEM_PROVA ? [{ id: "prova", rotulo: "Resultados" }] : []),
    { id: "planos", rotulo: "Planos" },
    { id: "perguntas", rotulo: "Dúvidas" },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-canvas">
      <script
        type="application/ld+json"
        // "<" vira < para nenhum texto fechar a tag <script> antes da hora.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados()).replace(/</g, "\\u003c") }}
      />

      <header className="pt-seguro px-seguro relative z-10 border-b border-line-2 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 sm:h-20">
          <Logo tamanho={24} className="sm:hidden" />
          <Logo tamanho={32} className="max-sm:hidden" />
          <nav aria-label="Seções da página" className="flex items-center max-lg:hidden">
            {secoes.map((secao) => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                className="inline-flex min-h-11 items-center px-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-ink-2 transition hover:text-ink"
              >
                {secao.rotulo}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <SeletorTema variante="menu" />
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-3 font-display text-sm font-bold uppercase tracking-[0.08em] text-ink-2 transition hover:text-ink"
            >
              Entrar
            </Link>
            <Link href="/cadastro" className={`${BOTAO} max-sm:hidden`}>
              {TOPO.botao}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* 1. Topo -------------------------------------------------------- */}
        <section className="ap-grid px-seguro relative sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-24 lg:pt-20">
            <div>
              <p className={ROTULO_SECAO}>{TOPO.rotulo}</p>
              <h1 className="mt-5 text-[2.25rem] font-bold uppercase italic leading-[1] text-ink sm:text-[3.25rem] lg:text-[3.5rem]">
                {TOPO.titulo} <span className="text-destaque">{TOPO.tituloDestaque}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-[1.55] text-ink-2 sm:text-[19px]">{TOPO.subtitulo}</p>
              <div className="mt-8">
                <BotaoCadastro texto={TOPO.botao} />
              </div>
              <p className="mt-4 text-sm text-muted">{TOPO.observacao}</p>
            </div>

            <Mira className="mx-auto w-full max-w-sm sm:max-w-none">
              <div className={`${CARTAO} overflow-hidden`}>
                <ImagemTopo alt={TOPO.textoImagem} />
              </div>
            </Mira>
          </div>
        </section>

        {/* 2. O problema ---------------------------------------------------- */}
        <section aria-labelledby="problema-titulo" className="px-seguro border-t border-line bg-surface sm:px-6">
          <div className="mx-auto max-w-6xl py-16 sm:py-20">
            <p className={ROTULO_SECAO}>{PROBLEMA.rotulo}</p>
            <h2 id="problema-titulo" className="mt-3 max-w-3xl text-3xl text-ink sm:text-4xl">
              {PROBLEMA.titulo}
            </h2>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {PROBLEMA.blocos.map((bloco, i) => (
                <li key={bloco.titulo} className="border border-line bg-canvas p-6">
                  <span aria-hidden="true" className="font-display text-sm font-bold tracking-[0.2em] text-destaque">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-xl text-ink">{bloco.titulo}</h3>
                  <p className="mt-2 text-ink-2">{bloco.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. Como funciona ------------------------------------------------- */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-titulo"
          className="px-seguro scroll-mt-4 border-t border-line sm:px-6"
        >
          <div className="mx-auto max-w-6xl py-16 sm:py-20">
            <p className={ROTULO_SECAO}>{COMO_FUNCIONA.rotulo}</p>
            <h2 id="como-funciona-titulo" className="mt-3 max-w-3xl text-3xl text-ink sm:text-4xl">
              {COMO_FUNCIONA.titulo}
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {COMO_FUNCIONA.passos.map((passo, i) => (
                <li key={passo.titulo} className="flex flex-col">
                  <div className="flex aspect-[390/424] items-center overflow-hidden border border-line bg-[var(--ap-black)]">
                    <Image
                      src={IMAGENS_PASSOS[i]}
                      alt={passo.textoImagem}
                      sizes="(min-width: 1152px) 360px, (min-width: 768px) 30vw, 92vw"
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="ap-cut-s flex h-10 w-10 shrink-0 items-center justify-center bg-primary font-display text-lg font-bold text-primary-ink">
                      {i + 1}
                    </span>
                    <h3 className="text-2xl uppercase text-ink">{passo.titulo}</h3>
                  </div>
                  <p className="mt-3 text-ink-2">{passo.texto}</p>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-col items-start gap-5 border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <p className="font-display text-2xl font-bold text-ink">{CHAMADA_MEIO.titulo}</p>
              <BotaoCadastro texto={CHAMADA_MEIO.botao} />
            </div>
          </div>
        </section>

        {/* 4. O que o Ártemis acha ----------------------------------------- */}
        <section
          id="o-que-acha"
          aria-labelledby="o-que-acha-titulo"
          className="px-seguro scroll-mt-4 border-t border-line bg-surface sm:px-6"
        >
          <div className="mx-auto max-w-6xl py-16 sm:py-20">
            <p className={ROTULO_SECAO}>{CATEGORIAS.rotulo}</p>
            <h2 id="o-que-acha-titulo" className="mt-3 max-w-3xl text-3xl text-ink sm:text-4xl">
              {CATEGORIAS.titulo}
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">{CATEGORIAS.texto}</p>
            <ul className="mt-10 grid gap-4 lg:grid-cols-3">
              {CATEGORIAS.itens.map((item) => (
                <li key={item.situacao} className="flex flex-col border border-line bg-canvas p-6">
                  <div>
                    <EtiquetaSituacao situacao={item.situacao} plataforma={item.plataforma} />
                  </div>
                  <h3 className="mt-4 text-xl text-ink">{item.titulo}</h3>
                  <p className="mt-2 text-ink-2">{item.texto}</p>
                  <h4 className="mt-5 font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
                    Exemplos
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-ink-2">
                    {item.exemplos.map((exemplo) => (
                      <li key={exemplo} className="flex gap-2">
                        <span aria-hidden="true" className="text-destaque">
                          ›
                        </span>
                        {exemplo}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 flex-1 border-t border-line pt-4 text-ink">
                    <strong className="font-bold">O que oferecer: </strong>
                    <span className="text-ink-2">{item.abordagem}</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex flex-wrap items-center gap-3 text-ink-2">
              <EtiquetaSituacao situacao="site_proprio" plataforma={null} />
              {CATEGORIAS.rodape}
            </p>
          </div>
        </section>

        {/* 5. Prova (conteudo/vendas.ts, seção PROVA) ---------------------- */}
        <Prova id="prova" />

        {/* 6. Planos -------------------------------------------------------- */}
        <section id="planos" aria-labelledby="planos-titulo" className="px-seguro scroll-mt-4 border-t border-line sm:px-6">
          <div className="mx-auto max-w-6xl py-16 sm:py-20">
            <p className={ROTULO_SECAO}>{PLANOS_TEXTO.rotulo}</p>
            <h2 id="planos-titulo" className="mt-3 text-3xl text-ink sm:text-4xl">
              {PLANOS_TEXTO.titulo}
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">{PLANOS_TEXTO.texto}</p>
            <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.values(PLANOS).map((plano) => (
                <CartaoPlano key={plano.id} plano={plano} destaque={plano.id === PLANOS_TEXTO.planoDestaque} />
              ))}
            </ul>
            <p className="mt-6 text-ink-2">
              Precisa de mais no mês? O pacote extra soma +{PACOTE_EXTRA.desbloqueios} desbloqueios e +
              {PACOTE_EXTRA.buscas} buscas por {formatarPreco(PACOTE_EXTRA.preco)}, sem assinatura. No Platina, o
              pacote de sites soma +{PACOTE_SITES.sites} gerações por {formatarPreco(PACOTE_SITES.preco)}.
            </p>
          </div>
        </section>

        {/* 7. Perguntas frequentes ----------------------------------------- */}
        <section
          id="perguntas"
          aria-labelledby="perguntas-titulo"
          className="px-seguro scroll-mt-4 border-t border-line bg-surface sm:px-6"
        >
          <div className="mx-auto max-w-3xl py-16 sm:py-20">
            <p className={ROTULO_SECAO}>{PERGUNTAS.rotulo}</p>
            <h2 id="perguntas-titulo" className="mt-3 text-3xl text-ink sm:text-4xl">
              {PERGUNTAS.titulo}
            </h2>
            <div className="mt-8 divide-y divide-line border-y border-line">
              {PERGUNTAS.itens.map((item) => (
                <details key={item.pergunta} className="group py-1">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                    {item.pergunta}
                    <span aria-hidden="true" className="font-display text-2xl text-destaque transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-4 text-ink-2">{item.resposta}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-ink-2">
              Outra dúvida? Escreva para{" "}
              <a
                href={`mailto:${EMAIL_CONTATO}`}
                className="font-semibold text-destaque underline-offset-4 hover:underline"
              >
                {EMAIL_CONTATO}
              </a>
              .
            </p>
          </div>
        </section>

        {/* Chamada final ---------------------------------------------------- */}
        <section aria-labelledby="chamada-final-titulo" className="ap-grid px-seguro border-t border-line sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="chamada-final-titulo" className="text-3xl text-ink sm:text-4xl">
                {CHAMADA_FINAL.titulo}
              </h2>
              <p className="mt-3 text-lg text-ink-2">{CHAMADA_FINAL.texto}</p>
            </div>
            <BotaoCadastro texto={CHAMADA_FINAL.botao} />
          </div>
        </section>
      </main>

      {/* 8. Rodapé: privacidade, termos e contato. */}
      <Rodape />
    </div>
  );
}

function BotaoCadastro({ texto }: { texto: string }) {
  return (
    <Link href="/cadastro" className={`${BOTAO_GRANDE} max-sm:w-full`}>
      {texto}
      <IconeSeta width={18} height={18} />
    </Link>
  );
}

function CartaoPlano({ plano, destaque }: { plano: Plano; destaque: boolean }) {
  const pago = plano.preco > 0;
  const periodo = pago ? " por mês" : " para testar";
  return (
    <li className={`${CARTAO} relative flex flex-col p-6 ${destaque ? "border-destaque!" : ""}`}>
      {destaque && (
        <span className="absolute -top-px right-6 bg-primary px-2.5 py-1 font-display text-xs font-bold uppercase tracking-[0.1em] text-primary-ink">
          {PLANOS_TEXTO.seloDestaque}
        </span>
      )}
      <h3 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-ink">{plano.nome}</h3>
      <p className="mt-1 text-sm text-ink-2">{PLANOS_TEXTO.paraQuem[plano.id]}</p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold text-ink">{pago ? formatarPreco(plano.preco) : "R$ 0"}</span>
        {pago && <span className="text-sm text-ink-2">/mês</span>}
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-ink-2">
        <li>
          {plano.buscas} buscas{periodo}
        </li>
        <li>
          {plano.desbloqueios} desbloqueios{periodo}
        </li>
        <li>WhatsApp com mensagem pronta</li>
        <li>Funil de vendas em “Meus leads”</li>
        {plano.contratos && <li>Gerador de contrato, com assinatura online do cliente</li>}
        {plano.hospedagem && <li>Modo Hospedagem (Airbnb e Booking)</li>}
        {plano.internacional && <li>Aba Internacional ({nomesPaisesInternacionais()})</li>}
        {plano.sites > 0 && <li>{plano.sites} sites gerados com IA por mês, para baixar e hospedar onde quiser</li>}
      </ul>
      <Link href="/cadastro" className={`${destaque ? BOTAO : BOTAO_SECUNDARIO} mt-6`}>
        {pago ? `Começar com o ${plano.nome}` : TOPO.botao}
      </Link>
    </li>
  );
}

// Dados estruturados (JSON-LD) para o Google: a organização, o site, o
// aplicativo com o preço de cada plano e as perguntas frequentes.
function dadosEstruturados() {
  const logo = `${URL_SITE}/brand/icon-512.png`;
  const organizacao = `${URL_SITE}/#organizacao`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizacao,
        name: NOME_SITE,
        url: URL_SITE,
        logo,
        email: EMAIL_CONTATO,
      },
      {
        "@type": "WebSite",
        "@id": `${URL_SITE}/#site`,
        name: NOME_SITE,
        url: URL_SITE,
        inLanguage: "pt-BR",
        publisher: { "@id": organizacao },
      },
      {
        "@type": "SoftwareApplication",
        name: NOME_SITE,
        description: SEO.descricao,
        url: URL_SITE,
        image: `${URL_SITE}/opengraph-image.png`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        publisher: { "@id": organizacao },
        offers: Object.values(PLANOS).map((plano) => ({
          "@type": "Offer",
          name: `Plano ${plano.nome}`,
          price: plano.preco.toFixed(2),
          priceCurrency: "BRL",
          url: `${URL_SITE}/cadastro`,
          ...(plano.preco > 0
            ? {
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  price: plano.preco.toFixed(2),
                  priceCurrency: "BRL",
                  billingDuration: "P1M",
                },
              }
            : {}),
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: PERGUNTAS.itens.map((item) => ({
          "@type": "Question",
          name: item.pergunta,
          acceptedAnswer: { "@type": "Answer", text: item.resposta },
        })),
      },
    ],
  };
}
