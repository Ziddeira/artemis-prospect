"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALERTA_AVISO, ALERTA_ERRO, ALERTA_SUCESSO, BOTAO_NEUTRO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import {
  LINKS_PADRAO,
  MAX_URL_REGISTRADOR,
  montarLinkRegistro,
  urlRegistradorValida,
  type LinkRegistrador,
} from "@/lib/dominios/regras";

export default function RegistradoresClient({
  links,
  ativo,
}: {
  links: LinkRegistrador[];
  // false = etapa 26 não rodada (a tabela não existe).
  ativo: boolean;
}) {
  return (
    <div>
      <p className="max-w-3xl text-sm text-ink-2">
        Link do botão <strong className="text-ink">“Registrar”</strong> da aba Domínios, um por extensão. Pode ser
        link de afiliado. Use os marcadores <code className="text-ink">{"{dominio}"}</code> (ex.: padaria.com.br),{" "}
        <code className="text-ink">{"{nome}"}</code> (padaria) e <code className="text-ink">{"{extensao}"}</code>{" "}
        (com.br) onde o registrador espera o domínio buscado. Sem marcador, o botão só abre o link.
      </p>

      {!ativo && (
        <p className={`${ALERTA_AVISO} mt-4`}>
          Os links ainda não foram ativados no banco. Rode o script supabase/etapa26-dominios.sql no Supabase. Até lá,
          a aba Domínios usa os links padrão abaixo.
        </p>
      )}

      <ul className="mt-5 grid gap-3">
        {links.map((l) => (
          <li key={l.extensao}>
            <Linha link={l} ativo={ativo} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Linha({ link, ativo }: { link: LinkRegistrador; ativo: boolean }) {
  const router = useRouter();
  const [registrador, setRegistrador] = useState(link.registrador);
  const [url, setUrl] = useState(link.url);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const mudou = registrador.trim() !== link.registrador || url.trim() !== link.url;
  const urlOk = urlRegistradorValida(url.trim());
  const exemplo = urlOk ? montarLinkRegistro(url.trim(), "padariasaojoao", link.extensao) : null;
  const id = `reg-${link.extensao.replace(".", "-")}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/registradores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extensao: link.extensao, registrador, url }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro || "Não foi possível salvar.");
      setSalvo(true);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function voltarPadrao() {
    setRegistrador(LINKS_PADRAO[link.extensao].registrador);
    setUrl(LINKS_PADRAO[link.extensao].url);
    setSalvo(false);
  }

  return (
    <form onSubmit={salvar} className={`${CARTAO} p-4 sm:p-5`}>
      <h2 className="text-lg text-ink">.{link.extensao}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_3fr]">
        <div>
          <label htmlFor={`${id}-nome`} className={ROTULO}>
            Registrador
          </label>
          <input
            id={`${id}-nome`}
            className={CAMPO}
            value={registrador}
            onChange={(e) => setRegistrador(e.target.value)}
            maxLength={60}
            disabled={!ativo}
          />
        </div>
        <div>
          <label htmlFor={`${id}-url`} className={ROTULO}>
            Link
          </label>
          <input
            id={`${id}-url`}
            className={CAMPO}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={MAX_URL_REGISTRADOR}
            disabled={!ativo}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!urlOk}
          />
        </div>
      </div>
      <p className="mt-2 break-all text-xs text-muted">
        {exemplo ? (
          <>
            Exemplo:{" "}
            <a href={exemplo} target="_blank" rel="noopener" className="underline hover:text-ink">
              {exemplo}
            </a>
          </>
        ) : (
          <span className="text-danger">O link precisa começar com https:// e não pode ter espaços.</span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={BOTAO_NEUTRO}
          disabled={!ativo || salvando || !mudou || !urlOk || !registrador.trim()}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" className={BOTAO_NEUTRO} onClick={voltarPadrao} disabled={!ativo || salvando}>
          Voltar ao padrão
        </button>
      </div>
      {erro && (
        <p role="alert" className={`${ALERTA_ERRO} mt-3`}>
          {erro}
        </p>
      )}
      {salvo && !mudou && (
        <p role="status" className={`${ALERTA_SUCESSO} mt-3`}>
          Link salvo. Já vale na aba Domínios.
        </p>
      )}
    </form>
  );
}
