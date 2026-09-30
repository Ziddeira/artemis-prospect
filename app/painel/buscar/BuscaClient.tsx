"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadResultado, Modo, Situacao } from "@/lib/leads/classificacao";
import { PAISES, PAISES_INTERNACIONAIS, configPais, type CodigoPais } from "@/lib/leads/paises";
import type { ModelosPorIdioma } from "@/lib/perfil/modelos";
import { VALIDADE_CACHE_DIAS } from "@/lib/leads/dadosLead";
import { dataCurta, quandoFoi, type UltimaBusca } from "@/lib/leads/ultimaBusca";
import {
  MSG_PADRAO_HOSPEDAGEM,
  MSG_PADRAO_NEGOCIOS,
  linkWhatsapp,
  montarMensagem,
  preencherModelo,
} from "@/lib/leads/mensagens";
import {
  ROTULO_CONFIANCA,
  passaFiltroConfianca,
  type FiltroConfianca,
  type NivelConfianca,
} from "@/lib/leads/confianca";
import EtiquetaSituacao from "@/components/leads/EtiquetaSituacao";
import SeloConfianca from "@/components/leads/SeloConfianca";
import HoraLocal from "@/components/leads/HoraLocal";
import { BotoesContatoInternacional, MensagemPronta } from "@/components/leads/ContatoInternacional";
import Score from "@/components/marca/Score";
import LimitePlano from "@/components/marca/LimitePlano";
import { ListaEsqueleto } from "@/components/leads/CartaoLeadEsqueleto";
import {
  ABA_ATIVA,
  ABA_INATIVA,
  ALERTA_AVISO,
  ALERTA_ERRO,
  BOTAO,
  BOTAO_NEUTRO,
  BOTAO_WHATSAPP,
  CAMPO,
  CARTAO,
  EstadoVazio,
  ROTULO,
  TituloPagina,
} from "@/components/ui";
import {
  IconeBuscar,
  IconeCadeado,
  IconeEstrela,
  IconeFiltro,
  IconeGlobo,
  IconeLink,
  IconeMapa,
  IconeWhatsapp,
} from "@/components/Icones";

interface Perfil {
  plano: string;
  buscasRestantes: number;
  creditosDesbloqueio: number;
}

// Termos, regiões e data da busca que está na tela (a salva no banco).
type InfoBusca = Omit<UltimaBusca, "leads" | "totalLeads" | "aviso">;

function infoDe(busca: UltimaBusca): InfoBusca {
  return {
    termos: busca.termos,
    areas: busca.areas,
    modo: busca.modo,
    pais: busca.pais,
    feitaEm: busca.feitaEm,
    expiraEm: busca.expiraEm,
  };
}

const ROTULO_PLANO: Record<string, string> = {
  gratis: "Grátis",
  solo: "Solo",
  pro: "Pro",
};

const CHECKBOX = "h-5 w-5 shrink-0 cursor-pointer accent-destaque";

// Hospedagem e Internacional são do plano Pro.
const MODOS: { modo: Modo; rotulo: string; pro: boolean }[] = [
  { modo: "negocios", rotulo: "Negócios", pro: false },
  { modo: "hospedagem", rotulo: "Hospedagem", pro: true },
  { modo: "internacional", rotulo: "Internacional", pro: true },
];

// "(Hospedagem)", "(Internacional · 🇺🇸 Estados Unidos)" ou nada.
function rotuloModo(info: { modo: Modo; pais: CodigoPais | null }): string {
  if (info.modo === "hospedagem") return " (Hospedagem)";
  if (info.modo === "internacional") {
    const p = configPais(info.pais);
    return ` (Internacional · ${p.bandeira} ${p.nome})`;
  }
  return "";
}

const ORDENS = {
  pontuacao: (a: LeadResultado, b: LeadResultado) => b.pontuacao - a.pontuacao,
  avaliacoes: (a: LeadResultado, b: LeadResultado) => b.avaliacoes - a.avaliacoes,
  nota: (a: LeadResultado, b: LeadResultado) => b.nota - a.nota || b.avaliacoes - a.avaliacoes,
  nome: (a: LeadResultado, b: LeadResultado) => a.nome.localeCompare(b.nome, "pt-BR"),
} as const;

