-- Ártemis Prospect — Etapa 25, parte 1 de 3: limite de tentativas de login
-- Rode DEPOIS da etapa 24. Supabase > SQL Editor > New query > cole tudo > Run.
-- Depois rode a parte 2 e a parte 3. Pode rodar de novo sem problema.
-- Só o servidor (service_role) usa o que está aqui. O banco guarda só um
-- resumo (hash) do e-mail e do IP e apaga tudo com mais de 2 dias.

-- 1. Tentativas de login ----------------------------------------------------
-- conta: hash do e-mail (em minúsculas). origem: hash do IP (pode faltar).
create table if not exists public.login_tentativas (
  id bigint generated always as identity primary key,
  conta text not null check (char_length(conta) = 64),
  origem text check (origem is null or char_length(origem) = 64),
  sucesso boolean not null,
  criado_em timestamptz not null default now()
);

create index if not exists login_tentativas_conta_idx
  on public.login_tentativas (conta, criado_em desc);
create index if not exists login_tentativas_origem_idx
  on public.login_tentativas (origem, criado_em desc) where not sucesso;
create index if not exists login_tentativas_criado_em_idx
  on public.login_tentativas (criado_em);

alter table public.login_tentativas enable row level security;
revoke all on public.login_tentativas from anon, authenticated;

-- Situação do login para uma conta e uma origem.
-- Devolve: segundos até liberar (0 = liberado), o motivo ('conta' ou
-- 'origem') e quantos erros ainda cabem antes da pausa da conta.
--
-- Por conta: conta os erros desde o último login certo (nas últimas 24h).
--   A partir de 5 erros, o login pausa a partir do último erro:
--   5 a 9 erros = 15 min; 10 a 14 = 30 min; 15 ou mais = 1 hora.
--   Como o erro só é registrado quando a senha é testada, depois da
--   primeira pausa cada novo erro pausa de novo.
-- Por origem: 20 erros em 15 minutos, em qualquer conta, pausam aquele
--   IP por 15 minutos a partir do último erro.
create or replace function public.login_situacao(p_conta text, p_origem text)
returns table (segundos integer, motivo text, restantes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo_ok timestamptz;
  v_falhas integer;
  v_ultima_falha timestamptz;
  v_pausa interval;
  v_falhas_origem integer;
  v_ultima_falha_origem timestamptz;
  v_seg_conta integer := 0;
  v_seg_origem integer := 0;
begin
  select max(t.criado_em) into v_ultimo_ok
    from login_tentativas t
    where t.conta = p_conta and t.sucesso;

  select count(*), max(t.criado_em) into v_falhas, v_ultima_falha
    from login_tentativas t
    where t.conta = p_conta
      and not t.sucesso
      and t.criado_em > now() - interval '24 hours'
      and (v_ultimo_ok is null or t.criado_em > v_ultimo_ok);

  if v_falhas >= 5 then
    v_pausa := case
      when v_falhas >= 15 then interval '1 hour'
      when v_falhas >= 10 then interval '30 minutes'
      else interval '15 minutes'
    end;
    v_seg_conta := greatest(0, ceil(extract(epoch from (v_ultima_falha + v_pausa - now())))::integer);
  end if;

  if p_origem is not null then
    select count(*), max(t.criado_em) into v_falhas_origem, v_ultima_falha_origem
      from login_tentativas t
      where t.origem = p_origem
        and not t.sucesso
        and t.criado_em > now() - interval '15 minutes';
    if v_falhas_origem >= 20 then
      v_seg_origem := greatest(
        0,
        ceil(extract(epoch from (v_ultima_falha_origem + interval '15 minutes' - now())))::integer
      );
    end if;
  end if;

  return query select
    greatest(v_seg_conta, v_seg_origem),
    case
      when v_seg_conta = 0 and v_seg_origem = 0 then null
      when v_seg_conta >= v_seg_origem then 'conta'
      else 'origem'
    end,
    greatest(0, 5 - v_falhas);
end;
$$;

revoke all on function public.login_situacao(text, text) from public, anon, authenticated;
grant execute on function public.login_situacao(text, text) to service_role;

-- Registra uma tentativa e devolve quantos erros ainda cabem antes da
-- pausa da conta (0 = a conta acabou de entrar em pausa).
create or replace function public.login_registrar_tentativa(p_conta text, p_origem text, p_sucesso boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restantes integer;
begin
  insert into login_tentativas (conta, origem, sucesso)
    values (p_conta, p_origem, p_sucesso);

  -- Faxina de vez em quando (cerca de 1 a cada 50 tentativas): nada
  -- aqui interessa depois de 2 dias.
  if random() < 0.02 then
    delete from login_tentativas where criado_em < now() - interval '2 days';
  end if;

  select s.restantes into v_restantes from login_situacao(p_conta, p_origem) s;
  return v_restantes;
end;
$$;

revoke all on function public.login_registrar_tentativa(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_registrar_tentativa(text, text, boolean) to service_role;

notify pgrst, 'reload schema';
