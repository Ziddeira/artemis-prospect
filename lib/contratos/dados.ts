// Gerador de contrato de criação de site (etapa 24): respostas do
// questionário, modelo padrão, validação e pendências. Serve para a tela
// e para o servidor. Quem confere plano, dono e situação do contrato é o
// banco (supabase/etapa24-2-contratos-funcoes.sql).
import { cnpjValido, cpfValido, formatarCnpj, formatarCpf, limparCnpj, soDigitos } from "./documentos";

export type StatusContrato = "rascunho" | "enviado" | "assinado";
export type ModoContrato = "padrao" | "questionario";

export const ROTULO_STATUS: Record<StatusContrato, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
};

export const ESTILO_STATUS: Record<StatusContrato, string> = {
  rascunho: "bg-canvas text-ink-2 border-line-strong",
  enviado: "bg-primary-soft text-destaque border-destaque/60",
  assinado: "bg-primary text-primary-ink border-primary",
};

export function ehStatusContrato(valor: unknown): valor is StatusContrato {
  return valor === "rascunho" || valor === "enviado" || valor === "assinado";
}

// Situações do lead (funil) que liberam o botão "Gerar contrato". O banco
// confere o mesmo em criar_contrato.
export const SITUACOES_CONTRATO = ["negociacao", "fechado"] as const;

export interface Contratante {
  tipo: "pf" | "pj";
  nome: string;
  documento: string;
  endereco: string;
  // Quem assina pela empresa (pessoa jurídica). Pessoa física assina por si.
  assinanteNome: string;
  assinanteCargo: string;
}

export interface Prestador {
  // pf = pessoa física (CPF); pj = MEI ou outra empresa (CNPJ).
  tipo: "pf" | "pj";
  nome: string;
  documento: string;
  endereco: string;
  email: string;
  // Quem assina pelo CNPJ (no MEI, o próprio dono).
  responsavelNome: string;
}

export interface Escopo {
  tipo: "site" | "landing";
  paginas: number;
  formulario: boolean;
  whatsapp: boolean;
  rodadas: number;
  prazoDias: number;
  extras: string;
}

export type MeioPagamento = "pix" | "transferencia" | "boleto" | "cartao";

export interface Pagamento {
  valor: number | null;
  forma: "avista" | "parcelado";
  parcelas: number;
  meio: MeioPagamento;
  jaPago: "nao" | "parcial" | "total";
  valorPago: number | null;
}

export type Lado = "contratante" | "prestador";

export interface Hospedagem {
  paga: Lado;
  titular: Lado;
}

export interface Manutencao {
  tipo: "unica" | "mensal";
  valorMensal: number | null;
  inclui: string;
}

export type Propriedade = "cessao" | "licenca";

export interface Foro {
  cidade: string;
  uf: string;
}

export interface DadosContrato {
  contratante: Contratante;
  prestador: Prestador;
  escopo: Escopo;
  pagamento: Pagamento;
  hospedagem: Hospedagem;
  manutencao: Manutencao;
  propriedade: Propriedade;
  foro: Foro;
}

export const MEIOS_PAGAMENTO: { id: MeioPagamento; nome: string; texto: string }[] = [
  { id: "pix", nome: "PIX", texto: "PIX" },
  { id: "transferencia", nome: "Transferência bancária", texto: "transferência bancária" },
  { id: "boleto", nome: "Boleto", texto: "boleto bancário" },
  { id: "cartao", nome: "Cartão de crédito", texto: "cartão de crédito" },
];

