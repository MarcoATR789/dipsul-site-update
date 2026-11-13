(function (global) {
  "use strict";

  const LIMITE_BYTES = 30 * 1000 * 1000;
  const MM_POR_PIXEL = 25.4 / 96;
  const fontes = [
    ["Kresson Catalogo", "kresson-black.ttf"],
    ["Corbel Catalogo", "corbel.ttf"],
    ["Courier Catalogo", "cour.ttf"]
  ];

  function cor(valor) {
    return (valor.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  }

  function caixa(elemento, origem) {
    const r = elemento.getBoundingClientRect();
    return { x: (r.left - origem.left) * MM_POR_PIXEL, y: (r.top - origem.top) * MM_POR_PIXEL,
      largura: r.width * MM_POR_PIXEL, altura: r.height * MM_POR_PIXEL };
  }

  function desenharCaixa(pdf, elemento, origem, janela) {
    const estilo = janela.getComputedStyle(elemento);
    const r = caixa(elemento, origem);
    const raio = parseFloat(estilo.borderTopLeftRadius) * MM_POR_PIXEL;
    const borda = parseFloat(estilo.borderTopWidth);
    const uniforme = borda > 0 && [estilo.borderRightWidth, estilo.borderBottomWidth, estilo.borderLeftWidth]
      .every(largura => parseFloat(largura) === borda);
    pdf.setFillColor(...cor(estilo.backgroundColor));
    if (uniforme) {
      pdf.setDrawColor(...cor(estilo.borderTopColor));
      pdf.setLineWidth(borda * MM_POR_PIXEL);
    }
    pdf.roundedRect(r.x, r.y, r.largura, r.altura, raio, raio, uniforme ? "FD" : "F");
    if (!uniforme && parseFloat(estilo.borderBottomWidth) > 0) {
      pdf.setDrawColor(...cor(estilo.borderBottomColor));
      pdf.setLineWidth(parseFloat(estilo.borderBottomWidth) * MM_POR_PIXEL);
      pdf.line(r.x, r.y + r.altura, r.x + r.largura, r.y + r.altura);
    }
  }

  // Usa as quebras de linha do próprio HTML, mantendo os textos selecionáveis no PDF.
  function desenharTextos(pdf, folha, origem, janela, medidor) {
    const documento = folha.ownerDocument;
    const nos = documento.createTreeWalker(folha, 4);
    const trecho = documento.createRange();
    let no;
    while ((no = nos.nextNode())) {
      if (!no.textContent.trim()) continue;
      const estilo = janela.getComputedStyle(no.parentElement);
      const familia = fontes.find(([nome]) => estilo.fontFamily.includes(nome))?.[0] || "helvetica";
      const peso = familia === "helvetica" && parseInt(estilo.fontWeight, 10) >= 600 ? "bold" : "normal";
      const tamanho = parseFloat(estilo.fontSize);
      pdf.setFont(familia, peso);
      pdf.setFontSize(tamanho * 0.75);
      pdf.setTextColor(...cor(estilo.color));
      medidor.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
      const metricas = medidor.measureText("Hg");
      const ascendente = metricas.fontBoundingBoxAscent ?? tamanho * 0.8;
      let linha = null;
      function escrever() {
        if (!linha || !linha.texto.trim()) return;
        const largura = (linha.direita - linha.esquerda) * MM_POR_PIXEL;
        pdf.text(linha.texto, (linha.esquerda - origem.left) * MM_POR_PIXEL,
          (linha.topo - origem.top + ascendente) * MM_POR_PIXEL,
          { horizontalScale: largura / pdf.getTextWidth(linha.texto) });
      }
      let posicao = 0;
      for (const letra of no.textContent) {
        trecho.setStart(no, posicao);
        posicao += letra.length;
        trecho.setEnd(no, posicao);
        const r = trecho.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (linha && Math.abs(linha.topo - r.top) > 1) { escrever(); linha = null; }
        if (!linha) linha = { texto: "", esquerda: r.left, direita: r.right, topo: r.top };
        linha.texto += letra;
        linha.direita = r.right;
      }
      escrever();
    }
  }

  function desenharImagem(pdf, imagem, origem, janela, imagens, reducao) {
    const r = caixa(imagem, origem);
    if (janela.getComputedStyle(imagem).objectFit === "contain") {
      const escala = Math.min(r.largura / imagem.naturalWidth, r.altura / imagem.naturalHeight);
      const largura = imagem.naturalWidth * escala;
      const altura = imagem.naturalHeight * escala;
      r.x += (r.largura - largura) / 2;
      r.y += (r.altura - altura) / 2;
      r.largura = largura;
      r.altura = altura;
    }
    let entrada = imagens.get(imagem.src);
    if (!entrada) {
      entrada = { nome: `imagem-${imagens.size}`, dados: imagem.src };
      if (reducao < 1) {
        entrada.dados = global.DipsulCatalogoPDF.imagemParaPDF(imagem,
          imagem.naturalWidth * reducao, imagem.naturalHeight * reducao,
          0.76 * reducao, imagem.matches(".produto-imagem img") ? "#f8fbff" : "#fff");
      }
      imagens.set(imagem.src, entrada);
    }
    pdf.addImage(entrada.dados, "JPEG", r.x, r.y, r.largura, r.altura, entrada.nome);
  }

  async function carregarFontes(raiz, sinal, temIndice) {
    const arquivos = [];
    for (const [nome, arquivo] of fontes.slice(0, temIndice ? 3 : 1)) {
      const resposta = await fetch(new URL(`lib/catalogo/${arquivo}`, raiz), { signal: sinal });
      if (!resposta.ok) throw new Error("Não foi possível incorporar as fontes ao PDF. Tente novamente.");
      const bytes = new Uint8Array(await resposta.arrayBuffer());
      let dados = "";
      for (let inicio = 0; inicio < bytes.length; inicio += 8192) {
        dados += String.fromCharCode(...bytes.subarray(inicio, inicio + 8192));
      }
      arquivos.push({ nome, arquivo, dados });
    }
    return arquivos;
  }

  async function gerar({ documento, raiz, sinal, progresso = () => {} }) {
    sinal.throwIfAborted();
    if (!global.jspdf?.jsPDF) throw new Error("Não foi possível carregar o gerador de PDF. Atualize a página.");
    const principal = documento.querySelector(".catalogo-publico");
    if (!principal?.children.length) throw new Error("Gere a prévia do PDF público antes de baixar.");
    global.DipsulCatalogoPDF.atualizarDataExportacao(documento);
    const folhas = Array.from(principal.children);
    const destinos = new Map(folhas.map((folha, indice) => [folha.id, indice + 1]));
    const arquivos = await carregarFontes(raiz, sinal, !!principal.querySelector(".folha-indice"));
    const janela = documento.defaultView;
    const medidor = documento.createElement("canvas").getContext("2d");
    for (const reducao of [1, 0.8, 0.6]) {
      const pdf = new global.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true, precision: 5 });
      pdf.setProperties({ title: documento.title, author: "Dipsul Distribuidora", creator: "Catálogo Dipsul" });
      for (const { nome, arquivo, dados } of arquivos) {
        pdf.addFileToVFS(arquivo, dados);
        pdf.addFont(arquivo, nome, "normal");
      }
      const imagens = new Map();
      for (const [indice, folha] of folhas.entries()) {
        sinal.throwIfAborted();
        if (indice) pdf.addPage();
        const origem = folha.getBoundingClientRect();
        if (!origem.width) throw new Error("A prévia do catálogo foi fechada. Gere novamente.");
        for (const elemento of folha.querySelectorAll(".folha-categoria, .produto-impresso, .produto-imagem, .produto-codigo")) {
          desenharCaixa(pdf, elemento, origem, janela);
        }
        for (const imagem of folha.querySelectorAll("img")) {
          desenharImagem(pdf, imagem, origem, janela, imagens, reducao);
        }
        desenharTextos(pdf, folha, origem, janela, medidor);
        for (const link of folha.querySelectorAll('a[href*="#catalogo-pagina-"]')) {
          const pagina = destinos.get(link.hash.slice(1));
          if (!pagina) throw new Error("Destino inválido no índice do catálogo.");
          const r = caixa(link, origem);
          pdf.link(r.x, r.y, r.largura, r.altura, { pageNumber: pagina, top: 0 });
        }
        progresso(`${reducao < 1 ? "Compactando" : "Preparando download"}: página ${indice + 1} de ${folhas.length}...`);
        if (indice % 5 === 0) await new Promise(resolver => setTimeout(resolver, 0));
      }
      sinal.throwIfAborted();
      const arquivo = pdf.output("blob");
      if (arquivo.size <= LIMITE_BYTES) {
        const nome = `${documento.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim()}.pdf`;
        return { arquivo, nome, paginas: folhas.length };
      }
    }
    throw new Error("O PDF ainda excede 30 MB após a compactação. Exporte por categoria; nenhum arquivo acima do limite foi baixado.");
  }

  function baixar({ arquivo, nome }) {
    if (arquivo.size > LIMITE_BYTES) throw new Error("O PDF excede o limite de 30 MB.");
    const url = URL.createObjectURL(arquivo);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = nome;
    global.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  global.DipsulPDFPublico = { gerar, baixar };
})(window);
