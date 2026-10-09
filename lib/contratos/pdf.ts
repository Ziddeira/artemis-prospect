import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentoContrato } from "./texto";

// Monta o PDF do contrato (A4) com a biblioteca pdf-lib, só com as fontes
// padrão do PDF (Helvetica e Courier), que já vêm em qualquer leitor.
// Elas cobrem o português (acentos, ç, ª, º); qualquer caractere fora
// delas (emoji, por exemplo) vira "?" em vez de quebrar a geração.

const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM_X = 56;
const MARGEM_TOPO = 60;
const MARGEM_BASE = 64;
const UTIL = LARGURA - 2 * MARGEM_X;

const COR_TEXTO = rgb(0.1, 0.1, 0.1);
const COR_APOIO = rgb(0.38, 0.38, 0.38);
const COR_LINHA = rgb(0.55, 0.55, 0.55);

// Onde fica o espaço da assinatura do cliente no PDF (para desenhar a
// imagem depois que ele assinar, sem mexer no resto do arquivo).
export interface CampoPdf {
  pagina: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
  mono: PDFFont;
}

interface Trecho {
  texto: string;
  negrito?: boolean;
  mono?: boolean;
}

const CARACTERES = new WeakMap<PDFFont, Set<number>>();
const LARGURAS = new WeakMap<PDFFont, Map<string, number>>();

// Largura do texto como ele é desenhado. A medida da pdf-lib desconta o
// "kerning" (ajuste entre pares de letras, como "TA"), mas o desenho não
// aplica esse ajuste: medindo letra por letra, nada fica encavalado.
function largura(texto: string, fonte: PDFFont, tamanho: number) {
  let tabela = LARGURAS.get(fonte);
  if (!tabela) {
    tabela = new Map();
    LARGURAS.set(fonte, tabela);
  }
  let total = 0;
  for (const ch of texto) {
    let w = tabela.get(ch);
    if (w === undefined) {
      w = fonte.widthOfTextAtSize(ch, 1000);
      tabela.set(ch, w);
    }
    total += w;
  }
  return (total * tamanho) / 1000;
}

// Troca o que a fonte não sabe desenhar.
function limpar(texto: string, fonte: PDFFont) {
  let conjunto = CARACTERES.get(fonte);
  if (!conjunto) {
    conjunto = new Set(fonte.getCharacterSet());
    CARACTERES.set(fonte, conjunto);
  }
  let saida = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0) ?? 63;
    if (conjunto.has(cp)) saida += ch;
    else if (/\s/.test(ch)) saida += " ";
    else saida += "?";
  }
  return saida;
}

