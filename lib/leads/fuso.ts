// Hora local da empresa, para o usuário não ligar de madrugada.
//
// O Google manda, na busca, só a diferença do horário da empresa para o
// UTC naquele momento (utcOffsetMinutes). Isso muda no horário de verão,
// e a busca fica salva por até 30 dias, então o lead guarda o nome do
// fuso (ex.: "America/Chicago"), que o navegador sabe converter em
// qualquer data. O fuso vem do estado/província do endereço; se o
// estado tem mais de um fuso (Texas, Flórida...), a diferença que o
// Google mandou escolhe o certo.
import type { AddressComponent } from "./classificacao";
import type { ConfigPais } from "./paises";

export const FUSO_BRASILIA = "America/Sao_Paulo";

// Diferença do fuso para o UTC, em minutos, no instante "data".
export function diferencaUtcMinutos(fuso: string, data = new Date()): number | null {
  try {
    const parte = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "longOffset" })
      .formatToParts(data)
      .find((p) => p.type === "timeZoneName")?.value;
    // "GMT-05:00", "GMT+05:30" ou só "GMT" (diferença zero).
    const m = parte?.match(/GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    if (!m[1]) return 0;
    const minutos = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return m[1] === "-" ? -minutos : minutos;
  } catch {
    return null;
  }
}

export function codigoEstado(componentes?: AddressComponent[]): string | null {
  const estado = componentes?.find((c) => c.types?.includes("administrative_area_level_1"));
  return estado?.shortText?.toUpperCase() || null;
}

export function codigoPaisDoEndereco(componentes?: AddressComponent[]): string | null {
  const pais = componentes?.find((c) => c.types?.includes("country"));
  return pais?.shortText?.toUpperCase() || null;
}

// Nome do fuso da empresa, ou null se não der para saber (o país não
// mostra hora local, ou nada bateu).
export function escolherFuso(
  pais: ConfigPais,
  estado: string | null,
  diferencaGoogle: number | null | undefined,
  agora = new Date(),
): string | null {
  if (!pais.fusos.length) return null;
  const doEstado = estado ? pais.fusoPorEstado[estado] : undefined;
  if (diferencaGoogle === null || diferencaGoogle === undefined) return doEstado ?? null;
  if (doEstado && diferencaUtcMinutos(doEstado, agora) === diferencaGoogle) return doEstado;
  return pais.fusos.find((f) => diferencaUtcMinutos(f, agora) === diferencaGoogle) ?? doEstado ?? null;
}

export type PeriodoLigacao = "comercial" | "limite" | "evitar";

export interface HoraNoFuso {
  // "14:05"
  hora: string;
  periodo: PeriodoLigacao;
  // Diferença para Brasília em minutos (negativo = atrás de Brasília).
  diferencaBrasilia: number | null;
}

export function horaNoFuso(fuso: string, agora = new Date()): HoraNoFuso | null {
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(agora);
    const h = Number(partes.find((p) => p.type === "hour")?.value ?? NaN);
    const min = partes.find((p) => p.type === "minute")?.value ?? "00";
    if (Number.isNaN(h)) return null;
    const periodo: PeriodoLigacao = h >= 9 && h < 18 ? "comercial" : h >= 8 && h < 20 ? "limite" : "evitar";
    const deles = diferencaUtcMinutos(fuso, agora);
    const nossa = diferencaUtcMinutos(FUSO_BRASILIA, agora);
    return {
      hora: `${String(h).padStart(2, "0")}:${min}`,
      periodo,
      diferencaBrasilia: deles === null || nossa === null ? null : deles - nossa,
    };
  } catch {
    return null;
  }
}

// "3h a menos que Brasília", "1h30 a mais que Brasília", "mesmo horário de Brasília".
export function textoDiferencaBrasilia(minutos: number): string {
  if (minutos === 0) return "mesmo horário de Brasília";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const quanto = m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  return `${quanto} a ${minutos < 0 ? "menos" : "mais"} que Brasília`;
}
