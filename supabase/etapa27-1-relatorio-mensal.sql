-- Ártemis Prospect — Etapa 27, parte 1 de 3: relatório mensal ("Meu mês")
-- Rode DEPOIS de todas as etapas anteriores (até a 26), inteiro, de uma
-- vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * nova tabela "leads_funil_eventos": cada vez que um lead muda de
--     situação (contatado, negociação, fechado, perdido...), fica uma
--     linha com a data. Antes só existia a situação ATUAL, e o relatório
--     precisa saber QUANDO cada lead avançou. Os leads que já tinham
--     avançado antes desta etapa ganham uma linha "estimada", com a data
--     do último contato;
--   * nova tabela "relatorios_mensais": a foto de cada mês de cada
--     usuário ativo (o mês e o mês anterior, para comparar). O usuário
--     só LÊ os próprios relatórios;
--   * função "gerar_relatorios_mensais" (só o servidor chama): no dia 1º,
--     fecha o rank do mês que acabou e gera o relatório de todo mundo que
--     teve atividade no mês, com o aviso no sino (tipo "relatorio").
--     Não envia e-mail.
--
-- Nada aqui mexe em planos, créditos, buscas ou cobrança.

-- 1. Histórico do funil ---------------------------------------------------------
-- estimado = true: linha criada por este script para leads que já tinham
-- avançado antes dele (data = último contato). As novas são exatas.
create table if not exists public.leads_funil_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  situacao text not null check (
    situacao in ('desbloqueado', 'contatado', 'negociacao', 'fechado', 'perdido')
  ),
  estimado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists leads_funil_eventos_user_criado_em_idx
  on public.leads_funil_eventos (user_id, criado_em);
create index if not exists leads_funil_eventos_user_place_idx
  on public.leads_funil_eventos (user_id, place_id, criado_em);

-- Ninguém do navegador lê ou escreve aqui: só o gatilho abaixo grava e
-- só as funções deste arquivo leem.
alter table public.leads_funil_eventos enable row level security;
revoke all on public.leads_funil_eventos from anon, authenticated;

-- Gatilho: toda troca de situação vira uma linha. Pega as três portas
-- de escrita do funil (atualizar_situacao_lead, registrar_venda e o que
-- vier depois) sem precisar mexer nelas.
create or replace function public.registrar_evento_funil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.situacao is distinct from old.situacao then
    insert into public.leads_funil_eventos (user_id, place_id, situacao)
      values (new.user_id, new.place_id, new.situacao);
  end if;
  return new;
end;
$$;

revoke all on function public.registrar_evento_funil() from public, anon, authenticated;

drop trigger if exists leads_desbloqueados_evento_funil on public.leads_desbloqueados;
create trigger leads_desbloqueados_evento_funil
  after update of situacao on public.leads_desbloqueados
  for each row execute function public.registrar_evento_funil();

-- Leads que já tinham avançado antes desta etapa: uma linha estimada.
-- Só entra para quem ainda não tem nenhuma linha (rodar de novo não
-- duplica).
insert into public.leads_funil_eventos (user_id, place_id, situacao, estimado, criado_em)
select l.user_id, l.place_id, l.situacao, true, l.ultimo_contato_em
  from public.leads_desbloqueados l
  where l.situacao <> 'desbloqueado'
    and l.ultimo_contato_em is not null
    and not exists (
      select 1 from public.leads_funil_eventos e
       where e.user_id = l.user_id and e.place_id = l.place_id
    );

