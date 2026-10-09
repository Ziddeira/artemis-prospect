import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarErro } from "@/lib/erros/registrar";
import { MSG_FALTA_ETAPA24, faltaEtapa24, validarDadosContrato, type DadosContrato, type StatusContrato } from "./dados";
import { dataHoraBrasilia, gerarPdfAssinado, type CampoPdf } from "./pdf";

// Peças do servidor do gerador de contratos (etapa 24).

export const BUCKET_CONTRATOS = "contratos";

// Assinatura em PNG: até 400 KB e até 2000 px de lado.
const PNG_MAX_BYTES = 400 * 1024;
const PNG_ASSINATURA = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

export function erro(mensagem: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ erro: mensagem, ...extra }, { status });
}

// Erro de uma função SQL do contrato (plano, dono, situação).
export function respostaErroBanco(error: { code?: string; message: string }, contexto: string) {
  if (faltaEtapa24(error.code)) {
    console.error(`[contratos/${contexto}]`, error.code, error.message);
    return erro(MSG_FALTA_ETAPA24, 503);
  }
  if (error.code === "AP402") return erro(error.message, 402, { precisaPlano: true });
  if (error.code === "P0001") return erro(error.message.replace(/^ERROR:\s*/i, ""), 400);
  console.error(`[contratos/${contexto}]`, error.code, error.message);
  return erro("Não foi possível falar com o banco agora. Tente de novo.", 500);
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

// Código aleatório para nomes de arquivo (minúsculas e números).
export function codigoArquivo() {
  return randomBytes(12).toString("hex");
}

// Código do link público: 256 bits aleatórios, impossível de adivinhar.
export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

// IP de quem fez o pedido. Na Vercel, o primeiro endereço de
// x-forwarded-for é o do visitante (a própria Vercel preenche).
export function ipDoPedido(request: Request) {
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (encaminhado || request.headers.get("x-real-ip") || "não informado").slice(0, 64);
}

export function navegadorDoPedido(request: Request) {
  return (request.headers.get("user-agent") || "não informado").slice(0, 300);
}

// Confere a imagem da assinatura enviada pela tela: PNG de verdade (pela
// assinatura do arquivo), tamanho e dimensões razoáveis.
export function lerPngAssinatura(valor: unknown): Uint8Array | null {
  if (typeof valor !== "string" || valor.length > PNG_MAX_BYTES * 1.4) return null;
  const m = PNG_ASSINATURA.exec(valor);
  if (!m) return null;
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  if (bytes.length < 100 || bytes.length > PNG_MAX_BYTES) return null;
  const assinaturaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!assinaturaPng.every((b, i) => bytes[i] === b)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const largura = v.getUint32(16);
  const altura = v.getUint32(20);
  if (largura < 10 || altura < 10 || largura > 2000 || altura > 2000) return null;
  return bytes;
}

export async function baixarArquivo(cliente: SupabaseClient, caminho: string): Promise<Uint8Array | null> {
  const { data, error } = await cliente.storage.from(BUCKET_CONTRATOS).download(caminho);
  if (error || !data) {
    console.error("[contratos] download:", caminho, error?.message);
    return null;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function enviarArquivo(admin: SupabaseClient, caminho: string, bytes: Uint8Array, tipo: "application/pdf" | "image/png") {
  const { error } = await admin.storage
    .from(BUCKET_CONTRATOS)
    .upload(caminho, new Blob([bytes as BlobPart], { type: tipo }), { contentType: tipo, upsert: false });
  if (error) throw new Error(`upload ${caminho}: ${error.message}`);
}

// Apaga todos os arquivos de um contrato (pasta "<usuário>/<contrato>/").
// Devolve false se algo não pôde ser apagado.
export async function apagarArquivosContrato(admin: SupabaseClient, userId: string, contratoId: string) {
  const pasta = `${userId}/${contratoId}`;
  for (let rodada = 0; rodada < 5; rodada++) {
    const { data, error } = await admin.storage.from(BUCKET_CONTRATOS).list(pasta, { limit: 100 });
    if (error) {
      console.error("[contratos] listar arquivos:", error.message);
      return false;
    }
    if (!data?.length) return true;
    const { error: erroRemover } = await admin.storage.from(BUCKET_CONTRATOS).remove(data.map((a) => `${pasta}/${a.name}`));
    if (erroRemover) {
      console.error("[contratos] apagar arquivos:", erroRemover.message);
      return false;
    }
  }
  return true;
}

export function respostaPdf(bytes: Uint8Array, nome: string, inline = false) {
  return new NextResponse(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nome}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

// "contrato-2026-0001.pdf"
export function nomePdf(numero: string, sufixo = "") {
  return `contrato-${numero.replace(/[^0-9A-Za-z]+/g, "-")}${sufixo}.pdf`;
}

// Linha completa da tabela "contratos".
export interface LinhaContrato {
  id: string;
  user_id: string;
  place_id: string;
  numero: string;
  titulo: string;
  modo: "padrao" | "questionario";
  dados: unknown;
  status: StatusContrato;
  conteudo: unknown;
  pdf_original_path: string | null;
  pdf_original_hash: string | null;
  campo_cliente: CampoPdf | null;
  token: string | null;
  link_expira_em: string | null;
  avisos_aceitos_em: string | null;
  enviado_em: string | null;
  prestador_nome: string | null;
  prestador_email: string | null;
  prestador_ip: string | null;
  prestador_navegador: string | null;
  prestador_assinou_em: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_ip: string | null;
  cliente_navegador: string | null;
  cliente_assinou_em: string | null;
  cliente_assinatura_path: string | null;
  pdf_assinado_path: string | null;
  pdf_assinado_hash: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function dadosDaLinha(linha: Pick<LinhaContrato, "dados">): DadosContrato | null {
  const r = validarDadosContrato(linha.dados);
  return "dados" in r ? r.dados : null;
}

// PDF final assinado. Se ainda não existe (a gravação falhou logo depois
// da assinatura), monta agora a partir do original e dos dados gravados,
// e guarda. Confere o hash do original antes: se o arquivo mudou, recusa.
export async function garantirPdfAssinado(admin: SupabaseClient, c: LinhaContrato): Promise<Uint8Array | null> {
  if (c.status !== "assinado") return null;
  if (c.pdf_assinado_path) {
    const pronto = await baixarArquivo(admin, c.pdf_assinado_path);
    if (pronto) return pronto;
  }
  if (!c.pdf_original_path || !c.pdf_original_hash || !c.campo_cliente || !c.cliente_assinatura_path) return null;

  const original = await baixarArquivo(admin, c.pdf_original_path);
  const assinatura = await baixarArquivo(admin, c.cliente_assinatura_path);
  if (!original || !assinatura) return null;
  if (sha256(original) !== c.pdf_original_hash) {
    await registrarErro("contratos", "PDF original não confere com o hash gravado.", { contrato: c.id }, c.user_id);
    return null;
  }

  const bytes = await gerarPdfAssinado(original, c.campo_cliente, assinatura, {
    numero: c.numero,
    titulo: c.titulo,
    id: c.id,
    hashOriginal: c.pdf_original_hash,
    enviadoEm: c.enviado_em ?? c.prestador_assinou_em ?? c.criado_em,
    partes: [
      {
        papel: "CONTRATADA (prestador do serviço)",
        observacao: "Assinou ao gerar o link de assinatura; a assinatura já consta do PDF original.",
        nome: c.prestador_nome ?? "",
        email: c.prestador_email ?? "",
        quando: c.prestador_assinou_em ?? c.enviado_em ?? c.criado_em,
        ip: c.prestador_ip ?? "",
        navegador: c.prestador_navegador ?? "",
      },
      {
        papel: "CONTRATANTE (cliente)",
        observacao: "Assinou pelo link público, sem conta no Ártemis Prospect.",
        nome: c.cliente_nome ?? "",
        email: c.cliente_email ?? "",
        quando: c.cliente_assinou_em ?? new Date().toISOString(),
        ip: c.cliente_ip ?? "",
        navegador: c.cliente_navegador ?? "",
      },
    ],
  });

  try {
    const caminho = `${c.user_id}/${c.id}/assinado-${codigoArquivo()}.pdf`;
    await enviarArquivo(admin, caminho, bytes, "application/pdf");
    const { error } = await admin.rpc("registrar_pdf_assinado", { p_id: c.id, p_path: caminho, p_hash: sha256(bytes) });
    if (error) throw new Error(`registrar_pdf_assinado: ${error.message}`);
  } catch (e) {
    // O PDF sai do mesmo jeito; na próxima vez tenta guardar de novo.
    await registrarErro("contratos", `Falha ao guardar o PDF assinado: ${e instanceof Error ? e.message : e}`, { contrato: c.id }, c.user_id);
  }
  return bytes;
}

export { dataHoraBrasilia };
