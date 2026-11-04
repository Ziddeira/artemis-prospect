// Gestão > Laura: tipos dos dados que a função SQL laura_painel() devolve
// (supabase/vendedor-2-painel-laura.sql) e a leitura dos gargalos.

export type Periodo = "hoje" | "semana" | "mes";

export interface NumerosPeriodo {
  captados: number;
  abordados: number;
  responderam: number;
  previas: number;
  pix: number;
  pagamento_informado: number;
  fechados: number;
  receita: number;
  sinais: number;
  sem_resposta: number;
  sem_interesse: number;
  buscas: number;
  objecoes: number;
}

export interface LeadAndamento {
  id: string;
  nome: string;
  nicho: string;
  cidade: string;
  telefone: string | null;
  status: string;
  pacote: string | null;
  valor: number | null;
  sinal: number | null;
  previa_url: string | null;
  motivo: string | null;
  humano: boolean;
  pagamento_informado_em: string | null;
  ultimo_contato_em: string | null;
  respondeu_em: string | null;
}

export interface LeadRecente {
  id: string;
  nome: string;
  nicho: string;
  cidade: string;
  status: string;
  valor: number | null;
  previa_url: string | null;
  motivo: string | null;
  quando: string;
}

export interface ObjecaoResumo {
  categoria: string;
  total: number;
  contornadas: number;
  nao_contornadas: number;
  com_zidd: number;
  em_aberto: number;
}

export interface Objecao {
  id: number;
  categoria: string;
  fala: string;
  resposta: string | null;
  resultado: "contornada" | "nao_contornada" | "com_zidd" | "em_aberto";
  lead: string;
  nicho: string;
  cidade: string;
  quando: string;
}

export interface PainelLaura {
  gerado_em: string;
  periodos: Record<Periodo, NumerosPeriodo>;
  operacao: {
    pausado: boolean;
    inicio_operacao: string | null;
    em_expediente: boolean;
    abordagens_hoje: number;
    limite_hoje: number;
    buscas_hoje: number;
    buscas_dia_max: number;
    buscas_mes: number;
    buscas_mes_max: number;
    fila: number;
    ultima_atividade: string | null;
    hora_inicio: string;
    hora_fim: string;
  };
  funil_total: { captados: number; abordados: number; responderam: number; previas: number; pix: number; fechados: number };
  status: Record<string, number>;
  serie: { dia: string; abordados: number; responderam: number; fechados: number }[];
  em_andamento: LeadAndamento[];
  abordados_aguardando: number;
  recentes: LeadRecente[];
  nichos: { nicho: string; abordados: number; responderam: number; fechados: number }[];
  objecoes_resumo: ObjecaoResumo[];
  objecoes: Objecao[];
  eventos: { tipo: string; detalhe: string; quando: string }[];
}

export const NOME_NICHO: Record<string, string> = {
  barbearia: "Barbearia",
  obras: "Vidros, mármores e serralheria",
  oficina: "Oficina mecânica",
  pousada: "Hospedagem",
  estetica: "Estética",
  pet: "Pet shop",
  dedetizacao: "Dedetização",
  pilates: "Pilates e treino",
};

export const NOME_STATUS: Record<string, string> = {
  fila: "Na fila",
  abordado: "Abordado, sem resposta",
  conversando: "Conversando",
  previa_enviada: "Prévia enviada",
  sinal_enviado: "Pix enviado",
  fechado: "Fechado",
  atencao: "Com você",
  encerrado: "Encerrado",
  bloqueado: "Pediu para parar",
  descartado: "Descartado",
};

export const NOME_OBJECAO: Record<string, string> = {
  preco: "Preço",
  confianca: "Desconfiança / golpe",
  ja_tem_instagram: "Já tem Instagram",
  nao_precisa: "Não precisa de site",
  sem_tempo: "Sem tempo agora",
  vou_pensar: "Vou pensar",
  falar_com_socio: "Falar com sócio/família",
  ja_tem_site: "Já tem site / alguém fazendo",
  prazo: "Prazo",
  outra: "Outra",
};

export const NOME_RESULTADO: Record<Objecao["resultado"], string> = {
  contornada: "Contornada",
  nao_contornada: "Não contornada",
  com_zidd: "Com você",
  em_aberto: "Em aberto",
};

export interface Gargalo {
  nivel: "alto" | "medio";
  titulo: string;
  detalhe: string;
  acao: string;
}

const pct = (a: number, b: number) => (b ? a / b : 0);
const fmtPct = (x: number) => `${Math.round(x * 100)}%`;

