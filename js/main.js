(function () {
  "use strict";

  const DURACAO_NOTIFICACAO = 3200;
  const baseImagens = new URL("../img/catalogo/", document.currentScript.src);
  let temporizadorNotificacao = null;

  function obterDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function formatarTelefone(valor) {
    let numeros = obterDigitos(valor);
    if (numeros.startsWith("55") && [12, 13].includes(numeros.length)) numeros = numeros.slice(2);
    numeros = numeros.slice(0, 11);
    if (numeros.length > 10) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    if (numeros.length > 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    if (numeros.length > 2) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return numeros ? `(${numeros}` : "";
  }

  function formatarCnpj(valor) {
    return obterDigitos(valor).slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function cnpjValido(valor) {
    const cnpj = obterDigitos(valor);
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const digito = base => {
      const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const resto = base.split("").reduce((soma, numero, indice) => soma + Number(numero) * pesos[indice], 0) % 11;
      return resto < 2 ? "0" : String(11 - resto);
    };
    const primeiro = digito(cnpj.slice(0, 12));
    return cnpj.endsWith(primeiro + digito(cnpj.slice(0, 12) + primeiro));
  }

  function mostrarSenha(botao, visivel) {
    document.getElementById(botao.getAttribute("aria-controls")).type = visivel ? "text" : "password";
    botao.title = visivel ? "Ocultar senha" : "Mostrar senha";
    botao.setAttribute("aria-label", botao.title);
    botao.firstElementChild.className = visivel ? "fa fa-eye-slash" : "fa fa-eye";
  }

  function montarMensagemPedido(cliente, itens) {
    return [
      "Olá, quero fazer um pedido. Fiz um carrinho de itens pelo site, gostaria de prosseguir com a compra.",
      "",
      `Empresa: ${cliente.empresa}`,
      `CNPJ: ${formatarCnpj(cliente.cnpj)}`,
      `Telefone: ${formatarTelefone(cliente.telefone)}`,
      "",
      "Segue abaixo os itens selecionados:",
      ...itens.map((item, indice) => `${indice + 1}- (${item.quantidade}Uni) ${item.descricao} - ${item.codigo}`)
    ].join("\n");
  }

  function obterUrlImagemProduto(produto) {
    const nome = String(produto?.imagem || "").trim();
    const valido = nome && !nome.includes("..") && !/[\\/]/.test(nome) && !/^[a-z]+:/i.test(nome);
    return new URL(valido ? `imagens/${encodeURIComponent(nome)}` : "sem-imagem.webp", baseImagens).href;
  }

  function definirImagemProduto(imagem, produto) {
    imagem.onerror = () => {
      imagem.onerror = null;
      imagem.src = obterUrlImagemProduto();
    };
    imagem.src = obterUrlImagemProduto(produto);
  }

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
    copiarTexto,
    obterUrlImagemProduto,
    definirImagemProduto,
    obterDigitos,
    formatarTelefone,
    formatarCnpj,
    cnpjValido,
    mostrarSenha,
    montarMensagemPedido
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-telefone]").forEach(campo => {
      campo.addEventListener("input", () => {
        const posicao = campo.selectionStart;
        const quantidade = obterDigitos(campo.value.slice(0, posicao)).length;
        campo.value = formatarTelefone(campo.value);
        let cursor = 0, numeros = 0;
        while (cursor < campo.value.length && numeros < quantidade) {
          if (/\d/.test(campo.value[cursor])) numeros++;
          cursor++;
        }
        campo.setSelectionRange(cursor, cursor);
      });
      campo.addEventListener("change", () => { campo.value = formatarTelefone(campo.value); });
    });
    if (CSS.supports("(appearance: base-select) and selector(::picker(select))")) return;

    document.querySelectorAll("select[data-abrir-ao-clicar]").forEach((seletor) => {
      if (typeof seletor.showPicker !== "function") return;
      let abrirComClique = false;

      // Abre após soltar o mouse; teclado e toque mantêm o comportamento nativo.
      function prepararClique(evento) {
        abrirComClique = evento.pointerType === "mouse" && evento.button === 0 && !seletor.disabled;
        if (!abrirComClique) return;
        evento.preventDefault();
        seletor.focus({ preventScroll: true });
      }

      function abrirSeletor(evento) {
        if (!abrirComClique) return;
        abrirComClique = false;
        evento.preventDefault();
        try {
          seletor.showPicker();
        } catch {
          seletor.removeEventListener("pointerdown", prepararClique);
          seletor.removeEventListener("click", abrirSeletor);
        }
      }

      seletor.addEventListener("pointerdown", prepararClique);
      seletor.addEventListener("click", abrirSeletor);
    });
  });

})();

(function ($) {
  "use strict";

  if (!$) return;

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

})(window.jQuery);
