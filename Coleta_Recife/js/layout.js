/* =====================================================================
   layout.js — barra da conta no topo de todas as páginas.

   Sem login:  "Entrar | Criar conta"   (já vem escrito no HTML)
   Com login:  "Olá, Nome | Sair"
   ===================================================================== */

(function () {
  "use strict";

  var auth = window.ColetaAuth;
  var barra = document.querySelector("[data-barra-conta]");
  if (!auth || !auth.configurado || !barra) return;

  var conteudo = barra.querySelector(".barra-conta__conteudo");
  var raiz = document.body.getAttribute("data-raiz") || "";
  var htmlDeslogado = conteudo.innerHTML;
  var sessaoAtual = null;

  function primeiroNome(nome) {
    return String(nome || "").trim().split(/\s+/)[0];
  }

  function mostrarDeslogado() {
    conteudo.innerHTML = htmlDeslogado;
  }

  // O nome vem do usuário, então entra na tela só como texto (textContent),
  // nunca como HTML.
  function mostrarLogado(nome) {
    var primeiro = primeiroNome(nome);

    var ola = document.createElement("span");
    ola.className = "barra-conta__ola";
    ola.textContent = primeiro ? "Olá, " + primeiro : "Olá!";

    var botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Sair";
    botao.addEventListener("click", function () {
      botao.disabled = true;
      auth.sair().then(function () {
        window.location.href = raiz + "index.html";
      });
    });

    conteudo.textContent = "";
    conteudo.appendChild(ola);
    conteudo.appendChild(botao);
  }

  function atualizar(sessao) {
    sessaoAtual = sessao;
    if (!sessao) {
      mostrarDeslogado();
      return;
    }
    // Mostra já o nome que veio no login e depois confirma na tabela "usuario".
    var meta = sessao.user.user_metadata || {};
    mostrarLogado(meta.nome);
    auth.obterPerfil().then(function (perfil) {
      if (sessaoAtual === sessao && perfil && perfil.nome_usuario) {
        mostrarLogado(perfil.nome_usuario);
      }
    });
  }

  auth.obterSessao().then(atualizar);
  auth.aoMudarSessao(function (evento, sessao) {
    atualizar(sessao);
  });
})();