function dividirLista(valor: string): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const parte of valor.split(",")) {
    const item = parte.trim();
    const chave = item.toLowerCase();
    if (item && !vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(item);
    }
  }
  return resultado;
}

export default function BuscaClient({
  perfilInicial,
  ultimaBusca,
  modelos,
}: {
  perfilInicial: Perfil;
  // Última busca salva no banco (lida pelo servidor, sem chamar o Google).
  ultimaBusca: UltimaBusca | null;
  // Modelos de mensagem do Perfil (leads da aba Internacional).
  modelos: ModelosPorIdioma;
}) {
  const salvaValida = ultimaBusca?.leads ? ultimaBusca : null;
  const [nicho, setNicho] = useState(ultimaBusca?.termos.join(", ") ?? "");
  const [areas, setAreas] = useState(ultimaBusca?.areas.join(", ") ?? "");
  const [modo, setModo] = useState<Modo>(
    ultimaBusca && ultimaBusca.modo !== "negocios" && perfilInicial.plano === "pro" ? ultimaBusca.modo : "negocios",
  );
  const [pais, setPais] = useState<CodigoPais>(ultimaBusca?.pais ?? PAISES_INTERNACIONAIS[0]);
  const [perfil, setPerfil] = useState(perfilInicial);
  const [leads, setLeads] = useState<LeadResultado[]>(salvaValida?.leads ?? []);
  const [carregando, setCarregando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(salvaValida?.aviso ?? null);
  // Quantas empresas fechadas definitivamente a última busca escondeu.
  const [fechadosOcultos, setFechadosOcultos] = useState(0);
  // Quantas eram de outro país (só na aba Internacional).
  const [deOutroPais, setDeOutroPais] = useState(0);
  const [buscaFeita, setBuscaFeita] = useState(!!salvaValida);
  const [infoBusca, setInfoBusca] = useState<InfoBusca | null>(salvaValida ? infoDe(salvaValida) : null);
  // Busca salva que passou do prazo do cache do Google: a lista foi
  // apagada, mas a tela avisa em vez de sumir com tudo.
  const [expirada, setExpirada] = useState<InfoBusca | null>(
    ultimaBusca && !ultimaBusca.leads ? infoDe(ultimaBusca) : null,
  );
  const [desbloqueando, setDesbloqueando] = useState<Record<string, boolean>>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [minNota, setMinNota] = useState(0);
  const [minAvaliacoes, setMinAvaliacoes] = useState(0);
  const [textoEndereco, setTextoEndereco] = useState("");
  const [apenasCelular, setApenasCelular] = useState(false);
  const [apenasAberto, setApenasAberto] = useState(true);
  const [esconderDesbloqueados, setEsconderDesbloqueados] = useState(false);
  const [filtroConfianca, setFiltroConfianca] = useState<FiltroConfianca>("todos");
  const [ordenarPor, setOrdenarPor] = useState<keyof typeof ORDENS>("pontuacao");
  const [situacoesAtivas, setSituacoesAtivas] = useState<Record<Situacao, boolean>>({
    sem_site: true,
    booking: true,
    rede_social: true,
    site_proprio: false,
  });

  const termos = useMemo(() => dividirLista(nicho), [nicho]);
  const listaAreas = useMemo(() => dividirLista(areas), [areas]);
  const estimativaBuscas = termos.length * listaAreas.length;
  const podeHospedagem = perfil.plano === "pro";
  const ehInternacional = modo === "internacional";
  // Config do país da busca (Brasil nas abas Negócios e Hospedagem).
  const paisBusca = configPais(ehInternacional ? pais : null);
  // O resultado na tela é de uma busca internacional? (Pode ser diferente
  // da aba escolhida agora.)
  const resultadoInternacional = infoBusca?.modo === "internacional";
  const semBuscas = perfil.buscasRestantes <= 0;

  const contagens = useMemo(() => {
    const c: Record<Situacao, number> = { sem_site: 0, booking: 0, rede_social: 0, site_proprio: 0 };
    for (const l of leads) c[l.situacao]++;
    return c;
  }, [leads]);

  const contagensConfianca = useMemo(() => {
    const c: Record<NivelConfianca, number> = { verde: 0, amarelo: 0, vermelho: 0 };
    for (const l of leads) if (l.confianca) c[l.confianca.nivel]++;
    return c;
  }, [leads]);
  const temSelo = contagensConfianca.verde + contagensConfianca.amarelo + contagensConfianca.vermelho > 0;

  const leadsFiltrados = useMemo(() => {
    const texto = textoEndereco.trim().toLowerCase();
    return leads
      .filter(
        (l) =>
          situacoesAtivas[l.situacao] &&
          l.nota >= minNota &&
          l.avaliacoes >= minAvaliacoes &&
          (!apenasCelular || resultadoInternacional || l.temCelular) &&
          (!apenasAberto || l.aberto) &&
          passaFiltroConfianca(l.confianca, filtroConfianca) &&
          (!esconderDesbloqueados || !l.contato) &&
          (!texto || l.bairro.toLowerCase().includes(texto)),
      )
      .sort(ORDENS[ordenarPor]);
  }, [
    leads,
    situacoesAtivas,
    minNota,
    minAvaliacoes,
    apenasCelular,
    resultadoInternacional,
    apenasAberto,
    filtroConfianca,
    esconderDesbloqueados,
    textoEndereco,
    ordenarPor,
  ]);

  // O tour destaca o botão Desbloquear do primeiro lead ainda fechado.
  const primeiroBloqueado = leadsFiltrados.find((l) => !l.contato)?.id;

  function alternarModo(novoModo: Modo) {
    if (novoModo !== "negocios" && !podeHospedagem) return;
    setModo(novoModo);
  }

  async function buscar() {
    setErro(null);
    setAviso(null);
    setFechadosOcultos(0);
    setDeOutroPais(0);
    if (!termos.length) return setErro("Digite ao menos um nicho.");
    if (!listaAreas.length) return setErro("Digite ao menos uma região.");
    if (modo === "hospedagem" && !podeHospedagem) {
      return setErro("O modo Hospedagem é exclusivo do plano Pro.");
    }
    if (ehInternacional && !podeHospedagem) {
      return setErro("A aba Internacional é exclusiva do plano Pro.");
    }
    if (estimativaBuscas > perfil.buscasRestantes) {
      return setErro(
        `Isso gastaria ${estimativaBuscas} busca(s), mas você só tem ${perfil.buscasRestantes} disponível(is).`,
      );
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/leads/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicho, areas, modo, ...(ehInternacional ? { pais } : {}) }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.erro || "Não foi possível buscar agora.");
        return;
      }
      // Só aqui (busca nova, já cobrada) o resultado anterior é substituído.
      setLeads(dados.leads as LeadResultado[]);
      setPerfil((p) => ({ ...p, buscasRestantes: dados.buscasRestantes }));
      setAviso(dados.aviso || null);
      setFechadosOcultos(Number(dados.fechadosOcultos) || 0);
      setDeOutroPais(Number(dados.deOutroPais) || 0);
      setBuscaFeita(true);
      setExpirada(null);
      setInfoBusca({
        termos: dados.termos,
        areas: dados.areas,
        modo: dados.modo,
        pais: dados.pais ?? null,
        feitaEm: dados.feitaEm,
        expiraEm: dados.expiraEm,
      });
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setCarregando(false);
    }
  }

  async function limparPesquisa() {
    const ok = window.confirm(
      "Limpar esta pesquisa? O resultado sai da tela e não volta sem uma busca nova (que gasta do seu saldo). Os leads que você já desbloqueou continuam em Meus leads.",
    );
    if (!ok) return;
    setErro(null);
    setLimpando(true);
    try {
      const res = await fetch("/api/leads/ultima-busca", { method: "DELETE" });
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.erro || "Não foi possível limpar a pesquisa agora.");
        return;
      }
      setLeads([]);
      setBuscaFeita(false);
      setInfoBusca(null);
      setExpirada(null);
      setAviso(null);
      setFechadosOcultos(0);
      setDeOutroPais(0);
      setNicho("");
      setAreas("");
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setLimpando(false);
    }
  }

  async function desbloquear(lead: LeadResultado) {
    // Lead já desbloqueado antes não gasta crédito de novo.
    if (!lead.desbloqueado && perfil.creditosDesbloqueio < 1) {
      setErro("Você não tem créditos de desbloqueio disponíveis.");
      return;
    }
    if (!lead.desbloqueado && lead.confianca?.nivel === "vermelho") {
      const ok = window.confirm(
        `Este lead parece inativo (${lead.confianca.motivo}). Tem certeza que quer usar 1 crédito?`,
      );
      if (!ok) return;
    }
    setDesbloqueando((d) => ({ ...d, [lead.id]: true }));
    try {
      const res = await fetch("/api/leads/desbloquear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: lead.id }),
      });
      const dados = await res.json();
      if (!res.ok && dados.creditosRestantes === undefined) {
        setErro(dados.erro || "Não foi possível desbloquear agora.");
        return;
      }
      setPerfil((p) => ({ ...p, creditosDesbloqueio: dados.creditosRestantes }));
      if (dados.erro) {
        setErro(dados.erro);
      }
      if (dados.contato) {
        setLeads((atual) =>
          atual.map((l) => (l.id === lead.id ? { ...l, contato: dados.contato } : l)),
        );
      }
    } catch {
      setErro("Não foi possível falar com o servidor agora.");
    } finally {
      setDesbloqueando((d) => ({ ...d, [lead.id]: false }));
    }
  }

  return (
    <div>
      <TituloPagina
        titulo="Buscar leads"
        descricao="Busca no Google Maps e separa quem não tem site, quem depende de Airbnb/Booking e quem só usa app ou rede social. No plano Pro, também em outros países."
      />

      {/* data-tour: partes destacadas pelo tour da Ártemis
          (components/tour/TourArtemis.tsx). */}
      <div data-tour="saldo" className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center border border-destaque/40 bg-primary-soft px-3 py-1.5 font-semibold text-destaque">
          Plano {ROTULO_PLANO[perfil.plano] ?? perfil.plano}
        </span>
        <span className="inline-flex items-center border border-line bg-surface px-3 py-1.5 text-ink-2">
          <strong className="mr-1 font-display text-ink">{perfil.buscasRestantes}</strong> busca(s) restante(s)
        </span>
        <span data-tour="creditos" className="inline-flex items-center border border-line bg-surface px-3 py-1.5 text-ink-2">
          <strong className="mr-1 font-display text-ink">{perfil.creditosDesbloqueio}</strong> crédito(s) de desbloqueio
        </span>
      </div>

      <div data-tour="busca" className={`${CARTAO} mt-4 p-4 sm:p-6`}>
        <div role="group" aria-label="Tipo de busca" className="grid w-full grid-cols-3 gap-1 border border-line bg-canvas p-1 sm:inline-grid sm:w-auto">
          {MODOS.map((m) => {
            const bloqueado = m.pro && !podeHospedagem;
            return (
              <button
                key={m.modo}
                type="button"
                onClick={() => alternarModo(m.modo)}
                disabled={bloqueado}
                aria-pressed={modo === m.modo}
                title={bloqueado ? "Disponível no plano Pro" : undefined}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 px-2 font-display text-[13px] font-semibold uppercase tracking-[0.06em] transition sm:px-5 sm:text-sm sm:tracking-[0.08em] ${
                  modo === m.modo ? ABA_ATIVA : ABA_INATIVA
                } ${bloqueado ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {m.rotulo}
                {bloqueado && (
                  <>
                    <IconeCadeado width={14} height={14} />
                    <span className="sr-only">(exclusivo do plano Pro)</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {ehInternacional && (
          <fieldset className="mt-4">
            <legend className={ROTULO}>País</legend>
            <div className="flex flex-wrap gap-2">
              {PAISES_INTERNACIONAIS.map((codigo) => {
                const p = PAISES[codigo];
                const ativo = pais === codigo;
                return (
                  <button
                    key={codigo}
                    type="button"
                    onClick={() => setPais(codigo)}
                    aria-pressed={ativo}
                    className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold transition ${
                      ativo ? "border-destaque bg-primary-soft text-destaque" : "border-line bg-surface text-ink-2 hover:text-ink"
                    }`}
                  >
                    <span aria-hidden="true">{p.bandeira}</span>
                    {p.nome}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
              <IconeGlobo width={16} height={16} className="mt-0.5 shrink-0" />
              Digite o nicho em inglês, do jeito que as empresas aparecem no Google de lá. A tela continua em português.
            </p>
          </fieldset>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nicho" className={ROTULO}>
              {modo === "hospedagem"
                ? "Tipos de hospedagem (separe por vírgula)"
                : ehInternacional
                  ? "Nicho em inglês (pode separar por vírgula)"
                  : "Nicho (pode separar por vírgula)"}
            </label>
            <input
              id="nicho"
              className={CAMPO}
              lang={ehInternacional ? "en" : undefined}
              placeholder={modo === "hospedagem" ? "chalé, cabana, pousada" : paisBusca.exemploNicho}
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="areas" className={ROTULO}>
              {ehInternacional ? "Cidades ou estados (separe por vírgula)" : "Regiões (separe por vírgula)"}
            </label>
            <input
              id="areas"
              className={CAMPO}
              placeholder={paisBusca.exemploRegiao}
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {estimativaBuscas > 0
              ? `${termos.length} termo(s) × ${listaAreas.length} região(ões): vai gastar ${estimativaBuscas} busca(s) do seu saldo (até ${estimativaBuscas * 3} chamadas à API do Google).`
              : "Até 3 páginas de resultado do Google por busca."}
          </p>
          <button
            type="button"
            onClick={buscar}
            disabled={carregando}
            className={`${BOTAO} w-full shrink-0 px-7! text-base! sm:w-auto`}
          >
            <IconeBuscar width={18} height={18} />
            {carregando ? "Buscando..." : "Buscar leads"}
          </button>
        </div>

        {erro && (
          <div role="alert" className={`${ALERTA_ERRO} mt-4`}>
            {erro}
          </div>
        )}
        {aviso && (
          <div role="status" className={`${ALERTA_AVISO} mt-4`}>
            {aviso}
          </div>
        )}
      </div>

      {/* Saldo zerado: aviso de limite (no lugar do estado vazio). */}
      {semBuscas && !carregando && (
        <div data-tour="resultado" className="mt-6">
          <LimitePlano
            titulo="Suas buscas acabaram"
            texto="Você usou todas as buscas do seu plano. Assine um plano ou compre um pacote extra para continuar caçando leads."
          />
        </div>
      )}

      {carregando && !buscaFeita && <ListaEsqueleto quantidade={3} />}

      {expirada && !buscaFeita && !carregando && (
        <div data-tour="resultado" className="mt-6">
          <EstadoVazio
            icone={<IconeBuscar width={26} height={26} />}
            titulo="Esta busca expirou"
            texto={
              <>
                A busca por <strong>{expirada.termos.join(", ")}</strong> em{" "}
                <strong>{expirada.areas.join(", ")}</strong>, feita{" "}
                <span suppressHydrationWarning>{quandoFoi(expirada.feitaEm)}</span>, ficou salva por{" "}
                {VALIDADE_CACHE_DIAS} dias, o prazo máximo que o Google permite guardar esses dados. Os termos
                já estão preenchidos acima: é só buscar de novo (gasta do seu saldo). Os leads que você
                desbloqueou continuam em <Link href="/painel/meus-leads" className="font-semibold text-destaque underline">Meus leads</Link>.
              </>
            }
          >
            <button type="button" onClick={limparPesquisa} disabled={limpando} className={BOTAO_NEUTRO}>
              {limpando ? "Limpando..." : "Limpar pesquisa"}
            </button>
          </EstadoVazio>
        </div>
      )}

      {!buscaFeita && !expirada && !carregando && !semBuscas && (
        <div data-tour="resultado" className="mt-6">
          <EstadoVazio
            logo
            titulo="Sua lista de leads aparece aqui"
            texto={
              <>
                Comece simples: um nicho e o seu bairro, como <strong>“barbearia”</strong> em{" "}
                <strong>“Centro Palhoça SC”</strong>. Depois é só filtrar e desbloquear os melhores.
              </>
            }
          />
        </div>
      )}

      {buscaFeita && infoBusca && (
        <div className={`${CARTAO} mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="min-w-0 text-sm text-ink-2">
            <p>
              Resultado de <strong className="text-ink" suppressHydrationWarning>{quandoFoi(infoBusca.feitaEm)}</strong>
              {rotuloModo(infoBusca)}:{" "}
              <strong className="break-words text-ink">{infoBusca.termos.join(", ")}</strong> em{" "}
              <strong className="break-words text-ink">{infoBusca.areas.join(", ")}</strong>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {infoBusca.expiraEm
                ? `Fica salvo até ${dataCurta(infoBusca.expiraEm)}, mesmo se você sair desta página. Voltar aqui não gasta busca.`
                : "Não foi possível salvar este resultado: ele some se você sair desta página."}
            </p>
          </div>
          <button
            type="button"
            onClick={limparPesquisa}
            disabled={limpando || carregando}
            className={`${BOTAO_NEUTRO} w-full shrink-0 sm:w-auto`}
          >
            {limpando ? "Limpando..." : "Limpar pesquisa"}
          </button>
        </div>
      )}

      {buscaFeita && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <button
            type="button"
            onClick={() => setFiltrosAbertos((a) => !a)}
            aria-expanded={filtrosAbertos}
            aria-controls="filtros-busca"
            className={`${BOTAO_NEUTRO} w-full lg:hidden`}
          >
            <IconeFiltro width={18} height={18} />
            {filtrosAbertos ? "Esconder filtros" : "Categorias e filtros"}
          </button>

          <aside id="filtros-busca" className={`${filtrosAbertos ? "flex" : "hidden"} flex-col gap-3 lg:flex`}>
            <div className={`${CARTAO} p-4`}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.2em] text-ink">Categorias</h2>
              <div className="flex flex-col text-sm">
                {(
                  [
                    ["sem_site", "Sem site"],
                    ["booking", "Depende do Airbnb/Booking"],
                    ["rede_social", "Só app ou rede social"],
                    ["site_proprio", "Site próprio"],
                  ] as [Situacao, string][]
                ).map(([chave, rotulo]) => (
                  <label key={chave} className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-ink-2">
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className={CHECKBOX}
                        checked={situacoesAtivas[chave]}
                        onChange={(e) =>
                          setSituacoesAtivas((s) => ({ ...s, [chave]: e.target.checked }))
                        }
                      />
                      {rotulo}
                    </span>
                    <span className="font-semibold text-muted">{contagens[chave]}</span>
                  </label>
                ))}
              </div>
            </div>

            {temSelo && (
              <fieldset className={`${CARTAO} p-4`}>
                <legend className="sr-only">Confiança</legend>
                <h2 aria-hidden="true" className="mb-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-ink">
                  Confiança
                </h2>
                <p className="mb-1 text-xs text-muted">Se a empresa parece ainda existir e atender.</p>
                <div className="flex flex-col text-sm">
                  {(
                    [
                      ["todos", "Todos", leads.length],
                      [
                        "verde_amarelo",
                        `${ROTULO_CONFIANCA.verde} e ${ROTULO_CONFIANCA.amarelo.toLowerCase()}`,
                        contagensConfianca.verde + contagensConfianca.amarelo,
                      ],
                      ["verde", `Só ${ROTULO_CONFIANCA.verde.toLowerCase()}`, contagensConfianca.verde],
                    ] as [FiltroConfianca, string, number][]
                  ).map(([valor, rotulo, qtd]) => (
                    <label key={valor} className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-ink-2">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="filtro-confianca"
                          className={CHECKBOX}
                          checked={filtroConfianca === valor}
                          onChange={() => setFiltroConfianca(valor)}
                        />
                        {rotulo}
                      </span>
                      <span className="font-semibold text-muted">{qtd}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className={`${CARTAO} p-4`}>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-ink">Filtros</h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="min-nota" className="mb-1 block text-xs font-semibold text-ink-2">Nota mínima</label>
                  <select
                    id="min-nota"
                    className={CAMPO}
                    value={minNota}
                    onChange={(e) => setMinNota(parseFloat(e.target.value))}
                  >
                    <option value={0}>Qualquer</option>
                    <option value={3.5}>3,5+</option>
                    <option value={4}>4,0+</option>
                    <option value={4.5}>4,5+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="min-avaliacoes" className="mb-1 block text-xs font-semibold text-ink-2">Avaliações</label>
                  <input
                    id="min-avaliacoes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={CAMPO}
                    value={minAvaliacoes}
                    onChange={(e) => setMinAvaliacoes(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <label htmlFor="bairro-contem" className="mb-1 mt-3 block text-xs font-semibold text-ink-2">
                {resultadoInternacional ? "Bairro ou cidade contém" : "Bairro contém"}
              </label>
              <input
                id="bairro-contem"
                className={CAMPO}
                placeholder={resultadoInternacional ? "ex.: Downtown" : "ex.: Centro"}
                value={textoEndereco}
                onChange={(e) => setTextoEndereco(e.target.value)}
              />
              <div className="mt-2 flex flex-col text-sm text-ink-2">
                {/* Fora do Brasil não dá para saber se o número é celular,
                    e o contato é por telefone mesmo. */}
                {!resultadoInternacional && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                    <input type="checkbox" className={CHECKBOX} checked={apenasCelular} onChange={(e) => setApenasCelular(e.target.checked)} />
                    Só com celular
                  </label>
                )}
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input type="checkbox" className={CHECKBOX} checked={apenasAberto} onChange={(e) => setApenasAberto(e.target.checked)} />
                  Só em funcionamento
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={esconderDesbloqueados}
                    onChange={(e) => setEsconderDesbloqueados(e.target.checked)}
                  />
                  Esconder já desbloqueados
                </label>
              </div>
            </div>
          </aside>

          <section data-tour="resultado" aria-label="Resultados" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2" aria-live="polite">
                <strong className="font-display text-ink">{leadsFiltrados.length}</strong> de {leads.length} leads
                {fechadosOcultos > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {fechadosOcultos} {fechadosOcultos === 1 ? "empresa fechada" : "empresas fechadas"} definitivamente{" "}
                    {fechadosOcultos === 1 ? "ficou" : "ficaram"} de fora
                  </span>
                )}
                {deOutroPais > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {deOutroPais} de outro país {deOutroPais === 1 ? "ficou" : "ficaram"} de fora
                  </span>
                )}
              </p>
              <label htmlFor="ordenar" className="sr-only">Ordenar por</label>
              <select
                id="ordenar"
                className={`${CAMPO} w-auto! text-sm!`}
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value as keyof typeof ORDENS)}
              >
                <option value="pontuacao">Maior pontuação</option>
                <option value="avaliacoes">Mais avaliações</option>
                <option value="nota">Melhor nota</option>
                <option value="nome">Nome (A–Z)</option>
              </select>
            </div>

            <div className="flex flex-col gap-3">
              {leadsFiltrados.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  modelos={modelos}
                  tour={lead.id === primeiroBloqueado}
                  carregando={!!desbloqueando[lead.id]}
                  onDesbloquear={() => desbloquear(lead)}
                />
              ))}
              {!leadsFiltrados.length && (
                <EstadoVazio
                  icone={<IconeFiltro width={26} height={26} />}
                  titulo={leads.length ? "Nenhum lead com esses filtros" : "A busca não trouxe resultados"}
                  texto={
                    leads.length
                      ? "Baixe a nota mínima, zere as avaliações, inclua mais níveis de confiança ou ative mais categorias para ver mais leads."
                      : resultadoInternacional
                        ? "Confira se o nicho está em inglês (ex.: barber shop) e tente uma cidade maior ou o estado."
                        : "Tente um nicho mais comum ou uma região maior (o nome da cidade, por exemplo)."
                  }
                />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  modelos,
  tour,
  carregando,
  onDesbloquear,
}: {
  lead: LeadResultado;
  modelos: ModelosPorIdioma;
  tour: boolean;
  carregando: boolean;
  onDesbloquear: () => void;
}) {
  const eHospedagem = lead.modo === "hospedagem" || lead.situacao === "booking";
  const modeloMsg = eHospedagem ? MSG_PADRAO_HOSPEDAGEM : MSG_PADRAO_NEGOCIOS;
  const plataforma = lead.plataforma || (eHospedagem ? "Airbnb ou Booking" : "redes sociais");
  // Lead de fora do Brasil: telefone internacional, Maps e mensagem no
  // idioma do país, no lugar do WhatsApp.
  const internacional = !!lead.pais && lead.pais !== "BR";
  const idioma = configPais(lead.pais).idiomaMensagem;
  const msgCurta =
    idioma === "pt" ? montarMensagem(modeloMsg, lead.nome, plataforma) : preencherModelo(modelos[idioma].curta, lead.nome);

  return (
    <article className={`${CARTAO} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
          <Score pontos={lead.pontuacao} title={`Pontuação de lead: ${lead.pontuacao} de 100`} />

          <div className="min-w-0 flex-1">
            <h3 className="break-words font-sans text-base font-extrabold text-ink">{lead.nome}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <EtiquetaSituacao situacao={lead.situacao} plataforma={lead.plataforma} />
              {lead.tipo && <span className="text-xs text-muted">{lead.tipo}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <span className="min-w-0 break-words">{lead.bairro || lead.area}</span>
              {lead.nota ? (
                <span className="inline-flex items-center gap-1">
                  <IconeEstrela className="text-ink-2" />
                  {lead.nota.toFixed(1).replace(".", ",")}{" "}
                  <span className="text-muted">({lead.avaliacoes})</span>
                </span>
              ) : (
                <span className="text-muted">Sem avaliações</span>
              )}
              {!lead.aberto && !lead.confianca && <span className="font-semibold text-danger">Fechado</span>}
            </div>
            {(lead.confianca || lead.fuso) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {lead.confianca && <SeloConfianca confianca={lead.confianca} />}
                {lead.fuso && <HoraLocal fuso={lead.fuso} />}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap [&>*]:flex-1 sm:[&>*]:flex-none">
          {lead.contato && internacional ? (
            <BotoesContatoInternacional
              pais={lead.pais}
              telefone={lead.contato.telefone}
              whatsapp={lead.contato.whatsapp}
              maps={lead.contato.maps}
              site={lead.contato.site}
              mensagemWhatsapp={msgCurta}
            />
          ) : lead.contato ? (
            <>
              {lead.contato.whatsapp ? (
                <a
                  target="_blank"
                  rel="noopener"
                  href={linkWhatsapp(lead.contato.whatsapp, montarMensagem(modeloMsg, lead.nome, plataforma))}
                  className={BOTAO_WHATSAPP}
                >
                  <IconeWhatsapp width={18} height={18} />
                  WhatsApp
                </a>
              ) : (
                <span className="text-sm text-ink-2">{lead.contato.telefone || "Sem telefone"}</span>
              )}
              {lead.contato.maps && (
                <a target="_blank" rel="noopener" href={lead.contato.maps} className={BOTAO_NEUTRO}>
                  <IconeMapa width={18} height={18} />
                  Maps
                </a>
              )}
              {lead.contato.site && (
                <a target="_blank" rel="noopener" href={lead.contato.site} className={BOTAO_NEUTRO}>
                  <IconeLink width={18} height={18} />
                  Link
                </a>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onDesbloquear}
              disabled={carregando}
              data-tour={tour ? "desbloquear" : undefined}
              className={BOTAO_NEUTRO}
            >
              <IconeCadeado width={13} height={13} />
              {carregando
                ? "Desbloqueando..."
                : lead.desbloqueado
                  ? "Ver contato (já pago)"
                  : "Desbloquear (1 crédito)"}
            </button>
          )}
        </div>
      </div>

      {lead.contato && internacional && (
        <div className="border-t border-line pt-3">
          <MensagemPronta pais={lead.pais} nome={lead.nome} modelosPorIdioma={modelos} />
        </div>
      )}
    </article>
  );
}
