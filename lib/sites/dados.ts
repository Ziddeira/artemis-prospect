// Geração de site com IA (etapa 23): formulário, estilos e validação.
// Serve para a tela e para o servidor. Quem confere plano, saldo e
// limites é o banco (supabase/etapa23-3-sites-ia.sql); aqui é só a
// validação do formulário.

export type EstiloSite = "moderno" | "elegante" | "acolhedor" | "impacto";
export type IdiomaSite = "pt-BR" | "en" | "es";

export interface OpcaoEstilo {
  id: EstiloSite;
  nome: string;
  descricao: string;
  // Três cores de amostra para o cartão da escolha (só na tela).
  amostra: [string, string, string];
}

export const ESTILOS: OpcaoEstilo[] = [
  {
    id: "moderno",
    nome: "Moderno",
    descricao: "Limpo, muito espaço em branco, uma cor viva de destaque.",
    amostra: ["#ffffff", "#0f172a", "#2563eb"],
  },
  {
    id: "elegante",
    nome: "Elegante",
    descricao: "Sóbrio, fundo escuro, letras com serifa e detalhes dourados.",
    amostra: ["#111111", "#f5f0e6", "#c8a45c"],
  },
  {
    id: "acolhedor",
    nome: "Acolhedor",
    descricao: "Cores quentes e suaves, cantos arredondados, tom próximo.",
    amostra: ["#fff7ed", "#7c2d12", "#ea580c"],
  },
  {
    id: "impacto",
    nome: "Impacto",
    descricao: "Contraste forte, títulos grandes, energia de academia ou oficina.",
    amostra: ["#0a0a0a", "#fafafa", "#facc15"],
  },
];

export const IDIOMAS: { id: IdiomaSite; nome: string }[] = [
  { id: "pt-BR", nome: "Português" },
  { id: "en", nome: "Inglês" },
  { id: "es", nome: "Espanhol" },
];

export const MAX_SERVICOS = 8;
export const AJUSTES_GRATIS = 2;

export interface DadosSite {
  nome: string;
  ramo: string;
  cidade: string;
  endereco: string;
  servicos: string[];
  telefone: string;
  idioma: IdiomaSite;
  observacoes: string;
}

export function ehEstilo(valor: unknown): valor is EstiloSite {
  return ESTILOS.some((e) => e.id === valor);
}

function texto(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Telefone só com dígitos, com o código do país. Número brasileiro sem o
// 55 (10 ou 11 dígitos, com DDD) ganha o 55.
export function telefoneComPais(telefone: string): string {
  let d = telefone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!telefone.trim().startsWith("+") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d;
}

export function validarDadosSite(corpo: unknown): { dados: DadosSite } | { erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(c.nome, 120);
  const ramo = texto(c.ramo, 80);
  const cidade = texto(c.cidade, 80);
  const endereco = texto(c.endereco, 160);
  const telefone = texto(c.telefone, 30);
  const observacoes = texto(c.observacoes, 400);
  const idioma = IDIOMAS.some((i) => i.id === c.idioma) ? (c.idioma as IdiomaSite) : "pt-BR";
  const servicos = (Array.isArray(c.servicos) ? c.servicos : typeof c.servicos === "string" ? c.servicos.split("\n") : [])
    .map((s) => texto(s, 80))
    .filter(Boolean)
    .slice(0, MAX_SERVICOS);

  if (nome.length < 2) return { erro: "Confira o nome da empresa." };
  if (ramo.length < 2) return { erro: "Diga o ramo da empresa (ex.: barbearia, pet shop)." };
  if (cidade.length < 2) return { erro: "Diga a cidade da empresa." };
  if (!servicos.length) return { erro: "Escreva ao menos um serviço, um por linha." };
  const digitos = telefoneComPais(telefone);
  if (digitos.length < 10 || digitos.length > 15) {
    return { erro: "Confira o telefone de WhatsApp, com DDD (ex.: (11) 98765-4321)." };
  }

  return { dados: { nome, ramo, cidade, endereco, servicos, telefone, idioma, observacoes } };
}

// Erro de função ou tabela que ainda não existe no banco: o script da
// etapa 23 não foi rodado.
export function faltaEtapa23(codigo: string | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42703", "42P01"].includes(codigo ?? "");
}

export const MSG_FALTA_ETAPA23 =
  "A geração de sites ainda não está ativa: falta rodar os scripts da etapa 23 no Supabase.";

// Nome de arquivo seguro para o download (ex.: "barbearia-do-ze").
export function nomeArquivo(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "site";
}
