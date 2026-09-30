-- Ártemis Prospect — Etapa 21, parte 2: aba Internacional (funções)
-- Rode isto DEPOIS da parte 1 (etapa21-1-internacional-base.sql),
-- inteiro, de uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).

-- 1. iniciar_busca: agora com o modo "internacional" ------------------------
-- A mesma função da etapa 3, com duas diferenças:
--   - aceita o modo "internacional", só no plano Pro (igual Hospedagem);
--   - recebe o país (p_pais), obrigatório no modo internacional.
-- A cobrança não muda: 1 busca por termo × região, em qualquer modo.
-- A versão antiga (3 parâmetros) sai, senão o banco não saberia qual das
-- duas usar quando o país não é enviado.
drop function if exists public.iniciar_busca(text[], text[], text);

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

  if p_modo = 'hospedagem' and v_plano <> 'pro' then
    raise exception 'O modo Hospedagem é exclusivo do plano Pro.';
  end if;

  if p_modo = 'internacional' and v_plano <> 'pro' then
    raise exception 'A aba Internacional é exclusiva do plano Pro.';
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

-- 2. salvar_ultima_busca: guarda também o país ------------------------------
-- A mesma função da etapa 15, aceitando o modo "internacional" e o país.
drop function if exists public.salvar_ultima_busca(text[], text[], text, jsonb, text);

