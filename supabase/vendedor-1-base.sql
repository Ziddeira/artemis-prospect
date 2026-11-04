-- Vendedor Ártemis — Etapa 2: base de dados do vendedor autônomo
-- Tudo fica no schema "vendedor", separado das tabelas da Ártemis Prospect.
-- O vendedor (no PC) entra com um usuário próprio, "vendedor_bot", que só
-- enxerga este schema. Ninguém do site (anon/authenticated) tem acesso.

create schema if not exists vendedor;
revoke all on schema vendedor from public, anon, authenticated;

-- 1. Configuração (uma linha só) ---------------------------------------------
create table if not exists vendedor.config (
  id integer primary key default 1 check (id = 1),
  pausado boolean not null default true,              -- começa PAUSADO
  inicio_operacao date,                               -- dia da 1ª abordagem real (define a semana do volume)
  buscas_dia_max integer not null default 30,         -- teto diário do Google
  buscas_mes_max integer not null default 950,        -- teto mensal (grátis = 1.000)
  fotos_dia_max integer not null default 30,          -- teto diário de fotos do Google
  hora_inicio time not null default '09:00',
  hora_fim time not null default '18:00',
  dias_semana integer[] not null default '{1,2,3,4,5,6}', -- 1=seg ... 7=dom
  numero_aviso text not null default '5548988149115',
  atualizado_em timestamptz not null default now()
);
insert into vendedor.config (id) values (1) on conflict (id) do nothing;

