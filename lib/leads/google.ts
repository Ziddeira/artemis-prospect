// Acesso à Places API (New) do Google. Só deve ser importado por código
// que roda no servidor (rotas de API, Server Components): lê
// GOOGLE_PLACES_API_KEY, que não tem prefixo NEXT_PUBLIC_ e por isso
// nunca é exposta ao navegador.
import type { PlaceBruto } from "./classificacao";
import type { ConfigPais } from "./paises";

export class ErroGooglePlaces extends Error {}

function chaveApi(): string {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) {
    throw new ErroGooglePlaces(
      "GOOGLE_PLACES_API_KEY não configurada no servidor.",
    );
  }
  return chave;
}

// Pede as avaliações na busca de texto só para saber a data da mais
// recente (selo de confiança). Custo: a busca passa da faixa
// "Enterprise" (US$ 35 por mil páginas) para "Enterprise + Atmosphere"
// (US$ 40 por mil). Com false, o selo continua funcionando, só sem o
// critério da data — e o preço volta para US$ 35 (lib/admin/custos.ts
// acompanha sozinho).
export const PEDIR_AVALIACOES_NA_BUSCA = true;

// utcOffsetMinutes (hora local do lead, aba Internacional) é da faixa
// "Pro", mais barata que as que a busca e os detalhes já pedem: não muda
// o preço de nenhuma das duas. O Google cobra pela faixa mais cara entre
// os campos pedidos.

const CAMPOS_BUSCA = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.regularOpeningHours",
  "places.primaryTypeDisplayName",
  "places.addressComponents",
  "places.utcOffsetMinutes",
  ...(PEDIR_AVALIACOES_NA_BUSCA ? ["places.reviews"] : []),
  "nextPageToken",
].join(",");

const CAMPOS_DETALHES = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "addressComponents",
  "utcOffsetMinutes",
].join(",");

interface RespostaBusca {
  places?: PlaceBruto[];
  nextPageToken?: string;
}

// A região e o idioma vêm do país da busca (lib/leads/paises.ts). O
// preço é o mesmo em qualquer país: o Google cobra pelos campos pedidos,
// não pelo lugar pesquisado.
export async function buscarTexto(
  query: string,
  pais: ConfigPais,
  pageToken?: string,
): Promise<RespostaBusca> {
  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: pais.languageCode,
    regionCode: pais.regionCode,
    pageSize: 20,
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chaveApi(),
      "X-Goog-FieldMask": CAMPOS_BUSCA,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = dados?.error?.message || `Erro ${res.status} na Places API.`;
    throw new ErroGooglePlaces(msg);
  }
  return dados as RespostaBusca;
}

export async function detalhesLugar(placeId: string): Promise<PlaceBruto> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": chaveApi(),
        "X-Goog-FieldMask": CAMPOS_DETALHES,
      },
      cache: "no-store",
    },
  );

  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = dados?.error?.message || `Erro ${res.status} na Places API.`;
    throw new ErroGooglePlaces(msg);
  }
  return dados as PlaceBruto;
}

// Só o site que o Google Maps mostra para a empresa. Usada pela
// verificação semanal das vendas (campo único = consulta mais barata).
export async function siteNoGoogle(placeId: string): Promise<string | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": chaveApi(),
        "X-Goog-FieldMask": "websiteUri",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = dados?.error?.message || `Erro ${res.status} na Places API.`;
    throw new ErroGooglePlaces(msg);
  }
  return (dados as PlaceBruto).websiteUri || null;
}
