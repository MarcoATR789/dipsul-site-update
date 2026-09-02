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
  const TEMPO_PREVIEW_PEDIDO_MS = 500;
  const QUANTIDADE_MAXIMA_PEDIDO = 500;
  const CHAVE_PEDIDO_SALVO = "dipsul_catalogo_pedido_v1";
  const SUPABASE_URL = "https://yypsfvlajycinrhmwykn.supabase.co";
  const SUPABASE_CHAVE_PUBLICA = "sb_publishable_0lRHqPKNvLuSjrfICsdZ8g_A8gluaXX";
  const SUPABASE_FUNCAO_PEDIDO = "catalogo_registrar_pedido";
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
    pedido: new Map(),
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
    pedidoResumo: document.getElementById("catalogo-pedido-resumo"),
    pedidoItens: document.getElementById("catalogo-pedido-itens"),
    pedidoCnpj: document.getElementById("catalogo-pedido-cnpj"),
    pedidoEmpresa: document.getElementById("catalogo-pedido-empresa"),
    pedidoLimpar: document.getElementById("catalogo-pedido-limpar"),
    pedidoEnviar: document.getElementById("catalogo-pedido-enviar"),
    pedidoPainel: document.getElementById("catalogo-pedido-painel"),
    pedidoBotao: document.getElementById("catalogo-pedido-botao"),
    pedidoFechar: document.getElementById("catalogo-pedido-fechar"),
    pedidoContador: document.getElementById("catalogo-pedido-contador"),
    status: document.getElementById("catalogo-status")
  };

  let temporizadorPreviewPedido = null;
  let pedidoAbertoAutomatico = false;
  let pedidoEnviando = false;

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

  function normalizarQuantidade(valor) {
    const quantidade = parseInt(valor, 10);

    if (!Number.isFinite(quantidade) || quantidade < 1) return 1;
    return Math.min(quantidade, QUANTIDADE_MAXIMA_PEDIDO);
  }

  function limitarCampoQuantidade(campo) {
    const digitos = String(campo.value || "").replace(/\D/g, "").slice(0, 3);

    if (!digitos) {
      campo.value = "";
      return;
    }

    campo.value = String(normalizarQuantidade(digitos));
  }

  function configurarCampoQuantidade(campo) {
    campo.min = "1";
    campo.max = String(QUANTIDADE_MAXIMA_PEDIDO);
    campo.step = "1";
    campo.inputMode = "numeric";
    campo.setAttribute("maxlength", "3");

    campo.addEventListener("input", () => limitarCampoQuantidade(campo));
    campo.addEventListener("change", () => {
      campo.value = String(normalizarQuantidade(campo.value));
    });
  }

  function obterDigitos(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function formatarCnpj(valor) {
    const digitos = obterDigitos(valor).slice(0, 14);

    return digitos
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function cnpjValido(valor) {
    const cnpj = obterDigitos(valor);

    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

    const calcularDigito = (base) => {
      const pesos = base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const soma = base.split("").reduce((total, digito, indice) => {
        return total + Number(digito) * pesos[indice];
      }, 0);
      const resto = soma % 11;

      return resto < 2 ? "0" : String(11 - resto);
    };

    const primeiro = calcularDigito(cnpj.slice(0, 12));
    const segundo = calcularDigito(cnpj.slice(0, 12) + primeiro);

    return cnpj.endsWith(`${primeiro}${segundo}`);
  }

  function configurarCampoCnpj() {
    if (!tela.pedidoCnpj) return;

    tela.pedidoCnpj.addEventListener("input", () => {
      tela.pedidoCnpj.value = formatarCnpj(tela.pedidoCnpj.value);
    });
  }

  function avisarPedido(texto, erro = false) {
    const mensagem = String(texto || "").trim();
    if (!mensagem) return;

    if (window.Dipsul && typeof window.Dipsul.notificar === "function") {
      window.Dipsul.notificar(mensagem, { tipo: erro ? "erro" : "status" });
    }

    if (tela.status) {
      tela.status.textContent = mensagem;
    }
  }

  function carregarPedidoSalvo() {
    try {
      const dadosSalvos = JSON.parse(localStorage.getItem(CHAVE_PEDIDO_SALVO) || "[]");

      if (!Array.isArray(dadosSalvos)) return;

      dadosSalvos.forEach((item) => {
        if (!item || !item.codigo || !item.descricao) return;

        estado.pedido.set(String(item.codigo), {
          codigo: String(item.codigo),
          descricao: String(item.descricao),
          quantidade: normalizarQuantidade(item.quantidade)
        });
      });
    } catch (erro) {
      console.warn("Não foi possível carregar a lista de pedido salva.", erro);
    }
  }

  function salvarPedido() {
    try {
      localStorage.setItem(CHAVE_PEDIDO_SALVO, JSON.stringify(Array.from(estado.pedido.values())));
    } catch (erro) {
      console.warn("Não foi possível salvar a lista de pedido.", erro);
    }
  }

  function definirPainelPedidoAberto(aberto, opcoes = {}) {
    if (!tela.pedidoPainel || !tela.pedidoBotao) return;

    tela.pedidoPainel.classList.toggle("esta-aberto", aberto);
    tela.pedidoPainel.setAttribute("aria-hidden", aberto ? "false" : "true");
    tela.pedidoPainel.inert = !aberto;
    tela.pedidoBotao.setAttribute("aria-expanded", aberto ? "true" : "false");

    if (aberto && opcoes.foco !== false) {
      const primeiroControle = tela.pedidoPainel.querySelector("input, button, a");
      if (primeiroControle) primeiroControle.focus();
    }
  }

  function cancelarPreviewPedido() {
    if (!temporizadorPreviewPedido) return;

    window.clearTimeout(temporizadorPreviewPedido);
    temporizadorPreviewPedido = null;
  }

  function fecharPainelPedido() {
    cancelarPreviewPedido();
    pedidoAbertoAutomatico = false;
    definirPainelPedidoAberto(false, { foco: false });
  }

  function mostrarPreviewPedido() {
    cancelarPreviewPedido();
    pedidoAbertoAutomatico = true;
    definirPainelPedidoAberto(true, { foco: false });

    temporizadorPreviewPedido = window.setTimeout(() => {
      temporizadorPreviewPedido = null;

      if (pedidoAbertoAutomatico) {
        pedidoAbertoAutomatico = false;
        definirPainelPedidoAberto(false, { foco: false });
      }
    }, TEMPO_PREVIEW_PEDIDO_MS);
  }

  function alternarPainelPedido() {
    const aberto = tela.pedidoPainel && tela.pedidoPainel.classList.contains("esta-aberto");

    if (aberto && pedidoAbertoAutomatico) {
      cancelarPreviewPedido();
      pedidoAbertoAutomatico = false;
      definirPainelPedidoAberto(true);
      return;
    }

    cancelarPreviewPedido();
    pedidoAbertoAutomatico = false;
    definirPainelPedidoAberto(!aberto);
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
    configurarCampoQuantidade(campoQuantidade);

    const botaoAdicionar = document.createElement("button");
    botaoAdicionar.type = "button";
    botaoAdicionar.className = "btn btn-primary btn-sm catalogo-produto-adicionar";
    botaoAdicionar.textContent = "Adicionar";
    botaoAdicionar.addEventListener("click", () => {
      adicionarItemPedido(produto, normalizarQuantidade(campoQuantidade.value));
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

  function adicionarItemPedido(produto, quantidade) {
    const codigo = String(produto.codigo);
    const itemAtual = estado.pedido.get(codigo);
    const quantidadeAtual = itemAtual ? itemAtual.quantidade : 0;
    const novaQuantidade = Math.min(
      quantidadeAtual + normalizarQuantidade(quantidade),
      QUANTIDADE_MAXIMA_PEDIDO
    );

    estado.pedido.set(codigo, {
      codigo,
      descricao: produto.descricao,
      quantidade: novaQuantidade
    });

    salvarPedido();
    renderizarPedido();
    mostrarPreviewPedido();

    if (tela.status) {
      tela.status.textContent = `${produto.descricao} adicionado à lista de pedido.`;
    }
  }

  function atualizarQuantidadePedido(codigo, quantidade) {
    const item = estado.pedido.get(codigo);
    if (!item) return;

    item.quantidade = normalizarQuantidade(quantidade);
    estado.pedido.set(codigo, item);
    salvarPedido();
    renderizarPedido();
  }

  function alterarQuantidadePedido(codigo, incremento) {
    const item = estado.pedido.get(codigo);
    if (!item) return;

    atualizarQuantidadePedido(codigo, item.quantidade + incremento);
  }

  function removerItemPedido(codigo) {
    estado.pedido.delete(codigo);
    salvarPedido();
    renderizarPedido();

    if (tela.status) {
      tela.status.textContent = "Item removido da lista de pedido.";
    }
  }

  function limparPedido() {
    estado.pedido.clear();
    salvarPedido();
    renderizarPedido();

    if (tela.status) {
      tela.status.textContent = "Lista de pedido limpa.";
    }
  }

  function obterItensPedido() {
    return Array.from(estado.pedido.values());
  }

  function renderizarPedido() {
    if (!tela.pedidoItens) return;

    const itens = obterItensPedido();
    const totalUnidades = itens.reduce((total, item) => total + item.quantidade, 0);

    limparElemento(tela.pedidoItens);

    if (!itens.length) {
      const avisoVazio = document.createElement("p");
      avisoVazio.className = "catalogo-pedido-vazio";
      avisoVazio.textContent = "Selecione produtos no catálogo para montar sua lista.";
      tela.pedidoItens.appendChild(avisoVazio);
    } else {
      itens.forEach((item, indice) => {
        tela.pedidoItens.appendChild(criarItemPedido(item, indice));
      });
    }

    if (tela.pedidoResumo) {
      tela.pedidoResumo.textContent = itens.length
        ? `${itens.length} item(ns), ${totalUnidades} unidade(s) selecionada(s).`
        : "Nenhum item selecionado.";
    }

    if (tela.pedidoContador) {
      tela.pedidoContador.textContent = String(itens.length);
    }

    if (tela.pedidoLimpar) tela.pedidoLimpar.disabled = !itens.length;
    if (tela.pedidoEnviar) tela.pedidoEnviar.disabled = pedidoEnviando || !itens.length;
  }

  function criarItemPedido(item, indice) {
    const linha = document.createElement("article");
    linha.className = "catalogo-pedido-item";

    const info = document.createElement("div");
    info.className = "catalogo-pedido-item-info";

    const titulo = document.createElement("h3");
    titulo.textContent = `${indice + 1}. ${item.descricao}`;

    const codigo = document.createElement("p");
    codigo.className = "catalogo-pedido-codigo";
    codigo.textContent = `Código: ${item.codigo}`;

    const legendaQuantidade = document.createElement("label");
    legendaQuantidade.className = "sr-only";
    legendaQuantidade.setAttribute("for", `pedido-quantidade-${item.codigo}`);
    legendaQuantidade.textContent = `Quantidade de ${item.descricao}`;

    const campoQuantidade = document.createElement("input");
    campoQuantidade.type = "number";
    campoQuantidade.id = `pedido-quantidade-${item.codigo}`;
    campoQuantidade.className = "form-control catalogo-pedido-quantidade";
    campoQuantidade.value = String(item.quantidade);
    configurarCampoQuantidade(campoQuantidade);
    campoQuantidade.addEventListener("change", () => {
      atualizarQuantidadePedido(item.codigo, campoQuantidade.value);
    });

    const grupoQuantidade = document.createElement("div");
    grupoQuantidade.className = "catalogo-pedido-quantidade-grupo";

    const botaoMenos = document.createElement("button");
    botaoMenos.type = "button";
    botaoMenos.className = "btn btn-outline-secondary btn-sm catalogo-pedido-passo";
    botaoMenos.textContent = "-";
    botaoMenos.setAttribute("aria-label", `Diminuir quantidade de ${item.descricao}`);
    botaoMenos.disabled = item.quantidade <= 1;
    botaoMenos.addEventListener("click", () => alterarQuantidadePedido(item.codigo, -1));

    const botaoMais = document.createElement("button");
    botaoMais.type = "button";
    botaoMais.className = "btn btn-outline-secondary btn-sm catalogo-pedido-passo";
    botaoMais.textContent = "+";
    botaoMais.setAttribute("aria-label", `Aumentar quantidade de ${item.descricao}`);
    botaoMais.disabled = item.quantidade >= QUANTIDADE_MAXIMA_PEDIDO;
    botaoMais.addEventListener("click", () => alterarQuantidadePedido(item.codigo, 1));

    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.className = "btn btn-outline-secondary btn-sm";
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => removerItemPedido(item.codigo));

    info.appendChild(titulo);
    grupoQuantidade.appendChild(botaoMenos);
    grupoQuantidade.appendChild(campoQuantidade);
    grupoQuantidade.appendChild(botaoMais);
    linha.appendChild(info);
    linha.appendChild(legendaQuantidade);
    linha.appendChild(grupoQuantidade);
    linha.appendChild(botaoRemover);
    linha.appendChild(codigo);

    return linha;
  }

  function normalizarTextoCliente(valor) {
    return String(valor || "").replace(/\s+/g, " ").trim();
  }

  function obterClientePedido() {
    const cnpj = obterDigitos(tela.pedidoCnpj && tela.pedidoCnpj.value);
    const empresa = normalizarTextoCliente(tela.pedidoEmpresa && tela.pedidoEmpresa.value);

    if (!cnpjValido(cnpj)) {
      throw new Error("Informe um CNPJ válido.");
    }

    if (empresa.length < 2) {
      throw new Error("Informe o nome da empresa.");
    }

    return { cnpj, empresa };
  }

  async function registrarPedidoSupabase(cliente) {
    const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${SUPABASE_FUNCAO_PEDIDO}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_CHAVE_PUBLICA,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_cnpj: cliente.cnpj,
        p_empresa: cliente.empresa
      })
    });

    if (!resposta.ok) {
      let mensagem = "Não foi possível selecionar o televendas. Tente novamente.";

      try {
        const erro = await resposta.json();
        mensagem = erro.message || mensagem;
      } catch (erro) {
        mensagem = resposta.statusText || mensagem;
      }

      throw new Error(mensagem);
    }

    const dados = await resposta.json();
    const resultado = Array.isArray(dados) ? dados[0] : dados;

    if (!resultado || !resultado.televendas_whatsapp) {
      throw new Error("O Supabase não retornou um número de WhatsApp.");
    }

    return resultado;
  }

  function montarMensagemPedido(cliente) {
    const linhasItens = obterItensPedido().map((item, indice) => {
      return `${indice + 1}- (${item.quantidade}Uni) ${item.descricao} - ${item.codigo}`;
    });

    return [
      "Olá, quero fazer um pedido. Fiz um carrinho de itens pelo site, gostaria de prosseguir com a compra.",
      "",
      `Empresa: ${cliente.empresa}`,
      `CNPJ: ${formatarCnpj(cliente.cnpj)}`,
      "",
      "Segue abaixo os itens selecionados:",
      ...linhasItens
    ].join("\n");
  }

  function definirEnvioPedidoAtivo(ativo) {
    if (!tela.pedidoEnviar) return;

    pedidoEnviando = ativo;
    tela.pedidoEnviar.disabled = pedidoEnviando || !obterItensPedido().length;
    tela.pedidoEnviar.textContent = ativo ? "Selecionando televendas..." : "Finalizar pelo WhatsApp";
  }

  async function enviarPedidoWhatsApp() {
    if (!obterItensPedido().length) {
      avisarPedido("Selecione ao menos um item para finalizar o pedido.", true);
      return;
    }

    try {
      const cliente = obterClientePedido();

      definirEnvioPedidoAtivo(true);
      avisarPedido("Selecionando televendas...");

      const atendimento = await registrarPedidoSupabase(cliente);
      const mensagem = montarMensagemPedido(cliente);
      const numero = obterDigitos(atendimento.televendas_whatsapp);
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

      avisarPedido(`Pedido direcionado para ${atendimento.televendas_nome}.`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (erro) {
      avisarPedido(erro.message || "Não foi possível finalizar o pedido.", true);
    } finally {
      definirEnvioPedidoAtivo(false);
    }
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
    tela.pedidoLimpar.addEventListener("click", limparPedido);
    tela.pedidoEnviar.addEventListener("click", enviarPedidoWhatsApp);
    tela.pedidoBotao.addEventListener("click", alternarPainelPedido);
    tela.pedidoFechar.addEventListener("click", fecharPainelPedido);
    tela.tentarNovamente.addEventListener("click", () => {
      estado.catalogoCarregado = false;
      carregarCatalogo();
    });

    configurarCampoCnpj();

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        fecharPainelPedido();
      }
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
    carregarPedidoSalvo();
    configurarEventos();
    renderizarPedido();
    carregarCatalogo();
  }

  document.addEventListener("DOMContentLoaded", iniciarCatalogo);
})();
