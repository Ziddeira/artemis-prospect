-- Ártemis Prospect — Etapa 23, parte 1 de 3: plano Platina
-- Rode isto DEPOIS de todos os scripts anteriores (até a etapa 22),
-- inteiro, de uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Depois rode a parte 2 (etapa23-2-platina-pagamentos.sql) e a parte 3
-- (etapa23-3-sites-ia.sql).
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * novo plano "platina" (R$ 89,90/mês): tudo do Pro (100 desbloqueios,
--     45 buscas, modo Hospedagem, aba Internacional) + 5 gerações de site
--     com IA por mês;
--   * profiles ganha "sites_restantes" (as 5 do mês; voltam a 5 a cada
--     renovação paga, não acumulam) e "sites_extras" (as do pacote avulso
--     de +3; não vencem e são gastas depois das do mês);
--   * os preços e limites (limites_do_plano, plano_por_valor,
--     preco_do_plano) passam a conhecer o Platina;
--   * as regras que liberavam algo "só para o Pro" (modo Hospedagem, aba
--     Internacional) ou "para Solo e Pro" (imagens na Comunidade, pedidos
--     de conversa) passam a valer também para o Platina;
--   * o administrador pode colocar uma conta no Platina (Gestão >
--     Usuários).
-- Os números estão também em lib/planos.ts (só para mostrar na tela).
-- Se mudar um, mude o outro.

-- 1. Regras das tabelas: aceitar o plano "platina" ---------------------------
-- As regras antigas foram criadas junto com as tabelas (nome automático),
-- por isso são achadas pelo conteúdo.
do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%plano%'
      and pg_get_constraintdef(oid) like '%gratis%'
  loop
    execute format('alter table public.profiles drop constraint %I', v_nome);
  end loop;

  for v_nome in
    select conname from pg_constraint
    where conrelid = 'public.assinaturas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%plano%'
      and pg_get_constraintdef(oid) like '%solo%'
  loop
    execute format('alter table public.assinaturas drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table public.profiles
  add constraint profiles_plano_valido
  check (plano in ('gratis', 'solo', 'pro', 'platina'));

alter table public.assinaturas
  add constraint assinaturas_plano_valido
  check (plano in ('solo', 'pro', 'platina'));

-- 2. Saldo de gerações de site -------------------------------------------------
alter table public.profiles
  add column if not exists sites_restantes integer not null default 0,
  add column if not exists sites_extras integer not null default 0;

alter table public.profiles drop constraint if exists profiles_sites_validos;
alter table public.profiles
  add constraint profiles_sites_validos check (sites_restantes >= 0 and sites_extras >= 0);

-- 3. Limites e preços ------------------------------------------------------------
-- Mesmas funções das etapas 3 e 11, agora com o Platina.
create or replace function public.limites_do_plano(
  p_plano text,
  out desbloqueios integer,
  out buscas integer
)
language sql
immutable
as $$
  select case p_plano when 'solo' then 50 when 'pro' then 100 when 'platina' then 100 else 5 end,
         case p_plano when 'solo' then 20 when 'pro' then 45 when 'platina' then 45 else 3 end;
$$;

-- Gerações de site por mês de cada plano.
create or replace function public.sites_do_plano(p_plano text)
returns integer
language sql
immutable
as $$
  select case p_plano when 'platina' then 5 else 0 end;
$$;

create or replace function public.plano_por_valor(p_valor numeric)
returns text
language sql
immutable
as $$
  select case p_valor when 34.90 then 'solo' when 69.90 then 'pro' when 89.90 then 'platina' else null end;
$$;

create or replace function public.preco_do_plano(p_plano text)
returns numeric
language sql
immutable
as $$
  select case p_plano when 'solo' then 34.90 when 'pro' then 69.90 when 'platina' then 89.90 else 0 end::numeric;
$$;

-- Planos com os recursos do Pro (modo Hospedagem e aba Internacional).
create or replace function public.plano_tem_recursos_pro(p_plano text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_plano in ('pro', 'platina'), false);
$$;

-- 4. iniciar_busca: Hospedagem e Internacional também no Platina -------------
-- A mesma função da etapa 21; só muda a conferência do plano.
create or replace function public.iniciar_busca(
  p_termos text[],
  p_areas text[],
  p_modo text,
  p_pais text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_buscas_restantes integer;
  v_total integer;
  v_recentes integer;
  v_termo text;
  v_area text;
  v_pais text;
begin
  if p_modo not in ('negocios', 'hospedagem', 'internacional') then
    raise exception 'Modo de busca inválido.';
  end if;

  if p_modo = 'internacional' then
    v_pais := upper(btrim(coalesce(p_pais, '')));
    if v_pais !~ '^[A-Z]{2}$' or v_pais = 'BR' then
      raise exception 'Escolha o país da busca.';
    end if;
  else
    v_pais := 'BR';
  end if;

  if p_termos is null or array_length(p_termos, 1) is null then
    raise exception 'Digite ao menos um nicho.';
  end if;

  if p_areas is null or array_length(p_areas, 1) is null then
    raise exception 'Digite ao menos uma região.';
  end if;

  v_total := array_length(p_termos, 1) * array_length(p_areas, 1);

  perform public.aplicar_vencimento_plano(auth.uid());

  select plano, buscas_restantes
    into v_plano, v_buscas_restantes
    from public.profiles
    where id = auth.uid()
    for update;

  if v_plano is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if p_modo = 'hospedagem' and not public.plano_tem_recursos_pro(v_plano) then
    raise exception 'O modo Hospedagem é dos planos Pro e Platina.';
  end if;

  if p_modo = 'internacional' and not public.plano_tem_recursos_pro(v_plano) then
    raise exception 'A aba Internacional é dos planos Pro e Platina.';
  end if;

  if v_buscas_restantes < v_total then
    raise exception
      'Saldo de buscas insuficiente: restam % e essa busca gastaria %.',
      v_buscas_restantes, v_total;
  end if;

  select count(*)
    into v_recentes
    from public.buscas
    where user_id = auth.uid()
      and criado_em > now() - interval '1 minute';

  if v_recentes + v_total > 10 then
    raise exception
      'Limite de 10 buscas por minuto atingido (% no último minuto, essa busca pediria mais %). Aguarde um pouco e tente de novo.',
      v_recentes, v_total;
  end if;

  update public.profiles
    set buscas_restantes = buscas_restantes - v_total
    where id = auth.uid();

  foreach v_termo in array p_termos loop
    foreach v_area in array p_areas loop
      insert into public.buscas (user_id, termo, area, modo, pais)
      values (auth.uid(), v_termo, v_area, p_modo, v_pais);
    end loop;
  end loop;

  return v_buscas_restantes - v_total;
end;
$$;

revoke all on function public.iniciar_busca(text[], text[], text, text) from public, anon;
grant execute on function public.iniciar_busca(text[], text[], text, text) to authenticated;

-- 5. Comunidade e Mensagens: o Platina tem o mesmo acesso do Solo e do Pro --
-- A mesma função da etapa 14 (também usada pelas Mensagens, etapa 16).
create or replace function public.comunidade_acesso_total(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin
        or (p.plano in ('solo', 'pro', 'platina')
            and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now()))
      from public.profiles p
     where p.id = p_user
  ), false);
