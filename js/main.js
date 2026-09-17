(function () {
  "use strict";

  const DURACAO_NOTIFICACAO = 3200;
  let temporizadorNotificacao = null;

  function obterAreaNotificacao() {
    let area = document.getElementById("dipsul-notificacao-area");

    if (!area) {
      area = document.createElement("div");
      area.id = "dipsul-notificacao-area";
      area.className = "dipsul-notificacao-area";
      area.setAttribute("aria-live", "polite");
      area.setAttribute("aria-atomic", "true");
      document.body.appendChild(area);
    }

    return area;
  }

  function removerNotificacao(notificacao) {
    if (!notificacao) return;

    notificacao.classList.remove("esta-visivel");

    window.setTimeout(() => {
      if (notificacao.parentNode) {
        notificacao.parentNode.removeChild(notificacao);
      }
    }, 180);
  }

  function notificar(mensagem, opcoes = {}) {
    const texto = String(mensagem || "").trim();
    if (!texto) return;

    const area = obterAreaNotificacao();
    const notificacaoAnterior = area.querySelector(".dipsul-notificacao");
    const tipo = opcoes.tipo === "erro" ? "erro" : "status";
    const duracao = Number(opcoes.duracao) || DURACAO_NOTIFICACAO;

    window.clearTimeout(temporizadorNotificacao);
    removerNotificacao(notificacaoAnterior);

    const notificacao = document.createElement("div");
    notificacao.className = "dipsul-notificacao";
    notificacao.textContent = texto;
    notificacao.setAttribute("role", tipo === "erro" ? "alert" : "status");

    area.appendChild(notificacao);
    window.requestAnimationFrame(() => notificacao.classList.add("esta-visivel"));

    temporizadorNotificacao = window.setTimeout(() => {
      removerNotificacao(notificacao);
    }, duracao);
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return;
    }

    const campoTemporario = document.createElement("textarea");
    campoTemporario.value = texto;
    campoTemporario.setAttribute("readonly", "");
    campoTemporario.style.position = "fixed";
    campoTemporario.style.top = "0";
    campoTemporario.style.left = "0";
    campoTemporario.style.opacity = "0";

    document.body.appendChild(campoTemporario);
    campoTemporario.select();

    const copiado = document.execCommand("copy");
    document.body.removeChild(campoTemporario);

    if (!copiado) {
      throw new Error("Cópia indisponível.");
    }
  }

  window.Dipsul = Object.assign(window.Dipsul || {}, {
    notificar,
    copiarTexto
  });

})();

(function ($) {
  "use strict";

  $(window).on("load", function () {
    const preCarregador = $("#pre-carregador");

    if (preCarregador.length) {
      preCarregador.delay(100).fadeOut("slow", function () {
        $(this).remove();
      });
    }
  });

  $(window).scroll(function () {
    const passouDoTopo = $(this).scrollTop() > 100;
    $(".voltar-ao-topo")[passouDoTopo ? "fadeIn" : "fadeOut"]("slow");
  });

  $(".voltar-ao-topo").click(function () {
    window.scrollTo(0, 0);
    return false;
  });

  new WOW().init();

  function atualizarCabecalho() {
    $("#header").toggleClass("cabecalho-rolado", $(window).scrollTop() > 100);
  }

  $(window).scroll(atualizarCabecalho);
  atualizarCabecalho();

  $(".main-nav a, .mobile-nav a, .rolar-ate").on("click", function () {
    const mesmaPagina = location.pathname.replace(/^\//, "") === this.pathname.replace(/^\//, "");
    const mesmoDominio = location.hostname === this.hostname;

    if (!mesmaPagina || !mesmoDominio) return undefined;

    const alvo = $(this.hash);
    if (!alvo.length) return undefined;

    let espacoTopo = 0;
    const cabecalho = $("#header");

    if (cabecalho.length) {
      espacoTopo = cabecalho.outerHeight();

      if (!cabecalho.hasClass("cabecalho-rolado")) {
        espacoTopo -= 20;
      }
    }

    window.scrollTo(0, Math.max(0, alvo.offset().top - espacoTopo));

    if (this.hash) {
      history.pushState(null, "", this.hash);
    }

    if ($(this).parents(".main-nav, .mobile-nav").length) {
      $(".main-nav .active, .mobile-nav .active").removeClass("active");
      $(this).closest("li").addClass("active");
    }

    if ($("body").hasClass("menu-mobile-ativo")) {
      $("body").removeClass("menu-mobile-ativo");
      $(".mobile-nav-toggle i").toggleClass("fa-times fa-bars");
      $(".mobile-nav-overly").fadeOut();
    }

    return false;
  });

  const secoes = $("section");
  const navegacao = $(".main-nav, .mobile-nav");
  const alturaNavegacao = $("#header").outerHeight();

  $(window).on("scroll", function () {
    const posicaoAtual = $(this).scrollTop();

    secoes.each(function () {
      const topo = $(this).offset().top - alturaNavegacao;
      const base = topo + $(this).outerHeight();

      if (posicaoAtual >= topo && posicaoAtual <= base) {
        navegacao.find("li").removeClass("active");
        navegacao.find(`a[href="#${$(this).attr("id")}"]`).parent("li").addClass("active");
      }
    });
  });

  $("[data-contador=\"estatistica\"]").counterUp({
    delay: 10,
    time: 1000
  });

})(jQuery);
