// Rolagem contínua e arrastável da faixa de parceiros.
(function () {
  "use strict";

  const faixa = document.getElementById("parceiros-faixa");
  const lista = document.getElementById("parceiros-lista");

  if (!faixa || !lista) return;

  const parceiros = Array.from(lista.querySelectorAll(".parceiro-item"));
  if (!parceiros.length) return;

  let primeiroClone = null;
  let pausado = false;
  let tempoAnterior = 0;
  let mouseSobreFaixa = false;
  let focoNaFaixa = false;
  let arrastando = false;
  let inicioArrasteX = 0;
  let scrollInicial = 0;

  const VELOCIDADE_PIXELS_POR_SEGUNDO = 34;
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function prepararParceiro(item) {
    const imagem = item.querySelector("img");
    if (!imagem) return;

    imagem.setAttribute("draggable", "false");
    imagem.addEventListener("dragstart", (evento) => evento.preventDefault());
    imagem.addEventListener("error", () => item.remove(), { once: true });
  }

  function duplicarParceiros() {
    parceiros.forEach((parceiro, indice) => {
      parceiro.classList.remove("d-none");
      prepararParceiro(parceiro);

      const clone = parceiro.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      prepararParceiro(clone);
      lista.appendChild(clone);

      if (indice === 0) {
        primeiroClone = clone;
      }
    });
  }

  function obterLarguraDoCiclo() {
    return primeiroClone ? primeiroClone.offsetLeft : lista.scrollWidth / 2;
  }

  function aplicarScrollCircular(proximoScroll) {
    const larguraDoCiclo = obterLarguraDoCiclo();
    if (larguraDoCiclo <= 0) return;

    let scroll = proximoScroll;

    while (scroll >= larguraDoCiclo) {
      scroll -= larguraDoCiclo;
    }

    while (scroll < 0) {
      scroll += larguraDoCiclo;
    }

    faixa.scrollLeft = scroll;
  }

  function atualizarPausa() {
    pausado = mouseSobreFaixa || focoNaFaixa || arrastando;
  }

  function iniciarArraste(evento) {
    if (evento.button !== undefined && evento.button !== 0) return;

    arrastando = true;
    inicioArrasteX = evento.clientX;
    scrollInicial = faixa.scrollLeft;
    atualizarPausa();

    if (faixa.setPointerCapture && evento.pointerId !== undefined) {
      try {
        faixa.setPointerCapture(evento.pointerId);
      } catch (erro) {
        // Alguns eventos sintéticos não permitem captura do ponteiro.
      }
    }

    evento.preventDefault();
  }

  function moverArraste(evento) {
    if (!arrastando) return;

    const deslocamento = evento.clientX - inicioArrasteX;
    aplicarScrollCircular(scrollInicial - deslocamento);
    evento.preventDefault();
  }

  function finalizarArraste(evento) {
    if (!arrastando) return;

    arrastando = false;

    if (faixa.releasePointerCapture && evento.pointerId !== undefined) {
      try {
        faixa.releasePointerCapture(evento.pointerId);
      } catch (erro) {
        // O navegador pode soltar a captura antes do evento final.
      }
    }

    atualizarPausa();
  }

  function animar(tempoAtual) {
    if (!tempoAnterior) {
      tempoAnterior = tempoAtual;
    }

    const tempoDecorrido = tempoAtual - tempoAnterior;
    tempoAnterior = tempoAtual;

    if (!pausado) {
      const deslocamento = (VELOCIDADE_PIXELS_POR_SEGUNDO * tempoDecorrido) / 1000;
      aplicarScrollCircular(faixa.scrollLeft + deslocamento);
    }

    window.requestAnimationFrame(animar);
  }

  duplicarParceiros();

  faixa.addEventListener("mouseenter", () => {
    mouseSobreFaixa = true;
    atualizarPausa();
  });

  faixa.addEventListener("mouseleave", () => {
    mouseSobreFaixa = false;
    atualizarPausa();
  });

  faixa.addEventListener("focusin", () => {
    focoNaFaixa = true;
    atualizarPausa();
  });

  faixa.addEventListener("focusout", () => {
    focoNaFaixa = false;
    atualizarPausa();
  });

  faixa.addEventListener("pointerdown", iniciarArraste);
  faixa.addEventListener("pointermove", moverArraste);
  faixa.addEventListener("pointerup", finalizarArraste);
  faixa.addEventListener("pointercancel", finalizarArraste);
  faixa.addEventListener("lostpointercapture", finalizarArraste);
  faixa.addEventListener("scroll", () => aplicarScrollCircular(faixa.scrollLeft), { passive: true });

  if (!reduzirMovimento) {
    window.requestAnimationFrame(animar);
  }
})();
