-- Ártemis Prospect — Etapa 23, parte 3 de 3: geração de site com IA
-- Rode DEPOIS da parte 2 (etapa23-2-platina-pagamentos.sql), inteiro, de
-- uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Regras desta etapa (todas conferidas AQUI, no banco, nunca no navegador):
--   * só gera site quem está no Platina dentro da validade, e só a partir
--     de um lead que a própria pessoa desbloqueou;
--   * cada geração gasta 1 do saldo: primeiro as 5 do mês
--     (sites_restantes), depois as do pacote avulso (sites_extras);
--   * cada site tem 2 ajustes grátis. O 3º ajuste conta como uma geração
--     nova (gasta 1 do saldo) e, como geração nova, devolve os 2 ajustes
--     grátis;
--   * no máximo 2 gerações por hora por usuário (gerações = o que gasta
--     saldo). Como trava extra de custo, no máximo 6 chamadas à IA por
--     hora no total (contando ajustes grátis e falhas);
--   * uma geração por vez por usuário;
--   * se a IA falhar, o saldo (ou o ajuste grátis) volta na hora;
--   * cada chamada à IA vira uma linha em sites_geracoes, com usuário,
--     data, modelo, tokens e custo estimado em dólar (Gestão > Sites IA).
--     Só o servidor (service_role) grava o resultado e o custo;
--   * o site pronto (HTML) fica guardado 30 dias depois da última versão,
--     para baixar de novo e pedir ajustes. Ele leva nome, telefone e
--     endereço que vieram do Google, e a política de cache do Google
--     limita esse tempo. O registro de custo continua para sempre.
--   * o Ártemis NÃO hospeda o site: a pessoa baixa e publica onde quiser.

-- 1. Tabela "sites_gerados" ---------------------------------------------------
-- Um site por linha. "dados" guarda o formulário confirmado pela pessoa
-- (nome, ramo, cidade, serviços, telefone, idioma...).
create table if not exists public.sites_gerados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  nome text not null check (char_length(nome) between 1 and 120),
  dados jsonb not null,
  estilo text not null check (estilo in ('moderno', 'elegante', 'acolhedor', 'impacto')),
  status text not null default 'gerando' check (status in ('gerando', 'pronto', 'falhou')),
  html text,
  versao integer not null default 0,
  ajustes_gratis integer not null default 2 check (ajustes_gratis between 0 and 2),
  ajustes_feitos integer not null default 0,
  html_expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists sites_gerados_user_idx on public.sites_gerados (user_id, criado_em desc);

alter table public.sites_gerados enable row level security;

grant select on public.sites_gerados to authenticated;
revoke insert, update, delete on public.sites_gerados from authenticated, anon;

drop policy if exists "Usuários veem os próprios sites" on public.sites_gerados;
create policy "Usuários veem os próprios sites"
  on public.sites_gerados
  for select
  to authenticated
  using (user_id = auth.uid());

-- 2. Tabela "sites_geracoes" (registro de custo) ------------------------------
-- Uma linha por chamada à IA (geração ou ajuste).
--   tipo: geracao | ajuste (grátis) | ajuste_cobrado (3º ajuste em diante).
--   credito_origem: de onde saiu a geração (mensal | extra); vazio nos
--     ajustes grátis.
--   status: reservada (IA trabalhando) | concluida | falhou.
--   custo_usd: estimado pelo servidor com os tokens que a IA informou e a
--     tabela de preços de lib/sites/custos.ts.
create table if not exists public.sites_geracoes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  site_id uuid references public.sites_gerados (id) on delete set null,
  tipo text not null check (tipo in ('geracao', 'ajuste', 'ajuste_cobrado')),
  pedido text check (pedido is null or char_length(pedido) <= 1000),
  credito_origem text check (credito_origem is null or credito_origem in ('mensal', 'extra')),
  status text not null default 'reservada' check (status in ('reservada', 'concluida', 'falhou')),
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  tokens_cache_leitura integer,
  tokens_cache_escrita integer,
  custo_usd numeric(10, 4),
  duracao_ms integer,
  erro text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists sites_geracoes_user_idx on public.sites_geracoes (user_id, criado_em desc);
