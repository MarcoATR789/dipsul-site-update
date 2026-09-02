(function () {
  "use strict";

  const CHAVE_CONSENTIMENTO = "dipsul_cookie_consent_v1";
  const EVENTOS_CONSENTIMENTO = [
    "aviso-cookies-changed",
    "cookie-consent-changed"
  ];

  function estaEmHttps() {
    return location.protocol === "https:";
  }

  function escaparRegExp(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escreverCookie(nome, valor, dias) {
    let expira = "";

    if (typeof dias === "number") {
      const data = new Date();
      data.setTime(data.getTime() + dias * 24 * 60 * 60 * 1000);
      expira = `;expires=${data.toUTCString()}`;
    }

    const seguro = estaEmHttps() ? ";Secure" : "";
    document.cookie = `${nome}=${encodeURIComponent(valor)}${expira};path=/;SameSite=Lax${seguro}`;
  }

  function lerCookie(nome) {
    const regex = new RegExp(`(?:^|; )${escaparRegExp(nome)}=([^;]*)`);
    const encontrado = document.cookie.match(regex);

    return encontrado ? decodeURIComponent(encontrado[1]) : null;
  }

  function emitirConsentimento(consentimento) {
    EVENTOS_CONSENTIMENTO.forEach((evento) => {
      document.dispatchEvent(new CustomEvent(evento, { detail: consentimento }));
    });
  }

  function salvarConsentimento(consentimento) {
    try {
      localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(consentimento));
    } catch (erro) {
      console.warn("Não foi possível salvar as preferências em localStorage.", erro);
    }

    escreverCookie(CHAVE_CONSENTIMENTO, JSON.stringify(consentimento), 365);
    emitirConsentimento(consentimento);
  }

  function carregarConsentimento() {
    try {
      const salvo = localStorage.getItem(CHAVE_CONSENTIMENTO) || lerCookie(CHAVE_CONSENTIMENTO);
      return salvo ? JSON.parse(salvo) : null;
    } catch (erro) {
      console.warn("Não foi possível ler as preferências de cookies.", erro);
      return null;
    }
  }

  function obterModal(elemento) {
    const temJQuery = typeof window.jQuery !== "undefined" && elemento;
    const temBootstrap = typeof window.bootstrap !== "undefined" && elemento;

    return {
      abrir() {
        if (temJQuery) return window.jQuery(elemento).modal("show");
        if (temBootstrap) return new window.bootstrap.Modal(elemento).show();
        return elemento && elemento.classList.add("show");
      },
      fechar() {
        if (temJQuery) return window.jQuery(elemento).modal("hide");
        if (temBootstrap) return new window.bootstrap.Modal(elemento).hide();
        return elemento && elemento.classList.remove("show");
      }
    };
  }

  function montarConsentimento(status, analytics, marketing) {
    return {
      status,
      necessary: true,
      analytics,
      marketing,
      updated: new Date().toISOString()
    };
  }

  function ocultarAviso(aviso) {
    aviso.classList.add("hide");

    setTimeout(() => {
      if (aviso.parentNode) {
        aviso.parentNode.removeChild(aviso);
      }
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const aviso = document.getElementById("aviso-cookies");
    if (!aviso) return;

    const consentimento = carregarConsentimento();

    if (consentimento && ["accepted", "declined", "custom"].includes(consentimento.status)) {
      emitirConsentimento(consentimento);
      return;
    }

    const botaoAceitarTodos = document.getElementById("cookies-aceitar-todos");
    const botaoRecusar = document.getElementById("cookies-recusar");
    const botaoGerenciar = document.getElementById("cookies-gerenciar");
    const janelaPreferencias = document.getElementById("preferencias-cookies-modal");
    const modal = janelaPreferencias ? obterModal(janelaPreferencias) : null;
    const campoAnalise = document.getElementById("cookies-analise");
    const campoMarketing = document.getElementById("cookies-marketing");
    const botaoSalvarModal = document.getElementById("cookies-modal-salvar");
    const botaoRecusarModal = document.getElementById("cookies-modal-recusar");

    aviso.classList.remove("hide");

    if (botaoAceitarTodos) {
      botaoAceitarTodos.addEventListener("click", () => {
        salvarConsentimento(montarConsentimento("accepted", true, true));
        ocultarAviso(aviso);
      });
    }

    if (botaoRecusar) {
      botaoRecusar.addEventListener("click", () => {
        salvarConsentimento(montarConsentimento("declined", false, false));
        ocultarAviso(aviso);
      });
    }

    if (botaoGerenciar) {
      botaoGerenciar.addEventListener("click", () => {
        if (campoAnalise) campoAnalise.checked = !!(consentimento && consentimento.analytics);
        if (campoMarketing) campoMarketing.checked = !!(consentimento && consentimento.marketing);
        if (modal) modal.abrir();
      });
    }

    if (botaoSalvarModal) {
      botaoSalvarModal.addEventListener("click", () => {
        salvarConsentimento(montarConsentimento(
          "custom",
          !!(campoAnalise && campoAnalise.checked),
          !!(campoMarketing && campoMarketing.checked)
        ));

        if (modal) modal.fechar();
        ocultarAviso(aviso);
      });
    }

    if (botaoRecusarModal) {
      botaoRecusarModal.addEventListener("click", () => {
        salvarConsentimento(montarConsentimento("declined", false, false));
        if (modal) modal.fechar();
        ocultarAviso(aviso);
      });
    }
  });
})();
