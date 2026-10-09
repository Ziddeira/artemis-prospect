"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ALERTA_AVISO, ALERTA_ERRO, BOTAO, BOTAO_NEUTRO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from "@/components/ui";
import { TextoContrato } from "@/components/contratos/Pecas";
import {
  INCLUI_MANUTENCAO_SUGERIDO,
  MEIOS_PAGAMENTO,
  OPCOES_PROPRIEDADE,
  RESUMO_PADRAO,
  UFS,
  aplicarPadrao,
  mascaraDocumento,
  pendencias,
  validarDadosContrato,
  type DadosContrato,
  type ModoContrato,
} from "@/lib/contratos/dados";
import { montarContrato } from "@/lib/contratos/texto";
import { lerValor } from "@/lib/leads/funil";

type Passo =
  | "contratante"
  | "prestador"
  | "escopo"
  | "pagamento"
  | "hospedagem"
  | "manutencao"
  | "propriedade"
  | "foro"
  | "revisar";

const TITULOS: Record<Passo, string> = {
  contratante: "Empresa contratante",
  prestador: "Prestador do serviço (você)",
  escopo: "Escopo do serviço",
  pagamento: "Valor e pagamento",
  hospedagem: "Hospedagem e domínio",
  manutencao: "Manutenção",
  propriedade: "Propriedade do código e do design",
  foro: "Cidade do foro",
  revisar: "Revisar e salvar",
};

const PASSOS: Record<ModoContrato, Passo[]> = {
  questionario: ["contratante", "prestador", "escopo", "pagamento", "hospedagem", "manutencao", "propriedade", "foro", "revisar"],
  padrao: ["contratante", "prestador", "pagamento", "foro", "revisar"],
};

export type DestinoQuestionario = { tipo: "criar"; placeId: string } | { tipo: "editar"; id: string };

