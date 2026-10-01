-- Ártemis Prospect — Etapa 22: negócios brasileiros no exterior
-- Rode isto DEPOIS das etapas anteriores (precisa da 11, que cria
-- eh_admin e registrar_auditoria), inteiro, de uma vez:
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   - tabela nova palavras_brasileiras: palavras do nome do negócio que
--     contam como sinal de "Provável negócio brasileiro" na aba
--     Internacional (Açaí, Padaria, Churrascaria, Carioca...);
--   - tabela nova regioes_brasileiras: atalhos de região com grande
--     comunidade brasileira, por país, que aparecem na busca;
--   - funções de administrador para incluir e tirar itens das duas
--     listas (Gestão > Negócio brasileiro), com auditoria.
--
-- Nada aqui mexe em planos, saldos ou cobrança. Sem este script, o site
-- usa as listas iniciais do código (lib/leads/brasileiro.ts e
-- lib/leads/paises.ts) e a Gestão avisa que falta rodá-lo.

-- 1. Tabela "palavras_brasileiras" -------------------------------------------
-- Uma palavra (ou expressão curta, como "Pão de Queijo") por linha. A
-- comparação com o nome do negócio ignora acentos e maiúsculas, então
-- "Acai" e "Açaí" são a mesma coisa para a busca.
create table if not exists public.palavras_brasileiras (
  palavra text primary key
    check (length(palavra) between 2 and 40 and palavra = btrim(palavra)),
  criado_em timestamptz not null default now()
);

-- Evita "Açaí" e "açaí" duplicados.
create unique index if not exists palavras_brasileiras_unica
  on public.palavras_brasileiras (lower(palavra));

alter table public.palavras_brasileiras enable row level security;

-- Todo usuário logado lê (a busca precisa da lista; não tem nada
-- pessoal). Escrever, só pelas funções de administrador abaixo.
grant select on public.palavras_brasileiras to authenticated;
revoke insert, update, delete on public.palavras_brasileiras from authenticated, anon;

drop policy if exists "Usuários logados leem as palavras brasileiras" on public.palavras_brasileiras;
create policy "Usuários logados leem as palavras brasileiras"
  on public.palavras_brasileiras
  for select
  to authenticated
  using (true);

-- Lista inicial (a mesma de lib/leads/brasileiro.ts). Só insere o que
-- ainda não existe. Se você apagar uma palavra pela Gestão e rodar este
-- script de novo, ela volta — nesse caso, apague de novo pela Gestão.
insert into public.palavras_brasileiras (palavra)
select v.palavra
from (values
  ('Brazil'), ('Brazilian'), ('Brasil'), ('Brasileiro'), ('Brasileira'),
  ('Brasileirinho'), ('Rio'), ('Carioca'), ('Bahia'), ('Baiano'), ('Baiana'),
  ('Minas'), ('Mineiro'), ('Mineira'), ('Mineirinho'), ('Paulista'),
  ('Paulistano'), ('Gaúcho'), ('Gaúcha'), ('Goiano'), ('Capixaba'),
  ('Nordestino'), ('Floripa'), ('Açaí'), ('Padaria'), ('Churrascaria'),
  ('Churrasco'), ('Salgado'), ('Salgados'), ('Salgadinho'), ('Pão de Queijo'),
  ('Coxinha'), ('Feijoada'), ('Brigadeiro'), ('Pastelaria'), ('Lanchonete'),
  ('Boteco'), ('Picanha'), ('Tapioca'), ('Guaraná'), ('Cantinho'),
  ('Sabor Brasileiro'), ('Verde Amarelo'), ('Saudade'), ('Samba'), ('Capoeira')
) as v (palavra)
where not exists (
  select 1 from public.palavras_brasileiras p where lower(p.palavra) = lower(v.palavra)
);

-- 2. Tabela "regioes_brasileiras" --------------------------------------------
-- Atalhos de região da aba Internacional, separados por país. O texto é
-- o que entra no campo de região da busca (ex.: "Pompano Beach FL").
create table if not exists public.regioes_brasileiras (
  pais text not null check (pais ~ '^[A-Z]{2}$'),
  regiao text not null
    check (length(regiao) between 2 and 80 and regiao = btrim(regiao) and position(',' in regiao) = 0),
  criado_em timestamptz not null default now(),
  primary key (pais, regiao)
);

create unique index if not exists regioes_brasileiras_unica
  on public.regioes_brasileiras (pais, lower(regiao));

alter table public.regioes_brasileiras enable row level security;

grant select on public.regioes_brasileiras to authenticated;
revoke insert, update, delete on public.regioes_brasileiras from authenticated, anon;

drop policy if exists "Usuários logados leem as regiões brasileiras" on public.regioes_brasileiras;
create policy "Usuários logados leem as regiões brasileiras"
  on public.regioes_brasileiras
  for select
  to authenticated
  using (true);

