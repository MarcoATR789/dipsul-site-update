(function () {
  "use strict";

  const CHAVE_PEDIDOS = "dipsul_pedidos_v2";
  const CHAVE_LISTA_ANTIGA = "dipsul_catalogo_pedido_v1";
  const QUANTIDADE_MAXIMA_PEDIDO = 500;
  const TEMPO_PREVIEW_PEDIDO_MS = 500;
  const urlCatalogo = new URL("../data/catalogo/produtos.json", document.currentScript.src);
  const noCarrinho = !!document.getElementById("carrinho");
  const listaAtual = noCarrinho ? "carrinho" : "lista";
  const { obterDigitos, formatarCnpj, cnpjValido, formatarTelefone, montarMensagemPedido } = window.Dipsul;
  const tela = {
    pedidoResumo: document.getElementById("catalogo-pedido-resumo"),
    pedidoItens: document.getElementById("catalogo-pedido-itens"),
    pedidoCnpj: document.getElementById("catalogo-pedido-cnpj"),
    pedidoEmpresa: document.getElementById("catalogo-pedido-empresa"),
    pedidoTelefone: document.getElementById("catalogo-pedido-telefone"),
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
  let produtos = new Map();
  let temporizadorPreviewPedido = null;
  let pedidoAbertoAutomatico = false;
  let pedidoEnviando = false;
  let clientePedido = null, contaPronta = !noCarrinho, consultaConta = 0;

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

  function configurarCampoCnpj() {
    if (!tela.pedidoCnpj) return;

    tela.pedidoCnpj.addEventListener("input", () => {
      tela.pedidoCnpj.value = formatarCnpj(tela.pedidoCnpj.value);
    });
  }

  function avisarPedido(texto, erro = false) {
    if (tela.status) {
      tela.status.textContent = erro ? "" : texto;
    }
    if (!noCarrinho || erro) window.Dipsul?.notificar(texto, { tipo: erro ? "erro" : "status" });
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

  async function carregarFotos() {
    if (!noCarrinho) return;
    try {
      const resposta = await fetch(urlCatalogo, { cache: "no-cache" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.json();
      produtos = new Map(dados.map(produto => [String(produto.codigo), produto]));
      tela.pedidoItens.querySelectorAll(".carrinho-produto-imagem").forEach(imagem => {
        window.Dipsul.definirImagemProduto(imagem, produtos.get(imagem.dataset.codigo));
      });
    } catch (erro) {
      console.warn("Não foi possível carregar as fotos do carrinho.", erro);
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
    if (tela.pedidoEnviar) tela.pedidoEnviar.disabled = pedidoEnviando || !itens.length || !contaPronta || (clientePedido && clientePedido.situacao !== "aprovado");
    if (tela.pedidoAdicionar) tela.pedidoAdicionar.disabled = !itens.length;
    if (tela.formulario) tela.formulario.querySelector("fieldset").disabled = pedidoEnviando || !itens.length || !contaPronta;
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

    if (noCarrinho) {
      const imagem = document.createElement("img");
      imagem.className = "carrinho-produto-imagem";
      imagem.dataset.codigo = item.codigo;
      imagem.alt = item.descricao;
      imagem.width = imagem.height = 80;
      imagem.loading = "lazy";
      imagem.decoding = "async";
      window.Dipsul.definirImagemProduto(imagem, produtos.get(item.codigo));
      info.appendChild(imagem);
    }

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
    if (!contaPronta) throw new Error("Não foi possível verificar os dados da conta. Recarregue a página.");
    if (clientePedido) {
      if (clientePedido.situacao !== "aprovado") throw new Error("O cadastro precisa estar aprovado para finalizar com esta conta.");
      return { ...clientePedido };
    }
    const cnpj = obterDigitos(tela.pedidoCnpj && tela.pedidoCnpj.value);
    const empresa = normalizarTextoCliente(tela.pedidoEmpresa && tela.pedidoEmpresa.value);
    const telefone = obterDigitos(tela.pedidoTelefone && tela.pedidoTelefone.value);

    if (!cnpjValido(cnpj)) {
      throw new Error("Informe um CNPJ válido.");
    }

    if (empresa.length < 2 || empresa.length > 120) {
      throw new Error("Informe o nome da empresa com 2 a 120 caracteres.");
    }

    if (!/^[1-9]{2}\d{8,9}$/.test(telefone)) {
      throw new Error("Informe um telefone com DDD, com 10 ou 11 dígitos.");
    }

    return { cnpj, empresa, telefone };
  }

  async function registrarPedidoSupabase(cliente, itens) {
    if (itens.length > 1000) throw new Error("O pedido deve ter no máximo 1000 itens diferentes.");
    if (!window.DipsulConta) throw new Error("Não foi possível verificar a conta. Recarregue a página.");
    const { data, error } = await window.DipsulConta.auth.getSession();
    if (error) throw new Error("Não foi possível verificar a sessão. Entre novamente na sua conta.");
    const sessao = data.session;
    if ((sessao?.user.id || null) !== (cliente.usuario_id || null)) throw new Error("A sessão foi alterada. Atualize o carrinho antes de finalizar.");
    const funcao = sessao ? "catalogo_cliente_registrar_pedido" : "catalogo_registrar_pedido_itens";
    const resposta = await fetch(`${window.DipsulConfiguracao.supabaseUrl}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: {
        apikey: window.DipsulConfiguracao.supabaseChavePublica,
        ...(sessao ? { Authorization: `Bearer ${sessao.access_token}` } : {}),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_cnpj: cliente.cnpj, p_empresa: cliente.empresa, p_telefone: cliente.telefone, p_itens: itens })
    });

    if (!resposta.ok) {
      let mensagem = "Não foi possível registrar o pedido. Tente novamente.";

      try {
        const erro = await resposta.json();
        if (erro.code !== "PGRST202") mensagem = erro.message || mensagem;
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

  async function preencherCliente() {
    if (!noCarrinho) return false;
    const consulta = ++consultaConta;
    contaPronta = false;
    const campos = [tela.pedidoEmpresa, tela.pedidoCnpj, tela.pedidoTelefone];
    campos.forEach(campo => { campo.readOnly = true; });
    renderizarPedido();
    try {
      if (!window.DipsulConta) throw new Error("Não foi possível verificar a conta. Recarregue a página.");
      const { data, error } = await window.DipsulConta.auth.getSession();
      if (consulta !== consultaConta) return false;
      if (error) throw new Error("Não foi possível verificar a sessão. Entre novamente na sua conta.");
      const campoConta = document.getElementById("carrinho-conta");
      if (!data.session) {
        if (clientePedido) campos.forEach(campo => { campo.value = ""; });
        clientePedido = null;
        campos.forEach(campo => { campo.readOnly = false; });
        campoConta.textContent = "Entrar na minha conta"; campoConta.hash = "";
      } else {
        campoConta.textContent = "Editar dados no perfil"; campoConta.hash = "perfil";
        const resposta = await window.DipsulConta.from("catalogo_clientes").select("usuario_id,empresa,cnpj,telefone,situacao").eq("usuario_id", data.session.user.id).maybeSingle();
        if (consulta !== consultaConta) return false;
        if (resposta.error || !resposta.data) throw new Error("Não foi possível carregar o perfil. Acesse sua conta para conferir o cadastro.");
        clientePedido = resposta.data;
        tela.pedidoEmpresa.value = clientePedido.empresa;
        tela.pedidoCnpj.value = formatarCnpj(clientePedido.cnpj);
        tela.pedidoTelefone.value = formatarTelefone(clientePedido.telefone);
      }
      contaPronta = true;
      avisarPedido(clientePedido?.situacao === "pendente" ? "Cadastro aguardando aprovação." : clientePedido?.situacao === "bloqueado" ? "Cadastro bloqueado. Entre em contato com o televendas." : "");
      return true;
    } catch (erro) {
      if (consulta === consultaConta) {
        if (clientePedido) campos.forEach(campo => { campo.value = ""; });
        avisarPedido(erro.message || "Não foi possível carregar o perfil. Recarregue a página.", true);
      }
      return false;
    } finally { if (consulta === consultaConta) renderizarPedido(); }
  }

  function definirEnvioPedidoAtivo(ativo) {
    if (!tela.pedidoEnviar) return;

    pedidoEnviando = ativo;
    renderizarPedido();
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
      definirEnvioPedidoAtivo(true);
      if (!await preencherCliente()) return;
      const cliente = obterClientePedido();
      const itens = obterItensPedido().map(({ codigo, descricao, quantidade }) => ({ codigo, descricao, quantidade }));

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
    carregarFotos();
    configurarCampoCnpj();
    preencherCliente();
    if (noCarrinho && window.DipsulConta) window.DipsulConta.auth.onAuthStateChange(evento => {
      if (!["SIGNED_OUT", "SIGNED_IN", "USER_UPDATED"].includes(evento)) return;
      consultaConta++; contaPronta = false;
      [tela.pedidoEmpresa, tela.pedidoCnpj, tela.pedidoTelefone].forEach(campo => { campo.value = ""; campo.readOnly = true; });
      renderizarPedido();
      setTimeout(() => { if (!pedidoEnviando) preencherCliente(); }, 0);
    });
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
  window.addEventListener("pageshow", evento => {
    carregarPedidos();
    if (evento.persisted && !pedidoEnviando) preencherCliente();
  });
  window.addEventListener("focus", () => { if (noCarrinho && !pedidoEnviando) preencherCliente(); });
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharPainelPedido();
  });
})();
