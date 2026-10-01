// "Provável negócio brasileiro" (aba Internacional): estima se uma
// empresa nos EUA ou no Canadá é de brasileiros, só com o que a busca do
// Google já devolve (nenhuma chamada extra, nenhum campo mais caro):
//
//   1. avaliações escritas em português (o sinal mais forte): o Google
//      manda até 5 avaliações por empresa e diz o idioma original de cada
//      uma (reviews[].originalText.languageCode). Só o idioma é lido; o
//      texto nunca é mostrado nem guardado;
//   2. tipo do negócio indicando culinária brasileira (ex.:
//      "brazilian_restaurant", "acai_shop");
//   3. palavras no nome (Açaí, Padaria, Churrascaria, Carioca...), de uma
//      lista editável em Gestão > Negócio brasileiro (o sinal mais fraco:
//      "Rio" ou "Samba" também aparecem em nome de quem não é brasileiro).
//
// É uma estimativa: a tela sempre diz "provável".
//
// Pode ser importado no navegador: não tem nada secreto.
import type { PlaceBruto } from "./classificacao";

// Pesos de cada sinal. Avaliação em português pesa mais; nome, menos.
export const PESO_AVALIACAO_PT = 3;
// Cada avaliação em português além da primeira soma este tanto, até
// MAX_AVALIACOES_PT_CONTADAS (o Google manda no máximo 5).
export const PESO_AVALIACAO_PT_EXTRA = 1;
const MAX_AVALIACOES_PT_CONTADAS = 3;
export const PESO_TIPO = 2;
export const PESO_NOME = 1;

// A partir de quantos pontos o sinal é "forte" (pelo menos uma avaliação
// em português) ou "médio" (tipo de negócio brasileiro, ou nome + algo).
const PONTOS_FORTE = PESO_AVALIACAO_PT;
const PONTOS_MEDIO = PESO_TIPO;

export type ForcaBrasileiro = "forte" | "medio" | "fraco";

export interface SinalBrasileiro {
  pontos: number;
  forca: ForcaBrasileiro;
  // Frase curta com o porquê ("2 avaliações em português e “Açaí” no nome").
  motivo: string;
  // Quantas das avaliações que o Google mandou estão em português. Fica
  // guardado para o desbloqueio (o Google não manda avaliações no
  // detalhe do lugar sem subir o preço da chamada).
  avaliacoesPt: number;
}

// Tipos da Places API (New) que indicam negócio brasileiro.
export const TIPOS_BRASILEIROS = ["brazilian_restaurant", "acai_shop"];

// Lista inicial de palavras do nome. A que vale é a do banco (Gestão >
// Negócio brasileiro); esta só é usada se o SQL da etapa 22 ainda não
// foi rodado. A comparação ignora acentos e maiúsculas, e a palavra
// precisa aparecer inteira ("Rio" não pega "Riordan").
export const PALAVRAS_BRASILEIRAS_PADRAO = [
  "Brazil",
  "Brazilian",
  "Brasil",
  "Brasileiro",
  "Brasileira",
  "Brasileirinho",
  "Rio",
  "Carioca",
  "Bahia",
  "Baiano",
  "Baiana",
  "Minas",
  "Mineiro",
  "Mineira",
  "Mineirinho",
  "Paulista",
  "Paulistano",
  "Gaúcho",
  "Gaúcha",
  "Goiano",
  "Capixaba",
  "Nordestino",
  "Floripa",
  "Açaí",
  "Padaria",
  "Churrascaria",
  "Churrasco",
  "Salgado",
  "Salgados",
  "Salgadinho",
  "Pão de Queijo",
  "Coxinha",
  "Feijoada",
  "Brigadeiro",
  "Pastelaria",
  "Lanchonete",
  "Boteco",
  "Picanha",
  "Tapioca",
  "Guaraná",
  "Cantinho",
  "Sabor Brasileiro",
  "Verde Amarelo",
  "Saudade",
  "Samba",
  "Capoeira",
];

// Expressões com "Brazilian" que são nome de serviço, não de origem do
// dono: depilação, escova e jiu-jitsu brasileiros existem em qualquer
// salão ou academia americana. Saem do nome antes da comparação.
const EXPRESSOES_IGNORADAS = [
  "brazilian wax",
  "brazilian waxing",
  "brazilian blowout",
  "brazilian keratin",
  "brazilian jiu jitsu",
  "brazilian jiujitsu",
  "brazilian bjj",
];

// "Pão de Queijo!" -> "pao de queijo"
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Palavras do nome que estão na lista (na grafia da lista), sem repetir.
export function palavrasNoNome(nome: string, palavras: string[]): string[] {
  let alvo = ` ${normalizarTexto(nome)} `;
  for (const expressao of EXPRESSOES_IGNORADAS) alvo = alvo.replaceAll(` ${expressao} `, " ");
  const achadas: string[] = [];
  const vistas = new Set<string>();
  for (const palavra of palavras) {
    const chave = normalizarTexto(palavra);
    if (!chave || vistas.has(chave)) continue;
    if (alvo.includes(` ${chave} `)) {
      vistas.add(chave);
      achadas.push(palavra);
    }
  }
  return achadas;
}

