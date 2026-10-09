-- Ártemis Prospect — Etapa 24, parte 2 de 2: contratos (funções)
-- Rode DEPOIS da parte 1 (etapa24-1-contratos-base.sql), inteiro, de uma
-- vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Regras desta etapa (todas conferidas AQUI, no banco):
--   * criar, editar e enviar contrato: planos Solo, Pro e Platina dentro
--     da validade (para mudar, edite só contratos_plano_permitido);
--   * só a partir de um lead que a própria pessoa desbloqueou e que está
--     "em negociação" ou "fechado";
--   * no máximo 30 contratos criados por dia e 500 guardados por usuário;
--   * só o rascunho pode ser editado. Depois de enviado, o texto e o PDF
--     ficam congelados (o hash do PDF é gravado); para mudar algo, cancele
--     o envio (o link para de funcionar) e edite;
--   * ver, baixar e APAGAR DEFINITIVAMENTE funcionam em qualquer plano:
--     o dado é do usuário, mesmo que o plano tenha vencido;
--   * o registro de envio e o de assinatura do cliente (IP, data e hora,
--     hash do PDF) só o servidor grava (service_role), nunca o navegador.

-- 1. Quais planos têm contratos ------------------------------------------------
-- O mesmo está em lib/planos.ts (campo "contratos"). Se mudar um, mude o outro.
create or replace function public.contratos_plano_permitido(p_plano text)
returns boolean
language sql
immutable
as $$
  select p_plano in ('solo', 'pro', 'platina');
$$;

