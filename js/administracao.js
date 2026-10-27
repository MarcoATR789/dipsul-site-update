(function () {
  "use strict";

  const campo = (id) => document.getElementById(id);
  const raiz = new URL("../../", window.location.href);
  const nomesSituacao = { novo: "Novo", em_atendimento: "Em atendimento", concluido: "Concluído", cancelado: "Cancelado" };
  const nomesSituacaoCliente = { pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Bloqueado" };
  const porPagina = 25;
  const abas = ["pedidos", "clientes", "catalogo", "administradores"];
  const nomesMenus = { pedidos: "Pedidos", clientes: "Clientes", catalogo: "Catálogo", administradores: "Permissão" };
  let permissoes = null, abaAtual = null;
  let paginaAdministradores = 0, consultaAdministradores = 0, administradorAberto = null;
  let cliente;
  let usuario = null;
  let versaoSessao = 0;
  let consultaAtual = 0;
  let detalheAtual = 0;
  let pagina = 0;
  let paginaClientes = 0;
  let consultaClientes = 0;
  let detalheClienteAtual = 0;
  let clienteParaAlterar = null;
  let pedidoAberto = null;
  let pedidoParaExcluir = null;
  let vendedores = new Map();
  let produtos = null;
  let geracaoPDF = null;
  let leituraCatalogo = null;
  let ultimaAtividade = Date.now();

  function mensagem(id, texto, erro = false) {
    campo(id).textContent = erro ? "" : texto;
    if (erro) window.Dipsul.notificar(texto, { tipo: "erro" });
  }

  function elemento(tag, texto, classe) {
    const novo = document.createElement(tag);
    if (texto != null) novo.textContent = String(texto);
    if (classe) novo.className = classe;
    return novo;
  }

  function mostrarSenha(visivel, botao = campo("alternar-senha")) {
    window.Dipsul.mostrarSenha(botao, visivel);
  }

  function limparLogin() {
    campo("formulario-login").reset();
    mostrarSenha(false);
  }

  function validarTamanhoSenha() {
    const senha = campo("senha-nova");
    const valido = senha.value.length >= senha.minLength && senha.value.length <= senha.maxLength;
    const requisito = campo("senha-tamanho");
    const classe = valido ? "text-success" : "text-danger";
    if (requisito.className !== classe) {
      requisito.className = classe;
      requisito.querySelector("span").textContent = valido ? "Atendido:" : "Pendente:";
    }
    senha.setAttribute("aria-invalid", String(senha.value.length > 0 && !valido));
    return valido;
  }

  function limparFormularioSenha() {
    campo("formulario-senha").reset();
    validarTamanhoSenha();
    campo("dialogo-senha").querySelectorAll("[data-visualizar-senha]").forEach((botao) => mostrarSenha(false, botao));
  }

  function bloquearFormularioSenha(bloqueado) {
    campo("dialogo-senha").querySelectorAll("input, button").forEach((controle) => { controle.disabled = bloqueado; });
    campo("sair").disabled = campo("trocar-senha").disabled = bloqueado;
    campo("dialogo-senha").setAttribute("aria-busy", String(bloqueado));
  }

  function dataBrasil(data) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(data));
  }

  function formatarCnpj(cnpj) {
    return String(cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  function formatarTelefone(telefone) {
    const partes = String(telefone || "").replace(/\D/g, "").match(/^(55)?(\d{2})(\d{4,5})(\d{4})$/);
    return partes ? `${partes[1] ? "+55 " : ""}(${partes[2]}) ${partes[3]}-${partes[4]}` : String(telefone || "");
  }

  function limparPDF() {
    geracaoPDF?.abort();
    geracaoPDF = null;
    campo("previa-pdf").hidden = true;
    campo("previa-pdf").contentDocument?.body.replaceChildren();
    campo("imprimir-pdf").disabled = true;
    campo("preparar-pdf").disabled = !produtos;
    campo("cancelar-pdf").hidden = true;
    mensagem("pdf-mensagem", "");
  }

  function limparSessao(texto = "") {
    versaoSessao++;
    consultaAtual++;
    consultaClientes++;
    detalheAtual++;
    usuario = null;
    permissoes = null;
    consultaAdministradores++;
    paginaAdministradores = 0;
    campo("dialogo-permissoes").close();
    campo("administradores-lista").replaceChildren();
    campo("administradores-pagina").textContent = "";
    mensagem("administradores-mensagem", "");
    pedidoAberto = null;
    produtos = null;
    vendedores.clear();
    leituraCatalogo?.abort();
    leituraCatalogo = null;
    limparPDF();
    campo("painel").hidden = campo("sessao").hidden = true;
    campo("acesso").hidden = false;
    campo("usuario-email").textContent = "";
    limparLogin();
    campo("dialogo-senha").close();
    limparFormularioSenha();
    campo("confirmacao-exclusao").close();
    campo("confirmacao-exclusao").removeAttribute("aria-busy");
    pedidoParaExcluir = null;
    campo("exclusao-dados").replaceChildren();
    mensagem("exclusao-mensagem", "");
    for (const id of ["confirmar-exclusao", "cancelar-exclusao", "fechar-exclusao"]) campo(id).disabled = false;
    campo("detalhes").close();
    fecharCliente();
    campo("clientes-lista").replaceChildren();
    campo("clientes-pagina").textContent = "";
    campo("clientes-mensagem").textContent = "";
    campo("clientes-filtros").reset();
    paginaClientes = 0;
    for (const id of ["pedidos-lista", "detalhes-dados", "detalhes-itens", "pedido-data"]) campo(id).replaceChildren();
    campo("televendas").replaceChildren(new Option("Todos", ""));
    campo("categoria-pdf").replaceChildren(new Option("Todas as categorias", ""));
    campo("categoria-pdf").disabled = true;
    selecionarAba("pedidos");
    campo("filtros").reset();
    campo("formulario-situacao").reset();
    campo("salvar-situacao").disabled = campo("excluir-pedido").disabled = false;
    campo("detalhes-conteudo").hidden = true;
    campo("titulo-detalhes").textContent = "Pedido:";
    campo("detalhes-mensagem").textContent = "";
    campo("itens-mensagem").textContent = "";
    campo("pedidos-mensagem").textContent = "";
    campo("pagina-atual").textContent = "";
    document.querySelectorAll(".dipsul-notificacao").forEach((aviso) => aviso.remove());
    mensagem("mensagem-acesso", "");
    if (texto) window.Dipsul.notificar(texto);
  }

  async function sair(texto = "Sessão encerrada.") {
    limparSessao(texto);
    await cliente.auth.signOut({ scope: "local" });
  }

  function podeAcessar(menu) {
    return abas.includes(menu) && !!permissoes && (permissoes.absoluto || permissoes.menus.includes(menu));
  }

  function mostrarAbas() {
    if (!podeAcessar(abaAtual)) abaAtual = abas.find(podeAcessar) || null;
    for (const nome of abas) {
      campo(`aba-${nome}`).hidden = !podeAcessar(nome);
      campo(`secao-${nome}`).hidden = nome !== abaAtual;
      campo(`aba-${nome}`).classList.toggle("ativa", nome === abaAtual);
      campo(`aba-${nome}`).setAttribute("aria-pressed", String(nome === abaAtual));
    }
    campo("sem-menus").hidden = !!abaAtual;
  }

  async function confirmarAcesso(menu) {
    const versao = versaoSessao;
    const resposta = await cliente.rpc("catalogo_admin_perfil");
    if (versao !== versaoSessao) throw new Error("Sessão alterada.");
    if (resposta.error) {
      permissoes = null;
      mostrarAbas();
      throw new Error("Não foi possível verificar as permissões. Confira a conexão e a aplicação do SQL catalogo-admin-menus.sql.");
    }
    if (!resposta.data || !Array.isArray(resposta.data.menus)) {
      await sair("Usuário sem autorização administrativa.");
      throw new Error("Usuário sem autorização administrativa.");
    }
    permissoes = { absoluto: resposta.data.absoluto === true, menus: resposta.data.menus };
    if (!podeAcessar("pedidos")) {
      consultaAtual++; detalheAtual++;
      campo("pedidos-lista").replaceChildren();
      campo("detalhes").close(); vendedores.clear();
    }
    if (!podeAcessar("clientes")) {
      consultaClientes++; fecharCliente(); campo("clientes-lista").replaceChildren();
    }
    if (!podeAcessar("catalogo")) { leituraCatalogo?.abort(); produtos = null; limparPDF(); }
    if (!podeAcessar("administradores")) {
      consultaAdministradores++; campo("dialogo-permissoes").close(); campo("administradores-lista").replaceChildren();
    }
    mostrarAbas();
    if (menu && !podeAcessar(menu)) throw new Error("Este menu não está liberado para seu administrador.");
  }

  async function iniciarSessao(sessao) {
    if (!sessao) { limparSessao(); return; }
    const versao = ++versaoSessao;
    await confirmarAcesso();
    if (versao !== versaoSessao) return;
    usuario = sessao.user;
    ultimaAtividade = Date.now();
    campo("usuario-email").textContent = usuario.email;
    campo("acesso").hidden = true;
    campo("painel").hidden = campo("sessao").hidden = false;
    campo("admin-senha").value = "";
    mostrarSenha(false);
    pagina = 0;
    selecionarAba(abas.find(podeAcessar));
  }

  async function carregarVendedores() {
    const versao = versaoSessao;
    const resposta = await cliente.from("catalogo_televendas").select("id,nome,telefone_whatsapp").order("ordem");
    if (versao !== versaoSessao) return;
    if (resposta.error) throw new Error("Não foi possível carregar os televendas.");
    vendedores = new Map(resposta.data.map(vendedor => [String(vendedor.id), window.Dipsul.identificarTelevendas(vendedor)]));
    campo("televendas").replaceChildren(new Option("Todos", ""));
    for (const [id, nome] of vendedores) campo("televendas").add(new Option(nome, id));
  }

  async function carregarPedidos() {
    if (!usuario || !podeAcessar("pedidos")) return;
    const consulta = ++consultaAtual;
    const versao = versaoSessao;
    campo("pedidos-lista").replaceChildren();
    campo("anterior").disabled = campo("proxima").disabled = true;
    campo("pagina-atual").textContent = "";
    mensagem("pedidos-mensagem", "Carregando pedidos...");
    try {
      const inicio = campo("data-inicio").value;
      const fim = campo("data-fim").value;
      if (inicio && fim && inicio > fim) throw new Error("A data inicial deve ser anterior à data final.");
      await confirmarAcesso("pedidos");
      if (!vendedores.size) await carregarVendedores();
      let consultaPedidos = cliente.from("catalogo_pedidos_log")
        .select("id,cnpj,empresa,televendas_id,situacao,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).order("id", { ascending: false });
      const busca = campo("busca").value.trim();
      if (busca) {
        consultaPedidos = /^[\d.\/\-\s]+$/.test(busca)
          ? consultaPedidos.like("cnpj", `%${busca.replace(/\D/g, "")}%`)
          : consultaPedidos.ilike("empresa", `%${busca.replace(/[\\%_]/g, "\\$&")}%`);
      }
      if (campo("situacao").value) consultaPedidos = consultaPedidos.eq("situacao", campo("situacao").value);
      if (campo("televendas").value) consultaPedidos = consultaPedidos.eq("televendas_id", campo("televendas").value);
      if (inicio) consultaPedidos = consultaPedidos.gte("created_at", `${inicio}T00:00:00-03:00`);
      if (fim) {
        const limite = new Date(`${fim}T00:00:00-03:00`);
        limite.setUTCDate(limite.getUTCDate() + 1);
        consultaPedidos = consultaPedidos.lt("created_at", limite.toISOString());
      }
      const resposta = await consultaPedidos.range(pagina * porPagina, (pagina + 1) * porPagina - 1);
      if (versao !== versaoSessao || consulta !== consultaAtual) return;
      if (resposta.error) throw new Error("Não foi possível carregar os pedidos.");
      const total = resposta.count || 0;
      if (pagina > 0 && pagina * porPagina >= total) { pagina = 0; return carregarPedidos(); }
      for (const pedido of resposta.data) {
        const linha = elemento("tr");
        const data = elemento("td", `#${pedido.id}`);
        data.append(elemento("small", dataBrasil(pedido.created_at)));
        const empresa = elemento("td", pedido.empresa);
        empresa.append(elemento("small", formatarCnpj(pedido.cnpj)));
        const situacao = elemento("td");
        situacao.append(elemento("span", nomesSituacao[pedido.situacao] || pedido.situacao, `admin-situacao ${pedido.situacao}`));
        const acao = elemento("td");
        const botao = elemento("button", null, "btn btn-outline-secondary botao-icone");
        botao.type = "button";
        botao.title = `Detalhes do pedido ${pedido.id}`;
        botao.setAttribute("aria-label", botao.title);
        const icone = elemento("i", null, "fa fa-eye");
        icone.setAttribute("aria-hidden", "true");
        botao.append(icone);
        botao.addEventListener("click", () => abrirPedido(pedido.id));
        acao.append(botao);
        linha.append(data, empresa, elemento("td", vendedores.get(String(pedido.televendas_id)) || "Não informado"), situacao, acao);
        campo("pedidos-lista").append(linha);
      }
      mensagem("pedidos-mensagem", total ? `${total} pedido(s) encontrado(s).` : "Nenhum pedido encontrado.");
      campo("pagina-atual").textContent = total ? `Página ${pagina + 1} de ${Math.ceil(total / porPagina)}` : "";
      campo("anterior").disabled = pagina === 0;
      campo("proxima").disabled = (pagina + 1) * porPagina >= total;
    } catch (erro) {
      if (versao === versaoSessao && consulta === consultaAtual) mensagem("pedidos-mensagem", erro.message, true);
    }
  }

  async function abrirPedido(id) {
    if (!usuario || !podeAcessar("pedidos")) return;
    const versao = versaoSessao;
    const detalhe = ++detalheAtual;
    pedidoAberto = null;
    campo("detalhes-conteudo").hidden = true;
    campo("titulo-detalhes").textContent = `Pedido #${id}:`;
    if (!campo("detalhes").open) campo("detalhes").showModal();
    mensagem("detalhes-mensagem", "Carregando detalhes...");
    try {
      await confirmarAcesso("pedidos");
      const resposta = await cliente.from("catalogo_pedidos_log")
        .select("id,cnpj,empresa,telefone,televendas_id,created_at,updated_at,situacao,itens").eq("id", id).single();
      if (resposta.error) throw new Error("Não foi possível carregar os detalhes do pedido.");
      if (versao !== versaoSessao || detalhe !== detalheAtual) return;
      pedidoAberto = resposta.data;
      const pedido = pedidoAberto;
      campo("detalhes-dados").replaceChildren();
      for (const [nome, valor] of Object.entries({ Empresa: pedido.empresa, CNPJ: formatarCnpj(pedido.cnpj), Telefone: formatarTelefone(pedido.telefone) || "Não informado", Data: dataBrasil(pedido.created_at), Televendas: vendedores.get(String(pedido.televendas_id)) || "Não informado" })) {
        campo("detalhes-dados").append(elemento("dt", `${nome}:`), elemento("dd", valor));
      }
      campo("detalhes-itens").replaceChildren();
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      campo("itens-mensagem").textContent = itens.length ? `${itens.length} item(ns), ${itens.reduce((total, item) => total + Number(item.quantidade || 0), 0)} unidade(s).` : "Itens não registrados neste pedido antigo.";
      for (const item of itens) {
        const linha = elemento("tr");
        linha.append(elemento("td", item.codigo), elemento("td", item.descricao), elemento("td", item.quantidade));
        campo("detalhes-itens").append(linha);
      }
      campo("nova-situacao").value = pedido.situacao;
      campo("observacao").value = "";
      campo("pedido-data").textContent = `Pedido realizado no site em ${dataBrasil(pedido.created_at)}.`;
      mensagem("detalhes-mensagem", "");
      campo("detalhes-conteudo").hidden = false;
    } catch (erro) {
      if (versao === versaoSessao && detalhe === detalheAtual) mensagem("detalhes-mensagem", erro.message, true);
    }
  }

  async function carregarCatalogo() {
    if (!usuario || !podeAcessar("catalogo") || produtos || leituraCatalogo) return;
    const leitura = new AbortController();
    leituraCatalogo = leitura;
    const categoriaSelecionada = campo("categoria-pdf").value;
    mensagem("pdf-mensagem", "Carregando catálogo...");
    try {
      await confirmarAcesso("catalogo");
      leitura.signal.throwIfAborted();
      const catalogo = await window.DipsulCatalogoPDF.carregarProdutos(raiz, leitura.signal);
      leitura.signal.throwIfAborted();
      produtos = catalogo;
      campo("categoria-pdf").replaceChildren(new Option("Todas as categorias", ""));
      const categorias = [...new Set(produtos.map((produto) => produto.categoria))];
      for (const categoria of categorias) campo("categoria-pdf").add(new Option(categoria, categoria));
      campo("categoria-pdf").value = categorias.includes(categoriaSelecionada) ? categoriaSelecionada : "";
      campo("categoria-pdf").disabled = campo("preparar-pdf").disabled = false;
      mensagem("pdf-mensagem", `${produtos.length} produtos · ${categorias.length} categorias`);
    } catch (erro) {
      if (!leitura.signal.aborted) {
        mensagem("pdf-mensagem", erro.message, true);
        campo("preparar-pdf").disabled = false;
      }
    } finally { if (leituraCatalogo === leitura) leituraCatalogo = null; }
  }

  async function carregarClientes() {
    if (!usuario || !podeAcessar("clientes")) return;
    const consulta = ++consultaClientes, versao = versaoSessao;
    campo("clientes-lista").replaceChildren();
    campo("clientes-anterior").disabled = campo("clientes-proxima").disabled = true;
    campo("clientes-pagina").textContent = "";
    mensagem("clientes-mensagem", "Carregando cadastros...");
    try {
      await confirmarAcesso("clientes");
      let busca = cliente.from("catalogo_clientes").select("usuario_id,empresa,cnpj,telefone,situacao,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).order("usuario_id");
      const termo = campo("clientes-busca").value.trim();
      if (termo) busca = /^[\d.\/\-\s]+$/.test(termo)
        ? busca.like("cnpj", `%${termo.replace(/\D/g, "")}%`)
        : busca.ilike("empresa", `%${termo.replace(/[\\%_]/g, "\\$&")}%`);
      if (campo("clientes-situacao").value) busca = busca.eq("situacao", campo("clientes-situacao").value);
      const resposta = await busca.range(paginaClientes * porPagina, (paginaClientes + 1) * porPagina - 1);
      if (versao !== versaoSessao || consulta !== consultaClientes) return;
      if (resposta.error) throw new Error("Não foi possível carregar os cadastros.");
      const total = resposta.count || 0;
      if (paginaClientes && paginaClientes * porPagina >= total) { paginaClientes = 0; return carregarClientes(); }
      for (const cadastro of resposta.data) {
        const linha = elemento("tr"), empresa = elemento("td", cadastro.empresa), acoes = elemento("td"), grupo = elemento("div", null, "admin-acoes-cliente");
        empresa.append(elemento("small", dataBrasil(cadastro.created_at)));
        const situacao = elemento("td");
        const classe = cadastro.situacao === "aprovado" ? "concluido" : cadastro.situacao === "bloqueado" ? "cancelado" : "novo";
        situacao.append(elemento("span", nomesSituacaoCliente[cadastro.situacao] || cadastro.situacao, `admin-situacao ${classe}`));
        for (const [destino, titulo, icone, cor] of [[null, "Ver cadastro", "eye", "secondary"], ["aprovado", "Aprovar cadastro", "check", "success"], ["bloqueado", "Bloquear cadastro", "ban", "danger"]]) {
          const botao = elemento("button", null, `btn btn-outline-${cor} botao-icone`);
          botao.type = "button"; botao.title = titulo; botao.setAttribute("aria-label", titulo);
          const simbolo = elemento("i", null, `fa fa-${icone}`); simbolo.setAttribute("aria-hidden", "true"); botao.append(simbolo);
          botao.disabled = Boolean(destino && cadastro.situacao === destino);
          botao.addEventListener("click", () => abrirCliente(cadastro.usuario_id, destino));
          grupo.append(botao);
        }
        acoes.append(grupo);
        linha.append(empresa, elemento("td", cadastro.cnpj ? formatarCnpj(cadastro.cnpj) : "Não informado"), elemento("td", formatarTelefone(cadastro.telefone)), situacao, acoes);
        campo("clientes-lista").append(linha);
      }
      mensagem("clientes-mensagem", total ? `${total} cadastro(s) encontrado(s).` : "Nenhum cadastro encontrado.");
      campo("clientes-pagina").textContent = total ? `Página ${paginaClientes + 1} de ${Math.ceil(total / porPagina)}` : "";
      campo("clientes-anterior").disabled = paginaClientes === 0;
      campo("clientes-proxima").disabled = (paginaClientes + 1) * porPagina >= total;
    } catch (erro) { if (versao === versaoSessao && consulta === consultaClientes) mensagem("clientes-mensagem", erro.message, true); }
  }

  function limparDetalhesCliente() {
    detalheClienteAtual++;
    clienteParaAlterar = null;
    campo("cliente-dados").replaceChildren();
    campo("titulo-cliente").textContent = "Cadastro:";
    mensagem("cliente-mensagem", "");
    campo("confirmar-cliente").hidden = campo("confirmar-cliente").disabled = true;
    campo("confirmar-cliente").textContent = "Confirmar";
    campo("cancelar-cliente").textContent = "Fechar";
    campo("cancelar-cliente").disabled = campo("fechar-cliente").disabled = false;
    campo("confirmacao-cliente").removeAttribute("aria-busy");
  }

  function fecharCliente() {
    campo("confirmacao-cliente").close();
    limparDetalhesCliente();
  }

  function detalheClienteAtivo(versao, detalhe) {
    return usuario && versao === versaoSessao && detalhe === detalheClienteAtual && campo("confirmacao-cliente").open;
  }

  async function abrirCliente(usuarioId, destino = null) {
    if (!usuario || !podeAcessar("clientes")) return;
    limparDetalhesCliente();
    const versao = versaoSessao, detalhe = detalheClienteAtual;
    campo("titulo-cliente").textContent = destino === "aprovado" ? "Aprovar cadastro:" : destino === "bloqueado" ? "Bloquear cadastro:" : "Ver cadastro:";
    campo("confirmar-cliente").hidden = !destino;
    campo("confirmar-cliente").textContent = destino === "aprovado" ? "Aprovar" : "Bloquear";
    campo("cancelar-cliente").textContent = destino ? "Cancelar" : "Fechar";
    campo("confirmacao-cliente").setAttribute("aria-busy", "true");
    mensagem("cliente-mensagem", "Carregando cadastro...");
    if (!campo("confirmacao-cliente").open) campo("confirmacao-cliente").showModal();
    campo("cancelar-cliente").focus();
    try {
      await confirmarAcesso("clientes");
      const resposta = await cliente.from("catalogo_clientes")
        .select("usuario_id,empresa,cnpj,telefone,email,cep,tipo_logradouro,logradouro,numero,complemento,bairro,cidade,uf,situacao,created_at,updated_at")
        .eq("usuario_id", usuarioId).single();
      if (!detalheClienteAtivo(versao, detalhe)) return;
      if (resposta.error || !resposta.data) throw new Error("Não foi possível carregar o cadastro. Atualize a lista e tente novamente.");
      const cadastro = resposta.data;
      for (const [nome, valor] of Object.entries({
        ...window.Dipsul.dadosCliente(cadastro),
        Situação: nomesSituacaoCliente[cadastro.situacao] || cadastro.situacao,
        "Data de cadastro": cadastro.created_at ? dataBrasil(cadastro.created_at) : "",
        "Última atualização": cadastro.updated_at ? dataBrasil(cadastro.updated_at) : ""
      })) {
        campo("cliente-dados").append(elemento("dt", nome + ":"), elemento("dd", valor || "Não informado"));
      }
      if (destino && !cadastro.updated_at) throw new Error("Não foi possível verificar a atualização do cadastro. Feche e abra novamente.");
      if (destino && cadastro.situacao !== destino) {
        clienteParaAlterar = { cadastro, destino };
        campo("confirmar-cliente").disabled = false;
      }
      mensagem("cliente-mensagem", destino && cadastro.situacao === destino ? "O cadastro já está nessa situação." : "");
    } catch (erro) {
      if (detalheClienteAtivo(versao, detalhe)) mensagem("cliente-mensagem", erro.message, true);
    } finally {
      if (detalheClienteAtivo(versao, detalhe)) campo("confirmacao-cliente").removeAttribute("aria-busy");
    }
  }

  campo("atualizar-clientes").addEventListener("click", carregarClientes);
  campo("clientes-filtros").addEventListener("submit", evento => { evento.preventDefault(); paginaClientes = 0; carregarClientes(); });
  campo("clientes-limpar").addEventListener("click", () => { campo("clientes-filtros").reset(); paginaClientes = 0; carregarClientes(); });
  campo("clientes-situacao").addEventListener("change", () => { paginaClientes = 0; carregarClientes(); });
  campo("clientes-anterior").addEventListener("click", () => { paginaClientes = Math.max(0, paginaClientes - 1); carregarClientes(); });
  campo("clientes-proxima").addEventListener("click", () => { paginaClientes++; carregarClientes(); });
  for (const id of ["fechar-cliente", "cancelar-cliente"]) campo(id).addEventListener("click", fecharCliente);
  campo("confirmacao-cliente").addEventListener("cancel", evento => {
    evento.preventDefault();
    if (!campo("cancelar-cliente").disabled) fecharCliente();
  });
  campo("confirmacao-cliente").addEventListener("close", () => {
    if (!campo("confirmacao-cliente").open) limparDetalhesCliente();
  });
  campo("confirmar-cliente").addEventListener("click", async () => {
    if (!usuario || !clienteParaAlterar || !campo("confirmacao-cliente").open || campo("confirmar-cliente").disabled) return;
    const { cadastro, destino } = clienteParaAlterar, versao = versaoSessao, detalhe = detalheClienteAtual;
    const controles = ["confirmar-cliente", "cancelar-cliente", "fechar-cliente"];
    controles.forEach(id => { campo(id).disabled = true; });
    campo("confirmacao-cliente").setAttribute("aria-busy", "true");
    mensagem("cliente-mensagem", "Salvando alteração...");
    try {
      const resposta = await cliente.rpc("catalogo_admin_atualizar_cliente", { p_usuario_id: cadastro.usuario_id, p_situacao: destino, p_updated_at: cadastro.updated_at });
      if (!detalheClienteAtivo(versao, detalhe)) return;
      if (resposta.error) throw new Error(resposta.error.message || "Não foi possível alterar o cadastro.");
      fecharCliente();
      await carregarClientes();
    } catch (erro) { if (detalheClienteAtivo(versao, detalhe)) mensagem("cliente-mensagem", erro.message, true); }
    finally {
      if (detalheClienteAtivo(versao, detalhe)) {
        controles.forEach(id => { campo(id).disabled = false; });
        campo("confirmacao-cliente").removeAttribute("aria-busy");
      }
    }
  });

  async function carregarAdministradores() {
    if (!usuario || !podeAcessar("administradores")) return;
    const versao = versaoSessao, consulta = ++consultaAdministradores;
    campo("administradores-lista").replaceChildren();
    campo("administradores-pagina").textContent = "";
    campo("administradores-anterior").disabled = campo("administradores-proxima").disabled = true;
    mensagem("administradores-mensagem", "Carregando administradores...");
    try {
      await confirmarAcesso("administradores");
      const resposta = await cliente.rpc("catalogo_admin_listar_administradores", { p_pagina: paginaAdministradores });
      if (versao !== versaoSessao || consulta !== consultaAdministradores) return;
      if (resposta.error) throw new Error("Não foi possível carregar os administradores.");
      const { administradores, total } = resposta.data;
      if (paginaAdministradores && paginaAdministradores * porPagina >= total) { paginaAdministradores = 0; return carregarAdministradores(); }
      for (const admin of administradores) {
        if (admin.absoluto || admin.usuario_id === usuario.id) continue;
        const linha = elemento("tr"), acoes = elemento("td");
        if (!admin.absoluto) {
          const botao = elemento("button", null, "btn btn-outline-secondary botao-icone");
          botao.type = "button"; botao.title = "Editar permissões"; botao.setAttribute("aria-label", `Editar permissões de ${admin.email}`);
          const icone = elemento("i", null, "fa fa-pencil"); icone.setAttribute("aria-hidden", "true"); botao.append(icone);
          botao.addEventListener("click", () => {
            if (!podeAcessar("administradores")) return;
            administradorAberto = admin;
            campo("permissoes-email").textContent = admin.email;
            campo("permissoes-ativo").checked = admin.ativo;
            campo("formulario-permissoes").querySelectorAll('[name="menus"]').forEach(opcao => { opcao.checked = admin.menus.includes(opcao.value); });
            campo("dialogo-permissoes").showModal();
          });
          acoes.append(botao);
        }
        linha.append(elemento("td", admin.email || "Não informado"), elemento("td", admin.absoluto ? "Absoluto" : admin.ativo ? "Ativo" : "Inativo"),
          elemento("td", admin.absoluto ? "Todos" : admin.menus.map(menu => nomesMenus[menu]).filter(Boolean).join(", ") || "Nenhum"), acoes);
        campo("administradores-lista").append(linha);
      }
      mensagem("administradores-mensagem", `${total} administrador(es) encontrado(s).`);
      campo("administradores-pagina").textContent = total ? `Página ${paginaAdministradores + 1} de ${Math.ceil(total / porPagina)}` : "";
      campo("administradores-anterior").disabled = paginaAdministradores === 0;
      campo("administradores-proxima").disabled = (paginaAdministradores + 1) * porPagina >= total;
    } catch (erro) {
      if (versao === versaoSessao && consulta === consultaAdministradores) mensagem("administradores-mensagem", erro.message, true);
    }
  }

  campo("atualizar-administradores").addEventListener("click", carregarAdministradores);
  campo("administradores-anterior").addEventListener("click", () => { paginaAdministradores = Math.max(0, paginaAdministradores - 1); carregarAdministradores(); });
  campo("administradores-proxima").addEventListener("click", () => { paginaAdministradores++; carregarAdministradores(); });
  for (const id of ["cancelar-permissoes", "fechar-permissoes"]) campo(id).addEventListener("click", () => campo("dialogo-permissoes").close());
  campo("dialogo-permissoes").addEventListener("cancel", evento => { if (campo("salvar-permissoes").disabled) evento.preventDefault(); });
  campo("dialogo-permissoes").addEventListener("close", () => {
    administradorAberto = null;
    campo("permissoes-email").textContent = "";
    campo("formulario-permissoes").reset();
  });
  campo("formulario-permissoes").addEventListener("submit", async evento => {
    evento.preventDefault();
    if (!usuario || !podeAcessar("administradores") || !administradorAberto || campo("salvar-permissoes").disabled) return;
    const versao = versaoSessao, admin = administradorAberto;
    const dados = { p_usuario_id: admin.usuario_id, p_ativo: campo("permissoes-ativo").checked,
      p_menus: new FormData(campo("formulario-permissoes")).getAll("menus"), p_updated_at: admin.updated_at };
    const controles = campo("dialogo-permissoes").querySelectorAll("input, button");
    controles.forEach(controle => { controle.disabled = true; });
    campo("dialogo-permissoes").setAttribute("aria-busy", "true");
    try {
      await confirmarAcesso("administradores");
      const resposta = await cliente.rpc("catalogo_admin_salvar_permissoes", dados);
      if (versao !== versaoSessao) return;
      if (resposta.error) throw new Error(resposta.error.message || "Não foi possível salvar as permissões.");
      campo("dialogo-permissoes").close();
      window.Dipsul.notificar("Permissões atualizadas.");
      await carregarAdministradores();
    } catch (erro) { if (versao === versaoSessao) window.Dipsul.notificar(erro.message, { tipo: "erro" }); }
    finally {
      controles.forEach(controle => { controle.disabled = false; });
      campo("dialogo-permissoes").removeAttribute("aria-busy");
    }
  });

  document.querySelectorAll("[data-visualizar-senha]").forEach((botao) => {
    botao.addEventListener("click", () => mostrarSenha(campo(botao.getAttribute("aria-controls")).type === "password", botao));
  });
  campo("formulario-login").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!cliente || campo("entrar").disabled) return;
    campo("entrar").disabled = true;
    mensagem("mensagem-acesso", "Entrando...");
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo("admin-email").value.trim())) throw new Error("Informe um e-mail válido para acessar a administração.");
      if (!campo("admin-senha").value) throw new Error("Informe sua senha.");
      const { data, error } = await cliente.auth.signInWithPassword({ email: campo("admin-email").value.trim(), password: campo("admin-senha").value });
      if (error) throw new Error("Não foi possível entrar. Confira o e-mail, a senha e sua conexão.");
      await iniciarSessao(data.session);
    } catch (erro) { mensagem("mensagem-acesso", erro.message, true); }
    finally { campo("admin-senha").value = ""; mostrarSenha(false); campo("entrar").disabled = false; }
  });
  campo("sair").addEventListener("click", () => sair());
  campo("trocar-senha").addEventListener("click", () => {
    if (!usuario || campo("trocar-senha").disabled) return;
    limparFormularioSenha();
    mensagem("senha-mensagem", "");
    campo("dialogo-senha").showModal();
  });
  for (const id of ["cancelar-senha", "fechar-senha"]) campo(id).addEventListener("click", () => campo("dialogo-senha").close());
  campo("dialogo-senha").addEventListener("cancel", (evento) => { if (campo("salvar-senha").disabled) evento.preventDefault(); });
  campo("dialogo-senha").addEventListener("close", limparFormularioSenha);
  campo("senha-nova").addEventListener("input", validarTamanhoSenha);
  campo("formulario-senha").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!usuario || campo("salvar-senha").disabled) return;
    const senhaAtual = campo("senha-atual").value;
    const novaSenha = campo("senha-nova").value;
    mensagem("senha-mensagem", "");
    if (!senhaAtual) {
      mensagem("senha-mensagem", "Informe a senha atual.", true);
      campo("senha-atual").focus();
      return;
    }
    if (!validarTamanhoSenha()) {
      mensagem("senha-mensagem", "Confira o tamanho permitido para a nova senha.", true);
      campo("senha-nova").focus();
      return;
    }
    if (novaSenha !== campo("senha-confirmacao").value) {
      mensagem("senha-mensagem", "A confirmação deve ser igual à nova senha.", true);
      campo("senha-confirmacao").focus();
      return;
    }
    if (novaSenha === senhaAtual) {
      mensagem("senha-mensagem", "A nova senha deve ser diferente da atual.", true);
      campo("senha-nova").focus();
      return;
    }
    const versao = versaoSessao;
    const usuarioAtual = usuario;
    let autenticacaoTemporaria;
    bloquearFormularioSenha(true);
    mensagem("senha-mensagem", "Alterando senha...");
    try {
      const configuracao = window.DipsulConfiguracao;
      // A verificação fica em memória e não substitui a sessão administrativa.
      autenticacaoTemporaria = window.supabase.createClient(configuracao.supabaseUrl, configuracao.supabaseChavePublica, { auth: { storageKey: "dipsul_admin_troca_senha", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth;
      const resposta = await autenticacaoTemporaria.signInWithPassword({ email: usuarioAtual.email, password: senhaAtual });
      if (versao !== versaoSessao) return;
      if (resposta.error) throw new Error(resposta.error.code === "invalid_credentials" ? "Senha atual incorreta." : "Não foi possível validar a senha atual. Confira a conexão e tente novamente.");
      if (resposta.data.user?.id !== usuarioAtual.id) throw new Error("Sessão inválida. Entre novamente.");
      const { error } = await autenticacaoTemporaria.updateUser({ password: novaSenha, current_password: senhaAtual });
      if (versao !== versaoSessao) return;
      if (error) throw new Error(error.code === "weak_password" ? "A nova senha não atende aos requisitos de segurança do Supabase." : "Não foi possível alterar a senha. Confira a conexão e os requisitos da sua conta.");
      const aviso = "Senha alterada. Entre novamente com a nova senha.";
      await sair(aviso).catch(() => {});
    } catch (erro) {
      if (versao === versaoSessao) mensagem("senha-mensagem", erro.message, true);
    } finally {
      limparFormularioSenha();
      bloquearFormularioSenha(false);
      await autenticacaoTemporaria?.signOut({ scope: "local" }).catch(() => {});
    }
  });
  campo("filtros").addEventListener("submit", (evento) => { evento.preventDefault(); pagina = 0; carregarPedidos(); });
  campo("limpar-filtros").addEventListener("click", () => { campo("filtros").reset(); pagina = 0; carregarPedidos(); });
  campo("atualizar").addEventListener("click", carregarPedidos);
  campo("atualizar-catalogo").addEventListener("click", () => {
    if (!usuario) return;
    leituraCatalogo?.abort();
    leituraCatalogo = null;
    produtos = null;
    limparPDF();
    campo("categoria-pdf").disabled = true;
    carregarCatalogo();
  });
  campo("anterior").addEventListener("click", () => { pagina = Math.max(0, pagina - 1); carregarPedidos(); });
  campo("proxima").addEventListener("click", () => { pagina++; carregarPedidos(); });
  campo("fechar-detalhes").addEventListener("click", () => campo("detalhes").close());
  campo("detalhes").addEventListener("close", () => {
    detalheAtual++;
    pedidoAberto = null;
    campo("confirmacao-exclusao").close();
    for (const id of ["detalhes-dados", "detalhes-itens", "pedido-data"]) campo(id).replaceChildren();
    campo("formulario-situacao").reset();
    mensagem("detalhes-mensagem", "");
    campo("itens-mensagem").textContent = "";
    campo("titulo-detalhes").textContent = "Pedido:";
  });
  campo("formulario-situacao").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!usuario || !pedidoAberto || campo("salvar-situacao").disabled) return;
    const pedido = pedidoAberto;
    if (campo("nova-situacao").value === pedido.situacao && !campo("observacao").value.trim()) {
      window.Dipsul.notificar("Nenhuma alteração para salvar.");
      return;
    }
    const versao = versaoSessao;
    const detalhe = detalheAtual;
    campo("salvar-situacao").disabled = campo("excluir-pedido").disabled = true;
    try {
      const resposta = await cliente.rpc("catalogo_admin_atualizar_pedido", { p_pedido_id: pedido.id, p_situacao: campo("nova-situacao").value, p_observacao: campo("observacao").value.trim(), p_updated_at: pedido.updated_at });
      if (versao !== versaoSessao) return;
      if (resposta.error) throw new Error(resposta.error.code === "40001" ? "Pedido alterado por outro usuário. Feche e abra os detalhes novamente." : "Não foi possível salvar. Verifique sua autorização e tente novamente.");
      window.Dipsul.notificar("Alteração registrada.");
      if (detalhe === detalheAtual && pedidoAberto?.id === pedido.id && campo("detalhes").open) await abrirPedido(pedido.id);
      await carregarPedidos();
    } catch (erro) { if (versao === versaoSessao && detalhe === detalheAtual) mensagem("detalhes-mensagem", erro.message, true); }
    finally { if (versao === versaoSessao) campo("salvar-situacao").disabled = campo("excluir-pedido").disabled = false; }
  });
  campo("excluir-pedido").addEventListener("click", () => {
    if (!usuario || !pedidoAberto || campo("excluir-pedido").disabled) return;
    pedidoParaExcluir = pedidoAberto;
    campo("exclusao-dados").replaceChildren();
    for (const [nome, valor] of Object.entries({ Pedido: `#${pedidoAberto.id}`, Empresa: pedidoAberto.empresa, CNPJ: formatarCnpj(pedidoAberto.cnpj) })) {
      campo("exclusao-dados").append(elemento("dt", `${nome}:`), elemento("dd", valor));
    }
    mensagem("exclusao-mensagem", "");
    campo("confirmacao-exclusao").showModal();
    campo("cancelar-exclusao").focus();
  });
  for (const id of ["cancelar-exclusao", "fechar-exclusao"]) campo(id).addEventListener("click", () => campo("confirmacao-exclusao").close());
  campo("confirmacao-exclusao").addEventListener("cancel", (evento) => {
    if (campo("confirmar-exclusao").disabled) evento.preventDefault();
  });
  campo("confirmacao-exclusao").addEventListener("close", () => {
    pedidoParaExcluir = null;
    campo("exclusao-dados").replaceChildren();
    mensagem("exclusao-mensagem", "");
  });
  campo("confirmar-exclusao").addEventListener("click", async () => {
    if (!usuario || !pedidoParaExcluir || campo("confirmar-exclusao").disabled) return;
    const pedido = pedidoParaExcluir;
    const versao = versaoSessao;
    const detalhe = detalheAtual;
    campo("salvar-situacao").disabled = campo("excluir-pedido").disabled = true;
    for (const id of ["confirmar-exclusao", "cancelar-exclusao", "fechar-exclusao"]) campo(id).disabled = true;
    campo("confirmacao-exclusao").setAttribute("aria-busy", "true");
    mensagem("exclusao-mensagem", "Excluindo pedido...");
    try {
      const resposta = await cliente.rpc("catalogo_admin_excluir_pedido_definitivo", { p_pedido_id: pedido.id, p_updated_at: pedido.updated_at });
      if (versao !== versaoSessao) return;
      if (resposta.error) {
        if (resposta.error.code === "40001" || resposta.error.code === "P0002") throw new Error("Pedido alterado ou excluído por outro usuário. Atualize a lista e abra os detalhes novamente.");
        throw new Error("Não foi possível excluir. Confira sua autorização e se o SQL administrativo atualizado foi aplicado.");
      }
      campo("confirmacao-exclusao").close();
      window.Dipsul.notificar("Pedido excluído definitivamente.");
      if (detalhe === detalheAtual && pedidoAberto?.id === pedido.id) campo("detalhes").close();
      await carregarPedidos();
    } catch (erro) { if (versao === versaoSessao && detalhe === detalheAtual) mensagem("exclusao-mensagem", erro.message, true); }
    finally {
      if (versao === versaoSessao) {
        campo("salvar-situacao").disabled = campo("excluir-pedido").disabled = false;
        for (const id of ["confirmar-exclusao", "cancelar-exclusao", "fechar-exclusao"]) campo(id).disabled = false;
        campo("confirmacao-exclusao").removeAttribute("aria-busy");
      }
    }
  });
  function selecionarAba(aba) {
    abaAtual = podeAcessar(aba) ? aba : abas.find(podeAcessar) || null;
    mostrarAbas();
    if (!usuario || !abaAtual) return;
    aba = abaAtual;
    if (aba === "pedidos") carregarPedidos();
    if (aba === "catalogo") carregarCatalogo();
    if (aba === "clientes") { campo("clientes-filtros").reset(); paginaClientes = 0; carregarClientes(); }
    if (aba === "administradores") carregarAdministradores();
  }
  for (const aba of abas) campo(`aba-${aba}`).addEventListener("click", () => selecionarAba(aba));
  campo("formulario-pdf").addEventListener("change", limparPDF);
  campo("cancelar-pdf").addEventListener("click", limparPDF);
  campo("formulario-pdf").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!usuario) return;
    if (!produtos) { await carregarCatalogo(); if (!produtos) return; }
    limparPDF();
    const geracao = new AbortController();
    geracaoPDF = geracao;
    campo("preparar-pdf").disabled = true;
    campo("cancelar-pdf").hidden = false;
    campo("previa-pdf").hidden = false;
    try {
      await confirmarAcesso("catalogo");
      geracao.signal.throwIfAborted();
      const resultado = await window.DipsulCatalogoPDF.preparar({ iframe: campo("previa-pdf"), raiz, produtos, categoria: campo("categoria-pdf").value, formato: new FormData(campo("formulario-pdf")).get("formato"), sinal: geracao.signal, progresso: (texto) => { if (!geracao.signal.aborted) mensagem("pdf-mensagem", texto); } });
      geracao.signal.throwIfAborted();
      campo("imprimir-pdf").disabled = false;
      mensagem("pdf-mensagem", `${resultado.itens} produtos · ${resultado.paginas} páginas${resultado.ausentes ? ` · ${resultado.ausentes} imagem(ns) indisponível(is)` : ""}`);
    } catch (erro) {
      if (!geracao.signal.aborted) { geracao.abort(); mensagem("pdf-mensagem", erro.message, true); }
    } finally {
      if (geracaoPDF === geracao) { campo("preparar-pdf").disabled = false; campo("cancelar-pdf").hidden = true; }
    }
  });
  campo("imprimir-pdf").addEventListener("click", async () => {
    if (!usuario || campo("imprimir-pdf").disabled) return;
    try {
      await confirmarAcesso("catalogo");
      if (campo("imprimir-pdf").disabled) return;
      window.DipsulCatalogoPDF.atualizarDataExportacao(campo("previa-pdf").contentDocument);
      campo("previa-pdf").contentWindow.focus();
      campo("previa-pdf").contentWindow.print();
    } catch (erro) { mensagem("pdf-mensagem", erro.message, true); }
  });

  for (const evento of ["pointerdown", "keydown"]) document.addEventListener(evento, () => { ultimaAtividade = Date.now(); }, { passive: true });
  setInterval(() => { if (usuario && Date.now() - ultimaAtividade > 30 * 60 * 1000) sair("Sessão encerrada por inatividade."); }, 30000);

  window.addEventListener("pageshow", evento => { if (evento.persisted) limparLogin(); });

  async function iniciar() {
    limparLogin();
    try {
      const configuracao = window.DipsulConfiguracao;
      cliente = window.supabase.createClient(configuracao.supabaseUrl, configuracao.supabaseChavePublica, { auth: { storage: window.sessionStorage, storageKey: "dipsul_admin_sessao", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      cliente.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") limparSessao("Sessão encerrada."); });
      const { data, error } = await cliente.auth.getSession();
      if (error) throw error;
      await iniciarSessao(data.session);
      campo("entrar").disabled = false;
    } catch (erro) {
      mensagem("mensagem-acesso", erro.message || "Não foi possível iniciar o acesso administrativo.", true);
      campo("entrar").disabled = !cliente;
    }
  }
  iniciar();
})();
