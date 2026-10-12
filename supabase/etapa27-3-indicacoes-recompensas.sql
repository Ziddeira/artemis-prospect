-- Ártemis Prospect — Etapa 27, parte 3 de 3: recompensas da indicação
-- Rode DEPOIS da parte 2 (etapa27-2-indicacoes-base.sql), inteiro, de
-- uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Regras (todas aqui no banco, nada depende da tela):
--   * quando a pessoa indicada CONFIRMA O E-MAIL, quem indicou ganha
--     10 desbloqueios;
--   * quando a pessoa indicada paga um plano pela PRIMEIRA vez, quem
--     indicou ganha mais 30 desbloqueios. Nada sai antes de o e-mail da
--     pessoa indicada estar confirmado;
--   * no máximo 20 indicações recompensadas por mês (mês de Brasília) para
--     cada pessoa. Passou disso, a indicação fica registrada, mas aquela
--     recompensa não é paga (nem depois);
--   * a recompensa é sempre em DESBLOQUEIOS, nunca em buscas. Entra no
--     mesmo saldo extra do prêmio do rank (profiles.creditos_premio): não
--     vence na renovação e é gasto depois dos créditos do plano;
--   * se o 1º pagamento for estornado ou contestado, os 30 desbloqueios
--     saem do saldo de quem indicou (o que ainda houver; nunca fica
--     negativo).
-- Quem indicou recebe um aviso no sino (tipo "indicacao") a cada
-- recompensa, e um aviso por mês quando bate o limite.

-- 1. Aviso no sino (tipo "indicacao") ---------------------------------------------
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade',
             'contrato', 'seguranca', 'relatorio', 'indicacao')
  );

