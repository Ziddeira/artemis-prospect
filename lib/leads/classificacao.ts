// Classificação e pontuação de leads, portadas de caca-leads-sem-site.html.
import type { SinalBrasileiro } from "./brasileiro";
import type { Confianca } from "./confianca";
import type { CodigoPais, ConfigPais } from "./paises";

// "internacional" = aba Internacional (plano Pro): busca em outro país,
// escolhido em lib/leads/paises.ts.
export type Modo = "negocios" | "hospedagem" | "internacional";

export function ehModo(valor: unknown): valor is Modo {
  return valor === "negocios" || valor === "hospedagem" || valor === "internacional";
}

export type Situacao = "sem_site" | "booking" | "rede_social" | "site_proprio";

export interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface PlaceBruto {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: unknown;
  primaryTypeDisplayName?: { text?: string };
  // Tipos da Places API (ex.: "brazilian_restaurant"), para o sinal de
  // negócio brasileiro (lib/leads/brasileiro.ts).
  primaryType?: string;
  types?: string[];
  addressComponents?: AddressComponent[];
  // Só a data (selo de confiança) e o idioma original (negócio
  // brasileiro) são usados; o texto das avaliações nunca é mostrado nem
  // guardado.
  reviews?: {
    publishTime?: string;
    text?: { languageCode?: string };
    originalText?: { languageCode?: string };
  }[];
  // Diferença do horário da empresa para o UTC agora (lib/leads/fuso.ts).
  utcOffsetMinutes?: number;
}

export interface LeadResultado {
  id: string;
  nome: string;
  bairro: string;
  nota: number;
  avaliacoes: number;
  situacao: Situacao;
  plataforma: string | null;
  tipo: string;
  aberto: boolean;
  temCelular: boolean;
  temTelefone: boolean;
  pontuacao: number;
  area: string;
  modo: Modo;
  // País da empresa. Vazio = Brasil (buscas salvas antes da aba
  // Internacional).
  pais?: CodigoPais;
  // Fuso da empresa (ex.: "America/Chicago"), para mostrar a hora local.
  // Só em países de fora; nulo = não deu para saber.
  fuso?: string | null;
  contato: ContatoLead | null;
  // Selo de confiança (lib/leads/confianca.ts). Buscas salvas antes do
  // selo existir vêm sem ele.
  confianca?: Confianca;
  // "Provável negócio brasileiro" (lib/leads/brasileiro.ts). Só na aba
  // Internacional; nulo/vazio = nenhum sinal.
  brasileiro?: SinalBrasileiro | null;
  // Já desbloqueado antes, mas sem o contato à mão (cache vencido):
  // desbloquear de novo não cobra.
  desbloqueado?: boolean;
}

export interface ContatoLead {
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  maps: string | null;
}

// Domínios de plataformas de reserva: geram a etiqueta "Depende do
// Airbnb/Booking".
export const DOMINIOS_RESERVA = [
  "airbnb.com",
  "airbnb.com.br",
  "abnb.me",
  "booking.com",
  "expedia.com",
  "expedia.com.br",
  "hoteis.com",
  "hotels.com",
  "decolar.com",
  "vrbo.com",
  "tripadvisor.com",
  "tripadvisor.com.br",
  "trivago.com.br",
  "agoda.com",
  "hostelworld.com",
];

// Domínios de apps e redes sociais: não contam como site próprio. Vale
// em todos os países; cada país ainda tem a própria lista extra, editável
// em Gestão > Sites de terceiros (tabela dominios_terceiro, etapa 21).
export const DOMINIOS_TERCEIRO = [
  "appbarber.com.br",
  "booksy.com",
  "trinks.com",
  "avec.app",
  "salaovip.com.br",
  "simplybook.me",
  "calendly.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "tiktok.com",
  "youtube.com",
  "linktr.ee",
  "linkin.bio",
  "bio.link",
  "beacons.ai",
  "taplink.cc",
  "carrd.co",
  "wa.me",
  "wa.link",
  "whatsapp.com",
  "api.whatsapp.com",
  "ifood.com.br",
  "aiqfome.com",
  "anota.ai",
  "goomer.app",
  "cardapioweb.com",
  "ubereats.com",
  "doctoralia.com.br",
  "boaconsulta.com",
  "google.com",
  "g.page",
  "goo.gl",
  "business.site",
  "sites.google.com",
  "wixsite.com",
  "blogspot.com",
  "wordpress.com",
  "webnode.page",
  "negocio.site",
  "bit.ly",
];

