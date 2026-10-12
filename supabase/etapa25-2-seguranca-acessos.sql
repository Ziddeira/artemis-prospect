-- Ártemis Prospect — Etapa 25, parte 2 de 3: registro de acessos
-- Rode DEPOIS da parte 1. Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema.
-- Cada login fica guardado 6 meses (Marco Civil da Internet). O usuário só
-- LÊ os próprios acessos e nunca escreve neles.

-- 2. Registro de acessos ----------------------------------------------------
-- Um login por linha.
--   metodo: senha | google | link (link do e-mail) | cadastro
--   aparelho_id: código aleatório guardado num cookie do navegador
--   aparelho: descrição curta, ex.: "Chrome no Windows"
--   local: cidade, estado e país aproximados (pelo IP)
--   navegador: o "user agent" completo, para conferência
create table if not exists public.acessos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  metodo text not null check (metodo in ('senha', 'google', 'link', 'cadastro')),
  aparelho_id uuid,
  aparelho text check (aparelho is null or char_length(aparelho) <= 60),
  ip text check (ip is null or char_length(ip) <= 64),
  local text check (local is null or char_length(local) <= 120),
  navegador text check (navegador is null or char_length(navegador) <= 400)
);

create index if not exists acessos_user_criado_em_idx
  on public.acessos (user_id, criado_em desc);
create index if not exists acessos_user_aparelho_idx
  on public.acessos (user_id, aparelho_id);

alter table public.acessos enable row level security;

grant usage on schema public to authenticated;
grant select on public.acessos to authenticated;
revoke insert, update, delete on public.acessos from authenticated, anon;

drop policy if exists "Usuários veem os próprios acessos" on public.acessos;
create policy "Usuários veem os próprios acessos"
  on public.acessos
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Aviso no sino (tipo "seguranca") ----------------------------------------
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade', 'contrato', 'seguranca')
  );

notify pgrst, 'reload schema';
