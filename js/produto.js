(function () {
  'use strict';

  const CATALOGO_DATA_URL = '../data/catalogo/produtos.json';
  const CATALOGO_IMAGE_BASE = '../img/catalogo/imagens/';
  const CATALOGO_PLACEHOLDER_IMAGE = '../img/catalogo/sem-imagem.webp';

  const elements = {
    loading: document.getElementById('produto-loading'),
    error: document.getElementById('produto-error'),
    detail: document.getElementById('produto-detail'),
    image: document.getElementById('produto-image'),
    code: document.getElementById('produto-code'),
    title: document.getElementById('produto-title'),
    category: document.getElementById('produto-category'),
    backLink: document.getElementById('produto-back-link'),
    backButton: document.getElementById('produto-back-button'),
    copy: document.getElementById('produto-copy'),
    share: document.getElementById('produto-share'),
    feedback: document.getElementById('produto-feedback'),
    jsonLd: document.getElementById('produto-jsonld'),
    metaDescription: document.getElementById('produto-meta-description'),
    canonical: document.getElementById('produto-canonical')
  };

  function setHidden(element, hidden) {
    if (element) element.hidden = hidden;
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

  function obterCodigoUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('codigo') || '').trim();
  }

  function obterVoltarSeguro() {
    const params = new URLSearchParams(window.location.search);
    const voltar = params.get('voltar');

    if (voltar) {
      try {
        const url = new URL(voltar, window.location.href);
        const catalogoPath = new URL('catalogo.html', window.location.href).pathname;

        if (url.origin === window.location.origin && url.pathname === catalogoPath) {
          return `${url.pathname.split('/').pop()}${url.search}`;
        }
      } catch (error) {
        console.warn('Parâmetro voltar inválido:', error);
      }
    }

    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        const catalogoUrl = new URL('catalogo.html', window.location.href);

        if (referrer.origin === window.location.origin && referrer.pathname === catalogoUrl.pathname) {
          return `catalogo.html${referrer.search}`;
        }
      } catch (error) {
        console.warn('Referrer inválido:', error);
      }
    }

    return 'catalogo.html';
  }

  function atualizarVoltar() {
    const voltar = obterVoltarSeguro();

    if (elements.backLink) elements.backLink.href = voltar;
    if (elements.backButton) elements.backButton.href = voltar;
  }

  function aplicarFallbackImagem() {
    if (!elements.image) return;

    elements.image.addEventListener('error', function () {
      if (elements.image.dataset.fallbackApplied === 'true') return;

      elements.image.dataset.fallbackApplied = 'true';
      elements.image.src = CATALOGO_PLACEHOLDER_IMAGE;
    });
  }

  function atualizarSeo(produto) {
    const params = new URLSearchParams();
    params.set('codigo', produto.codigo);
    const canonicalUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const description = `${produto.descricao} - código: ${produto.codigo}, categoria ${produto.categoria}.`;

    document.title = `${produto.descricao} (${produto.codigo}) - Dipsul`;

    if (elements.metaDescription) {
      elements.metaDescription.setAttribute('content', description);
    }

    if (elements.canonical) {
      elements.canonical.href = canonicalUrl;
    }

    if (elements.jsonLd) {
      elements.jsonLd.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: produto.descricao,
        sku: produto.codigo,
        category: produto.categoria,
        image: new URL(obterUrlImagem(produto), window.location.href).href,
        url: canonicalUrl
      });
    }
  }

  function mostrarProduto(produto) {
    setHidden(elements.loading, true);
    setHidden(elements.error, true);
    setHidden(elements.detail, false);

    elements.image.src = obterUrlImagem(produto);
    elements.image.alt = produto.descricao;
    elements.code.textContent = `Código: ${produto.codigo}`;
    elements.title.textContent = produto.descricao;
    elements.category.textContent = produto.categoria;

    atualizarSeo(produto);
  }

  function mostrarErro(message, error) {
    if (error) console.error(message, error);

    setHidden(elements.loading, true);
    setHidden(elements.detail, true);
    setHidden(elements.error, false);
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  function mostrarFeedback(texto) {
    if (!elements.feedback) return;

    elements.feedback.textContent = texto;
    window.setTimeout(() => {
      if (elements.feedback.textContent === texto) {
        elements.feedback.textContent = '';
      }
    }, 3500);
  }

  function configurarAcoes(produto) {
    const url = window.location.href;

    elements.copy.addEventListener('click', async () => {
      try {
        await copiarTexto(url);
        mostrarFeedback('Link copiado.');
      } catch (error) {
        console.error('Erro ao copiar link:', error);
        mostrarFeedback('Não foi possível copiar o link.');
      }
    });

    elements.share.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: `${produto.descricao} - Dipsul`,
            text: `${produto.descricao} (${produto.codigo})`,
            url
          });
          mostrarFeedback('Produto compartilhado.');
          return;
        }

        await copiarTexto(url);
        mostrarFeedback('Compartilhamento indisponível. Link copiado.');
      } catch (error) {
        if (error && error.name === 'AbortError') return;

        console.error('Erro ao compartilhar produto:', error);
        mostrarFeedback('Não foi possível compartilhar. Tente copiar o link.');
      }
    });
  }

  async function carregarProduto() {
    const codigo = obterCodigoUrl();

    atualizarVoltar();
    aplicarFallbackImagem();

    if (!codigo) {
      mostrarErro('Código do produto ausente.');
      return;
    }

    try {
      const response = await fetch(CATALOGO_DATA_URL, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const produtos = await response.json();

      if (!Array.isArray(produtos)) {
        throw new Error('O arquivo produtos.json não retornou uma lista.');
      }

      const produto = produtos.find((item) => String(item.codigo) === codigo);

      if (!produto) {
        mostrarErro(`Produto não encontrado: ${codigo}`);
        return;
      }

      mostrarProduto(produto);
      configurarAcoes(produto);
    } catch (error) {
      mostrarErro('Erro ao carregar produto:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', carregarProduto);
})();
