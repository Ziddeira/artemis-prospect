-- Vendedor Ártemis — Painel da Laura (Gestão > Laura na Ártemis Prospect)
-- Objeções, eventos e as funções que o painel lê. Só administrador acessa.

alter table vendedor.leads add column if not exists pagamento_informado_em timestamptz;

create table if not exists vendedor.objecoes (
  id bigint generated always as identity primary key,
  lead_id uuid not null references vendedor.leads (id) on delete cascade,
  categoria text not null check (categoria in (
    'preco', 'confianca', 'ja_tem_instagram', 'nao_precisa', 'sem_tempo', 'vou_pensar',
    'falar_com_socio', 'ja_tem_site', 'prazo', 'outra'
  )),
  fala_lead text not null,
  resposta_laura text,
  criado_em timestamptz not null default now()
);
create index if not exists objecoes_criado_em_idx on vendedor.objecoes (criado_em desc);
create index if not exists objecoes_lead_idx on vendedor.objecoes (lead_id);

create table if not exists vendedor.eventos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('erro', 'aviso', 'info')),
  detalhe text not null,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_criado_em_idx on vendedor.eventos (criado_em desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'vendedor_bot') then
    execute 'grant select, insert, update, delete on vendedor.objecoes, vendedor.eventos to vendedor_bot';
    execute 'grant usage, select on all sequences in schema vendedor to vendedor_bot';
  end if;
end $$;
revoke all on vendedor.objecoes, vendedor.eventos from public, anon, authenticated;

-- Resultado de uma objeção, pelo destino do lead (contornada = chegou ao Pix).
drop function if exists vendedor.resultado_objecao(text);
create or replace function vendedor.resultado_objecao(p_status text, p_pix timestamptz default null)
returns text language sql immutable as $$
  select case
    when p_status in ('fechado', 'sinal_enviado') or p_pix is not null then 'contornada'
    when p_status in ('encerrado', 'bloqueado', 'descartado') then 'nao_contornada'
    when p_status = 'atencao' then 'com_zidd'
    else 'em_aberto'
  end
$$;

-- Tudo o que o painel mostra, numa chamada só.
create or replace function public.laura_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = vendedor, public
as $$
declare
  v_hoje timestamptz := vendedor.hoje_inicio();
  v_semana timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v jsonb;
