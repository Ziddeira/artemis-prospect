-- Ártemis Prospect — Etapa 20, parte 1 de 2: leads inválidos e devolução
-- de crédito
-- Rode DEPOIS das etapas anteriores, inteiro, de uma vez:
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * o desbloqueio passa a anotar de onde saiu o crédito (do plano ou do
--     prêmio do rank), para a devolução voltar para o mesmo lugar;
--   * nova tabela "leads_invalidos": o usuário marca um lead desbloqueado
--     como "empresa não existe mais" ou "telefone não atende";
--   * a função "marcar_lead_invalido" registra a marcação e devolve 1
--     crédito automaticamente, com duas travas contra abuso:
--       - no máximo 3 devoluções por mês por usuário (mês de Brasília);
--       - só para leads desbloqueados há até 30 dias.
--     Passou de uma trava, a marcação é registrada do mesmo jeito (você vê
--     no painel), só não devolve o crédito.
--
-- Política de cache do Google: só o place_id é guardado aqui (pode ficar
-- para sempre). Nome, telefone etc. do lead não são copiados.

-- 1. De onde saiu o crédito de cada desbloqueio ------------------------------
-- 'plano' = creditos_desbloqueio; 'premio' = creditos_premio (etapa 8).
-- Desbloqueios antigos ficam vazios e, se devolvidos, voltam para o plano.
alter table public.leads_desbloqueados
  add column if not exists credito_origem text;
alter table public.leads_desbloqueados
  drop constraint if exists leads_desbloqueados_credito_origem_valida;
alter table public.leads_desbloqueados
  add constraint leads_desbloqueados_credito_origem_valida
  check (credito_origem is null or credito_origem in ('plano', 'premio'));

-- 2. Tabela "leads_invalidos" -------------------------------------------------
-- Uma linha por lead marcado (cada lead só pode ser marcado uma vez por
-- usuário).
--   motivo: 'nao_existe' (empresa não existe mais) ou 'nao_atende'
--           (telefone não atende).
--   credito_devolvido: se esta marcação devolveu 1 crédito.
--   sem_devolucao: por que não devolveu — 'limite_mes' (já teve 3
--           devoluções no mês) ou 'fora_do_prazo' (desbloqueado há mais
--           de 30 dias). Vazio quando devolveu.
create table if not exists public.leads_invalidos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  motivo text not null check (motivo in ('nao_existe', 'nao_atende')),
  credito_devolvido boolean not null default false,
  credito_origem text check (credito_origem is null or credito_origem in ('plano', 'premio')),
  sem_devolucao text check (sem_devolucao is null or sem_devolucao in ('limite_mes', 'fora_do_prazo')),
  desbloqueado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists leads_invalidos_criado_em_idx
  on public.leads_invalidos (criado_em desc);

-- O usuário só LÊ as próprias marcações (para a tela "Meus leads" saber
-- quais já marcou). Escrever, só pela função abaixo.
alter table public.leads_invalidos enable row level security;
revoke all on public.leads_invalidos from anon, authenticated;
grant select on public.leads_invalidos to authenticated;

