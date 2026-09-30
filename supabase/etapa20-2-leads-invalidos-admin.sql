-- Ártemis Prospect — Etapa 20, parte 2 de 2: painel dos leads inválidos
-- Rode DEPOIS da parte 1 (etapa20-1-leads-invalidos.sql), inteiro, de uma
-- vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Alimenta a aba Gestão > Leads inválidos. Só lê; recusa quem não é
-- administrador (eh_admin(), etapa 11).

create or replace function public.admin_leads_invalidos(p_limite integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mes date := public.mes_brasilia();
  v_inicio timestamptz := public.inicio_do_mes(public.mes_brasilia());
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 500));
  v_resultado jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select jsonb_build_object(
    'mes', v_mes,
    'marcados_mes', (select count(*) from public.leads_invalidos where criado_em >= v_inicio),
    'devolvidos_mes', (select count(*) from public.leads_invalidos
                        where criado_em >= v_inicio and credito_devolvido),
    'sem_devolucao_mes', coalesce((
      select jsonb_object_agg(sem_devolucao, qtd)
        from (select sem_devolucao, count(*) as qtd from public.leads_invalidos
               where criado_em >= v_inicio and not credito_devolvido
               group by sem_devolucao) t
    ), '{}'::jsonb),
    'por_motivo_mes', coalesce((
      select jsonb_object_agg(motivo, qtd)
        from (select motivo, count(*) as qtd from public.leads_invalidos
               where criado_em >= v_inicio group by motivo) t
    ), '{}'::jsonb),
    'usuarios_mes', (select count(distinct user_id) from public.leads_invalidos where criado_em >= v_inicio),
    'desbloqueios_mes', (select count(*) from public.leads_desbloqueados where desbloqueado_em >= v_inicio),
    'marcados_total', (select count(*) from public.leads_invalidos),
    'devolvidos_total', (select count(*) from public.leads_invalidos where credito_devolvido),
    'quem_mais_marca', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.marcados desc, q.devolvidos desc)
        from (
          select i.user_id, p.email, p.apelido, p.plano,
                 count(*) as marcados,
                 count(*) filter (where i.credito_devolvido) as devolvidos
            from public.leads_invalidos i
            left join public.profiles p on p.id = i.user_id
            where i.criado_em >= v_inicio
            group by i.user_id, p.email, p.apelido, p.plano
            order by count(*) desc
            limit 10
        ) q
    ), '[]'::jsonb),
    'recentes', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.criado_em desc)
        from (
          select i.id, i.criado_em, i.place_id, i.motivo, i.credito_devolvido,
                 i.sem_devolucao, i.desbloqueado_em, p.email, p.apelido
            from public.leads_invalidos i
            left join public.profiles p on p.id = i.user_id
            order by i.criado_em desc
            limit v_limite
        ) r
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.admin_leads_invalidos(integer) from public, anon;
grant execute on function public.admin_leads_invalidos(integer) to authenticated;

-- Avisa a API do Supabase (PostgREST) para reler tabelas e funções.
notify pgrst, 'reload schema';
