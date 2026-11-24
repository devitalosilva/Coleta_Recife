# Coleta Recife

Site da plataforma de transparência da coleta de resíduos urbanos do Recife.
Projeto em construção. HTML, CSS e JavaScript puros, com login e cadastro via [Supabase](https://supabase.com).

## Estrutura

```
Coleta_Recife/
├── index.html                  Página inicial
├── paginas/
│   ├── quem-somos.html
│   ├── o-que-fazemos.html
│   ├── blog.html
│   ├── criar-conta.html        Cadastro
│   └── login.html              Login
├── css/
│   └── style.css               Todos os estilos (era Style_menu.css)
├── js/
│   ├── config.js               URL e chave do Supabase  ← PREENCHER
│   ├── auth.js                 Cadastro, login, logout e perfil (Supabase)
│   ├── layout.js               Barra "Entrar / Criar conta" ou "Olá, Nome / Sair"
│   ├── formularios.js          Validação e envio dos formulários
│   └── vendor/supabase.js      Biblioteca supabase-js (v2.119.0), já incluída
├── supabase/
│   └── schema.sql              Script completo (6 tabelas, RLS, triggers e seed)
├── docs/
│   ├── diagrama-er-coleta-recife.png  Diagrama Entidade-Relacionamento (DER) visual
│   └── modelagem-banco-dados.html     Documentação visual interativa do banco
└── imagens/
```

## Como conectar ao Supabase

1. **Crie o projeto** em [supabase.com](https://supabase.com) (New project).
2. **Crie a tabela:** no painel, abra **SQL Editor > New query**, cole todo o conteúdo de
   `supabase/schema.sql` e clique em **Run**.
3. **Copie as chaves:** clique em **Connect** no projeto (ou vá em **Project Settings > API Keys**)
   e copie a **Project URL** e a chave **publicável** (`sb_publishable_...`; em projetos antigos pode
   ser a chave `anon`). Cole os dois valores em `js/config.js`.
   Nunca use a chave `secret` / `service_role` no site.
4. **Confirmação de e-mail:** em **Authentication > Configuration > Sign In / Providers > Email**
   existe a opção **Confirm email**.
   - Ligada (padrão): o usuário recebe um e-mail e precisa clicar no link antes do primeiro login.
   - Desligada: a conta já entra logada. Útil durante o desenvolvimento.
5. **Endereço do site:** em **Authentication > Configuration > URL Configuration**, coloque em
   **Site URL** o endereço onde o site roda (por exemplo `http://127.0.0.1:5500` nos testes locais e
   o endereço real depois de publicar). É para lá que o link do e-mail de confirmação leva o usuário.

## Rodar no seu computador

Abra a pasta no VS Code e use a extensão **Live Server**, ou pelo terminal:

```
python3 -m http.server 5500
```

e acesse `http://localhost:5500`. Prefira isso a abrir o `index.html` com duplo clique: o login
guarda a sessão no navegador e funciona melhor com o site servido por endereço http.

## Como testar

1. Abra **Criar conta**, preencha e envie.
2. No painel do Supabase, confira o usuário em **Authentication > Users** e a linha criada em
   **Table Editor > usuario**.
3. Entre em **Entrar**. A barra no topo deve mostrar "Olá, \<seu nome\>" e o botão **Sair**.

## Sobre a senha

A tabela `usuario` não tem a coluna `SENHA_USUARIO`. A senha é guardada pelo **Supabase Auth**, com
hash, e a tabela `usuario` se liga a essa conta pelo mesmo ID (`id_usuario`). Guardar senha em uma
tabela do próprio site é um risco de segurança desnecessário, e o Auth já faz login, logout e sessão.

## Pendências

- Páginas **Suporte** e **Baixar app** (os links do menu ainda são `#`).
- Botão **Responder formulário** da página inicial ainda não tem link.
- Textos de exemplo: o "Lorem ipsum" e os três cartões repetidos de **Nosso objetivo** na página
  inicial, e os três posts do **Blog**.
- Recuperação de senha ("Esqueci minha senha").
- Página "Minha conta" para o usuário editar nome e celular (a regra de segurança já permite).
- Se um dia o menu ganhar mais itens, o cabeçalho e o rodapé precisam ser editados em cada página.
