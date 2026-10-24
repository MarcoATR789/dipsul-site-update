(function () {
  "use strict";

  const CHAVE_PEDIDOS = "dipsul_pedidos_v2";
  const CHAVE_LISTA_ANTIGA = "dipsul_catalogo_pedido_v1";
  const QUANTIDADE_MAXIMA_PEDIDO = 500;
  const TEMPO_PREVIEW_PEDIDO_MS = 500;
  const SUPABASE_FUNCAO_PEDIDO = "catalogo_registrar_pedido";
  const noCarrinho = !!document.getElementById("carrinho");
  const listaAtual = noCarrinho ? "carrinho" : "lista";
  const tela = {
    pedidoResumo: document.getElementById("catalogo-pedido-resumo"),
    pedidoItens: document.getElementById("catalogo-pedido-itens"),
    pedidoCnpj: document.getElementById("catalogo-pedido-cnpj"),
    pedidoEmpresa: document.getElementById("catalogo-pedido-empresa"),
    pedidoLimpar: document.getElementById("catalogo-pedido-limpar"),
    pedidoEnviar: document.getElementById("catalogo-pedido-enviar"),
    pedidoAdicionar: document.getElementById("catalogo-pedido-adicionar"),
    pedidoPainel: document.getElementById("catalogo-pedido-painel"),
    pedidoBotao: document.getElementById("catalogo-pedido-botao"),
    pedidoFechar: document.getElementById("catalogo-pedido-fechar"),
    pedidoContador: document.getElementById("catalogo-pedido-contador"),
    formulario: document.getElementById("carrinho-finalizar"),
    status: document.getElementById("catalogo-status")
  };
  let pedidos = { lista: [], carrinho: [] };
  let temporizadorPreviewPedido = null;
  let pedidoAbertoAutomatico = false;
  let pedidoEnviando = false;

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
    if (tela.status) {
      tela.status.textContent = texto;
      tela.status.classList.toggle("text-danger", erro);
    }
    if (!noCarrinho) window.Dipsul?.notificar(texto, { tipo: erro ? "erro" : "status" });
  }

  function normalizarItens(itens) {
    if (!Array.isArray(itens)) throw new Error("Não foi possível ler os itens salvos.");
    const mapa = new Map();
    for (const item of itens) {
      if (!item || !item.codigo || !item.descricao) continue;
      mapa.set(String(item.codigo), {
        codigo: String(item.codigo),
        descricao: String(item.descricao),
        quantidade: normalizarQuantidade(item.quantidade)
      });
    }
    return Array.from(mapa.values());
  }

  function lerPedidos() {
    const salvo = localStorage.getItem(CHAVE_PEDIDOS);
    if (salvo === null) {
      return { lista: normalizarItens(JSON.parse(localStorage.getItem(CHAVE_LISTA_ANTIGA) || "[]")), carrinho: [] };
    }
    const dados = JSON.parse(salvo);
    return { lista: normalizarItens(dados.lista), carrinho: normalizarItens(dados.carrinho) };
  }

  function salvarPedidos(dados) {
    // Uma única gravação transfere os itens e limpa a seleção sem perder produtos.
    localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(dados));
    pedidos = dados;
    try { localStorage.removeItem(CHAVE_LISTA_ANTIGA); } catch {}
    renderizarPedido();
  }

  function carregarPedidos() {
    try {
      pedidos = lerPedidos();
      renderizarPedido();
      return true;
    } catch {
      avisarPedido("Não foi possível ler os pedidos salvos neste navegador.", true);
      return false;
    }
  }

  function editarPedido(alterar) {
    if (pedidoEnviando) return false;
    try {
      const dados = lerPedidos();
      const itens = new Map(dados[listaAtual].map(item => [item.codigo, item]));
      alterar(itens);
      if (itens.size > 1000) throw new Error("O pedido deve ter no máximo 1000 itens diferentes.");
      dados[listaAtual] = Array.from(itens.values());
      salvarPedidos(dados);
      return true;
    } catch (erro) {
      avisarPedido(erro instanceof DOMException ? "Não foi possível salvar. Verifique o armazenamento do navegador." : erro.message, true);
      return false;
    }
  }

  function adicionarItemPedido(produto, quantidade) {
    const salvo = editarPedido(itens => {
      const codigo = String(produto.codigo);
      const atual = itens.get(codigo)?.quantidade || 0;
      itens.set(codigo, { codigo, descricao: produto.descricao, quantidade: Math.min(atual + normalizarQuantidade(quantidade), QUANTIDADE_MAXIMA_PEDIDO) });
    });
    if (salvo) mostrarPreviewPedido();
  }

  function atualizarQuantidadePedido(codigo, quantidade) {
    editarPedido(itens => {
      const item = itens.get(codigo);
      if (item) item.quantidade = normalizarQuantidade(quantidade);
    });
  }

  function alterarQuantidadePedido(codigo, incremento) {
    editarPedido(itens => {
      const item = itens.get(codigo);
      if (item) item.quantidade = normalizarQuantidade(item.quantidade + incremento);
    });
  }

  function removerItemPedido(codigo) {
    editarPedido(itens => itens.delete(codigo));
  }

  function limparPedido() {
    editarPedido(itens => itens.clear());
  }

  function adicionarAoCarrinho() {
    try {
      const dados = lerPedidos();
      if (!dados.lista.length) { carregarPedidos(); return; }
      const carrinho = new Map(dados.carrinho.map(item => [item.codigo, item]));
      for (const item of dados.lista) {
        const quantidade = (carrinho.get(item.codigo)?.quantidade || 0) + item.quantidade;
        if (quantidade > QUANTIDADE_MAXIMA_PEDIDO) throw new Error("O produto " + item.codigo + " ultrapassaria 500 unidades no carrinho. Ajuste a quantidade antes de adicionar.");
        carrinho.set(item.codigo, { ...item, quantidade });
      }
      if (carrinho.size > 1000) throw new Error("O carrinho deve ter no máximo 1000 itens diferentes.");
      dados.carrinho = Array.from(carrinho.values());
      dados.lista = [];
      salvarPedidos(dados);
      fecharPainelPedido();
      window.location.assign(document.querySelector("[data-carrinho-link]").href);
    } catch (erro) {
      avisarPedido(erro instanceof DOMException ? "Não foi possível salvar o carrinho. Sua seleção foi mantida." : erro.message, true);
    }
  }

  function obterItensPedido() {
    return pedidos[listaAtual];
  }

  function renderizarPedido() {
    for (const link of document.querySelectorAll("[data-carrinho-link]")) {
      link.querySelector("[data-carrinho-contador]").textContent = String(pedidos.carrinho.length);
      link.setAttribute("aria-label", "Carrinho de compras: " + pedidos.carrinho.length + " item(ns)");
    }
    if (!tela.pedidoItens) return;
    const itens = obterItensPedido();
    const total = itens.reduce((soma, item) => soma + item.quantidade, 0);
    tela.pedidoItens.replaceChildren();
    if (!itens.length) {
      const vazio = document.createElement("p");
      vazio.className = "catalogo-pedido-vazio";
      vazio.textContent = noCarrinho ? "Seu carrinho está vazio." : "Selecione produtos no catálogo para montar sua lista.";
      tela.pedidoItens.append(vazio);
    } else {
      itens.forEach((item, indice) => tela.pedidoItens.append(criarItemPedido(item, indice)));
    }
    tela.pedidoResumo.textContent = itens.length ? itens.length + " item(ns), " + total + " unidade(s)." : "Nenhum item selecionado.";
    if (tela.pedidoContador) tela.pedidoContador.textContent = String(itens.length);
    if (tela.pedidoLimpar) tela.pedidoLimpar.disabled = pedidoEnviando || !itens.length;
    if (tela.pedidoEnviar) tela.pedidoEnviar.disabled = pedidoEnviando || !itens.length;
    if (tela.pedidoAdicionar) tela.pedidoAdicionar.disabled = !itens.length;
    if (tela.formulario) tela.formulario.querySelector("fieldset").disabled = pedidoEnviando || !itens.length;
    if (pedidoEnviando) tela.pedidoItens.querySelectorAll("input, button").forEach(controle => { controle.disabled = true; });
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

    if (empresa.length < 2 || empresa.length > 120) {
      throw new Error("Informe o nome da empresa com 2 a 120 caracteres.");
    }

    return { cnpj, empresa };
  }

  async function registrarPedidoSupabase(cliente, itens) {
    if (itens.length > 1000) throw new Error("O pedido deve ter no máximo 1000 itens diferentes.");
    const parametros = { p_cnpj: cliente.cnpj, p_empresa: cliente.empresa };
    const solicitar = (funcao, dados) => fetch(`${window.DipsulConfiguracao.supabaseUrl}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: {
        apikey: window.DipsulConfiguracao.supabaseChavePublica,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dados)
    });

    let resposta = await solicitar("catalogo_registrar_pedido_itens", { ...parametros, p_itens: itens });
    // Compatibilidade apenas enquanto a nova função SQL ainda não foi instalada.
    if (resposta.status === 404) {
      const erro = await resposta.clone().json().catch(() => ({}));
      if (erro.code === "PGRST202") resposta = await solicitar(SUPABASE_FUNCAO_PEDIDO, parametros);
    }

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

  function montarMensagemPedido(cliente, itens) {
    const linhasItens = itens.map((item, indice) => {
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
    renderizarPedido();
    tela.pedidoEnviar.disabled = pedidoEnviando || !obterItensPedido().length;
    tela.pedidoEnviar.textContent = ativo ? "Selecionando televendas..." : "Finalizar pelo WhatsApp";
  }

  async function enviarPedidoWhatsApp() {
    if (pedidoEnviando) return;
    if (!carregarPedidos()) return;
    if (!obterItensPedido().length) {
      avisarPedido("Selecione ao menos um item para finalizar o pedido.", true);
      return;
    }

    try {
      const cliente = obterClientePedido();
      const itens = obterItensPedido().map(({ codigo, descricao, quantidade }) => ({ codigo, descricao, quantidade }));

      definirEnvioPedidoAtivo(true);
      avisarPedido("Selecionando televendas...");

      const atendimento = await registrarPedidoSupabase(cliente, itens);
      const mensagem = montarMensagemPedido(cliente, itens);
      const numero = obterDigitos(atendimento.televendas_whatsapp);
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

      avisarPedido(`Pedido direcionado para ${atendimento.televendas_nome}.`);
      window.location.assign(url);
    } catch (erro) {
      avisarPedido(erro.message || "Não foi possível finalizar o pedido.", true);
    } finally {
      definirEnvioPedidoAtivo(false);
    }
  }

  window.DipsulPedidos = {
    adicionar: adicionarItemPedido,
    configurarQuantidade: configurarCampoQuantidade
  };

  document.addEventListener("DOMContentLoaded", () => {
    carregarPedidos();
    configurarCampoCnpj();
    tela.pedidoAdicionar?.addEventListener("click", adicionarAoCarrinho);
    tela.pedidoLimpar?.addEventListener("click", limparPedido);
    tela.pedidoBotao?.addEventListener("click", alternarPainelPedido);
    tela.pedidoFechar?.addEventListener("click", fecharPainelPedido);
    tela.formulario?.addEventListener("submit", evento => {
      evento.preventDefault();
      enviarPedidoWhatsApp();
    });
  });
  window.addEventListener("storage", evento => {
    if (evento.key === CHAVE_PEDIDOS || evento.key === CHAVE_LISTA_ANTIGA || evento.key === null) carregarPedidos();
  });
  window.addEventListener("pageshow", carregarPedidos);
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharPainelPedido();
  });
})();