// Quantas avaliações estão em português ("pt", "pt-BR", "pt-PT"). Usa o
// idioma ORIGINAL: o Google pode traduzir o texto para o idioma da busca.
export function contarAvaliacoesPt(reviews: PlaceBruto["reviews"]): number {
  let total = 0;
  for (const r of reviews ?? []) {
    const idioma = (r.originalText?.languageCode || r.text?.languageCode || "").toLowerCase();
    if (idioma === "pt" || idioma.startsWith("pt-")) total++;
  }
  return total;
}

export function tipoBrasileiro(lugar: Pick<PlaceBruto, "primaryType" | "types" | "primaryTypeDisplayName">): string | null {
  const tipos = [lugar.primaryType, ...(lugar.types ?? [])];
  const daLista = tipos.some((t) => t && TIPOS_BRASILEIROS.includes(t));
  const nomeTipo = lugar.primaryTypeDisplayName?.text || "";
  const nomeTipoNormal = normalizarTexto(nomeTipo);
  const pelaDescricao = /\b(brazilian|brasileir[oa]|brazil|brasil)\b/.test(nomeTipoNormal);
  if (!daLista && !pelaDescricao) return null;
  // "Brazilian restaurant" quando o Google manda a descrição; senão, um
  // rótulo genérico.
  return nomeTipo || (tipos.includes("acai_shop") ? "Açaí" : "Restaurante brasileiro");
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

export interface SinaisBrasileiro {
  nome: string;
  avaliacoesPt: number;
  // Quantas avaliações o Google mandou (para "2 de 5 avaliações...").
  // Nulo = não se sabe (desbloqueio, que não pede avaliações).
  avaliacoesRecebidas: number | null;
  tipo: string | null;
  palavras: string[];
}

// Nulo = nenhum sinal.
export function avaliarBrasileiro(s: SinaisBrasileiro): SinalBrasileiro | null {
  const noNome = palavrasNoNome(s.nome, s.palavras);
  const pt = Math.max(0, Math.min(5, Math.floor(s.avaliacoesPt)));

  let pontos = 0;
  if (pt > 0) pontos += PESO_AVALIACAO_PT + PESO_AVALIACAO_PT_EXTRA * (Math.min(pt, MAX_AVALIACOES_PT_CONTADAS) - 1);
  if (s.tipo) pontos += PESO_TIPO;
  if (noNome.length) pontos += PESO_NOME;
  if (!pontos) return null;

  const partes: string[] = [];
  if (pt > 0) {
    const de = s.avaliacoesRecebidas && s.avaliacoesRecebidas >= pt ? ` de ${s.avaliacoesRecebidas}` : "";
    partes.push(`${pt}${de} ${pt === 1 && !de ? "avaliação" : "avaliações"} em português`);
  }
  if (s.tipo) partes.push(`tipo “${s.tipo}”`);
  if (noNome.length) {
    const lista = noNome.slice(0, 2).map((p) => `“${p}”`);
    partes.push(`${juntar(lista)} no nome`);
  }

  const forca: ForcaBrasileiro = pontos >= PONTOS_FORTE ? "forte" : pontos >= PONTOS_MEDIO ? "medio" : "fraco";
  return { pontos, forca, motivo: juntar(partes), avaliacoesPt: pt };
}

// Sinal a partir do lugar que veio da busca de texto (com avaliações).
export function brasileiroDoLugar(lugar: PlaceBruto, palavras: string[]): SinalBrasileiro | null {
  return avaliarBrasileiro({
    nome: lugar.displayName?.text || "",
    avaliacoesPt: contarAvaliacoesPt(lugar.reviews),
    avaliacoesRecebidas: lugar.reviews?.length ?? 0,
    tipo: tipoBrasileiro(lugar),
    palavras,
  });
}

export const ROTULO_FORCA_BRASILEIRO: Record<ForcaBrasileiro, string> = {
  forte: "sinal forte",
  medio: "sinal médio",
  fraco: "sinal fraco",
};

// Confere um sinal que veio de fora (JSON salvo no banco ou mandado pelo
// navegador). Nulo se não tiver o formato certo.
export function ehSinalBrasileiro(valor: unknown): valor is SinalBrasileiro {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.pontos === "number" &&
    typeof v.motivo === "string" &&
    typeof v.avaliacoesPt === "number" &&
    (v.forca === "forte" || v.forca === "medio" || v.forca === "fraco")
  );
}

// Número para o WhatsApp de um provável negócio brasileiro: o telefone
// inteiro com o código do país ("+1 512-555-0100" -> "15125550100").
// Telefone sem "+" (formato nacional) ganha o código do país na frente.
export function whatsappDoTelefone(telefone: string | null | undefined, ddi: string): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;
  if (telefone.trim().startsWith("+")) return digitos;
  return digitos.startsWith(ddi) && digitos.length > 10 ? digitos : `${ddi}${digitos}`;
}
