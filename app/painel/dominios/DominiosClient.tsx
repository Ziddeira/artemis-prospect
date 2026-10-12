"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ALERTA_AVISO, ALERTA_ERRO, BOTAO, BOTAO_WHATSAPP, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { IconeGlobo, IconeLink } from "@/components/Icones";
import {
  LIMITE_BUSCAS_MINUTO,
  montarLinkRegistro,
  normalizarNome,
  type Extensao,
  type LinkRegistrador,
  type RespostaBusca,
  type ResultadoDominio,
} from "@/lib/dominios/regras";

export default function DominiosClient({
  links,
  nomeInicial,
  cidadeInicial,
}: {
  links: Record<Extensao, LinkRegistrador>;
  nomeInicial: string;
  cidadeInicial: string;
}) {
  const [texto, setTexto] = useState(nomeInicial);
  const [cidade, setCidade] = useState(cidadeInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaBusca | null>(null);
  const buscouInicial = useRef(false);

  const nome = normalizarNome(texto);

  async function buscar(nomeBusca: string, cidadeBusca: string) {
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/dominios/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeBusca, cidade: cidadeBusca }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok || !corpo) {
        throw new Error(corpo?.erro || "Não foi possível buscar agora. Confira sua internet e tente de novo.");
      }
      setResposta(corpo as RespostaBusca);
    } catch (e) {
      setErro(
        e instanceof TypeError
          ? "Sem conexão com o servidor. Confira sua internet e tente de novo."
          : e instanceof Error
            ? e.message
            : "Não foi possível buscar agora.",
      );
    } finally {
      setCarregando(false);
    }
  }

  // Veio pelo atalho do lead: já busca ao abrir (uma vez só).
  useEffect(() => {
    if (buscouInicial.current || normalizarNome(nomeInicial).length < 2) return;
    buscouInicial.current = true;
    buscar(nomeInicial, cidadeInicial);
  }, [nomeInicial, cidadeInicial]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.length >= 2 && !carregando) buscar(texto, cidade);
  }

  return (
    <div className="mt-6">
      <AvisoRegistrador />

      <form onSubmit={enviar} className={`${CARTAO} mt-5 p-4 sm:p-5`}>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <label htmlFor="dominio-nome" className={ROTULO}>
              Nome desejado
            </label>
            <input
              id="dominio-nome"
              className={CAMPO}
              placeholder="ex.: Padaria São João"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={200}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="dominio-previa"
            />
          </div>
          <div>
            <label htmlFor="dominio-cidade" className={ROTULO}>
              Cidade <span className="font-normal text-muted">(opcional, para sugestões)</span>
            </label>
            <input
              id="dominio-cidade"
              className={CAMPO}
              placeholder="ex.: Campinas"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p id="dominio-previa" className="min-w-0 break-words text-sm text-ink-2">
            {nome.length >= 2 ? (
              <>
                Vamos consultar <strong className="text-ink">{nome}</strong> em .com.br, .com, .net, .app, .site e
                .online.
              </>
            ) : (
              "Acentos, espaços e símbolos são tirados automaticamente."
            )}
          </p>
          <button type="submit" className={BOTAO} disabled={carregando || nome.length < 2}>
            {carregando ? "Consultando..." : "Buscar domínio"}
          </button>
        </div>
      </form>

      {erro && (
        <p role="alert" className={`${ALERTA_ERRO} mt-4`}>
          {erro}
        </p>
      )}

      <div aria-live="polite" aria-busy={carregando}>
        {carregando && !resposta && <p className="mt-6 text-sm text-ink-2">Consultando as extensões...</p>}

        {resposta && (
          <div className={carregando ? "opacity-60 transition" : undefined}>
            {resposta.aviso && <p className={`${ALERTA_AVISO} mt-4`}>{resposta.aviso}</p>}

            <h2 className="mt-6 text-lg text-ink">
              Resultado para <span className="break-all">{resposta.nome}</span>
            </h2>
            <ListaResultados resultados={resposta.resultados} links={links} />

            {resposta.sugestoes.length > 0 && (
              <>
                <h2 className="mt-8 text-lg text-ink">Sugestões parecidas</h2>
                <p className="mt-1 text-sm text-ink-2">
                  O nome exato está ocupado. Estas variações foram conferidas no .com.br e no .com.
                </p>
                <ListaResultados
                  resultados={resposta.sugestoes.flatMap((s) => s.resultados)}
                  links={links}
                />
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-muted">
        A consulta usa o RDAP, serviço público e oficial dos registros de domínio (Registro.br para o .com.br). Para
        não sobrecarregar esses serviços, cada pessoa pode fazer até {LIMITE_BUSCAS_MINUTO} buscas por minuto, e o
        resultado fica guardado por alguns minutos.
      </p>
    </div>
  );
}

function AvisoRegistrador() {
  return (
    <div className={`${CARTAO} flex gap-3 p-4`}>
      <IconeGlobo className="mt-0.5 shrink-0 text-destaque" />
      <div className="text-sm text-ink-2">
        <p>
          <strong className="text-ink">O Ártemis não vende domínios.</strong> Aqui você só confere se o nome está
          livre. O registro e o pagamento são feitos no site do registrador, que abre numa nova aba.
        </p>
        <p className="mt-1.5">
          “Disponível” quer dizer que o serviço oficial de consulta não encontrou o domínio. Quem confirma de vez é o
          registrador, na hora de registrar. Alguns links podem ser de parceiros: o Ártemis pode receber uma comissão,
          sem custo extra para você.
        </p>
      </div>
    </div>
  );
}

const ROTULO_SITUACAO: Record<ResultadoDominio["situacao"], string> = {
  disponivel: "Disponível",
  ocupado: "Ocupado",
  invalido: "Nome não permitido",
  limite: "Consulta em pausa",
  erro: "Não deu para consultar",
};

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function ListaResultados({
  resultados,
  links,
}: {
  resultados: ResultadoDominio[];
  links: Record<Extensao, LinkRegistrador>;
}) {
  return (
    <ul className={`${CARTAO} mt-3 divide-y divide-line-2`}>
      {resultados.map((r) => {
        const link = links[r.extensao];
        const nome = r.dominio.slice(0, -(r.extensao.length + 1));
        return (
          <li key={r.dominio} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="break-all font-semibold text-ink">
                {nome}
                <span className="text-destaque">.{r.extensao}</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-2">
                <Selo situacao={r.situacao} />
                {r.situacao === "ocupado" && r.expiraEm && (
                  <span className="ml-2">Expira em {dataCurta(r.expiraEm)}</span>
                )}
                {r.situacao === "invalido" && (
                  <span className="ml-2">
                    {r.extensao === "com.br" ? "No .com.br, o nome vai de 2 a 26 caracteres." : "Nome fora das regras."}
                  </span>
                )}
              </p>
            </div>
            {r.situacao === "disponivel" && (
              <a
                href={montarLinkRegistro(link.url, nome, r.extensao)}
                target="_blank"
                rel="noopener sponsored"
                className={BOTAO_WHATSAPP}
              >
                <IconeLink width={16} height={16} />
                Registrar
                <span className="sr-only">
                  {" "}
                  {r.dominio} no site {link.registrador} (abre em nova aba)
                </span>
                <span aria-hidden="true" className="font-sans text-xs font-semibold normal-case tracking-normal">
                  · {link.registrador}
                </span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Selo({ situacao }: { situacao: ResultadoDominio["situacao"] }) {
  const cor =
    situacao === "disponivel"
      ? "border-conf-verde/40 bg-conf-verde-soft text-conf-verde"
      : situacao === "ocupado"
        ? "border-line-strong text-ink-2"
        : "border-conf-amarelo/40 bg-conf-amarelo-soft text-conf-amarelo";
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-semibold ${cor}`}>
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}
