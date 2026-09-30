"use client";

import { useEffect, useRef, useState } from "react";
import { NOME_IDIOMA, linkWhatsapp, preencherModelo, type ModelosMensagem } from "@/lib/leads/mensagens";
import { configPais } from "@/lib/leads/paises";
import { BOTAO_NEUTRO, BOTAO_WHATSAPP } from "@/components/ui";
import { IconeCopiar, IconeLink, IconeMapa, IconeTelefone, IconeVisto, IconeWhatsapp } from "@/components/Icones";

// Contato de lead de fora do Brasil (aba Internacional). O Google não
// devolve e-mail, então o que dá para entregar é: telefone no formato
// internacional (com botão de ligar), o Google Maps (onde o usuário acha
// site, redes e às vezes e-mail) e a mensagem pronta no idioma do país.

// "+1 512-555-0100" -> "tel:+15125550100"
function linkTelefone(telefone: string): string {
  return `tel:${telefone.replace(/[^\d+]/g, "")}`;
}

export function BotoesContatoInternacional({
  pais,
  telefone,
  whatsapp,
  maps,
  site,
  mensagemWhatsapp,
}: {
  pais: string | null | undefined;
  telefone: string | null;
  whatsapp: string | null;
  maps: string | null;
  site: string | null;
  // Texto do botão de WhatsApp, nos países em que ele aparece.
  mensagemWhatsapp: string;
}) {
  const config = configPais(pais);
  return (
    <>
      {telefone ? (
        <a href={linkTelefone(telefone)} className={BOTAO_WHATSAPP} title={`Ligar para ${telefone}`}>
          <IconeTelefone width={16} height={16} />
          <span>
            Ligar <span className="font-sans normal-case tracking-normal">{telefone}</span>
          </span>
        </a>
      ) : (
        <span className="text-sm text-muted">Sem telefone no Google</span>
      )}
      {config.whatsapp && whatsapp && (
        <a target="_blank" rel="noopener" href={linkWhatsapp(whatsapp, mensagemWhatsapp)} className={BOTAO_NEUTRO}>
          <IconeWhatsapp width={18} height={18} />
          WhatsApp
        </a>
      )}
      {maps && (
        <a target="_blank" rel="noopener" href={maps} className={BOTAO_NEUTRO}>
          <IconeMapa width={18} height={18} />
          Abrir no Google Maps
        </a>
      )}
      {site && (
        <a target="_blank" rel="noopener" href={site} className={BOTAO_NEUTRO}>
          <IconeLink width={18} height={18} />
          Link
        </a>
      )}
    </>
  );
}

// Copia texto com um toque. Em navegador antigo (sem a API de área de
// transferência), usa o jeito clássico com um campo escondido.
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      const ok = document.execCommand("copy");
      campo.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

type Copiavel = "email" | "assunto" | "curta";

export function MensagemPronta({
  pais,
  nome,
  modelosPorIdioma,
}: {
  pais: string | null | undefined;
  nome: string;
  // Modelos do usuário (Perfil), por idioma. O do país é escolhido aqui.
  modelosPorIdioma: Partial<Record<string, ModelosMensagem>>;
}) {
  const config = configPais(pais);
  const modelos = modelosPorIdioma[config.idiomaMensagem];
  const [copiado, setCopiado] = useState<Copiavel | null>(null);
  const [erro, setErro] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copiar(qual: Copiavel) {
    if (!modelos) return;
    const texto = preencherModelo(
      qual === "email" ? modelos.emailCorpo : qual === "assunto" ? modelos.emailAssunto : modelos.curta,
      nome,
    );
    const ok = await copiarTexto(texto);
    setErro(!ok);
    setCopiado(ok ? qual : null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 2500);
  }

  const botao = (qual: Copiavel, rotulo: string) => (
    <button type="button" onClick={() => copiar(qual)} className={BOTAO_NEUTRO}>
      {copiado === qual ? <IconeVisto width={16} height={16} /> : <IconeCopiar width={16} height={16} />}
      {copiado === qual ? "Copiado!" : rotulo}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {!config.whatsapp && config.avisoContato && (
        <p className="text-xs text-muted">
          <span aria-hidden="true">{config.bandeira} </span>
          {config.avisoContato}
        </p>
      )}
      {modelos && (
        <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <span className="w-full text-xs font-semibold text-ink-2 sm:w-auto">
            Mensagem pronta em {NOME_IDIOMA[config.idiomaMensagem]}:
          </span>
          {botao("email", "Copiar e-mail")}
          {botao("assunto", "Copiar assunto")}
          {botao("curta", "Copiar mensagem curta")}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {copiado ? "Mensagem copiada." : ""}
      </p>
      {erro && (
        <p role="alert" className="text-xs text-danger">
          Não foi possível copiar. Edite e copie o texto pelo Perfil.
        </p>
      )}
    </div>
  );
}
