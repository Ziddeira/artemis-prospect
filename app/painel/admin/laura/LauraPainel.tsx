"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ABA_ATIVA, ABA_INATIVA, ALERTA_ERRO, BOTAO_NEUTRO, CARTAO } from "@/components/ui";
import {
  NOME_NICHO,
  NOME_OBJECAO,
  NOME_RESULTADO,
  NOME_STATUS,
  gargalos,
  type Gargalo,
  type LeadAndamento,
  type Objecao,
  type PainelLaura,
  type Periodo,
} from "@/lib/laura/painel";

const FUSO = "America/Sao_Paulo";
const brl = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => n.toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
function quando(iso: string | null) {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

type Aba = "panorama" | "funil" | "objecoes";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "panorama", rotulo: "Panorama" },
  { id: "funil", rotulo: "Funil ao vivo" },
  { id: "objecoes", rotulo: "Objeções" },
];
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "semana", rotulo: "Esta semana" },
  { id: "mes", rotulo: "Este mês" },
];

export default function LauraPainel({ dados }: { dados: PainelLaura }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("panorama");
  const [periodo, setPeriodo] = useState<Periodo>("hoje");

  // Tempo real: busca os números de novo a cada 30 segundos.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  const lista = useMemo(() => gargalos(dados), [dados]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Estado dados={dados} />
        <p className="text-xs text-muted" aria-live="polite">
          Atualiza sozinho a cada 30 s · última leitura às {hora(dados.gerado_em)}
        </p>
      </div>

      <div role="tablist" aria-label="Seções do painel da Laura" className="mt-5 flex w-max max-w-full gap-1 overflow-x-auto border border-line bg-surface p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`min-h-11 whitespace-nowrap px-4 font-display text-sm font-semibold uppercase tracking-[0.08em] transition ${aba === a.id ? ABA_ATIVA : ABA_INATIVA}`}
          >
            {a.rotulo}
            {a.id === "panorama" && lista.some((g) => g.nivel === "alto") && (
              <span className="ml-2 inline-block size-2 rounded-full bg-danger align-middle" aria-label="há gargalos graves" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {aba === "panorama" && <Panorama dados={dados} lista={lista} periodo={periodo} setPeriodo={setPeriodo} />}
        {aba === "funil" && <Funil dados={dados} periodo={periodo} setPeriodo={setPeriodo} />}
        {aba === "objecoes" && <Objecoes dados={dados} />}
      </div>
    </div>
  );
}

// ---------- topo: situação agora ----------
function Estado({ dados }: { dados: PainelLaura }) {
  const op = dados.operacao;
  const [rotulo, cor] = op.pausado
    ? ["Pausada", "bg-conf-amarelo"]
    : op.em_expediente
      ? ["Trabalhando", "bg-conf-verde"]
      : [`Fora do horário (${op.hora_inicio.slice(0, 5)} às ${op.hora_fim.slice(0, 5)})`, "bg-ink-3"];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
      <span className="inline-flex items-center gap-2 font-semibold text-ink">
        <span className={`size-2.5 rounded-full ${cor}`} aria-hidden /> Laura: {rotulo}
      </span>
      <span>
        Abordagens hoje <strong className="text-ink tabular-nums">{op.abordagens_hoje}/{op.limite_hoje}</strong>
      </span>
      <span>
        Fila <strong className="text-ink tabular-nums">{op.fila}</strong>
      </span>
      <span>
        Buscas no Google <strong className="text-ink tabular-nums">{op.buscas_hoje}/{op.buscas_dia_max}</strong> hoje ·{" "}
        <strong className="text-ink tabular-nums">{op.buscas_mes}/{op.buscas_mes_max}</strong> no mês
      </span>
    </div>
  );
}

function SeletorPeriodo({ periodo, setPeriodo, extra }: { periodo: string; setPeriodo: (p: Periodo) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          aria-pressed={periodo === p.id}
          onClick={() => setPeriodo(p.id)}
          className={`min-h-11 border px-3 text-sm font-semibold transition ${periodo === p.id ? "border-destaque bg-primary-soft text-destaque" : "border-line text-ink-2 hover:text-ink"}`}
        >
          {p.rotulo}
        </button>
      ))}
      {extra}
    </div>
  );
}