create index if not exists sites_geracoes_criado_idx on public.sites_geracoes (criado_em desc);
create index if not exists sites_geracoes_site_idx on public.sites_geracoes (site_id);

alter table public.sites_geracoes enable row level security;
-- Sem GRANT para o usuário: só as funções abaixo leem e escrevem aqui.
revoke all on public.sites_geracoes from anon, authenticated;

-- 3. Uso interno: devolver o que uma chamada reservou -------------------------
create or replace function public.sites_devolver_reserva(p_geracao public.sites_geracoes)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_geracao.credito_origem = 'mensal' then
    update public.profiles set sites_restantes = sites_restantes + 1 where id = p_geracao.user_id;
  elsif p_geracao.credito_origem = 'extra' then
    update public.profiles set sites_extras = sites_extras + 1 where id = p_geracao.user_id;
  end if;

  if p_geracao.tipo = 'ajuste' then
    update public.sites_gerados
      set ajustes_gratis = least(2, ajustes_gratis + 1)
      where id = p_geracao.site_id;
  end if;

  if p_geracao.tipo = 'geracao' then
    update public.sites_gerados
      set status = 'falhou', atualizado_em = now()
      where id = p_geracao.site_id and html is null;
  end if;
end;
$$;

revoke all on function public.sites_devolver_reserva(public.sites_geracoes) from public, anon, authenticated;

