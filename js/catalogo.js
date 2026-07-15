(function () {
  'use strict';

  const CATALOGO_DATA_URL = '../data/catalogo/produtos.json';
  const CATALOGO_IMAGE_BASE = '../img/catalogo/imagens/';
  const CATALOGO_PLACEHOLDER_IMAGE = '../img/catalogo/sem-imagem.webp';
  const DEFAULT_PAGE_SIZE = 40;
  const PAGE_SIZE_OPTIONS = [20, 40, 80];
  const SEARCH_DEBOUNCE_MS = 250;
  const PEDIDO_PREVIEW_MS = 500;
  const PEDIDO_STORAGE_KEY = 'dipsul_catalogo_pedido_v1';
  const PEDIDO_WHATSAPP_NUMERO = '5555991434780';
  const CATEGORIAS_ORDEM = [
    'medicamentos-veterinarios',
    'minerais',
    'instrumentos-veterinarios',
    'pet',
    'pet-caes-e-gatos',
    'raticida-e-inseticida',
    'cordas',
    'ferragens',
    'ferramentas',
    'materiais-eletricos',
    'materiais-para-construcao',
    'maquinas-eletricas',
    'adesivos',
    'lubrificantes-e-oleos',
    'selaria',
    'pecuaria',
    'aviario-telas-e-lonas',
    'suinocultura',
    'apicultura',
    'jardinagem',
    'camping-caca-pesca',
    'e-p-i',
    'utilidades-e-utensilios',
    'capas-de-chuva-guarda-chuva',
    'embalagens',
    'supermercado',
    'fogao',
    'sementes'
  ];
  const CATEGORIAS_ORDEM_MAP = new Map(CATEGORIAS_ORDEM.map((slug, index) => [slug, index]));

  const state = {
    produtos: [],
    filtrados: [],
    categorias: [],
    busca: '',
    categoria: '',
    pagina: 1,
    itensPorPagina: DEFAULT_PAGE_SIZE,
    pedido: new Map(),
    abortController: null,
    carregado: false
  };

  const elements = {
    form: document.getElementById('catalogo-filters'),
    search: document.getElementById('catalogo-search'),
    category: document.getElementById('catalogo-category-select'),
    clear: document.getElementById('catalogo-clear'),
    pageSize: document.getElementById('catalogo-page-size'),
    count: document.getElementById('catalogo-results-count'),
    products: document.getElementById('catalogo-products'),
    loading: document.getElementById('catalogo-loading'),
    empty: document.getElementById('catalogo-empty'),
    error: document.getElementById('catalogo-error'),
    retry: document.getElementById('catalogo-retry'),
    pagination: document.getElementById('catalogo-pagination'),
    orderSummary: document.getElementById('catalogo-order-summary'),
    orderItems: document.getElementById('catalogo-order-items'),
    orderClear: document.getElementById('catalogo-order-clear'),
    orderSend: document.getElementById('catalogo-order-send'),
    orderPanel: document.getElementById('catalogo-order-panel'),
    orderToggle: document.getElementById('catalogo-order-toggle'),
    orderClose: document.getElementById('catalogo-order-close'),
    orderBadge: document.getElementById('catalogo-order-badge'),
    live: document.getElementById('catalogo-live-region')
  };

  let pedidoPreviewTimer = null;
  let pedidoAbertoAutomatico = false;

  function normalizar(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function debounce(fn, delay) {
    let timer = null;

    return function debounced(...args) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function limparElemento(element) {
    if (!element) return;

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function normalizarQuantidade(valor) {
    const quantidade = parseInt(valor, 10);

    if (!Number.isFinite(quantidade) || quantidade < 1) return 1;
    return Math.min(quantidade, 999);
  }

  function carregarPedidoSalvo() {
    try {
      const dados = JSON.parse(localStorage.getItem(PEDIDO_STORAGE_KEY) || '[]');

      if (!Array.isArray(dados)) return;

      dados.forEach((item) => {
        if (!item || !item.codigo || !item.descricao) return;

        state.pedido.set(String(item.codigo), {
          codigo: String(item.codigo),
          descricao: String(item.descricao),
          quantidade: normalizarQuantidade(item.quantidade)
        });
      });
    } catch (error) {
      console.warn('Não foi possível carregar a lista de pedido salva.', error);
    }
  }

  function salvarPedido() {
    try {
      localStorage.setItem(PEDIDO_STORAGE_KEY, JSON.stringify(Array.from(state.pedido.values())));
    } catch (error) {
      console.warn('Não foi possível salvar a lista de pedido.', error);
    }
  }

  function definirPainelPedidoAberto(aberto, options = {}) {
    if (!elements.orderPanel || !elements.orderToggle) return;

    elements.orderPanel.classList.toggle('is-open', aberto);
    elements.orderPanel.setAttribute('aria-hidden', aberto ? 'false' : 'true');
    elements.orderPanel.inert = !aberto;
    elements.orderToggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');

    if (aberto && options.focus !== false) {
      const primeiroControle = elements.orderPanel.querySelector('input, button, a');
      if (primeiroControle) primeiroControle.focus();
    }
  }

  function cancelarPreviewPedido() {
    if (pedidoPreviewTimer) {
      window.clearTimeout(pedidoPreviewTimer);
      pedidoPreviewTimer = null;
    }
  }

  function fecharPainelPedido() {
    cancelarPreviewPedido();
    pedidoAbertoAutomatico = false;
    definirPainelPedidoAberto(false, { focus: false });
  }

  function mostrarPreviewPedido() {
    cancelarPreviewPedido();
    pedidoAbertoAutomatico = true;
    definirPainelPedidoAberto(true, { focus: false });

    pedidoPreviewTimer = window.setTimeout(() => {
      pedidoPreviewTimer = null;

      if (pedidoAbertoAutomatico) {
        pedidoAbertoAutomatico = false;
        definirPainelPedidoAberto(false, { focus: false });
      }
    }, PEDIDO_PREVIEW_MS);
  }

  function alternarPainelPedido() {
    const aberto = elements.orderPanel && elements.orderPanel.classList.contains('is-open');

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
    const nome = String(nomeImagem || '').trim();

    if (!nome) return '';
    if (nome.includes('..') || nome.includes('/') || nome.includes('\\') || /^[a-z]+:/i.test(nome)) {
      return '';
    }

    return nome;
  }

  function obterUrlImagem(produto) {
    const imagem = sanitizarImagem(produto && produto.imagem);
    return imagem ? `${CATALOGO_IMAGE_BASE}${encodeURIComponent(imagem)}` : CATALOGO_PLACEHOLDER_IMAGE;
  }

  function aplicarFallbackImagem(img) {
    img.addEventListener('error', function () {
      if (img.dataset.fallbackApplied === 'true') return;

      img.dataset.fallbackApplied = 'true';
      img.src = CATALOGO_PLACEHOLDER_IMAGE;
    });
  }

  function obterEstadoUrl() {
    const params = new URLSearchParams(window.location.search);
    const itensUrl = Number(params.get('itens'));
    const paginaUrl = Number(params.get('pagina'));

    state.busca = (params.get('busca') || '').trim();
    state.categoria = (params.get('categoria') || '').trim();
    state.pagina = Number.isFinite(paginaUrl) && paginaUrl > 0 ? Math.floor(paginaUrl) : 1;
    state.itensPorPagina = PAGE_SIZE_OPTIONS.includes(itensUrl) ? itensUrl : DEFAULT_PAGE_SIZE;

    if (elements.search) elements.search.value = state.busca;
    if (elements.pageSize) elements.pageSize.value = String(state.itensPorPagina);
  }

  function atualizarUrl(push) {
    const params = new URLSearchParams();

    if (state.busca) params.set('busca', state.busca);
    if (state.categoria) params.set('categoria', state.categoria);
    if (state.pagina > 1) params.set('pagina', String(state.pagina));
    if (state.itensPorPagina !== DEFAULT_PAGE_SIZE) params.set('itens', String(state.itensPorPagina));

    const query = params.toString();
    const novaUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const metodo = push ? 'pushState' : 'replaceState';

    window.history[metodo]({}, '', novaUrl);
  }

  function mostrarCarregando() {
    setHidden(elements.loading, false);
    setHidden(elements.empty, true);
    setHidden(elements.error, true);
    limparElemento(elements.products);
    limparElemento(elements.pagination);
    if (elements.count) elements.count.textContent = 'Carregando produtos...';
  }

  function mostrarErro(error) {
    console.error('Erro ao carregar catálogo:', error);
    setHidden(elements.loading, true);
    setHidden(elements.empty, true);
    setHidden(elements.error, false);
    limparElemento(elements.products);
    limparElemento(elements.pagination);
    if (elements.count) elements.count.textContent = 'Não foi possível carregar o catálogo.';
    if (elements.live) elements.live.textContent = 'Não foi possível carregar o catálogo.';
  }

  function montarCategorias() {
    const mapa = new Map();

    state.produtos.forEach((produto) => {
      if (produto.categoriaSlug && produto.categoria && !mapa.has(produto.categoriaSlug)) {
        mapa.set(produto.categoriaSlug, produto.categoria);
      }
    });

    state.categorias = Array.from(mapa.entries())
      .map(([slug, nome]) => ({ slug, nome }))
      .sort((a, b) => {
        const ordemA = CATEGORIAS_ORDEM_MAP.has(a.slug) ? CATEGORIAS_ORDEM_MAP.get(a.slug) : Number.MAX_SAFE_INTEGER;
        const ordemB = CATEGORIAS_ORDEM_MAP.has(b.slug) ? CATEGORIAS_ORDEM_MAP.get(b.slug) : Number.MAX_SAFE_INTEGER;

        if (ordemA !== ordemB) {
          return ordemA - ordemB;
        }

        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

    limparElemento(elements.category);

    const todas = document.createElement('option');
    todas.value = '';
    todas.textContent = 'Todas as categorias';
    elements.category.appendChild(todas);

    state.categorias.forEach((categoria) => {
      const option = document.createElement('option');
      option.value = categoria.slug;
      option.textContent = categoria.nome;
      elements.category.appendChild(option);
    });

    if (state.categoria && state.categorias.some((categoria) => categoria.slug === state.categoria)) {
      elements.category.value = state.categoria;
    } else {
      state.categoria = '';
      elements.category.value = '';
    }
  }

  function aplicarFiltros() {
    const buscaNormalizada = normalizar(state.busca);
    const termos = buscaNormalizada ? buscaNormalizada.split(' ') : [];

    state.filtrados = state.produtos.filter((produto) => {
      if (state.categoria && produto.categoriaSlug !== state.categoria) {
        return false;
      }

      if (!termos.length) {
        return true;
      }

      const buscaProduto = produto.busca || normalizar(`${produto.codigo} ${produto.descricao} ${produto.categoria}`);
      return termos.every((termo) => buscaProduto.includes(termo));
    });

    const totalPaginas = obterTotalPaginas();
    if (state.pagina > totalPaginas) {
      state.pagina = totalPaginas;
    }
  }

  function obterTotalPaginas() {
    return Math.max(1, Math.ceil(state.filtrados.length / state.itensPorPagina));
  }

  function criarLinkProduto(produto) {
    const params = new URLSearchParams();
    params.set('codigo', produto.codigo);

    const estadoCatalogo = new URLSearchParams(window.location.search);
    estadoCatalogo.delete('codigo');

    if (estadoCatalogo.toString()) {
      params.set('voltar', `catalogo.html?${estadoCatalogo.toString()}`);
    }

    return `produto.html?${params.toString()}`;
  }

  function criarCardProduto(produto) {
    const article = document.createElement('article');
    article.className = 'catalogo-product-card';

    const link = document.createElement('a');
    link.className = 'catalogo-product-link';
    link.href = criarLinkProduto(produto);
    link.setAttribute('aria-label', `Ver produto ${produto.descricao}`);

    const imageWrap = document.createElement('div');
    imageWrap.className = 'catalogo-product-image';

    const img = document.createElement('img');
    img.src = obterUrlImagem(produto);
    img.alt = produto.descricao;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 220;
    img.height = 220;
    aplicarFallbackImagem(img);

    imageWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'catalogo-product-body';

    const codigo = document.createElement('span');
    codigo.className = 'catalogo-product-code';
    codigo.textContent = `Código: ${produto.codigo}`;

    const title = document.createElement('h2');
    title.className = 'catalogo-product-title';
    title.textContent = produto.descricao;

    const categoria = document.createElement('p');
    categoria.className = 'catalogo-product-category';
    categoria.textContent = produto.categoria;

    const action = document.createElement('span');
    action.className = 'catalogo-product-action';
    action.textContent = 'Ver produto';

    body.appendChild(codigo);
    body.appendChild(title);
    body.appendChild(categoria);
    body.appendChild(action);

    link.appendChild(imageWrap);
    link.appendChild(body);
    article.appendChild(link);

    const orderControls = document.createElement('div');
    orderControls.className = 'catalogo-product-order';

    const quantityId = `catalogo-qty-${normalizar(produto.codigo).replace(/\s+/g, '-')}`;

    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'sr-only';
    quantityLabel.setAttribute('for', quantityId);
    quantityLabel.textContent = `Quantidade de ${produto.descricao}`;

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.id = quantityId;
    quantityInput.className = 'form-control catalogo-product-quantity';
    quantityInput.min = '1';
    quantityInput.max = '999';
    quantityInput.step = '1';
    quantityInput.value = '1';
    quantityInput.inputMode = 'numeric';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn-primary btn-sm catalogo-product-add';
    addButton.textContent = 'Adicionar';

    addButton.addEventListener('click', () => {
      adicionarItemPedido(produto, normalizarQuantidade(quantityInput.value));
      quantityInput.value = '1';
    });

    orderControls.appendChild(quantityLabel);
    orderControls.appendChild(quantityInput);
    orderControls.appendChild(addButton);
    article.appendChild(orderControls);

    return article;
  }

  function adicionarItemPedido(produto, quantidade) {
    const codigo = String(produto.codigo);
    const itemAtual = state.pedido.get(codigo);
    const quantidadeAtual = itemAtual ? itemAtual.quantidade : 0;
    const novaQuantidade = Math.min(quantidadeAtual + normalizarQuantidade(quantidade), 999);

    state.pedido.set(codigo, {
      codigo,
      descricao: produto.descricao,
      quantidade: novaQuantidade
    });

    salvarPedido();
    renderizarPedido();
    mostrarPreviewPedido();

    if (elements.live) {
      elements.live.textContent = `${produto.descricao} adicionado à lista de pedido.`;
    }
  }

  function atualizarQuantidadePedido(codigo, quantidade) {
    const item = state.pedido.get(codigo);
    if (!item) return;

    item.quantidade = normalizarQuantidade(quantidade);
    state.pedido.set(codigo, item);
    salvarPedido();
    renderizarPedido();
  }

  function removerItemPedido(codigo) {
    state.pedido.delete(codigo);
    salvarPedido();
    renderizarPedido();

    if (elements.live) {
      elements.live.textContent = 'Item removido da lista de pedido.';
    }
  }

  function limparPedido() {
    state.pedido.clear();
    salvarPedido();
    renderizarPedido();

    if (elements.live) {
      elements.live.textContent = 'Lista de pedido limpa.';
    }
  }

  function obterItensPedido() {
    return Array.from(state.pedido.values());
  }

  function renderizarPedido() {
    if (!elements.orderItems) return;

    const itens = obterItensPedido();
    const totalUnidades = itens.reduce((total, item) => total + item.quantidade, 0);

    limparElemento(elements.orderItems);

    if (!itens.length) {
      const vazio = document.createElement('p');
      vazio.className = 'catalogo-order-empty';
      vazio.textContent = 'Selecione produtos no catálogo para montar sua lista.';
      elements.orderItems.appendChild(vazio);
    } else {
      itens.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'catalogo-order-item';

        const info = document.createElement('div');
        info.className = 'catalogo-order-item-info';

        const title = document.createElement('h3');
        title.textContent = `${index + 1}. ${item.descricao}`;

        const code = document.createElement('p');
        code.textContent = `Código: ${item.codigo}`;

        info.appendChild(title);
        info.appendChild(code);

        const quantityLabel = document.createElement('label');
        quantityLabel.className = 'sr-only';
        quantityLabel.setAttribute('for', `pedido-quantidade-${item.codigo}`);
        quantityLabel.textContent = `Quantidade de ${item.descricao}`;

        const quantity = document.createElement('input');
        quantity.type = 'number';
        quantity.id = `pedido-quantidade-${item.codigo}`;
        quantity.className = 'form-control catalogo-order-quantity';
        quantity.min = '1';
        quantity.max = '999';
        quantity.step = '1';
        quantity.value = String(item.quantidade);
        quantity.inputMode = 'numeric';

        quantity.addEventListener('change', () => {
          atualizarQuantidadePedido(item.codigo, quantity.value);
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-outline-secondary btn-sm';
        remove.textContent = 'Remover';
        remove.addEventListener('click', () => removerItemPedido(item.codigo));

        row.appendChild(info);
        row.appendChild(quantityLabel);
        row.appendChild(quantity);
        row.appendChild(remove);
        elements.orderItems.appendChild(row);
      });
    }

    if (elements.orderSummary) {
      elements.orderSummary.textContent = itens.length
        ? `${itens.length} item(ns), ${totalUnidades} unidade(s) selecionada(s).`
        : 'Nenhum item selecionado.';
    }

    if (elements.orderBadge) {
      elements.orderBadge.textContent = String(totalUnidades);
    }

    if (elements.orderClear) elements.orderClear.disabled = !itens.length;
    if (elements.orderSend) elements.orderSend.disabled = !itens.length;
  }

  function montarMensagemPedido() {
    const itens = obterItensPedido();
    const linhas = itens.map((item, index) => {
      return `${index + 1}- (${item.quantidade}Uni) ${item.descricao} - ${item.codigo}`;
    });

    return [
      'Olá, quero fazer um pedido. Fiz um carrinho de itens pelo site, gostaria de prosseguir com a compra.',
      '',
      'Segue abaixo os itens selecionados:',
      ...linhas
    ].join('\n');
  }

  function enviarPedidoWhatsApp() {
    const itens = obterItensPedido();

    if (!itens.length) {
      if (elements.live) {
        elements.live.textContent = 'Selecione ao menos um item para finalizar o pedido.';
      }
      return;
    }

    const mensagem = montarMensagemPedido();
    const url = `https://wa.me/${PEDIDO_WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
    const novaJanela = window.open(url, '_blank', 'noopener,noreferrer');

    if (!novaJanela) {
      window.location.href = url;
    }
  }

  function renderizarProdutos() {
    limparElemento(elements.products);

    const inicio = (state.pagina - 1) * state.itensPorPagina;
    const fim = inicio + state.itensPorPagina;
    const produtosPagina = state.filtrados.slice(inicio, fim);

    produtosPagina.forEach((produto) => {
      elements.products.appendChild(criarCardProduto(produto));
    });
  }

  function criarBotaoPagina(label, pagina, disabled, current) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = current ? 'catalogo-page-button is-active' : 'catalogo-page-button';
    button.textContent = label;
    button.disabled = disabled;

    if (current) {
      button.setAttribute('aria-current', 'page');
    }

    button.addEventListener('click', () => {
      if (disabled || pagina === state.pagina) return;
      state.pagina = pagina;
      atualizarUrl(false);
      renderizar();
      rolarParaCatalogo();
    });

    return button;
  }

  function renderizarPaginacao() {
    limparElemento(elements.pagination);

    const totalPaginas = obterTotalPaginas();
    if (totalPaginas <= 1) return;

    elements.pagination.appendChild(criarBotaoPagina('Anterior', Math.max(1, state.pagina - 1), state.pagina === 1, false));

    const inicio = Math.max(1, state.pagina - 2);
    const fim = Math.min(totalPaginas, state.pagina + 2);

    if (inicio > 1) {
      elements.pagination.appendChild(criarBotaoPagina('1', 1, false, state.pagina === 1));
      if (inicio > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'catalogo-page-ellipsis';
        ellipsis.textContent = '...';
        elements.pagination.appendChild(ellipsis);
      }
    }

    for (let pagina = inicio; pagina <= fim; pagina += 1) {
      elements.pagination.appendChild(criarBotaoPagina(String(pagina), pagina, false, pagina === state.pagina));
    }

    if (fim < totalPaginas) {
      if (fim < totalPaginas - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'catalogo-page-ellipsis';
        ellipsis.textContent = '...';
        elements.pagination.appendChild(ellipsis);
      }
      elements.pagination.appendChild(criarBotaoPagina(String(totalPaginas), totalPaginas, false, state.pagina === totalPaginas));
    }

    elements.pagination.appendChild(criarBotaoPagina('Próxima', Math.min(totalPaginas, state.pagina + 1), state.pagina === totalPaginas, false));
  }

  function atualizarResumo() {
    const total = state.filtrados.length;
    const totalPaginas = obterTotalPaginas();
    const texto = total === 1
      ? `1 produto encontrado. Página ${state.pagina} de ${totalPaginas}.`
      : `${total} produtos encontrados. Página ${state.pagina} de ${totalPaginas}.`;

    if (elements.count) elements.count.textContent = texto;
    if (elements.live) elements.live.textContent = texto;
  }

  function renderizar() {
    aplicarFiltros();
    setHidden(elements.loading, true);
    setHidden(elements.error, true);
    setHidden(elements.empty, state.filtrados.length > 0);

    renderizarProdutos();
    renderizarPaginacao();
    atualizarResumo();
  }

  function rolarParaCatalogo() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = document.querySelector('.catalogo-shop').getBoundingClientRect().top + window.pageYOffset - 90;

    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  async function carregarCatalogo() {
    if (state.abortController) {
      state.abortController.abort();
    }

    if (state.carregado) {
      renderizar();
      return;
    }

    state.abortController = new AbortController();
    mostrarCarregando();

    if (window.location.protocol === 'file:' && Array.isArray(window.CATALOGO_PRODUTOS)) {
      state.produtos = window.CATALOGO_PRODUTOS;
      state.carregado = true;
      montarCategorias();
      renderizar();
      return;
    }

    try {
      const response = await fetch(CATALOGO_DATA_URL, {
        signal: state.abortController.signal,
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const produtos = await response.json();

      if (!Array.isArray(produtos)) {
        throw new Error('O arquivo produtos.json não retornou uma lista.');
      }

      state.produtos = produtos;
      state.carregado = true;
      montarCategorias();
      renderizar();
    } catch (error) {
      if (error.name === 'AbortError') return;

      if (Array.isArray(window.CATALOGO_PRODUTOS)) {
        console.warn('Fetch do JSON falhou; usando fallback JS do catálogo.', error);
        state.produtos = window.CATALOGO_PRODUTOS;
        state.carregado = true;
        montarCategorias();
        renderizar();
        return;
      }

      mostrarErro(error);
    }
  }

  function limparFiltros() {
    state.busca = '';
    state.categoria = '';
    state.pagina = 1;
    state.itensPorPagina = DEFAULT_PAGE_SIZE;

    if (elements.search) elements.search.value = '';
    if (elements.category) elements.category.value = '';
    if (elements.pageSize) elements.pageSize.value = String(DEFAULT_PAGE_SIZE);

    atualizarUrl(false);
    renderizar();
  }

  function configurarEventos() {
    const buscarComDebounce = debounce(() => {
      state.busca = elements.search.value.trim();
      state.pagina = 1;
      atualizarUrl(false);
      renderizar();
    }, SEARCH_DEBOUNCE_MS);

    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
    });

    elements.search.addEventListener('input', buscarComDebounce);

    elements.category.addEventListener('change', () => {
      state.categoria = elements.category.value;
      state.pagina = 1;
      atualizarUrl(false);
      renderizar();
    });

    elements.pageSize.addEventListener('change', () => {
      const valor = Number(elements.pageSize.value);
      state.itensPorPagina = PAGE_SIZE_OPTIONS.includes(valor) ? valor : DEFAULT_PAGE_SIZE;
      state.pagina = 1;
      atualizarUrl(false);
      renderizar();
    });

    elements.clear.addEventListener('click', limparFiltros);
    elements.orderClear.addEventListener('click', limparPedido);
    elements.orderSend.addEventListener('click', enviarPedidoWhatsApp);
    elements.orderToggle.addEventListener('click', alternarPainelPedido);
    elements.orderClose.addEventListener('click', fecharPainelPedido);
    elements.retry.addEventListener('click', () => {
      state.carregado = false;
      carregarCatalogo();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        fecharPainelPedido();
      }
    });

    window.addEventListener('popstate', () => {
      obterEstadoUrl();
      if (elements.category) elements.category.value = state.categoria;
      renderizar();
    });
  }

  function iniciar() {
    if (!elements.form || !elements.products) return;

    obterEstadoUrl();
    carregarPedidoSalvo();
    configurarEventos();
    renderizarPedido();
    carregarCatalogo();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
