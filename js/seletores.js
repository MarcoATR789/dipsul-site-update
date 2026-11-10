(function () {
  "use strict";

  const campos = "select.form-control:not([multiple]):not([size])";
  const nativo = window.CSS?.supports("(appearance: base-select) and selector(::picker(select))");
  let campo = null, lista = null, opcoes = [], ativo = -1, busca = "", ultimaTecla = 0, sequencia = 0;

  function preparar(raiz) {
    const encontrados = [...raiz.querySelectorAll(campos)];
    if (raiz.matches?.(campos)) encontrados.unshift(raiz);
    encontrados.forEach(seletor => {
      if (seletor.parentElement.classList.contains("campo-selecao")) return;
      const grupo = document.createElement("div");
      grupo.className = "campo-selecao";
      seletor.before(grupo);
      grupo.append(seletor);
    });
  }

  function fechar() {
    if (!campo) return;
    campo.removeAttribute("aria-expanded");
    campo.removeAttribute("aria-controls");
    campo.removeAttribute("aria-activedescendant");
    lista.remove();
    campo = lista = null;
    opcoes = [];
    ativo = -1;
    busca = "";
  }

  function destacar(indice) {
    if (!opcoes[indice] || opcoes[indice].disabled) return;
    ativo = indice;
    lista.querySelectorAll("[role=option]").forEach(item => {
      item.classList.toggle("ativa", Number(item.dataset.indice) === ativo);
    });
    const item = lista.querySelector(`[data-indice="${ativo}"]`);
    campo.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function mover(direcao, extremo = false) {
    let indice = extremo ? (direcao > 0 ? -1 : opcoes.length) : ativo;
    while ((indice += direcao) >= 0 && indice < opcoes.length) {
      if (!opcoes[indice].disabled) return destacar(indice);
    }
  }

  function confirmar() {
    if (ativo < 0 || opcoes[ativo].disabled || campo.matches(":disabled")) return fechar();
    const seletor = campo, indice = opcoes[ativo].index, alterou = seletor.selectedIndex !== indice;
    seletor.selectedIndex = indice;
    fechar();
    if (alterou) {
      seletor.dispatchEvent(new Event("input", { bubbles: true }));
      seletor.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function abrir(seletor) {
    if (seletor.matches(":disabled")) return;
    fechar();
    const retangulo = seletor.getBoundingClientRect();
    if (!retangulo.width || !retangulo.height) return;
    campo = seletor;
    lista = document.createElement("div");
    lista.className = "campo-selecao-lista";
    lista.id = `campo-selecao-lista-${++sequencia}`;
    lista.setAttribute("role", "listbox");
    lista.setAttribute("aria-label", seletor.getAttribute("aria-label") ||
      Array.from(seletor.labels || [], rotulo => rotulo.textContent.trim()).join(" ") || "Opções");

    let ultimoGrupo = null;
    Array.from(seletor.options).forEach((opcao, index) => {
      const grupo = opcao.closest("optgroup");
      if (opcao.hidden || grupo?.hidden) return;
      if (grupo && grupo !== ultimoGrupo) {
        const titulo = document.createElement("div");
        titulo.className = "campo-selecao-grupo";
        titulo.textContent = grupo.label;
        lista.append(titulo);
      }
      ultimoGrupo = grupo;
      const disabled = opcao.disabled || Boolean(grupo?.disabled), indice = opcoes.length;
      opcoes.push({ index, disabled, texto: opcao.label });
      const item = document.createElement("div");
      item.id = `${lista.id}-${indice}`;
      item.className = "campo-selecao-opcao";
      item.dataset.indice = indice;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(opcao.selected));
      item.setAttribute("aria-disabled", String(disabled));
      item.textContent = opcao.label;
      lista.append(item);
    });

    // Mantém a lista na camada do diálogo, sem substituir o select do formulário.
    (seletor.closest("dialog[open]") || document.body).append(lista);
    if (typeof lista.showPopover === "function") {
      lista.setAttribute("popover", "manual");
      lista.showPopover();
    }
    const alturaTela = document.documentElement.clientHeight, larguraTela = document.documentElement.clientWidth;
    const abaixo = alturaTela - retangulo.bottom - 12, acima = retangulo.top - 12;
    lista.style.width = `${Math.min(retangulo.width, larguraTela - 16)}px`;
    const altura = Math.min(320, alturaTela / 2, lista.scrollHeight + 2);
    const abrirAcima = abaixo < altura && acima > abaixo;
    lista.style.left = `${Math.max(8, Math.min(retangulo.left, larguraTela - lista.offsetWidth - 8))}px`;
    lista.style.maxHeight = `${Math.max(0, Math.min(altura, abrirAcima ? acima : abaixo))}px`;
    lista.style.top = `${abrirAcima ? retangulo.top - lista.offsetHeight - 4 : retangulo.bottom + 4}px`;
    seletor.setAttribute("aria-expanded", "true");
    seletor.setAttribute("aria-controls", lista.id);
    seletor.focus({ preventScroll: true });

    const selecionada = opcoes.findIndex(opcao => opcao.index === seletor.selectedIndex && !opcao.disabled);
    destacar(selecionada >= 0 ? selecionada : opcoes.findIndex(opcao => !opcao.disabled));
    lista.addEventListener("pointerdown", evento => {
      if (evento.target.closest("[role=option]")) evento.preventDefault();
    });
    lista.addEventListener("click", evento => {
      const item = evento.target.closest("[role=option]");
      if (!item || item.getAttribute("aria-disabled") === "true") return;
      destacar(Number(item.dataset.indice));
      confirmar();
    });
  }

  function iniciar() {
    preparar(document);
    new MutationObserver(registros => {
      for (const registro of registros) {
        for (const no of registro.addedNodes) if (no.nodeType === 1) preparar(no);
      }
      if (campo && (!campo.isConnected || campo.matches(":disabled") || !campo.getClientRects().length ||
        registros.some(registro => registro.target === campo || campo.contains(registro.target)))) fechar();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });

    if (nativo) return;
    document.addEventListener("pointerdown", evento => {
      const seletor = evento.target.closest(campos);
      if (campo && !lista.contains(evento.target) && seletor !== campo) fechar();
      if (seletor && evento.button === 0 && !seletor.matches(":disabled")) {
        evento.preventDefault();
        seletor.focus({ preventScroll: true });
      }
    });
    document.addEventListener("click", evento => {
      const seletor = evento.target.closest(campos);
      if (!seletor) return;
      evento.preventDefault();
      if (campo === seletor) fechar(); else abrir(seletor);
    });
    document.addEventListener("keydown", evento => {
      const seletor = evento.target.closest(campos);
      if (!seletor || seletor.matches(":disabled")) return;
      const tecla = evento.key;
      if (tecla === "Escape" && campo) {
        evento.preventDefault(); evento.stopPropagation(); fechar(); return;
      }
      if (tecla === "Tab") { if (campo) confirmar(); return; }
      if (evento.ctrlKey || evento.metaKey || (evento.altKey && !["ArrowDown", "ArrowUp"].includes(tecla))) return;
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(tecla)) {
        evento.preventDefault();
        if (!campo) { abrir(seletor); return; }
        if (["Enter", " "].includes(tecla)) confirmar();
        else if (evento.altKey && tecla === "ArrowUp") confirmar();
        else mover(["ArrowDown", "Home"].includes(tecla) ? 1 : -1, ["Home", "End"].includes(tecla));
      } else if (tecla.length === 1) {
        evento.preventDefault();
        if (!campo) abrir(seletor);
        const agora = Date.now();
        busca = agora - ultimaTecla > 700 ? tecla : busca + tecla;
        ultimaTecla = agora;
        const normalizar = texto => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
        const termo = normalizar(busca);
        const repetida = [...termo].every(letra => letra === termo[0]);
        const candidatos = opcoes.map((_, indice) => (ativo + (repetida ? 1 : 0) + indice + opcoes.length) % opcoes.length);
        const indice = candidatos.find(indice => !opcoes[indice].disabled && normalizar(opcoes[indice].texto).startsWith(repetida ? termo[0] : termo));
        if (indice !== undefined) destacar(indice);
      }
    }, true);
    document.addEventListener("focusin", evento => { if (campo && evento.target !== campo && !lista.contains(evento.target)) fechar(); });
    document.addEventListener("scroll", evento => { if (campo && !lista.contains(evento.target)) fechar(); }, true);
    document.addEventListener("reset", fechar, true);
    document.addEventListener("close", fechar, true);
    window.addEventListener("resize", fechar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
