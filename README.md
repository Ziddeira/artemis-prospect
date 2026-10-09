# Ártemis Prospect

SaaS de prospecção de leads para web designers independentes.

## Marca

A identidade visual segue o manual em `brand/` (`MANUAL.md` tem os valores
exatos; o PDF é a referência visual). As cores e formas ficam centralizadas
em `app/globals.css` (tokens `--ap-*`), e as peças da marca (logo, mascote,
cantoneiras de mira, badge de score) em `components/marca/`. Os textos dos
e-mails de autenticação para colar no Supabase estão em
`brand/emails-supabase.md`.

O nome técnico do projeto continua `caca-leads` (repositório, pacote,
domínio `caca-leads.vercel.app`, projeto do Supabase), para não quebrar nada.

## Variáveis de ambiente

Cadastre estas variáveis na Vercel (Settings > Environment Variables)
e, se for rodar localmente, copie `.env.example` para `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_PLACES_API_KEY` — chave server-only da Places API (New) do
  Google Cloud, usada pela busca de leads. Nunca é exposta ao navegador.
- `SUPABASE_SERVICE_ROLE_KEY` — chave `service_role` do Supabase,
  server-only. Usada só pelo webhook e pelas rotas de pagamento para
  chamar as funções SQL que aplicam pagamentos.
- `ASAAS_API_KEY` — chave da API do Asaas, server-only.
- `ASAAS_ENV` — `sandbox` (testes) ou `producao`.
- `ASAAS_WEBHOOK_TOKEN` — segredo que você inventa e cadastra igual no
  webhook do Asaas; a rota recusa (401) qualquer evento sem ele.
- `ANTHROPIC_API_KEY` — chave server-only da API da Anthropic (Claude),
  usada só pela geração de site com IA do plano Platina (etapa 23).
  Nunca é exposta ao navegador. Gere em console.anthropic.com > API Keys.
- `SITES_IA_MODELO` (opcional) — modelo da geração de sites. Padrão
  `claude-opus-5-5`. Para gastar cerca de metade, use `claude-sonnet-5-5`.
- `SITES_IA_ESFORCO` (opcional) — `low`, `medium` (padrão) ou `high`.
- `CRON_SECRET` — segredo das rotinas agendadas (verificação semanal
  das vendas, virada do mês e notificações do sino). Texto aleatório de 32+ caracteres; a
  Vercel envia sozinho nas execuções agendadas.

Os valores do Supabase ficam em Supabase > Project Settings > API. A
chave do Google é gerada no Google Cloud Console, com a "Places API
(New)" ativada no projeto.

## Banco de dados (Supabase)

Rode os scripts abaixo **nessa ordem**, colando o conteúdo inteiro de
cada um no SQL Editor do Supabase:

1. `supabase/profiles.sql` — cria a tabela `profiles` (plano, créditos
   de desbloqueio, buscas restantes), com RLS e as permissões necessárias.
2. `supabase/etapa2-busca-desbloqueio.sql` — cria as tabelas `buscas`,
   `chamadas_google` e `leads_desbloqueados`, e as funções `iniciar_busca`
   e `desbloquear_lead` (security definer) que descontam saldo e créditos
   de forma atômica, sem depender de nenhuma permissão de escrita do
   usuário nessas tabelas.
3. `supabase/etapa3-planos-pagamentos.sql` — planos e pagamentos com
   Asaas: tabelas `assinaturas`, `cobrancas` e `pagamentos_eventos`
   (auditoria de todo evento recebido), a função `processar_evento_asaas`
   (aplica pagamentos de forma idempotente, só o servidor pode chamar),
   `meu_plano` e o vencimento automático para o Grátis. Também atualiza
   `iniciar_busca` e `desbloquear_lead` para aplicarem o vencimento.
4. `supabase/etapa4-cache-leads-comunidade.sql` — guarda em cache (por no
   máximo 30 dias, conforme a política de cache da Google Maps Platform)
   os dados de contato de cada lead desbloqueado, para "Meus leads" abrir
   sem chamar o Google a cada visita; cria a função `salvar_dados_lead` e
   a lista de espera da Comunidade (`interesse_comunidade` e a função
   `quero_ser_avisado_comunidade`). Não mexe em planos nem créditos.
