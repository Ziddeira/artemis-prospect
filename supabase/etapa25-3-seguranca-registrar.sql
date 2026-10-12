-- Ártemis Prospect — Etapa 25, parte 3 de 3: função que registra o login
-- Rode DEPOIS da parte 2. Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema.

-- 4. Função que registra o login ---------------------------------------------
-- Chamada pelo servidor logo depois de cada login. Devolve true quando o
-- aparelho é novo para a conta (e, nesse caso, cria o aviso no sino).
-- O primeiro login registrado de cada conta não gera aviso: não há com
-- o que comparar.
create or replace function public.registrar_acesso(
  p_user_id uuid,
  p_metodo text,
  p_aparelho_id uuid,
  p_aparelho text,
  p_ip text,
  p_local text,
  p_navegador text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_historico boolean;
  v_conhecido boolean;
  v_aparelho text := coalesce(nullif(left(p_aparelho, 60), ''), 'Aparelho desconhecido');
  v_local text := nullif(left(p_local, 120), '');
  v_quando text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
begin
  if p_user_id is null then
    raise exception 'Usuário não informado.';
  end if;

  select exists (select 1 from acessos where user_id = p_user_id) into v_tem_historico;
  select exists (
    select 1 from acessos where user_id = p_user_id and aparelho_id = p_aparelho_id
  ) into v_conhecido;

  insert into acessos (user_id, metodo, aparelho_id, aparelho, ip, local, navegador)
    values (
      p_user_id,
      p_metodo,
      p_aparelho_id,
      v_aparelho,
      nullif(left(p_ip, 64), ''),
      v_local,
      nullif(left(p_navegador, 400), '')
    );

  -- Registros de acesso ficam 6 meses (Marco Civil da Internet, art. 15).
  delete from acessos where user_id = p_user_id and criado_em < now() - interval '6 months';

  if v_tem_historico and not v_conhecido then
    insert into notificacoes (user_id, tipo, titulo, texto, link)
      values (
        p_user_id,
        'seguranca',
        'Novo acesso à sua conta',
        format(
          'Sua conta foi acessada em um aparelho novo: %s%s, em %s. Se foi você, pode ignorar. '
            || 'Se não foi, troque a senha e use "Encerrar outras sessões" no Perfil.',
          v_aparelho,
          coalesce(' (' || v_local || ')', ''),
          v_quando
        ),
        '/painel/perfil'
      );
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.registrar_acesso(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_acesso(uuid, text, uuid, text, text, text, text) to service_role;


notify pgrst, 'reload schema';
