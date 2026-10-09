-- Ártemis Prospect — Etapa 24: interruptor da geração de sites com IA
-- Rode DEPOIS da etapa 23 (as três partes), inteiro, de uma vez:
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente) e NÃO religa o
-- interruptor se você já tiver ligado.
--
-- O que muda:
--   * tabela "configuracoes_sistema" (chave → valor), com o interruptor
--     "geracao_sites_ativa". Começa DESLIGADO;
--   * com o interruptor desligado, o Platina continua à venda e quem
--     assina recebe na hora o plano, os desbloqueios, as buscas e tudo do
--     Pro. Só a geração de site fica parada: as funções de reserva
--     (etapa 23) recusam com uma mensagem de "liberação em andamento"
--     (código AP503) e o servidor nem chama a IA;
--   * Gestão > Sites IA ganha o botão de ligar/desligar (função
--     admin_definir_geracao_sites, com auditoria). Ao ligar, todos os
--     assinantes Platina recebem um aviso no sino, e a geração passa a
--     funcionar na hora, sem novo deploy;
--   * quando alguém entra no Platina (pagamento confirmado ou ajuste na
--     Gestão), todo administrador recebe um aviso no sino, e a Gestão
--     mostra em destaque quem está esperando a liberação.

-- 1. Tabela "configuracoes_sistema" -------------------------------------------
create table if not exists public.configuracoes_sistema (
  chave text primary key check (chave ~ '^[a-z0-9_]{1,60}$'),
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

alter table public.configuracoes_sistema enable row level security;
-- Sem GRANT: só as funções abaixo leem e escrevem aqui.
revoke all on public.configuracoes_sistema from anon, authenticated;

-- Começa DESLIGADO. "on conflict do nothing": rodar de novo não mexe no
-- valor que você já escolheu.
insert into public.configuracoes_sistema (chave, valor)
values ('geracao_sites_ativa', 'false'::jsonb)
on conflict (chave) do nothing;

-- 2. Ler o interruptor ------------------------------------------------------------
-- Qualquer um pode perguntar (é só um sim/não, usado pela tela de planos e
-- pelo servidor). Sem a linha, conta como desligado.
create or replace function public.geracao_sites_ativa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select valor = 'true'::jsonb from public.configuracoes_sistema
                    where chave = 'geracao_sites_ativa'), false);
$$;

revoke all on function public.geracao_sites_ativa() from public;
grant execute on function public.geracao_sites_ativa() to anon, authenticated, service_role;

-- 3. Avisos no sino: tipos novos "admin" e "sites" ------------------------------
-- A mesma regra da etapa 14, com dois tipos a mais.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade', 'admin', 'sites')
  );

