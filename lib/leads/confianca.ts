// Selo de confiança do lead: o quanto parece que a empresa ainda existe
// e atende. Calculado na hora da busca, só com o que a busca de texto do
// Google já devolve (nenhuma chamada extra):
//   - situação do negócio (businessStatus);
//   - data da avaliação mais recente (entre as até 5 que o Google manda);
//   - número de avaliações;
//   - se tem horário de funcionamento;
//   - se tem telefone.
//
// verde = confiável, amarelo = atenção, vermelho = provavelmente inativo.
// O motivo é uma frase curta, a do problema mais grave encontrado.

export type NivelConfianca = "verde" | "amarelo" | "vermelho";

export interface Confianca {
  nivel: NivelConfianca;
  motivo: string;
}

export interface SinaisConfianca {
  // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY ou vazio.
  status?: string | null;
  // ISO da avaliação mais nova que veio do Google, ou null.
  ultimaAvaliacao?: string | null;
  avaliacoes: number;
  temHorario: boolean;
  temTelefone: boolean;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const UM_ANO_DIAS = 365;
const DOIS_ANOS_DIAS = 730;
const POUCAS_AVALIACOES = 5;

export function fechadoDefinitivo(status?: string | null): boolean {
  return status === "CLOSED_PERMANENTLY";
}

function tempoDesde(dias: number): string {
  if (dias < 45) return "há menos de 1 mês";
  const meses = Math.round(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(dias / 365);
  return `há mais de ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

// A avaliação mais nova entre as que vieram (o Google manda até 5, as
// "mais relevantes", não necessariamente as mais novas).
export function avaliacaoMaisRecente(reviews?: { publishTime?: string }[]): string | null {
  let maior: number | null = null;
  for (const r of reviews ?? []) {
    const t = r.publishTime ? Date.parse(r.publishTime) : NaN;
    if (!Number.isNaN(t) && (maior === null || t > maior)) maior = t;
  }
  return maior === null ? null : new Date(maior).toISOString();
}

export function calcularConfianca(s: SinaisConfianca, agora = Date.now()): Confianca {
  if (fechadoDefinitivo(s.status)) {
    return { nivel: "vermelho", motivo: "fechado definitivamente no Google" };
  }
  if (s.status === "CLOSED_TEMPORARILY") {
    return { nivel: "vermelho", motivo: "fechado temporariamente no Google" };
  }

  const diasSemAvaliacao = s.ultimaAvaliacao
    ? Math.max(0, Math.floor((agora - Date.parse(s.ultimaAvaliacao)) / DIA_MS))
    : null;

  if (diasSemAvaliacao !== null && diasSemAvaliacao > DOIS_ANOS_DIAS) {
    return { nivel: "vermelho", motivo: `sem avaliações ${tempoDesde(diasSemAvaliacao)}` };
  }
  if (!s.temTelefone && !s.temHorario) {
    return { nivel: "vermelho", motivo: "sem telefone nem horário no Google" };
  }

  // Amarelo: do mais para o menos grave.
  if (!s.temTelefone) return { nivel: "amarelo", motivo: "sem telefone no Google" };
  if (diasSemAvaliacao !== null && diasSemAvaliacao > UM_ANO_DIAS) {
    return { nivel: "amarelo", motivo: `última avaliação ${tempoDesde(diasSemAvaliacao)}` };
  }
  if (s.avaliacoes === 0) return { nivel: "amarelo", motivo: "nenhuma avaliação no Google" };
  if (!s.temHorario) return { nivel: "amarelo", motivo: "sem horário de funcionamento no Google" };
  if (s.avaliacoes < POUCAS_AVALIACOES) {
    return {
      nivel: "amarelo",
      motivo: `só ${s.avaliacoes} ${s.avaliacoes === 1 ? "avaliação" : "avaliações"} no Google`,
    };
  }

  return {
    nivel: "verde",
    motivo:
      diasSemAvaliacao !== null
        ? `última avaliação ${tempoDesde(diasSemAvaliacao)}, com telefone e horário`
        : "com telefone, horário e avaliações",
  };
}

export const ROTULO_CONFIANCA: Record<NivelConfianca, string> = {
  verde: "Confiável",
  amarelo: "Atenção",
  vermelho: "Provavelmente inativo",
};

// Filtro da tela de busca.
export type FiltroConfianca = "todos" | "verde_amarelo" | "verde";

export function passaFiltroConfianca(c: Confianca | undefined, filtro: FiltroConfianca): boolean {
  // Buscas salvas antes do selo existir não têm selo: não somem da lista.
  if (!c || filtro === "todos") return true;
  if (filtro === "verde") return c.nivel === "verde";
  return c.nivel !== "vermelho";
}