5. `supabase/etapa5-perfil.sql` — perfil do usuário: colunas `apelido`
   (único, com apelido padrão para quem não escolher), `foto_path`,
   `telefone` e `telefone_verificado_em` (reservada para a verificação
   por SMS futura); funções `atualizar_perfil` e `definir_foto_perfil`
   (só mexem nesses campos, sempre no perfil de quem está logado); cria o
   bucket `avatares` no Storage com limite de 2 MB, só JPG/PNG/WEBP, e as
   regras para cada usuário só mexer na própria pasta. Não mexe em planos
   nem créditos.
6. `supabase/etapa6-boas-vindas.sql` — tela de boas-vindas no primeiro
   acesso e avatares prontos: colunas `avatar_pronto` e
   `configuracao_inicial_em` (contas que já existiam são marcadas como
   concluídas e não veem a tela); funções `definir_apelido`,
   `definir_avatar_pronto` e `concluir_configuracao_inicial` (sorteia um
   avatar para quem pular). A lista de avatares em `avatares_prontos()`
   precisa ser igual à de `lib/perfil/avatares.ts`. Não mexe em planos
   nem créditos.
7. `supabase/etapa7-funil-vendas.sql` — funil de leads e venda fechada:
   colunas `situacao`, `anotacao` (até 500 caracteres) e
   `ultimo_contato_em` em `leads_desbloqueados`; tabela `vendas` (nasce
   "pendente_verificacao", com os campos de verificação e pontos já
   criados e vazios); funções `atualizar_situacao_lead`,
   `salvar_anotacao_lead` e `registrar_venda`. Só dá para registrar venda
   de lead que o próprio usuário desbloqueou, uma por lead, e o usuário
   não consegue gravar verificação nem pontos. Não mexe em planos nem
   créditos.

8. Etapa 8, em **três partes, nesta ordem** (cada uma cabe fácil no
   editor; copie pelo botão "Copy raw file" do GitHub para não vir
   cortada): `supabase/etapa8-1-verificacao.sql`,
   `supabase/etapa8-2-comprovante-admin.sql` e
   `supabase/etapa8-3-rank-premio.sql` — verificação das vendas, pontos,
   comprovante, rank e prêmio: novos status da venda (`aguardando_google`,
   `nao_verificada`, `em_analise`), pontos calculados por gatilho a partir
   do status (10 / 50 / 0), tabela `verificacoes_venda` (registro de cada
   verificação, base do limite de 30 por usuário por mês), bucket privado
   `comprovantes` (5 MB, imagem ou PDF), tabela `administradores`, rank
   mensal (`rank_do_mes`), histórico (`rank_historico`) e prêmio do top 3
   em `profiles.creditos_premio` (separado dos créditos do plano, não
   vence; o desbloqueio gasta primeiro os do plano). Depois de rodar,
   cadastre você como administrador (comando no fim da parte 3).

9. Etapa 9, em **duas partes, nesta ordem**:
   `supabase/etapa9-1-notificacoes.sql` e
   `supabase/etapa9-2-rotina-notificacoes.sql` — central de notificações
   (sino): tabela `notificacoes` (o usuário só lê as próprias; marcar
   como lida e apagar passam por funções), `notificacoes_enviadas`
   (controle para nenhum aviso se repetir, mesmo depois de apagado),
   `novidades` (avisos escritos por você) e a função
   `gerar_notificacoes`, chamada pela rotina diária.

10. `supabase/etapa10-retorno.sql` — lembrete de retorno: colunas
    `retorno_em` e `retorno_obs` em `leads_desbloqueados`, a função
    `agendar_retorno_lead` (única porta de escrita; só aceita data futura,
    até 1 ano à frente) e a função `gerar_notificacoes_retorno`, chamada
    pela mesma rotina diária do sino para avisar no dia do retorno. O
    arquivo de agenda (.ics) é gerado pelo próprio site, em
    `/api/leads/retorno/ics`.