-- 4. Ligar/desligar (só administrador) --------------------------------------------
create or replace function public.admin_definir_geracao_sites(p_ativa boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes boolean := public.geracao_sites_ativa();
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if p_ativa is null then
    raise exception 'Escolha ligar ou desligar.';
  end if;
  if p_ativa = v_antes then
    return v_antes;
  end if;

  insert into public.configuracoes_sistema (chave, valor, atualizado_em, atualizado_por)
  values ('geracao_sites_ativa', to_jsonb(p_ativa), now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();

  perform public.registrar_auditoria(
    'geracao_sites',
    null,
    jsonb_build_object('ativa', v_antes),
    jsonb_build_object('ativa', p_ativa),
    case when p_ativa then 'Geração de sites ligada' else 'Geração de sites desligada' end
  );

  -- Ao ligar: avisa cada assinante Platina ativo que a geração foi liberada.
  if p_ativa then
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
    select p.id, 'sites', 'Geração de sites liberada',
           'A geração de site com IA do seu plano Platina já está funcionando. Abra Meus leads e clique em "Gerar site" no lead que quiser.',
           '/painel/meus-leads'
      from public.profiles p
     where p.plano = 'platina'
       and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now());
  end if;

  return p_ativa;
end;
$$;

revoke all on function public.admin_definir_geracao_sites(boolean) from public, anon;
grant execute on function public.admin_definir_geracao_sites(boolean) to authenticated;

-- 5. Conferência da conta antes de gerar: agora com o interruptor ---------------
-- A mesma função da etapa 23. A ordem importa: quem não é Platina vê o
-- convite (AP402); quem é Platina e a geração ainda está desligada vê a
-- mensagem de liberação em andamento (AP503), sem gastar nada.
create or replace function public.sites_conferir_conta(p_cobra boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.profiles%rowtype;
  v_cobradas integer;
  v_chamadas integer;
  v_libera timestamptz;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  perform public.aplicar_vencimento_plano(auth.uid());

  select * into v_perfil from public.profiles where id = auth.uid() for update;
  if v_perfil.id is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if v_perfil.plano <> 'platina'
     or (v_perfil.plano_valido_ate is not null and v_perfil.plano_valido_ate + interval '3 days' < now()) then
    raise exception 'A geração de site com IA é do plano Platina.'
      using errcode = 'AP402';
  end if;

  if not public.geracao_sites_ativa() then
    raise exception 'A geração de sites do seu plano está sendo liberada. Isso acontece em até 24 horas após a assinatura, e você recebe um aviso no sino quando estiver pronta. Enquanto isso, todo o resto do Platina já está funcionando.'
      using errcode = 'AP503';
  end if;

  perform public.sites_liberar_presas(auth.uid());

  if exists (
    select 1 from public.sites_geracoes
     where user_id = auth.uid() and status = 'reservada'
  ) then
    raise exception 'Já tem um site sendo gerado na sua conta. Espere ele terminar (leva de 1 a 3 minutos).';
  end if;

  select count(*) into v_chamadas from public.sites_geracoes
   where user_id = auth.uid() and criado_em > now() - interval '1 hour';
  if v_chamadas >= 6 then
    raise exception 'Limite de 6 pedidos à IA por hora atingido. Tente de novo daqui a pouco.';
  end if;

  if p_cobra then
    select count(*), min(criado_em) + interval '1 hour'
      into v_cobradas, v_libera
      from public.sites_geracoes
     where user_id = auth.uid()
       and credito_origem is not null
       and status <> 'falhou'
       and criado_em > now() - interval '1 hour';
    if v_cobradas >= 2 then
      raise exception 'Limite de 2 gerações por hora atingido. A próxima fica liberada às %.',
        to_char(v_libera at time zone 'America/Sao_Paulo', 'HH24:MI');
    end if;

    if v_perfil.sites_restantes < 1 and v_perfil.sites_extras < 1 then
      raise exception 'Suas gerações de site acabaram. Elas voltam a 5 na renovação do plano, ou compre o pacote com +3 em Meu plano.';
    end if;
  end if;

  return v_perfil;
end;
$$;

revoke all on function public.sites_conferir_conta(boolean) from public, anon, authenticated;

-- 6. Aviso para o administrador quando alguém entra no Platina ---------------------
-- Gatilho em profiles: quando o plano muda para "platina" (webhook do
-- Asaas ou ajuste na Gestão), todo administrador recebe um aviso no sino.
-- Renovação (Platina → Platina) não avisa de novo.
create or replace function public.avisar_admin_novo_platina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ativa boolean := public.geracao_sites_ativa();
begin
  if new.plano = 'platina' and old.plano is distinct from 'platina' then
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
    select a.id, 'admin',
           case when v_ativa then 'Novo assinante Platina' else 'Novo Platina: liberar geração de sites' end,
           left(format(
             case when v_ativa
               then '%s entrou no Platina. A geração de sites já está ligada, nada a fazer.'
               else '%s entrou no Platina e a geração de sites está desligada. Ligue em Gestão > Sites IA (prometido: em até 24 horas após a assinatura).'
             end,
             coalesce(new.email, 'Uma conta')
           ), 600),
           '/painel/admin/sites'
      from public.profiles a
     where a.is_admin;
  end if;
  return new;
end;
$$;

revoke all on function public.avisar_admin_novo_platina() from public, anon, authenticated;

drop trigger if exists profiles_avisar_novo_platina on public.profiles;
create trigger profiles_avisar_novo_platina
  after update of plano on public.profiles
  for each row execute function public.avisar_admin_novo_platina();

-- 7. Gestão: quem está esperando a liberação -------------------------------------
-- Assinantes Platina ativos e desde quando estão no plano (primeira
-- mensalidade do Platina paga; vazio = colocado pela Gestão).
create or replace function public.admin_platina_aguardando()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  return jsonb_build_object(
    'ativa', public.geracao_sites_ativa(),
    'atualizado_em', (select atualizado_em from public.configuracoes_sistema where chave = 'geracao_sites_ativa'),
    'assinantes', coalesce((
      select jsonb_agg(x order by (x ->> 'desde') nulls last)
        from (
          select jsonb_build_object(
                   'user_id', p.id,
                   'email', p.email,
                   'apelido', p.apelido,
                   'desde', (select min(c.creditado_em) from public.cobrancas c
                              where c.user_id = p.id and c.tipo = 'assinatura'
                                and c.plano = 'platina' and c.creditado_em is not null)
                 ) as x
            from public.profiles p
           where p.plano = 'platina'
             and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now())
           limit 200
        ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_platina_aguardando() from public, anon;
grant execute on function public.admin_platina_aguardando() to authenticated;

notify pgrst, 'reload schema';