-- Reservas "presas" (o servidor caiu no meio): depois de 15 minutos,
-- contam como falha e o saldo volta.
create or replace function public.sites_liberar_presas(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.sites_geracoes%rowtype;
begin
  for v_g in
    update public.sites_geracoes
       set status = 'falhou',
           erro = coalesce(erro, 'Tempo esgotado (a geração não terminou em 15 minutos).'),
           concluido_em = now()
     where user_id = p_user_id
       and status = 'reservada'
       and criado_em < now() - interval '15 minutes'
    returning *
  loop
    perform public.sites_devolver_reserva(v_g);
  end loop;
end;
$$;

revoke all on function public.sites_liberar_presas(uuid) from public, anon, authenticated;

-- Confere plano, trava o perfil e as regras de ritmo. Devolve o perfil.
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

-- 4. Para a tela: saldo e limites ------------------------------------------------
create or replace function public.meu_saldo_sites()
returns table (
  plano text,
  platina_ativo boolean,
  sites_restantes integer,
  sites_extras integer,
  geracoes_ultima_hora integer,
  proxima_liberacao timestamptz,
  gerando boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;

  perform public.aplicar_vencimento_plano(auth.uid());
  perform public.sites_liberar_presas(auth.uid());

  return query
    select p.plano,
           p.plano = 'platina' and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now()),
           p.sites_restantes,
           p.sites_extras,
           (select count(*)::integer from public.sites_geracoes g
             where g.user_id = p.id and g.credito_origem is not null and g.status <> 'falhou'
               and g.criado_em > now() - interval '1 hour'),
           (select min(g.criado_em) + interval '1 hour' from public.sites_geracoes g
             where g.user_id = p.id and g.credito_origem is not null and g.status <> 'falhou'
               and g.criado_em > now() - interval '1 hour'),
           exists (select 1 from public.sites_geracoes g where g.user_id = p.id and g.status = 'reservada')
      from public.profiles p
     where p.id = auth.uid();
end;
$$;

revoke all on function public.meu_saldo_sites() from public, anon;
grant execute on function public.meu_saldo_sites() to authenticated;

-- 5. Reservar uma geração nova ---------------------------------------------------
-- Chamada pelo servidor com a sessão do usuário, ANTES de chamar a IA.
-- Gasta 1 do saldo na hora (volta se a IA falhar).
create or replace function public.reservar_geracao_site(
  p_place_id text,
  p_dados jsonb,
  p_estilo text
)
returns table (site_id uuid, geracao_id bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_perfil public.profiles%rowtype;
  v_origem text;
  v_nome text := btrim(coalesce(p_dados ->> 'nome', ''));
  v_site uuid;
  v_geracao bigint;
begin
  if p_place_id is null or length(btrim(p_place_id)) = 0 then
    raise exception 'Lead inválido.';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or length(p_dados::text) > 8000 then
    raise exception 'Dados do site inválidos.';
  end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    raise exception 'Confira o nome da empresa (de 2 a 120 caracteres).';
  end if;
  if p_estilo is null or p_estilo not in ('moderno', 'elegante', 'acolhedor', 'impacto') then
    raise exception 'Escolha um estilo visual.';
  end if;

  v_perfil := public.sites_conferir_conta(true);

  if not exists (
    select 1 from public.leads_desbloqueados
     where user_id = auth.uid() and place_id = p_place_id
  ) then
    raise exception 'Só dá para gerar site de um lead que você desbloqueou.';
  end if;

  if v_perfil.sites_restantes > 0 then
    v_origem := 'mensal';
    update public.profiles set sites_restantes = sites_restantes - 1 where id = auth.uid();
  else
    v_origem := 'extra';
    update public.profiles set sites_extras = sites_extras - 1 where id = auth.uid();
  end if;

  insert into public.sites_gerados (user_id, place_id, nome, dados, estilo)
  values (auth.uid(), p_place_id, v_nome, p_dados, p_estilo)
  returning id into v_site;

  insert into public.sites_geracoes (user_id, site_id, tipo, credito_origem)
  values (auth.uid(), v_site, 'geracao', v_origem)
  returning id into v_geracao;

  return query select v_site, v_geracao;
end;
$$;

revoke all on function public.reservar_geracao_site(text, jsonb, text) from public, anon;
grant execute on function public.reservar_geracao_site(text, jsonb, text) to authenticated;

-- 6. Reservar um ajuste ------------------------------------------------------------
-- Os 2 primeiros ajustes de cada site são grátis. Do 3º em diante, conta
-- como geração nova: gasta 1 do saldo, entra no limite de 2 por hora e,
-- quando fica pronto, devolve os 2 ajustes grátis.
create or replace function public.reservar_ajuste_site(p_site_id uuid, p_pedido text)
returns table (geracao_id bigint, cobrado boolean, ajustes_gratis_restantes integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_site public.sites_gerados%rowtype;
  v_perfil public.profiles%rowtype;
  v_pedido text := btrim(coalesce(p_pedido, ''));
  v_cobra boolean;
  v_origem text;
  v_geracao bigint;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if char_length(v_pedido) < 5 then
    raise exception 'Escreva o que você quer mudar no site.';
  end if;
  if char_length(v_pedido) > 1000 then
    raise exception 'O pedido de ajuste pode ter no máximo 1000 caracteres.';
  end if;

  select * into v_site from public.sites_gerados
   where id = p_site_id and user_id = auth.uid()
   for update;
  if v_site.id is null then
    raise exception 'Site não encontrado.';
  end if;
  if v_site.html is null or v_site.status <> 'pronto' then
    raise exception 'Este site não está disponível para ajustes.';
  end if;
  if v_site.html_expira_em is not null and v_site.html_expira_em <= now() then
    raise exception 'Este site passou de 30 dias e não fica mais guardado. Gere um novo a partir do lead.';
  end if;

  v_cobra := v_site.ajustes_gratis < 1;
  v_perfil := public.sites_conferir_conta(v_cobra);

  if v_cobra then
    if v_perfil.sites_restantes > 0 then
      v_origem := 'mensal';
      update public.profiles set sites_restantes = sites_restantes - 1 where id = auth.uid();
    else
      v_origem := 'extra';
      update public.profiles set sites_extras = sites_extras - 1 where id = auth.uid();
    end if;
  else
    update public.sites_gerados set ajustes_gratis = ajustes_gratis - 1 where id = v_site.id;
  end if;

  insert into public.sites_geracoes (user_id, site_id, tipo, pedido, credito_origem)
  values (auth.uid(), v_site.id, case when v_cobra then 'ajuste_cobrado' else 'ajuste' end, v_pedido, v_origem)
  returning id into v_geracao;

  return query select v_geracao, v_cobra, case when v_cobra then 0 else v_site.ajustes_gratis - 1 end;
end;
$$;

revoke all on function public.reservar_ajuste_site(uuid, text) from public, anon;
grant execute on function public.reservar_ajuste_site(uuid, text) to authenticated;

-- 7. Resultado da IA (só o servidor) -------------------------------------------------
create or replace function public.concluir_geracao_site(
  p_geracao_id bigint,
  p_html text,
  p_modelo text,
  p_tokens_entrada integer,
  p_tokens_saida integer,
  p_tokens_cache_leitura integer,
  p_tokens_cache_escrita integer,
  p_custo_usd numeric,
  p_duracao_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.sites_geracoes%rowtype;
begin
  if p_html is null or char_length(p_html) < 200 or char_length(p_html) > 400000 then
    raise exception 'HTML inválido.';
  end if;

  select * into v_g from public.sites_geracoes where id = p_geracao_id for update;
  if v_g.id is null or v_g.status <> 'reservada' then
    raise exception 'Geração não está aguardando resultado.';
  end if;

  update public.sites_geracoes
     set status = 'concluida',
         modelo = p_modelo,
         tokens_entrada = p_tokens_entrada,
         tokens_saida = p_tokens_saida,
         tokens_cache_leitura = p_tokens_cache_leitura,
         tokens_cache_escrita = p_tokens_cache_escrita,
         custo_usd = p_custo_usd,
         duracao_ms = p_duracao_ms,
         concluido_em = now()
   where id = p_geracao_id;

  update public.sites_gerados
     set html = p_html,
         status = 'pronto',
         versao = versao + 1,
         ajustes_feitos = ajustes_feitos + case when v_g.tipo = 'geracao' then 0 else 1 end,
         ajustes_gratis = case when v_g.tipo = 'ajuste_cobrado' then 2 else ajustes_gratis end,
         html_expira_em = now() + interval '30 days',
         atualizado_em = now()
   where id = v_g.site_id;
end;
$$;

create or replace function public.falhar_geracao_site(
  p_geracao_id bigint,
  p_erro text,
  p_modelo text,
  p_tokens_entrada integer,
  p_tokens_saida integer,
  p_custo_usd numeric,
  p_duracao_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.sites_geracoes%rowtype;
begin
  update public.sites_geracoes
     set status = 'falhou',
         erro = left(coalesce(p_erro, 'Falha desconhecida.'), 500),
         modelo = p_modelo,
         tokens_entrada = p_tokens_entrada,
         tokens_saida = p_tokens_saida,
         custo_usd = p_custo_usd,
         duracao_ms = p_duracao_ms,
         concluido_em = now()
   where id = p_geracao_id and status = 'reservada'
  returning * into v_g;

  if v_g.id is not null then
    perform public.sites_devolver_reserva(v_g);
  end if;
end;
$$;

-- Apaga o HTML guardado há mais de 30 dias (rotina diária). O registro
-- de custo fica.
create or replace function public.limpar_sites_expirados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  update public.sites_gerados
     set html = null, dados = '{}'::jsonb
   where html is not null and html_expira_em <= now();
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.concluir_geracao_site(bigint, text, text, integer, integer, integer, integer, numeric, integer) from public, anon, authenticated;
revoke all on function public.falhar_geracao_site(bigint, text, text, integer, integer, numeric, integer) from public, anon, authenticated;
revoke all on function public.limpar_sites_expirados() from public, anon, authenticated;
grant execute on function public.concluir_geracao_site(bigint, text, text, integer, integer, integer, integer, numeric, integer) to service_role;
grant execute on function public.falhar_geracao_site(bigint, text, text, integer, integer, numeric, integer) to service_role;
grant execute on function public.limpar_sites_expirados() to service_role;

-- 8. Gestão > Sites IA -------------------------------------------------------------------
-- Números do mês corrente (Brasília) e as últimas chamadas.
create or replace function public.admin_sites_ia()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := public.inicio_do_mes(public.mes_brasilia());
  v_resultado jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  with mes as (
    select * from public.sites_geracoes where criado_em >= v_inicio
  )
  select jsonb_build_object(
    'mes', public.mes_brasilia(),
    'geracoes', (select count(*) from mes where tipo = 'geracao' and status = 'concluida'),
    'ajustes_gratis', (select count(*) from mes where tipo = 'ajuste' and status = 'concluida'),
    'ajustes_cobrados', (select count(*) from mes where tipo = 'ajuste_cobrado' and status = 'concluida'),
    'falhas', (select count(*) from mes where status = 'falhou'),
    'custo_usd', (select coalesce(sum(custo_usd), 0) from mes),
    'custo_medio_geracao_usd', (select coalesce(avg(custo_usd), 0) from mes
                                  where tipo = 'geracao' and status = 'concluida'),
    'custo_medio_ajuste_usd', (select coalesce(avg(custo_usd), 0) from mes
                                 where tipo <> 'geracao' and status = 'concluida'),
    'duracao_media_ms', (select coalesce(avg(duracao_ms), 0)::integer from mes where status = 'concluida'),
    'usuarios', (select count(distinct user_id) from mes),
    'assinantes_platina', (select count(*) from public.profiles p
                            where p.plano = 'platina'
                              and (p.plano_valido_ate is null or p.plano_valido_ate + interval '3 days' >= now())),
    'pacotes_vendidos', (select count(*) from public.cobrancas
                          where tipo = 'pacote_sites' and creditado_em >= v_inicio and estornado_em is null),
    'por_modelo', coalesce((
      select jsonb_agg(jsonb_build_object('modelo', modelo, 'chamadas', qtd, 'custo_usd', custo) order by custo desc)
        from (select coalesce(modelo, '—') as modelo, count(*) as qtd, coalesce(sum(custo_usd), 0) as custo
                from mes group by 1) t
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', dia, 'chamadas', qtd, 'custo_usd', custo) order by dia)
        from (select (criado_em at time zone 'America/Sao_Paulo')::date as dia,
                     count(*) as qtd, coalesce(sum(custo_usd), 0) as custo
                from mes group by 1) t
    ), '[]'::jsonb),
    'top_usuarios', coalesce((
      select jsonb_agg(x order by (x ->> 'custo_usd')::numeric desc)
        from (
          select jsonb_build_object(
                   'user_id', g.user_id,
                   'email', p.email,
                   'apelido', p.apelido,
                   'chamadas', count(*),
                   'geracoes', count(*) filter (where g.credito_origem is not null and g.status = 'concluida'),
                   'custo_usd', coalesce(sum(g.custo_usd), 0)
                 ) as x
            from mes g
            left join public.profiles p on p.id = g.user_id
           group by g.user_id, p.email, p.apelido
           order by coalesce(sum(g.custo_usd), 0) desc
           limit 10
        ) t
    ), '[]'::jsonb),
    'ultimas', coalesce((
      select jsonb_agg(x order by (x ->> 'criado_em') desc)
        from (
          select jsonb_build_object(
                   'id', g.id,
                   'criado_em', g.criado_em,
                   'email', p.email,
                   'site', s.nome,
                   'tipo', g.tipo,
                   'status', g.status,
                   'modelo', g.modelo,
                   'tokens_entrada', g.tokens_entrada,
                   'tokens_saida', g.tokens_saida,
                   'custo_usd', g.custo_usd,
                   'duracao_ms', g.duracao_ms,
                   'erro', g.erro
                 ) as x
            from public.sites_geracoes g
            left join public.profiles p on p.id = g.user_id
            left join public.sites_gerados s on s.id = g.site_id
           order by g.criado_em desc
           limit 30
        ) t
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.admin_sites_ia() from public, anon;
grant execute on function public.admin_sites_ia() to authenticated;

notify pgrst, 'reload schema';