11. Etapa 11, em **três partes, nesta ordem**:
    `supabase/etapa11-1-admin-base.sql`,
    `supabase/etapa11-2-admin-paineis.sql` e
    `supabase/etapa11-3-avisos.sql` — painel de Gestão: coluna
    `profiles.is_admin` (quem já estava em `administradores` é copiado),
    tabela `erros_servidor` (falhas do webhook, da verificação de vendas,
    da busca e das notificações), tabela `admin_auditoria` (quem ajustou
    o quê e quando), funções `admin_*` (todas recusam quem não é
    administrador) e os avisos do sino escritos pela tela (`avisos`,
    com período, público por plano e contagem de leitura). Depois de
    rodar, marque a sua conta como administradora:

    ```sql
    update public.profiles set is_admin = true where email = 'seu-email@exemplo.com';
    ```

12. `supabase/etapa12-suporte.sql` — botão "Preciso de ajuda": tabela
    `chamados` (cada usuário vê só os próprios; o administrador vê todos),
    bucket privado `suporte` (imagem até 5 MB), limite de 5 chamados
    abertos por usuário, dados de diagnóstico da conta preenchidos pelo
    banco, resposta pela aba Gestão > Suporte com aviso no sino (tipo
    `suporte`). A cópia por e-mail está preparada em
    `lib/suporte/email.ts`, mas desligada até existir um serviço de
    e-mail.
13. `supabase/etapa13-tour.sql` — tour guiado pela Ártemis logo depois
    das boas-vindas: coluna `tour_concluido_em` em `profiles` e função
    `concluir_tour` (concluir ou pular marcam como visto). Quem já tinha
    passado pelas boas-vindas fica marcado e não vê o tour sozinho; no
    Perfil há o botão "Rever o tour".
14. Etapa 14, em **três partes, nesta ordem**:
    `supabase/etapa14-1-comunidade-base.sql`,
    `supabase/etapa14-2-comunidade-funcoes.sql` e
    `supabase/etapa14-3-comunidade-moderacao.sql` — feed da Comunidade:
    posts (até 500 caracteres, até 4 imagens, link com prévia, categoria),
    curtidas, comentários de um nível (até 300), republicação, denúncias,
    suspensões e aceite das regras. Cria o bucket público `comunidade`
    (5 MB, só imagem; só Solo/Pro enviam). O Grátis lê, curte, comenta e
    publica 1 post por dia sem imagem; Solo e Pro têm até 20 posts e 50
    comentários por dia, com 60 s entre posts. Tudo passa por funções do
    banco com RLS; a moderação fica em Gestão > Comunidade e cada decisão
    vai para a auditoria. A prévia do link é gravada pelo servidor com a
    `SUPABASE_SERVICE_ROLE_KEY` (sem ela, o post sai sem prévia), e o link
    público do post (`/comunidade/post/<id>`) também usa essa chave.
15. `supabase/etapa15-ultima-busca.sql` — a última busca de cada usuário
    fica salva (tabela `ultima_busca`, uma linha por usuário, com termos,
    regiões, data e a lista de leads sem os contatos). A página Buscar
    recarrega esse resultado só lendo o banco: não gasta busca nem chama
    o Google. Ele só é trocado por uma busca nova ou pelo botão "Limpar
    pesquisa". Pela política de cache do Google, a lista é apagada 30 dias
    depois da busca e a tela avisa que ela expirou.
16. Etapa 16, em **três partes, nesta ordem**:
    `supabase/etapa16-1-mensagens-base.sql`,
    `supabase/etapa16-2-mensagens-funcoes.sql` e
    `supabase/etapa16-3-mensagens-moderacao.sql` — Mensagens (chat
    privado). A conversa só começa depois que a outra pessoa aceita o
    pedido (feito pelo perfil dela na Comunidade); quem aceitou pode
    desfazer. Texto até 1000 caracteres e imagem até 5 MB (só JPG, PNG e
    WEBP; o servidor confere o conteúdo do arquivo), com "enviada" e
    "lida" e atualização em tempo real (Supabase Realtime). Bloquear,
    denunciar (as últimas 30 mensagens vão para Gestão > Mensagens),
    10 pedidos por dia e 20 mensagens por minuto. Grátis responde e
    mantém até 3 conversas abertas; Solo e Pro sem limite. Cada pessoa só
    lê as próprias conversas pelo RLS, sem exceção para administrador.
    Cria o bucket **privado** `mensagens` e liga o Realtime nas tabelas
    `chat_conversas` e `chat_mensagens`. As imagens das denúncias abrem
    na Gestão com a `SUPABASE_SERVICE_ROLE_KEY`.