$$;

revoke all on function public.comunidade_acesso_total(uuid) from public, anon, authenticated;

-- 6. Gestão > Visão geral: assinantes do Platina --------------------------------
-- A mesma função da etapa 11, com a contagem do Platina.
create or replace function public.admin_visao_geral()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := public.inicio_do_mes(public.mes_brasilia());
  v_resultado jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  with pagantes as (
    select distinct c.user_id
      from public.cobrancas c
      where c.tipo = 'assinatura'
        and c.creditado_em is not null
        and c.estornado_em is null
  ),
  primeira_paga as (
    select c.user_id, min(c.creditado_em) as primeira
      from public.cobrancas c
      where c.tipo = 'assinatura' and c.creditado_em is not null
      group by c.user_id
  )
  select jsonb_build_object(
    'contas_total', (select count(*) from public.profiles),
    'assinantes_por_plano', jsonb_build_object(
      'solo', (select count(*) from public.profiles p
                where p.plano = 'solo'
                  and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now())),
      'pro', (select count(*) from public.profiles p
               where p.plano = 'pro'
                 and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now())),
      'platina', (select count(*) from public.profiles p
                   where p.plano = 'platina'
                     and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now()))
    ),
    'contas_gratis', (select count(*) from public.profiles p
                       where p.plano = 'gratis'
                          or (p.plano_valido_ate is not null and p.plano_valido_ate + interval '3 days' < now())),
    'novos_cadastros_mes', (select count(*) from public.profiles where created_at >= v_inicio),
    'assinaturas_ativas', (select count(*) from public.assinaturas where status = 'ativa'),
    'assinaturas_inadimplentes', (select count(*) from public.assinaturas where status = 'inadimplente'),
    'receita_mensal_recorrente', (select coalesce(sum(public.preco_do_plano(plano)), 0)
                                    from public.assinaturas where status = 'ativa'),
    'receita_em_risco', (select coalesce(sum(public.preco_do_plano(plano)), 0)
                           from public.assinaturas where status = 'inadimplente'),
    'recebido_no_mes', (select coalesce(sum(valor), 0) from public.cobrancas
                          where creditado_em >= v_inicio and estornado_em is null),
    'cancelamentos_mes', (select count(*) from public.assinaturas where cancelada_em >= v_inicio),
    'contas_que_pagaram', (select count(*) from pagantes),
    'novos_assinantes_mes', (select count(*) from primeira_paga where primeira >= v_inicio)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.admin_visao_geral() from public, anon;
