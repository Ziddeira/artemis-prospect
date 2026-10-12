// ============================================================================
// TEXTOS DA PÁGINA DE VENDAS (artemisprospect.com.br)
// ============================================================================
//
// Tudo o que aparece escrito na página inicial pública sai daqui. Para
// mudar um texto, troque só o que está entre aspas e salve. A página é
// montada em app/page.tsx; não precisa mexer lá.
//
// Cuidados:
//   * textos entre aspas duplas ("...") não podem ter outra aspa dupla
//     dentro; use aspas curvas (“ ”) ou simples (') no lugar;
//   * cada item de lista termina com vírgula;
//   * preços e limites dos planos NÃO ficam aqui: vêm de lib/planos.ts
//     (os mesmos números que o banco usa).
// ============================================================================

import { PLANOS } from "@/lib/planos";
import { LIMITE_DEVOLUCOES_MES, PRAZO_DEVOLUCAO_DIAS } from "@/lib/leads/invalido";

// ----------------------------------------------------------------------------
// Google e redes sociais: título da aba e texto que aparece na busca e
// quando o link é compartilhado. Título com até ~60 letras; descrição com
// até ~155.
// ----------------------------------------------------------------------------
export const SEO = {
  titulo: "Ártemis Prospect — ache clientes que ainda não têm site",
  descricao:
    "Para web designers independentes: busque por nicho e bairro, veja quem não tem site, quem só usa Instagram e quem depende do Airbnb, e chame no WhatsApp.",
};

// ----------------------------------------------------------------------------
// 1. Topo
// "tituloDestaque" sai em amarelo, logo depois de "titulo".
// ----------------------------------------------------------------------------
export const TOPO = {
  rotulo: "Para web designers independentes",
  titulo: "Fazer o site você sabe.",
  tituloDestaque: "Difícil é achar quem pague por ele.",
  subtitulo:
    "O Ártemis mostra, por nicho e bairro, quem ainda não tem site — com o WhatsApp pronto para chamar.",
  botao: "Criar conta grátis",
  observacao: `Sem cartão: ${PLANOS.gratis.buscas} buscas e ${PLANOS.gratis.desbloqueios} desbloqueios para testar.`,
  // Texto alternativo da imagem (lido por leitores de tela e pelo Google).
  textoImagem:
    "Tela de busca do Ártemis Prospect com leads de Palhoça SC: uma barbearia sem site e uma pousada que depende do Booking, cada uma com pontuação e botão de WhatsApp.",
};

// ----------------------------------------------------------------------------
// 2. O problema (3 blocos curtos)
// ----------------------------------------------------------------------------
export const PROBLEMA = {
  rotulo: "O problema",
  titulo: "Prospectar sozinho come o tempo que você teria para criar",
  blocos: [
    {
      titulo: "Horas no Maps, perfil por perfil",
      texto:
        "Você abre negócio por negócio para ver se tem site. A tarde acaba e a lista tem cinco nomes — metade já tinha site.",
    },
    {
      titulo: "Indicação não enche a agenda",
      texto:
        "Amigo, parente, cliente antigo: funciona até parar. Um mês tem três projetos, no outro, nenhum.",
    },
    {
      titulo: "Mensagem genérica vira vácuo",
      texto:
        "Chamar sem saber o que o negócio precisa soa como spam. Sem um bom motivo para conversar, ninguém responde.",
    },
  ],
};

// ----------------------------------------------------------------------------
// 3. Como funciona (3 passos, cada um com um print real da ferramenta)
// As imagens ficam em public/vendas/ (passo-buscar.png,
// passo-desbloquear.png e passo-contatar.png). Para trocar, substitua o
// arquivo mantendo o mesmo nome.
// ----------------------------------------------------------------------------
export const COMO_FUNCIONA = {
  rotulo: "Como funciona",
  titulo: "Da busca ao primeiro “oi” em 3 passos",
  passos: [
    {
      titulo: "Busque",
      texto:
        "Digite o nicho e a cidade ou bairro — “barbearia, pousada” em “Palhoça SC”. Dá para buscar vários de uma vez.",
      textoImagem: "Formulário de busca do Ártemis com os campos de nicho e região preenchidos.",
    },
    {
      titulo: "Desbloqueie",
      texto:
        "A lista chega com etiqueta e pontuação, dos que mais precisam de site para os que menos precisam. Gostou de um? Um crédito libera o contato.",
      textoImagem: "O mesmo lead antes e depois de desbloquear: primeiro com o botão Desbloquear, depois com WhatsApp e Maps.",
    },
    {
      titulo: "Chame",
      texto:
        "O WhatsApp abre com uma mensagem pronta, já com o nome do negócio. Depois, acompanhe cada conversa até fechar.",
      textoImagem: "Lead em Meus leads com telefone, botão de WhatsApp, situação Em negociação, anotação e retorno agendado.",
    },
  ],
};

