// Regras do link de indicação usadas na tela. Quem decide de verdade é o
// banco (supabase/etapa27-2 e etapa27-3): mantenha estes números iguais
// aos de lá. Aqui é só para mostrar.

export const BONUS_CADASTRO = 10;
export const BONUS_PLANO = 30;
export const LIMITE_MES = 20;

// Código do link /convite/<código>: letras minúsculas e números.
export const CODIGO_INDICACAO = /^[a-z0-9]{6,16}$/;

// Cookie que guarda o código entre o clique no link e o cadastro (só o
// servidor lê). Vale 30 dias.
export const COOKIE_INDICACAO = "ap_indicacao";
export const VALIDADE_COOKIE_SEGUNDOS = 30 * 24 * 60 * 60;

export function normalizarCodigo(texto: string | null | undefined): string | null {
  const codigo = (texto ?? "").trim().toLowerCase();
  return CODIGO_INDICACAO.test(codigo) ? codigo : null;
}

// Função, coluna ou tabela inexistente = script da etapa 27 não rodado.
export function faltaEtapa27(codigo: string | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42703", "42P01"].includes(codigo ?? "");
}

export interface ResumoIndicacoes {
  codigo: string;
  indicados: number;
  confirmados: number;
  assinantes: number;
  desbloqueios_ganhos: number;
  recompensadas_mes: number;
  limite_mes: number;
}
