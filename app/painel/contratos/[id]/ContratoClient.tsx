"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ALERTA_ERRO, ALERTA_SUCESSO, BOTAO, BOTAO_NEUTRO, BOTAO_SECUNDARIO, BOTAO_WHATSAPP, CAMPO, CARTAO } from "@/components/ui";
import PadAssinatura from "@/components/contratos/PadAssinatura";
import { IconeBaixar, IconeCopiar, IconeLixeira, IconeWhatsapp } from "@/components/Icones";
import { linkWhatsapp } from "@/lib/leads/mensagens";
import type { StatusContrato } from "@/lib/contratos/dados";

export interface RegistroTela {
  nome: string;
  email: string;
  ip: string;
  quando: string;
}

export interface ContratoTela {
  id: string;
  numero: string;
  status: StatusContrato;
  link: string | null;
  linkExpiraEm: string | null;
  hashOriginal: string | null;
  hashAssinado: string | null;
  enviadoEm: string | null;
  prestador: RegistroTela | null;
  cliente: RegistroTela | null;
  pendencias: string[];
  liberado: boolean;
  temAssinaturaPerfil: boolean;
  whatsappCliente: string | null;
}

function dataHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

async function chamar(url: string, corpo?: unknown): Promise<{ ok: true; dados: Record<string, unknown> } | { ok: false; erro: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, erro: dados.erro || "Não foi possível concluir agora." };
    return { ok: true, dados };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o servidor agora." };
  }
}

export default function ContratoClient({ contrato: c }: { contrato: ContratoTela }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      {c.status === "rascunho" && <Rascunho c={c} />}
      {c.status === "enviado" && <Enviado c={c} />}
      {c.status === "assinado" && <Assinado c={c} />}
      <Apagar c={c} />
    </div>
  );
}

