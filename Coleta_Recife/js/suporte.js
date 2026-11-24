/* =====================================================================
   suporte.js — comportamento da página de Suporte (#form-suporte).
   Preenche dados automaticamente se o usuário estiver logado, valida,
   envia o chamado ao Supabase e exibe os chamados anteriores da conta.
   ===================================================================== */

(function () {
  "use strict";

  var auth = window.ColetaAuth;
  var form = document.getElementById("form-suporte");
  if (!form || !auth) return;

  var areaMensagem = form.querySelector("[data-mensagem]");
  var botaoEnviar = form.querySelector("button[type='submit']");
  var selectBairro = form.elements["bairro"];
  var secaoHistorico = document.getElementById("secao-meus-chamados");
  var listaHistorico = document.getElementById("lista-meus-chamados");

  var ROTULOS_STATUS = {
    aberto: "Aberto",
    em_analise: "Em análise",
    resolvido: "Resolvido"
  };

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

  /* ---------- máscara de celular ---------- */

  function soDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
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

  /* ---------- validação ---------- */

  var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var REGEX_CELULAR = /^[1-9]\d9\d{8}$/;

  function lerFormulario() {
    var nome = form.elements["nome"];
    var email = form.elements["email"];
    var celular = form.elements["celular"];
    var categoria = form.elements["categoria"];
    var bairro = form.elements["bairro"];
    var assunto = form.elements["assunto"];
    var descricao = form.elements["descricao"];

    var nomeTexto = nome.value.trim().replace(/\s+/g, " ");
    var emailTexto = email.value.trim().toLowerCase();
    var celularDigitos = soDigitos(celular.value);
    var assuntoTexto = assunto.value.trim();
    var descricaoTexto = descricao.value.trim();

    if (nomeTexto.length < 2) return invalido(nome, "Informe seu nome completo.");
    if (!REGEX_EMAIL.test(emailTexto)) return invalido(email, "Informe um e-mail válido.");
    if (celularDigitos.length > 0 && !REGEX_CELULAR.test(celularDigitos)) {
      return invalido(celular, "Se informar celular, use DDD + 9 dígitos, ex.: (81) 91234-5678.");
    }
    if (!categoria.value) return invalido(categoria, "Selecione a categoria do atendimento.");
    if (assuntoTexto.length < 4) return invalido(assunto, "Informe um assunto com pelo menos 4 caracteres.");
    if (descricaoTexto.length < 10) {
      return invalido(descricao, "Descreva sua solicitação com pelo menos 10 caracteres.");
    }

    return {
      nome: nomeTexto,
      email: emailTexto,
      celular: celularDigitos,
      categoria: categoria.value,
      id_bairro: bairro.value || null,
      assunto: assuntoTexto,
      descricao: descricaoTexto
    };
  }

  /* ---------- carregar bairros e histórico ---------- */

  async function carregarBairros() {
    if (!selectBairro || !auth.configurado) return;
    var bairros = await auth.listarBairros();
    for (var i = 0; i < bairros.length; i++) {
      var opt = document.createElement("option");
      opt.value = bairros[i].id_bairro;
      opt.textContent = bairros[i].nome_bairro + " (" + bairros[i].zona + ")";
      selectBairro.appendChild(opt);
    }
  }

  async function carregarHistorico() {
    if (!secaoHistorico || !listaHistorico || !auth.configurado) return;
    var sessao = await auth.obterSessao();
    if (!sessao) {
      secaoHistorico.hidden = true;
      return;
    }

    var chamados = await auth.listarMeusChamados();
    listaHistorico.textContent = "";

    if (!chamados.length) {
      secaoHistorico.hidden = true;
      return;
    }

    secaoHistorico.hidden = false;
    for (var i = 0; i < chamados.length; i++) {
      var item = chamados[i];
      var artigo = document.createElement("article");
      artigo.className = "cartao cartao--texto artigo";

      var topo = document.createElement("div");
      var etiqueta = document.createElement("span");
      etiqueta.className = "etiqueta";
      etiqueta.textContent = item.protocolo;

      var badge = document.createElement("span");
      badge.className = "status-chamado status-chamado--" + item.status;
      badge.textContent = ROTULOS_STATUS[item.status] || item.status;

      topo.appendChild(etiqueta);
      topo.appendChild(badge);

      var titulo = document.createElement("h3");
      titulo.textContent = item.assunto;

      var desc = document.createElement("p");
      desc.textContent = item.descricao;

      artigo.appendChild(topo);
      artigo.appendChild(titulo);
      artigo.appendChild(desc);

      if (item.resposta_equipe) {
        var resp = document.createElement("p");
        resp.className = "resposta-equipe";
        resp.textContent = "Resposta da equipe: " + item.resposta_equipe;
        artigo.appendChild(resp);
      }

      listaHistorico.appendChild(artigo);
    }
  }

  async function preencherDadosUsuarioLogado() {
    if (!auth.configurado) return;
    var perfil = await auth.obterPerfil();
    if (!perfil) return;
    if (perfil.nome_usuario && !form.elements["nome"].value) {
      form.elements["nome"].value = perfil.nome_usuario;
    }
    if (perfil.email_usuario && !form.elements["email"].value) {
      form.elements["email"].value = perfil.email_usuario;
    }
    if (perfil.celular_usuario && !form.elements["celular"].value) {
      form.elements["celular"].value = mascaraCelular(perfil.celular_usuario);
    }
  }

  /* ---------- envio ---------- */

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    limpar();

    if (!auth.configurado) {
      mostrar("aviso", auth.mensagemSemConfig);
      return;
    }

    var dados = lerFormulario();
    if (!dados) return;

    var textoOriginal = botaoEnviar.textContent;
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = "Enviando…";

    var resultado = await auth.enviarChamadoSuporte(dados);

    botaoEnviar.disabled = false;
    botaoEnviar.textContent = textoOriginal;

    if (resultado.erro) {
      mostrar("erro", resultado.erro);
      return;
    }

    form.reset();
    await preencherDadosUsuarioLogado();
    await carregarHistorico();
    mostrar(
      "sucesso",
      "Solicitação enviada com sucesso! Anote seu número de protocolo: " + resultado.protocolo + "."
    );
  });

  /* ---------- inicialização ---------- */

  if (!auth.configurado) {
    mostrar("aviso", auth.mensagemSemConfig);
  } else {
    carregarBairros();
    preencherDadosUsuarioLogado();
    carregarHistorico();
  }
})();
