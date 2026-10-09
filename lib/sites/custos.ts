// Preço de cada modelo da Anthropic, em dólares por 1 milhão de tokens.
// É com esta tabela que o servidor estima o custo de cada geração de site
// (gravado em sites_geracoes.custo_usd e mostrado em Gestão > Sites IA).
// Confira os valores atuais em https://www.anthropic.com/pricing e ajuste
// aqui se mudarem. Modelo fora da tabela usa o preço do Opus 5.5.
export interface PrecoModelo {
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
}

export const PRECOS_USD_POR_MILHAO: Record<string, PrecoModelo> = {
  "claude-opus-5-5": { entrada: 4, saida: 20, cacheLeitura: 0.2, cacheEscrita: 5 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, cacheLeitura: 0.2, cacheEscrita: 2.5 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5, cacheLeitura: 0.01, cacheEscrita: 0.125 },
  // Modelos para onde a Anthropic pode desviar um pedido recusado
  // (fallback automático).
  "claude-opus-5": { entrada: 5, saida: 25, cacheLeitura: 0.5, cacheEscrita: 6.25 },
  "claude-opus-4-8": { entrada: 5, saida: 25, cacheLeitura: 0.5, cacheEscrita: 6.25 },
};

const PADRAO = PRECOS_USD_POR_MILHAO["claude-opus-5-5"];

export interface UsoTokens {
  modelo: string;
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
}

export function custoUsd(usos: UsoTokens[]): number {
  const total = usos.reduce((soma, u) => {
    const p = PRECOS_USD_POR_MILHAO[u.modelo] ?? PADRAO;
    return (
      soma +
      (u.entrada * p.entrada + u.saida * p.saida + u.cacheLeitura * p.cacheLeitura + u.cacheEscrita * p.cacheEscrita) /
        1_000_000
    );
  }, 0);
  return Math.round(total * 10000) / 10000;
}

export function formatarUsd(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
