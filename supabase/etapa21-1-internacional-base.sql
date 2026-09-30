-- Ártemis Prospect — Etapa 21, parte 1: aba Internacional (tabelas)
-- Rode isto DEPOIS das etapas anteriores, inteiro, de uma vez:
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Depois rode a parte 2 (etapa21-2-internacional-funcoes.sql).
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que muda:
--   - buscas e ultima_busca aceitam o modo "internacional" e guardam o
--     país (código de 2 letras, ex.: 'US', 'CA'; 'BR' nas outras abas);
--   - tabela nova dominios_terceiro: sites de terceiros de cada país
--     (Yelp, Square, Vagaro...), editável em Gestão > Sites de terceiros;
--   - coluna nova profiles.modelos_mensagem: os modelos de mensagem em
--     inglês que cada usuário edita no Perfil.
--
-- Nada aqui mexe em planos, saldos ou cobrança: 1 busca por termo ×
-- região e 1 crédito por desbloqueio, igual às outras abas.
--
-- Para acrescentar outro país depois não precisa de SQL novo: o banco só
-- confere se o código tem 2 letras maiúsculas; a lista de países fica no
-- código (lib/leads/paises.ts).

-- 1. buscas: modo "internacional" e país --------------------------------------
alter table public.buscas
  add column if not exists pais text not null default 'BR';

-- Troca a regra do modo (criada junto com a tabela, na etapa 2) por uma
-- que aceita "internacional". O nome automático da regra pode variar, por
-- isso ela é achada pelo conteúdo.
do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
    where conrelid = 'public.buscas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%modo%'
  loop
    execute format('alter table public.buscas drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table public.buscas
  add constraint buscas_modo_valido
  check (modo in ('negocios', 'hospedagem', 'internacional'));

alter table public.buscas
  drop constraint if exists buscas_pais_valido;
alter table public.buscas
  add constraint buscas_pais_valido
  check (pais ~ '^[A-Z]{2}$');

-- 2. ultima_busca: modo "internacional" e país -----------------------------
-- pais: nulo nas abas Negócios e Hospedagem.
alter table public.ultima_busca
  add column if not exists pais text;

do $$
declare
  v_nome text;
begin
  for v_nome in
    select conname from pg_constraint
    where conrelid = 'public.ultima_busca'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%modo%'
  loop
    execute format('alter table public.ultima_busca drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table public.ultima_busca
  add constraint ultima_busca_modo_valido
  check (modo in ('negocios', 'hospedagem', 'internacional'));

alter table public.ultima_busca
  drop constraint if exists ultima_busca_pais_valido;
alter table public.ultima_busca
  add constraint ultima_busca_pais_valido
  check (pais is null or pais ~ '^[A-Z]{2}$');

-- 3. Tabela "dominios_terceiro" --------------------------------------------
-- Um domínio por linha, separado por país. Um lead cujo site é de um
-- desses domínios (ou subdomínio dele) conta como "Só app ou rede
-- social", não como site próprio. A lista fixa do código
-- (lib/leads/classificacao.ts) continua valendo em todos os países; esta
-- é a lista extra de cada um.
create table if not exists public.dominios_terceiro (
  pais text not null check (pais ~ '^[A-Z]{2}$'),
  dominio text not null check (dominio ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' and length(dominio) <= 253),
  criado_em timestamptz not null default now(),
  primary key (pais, dominio)
);

alter table public.dominios_terceiro enable row level security;

-- Todo usuário logado lê (a busca precisa da lista; não tem nada
-- pessoal). Escrever, só pelas funções de administrador da parte 2.
grant select on public.dominios_terceiro to authenticated;
revoke insert, update, delete on public.dominios_terceiro from authenticated, anon;

drop policy if exists "Usuários logados leem os sites de terceiros" on public.dominios_terceiro;
create policy "Usuários logados leem os sites de terceiros"
  on public.dominios_terceiro
  for select
  to authenticated
  using (true);

-- Lista inicial de EUA e Canadá (a mesma de lib/leads/paises.ts). Não
-- duplica nem traz de volta nada: só insere o que ainda não existe. Se
-- você apagar um domínio pela Gestão e rodar este script de novo, ele
-- volta — nesse caso, apague de novo pela Gestão.
insert into public.dominios_terceiro (pais, dominio)
select p.pais, d.dominio
from (values ('US'), ('CA')) as p (pais)
cross join (values
  ('yelp.com'),
  ('squareup.com'),
  ('fresha.com'),
  ('booksy.com'),
  ('vagaro.com'),
  ('thumbtack.com'),
  ('doordash.com'),
  ('ubereats.com'),
  ('opentable.com'),
  ('wixsite.com'),
  ('godaddysites.com'),
  ('business.site'),
  ('facebook.com'),
  ('instagram.com')
) as d (dominio)
on conflict (pais, dominio) do nothing;

-- 4. profiles.modelos_mensagem ----------------------------------------------
-- Modelos de mensagem que o usuário editou, um grupo por idioma:
--   {"en": {"emailAssunto": "...", "emailCorpo": "...", "curta": "..."}}
-- Nulo (ou idioma ausente) = usa os modelos padrão do código.
alter table public.profiles
  add column if not exists modelos_mensagem jsonb;

-- O mesmo cinto de segurança das etapas anteriores: o navegador só lê a
-- própria linha e não escreve nada direto em "profiles".
revoke insert, update, delete on public.profiles from authenticated, anon;

notify pgrst, 'reload schema';
