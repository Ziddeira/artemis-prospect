-- Ártemis Prospect — Etapa 26: aba Domínios
-- Rode DEPOIS da etapa 25. Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   - tabela registradores_links: o link do botão "Registrar" de cada
--     extensão (.com.br, .com, .net, .app, .site, .online), editável em
--     Gestão > Registradores (para usar links de afiliado);
--   - tabela dominios_buscas + função dominios_contar_busca: limite de 6
--     buscas de domínio por minuto para cada usuário;
--   - tabela dominios_cache: guarda por 10 minutos o resultado de cada
--     consulta, para não perguntar a mesma coisa de novo. Só o servidor
--     (service_role) lê e grava.
--
-- Nada aqui mexe em planos, saldos ou cobrança: buscar domínio não gasta
-- crédito.

-- 1. Links dos registradores --------------------------------------------------
-- url: só https. Os marcadores {dominio}, {nome} e {extensao} são trocados
-- pelo domínio buscado (ex.: padaria.com.br, padaria e com.br).
create table if not exists public.registradores_links (
  extensao text primary key check (extensao in ('com.br', 'com', 'net', 'app', 'site', 'online')),
  registrador text not null check (char_length(btrim(registrador)) between 1 and 60),
  url text not null check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 1000),
  atualizado_em timestamptz not null default now()
);

alter table public.registradores_links enable row level security;

-- Todo usuário logado lê (o botão "Registrar" precisa do link; não tem
-- nada pessoal). Escrever, só pela função de administrador abaixo.
grant select on public.registradores_links to authenticated;
revoke insert, update, delete on public.registradores_links from authenticated, anon;

drop policy if exists "Usuários logados leem os links dos registradores" on public.registradores_links;
create policy "Usuários logados leem os links dos registradores"
  on public.registradores_links
  for select
  to authenticated
  using (true);

-- Links iniciais (os mesmos de lib/dominios/regras.ts). Não troca o que
-- você já salvou pela Gestão.
insert into public.registradores_links (extensao, registrador, url) values
  ('com.br', 'Registro.br', 'https://registro.br/busca-dominio/?fqdn={dominio}'),
  ('com', 'GoDaddy', 'https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}'),
  ('net', 'GoDaddy', 'https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}'),
  ('app', 'GoDaddy', 'https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}'),
  ('site', 'GoDaddy', 'https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}'),
  ('online', 'GoDaddy', 'https://www.godaddy.com/pt-br/domainsearch/find?domainToCheck={dominio}')
on conflict (extensao) do nothing;

-- Salvar o link de uma extensão (só administrador). Fica na auditoria.
create or replace function public.admin_salvar_registrador(p_extensao text, p_registrador text, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_extensao text := lower(btrim(coalesce(p_extensao, '')));
  v_registrador text := btrim(coalesce(p_registrador, ''));
  v_url text := btrim(coalesce(p_url, ''));
  v_antes jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if v_extensao not in ('com.br', 'com', 'net', 'app', 'site', 'online') then
    raise exception 'Extensão inválida.';
  end if;
  if char_length(v_registrador) not between 1 and 60 then
    raise exception 'Informe o nome do registrador (até 60 caracteres).';
  end if;
  if v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 1000 then
    raise exception 'O link precisa começar com https:// e não pode ter espaços.';
  end if;

  select jsonb_build_object('registrador', registrador, 'url', url) into v_antes
    from registradores_links where extensao = v_extensao;

  insert into registradores_links (extensao, registrador, url, atualizado_em)
  values (v_extensao, v_registrador, v_url, now())
  on conflict (extensao) do update
    set registrador = excluded.registrador, url = excluded.url, atualizado_em = now();

  perform public.registrar_auditoria(
    'registrador_link_salvo',
    null,
    v_antes,
    jsonb_build_object('extensao', v_extensao, 'registrador', v_registrador, 'url', v_url),
    null
  );
end;
$$;

revoke all on function public.admin_salvar_registrador(text, text, text) from public, anon;
grant execute on function public.admin_salvar_registrador(text, text, text) to authenticated;

-- 2. Limite de buscas por minuto ----------------------------------------------
-- Uma linha por busca feita. Ninguém lê direto: só a função abaixo.
create table if not exists public.dominios_buscas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create index if not exists dominios_buscas_user_idx
  on public.dominios_buscas (user_id, criado_em desc);

alter table public.dominios_buscas enable row level security;
revoke all on public.dominios_buscas from anon, authenticated;

-- Confere o limite de 6 buscas por minuto do usuário logado e já conta
-- esta. Passou do limite: erro AP429 com quantos segundos faltam.
-- Devolve quantas buscas ainda cabem neste minuto.
create or replace function public.dominios_contar_busca()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limite constant integer := 6;
  v_qtd integer;
  v_mais_antiga timestamptz;
  v_segundos integer;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado.';
  end if;

  select count(*), min(criado_em) into v_qtd, v_mais_antiga
    from dominios_buscas
    where user_id = v_uid and criado_em > now() - interval '1 minute';

  if v_qtd >= v_limite then
    v_segundos := greatest(1, ceil(extract(epoch from (v_mais_antiga + interval '1 minute' - now())))::integer);
    raise exception 'Você fez % buscas de domínio no último minuto. Espere % segundos e tente de novo.', v_qtd, v_segundos
      using errcode = 'AP429';
  end if;

  insert into dominios_buscas (user_id) values (v_uid);

  -- Faxina de vez em quando: nada aqui interessa depois de 1 dia.
  if random() < 0.02 then
    delete from dominios_buscas where criado_em < now() - interval '1 day';
  end if;

  return v_limite - v_qtd - 1;
end;
$$;

revoke all on function public.dominios_contar_busca() from public, anon;
grant execute on function public.dominios_contar_busca() to authenticated;

-- 3. Cache das consultas ------------------------------------------------------
-- Um domínio por linha, com o último resultado. Só o servidor usa (a
-- chave service_role), para ninguém gravar resultado falso.
create table if not exists public.dominios_cache (
  dominio text primary key check (char_length(dominio) <= 253),
  situacao text not null check (situacao in ('disponivel', 'ocupado')),
  expira_em timestamptz,
  consultado_em timestamptz not null default now()
);

alter table public.dominios_cache enable row level security;
revoke all on public.dominios_cache from anon, authenticated;
grant select on public.dominios_cache to service_role;

-- Grava vários resultados de uma vez:
--   [{"dominio": "padaria.com.br", "situacao": "ocupado", "expira_em": "2027-01-01T00:00:00Z"}]
create or replace function public.dominios_cache_gravar(p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into dominios_cache (dominio, situacao, expira_em, consultado_em)
  select lower(i.dominio), i.situacao, i.expira_em, now()
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb))
      as i (dominio text, situacao text, expira_em timestamptz)
    where i.dominio is not null and i.situacao in ('disponivel', 'ocupado')
  on conflict (dominio) do update
    set situacao = excluded.situacao,
        expira_em = excluded.expira_em,
        consultado_em = excluded.consultado_em;

  -- Faxina de vez em quando: resultado com mais de 1 dia não serve mais.
  if random() < 0.02 then
    delete from dominios_cache where consultado_em < now() - interval '1 day';
  end if;
end;
$$;

revoke all on function public.dominios_cache_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.dominios_cache_gravar(jsonb) to service_role;

notify pgrst, 'reload schema';
