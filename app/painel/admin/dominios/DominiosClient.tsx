"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALERTA_AVISO, ALERTA_ERRO, BOTAO, BOTAO_NEUTRO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { IconeFechar } from "@/components/Icones";
import type { CodigoPais } from "@/lib/leads/paises";

interface PaisLista {
  codigo: CodigoPais;
  nome: string;
  bandeira: string;
}

export default function DominiosClient({
  paises,
  listas,
  ativo,
  fixos,
}: {
  paises: PaisLista[];
  listas: Record<CodigoPais, string[]>;
  // false = etapa 21 não rodada (a tabela não existe).
  ativo: boolean;
  // Lista fixa do código, que vale em todos os países.
  fixos: string[];
}) {
  const [aba, setAba] = useState<CodigoPais>(paises[0].codigo);
  const pais = paises.find((p) => p.codigo === aba) ?? paises[0];

  return (
    <div>
      <p className="max-w-3xl text-sm text-ink-2">
        Quando o site de um lead é de um destes domínios (ou de um endereço dentro dele, como
        <code className="mx-1 text-ink">minhaloja.wixsite.com</code>), o lead conta como{" "}
        <strong className="text-ink">“Só app ou rede social”</strong>, não como site próprio. Cada país tem a
        sua lista. Mudanças valem para as próximas buscas e desbloqueios.
      </p>

      {!ativo && (
        <p className={`${ALERTA_AVISO} mt-4`}>
          A lista ainda não foi ativada no banco. Rode os scripts supabase/etapa21-1 e etapa21-2 no Supabase.
          Até lá, EUA e Canadá usam a lista inicial do código.
        </p>
      )}

      <div role="group" aria-label="País" className="mt-5 flex flex-wrap gap-2">
        {paises.map((p) => (
          <button
            key={p.codigo}
            type="button"
            aria-pressed={aba === p.codigo}
            onClick={() => setAba(p.codigo)}
            className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold transition ${
              aba === p.codigo ? "border-destaque bg-primary-soft text-destaque" : "border-line bg-surface text-ink-2 hover:text-ink"
            }`}
          >
            <span aria-hidden="true">{p.bandeira}</span>
            {p.nome}
            <span className="text-muted">({listas[p.codigo]?.length ?? 0})</span>
          </button>
        ))}
      </div>

      <ListaPais key={pais.codigo} pais={pais} dominios={listas[pais.codigo] ?? []} ativo={ativo} />

      <details className={`${CARTAO} mt-6 p-4`}>
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Lista fixa, que vale em todos os países ({fixos.length})
        </summary>
        <p className="mt-2 text-sm text-ink-2">
          Fica no código (lib/leads/classificacao.ts) e não muda por aqui. Plataformas de reserva (Airbnb,
          Booking...) viram “Depende do Airbnb/Booking”; o resto, “Só app ou rede social”.
        </p>
        <p className="mt-2 break-words text-sm text-muted">{fixos.join(", ")}</p>
      </details>
    </div>
  );
}

function ListaPais({ pais, dominios, ativo }: { pais: PaisLista; dominios: string[]; ativo: boolean }) {
  const router = useRouter();
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(metodo: "POST" | "DELETE", dominio: string) {
    setErro(null);
    setOcupado(dominio);
    try {
      const res = await fetch("/api/admin/dominios", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pais: pais.codigo, dominio }),
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

  function tirar(dominio: string) {
    if (!window.confirm(`Tirar ${dominio} da lista de ${pais.nome}? Leads com esse site passam a contar como site próprio.`)) return;
    enviar("DELETE", dominio);
  }

  return (
    <section aria-label={`Lista de ${pais.nome}`} className={`${CARTAO} mt-4 p-4 sm:p-5`}>
      <form onSubmit={incluir} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="novo-dominio" className={ROTULO}>
            Incluir domínio em {pais.nome}
          </label>
          <input
            id="novo-dominio"
            className={CAMPO}
            placeholder="ex.: yelp.com"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            disabled={!ativo}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" disabled={!ativo || !novo.trim() || ocupado !== null} className={BOTAO}>
          {ocupado === novo.trim() && ocupado ? "Incluindo..." : "Incluir"}
        </button>
      </form>

      {erro && (
        <p role="alert" className={`${ALERTA_ERRO} mt-3`}>
          {erro}
        </p>
      )}

      {dominios.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {dominios.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => tirar(d)}
                disabled={!ativo || ocupado !== null}
                className={`${BOTAO_NEUTRO} normal-case! tracking-normal!`}
                title={`Tirar ${d}`}
              >
                <span className="font-sans">{ocupado === d ? "Tirando..." : d}</span>
                <IconeFechar width={14} height={14} />
                <span className="sr-only">(tirar da lista)</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Nenhum domínio extra em {pais.nome}. Só a lista fixa vale por enquanto.
        </p>
      )}
    </section>
  );
}
