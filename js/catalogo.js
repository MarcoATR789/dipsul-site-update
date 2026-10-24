(function () {
  "use strict";

  const ROTA_LIMPA_CATALOGO = window.location.pathname.endsWith("/pages/catalogo/");
  const BASE_ARQUIVOS_CATALOGO = ROTA_LIMPA_CATALOGO ? "../../" : "../";
  const URL_DADOS_CATALOGO = `${BASE_ARQUIVOS_CATALOGO}data/catalogo/produtos.json`;
  const BASE_IMAGENS_CATALOGO = `${BASE_ARQUIVOS_CATALOGO}img/catalogo/imagens/`;
  const IMAGEM_PADRAO_CATALOGO = `${BASE_ARQUIVOS_CATALOGO}img/catalogo/sem-imagem.webp`;
  const ITENS_PADRAO_POR_PAGINA = 40;
  const OPCOES_ITENS_POR_PAGINA = [20, 40, 80];
  const TEMPO_ESPERA_BUSCA_MS = 250;
  const ORDEM_CATEGORIAS = [
    "medicamentos-veterinarios",
    "minerais",
    "instrumentos-veterinarios",
    "pet",
    "pet-caes-e-gatos",
    "raticida-e-inseticida",
    "cordas",
    "ferragens",
    "ferramentas",
    "materiais-eletricos",
    "materiais-para-construcao",
    "maquinas-eletricas",
    "adesivos",
    "lubrificantes-e-oleos",
    "selaria",
    "pecuaria",
    "aviario-telas-e-lonas",
    "suinocultura",
    "apicultura",
    "jardinagem",
    "camping-caca-pesca",
    "e-p-i",
    "utilidades-e-utensilios",
    "capas-de-chuva-guarda-chuva",
    "embalagens",
    "supermercado",
    "fogao",
    "sementes"
  ];
  const ORDEM_CATEGORIAS_MAPA = new Map(ORDEM_CATEGORIAS.map((slug, indice) => [slug, indice]));

  const estado = {
    produtos: [],
    produtosFiltrados: [],
    categorias: [],
    busca: "",
    categoria: "",
    pagina: 1,
    itensPorPagina: ITENS_PADRAO_POR_PAGINA,
    controladorCarregamento: null,
    catalogoCarregado: false
  };

  const tela = {
    formulario: document.getElementById("catalogo-filtros"),
    busca: document.getElementById("catalogo-busca"),
    categoria: document.getElementById("catalogo-categoria"),
    limpar: document.getElementById("catalogo-limpar"),
    itensPorPagina: document.getElementById("catalogo-itens-por-pagina"),
    contador: document.getElementById("catalogo-contagem-resultados"),
    produtos: document.getElementById("catalogo-produtos"),
    carregando: document.getElementById("catalogo-carregando"),
    vazio: document.getElementById("catalogo-vazio"),
    erro: document.getElementById("catalogo-erro"),
    tentarNovamente: document.getElementById("catalogo-tentar-novamente"),
    paginacao: document.getElementById("catalogo-paginacao"),
    status: document.getElementById("catalogo-status")
  };

  function normalizar(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aguardarPausa(funcao, espera) {
    let temporizador = null;

    return function executarDepoisDaPausa(...argumentos) {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => funcao.apply(this, argumentos), espera);
    };
  }

  function definirOculto(elemento, oculto) {
    if (elemento) {
      elemento.hidden = oculto;
    }
  }

  function limparElemento(elemento) {
    if (!elemento) return;

    while (elemento.firstChild) {
      elemento.removeChild(elemento.firstChild);
    }
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

  function aplicarFallbackImagem(imagem) {
    imagem.addEventListener("error", function () {
      if (imagem.dataset.alternativaAplicada === "true") return;

      imagem.dataset.alternativaAplicada = "true";
      imagem.src = IMAGEM_PADRAO_CATALOGO;
    });
  }

  function lerEstadoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const itensUrl = Number(parametros.get("itens"));
    const paginaUrl = Number(parametros.get("pagina"));

    estado.busca = (parametros.get("busca") || "").trim();
    estado.categoria = (parametros.get("categoria") || "").trim();
    estado.pagina = Number.isFinite(paginaUrl) && paginaUrl > 0 ? Math.floor(paginaUrl) : 1;
    estado.itensPorPagina = OPCOES_ITENS_POR_PAGINA.includes(itensUrl)
      ? itensUrl
      : ITENS_PADRAO_POR_PAGINA;

    if (tela.busca) tela.busca.value = estado.busca;
    if (tela.itensPorPagina) tela.itensPorPagina.value = String(estado.itensPorPagina);
  }

  function atualizarUrl(registrarHistorico) {
    const parametros = new URLSearchParams();

    if (estado.busca) parametros.set("busca", estado.busca);
    if (estado.categoria) parametros.set("categoria", estado.categoria);
    if (estado.pagina > 1) parametros.set("pagina", String(estado.pagina));
    if (estado.itensPorPagina !== ITENS_PADRAO_POR_PAGINA) {
      parametros.set("itens", String(estado.itensPorPagina));
    }

    const query = parametros.toString();
    const novaUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const metodo = registrarHistorico ? "pushState" : "replaceState";

    window.history[metodo]({}, "", novaUrl);
  }

  function mostrarCarregando() {
    definirOculto(tela.carregando, false);
    definirOculto(tela.vazio, true);
    definirOculto(tela.erro, true);
    limparElemento(tela.produtos);
    limparElemento(tela.paginacao);

    if (tela.contador) {
      tela.contador.textContent = "Carregando produtos...";
    }
  }

  function mostrarErro(erro) {
    console.error("Erro ao carregar catálogo:", erro);
    definirOculto(tela.carregando, true);
    definirOculto(tela.vazio, true);
    definirOculto(tela.erro, false);
    limparElemento(tela.produtos);
    limparElemento(tela.paginacao);

    if (tela.contador) tela.contador.textContent = "Não foi possível carregar o catálogo.";
    if (tela.status) tela.status.textContent = "Não foi possível carregar o catálogo.";
  }

  function montarCategorias() {
    const mapa = new Map();

    estado.produtos.forEach((produto) => {
      if (produto.categoriaSlug && produto.categoria && !mapa.has(produto.categoriaSlug)) {
        mapa.set(produto.categoriaSlug, produto.categoria);
      }
    });

    estado.categorias = Array.from(mapa.entries())
      .map(([slug, nome]) => ({ slug, nome }))
      .sort((a, b) => {
        const ordemA = ORDEM_CATEGORIAS_MAPA.has(a.slug)
          ? ORDEM_CATEGORIAS_MAPA.get(a.slug)
          : Number.MAX_SAFE_INTEGER;
        const ordemB = ORDEM_CATEGORIAS_MAPA.has(b.slug)
          ? ORDEM_CATEGORIAS_MAPA.get(b.slug)
          : Number.MAX_SAFE_INTEGER;

        return ordemA !== ordemB
          ? ordemA - ordemB
          : a.nome.localeCompare(b.nome, "pt-BR");
      });

    limparElemento(tela.categoria);

    const todas = document.createElement("option");
    todas.value = "";
    todas.textContent = "Todas as categorias";
    tela.categoria.appendChild(todas);

    estado.categorias.forEach((categoria) => {
      const opcao = document.createElement("option");
      opcao.value = categoria.slug;
      opcao.textContent = categoria.nome;
      tela.categoria.appendChild(opcao);
    });

    if (estado.categoria && estado.categorias.some((categoria) => categoria.slug === estado.categoria)) {
      tela.categoria.value = estado.categoria;
      return;
    }

    estado.categoria = "";
    tela.categoria.value = "";
  }

  function aplicarFiltros() {
    const buscaNormalizada = normalizar(estado.busca);
    const termos = buscaNormalizada ? buscaNormalizada.split(" ") : [];

    estado.produtosFiltrados = estado.produtos.filter((produto) => {
      if (estado.categoria && produto.categoriaSlug !== estado.categoria) {
        return false;
      }

      if (!termos.length) {
        return true;
      }

      const textoBusca = produto.busca || normalizar(`${produto.codigo} ${produto.descricao} ${produto.categoria}`);
      return termos.every((termo) => textoBusca.includes(termo));
    });

    const totalPaginas = obterTotalPaginas();
    if (estado.pagina > totalPaginas) {
      estado.pagina = totalPaginas;
    }
  }

  function obterTotalPaginas() {
    return Math.max(1, Math.ceil(estado.produtosFiltrados.length / estado.itensPorPagina));
  }

  function criarLinkProduto(produto) {
    const parametros = new URLSearchParams();
    parametros.set("codigo", produto.codigo);

    const estadoCatalogo = new URLSearchParams(window.location.search);
    estadoCatalogo.delete("codigo");

    if (estadoCatalogo.toString()) {
      const paginaCatalogo = ROTA_LIMPA_CATALOGO ? "../catalogo/" : "catalogo.html";
      parametros.set("voltar", `${paginaCatalogo}?${estadoCatalogo.toString()}`);
    }

    const paginaProduto = ROTA_LIMPA_CATALOGO ? "../produto/" : "produto.html";
    return `${paginaProduto}?${parametros.toString()}`;
  }

  function criarCartaoProduto(produto) {
    const cartao = document.createElement("article");
    cartao.className = "catalogo-produto-cartao";

    const linkProduto = document.createElement("a");
    linkProduto.className = "catalogo-produto-link";
    linkProduto.href = criarLinkProduto(produto);
    linkProduto.setAttribute("aria-label", `Ver produto ${produto.descricao}`);

    const areaImagem = document.createElement("div");
    areaImagem.className = "catalogo-produto-imagem";

    const imagem = document.createElement("img");
    imagem.src = obterUrlImagem(produto);
    imagem.alt = produto.descricao;
    imagem.loading = "lazy";
    imagem.decoding = "async";
    imagem.width = 220;
    imagem.height = 220;
    aplicarFallbackImagem(imagem);

    const corpo = document.createElement("div");
    corpo.className = "catalogo-produto-corpo";

    const codigo = document.createElement("span");
    codigo.className = "catalogo-produto-codigo";
    codigo.textContent = `Código: ${produto.codigo}`;

    const titulo = document.createElement("h2");
    titulo.className = "catalogo-produto-titulo";
    titulo.textContent = produto.descricao;

    const categoria = document.createElement("p");
    categoria.className = "catalogo-produto-categoria";
    categoria.textContent = produto.categoria;

    const controlesPedido = document.createElement("div");
    controlesPedido.className = "catalogo-produto-pedido";

    const quantidadeId = `catalogo-quantidade-${normalizar(produto.codigo).replace(/\s+/g, "-")}`;
    const legendaQuantidade = document.createElement("label");
    legendaQuantidade.className = "sr-only";
    legendaQuantidade.setAttribute("for", quantidadeId);
    legendaQuantidade.textContent = `Quantidade de ${produto.descricao}`;

    const campoQuantidade = document.createElement("input");
    campoQuantidade.type = "number";
    campoQuantidade.id = quantidadeId;
    campoQuantidade.className = "form-control catalogo-produto-quantidade";
    campoQuantidade.value = "1";
    window.DipsulPedidos.configurarQuantidade(campoQuantidade);

    const botaoAdicionar = document.createElement("button");
    botaoAdicionar.type = "button";
    botaoAdicionar.className = "btn btn-primary btn-sm catalogo-produto-adicionar";
    botaoAdicionar.textContent = "Adicionar";
    botaoAdicionar.addEventListener("click", () => {
      window.DipsulPedidos.adicionar(produto, campoQuantidade.value);
      campoQuantidade.value = "1";
    });

    areaImagem.appendChild(imagem);
    corpo.appendChild(codigo);
    corpo.appendChild(titulo);
    corpo.appendChild(categoria);
    linkProduto.appendChild(areaImagem);
    linkProduto.appendChild(corpo);
    controlesPedido.appendChild(legendaQuantidade);
    controlesPedido.appendChild(campoQuantidade);
    controlesPedido.appendChild(botaoAdicionar);
    cartao.appendChild(linkProduto);
    cartao.appendChild(controlesPedido);

    return cartao;
  }

  function renderizarProdutos() {
    limparElemento(tela.produtos);

    const inicio = (estado.pagina - 1) * estado.itensPorPagina;
    const fim = inicio + estado.itensPorPagina;
    const produtosPagina = estado.produtosFiltrados.slice(inicio, fim);

    produtosPagina.forEach((produto) => {
      tela.produtos.appendChild(criarCartaoProduto(produto));
    });
  }

  function criarBotaoPaginacao(texto, pagina, desabilitado, atual) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = atual ? "catalogo-paginacao-botao esta-ativa" : "catalogo-paginacao-botao";
    botao.textContent = texto;
    botao.disabled = desabilitado;

    if (atual) {
      botao.setAttribute("aria-current", "page");
    }

    botao.addEventListener("click", () => {
      if (desabilitado || pagina === estado.pagina) return;

      estado.pagina = pagina;
      atualizarUrl(false);
      renderizar();
      rolarParaCatalogo();
    });

    return botao;
  }

  function adicionarReticenciasPaginacao() {
    const reticencias = document.createElement("span");
    reticencias.className = "catalogo-paginacao-reticencias";
    reticencias.textContent = "...";
    tela.paginacao.appendChild(reticencias);
  }

  function renderizarPaginacao() {
    limparElemento(tela.paginacao);

    const totalPaginas = obterTotalPaginas();
    if (totalPaginas <= 1) return;

    tela.paginacao.appendChild(criarBotaoPaginacao(
      "Anterior",
      Math.max(1, estado.pagina - 1),
      estado.pagina === 1,
      false
    ));

    const inicio = Math.max(1, estado.pagina - 2);
    const fim = Math.min(totalPaginas, estado.pagina + 2);

    if (inicio > 1) {
      tela.paginacao.appendChild(criarBotaoPaginacao("1", 1, false, estado.pagina === 1));

      if (inicio > 2) {
        adicionarReticenciasPaginacao();
      }
    }

    for (let pagina = inicio; pagina <= fim; pagina += 1) {
      tela.paginacao.appendChild(criarBotaoPaginacao(String(pagina), pagina, false, pagina === estado.pagina));
    }

    if (fim < totalPaginas) {
      if (fim < totalPaginas - 1) {
        adicionarReticenciasPaginacao();
      }

      tela.paginacao.appendChild(criarBotaoPaginacao(
        String(totalPaginas),
        totalPaginas,
        false,
        estado.pagina === totalPaginas
      ));
    }

    tela.paginacao.appendChild(criarBotaoPaginacao(
      "Próxima",
      Math.min(totalPaginas, estado.pagina + 1),
      estado.pagina === totalPaginas,
      false
    ));
  }

  function atualizarResumo() {
    const total = estado.produtosFiltrados.length;
    const totalPaginas = obterTotalPaginas();
    const texto = total === 1
      ? `1 produto encontrado. Página ${estado.pagina} de ${totalPaginas}.`
      : `${total} produtos encontrados. Página ${estado.pagina} de ${totalPaginas}.`;

    if (tela.contador) tela.contador.textContent = texto;
    if (tela.status) tela.status.textContent = texto;
  }

  function renderizar() {
    aplicarFiltros();
    definirOculto(tela.carregando, true);
    definirOculto(tela.erro, true);
    definirOculto(tela.vazio, estado.produtosFiltrados.length > 0);

    renderizarProdutos();
    renderizarPaginacao();
    atualizarResumo();
  }

  function rolarParaCatalogo() {
    const catalogo = document.querySelector(".catalogo-listagem");
    if (!catalogo) return;

    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const topo = catalogo.getBoundingClientRect().top + window.pageYOffset - 90;

    window.scrollTo({
      top: topo,
      behavior: reduzMovimento ? "auto" : "smooth"
    });
  }

  async function carregarCatalogo() {
    if (estado.controladorCarregamento) {
      estado.controladorCarregamento.abort();
    }

    if (estado.catalogoCarregado) {
      renderizar();
      return;
    }

    estado.controladorCarregamento = new AbortController();
    mostrarCarregando();

    try {
      const resposta = await fetch(URL_DADOS_CATALOGO, {
        signal: estado.controladorCarregamento.signal,
        cache: "no-cache"
      });

      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}`);
      }

      const produtos = await resposta.json();

      if (!Array.isArray(produtos)) {
        throw new Error("O arquivo produtos.json não retornou uma lista.");
      }

      estado.produtos = produtos;
      estado.catalogoCarregado = true;
      montarCategorias();
      renderizar();
    } catch (erro) {
      if (erro.name === "AbortError") return;

      mostrarErro(erro);
    }
  }

  function limparFiltros() {
    estado.busca = "";
    estado.categoria = "";
    estado.pagina = 1;
    estado.itensPorPagina = ITENS_PADRAO_POR_PAGINA;

    if (tela.busca) tela.busca.value = "";
    if (tela.categoria) tela.categoria.value = "";
    if (tela.itensPorPagina) tela.itensPorPagina.value = String(ITENS_PADRAO_POR_PAGINA);

    atualizarUrl(false);
    renderizar();
  }

  function configurarEventos() {
    const buscarComPausa = aguardarPausa(() => {
      estado.busca = tela.busca.value.trim();
      estado.pagina = 1;
      atualizarUrl(false);
      renderizar();
    }, TEMPO_ESPERA_BUSCA_MS);

    tela.formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
    });

    tela.busca.addEventListener("input", buscarComPausa);

    tela.categoria.addEventListener("change", () => {
      estado.categoria = tela.categoria.value;
      estado.pagina = 1;
      atualizarUrl(false);
      renderizar();
    });

    tela.itensPorPagina.addEventListener("change", () => {
      const valor = Number(tela.itensPorPagina.value);
      estado.itensPorPagina = OPCOES_ITENS_POR_PAGINA.includes(valor) ? valor : ITENS_PADRAO_POR_PAGINA;
      estado.pagina = 1;
      atualizarUrl(false);
      renderizar();
    });

    tela.limpar.addEventListener("click", limparFiltros);
    tela.tentarNovamente.addEventListener("click", () => {
      estado.catalogoCarregado = false;
      carregarCatalogo();
    });

    window.addEventListener("popstate", () => {
      lerEstadoDaUrl();
      if (tela.categoria) tela.categoria.value = estado.categoria;
      renderizar();
    });
  }

  function iniciarCatalogo() {
    if (!tela.formulario || !tela.produtos) return;

    lerEstadoDaUrl();
    configurarEventos();
    carregarCatalogo();
  }

  document.addEventListener("DOMContentLoaded", iniciarCatalogo);
})();
