// Países em que a busca funciona. Tudo o que muda de um país para outro
// fica aqui: idioma e região da busca no Google, se WhatsApp faz sentido,
// fusos horários e a lista inicial de sites de terceiros. Para acrescentar
// um país, basta uma entrada nova em PAISES (e, se ele for da aba
// Internacional, o código dele em PAISES_INTERNACIONAIS). Nenhuma outra
// lógica precisa mudar: busca, classificação, contato e mensagem leem
// daqui. O banco só confere se o código tem 2 letras.
//
// Pode ser importado no navegador: não tem nada secreto.

export type CodigoPais = "BR" | "US" | "CA";

export interface ConfigPais {
  codigo: CodigoPais;
  // Nome em português, para a tela.
  nome: string;
  bandeira: string;
  // Nome em inglês, acrescentado ao fim da consulta ("... in Austin TX,
  // United States") para o Google não confundir cidades de mesmo nome
  // em outro país. Nulo = não acrescenta.
  nomeNaBusca: string | null;
  // Parâmetros da Places API: região (viés dos resultados) e idioma
  // (nome dos tipos de negócio, endereço etc.).
  regionCode: string;
  languageCode: string;
  // Palavra entre o nicho e a região: "barbearia em Centro" / "barber
  // shop in Austin".
  conectorBusca: string;
  // Idioma dos modelos de mensagem usados para leads deste país.
  idiomaMensagem: "pt" | "en";
  // WhatsApp é o jeito usual de chamar empresa por lá? Se não, o botão
  // some e aparece avisoContato.
  whatsapp: boolean;
  avisoContato: string | null;
  // Exemplos que aparecem nos campos da busca.
  exemploNicho: string;
  exemploRegiao: string;
  // Fuso de cada estado/província (código curto do Google, ex.: "TX",
  // "ON"). Onde um estado tem mais de um fuso, vale o da maior parte, e
  // o horário que o Google manda corrige (ver lib/leads/fuso.ts).
  fusoPorEstado: Record<string, string>;
  // Todos os fusos do país, do mais comum para o menos. Usado quando o
  // estado não bate com o horário que o Google mandou.
  fusos: string[];
  // Sites de terceiros comuns no país, além da lista fixa de
  // lib/leads/classificacao.ts. É só o ponto de partida: a lista que
  // vale é a do banco, editável em Gestão > Sites de terceiros. Esta só
  // é usada se o SQL da etapa 21 ainda não foi rodado.
  dominiosTerceiroPadrao: string[];
}

// Os mesmos para EUA e Canadá (e o que o supabase/etapa21 grava no banco).
const DOMINIOS_AMERICA_DO_NORTE = [
  "yelp.com",
  "squareup.com",
  "fresha.com",
  "booksy.com",
  "vagaro.com",
  "thumbtack.com",
  "doordash.com",
  "ubereats.com",
  "opentable.com",
  "wixsite.com",
  "godaddysites.com",
  "business.site",
  "facebook.com",
  "instagram.com",
];

const AVISO_SEM_WHATSAPP = "Por lá, empresa se chama por telefone ou e-mail: WhatsApp não é o costume.";

export const PAISES: Record<CodigoPais, ConfigPais> = {
  BR: {
    codigo: "BR",
    nome: "Brasil",
    bandeira: "🇧🇷",
    nomeNaBusca: null,
    regionCode: "BR",
    languageCode: "pt-BR",
    conectorBusca: "em",
    idiomaMensagem: "pt",
    whatsapp: true,
    avisoContato: null,
    exemploNicho: "barbearia, salão de beleza",
    exemploRegiao: "Centro Palhoça SC, Pagani Palhoça SC",
    // O Brasil não mostra hora local (o usuário já está no país).
    fusoPorEstado: {},
    fusos: [],
    dominiosTerceiroPadrao: [],
  },
  US: {
    codigo: "US",
    nome: "Estados Unidos",
    bandeira: "🇺🇸",
    nomeNaBusca: "United States",
    regionCode: "US",
    languageCode: "en-US",
    conectorBusca: "in",
    idiomaMensagem: "en",
    whatsapp: false,
    avisoContato: AVISO_SEM_WHATSAPP,
    exemploNicho: "barber shop, hair salon, dentist",
    exemploRegiao: "Austin TX, Miami FL",
    fusoPorEstado: {
      CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York",
      GA: "America/New_York", IN: "America/New_York", KY: "America/New_York", ME: "America/New_York",
      MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", NH: "America/New_York",
      NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York", OH: "America/New_York",
      PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VT: "America/New_York",
      VA: "America/New_York", WV: "America/New_York",
      AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago",
      KS: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago",
      MO: "America/Chicago", NE: "America/Chicago", ND: "America/Chicago", OK: "America/Chicago",
      SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
      CO: "America/Denver", ID: "America/Denver", MT: "America/Denver", NM: "America/Denver",
      UT: "America/Denver", WY: "America/Denver",
      AZ: "America/Phoenix",
      CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
      AK: "America/Anchorage",
      HI: "Pacific/Honolulu",
      PR: "America/Puerto_Rico",
    },
    fusos: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Phoenix",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Puerto_Rico",
    ],
    dominiosTerceiroPadrao: DOMINIOS_AMERICA_DO_NORTE,
  },
  CA: {
    codigo: "CA",
    nome: "Canadá",
    bandeira: "🇨🇦",
    nomeNaBusca: "Canada",
    regionCode: "CA",
    languageCode: "en-CA",
    conectorBusca: "in",
    idiomaMensagem: "en",
    whatsapp: false,
    avisoContato: AVISO_SEM_WHATSAPP,
    exemploNicho: "barber shop, hair salon, dentist",
    exemploRegiao: "Toronto ON, Vancouver BC",
    fusoPorEstado: {
      BC: "America/Vancouver",
      AB: "America/Edmonton",
      SK: "America/Regina",
      MB: "America/Winnipeg",
      ON: "America/Toronto",
      QC: "America/Toronto",
      NB: "America/Moncton",
      NS: "America/Halifax",
      PE: "America/Halifax",
      NL: "America/St_Johns",
      YT: "America/Whitehorse",
      NT: "America/Edmonton",
      NU: "America/Iqaluit",
    },
    fusos: [
      "America/Toronto",
      "America/Vancouver",
      "America/Edmonton",
      "America/Winnipeg",
      "America/Regina",
      "America/Halifax",
      "America/St_Johns",
      "America/Whitehorse",
    ],
    dominiosTerceiroPadrao: DOMINIOS_AMERICA_DO_NORTE,
  },
};

export const PAIS_PADRAO: CodigoPais = "BR";

// Países da aba Internacional, na ordem em que aparecem.
export const PAISES_INTERNACIONAIS: CodigoPais[] = ["US", "CA"];

export function ehCodigoPais(valor: unknown): valor is CodigoPais {
  return typeof valor === "string" && Object.hasOwn(PAISES, valor);
}

export function ehPaisInternacional(valor: unknown): valor is CodigoPais {
  return ehCodigoPais(valor) && PAISES_INTERNACIONAIS.includes(valor);
}

// Config do país, com o Brasil para valores vazios ou desconhecidos
// (leads e buscas salvos antes da aba Internacional não têm país).
export function configPais(codigo: string | null | undefined): ConfigPais {
  return ehCodigoPais(codigo) ? PAISES[codigo] : PAISES[PAIS_PADRAO];
}

// "Estados Unidos e Canadá" (para textos de plano e ajuda).
export function nomesPaisesInternacionais(): string {
  const nomes = PAISES_INTERNACIONAIS.map((c) => PAISES[c].nome);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
}
