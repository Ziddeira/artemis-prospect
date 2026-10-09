"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ALERTA_ERRO, BOTAO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { ESTILOS, IDIOMAS, MAX_SERVICOS, type EstiloSite, type IdiomaSite } from "@/lib/sites/dados";

interface Inicial {
  nome: string;
  cidade: string;
  endereco: string;
  telefone: string;
  idioma: IdiomaSite;
}

export default function NovoSiteClient({
  placeId,
  inicial,
  semSaldo,
  gerando: gerandoInicial,
}: {
  placeId: string;
  inicial: Inicial;
  semSaldo: boolean;
  gerando: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [ramo, setRamo] = useState("");
  const [cidade, setCidade] = useState(inicial.cidade);
  const [endereco, setEndereco] = useState(inicial.endereco);
  const [servicos, setServicos] = useState("");
  const [telefone, setTelefone] = useState(inicial.telefone);
  const [idioma, setIdioma] = useState<IdiomaSite>(inicial.idioma);
  const [estilo, setEstilo] = useState<EstiloSite>("moderno");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/sites/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          estilo,
          dados: { nome, ramo, cidade, endereco, servicos: servicos.split("\n"), telefone, idioma, observacoes },
        }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível gerar o site agora.");
        return;
      }
      router.push(`/painel/sites/${corpo.siteId}`);
      router.refresh();
    } catch {
      setErro("A conexão caiu enquanto o site era gerado. Confira em Meus sites antes de tentar de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const bloqueado = enviando || semSaldo || gerandoInicial;
  const qtdServicos = servicos.split("\n").filter((s) => s.trim()).length;

  return (
    <form onSubmit={gerar} className={`${CARTAO} mt-6 p-5 sm:p-6`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nome" rotulo="Nome da empresa">
          <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required className={CAMPO} />
        </Campo>
        <Campo id="ramo" rotulo="Ramo">
          <input
            id="ramo"
            value={ramo}
            onChange={(e) => setRamo(e.target.value)}
            maxLength={80}
            required
            placeholder="Ex.: barbearia, pet shop, clínica odontológica"
            className={CAMPO}
          />
        </Campo>
        <Campo id="cidade" rotulo="Cidade">
          <input
            id="cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            maxLength={80}
            required
            placeholder="Ex.: Campinas - SP"
            className={CAMPO}
          />
        </Campo>
        <Campo id="endereco" rotulo="Endereço ou bairro (opcional)">
          <input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={160} className={CAMPO} />
        </Campo>
        <Campo id="telefone" rotulo="WhatsApp da empresa">
          <input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            maxLength={30}
            required
            inputMode="tel"
            placeholder="(11) 98765-4321"
            className={CAMPO}
          />
        </Campo>
        <Campo id="idioma" rotulo="Idioma do site">
          <select id="idioma" value={idioma} onChange={(e) => setIdioma(e.target.value as IdiomaSite)} className={CAMPO}>
            {IDIOMAS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="servicos" rotulo={`Serviços (um por linha, até ${MAX_SERVICOS})`}>
            <textarea
              id="servicos"
              value={servicos}
              onChange={(e) => setServicos(e.target.value)}
              rows={5}
              required
              placeholder={"Corte masculino\nBarba completa\nSobrancelha"}
              className={`${CAMPO} min-h-32`}
            />
          </Campo>
          {qtdServicos > MAX_SERVICOS && (
            <p className="mt-1 text-xs text-danger">Só os {MAX_SERVICOS} primeiros entram no site.</p>
          )}
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className={ROTULO}>Estilo visual</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ESTILOS.map((op) => {
            const ativo = estilo === op.id;
            return (
              <label
                key={op.id}
                className={`flex min-h-11 cursor-pointer gap-3 border p-3 transition ${
                  ativo ? "border-destaque bg-primary-soft" : "border-line hover:border-line-strong"
                }`}
              >
                <input
                  type="radio"
                  name="estilo"
                  value={op.id}
                  checked={ativo}
                  onChange={() => setEstilo(op.id)}
                  className="mt-1 accent-[var(--color-destaque)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    {op.nome}
                    <span className="flex" aria-hidden="true">
                      {op.amostra.map((cor) => (
                        <span key={cor} className="h-3.5 w-3.5 border border-line" style={{ background: cor }} />
                      ))}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-2">{op.descricao}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <Campo id="observacoes" rotulo="Observações para a IA (opcional)">
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="Ex.: usar verde como cor principal; destacar o atendimento a domicílio"
            className={CAMPO}
          />
        </Campo>
      </div>

      <div className="mt-5 border border-line-2 bg-canvas p-3 text-sm text-ink-2">
        <p>
          <strong className="text-ink">Fotos:</strong> o site sai com espaços reservados e marcados para as fotos do seu
          cliente. Nenhuma foto do Google entra no site.
        </p>
        <p className="mt-1">
          <strong className="text-ink">Depoimentos:</strong> saem como exemplos marcados, para trocar pelos depoimentos
          reais antes de publicar.
        </p>
      </div>

      {erro && (
        <p role="alert" className={`mt-4 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}
      {semSaldo && (
        <p className={`mt-4 ${ALERTA_ERRO}`}>
          Suas gerações acabaram. Elas voltam na renovação do plano, ou compre o pacote em{" "}
          <Link href="/painel/plano" className="font-semibold underline">
            Meu plano
          </Link>
          .
        </p>
      )}
      {gerandoInicial && (
        <p className={`mt-4 ${ALERTA_ERRO}`}>Já tem um site sendo gerado na sua conta. Espere ele terminar.</p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="submit" disabled={bloqueado} className={BOTAO}>
          {enviando ? "Gerando o site..." : "Gerar site (usa 1 geração)"}
        </button>
        {enviando && (
          <p role="status" className="text-sm text-ink-2">
            A IA leva de 1 a 3 minutos. Não feche esta página.
          </p>
        )}
      </div>
    </form>
  );
}

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      {children}
    </div>
  );
}
