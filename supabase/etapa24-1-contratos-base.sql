-- Ártemis Prospect — Etapa 24, parte 1 de 2: contratos (tabela, RLS e Storage)
-- Rode inteiro, de uma vez: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- O que esta parte cria:
--   * tabela "contratos": um contrato de criação de site por linha, com os
--     dados do questionário, a situação (rascunho, enviado, assinado) e o
--     registro das assinaturas (data e hora, IP, nome, e-mail, navegador);
--   * coluna profiles.assinatura_path (assinatura salva no perfil) e
--     profiles.contratos_seq (numeração dos contratos de cada usuário);
--   * bucket PRIVADO "contratos" no Storage, para os PDFs e as imagens das
--     assinaturas;
--   * aviso no sino (tipo "contrato") quando o cliente assina.
--
-- LGPD: o contrato guarda dados pessoais de terceiros (CPF, endereço,
-- IP de quem assinou). Por isso:
--   * cada usuário só LÊ os próprios contratos (RLS), sem exceção para
--     administrador;
--   * ninguém escreve direto na tabela pelo navegador: tudo passa pelas
--     funções da parte 2, que conferem o dono;
--   * os arquivos ficam num bucket privado; o usuário só lê e apaga a
--     própria pasta. Quem grava os arquivos é o servidor (service_role),
--     para ninguém trocar o PDF depois de enviado;
--   * o cliente que assina (sem conta) nunca acessa o banco: o servidor
--     confere o link e mostra só aquele contrato.

-- 1. Colunas novas em "profiles" ---------------------------------------------
-- assinatura_path: imagem PNG da assinatura salva no perfil
--   (ex.: "<id do usuário>/assinatura-abc123.png", no bucket "contratos").
-- contratos_seq: contador para numerar os contratos (2026/0001, 2026/0002...).
alter table public.profiles
  add column if not exists assinatura_path text,
  add column if not exists contratos_seq integer not null default 0;

-- Mesmo cinto de segurança das etapas anteriores: o navegador não escreve
-- em "profiles" (só pelas funções).
revoke insert, update, delete on public.profiles from authenticated, anon;

-- 2. Tabela "contratos" ------------------------------------------------------
--   status: rascunho (editável) | enviado (PDF congelado, link público
--     ativo, esperando o cliente) | assinado (as duas partes assinaram).
--   modo: padrao (modelo pronto) | questionario (respondido passo a passo).
--   dados: respostas do questionário (partes, escopo, valor, foro...).
--   conteudo: o texto do contrato congelado no envio (o que o cliente lê).
--   pdf_original_*: o PDF enviado para assinatura e o hash SHA-256 dele.
--   campo_cliente: onde fica o campo de assinatura do cliente no PDF.
--   token: o código do link público (só existe depois do envio).
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  numero text not null,
  titulo text not null check (char_length(titulo) between 1 and 160),
  modo text not null default 'questionario' check (modo in ('padrao', 'questionario')),
  dados jsonb not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'assinado')),
  conteudo jsonb,
  pdf_original_path text,
  pdf_original_hash text check (pdf_original_hash is null or pdf_original_hash ~ '^[0-9a-f]{64}$'),
  campo_cliente jsonb,
  token text unique,
  link_expira_em timestamptz,
  avisos_aceitos_em timestamptz,
  enviado_em timestamptz,
  prestador_nome text,
  prestador_email text,
  prestador_ip text,
  prestador_navegador text,
  prestador_assinou_em timestamptz,
  cliente_nome text,
  cliente_email text,
  cliente_ip text,
  cliente_navegador text,
  cliente_assinou_em timestamptz,
  cliente_assinatura_path text,
  pdf_assinado_path text,
  pdf_assinado_hash text check (pdf_assinado_hash is null or pdf_assinado_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contratos_user_idx on public.contratos (user_id, criado_em desc);
create index if not exists contratos_lead_idx on public.contratos (user_id, place_id);

alter table public.contratos enable row level security;

grant select on public.contratos to authenticated;
revoke insert, update, delete on public.contratos from authenticated, anon;
revoke all on public.contratos from anon;

drop policy if exists "Usuários veem os próprios contratos" on public.contratos;
create policy "Usuários veem os próprios contratos"
  on public.contratos
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Bucket "contratos" no Storage (PRIVADO) ---------------------------------
-- Estrutura das pastas:
--   <id do usuário>/assinatura-<código>.png        assinatura salva no perfil
--   <id do usuário>/<id do contrato>/original-<código>.pdf   PDF enviado
--   <id do usuário>/<id do contrato>/assinado-<código>.pdf   PDF assinado
--   <id do usuário>/<id do contrato>/cliente-<código>.png    assinatura do cliente
-- Limite de 5 MB por arquivo, só PDF e PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratos',
  'contratos',
  false,
  5242880,
  array['application/pdf', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Regras de acesso (RLS) dos arquivos -------------------------------------
-- O dono lê e apaga só a própria pasta. Não há regra de envio (insert) nem
-- de troca (update) para o usuário: só o servidor (service_role) grava, e
-- assim ninguém troca o PDF depois de calcular o hash.
drop policy if exists "Contratos: dono vê os próprios arquivos" on storage.objects;
create policy "Contratos: dono vê os próprios arquivos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contratos: dono apaga os próprios arquivos" on storage.objects;
create policy "Contratos: dono apaga os próprios arquivos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Aviso no sino quando o cliente assina (tipo "contrato") ------------------
-- O aviso leva só o número do contrato (sem nome nem CPF do cliente) e é
-- apagado junto quando o contrato é apagado.
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes drop constraint if exists notificacoes_tipo_valido;
alter table public.notificacoes
  add constraint notificacoes_tipo_valido check (
    tipo in ('renovacao', 'saldo', 'novidade', 'incentivo', 'retorno', 'suporte', 'comunidade', 'contrato')
  );

notify pgrst, 'reload schema';