// As duas opções de propriedade, em uma frase cada, para a pessoa
// escolher sabendo o que cada uma quer dizer.
export const OPCOES_PROPRIEDADE: { id: Propriedade; nome: string; explicacao: string }[] = [
  {
    id: "cessao",
    nome: "O código e o design passam ao cliente após o pagamento",
    explicacao:
      "Depois de pagar tudo, o site é do cliente: ele pode mexer, trocar de profissional e levar o site junto, sem te pagar mais nada.",
  },
  {
    id: "licenca",
    nome: "Licença de uso enquanto a manutenção for paga",
    explicacao:
      "O site continua sendo seu e o cliente só pode usá-lo enquanto pagar a mensalidade; se parar de pagar, o direito de uso acaba.",
  },
];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// O que o modelo padrão já traz pronto (os passos 3, 5, 6 e 7 do
// questionário). As partes, o valor e o foro a pessoa sempre preenche.
export const PADRAO_ESCOPO: Escopo = {
  tipo: "site",
  paginas: 5,
  formulario: true,
  whatsapp: true,
  rodadas: 2,
  prazoDias: 20,
  extras: "",
};
export const PADRAO_HOSPEDAGEM: Hospedagem = { paga: "contratante", titular: "contratante" };
export const PADRAO_MANUTENCAO: Manutencao = {
  tipo: "unica",
  valorMensal: null,
  inclui: "",
};
export const PADRAO_PROPRIEDADE: Propriedade = "cessao";
export const INCLUI_MANUTENCAO_SUGERIDO =
  "atualização de textos e imagens (até 2 pedidos por mês), cópia de segurança mensal, correção de falhas e acompanhamento da hospedagem";

// Resumo do modelo padrão, para a tela.
export const RESUMO_PADRAO = [
  "Site institucional de até 5 páginas, com formulário de contato e botão de WhatsApp",
  "2 rodadas de ajustes e entrega em até 20 dias úteis",
  "Hospedagem e domínio pagos pelo cliente e registrados no nome dele",
  "Entrega única, com 30 dias para correção de falhas",
  "Código e design passam ao cliente depois do pagamento total",
];

export function dadosVazios(): DadosContrato {
  return {
    contratante: { tipo: "pj", nome: "", documento: "", endereco: "", assinanteNome: "", assinanteCargo: "" },
    prestador: { tipo: "pf", nome: "", documento: "", endereco: "", email: "", responsavelNome: "" },
    escopo: { ...PADRAO_ESCOPO },
    pagamento: { valor: null, forma: "avista", parcelas: 2, meio: "pix", jaPago: "nao", valorPago: null },
    hospedagem: { ...PADRAO_HOSPEDAGEM },
    manutencao: { ...PADRAO_MANUTENCAO },
    propriedade: PADRAO_PROPRIEDADE,
    foro: { cidade: "", uf: "" },
  };
}

// Volta os passos que o modelo padrão traz prontos para o padrão.
export function aplicarPadrao(dados: DadosContrato): DadosContrato {
  return {
    ...dados,
    escopo: { ...PADRAO_ESCOPO },
    hospedagem: { ...PADRAO_HOSPEDAGEM },
    manutencao: { ...PADRAO_MANUTENCAO },
    propriedade: PADRAO_PROPRIEDADE,
  };
}

// Validação ---------------------------------------------------------------

