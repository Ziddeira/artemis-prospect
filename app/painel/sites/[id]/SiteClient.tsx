"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALERTA_ERRO, ALERTA_SUCESSO, BOTAO, BOTAO_NEUTRO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { IconeBaixar } from "@/components/Icones";

type Tela = "celular" | "computador";

export default function SiteClient({
  id,
  html,
  ajustesGratis,
  podeAjustar,
  temSaldo,
}: {
  id: string;
  html: string;
  ajustesGratis: number;
  podeAjustar: boolean;
  temSaldo: boolean;
}) {
  const router = useRouter();
  const [tela, setTela] = useState<Tela>("computador");
  const [pedido, setPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const cobra = ajustesGratis < 1;

  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    if (cobra && !confirm("Os 2 ajustes grátis deste site já foram usados. Este ajuste conta como uma geração nova. Continuar?")) {
      return;
    }
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/sites/${id}/ajustar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (corpo.emLiberacao) setMensagem(corpo.erro);
        else setErro(corpo.erro || "Não foi possível ajustar o site agora.");
        return;
      }
      setPedido("");
      setMensagem(corpo.cobrado ? "Ajuste feito (contou como uma geração nova)." : "Ajuste feito!");
      router.refresh();
    } catch {
      setErro("A conexão caiu durante o ajuste. Recarregue a página para ver se ele foi aplicado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Prévia do site">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-2">Prévia</p>
          <div className="flex gap-1 border border-line bg-surface p-1">
            {(["computador", "celular"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tela === t}
                onClick={() => setTela(t)}
                className={`min-h-11 px-3 text-sm font-semibold ${tela === t ? "bg-primary-soft text-destaque" : "text-ink-2"}`}
              >
                {t === "computador" ? "Computador" : "Celular"}
              </button>
            ))}
          </div>
        </div>
        <div className={`${CARTAO} overflow-hidden bg-canvas`}>
          {/* sandbox sem allow-same-origin: o HTML gerado roda isolado do painel. */}
          <iframe
            title="Prévia do site gerado"
            srcDoc={html}
            sandbox="allow-scripts allow-popups"
            className={`mx-auto block h-[70vh] border-0 bg-white ${tela === "celular" ? "w-[390px] max-w-full" : "w-full"}`}
          />
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className={`${CARTAO} p-4`}>
          <p className="font-semibold text-ink">Baixar</p>
          <p className="mt-1 text-sm text-ink-2">Baixar não gasta nada. Publique onde preferir.</p>
          <div className="mt-3 flex flex-col gap-2">
            <a href={`/api/sites/${id}/baixar?formato=zip`} className={BOTAO_SECUNDARIO}>
              <IconeBaixar width={18} height={18} />
              Baixar .zip
            </a>
            <a href={`/api/sites/${id}/baixar?formato=html`} className={BOTAO_NEUTRO}>
              Só o arquivo .html
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            O .zip traz o index.html, um LEIA-ME com o passo a passo e a pasta fotos/ para as fotos do cliente.
          </p>
        </div>

        <form onSubmit={ajustar} className={`${CARTAO} p-4`}>
          <label htmlFor="pedido" className={ROTULO}>
            Pedir ajuste
          </label>
          <p className="mb-2 text-sm text-ink-2">
            {cobra
              ? "Os 2 ajustes grátis já foram usados: o próximo conta como uma geração nova (e devolve 2 ajustes grátis)."
              : `${ajustesGratis} ${ajustesGratis === 1 ? "ajuste grátis restante" : "ajustes grátis restantes"} neste site.`}
          </p>
          <textarea
            id="pedido"
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            rows={4}
            maxLength={1000}
            required
            placeholder="Ex.: trocar a cor principal por verde e deixar o título do topo mais curto"
            className={CAMPO}
            disabled={!podeAjustar}
          />
          {erro && (
            <p role="alert" className={`mt-2 ${ALERTA_ERRO}`}>
              {erro}
            </p>
          )}
          {mensagem && (
            <p role="status" className={`mt-2 ${ALERTA_SUCESSO}`}>
              {mensagem}
            </p>
          )}
          {!podeAjustar && (
            <p className="mt-2 text-sm text-ink-2">Os ajustes ficam disponíveis enquanto o Platina e a geração de sites estão ativos.</p>
          )}
          {podeAjustar && cobra && !temSaldo && (
            <p className="mt-2 text-sm text-ink-2">Você não tem gerações disponíveis para este ajuste.</p>
          )}
          <button
            type="submit"
            disabled={enviando || !podeAjustar || (cobra && !temSaldo)}
            className={`${BOTAO} mt-3 w-full`}
          >
            {enviando ? "Ajustando..." : "Enviar ajuste"}
          </button>
          {enviando && <p className="mt-2 text-xs text-muted">Leva de 1 a 3 minutos. Não feche a página.</p>}
        </form>
      </aside>
    </div>
  );
}
