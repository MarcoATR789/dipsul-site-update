// BARRA DE PARCEIROS DO SITE.
(function () {
  "use strict";

  const faixa = document.getElementById("parceiros-faixa");
  const lista = document.getElementById("parceiros-lista");

  if (!faixa || !lista) return;

  const parceiros = Array.from(lista.querySelectorAll(".parceiro-item"));
  if (!parceiros.length) return;

  // CONTROLA O ESTADO DA ANIMAÇÃO MANUAL.
  let primeiroClone = null;
  let pausado = false;
  let tempoAnterior = 0;
  let mouseSobreFaixa = false;
  let fofoFaixa = false;
  let arrastando = false;
  let inicioArrasteX = 0;
  let scrollInicial = 0;

  // VELOCIDADE DE PIXELS POR SEGUNDO.
  const VELOCIDADE_PIXELS = 34;
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // DESATIVA O ARRASTE NATIVO DAS IMAGENS E REMOVE ITENS COM ERRO.
  function prepararParceiro(item) {
    const imagem = item.querySelector("img");
    if (!imagem) return;

    imagem.setAttribute("draggable", "false");
    imagem.addEventListener("dragstart", (evento) => evento.preventDefault());
    imagem.addEventListener("error", () => item.remove(), { once: true });
  }

  // DUPLICA OS PARCEIROS PARA CRIAR O EFEITO DE ROLAGEM INFINITA.
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

  // IDENTIFICA A DISTÂNCIA NECESSÁRIA PARA COMPLETAR UM CICLO.
  function obterLarguraDoCiclo() {
    return primeiroClone ? primeiroClone.offsetLeft : lista.scrollWidth / 2;
  }

  // MANTÉM O SCROLL DENTRO DO CICLO, EVITANDO QUE A LISTA TERMINE.
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

  // PAUSA A ANIMAÇÃO DURANTE INTERAÇÃO OU NAVEGAÇÃO POR TECLADO.
  function atualizarPausa() {
    pausado = mouseSobreFaixa || fofoFaixa || arrastando;
  }

  // INICIA O ARRASTE E GUARDA A POSIÇÃO INICIAL DO SCROLL.
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
      }
    }

    evento.preventDefault();
  }

  // MOVE A LISTA DE ACORDO COM O DESLOCAMENTO DO PONTEIRO.
  function moverArraste(evento) {
    if (!arrastando) return;

    const deslocamento = evento.clientX - inicioArrasteX;
    aplicarScrollCircular(scrollInicial - deslocamento);
    evento.preventDefault();
  }

  // FINALIZA O ARRASTE E DEVOLVE O CONTROLE À ANIMAÇÃO.
  function finalizarArraste(evento) {
    if (!arrastando) return;

    arrastando = false;

    if (faixa.releasePointerCapture && evento.pointerId !== undefined) {
      try {
        faixa.releasePointerCapture(evento.pointerId);
      } catch (erro) {
      }
    }

    atualizarPausa();
  }

  // AVANÇA A LISTA AUTOMATICAMENTE COM BASE NO TEMPO DECORRIDO.
  function animar(tempoAtual) {
    if (!tempoAnterior) {
      tempoAnterior = tempoAtual;
    }

    const tempoDecorrido = tempoAtual - tempoAnterior;
    tempoAnterior = tempoAtual;

    if (!pausado) {
      const deslocamento = (VELOCIDADE_PIXELS * tempoDecorrido) / 1000;
      aplicarScrollCircular(faixa.scrollLeft + deslocamento);
    }

    window.requestAnimationFrame(animar);
  }

  // PREPARA A LISTA DUPLICADA ANTES DE REGISTRAR AS INTERAÇÕES.
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
    fofoFaixa = true;
    atualizarPausa();
  });

  faixa.addEventListener("focusout", () => {
    fofoFaixa = false;
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
