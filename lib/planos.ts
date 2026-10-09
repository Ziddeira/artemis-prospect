// Preços e limites dos planos. Os mesmos números estão nas funções SQL
// "limites_do_plano", "sites_do_plano", "plano_por_valor" e
// "preco_do_plano" (supabase/etapa23-1-platina-plano.sql)
// — é o banco que aplica os limites; aqui é só para mostrar na tela e
// para mandar o valor certo ao Asaas. Se mudar um, mude o outro.

export type PlanoId = "gratis" | "solo" | "pro" | "platina";
export type PlanoPago = Exclude<PlanoId, "gratis">;
export type FormaPagamento = "PIX" | "CREDIT_CARD";

export interface Plano {
  id: PlanoId;
  nome: string;
  preco: number;
  desbloqueios: number;
  buscas: number;
  hospedagem: boolean;
  // Aba Internacional (EUA e Canadá). Quem confere de verdade é a função
  // SQL iniciar_busca (etapa 21).
  internacional: boolean;
  // Gerações de site com IA por mês (etapa 23). Quem confere de verdade
  // são as funções SQL reservar_geracao_site e reservar_ajuste_site.
  sites: number;
  // Gerador de contratos (etapa 24). Quem confere de verdade é a função
  // SQL contratos_plano_permitido (etapa24-2-contratos-funcoes.sql).
  contratos: boolean;
}

export const PLANOS: Record<PlanoId, Plano> = {
  gratis: { id: "gratis", nome: "Grátis", preco: 0, desbloqueios: 5, buscas: 3, hospedagem: false, internacional: false, sites: 0, contratos: false },
  solo: { id: "solo", nome: "Solo", preco: 34.9, desbloqueios: 50, buscas: 20, hospedagem: false, internacional: false, sites: 0, contratos: true },
  pro: { id: "pro", nome: "Pro", preco: 69.9, desbloqueios: 100, buscas: 45, hospedagem: true, internacional: true, sites: 0, contratos: true },
  platina: { id: "platina", nome: "Platina", preco: 89.9, desbloqueios: 100, buscas: 45, hospedagem: true, internacional: true, sites: 5, contratos: true },
};

export const PACOTE_EXTRA = { preco: 24.9, desbloqueios: 25, buscas: 15 };

// Pacote avulso de gerações de site (só para quem está no Platina). As
// gerações do pacote não vencem e são gastas depois das do mês. O "+3"
// também está em processar_evento_asaas (etapa23-2-platina-pagamentos.sql).
export const PACOTE_SITES = { preco: 39.9, sites: 3 };

// Cupons de desconto valem só para Solo e Pro (etapa 19).
export const PLANOS_COM_CUPOM: PlanoPago[] = ["solo", "pro"];

export function ehPlanoPago(valor: unknown): valor is PlanoPago {
  return valor === "solo" || valor === "pro" || valor === "platina";
}

// Modo Hospedagem e aba Internacional.
export function temRecursosPro(plano: string): boolean {
  return plano === "pro" || plano === "platina";
}

// Gerador de contratos: todos os planos pagos.
export function temContratos(plano: string): boolean {
  return PLANOS[plano as PlanoId]?.contratos ?? false;
}

export function nomeDoPlano(id: string): string {
  return PLANOS[id as PlanoId]?.nome ?? id;
}

export function ehFormaPagamento(valor: unknown): valor is FormaPagamento {
  return valor === "PIX" || valor === "CREDIT_CARD";
}

export function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
