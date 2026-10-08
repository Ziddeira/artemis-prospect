-- Ártemis Prospect — Etapa 23, parte 2 de 3: pagamentos do Platina e do
-- pacote de sites (+3 gerações por R$ 39,90)
-- Rode DEPOIS da parte 1 (etapa23-1-platina-plano.sql), inteiro, de uma
-- vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * cobrancas aceita o tipo novo "pacote_sites";
--   * função registrar_cobranca_pacote_sites (só o servidor chama), igual
--     à do pacote extra da etapa 3;
--   * processar_evento_asaas (a função do webhook, etapa 3) passa a:
--       - reconhecer o pacote de sites (pela referência
--         "pacote_sites:<id do usuário>" que o servidor manda ao Asaas)
--         e somar +3 em profiles.sites_extras quando o pagamento for
--         confirmado (e tirar 3 se for estornado);
--       - na renovação paga de qualquer plano, voltar
--         profiles.sites_restantes ao limite do plano (5 no Platina,
--         0 nos outros). As do mês não acumulam; as do pacote, sim.
--     Todo o resto (idempotência, estorno, cancelamento, auditoria) é
--     igual ao da etapa 3.

-- 1. cobrancas: tipo "pacote_sites" ----------------------------------------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
    where conrelid = 'public.cobrancas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%tipo%'
  loop
    execute format('alter table public.cobrancas drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table public.cobrancas
  add constraint cobrancas_tipo_valido
  check (tipo in ('assinatura', 'pacote', 'pacote_sites'));

-- 2. Registrar a cobrança do pacote de sites (servidor) ----------------------
-- Só registra o que foi criado no Asaas; as gerações só entram quando o
-- webhook confirmar o pagamento.
create or replace function public.registrar_cobranca_pacote_sites(
  p_user_id uuid,
  p_payment_id text,
  p_valor numeric,
  p_forma text,
  p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cobrancas (asaas_payment_id, user_id, tipo, valor, forma_pagamento, link_pagamento, status)
  values (p_payment_id, p_user_id, 'pacote_sites', p_valor, p_forma, p_link, 'PENDING')
  on conflict (asaas_payment_id) do nothing;
$$;

revoke all on function public.registrar_cobranca_pacote_sites(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.registrar_cobranca_pacote_sites(uuid, text, numeric, text, text) to service_role;

-- 3. processar_evento_asaas com o Platina e o pacote de sites ----------------
create or replace function public.processar_evento_asaas(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text := p_payload ->> 'event';
  v_pay jsonb := p_payload -> 'payment';
  v_sub jsonb := p_payload -> 'subscription';
  v_payment_id text := v_pay ->> 'id';
  v_subscription_id text := coalesce(v_pay ->> 'subscription', v_sub ->> 'id');
  v_customer_id text := coalesce(v_pay ->> 'customer', v_sub ->> 'customer');
  v_ref text := coalesce(v_pay ->> 'externalReference', v_sub ->> 'externalReference');
  v_valor numeric := nullif(v_pay ->> 'value', '')::numeric;
  v_tipo_avulso text;
  v_event_id text;
  v_user uuid;
  v_log_id bigint;
  v_resultado text;
  v_cob public.cobrancas%rowtype;
  v_plano text;
  v_lim record;
  v_fim_ciclo timestamptz;
  v_valido_ate timestamptz;
begin
  if v_evento is null then
    raise exception 'Evento sem o campo "event".';
  end if;

  -- Cobrança avulsa: pacote de sites (referência "pacote_sites:<id>") ou
  -- pacote extra de desbloqueios e buscas (todo o resto).
  v_tipo_avulso := case when v_ref like 'pacote\_sites:%' then 'pacote_sites' else 'pacote' end;

  v_event_id := coalesce(
    p_payload ->> 'id',
    v_evento || ':' || coalesce(v_payment_id, v_subscription_id, md5(p_payload::text))
      || ':' || coalesce(v_pay ->> 'status', v_sub ->> 'status', '')
  );

  if v_subscription_id is not null then
    select user_id into v_user from public.assinaturas
      where asaas_subscription_id = v_subscription_id;
  end if;
  if v_user is null and v_payment_id is not null then
    select user_id into v_user from public.cobrancas
      where asaas_payment_id = v_payment_id;
  end if;
  if v_user is null and v_ref ~ '^(assinatura|pacote|pacote_sites):[0-9a-f-]{36}$' then
    select id into v_user from public.profiles
      where id = split_part(v_ref, ':', 2)::uuid;
  end if;
  if v_user is null and v_customer_id is not null then
    select id into v_user from public.profiles
      where asaas_customer_id = v_customer_id;
  end if;

  insert into public.pagamentos_eventos (
    asaas_event_id, evento, asaas_payment_id, asaas_subscription_id,
    user_id, valor, forma_pagamento, status_pagamento, payload
  ) values (
    v_event_id, v_evento, v_payment_id, v_subscription_id,
    v_user, v_valor, v_pay ->> 'billingType', coalesce(v_pay ->> 'status', v_sub ->> 'status'), p_payload
  )
  on conflict (asaas_event_id) do nothing
  returning id into v_log_id;

  if v_log_id is null then
    return 'duplicado';
  end if;

  if v_user is null then
    v_resultado := 'usuario_nao_encontrado';

  -- Pagamento confirmado (cartão aprovado ou Pix pago) --------------------
  elsif v_evento in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') and v_payment_id is not null then
    insert into public.cobrancas (
      asaas_payment_id, user_id, tipo, asaas_subscription_id, valor, forma_pagamento, link_pagamento, status
    ) values (
      v_payment_id, v_user,
      case when v_subscription_id is not null then 'assinatura' else v_tipo_avulso end,
      v_subscription_id, v_valor, v_pay ->> 'billingType', v_pay ->> 'invoiceUrl', v_pay ->> 'status'
    )
    on conflict (asaas_payment_id) do nothing;

    select * into v_cob from public.cobrancas
      where asaas_payment_id = v_payment_id
      for update;
    perform 1 from public.profiles where id = v_user for update;

    update public.cobrancas set status = v_pay ->> 'status'
      where asaas_payment_id = v_payment_id;

    if v_cob.estornado_em is not null then
      v_resultado := 'ignorado_cobranca_estornada';
    elsif v_cob.creditado_em is not null then
      v_resultado := 'ja_creditado';
    elsif v_cob.tipo = 'pacote' then
      update public.profiles
        set creditos_desbloqueio = creditos_desbloqueio + 25,
            buscas_restantes = buscas_restantes + 15
        where id = v_user;
      update public.cobrancas set creditado_em = now()
        where asaas_payment_id = v_payment_id;
      v_resultado := 'pacote_creditado';
    elsif v_cob.tipo = 'pacote_sites' then
      -- Pacote de sites: +3 gerações, que não vencem.
      update public.profiles
        set sites_extras = sites_extras + 3
        where id = v_user;
      update public.cobrancas set creditado_em = now()
        where asaas_payment_id = v_payment_id;
      v_resultado := 'pacote_sites_creditado';
    else
      v_plano := public.plano_por_valor(v_valor);
      if v_plano is null then
        select plano into v_plano from public.assinaturas
          where asaas_subscription_id = v_subscription_id;
      end if;

      if v_plano is null then
        v_resultado := 'erro_plano_desconhecido';
      else
        select * into v_lim from public.limites_do_plano(v_plano);
        v_fim_ciclo := (
          (coalesce((v_pay ->> 'dueDate')::date, current_date) + interval '1 month')::date
        )::timestamp at time zone 'America/Sao_Paulo';

        -- Renovação: saldo VOLTA ao limite do plano (não acumula),
        -- inclusive as gerações de site do mês.
        update public.profiles
          set plano = v_plano,
              creditos_desbloqueio = v_lim.desbloqueios,
              buscas_restantes = v_lim.buscas,
              sites_restantes = public.sites_do_plano(v_plano),
              plano_valido_ate = greatest(coalesce(plano_valido_ate, v_fim_ciclo), v_fim_ciclo)
          where id = v_user;

        update public.assinaturas
          set status = 'ativa', atualizado_em = now()
          where asaas_subscription_id = v_subscription_id
            and status <> 'cancelada';

        update public.cobrancas
          set creditado_em = now(), plano = v_plano
          where asaas_payment_id = v_payment_id;
        v_resultado := 'plano_renovado_' || v_plano;
      end if;
    end if;

  -- Pagamento recusado ou vencido sem pagar -------------------------------
  elsif v_evento in ('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'PAYMENT_OVERDUE') then
    update public.cobrancas set status = v_pay ->> 'status'
      where asaas_payment_id = v_payment_id;
    if v_subscription_id is not null then
      update public.assinaturas
        set status = case when status = 'ativa' then 'inadimplente' else status end,
            link_pagamento = coalesce(v_pay ->> 'invoiceUrl', link_pagamento),
            atualizado_em = now()
        where asaas_subscription_id = v_subscription_id
          and status <> 'cancelada';
    end if;
    v_resultado := 'pagamento_nao_aprovado';

  -- Estorno ou contestação (chargeback) ------------------------------------
  elsif v_evento in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') and v_payment_id is not null then
    insert into public.cobrancas (
      asaas_payment_id, user_id, tipo, asaas_subscription_id, valor, forma_pagamento, status, estornado_em
    ) values (
      v_payment_id, v_user,
      case when v_subscription_id is not null then 'assinatura' else v_tipo_avulso end,
      v_subscription_id, v_valor, v_pay ->> 'billingType', v_pay ->> 'status', now()
    )
    on conflict (asaas_payment_id) do nothing;

    select * into v_cob from public.cobrancas
      where asaas_payment_id = v_payment_id
      for update;
    perform 1 from public.profiles where id = v_user for update;

    if v_cob.creditado_em is null then
      update public.cobrancas
        set estornado_em = coalesce(estornado_em, now()), status = v_pay ->> 'status'
        where asaas_payment_id = v_payment_id;
      v_resultado := 'estorno_sem_credito_a_remover';
    elsif v_cob.estornado_em is not null then
      v_resultado := 'ja_estornado';
    elsif v_cob.tipo = 'pacote' then
      update public.profiles
        set creditos_desbloqueio = greatest(0, creditos_desbloqueio - 25),
            buscas_restantes = greatest(0, buscas_restantes - 15)
        where id = v_user;
      update public.cobrancas set estornado_em = now(), status = v_pay ->> 'status'
        where asaas_payment_id = v_payment_id;
      v_resultado := 'pacote_estornado';
    elsif v_cob.tipo = 'pacote_sites' then
      -- Tira as 3 gerações do pacote (sem deixar negativo).
      update public.profiles
        set sites_extras = greatest(0, sites_extras - 3)
        where id = v_user;
      update public.cobrancas set estornado_em = now(), status = v_pay ->> 'status'
        where asaas_payment_id = v_payment_id;
      v_resultado := 'pacote_sites_estornado';
    else
      v_fim_ciclo := (
        (coalesce((v_pay ->> 'dueDate')::date, current_date) + interval '1 month')::date
      )::timestamp at time zone 'America/Sao_Paulo';
      select plano_valido_ate into v_valido_ate from public.profiles where id = v_user;

      if v_valido_ate is null or v_fim_ciclo >= v_valido_ate then
        select * into v_lim from public.limites_do_plano('gratis');
        update public.profiles
          set plano = 'gratis',
              plano_valido_ate = null,
              creditos_desbloqueio = least(creditos_desbloqueio, v_lim.desbloqueios),
              buscas_restantes = least(buscas_restantes, v_lim.buscas),
              sites_restantes = 0
          where id = v_user;
        v_resultado := 'mensalidade_estornada_plano_gratis';
      else
        v_resultado := 'mensalidade_antiga_estornada';
      end if;
      update public.cobrancas set estornado_em = now(), status = v_pay ->> 'status'
        where asaas_payment_id = v_payment_id;
    end if;

  -- Assinatura cancelada ----------------------------------------------------
  elsif v_evento in ('SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED') and v_subscription_id is not null then
    perform public.marcar_assinatura_cancelada(v_subscription_id);
    v_resultado := 'assinatura_cancelada';

  else
    v_resultado := 'ignorado';
  end if;

  update public.pagamentos_eventos set resultado = v_resultado where id = v_log_id;
  return v_resultado;
end;
$$;

revoke all on function public.processar_evento_asaas(jsonb) from public, anon, authenticated;
grant execute on function public.processar_evento_asaas(jsonb) to service_role;

notify pgrst, 'reload schema';