// Lê o painel e aponta onde a produção está travando, do mais grave ao mais leve.
// As regras só disparam com amostra mínima, para não acusar gargalo com 2 leads.
export function gargalos(p: PainelLaura, agora = new Date()): Gargalo[] {
  const g: Gargalo[] = [];
  const op = p.operacao;
  const f = p.funil_total;

  // Operação
  if (op.pausado) {
    g.push({ nivel: "medio", titulo: "Laura pausada", detalhe: "Ela não aborda ninguém novo nem manda lembretes.", acao: "Mande /ligar do seu celular para o chip quando quiser voltar." });
  } else if (op.em_expediente && op.ultima_atividade) {
    const horas = (agora.getTime() - new Date(op.ultima_atividade).getTime()) / 36e5;
    if (horas >= 2) {
      g.push({ nivel: "alto", titulo: `Nenhuma atividade há ${Math.floor(horas)}h em horário de trabalho`, detalhe: "O PC pode estar desligado, sem internet, ou a janela da Laura/Docker fechada.", acao: "Confira o PC, o Docker e a janela da Laura. Mande /status para testar." });
    }
  }

  const aguardandoVoce = p.em_andamento.filter((l) => l.status === "atencao" && !l.humano);
  if (aguardandoVoce.length) {
    g.push({ nivel: "alto", titulo: `${aguardandoVoce.length} conversa(s) esperando você`, detalhe: "A Laura passou para você e ninguém respondeu ainda pelo celular do chip.", acao: "Abra a aba Funil e responda pelo celular do chip." });
  }
  const pagarConferir = p.em_andamento.filter((l) => l.pagamento_informado_em);
  if (pagarConferir.length) {
    g.push({ nivel: "alto", titulo: `${pagarConferir.length} pagamento(s) para conferir`, detalhe: "O cliente disse que pagou o sinal.", acao: "Confira na sua conta e clique em Marcar como pago na aba Funil." });
  }

  const erros = p.eventos.filter((e) => e.tipo === "erro");
  if (erros.length) {
    g.push({ nivel: erros.length >= 5 ? "alto" : "medio", titulo: `${erros.length} erro(s) nos últimos 7 dias`, detalhe: `Último: ${erros[0].detalhe}`, acao: "Se repetir, mande o print da janela da Laura." });
  }
  if (op.buscas_mes >= op.buscas_mes_max * 0.9) {
    g.push({ nivel: "alto", titulo: "Buscas do Google quase no limite do mês", detalhe: `${op.buscas_mes} de ${op.buscas_mes_max} buscas gratuitas usadas.`, acao: "A Laura vai parar de buscar até o mês virar. A fila atual continua sendo abordada." });
  } else if (op.buscas_hoje >= op.buscas_dia_max) {
    g.push({ nivel: "medio", titulo: "Limite de buscas do dia atingido", detalhe: `${op.buscas_hoje} buscas hoje.`, acao: "Normal se a fila ainda tiver leads. Se a fila zerar, poucos resultados estão passando nos filtros." });
  }
  if (!op.pausado && op.fila === 0 && op.abordagens_hoje < op.limite_hoje) {
    g.push({ nivel: "medio", titulo: "Fila de leads vazia", detalhe: "Não há empresas prontas para abordar agora.", acao: "A Laura busca sozinha; se continuar vazia, aumente a lista de cidades ou nichos." });
  }

  // Funil (amostra mínima em cada etapa)
  const resp = pct(f.responderam, f.abordados);
  if (f.abordados >= 20 && resp < 0.1) {
    g.push({ nivel: "alto", titulo: `Poucas respostas: ${fmtPct(resp)} dos abordados`, detalhe: `${f.responderam} de ${f.abordados} responderam.`, acao: "A primeira mensagem ou os nichos não estão chamando atenção. Veja quais nichos respondem menos no Panorama." });
  }
  const prev = pct(f.previas, f.responderam);
  if (f.responderam >= 6 && prev < 0.5) {
    g.push({ nivel: "medio", titulo: `Muita gente responde mas não pede a prévia (${fmtPct(prev)})`, detalhe: `${f.previas} prévias para ${f.responderam} respostas.`, acao: "Veja as objeções: provavelmente desconfiança ou 'não preciso' logo no começo." });
  }
  const pix = pct(f.pix, f.previas);
  if (f.previas >= 6 && pix < 0.2) {
    g.push({ nivel: "alto", titulo: `A prévia não está virando venda (${fmtPct(pix)})`, detalhe: `${f.pix} Pix enviados para ${f.previas} prévias.`, acao: "Revise a prévia do nicho que mais perde e a objeção de preço." });
  }
  const pago = pct(f.fechados, f.pix);
  if (f.pix >= 4 && pago < 0.5) {
    g.push({ nivel: "alto", titulo: `Pix enviado e não pago (${fmtPct(pago)} pagam)`, detalhe: `${f.fechados} pagos de ${f.pix} Pix enviados.`, acao: "Chame quem recebeu o Pix e não pagou; considere um lembrete automático do sinal." });
  }

  // Objeções e nichos
  const pior = [...p.objecoes_resumo].sort((a, b) => b.nao_contornadas - a.nao_contornadas)[0];
  if (pior && pior.nao_contornadas >= 3) {
    g.push({ nivel: "medio", titulo: `Objeção que mais perde vendas: ${NOME_OBJECAO[pior.categoria] ?? pior.categoria}`, detalhe: `${pior.nao_contornadas} de ${pior.total} não foram contornadas.`, acao: "Veja as falas na aba Objeções e me mande um contorno novo para ensinar à Laura." });
  }
  for (const n of p.nichos) {
    if (n.abordados >= 15 && n.responderam === 0) {
      g.push({ nivel: "medio", titulo: `${NOME_NICHO[n.nicho] ?? n.nicho}: ninguém respondeu`, detalhe: `${n.abordados} abordados, 0 respostas.`, acao: "Considere tirar esse nicho da lista ou mudar a primeira mensagem dele." });
    }
  }

  return g.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alto" ? -1 : 1));
}
