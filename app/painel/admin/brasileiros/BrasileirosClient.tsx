"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALERTA_AVISO, ALERTA_ERRO, BOTAO, BOTAO_NEUTRO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { IconeFechar } from "@/components/Icones";
import { LIMITE_PALAVRA, LIMITE_REGIAO } from "@/lib/leads/listasBrasileiras";
import type { CodigoPais } from "@/lib/leads/paises";

interface PaisLista {
  codigo: CodigoPais;
  nome: string;
  bandeira: string;
}

type Lista = "palavra" | "regiao";

export default function BrasileirosClient({
  ativo,
  palavras,
  paises,
  regioes,
}: {
  // false = etapa 22 não rodada (as tabelas não existem).
  ativo: boolean;
  palavras: string[];
  paises: PaisLista[];
  regioes: Record<CodigoPais, string[]>;
}) {
  const [aba, setAba] = useState<CodigoPais>(paises[0].codigo);
  const pais = paises.find((p) => p.codigo === aba) ?? paises[0];

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-ink-2">
        Na aba Internacional, cada lead pode ganhar o selo <strong className="text-ink">“Provável negócio
        brasileiro”</strong>. O sinal mais forte são as avaliações escritas em português; depois, o tipo do
        negócio no Google (ex.: restaurante brasileiro, açaí); e, mais fraco, as palavras do nome abaixo.
        Mudanças valem para as próximas buscas.
      </p>

      {!ativo && (
        <p className={ALERTA_AVISO}>
          As listas ainda não foram ativadas no banco. Rode o script supabase/etapa22-negocios-brasileiros.sql no
          Supabase. Até lá, valem as listas iniciais do código, mostradas abaixo só para leitura.
        </p>
      )}

      <section aria-labelledby="titulo-palavras" className={`${CARTAO} p-4 sm:p-5`}>
        <h2 id="titulo-palavras" className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink">
          Palavras no nome ({palavras.length})
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          A comparação ignora acentos e maiúsculas, e a palavra precisa aparecer inteira (“Rio” não pega
          “Riordan”). Expressões como “Brazilian wax”, “Brazilian blowout” e “Brazilian jiu-jitsu” não contam:
          são serviços que qualquer salão ou academia oferece.
        </p>
        <ListaEditavel
          lista="palavra"
          itens={palavras}
          ativo={ativo}
          rotulo="Incluir palavra"
          exemplo="ex.: Pão de Queijo"
          limite={LIMITE_PALAVRA}
          avisoTirar={(p) => `Tirar “${p}”? Nomes com essa palavra deixam de contar como sinal.`}
        />
      </section>

      <section aria-labelledby="titulo-regioes" className={`${CARTAO} p-4 sm:p-5`}>
        <h2 id="titulo-regioes" className="text-[13px] font-semibold uppercase tracking-[0.2em] text-ink">
          Atalhos de região
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Regiões com grande comunidade brasileira. Aparecem embaixo do campo de região, na aba Internacional, e
          o usuário toca para pôr na busca. Escreva do jeito que vai para o Google: cidade e sigla do estado.
        </p>

        <div role="group" aria-label="País" className="mt-4 flex flex-wrap gap-2">
          {paises.map((p) => (
            <button
              key={p.codigo}
              type="button"
              aria-pressed={aba === p.codigo}
              onClick={() => setAba(p.codigo)}
              className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold transition ${
                aba === p.codigo
                  ? "border-destaque bg-primary-soft text-destaque"
                  : "border-line bg-surface text-ink-2 hover:text-ink"
              }`}
            >
              <span aria-hidden="true">{p.bandeira}</span>
              {p.nome}
              <span className="text-muted">({regioes[p.codigo]?.length ?? 0})</span>
            </button>
          ))}
        </div>

        <ListaEditavel
          key={pais.codigo}
          lista="regiao"
          pais={pais.codigo}
          itens={regioes[pais.codigo] ?? []}
          ativo={ativo}
          rotulo={`Incluir região em ${pais.nome}`}
          exemplo={pais.codigo === "CA" ? "ex.: Mississauga ON" : "ex.: Pompano Beach FL"}
          limite={LIMITE_REGIAO}
          avisoTirar={(r) => `Tirar o atalho “${r}” de ${pais.nome}?`}
        />
      </section>
    </div>
  );
}

function ListaEditavel({
  lista,
  pais,
  itens,
  ativo,
  rotulo,
  exemplo,
  limite,
  avisoTirar,
}: {
  lista: Lista;
  pais?: CodigoPais;
  itens: string[];
  ativo: boolean;
  rotulo: string;
  exemplo: string;
  limite: number;
  avisoTirar: (item: string) => string;
}) {
  const router = useRouter();
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const idCampo = `novo-${lista}${pais ? `-${pais}` : ""}`;

  async function enviar(metodo: "POST" | "DELETE", valor: string) {
    setErro(null);
    setOcupado(valor);
    try {
      const res = await fetch("/api/admin/brasileiros", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lista, pais, valor }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro || "Não foi possível salvar.");
      if (metodo === "POST") setNovo("");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(null);
    }
  }

  function incluir(e: FormEvent) {
    e.preventDefault();
    if (novo.trim()) enviar("POST", novo.trim());
  }

  function tirar(item: string) {
    if (!window.confirm(avisoTirar(item))) return;
    enviar("DELETE", item);
  }

  return (
    <div className="mt-4">
      <form onSubmit={incluir} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={idCampo} className={ROTULO}>
            {rotulo}
          </label>
          <input
            id={idCampo}
            className={CAMPO}
            placeholder={exemplo}
            value={novo}
            maxLength={limite}
            onChange={(e) => setNovo(e.target.value)}
            disabled={!ativo}
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" disabled={!ativo || !novo.trim() || ocupado !== null} className={BOTAO}>
          {ocupado !== null && ocupado === novo.trim() ? "Incluindo..." : "Incluir"}
        </button>
      </form>

      {erro && (
        <p role="alert" className={`${ALERTA_ERRO} mt-3`}>
          {erro}
        </p>
      )}

      {itens.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {itens.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => tirar(item)}
                disabled={!ativo || ocupado !== null}
                className={`${BOTAO_NEUTRO} normal-case! tracking-normal!`}
                title={ativo ? `Tirar ${item}` : undefined}
              >
                <span className="font-sans">{ocupado === item ? "Tirando..." : item}</span>
                {ativo && (
                  <>
                    <IconeFechar width={14} height={14} />
                    <span className="sr-only">(tirar da lista)</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Lista vazia.</p>
      )}
    </div>
  );
}
