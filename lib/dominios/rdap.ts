import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { URL_SITE } from "@/lib/site";
import type { Extensao, ResultadoDominio, SituacaoDominio } from "@/lib/dominios/regras";

// Consulta de disponibilidade por RDAP (protocolo público e oficial dos
// registros de domínio). Roda só no servidor: o navegador nunca fala
// direto com os serviços de consulta.
//
// Como lê a resposta:
//   * 404 = o registro não conhece o domínio → disponível;
//   * 200 = existe → ocupado (e a data de expiração, se vier);
//   * 429 = pediu para esperar → "limite" (e o servidor fica em pausa
//     pelo tempo do Retry-After, sem receber outra consulta).
//
// Cuidados para não sobrecarregar os serviços:
//   * resultado guardado por CACHE_MINUTOS: primeiro na memória do
//     servidor, depois no banco (tabela dominios_cache, etapa 26), para
//     valer também entre servidores diferentes;
//   * no máximo SIMULTANEAS consultas ao mesmo tempo em cada serviço;
//   * o limite de buscas por usuário fica na rota (função SQL).

const CACHE_MINUTOS = 10;
const TEMPO_LIMITE_MS = 8000;
const PAUSA_PADRAO_SEGUNDOS = 60;
const SIMULTANEAS: Record<string, number> = { "rdap.registro.br": 2 };
const SIMULTANEAS_PADRAO = 4;

// Endereços RDAP de cada extensão. A lista oficial da IANA
// (data.iana.org/rdap/dns.json) é lida uma vez por dia e manda; esta
// fica de reserva, para quando a IANA não responder.
const BOOTSTRAP_IANA = "https://data.iana.org/rdap/dns.json";
const SERVIDORES_RESERVA: Record<Extensao, string> = {
  "com.br": "https://rdap.registro.br/",
  com: "https://rdap.verisign.com/com/v1/",
  net: "https://rdap.verisign.com/net/v1/",
  app: "https://pubapi.registry.google/rdap/",
  site: "https://rdap.centralnic.com/site/",
  online: "https://rdap.centralnic.com/online/",
};
// No arquivo da IANA o .com.br aparece como "br".
const TLD_IANA: Record<Extensao, string> = { "com.br": "br", com: "com", net: "net", app: "app", site: "site", online: "online" };

const CABECALHOS = {
  Accept: "application/rdap+json, application/json",
  "User-Agent": `ArtemisProspect/1.0 (+${URL_SITE})`,
};

// Memória do servidor -------------------------------------------------------
// Vale enquanto a instância do servidor estiver de pé (some a cada deploy).

type Guardado = { situacao: "disponivel" | "ocupado"; expiraEm: string | null; ate: number };
const memoria = new Map<string, Guardado>();
const pausas = new Map<string, number>(); // host → até quando (ms)
const filas = new Map<string, { ativas: number; esperando: (() => void)[] }>();
let servidoresIana: { mapa: Promise<Partial<Record<Extensao, string>>>; ate: number } | null = null;

