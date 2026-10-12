-- Ártemis Prospect — Etapa 27, parte 2 de 3: link de indicação (base)
-- Rode DEPOIS da parte 1 (etapa27-1-relatorio-mensal.sql), inteiro, de
-- uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * cada perfil ganha um código de indicação único
--     (profiles.codigo_indicacao), usado no link /convite/<código>;
--   * nova tabela "indicacoes": quem indicou quem, e o que já foi pago.
--     Ninguém do navegador lê nem escreve nela;
--   * função "vincular_indicacao" (só o servidor chama, logo depois do
--     cadastro): liga a conta NOVA a quem indicou. Recusa indicar a si
--     mesmo (mesma conta ou mesmo e-mail, inclusive "nome+1@gmail.com" e
--     variações com ponto do Gmail) e contas que não acabaram de nascer;
--   * função "minhas_indicacoes" (o Perfil lê): quantas pessoas a pessoa
--     indicou e quanto ganhou.
-- As recompensas ficam na parte 3.

-- 1. Código de indicação ------------------------------------------------------
alter table public.profiles add column if not exists codigo_indicacao text;

create unique index if not exists profiles_codigo_indicacao_idx
  on public.profiles (codigo_indicacao);

-- 8 caracteres, sem letras e números que se confundem (0/o, 1/l/i).
-- Não é segredo (vai num link público): só precisa ser único.
create or replace function public.gerar_codigo_indicacao()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_letras constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_codigo text;
begin
  loop
    select string_agg(substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1), '')
      into v_codigo
      from generate_series(1, 8);
    exit when not exists (select 1 from public.profiles where codigo_indicacao = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

revoke all on function public.gerar_codigo_indicacao() from public, anon, authenticated;

-- Perfil novo já nasce com código (sem mexer na função do cadastro).
create or replace function public.preencher_codigo_indicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo_indicacao is null then
    new.codigo_indicacao := public.gerar_codigo_indicacao();
  end if;
  return new;
end;
$$;

revoke all on function public.preencher_codigo_indicacao() from public, anon, authenticated;

drop trigger if exists profiles_codigo_indicacao on public.profiles;
create trigger profiles_codigo_indicacao
  before insert on public.profiles
  for each row execute function public.preencher_codigo_indicacao();

-- Quem já tinha conta ganha um código agora.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.profiles where codigo_indicacao is null loop
    update public.profiles set codigo_indicacao = public.gerar_codigo_indicacao() where id = v_id;
  end loop;
end;
$$;

-- 2. Tabela "indicacoes" -------------------------------------------------------
-- Uma linha por pessoa indicada (cada conta só pode ser indicada uma vez).
--   indicado_id: vira nulo se a conta indicada for apagada, mas a linha
--                fica — assim apagar contas não "libera" o limite do mês.
--   bonus_cadastro / bonus_plano: desbloqueios pagos (0 = não pagou).
--   *_em: quando a recompensa foi decidida (paga ou não).
--   *_motivo: 'pago', 'limite_mes' (passou de 20 no mês) ou, no plano,
--             'estornado' (o 1º pagamento foi estornado e os
--             desbloqueios foram tirados).
create table if not exists public.indicacoes (
  id bigint generated always as identity primary key,
  indicador_id uuid not null references auth.users (id) on delete cascade,
  indicado_id uuid unique references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  email_confirmado_em timestamptz,
  bonus_cadastro integer not null default 0 check (bonus_cadastro >= 0),
  bonus_cadastro_em timestamptz,
  bonus_cadastro_motivo text check (bonus_cadastro_motivo in ('pago', 'limite_mes')),
  plano_pago_em timestamptz,
  plano_pago_cobranca text,
  bonus_plano integer not null default 0 check (bonus_plano >= 0),
  bonus_plano_em timestamptz,
  bonus_plano_motivo text check (bonus_plano_motivo in ('pago', 'limite_mes', 'estornado')),
  check (indicador_id is distinct from indicado_id)
);

create index if not exists indicacoes_indicador_idx on public.indicacoes (indicador_id);
create index if not exists indicacoes_cobranca_idx on public.indicacoes (plano_pago_cobranca)
  where plano_pago_cobranca is not null;

alter table public.indicacoes enable row level security;
revoke all on public.indicacoes from anon, authenticated;

-- 3. Regras numéricas (um lugar só para mudar) ---------------------------------
-- Mantenha iguais às de lib/indicacoes/regras.ts (que só serve para a tela).
create or replace function public.indicacao_bonus_cadastro()
returns integer language sql immutable as $$ select 10 $$;

create or replace function public.indicacao_bonus_plano()
returns integer language sql immutable as $$ select 30 $$;

create or replace function public.indicacao_limite_mes()
returns integer language sql immutable as $$ select 20 $$;

-- 4. E-mail "normalizado" ---------------------------------------------------------
-- Para a regra "não vale indicar a si mesmo": ignora maiúsculas, o
-- "+qualquercoisa" antes do @ e, no Gmail, os pontos (joao.silva+2@gmail.com
-- e joaosilva@googlemail.com são a mesma caixa de entrada).
create or replace function public.email_normalizado(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_local text := split_part(v_email, '@', 1);
  v_dominio text := split_part(v_email, '@', 2);
begin
  if v_dominio = '' then
    return v_email;
  end if;
  v_local := split_part(v_local, '+', 1);
  if v_dominio in ('gmail.com', 'googlemail.com') then
    v_local := replace(v_local, '.', '');
    v_dominio := 'gmail.com';
  end if;
  return v_local || '@' || v_dominio;
end;
$$;

-- 5. Função "vincular_indicacao" (servidor) -----------------------------------------
-- Chamada pelo servidor logo depois do cadastro (e-mail e senha) e da
-- primeira entrada pelo Google, com o código guardado no cookie do link.
-- Devolve o que aconteceu:
--   'ok'             → ligada (e, se o e-mail já está confirmado, como no
--                      Google, a recompensa já é avaliada — parte 3);
--   'codigo_invalido', 'proprio' (mesma conta ou mesmo e-mail),
--   'conta_antiga'   (a conta não nasceu agora: só vale para cadastro novo),
--   'ja_indicado'    (a conta já tem quem a indicou).
create or replace function public.vincular_indicacao(p_indicado uuid, p_codigo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := lower(btrim(coalesce(p_codigo, '')));
  v_indicador uuid;
  v_email_indicador text;
  v_email_indicado text;
  v_criado_em timestamptz;
begin
  if p_indicado is null or v_codigo !~ '^[a-z0-9]{6,16}$' then
    return 'codigo_invalido';
  end if;

  select p.id, u.email into v_indicador, v_email_indicador
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.codigo_indicacao = v_codigo;
  if v_indicador is null then
    return 'codigo_invalido';
  end if;

  select u.email, u.created_at into v_email_indicado, v_criado_em
    from auth.users u where u.id = p_indicado;
  if v_criado_em is null then
    return 'codigo_invalido';
  end if;

  if v_indicador = p_indicado
    or public.email_normalizado(v_email_indicador) = public.email_normalizado(v_email_indicado) then
    return 'proprio';
  end if;

  -- Só conta criada há pouco: quem já tinha conta não vira "indicado".
  if v_criado_em < now() - interval '1 hour' then
    return 'conta_antiga';
  end if;

  insert into public.indicacoes (indicador_id, indicado_id)
    values (v_indicador, p_indicado)
    on conflict (indicado_id) do nothing;
  if not found then
    return 'ja_indicado';
  end if;

  -- Parte 3: se o e-mail já está confirmado (login pelo Google), a
  -- recompensa sai agora. Sem a parte 3, a função ainda não existe.
  if to_regprocedure('public.processar_indicacao(uuid)') is not null then
    execute 'select public.processar_indicacao($1)' using p_indicado;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.vincular_indicacao(uuid, text) from public, anon, authenticated;
grant execute on function public.vincular_indicacao(uuid, text) to service_role;

-- 6. Função "minhas_indicacoes" (Perfil) --------------------------------------------
-- Só números da própria pessoa: nunca devolve quem foi indicado.
create or replace function public.minhas_indicacoes()
returns table (
  codigo text,
  indicados integer,
  confirmados integer,
  assinantes integer,
  desbloqueios_ganhos integer,
  recompensadas_mes integer,
  limite_mes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ini timestamptz := public.inicio_do_mes(public.mes_brasilia());
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  update public.profiles set codigo_indicacao = public.gerar_codigo_indicacao()
    where id = auth.uid() and codigo_indicacao is null;

  return query
    select p.codigo_indicacao,
           (select count(*)::int from public.indicacoes i where i.indicador_id = p.id),
           (select count(*)::int from public.indicacoes i
             where i.indicador_id = p.id and i.email_confirmado_em is not null),
           (select count(*)::int from public.indicacoes i
             where i.indicador_id = p.id and i.plano_pago_em is not null),
           (select coalesce(sum(i.bonus_cadastro + i.bonus_plano), 0)::int from public.indicacoes i
             where i.indicador_id = p.id),
           (select count(*)::int from public.indicacoes i
             where i.indicador_id = p.id
               and ((i.bonus_cadastro > 0 and i.bonus_cadastro_em >= v_ini)
                 or (i.bonus_plano > 0 and i.bonus_plano_em >= v_ini))),
           public.indicacao_limite_mes()
      from public.profiles p
      where p.id = auth.uid();
end;
$$;

revoke all on function public.minhas_indicacoes() from public, anon;
grant execute on function public.minhas_indicacoes() to authenticated;

notify pgrst, 'reload schema';
