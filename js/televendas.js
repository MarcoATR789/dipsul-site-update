(function () {
  "use strict";

  const VENDEDORES = {
    cleber: {
      nome: "Cleber Martins",
      telefone: "(48) 3301-0726",
      email: "cleber.martins@dipsul.com.br",
      whatsapp: "https://wa.me/554833010726?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
    },
    rose: {
      nome: "Rose Leal",
      telefone: "(48) 3301-0737",
      email: "rosimeire.leal@dipsul.com.br",
      whatsapp: "https://wa.me/554833010737?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
    },
    keitiane: {
      nome: "Keitiane Alves",
      telefone: "(48) 3301-0740",
      email: "keitiane.alves@dipsul.com.br",
      whatsapp: "https://wa.me/554833010740?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
    },
    aliane: {
      nome: "Aliane Trindade",
      telefone: "(48) 3301-0735",
      email: "aliane.trindade@dipsul.com.br",
      whatsapp: "https://wa.me/554833010735?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
    }
  };

  function obterPainel() {
    return document.getElementById("televendas-painel");
  }

  function obterDetalhes() {
    return document.getElementById("televendas-detalhes");
  }

  function avisar(mensagem, erro = false) {
    if (window.Dipsul && typeof window.Dipsul.notificar === "function") {
      window.Dipsul.notificar(mensagem, { tipo: erro ? "erro" : "status" });
      return;
    }

    console[erro ? "error" : "log"](mensagem);
  }

  function copiarTexto(texto) {
    if (window.Dipsul && typeof window.Dipsul.copiarTexto === "function") {
      return window.Dipsul.copiarTexto(texto);
    }

    return Promise.reject(new Error("Cópia indisponível."));
  }

  function obterTelefoneLimpo(telefone) {
    return String(telefone || "").replace(/[\s()-]/g, "");
  }

  function definirPainelAberto(aberto, opcoes = {}) {
    const painel = obterPainel();
    if (!painel) return;

    painel.classList.toggle("esta-aberto", aberto);
    painel.setAttribute("aria-hidden", aberto ? "false" : "true");
    painel.inert = !aberto;

    if (aberto && opcoes.foco !== false) {
      const primeiroControle = painel.querySelector("button, a, input");
      if (primeiroControle) primeiroControle.focus();
    }
  }

  function fecharInfoVendedor() {
    definirPainelAberto(false, { foco: false });
  }

  function montarContato(info) {
    const telefoneLimpo = obterTelefoneLimpo(info.telefone);
    const corpoEmail = encodeURIComponent(
      "Olá! Vim através do site da Dipsul e gostaria de realizar um pedido com a empresa."
    );

    return `
      <div class="catalogo-pedido-cabecalho">
        <div>
          <span class="televendas-contato-etiqueta">Televendas:</span>
          <h2 id="televendas-contato-titulo">${info.nome}</h2>
        </div>
        <button type="button" class="catalogo-pedido-fechar" data-fechar-contatos aria-label="Fechar contatos">
          &times;
        </button>
      </div>

      <div class="vendedor-contatos-lista">
        <button type="button" class="vendedor-contato-item vendedor-contato-copiar" data-copiar-valor="${info.telefone}" data-copiar-label="Telefone" aria-label="Copiar telefone de ${info.nome}">
          <span>Telefone:</span>
          <strong>${info.telefone}</strong>
          <i class="fa fa-copy" aria-hidden="true"></i>
        </button>
        <button type="button" class="vendedor-contato-item vendedor-contato-copiar" data-copiar-valor="${info.email}" data-copiar-label="Email" aria-label="Copiar email de ${info.nome}">
          <span>Email:</span>
          <strong>${info.email}</strong>
          <i class="fa fa-copy" aria-hidden="true"></i>
        </button>
      </div>

      <div class="catalogo-pedido-acoes vendedor-acoes">
        <a href="${info.whatsapp}" target="_blank" rel="noopener noreferrer" class="vendedor-acao vendedor-acao--whatsapp">
          <i class="fa fa-whatsapp" aria-hidden="true"></i>
          <span>Conversar por WhatsApp</span>
        </a>
        <a href="mailto:${info.email}?subject=Site - Pedido com a Dipsul!&body=${corpoEmail}" target="_blank" rel="noopener noreferrer" class="vendedor-acao vendedor-acao--email">
          <i class="fa fa-envelope" aria-hidden="true"></i>
          <span>Enviar Email</span>
        </a>
        <a href="tel:${telefoneLimpo}" target="_blank" class="vendedor-acao vendedor-acao--telefone">
          <i class="fa fa-phone" aria-hidden="true"></i>
          <span>Ligar Agora</span>
        </a>
      </div>
    `;
  }

  function configurarCopiaContato(container) {
    container.querySelectorAll("[data-copiar-valor]").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const valor = botao.dataset.copiarValor || "";
        const label = botao.dataset.copiarLabel || "Informação";

        try {
          await copiarTexto(valor);
          avisar(`${label} copiado.`);
        } catch (erro) {
          console.error("Erro ao copiar contato:", erro);
          avisar("Não foi possível copiar.", true);
        }
      });
    });
  }

  function abrirInfoVendedor(vendedor) {
    const info = VENDEDORES[vendedor];
    const detalhes = obterDetalhes();

    if (!info || !detalhes) return;

    detalhes.innerHTML = montarContato(info);
    detalhes.querySelector("[data-fechar-contatos]").addEventListener("click", fecharInfoVendedor);
    configurarCopiaContato(detalhes);
    definirPainelAberto(true);
  }

  function configurarCartoes() {
    document.querySelectorAll("[data-vendedor]").forEach((cartao) => {
      cartao.addEventListener("click", () => abrirInfoVendedor(cartao.dataset.vendedor));
      cartao.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter" && evento.key !== " ") return;

        evento.preventDefault();
        abrirInfoVendedor(cartao.dataset.vendedor);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", configurarCartoes);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharInfoVendedor();
    }
  });

  window.abrirInfoVendedor = abrirInfoVendedor;
  window.fecharInfoVendedor = fecharInfoVendedor;
})();