create or replace function public.salvar_ultima_busca(
  p_termos text[],
  p_areas text[],
  p_modo text,
  p_leads jsonb,
  p_aviso text,
  p_pais text default null
)
returns table (feita_em timestamptz, expira_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_agora timestamptz := now();
  v_modo text;
  v_pais text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if p_leads is null or jsonb_typeof(p_leads) <> 'array' then
    raise exception 'Lista de leads inválida.';
  end if;

  v_modo := case when p_modo in ('hospedagem', 'internacional') then p_modo else 'negocios' end;
  v_pais := case
    when v_modo = 'internacional' and upper(coalesce(p_pais, '')) ~ '^[A-Z]{2}$' then upper(p_pais)
    else null
  end;
  if v_modo = 'internacional' and v_pais is null then
    raise exception 'País da busca inválido.';
  end if;

  insert into public.ultima_busca as u
    (user_id, termos, areas, modo, pais, leads, total_leads, aviso, feita_em, expira_em)
  values (
    auth.uid(),
    coalesce(p_termos, '{}'),
    coalesce(p_areas, '{}'),
    v_modo,
    v_pais,
    p_leads,
    jsonb_array_length(p_leads),
    left(p_aviso, 500),
    v_agora,
    v_agora + interval '30 days'
  )
  on conflict (user_id) do update
    set termos = excluded.termos,
        areas = excluded.areas,
        modo = excluded.modo,
        pais = excluded.pais,
        leads = excluded.leads,
        total_leads = excluded.total_leads,
        aviso = excluded.aviso,
        feita_em = excluded.feita_em,
        expira_em = excluded.expira_em;

  update public.ultima_busca u
    set leads = null
    where u.leads is not null
      and u.expira_em <= v_agora;

  return query select v_agora, v_agora + interval '30 days';
end;
$$;

revoke all on function public.salvar_ultima_busca(text[], text[], text, jsonb, text, text) from public, anon;
grant execute on function public.salvar_ultima_busca(text[], text[], text, jsonb, text, text) to authenticated;

-- 3. minha_ultima_busca: devolve também o país -------------------------------
-- O formato da resposta mudou (coluna "pais"), então a função antiga
-- precisa sair antes.
drop function if exists public.minha_ultima_busca();

create or replace function public.minha_ultima_busca()
returns table (
  termos text[],
  areas text[],
  modo text,
  pais text,
  leads jsonb,
  total_leads integer,
  aviso text,
  feita_em timestamptz,
  expira_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  update public.ultima_busca u
    set leads = null
    where u.user_id = auth.uid()
      and u.leads is not null
      and u.expira_em <= now();

  return query
    select u.termos, u.areas, u.modo, u.pais, u.leads, u.total_leads, u.aviso, u.feita_em, u.expira_em
    from public.ultima_busca u
    where u.user_id = auth.uid();
end;
$$;

revoke all on function public.minha_ultima_busca() from public, anon;
grant execute on function public.minha_ultima_busca() to authenticated;

-- 4. Sites de terceiros: incluir e tirar (só administrador) ------------------
-- Cada mudança fica na auditoria da Gestão.
create or replace function public.admin_adicionar_dominio_terceiro(p_pais text, p_dominio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_dominio text := lower(btrim(coalesce(p_dominio, '')));
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if v_pais !~ '^[A-Z]{2}$' then
    raise exception 'País inválido.';
  end if;
  if v_dominio !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' or length(v_dominio) > 253 then
    raise exception 'Domínio inválido. Use só o endereço, sem https:// nem barra: ex.: yelp.com';
  end if;

  insert into public.dominios_terceiro (pais, dominio)
  values (v_pais, v_dominio)
  on conflict (pais, dominio) do nothing;

  if found then
    perform public.registrar_auditoria(
      'dominio_terceiro_incluido',
      null,
      null,
      jsonb_build_object('pais', v_pais, 'dominio', v_dominio),
      null
    );
  end if;
end;
$$;

revoke all on function public.admin_adicionar_dominio_terceiro(text, text) from public, anon;
grant execute on function public.admin_adicionar_dominio_terceiro(text, text) to authenticated;

create or replace function public.admin_remover_dominio_terceiro(p_pais text, p_dominio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_dominio text := lower(btrim(coalesce(p_dominio, '')));
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  delete from public.dominios_terceiro
    where pais = v_pais and dominio = v_dominio;

  if found then
    perform public.registrar_auditoria(
      'dominio_terceiro_removido',
      null,
      jsonb_build_object('pais', v_pais, 'dominio', v_dominio),
      null,
      null
    );
  end if;
end;
$$;

revoke all on function public.admin_remover_dominio_terceiro(text, text) from public, anon;
grant execute on function public.admin_remover_dominio_terceiro(text, text) to authenticated;

-- 5. salvar_modelos_mensagem: modelos em inglês do Perfil --------------------
-- Guarda os modelos de um idioma (ex.: 'en') só no perfil de quem está
-- logado. p_modelos nulo = volta aos modelos padrão daquele idioma.
create or replace function public.salvar_modelos_mensagem(p_idioma text, p_modelos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idioma text := lower(btrim(coalesce(p_idioma, '')));
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if v_idioma !~ '^[a-z]{2}$' then
    raise exception 'Idioma inválido.';
  end if;

  if p_modelos is null then
    update public.profiles
      set modelos_mensagem = nullif(coalesce(modelos_mensagem, '{}'::jsonb) - v_idioma, '{}'::jsonb)
      where id = auth.uid();
    return;
  end if;

  if jsonb_typeof(p_modelos) <> 'object'
     or jsonb_typeof(p_modelos -> 'emailAssunto') is distinct from 'string'
     or jsonb_typeof(p_modelos -> 'emailCorpo') is distinct from 'string'
     or jsonb_typeof(p_modelos -> 'curta') is distinct from 'string' then
    raise exception 'Modelos de mensagem inválidos.';
  end if;
  if length(p_modelos ->> 'emailAssunto') > 200 then
    raise exception 'O assunto do e-mail pode ter no máximo 200 caracteres.';
  end if;
  if length(p_modelos ->> 'emailCorpo') > 3000 then
    raise exception 'O texto do e-mail pode ter no máximo 3000 caracteres.';
  end if;
  if length(p_modelos ->> 'curta') > 1000 then
    raise exception 'A mensagem curta pode ter no máximo 1000 caracteres.';
  end if;

  update public.profiles
    set modelos_mensagem = coalesce(modelos_mensagem, '{}'::jsonb)
      || jsonb_build_object(v_idioma, jsonb_build_object(
        'emailAssunto', p_modelos ->> 'emailAssunto',
        'emailCorpo', p_modelos ->> 'emailCorpo',
        'curta', p_modelos ->> 'curta'
      ))
    where id = auth.uid();
end;
$$;

revoke all on function public.salvar_modelos_mensagem(text, jsonb) from public, anon;
grant execute on function public.salvar_modelos_mensagem(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
