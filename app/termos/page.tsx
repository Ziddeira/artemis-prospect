import Link from "next/link";
import PaginaLegal, { Secao as SecaoLegal, Subtitulo } from "@/components/legal/PaginaLegal";
import { REGRAS_COMUNIDADE } from "@/lib/comunidade/regras";
import { PACOTE_EXTRA, PACOTE_SITES, PLANOS, formatarPreco } from "@/lib/planos";
import { EMAIL_CONTATO, metadadosPagina } from "@/lib/site";

export const metadata = metadadosPagina({
  titulo: "Termos de uso",
  descricao:
    "Regras de uso do Ártemis Prospect: o serviço, planos e cobrança, cancelamento e reembolso, Comunidade e Mensagens, responsabilidades e foro.",
  caminho: "/termos",
});

const SECOES = [
  { id: "aceite", titulo: "Sobre estes termos" },
  { id: "servico", titulo: "O que é o serviço" },
  { id: "conta", titulo: "Conta e maioridade" },
  { id: "planos", titulo: "Planos e cobrança" },
  { id: "cancelamento", titulo: "Cancelamento e reembolso" },
  { id: "uso", titulo: "Uso permitido" },
  { id: "mensagens-leads", titulo: "Mensagens que você envia aos leads" },
  { id: "comunidade", titulo: "Regras da Comunidade e das Mensagens" },
  { id: "conteudo", titulo: "Seu conteúdo" },
  { id: "ferramentas", titulo: "Sites com IA e contratos" },
  { id: "responsabilidade", titulo: "Limitação de responsabilidade" },
  { id: "suspensao", titulo: "Suspensão e encerramento" },
  { id: "mudancas", titulo: "Mudanças nos termos" },
  { id: "foro", titulo: "Lei aplicável e foro" },
  { id: "contato", titulo: "Contato" },
];

function Secao(props: { id: string; children: React.ReactNode }) {
  return <SecaoLegal secoes={SECOES} {...props} />;
}

const EMAIL = <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>;

const PAGOS = [PLANOS.solo, PLANOS.pro, PLANOS.platina];