-- 2. Cabe mais uma recompensa este mês? (uso interno) --------------------------------
-- Conta as indicações que já renderam alguma recompensa neste mês. Uma
-- indicação que já rendeu este mês não ocupa vaga nova.
create or replace function public.indicacao_cabe_no_mes(p_indicador uuid, p_indicacao bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ini timestamptz := public.inicio_do_mes(public.mes_brasilia());
  v_ja_conta boolean;
  v_total integer;
begin
  select exists (
    select 1 from public.indicacoes i
     where i.id = p_indicacao
       and ((i.bonus_cadastro > 0 and i.bonus_cadastro_em >= v_ini)
         or (i.bonus_plano > 0 and i.bonus_plano_em >= v_ini))
  ) into v_ja_conta;
  if v_ja_conta then
    return true;
  end if;

  select count(*) into v_total
    from public.indicacoes i
    where i.indicador_id = p_indicador
      and ((i.bonus_cadastro > 0 and i.bonus_cadastro_em >= v_ini)
        or (i.bonus_plano > 0 and i.bonus_plano_em >= v_ini));
  return v_total < public.indicacao_limite_mes();
end;
$$;

revoke all on function public.indicacao_cabe_no_mes(uuid, bigint) from public, anon, authenticated;

-- 3. Aviso para quem indicou (uso interno) -------------------------------------------
create or replace function public.avisar_indicacao(p_indicador uuid, p_tipo text, p_creditos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text;
begin
  if p_tipo = 'limite' then
    -- Uma vez por mês, no máximo.
    v_chave := 'indicacao-limite:' || to_char(public.mes_brasilia(), 'YYYY-MM');
    insert into public.notificacoes_enviadas (user_id, chave) values (p_indicador, v_chave)
      on conflict do nothing;
    if not found then
      return;
    end if;
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
      values (
        p_indicador, 'indicacao',
        'Limite de indicações do mês atingido',
        format(
          'Você chegou a %s indicações recompensadas este mês. Novas indicações continuam valendo para o cadastro, mas só voltam a render desbloqueios no mês que vem.',
          public.indicacao_limite_mes()
        ),
        '/painel/perfil'
      );
  elsif p_tipo = 'cadastro' then
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
      values (
        p_indicador, 'indicacao',
        format('Sua indicação rendeu +%s desbloqueios', p_creditos),
        format(
          'Uma pessoa que você indicou confirmou o e-mail. Os %s desbloqueios já estão no seu saldo e não vencem. Se ela assinar um plano, você ganha mais %s.',
          p_creditos, public.indicacao_bonus_plano()
        ),
        '/painel/perfil'
      );
  elsif p_tipo = 'plano' then
    insert into public.notificacoes (user_id, tipo, titulo, texto, link)
      values (
        p_indicador, 'indicacao',
        format('Sua indicação assinou: +%s desbloqueios', p_creditos),
        format(
          'Uma pessoa que você indicou assinou um plano pago. Os %s desbloqueios já estão no seu saldo e não vencem.',
          p_creditos
        ),
        '/painel/perfil'
      );
  end if;
end;
$$;

revoke all on function public.avisar_indicacao(uuid, text, integer) from public, anon, authenticated;

-- 4. Função "processar_indicacao" (uso interno) -----------------------------------------
-- Olha a situação de UMA pessoa indicada e paga o que estiver faltando.
-- Pode ser chamada quantas vezes for: cada recompensa é decidida uma vez
-- só (a linha da indicação e o perfil de quem indicou ficam travados até
-- o fim da transação, então duas chamadas ao mesmo tempo não pagam duas
-- vezes nem passam do limite do mês).
create or replace function public.processar_indicacao(p_indicado uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind public.indicacoes%rowtype;
  v_confirmado timestamptz;
  v_valor integer;
begin
  select * into v_ind from public.indicacoes where indicado_id = p_indicado for update;
  if v_ind.id is null then
    return;
  end if;

  -- Nada sai antes da confirmação do e-mail da pessoa indicada.
  select email_confirmed_at into v_confirmado from auth.users where id = p_indicado;
  if v_confirmado is null then
    return;
  end if;

  if v_ind.email_confirmado_em is null then
    update public.indicacoes set email_confirmado_em = v_confirmado where id = v_ind.id;
  end if;

  perform 1 from public.profiles where id = v_ind.indicador_id for update;
  if not found then
    return;
  end if;

  -- a) E-mail confirmado: +10 ------------------------------------------------
  if v_ind.bonus_cadastro_em is null then
    if public.indicacao_cabe_no_mes(v_ind.indicador_id, v_ind.id) then
      v_valor := public.indicacao_bonus_cadastro();
      update public.profiles set creditos_premio = creditos_premio + v_valor
        where id = v_ind.indicador_id;
      update public.indicacoes
        set bonus_cadastro = v_valor, bonus_cadastro_em = now(), bonus_cadastro_motivo = 'pago'
        where id = v_ind.id;
      perform public.avisar_indicacao(v_ind.indicador_id, 'cadastro', v_valor);
    else
      update public.indicacoes
        set bonus_cadastro = 0, bonus_cadastro_em = now(), bonus_cadastro_motivo = 'limite_mes'
        where id = v_ind.id;
      perform public.avisar_indicacao(v_ind.indicador_id, 'limite', 0);
    end if;
  end if;

  -- b) Primeiro plano pago: +30 ---------------------------------------------
  if v_ind.plano_pago_em is not null and v_ind.bonus_plano_em is null then
    if public.indicacao_cabe_no_mes(v_ind.indicador_id, v_ind.id) then
      v_valor := public.indicacao_bonus_plano();
      update public.profiles set creditos_premio = creditos_premio + v_valor
        where id = v_ind.indicador_id;
      update public.indicacoes
        set bonus_plano = v_valor, bonus_plano_em = now(), bonus_plano_motivo = 'pago'
        where id = v_ind.id;
      perform public.avisar_indicacao(v_ind.indicador_id, 'plano', v_valor);
    else
      update public.indicacoes
        set bonus_plano = 0, bonus_plano_em = now(), bonus_plano_motivo = 'limite_mes'
        where id = v_ind.id;
      perform public.avisar_indicacao(v_ind.indicador_id, 'limite', 0);
    end if;
  end if;
end;
$$;

revoke all on function public.processar_indicacao(uuid) from public, anon, authenticated;

-- 5. Gatilho: confirmação do e-mail ------------------------------------------------------
-- Dispara quando o Supabase marca o e-mail como confirmado. Se algo der
-- errado aqui, a confirmação do e-mail NÃO é bloqueada: o erro vai para
-- Gestão > Erros e a pessoa entra normalmente.
create or replace function public.indicacao_email_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.processar_indicacao(new.id);
  exception when others then
    begin
      insert into public.erros_servidor (origem, mensagem, user_id)
        values ('indicacao', left('processar_indicacao falhou na confirmação do e-mail: ' || sqlerrm, 1900), new.id);
    exception when others then
      raise warning 'indicacao_email_confirmado: %', sqlerrm;
    end;
  end;
  return new;
end;
$$;

revoke all on function public.indicacao_email_confirmado() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmado_indicacao on auth.users;
create trigger on_auth_user_confirmado_indicacao
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.indicacao_email_confirmado();

-- 6. Gatilho: pagamento e estorno da mensalidade ---------------------------------------
-- Olha a tabela "cobrancas" (etapa 3), que o webhook do Asaas atualiza:
--   * mensalidade creditada (creditado_em preenchido, valor > 0) de quem
--     foi indicado e ainda não tinha pago → marca o 1º plano pago e paga
--     os 30 a quem indicou;
--   * essa MESMA cobrança estornada → tira os desbloqueios de volta.
-- Pacotes avulsos não contam. Como no gatilho acima, um erro aqui nunca
-- derruba o webhook do pagamento.
create or replace function public.indicacao_cobranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind public.indicacoes%rowtype;
  v_tirar integer;
begin
  begin
    if new.tipo = 'assinatura'
      and new.creditado_em is not null
      and new.estornado_em is null
      and coalesce(new.valor, 0) > 0
      and (tg_op = 'INSERT' or old.creditado_em is null) then
      update public.indicacoes
        set plano_pago_em = now(), plano_pago_cobranca = new.asaas_payment_id
        where indicado_id = new.user_id and plano_pago_em is null;
      if found then
        perform public.processar_indicacao(new.user_id);
      end if;
    end if;

    if tg_op = 'UPDATE'
      and new.estornado_em is not null
      and old.estornado_em is null
      and new.creditado_em is not null then
      select * into v_ind from public.indicacoes
        where plano_pago_cobranca = new.asaas_payment_id
          and bonus_plano > 0
          and bonus_plano_motivo = 'pago'
        for update;
      if v_ind.id is not null then
        perform 1 from public.profiles where id = v_ind.indicador_id for update;
        select least(creditos_premio, v_ind.bonus_plano) into v_tirar
          from public.profiles where id = v_ind.indicador_id;
        v_tirar := coalesce(v_tirar, 0);
        update public.profiles set creditos_premio = creditos_premio - v_tirar
          where id = v_ind.indicador_id;
        -- Fica registrado o que a pessoa ainda ficou (se já tinha gastado).
        update public.indicacoes
          set bonus_plano = bonus_plano - v_tirar, bonus_plano_motivo = 'estornado'
          where id = v_ind.id;
      end if;
    end if;
  exception when others then
    begin
      insert into public.erros_servidor (origem, mensagem, detalhe, user_id)
        values ('indicacao', left('indicacao_cobranca falhou: ' || sqlerrm, 1900),
                jsonb_build_object('cobranca', new.asaas_payment_id), new.user_id);
    exception when others then
      raise warning 'indicacao_cobranca: %', sqlerrm;
    end;
  end;
  return new;
end;
$$;

revoke all on function public.indicacao_cobranca() from public, anon, authenticated;

drop trigger if exists cobrancas_indicacao on public.cobrancas;
create trigger cobrancas_indicacao
  after insert or update of creditado_em, estornado_em on public.cobrancas
  for each row execute function public.indicacao_cobranca();

notify pgrst, 'reload schema';

-- Para conferir as indicações (rode SEPARADO, quando quiser):
--
--   select i.criado_em, a.email as indicou, b.email as indicado,
--          i.email_confirmado_em, i.bonus_cadastro, i.bonus_cadastro_motivo,
--          i.plano_pago_em, i.bonus_plano, i.bonus_plano_motivo
--     from public.indicacoes i
--     left join auth.users a on a.id = i.indicador_id
--     left join auth.users b on b.id = i.indicado_id
--    order by i.criado_em desc;