// Rascunho: baixar, editar e assinar/enviar ---------------------------------
function Rascunho({ c }: { c: ContratoTela }) {
  const router = useRouter();
  const [usarPerfil, setUsarPerfil] = useState(c.temAssinaturaPerfil);
  const [nova, setNova] = useState<string | null>(null);
  const [salvarNoPerfil, setSalvarNoPerfil] = useState(!c.temAssinaturaPerfil);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aoAssinar = useCallback((png: string | null) => setNova(png), []);

  const bloqueado = c.pendencias.length > 0 || !c.liberado;

  async function enviar() {
    setErro(null);
    if (!aceite) {
      setErro("Marque que leu os avisos e assume a responsabilidade pelo contrato.");
      return;
    }
    if (!usarPerfil && !nova) {
      setErro("Faça sua assinatura no quadro (ou envie uma imagem) antes de enviar.");
      return;
    }
    setEnviando(true);
    const r = await chamar(`/api/contratos/${c.id}/enviar`, {
      assinatura: usarPerfil ? "perfil" : nova,
      salvarNoPerfil: !usarPerfil && salvarNoPerfil,
      aceiteAvisos: true,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/painel/contratos/${c.id}/editar`} className={BOTAO_SECUNDARIO}>
          Editar respostas
        </Link>
        <a href={`/api/contratos/${c.id}/pdf`} className={BOTAO_NEUTRO}>
          <IconeBaixar width={18} height={18} />
          Baixar PDF (rascunho)
        </a>
      </div>

      <section aria-labelledby="titulo-enviar" className={`${CARTAO} p-5 sm:p-6`}>
        <h2 id="titulo-enviar" className="text-xl text-ink">
          Assinar e enviar ao cliente
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Você assina primeiro. O contrato vira um PDF que não muda mais (guardamos a “impressão digital” dele, o hash) e
          você recebe um link para mandar ao cliente. Ele lê e assina pelo celular ou computador, sem criar conta.
        </p>

        {c.pendencias.length > 0 ? (
          <div className={`mt-4 ${ALERTA_ERRO}`}>
            <p className="font-semibold">Para enviar, falta preencher:</p>
            <ul className="mt-1 list-disc pl-5">
              {c.pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link href={`/painel/contratos/${c.id}/editar`} className="mt-2 inline-block font-semibold underline">
              Completar agora
            </Link>
          </div>
        ) : !c.liberado ? (
          <p className={`mt-4 ${ALERTA_ERRO}`}>
            Enviar para assinatura é dos planos Solo, Pro e Platina.{" "}
            <Link href="/painel/plano" className="font-semibold underline">
              Ver planos
            </Link>
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-semibold text-campo">Sua assinatura</legend>
              {c.temAssinaturaPerfil && (
                <label className={`flex min-h-11 cursor-pointer items-center gap-3 border p-3 ${usarPerfil ? "border-destaque bg-primary-soft" : "border-line"}`}>
                  <input
                    type="radio"
                    name="tipo-assinatura"
                    checked={usarPerfil}
                    onChange={() => setUsarPerfil(true)}
                    className="accent-[var(--color-destaque)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <span className="font-semibold text-ink">Usar a assinatura salva no perfil</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/perfil/assinatura" alt="Sua assinatura salva" className="h-12 max-w-48 bg-white object-contain px-2" />
                  </span>
                </label>
              )}
              {c.temAssinaturaPerfil && (
                <label className={`flex min-h-11 cursor-pointer items-center gap-3 border p-3 ${!usarPerfil ? "border-destaque bg-primary-soft" : "border-line"}`}>
                  <input
                    type="radio"
                    name="tipo-assinatura"
                    checked={!usarPerfil}
                    onChange={() => setUsarPerfil(false)}
                    className="accent-[var(--color-destaque)]"
                  />
                  <span className="font-semibold text-ink">Assinar agora (desenhar ou enviar imagem)</span>
                </label>
              )}
            </fieldset>

            {!usarPerfil && (
              <div>
                <PadAssinatura onChange={aoAssinar} id="assinatura-prestador" />
                <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={salvarNoPerfil}
                    onChange={(e) => setSalvarNoPerfil(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-destaque)]"
                  />
                  Salvar esta assinatura no meu perfil para os próximos contratos
                </label>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 border border-line p-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-destaque)]"
              />
              <span>
                Li os avisos: este é um modelo sugerido, que não substitui a orientação de um advogado, e eu sou o
                responsável pelo conteúdo deste contrato.
              </span>
            </label>

            {erro && (
              <p role="alert" className={ALERTA_ERRO}>
                {erro}
              </p>
            )}

            <div>
              <button type="button" onClick={enviar} disabled={enviando || bloqueado} className={BOTAO}>
                {enviando ? "Gerando o PDF..." : "Assinar e gerar link"}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// Enviado: link para o cliente ----------------------------------------------
function Enviado({ c }: { c: ContratoTela }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mensagem = `Olá! Segue o contrato de criação do site (nº ${c.numero}) para você ler e assinar online, pelo celular ou computador, sem precisar criar conta: ${c.link}`;

  async function copiar() {
    if (!c.link) return;
    try {
      await navigator.clipboard.writeText(c.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não deu para copiar sozinho. Selecione o link e copie.");
    }
  }

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    const r = await chamar(`/api/contratos/${c.id}/cancelar-envio`);
    setCancelando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="titulo-link" className={`${CARTAO} p-5 sm:p-6`}>
      <h2 id="titulo-link" className="text-xl text-ink">
        Esperando a assinatura do cliente
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Mande este link para o cliente. Ele lê o contrato, assina com o dedo ou o mouse e não precisa criar conta.
        {c.linkExpiraEm && ` O link vale até ${dataHora(c.linkExpiraEm)}.`} Você recebe um aviso no sino quando ele
        assinar.
      </p>

      <label htmlFor="link-contrato" className="sr-only">
        Link para o cliente assinar
      </label>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input id="link-contrato" readOnly value={c.link ?? ""} onFocus={(e) => e.target.select()} className={`${CAMPO} font-mono text-sm`} />
        <button type="button" onClick={copiar} className={BOTAO_NEUTRO}>
          <IconeCopiar width={18} height={18} />
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={linkWhatsapp(c.whatsappCliente ?? "", mensagem)} target="_blank" rel="noopener" className={BOTAO_WHATSAPP}>
          <IconeWhatsapp width={18} height={18} />
          Enviar pelo WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Contrato nº ${c.numero} para assinatura`)}&body=${encodeURIComponent(mensagem)}`}
          className={BOTAO_NEUTRO}
        >
          Enviar por e-mail
        </a>
        <a href={`/api/contratos/${c.id}/pdf`} className={BOTAO_NEUTRO}>
          <IconeBaixar width={18} height={18} />
          Baixar PDF enviado
        </a>
      </div>

      {c.hashOriginal && <Hash rotulo="Hash SHA-256 do PDF enviado" valor={c.hashOriginal} />}
      {c.prestador && <Registro titulo="Sua assinatura" r={c.prestador} />}

      <div className="mt-6 border-t border-line pt-4">
        {confirmar ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">
              Cancelar o envio desativa o link (o cliente não consegue mais assinar) e apaga sua assinatura deste
              contrato. Ele volta a rascunho para você editar e enviar de novo.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={cancelar} disabled={cancelando} className={BOTAO_SECUNDARIO}>
                {cancelando ? "Cancelando..." : "Sim, cancelar o envio"}
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className={BOTAO_NEUTRO}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmar(true)} className={BOTAO_NEUTRO}>
            Cancelar envio e editar
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className={`mt-3 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}
    </section>
  );
}

