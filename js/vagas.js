jQuery(function ($) {
  "use strict";

  const CONFIGURACAO = {
    larguraPadraoImagem: 1080,
    alturaPadraoImagem: 1920,
    preenchimentoModal: 60,
    descontoAlturaModal: 140,
    margemLateral: 60,
    extensoesImagem: ["jpg", "png"]
  };

  const SLUG_DAS_VAGAS = {
    "Assistente de Faturamento - Tubarão": "assistente-de-faturamento-tubarao",
    "Ajudante de Produção - Tubarão": "ajudante-de-producao-tubarao",
    "Conferente de Mercadorias - Tubarão": "conferente-de-mercadorias-tubarao",
    "Coordenador - Chapecó": "coordenador-chapeco",
    "Coordenador - Montenegro": "coordenador-montenegro",
    "Coordenador - Tubarão": "coordenador-tubarao",
    "Motorista - Chapecó": "motorista-chapeco",
    "Motorista - Montenegro": "motorista-montenegro",
    "Menor Aprendiz - Matutino": "menor-aprendiz-matutino",
    "Menor Aprendiz - Vespertino": "menor-aprendiz-vespertino",
    "Promotor de Vendas - SC": "promotor-vendas-sc",
    "Promotor de Vendas - RS": "promotor-vendas-rs"
  };

  let imagemAtual = null;

  function gerarSlug(texto) {
    let normalizado = String(texto || "");

    if (typeof normalizado.normalize === "function") {
      normalizado = normalizado.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } else {
      normalizado = normalizado
        .replace(/[ÀÁÂÃÄÅàáâãäå]/g, "a")
        .replace(/[Ææ]/g, "ae")
        .replace(/[Çç]/g, "c")
        .replace(/[ÈÉÊËèéêë]/g, "e")
        .replace(/[ÌÍÎÏìíîï]/g, "i")
        .replace(/[Ññ]/g, "n")
        .replace(/[ÒÓÔÕÖØòóôõöø]/g, "o")
        .replace(/[ÙÚÛÜùúûü]/g, "u")
        .replace(/[Ýýÿ]/g, "y");
    }

    return normalizado
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function obterTamanhoImagem(imagem) {
    return {
      largura: imagem.naturalWidth || CONFIGURACAO.larguraPadraoImagem,
      altura: imagem.naturalHeight || CONFIGURACAO.alturaPadraoImagem
    };
  }

  function obterLimitesTela() {
    return {
      larguraMaxima: Math.max(100, $(window).width() - CONFIGURACAO.margemLateral),
      alturaMaxima: Math.max(100, $(window).height() - CONFIGURACAO.descontoAlturaModal)
    };
  }

  function ajustarModalParaImagem(imagem) {
    if (!imagem) return;

    const tamanho = obterTamanhoImagem(imagem);
    const limites = obterLimitesTela();
    const escala = Math.min(
      1,
      limites.larguraMaxima / tamanho.largura,
      limites.alturaMaxima / tamanho.altura
    );
    const larguraExibida = Math.round(tamanho.largura * escala);

    $("#vaga-preview-imagem").css({
      width: `${larguraExibida}px`,
      height: "auto",
      "max-width": `${limites.larguraMaxima}px`,
      "max-height": `${limites.alturaMaxima}px`,
      display: "block",
      margin: "0 auto"
    });

    $("#vaga-preview-modal .modal-dialog").css({
      "max-width": `${larguraExibida + CONFIGURACAO.preenchimentoModal}px`,
      width: "auto"
    });
  }

  function limparEstiloModal() {
    $("#vaga-preview-modal .modal-dialog").css({ "max-width": "" });
    $("#vaga-preview-imagem").css({
      width: "",
      height: "",
      "max-width": "",
      "max-height": ""
    });
  }

  function notificar(mensagem, erro = false) {
    if (window.Dipsul && typeof window.Dipsul.notificar === "function") {
      window.Dipsul.notificar(mensagem, { tipo: erro ? "erro" : "status" });
      return;
    }

    console[erro ? "error" : "log"](mensagem);
  }

  function validarVagaSelecionada() {
    const campoVaga = $("#vaga-selecao");

    if (!campoVaga.val()) {
      campoVaga[0].classList.add("is-invalid");
      notificar("Selecione uma vaga disponível.", true);
      try {
        campoVaga[0].focus();
      } catch (erro) {
        // O foco pode falhar se o navegador bloquear a ação.
      }
      return false;
    }

    campoVaga[0].classList.remove("is-invalid");
    return true;
  }

  function obterCaminhoImagemVaga(titulo) {
    const slug = SLUG_DAS_VAGAS[titulo] || gerarSlug(titulo);
    return `img/vagas/${slug}`;
  }

  function abrirModal() {
    $(window).off("resize.visualizarVaga").on("resize.visualizarVaga", function () {
      ajustarModalParaImagem(imagemAtual);
    });

    $("#vaga-preview-modal").off("hidden.bs.modal.visualizarVaga").on("hidden.bs.modal.visualizarVaga", function () {
      $(window).off("resize.visualizarVaga");
      imagemAtual = null;
      limparEstiloModal();
    });

    $("#vaga-preview-modal").modal("show");
  }

  function usarImagemPadrao() {
    const imagemPadrao = $("#vaga-preview-imagem");

    if (imagemPadrao.length && imagemPadrao[0].complete) {
      ajustarModalParaImagem(imagemPadrao[0]);
    } else if (imagemPadrao.length) {
      imagemPadrao.off("load.visualizarVaga").on("load.visualizarVaga", function () {
        ajustarModalParaImagem(this);
      });
    }

    abrirModal();
  }

  function carregarImagemVaga(caminhoBase) {
    const imagem = new Image();
    let indiceExtensao = 0;
    imagemAtual = imagem;

    imagem.onload = function () {
      ajustarModalParaImagem(this);
      $("#vaga-preview-imagem").attr("src", this.src);
      abrirModal();
    };

    imagem.onerror = function () {
      if (indiceExtensao < CONFIGURACAO.extensoesImagem.length - 1) {
        indiceExtensao += 1;
        imagem.src = `${caminhoBase}.${CONFIGURACAO.extensoesImagem[indiceExtensao]}`;
        return;
      }

      usarImagemPadrao();
    };

    imagem.src = `${caminhoBase}.${CONFIGURACAO.extensoesImagem[0]}`;
  }

  $("#ver-vaga-botao").on("click", function () {
    if (!validarVagaSelecionada()) return;

    const tituloVaga = $("#vaga-selecao").val();
    carregarImagemVaga(obterCaminhoImagemVaga(tituloVaga));
  });
});