17. `supabase/etapa17-login-google.sql` — cria só a função `tem_senha`,
    que o Perfil usa para saber se a conta tem senha (e esconder a troca
    de senha de quem entra só pelo Google). O login com o Google funciona
    sem este script; sem ele, o Perfil decide pelo tipo de login. Veja
    "Login com o Google" abaixo.
18. `supabase/etapa18-tema.sql` — tema claro, escuro ou "seguir o
    sistema". Cria a coluna `profiles.tema` e a função `definir_tema`,
    para a escolha valer em qualquer aparelho. Sem este script, o botão
    de tema funciona do mesmo jeito, mas a escolha fica só no aparelho
    (cookie). As cores dos dois temas ficam em `app/globals.css`.
19. `supabase/etapa19-1-cupons-base.sql` e depois
    `supabase/etapa19-2-cupons-funcoes.sql` — promoções e cupons de
    desconto para os planos (Gestão > Promoções).
20. `supabase/etapa20-1-leads-invalidos.sql` e depois
    `supabase/etapa20-2-leads-invalidos-admin.sql` — validação de
    veracidade do lead. Em "Meus leads", o usuário marca um lead como
    "empresa não existe mais" ou "telefone não atende" e recebe 1 crédito
    de volta na hora (no máximo 3 por mês, só para leads desbloqueados há
    até 30 dias). O desbloqueio passa a anotar se o crédito saiu do plano
    ou do prêmio, para devolver no mesmo lugar. Gestão > Leads inválidos
    mostra as marcações e os créditos devolvidos. O selo de confiança
    (verde/amarelo/vermelho) da busca não depende deste script.
21. `supabase/etapa21-1-internacional-base.sql` e depois
    `supabase/etapa21-2-internacional-funcoes.sql` — aba Internacional
    da página Buscar (plano Pro), começando por EUA e Canadá: busca com
    região e idioma do país, telefone internacional com botão de ligar,
    hora local da empresa e mensagem pronta em inglês (editável no
    Perfil). Cria a tabela `dominios_terceiro` (Gestão > Sites de
    terceiros, uma lista por país) e a coluna `profiles.modelos_mensagem`.
    A cobrança não muda. Os países ficam em `lib/leads/paises.ts`: para
    acrescentar outro, basta uma entrada nova ali (o banco não precisa de
    script novo). Sem este script, Negócios e Hospedagem funcionam como
    antes e a aba Internacional avisa que falta rodá-lo.
22. `supabase/etapa22-negocios-brasileiros.sql` — negócios brasileiros
    no exterior (aba Internacional). Cria as tabelas
    `palavras_brasileiras` (palavras do nome que contam como sinal) e
    `regioes_brasileiras` (atalhos de região com grande comunidade
    brasileira, por país), editáveis em Gestão > Negócio brasileiro. Sem
    este script, o selo, o filtro e os atalhos já funcionam com as listas
    iniciais do código; só a edição pela Gestão fica desligada.

