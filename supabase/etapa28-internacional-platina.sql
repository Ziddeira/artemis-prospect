-- Ártemis Prospect — Etapa 28: aba Internacional só no plano Platina
-- Rode isto DEPOIS de todos os scripts anteriores (até a etapa 27),
-- inteiro, de uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   * a aba Internacional (busca em outros países) deixa de fazer parte
--     do plano Pro e passa a ser só do Platina;
--   * o modo Hospedagem continua nos planos Pro e Platina;
--   * nada é apagado: os leads internacionais que alguém do Pro já
--     desbloqueou continuam em "Meus leads". Só as buscas novas na aba
--     Internacional passam a exigir o Platina.
-- A mesma regra está em lib/planos.ts (só para mostrar na tela).
-- Se mudar um, mude o outro.

-- 1. Planos com a aba Internacional -----------------------------------------
create or replace function public.plano_tem_internacional(p_plano text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_plano = 'platina', false);
$$;

-- 2. iniciar_busca: Internacional só no Platina -----------------------------
-- A mesma função da etapa 23; só muda a conferência da aba Internacional.
create or replace function public.iniciar_busca(
  p_termos text[],
  p_areas text[],
  p_modo text,
  p_pais text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_buscas_restantes integer;
  v_total integer;
  v_recentes integer;
  v_termo text;
  v_area text;
  v_pais text;
begin
  if p_modo not in ('negocios', 'hospedagem', 'internacional') then
    raise exception 'Modo de busca inválido.';
  end if;

  if p_modo = 'internacional' then
    v_pais := upper(btrim(coalesce(p_pais, '')));
    if v_pais !~ '^[A-Z]{2}$' or v_pais = 'BR' then
      raise exception 'Escolha o país da busca.';
    end if;
  else
    v_pais := 'BR';
  end if;

  if p_termos is null or array_length(p_termos, 1) is null then
    raise exception 'Digite ao menos um nicho.';
  end if;

  if p_areas is null or array_length(p_areas, 1) is null then
    raise exception 'Digite ao menos uma região.';
  end if;

  v_total := array_length(p_termos, 1) * array_length(p_areas, 1);

  perform public.aplicar_vencimento_plano(auth.uid());

  select plano, buscas_restantes
    into v_plano, v_buscas_restantes
    from public.profiles
    where id = auth.uid()
    for update;

  if v_plano is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if p_modo = 'hospedagem' and not public.plano_tem_recursos_pro(v_plano) then
    raise exception 'O modo Hospedagem é dos planos Pro e Platina.';
  end if;

  if p_modo = 'internacional' and not public.plano_tem_internacional(v_plano) then
    raise exception 'A aba Internacional é do plano Platina.';
  end if;

  if v_buscas_restantes < v_total then
    raise exception
      'Saldo de buscas insuficiente: restam % e essa busca gastaria %.',
      v_buscas_restantes, v_total;
  end if;

  select count(*)
    into v_recentes
    from public.buscas
    where user_id = auth.uid()
      and criado_em > now() - interval '1 minute';

  if v_recentes + v_total > 10 then
    raise exception
      'Limite de 10 buscas por minuto atingido (% no último minuto, essa busca pediria mais %). Aguarde um pouco e tente de novo.',
      v_recentes, v_total;
  end if;

  update public.profiles
    set buscas_restantes = buscas_restantes - v_total
    where id = auth.uid();

  foreach v_termo in array p_termos loop
    foreach v_area in array p_areas loop
      insert into public.buscas (user_id, termo, area, modo, pais)
      values (auth.uid(), v_termo, v_area, p_modo, v_pais);
    end loop;
  end loop;

  return v_buscas_restantes - v_total;
end;
$$;

revoke all on function public.iniciar_busca(text[], text[], text, text) from public, anon;
grant execute on function public.iniciar_busca(text[], text[], text, text) to authenticated;

notify pgrst, 'reload schema';