-- Uso interno: aplica o vencimento e diz se o plano da pessoa libera contratos.
create or replace function public.contratos_acesso(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_validade timestamptz;
begin
  perform public.aplicar_vencimento_plano(p_user_id);
  select plano, plano_valido_ate into v_plano, v_validade from public.profiles where id = p_user_id;
  return v_plano is not null
     and public.contratos_plano_permitido(v_plano)
     and (v_validade is null or v_validade + interval '3 days' >= now());
end;
$$;

revoke all on function public.contratos_acesso(uuid) from public, anon, authenticated;

-- Para a tela: o plano de quem está logado libera contratos?
create or replace function public.meu_acesso_contratos()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return public.contratos_acesso(auth.uid());
end;
$$;

revoke all on function public.meu_acesso_contratos() from public, anon;
grant execute on function public.meu_acesso_contratos() to authenticated;

-- Uso interno: confere o formato das respostas e tira o título (nome do
-- contratante). A validação campo a campo é do servidor
-- (lib/contratos/dados.ts); aqui é o limite de tamanho e o básico.
create or replace function public.contratos_titulo(p_dados jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_nome text;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or length(p_dados::text) > 20000 then
    raise exception 'Dados do contrato inválidos.';
  end if;
  v_nome := btrim(coalesce(p_dados -> 'contratante' ->> 'nome', ''));
  if char_length(v_nome) < 2 then
    raise exception 'Informe o nome da empresa contratante.';
  end if;
  return left(v_nome, 160);
end;
$$;

-- 2. Criar um contrato (rascunho) ----------------------------------------------
create or replace function public.criar_contrato(p_place_id text, p_modo text, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_seq integer;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if p_modo is null or p_modo not in ('padrao', 'questionario') then
    raise exception 'Escolha o modelo padrão ou o questionário.';
  end if;
  v_titulo := public.contratos_titulo(p_dados);

  if not public.contratos_acesso(auth.uid()) then
    raise exception 'O gerador de contratos é dos planos Solo, Pro e Platina.'
      using errcode = 'AP402';
  end if;

  if not exists (
    select 1 from public.leads_desbloqueados
     where user_id = auth.uid()
       and place_id = p_place_id
       and situacao in ('negociacao', 'fechado')
  ) then
    raise exception 'Só dá para gerar contrato de um lead seu que esteja "em negociação" ou "fechado".';
  end if;

  if (select count(*) from public.contratos
       where user_id = auth.uid() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Limite de 30 contratos por dia atingido. Tente de novo amanhã.';
  end if;
  if (select count(*) from public.contratos where user_id = auth.uid()) >= 500 then
    raise exception 'Você chegou a 500 contratos guardados. Apague os que não usa mais para criar outro.';
  end if;

  update public.profiles
     set contratos_seq = contratos_seq + 1
   where id = auth.uid()
  returning contratos_seq into v_seq;

  insert into public.contratos (user_id, place_id, numero, titulo, modo, dados)
  values (
    auth.uid(),
    p_place_id,
    to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '/' || lpad(v_seq::text, 4, '0'),
    v_titulo,
    p_modo,
    p_dados
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.criar_contrato(text, text, jsonb) from public, anon;
grant execute on function public.criar_contrato(text, text, jsonb) to authenticated;

-- 3. Salvar alterações (só rascunho) ---------------------------------------------
create or replace function public.salvar_contrato(p_id uuid, p_modo text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_titulo text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if p_modo is null or p_modo not in ('padrao', 'questionario') then
    raise exception 'Modo do contrato inválido.';
  end if;
  v_titulo := public.contratos_titulo(p_dados);

  select status into v_status from public.contratos
   where id = p_id and user_id = auth.uid()
   for update;
  if v_status is null then
    raise exception 'Contrato não encontrado.';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'Só o rascunho pode ser editado. Cancele o envio para editar.';
  end if;

  if not public.contratos_acesso(auth.uid()) then
    raise exception 'O gerador de contratos é dos planos Solo, Pro e Platina.'
      using errcode = 'AP402';
  end if;

  update public.contratos
     set dados = p_dados, modo = p_modo, titulo = v_titulo, atualizado_em = now()
   where id = p_id;
end;
$$;

revoke all on function public.salvar_contrato(uuid, text, jsonb) from public, anon;
grant execute on function public.salvar_contrato(uuid, text, jsonb) to authenticated;

-- 4. Registrar o envio (só o servidor) ---------------------------------------------
-- O servidor confere o login, gera o PDF com a assinatura do prestador,
-- guarda no Storage, calcula o hash e chama esta função. Ela confere de
-- novo o dono, a situação e o plano, e congela tudo.
create or replace function public.registrar_envio_contrato(
  p_user_id uuid,
  p_id uuid,
  p_conteudo jsonb,
  p_pdf_path text,
  p_hash text,
  p_campo_cliente jsonb,
  p_token text,
  p_nome text,
  p_email text,
  p_ip text,
  p_navegador text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_agora timestamptz := now();
begin
  select status into v_status from public.contratos
   where id = p_id and user_id = p_user_id
   for update;
  if v_status is null then
    raise exception 'Contrato não encontrado.';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'Este contrato já foi enviado.';
  end if;
  if not public.contratos_acesso(p_user_id) then
    raise exception 'O gerador de contratos é dos planos Solo, Pro e Platina.'
      using errcode = 'AP402';
  end if;
  if p_pdf_path !~ ('^' || p_user_id::text || '/' || p_id::text || '/original-[a-z0-9]{6,40}\.pdf$') then
    raise exception 'Caminho do PDF inválido.';
  end if;
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash inválido.';
  end if;
  if p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception 'Código do link inválido.';
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' or length(p_conteudo::text) > 60000 then
    raise exception 'Texto do contrato inválido.';
  end if;

  update public.contratos
     set status = 'enviado',
         conteudo = p_conteudo,
         pdf_original_path = p_pdf_path,
         pdf_original_hash = p_hash,
         campo_cliente = p_campo_cliente,
         token = p_token,
         link_expira_em = v_agora + interval '30 days',
         avisos_aceitos_em = v_agora,
         enviado_em = v_agora,
         prestador_nome = left(btrim(coalesce(p_nome, '')), 160),
         prestador_email = left(btrim(coalesce(p_email, '')), 200),
         prestador_ip = left(coalesce(p_ip, ''), 64),
         prestador_navegador = left(coalesce(p_navegador, ''), 300),
         prestador_assinou_em = v_agora,
         atualizado_em = v_agora
   where id = p_id;

  return v_agora;
end;
$$;

revoke all on function public.registrar_envio_contrato(uuid, uuid, jsonb, text, text, jsonb, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_contrato(uuid, uuid, jsonb, text, text, jsonb, text, text, text, text, text) to service_role;

-- 5. Cancelar o envio (volta a rascunho) ----------------------------------------------
-- Só antes de o cliente assinar. O link antigo para de funcionar e a
-- assinatura do prestador é descartada. Devolve o caminho do PDF antigo,
-- para o servidor apagar o arquivo.
create or replace function public.cancelar_envio_contrato(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contratos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  select * into v_c from public.contratos
   where id = p_id and user_id = auth.uid()
   for update;
  if v_c.id is null then
    raise exception 'Contrato não encontrado.';
  end if;
  if v_c.status = 'assinado' then
    raise exception 'O cliente já assinou: este contrato não pode mais ser alterado.';
  end if;
  if v_c.status <> 'enviado' then
    raise exception 'Este contrato ainda não foi enviado.';
  end if;

  update public.contratos
     set status = 'rascunho',
         conteudo = null,
         pdf_original_path = null,
         pdf_original_hash = null,
         campo_cliente = null,
         token = null,
         link_expira_em = null,
         enviado_em = null,
         prestador_nome = null,
         prestador_email = null,
         prestador_ip = null,
         prestador_navegador = null,
         prestador_assinou_em = null,
         atualizado_em = now()
   where id = p_id;

  return v_c.pdf_original_path;
end;
$$;

revoke all on function public.cancelar_envio_contrato(uuid) from public, anon;
grant execute on function public.cancelar_envio_contrato(uuid) to authenticated;

-- 6. Assinatura do cliente pelo link público (só o servidor) ------------------------
-- Trava a linha: duas assinaturas ao mesmo tempo não passam. Devolve o
-- contrato já assinado (data e hora gravadas pelo banco).
create or replace function public.registrar_assinatura_cliente(
  p_token text,
  p_nome text,
  p_email text,
  p_ip text,
  p_navegador text,
  p_assinatura_path text
)
returns setof public.contratos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contratos%rowtype;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception 'Link inválido.';
  end if;

  select * into v_c from public.contratos where token = p_token for update;
  if v_c.id is null then
    raise exception 'Link inválido ou contrato cancelado.';
  end if;
  if v_c.status = 'assinado' then
    raise exception 'Este contrato já foi assinado.';
  end if;
  if v_c.status <> 'enviado' or v_c.link_expira_em is null or v_c.link_expira_em < now() then
    raise exception 'Este link expirou. Peça um link novo a quem enviou o contrato.';
  end if;
  if char_length(v_nome) < 3 or char_length(v_nome) > 120 then
    raise exception 'Escreva seu nome completo.';
  end if;
  if char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Confira o e-mail.';
  end if;
  if p_assinatura_path !~ ('^' || v_c.user_id::text || '/' || v_c.id::text || '/cliente-[a-z0-9]{6,40}\.png$') then
    raise exception 'Imagem da assinatura inválida.';
  end if;

  update public.contratos
     set status = 'assinado',
         cliente_nome = v_nome,
         cliente_email = v_email,
         cliente_ip = left(coalesce(p_ip, ''), 64),
         cliente_navegador = left(coalesce(p_navegador, ''), 300),
         cliente_assinou_em = now(),
         cliente_assinatura_path = p_assinatura_path,
         -- O cliente ainda pode baixar a cópia assinada pelo link por 30 dias.
         link_expira_em = now() + interval '30 days',
         atualizado_em = now()
   where id = v_c.id
  returning * into v_c;

  -- Aviso no sino de quem enviou. Se falhar, a assinatura vale do mesmo jeito.
  begin
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
    values (
      v_c.user_id,
      'contrato',
      'Contrato assinado',
      'O cliente assinou o contrato nº ' || v_c.numero || '. O PDF assinado, com a página de registro, já está disponível.',
      '/painel/contratos/' || v_c.id::text
    );
  exception when others then
    null;
  end;

  return next v_c;
end;
$$;

revoke all on function public.registrar_assinatura_cliente(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_assinatura_cliente(text, text, text, text, text, text) to service_role;

-- PDF final (contrato + página de registro), gravado depois da assinatura.
create or replace function public.registrar_pdf_assinado(p_id uuid, p_path text, p_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash inválido.';
  end if;
  update public.contratos
     set pdf_assinado_path = p_path, pdf_assinado_hash = p_hash
   where id = p_id
     and status = 'assinado'
     and p_path ~ ('^' || user_id::text || '/' || id::text || '/assinado-[a-z0-9]{6,40}\.pdf$');
end;
$$;

revoke all on function public.registrar_pdf_assinado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pdf_assinado(uuid, text, text) to service_role;

-- 7. Apagar definitivamente (LGPD) ------------------------------------------------------
-- Funciona em qualquer situação e em qualquer plano. Os arquivos do
-- Storage são apagados pelo servidor ANTES de chamar esta função.
create or replace function public.apagar_contrato(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  delete from public.contratos where id = p_id and user_id = auth.uid();
  if not found then
    return false;
  end if;
  -- O aviso do sino sobre este contrato vai junto.
  delete from public.notificacoes
   where user_id = auth.uid() and link = '/painel/contratos/' || p_id::text;
  return true;
end;
$$;

revoke all on function public.apagar_contrato(uuid) from public, anon;
grant execute on function public.apagar_contrato(uuid) to authenticated;

-- 8. Assinatura salva no perfil -------------------------------------------------------------
-- Grava (ou apaga, com nulo) o caminho da imagem. Só aceita arquivo na
-- pasta do próprio usuário. Devolve o caminho anterior, para o servidor
-- apagar o arquivo antigo.
create or replace function public.definir_assinatura_perfil(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antiga text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if p_path is not null
     and p_path !~ ('^' || auth.uid()::text || '/assinatura-[a-z0-9]{6,40}\.png$') then
    raise exception 'Caminho da assinatura inválido.';
  end if;

  select assinatura_path into v_antiga from public.profiles where id = auth.uid() for update;
  update public.profiles set assinatura_path = p_path where id = auth.uid();
  return v_antiga;
end;
$$;

revoke all on function public.definir_assinatura_perfil(text) from public, anon;
grant execute on function public.definir_assinatura_perfil(text) to authenticated;

notify pgrst, 'reload schema';