23. Etapa 23, em **três partes, nesta ordem**:
    `supabase/etapa23-1-platina-plano.sql`,
    `supabase/etapa23-2-platina-pagamentos.sql` e
    `supabase/etapa23-3-sites-ia.sql` — plano Platina (R$ 89,90/mês: tudo
    do Pro + 5 gerações de site com IA por mês), pacote avulso de +3
    gerações (R$ 39,90, só para quem está no Platina; não vence) e a
    geração de site. Cria as colunas `profiles.sites_restantes` e
    `profiles.sites_extras`, as tabelas `sites_gerados` (o site e o
    formulário confirmado) e `sites_geracoes` (uma linha por chamada à IA:
    usuário, data, modelo, tokens e custo estimado) e atualiza a função do
    webhook do Asaas (`processar_evento_asaas`) para o Platina e o pacote.
    Todas as regras ficam no banco: plano Platina válido, só lead que a
    pessoa desbloqueou, 1 geração por vez, 2 gerações por hora (e no máximo
    6 chamadas à IA por hora, contando ajustes), 2 ajustes grátis por site
    (o 3º conta como geração nova e devolve os 2 ajustes grátis) e saldo
    devolvido se a IA falhar. Os cupons continuam valendo só para Solo e
    Pro. Veja "Geração de site com IA" abaixo.

24. Etapa 24, em **duas partes, nesta ordem**:
    `supabase/etapa24-1-contratos-base.sql` e
    `supabase/etapa24-2-contratos-funcoes.sql` — gerador de contrato de
    criação de site (planos Solo, Pro e Platina). Cria a tabela
    `contratos` (cada usuário só lê os próprios, pelo RLS, sem exceção
    para administrador; escrita só pelas funções), as colunas
    `profiles.assinatura_path` e `profiles.contratos_seq`, o bucket
    **privado** `contratos` no Storage (PDF e PNG, até 5 MB; o usuário só
    lê e apaga a própria pasta, quem grava é o servidor) e o aviso do sino
    do tipo `contrato`. Precisa da `SUPABASE_SERVICE_ROLE_KEY`. Veja
    "Gerador de contratos" abaixo.

### Gerador de contratos (Solo, Pro e Platina)

Em "Meus leads", o lead "Em negociação" ou "Fechado" ganha o botão
"Gerar contrato"; a aba "Contratos" lista todos, com a situação
(rascunho, enviado, assinado).

- **Dois caminhos:** modelo padrão (a pessoa preenche só as partes, o
  valor e o foro) ou questionário de 8 passos, um por tela. O nome do
  lead e os dados do prestador (do último contrato) já vêm preenchidos.
  O texto das cláusulas fica em `lib/contratos/texto.ts`.
- **PDF:** gerado no servidor com `pdf-lib` (`lib/contratos/pdf.ts`),
  com cláusulas numeradas e os campos de assinatura das duas partes.
  O rascunho sai com a marca "RASCUNHO".
- **Envio:** o prestador assina (desenhando, enviando imagem ou usando a
  assinatura salva no Perfil). O PDF é guardado no Storage, o hash
  SHA-256 é gravado, o texto fica congelado e nasce um link público
  (`/contrato/<código>`, 256 bits aleatórios, válido por 30 dias, fora do
  Google). Para mudar algo depois, "Cancelar envio e editar" desativa o
  link.
- **Assinatura do cliente:** pelo link, sem conta. O servidor registra
  data e hora (do banco), IP, navegador, nome e e-mail informados, confere
  que o PDF não mudou (hash) e monta o PDF final com a página
  "Registro de assinatura". O dono recebe um aviso no sino.
- **LGPD:** "Apagar contrato definitivamente" apaga os arquivos do
  Storage e depois a linha do banco (e o aviso do sino). Funciona em
  qualquer plano.
- **Planos:** para mudar quem tem acesso, edite a função SQL
  `contratos_plano_permitido` e o campo `contratos` em `lib/planos.ts`.

### Geração de site com IA (plano Platina)

Em "Meus leads", cada lead tem o botão "Gerar site". Um formulário curto
confirma nome, ramo, cidade, serviços, WhatsApp, idioma e estilo visual
(Moderno, Elegante, Acolhedor ou Impacto). O servidor chama a IA
(`lib/sites/ia.ts`) e guarda uma landing page de uma página só, em HTML,
CSS e JS num arquivo, com topo, serviços, sobre, depoimentos,
localização e contato por WhatsApp. Em "Meus sites" a pessoa vê a
prévia, baixa o `.html` ou o `.zip` (com LEIA-ME e a pasta `fotos/`) e
pede ajustes.