async function lerListaIana(): Promise<Partial<Record<Extensao, string>>> {
  const mapa: Partial<Record<Extensao, string>> = {};
  try {
    const res = await fetch(BOOTSTRAP_IANA, { cache: "no-store", signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (res.ok) {
      const dados = (await res.json()) as { services?: [string[], string[]][] };
      for (const [ext, tld] of Object.entries(TLD_IANA) as [Extensao, string][]) {
        const servico = dados.services?.find(([tlds]) => tlds.includes(tld));
        const url = servico?.[1].find((u) => u.startsWith("https://"));
        if (url) mapa[ext] = url.endsWith("/") ? url : `${url}/`;
      }
    }
  } catch (e) {
    console.error("[dominios/rdap] Lista da IANA indisponível, usando a reserva:", e instanceof Error ? e.message : e);
  }
  // Falhou: tenta de novo em 10 minutos, não a cada busca.
  if (!Object.keys(mapa).length && servidoresIana) servidoresIana.ate = Date.now() + 10 * 60_000;
  return mapa;
}

async function servidorDe(extensao: Extensao): Promise<string> {
  // Consultas ao mesmo tempo dividem a mesma leitura da lista.
  if (!servidoresIana || servidoresIana.ate < Date.now()) {
    servidoresIana = { mapa: lerListaIana(), ate: Date.now() + 24 * 60 * 60_000 };
  }
  return (await servidoresIana.mapa)[extensao] ?? SERVIDORES_RESERVA[extensao];
}

async function naFila<T>(host: string, tarefa: () => Promise<T>): Promise<T> {
  const limite = SIMULTANEAS[host] ?? SIMULTANEAS_PADRAO;
  let fila = filas.get(host);
  if (!fila) {
    fila = { ativas: 0, esperando: [] };
    filas.set(host, fila);
  }
  if (fila.ativas >= limite) await new Promise<void>((liberar) => fila.esperando.push(liberar));
  fila.ativas++;
  try {
    return await tarefa();
  } finally {
    fila.ativas--;
    fila.esperando.shift()?.();
  }
}

function segundosDeEspera(valor: string | null): number {
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 3600);
  const data = valor ? Date.parse(valor) : NaN;
  if (Number.isFinite(data)) return Math.min(Math.max(1, Math.ceil((data - Date.now()) / 1000)), 3600);
  return PAUSA_PADRAO_SEGUNDOS;
}

function dataExpiracao(corpo: unknown): string | null {
  const eventos = (corpo as { events?: { eventAction?: string; eventDate?: string }[] } | null)?.events;
  const evento = Array.isArray(eventos) ? eventos.find((e) => e?.eventAction === "expiration") : undefined;
  if (!evento?.eventDate || Number.isNaN(Date.parse(evento.eventDate))) return null;
  return new Date(evento.eventDate).toISOString();
}

async function consultarRdap(
  dominio: string,
  extensao: Extensao,
): Promise<{ situacao: SituacaoDominio; expiraEm: string | null }> {
  const base = await servidorDe(extensao);
  const host = new URL(base).host;
  if ((pausas.get(host) ?? 0) > Date.now()) return { situacao: "limite", expiraEm: null };

  return naFila(host, async () => {
    // Pode ter entrado em pausa enquanto esperava na fila.
    if ((pausas.get(host) ?? 0) > Date.now()) return { situacao: "limite" as const, expiraEm: null };
    try {
      const res = await fetch(`${base}domain/${encodeURIComponent(dominio)}`, {
        headers: CABECALHOS,
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (res.status === 404) return { situacao: "disponivel" as const, expiraEm: null };
      if (res.status === 429) {
        pausas.set(host, Date.now() + segundosDeEspera(res.headers.get("retry-after")) * 1000);
        console.error(`[dominios/rdap] ${host} pediu pausa (429).`);
        return { situacao: "limite" as const, expiraEm: null };
      }
      if (res.ok) {
        const corpo = await res.json().catch(() => null);
        return { situacao: "ocupado" as const, expiraEm: dataExpiracao(corpo) };
      }
      console.error(`[dominios/rdap] ${host} respondeu ${res.status} para ${dominio}.`);
      return { situacao: "erro" as const, expiraEm: null };
    } catch (e) {
      console.error(`[dominios/rdap] Falha de rede em ${host} (${dominio}):`, e instanceof Error ? e.message : e);
      return { situacao: "erro" as const, expiraEm: null };
    }
  });
}

// Banco (dominios_cache, só o servidor lê e grava) ------------------------

type LinhaCache = { dominio: string; situacao: "disponivel" | "ocupado"; expira_em: string | null; consultado_em: string };

async function lerCacheBanco(dominios: string[]): Promise<Map<string, Guardado>> {
  const mapa = new Map<string, Guardado>();
  const admin = createAdminClient();
  if (!admin || !dominios.length) return mapa;
  const desde = new Date(Date.now() - CACHE_MINUTOS * 60_000).toISOString();
  const { data, error } = await admin
    .from("dominios_cache")
    .select("dominio, situacao, expira_em, consultado_em")
    .in("dominio", dominios)
    .gt("consultado_em", desde)
    .returns<LinhaCache[]>();
  if (error) {
    console.error("[dominios/rdap] Cache do banco indisponível:", error.code, error.message);
    return mapa;
  }
  for (const l of data ?? []) {
    mapa.set(l.dominio, {
      situacao: l.situacao,
      expiraEm: l.expira_em,
      ate: Date.parse(l.consultado_em) + CACHE_MINUTOS * 60_000,
    });
  }
  return mapa;
}

async function gravarCacheBanco(itens: { dominio: string; situacao: string; expira_em: string | null }[]) {
  const admin = createAdminClient();
  if (!admin || !itens.length) return;
  const { error } = await admin.rpc("dominios_cache_gravar", { p_itens: itens });
  if (error) console.error("[dominios/rdap] Não gravou o cache:", error.code, error.message);
}

// Consulta vários domínios de uma vez (ex.: "padaria.com.br", ...).
// Só "disponivel" e "ocupado" ficam guardados; erro e limite não, para
// a próxima busca tentar de novo.
export async function consultarDominios(
  pedidos: { nome: string; extensao: Extensao }[],
): Promise<ResultadoDominio[]> {
  const agora = Date.now();
  const dominios = pedidos.map((p) => `${p.nome}.${p.extensao}`);
  const faltam = dominios.filter((d) => (memoria.get(d)?.ate ?? 0) <= agora);
  const doBanco = await lerCacheBanco(faltam);
  for (const [d, g] of doBanco) memoria.set(d, g);

  const novos: { dominio: string; situacao: string; expira_em: string | null }[] = [];
  const resultados = await Promise.all(
    pedidos.map(async ({ nome, extensao }): Promise<ResultadoDominio> => {
      const dominio = `${nome}.${extensao}`;
      const guardado = memoria.get(dominio);
      if (guardado && guardado.ate > Date.now()) {
        return { extensao, dominio, situacao: guardado.situacao, expiraEm: guardado.expiraEm };
      }
      const r = await consultarRdap(dominio, extensao);
      if (r.situacao === "disponivel" || r.situacao === "ocupado") {
        memoria.set(dominio, { situacao: r.situacao, expiraEm: r.expiraEm, ate: Date.now() + CACHE_MINUTOS * 60_000 });
        novos.push({ dominio, situacao: r.situacao, expira_em: r.expiraEm });
      }
      return { extensao, dominio, ...r };
    }),
  );

  // Faxina da memória: tira o que já venceu, para não crescer sem fim.
  if (memoria.size > 5000) {
    for (const [d, g] of memoria) if (g.ate <= Date.now()) memoria.delete(d);
  }
  await gravarCacheBanco(novos);
  return resultados;
}