const NOMES_PLATAFORMA: Record<string, string> = {
  airbnb: "Airbnb",
  abnb: "Airbnb",
  booking: "Booking",
  expedia: "Expedia",
  hoteis: "Hoteis.com",
  hotels: "Hotels.com",
  decolar: "Decolar",
  vrbo: "Vrbo",
  tripadvisor: "TripAdvisor",
  trivago: "Trivago",
  agoda: "Agoda",
  hostelworld: "Hostelworld",
  instagram: "Instagram",
  facebook: "Facebook",
  appbarber: "AppBarber",
  booksy: "Booksy",
  linktr: "Linktree",
  yelp: "Yelp",
  squareup: "Square",
  square: "Square",
  fresha: "Fresha",
  vagaro: "Vagaro",
  thumbtack: "Thumbtack",
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  opentable: "OpenTable",
  wixsite: "Wix",
  godaddysites: "GoDaddy",
};

export function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function pertenceALista(host: string, lista: string[]): boolean {
  return lista.some((d) => host === d || host.endsWith("." + d));
}

// dominiosDoPais: a lista extra do país da empresa (vem do banco, ver
// lib/leads/dominios.ts). A lista fixa acima vale sempre.
export function classificar(url: string | null | undefined, dominiosDoPais: string[] = []): Situacao {
  if (!url) return "sem_site";
  const host = hostDe(url);
  if (!host) return "sem_site";
  if (pertenceALista(host, DOMINIOS_RESERVA)) return "booking";
  if (pertenceALista(host, DOMINIOS_TERCEIRO)) return "rede_social";
  if (pertenceALista(host, dominiosDoPais)) return "rede_social";
  return "site_proprio";
}

export function nomePlataforma(url: string): string {
  const host = hostDe(url);
  if (!host) return "link externo";
  const chave = Object.keys(NOMES_PLATAFORMA).find(
    (k) => host.startsWith(k + ".") || host.includes("." + k + "."),
  );
  return chave ? NOMES_PLATAFORMA[chave] : host;
}

// Retorna 55 + DDD + número se o telefone parecer ser um celular
// brasileiro (13 dígitos com 9 na frente do número local), senão null.
export function celularBrasileiro(
  nacional?: string | null,
  internacional?: string | null,
): string | null {
  const origem = internacional || nacional || "";
  let digitos = origem.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("0")) digitos = digitos.replace(/^0+/, "");
  if (!digitos.startsWith("55")) digitos = "55" + digitos;
  const local = digitos.slice(4);
  if (digitos.length === 13 && local.startsWith("9")) return digitos;
  return null;
}

// Número para o botão de WhatsApp, só nos países em que WhatsApp é o
// costume. No Brasil, só celular (dá para reconhecer pelo 9); nos outros,
// o número internacional inteiro.
export function whatsappDoLugar(pais: ConfigPais, p: PlaceBruto): string | null {
  if (!pais.whatsapp) return null;
  if (pais.codigo === "BR") return celularBrasileiro(p.nationalPhoneNumber, p.internationalPhoneNumber);
  return (p.internationalPhoneNumber || "").replace(/\D/g, "") || null;
}

// No Brasil, o formato local "(48) 99999-0000"; nos outros países, o
// internacional "+1 512-555-0100", que já funciona para ligar daqui.
export function telefoneDoLugar(pais: ConfigPais, p: PlaceBruto): string | null {
  const nacional = p.nationalPhoneNumber || null;
  const internacional = p.internationalPhoneNumber || null;
  return pais.codigo === "BR" ? nacional || internacional : internacional || nacional;
}

export function pontuarLead(l: {
  avaliacoes: number;
  nota: number;
  situacao: Situacao;
  celular: boolean;
  temHorario: boolean;
}): number {
  let s = 0;
  s += (Math.min(l.avaliacoes, 200) / 200) * 35;
  s += l.nota >= 4.5 ? 20 : l.nota >= 4 ? 12 : l.nota ? 5 : 0;
  s +=
    l.situacao === "booking"
      ? 25
      : l.situacao === "rede_social"
        ? 20
        : l.situacao === "sem_site"
          ? 10
          : 0;
  s += l.celular ? 15 : 0;
  s += l.temHorario ? 10 : 0;
  return Math.round(s);
}

const TIPOS_BAIRRO = ["sublocality", "sublocality_level_1", "neighborhood"];

export function extrairBairro(
  componentes?: AddressComponent[],
  enderecoCompleto?: string,
): string {
  if (componentes?.length) {
    const bairro = componentes.find((c) =>
      c.types?.some((t) => TIPOS_BAIRRO.includes(t)),
    );
    if (bairro?.longText) return bairro.longText;
    const cidade = componentes.find((c) => c.types?.includes("locality"));
    if (cidade?.longText) return cidade.longText;
  }
  if (enderecoCompleto) {
    const partes = enderecoCompleto.split(",").map((p) => p.trim());
    if (partes.length >= 2) return partes[1];
  }
  return "";
}
