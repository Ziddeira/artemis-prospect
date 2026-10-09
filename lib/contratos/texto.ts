// Texto do contrato montado a partir das respostas. O mesmo resultado
// vira o PDF (lib/contratos/pdf.ts) e a leitura na tela (painel e link
// público). No envio, este texto é congelado no banco (contratos.conteudo),
// para o cliente ler exatamente o que está no PDF.
import { MEIOS_PAGAMENTO, documentoRotulado, type DadosContrato } from "./dados";
import { valorComExtenso } from "./extenso";

export interface ItemClausula {
  texto: string;
  // Subitens a), b), c)...
  sub?: string[];
}

export interface Clausula {
  titulo: string;
  itens: ItemClausula[];
}

export interface CampoAssinatura {
  papel: "CONTRATANTE" | "CONTRATADA";
  nome: string;
  detalhe: string;
}

export interface DocumentoContrato {
  versao: 1;
  titulo: string;
  numero: string;
  partes: { rotulo: string; texto: string }[];
  preambulo: string;
  clausulas: Clausula[];
  fecho: string;
  localData: string;
  assinaturas: { contratante: CampoAssinatura; contratada: CampoAssinatura };
}

// Lacuna para o que ainda não foi preenchido (o rascunho sai assim).
const LACUNA = "____________________";

function ou(valor: string | null | undefined) {
  return valor && valor.trim() ? valor.trim() : LACUNA;
}

function dinheiro(valor: number | null) {
  return valor ? valorComExtenso(valor) : `R$ ${LACUNA}`;
}

function ordinal(n: number) {
  return `${n}ª`;
}

