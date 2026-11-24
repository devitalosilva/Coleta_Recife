/* =====================================================================
   formularios.js — telas de login (#form-login) e criar conta (#form-cadastro).
   Valida os campos, chama o ColetaAuth e mostra as mensagens.
   ===================================================================== */

(function () {
  "use strict";

  var auth = window.ColetaAuth;
  var formLogin = document.getElementById("form-login");
  var formCadastro = document.getElementById("form-cadastro");
  var form = formLogin || formCadastro;
  if (!form || !auth) return;

  var raiz = document.body.getAttribute("data-raiz") || "";
  var areaMensagem = form.querySelector("[data-mensagem]");
  var botaoEnviar = form.querySelector("button[type='submit']");

  /* ---------- mensagens ---------- */

  function mostrar(tipo, texto) {
    areaMensagem.hidden = false;
    areaMensagem.className = "mensagem mensagem--" + tipo;
    areaMensagem.textContent = texto;
  }

  function limpar() {
    areaMensagem.hidden = true;
    areaMensagem.textContent = "";
    var marcados = form.querySelectorAll("[aria-invalid]");
    for (var i = 0; i < marcados.length; i++) marcados[i].removeAttribute("aria-invalid");
  }

  function invalido(campo, texto) {
    campo.setAttribute("aria-invalid", "true");
    mostrar("erro", texto);
    campo.focus();
    return null;
  }

  /* ---------- celular: máscara (81) 91234-5678 ---------- */

  function soDigitos(valor) {
    return String(valor).replace(/\D/g, "");
  }

  function mascaraCelular(valor) {
    var d = soDigitos(valor).slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return "(" + d;
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  var campoCelular = form.elements["celular"];
  if (campoCelular) {
    campoCelular.addEventListener("input", function () {
      campoCelular.value = mascaraCelular(campoCelular.value);
    });
  }

  /* ---------- mostrar / ocultar senha ---------- */

  var botoesSenha = form.querySelectorAll("[data-alternar-senha]");
  for (var i = 0; i < botoesSenha.length; i++) {
    botoesSenha[i].addEventListener("click", function (ev) {
      var botao = ev.currentTarget;
      var campo = botao.parentElement.querySelector("input");
      var estavaVisivel = campo.type === "text";
      campo.type = estavaVisivel ? "password" : "text";
      botao.textContent = estavaVisivel ? "Mostrar" : "Ocultar";
      botao.setAttribute("aria-label", estavaVisivel ? "Mostrar senha" : "Ocultar senha");
    });
  }

  /* ---------- validação ---------- */

  var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var REGEX_CELULAR = /^[1-9]\d9\d{8}$/; // DDD + 9 + 8 dígitos

  function lerLogin() {
    var email = form.elements["email"];
    var senha = form.elements["senha"];
    var emailTexto = email.value.trim().toLowerCase();

    if (!REGEX_EMAIL.test(emailTexto)) return invalido(email, "Informe um e-mail válido.");
    if (!senha.value) return invalido(senha, "Informe sua senha.");
    return { email: emailTexto, senha: senha.value };
  }

  function lerCadastro() {
    var nome = form.elements["nome"];
    var email = form.elements["email"];
    var celular = form.elements["celular"];
    var senha = form.elements["senha"];
    var confirmar = form.elements["confirmar"];

    var nomeTexto = nome.value.trim().replace(/\s+/g, " ");
    var emailTexto = email.value.trim().toLowerCase();
    var celularDigitos = soDigitos(celular.value);

    if (nomeTexto.length < 2) return invalido(nome, "Informe seu nome completo.");
    if (nomeTexto.length > 120) return invalido(nome, "O nome pode ter no máximo 120 caracteres.");
    if (!REGEX_EMAIL.test(emailTexto)) return invalido(email, "Informe um e-mail válido.");
    if (!REGEX_CELULAR.test(celularDigitos)) {
      return invalido(celular, "Informe o celular com DDD, por exemplo (81) 91234-5678.");
    }
    if (senha.value.length < 8) return invalido(senha, "A senha precisa ter pelo menos 8 caracteres.");
    if (senha.value !== confirmar.value) return invalido(confirmar, "As senhas não são iguais.");

    return { nome: nomeTexto, email: emailTexto, celular: celularDigitos, senha: senha.value };
  }

  /* ---------- envio ---------- */

  function irParaInicio() {
    window.location.href = raiz + "index.html";
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    limpar();

    if (!auth.configurado) {
      mostrar("aviso", auth.mensagemSemConfig);
      return;
    }

    var dados = formLogin ? lerLogin() : lerCadastro();
    if (!dados) return;

    var textoOriginal = botaoEnviar.textContent;
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = "Aguarde…";

    var resultado = formLogin ? await auth.entrar(dados) : await auth.cadastrar(dados);

    botaoEnviar.disabled = false;
    botaoEnviar.textContent = textoOriginal;

    if (resultado.erro) {
      mostrar("erro", resultado.erro);
      return;
    }

    if (formLogin) {
      irParaInicio();
      return;
    }

    // Cadastro concluído
    form.reset();
    if (resultado.sessao) {
      mostrar("sucesso", "Conta criada! Você já está conectado. Redirecionando…");
      setTimeout(irParaInicio, 1200);
    } else {
      mostrar(
        "sucesso",
        "Conta criada! Enviamos um e-mail de confirmação para " +
          dados.email +
          ". Clique no link da mensagem e depois entre no site."
      );
    }
  });

  /* ---------- ao abrir a página ---------- */

  if (!auth.configurado) {
    mostrar("aviso", auth.mensagemSemConfig);
  } else {
    // Quem já está logado não precisa ver login nem criar conta.
    auth.obterSessao().then(function (sessao) {
      if (sessao) window.location.replace(raiz + "index.html");
    });
  }
})();