-- 2. Números de um mês ------------------------------------------------------------
-- Uso interno (não tem GRANT). Devolve um JSON com:
--   desbloqueados: leads desbloqueados no mês;
--   contatados:    leads que tiveram o PRIMEIRO contato no mês (a primeira
--                  vez que saíram de "desbloqueado" para contatado,
--                  negociação ou fechado);
--   negociacao:    leads que entraram em "negociação" no mês;
--   fechados:      vendas registradas no mês;
--   verificadas:   vendas verificadas no mês (a mesma conta do rank);
--   pontos:        pontos ganhos no mês = 10 por venda registrada no mês
--                  (que não foi recusada) + 40 por venda verificada no mês
--                  (a mesma regra da tela Score);
--   posicao:       posição no rank do mês (nulo = sem venda verificada);
--   participantes: quantas pessoas entraram no rank do mês.
create or replace function public.numeros_do_mes(p_user uuid, p_mes date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mes date := public.primeiro_dia(p_mes);
  v_ini timestamptz := public.inicio_do_mes(public.primeiro_dia(p_mes));
  v_fim timestamptz := public.inicio_do_mes((public.primeiro_dia(p_mes) + interval '1 month')::date);
  v_desbloqueados integer;
  v_contatados integer;
  v_negociacao integer;
  v_fechados integer;
  v_verificadas integer;
  v_posicao integer;
  v_participantes integer;
begin
  select count(*) into v_desbloqueados
    from public.leads_desbloqueados
    where user_id = p_user and desbloqueado_em >= v_ini and desbloqueado_em < v_fim;

  select count(*) into v_contatados
    from (
      select e.place_id, min(e.criado_em) as primeiro
        from public.leads_funil_eventos e
        where e.user_id = p_user
          and e.situacao in ('contatado', 'negociacao', 'fechado')
        group by e.place_id
    ) p
    where p.primeiro >= v_ini and p.primeiro < v_fim;

  select count(distinct e.place_id) into v_negociacao
    from public.leads_funil_eventos e
    where e.user_id = p_user and e.situacao = 'negociacao'
      and e.criado_em >= v_ini and e.criado_em < v_fim;

  select count(*) into v_fechados
    from public.vendas
    where user_id = p_user and criado_em >= v_ini and criado_em < v_fim
      and status <> 'recusada';

  select count(*) into v_verificadas
    from public.vendas
    where user_id = p_user and status = 'verificada'
      and verificado_em >= v_ini and verificado_em < v_fim;

  -- Mês já fechado: vem do histórico do rank (etapa 8). Mês que ainda
  -- não fechou: calcula na hora.
  if exists (select 1 from public.meses_fechados where mes = v_mes) then
    select h.posicao into v_posicao from public.rank_historico h
      where h.mes = v_mes and h.user_id = p_user;
    select count(*) into v_participantes from public.rank_historico h where h.mes = v_mes;
  else
    select c.posicao into v_posicao from public.classificacao_do_mes(v_mes) c
      where c.user_id = p_user;
    select count(*) into v_participantes from public.classificacao_do_mes(v_mes);
  end if;

  return jsonb_build_object(
    'desbloqueados', v_desbloqueados,
    'contatados', v_contatados,
    'negociacao', v_negociacao,
    'fechados', v_fechados,
    'verificadas', v_verificadas,
    'pontos', 10 * v_fechados + 40 * v_verificadas,
    'posicao', v_posicao,
    'participantes', v_participantes
  );
end;
$$;

revoke all on function public.numeros_do_mes(uuid, date) from public, anon, authenticated;

-- 3. Tabela "relatorios_mensais" ---------------------------------------------------
-- Uma linha por usuário por mês. "dados" = números do mês; "anterior" =
-- números do mês anterior, guardados junto para a comparação não mudar
-- depois. Fica para sempre (é pequena).
create table if not exists public.relatorios_mensais (
  user_id uuid not null references auth.users (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  dados jsonb not null,
  anterior jsonb,
  criado_em timestamptz not null default now(),
  primary key (user_id, mes)
);

alter table public.relatorios_mensais enable row level security;

grant usage on schema public to authenticated;
grant select on public.relatorios_mensais to authenticated;
revoke insert, update, delete on public.relatorios_mensais from authenticated, anon;

drop policy if exists "Usuários veem os próprios relatórios" on public.relatorios_mensais;
create policy "Usuários veem os próprios relatórios"
  on public.relatorios_mensais
  for select
  to authenticated
  using (user_id = auth.uid());

-- 4. Aviso no sino (tipo "relatorio") ---------------------------------------------
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade',
             'contrato', 'seguranca', 'relatorio')
  );

