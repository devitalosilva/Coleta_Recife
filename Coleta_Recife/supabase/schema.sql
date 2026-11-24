-- =====================================================================
-- COLETA RECIFE — Banco de Dados Completo (Supabase / PostgreSQL)
--
-- Como usar: Painel do Supabase > SQL Editor > New query > cole este
-- arquivo inteiro > Run. Pode rodar mais de uma vez sem problema.
-- =====================================================================


-- =====================================================================
-- 1. TABELA: usuario
-- =====================================================================

create table if not exists public.usuario (
  id_usuario      uuid primary key references auth.users (id) on delete cascade,
  nome_usuario    text not null default ''
                    check (char_length(nome_usuario) <= 120),
  email_usuario   text not null unique,
  celular_usuario text
                    check (celular_usuario is null or celular_usuario ~ '^[0-9]{10,11}$'),
  criado_em       timestamptz not null default now()
);

comment on table public.usuario is
  'Dados de cadastro de cada usuário. A senha fica no Supabase Auth, não aqui.';

alter table public.usuario enable row level security;

drop policy if exists "usuario le o proprio cadastro" on public.usuario;
create policy "usuario le o proprio cadastro"
  on public.usuario
  for select
  to authenticated
  using (auth.uid() = id_usuario);

drop policy if exists "usuario altera o proprio cadastro" on public.usuario;
create policy "usuario altera o proprio cadastro"
  on public.usuario
  for update
  to authenticated
  using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario);

revoke all on public.usuario from anon, authenticated;
grant select on public.usuario to authenticated;
grant update (nome_usuario, celular_usuario) on public.usuario to authenticated;

create or replace function public.criar_usuario_apos_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuario (id_usuario, nome_usuario, email_usuario, celular_usuario)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'celular', '')
  );
  return new;
end;
$$;

drop trigger if exists ao_criar_conta on auth.users;
create trigger ao_criar_conta
  after insert on auth.users
  for each row
  execute function public.criar_usuario_apos_cadastro();


-- =====================================================================
-- 2. TABELA: bairro
-- =====================================================================

create table if not exists public.bairro (
  id_bairro   serial primary key,
  nome_bairro text not null unique
                check (char_length(nome_bairro) between 2 and 100),
  rpa         smallint not null
                check (rpa between 1 and 6),
  zona        text not null
                check (zona in ('Centro', 'Norte', 'Noroeste', 'Oeste', 'Sudoeste', 'Sul')),
  ativo       boolean not null default true
);

comment on table public.bairro is
  'Bairros do Recife agrupados por Região Político-Administrativa (RPA 1 a 6).';

alter table public.bairro enable row level security;

drop policy if exists "leitura publica de bairros ativos" on public.bairro;
create policy "leitura publica de bairros ativos"
  on public.bairro
  for select
  to anon, authenticated
  using (ativo = true);

revoke all on public.bairro from anon, authenticated;
grant select on public.bairro to anon, authenticated;


-- =====================================================================
-- 3. TABELA: rota_coleta
-- =====================================================================

create table if not exists public.rota_coleta (
  id_rota                uuid primary key default gen_random_uuid(),
  id_bairro              integer not null references public.bairro (id_bairro) on delete restrict,
  codigo_rota            text not null unique
                           check (char_length(codigo_rota) between 3 and 30),
  tipo_residuo           text not null default 'domiciliar'
                           check (tipo_residuo in ('domiciliar', 'seletiva', 'volumosos')),
  dias_semana            text not null
                           check (char_length(dias_semana) between 3 and 60),
  horario_inicio         time not null,
  horario_fim            time not null
                           check (horario_fim > horario_inicio),
  logradouros_referencia text not null default '',
  ativa                  boolean not null default true,
  atualizado_em          timestamptz not null default now()
);

create index if not exists idx_rota_coleta_bairro on public.rota_coleta (id_bairro);

comment on table public.rota_coleta is
  'Rotas, dias e faixas de horário da coleta de resíduos por bairro.';

alter table public.rota_coleta enable row level security;

drop policy if exists "leitura publica de rotas ativas" on public.rota_coleta;
create policy "leitura publica de rotas ativas"
  on public.rota_coleta
  for select
  to anon, authenticated
  using (ativa = true);

revoke all on public.rota_coleta from anon, authenticated;
grant select on public.rota_coleta to anon, authenticated;


-- =====================================================================
-- 4. TABELA: endereco_usuario
-- =====================================================================

create table if not exists public.endereco_usuario (
  id_endereco    uuid primary key default gen_random_uuid(),
  id_usuario     uuid not null references public.usuario (id_usuario) on delete cascade,
  id_bairro      integer not null references public.bairro (id_bairro) on delete restrict,
  apelido        text not null default 'Casa'
                   check (char_length(apelido) between 1 and 40),
  logradouro     text not null
                   check (char_length(logradouro) between 3 and 150),
  numero         text not null default 'S/N'
                   check (char_length(numero) <= 20),
  cep            text
                   check (cep is null or cep ~ '^[0-9]{8}$'),
  receber_alerta boolean not null default true,
  criado_em      timestamptz not null default now()
);

create index if not exists idx_endereco_usuario_user on public.endereco_usuario (id_usuario);

alter table public.endereco_usuario enable row level security;

drop policy if exists "usuario gerencia proprios enderecos" on public.endereco_usuario;
create policy "usuario gerencia proprios enderecos"
  on public.endereco_usuario
  for all
  to authenticated
  using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario);

