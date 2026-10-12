-- Ártemis Prospect — Etapa 25: segurança do login
-- Rode isto DEPOIS de todos os scripts anteriores (até a etapa 24),
-- inteiro, de uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que este script cria:
--   * tabela "login_tentativas" + funções login_situacao e
--     login_registrar_tentativa: limite de tentativas de login, por conta
--     e por origem (IP). Guarda só um resumo (hash) do e-mail e do IP,
--     calculado pelo servidor, e apaga tudo com mais de 2 dias;
--   * tabela "acessos" + função registrar_acesso: data, origem e aparelho
--     de cada login, mostrados no Perfil. Guardados por 6 meses, como
--     manda o Marco Civil da Internet para registros de acesso;
--   * aviso no sino (tipo "seguranca") quando a conta entra por um
--     aparelho novo.
--
-- Regras:
--   * só o servidor (service_role) chama as funções deste arquivo;
--   * o usuário só LÊ os próprios acessos (RLS) e nunca escreve neles;
--   * ninguém pelo navegador lê ou escreve "login_tentativas".

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

-- 2. Registro de acessos ----------------------------------------------------
-- Um login por linha.
--   metodo: senha | google | link (link do e-mail) | cadastro
--   aparelho_id: código aleatório guardado num cookie do navegador
--   aparelho: descrição curta, ex.: "Chrome no Windows"
--   local: cidade, estado e país aproximados (pelo IP)
--   navegador: o "user agent" completo, para conferência
create table if not exists public.acessos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  metodo text not null check (metodo in ('senha', 'google', 'link', 'cadastro')),
  aparelho_id uuid,
  aparelho text check (aparelho is null or char_length(aparelho) <= 60),
  ip text check (ip is null or char_length(ip) <= 64),
  local text check (local is null or char_length(local) <= 120),
  navegador text check (navegador is null or char_length(navegador) <= 400)
);

create index if not exists acessos_user_criado_em_idx
  on public.acessos (user_id, criado_em desc);
create index if not exists acessos_user_aparelho_idx
  on public.acessos (user_id, aparelho_id);

alter table public.acessos enable row level security;

grant usage on schema public to authenticated;
grant select on public.acessos to authenticated;
revoke insert, update, delete on public.acessos from authenticated, anon;

drop policy if exists "Usuários veem os próprios acessos" on public.acessos;
create policy "Usuários veem os próprios acessos"
  on public.acessos
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Aviso no sino (tipo "seguranca") ----------------------------------------
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade', 'contrato', 'seguranca')
  );

-- 4. Função que registra o login ---------------------------------------------
-- Chamada pelo servidor logo depois de cada login. Devolve true quando o
-- aparelho é novo para a conta (e, nesse caso, cria o aviso no sino).
-- O primeiro login registrado de cada conta não gera aviso: não há com
-- o que comparar.
create or replace function public.registrar_acesso(
  p_user_id uuid,
  p_metodo text,
  p_aparelho_id uuid,
  p_aparelho text,
  p_ip text,
  p_local text,
  p_navegador text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_historico boolean;
  v_conhecido boolean;
  v_aparelho text := coalesce(nullif(left(p_aparelho, 60), ''), 'Aparelho desconhecido');
  v_local text := nullif(left(p_local, 120), '');
  v_quando text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
begin
  if p_user_id is null then
    raise exception 'Usuário não informado.';
  end if;

  select exists (select 1 from acessos where user_id = p_user_id) into v_tem_historico;
  select exists (
    select 1 from acessos where user_id = p_user_id and aparelho_id = p_aparelho_id
  ) into v_conhecido;

  insert into acessos (user_id, metodo, aparelho_id, aparelho, ip, local, navegador)
    values (
      p_user_id,
      p_metodo,
      p_aparelho_id,
      v_aparelho,
      nullif(left(p_ip, 64), ''),
      v_local,
      nullif(left(p_navegador, 400), '')
    );

  -- Registros de acesso ficam 6 meses (Marco Civil da Internet, art. 15).
  delete from acessos where user_id = p_user_id and criado_em < now() - interval '6 months';

  if v_tem_historico and not v_conhecido then
    insert into notificacoes (user_id, tipo, titulo, texto, link)
      values (
        p_user_id,
        'seguranca',
        'Novo acesso à sua conta',
        format(
          'Sua conta foi acessada em um aparelho novo: %s%s, em %s. Se foi você, pode ignorar. '
            || 'Se não foi, troque a senha e use "Encerrar outras sessões" no Perfil.',
          v_aparelho,
          coalesce(' (' || v_local || ')', ''),
          v_quando
        ),
        '/painel/perfil'
      );
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.registrar_acesso(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_acesso(uuid, text, uuid, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
