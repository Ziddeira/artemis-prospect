import Link from "next/link";
import PaginaLegal, { Secao as SecaoLegal, Subtitulo } from "@/components/legal/PaginaLegal";
import { EMAIL_CONTATO, metadadosPagina } from "@/lib/site";

export const metadata = metadadosPagina({
  titulo: "Política de privacidade",
  descricao:
    "Quais dados o Ártemis Prospect coleta, para que usa, com quem compartilha, por quanto tempo guarda e como exercer seus direitos pela LGPD.",
  caminho: "/privacidade",
});

const SECOES = [
  { id: "quem-somos", titulo: "Quem somos" },
  { id: "dados", titulo: "Quais dados coletamos" },
  { id: "uso", titulo: "Para que usamos" },
  { id: "servicos", titulo: "Serviços que usamos" },
  { id: "empresas", titulo: "Dados das empresas (leads)" },
  { id: "prazos", titulo: "Por quanto tempo guardamos" },
  { id: "seguranca", titulo: "Como protegemos" },
  { id: "cookies", titulo: "Cookies" },
  { id: "direitos", titulo: "Seus direitos pela LGPD" },
  { id: "exclusao", titulo: "Como excluir sua conta" },
  { id: "idade", titulo: "Maioridade" },
  { id: "mudancas", titulo: "Mudanças nesta política" },
  { id: "contato", titulo: "Contato" },
];

function Secao(props: { id: string; children: React.ReactNode }) {
  return <SecaoLegal secoes={SECOES} {...props} />;
}

const EMAIL = <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>;