revoke all on public.endereco_usuario from anon, authenticated;
grant select, insert, update, delete on public.endereco_usuario to authenticated;


-- =====================================================================
-- 5. TABELA: notificacao_alerta
-- =====================================================================

create table if not exists public.notificacao_alerta (
  id_notificacao uuid primary key default gen_random_uuid(),
  id_usuario     uuid not null references public.usuario (id_usuario) on delete cascade,
  id_rota        uuid references public.rota_coleta (id_rota) on delete set null,
  titulo         text not null check (char_length(titulo) between 3 and 120),
  mensagem       text not null check (char_length(mensagem) between 5 and 500),
  lida           boolean not null default false,
  enviada_em     timestamptz not null default now()
);

create index if not exists idx_notificacao_usuario_lida
  on public.notificacao_alerta (id_usuario, lida, enviada_em desc);

alter table public.notificacao_alerta enable row level security;

drop policy if exists "usuario le proprias notificacoes" on public.notificacao_alerta;
create policy "usuario le proprias notificacoes"
  on public.notificacao_alerta
  for select
  to authenticated
  using (auth.uid() = id_usuario);

drop policy if exists "usuario marca notificacao como lida" on public.notificacao_alerta;
create policy "usuario marca notificacao como lida"
  on public.notificacao_alerta
  for update
  to authenticated
  using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario);

revoke all on public.notificacao_alerta from anon, authenticated;
grant select on public.notificacao_alerta to authenticated;
grant update (lida) on public.notificacao_alerta to authenticated;


-- =====================================================================
-- 6. TABELA: chamado_suporte + PROTOCOLO AUTOMÁTICO + RPC SEGURA
-- =====================================================================

create sequence if not exists public.seq_protocolo_suporte start 1;

create table if not exists public.chamado_suporte (
  id_chamado          uuid primary key default gen_random_uuid(),
  protocolo           text not null unique default (
                        'CR-' || extract(year from now())::text || '-' ||
                        lpad(nextval('public.seq_protocolo_suporte')::text, 5, '0')
                      ),
  id_usuario          uuid references public.usuario (id_usuario) on delete set null,
  id_bairro           integer references public.bairro (id_bairro) on delete set null,
  nome_solicitante    text not null
                        check (char_length(nome_solicitante) between 2 and 120),
  email_solicitante   text not null
                        check (email_solicitante ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  celular_solicitante text
                        check (celular_solicitante is null or celular_solicitante ~ '^[0-9]{10,11}$'),
  categoria           text not null
                        check (categoria in (
                          'duvida_rota',
                          'atraso_coleta',
                          'notificacoes',
                          'conta_acesso',
                          'sugestao',
                          'outro'
                        )),
  assunto             text not null
                        check (char_length(assunto) between 4 and 150),
  descricao           text not null
                        check (char_length(descricao) between 10 and 2000),
  status              text not null default 'aberto'
                        check (status in ('aberto', 'em_analise', 'resolvido')),
  resposta_equipe     text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_chamado_suporte_usuario
  on public.chamado_suporte (id_usuario, criado_em desc);

comment on table public.chamado_suporte is
  'Chamados abertos pela página de Suporte (visitantes ou usuários autenticados).';

alter table public.chamado_suporte enable row level security;

drop policy if exists "usuario le proprios chamados" on public.chamado_suporte;
create policy "usuario le proprios chamados"
  on public.chamado_suporte
  for select
  to authenticated
  using (auth.uid() = id_usuario);

revoke all on public.chamado_suporte from anon, authenticated;
grant select on public.chamado_suporte to authenticated;

create or replace function public.abrir_chamado_suporte(
  p_nome      text,
  p_email     text,
  p_celular   text,
  p_categoria text,
  p_id_bairro integer,
  p_assunto   text,
  p_descricao text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_protocolo text;
  v_uid uuid := auth.uid();
begin
  insert into public.chamado_suporte (
    id_usuario,
    id_bairro,
    nome_solicitante,
    email_solicitante,
    celular_solicitante,
    categoria,
    assunto,
    descricao
  )
  values (
    v_uid,
    p_id_bairro,
    trim(p_nome),
    lower(trim(p_email)),
    nullif(regexp_replace(coalesce(p_celular, ''), '\D', '', 'g'), ''),
    p_categoria,
    trim(p_assunto),
    trim(p_descricao)
  )
  returning protocolo into v_protocolo;

  return v_protocolo;
end;
$$;

grant execute on function public.abrir_chamado_suporte(text, text, text, text, integer, text, text)
  to anon, authenticated;


-- =====================================================================
-- 7. DADOS INICIAIS (SEED) — Bairros do Recife
-- =====================================================================

insert into public.bairro (nome_bairro, rpa, zona) values
  ('Boa Vista', 1, 'Centro'),
  ('Santo Amaro', 1, 'Centro'),
  ('Encruzilhada', 2, 'Norte'),
  ('Água Fria', 2, 'Norte'),
  ('Casa Amarela', 3, 'Noroeste'),
  ('Graças', 3, 'Noroeste'),
  ('Espinheiro', 3, 'Noroeste'),
  ('Várzea', 4, 'Oeste'),
  ('Cordeiro', 4, 'Oeste'),
  ('Afogados', 5, 'Sudoeste'),
  ('Boa Viagem', 6, 'Sul'),
  ('Pina', 6, 'Sul')
on conflict (nome_bairro) do nothing;
