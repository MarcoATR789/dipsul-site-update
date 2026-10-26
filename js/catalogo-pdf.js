(function (global) {
  "use strict";

  function organizarPaginas(produtos, categoria = "") {
    const grupos = new Map();
    for (const produto of produtos) {
      if (categoria && produto.categoria !== categoria) continue;
      const nome = produto.categoria || "Sem categoria";
      if (!grupos.has(nome)) grupos.set(nome, []);
      grupos.get(nome).push(produto);
    }
    const paginas = [];
    for (const [nome, itens] of grupos) {
      for (let inicio = 0; inicio < itens.length; inicio += 16) {
        paginas.push({ categoria: nome, itens: itens.slice(inicio, inicio + 16) });
      }
    }
    return paginas;
  }

  async function carregarProdutos(raiz, sinal) {
    const resposta = await fetch(new URL("data/catalogo/produtos.json", raiz), { signal: sinal, cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os produtos.");
    const produtos = await resposta.json();
    if (!Array.isArray(produtos) || !produtos.length) throw new Error("O catálogo está vazio.");
    return produtos;
  }

  function enderecoImagem(produto, raiz) {
    const nome = String(produto.imagem || "");
    return new URL(/^[\w.-]+\.(webp|png|jpe?g)$/i.test(nome)
      ? `img/catalogo/imagens/${encodeURIComponent(nome)}`
      : "img/catalogo/sem-imagem.webp", raiz).href;
  }

  function carregarImagem(imagem, endereco, sinal) {
    return new Promise((resolver, rejeitar) => {
      sinal.throwIfAborted();
      const concluir = (sucesso) => {
        clearTimeout(tempo);
        imagem.onload = imagem.onerror = null;
        sinal.removeEventListener("abort", cancelar);
        resolver(sucesso);
      };
      const cancelar = () => {
        clearTimeout(tempo);
        imagem.onload = imagem.onerror = null;
        imagem.removeAttribute("src");
        rejeitar(new DOMException("Geração cancelada", "AbortError"));
      };
      const tempo = setTimeout(() => concluir(false), 20000);
      sinal.addEventListener("abort", cancelar, { once: true });
      imagem.onload = () => concluir(imagem.naturalWidth > 0);
      imagem.onerror = () => concluir(false);
      imagem.src = endereco;
    });
  }

  function preencherTexto(elemento, campo, valor) {
    elemento.querySelectorAll(`[data-campo="${campo}"]`).forEach((destino) => {
      destino.textContent = String(valor ?? "");
    });
  }

  function atualizarDataExportacao(documento) {
    preencherTexto(documento, "data_exportacao", new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo"
    }).format(new Date()));
  }

  function imagemParaPDF(imagem) {
    const escala = Math.min(1, 500 / imagem.naturalWidth, 320 / imagem.naturalHeight);
    const tela = imagem.ownerDocument.createElement("canvas");
    tela.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    tela.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const desenho = tela.getContext("2d");
    desenho.fillStyle = "#f8fbff";
    desenho.fillRect(0, 0, tela.width, tela.height);
    desenho.drawImage(imagem, 0, 0, tela.width, tela.height);
    return tela.toDataURL("image/jpeg", 0.92);
  }

  async function preparar({ iframe, raiz, produtos, categoria, formato, sinal, progresso }) {
    const paginas = organizarPaginas(produtos, categoria);
    if (!paginas.length) throw new Error("Nenhum produto nessa categoria.");
    if (!["publico", "impressao"].includes(formato)) throw new Error("Formato inválido.");
    const resposta = await fetch(new URL(`pages/catalogo-${formato}.html`, raiz), { signal: sinal });
    if (!resposta.ok) throw new Error("Não foi possível carregar o modelo de impressão.");
    const modelo = new DOMParser().parseFromString(await resposta.text(), "text/html");
    const folhaModelo = modelo.querySelector(".folha-catalogo");
    if (!folhaModelo || folhaModelo.querySelectorAll(".produto-impresso").length !== 16) {
      throw new Error("O modelo deve conter 16 espaços de produtos por folha.");
    }
    sinal.throwIfAborted();
    const documento = iframe.contentDocument;
    documento.head.replaceChildren();
    documento.body.replaceChildren();
    documento.documentElement.lang = "pt-BR";
    documento.title = `Catálogo Dipsul - ${categoria || "Completo"}`;
    const estilo = documento.createElement("link");
    estilo.rel = "stylesheet";
    estilo.href = new URL("css/catalogo-impressao.css?v=20261026-1", raiz).href;
    const estiloPronto = new Promise((resolver, rejeitar) => {
      const cancelar = () => terminar(new DOMException("Geração cancelada", "AbortError"));
      const terminar = (erro) => {
        clearTimeout(tempo);
        sinal.removeEventListener("abort", cancelar);
        estilo.onload = estilo.onerror = null;
        if (erro) rejeitar(erro); else resolver();
      };
      const tempo = setTimeout(() => terminar(new Error("Tempo esgotado ao carregar o estilo.")), 20000);
      sinal.addEventListener("abort", cancelar, { once: true });
      estilo.onload = () => terminar();
      estilo.onerror = () => terminar(new Error("Não foi possível carregar o estilo de impressão."));
    });
    documento.head.append(estilo);
    await estiloPronto;
    const principal = documento.createElement("main");
    principal.className = `catalogo-impressao ${formato === "impressao" ? "catalogo-espelhado" : "catalogo-publico"}`;
    documento.body.append(principal);
    const imagens = [];
    for (const [indice, pagina] of paginas.entries()) {
      sinal.throwIfAborted();
      const folha = documento.importNode(folhaModelo, true);
      folha.setAttribute("aria-label", `Página ${indice + 1}`);
      preencherTexto(folha, "ct_descri", pagina.categoria);
      preencherTexto(folha, "numero_pagina", indice + 1);
      preencherTexto(folha, "total_paginas", paginas.length);
      const logo = folha.querySelector(".folha-logo");
      logo.removeAttribute("src");
      imagens.push([logo, new URL("img/logo.png", raiz).href]);
      folha.querySelectorAll(".produto-impresso").forEach((espaco, posicao) => {
        const produto = pagina.itens[posicao];
        if (!produto) { espaco.remove(); return; }
        espaco.removeAttribute("data-itc-item");
        if (produto.itc_item != null) espaco.dataset.itcItem = String(produto.itc_item);
        preencherTexto(espaco, "pr_produto", produto.codigo);
        preencherTexto(espaco, "itc_descricao", produto.descricao);
        const imagem = espaco.querySelector("img");
        imagem.removeAttribute("data-src");
        imagem.alt = produto.descricao;
        imagens.push([imagem, enderecoImagem(produto, raiz)]);
      });
      principal.append(folha);
      if (indice % 10 === 0) {
        progresso(`Montando página ${indice + 1} de ${paginas.length}...`);
        await new Promise((resolver) => setTimeout(resolver, 0));
      }
    }
    atualizarDataExportacao(documento);
    let proxima = 0;
    let carregadas = 0;
    let ausentes = 0;
    const reserva = new URL("img/catalogo/sem-imagem.webp", raiz).href;
    async function carregarFila() {
      while (proxima < imagens.length) {
        sinal.throwIfAborted();
        const [imagem, endereco] = imagens[proxima++];
        if (!await carregarImagem(imagem, endereco, sinal)) {
          ausentes++;
          if (!await carregarImagem(imagem, reserva, sinal)) throw new Error("Não foi possível carregar as imagens. Tente novamente.");
        }
        if (imagem.dataset.campo === "imagem_src") {
          if (!await carregarImagem(imagem, imagemParaPDF(imagem), sinal)) throw new Error("Não foi possível preparar uma imagem para o PDF.");
        }
        carregadas++;
        progresso(`Carregando imagens: ${carregadas} de ${imagens.length}...`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(8, imagens.length) }, carregarFila));
    await documento.fonts.ready;
    sinal.throwIfAborted();
    for (const corpo of principal.querySelectorAll(".produto-corpo")) {
      const descricao = corpo.querySelector(".produto-descricao");
      let tamanho = 8;
      while (corpo.scrollHeight > corpo.clientHeight + 1 && tamanho > 6) {
        tamanho -= 0.25;
        descricao.style.fontSize = `${tamanho}pt`;
      }
      if (corpo.scrollHeight > corpo.clientHeight + 1) {
        throw new Error(`Descrição excede o espaço do produto ${corpo.querySelector('[data-campo="pr_produto"]').textContent}. Revise o texto antes de imprimir.`);
      }
    }
    return { paginas: paginas.length, itens: paginas.reduce((total, pagina) => total + pagina.itens.length, 0), ausentes };
  }

  const api = { carregarProdutos, organizarPaginas, enderecoImagem, preparar, atualizarDataExportacao };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.DipsulCatalogoPDF = api;
})(typeof window === "undefined" ? globalThis : window);