- **Fotos:** o site nunca leva fotos do Google (nem de lugar nenhum). A IA
  é instruída a usar espaços reservados marcados, e o servidor confere de
  novo (`lib/sites/html.ts`): qualquer imagem de fora vira espaço
  reservado, e mapas incorporados e scripts de fora saem.
- **Depoimentos:** saem como "Depoimento de exemplo", para trocar pelos
  reais antes de publicar. A IA não inventa números, prêmios nem preços.
- **Hospedagem:** o Ártemis não hospeda o site; as telas dizem isso.
  O HTML fica guardado 30 dias depois da última versão (leva nome,
  telefone e endereço vindos do Google) e a rotina diária do sino apaga
  os vencidos. O registro de custo fica.
- **Chave da IA:** `ANTHROPIC_API_KEY` só no servidor. O saldo e os
  limites são conferidos pelas funções SQL `reservar_geracao_site` e
  `reservar_ajuste_site`; só o servidor (service_role) grava o
  resultado e o custo (`concluir_geracao_site` / `falhar_geracao_site`).
- **Tempo:** a IA leva de 1 a 3 minutos. As rotas `/api/sites/gerar` e
  `/api/sites/[id]/ajustar` pedem até 300 s à Vercel (`maxDuration`).
  Se a função for cortada no meio, a reserva é liberada sozinha depois
  de 15 minutos e o saldo volta.
- **Custo:** Gestão > Sites IA mostra o custo do mês, a média por
  geração e por ajuste, o custo por dia, por modelo, quem mais gasta e as
  últimas 30 chamadas. Os preços por modelo ficam em
  `lib/sites/custos.ts`. Para conferir direto no banco:

  ```sql
  select criado_em, tipo, status, modelo, tokens_entrada, tokens_saida, custo_usd
  from sites_geracoes order by criado_em desc limit 50;
  ```

### Provável negócio brasileiro (aba Internacional)

Cada lead da aba Internacional pode ganhar o selo "Provável negócio
brasileiro", com a força do sinal e o motivo em uma frase
(`lib/leads/brasileiro.ts`). Pesos: avaliação escrita em português = 3
pontos (+1 por avaliação a mais, até 3), tipo do negócio brasileiro no
Google (`brazilian_restaurant`, `acai_shop`) = 2, palavra da lista no
nome = 1. É sempre "provável": a tela nunca afirma.

- O idioma das avaliações vem em `reviews[].originalText.languageCode`,
  dentro do campo `places.reviews` que a busca já pedia para o selo de
  confiança. `places.types` e `places.primaryType` são de faixas mais
  baratas que a da busca. Resultado: nenhum campo novo caro e **o preço
  por chamada não muda**. Se `PEDIR_AVALIACOES_NA_BUSCA` (em
  `lib/leads/google.ts`) for desligado, o sinal das avaliações some (o
  tipo e o nome continuam).
- No desbloqueio, o detalhe do lugar não traz avaliações (pedir subiria o
  preço). Por isso a tela manda junto quantas avaliações em português a
  busca viu, para "Meus leads" manter o selo.
- Nesses leads, a mensagem pronta vai em português (editável no Perfil,
  "Mensagens para brasileiros no exterior") e o botão de WhatsApp
  aparece, com o número internacional da empresa.
- Filtro "Mostrar só prováveis negócios brasileiros" na busca e atalhos
  de região embaixo do campo de região.

### Rotinas agendadas (Vercel Cron)

O `vercel.json` agenda três rotas, que só aceitam chamadas com o
`CRON_SECRET`:

- `/api/cron/verificar-vendas` — toda segunda às 6h (Brasília). Verifica
  em lote as vendas em aberto: cada venda no máximo 1 vez por semana, até
  8 tentativas automáticas, e no máximo 30 verificações por usuário por
  mês. O Google só é consultado quando o site abre e tem domínio próprio;
  cada consulta vira uma linha em `chamadas_google` (tipo
  `verificacao_venda`).
