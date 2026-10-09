import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pendencias } from "@/lib/contratos/dados";
import { montarContrato } from "@/lib/contratos/texto";
import { gerarPdfContrato } from "@/lib/contratos/pdf";
import {
  BUCKET_CONTRATOS,
  UUID,
  baixarArquivo,
  codigoArquivo,
  dadosDaLinha,
  enviarArquivo,
  erro,
  gerarToken,
  ipDoPedido,
  lerPngAssinatura,
  navegadorDoPedido,
  respostaErroBanco,
  sha256,
  type LinhaContrato,
} from "@/lib/contratos/servidor";
import { registrarErro } from "@/lib/erros/registrar";

export const dynamic = "force-dynamic";

// Assinar (prestador) e gerar o link para o cliente:
//   1. confere login, aceite dos avisos, situação e pendências;
//   2. pega a assinatura (a salva no perfil ou uma nova, desenhada ou
//      enviada como imagem) e, se pedido, salva no perfil;
//   3. monta o PDF com a assinatura do prestador, guarda no Storage e
//      calcula o hash SHA-256;
//   4. o banco congela o texto, o PDF, o hash e cria o link público.
// Corpo: { assinatura: "perfil" | "data:image/png;base64,...", salvarNoPerfil, aceiteAvisos }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return erro("Contrato não encontrado.", 404);

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return erro("Supabase não configurado neste ambiente (falta SUPABASE_SERVICE_ROLE_KEY?).", 500);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erro("É preciso estar logado.", 401);

  const corpo = await request.json().catch(() => null);
  if (corpo?.aceiteAvisos !== true) {
    return erro("Confirme que leu os avisos e que é responsável pelo conteúdo do contrato.");
  }

  const { data: contrato, error: erroLeitura } = await supabase
    .from("contratos")
    .select("*")
    .eq("id", id)
    .maybeSingle<LinhaContrato>();
  if (erroLeitura) return respostaErroBanco(erroLeitura, "enviar");
  if (!contrato) return erro("Contrato não encontrado.", 404);
  if (contrato.status !== "rascunho") return erro("Este contrato já foi enviado.");

  const dados = dadosDaLinha(contrato);
  if (!dados) return erro("Os dados deste contrato estão incompletos. Abra “Editar respostas” e salve de novo.");
  const faltam = pendencias(dados);
  if (faltam.length) return erro(`Antes de enviar, preencha: ${faltam.join(", ")}.`, 400, { pendencias: faltam });

  const { data: liberado } = await supabase.rpc("meu_acesso_contratos");
  if (liberado !== true) return erro("O gerador de contratos é dos planos Solo, Pro e Platina.", 402, { precisaPlano: true });

  // Assinatura do prestador ------------------------------------------------
  let assinatura: Uint8Array | null = null;
  if (corpo?.assinatura === "perfil") {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("assinatura_path")
      .eq("id", user.id)
      .maybeSingle<{ assinatura_path: string | null }>();
    if (!perfil?.assinatura_path) return erro("Você ainda não tem assinatura salva no perfil. Desenhe ou envie uma.");
    assinatura = await baixarArquivo(admin, perfil.assinatura_path);
    if (!assinatura) return erro("Não foi possível abrir sua assinatura salva. Desenhe ou envie de novo.", 500);
  } else {
    assinatura = lerPngAssinatura(corpo?.assinatura);
    if (!assinatura) return erro("Faça sua assinatura (desenhe ou envie uma imagem) antes de enviar.");
    if (corpo?.salvarNoPerfil === true) {
      // Se falhar, o envio segue: salvar no perfil é só comodidade.
      try {
        const caminho = `${user.id}/assinatura-${codigoArquivo()}.png`;
        await enviarArquivo(admin, caminho, assinatura, "image/png");
        const { data: antiga, error } = await supabase.rpc("definir_assinatura_perfil", { p_path: caminho });
        if (error) {
          await admin.storage.from(BUCKET_CONTRATOS).remove([caminho]);
          throw new Error(error.message);
        }
        if (typeof antiga === "string" && antiga && antiga !== caminho) {
          await admin.storage.from(BUCKET_CONTRATOS).remove([antiga]);
        }
      } catch (e) {
        console.error("[contratos/enviar] salvar assinatura no perfil:", e);
      }
    }
  }

  // PDF congelado ------------------------------------------------------------
  const doc = montarContrato(dados, { numero: contrato.numero, data: new Date() });
  const nomePrestador =
    dados.prestador.tipo === "pj" ? `${dados.prestador.responsavelNome} (pela ${dados.prestador.nome})` : dados.prestador.nome;
  let caminho: string | null = null;
  try {
    const { bytes, campoCliente } = await gerarPdfContrato(doc, { assinaturaContratada: assinatura, autor: dados.prestador.nome });
    const hash = sha256(bytes);
    caminho = `${user.id}/${contrato.id}/original-${codigoArquivo()}.pdf`;
    await enviarArquivo(admin, caminho, bytes, "application/pdf");

    const token = gerarToken();
    const { error } = await admin.rpc("registrar_envio_contrato", {
      p_user_id: user.id,
      p_id: contrato.id,
      p_conteudo: doc,
      p_pdf_path: caminho,
      p_hash: hash,
      p_campo_cliente: campoCliente,
      p_token: token,
      p_nome: nomePrestador,
      p_email: dados.prestador.email || user.email || "",
      p_ip: ipDoPedido(request),
      p_navegador: navegadorDoPedido(request),
    });
    if (error) {
      await admin.storage.from(BUCKET_CONTRATOS).remove([caminho]);
      return respostaErroBanco(error, "enviar");
    }
    return NextResponse.json({ token, hash });
  } catch (e) {
    if (caminho) await admin.storage.from(BUCKET_CONTRATOS).remove([caminho]);
    const tecnica = e instanceof Error ? e.message : String(e);
    console.error("[contratos/enviar]", e);
    await registrarErro("contratos", `Falha ao gerar o PDF para envio: ${tecnica}`, { contrato: contrato.id }, user.id);
    return erro("Não foi possível gerar o PDF agora. Tente de novo.", 500);
  }
}
