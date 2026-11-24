/* =====================================================================
   auth.js — conexão com o Supabase: cadastro, login, logout e perfil.

   Fica disponível para as outras páginas como window.ColetaAuth.
   Nenhuma função aqui mexe na tela: isso é trabalho de layout.js
   (barra da conta) e formularios.js (login e criar conta).
   ===================================================================== */

(function () {
  "use strict";

  var cfg = window.COLETA_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || "").trim();
  var chave = String(cfg.SUPABASE_PUBLISHABLE_KEY || "").trim();

  // Só considera configurado se o config.js foi preenchido de verdade.
  var configurado =
    url.indexOf("http") === 0 &&
    url.indexOf("SEU-PROJETO") === -1 &&
    chave.length > 0 &&
    chave.indexOf("COLE_AQUI") === -1;

  var cliente = null;
  if (configurado && window.supabase && typeof window.supabase.createClient === "function") {
    cliente = window.supabase.createClient(url, chave);
  }

  var MENSAGENS = {
    sem_config: "O site ainda não está conectado ao Supabase. Preencha o arquivo js/config.js.",
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.",
    ja_cadastrado: "Este e-mail já está cadastrado. Tente entrar.",
    weak_password: "Senha fraca. Use pelo menos 8 caracteres.",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    over_email_send_rate_limit: "Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.",
    signup_disabled: "O cadastro de novas contas está desativado no momento.",
    rede: "Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.",
    generico: "Algo deu errado. Tente novamente em instantes."
  };

  var POR_CODIGO = {
    invalid_credentials: MENSAGENS.invalid_credentials,
    email_not_confirmed: MENSAGENS.email_not_confirmed,
    user_already_exists: MENSAGENS.ja_cadastrado,
    email_exists: MENSAGENS.ja_cadastrado,
    weak_password: MENSAGENS.weak_password,
    over_request_rate_limit: MENSAGENS.over_request_rate_limit,
    over_email_send_rate_limit: MENSAGENS.over_email_send_rate_limit,
    signup_disabled: MENSAGENS.signup_disabled
  };

  function traduzirErro(erro) {
    if (!erro) return MENSAGENS.generico;
    if (erro.code && POR_CODIGO[erro.code]) return POR_CODIGO[erro.code];
    var msg = String(erro.message || "").toLowerCase();
    if (msg.indexOf("invalid login credentials") !== -1) return MENSAGENS.invalid_credentials;
    if (msg.indexOf("email not confirmed") !== -1) return MENSAGENS.email_not_confirmed;
    if (msg.indexOf("already registered") !== -1) return MENSAGENS.ja_cadastrado;
    if (msg.indexOf("failed to fetch") !== -1 || msg.indexOf("network") !== -1) return MENSAGENS.rede;
    return MENSAGENS.generico;
  }

  /* ---------- Cadastro ----------
     A senha vai para o Supabase Auth (que guarda só o hash).
     Nome e celular vão como metadados; um gatilho no banco (ver
     supabase/schema.sql) copia tudo para a tabela "usuario". */
  async function cadastrar(dados) {
    if (!cliente) return { erro: MENSAGENS.sem_config };
    try {
      var resp = await cliente.auth.signUp({
        email: dados.email,
        password: dados.senha,
        options: { data: { nome: dados.nome, celular: dados.celular } }
      });
      if (resp.error) return { erro: traduzirErro(resp.error) };

      // Com confirmação de e-mail ligada, o Supabase não devolve erro para
      // e-mail repetido: devolve um usuário sem "identities".
      var user = resp.data && resp.data.user;
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        return { erro: MENSAGENS.ja_cadastrado };
      }
      // sessao = null quando o usuário ainda precisa confirmar o e-mail.
      return { sessao: (resp.data && resp.data.session) || null };
    } catch (e) {
      return { erro: traduzirErro(e) };
    }
  }

  /* ---------- Login ---------- */
  async function entrar(dados) {
    if (!cliente) return { erro: MENSAGENS.sem_config };
    try {
      var resp = await cliente.auth.signInWithPassword({
        email: dados.email,
        password: dados.senha
      });
      if (resp.error) return { erro: traduzirErro(resp.error) };
      return { sessao: resp.data.session };
    } catch (e) {
      return { erro: traduzirErro(e) };
    }
  }

  /* ---------- Logout ---------- */
  async function sair() {
    if (!cliente) return {};
    try {
      var resp = await cliente.auth.signOut();
      if (resp.error) return { erro: traduzirErro(resp.error) };
      return {};
    } catch (e) {
      return { erro: traduzirErro(e) };
    }
  }

  /* ---------- Sessão atual (null se ninguém está logado) ---------- */
  async function obterSessao() {
    if (!cliente) return null;
    try {
      var resp = await cliente.auth.getSession();
      return (resp.data && resp.data.session) || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Perfil: lê a linha do usuário logado na tabela "usuario" ---------- */
  async function obterPerfil() {
    var sessao = await obterSessao();
    if (!sessao) return null;

    // Ponto de partida: dados que já vêm na sessão.
    var meta = sessao.user.user_metadata || {};
    var perfil = {
      id_usuario: sessao.user.id,
      nome_usuario: meta.nome || "",
      email_usuario: sessao.user.email || "",
      celular_usuario: meta.celular || ""
    };

    try {
      var resp = await cliente
        .from("usuario")
        .select("nome_usuario, email_usuario, celular_usuario")
        .eq("id_usuario", sessao.user.id)
        .maybeSingle();
      if (resp.data) {
        perfil.nome_usuario = resp.data.nome_usuario || perfil.nome_usuario;
        perfil.email_usuario = resp.data.email_usuario || perfil.email_usuario;
        perfil.celular_usuario = resp.data.celular_usuario || perfil.celular_usuario;
      }
    } catch (e) {
      /* se a leitura falhar, fica com os dados da sessão */
    }
    return perfil;
  }

  /* ---------- Avisa quando alguém entra ou sai ----------
     O Supabase recomenda não chamar outras funções dele dentro do
     callback do onAuthStateChange (pode travar); o setTimeout evita isso. */
  function aoMudarSessao(callback) {
    if (!cliente) return function () {};
    var inscricao = cliente.auth.onAuthStateChange(function (evento, sessao) {
      setTimeout(function () {
        callback(evento, sessao);
      }, 0);
    });
    return function () {
      inscricao.data.subscription.unsubscribe();
    };
  }

  window.ColetaAuth = {
    configurado: configurado,
    mensagemSemConfig: MENSAGENS.sem_config,
    cadastrar: cadastrar,
    entrar: entrar,
    sair: sair,
    obterSessao: obterSessao,
    obterPerfil: obterPerfil,
    aoMudarSessao: aoMudarSessao
  };
})();