// ---------- Panorama ----------
function Panorama({ dados, lista, periodo, setPeriodo }: { dados: PainelLaura; lista: Gargalo[]; periodo: Periodo; setPeriodo: (p: Periodo) => void }) {
  const n = dados.periodos[periodo];
  return (
    <div className="space-y-10">
      <section aria-labelledby="t-gargalos">
        <h2 id="t-gargalos" className="text-lg font-bold text-ink">Gargalos</h2>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nada travando agora. Os alertas aparecem aqui quando houver amostra suficiente para afirmar.</p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {lista.map((g, i) => (
              <li key={i} className={`${CARTAO} border-l-4 p-4 ${g.nivel === "alto" ? "border-l-danger" : "border-l-conf-amarelo"}`}>
                <p className="font-semibold text-ink">
                  <span className={`mr-2 text-xs font-bold uppercase tracking-wider ${g.nivel === "alto" ? "text-danger" : "text-conf-amarelo"}`}>
                    {g.nivel === "alto" ? "Grave" : "Atenção"}
                  </span>
                  {g.titulo}
                </p>
                <p className="mt-1 text-sm text-ink-2">{g.detalhe}</p>
                <p className="mt-2 text-sm text-ink">{g.acao}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-producao">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="t-producao" className="text-lg font-bold text-ink">Produção</h2>
          <SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Cartao rotulo="Fechados" valor={int(n.fechados)} dica={`${brl(n.receita)} em vendas · ${brl(n.sinais)} de sinal`} forte />
          <Cartao rotulo="Abordados" valor={int(n.abordados)} dica={`${int(n.captados)} empresas captadas · ${int(n.buscas)} buscas`} />
          <Cartao rotulo="Responderam" valor={int(n.responderam)} dica={`${pct(n.responderam, n.abordados)} dos abordados`} />
          <Cartao rotulo="Prévias enviadas" valor={int(n.previas)} dica={`${pct(n.previas, n.responderam)} de quem respondeu`} />
          <Cartao rotulo="Pix enviados" valor={int(n.pix)} dica={`${pct(n.pix, n.previas)} das prévias · ${int(n.pagamento_informado)} disseram que pagaram`} />
          <Cartao rotulo="Perdidos" valor={int(n.sem_resposta + n.sem_interesse)} dica={`${int(n.sem_resposta)} sem resposta · ${int(n.sem_interesse)} sem interesse · ${int(n.objecoes)} objeções`} />
        </div>
      </section>

      <Serie dados={dados} />

      <section aria-labelledby="t-nichos">
        <h2 id="t-nichos" className="text-lg font-bold text-ink">Por nicho, desde o início</h2>
        {dados.nichos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Ainda sem abordagens.</p>
        ) : (
          <div className={`${CARTAO} mt-3 overflow-x-auto`}>
            <table className="w-full min-w-[32rem] text-left text-sm [&_td]:border-t [&_td]:border-line-2 [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-semibold [&_th]:text-ink-2">
              <thead>
                <tr>
                  <th>Nicho</th>
                  <th className="text-right">Abordados</th>
                  <th className="text-right">Responderam</th>
                  <th className="text-right">Taxa de resposta</th>
                  <th className="text-right">Fechados</th>
                </tr>
              </thead>
              <tbody>
                {dados.nichos.map((x) => (
                  <tr key={x.nicho}>
                    <td>{NOME_NICHO[x.nicho] ?? x.nicho}</td>
                    <td className="text-right tabular-nums">{int(x.abordados)}</td>
                    <td className="text-right tabular-nums">{int(x.responderam)}</td>
                    <td className="text-right tabular-nums">{pct(x.responderam, x.abordados)}</td>
                    <td className="text-right font-semibold tabular-nums">{int(x.fechados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dados.eventos.length > 0 && (
        <section aria-labelledby="t-eventos">
          <h2 id="t-eventos" className="text-lg font-bold text-ink">Erros e avisos (7 dias)</h2>
          <ul className={`${CARTAO} mt-3 divide-y divide-line-2 text-sm`}>
            {dados.eventos.map((e, i) => (
              <li key={i} className="flex gap-3 px-3 py-2.5">
                <span className={`shrink-0 font-semibold ${e.tipo === "erro" ? "text-danger" : "text-conf-amarelo"}`}>{e.tipo === "erro" ? "Erro" : "Aviso"}</span>
                <span className="min-w-0 flex-1 break-words text-ink-2">{e.detalhe}</span>
                <span className="shrink-0 text-muted">{quando(e.quando)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, dica, forte }: { rotulo: string; valor: string; dica?: string; forte?: boolean }) {
  return (
    <div className={`${CARTAO} p-4 ${forte ? "border-destaque/50" : ""}`}>
      <p className="text-sm font-semibold text-ink-2">{rotulo}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${forte ? "text-destaque" : "text-ink"}`}>{valor}</p>
      {dica && <p className="mt-1 text-xs text-muted">{dica}</p>}
    </div>
  );
}

function Serie({ dados }: { dados: PainelLaura }) {
  const maior = Math.max(1, ...dados.serie.map((d) => d.abordados));
  const dia = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);
  return (
    <section aria-labelledby="t-serie">
      <h2 id="t-serie" className="text-lg font-bold text-ink">Últimos 30 dias</h2>
      <p className="mt-0.5 text-sm text-ink-2">
        Cada barra é um dia: a altura são os abordados, a parte amarela quem respondeu. O número em cima é de vendas fechadas.
      </p>
      <div className={`${CARTAO} mt-3 p-4`}>
        <div role="img" aria-label="Gráfico de abordagens, respostas e vendas por dia nos últimos 30 dias" className="flex h-44 items-end gap-0.5">
          {dados.serie.map((d) => (
            <div key={d.dia} title={`${dia(d.dia)}: ${d.abordados} abordados, ${d.responderam} responderam, ${d.fechados} fechados`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              {d.fechados > 0 && <span className="mb-0.5 text-[11px] font-bold text-conf-verde">{d.fechados}</span>}
              <div className="relative w-full bg-line-strong" style={{ height: d.abordados ? `${Math.max(3, (d.abordados / maior) * 100)}%` : "0" }}>
                <div className="absolute inset-x-0 bottom-0 bg-destaque" style={{ height: d.abordados ? `${(Math.min(d.responderam, d.abordados) / d.abordados) * 100}%` : "0" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-1 text-xs text-muted">
          <span>{dados.serie[0] ? dia(dados.serie[0].dia) : ""}</span>
          <span>máx. {maior}/dia</span>
          <span>hoje</span>
        </div>
      </div>
    </section>
  );
}

// ---------- Funil ----------
const ETAPAS: { chave: "captados" | "abordados" | "responderam" | "previas" | "pix" | "fechados"; rotulo: string }[] = [
  { chave: "captados", rotulo: "Captados" },
  { chave: "abordados", rotulo: "Abordados" },
  { chave: "responderam", rotulo: "Responderam" },
  { chave: "previas", rotulo: "Viram a prévia" },
  { chave: "pix", rotulo: "Receberam o Pix" },
  { chave: "fechados", rotulo: "Fechados" },
];

const COLUNAS: { status: string; titulo: string; dica: string }[] = [
  { status: "conversando", titulo: "Conversando", dica: "Responderam, ainda sem prévia" },
  { status: "previa_enviada", titulo: "Prévia enviada", dica: "Decidindo" },
  { status: "sinal_enviado", titulo: "Pix enviado", dica: "Aguardando o sinal" },
  { status: "atencao", titulo: "Com você", dica: "A Laura passou para você" },
];

function Funil({ dados, periodo, setPeriodo }: { dados: PainelLaura; periodo: Periodo; setPeriodo: (p: Periodo) => void }) {
  const [total, setTotal] = useState(true);
  const fonte = total ? dados.funil_total : dados.periodos[periodo];
  const topo = Math.max(1, fonte.captados, fonte.abordados);
  const perdidos = (dados.status.encerrado ?? 0) + (dados.status.bloqueado ?? 0);

  return (
    <div className="space-y-10">
      <section aria-labelledby="t-funil">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="t-funil" className="text-lg font-bold text-ink">Funil de vendas</h2>
          <SeletorPeriodo
            periodo={total ? "" : periodo}
            setPeriodo={(p) => { setTotal(false); setPeriodo(p); }}
            extra={
              <button
                aria-pressed={total}
                onClick={() => setTotal(true)}
                className={`min-h-11 border px-3 text-sm font-semibold transition ${total ? "border-destaque bg-primary-soft text-destaque" : "border-line text-ink-2 hover:text-ink"}`}
              >
                Desde o início
              </button>
            }
          />
        </div>
        <ol className={`${CARTAO} mt-3 space-y-2 p-4`}>
          {ETAPAS.map((e, i) => {
            const v = fonte[e.chave];
            const ant = i > 0 ? fonte[ETAPAS[i - 1].chave] : null;
            return (
              <li key={e.chave} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_6rem]">
                <span className="font-semibold text-ink">{e.rotulo}</span>
                <span className="h-7 bg-realce">
                  <span
                    className={`block h-full ${e.chave === "fechados" ? "bg-conf-verde" : "bg-destaque"}`}
                    style={{ width: v ? `${Math.max(1.5, (v / topo) * 100)}%` : "0" }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  <strong className="text-ink">{int(v)}</strong>
                  {ant !== null && <span className="block text-xs text-muted">{pct(v, ant)} da etapa anterior</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-ink-2">
          Agora: {int(dados.abordados_aguardando)} abordados esperando resposta · {int(dados.status.fila ?? 0)} na fila · {int(perdidos)} perdidos no total.
        </p>
      </section>

      <section aria-labelledby="t-andamento">
        <h2 id="t-andamento" className="text-lg font-bold text-ink">Sendo trabalhados agora</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((c) => {
            const leads = dados.em_andamento.filter((l) => l.status === c.status);
            return (
              <div key={c.status} className={`${CARTAO} p-3`}>
                <h3 className="flex items-baseline justify-between font-semibold text-ink">
                  {c.titulo} <span className="tabular-nums text-ink-2">{leads.length}</span>
                </h3>
                <p className="text-xs text-muted">{c.dica}</p>
                <ul className="mt-3 space-y-2">
                  {leads.length === 0 && <li className="text-sm text-ink-3">Ninguém aqui.</li>}
                  {leads.map((l) => <CartaoLead key={l.id} lead={l} />)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="t-recentes">
        <h2 id="t-recentes" className="text-lg font-bold text-ink">Resultados recentes</h2>
        <p className="mt-0.5 text-sm text-ink-2">Quem conversou com a Laura e já teve um desfecho.</p>
        {dados.recentes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nenhum desfecho ainda.</p>
        ) : (
          <ul className={`${CARTAO} mt-3 divide-y divide-line-2 text-sm`}>
            {dados.recentes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <span className={`font-semibold ${r.status === "fechado" ? "text-conf-verde" : "text-ink-2"}`}>{r.status === "fechado" ? "Fechado" : NOME_STATUS[r.status]}</span>
                <span className="font-semibold text-ink">{r.nome}</span>
                <span className="text-ink-2">{NOME_NICHO[r.nicho] ?? r.nicho} · {r.cidade}</span>
                {r.valor ? <span className="tabular-nums text-ink">{brl(r.valor)}</span> : null}
                <span className="ml-auto text-muted">{quando(r.quando)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CartaoLead({ lead }: { lead: LeadAndamento }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const podePagar = lead.status === "sinal_enviado" || lead.status === "atencao" || !!lead.pagamento_informado_em;

  async function marcarPago() {
    if (!confirm(`Confirma que o sinal de ${lead.nome} caiu na sua conta?`)) return;
    setEnviando(true);
    setErro("");
    const r = await fetch("/api/admin/laura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pago", id: lead.id }) });
    const corpo = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setErro(corpo.erro || "Não foi possível marcar agora.");
    router.refresh();
  }

  return (
    <li className={`border p-3 ${lead.pagamento_informado_em ? "border-conf-verde/60" : "border-line-2"}`}>
      <p className="font-semibold text-ink">{lead.nome}</p>
      <p className="text-xs text-ink-2">{NOME_NICHO[lead.nicho] ?? lead.nicho} · {lead.cidade}</p>
      {lead.valor ? <p className="mt-1 text-sm tabular-nums text-ink">{brl(lead.valor)} · sinal {brl(lead.sinal)}</p> : null}
      {lead.pagamento_informado_em && <p className="mt-1 text-xs font-semibold text-conf-verde">Disse que pagou {quando(lead.pagamento_informado_em)}</p>}
      {lead.status === "atencao" && lead.motivo && <p className="mt-1 text-xs text-conf-amarelo">{lead.motivo}</p>}
      {lead.humano && <p className="mt-1 text-xs text-ink-3">Você já está conversando</p>}
      <p className="mt-1 text-xs text-muted">Último contato {quando(lead.ultimo_contato_em)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {lead.previa_url && (
          <a href={lead.previa_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-destaque underline underline-offset-2">Ver prévia</a>
        )}
        {lead.telefone && <span className="text-xs text-ink-3">+{lead.telefone}</span>}
      </div>
      {podePagar && (
        <button onClick={marcarPago} disabled={enviando} className={`${BOTAO_NEUTRO} mt-3 w-full`}>
          {enviando ? "Salvando..." : "Marcar como pago"}
        </button>
      )}
      {erro && <p className={`${ALERTA_ERRO} mt-2`}>{erro}</p>}
    </li>
  );
}

// ---------- Objeções ----------
type Filtro = "todas" | Objecao["resultado"];

function Objecoes({ dados }: { dados: PainelLaura }) {
  const [filtro, setFiltro] = useState<Filtro>("nao_contornada");
  const [categoria, setCategoria] = useState("");
  const lista = dados.objecoes.filter((o) => (filtro === "todas" || o.resultado === filtro) && (!categoria || o.categoria === categoria));

  return (
    <div className="space-y-10">
      <section aria-labelledby="t-obj-resumo">
        <h2 id="t-obj-resumo" className="text-lg font-bold text-ink">Objeções por tipo</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          Contornada = o cliente seguiu até o Pix ou fechou depois da objeção. Não contornada = a conversa acabou sem venda.
        </p>
        {dados.objecoes_resumo.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nenhuma objeção registrada ainda.</p>
        ) : (
          <div className={`${CARTAO} mt-3 overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-left text-sm [&_td]:border-t [&_td]:border-line-2 [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-semibold [&_th]:text-ink-2">
              <thead>
                <tr>
                  <th>Objeção</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Contornadas</th>
                  <th className="text-right">Não contornadas</th>
                  <th className="text-right">Com você / em aberto</th>
                  <th className="w-40">Taxa de contorno</th>
                </tr>
              </thead>
              <tbody>
                {dados.objecoes_resumo.map((o) => {
                  const decididas = o.contornadas + o.nao_contornadas;
                  const taxa = decididas ? o.contornadas / decididas : 0;
                  return (
                    <tr key={o.categoria}>
                      <td>
                        <button className="font-semibold text-ink underline-offset-2 hover:underline" onClick={() => { setCategoria(o.categoria); setFiltro("todas"); }}>
                          {NOME_OBJECAO[o.categoria] ?? o.categoria}
                        </button>
                      </td>
                      <td className="text-right tabular-nums">{int(o.total)}</td>
                      <td className="text-right tabular-nums text-conf-verde">{int(o.contornadas)}</td>
                      <td className="text-right tabular-nums text-danger">{int(o.nao_contornadas)}</td>
                      <td className="text-right tabular-nums text-ink-2">{int(o.com_zidd)} / {int(o.em_aberto)}</td>
                      <td>
                        {decididas ? (
                          <span className="flex items-center gap-2">
                            <span className="h-2 flex-1 bg-danger/40"><span className="block h-full bg-conf-verde" style={{ width: `${taxa * 100}%` }} /></span>
                            <span className="w-10 text-right tabular-nums">{Math.round(taxa * 100)}%</span>
                          </span>
                        ) : <span className="text-ink-3">sem desfecho</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="t-obj-lista">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="t-obj-lista" className="text-lg font-bold text-ink">O que os clientes disseram</h2>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por resultado">
            {(["nao_contornada", "contornada", "em_aberto", "com_zidd", "todas"] as Filtro[]).map((f) => (
              <button
                key={f}
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
                className={`min-h-11 border px-3 text-sm font-semibold transition ${filtro === f ? "border-destaque bg-primary-soft text-destaque" : "border-line text-ink-2 hover:text-ink"}`}
              >
                {f === "todas" ? "Todas" : NOME_RESULTADO[f]}
              </button>
            ))}
          </div>
        </div>
        {categoria && (
          <p className="mt-2 text-sm text-ink-2">
            Mostrando só: <strong className="text-ink">{NOME_OBJECAO[categoria] ?? categoria}</strong>{" "}
            <button className="ml-1 text-destaque underline underline-offset-2" onClick={() => setCategoria("")}>mostrar todos os tipos</button>
          </p>
        )}
        {lista.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">Nenhuma objeção com esse filtro.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {lista.map((o) => (
              <li key={o.id} className={`${CARTAO} p-4`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold uppercase tracking-wider text-destaque">{NOME_OBJECAO[o.categoria] ?? o.categoria}</span>
                  <span className={`font-semibold ${o.resultado === "contornada" ? "text-conf-verde" : o.resultado === "nao_contornada" ? "text-danger" : "text-ink-2"}`}>
                    {NOME_RESULTADO[o.resultado]}
                  </span>
                  <span className="text-ink-2">{o.lead} · {NOME_NICHO[o.nicho] ?? o.nicho} · {o.cidade}</span>
                  <span className="ml-auto text-muted">{quando(o.quando)}</span>
                </div>
                <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-ink">“{o.fala}”</blockquote>
                {o.resposta && (
                  <p className="mt-2 text-sm text-ink-2"><span className="font-semibold text-ink">Laura:</span> {o.resposta}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-ink-2">
          Para ensinar um contorno novo à Laura, copie a fala do cliente e me mande com a resposta que você daria.
        </p>
      </section>
    </div>
  );
}
