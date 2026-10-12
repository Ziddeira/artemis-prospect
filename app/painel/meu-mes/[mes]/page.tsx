import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { faltaEtapa27 } from "@/lib/indicacoes/regras";
import { lerMes, nomeDoMes } from "@/lib/vendas/regras";
import {
  METRICAS,
  lerNumeros,
  mesAnterior,
  variacao,
  variacaoPosicao,
  type NumerosMes,
} from "@/lib/relatorio/dados";
import AbasScore from "@/components/score/AbasScore";
import { CARTAO, TituloPagina } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Linha {
  mes: string;
  dados: unknown;
  anterior: unknown;
}

// Relatório de um mês ("/painel/meu-mes/2026-09"). Só leitura: os números
// foram calculados e guardados pelo banco no dia 1º (etapa 27), e o RLS só
// devolve os relatórios do usuário logado.
export default async function RelatorioMesPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes: texto } = await params;
  const mes = lerMes(texto);
  const supabase = await createClient();
  if (!supabase) return <Aviso texto="Supabase não configurado neste ambiente." />;

  const { data, error } = await supabase
    .from("relatorios_mensais")
    .select("mes, dados, anterior")
    .order("mes", { ascending: false })
    .limit(24)
    .returns<Linha[]>();
  if (error) {
    if (!faltaEtapa27(error.code)) console.error("[meu-mes]", error.code, error.message);
    return (
      <Aviso
        texto={
          faltaEtapa27(error.code)
            ? "O relatório mensal ainda não foi ativado no banco. Rode as 3 partes supabase/etapa27-1, etapa27-2 e etapa27-3 no Supabase, nessa ordem."
            : "Não foi possível carregar este relatório agora."
        }
      />
    );
  }

  const lista = data ?? [];
  const linha = mes ? lista.find((l) => l.mes === mes) : undefined;
  const dados = linha ? lerNumeros(linha.dados) : null;
  if (!mes || !linha || !dados) {
    return (
      <Aviso
        texto={
          mes
            ? `Não há relatório de ${nomeDoMes(mes)}. Ele só é gerado para meses em que você usou o Ártemis.`
            : "Mês inválido."
        }
        meses={lista.map((l) => l.mes)}
      />
    );
  }
  const anterior = lerNumeros(linha.anterior);
  const nomeAnterior = nomeDoMes(mesAnterior(mes)).split(" de ")[0];

  return (
    <div>
      <TituloPagina
        titulo="Meu mês"
        descricao={
          <>
            Seu resumo de <span className="font-semibold text-ink">{nomeDoMes(mes)}</span>, comparado com{" "}
            {nomeAnterior}.
          </>
        }
      />
      <div className="mt-6">
        <AbasScore atual="meu-mes" />
      </div>

      <section aria-label={`Números de ${nomeDoMes(mes)}`} className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        {METRICAS.map((m) => (
          <Numero
            key={m.chave}
            rotulo={m.rotulo}
            ajuda={m.ajuda}
            valor={String(dados[m.chave])}
            comparacao={anterior ? variacao(dados[m.chave], anterior[m.chave]) : null}
            nomeAnterior={nomeAnterior}
            antes={anterior ? String(anterior[m.chave]) : null}
            destaque={m.destaque}
          />
        ))}
      </section>

      <CartaoRank dados={dados} anterior={anterior} nomeAnterior={nomeAnterior} mes={mes} />

      <details className={`${CARTAO} mt-4 px-4 py-3 text-sm text-ink-2 sm:px-5`}>
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-ink">Como contamos</summary>
        <ul className="mt-2 list-disc space-y-1.5 pb-2 pl-5">
          {METRICAS.map((m) => (
            <li key={m.chave}>
              <strong className="text-ink">{m.rotulo}:</strong> {m.ajuda}
            </li>
          ))}
          <li>
            <strong className="text-ink">Posição no rank:</strong> pelas vendas verificadas no mês, a mesma conta da
            página Rank.
          </li>
          <li>
            Datas no horário de Brasília. Para leads que avançaram antes de o relatório existir, usamos a data do último
            contato.
          </li>
          <li>O resumo é gerado no dia 1º e não muda depois.</li>
        </ul>
      </details>

      <Historico meses={lista.map((l) => l.mes)} atual={mes} />
    </div>
  );
}

