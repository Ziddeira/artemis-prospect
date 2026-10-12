// Aba Domínios: regras que valem no navegador e no servidor (extensões,
// limpeza do nome digitado, sugestões e links dos registradores).
// A consulta RDAP em si fica só no servidor (lib/dominios/rdap.ts).

export const EXTENSOES = ["com.br", "com", "net", "app", "site", "online"] as const;
export type Extensao = (typeof EXTENSOES)[number];

export function ehExtensao(valor: unknown): valor is Extensao {
  return typeof valor === "string" && (EXTENSOES as readonly string[]).includes(valor);
}

// Sugestões são conferidas só nas duas extensões mais procuradas, para
// não multiplicar as consultas.
export const EXTENSOES_SUGESTAO: Extensao[] = ["com.br", "com"];
export const MAX_SUGESTOES = 5;

// Buscas por minuto de cada usuário. A conta de verdade é feita no banco
// (função dominios_contar_busca, supabase/etapa26-dominios.sql); este
// número é só para o texto da tela. Mudou lá? Mude aqui também.
export const LIMITE_BUSCAS_MINUTO = 6;

// "disponivel" e "ocupado" vêm do RDAP. "invalido": o nome não cabe nas
// regras da extensão (ex.: mais de 26 letras no .com.br). "limite": o
// serviço de consulta pediu para esperar. "erro": rede ou resposta estranha.
export type SituacaoDominio = "disponivel" | "ocupado" | "invalido" | "limite" | "erro";

export interface ResultadoDominio {
  extensao: Extensao;
  dominio: string;
  situacao: SituacaoDominio;
  // Data de expiração (ISO), quando o RDAP informa. Só para ocupados.
  expiraEm: string | null;
}

export interface SugestaoDominio {
  nome: string;
  resultados: ResultadoDominio[];
}

export interface RespostaBusca {
  nome: string;
  resultados: ResultadoDominio[];
  sugestoes: SugestaoDominio[];
  // Mensagem amigável quando alguma consulta não deu certo.
  aviso: string | null;
}

// Tira acentos, espaços e símbolos: "Padaria São João" → "padariasaojoao".
// Aceita também quem cola o endereço inteiro (https://www.x.com.br/).
export function normalizarNome(texto: string, { hifens = false } = {}): string {
  let t = texto.trim().toLowerCase();
  t = t.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  for (const ext of [...EXTENSOES].sort((a, b) => b.length - a.length)) {
    if (t.endsWith(`.${ext}`)) {
      t = t.slice(0, -(ext.length + 1));
      break;
    }
  }
  t = t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " e ");
  // Espaço vira hífen só quando pedido (sugestão "padaria-sao-joao").
  t = hifens ? t.replace(/[\s._]+/g, "-") : t.replace(/[\s._]+/g, "");
  t = t.replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return t.slice(0, 63).replace(/-+$/, "");
}

// O nome serve para a extensão? .com.br (Registro.br): de 2 a 26
// caracteres e não pode ser só número. Demais: até 63 caracteres.
// Nenhuma aceita hífen no começo ou no fim, nem "--" na 3ª e 4ª posição
// (reservado para nomes com acento codificados).
export function nomeValidoPara(nome: string, extensao: Extensao): boolean {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(nome)) return false;
  if (nome.slice(2, 4) === "--") return false;
  if (extensao === "com.br") return nome.length >= 2 && nome.length <= 26 && !/^\d+$/.test(nome);
  return nome.length >= 2 && nome.length <= 63;
}

// Variações para quando o nome exato está ocupado: com a cidade, com
// sufixo, com prefixo e com hífens. Só entram as que servem no .com.br e
// no .com, sem repetir, até MAX_SUGESTOES.
export function montarSugestoes(textoOriginal: string, nome: string, cidade: string): string[] {
  const local = normalizarNome(cidade);
  const comHifens = normalizarNome(textoOriginal, { hifens: true });
  const candidatos = [
    local && !nome.endsWith(local) ? `${nome}${local}` : "",
    local && !nome.endsWith(local) ? `${nome}-${local}` : "",
    `${nome}oficial`,
    `meu${nome}`,
    comHifens !== nome ? comHifens : "",
    `${nome}online`,
    `${nome}br`,
  ];
  const vistos = new Set<string>([nome]);
  const lista: string[] = [];
  for (const c of candidatos) {
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    if (EXTENSOES_SUGESTAO.every((ext) => nomeValidoPara(c, ext))) lista.push(c);
    if (lista.length >= MAX_SUGESTOES) break;
  }
  return lista;
}

// Links dos registradores ---------------------------------------------------
// Editáveis em Gestão > Registradores (tabela registradores_links). Os
// marcadores {dominio}, {nome} e {extensao} viram, por exemplo,
// "padariasaojoao.com.br", "padariasaojoao" e "com.br".
export interface LinkRegistrador {
  extensao: Extensao;
  registrador: string;
  url: string;
}

// Usados até o SQL da etapa 26 ser rodado (e como valor inicial dele).
export const LINKS_PADRAO: Record<Extensao, LinkRegistrador> = {
  "com.br": { extensao: "com.br", registrador: "Registro.br", url: "https://registro.br/busca-dominio/?fqdn={dominio}" },
  com: { extensao: "com", registrador: "GoDaddy", url: "https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}" },
  net: { extensao: "net", registrador: "GoDaddy", url: "https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}" },
  app: { extensao: "app", registrador: "GoDaddy", url: "https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}" },
  site: { extensao: "site", registrador: "GoDaddy", url: "https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}" },
  online: { extensao: "online", registrador: "GoDaddy", url: "https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}" },
};

export const MAX_URL_REGISTRADOR = 1000;

// Só https, sem espaço. O resto (parâmetros de afiliado) fica livre.
export function urlRegistradorValida(url: string): boolean {
  if (url.length > MAX_URL_REGISTRADOR || /\s/.test(url)) return false;
  try {
    return new URL(url.replace(/\{(dominio|nome|extensao)\}/g, "x")).protocol === "https:";
  } catch {
    return false;
  }
}

export function montarLinkRegistro(modelo: string, nome: string, extensao: Extensao): string {
  return modelo
    .replace(/\{dominio\}/g, encodeURIComponent(`${nome}.${extensao}`))
    .replace(/\{nome\}/g, encodeURIComponent(nome))
    .replace(/\{extensao\}/g, encodeURIComponent(extensao));
}

// Lê os links salvos, completando com o padrão o que faltar.
export function juntarLinks(linhas: { extensao: string; registrador: string; url: string }[] | null) {
  const links: Record<Extensao, LinkRegistrador> = { ...LINKS_PADRAO };
  for (const l of linhas ?? []) {
    if (ehExtensao(l.extensao) && l.url) links[l.extensao] = { extensao: l.extensao, registrador: l.registrador, url: l.url };
  }
  return links;
}

// Link para a aba Domínios já preenchida (atalho do lead).
export function linkBuscaDominio(nomeEmpresa: string, cidade?: string | null) {
  const params = new URLSearchParams({ nome: nomeEmpresa });
  if (cidade) params.set("cidade", cidade);
  return `/painel/dominios?${params.toString()}`;
}