// Assinado: PDFs e registro ------------------------------------------------------
function Assinado({ c }: { c: ContratoTela }) {
  return (
    <section aria-labelledby="titulo-assinado" className={`${CARTAO} p-5 sm:p-6`}>
      <h2 id="titulo-assinado" className="text-xl text-ink">
        Contrato assinado pelas duas partes
      </h2>
      <p className={`mt-3 ${ALERTA_SUCESSO}`}>
        O PDF assinado tem as duas assinaturas e, na última página, o registro de assinatura (data e hora, IP, nome e
        e-mail informados e o hash do documento).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`/api/contratos/${c.id}/pdf`} className={BOTAO}>
          <IconeBaixar width={18} height={18} />
          Baixar PDF assinado
        </a>
        <a href={`/api/contratos/${c.id}/pdf?versao=original`} className={BOTAO_NEUTRO}>
          Baixar PDF original (para conferir o hash)
        </a>
      </div>
      {c.hashOriginal && <Hash rotulo="Hash SHA-256 do PDF original" valor={c.hashOriginal} />}
      {c.hashAssinado && <Hash rotulo="Hash SHA-256 do PDF assinado" valor={c.hashAssinado} />}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {c.prestador && <Registro titulo="Prestador (você)" r={c.prestador} />}
        {c.cliente && <Registro titulo="Cliente" r={c.cliente} />}
      </div>
    </section>
  );
}

function Hash({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-ink-2">{rotulo}</p>
      <p className="mt-0.5 break-all font-mono text-xs text-ink">{valor}</p>
    </div>
  );
}

function Registro({ titulo, r }: { titulo: string; r: RegistroTela }) {
  return (
    <div className="mt-4 border border-line-2 bg-canvas p-3 text-sm">
      <p className="font-semibold text-ink">{titulo}</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink-2">
        <dt>Nome</dt>
        <dd className="break-words text-ink">{r.nome}</dd>
        <dt>E-mail</dt>
        <dd className="break-all text-ink">{r.email}</dd>
        <dt>Quando</dt>
        <dd className="text-ink">{dataHora(r.quando)}</dd>
        <dt>IP</dt>
        <dd className="break-all font-mono text-xs text-ink">{r.ip}</dd>
      </dl>
    </div>
  );
}

// Apagar definitivamente (LGPD) ---------------------------------------------------
function Apagar({ c }: { c: ContratoTela }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [entendi, setEntendi] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setApagando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/contratos/${c.id}`, { method: "DELETE" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível apagar agora.");
        return;
      }
      router.push("/painel/contratos");
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-apagar" className="border border-danger/40 p-5 sm:p-6">
      <h2 id="titulo-apagar" className="text-lg text-ink">
        Apagar contrato definitivamente
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Apaga o contrato, os PDFs, as imagens das assinaturas e os dados das partes (CPF, endereço, IP). Não dá para
        desfazer{c.status !== "rascunho" ? " e o link do cliente para de funcionar" : ""}.
        {c.status === "assinado" && " Baixe o PDF assinado antes, se for guardar uma cópia."}
      </p>
      {aberto ? (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={entendi}
              onChange={(e) => setEntendi(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-danger)]"
            />
            Entendo que o contrato nº {c.numero} será apagado para sempre.
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={apagar}
              disabled={!entendi || apagando}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-danger bg-danger px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.08em] text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconeLixeira width={18} height={18} />
              {apagando ? "Apagando..." : "Apagar para sempre"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className={BOTAO_NEUTRO}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAberto(true)} className={`${BOTAO_NEUTRO} mt-4`}>
          <IconeLixeira width={18} height={18} />
          Apagar contrato
        </button>
      )}
      {erro && (
        <p role="alert" className={`mt-3 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}
    </section>
  );
}
