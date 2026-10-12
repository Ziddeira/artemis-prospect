// Exportar a carteira (Meus leads) em CSV e em Excel (.xlsx), sem
// biblioteca: o .xlsx é um .zip de arquivos XML (lib/sites/zip.ts).
//
// Política da Google Maps Platform: nome, telefone, endereço, site, nota
// e qualquer outro dado que veio do Google NÃO entram no arquivo. Os
// Termos proíbem exportar ou "copiar e salvar nomes de empresas,
// endereços" fora do serviço, e o arquivo baixado sai do nosso controle
// (não dá para apagar depois de 30 dias, como fazemos com o cache). Só
// entram o place_id (o Google permite guardar sem prazo), um link do
// Google Maps montado com ele e os dados que o próprio usuário criou:
// situação, anotações, datas, retorno e vendas.
import { montarZip } from "@/lib/sites/zip";
import { ROTULO_FUNIL, ROTULO_STATUS_VENDA, situacaoFunilValida, type StatusVenda } from "./funil";

export interface LeadExportacao {
  place_id: string;
  desbloqueado_em: string;
  situacao: string | null;
  anotacao: string | null;
  ultimo_contato_em: string | null;
  retorno_em: string | null;
  retorno_obs: string | null;
}

export interface VendaExportacao {
  place_id: string;
  site_url: string;
  fechado_em: string;
  valor: number | string | null;
  status: string;
  pontos: number | null;
}

type Celula =
  | { tipo: "texto"; v: string }
  | { tipo: "numero"; v: number; moeda?: boolean }
  | { tipo: "data"; v: string; hora: boolean }
  | null;

const COLUNAS: { titulo: string; largura: number }[] = [
  { titulo: "Código do lugar no Google (place_id)", largura: 30 },
  { titulo: "Abrir no Google Maps", largura: 45 },
  { titulo: "Situação", largura: 15 },
  { titulo: "Anotações", largura: 50 },
  { titulo: "Desbloqueado em", largura: 17 },
  { titulo: "Último contato", largura: 17 },
  { titulo: "Retorno agendado", largura: 17 },
  { titulo: "Observação do retorno", largura: 30 },
  { titulo: "Site entregue", largura: 32 },
  { titulo: "Fechado em", largura: 12 },
  { titulo: "Valor recebido (R$)", largura: 16 },
  { titulo: "Situação da venda", largura: 24 },
  { titulo: "Pontos", largura: 8 },
];