begin
  if not coalesce(public.eh_admin(), false) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  with p(nome, inicio) as (values ('hoje', v_hoje), ('semana', v_semana), ('mes', v_mes))
  select jsonb_object_agg(p.nome, jsonb_build_object(
    'captados',    (select count(*) from leads where criado_em >= p.inicio and place_id not like 'teste-%'),
    'abordados',   (select count(*) from leads where primeira_abordagem_em >= p.inicio),
    'responderam', (select count(*) from leads where respondeu_em >= p.inicio),
    'previas',     (select count(*) from leads where previa_gerada_em >= p.inicio),
    'pix',         (select count(*) from leads where sinal_enviado_em >= p.inicio),
    'pagamento_informado', (select count(*) from leads where pagamento_informado_em >= p.inicio),
    'fechados',    (select count(*) from leads where fechado_em >= p.inicio and status = 'fechado'),
    'receita',     (select coalesce(sum(valor_final), 0) from leads where fechado_em >= p.inicio and status = 'fechado'),
    'sinais',      (select coalesce(sum(sinal_valor), 0) from leads where fechado_em >= p.inicio and status = 'fechado'),
    'sem_resposta',(select count(*) from leads where status = 'encerrado' and respondeu_em is null and atualizado_em >= p.inicio),
    'sem_interesse',(select count(*) from leads where status in ('encerrado', 'bloqueado') and respondeu_em is not null and atualizado_em >= p.inicio),
    'buscas',      (select count(*) from buscas where criado_em >= p.inicio),
    'objecoes',    (select count(*) from objecoes where criado_em >= p.inicio)
  ))
  into v from p;

  return jsonb_build_object(
    'gerado_em', now(),
    'periodos', v,

    'operacao', (select jsonb_build_object(
      'pausado', c.pausado,
      'inicio_operacao', c.inicio_operacao,
      'em_expediente', vendedor.em_expediente(),
      'abordagens_hoje', vendedor.abordagens_hoje(),
      'limite_hoje', vendedor.limite_abordagens_hoje(),
      'buscas_hoje', (select count(*) from buscas where criado_em >= v_hoje),
      'buscas_dia_max', c.buscas_dia_max,
      'buscas_mes', (select count(*) from buscas where criado_em >= v_mes),
      'buscas_mes_max', c.buscas_mes_max,
      'fila', (select count(*) from leads where status = 'fila' and telefone is not null),
      'ultima_atividade', (select max(criado_em) from mensagens),
      'hora_inicio', c.hora_inicio, 'hora_fim', c.hora_fim
    ) from config c where c.id = 1),

    'funil_total', jsonb_build_object(
      'captados',    (select count(*) from leads where place_id not like 'teste-%'),
      'abordados',   (select count(*) from leads where primeira_abordagem_em is not null),
      'responderam', (select count(*) from leads where respondeu_em is not null),
      'previas',     (select count(*) from leads where previa_gerada_em is not null),
      'pix',         (select count(*) from leads where sinal_enviado_em is not null),
      'fechados',    (select count(*) from leads where status = 'fechado')
    ),

    'status', (select coalesce(jsonb_object_agg(status, n), '{}') from (
      select status, count(*) n from leads where place_id not like 'teste-%' group by status) s),

    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
        'dia', d::date,
        'abordados', (select count(*) from leads where (primeira_abordagem_em at time zone 'America/Sao_Paulo')::date = d::date),
        'responderam', (select count(*) from leads where (respondeu_em at time zone 'America/Sao_Paulo')::date = d::date),
        'fechados', (select count(*) from leads where status = 'fechado' and (fechado_em at time zone 'America/Sao_Paulo')::date = d::date)
      ) order by d), '[]')
      from generate_series((now() at time zone 'America/Sao_Paulo')::date - 29, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d),

    'em_andamento', (select coalesce(jsonb_agg(x order by x->>'ultimo_contato_em' desc nulls last), '[]') from (
      select jsonb_build_object('id', id, 'nome', coalesce(nome, '(dados expirados)'), 'nicho', nicho, 'cidade', cidade,
        'telefone', telefone, 'status', status, 'pacote', pacote, 'valor', valor_final, 'sinal', sinal_valor,
        'previa_url', previa_url, 'motivo', motivo_passagem, 'humano', humano_assumiu,
        'pagamento_informado_em', pagamento_informado_em,
        'ultimo_contato_em', ultimo_contato_em, 'respondeu_em', respondeu_em) x
      from leads where status in ('conversando', 'previa_enviada', 'sinal_enviado', 'atencao')
      and place_id not like 'teste-%') a),

    'abordados_aguardando', (select count(*) from leads where status = 'abordado'),

    'recentes', (select coalesce(jsonb_agg(x), '[]') from (
      select jsonb_build_object('id', id, 'nome', coalesce(nome, '(dados expirados)'), 'nicho', nicho, 'cidade', cidade,
        'status', status, 'valor', valor_final, 'previa_url', previa_url, 'motivo', motivo_passagem,
        'quando', coalesce(fechado_em, atualizado_em)) x
      from leads where status in ('fechado', 'encerrado', 'bloqueado') and place_id not like 'teste-%'
      and respondeu_em is not null
      order by coalesce(fechado_em, atualizado_em) desc limit 30) r),

    'nichos', (select coalesce(jsonb_agg(x order by (x->>'abordados')::int desc), '[]') from (
      select jsonb_build_object('nicho', nicho,
        'abordados', count(*) filter (where primeira_abordagem_em is not null),
        'responderam', count(*) filter (where respondeu_em is not null),
        'fechados', count(*) filter (where status = 'fechado')) x
      from leads where place_id not like 'teste-%' group by nicho) n),

    'objecoes_resumo', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]') from (
      select jsonb_build_object('categoria', o.categoria, 'total', count(*),
        'contornadas', count(*) filter (where vendedor.resultado_objecao(l.status, l.sinal_enviado_em) = 'contornada'),
        'nao_contornadas', count(*) filter (where vendedor.resultado_objecao(l.status, l.sinal_enviado_em) = 'nao_contornada'),
        'com_zidd', count(*) filter (where vendedor.resultado_objecao(l.status, l.sinal_enviado_em) = 'com_zidd'),
        'em_aberto', count(*) filter (where vendedor.resultado_objecao(l.status, l.sinal_enviado_em) = 'em_aberto')) x
      from objecoes o join leads l on l.id = o.lead_id group by o.categoria) s),

    'objecoes', (select coalesce(jsonb_agg(x), '[]') from (
      select jsonb_build_object('id', o.id, 'categoria', o.categoria, 'fala', o.fala_lead, 'resposta', o.resposta_laura,
        'resultado', vendedor.resultado_objecao(l.status, l.sinal_enviado_em), 'lead', coalesce(l.nome, '(dados expirados)'),
        'nicho', l.nicho, 'cidade', l.cidade, 'quando', o.criado_em) x
      from objecoes o join leads l on l.id = o.lead_id
      order by o.criado_em desc limit 200) s),

    'eventos', (select coalesce(jsonb_agg(x), '[]') from (
      select jsonb_build_object('tipo', tipo, 'detalhe', detalhe, 'quando', criado_em) x
      from eventos where criado_em > now() - interval '7 days' and tipo in ('erro', 'aviso')
      order by criado_em desc limit 20) e)
  );
end $$;

-- Botão "Marcar como pago" (Pix manual): a venda vai para Fechado.
create or replace function public.laura_marcar_pago(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = vendedor, public
as $$
begin
  if not coalesce(public.eh_admin(), false) then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  update vendedor.leads
     set status = 'fechado', fechado_em = coalesce(fechado_em, now()), humano_assumiu = true, proximo_contato_em = null
   where id = p_lead and status in ('conversando', 'previa_enviada', 'sinal_enviado', 'atencao');
  if not found then
    raise exception 'Este lead não está numa etapa que possa ser marcada como paga.';
  end if;
end $$;

revoke all on function public.laura_painel() from public, anon;
revoke all on function public.laura_marcar_pago(uuid) from public, anon;
grant execute on function public.laura_painel() to authenticated;
grant execute on function public.laura_marcar_pago(uuid) to authenticated;