drop policy if exists "Usuários veem as próprias marcações" on public.leads_invalidos;
create policy "Usuários veem as próprias marcações"
  on public.leads_invalidos
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. "desbloquear_lead" passa a anotar a origem do crédito --------------------
-- Igual à versão da etapa 8, parte 3; a única diferença é a coluna
-- credito_origem no insert.
create or replace function public.desbloquear_lead(p_place_id text)
returns table (ja_desbloqueado boolean, creditos_restantes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano_creditos integer;
  v_premio integer;
  v_existe boolean;
  v_origem text;
begin
  if p_place_id is null or length(trim(p_place_id)) = 0 then
    raise exception 'place_id inválido.';
  end if;

  perform public.aplicar_vencimento_plano(auth.uid());

  select creditos_desbloqueio, creditos_premio
    into v_plano_creditos, v_premio
    from public.profiles
    where id = auth.uid()
    for update;

  if v_plano_creditos is null then
    raise exception 'Perfil não encontrado.';
  end if;

  select exists(
    select 1 from public.leads_desbloqueados
    where user_id = auth.uid() and place_id = p_place_id
  ) into v_existe;

  if v_existe then
    return query select true, v_plano_creditos + v_premio;
    return;
  end if;

  if v_plano_creditos + v_premio < 1 then
    raise exception 'Você não tem créditos de desbloqueio disponíveis.';
  end if;

  if v_plano_creditos > 0 then
    update public.profiles
      set creditos_desbloqueio = creditos_desbloqueio - 1
      where id = auth.uid();
    v_origem := 'plano';
  else
    update public.profiles
      set creditos_premio = creditos_premio - 1
      where id = auth.uid();
    v_origem := 'premio';
  end if;

  insert into public.leads_desbloqueados (user_id, place_id, credito_origem)
  values (auth.uid(), p_place_id, v_origem);

  return query select false, v_plano_creditos + v_premio - 1;
end;
$$;

grant execute on function public.desbloquear_lead(text) to authenticated;

-- 4. Função "marcar_lead_invalido" ---------------------------------------------
-- Chamada pelo botão "Marcar como inválido" em Meus leads. Tudo numa
-- transação só, com o perfil travado: dois cliques ao mesmo tempo não
-- conseguem devolver mais de 3 créditos no mês.
-- Devolve:
--   devolvido: se devolveu 1 crédito agora;
--   devolucoes_no_mes: quantas devoluções o usuário já teve neste mês
--                      (contando esta);
--   limite_mes: o limite (3);
--   creditos_restantes: saldo de desbloqueio depois (plano + prêmio);
--   sem_devolucao: 'limite_mes', 'fora_do_prazo' ou vazio.
create or replace function public.marcar_lead_invalido(p_place_id text, p_motivo text)
returns table (
  devolvido boolean,
  devolucoes_no_mes integer,
  limite_mes integer,
  creditos_restantes integer,
  sem_devolucao text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_limite constant integer := 3;
  c_prazo constant interval := interval '30 days';
  v_uid uuid := auth.uid();
  v_desbloqueado_em timestamptz;
  v_origem text;
  v_usadas integer;
  v_devolve boolean := false;
  v_sem text;
  v_saldo integer;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado.';
  end if;
  if p_motivo is null or p_motivo not in ('nao_existe', 'nao_atende') then
    raise exception 'Motivo inválido.';
  end if;

  perform public.aplicar_vencimento_plano(v_uid);

  -- Trava o perfil até o fim da transação (fila única por usuário).
  perform 1 from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  select d.desbloqueado_em, d.credito_origem
    into v_desbloqueado_em, v_origem
    from public.leads_desbloqueados d
    where d.user_id = v_uid and d.place_id = p_place_id;
  if not found then
    raise exception 'Este lead não está entre os seus desbloqueados.';
  end if;

  if exists (
    select 1 from public.leads_invalidos i
    where i.user_id = v_uid and i.place_id = p_place_id
  ) then
    raise exception 'Você já marcou este lead.';
  end if;

  select count(*)
    into v_usadas
    from public.leads_invalidos i
    where i.user_id = v_uid
      and i.credito_devolvido
      and i.criado_em >= public.inicio_do_mes(public.mes_brasilia());

  if v_desbloqueado_em < now() - c_prazo then
    v_sem := 'fora_do_prazo';
  elsif v_usadas >= c_limite then
    v_sem := 'limite_mes';
  else
    v_devolve := true;
  end if;

  if v_devolve then
    if v_origem = 'premio' then
      update public.profiles p set creditos_premio = p.creditos_premio + 1 where p.id = v_uid;
    else
      update public.profiles p set creditos_desbloqueio = p.creditos_desbloqueio + 1 where p.id = v_uid;
    end if;
    v_usadas := v_usadas + 1;
  end if;

  insert into public.leads_invalidos
    (user_id, place_id, motivo, credito_devolvido, credito_origem, sem_devolucao, desbloqueado_em)
  values
    (v_uid, p_place_id, p_motivo, v_devolve, case when v_devolve then coalesce(v_origem, 'plano') end,
     v_sem, v_desbloqueado_em);

  select p.creditos_desbloqueio + p.creditos_premio
    into v_saldo
    from public.profiles p
    where p.id = v_uid;

  return query select v_devolve, v_usadas, c_limite, v_saldo, v_sem;
end;
$$;

revoke execute on function public.marcar_lead_invalido(text, text) from public, anon;
grant execute on function public.marcar_lead_invalido(text, text) to authenticated;

-- Avisa a API do Supabase (PostgREST) para reler tabelas e funções.
notify pgrst, 'reload schema';