// ----------------------------------------------------------------------------
// 4. O que o Ártemis acha (as categorias de lead)
// "situacao" liga cada bloco à etiqueta da ferramenta; não mude.
// ----------------------------------------------------------------------------
export const CATEGORIAS = {
  rotulo: "O que o Ártemis acha",
  titulo: "Cada lead chega com o motivo para você chamar",
  texto:
    "O Ártemis confere o que cada negócio mostra no Google Maps e separa em categorias. Você já sabe o que oferecer antes de mandar a primeira mensagem.",
  itens: [
    {
      situacao: "sem_site",
      plataforma: null,
      titulo: "Sem site",
      texto: "O negócio aparece no Google Maps, tem avaliação e cliente, mas nenhum endereço na internet.",
      exemplos: [
        "Barbearia com 4,8 estrelas e 200 avaliações, sem site nenhum",
        "Auto center de bairro que só tem o telefone no Maps",
        "Clínica de estética que vive de indicação",
      ],
      abordagem: "Um site simples, com endereço, serviços e botão de WhatsApp, já faz o negócio aparecer melhor no Google.",
    },
    {
      situacao: "rede_social",
      plataforma: null,
      titulo: "Só app ou rede social",
      texto: "O “site” cadastrado é um perfil do Instagram, do Facebook, um Linktree ou um app de agendamento.",
      exemplos: [
        "Estúdio de unhas cujo link é o Instagram",
        "Hamburgueria que só tem um Linktree",
        "Barbearia que agenda tudo pelo AppBarber ou pelo Booksy",
      ],
      abordagem: "Um endereço próprio, que não depende do algoritmo nem de taxa por pedido, e que passa mais confiança.",
    },
    {
      situacao: "booking",
      plataforma: null,
      titulo: "Depende do Airbnb ou do Booking",
      texto: "Pousadas e hospedagens cujo único canal de reserva é uma plataforma que cobra comissão por diária.",
      exemplos: [
        "Pousada na praia com o link do Booking no lugar do site",
        "Chalés na serra que só alugam pelo Airbnb",
        "Hostel que recebe tudo por plataforma",
      ],
      abordagem: "Um site com reserva direta, para pagar menos comissão e ter o contato do hóspede. Busca própria no plano Pro.",
    },
  ],
  // Nota sobre quem já tem site.
  rodape: "Quem já tem site próprio vai para o fim da lista, para você focar em quem precisa.",
} as const;

// ----------------------------------------------------------------------------
// 5. Planos
// Preços e limites vêm de lib/planos.ts. Aqui só a frase de "para quem é"
// de cada plano e o selo do plano em destaque.
// ----------------------------------------------------------------------------
export const PLANOS_TEXTO = {
  rotulo: "Planos",
  titulo: "Comece grátis, assine quando fizer sentido",
  texto: "Pague por PIX ou cartão. Sem fidelidade: cancele quando quiser, direto no painel.",
  paraQuem: {
    gratis: "Para testar sem cartão.",
    solo: "Para quem está começando a prospectar.",
    pro: "Para prospectar toda semana, inclusive hospedagens.",
    platina: "Tudo do Pro, mais clientes fora do Brasil e sites gerados com IA para entregar rápido.",
  },
  planoDestaque: "pro",
  seloDestaque: "Recomendado",
} as const;

// ----------------------------------------------------------------------------
// 6. Perguntas frequentes
// Também vão para o Google como "perguntas e respostas" (dados
// estruturados), por isso a resposta é só texto, sem links.
// ----------------------------------------------------------------------------
export const PERGUNTAS = {
  rotulo: "Dúvidas",
  titulo: "Perguntas frequentes",
  itens: [
    {
      pergunta: "De onde vêm os dados dos negócios?",
      resposta:
        "Do Google Maps, pela API oficial do Google. São as informações que os próprios negócios publicam lá: nome, endereço, telefone, site e avaliações. O Ártemis não compra listas nem raspa redes sociais.",
    },
    {
      pergunta: "É legal usar esses dados para oferecer meu serviço?",
      resposta:
        "Sim, quando feito com cuidado. São dados que a empresa tornou públicos para ser encontrada por clientes, e a LGPD permite usá-los para um contato comercial pontual com base no legítimo interesse. A sua parte: se apresentar com seu nome, dizer de onde tirou o contato se perguntarem, não mandar mensagem em massa e parar se a pessoa pedir. O Ártemis nunca manda mensagem por você.",
    },
    {
      pergunta: "E se o lead for ruim?",
      resposta: `Se a empresa não existe mais ou o telefone não atende, marque o lead como inválido em “Meus leads” e o crédito volta na hora — até ${LIMITE_DEVOLUCOES_MES} devoluções por mês, para leads desbloqueados há até ${PRAZO_DEVOLUCAO_DIAS} dias. Antes de desbloquear, você já vê a nota, o número de avaliações, a etiqueta e um selo de confiança, para gastar crédito só com quem vale a pena.`,
    },
    {
      pergunta: "Como cancelo a assinatura?",
      resposta:
        "No painel, em “Meu plano”, com um clique. Não há fidelidade nem multa: nenhuma nova cobrança é feita, o plano vale até o fim do período pago e depois a conta volta para o Grátis. Desistiu em até 7 dias da primeira contratação? Escreva para o contato e devolvemos o valor inteiro.",
    },
    {
      pergunta: "Preciso de cartão para testar?",
      resposta: `Não. A conta grátis vem com ${PLANOS.gratis.buscas} buscas e ${PLANOS.gratis.desbloqueios} desbloqueios, sem cartão e sem prazo para usar.`,
    },
    {
      pergunta: "O que é um desbloqueio?",
      resposta:
        "Na lista, todo negócio aparece com nome, etiqueta e pontuação. Desbloquear libera o telefone e o botão de WhatsApp com a mensagem pronta. Cada desbloqueio usa um crédito do seu plano.",
    },
  ],
};

// ----------------------------------------------------------------------------
// Chamada do meio (logo depois de "Como funciona") e chamada final.
// ----------------------------------------------------------------------------
export const CHAMADA_MEIO = {
  titulo: "Sua primeira lista sai em menos de um minuto.",
  botao: "Criar conta grátis",
};

export const CHAMADA_FINAL = {
  titulo: "Seu próximo cliente ainda não tem site.",
  texto: "Crie a conta em um minuto e faça a primeira busca agora.",
  botao: "Criar conta grátis",
};