// Link oficial do Google Maps para um place_id (Maps URLs).
export function linkMaps(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`;
}

const texto = (v: string | null | undefined): Celula => (v ? { tipo: "texto", v } : null);

function montarLinhas(leads: LeadExportacao[], vendas: VendaExportacao[]): Celula[][] {
  const vendaPorLead = new Map(vendas.map((v) => [v.place_id, v]));
  return leads.map((l) => {
    const venda = vendaPorLead.get(l.place_id);
    const situacao = situacaoFunilValida(l.situacao) ? ROTULO_FUNIL[l.situacao] : ROTULO_FUNIL.desbloqueado;
    const valor = venda?.valor == null || venda.valor === "" ? null : Number(venda.valor);
    return [
      texto(l.place_id),
      texto(linkMaps(l.place_id)),
      texto(situacao),
      texto(l.anotacao),
      { tipo: "data", v: l.desbloqueado_em, hora: true },
      l.ultimo_contato_em ? { tipo: "data", v: l.ultimo_contato_em, hora: true } : null,
      l.retorno_em ? { tipo: "data", v: l.retorno_em, hora: true } : null,
      texto(l.retorno_obs),
      texto(venda?.site_url),
      venda?.fechado_em ? { tipo: "data", v: venda.fechado_em, hora: false } : null,
      valor != null && Number.isFinite(valor) ? { tipo: "numero", v: valor, moeda: true } : null,
      venda ? texto(ROTULO_STATUS_VENDA[venda.status as StatusVenda] ?? venda.status) : null,
      venda?.pontos != null ? { tipo: "numero", v: venda.pontos } : null,
    ];
  });
}

// Data e hora no relógio de Brasília. "2026-09-15" (só data) fica como está.
function partesBrasilia(valor: string, hora: boolean) {
  if (!hora && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split("-").map(Number);
    return { a, m, d, h: 0, min: 0 };
  }
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(valor))
      .map((p) => [p.type, p.value]),
  );
  return { a: Number(partes.year), m: Number(partes.month), d: Number(partes.day), h: Number(partes.hour), min: Number(partes.minute) };
}

const dois = (n: number) => String(n).padStart(2, "0");

// CSV ------------------------------------------------------------------------
// Separador ";" e BOM UTF-8: é o que o Excel em português abre direto,
// com acentos certos. Texto que começa com = + - @ ganha um apóstrofo na
// frente, para a planilha não executar como fórmula.
function celulaCsv(c: Celula): string {
  if (!c) return "";
  let s: string;
  if (c.tipo === "numero") {
    s = c.moeda ? c.v.toFixed(2).replace(".", ",") : String(c.v);
  } else if (c.tipo === "data") {
    const p = partesBrasilia(c.v, c.hora);
    s = `${dois(p.d)}/${dois(p.m)}/${p.a}${c.hora ? ` ${dois(p.h)}:${dois(p.min)}` : ""}`;
  } else {
    s = /^[=+\-@\t\r]/.test(c.v) ? `'${c.v}` : c.v;
  }
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsv(leads: LeadExportacao[], vendas: VendaExportacao[]): string {
  const linhas = [
    COLUNAS.map((c) => celulaCsv({ tipo: "texto", v: c.titulo })).join(";"),
    ...montarLinhas(leads, vendas).map((l) => l.map(celulaCsv).join(";")),
  ];
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

// Excel (.xlsx) ----------------------------------------------------------------
const INVALIDO_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xml(s: string) {
  return s
    .replace(INVALIDO_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letraColuna(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Excel conta os dias desde 30/12/1899.
function serialExcel(valor: string, hora: boolean) {
  const p = partesBrasilia(valor, hora);
  return Date.UTC(p.a, p.m - 1, p.d, p.h, p.min) / 86_400_000 + 25_569;
}

// Estilos (styles.xml): 1 = cabeçalho em negrito, 2 = data e hora,
// 3 = só data, 4 = valor em reais.
function celulaXlsx(c: Celula, ref: string): string {
  if (!c) return "";
  if (c.tipo === "numero") return `<c r="${ref}"${c.moeda ? ' s="4"' : ""}><v>${c.v}</v></c>`;
  if (c.tipo === "data") return `<c r="${ref}" s="${c.hora ? 2 : 3}"><v>${serialExcel(c.v, c.hora)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(c.v.slice(0, 32_000))}</t></is></c>`;
}

export function gerarXlsx(leads: LeadExportacao[], vendas: VendaExportacao[]): Uint8Array {
  const corpo = montarLinhas(leads, vendas);
  const ultima = letraColuna(COLUNAS.length - 1);
  const total = corpo.length + 1;

  const cabecalho = `<row r="1">${COLUNAS.map(
    (c, i) => `<c r="${letraColuna(i)}1" t="inlineStr" s="1"><is><t>${xml(c.titulo)}</t></is></c>`,
  ).join("")}</row>`;
  const linhas = corpo
    .map((l, i) => `<row r="${i + 2}">${l.map((c, j) => celulaXlsx(c, `${letraColuna(j)}${i + 2}`)).join("")}</row>`)
    .join("");

  const planilha =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${COLUNAS.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${cabecalho}${linhas}</sheetData>` +
    `<autoFilter ref="A1:${ultima}${total}"/>` +
    "</worksheet>";

  const livro =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Meus leads" sheetId="1" r:id="rId1"/></sheets>' +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Meus leads'!$A$1:$${ultima}$${total}</definedName></definedNames>` +
    "</workbook>";

  const estilos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  return montarZip([
    {
      caminho: "[Content_Types].xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    },
    {
      caminho: "_rels/.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    { caminho: "xl/workbook.xml", conteudo: livro },
    {
      caminho: "xl/_rels/workbook.xml.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    },
    { caminho: "xl/worksheets/sheet1.xml", conteudo: planilha },
    { caminho: "xl/styles.xml", conteudo: estilos },
  ]);
}