async function carregarFontes(pdf: PDFDocument): Promise<Fontes> {
  return {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
}

// Escreve texto corrido com quebra de linha e de página.
class Escritor {
  pagina!: PDFPage;
  y = 0;

  constructor(
    readonly pdf: PDFDocument,
    readonly fontes: Fontes,
  ) {
    this.novaPagina();
  }

  novaPagina() {
    this.pagina = this.pdf.addPage([LARGURA, ALTURA]);
    this.y = ALTURA - MARGEM_TOPO;
  }

  indicePagina() {
    return this.pdf.getPageCount() - 1;
  }

  // Garante espaço; se não couber, vai para a próxima página.
  garantir(altura: number) {
    if (this.y - altura < MARGEM_BASE) this.novaPagina();
  }

  espaco(pontos: number) {
    this.y -= pontos;
  }

  private fonte(t: Trecho) {
    return t.mono ? this.fontes.mono : t.negrito ? this.fontes.negrito : this.fontes.normal;
  }

  paragrafo(
    trechos: Trecho[],
    {
      tamanho = 10,
      entrelinha = 1.45,
      recuo = 0,
      alinhamento = "justificado",
      cor = COR_TEXTO,
      largura: larguraMax = UTIL - recuo,
    }: {
      tamanho?: number;
      entrelinha?: number;
      recuo?: number;
      alinhamento?: "justificado" | "esquerda" | "centro";
      cor?: ReturnType<typeof rgb>;
      largura?: number;
    } = {},
  ) {
    type Palavra = { texto: string; fonte: PDFFont; largura: number };
    const palavras: Palavra[] = [];
    for (const t of trechos) {
      const fonte = this.fonte(t);
      for (const p of limpar(t.texto, fonte).split(/\s+/).filter(Boolean)) {
        // Palavra maior que a linha (hash, link): quebra no meio.
        let resto = p;
        while (largura(resto, fonte, tamanho) > larguraMax) {
          let corte = resto.length - 1;
          while (corte > 1 && largura(resto.slice(0, corte), fonte, tamanho) > larguraMax) corte--;
          palavras.push({ texto: resto.slice(0, corte), fonte, largura: largura(resto.slice(0, corte), fonte, tamanho) });
          resto = resto.slice(corte);
        }
        palavras.push({ texto: resto, fonte, largura: largura(resto, fonte, tamanho) });
      }
    }

    const espacoNormal = largura(" ", this.fontes.normal, tamanho);
    const linhas: Palavra[][] = [];
    let atual: Palavra[] = [];
    let larguraAtual = 0;
    for (const p of palavras) {
      const extra = atual.length ? espacoNormal + p.largura : p.largura;
      if (atual.length && larguraAtual + extra > larguraMax) {
        linhas.push(atual);
        atual = [p];
        larguraAtual = p.largura;
      } else {
        atual.push(p);
        larguraAtual += extra;
      }
    }
    if (atual.length) linhas.push(atual);

    const passo = tamanho * entrelinha;
    linhas.forEach((linha, i) => {
      this.garantir(passo);
      this.y -= passo;
      const natural = linha.reduce((s, p) => s + p.largura, 0) + espacoNormal * (linha.length - 1);
      const ultima = i === linhas.length - 1;
      let x = MARGEM_X + recuo;
      let espaco = espacoNormal;
      if (alinhamento === "centro") x += (larguraMax - natural) / 2;
      else if (alinhamento === "justificado" && !ultima && linha.length > 1) {
        espaco = espacoNormal + (larguraMax - natural) / (linha.length - 1);
      }
      for (const p of linha) {
        this.pagina.drawText(p.texto, { x, y: this.y, size: tamanho, font: p.fonte, color: cor });
        x += p.largura + espaco;
      }
    });
  }

  linhaHorizontal() {
    this.pagina.drawLine({
      start: { x: MARGEM_X, y: this.y },
      end: { x: LARGURA - MARGEM_X, y: this.y },
      thickness: 0.6,
      color: COR_LINHA,
    });
  }
}

function rodape(pdf: PDFDocument, fontes: Fontes, texto: (i: number, total: number) => string, inicio = 0, total?: number) {
  const paginas = pdf.getPages();
  const n = total ?? paginas.length;
  paginas.slice(inicio).forEach((p, j) => {
    const t = limpar(texto(inicio + j, n), fontes.normal);
    const w = largura(t, fontes.normal, 8);
    p.drawText(t, { x: (LARGURA - w) / 2, y: 30, size: 8, font: fontes.normal, color: COR_APOIO });
  });
}

function marcaRascunho(pdf: PDFDocument, fontes: Fontes) {
  for (const p of pdf.getPages()) {
    p.drawText("RASCUNHO", {
      x: 150,
      y: 250,
      size: 96,
      font: fontes.negrito,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.25,
      rotate: degrees(45),
    });
  }
}

// Desenha uma imagem de assinatura dentro do espaço, centralizada e
// apoiada na linha.
async function desenharAssinatura(pdf: PDFDocument, png: Uint8Array, campo: CampoPdf) {
  const imagem = await pdf.embedPng(png);
  const { width, height } = imagem.scaleToFit(campo.largura, campo.altura);
  pdf.getPage(campo.pagina).drawImage(imagem, {
    x: campo.x + (campo.largura - width) / 2,
    y: campo.y,
    width,
    height,
  });
}

export interface OpcoesPdf {
  rascunho?: boolean;
  // PNG da assinatura do prestador (desenhada no campo dele, no envio).
  assinaturaContratada?: Uint8Array | null;
  autor?: string;
}

export async function gerarPdfContrato(
  doc: DocumentoContrato,
  opcoes: OpcoesPdf = {},
): Promise<{ bytes: Uint8Array; campoCliente: CampoPdf }> {
  const pdf = await PDFDocument.create();
  const fontes = await carregarFontes(pdf);
  const e = new Escritor(pdf, fontes);

  e.paragrafo([{ texto: doc.titulo, negrito: true }], { tamanho: 12.5, alinhamento: "centro", entrelinha: 1.35 });
  e.paragrafo([{ texto: `Contrato nº ${doc.numero}` }], { tamanho: 9, alinhamento: "centro", cor: COR_APOIO });
  e.espaco(14);

  for (const parte of doc.partes) {
    e.paragrafo([{ texto: `${parte.rotulo}: `, negrito: true }, { texto: parte.texto }]);
    e.espaco(6);
  }
  e.paragrafo([{ texto: doc.preambulo }]);
  e.espaco(8);

  doc.clausulas.forEach((c, i) => {
    // O título não fica sozinho no pé da página.
    e.garantir(48);
    e.espaco(6);
    e.paragrafo([{ texto: c.titulo, negrito: true }], { tamanho: 10.5, alinhamento: "esquerda" });
    e.espaco(2);
    c.itens.forEach((item, j) => {
      e.paragrafo([{ texto: `${i + 1}.${j + 1}. `, negrito: true }, { texto: item.texto }]);
      for (const s of item.sub ?? []) e.paragrafo([{ texto: s }], { recuo: 18 });
      e.espaco(3);
    });
  });

  e.espaco(10);
  e.paragrafo([{ texto: doc.fecho }]);
  e.espaco(6);
  e.paragrafo([{ texto: doc.localData }], { alinhamento: "esquerda" });

  // Assinaturas: lado a lado, sempre juntas na mesma página.
  e.garantir(170);
  e.espaco(30);
  const alturaImagem = 58;
  const colunas = 2;
  const vao = 28;
  const larguraCol = (UTIL - vao * (colunas - 1)) / colunas;
  const yLinha = e.y - alturaImagem - 4;
  const campos: CampoPdf[] = [];
  const pagina = e.pagina;
  [doc.assinaturas.contratante, doc.assinaturas.contratada].forEach((a, i) => {
    const x = MARGEM_X + i * (larguraCol + vao);
    campos.push({ pagina: e.indicePagina(), x: x + 6, y: yLinha + 3, largura: larguraCol - 12, altura: alturaImagem - 2 });
    pagina.drawLine({ start: { x, y: yLinha }, end: { x: x + larguraCol, y: yLinha }, thickness: 0.8, color: COR_TEXTO });
    let y = yLinha - 13;
    const linhas: { t: string; f: PDFFont; s: number; c: ReturnType<typeof rgb> }[] = [
      { t: a.nome, f: fontes.negrito, s: 9.5, c: COR_TEXTO },
      { t: a.detalhe, f: fontes.normal, s: 8.5, c: COR_APOIO },
      { t: a.papel, f: fontes.negrito, s: 8, c: COR_APOIO },
    ];
    for (const l of linhas) {
      if (!l.t) continue;
      let t = limpar(l.t, l.f);
      while (t.length > 3 && largura(t, l.f, l.s) > larguraCol) t = `${t.slice(0, -4)}...`;
      pagina.drawText(t, { x, y, size: l.s, font: l.f, color: l.c });
      y -= l.s * 1.5;
    }
  });
  e.y = yLinha - 60;

  if (opcoes.assinaturaContratada) await desenharAssinatura(pdf, opcoes.assinaturaContratada, campos[1]);
  if (opcoes.rascunho) marcaRascunho(pdf, fontes);
  rodape(pdf, fontes, (i, n) => `Contrato nº ${doc.numero} · Página ${i + 1} de ${n}`);

  pdf.setTitle(`Contrato nº ${doc.numero}`);
  pdf.setSubject(doc.titulo);
  if (opcoes.autor) pdf.setAuthor(opcoes.autor);
  pdf.setLanguage("pt-BR");
  pdf.setCreator("Ártemis Prospect");
  pdf.setProducer("Ártemis Prospect");

  return { bytes: await pdf.save(), campoCliente: campos[0] };
}

// Página final "Registro de assinatura" -------------------------------------

export interface ParteRegistro {
  papel: string;
  nome: string;
  email: string;
  quando: string;
  ip: string;
  navegador: string;
  observacao?: string;
}

export interface RegistroAssinatura {
  numero: string;
  titulo: string;
  id: string;
  hashOriginal: string;
  enviadoEm: string;
  partes: ParteRegistro[];
}

export function dataHoraBrasilia(iso: string) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
  return `${data} às ${hora} (horário de Brasília)`;
}