function CartaoRank({
  dados,
  anterior,
  nomeAnterior,
  mes,
}: {
  dados: NumerosMes;
  anterior: NumerosMes | null;
  nomeAnterior: string;
  mes: string;
}) {
  const comp = anterior ? variacaoPosicao(dados.posicao, anterior.posicao) : null;
  return (
    <section aria-label="Posição no rank" className={`${CARTAO} mt-4 flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5`}>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">Posição no rank</p>
        {dados.posicao ? (
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-destaque">
            {dados.posicao}º <span className="text-base font-semibold text-ink-2">de {dados.participantes}</span>
          </p>
        ) : (
          <p className="mt-1 text-ink-2">Fora do rank: nenhuma venda verificada no mês.</p>
        )}
        {comp && (
          <p className={`mt-1 text-sm ${COR_SINAL[comp.sinal]}`}>
            {comp.texto}
            {anterior?.posicao ? ` (em ${nomeAnterior}: ${anterior.posicao}º)` : ""}
          </p>
        )}
      </div>
      <Link
        href={`/painel/rank?mes=${mes.slice(0, 7)}`}
        className="inline-flex min-h-11 items-center font-semibold text-destaque underline-offset-2 hover:underline"
      >
        Ver o rank do mês
      </Link>
    </section>
  );
}

const COR_SINAL: Record<-1 | 0 | 1, string> = {
  1: "text-ink font-semibold",
  0: "text-muted",
  [-1]: "text-danger",
};

const SETA: Record<-1 | 0 | 1, string> = { 1: "▲", 0: "", [-1]: "▼" };

function Numero({
  rotulo,
  ajuda,
  valor,
  comparacao,
  nomeAnterior,
  antes,
  destaque = false,
}: {
  rotulo: string;
  ajuda: string;
  valor: string;
  comparacao: { texto: string; sinal: -1 | 0 | 1 } | null;
  nomeAnterior: string;
  antes: string | null;
  destaque?: boolean;
}) {
  return (
    <div className={`${CARTAO} px-3 py-4 sm:px-5`} title={ajuda}>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted">{rotulo}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl ${destaque ? "text-destaque" : "text-ink"}`}
      >
        {valor}
      </p>
      <p className={`mt-1 text-xs sm:text-sm ${comparacao ? COR_SINAL[comparacao.sinal] : "text-muted"}`}>
        {comparacao ? (
          <>
            <span aria-hidden="true">{SETA[comparacao.sinal]} </span>
            {comparacao.texto}
            <span className="text-muted">
              {" "}
              · {nomeAnterior}: {antes}
            </span>
          </>
        ) : (
          "sem mês anterior"
        )}
      </p>
    </div>
  );
}

function Historico({ meses, atual }: { meses: string[]; atual: string | null }) {
  if (meses.length < 2 && meses[0] === atual) return null;
  if (!meses.length) return null;
  return (
    <nav aria-label="Outros meses" className="mt-8">
      <h2 className="text-lg font-bold text-ink">Outros meses</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {meses.map((m) => (
          <li key={m}>
            <Link
              href={`/painel/meu-mes/${m.slice(0, 7)}`}
              aria-current={m === atual ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border px-4 text-sm font-semibold capitalize ${
                m === atual ? "border-destaque bg-primary-soft text-destaque" : "border-line bg-surface text-ink-2 hover:text-ink"
              }`}
            >
              {nomeDoMes(m)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Aviso({ texto, meses = [] }: { texto: string; meses?: string[] }) {
  return (
    <div>
      <TituloPagina titulo="Meu mês" />
      <div className="mt-6">
        <AbasScore atual="meu-mes" />
      </div>
      <p className="text-ink-2">{texto}</p>
      <Historico meses={meses} atual={null} />
    </div>
  );
}