-- Lista inicial (a mesma de lib/leads/paises.ts). A ordem de inclusão é
-- a ordem em que os atalhos aparecem.
insert into public.regioes_brasileiras (pais, regiao, criado_em)
select v.pais, v.regiao, now() + (v.ordem * interval '1 millisecond')
from (values
  ('US', 'Pompano Beach FL', 1),
  ('US', 'Deerfield Beach FL', 2),
  ('US', 'Boca Raton FL', 3),
  ('US', 'Fort Lauderdale FL', 4),
  ('US', 'Orlando FL', 5),
  ('US', 'Kissimmee FL', 6),
  ('US', 'Framingham MA', 7),
  ('US', 'Marlborough MA', 8),
  ('US', 'Everett MA', 9),
  ('US', 'Newark NJ', 10),
  ('US', 'Long Branch NJ', 11),
  ('US', 'Danbury CT', 12),
  ('US', 'Astoria NY', 13),
  ('US', 'Marietta GA', 14),
  ('CA', 'Toronto ON', 1),
  ('CA', 'Mississauga ON', 2),
  ('CA', 'Brampton ON', 3),
  ('CA', 'Vancouver BC', 4),
  ('CA', 'Montreal QC', 5),
  ('CA', 'Calgary AB', 6)
) as v (pais, regiao, ordem)
where not exists (
  select 1 from public.regioes_brasileiras r
  where r.pais = v.pais and lower(r.regiao) = lower(v.regiao)
);

-- 3. Palavras: incluir e tirar (só administrador) ----------------------------
-- Cada mudança fica na auditoria da Gestão.
create or replace function public.admin_adicionar_palavra_brasileira(p_palavra text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palavra text := regexp_replace(btrim(coalesce(p_palavra, '')), '\s+', ' ', 'g');
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if length(v_palavra) < 2 or length(v_palavra) > 40 then
    raise exception 'A palavra precisa ter de 2 a 40 caracteres.';
  end if;
  if exists (select 1 from public.palavras_brasileiras where lower(palavra) = lower(v_palavra)) then
    return;
  end if;

  insert into public.palavras_brasileiras (palavra) values (v_palavra);

  perform public.registrar_auditoria(
    'palavra_brasileira_incluida',
    null,
    null,
    jsonb_build_object('palavra', v_palavra),
    null
  );
end;
$$;

revoke all on function public.admin_adicionar_palavra_brasileira(text) from public, anon;
grant execute on function public.admin_adicionar_palavra_brasileira(text) to authenticated;

create or replace function public.admin_remover_palavra_brasileira(p_palavra text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palavra text := btrim(coalesce(p_palavra, ''));
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  delete from public.palavras_brasileiras
    where lower(palavra) = lower(v_palavra);

  if found then
    perform public.registrar_auditoria(
      'palavra_brasileira_removida',
      null,
      jsonb_build_object('palavra', v_palavra),
      null,
      null
    );
  end if;
end;
$$;

revoke all on function public.admin_remover_palavra_brasileira(text) from public, anon;
grant execute on function public.admin_remover_palavra_brasileira(text) to authenticated;

-- 4. Regiões: incluir e tirar (só administrador) -----------------------------
create or replace function public.admin_adicionar_regiao_brasileira(p_pais text, p_regiao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_regiao text := regexp_replace(btrim(coalesce(p_regiao, '')), '\s+', ' ', 'g');
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;
  if v_pais !~ '^[A-Z]{2}$' then
    raise exception 'País inválido.';
  end if;
  if length(v_regiao) < 2 or length(v_regiao) > 80 then
    raise exception 'A região precisa ter de 2 a 80 caracteres.';
  end if;
  if position(',' in v_regiao) > 0 then
    raise exception 'Uma região por vez, sem vírgula: ex.: Pompano Beach FL';
  end if;
  if exists (
    select 1 from public.regioes_brasileiras
    where pais = v_pais and lower(regiao) = lower(v_regiao)
  ) then
    return;
  end if;

  insert into public.regioes_brasileiras (pais, regiao) values (v_pais, v_regiao);

  perform public.registrar_auditoria(
    'regiao_brasileira_incluida',
    null,
    null,
    jsonb_build_object('pais', v_pais, 'regiao', v_regiao),
    null
  );
end;
$$;

revoke all on function public.admin_adicionar_regiao_brasileira(text, text) from public, anon;
grant execute on function public.admin_adicionar_regiao_brasileira(text, text) to authenticated;

create or replace function public.admin_remover_regiao_brasileira(p_pais text, p_regiao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_regiao text := btrim(coalesce(p_regiao, ''));
begin
  if not public.eh_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  delete from public.regioes_brasileiras
    where pais = v_pais and lower(regiao) = lower(v_regiao);

  if found then
    perform public.registrar_auditoria(
      'regiao_brasileira_removida',
      null,
      jsonb_build_object('pais', v_pais, 'regiao', v_regiao),
      null,
      null
    );
  end if;
end;
$$;

revoke all on function public.admin_remover_regiao_brasileira(text, text) from public, anon;
grant execute on function public.admin_remover_regiao_brasileira(text, text) to authenticated;

notify pgrst, 'reload schema';