export default function PrivacidadePage() {
  return (
    <PaginaLegal
      rotulo="Privacidade"
      titulo="Política de privacidade"
      secoes={SECOES}
      resumo={
        <p>
          Esta página explica, em linguagem simples, quais dados o Ártemis Prospect coleta, para que
          usa, com quem compartilha, por quanto tempo guarda e como você pode ver, corrigir ou apagar
          seus dados, como prevê a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
        </p>
      }
    >
      <Secao id="quem-somos">
        <p>
          O Ártemis Prospect é uma ferramenta on-line de prospecção para web designers, freelancers e
          agências: você busca negócios por nicho e região e vê quais ainda não têm site. Para os
          dados das pessoas que usam o site, o Ártemis Prospect é o <strong>controlador</strong>, ou
          seja, quem decide como esses dados são tratados.
        </p>
        <p>
          Esta política vale para o site e para o painel. Ela anda junto com os{" "}
          <Link href="/termos">Termos de uso</Link>.
        </p>
      </Secao>

      <Secao id="dados">
        <p>Coletamos só o necessário para o serviço funcionar:</p>

        <Subtitulo>Cadastro e conta</Subtitulo>
        <ul>
          <li>
            <strong>E-mail e senha.</strong> A senha é guardada pelo sistema de login do Supabase em
            forma criptografada; ninguém da equipe consegue lê-la.
          </li>
          <li>
            <strong>Login com o Google:</strong> se você entrar pelo Google, recebemos o seu nome, o
            e-mail e a foto da conta Google.
          </li>
          <li>
            <strong>Perfil:</strong> apelido, foto ou avatar, telefone (se você informar), tema
            escolhido, modelos de mensagem e assinatura salva para contratos (se você salvar).
          </li>
          <li>
            <strong>Plano e uso:</strong> plano atual, saldo de buscas, desbloqueios e gerações de
            site, data de validade do plano e pontos do rank.
          </li>
        </ul>

        <Subtitulo>Buscas e leads desbloqueados</Subtitulo>
        <ul>
          <li>Os termos e as regiões que você pesquisa e a data de cada busca.</li>
          <li>
            Os leads que você desbloqueia (nome, endereço, telefone, site e avaliação da empresa,
            vindos do Google Maps), mais o que você anota sobre eles: situação no funil, anotações,
            retornos agendados, marcações de lead inválido e vendas registradas, com os comprovantes
            que você enviar.
          </li>
        </ul>

        <Subtitulo>Comunidade</Subtitulo>
        <ul>
          <li>
            Posts, comentários, imagens, links, curtidas, republicações, denúncias e o aceite das
            regras. O que você publica na Comunidade fica visível para os outros usuários, junto do
            seu apelido e avatar. Um post também pode ser aberto por quem tiver o link de
            compartilhamento.
          </li>
        </ul>

        <Subtitulo>Mensagens (chat)</Subtitulo>
        <ul>
          <li>
            Pedidos de conversa, textos e imagens enviados, horário de envio e de leitura, bloqueios e
            denúncias. As conversas são privadas: cada pessoa só lê as próprias. Quando alguém
            denuncia uma conversa, as últimas 30 mensagens dela vão para a moderação analisar.
          </li>
        </ul>

        <Subtitulo>Pagamentos</Subtitulo>
        <ul>
          <li>
            Para assinar ou comprar um pacote, você informa nome completo e CPF ou CNPJ, que enviamos
            ao Asaas para emitir a cobrança. Guardamos o plano, o valor, a forma de pagamento (PIX ou
            cartão) e a situação de cada cobrança. <strong>Os dados do cartão são digitados na
            página do Asaas e não passam pelo Ártemis Prospect.</strong>
          </li>
        </ul>

        <Subtitulo>Outros recursos</Subtitulo>
        <ul>
          <li>
            <strong>Suporte:</strong> o que você escreve no chamado, a imagem que anexar e dados
            básicos da conta para diagnóstico (plano, saldo e navegador).
          </li>
          <li>
            <strong>Contratos:</strong> dados do prestador e do cliente que você preenche e, quando o
            cliente assina pelo link, a data e a hora, o IP, o navegador, o nome e o e-mail
            informados por ele, para comprovar a assinatura.
          </li>
          <li>
            <strong>Sites gerados com IA (plano Platina):</strong> as informações do formulário
            (nome, ramo, cidade, serviços, WhatsApp, estilo) e o site gerado.
          </li>
          <li>
            <strong>Dados técnicos:</strong> registros de acesso (IP, data e hora, cidade aproximada
            e o aparelho e navegador usados no login), registros de erro do servidor e os cookies
            descritos mais abaixo. Você vê os seus últimos acessos no Perfil.
          </li>
        </ul>
      </Secao>

      <Secao id="uso">
        <p>Usamos esses dados para:</p>
        <ul>
          <li>criar e manter sua conta, fazer o login e mostrar seu painel;</li>
          <li>fazer as buscas, mostrar os leads e guardar o que você desbloqueou e anotou;</li>
          <li>cobrar os planos e pacotes e liberar o saldo quando o pagamento é confirmado;</li>
          <li>fazer funcionar a Comunidade, as Mensagens, o rank, os contratos e a geração de sites;</li>
          <li>mandar avisos dentro do site (o sino), como renovação, saldo baixo e retornos agendados;</li>
          <li>responder chamados de suporte e pedidos sobre seus dados;</li>
          <li>
            moderar conteúdo denunciado, evitar abuso e fraude e aplicar os limites de cada plano;
          </li>
          <li>corrigir erros e melhorar o serviço;</li>
          <li>cumprir obrigações legais, fiscais e ordens de autoridades.</li>
        </ul>
        <p>
          As bases legais da LGPD que usamos são: a <strong>execução do contrato</strong> (os Termos
          de uso) para prestar o serviço; o <strong>cumprimento de obrigação legal</strong> para
          guardar registros de acesso e de pagamento; e o <strong>legítimo interesse</strong> para
          segurança, prevenção de fraude e melhoria do serviço, sempre respeitando os seus direitos.
        </p>
        <p>
          <strong>Não vendemos seus dados</strong> e não usamos seus dados para publicidade de
          terceiros.
        </p>
      </Secao>

      <Secao id="servicos">
        <p>
          Para o site funcionar, contamos com empresas que tratam dados em nosso nome (operadores).
          Cada uma recebe só o necessário para a sua parte:
        </p>
        <ul>
          <li>
            <strong>Google Maps Platform (Google):</strong> fonte das buscas de negócios. Enviamos ao
            Google os termos e as regiões pesquisados, sem os seus dados pessoais. O uso desses dados
            segue também os termos e a política de privacidade do Google. Se você entrar com o
            Google, o login é feito pelo Google.
          </li>
          <li>
            <strong>Supabase:</strong> banco de dados, login, armazenamento de arquivos (fotos,
            imagens, comprovantes e contratos) e mensagens em tempo real. É onde ficam os dados da
            sua conta.
          </li>
          <li>
            <strong>Vercel:</strong> hospedagem do site e das rotinas automáticas. Recebe os dados de
            acesso de cada visita (como IP e navegador).
          </li>
          <li>
            <strong>Cloudflare:</strong> verificação anti-robô (Turnstile) na criação de conta.
            Recebe dados técnicos do navegador, como IP, para confirmar que quem se cadastra é uma
            pessoa.
          </li>
          <li>
            <strong>Asaas:</strong> processamento dos pagamentos por PIX e cartão. Recebe nome, CPF ou
            CNPJ, e-mail e os dados da cobrança.
          </li>
          <li>
            <strong>Anthropic:</strong> só no plano Platina, recebe as informações do formulário de
            geração de site para a IA montar a página.
          </li>
        </ul>
        <p>
          Alguns desses serviços guardam ou processam dados fora do Brasil. Nesses casos, a
          transferência é feita para prestar o serviço que você contratou e com empresas que adotam
          medidas de segurança e proteção de dados compatíveis com a LGPD.
        </p>
        <p>
          Também podemos compartilhar dados quando a lei exigir ou por ordem de autoridade
          competente.
        </p>
      </Secao>

      <Secao id="empresas">
        <p>
          Os leads são negócios encontrados no Google Maps. Usamos só as informações públicas que os
          próprios negócios mostram lá: nome, endereço, telefone, site e avaliações. Seguindo as
          regras do Google, esses dados ficam guardados no máximo por <strong>30 dias</strong>.
        </p>
        <p>
          Se você é responsável por um negócio e quer que ele não apareça mais para você ou que algum
          dado seu seja apagado das nossas bases, escreva para {EMAIL}.
        </p>
      </Secao>

      <Secao id="prazos">
        <ul>
          <li>
            <strong>Dados da conta, Comunidade, Mensagens, leads anotados e contratos:</strong>
            enquanto sua conta existir, ou até você apagar o item (por exemplo, um contrato ou uma
            notificação). Ao excluir a conta, apagamos esses dados, salvo o que a lei manda guardar.
          </li>
          <li>
            <strong>Contatos dos leads e lista da última busca:</strong> até 30 dias, pela política
            de cache do Google.
          </li>
          <li>
            <strong>Sites gerados com IA:</strong> o arquivo do site fica guardado 30 dias depois da
            última versão. O registro de uso (data e custo) continua.
          </li>
          <li>
            <strong>Link público de contrato:</strong> vale por 30 dias.
          </li>
          <li>
            <strong>Registros de pagamento:</strong> pelo prazo exigido pela legislação fiscal e de
            defesa do consumidor (em geral, 5 anos), mesmo depois de a conta ser excluída.
          </li>
          <li>
            <strong>Registros de acesso:</strong> por 6 meses, como exige o Marco Civil da Internet
            (Lei 12.965/2014).
          </li>
          <li>
            <strong>Registros de erro do servidor:</strong> 90 dias.
          </li>
        </ul>
      </Secao>

      <Secao id="seguranca">
        <p>
          Cada pessoa só acessa os próprios dados: o banco aplica regras de acesso por usuário,
          as conversas e os arquivos privados (comprovantes, mensagens, contratos) ficam em áreas
          protegidas, as chaves dos serviços ficam só no servidor e toda a conexão com o site é
          criptografada (HTTPS).
        </p>
        <p>
          Nenhum sistema é 100% seguro. Se acontecer um incidente que possa trazer risco ou dano
          relevante a você, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como
          manda a LGPD.
        </p>
      </Secao>

      <Secao id="cookies">
        <p>
          Usamos só <strong>cookies necessários</strong>: os do login, que mantêm você conectado, o
          que identifica o aparelho para avisar você de logins em aparelhos novos e o que guarda o
          tema escolhido (claro, escuro ou do sistema). Não usamos cookies de
          publicidade nem de rastreamento de terceiros.
        </p>
      </Secao>

      <Secao id="direitos">
        <p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, errados ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em excesso;</li>
          <li>portabilidade dos seus dados para outro serviço;</li>
          <li>eliminação dos dados tratados com o seu consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não dar consentimento e o que acontece se não der;</li>
          <li>revogação do consentimento;</li>
          <li>oposição a um tratamento que não cumpra a LGPD.</li>
        </ul>
        <p>
          Boa parte você já faz sozinho no painel: editar o perfil, apagar posts, comentários,
          contratos e notificações. Para o resto, escreva para {EMAIL} a partir do e-mail da sua
          conta. Respondemos em até 15 dias. Se achar que seu pedido não foi atendido, você também
          pode reclamar na ANPD (<a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>).
        </p>
      </Secao>

      <Secao id="exclusao">
        <p>Para excluir sua conta e seus dados:</p>
        <ul>
          <li>
            Se tiver um plano pago, <strong>cancele a assinatura</strong> no painel, na página do
            plano, para não haver novas cobranças.
          </li>
          <li>
            Mande um e-mail para {EMAIL}, <strong>a partir do e-mail cadastrado na conta</strong>, com
            o assunto “Excluir minha conta”. Se precisarmos confirmar que o pedido é seu, pediremos
            uma confirmação simples.
          </li>
          <li>
            Excluímos a conta e os dados ligados a ela em até 15 dias. Ficam guardados só os
            registros que a lei manda manter (pagamentos e registros de acesso), pelo prazo legal.
          </li>
        </ul>
        <p>
          A exclusão não pode ser desfeita: leads, anotações, posts, mensagens, contratos e saldo
          são perdidos. Seus posts, comentários e mensagens saem da Comunidade e das conversas junto
          com a conta.
        </p>
      </Secao>

      <Secao id="idade">
        <p>
          O Ártemis Prospect é só para <strong>maiores de 18 anos</strong>. Não coletamos dados de
          crianças e adolescentes de propósito. Se descobrirmos uma conta de menor de idade, ela será
          encerrada e os dados apagados.
        </p>
      </Secao>

      <Secao id="mudancas">
        <p>
          Esta é a primeira versão desta política e ela pode ser revisada. A data da versão atual
          fica no topo da página. Quando a mudança for importante, avisaremos no site antes de ela
          valer.
        </p>
      </Secao>

      <Secao id="contato">
        <p>
          Dúvidas, pedidos sobre seus dados ou exclusão da conta: {EMAIL}. Este também é o canal do
          encarregado pelo tratamento de dados pessoais.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