export default function TermosPage() {
  return (
    <PaginaLegal
      rotulo="Termos"
      titulo="Termos de uso"
      secoes={SECOES}
      resumo={
        <p>
          Estas são as regras para usar o Ártemis Prospect. Ao criar uma conta, você declara que leu
          e concorda com estes termos e com a{" "}
          <Link href="/privacidade" className="font-semibold text-destaque underline-offset-4 hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      }
    >
      <Secao id="aceite">
        <p>
          Estes termos são um contrato entre você e o Ártemis Prospect. Eles valem para o site, o
          painel e todos os recursos (buscas, leads, Comunidade, Mensagens, contratos e geração de
          sites). Se você não concordar com eles, não use o serviço.
        </p>
      </Secao>

      <Secao id="servico">
        <p>
          O Ártemis Prospect é uma ferramenta on-line de prospecção para quem cria sites. Você busca
          negócios por nicho e região, e o sistema consulta o Google Maps e mostra quais não têm
          site próprio, quais só usam rede social e quais dependem do Airbnb ou do Booking. Ao
          desbloquear um lead, você vê o contato completo e um atalho para o WhatsApp com uma
          mensagem sugerida.
        </p>
        <p>
          O serviço também traz o funil de leads, o rank, a Comunidade, as Mensagens entre usuários,
          o gerador de contratos (planos pagos) e a geração de sites com IA (plano Platina).
        </p>
        <p>
          O Ártemis Prospect é uma ferramenta de apoio: <strong>não garantimos que você vá fechar
          vendas</strong> nem que os negócios listados vão responder ou contratar.
        </p>
      </Secao>

      <Secao id="conta">
        <ul>
          <li>
            Para criar uma conta, você precisa ter <strong>18 anos ou mais</strong> e capacidade
            para assinar contratos. Ao se cadastrar, você declara que cumpre esse requisito.
          </li>
          <li>Os dados do cadastro precisam ser verdadeiros e estar atualizados.</li>
          <li>
            A conta é pessoal: não compartilhe o login. Você é responsável por manter a senha em
            segredo e por tudo o que for feito com a sua conta.
          </li>
          <li>
            Se notar algum uso que não foi você, troque a senha e avise pelo {EMAIL}.
          </li>
        </ul>
      </Secao>

      <Secao id="planos">
        <ul>
          <li>
            O plano <strong>Grátis</strong> traz {PLANOS.gratis.buscas} buscas e{" "}
            {PLANOS.gratis.desbloqueios} desbloqueios para testar, sem cartão.
          </li>
          <li>
            Os planos pagos são mensais:{" "}
            {PAGOS.map((plano, i) => (
              <span key={plano.id}>
                <strong>{plano.nome}</strong> ({formatarPreco(plano.preco)}/mês)
                {i < PAGOS.length - 2 ? ", " : i === PAGOS.length - 2 ? " e " : ""}
              </span>
            ))}
            . O que cada um inclui está na{" "}
            <Link href="/#planos">página inicial</Link> e na página do plano, no painel.
          </li>
          <li>
            O pagamento é feito por PIX ou cartão de crédito, pelo <strong>Asaas</strong>. A
            assinatura <strong>renova a cada mês</strong>, até você cancelar: no cartão, a cobrança
            é automática; no PIX, uma nova cobrança é gerada para você pagar.
          </li>
          <li>
            O plano é liberado quando o pagamento é confirmado. A cada renovação, o saldo de buscas e
            desbloqueios volta ao limite do plano: <strong>o saldo que sobrou não passa para o mês
            seguinte</strong>.
          </li>
          <li>
            O pacote extra (+{PACOTE_EXTRA.desbloqueios} desbloqueios e +{PACOTE_EXTRA.buscas}{" "}
            buscas por {formatarPreco(PACOTE_EXTRA.preco)}) é avulso e soma ao saldo do mês; ele
            também não passa para o mês seguinte. O pacote de sites do Platina (+
            {PACOTE_SITES.sites} gerações por {formatarPreco(PACOTE_SITES.preco)}) não vence.
          </li>
          <li>
            Se o pagamento da renovação não for confirmado, o plano pago continua por mais alguns
            dias de tolerância e depois a conta volta ao Grátis, sem perder os leads já
            desbloqueados.
          </li>
          <li>
            Cupons de desconto valem nas condições informadas na promoção.
          </li>
          <li>
            Os preços podem mudar. Se o preço do seu plano mudar, avisaremos com pelo menos 30 dias
            de antecedência, e o novo valor só vale a partir da renovação seguinte ao aviso.
          </li>
        </ul>
      </Secao>

      <Secao id="cancelamento">
        <Subtitulo>Cancelamento</Subtitulo>
        <ul>
          <li>
            Não há fidelidade. Você cancela quando quiser, direto no painel, na página do plano.
          </li>
          <li>
            Depois de cancelar, <strong>nenhuma nova cobrança é feita</strong>. O plano pago continua
            valendo até o fim do período já pago, e depois a conta volta ao Grátis.
          </li>
        </ul>
        <Subtitulo>Reembolso</Subtitulo>
        <ul>
          <li>
            <strong>Direito de arrependimento:</strong> você pode desistir da primeira contratação de
            um plano ou de um pacote em até <strong>7 dias</strong> depois do pagamento, como prevê o
            Código de Defesa do Consumidor (art. 49), e recebe o valor de volta integralmente. Para
            isso, escreva para {EMAIL} a partir do e-mail da conta. O saldo do plano ou do pacote é
            retirado da conta.
          </li>
          <li>
            Fora desse prazo, não devolvemos valores proporcionais do mês em andamento: o plano
            continua valendo até o fim do período pago.
          </li>
          <li>
            Cobrança em duplicidade ou feita por erro nosso é sempre devolvida.
          </li>
          <li>
            O reembolso é feito pelo Asaas, na mesma forma de pagamento usada. O prazo para o valor
            aparecer depende do banco ou da operadora do cartão.
          </li>
        </ul>
      </Secao>

      <Secao id="uso">
        <p>Para manter o serviço justo para todo mundo, não é permitido:</p>
        <ul>
          <li>
            revender, repassar ou publicar listas de leads, ou usar o Ártemis Prospect para montar
            bases de dados para terceiros;
          </li>
          <li>
            usar robôs, scripts ou qualquer automação para fazer buscas, desbloquear leads ou extrair
            dados do site;
          </li>
          <li>tentar burlar os limites dos planos, criar várias contas para isso ou dividir uma conta;</li>
          <li>tentar invadir, sobrecarregar ou atrapalhar o funcionamento do site;</li>
          <li>usar o serviço para golpes, fraudes ou qualquer atividade ilegal.</li>
        </ul>
        <p>
          Os dados das empresas vêm do Google Maps e seguem também as regras do Google. Eles podem
          estar desatualizados ou errados; não garantimos que estejam corretos. Se um lead não
          existir mais ou o telefone não atender, você pode marcá-lo como inválido em “Meus leads”,
          dentro das regras da tela, e o crédito volta.
        </p>
      </Secao>

      <Secao id="mensagens-leads">
        <p>
          O Ártemis Prospect <strong>não envia mensagens por você</strong>. O botão de WhatsApp só
          abre a conversa com um texto sugerido, que você pode editar. Quem escolhe para quem, quando
          e o que mandar é você.
        </p>
        <p>
          Por isso, <strong>você é o único responsável pelas mensagens que envia aos leads</strong>{" "}
          e pela forma como trata os dados deles. Ao entrar em contato, você se compromete a:
        </p>
        <ul>
          <li>apresentar-se com seu nome real e dizer de onde tirou o contato, se perguntarem;</li>
          <li>
            não mandar spam: nada de mensagens em massa, repetidas ou insistentes, e parar de
            contatar quem pedir;
          </li>
          <li>
            seguir a LGPD, o Código de Defesa do Consumidor e as regras do WhatsApp e de qualquer
            outro canal que usar;
          </li>
          <li>não enganar, ameaçar, ofender ou fazer promessas falsas.</li>
        </ul>
        <p>
          Se uma mensagem sua gerar reclamação, bloqueio de número, processo ou multa, a
          responsabilidade é sua. Se o Ártemis Prospect for cobrado por algo que você fez, você
          deverá cobrir os custos.
        </p>
      </Secao>

      <Secao id="comunidade">
        <Subtitulo>Comunidade</Subtitulo>
        <p>Para publicar, você aceita as regras abaixo, que também aparecem no painel:</p>
        <ul>
          {REGRAS_COMUNIDADE.map((regra) => (
            <li key={regra.titulo}>
              <strong>{regra.titulo}.</strong> {regra.texto}
            </li>
          ))}
        </ul>
        <Subtitulo>Mensagens entre usuários (chat)</Subtitulo>
        <ul>
          <li>A conversa só começa depois que a outra pessoa aceita o pedido.</li>
          <li>
            Valem as mesmas regras da Comunidade: respeito, sem spam, sem golpe e sem expor dados de
            clientes e leads.
          </li>
          <li>
            Você pode bloquear e denunciar qualquer pessoa. Na denúncia, as últimas 30 mensagens da
            conversa vão para a moderação analisar.
          </li>
          <li>Há limites de pedidos e de mensagens por dia e por minuto, para evitar abuso.</li>
        </ul>
        <p>
          Quem descumprir as regras pode ter o conteúdo removido e ser suspenso da Comunidade ou das
          Mensagens, por um tempo ou de vez, sem reembolso do plano. As decisões da moderação ficam
          registradas.
        </p>
      </Secao>

      <Secao id="conteudo">
        <p>
          O que você publica (posts, comentários, imagens, mensagens) continua sendo seu. Ao
          publicar, você nos autoriza a guardar, exibir e transmitir esse conteúdo dentro do serviço,
          só para fazer a Comunidade e as Mensagens funcionarem. Essa autorização termina quando você
          apaga o conteúdo ou exclui a conta.
        </p>
        <p>
          Você garante que tem o direito de publicar o que publica e é responsável por isso. A marca,
          o design e o código do Ártemis Prospect são nossos e não podem ser copiados.
        </p>
      </Secao>

      <Secao id="ferramentas">
        <ul>
          <li>
            <strong>Sites gerados com IA:</strong> são um ponto de partida. Revise tudo antes de
            publicar: textos, dados, telefones e os depoimentos de exemplo, que precisam ser trocados
            pelos reais. O Ártemis Prospect não hospeda os sites e não responde pelo uso que você ou
            seu cliente fizerem deles.
          </li>
          <li>
            <strong>Contratos:</strong> o modelo é uma ajuda para organizar o acordo com o seu
            cliente e <strong>não é consultoria jurídica</strong>. Revise as cláusulas e, se tiver
            dúvida, consulte um advogado. O contrato é entre você e o seu cliente; o Ártemis Prospect
            não é parte dele.
          </li>
        </ul>
      </Secao>

      <Secao id="responsabilidade">
        <ul>
          <li>
            Fazemos o possível para o site ficar no ar e funcionar bem, mas ele pode passar por
            falhas, manutenções ou ficar fora do ar, inclusive por problemas nos serviços que usamos
            (Google, Supabase, Vercel, Asaas). Recursos podem mudar ou deixar de existir.
          </li>
          <li>
            Não respondemos por vendas que não aconteceram, lucros que você esperava ter, dados de
            empresas desatualizados nem pelo que acontecer nas suas negociações com os leads e
            clientes.
          </li>
          <li>
            Também não respondemos pelo conteúdo que outros usuários publicam na Comunidade ou mandam
            nas Mensagens, mas removemos o que violar estas regras assim que soubermos.
          </li>
          <li>
            Quando a lei permitir, nossa responsabilidade total fica limitada ao valor que você pagou
            ao Ártemis Prospect nos 12 meses anteriores ao problema.
          </li>
          <li>
            Nada nestes termos tira os direitos que o Código de Defesa do Consumidor garante a quem é
            consumidor.
          </li>
        </ul>
      </Secao>

      <Secao id="suspensao">
        <p>
          Podemos suspender ou encerrar a conta de quem descumprir estes termos, usar o serviço para
          fraude ou colocar outros usuários em risco. Em casos graves, a suspensão pode ser imediata.
          Quando possível, avisamos o motivo.
        </p>
        <p>
          Você pode parar de usar o serviço e pedir a exclusão da conta quando quiser, como explica a{" "}
          <Link href="/privacidade#exclusao">Política de privacidade</Link>.
        </p>
      </Secao>

      <Secao id="mudancas">
        <p>
          Estes são os termos iniciais do Ártemis Prospect e eles podem ser revisados. A data da
          versão atual fica no topo da página. Mudanças importantes serão avisadas no site com
          antecedência. Se continuar usando o serviço depois de a mudança valer, você concorda com a
          nova versão; se não concordar, pode cancelar e excluir a conta.
        </p>
      </Secao>

      <Secao id="foro">
        <p>
          Estes termos seguem as leis do Brasil. Qualquer disputa será resolvida no foro da comarca
          do seu domicílio, como garante o Código de Defesa do Consumidor. Antes de ir à Justiça,
          tente falar com a gente: a maioria dos problemas se resolve por e-mail.
        </p>
      </Secao>

      <Secao id="contato">
        <p>Dúvidas sobre estes termos, reembolso ou qualquer outro assunto: {EMAIL}.</p>
      </Secao>
    </PaginaLegal>
  );
}
