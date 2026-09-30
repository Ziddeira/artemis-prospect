// Marcação de lead inválido e devolução de crédito. As regras de verdade
// (3 devoluções por mês, desbloqueado há até 30 dias) ficam no banco:
// supabase/etapa20-1-leads-invalidos.sql. Aqui só os textos da tela.

export const MOTIVOS_INVALIDO = ["nao_existe", "nao_atende"] as const;
export type MotivoInvalido = (typeof MOTIVOS_INVALIDO)[number];

export const ROTULO_MOTIVO: Record<MotivoInvalido, string> = {
  nao_existe: "Empresa não existe mais",
  nao_atende: "Telefone não atende",
};

export const LIMITE_DEVOLUCOES_MES = 3;
export const PRAZO_DEVOLUCAO_DIAS = 30;

export type SemDevolucao = "limite_mes" | "fora_do_prazo";

export const ROTULO_SEM_DEVOLUCAO: Record<SemDevolucao, string> = {
  limite_mes: `já tinha ${LIMITE_DEVOLUCOES_MES} devoluções no mês`,
  fora_do_prazo: `desbloqueado há mais de ${PRAZO_DEVOLUCAO_DIAS} dias`,
};

export interface MarcacaoInvalido {
  motivo: MotivoInvalido;
  devolvido: boolean;
  semDevolucao: SemDevolucao | null;
}

export const MSG_FALTA_ETAPA20 =
  "A marcação de lead inválido ainda não foi ativada no banco. Rode supabase/etapa20-1-leads-invalidos.sql e etapa20-2-leads-invalidos-admin.sql no Supabase, nessa ordem.";
