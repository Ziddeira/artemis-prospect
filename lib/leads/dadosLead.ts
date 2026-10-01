// Dados de um lead desbloqueado que ficam em cache no banco
// (leads_desbloqueados.dados), para a página "Meus leads" não precisar
// chamar o Google a cada visita. Ver supabase/etapa4-cache-leads-comunidade.sql.
import {
  classificar,
  extrairBairro,
  nomePlataforma,
  telefoneDoLugar,
  whatsappDoLugar,
  type PlaceBruto,
  type Situacao,
} from "./classificacao";
import { avaliarBrasileiro, tipoBrasileiro, type SinalBrasileiro } from "./brasileiro";
import { codigoEstado, codigoPaisDoEndereco, escolherFuso } from "./fuso";
import { PAIS_PADRAO, configPais, ehCodigoPais, type CodigoPais } from "./paises";

// Política de cache da Google Maps Platform: o conteúdo (tudo menos o
// place_id) só pode ficar em cache temporário. Passado esse prazo, o
// cache é descartado e buscado de novo no Google.
export const VALIDADE_CACHE_DIAS = 30;

export interface DadosLead {
  nome: string;
  bairro: string;
  nota: number;
  avaliacoes: number;
  situacao: Situacao;
  plataforma: string | null;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  maps: string | null;
  // País e fuso da empresa (aba Internacional). Cache gravado antes disso
  // vem sem: vale Brasil.
  pais?: CodigoPais;
  fuso?: string | null;
  // "Provável negócio brasileiro" (lib/leads/brasileiro.ts), só fora do
  // Brasil. Vazio = nenhum sinal (ou cache gravado antes disso).
  brasileiro?: SinalBrasileiro | null;
}

// Para o sinal de negócio brasileiro no desbloqueio: o detalhe do lugar
// não traz avaliações (pedir subiria o preço da chamada), então o número
// de avaliações em português vem da busca que mostrou o lead.
export interface OpcoesBrasileiro {
  palavras: string[];
  avaliacoesPt: number;
}

// País da empresa pelo endereço que o Google devolveu. País fora da
// lista de lib/leads/paises.ts conta como o padrão.
export function paisDoLugar(lugar: PlaceBruto): CodigoPais {
  const codigo = codigoPaisDoEndereco(lugar.addressComponents);
  return ehCodigoPais(codigo) ? codigo : PAIS_PADRAO;
}

// dominiosDoPais: lista extra de sites de terceiros do país da empresa
// (lib/leads/dominios.ts).
export function montarDadosLead(
  lugar: PlaceBruto,
  dominiosDoPais: string[] = [],
  brasileiro?: OpcoesBrasileiro,
): DadosLead {
  const pais = configPais(paisDoLugar(lugar));
  const situacao = classificar(lugar.websiteUri, dominiosDoPais);
  const ehPlataforma = situacao === "booking" || situacao === "rede_social";
  return {
    nome: lugar.displayName?.text || "Sem nome",
    bairro: extrairBairro(lugar.addressComponents, lugar.formattedAddress),
    nota: lugar.rating || 0,
    avaliacoes: lugar.userRatingCount || 0,
    situacao,
    plataforma: ehPlataforma && lugar.websiteUri ? nomePlataforma(lugar.websiteUri) : null,
    telefone: telefoneDoLugar(pais, lugar),
    whatsapp: whatsappDoLugar(pais, lugar),
    site: lugar.websiteUri || null,
    maps: lugar.googleMapsUri || null,
    pais: pais.codigo,
    fuso: escolherFuso(pais, codigoEstado(lugar.addressComponents), lugar.utcOffsetMinutes),
    ...(pais.codigo !== PAIS_PADRAO && brasileiro
      ? {
          brasileiro: avaliarBrasileiro({
            nome: lugar.displayName?.text || "",
            avaliacoesPt: brasileiro.avaliacoesPt,
            avaliacoesRecebidas: null,
            tipo: tipoBrasileiro(lugar),
            palavras: brasileiro.palavras,
          }),
        }
      : {}),
  };
}

export function cacheValido(atualizadoEm: string | null | undefined, agora = Date.now()): boolean {
  if (!atualizadoEm) return false;
  const idade = agora - new Date(atualizadoEm).getTime();
  return idade < VALIDADE_CACHE_DIAS * 24 * 60 * 60 * 1000;
}