// Junta ao PDF original a assinatura do cliente (no campo dele) e a
// página de registro. O PDF original não muda: é dele o hash registrado.
export async function gerarPdfAssinado(
  original: Uint8Array,
  campoCliente: CampoPdf,
  assinaturaCliente: Uint8Array,
  registro: RegistroAssinatura,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  const totalContrato = pdf.getPageCount();
  const fontes = await carregarFontes(pdf);
  await desenharAssinatura(pdf, assinaturaCliente, campoCliente);

  const e = new Escritor(pdf, fontes);
  const inicioRegistro = e.indicePagina();
  e.paragrafo([{ texto: "REGISTRO DE ASSINATURA ELETRÔNICA", negrito: true }], { tamanho: 13, alinhamento: "esquerda" });
  e.paragrafo([{ texto: `Contrato nº ${registro.numero} – ${registro.titulo}` }], { tamanho: 9.5, alinhamento: "esquerda", cor: COR_APOIO });
  e.espaco(10);
  e.linhaHorizontal();
  e.espaco(4);

  const campo = (rotulo: string, valor: string, mono = false) =>
    e.paragrafo([{ texto: `${rotulo}: `, negrito: true }, { texto: valor || "—", mono }], {
      tamanho: 9.5,
      alinhamento: "esquerda",
    });

  e.paragrafo([{ texto: "DOCUMENTO", negrito: true }], { tamanho: 10.5, alinhamento: "esquerda" });
  campo("Identificador", registro.id, true);
  campo("Páginas do contrato", String(totalContrato));
  campo("Enviado para assinatura em", dataHoraBrasilia(registro.enviadoEm));
  campo("Hash SHA-256 do PDF original", registro.hashOriginal, true);
  e.paragrafo(
    [
      {
        texto:
          "O hash é a impressão digital do PDF enviado para assinatura (as páginas do contrato, antes da assinatura do contratante e sem esta página de registro). Qualquer mudança no arquivo, por menor que seja, gera um hash diferente.",
      },
    ],
    { tamanho: 8.5, alinhamento: "esquerda", cor: COR_APOIO },
  );

  for (const p of registro.partes) {
    e.garantir(110);
    e.espaco(10);
    e.linhaHorizontal();
    e.espaco(4);
    e.paragrafo([{ texto: p.papel, negrito: true }], { tamanho: 10.5, alinhamento: "esquerda" });
    if (p.observacao) e.paragrafo([{ texto: p.observacao }], { tamanho: 8.5, alinhamento: "esquerda", cor: COR_APOIO });
    campo("Nome informado", p.nome);
    campo("E-mail informado", p.email);
    campo("Data e hora", `${dataHoraBrasilia(p.quando)} – ${new Date(p.quando).toISOString()} (UTC)`);
    campo("Endereço IP", p.ip, true);
    campo("Navegador", p.navegador);
  }

  e.garantir(80);
  e.espaco(12);
  e.linhaHorizontal();
  e.espaco(4);
  e.paragrafo(
    [
      {
        texto:
          "Assinatura eletrônica simples, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, aceita pelas partes no próprio contrato. Nome e e-mail foram informados por quem assinou; data, hora e endereço IP foram registrados pelo servidor no momento da assinatura. Para conferir a integridade, calcule o SHA-256 do PDF original (disponível no link de assinatura) e compare com o código acima.",
      },
    ],
    { tamanho: 8.5, cor: COR_APOIO },
  );

  rodape(pdf, fontes, () => `Registro de assinatura · Contrato nº ${registro.numero}`, inicioRegistro);
  pdf.setModificationDate(new Date());
  return pdf.save();
}
