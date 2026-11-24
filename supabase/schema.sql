-- =====================================================================
-- COLETA RECIFE — banco de dados (Supabase / PostgreSQL)
--
-- Como usar: painel do Supabase > SQL Editor > New query > cole este
-- arquivo inteiro > Run. Pode rodar mais de uma vez sem problema.
--
-- POR QUE NÃO EXISTE A COLUNA SENHA_USUARIO
-- A senha NÃO fica nesta tabela. O Supabase Auth (schema "auth") já
-- guarda e-mail + senha com hash e cuida de login, logout e sessão.
-- Guardar senha numa tabela do próprio site seria um risco: qualquer
-- falha de regra exporia a senha de todos os usuários.
-- A tabela "usuario" guarda o restante do cadastro e aponta para a
-- conta do Auth pelo mesmo ID.
--
-- (Nomes em minúsculas: no PostgreSQL ID_USUARIO e id_usuario são a
-- mesma coisa, e minúsculas evitam usar aspas nas consultas.)
-- =====================================================================


-- 1. TABELA ----------------------------------------------------------

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


-- 2. SEGURANÇA (RLS) -------------------------------------------------
-- Cada usuário logado só enxerga e altera a PRÓPRIA linha.
-- Visitantes sem login não enxergam nada.

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

-- Não há policy de INSERT nem DELETE: o navegador não cria nem apaga
-- linhas. Quem cria é o gatilho abaixo, no momento do cadastro.

-- Permissões de coluna: o usuário pode ler a tabela e alterar só nome e
-- celular (não consegue trocar o próprio id nem o e-mail por aqui).
revoke all on public.usuario from anon, authenticated;
grant select on public.usuario to authenticated;
grant update (nome_usuario, celular_usuario) on public.usuario to authenticated;


-- 3. GATILHO: cria a linha em "usuario" quando a conta é criada ------
-- O site envia nome e celular junto com o cadastro (signUp). Este
-- gatilho copia esses dados para a tabela. Funciona mesmo quando o
-- Supabase exige confirmação de e-mail (quando o usuário ainda não tem
-- sessão para gravar sozinho).

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