// "9 de outubro de 2026"
export function dataPorExtenso(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function numeroPorExtenso(n: number) {
  const nomes = [
    "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
    "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte",
  ];
  return nomes[n] ? `${n} (${nomes[n]})` : String(n);
}

export function montarContrato(d: DadosContrato, meta: { numero: string; data: Date }): DocumentoContrato {
  const ct = d.contratante;
  const pr = d.prestador;
  const landing = d.escopo.tipo === "landing";
  const objeto = landing ? "Landing Page" : "Site";
  const meio = MEIOS_PAGAMENTO.find((m) => m.id === d.pagamento.meio)?.texto ?? "PIX";
  const mensal = d.manutencao.tipo === "mensal";

  // Partes ----------------------------------------------------------------
  const textoContratante =
    ct.tipo === "pj"
      ? `${ou(ct.nome)}, pessoa jurídica inscrita no CNPJ sob o nº ${ou(ct.documento)}, com sede em ${ou(ct.endereco)}, neste ato representada por ${ou(ct.assinanteNome)}${ct.assinanteCargo ? `, ${ct.assinanteCargo}` : ""}, doravante denominada simplesmente CONTRATANTE.`
      : `${ou(ct.nome)}, pessoa física inscrita no CPF sob o nº ${ou(ct.documento)}, residente e domiciliada em ${ou(ct.endereco)}, doravante denominada simplesmente CONTRATANTE.`;
  const emailPrestador = pr.email ? `, e-mail ${pr.email}` : "";
  const textoContratada =
    pr.tipo === "pj"
      ? `${ou(pr.nome)}, inscrita no CNPJ sob o nº ${ou(pr.documento)}, com sede em ${ou(pr.endereco)}, neste ato representada por ${ou(pr.responsavelNome)}${emailPrestador}, doravante denominada simplesmente CONTRATADA.`
      : `${ou(pr.nome)}, pessoa física inscrita no CPF sob o nº ${ou(pr.documento)}, residente e domiciliada em ${ou(pr.endereco)}${emailPrestador}, doravante denominada simplesmente CONTRATADA.`;

  const clausulas: Clausula[] = [];

  // Objeto ----------------------------------------------------------------
  clausulas.push({
    titulo: "DO OBJETO",
    itens: [
      {
        texto: `O presente contrato tem como objeto a criação, pela CONTRATADA, de ${
          landing
            ? "uma landing page (site de página única)"
            : `um site institucional com até ${numeroPorExtenso(d.escopo.paginas)} ${d.escopo.paginas === 1 ? "página" : "páginas"}`
        } para a CONTRATANTE, conforme o escopo descrito na Cláusula 2ª.`,
      },
    ],
  });

  // Escopo ----------------------------------------------------------------
  const incluidos = [
    "criação do layout (design visual) a partir da identidade da CONTRATANTE;",
    landing
      ? "desenvolvimento de 1 (uma) página, organizada em seções;"
      : `desenvolvimento de até ${numeroPorExtenso(d.escopo.paginas)} ${d.escopo.paginas === 1 ? "página" : "páginas"};`,
    "versão adaptada para celular, tablet e computador (site responsivo);",
  ];
  if (d.escopo.formulario) incluidos.push("formulário de contato, com envio das mensagens para o e-mail indicado pela CONTRATANTE;");
  if (d.escopo.whatsapp) incluidos.push("botão de integração com o WhatsApp da CONTRATANTE;");
  if (d.escopo.extras) incluidos.push(`${d.escopo.extras.replace(/[.;]\s*$/, "")};`);
  incluidos.push("publicação do site na hospedagem indicada na Cláusula 7ª.");
  clausulas.push({
    titulo: "DO ESCOPO",
    itens: [
      { texto: "Estão incluídos no serviço:", sub: incluidos.map((t, i) => `${String.fromCharCode(97 + i)}) ${t}`) },
      {
        texto:
          "Não estão incluídos, salvo acordo por escrito: produção de textos, fotografias e logotipo; loja virtual, área de login ou sistemas sob medida; anúncios pagos; e qualquer funcionalidade não descrita no item anterior.",
      },
      { texto: "Serviços fora deste escopo serão orçados à parte, antes de serem feitos." },
    ],
  });

  // Prazo e ajustes ----------------------------------------------------------
  const rodadas = d.escopo.rodadas;
  clausulas.push({
    titulo: "DO PRAZO E DOS AJUSTES",
    itens: [
      {
        texto: `A CONTRATADA entregará a primeira versão do site em até ${numeroPorExtenso(d.escopo.prazoDias)} dias úteis, contados do recebimento dos materiais necessários (textos, imagens, logotipo e informações) e da assinatura deste contrato.`,
      },
      {
        texto: rodadas
          ? `Estão incluídas ${numeroPorExtenso(rodadas)} ${rodadas === 1 ? "rodada" : "rodadas"} de ajustes. Cada rodada é uma lista única de alterações enviada pela CONTRATANTE depois de ver a versão apresentada. Ajustes além desse número serão orçados à parte.`
          : "Não estão incluídas rodadas de ajustes: alterações pedidas depois da entrega serão orçadas à parte.",
      },
      { texto: "Atrasos no envio dos materiais ou nas respostas da CONTRATANTE prorrogam o prazo pelo mesmo período." },
      {
        texto:
          "O site será considerado aprovado se a CONTRATANTE não pedir alterações em até 5 (cinco) dias úteis depois da entrega da última versão.",
      },
    ],
  });

  // Preço e pagamento ------------------------------------------------------
  const pg = d.pagamento;
  const itensPagamento: ItemClausula[] = [
    { texto: `Pelo serviço descrito neste contrato, a CONTRATANTE pagará à CONTRATADA o valor total de ${dinheiro(pg.valor)}.` },
  ];
  if (pg.jaPago === "total") {
    itensPagamento.push({
      texto: "As partes declaram que o valor total já foi pago pela CONTRATANTE, e a CONTRATADA dá plena quitação dessa quantia.",
    });
  } else {
    const parcial = pg.jaPago === "parcial";
    const restante = pg.valor && pg.valorPago && parcial ? Math.round((pg.valor - pg.valorPago) * 100) / 100 : null;
    if (parcial) {
      itensPagamento.push({
        texto: `As partes declaram que a CONTRATANTE já pagou ${dinheiro(pg.valorPago)}, e a CONTRATADA dá quitação dessa quantia. O saldo de ${dinheiro(restante)} será pago conforme o item seguinte.`,
      });
    }
    const base = parcial ? restante : pg.valor;
    const quem = parcial ? "O saldo" : "O pagamento";
    if (pg.forma === "avista") {
      itensPagamento.push({
        texto: `${quem} será feito à vista, por ${meio}, ${parcial ? "na entrega do site" : "na assinatura deste contrato"}.`,
      });
    } else {
      const n = pg.parcelas;
      const parcela = base ? Math.floor((base / n) * 100) / 100 : null;
      const exato = base && parcela ? Math.round(parcela * n * 100) === Math.round(base * 100) : true;
      itensPagamento.push({
        texto: `${quem} será feito em ${numeroPorExtenso(n)} parcelas mensais de ${dinheiro(parcela)}, por ${meio}, vencendo a primeira na assinatura deste contrato e as demais a cada 30 (trinta) dias${exato ? "" : ", com a última ajustada para completar o valor exato"}.`,
      });
    }
    itensPagamento.push({
      texto:
        "Em caso de atraso, incidirão multa de 2% (dois por cento) sobre o valor em atraso e juros de 1% (um por cento) ao mês. Atraso superior a 30 (trinta) dias permite à CONTRATADA suspender o serviço até a regularização.",
    });
  }
  clausulas.push({ titulo: "DO PREÇO E DA FORMA DE PAGAMENTO", itens: itensPagamento });

  // Obrigações --------------------------------------------------------------
  clausulas.push({
    titulo: "DAS OBRIGAÇÕES DA CONTRATANTE",
    itens: [
      {
        texto:
          "Fornecer, nos prazos combinados, os textos, imagens, logotipo e demais informações necessárias, garantindo que tem o direito de usar esses materiais.",
      },
      { texto: "Responder aos pedidos de aprovação e fazer os pagamentos nas datas combinadas." },
      { texto: "Fornecer os acessos necessários à publicação do site, quando a hospedagem ou o domínio estiverem em seu nome." },
    ],
  });
  clausulas.push({
    titulo: "DAS OBRIGAÇÕES DA CONTRATADA",
    itens: [
      { texto: "Executar o serviço com qualidade técnica, dentro do escopo e do prazo combinados." },
      { texto: "Manter sigilo sobre as informações da CONTRATANTE a que tiver acesso por causa deste contrato." },
      {
        texto:
          "Usar somente imagens, fontes e componentes com licença de uso adequada ou fornecidos pela CONTRATANTE.",
      },
    ],
  });

  // Hospedagem e domínio --------------------------------------------------------
  const ho = d.hospedagem;
  const itensHospedagem: ItemClausula[] = [
    {
      texto:
        ho.paga === "contratante"
          ? "Os custos de hospedagem e de registro do domínio serão pagos pela CONTRATANTE, diretamente aos fornecedores."
          : `Os custos de hospedagem e de registro do domínio serão pagos pela CONTRATADA ${
              mensal
                ? "enquanto a manutenção mensal prevista na Cláusula 8ª estiver em vigor"
                : "por 12 (doze) meses, contados da publicação do site"
            }, já considerados nos valores deste contrato. Depois disso, passam a ser pagos pela CONTRATANTE.`,
    },
    {
      texto: `O domínio e a conta de hospedagem serão registrados em nome da ${ho.titular === "contratante" ? "CONTRATANTE" : "CONTRATADA"}.`,
    },
  ];
  if (ho.titular === "prestador") {
    itensHospedagem.push({
      texto:
        "Encerrada a relação entre as partes e quitados os valores devidos, a CONTRATADA transferirá o domínio para o nome da CONTRATANTE em até 15 (quinze) dias depois do pedido, por ser o endereço ligado à marca dela.",
    });
  }
  clausulas.push({ titulo: "DA HOSPEDAGEM E DO DOMÍNIO", itens: itensHospedagem });

  // Manutenção ----------------------------------------------------------------
  clausulas.push({
    titulo: "DA MANUTENÇÃO",
    itens: mensal
      ? [
          {
            texto: `Depois da entrega, a CONTRATADA prestará manutenção mensal pelo valor de ${dinheiro(d.manutencao.valorMensal)} por mês, pago por ${meio}, vencendo a primeira mensalidade 30 (trinta) dias depois da entrega do site e as demais no mesmo dia dos meses seguintes.`,
          },
          { texto: `A manutenção inclui: ${ou(d.manutencao.inclui).replace(/[.;]\s*$/, "")}.` },
          {
            texto:
              "A manutenção vale por prazo indeterminado e pode ser cancelada por qualquer das partes com aviso prévio de 30 (trinta) dias, sem multa.",
          },
          { texto: "O valor da mensalidade poderá ser reajustado uma vez a cada 12 (doze) meses, pela variação do IPCA." },
        ]
      : [
          { texto: "O serviço é de entrega única e não inclui manutenção mensal." },
          {
            texto:
              "Durante 30 (trinta) dias depois da entrega, a CONTRATADA corrigirá sem custo falhas técnicas do site (erros de funcionamento), o que não inclui novas alterações de conteúdo ou de layout.",
          },
          { texto: "Manutenções e alterações posteriores serão orçadas à parte." },
        ],
  });

  // Propriedade --------------------------------------------------------------
  clausulas.push({
    titulo: "DA PROPRIEDADE INTELECTUAL",
    itens:
      d.propriedade === "cessao"
        ? [
            {
              texto:
                "Depois do pagamento integral do valor previsto na Cláusula 4ª, a CONTRATADA cede à CONTRATANTE os direitos patrimoniais sobre o código-fonte e o design do site criado, nos termos da Lei nº 9.610/1998 e da Lei nº 9.609/1998. A partir daí, a CONTRATANTE poderá usar, alterar e transferir o site livremente, inclusive a outro profissional.",
            },
            { texto: "Até o pagamento integral, o código-fonte e o design permanecem da CONTRATADA." },
            {
              texto:
                "Não fazem parte da cessão as ferramentas, bibliotecas, temas e componentes de terceiros, que seguem as próprias licenças, nem os trechos genéricos de código que a CONTRATADA usa em outros trabalhos.",
            },
            { texto: "A CONTRATADA poderá mostrar o site em seu portfólio, salvo pedido contrário da CONTRATANTE por escrito." },
          ]
        : [
            {
              texto:
                "O código-fonte e o design do site permanecem de titularidade da CONTRATADA, nos termos da Lei nº 9.610/1998 e da Lei nº 9.609/1998. A CONTRATANTE recebe uma licença de uso do site, intransferível, válida enquanto a manutenção mensal prevista na Cláusula 8ª estiver em vigor e em dia.",
            },
            {
              texto:
                "Encerrada a manutenção, ou havendo atraso superior a 30 (trinta) dias, a licença termina e a CONTRATADA poderá retirar o site do ar, respeitado o que a Cláusula 7ª diz sobre o domínio.",
            },
            {
              texto:
                "Os conteúdos fornecidos pela CONTRATANTE (textos, fotos, logotipo e marca) continuam sendo dela e serão devolvidos quando ela pedir.",
            },
            { texto: "As partes podem combinar por escrito a compra definitiva do código e do design, por valor a negociar." },
            { texto: "A CONTRATADA poderá mostrar o site em seu portfólio, salvo pedido contrário da CONTRATANTE por escrito." },
          ],
  });

  // Dados pessoais --------------------------------------------------------------
  const itensLgpd: ItemClausula[] = [
    {
      texto:
        "As partes tratarão os dados pessoais envolvidos neste contrato de acordo com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados), apenas para cumprir este contrato.",
    },
  ];
  if (d.escopo.formulario) {
    itensLgpd.push({
      texto:
        "A CONTRATANTE é a controladora dos dados enviados pelos visitantes no formulário do site e é responsável por informar a eles como esses dados são usados.",
    });
  }
  clausulas.push({ titulo: "DA PROTEÇÃO DE DADOS", itens: itensLgpd });

  // Rescisão ------------------------------------------------------------------
  clausulas.push({
    titulo: "DA RESCISÃO",
    itens: [
      {
        texto:
          "Qualquer das partes pode encerrar este contrato por aviso escrito. Se o trabalho já tiver começado, será devido à CONTRATADA o valor proporcional ao que foi feito até a data do aviso.",
      },
      {
        texto:
          "Se uma das partes descumprir este contrato, a outra poderá encerrá-lo caso o problema não seja resolvido em até 10 (dez) dias depois de avisada por escrito.",
      },
    ],
  });

  // Assinatura eletrônica ---------------------------------------------------------
  clausulas.push({
    titulo: "DA ASSINATURA ELETRÔNICA E DAS COMUNICAÇÕES",
    itens: [
      {
        texto:
          "As partes reconhecem como válida a assinatura deste contrato por meio eletrônico, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, e concordam que o registro de assinatura anexo ao documento (data e hora, endereço IP, nome e e-mail informados e o código hash do documento) serve como prova da autoria e da integridade deste contrato.",
      },
      { texto: "As comunicações entre as partes poderão ser feitas por e-mail ou WhatsApp." },
    ],
  });

  // Foro ------------------------------------------------------------------------
  const foro = d.foro.cidade && d.foro.uf ? `${d.foro.cidade}/${d.foro.uf}` : LACUNA;
  clausulas.push({
    titulo: "DO FORO",
    itens: [
      {
        texto: `Fica eleito o foro da Comarca de ${foro} para resolver qualquer dúvida ou conflito sobre este contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
      },
    ],
  });

  return {
    versao: 1,
    titulo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CRIAÇÃO DE ${objeto.toUpperCase()}`,
    numero: meta.numero,
    partes: [
      { rotulo: "CONTRATANTE", texto: textoContratante },
      { rotulo: "CONTRATADA", texto: textoContratada },
    ],
    preambulo: `As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços de Criação de ${objeto}, que se regerá pelas cláusulas seguintes.`,
    clausulas: clausulas.map((c, i) => ({ ...c, titulo: `CLÁUSULA ${ordinal(i + 1)} – ${c.titulo}` })),
    fecho:
      "E, por estarem assim justas e contratadas, as partes assinam este contrato eletronicamente, para que produza seus efeitos legais.",
    localData: `${foro === LACUNA ? LACUNA : foro}, ${dataPorExtenso(meta.data)}.`,
    assinaturas: {
      contratante: {
        papel: "CONTRATANTE",
        nome: ou(ct.tipo === "pj" ? ct.assinanteNome || ct.nome : ct.nome),
        detalhe:
          ct.tipo === "pj" ? `pela ${ct.nome}${ct.documento ? ` (${documentoRotulado("pj", ct.documento)})` : ""}` : documentoRotulado("pf", ct.documento),
      },
      contratada: {
        papel: "CONTRATADA",
        nome: ou(pr.tipo === "pj" ? pr.responsavelNome || pr.nome : pr.nome),
        detalhe:
          pr.tipo === "pj"
            ? `pela ${ou(pr.nome)}${pr.documento ? ` (${documentoRotulado("pj", pr.documento)})` : ""}`
            : documentoRotulado("pf", pr.documento),
      },
    },
  };
}

// Confere o formato de um texto congelado lido do banco.
export function ehDocumentoContrato(valor: unknown): valor is DocumentoContrato {
  const v = valor as DocumentoContrato | null;
  return !!v && v.versao === 1 && Array.isArray(v.clausulas) && Array.isArray(v.partes) && !!v.assinaturas;
}