grant execute on function public.admin_visao_geral() to authenticated;

-- 7. Gestão > Usuários: ajustar conta para o Platina ---------------------------
-- A mesma função da etapa 11, aceitando "platina". Quando a conta ENTRA
-- no Platina pelo ajuste, recebe as 5 gerações de site do mês; quando
-- sai, perde as do mês (as do pacote avulso ficam guardadas).
create or replace function public.admin_ajustar_conta(
  p_user_id uuid,
  p_plano text,
  p_creditos integer,
  p_buscas integer,
  p_valido_ate date,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes public.profiles%rowtype;
  v_depois public.profiles%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_valido timestamptz;
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  if p_plano is null or p_plano not in ('gratis', 'solo', 'pro', 'platina') then
    raise exception 'Plano inválido.';
  end if;
  if p_creditos is null or p_creditos < 0 or p_creditos > 100000 then
    raise exception 'Desbloqueios: use um número de 0 a 100000.';
  end if;
  if p_buscas is null or p_buscas < 0 or p_buscas > 100000 then
    raise exception 'Buscas: use um número de 0 a 100000.';
  end if;
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'Escreva o motivo do ajuste (fica registrado na auditoria).';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'O motivo pode ter no máximo 500 caracteres.';
  end if;

  if p_plano = 'gratis' or p_valido_ate is null then
    v_valido := null;
  else
    if p_valido_ate < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'A data de validade não pode estar no passado.';
    end if;
    v_valido := (p_valido_ate + 1)::timestamp at time zone 'America/Sao_Paulo';
  end if;

  select * into v_antes from public.profiles where id = p_user_id for update;
  if v_antes.id is null then
    raise exception 'Conta não encontrada.';
  end if;

  if v_antes.plano = p_plano
     and v_antes.creditos_desbloqueio = p_creditos
     and v_antes.buscas_restantes = p_buscas
     and v_antes.plano_valido_ate is not distinct from v_valido then
    raise exception 'Nada mudou: os valores são iguais aos atuais.';
  end if;

  update public.profiles
     set plano = p_plano,
         creditos_desbloqueio = p_creditos,
         buscas_restantes = p_buscas,
         plano_valido_ate = v_valido,
         sites_restantes = case
           when p_plano = 'platina' and v_antes.plano <> 'platina' then public.sites_do_plano('platina')
           when p_plano <> 'platina' then 0
           else sites_restantes
         end
   where id = p_user_id
   returning * into v_depois;

  perform public.registrar_auditoria(
    'ajuste_conta',
    p_user_id,
    jsonb_build_object(
      'plano', v_antes.plano,
      'creditos_desbloqueio', v_antes.creditos_desbloqueio,
      'buscas_restantes', v_antes.buscas_restantes,
      'plano_valido_ate', v_antes.plano_valido_ate,
      'sites_restantes', v_antes.sites_restantes
    ),
    jsonb_build_object(
      'plano', v_depois.plano,
      'creditos_desbloqueio', v_depois.creditos_desbloqueio,
      'buscas_restantes', v_depois.buscas_restantes,
      'plano_valido_ate', v_depois.plano_valido_ate,
      'sites_restantes', v_depois.sites_restantes
    ),
    v_motivo
  );

  return jsonb_build_object(
    'plano', v_depois.plano,
    'creditos_desbloqueio', v_depois.creditos_desbloqueio,
    'buscas_restantes', v_depois.buscas_restantes,
    'plano_valido_ate', v_depois.plano_valido_ate
  );
end;
$$;

revoke all on function public.admin_ajustar_conta(uuid, text, integer, integer, date, text) from public, anon;
grant execute on function public.admin_ajustar_conta(uuid, text, integer, integer, date, text) to authenticated;

notify pgrst, 'reload schema';