- `/api/cron/fechar-mes` — dia 1º logo depois da meia-noite (Brasília).
  Guarda o rank do mês que acabou e credita o prêmio (25, 15 e 10
  desbloqueios). Não paga duas vezes, e fecha meses que tenham ficado
  para trás.
- `/api/cron/notificacoes` — todo dia às 8h (Brasília). Gera os avisos
  do sino: renovação (3 dias antes, 1 vez por ciclo), saldo baixo
  (3 buscas ou menos / 5 desbloqueios ou menos, 1 vez por ciclo),
  novidades e no máximo 1 incentivo por dia (venda pendente há mais de
  7 dias, negociação parada há mais de 7 dias, lead sem contato há mais
  de 3 dias), o aviso dos retornos agendados para o dia (etapa 10) e
  os avisos escritos em Gestão > Avisos (etapa 11).
  Rodar duas vezes no mesmo dia não duplica nada.

### Novidades do site (sino)

O jeito mais fácil agora é a tela Gestão > Avisos (etapa 11).
Continua valendo o jeito antigo: para avisar todos os usuários, escreva uma linha na tabela `novidades`
(Supabase > SQL Editor):

```sql
insert into public.novidades (titulo, texto, publicar_em, link)
values ('Título curto', 'Texto do aviso.', current_date, '/painel/buscar');
```

`publicar_em` é a data a partir da qual o aviso aparece e `link` é
opcional. Ele chega a todos na próxima rodada diária; para mandar na
hora, rode `select public.gerar_notificacoes();` logo depois.

Para rodar na hora (teste), use o botão "Run" em Vercel > Settings >
Cron Jobs.

### Links dos e-mails (Supabase Auth)

Em Supabase > Authentication > URL Configuration > Redirect URLs, deixe
liberado `https://<seu-domínio>/auth/callback**` (com os dois asteriscos,
para aceitar o `?next=...` usado na troca de e-mail e no "esqueci minha
senha"). Adicione também a URL de pré-visualização da Vercel, se usar.

### Login com o Google

1. Supabase > Authentication > Sign In / Providers > Google: ligado, com
   o Client ID e o Client Secret do Google Cloud. No Google Cloud, a
   "Authorized redirect URI" é a do Supabase
   (`https://<projeto>.supabase.co/auth/v1/callback`), não a do site.
2. Supabase > Authentication > URL Configuration:
   - **Site URL**: `https://artemisprospect.com.br`.
   - **Redirect URLs** (uma por linha):
     `https://artemisprospect.com.br/**`,
     `https://www.artemisprospect.com.br/**` (se o www também abrir o
     site), `https://*-<sua-conta>.vercel.app/**` (pré-visualizações da
     Vercel) e `http://localhost:3000/**`.
   O site pede ao Supabase para voltar ao endereço em que a pessoa
   está. Se esse endereço não estiver na lista, o Supabase manda para a
   Site URL — é por isso que, sem a linha da Vercel, o login feito numa
   pré-visualização terminaria no site oficial.
3. Quem entra pela primeira vez pelo Google ganha o perfil com o plano
   grátis (o mesmo gatilho do cadastro por e-mail), cai nas boas-vindas
   e, se a conta do Google tiver foto, ela já vem como foto inicial.
4. Quem já tem conta com o mesmo e-mail continua com a mesma conta: o
   Supabase liga o Google ao usuário que já existe ("automatic identity
   linking", que vem ligado). Não crie um segundo usuário manualmente.

## Webhook do Asaas

No painel do Asaas: Integrações > Webhooks > Adicionar webhook.

- URL: `https://<seu-domínio-de-produção>/api/asaas/webhook`
- Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- Versão da API: v3; tipo de envio: sequencial
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
  `PAYMENT_OVERDUE`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`,
  `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_REFUNDED`,
  `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED`,
  `SUBSCRIPTION_INACTIVATED`

Para auditar os pagamentos, no SQL Editor:

```sql
select recebido_em, evento, valor, asaas_payment_id, resultado
from pagamentos_eventos order by recebido_em desc;
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Deploy

Projeto conectado à Vercel. Cada push nesta branch gera um deploy de
pré-visualização automático.