export default function Questionario({
  inicial,
  modoInicial,
  numero,
  destino,
}: {
  inicial: DadosContrato;
  // null = mostra antes a escolha entre o modelo padrão e o questionário.
  modoInicial: ModoContrato | null;
  numero: string;
  destino: DestinoQuestionario;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoContrato | null>(modoInicial);
  const [dados, setDados] = useState<DadosContrato>(inicial);
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeiraVez = useRef(true);

  const passos = modo ? PASSOS[modo] : [];
  const passo = passos[indice];

  // Leitor de tela e teclado: a cada passo, o foco vai para o título.
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [indice, modo]);

  function mudar<K extends keyof DadosContrato>(chave: K, valor: Partial<DadosContrato[K]> | DadosContrato[K]) {
    setDados((d) => ({
      ...d,
      [chave]: typeof valor === "object" && valor !== null ? { ...(d[chave] as object), ...valor } : valor,
    }));
  }

  function escolherModo(m: ModoContrato) {
    setModo(m);
    setIndice(0);
    if (m === "padrao") setDados((d) => aplicarPadrao(d));
  }

  function personalizar() {
    setModo("questionario");
    setIndice(PASSOS.questionario.indexOf("escopo"));
  }

  async function avancar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = validarDadosContrato(dados);
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    if (passo !== "revisar") {
      setIndice((i) => Math.min(passos.length - 1, i + 1));
      return;
    }

    setSalvando(true);
    try {
      const res =
        destino.tipo === "criar"
          ? await fetch("/api/contratos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ placeId: destino.placeId, modo, dados: r.dados }),
            })
          : await fetch(`/api/contratos/${destino.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ modo, dados: r.dados }),
            });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro || "Não foi possível salvar o contrato agora.");
        return;
      }
      const id = destino.tipo === "criar" ? corpo.id : destino.id;
      router.push(`/painel/contratos/${id}`);
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!modo) {
    return (
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <EscolhaModo
          titulo="Usar o modelo padrão"
          texto="Você preenche só as partes, o valor e a cidade do foro. O resto já vem pronto:"
          lista={RESUMO_PADRAO}
          botao="Usar o modelo padrão"
          onEscolher={() => escolherModo("padrao")}
        />
        <EscolhaModo
          titulo="Responder o questionário"
          texto="8 perguntas curtas, uma por tela, para o contrato sair do jeito que você combinou com o cliente: escopo, pagamento, hospedagem, manutenção e propriedade."
          botao="Responder o questionário"
          onEscolher={() => escolherModo("questionario")}
        />
      </div>
    );
  }

  return (
    <form onSubmit={avancar} className={`${CARTAO} mt-6 p-5 sm:p-6`} noValidate>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {modo === "padrao" ? "Modelo padrão" : "Questionário"} · passo {indice + 1} de {passos.length}
      </p>
      <div className="mt-2 h-1 bg-line" aria-hidden="true">
        <div className="h-1 bg-primary transition-all" style={{ width: `${((indice + 1) / passos.length) * 100}%` }} />
      </div>
      <h2 ref={tituloRef} tabIndex={-1} className="mt-4 text-xl text-ink outline-none sm:text-2xl">
        {TITULOS[passo]}
      </h2>

      <div className="mt-4">
        {passo === "contratante" && <PassoContratante dados={dados} mudar={mudar} />}
        {passo === "prestador" && <PassoPrestador dados={dados} mudar={mudar} />}
        {passo === "escopo" && <PassoEscopo dados={dados} mudar={mudar} />}
        {passo === "pagamento" && <PassoPagamento dados={dados} mudar={mudar} />}
        {passo === "hospedagem" && <PassoHospedagem dados={dados} mudar={mudar} />}
        {passo === "manutencao" && <PassoManutencao dados={dados} mudar={mudar} />}
        {passo === "propriedade" && <PassoPropriedade dados={dados} mudar={mudar} />}
        {passo === "foro" && <PassoForo dados={dados} mudar={mudar} />}
        {passo === "revisar" && (
          <PassoRevisar dados={dados} numero={numero} modo={modo} onPersonalizar={personalizar} />
        )}
      </div>

      {erro && (
        <p role="alert" className={`mt-4 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className={BOTAO_SECUNDARIO}
          onClick={() => {
            setErro(null);
            if (indice === 0 && !modoInicial) setModo(null);
            else setIndice((i) => Math.max(0, i - 1));
          }}
          disabled={indice === 0 && !!modoInicial}
        >
          Voltar
        </button>
        <button type="submit" className={BOTAO} disabled={salvando}>
          {passo === "revisar" ? (salvando ? "Salvando..." : "Salvar contrato") : "Próximo"}
        </button>
      </div>
    </form>
  );
}

// Peças do formulário -------------------------------------------------------

type PropsPasso = {
  dados: DadosContrato;
  mudar: <K extends keyof DadosContrato>(chave: K, valor: Partial<DadosContrato[K]> | DadosContrato[K]) => void;
};

function EscolhaModo({
  titulo,
  texto,
  lista,
  botao,
  onEscolher,
}: {
  titulo: string;
  texto: string;
  lista?: string[];
  botao: string;
  onEscolher: () => void;
}) {
  return (
    <div className={`${CARTAO} flex flex-col p-5 sm:p-6`}>
      <h2 className="text-xl text-ink">{titulo}</h2>
      <p className="mt-2 text-sm text-ink-2">{texto}</p>
      {lista && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          {lista.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-5">
        <button type="button" onClick={onEscolher} className={BOTAO}>
          {botao}
        </button>
      </div>
    </div>
  );
}

function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      {children}
      {dica && <p className="mt-1 text-xs text-muted">{dica}</p>}
    </div>
  );
}