-- 2. Buscas feitas no Google (controle de teto e para não repetir) -----------
create table if not exists vendedor.buscas (
  id bigint generated always as identity primary key,
  nicho text not null,
  cidade text not null,
  uf text not null,
  termo text not null,
  pagina integer not null default 1,
  resultados integer not null default 0,
  aproveitados integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists buscas_criado_em_idx on vendedor.buscas (criado_em desc);
create index if not exists buscas_nicho_cidade_idx on vendedor.buscas (nicho, cidade, uf);

-- 3. Fotos buscadas no Google (teto diário) ----------------------------------
create table if not exists vendedor.fotos_consultas (
  id bigint generated always as identity primary key,
  lead_id uuid,
  quantidade integer not null default 1,
  criado_em timestamptz not null default now()
);
create index if not exists fotos_criado_em_idx on vendedor.fotos_consultas (criado_em desc);

-- 4. Lista de bloqueio (quem pediu para parar). Fica para sempre. ------------
create table if not exists vendedor.bloqueio (
  telefone text primary key check (telefone ~ '^[0-9]{12,13}$'),
  motivo text not null default 'pediu_para_parar',
  criado_em timestamptz not null default now()
);

-- 5. Leads ---------------------------------------------------------------------
create table if not exists vendedor.leads (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  nicho text not null,
  cidade text not null,
  uf text not null,
  -- dados vindos do Google: apagados em 30 dias se o lead não responder
  nome text,
  endereco text,
  nota numeric(2,1),
  avaliacoes integer,
  maps_url text,
  dados_google_expira_em timestamptz not null default now() + interval '30 days',
  -- contato (formato 55 + DDD + número, só dígitos)
  telefone text unique check (telefone is null or telefone ~ '^55[0-9]{2}9[0-9]{8}$'),
  -- andamento
  status text not null default 'fila' check (status in (
    'fila',            -- encontrado, aguardando 1ª abordagem
    'abordado',        -- 1ª mensagem enviada, sem resposta
    'conversando',     -- respondeu
    'previa_enviada',  -- link da prévia enviado
    'sinal_enviado',   -- Pix do sinal gerado e enviado
    'fechado',         -- sinal confirmado no Asaas -> passa para o Zidd
    'atencao',         -- passou para o Zidd por outro motivo
    'encerrado',       -- sem resposta após os lembretes
    'bloqueado',       -- pediu para parar
    'descartado'       -- não passou nos filtros / número inválido
  )),
  motivo_passagem text,
  humano_assumiu boolean not null default false,  -- Zidd respondeu: robô para
  lembretes_enviados integer not null default 0 check (lembretes_enviados between 0 and 2),
  proximo_contato_em timestamptz,
  primeira_abordagem_em timestamptz,
  ultimo_contato_em timestamptz,
  respondeu_em timestamptz,
  -- prévia
  previa_slug text unique,
  previa_url text,
  previa_gerada_em timestamptz,
  -- negociação e pagamento
  pacote text check (pacote in ('lp', 'site', 'complexo')),
  valor_tabela numeric(10,2),
  desconto_pct numeric(4,1) not null default 0 check (desconto_pct between 0 and 10),
  valor_final numeric(10,2),
  sinal_valor numeric(10,2),
  cliente_nome text,
  cliente_documento text,
  asaas_customer_id text,
  asaas_payment_id text unique,
  pix_copia_cola text,
  sinal_enviado_em timestamptz,
  fechado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- regras de preço gravadas no banco: nunca abaixo do mínimo
  constraint valor_minimo check (
    valor_final is null
    or (pacote = 'lp' and valor_final >= 135)
    or (pacote = 'site' and valor_final >= 495)
    or (pacote = 'complexo' and valor_final >= 765)
  ),
  -- sinal: 30% do valor, no mínimo R$ 50
  constraint sinal_regra check (
    sinal_valor is null or valor_final is null
    or sinal_valor >= greatest(50, round(valor_final * 0.30, 2))
  )
);
create index if not exists leads_status_idx on vendedor.leads (status, proximo_contato_em);
create index if not exists leads_abordagem_idx on vendedor.leads (primeira_abordagem_em desc);

-- 6. Mensagens -----------------------------------------------------------------
create table if not exists vendedor.mensagens (
  id bigint generated always as identity primary key,
  lead_id uuid not null references vendedor.leads (id) on delete cascade,
  direcao text not null check (direcao in ('enviada', 'recebida', 'sistema')),
  autor text not null default 'robo' check (autor in ('robo', 'lead', 'zidd', 'sistema')),
  texto text not null,
  whatsapp_msg_id text unique,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_lead_idx on vendedor.mensagens (lead_id, criado_em);

-- 7. atualizado_em automático ------------------------------------------------
create or replace function vendedor.tocar_atualizado_em()
returns trigger language plpgsql set search_path = vendedor as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists leads_atualizado_em on vendedor.leads;
create trigger leads_atualizado_em before update on vendedor.leads
  for each row execute function vendedor.tocar_atualizado_em();
drop trigger if exists config_atualizado_em on vendedor.config;
create trigger config_atualizado_em before update on vendedor.config
  for each row execute function vendedor.tocar_atualizado_em();

-- 8. Telefone bloqueado nunca vira lead ativo -------------------------------
create or replace function vendedor.barrar_bloqueado()
returns trigger language plpgsql set search_path = vendedor as $$
begin
  if new.telefone is not null
     and new.status not in ('bloqueado', 'descartado')
     and exists (select 1 from vendedor.bloqueio b where b.telefone = new.telefone) then
    new.status := 'bloqueado';
  end if;
  return new;
end $$;

drop trigger if exists leads_barrar_bloqueado on vendedor.leads;
create trigger leads_barrar_bloqueado before insert or update of telefone, status on vendedor.leads
  for each row execute function vendedor.barrar_bloqueado();

-- 9. Funções de controle ------------------------------------------------------
-- "Hoje" sempre no horário de Brasília.
create or replace function vendedor.hoje_inicio()
returns timestamptz language sql stable as $$
  select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

-- Limite de abordagens novas hoje, pela semana de operação: 10, 20, 35, 50.
create or replace function vendedor.limite_abordagens_hoje()
returns integer language sql stable set search_path = vendedor as $$
  select case
    when c.inicio_operacao is null then 10
    else case least(4, ((now() at time zone 'America/Sao_Paulo')::date - c.inicio_operacao) / 7 + 1)
      when 1 then 10 when 2 then 20 when 3 then 35 else 50 end
  end
  from vendedor.config c where c.id = 1
$$;

create or replace function vendedor.abordagens_hoje()
returns integer language sql stable set search_path = vendedor as $$
  select count(*)::integer from vendedor.leads
  where primeira_abordagem_em >= vendedor.hoje_inicio()
$$;

-- Pode buscar no Google agora? (teto diário e mensal)
create or replace function vendedor.pode_buscar()
returns boolean language sql stable set search_path = vendedor as $$
  select
    (select count(*) from vendedor.buscas where criado_em >= vendedor.hoje_inicio()) < c.buscas_dia_max
    and (select count(*) from vendedor.buscas
         where criado_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
        < c.buscas_mes_max
  from vendedor.config c where c.id = 1
$$;

create or replace function vendedor.pode_buscar_fotos(p_qtd integer default 1)
returns boolean language sql stable set search_path = vendedor as $$
  select coalesce((select sum(quantidade) from vendedor.fotos_consultas
                   where criado_em >= vendedor.hoje_inicio()), 0) + p_qtd <= c.fotos_dia_max
  from vendedor.config c where c.id = 1
$$;

-- Está em horário de trabalho e não pausado?
create or replace function vendedor.em_expediente()
returns boolean language sql stable set search_path = vendedor as $$
  select not c.pausado
    and extract(isodow from now() at time zone 'America/Sao_Paulo')::int = any (c.dias_semana)
    and (now() at time zone 'America/Sao_Paulo')::time between c.hora_inicio and c.hora_fim
  from vendedor.config c where c.id = 1
$$;

-- Pode fazer uma abordagem nova agora?
create or replace function vendedor.pode_abordar()
returns boolean language sql stable set search_path = vendedor as $$
  select vendedor.em_expediente() and vendedor.abordagens_hoje() < vendedor.limite_abordagens_hoje()
$$;

-- Bloqueia um telefone para sempre e encerra o lead.
create or replace function vendedor.bloquear(p_telefone text, p_motivo text default 'pediu_para_parar')
returns void language plpgsql set search_path = vendedor as $$
begin
  insert into vendedor.bloqueio (telefone, motivo) values (p_telefone, p_motivo)
  on conflict (telefone) do nothing;
  update vendedor.leads set status = 'bloqueado', proximo_contato_em = null
  where telefone = p_telefone;
end $$;

-- Apaga dados do Google de leads que nunca responderam, após 30 dias
-- (política de cache do Google Maps Platform; place_id pode ficar).
create or replace function vendedor.limpar_dados_google()
returns integer language plpgsql set search_path = vendedor as $$
declare v integer;
begin
  update vendedor.leads
     set nome = null, endereco = null, nota = null, avaliacoes = null, maps_url = null,
         telefone = case when respondeu_em is null then null else telefone end
   where dados_google_expira_em < now()
     and respondeu_em is null
     and (nome is not null or telefone is not null);
  get diagnostics v = row_count;
  return v;
end $$;

-- 10. Usuário do vendedor: só o schema "vendedor" -----------------------------
-- (o usuário vendedor_bot é criado à parte, com senha, fora desta migração)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'vendedor_bot') then
    execute 'grant usage on schema vendedor to vendedor_bot';
    execute 'grant select, insert, update, delete on all tables in schema vendedor to vendedor_bot';
    execute 'grant usage, select on all sequences in schema vendedor to vendedor_bot';
    execute 'grant execute on all functions in schema vendedor to vendedor_bot';
    execute 'alter role vendedor_bot set search_path = vendedor';
  end if;
end $$;

revoke all on all tables in schema vendedor from public, anon, authenticated;
revoke all on all functions in schema vendedor from public, anon, authenticated;
