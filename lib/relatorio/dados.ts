// Relatório mensal ("Meu mês", etapa 27). Os números são calculados e
// guardados pelo banco (supabase/etapa27-1-relatorio-mensal.sql, função
// numeros_do_mes); aqui é só o formato e os textos da tela.

export interface NumerosMes {
  desbloqueados: number;
  contatados: number;
  negociacao: number;
  fechados: number;
  verificadas: number;
  pontos: number;
  // null = sem venda verificada no mês (fora do rank).
  posicao: number | null;
  participantes: number;
}

export interface Relatorio {
  mes: string; // "AAAA-MM-01"
  dados: NumerosMes;
  anterior: NumerosMes | null;
}

export type ChaveContagem = Exclude<keyof NumerosMes, "posicao" | "participantes">;

export const METRICAS: { chave: ChaveContagem; rotulo: string; ajuda: string; destaque?: boolean }[] = [
  { chave: "desbloqueados", rotulo: "Leads desbloqueados", ajuda: "Desbloqueados no mês." },
  { chave: "contatados", rotulo: "Contatados", ajuda: "Leads com o primeiro contato feito no mês." },
  { chave: "negociacao", rotulo: "Em negociação", ajuda: "Leads que entraram em negociação no mês." },
  { chave: "fechados", rotulo: "Fechados", ajuda: "Vendas registradas no mês." },
  { chave: "verificadas", rotulo: "Vendas verificadas", ajuda: "Verificadas no mês (é o que conta no rank)." },
  { chave: "pontos", rotulo: "Pontos ganhos", ajuda: "10 por venda registrada + 40 por venda verificada.", destaque: true },
];

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Lê o JSON do banco sem confiar no formato (campo faltando vira 0).
export function lerNumeros(bruto: unknown): NumerosMes | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  return {
    desbloqueados: numero(o.desbloqueados),
    contatados: numero(o.contatados),
    negociacao: numero(o.negociacao),
    fechados: numero(o.fechados),
    verificadas: numero(o.verificadas),
    pontos: numero(o.pontos),
    posicao: o.posicao == null ? null : numero(o.posicao),
    participantes: numero(o.participantes),
  };
}

// Mês anterior de "AAAA-MM-01".
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const ano = m === 1 ? a - 1 : a;
  const mesNum = m === 1 ? 12 : m - 1;
  return `${ano}-${String(mesNum).padStart(2, "0")}-01`;
}

// Comparação de uma contagem com o mês anterior.
export function variacao(atual: number, antes: number | null | undefined): { texto: string; sinal: -1 | 0 | 1 } {
  if (antes == null) return { texto: "sem mês anterior", sinal: 0 };
  const dif = atual - antes;
  if (dif === 0) return { texto: "igual", sinal: 0 };
  return { texto: `${dif > 0 ? "+" : "−"}${Math.abs(dif)}`, sinal: dif > 0 ? 1 : -1 };
}

// Comparação da posição no rank (número menor = melhor).
export function variacaoPosicao(
  atual: number | null,
  antes: number | null | undefined,
): { texto: string; sinal: -1 | 0 | 1 } {
  if (atual == null && antes == null) return { texto: "fora do rank nos dois meses", sinal: 0 };
  if (atual == null) return { texto: `era ${antes}º`, sinal: -1 };
  if (antes == null) return { texto: "entrou no rank", sinal: 1 };
  if (atual === antes) return { texto: "mesma posição", sinal: 0 };
  const dif = Math.abs(atual - antes);
  const palavra = dif === 1 ? "posição" : "posições";
  return atual < antes ? { texto: `subiu ${dif} ${palavra}`, sinal: 1 } : { texto: `caiu ${dif} ${palavra}`, sinal: -1 };
}