function Opcoes<T extends string>({
  nome,
  legenda,
  valor,
  opcoes,
  onChange,
}: {
  nome: string;
  legenda: string;
  valor: T;
  opcoes: { id: T; nome: string; texto?: string; desativada?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className={ROTULO}>{legenda}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opcoes.map((op) => {
          const ativo = valor === op.id;
          return (
            <label
              key={op.id}
              className={`flex min-h-11 gap-3 border p-3 transition ${
                op.desativada ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${ativo ? "border-destaque bg-primary-soft" : "border-line hover:border-line-strong"}`}
            >
              <input
                type="radio"
                name={nome}
                value={op.id}
                checked={ativo}
                disabled={!!op.desativada}
                onChange={() => onChange(op.id)}
                className="mt-1 accent-[var(--color-destaque)]"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{op.nome}</span>
                {op.texto && <span className="mt-0.5 block text-sm text-ink-2">{op.texto}</span>}
                {op.desativada && <span className="mt-0.5 block text-xs text-muted">{op.desativada}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Valor em reais: aceita "1500", "1.500,50" etc. (lib/leads/funil.ts).
function CampoDinheiro({
  id,
  rotulo,
  valor,
  onChange,
  dica,
}: {
  id: string;
  rotulo: string;
  valor: number | null;
  onChange: (v: number | null) => void;
  dica?: string;
}) {
  const formatar = (v: number | null) =>
    v === null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [texto, setTexto] = useState(formatar(valor));
  const [invalido, setInvalido] = useState(false);
  return (
    <Campo id={id} rotulo={rotulo} dica={dica}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2">R$</span>
        <input
          id={id}
          inputMode="decimal"
          value={texto}
          aria-invalid={invalido}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = lerValor(e.target.value);
            setInvalido(v === "invalido");
            onChange(v === "invalido" ? null : v);
          }}
          onBlur={() => {
            const v = lerValor(texto);
            if (v !== "invalido") setTexto(formatar(v));
          }}
          placeholder="0,00"
          className={`${CAMPO} pl-10!`}
        />
      </div>
      {invalido && <p className="mt-1 text-xs text-danger">Use só números, como 1.500,00.</p>}
    </Campo>
  );
}

function CampoNumero({
  id,
  rotulo,
  valor,
  min,
  max,
  onChange,
  dica,
}: {
  id: string;
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  dica?: string;
}) {
  return (
    <Campo id={id} rotulo={rotulo} dica={dica}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className={`${CAMPO} max-w-40`}
      />
    </Campo>
  );
}

const DICA_DEPOIS = "Pode deixar para depois. Para enviar ao cliente, precisa estar preenchido.";

// Passos ----------------------------------------------------------------------

function PassoContratante({ dados, mudar }: PropsPasso) {
  const c = dados.contratante;
  const pj = c.tipo === "pj";
  return (
    <div className="grid gap-4">
      <Opcoes
        nome="contratante-tipo"
        legenda="O cliente é"
        valor={c.tipo}
        opcoes={[
          { id: "pj", nome: "Empresa (CNPJ)" },
          { id: "pf", nome: "Pessoa física (CPF)" },
        ]}
        onChange={(tipo) => mudar("contratante", { tipo, documento: mascaraDocumento(tipo, c.documento) })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="ct-nome" rotulo={pj ? "Razão social ou nome da empresa" : "Nome completo"}>
          <input id="ct-nome" value={c.nome} maxLength={160} onChange={(e) => mudar("contratante", { nome: e.target.value })} className={CAMPO} />
        </Campo>
        <Campo id="ct-doc" rotulo={pj ? "CNPJ" : "CPF"} dica={DICA_DEPOIS}>
          <input
            id="ct-doc"
            value={c.documento}
            inputMode={pj ? "text" : "numeric"}
            onChange={(e) => mudar("contratante", { documento: mascaraDocumento(c.tipo, e.target.value) })}
            placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
            className={CAMPO}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="ct-end" rotulo="Endereço completo" dica="Rua, número, bairro, cidade e estado.">
            <input id="ct-end" value={c.endereco} maxLength={240} onChange={(e) => mudar("contratante", { endereco: e.target.value })} className={CAMPO} />
          </Campo>
        </div>
        {pj && (
          <>
            <Campo id="ct-assina" rotulo="Quem assina pela empresa">
              <input
                id="ct-assina"
                value={c.assinanteNome}
                maxLength={120}
                onChange={(e) => mudar("contratante", { assinanteNome: e.target.value })}
                placeholder="Nome completo"
                className={CAMPO}
              />
            </Campo>
            <Campo id="ct-cargo" rotulo="Cargo de quem assina (opcional)">
              <input
                id="ct-cargo"
                value={c.assinanteCargo}
                maxLength={60}
                onChange={(e) => mudar("contratante", { assinanteCargo: e.target.value })}
                placeholder="Ex.: sócio-administrador"
                className={CAMPO}
              />
            </Campo>
          </>
        )}
      </div>
    </div>
  );
}

function PassoPrestador({ dados, mudar }: PropsPasso) {
  const p = dados.prestador;
  const pj = p.tipo === "pj";
  return (
    <div className="grid gap-4">
      <Opcoes
        nome="prestador-tipo"
        legenda="Você presta o serviço como"
        valor={p.tipo}
        opcoes={[
          { id: "pf", nome: "Pessoa física (CPF)" },
          { id: "pj", nome: "MEI ou empresa (CNPJ)" },
        ]}
        onChange={(tipo) => mudar("prestador", { tipo, documento: mascaraDocumento(tipo, p.documento) })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="pr-nome" rotulo={pj ? "Razão social do MEI ou da empresa" : "Seu nome completo"}>
          <input id="pr-nome" value={p.nome} maxLength={160} onChange={(e) => mudar("prestador", { nome: e.target.value })} className={CAMPO} />
        </Campo>
        <Campo id="pr-doc" rotulo={pj ? "CNPJ" : "CPF"}>
          <input
            id="pr-doc"
            value={p.documento}
            inputMode={pj ? "text" : "numeric"}
            onChange={(e) => mudar("prestador", { documento: mascaraDocumento(p.tipo, e.target.value) })}
            placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
            className={CAMPO}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="pr-end" rotulo="Endereço completo">
            <input id="pr-end" value={p.endereco} maxLength={240} onChange={(e) => mudar("prestador", { endereco: e.target.value })} className={CAMPO} />
          </Campo>
        </div>
        <Campo id="pr-email" rotulo="E-mail para contato">
          <input id="pr-email" type="email" value={p.email} maxLength={200} onChange={(e) => mudar("prestador", { email: e.target.value })} className={CAMPO} />
        </Campo>
        {pj && (
          <Campo id="pr-resp" rotulo="Quem assina pelo CNPJ" dica="No MEI, é o próprio dono.">
            <input
              id="pr-resp"
              value={p.responsavelNome}
              maxLength={120}
              onChange={(e) => mudar("prestador", { responsavelNome: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        )}
      </div>
      <p className="text-xs text-muted">Seus dados ficam guardados para preencher os próximos contratos sozinhos.</p>
    </div>
  );
}

function PassoEscopo({ dados, mudar }: PropsPasso) {
  const e = dados.escopo;
  return (
    <div className="grid gap-5">
      <Opcoes
        nome="escopo-tipo"
        legenda="O que você vai entregar"
        valor={e.tipo}
        opcoes={[
          { id: "site", nome: "Site institucional", texto: "Várias páginas: início, sobre, serviços, contato..." },
          { id: "landing", nome: "Landing page", texto: "Uma página só, com seções, focada em contato ou venda." },
        ]}
        onChange={(tipo) => mudar("escopo", { tipo, paginas: tipo === "landing" ? 1 : Math.max(e.paginas, 3) })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {e.tipo === "site" && (
          <CampoNumero id="es-paginas" rotulo="Número de páginas" valor={e.paginas} min={1} max={50} onChange={(paginas) => mudar("escopo", { paginas })} />
        )}
        <CampoNumero
          id="es-rodadas"
          rotulo="Rodadas de ajuste incluídas"
          valor={e.rodadas}
          min={0}
          max={10}
          onChange={(rodadas) => mudar("escopo", { rodadas })}
          dica="Cada rodada é uma lista de mudanças."
        />
        <CampoNumero
          id="es-prazo"
          rotulo="Prazo de entrega (dias úteis)"
          valor={e.prazoDias}
          min={1}
          max={180}
          onChange={(prazoDias) => mudar("escopo", { prazoDias })}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className={ROTULO}>Inclui</legend>
        <Marcar id="es-form" marcado={e.formulario} onChange={(formulario) => mudar("escopo", { formulario })}>
          Formulário de contato
        </Marcar>
        <Marcar id="es-whats" marcado={e.whatsapp} onChange={(whatsapp) => mudar("escopo", { whatsapp })}>
          Integração com WhatsApp (botão para chamar)
        </Marcar>
      </fieldset>
      <Campo id="es-extras" rotulo="Outros itens incluídos (opcional)">
        <input
          id="es-extras"
          value={e.extras}
          maxLength={300}
          onChange={(ev) => mudar("escopo", { extras: ev.target.value })}
          placeholder="Ex.: galeria de fotos e mapa de localização"
          className={CAMPO}
        />
      </Campo>
    </div>
  );
}

function Marcar({ id, marcado, onChange, children }: { id: string; marcado: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-line p-3 hover:border-line-strong">
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-destaque)]" />
      <span className="text-ink">{children}</span>
    </label>
  );
}

function PassoPagamento({ dados, mudar }: PropsPasso) {
  const p = dados.pagamento;
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoDinheiro id="pg-valor" rotulo="Valor total do site" valor={p.valor} onChange={(valor) => mudar("pagamento", { valor })} />
        <Campo id="pg-meio" rotulo="Forma de pagamento">
          <select
            id="pg-meio"
            value={p.meio}
            onChange={(e) => mudar("pagamento", { meio: e.target.value as typeof p.meio })}
            className={CAMPO}
          >
            {MEIOS_PAGAMENTO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Opcoes
        nome="pg-forma"
        legenda="Como o cliente vai pagar"
        valor={p.forma}
        opcoes={[
          { id: "avista", nome: "À vista" },
          { id: "parcelado", nome: "Parcelado" },
        ]}
        onChange={(forma) => mudar("pagamento", { forma })}
      />
      {p.forma === "parcelado" && (
        <Campo id="pg-parcelas" rotulo="Número de parcelas" dica="A primeira vence na assinatura e as demais a cada 30 dias.">
          <select
            id="pg-parcelas"
            value={p.parcelas}
            onChange={(e) => mudar("pagamento", { parcelas: Number(e.target.value) })}
            className={`${CAMPO} max-w-40`}
          >
            {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </Campo>
      )}
      <Opcoes
        nome="pg-pago"
        legenda="O cliente já pagou alguma coisa?"
        valor={p.jaPago}
        opcoes={[
          { id: "nao", nome: "Ainda não" },
          { id: "parcial", nome: "Pagou uma parte" },
          { id: "total", nome: "Pagou tudo" },
        ]}
        onChange={(jaPago) => mudar("pagamento", { jaPago })}
      />
      {p.jaPago === "parcial" && (
        <CampoDinheiro
          id="pg-pago-valor"
          rotulo="Quanto já foi pago"
          valor={p.valorPago}
          onChange={(valorPago) => mudar("pagamento", { valorPago })}
          dica="O contrato registra esse valor como recebido e cobra só o saldo."
        />
      )}
    </div>
  );
}

function PassoHospedagem({ dados, mudar }: PropsPasso) {
  const h = dados.hospedagem;
  return (
    <div className="grid gap-5">
      <Opcoes
        nome="ho-paga"
        legenda="Quem paga a hospedagem e o domínio"
        valor={h.paga}
        opcoes={[
          { id: "contratante", nome: "O cliente", texto: "Ele paga direto aos fornecedores (o mais comum)." },
          { id: "prestador", nome: "Eu", texto: "O custo já está no seu preço ou na mensalidade." },
        ]}
        onChange={(paga) => mudar("hospedagem", { paga })}
      />
      <Opcoes
        nome="ho-titular"
        legenda="Em nome de quem ficam registrados"
        valor={h.titular}
        opcoes={[
          { id: "contratante", nome: "No nome do cliente", texto: "Recomendado: o endereço é da marca dele." },
          { id: "prestador", nome: "No meu nome", texto: "O contrato prevê passar o domínio ao cliente quando a relação acabar." },
        ]}
        onChange={(titular) => mudar("hospedagem", { titular })}
      />
    </div>
  );
}

function PassoManutencao({ dados, mudar }: PropsPasso) {
  const m = dados.manutencao;
  return (
    <div className="grid gap-5">
      <Opcoes
        nome="ma-tipo"
        legenda="Depois da entrega"
        valor={m.tipo}
        opcoes={[
          { id: "unica", nome: "Entrega única", texto: "Inclui 30 dias para corrigir falhas. Depois, cada ajuste é orçado à parte." },
          { id: "mensal", nome: "Mensalidade", texto: "Você cuida do site todo mês por um valor fixo." },
        ]}
        onChange={(tipo) => {
          mudar("manutencao", { tipo, inclui: tipo === "mensal" && !m.inclui ? INCLUI_MANUTENCAO_SUGERIDO : m.inclui });
          // A licença de uso depende da mensalidade.
          if (tipo === "unica" && dados.propriedade === "licenca") mudar("propriedade", "cessao");
        }}
      />
      {m.tipo === "mensal" && (
        <div className="grid gap-4">
          <div className="sm:max-w-xs">
            <CampoDinheiro id="ma-valor" rotulo="Valor da mensalidade" valor={m.valorMensal} onChange={(valorMensal) => mudar("manutencao", { valorMensal })} />
          </div>
          <Campo id="ma-inclui" rotulo="O que a mensalidade inclui">
            <textarea
              id="ma-inclui"
              value={m.inclui}
              maxLength={400}
              rows={3}
              onChange={(e) => mudar("manutencao", { inclui: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        </div>
      )}
    </div>
  );
}

function PassoPropriedade({ dados, mudar }: PropsPasso) {
  const mensal = dados.manutencao.tipo === "mensal";
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">Quem fica dono do site depois de pronto? Leia as duas opções antes de escolher:</p>
      <Opcoes
        nome="propriedade"
        legenda="Propriedade"
        valor={dados.propriedade}
        opcoes={OPCOES_PROPRIEDADE.map((o) => ({
          id: o.id,
          nome: o.nome,
          texto: o.explicacao,
          desativada:
            o.id === "licenca" && !mensal ? "Só com manutenção mensal: volte um passo e escolha mensalidade." : undefined,
        }))}
        onChange={(v) => mudar("propriedade", v)}
      />
    </div>
  );
}

function PassoForo({ dados, mudar }: PropsPasso) {
  const f = dados.foro;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        É a cidade onde um eventual processo sobre o contrato seria resolvido. O comum é escolher a cidade de uma das
        partes.
      </p>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Campo id="fo-cidade" rotulo="Cidade">
          <input id="fo-cidade" value={f.cidade} maxLength={80} onChange={(e) => mudar("foro", { cidade: e.target.value })} className={CAMPO} />
        </Campo>
        <Campo id="fo-uf" rotulo="Estado">
          <select id="fo-uf" value={f.uf} onChange={(e) => mudar("foro", { uf: e.target.value })} className={CAMPO}>
            <option value="">UF</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </div>
  );
}

function PassoRevisar({
  dados,
  numero,
  modo,
  onPersonalizar,
}: {
  dados: DadosContrato;
  numero: string;
  modo: ModoContrato;
  onPersonalizar: () => void;
}) {
  const faltam = pendencias(dados);
  const doc = useMemo(() => montarContrato(dados, { numero, data: new Date() }), [dados, numero]);
  return (
    <div className="grid gap-4">
      {modo === "padrao" && (
        <div className="border border-line-2 bg-canvas p-3 text-sm text-ink-2">
          <p className="font-semibold text-ink">O modelo padrão já inclui:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {RESUMO_PADRAO.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button type="button" onClick={onPersonalizar} className={`${BOTAO_NEUTRO} mt-3`}>
            Personalizar essas escolhas
          </button>
        </div>
      )}
      {faltam.length > 0 ? (
        <div className={ALERTA_AVISO}>
          <p className="font-semibold">Você pode salvar agora, mas para enviar ao cliente ainda falta:</p>
          <ul className="mt-1 list-disc pl-5">
            {faltam.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-2">Tudo preenchido. Leia o contrato abaixo e salve.</p>
      )}
      <details open className="group">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink">Ler o contrato como vai ficar</summary>
        <div className="max-h-[32rem] overflow-y-auto">
          <TextoContrato doc={doc} />
        </div>
      </details>
    </div>
  );
}