-- 5. Função "gerar_relatorios_mensais" ----------------------------------------------
-- Chamada pelas rotinas agendadas (/api/cron/fechar-mes no dia 1º e
-- /api/cron/notificacoes todo dia, de reserva). Sem parâmetro, gera o mês
-- que acabou, e só nos dias 1º a 3 (se a rodada do dia 1º falhar, as dos
-- dias seguintes completam). Com um mês (ex.: '2026-09-01'), gera aquele
-- mês na hora — serve para testar no SQL Editor.
--
-- "Usuário ativo" = teve alguma atividade no mês: buscou, desbloqueou,
-- mudou a situação de um lead, registrou venda ou teve venda verificada.
-- Quem já tem o relatório do mês fica de fora (rodar de novo não duplica
-- nem manda dois avisos). Devolve quantos relatórios foram criados.
create or replace function public.gerar_relatorios_mensais(p_mes date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date;
  v_ini timestamptz;
  v_fim timestamptz;
  v_anterior date;
  v_nome text;
  v_total integer := 0;
  v_user uuid;
  v_dados jsonb;
  v_meses constant text[] := array[
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
begin
  if p_mes is null then
    if extract(day from now() at time zone 'America/Sao_Paulo') > 3 then
      return 0;
    end if;
    v_mes := (public.mes_brasilia() - interval '1 month')::date;
  else
    v_mes := public.primeiro_dia(p_mes);
  end if;

  if v_mes >= public.mes_brasilia() then
    raise exception 'Só dá para gerar o relatório de um mês que já acabou.';
  end if;

  -- Uma rodada por vez.
  if not pg_try_advisory_xact_lock(hashtext('public.gerar_relatorios_mensais')) then
    return 0;
  end if;

  -- Garante o rank do mês fechado antes de ler a posição.
  perform public.fechar_meses_pendentes();

  v_ini := public.inicio_do_mes(v_mes);
  v_fim := public.inicio_do_mes((v_mes + interval '1 month')::date);
  v_anterior := (v_mes - interval '1 month')::date;
  v_nome := v_meses[extract(month from v_mes)::int];

  for v_user in
    select a.user_id
      from (
        select user_id from public.buscas where criado_em >= v_ini and criado_em < v_fim
        union
        select user_id from public.leads_desbloqueados where desbloqueado_em >= v_ini and desbloqueado_em < v_fim
        union
        select user_id from public.leads_funil_eventos where criado_em >= v_ini and criado_em < v_fim
        union
        select user_id from public.vendas where criado_em >= v_ini and criado_em < v_fim
        union
        select user_id from public.vendas where verificado_em >= v_ini and verificado_em < v_fim
      ) a
      join public.profiles p on p.id = a.user_id
      where not exists (
        select 1 from public.relatorios_mensais r where r.user_id = a.user_id and r.mes = v_mes
      )
  loop
    v_dados := public.numeros_do_mes(v_user, v_mes);

    insert into public.relatorios_mensais (user_id, mes, dados, anterior)
      values (v_user, v_mes, v_dados, public.numeros_do_mes(v_user, v_anterior))
      on conflict (user_id, mes) do nothing;
    if not found then
      continue;
    end if;
    v_total := v_total + 1;

    -- Aviso no sino, uma vez só (mesmo se a pessoa apagar o aviso).
    insert into public.notificacoes_enviadas (user_id, chave)
      values (v_user, 'relatorio:' || to_char(v_mes, 'YYYY-MM'))
      on conflict do nothing;
    if found then
      insert into public.notificacoes (user_id, tipo, titulo, texto, link)
        values (
          v_user,
          'relatorio',
          format('Seu resumo de %s chegou', v_nome),
          format(
            'Em %s você desbloqueou %s %s, fez %s %s e teve %s %s. Veja os detalhes, sua posição no rank e a comparação com o mês anterior.',
            v_nome,
            v_dados ->> 'desbloqueados',
            case when (v_dados ->> 'desbloqueados')::int = 1 then 'lead' else 'leads' end,
            v_dados ->> 'contatados',
            case when (v_dados ->> 'contatados')::int = 1 then 'contato novo' else 'contatos novos' end,
            v_dados ->> 'verificadas',
            case when (v_dados ->> 'verificadas')::int = 1 then 'venda verificada' else 'vendas verificadas' end
          ),
          '/painel/meu-mes/' || to_char(v_mes, 'YYYY-MM')
        );
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.gerar_relatorios_mensais(date) from public, anon, authenticated;
grant execute on function public.gerar_relatorios_mensais(date) to service_role;

notify pgrst, 'reload schema';

-- Para testar na hora (gera o relatório de setembro de 2026 para quem
-- teve atividade nele e manda o aviso no sino), rode SEPARADO:
--
--   select public.gerar_relatorios_mensais('2026-09-01');
