(function () {
  "use strict";

  const ROTA_LIMPA = window.location.pathname.endsWith("/pages/produto/");
  const BASE_ARQUIVOS = ROTA_LIMPA ? "../../" : "../";
  const URL_DADOS_CATALOGO = `${BASE_ARQUIVOS}data/catalogo/produtos.json`;
  const BASE_IMAGENS_CATALOGO = `${BASE_ARQUIVOS}img/catalogo/imagens/`;
  const IMAGEM_PADRAO_CATALOGO = `${BASE_ARQUIVOS}img/catalogo/sem-imagem.webp`;

  const elementos = {
    carregando: document.getElementById("produto-carregando"),
    erro: document.getElementById("produto-erro"),
    detalhe: document.getElementById("produto-detalhe"),
    imagem: document.getElementById("produto-imagem"),
    codigo: document.getElementById("produto-codigo"),
    titulo: document.getElementById("produto-titulo"),
    categoria: document.getElementById("produto-categoria"),
    voltarLink: document.getElementById("produto-voltar-link"),
    voltarBotao: document.getElementById("produto-voltar-botao"),
    copiar: document.getElementById("produto-copiar"),
    compartilhar: document.getElementById("produto-compartilhar"),
    dadosEstruturados: document.getElementById("produto-jsonld"),
    metaDescricao: document.getElementById("produto-meta-descricao"),
    canonico: document.getElementById("produto-canonico")
  };

  function definirOculto(elemento, oculto) {
    if (elemento) elemento.hidden = oculto;
  }

  function avisar(mensagem, erro = false) {
    if (window.Dipsul && typeof window.Dipsul.notificar === "function") {
      window.Dipsul.notificar(mensagem, { tipo: erro ? "erro" : "status" });
      return;
    }

    console[erro ? "error" : "log"](mensagem);
  }

  function sanitizarImagem(nomeImagem) {
    const nome = String(nomeImagem || "").trim();

    if (!nome || nome.includes("..") || nome.includes("/") || nome.includes("\\") || /^[a-z]+:/i.test(nome)) {
      return "";
    }

    return nome;
  }

  function obterUrlImagem(produto) {
    const imagem = sanitizarImagem(produto && produto.imagem);
    return imagem ? `${BASE_IMAGENS_CATALOGO}${encodeURIComponent(imagem)}` : IMAGEM_PADRAO_CATALOGO;
  }

  function obterCodigoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    return String(parametros.get("codigo") || "").trim();
  }

  function obterRotaCatalogo() {
    return ROTA_LIMPA ? "../catalogo/" : "catalogo.html";
  }

  function obterCaminhosCatalogo() {
    const basePaginas = new URL(ROTA_LIMPA ? "../" : "./", window.location.href);

    return [
      new URL("catalogo.html", basePaginas).pathname,
      new URL("catalogo/", basePaginas).pathname
    ];
  }

  function obterVoltarSeguro() {
    const parametros = new URLSearchParams(window.location.search);
    const voltar = parametros.get("voltar");
    const caminhosCatalogo = obterCaminhosCatalogo();

    if (voltar) {
      try {
        const url = new URL(voltar, window.location.href);

        if (url.origin === window.location.origin && caminhosCatalogo.includes(url.pathname)) {
          return `${obterRotaCatalogo()}${url.search}`;
        }
      } catch (erro) {
        console.warn("Parâmetro voltar inválido:", erro);
      }
    }

    if (document.referrer) {
      try {
        const origem = new URL(document.referrer);

        if (origem.origin === window.location.origin && caminhosCatalogo.includes(origem.pathname)) {
          return `${obterRotaCatalogo()}${origem.search}`;
        }
      } catch (erro) {
        console.warn("Referrer inválido:", erro);
      }
    }

    return obterRotaCatalogo();
  }

  function atualizarVoltar() {
    const voltar = obterVoltarSeguro();

    if (elementos.voltarLink) elementos.voltarLink.href = voltar;
    if (elementos.voltarBotao) elementos.voltarBotao.href = voltar;
  }

  function aplicarFallbackImagem() {
    if (!elementos.imagem) return;

    elementos.imagem.addEventListener("error", function () {
      if (elementos.imagem.dataset.alternativaAplicada === "true") return;

      elementos.imagem.dataset.alternativaAplicada = "true";
      elementos.imagem.src = IMAGEM_PADRAO_CATALOGO;
    });
  }

  function atualizarSeo(produto) {
    const parametros = new URLSearchParams();
    parametros.set("codigo", produto.codigo);

    const urlCanonica = `${window.location.origin}${window.location.pathname}?${parametros.toString()}`;
    const descricao = `${produto.descricao} - código: ${produto.codigo}, categoria ${produto.categoria}.`;

    document.title = `${produto.descricao} (${produto.codigo}) - Dipsul`;

    if (elementos.metaDescricao) {
      elementos.metaDescricao.setAttribute("content", descricao);
    }

    if (elementos.canonico) {
      elementos.canonico.href = urlCanonica;
    }

    if (elementos.dadosEstruturados) {
      elementos.dadosEstruturados.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: produto.descricao,
        sku: produto.codigo,
        category: produto.categoria,
        image: new URL(obterUrlImagem(produto), window.location.href).href,
        url: urlCanonica
      });
    }
  }

  function mostrarProduto(produto) {
    definirOculto(elementos.carregando, true);
    definirOculto(elementos.erro, true);
    definirOculto(elementos.detalhe, false);

    elementos.imagem.src = obterUrlImagem(produto);
    elementos.imagem.alt = produto.descricao;
    elementos.codigo.textContent = `Código: ${produto.codigo}`;
    elementos.titulo.textContent = produto.descricao;
    elementos.categoria.textContent = `Categoria: ${produto.categoria}`;

    atualizarSeo(produto);
  }

  function mostrarErro(mensagem, erro) {
    if (erro) console.error(mensagem, erro);

    definirOculto(elementos.carregando, true);
    definirOculto(elementos.detalhe, true);
    definirOculto(elementos.erro, false);
  }

  function podeCompartilharNoCelular() {
    const suportaCompartilhar = typeof navigator.share === "function";
    const pareceCelular = window.matchMedia
      && window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)").matches;

    return suportaCompartilhar && pareceCelular;
  }

  function configurarAcoes(produto) {
    const url = window.location.href;
    const mostrarCompartilhar = podeCompartilharNoCelular();

    definirOculto(elementos.compartilhar, !mostrarCompartilhar);

    if (elementos.copiar) {
      elementos.copiar.addEventListener("click", async () => {
        try {
          await window.Dipsul.copiarTexto(url);
          avisar("Link copiado.");
        } catch (erro) {
          console.error("Erro ao copiar link:", erro);
          avisar("Não foi possível copiar o link.", true);
        }
      });
    }

    if (!mostrarCompartilhar || !elementos.compartilhar) return;

    elementos.compartilhar.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: `${produto.descricao} - Dipsul`,
          text: `${produto.descricao} (${produto.codigo})`,
          url
        });
        avisar("Produto compartilhado.");
      } catch (erro) {
        if (erro && erro.name === "AbortError") return;

        console.error("Erro ao compartilhar produto:", erro);
        avisar("Não foi possível compartilhar. Tente copiar o link.", true);
      }
    });
  }

  async function carregarProduto() {
    const codigo = obterCodigoDaUrl();

    atualizarVoltar();
    aplicarFallbackImagem();

    if (!codigo) {
      mostrarErro("Código do produto ausente.");
      return;
    }

    try {
      const resposta = await fetch(URL_DADOS_CATALOGO, { cache: "no-cache" });

      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}`);
      }

      const produtos = await resposta.json();

      if (!Array.isArray(produtos)) {
        throw new Error("O arquivo produtos.json não retornou uma lista.");
      }

      const produto = produtos.find((item) => String(item.codigo) === codigo);

      if (!produto) {
        mostrarErro(`Produto não encontrado: ${codigo}`);
        return;
      }

      mostrarProduto(produto);
      configurarAcoes(produto);
    } catch (erro) {
      mostrarErro("Erro ao carregar produto:", erro);
    }
  }

  document.addEventListener("DOMContentLoaded", carregarProduto);
})();