function texto(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function inteiro(valor: unknown, min: number, max: number, padrao: number): number {
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
}

function dinheiro(valor: unknown): number | null | "invalido" {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return "invalido";
  return Math.round(n * 100) / 100;
}

function escolha<T extends string>(valor: unknown, opcoes: readonly T[], padrao: T): T {
  return opcoes.includes(valor as T) ? (valor as T) : padrao;
}

function obj(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

// Documento formatado conforme o tipo, ou erro se estiver preenchido e
// não passar na conferência dos dígitos. Vazio é aceito (pendência).
function documento(valor: unknown, tipo: "pf" | "pj", quem: string): string | { erro: string } {
  const bruto = texto(valor, 30);
  if (!bruto) return "";
  if (tipo === "pf") {
    if (!cpfValido(bruto)) return { erro: `Confira o CPF ${quem}: os números não batem.` };
    return formatarCpf(bruto);
  }
  if (!cnpjValido(bruto)) return { erro: `Confira o CNPJ ${quem}: os números não batem.` };
  return formatarCnpj(bruto);
}

// Confere e limpa as respostas. Campo vazio passa (vira pendência e só
// impede o envio); campo preenchido com formato errado é recusado.
export function validarDadosContrato(corpo: unknown): { dados: DadosContrato } | { erro: string } {
  const c = obj(corpo);
  const ct = obj(c.contratante);
  const pr = obj(c.prestador);
  const es = obj(c.escopo);
  const pg = obj(c.pagamento);
  const ho = obj(c.hospedagem);
  const ma = obj(c.manutencao);
  const fo = obj(c.foro);

  const tipoContratante = escolha(ct.tipo, ["pf", "pj"] as const, "pj");
  const docContratante = documento(ct.documento, tipoContratante, "do contratante");
  if (typeof docContratante === "object") return docContratante;
  const contratante: Contratante = {
    tipo: tipoContratante,
    nome: texto(ct.nome, 160),
    documento: docContratante,
    endereco: texto(ct.endereco, 240),
    assinanteNome: tipoContratante === "pj" ? texto(ct.assinanteNome, 120) : "",
    assinanteCargo: tipoContratante === "pj" ? texto(ct.assinanteCargo, 60) : "",
  };
  if (contratante.nome.length < 2) return { erro: "Informe o nome da empresa contratante." };

  const tipoPrestador = escolha(pr.tipo, ["pf", "pj"] as const, "pf");
  const docPrestador = documento(pr.documento, tipoPrestador, "do prestador");
  if (typeof docPrestador === "object") return docPrestador;
  const email = texto(pr.email, 200).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "Confira o e-mail do prestador." };
  const prestador: Prestador = {
    tipo: tipoPrestador,
    nome: texto(pr.nome, 160),
    documento: docPrestador,
    endereco: texto(pr.endereco, 240),
    email,
    responsavelNome: tipoPrestador === "pj" ? texto(pr.responsavelNome, 120) : "",
  };

  const tipoEscopo = escolha(es.tipo, ["site", "landing"] as const, "site");
  const escopo: Escopo = {
    tipo: tipoEscopo,
    paginas: tipoEscopo === "landing" ? 1 : inteiro(es.paginas, 1, 50, PADRAO_ESCOPO.paginas),
    formulario: es.formulario !== false,
    whatsapp: es.whatsapp !== false,
    rodadas: inteiro(es.rodadas, 0, 10, PADRAO_ESCOPO.rodadas),
    prazoDias: inteiro(es.prazoDias, 1, 180, PADRAO_ESCOPO.prazoDias),
    extras: texto(es.extras, 300),
  };

  const valor = dinheiro(pg.valor);
  if (valor === "invalido") return { erro: "Confira o valor do contrato." };
  const valorPago = dinheiro(pg.valorPago);
  if (valorPago === "invalido") return { erro: "Confira o valor já pago." };
  const jaPago = escolha(pg.jaPago, ["nao", "parcial", "total"] as const, "nao");
  if (jaPago === "parcial" && valor !== null && valorPago !== null && valorPago >= valor) {
    return { erro: "O valor já pago precisa ser menor que o total. Se pagou tudo, marque “pagamento total”." };
  }
  const pagamento: Pagamento = {
    valor,
    forma: escolha(pg.forma, ["avista", "parcelado"] as const, "avista"),
    parcelas: inteiro(pg.parcelas, 2, 24, 2),
    meio: escolha(pg.meio, MEIOS_PAGAMENTO.map((m) => m.id), "pix"),
    jaPago,
    valorPago: jaPago === "parcial" ? valorPago : null,
  };

  const hospedagem: Hospedagem = {
    paga: escolha(ho.paga, ["contratante", "prestador"] as const, "contratante"),
    titular: escolha(ho.titular, ["contratante", "prestador"] as const, "contratante"),
  };

  const valorMensal = dinheiro(ma.valorMensal);
  if (valorMensal === "invalido") return { erro: "Confira o valor da mensalidade." };
  const tipoManutencao = escolha(ma.tipo, ["unica", "mensal"] as const, "unica");
  const manutencao: Manutencao = {
    tipo: tipoManutencao,
    valorMensal: tipoManutencao === "mensal" ? valorMensal : null,
    inclui: tipoManutencao === "mensal" ? texto(ma.inclui, 400) : "",
  };

  const propriedade = escolha(c.propriedade, ["cessao", "licenca"] as const, "cessao");
  if (propriedade === "licenca" && manutencao.tipo !== "mensal") {
    return {
      erro: "A licença de uso depende de uma mensalidade. Escolha manutenção mensal ou a passagem do código ao cliente.",
    };
  }

  const uf = texto(fo.uf, 2).toUpperCase();
  if (uf && !(UFS as readonly string[]).includes(uf)) return { erro: "Escolha o estado (UF) do foro." };
  const foro: Foro = { cidade: texto(fo.cidade, 80), uf };

  return { dados: { contratante, prestador, escopo, pagamento, hospedagem, manutencao, propriedade, foro } };
}

// O que ainda falta para poder enviar ao cliente.
export function pendencias(d: DadosContrato): string[] {
  const p: string[] = [];
  const docContratante = d.contratante.tipo === "pf" ? "CPF" : "CNPJ";
  if (!d.contratante.documento) p.push(`${docContratante} do contratante`);
  if (!d.contratante.endereco) p.push("Endereço do contratante");
  if (d.contratante.tipo === "pj" && !d.contratante.assinanteNome) p.push("Quem assina pela empresa contratante");
  if (!d.prestador.nome) p.push("Seu nome (prestador)");
  if (!d.prestador.documento) p.push(`Seu ${d.prestador.tipo === "pf" ? "CPF" : "CNPJ"} (prestador)`);
  if (!d.prestador.endereco) p.push("Seu endereço (prestador)");
  if (d.prestador.tipo === "pj" && !d.prestador.responsavelNome) p.push("Quem assina pelo seu CNPJ");
  if (!d.pagamento.valor) p.push("Valor do contrato");
  if (d.pagamento.jaPago === "parcial" && !d.pagamento.valorPago) p.push("Quanto já foi pago");
  if (d.manutencao.tipo === "mensal" && !d.manutencao.valorMensal) p.push("Valor da mensalidade");
  if (d.manutencao.tipo === "mensal" && !d.manutencao.inclui) p.push("O que a manutenção inclui");
  if (!d.foro.cidade || !d.foro.uf) p.push("Cidade e estado do foro");
  return p;
}

// Valores iniciais do questionário: dados do lead e, do prestador, os do
// último contrato que a pessoa fez (para não digitar tudo de novo).
export function dadosIniciais({
  nomeLead,
  enderecoLead,
  prestadorAnterior,
  email,
}: {
  nomeLead: string;
  enderecoLead: string;
  prestadorAnterior: Partial<Prestador> | null;
  email: string;
}): DadosContrato {
  const d = dadosVazios();
  d.contratante.nome = nomeLead.slice(0, 160);
  d.contratante.endereco = enderecoLead.slice(0, 240);
  if (prestadorAnterior) {
    const r = validarDadosContrato({ contratante: { nome: "xx" }, prestador: prestadorAnterior });
    if ("dados" in r) d.prestador = r.dados.prestador;
  }
  if (!d.prestador.email) d.prestador.email = email.slice(0, 200);
  return d;
}

// Identificação curta da parte para o campo de assinatura.
export function documentoRotulado(tipo: "pf" | "pj", documento: string) {
  if (!documento) return "";
  return `${tipo === "pf" ? "CPF" : "CNPJ"} ${documento}`;
}

// Erro de função ou tabela que ainda não existe no banco: os scripts da
// etapa 24 não foram rodados.
export function faltaEtapa24(codigo: string | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42703", "42P01"].includes(codigo ?? "");
}

export const MSG_FALTA_ETAPA24 =
  "O gerador de contratos ainda não está ativo: falta rodar os scripts da etapa 24 no Supabase.";

// Formatação de documento enquanto a pessoa digita (só para a tela).
export function mascaraDocumento(tipo: "pf" | "pj", texto: string) {
  if (tipo === "pf") {
    const d = soDigitos(texto).slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  const c = limparCnpj(texto).slice(0, 14);
  return c
    .replace(/^(\w{2})(\w)/, "$1.$2")
    .replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3")
    .replace(/^(\w{2})\.(\w{3})\.(\w{3})(\w)/, "$1.$2.$3/$4")
    .replace(/\/(\w{4})(\w)/, "/$1-$2");
}
