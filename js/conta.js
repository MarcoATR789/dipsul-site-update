(function () {
  "use strict";

  const configuracao = window.DipsulConfiguracao;
  const cliente = window.supabase.createClient(configuracao.supabaseUrl, configuracao.supabaseChavePublica, {
    auth: { storage: window.sessionStorage, storageKey: "dipsul_cliente_sessao", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  window.DipsulConta = cliente;
  if (!document.getElementById("conta")) return;

  const campo = id => document.getElementById(id);
  const urlCidades = new URL("../data/localidades/municipios.json", document.currentScript.src);
  const { obterDigitos, formatarCnpj, formatarTelefone, formatarCep, cnpjValido } = window.Dipsul;
  const nomes = { novo: "Novo", em_atendimento: "Em atendimento", concluido: "Concluído", cancelado: "Cancelado" };
  const porPagina = 10;
  let usuario = null, versao = 0, consulta = 0, detalhe = 0, pagina = 0, pedidoAberto = null;
  let autenticando = false, tipoLogin = "telefone", leituraCidades = null;
  let perfil = null, perfilEditado = null, salvandoPerfil = false;
  const camposPerfil = ["cnpj", "email", "empresa", "telefone", "cep", "logradouro", "numero", "complemento", "bairro", "uf", "cidade"];

  // Reaproveita os campos, limites e opções do formulário de cadastro.
  for (const nome of camposPerfil) {
    const original = campo(`conta-${nome}`), controle = original.cloneNode(true);
    const rotulo = document.querySelector(`label[for="${original.id}"]`).cloneNode(true);
    controle.id = `perfil-${nome}`; rotulo.htmlFor = controle.id;
    const grupo = elemento("div", null, `form-group ${nome === "empresa" ? "col-12" : "col-sm-6"}`);
    grupo.append(rotulo, controle); campo("conta-perfil-campos").append(grupo);
  }
  campo("perfil-cnpj").addEventListener("input", evento => { evento.target.value = formatarCnpj(evento.target.value); });
  campo("perfil-cep").addEventListener("input", evento => { evento.target.value = formatarCep(evento.target.value); });
  const cidadesCadastro = configurarCidades("conta"), cidadesPerfil = configurarCidades("perfil");

  function configurarCidades(prefixo) {
    const uf = campo(`${prefixo}-uf`), cidade = campo(`${prefixo}-cidade`);
    const grupo = elemento("div", null, "input-group"), acao = elemento("div", null, "input-group-append");
    const atualizar = elemento("button", null, "btn btn-outline-secondary botao-icone");
    atualizar.type = "button"; atualizar.title = "Atualizar cidades"; atualizar.setAttribute("aria-label", atualizar.title);
    const icone = elemento("i", null, "fa fa-refresh"); icone.setAttribute("aria-hidden", "true"); atualizar.append(icone);
    cidade.before(grupo); grupo.append(cidade, acao); acao.append(atualizar);
    let consulta = 0, pronta = false;
    async function carregar(selecionada = "") {
      const versao = ++consulta, estado = uf.value;
      pronta = false; cidade.disabled = true;
      cidade.replaceChildren(new Option(estado ? "Carregando cidades..." : "Selecione a UF", ""));
      atualizar.disabled = true;
      if (!estado) return;
      try {
        if (!leituraCidades) leituraCidades = fetch(urlCidades).then(async resposta => {
          if (!resposta.ok) throw new Error("Cidades indisponíveis.");
          return resposta.json();
        }).catch(erro => { leituraCidades = null; throw erro; });
        const dados = await leituraCidades;
        if (versao !== consulta || estado !== uf.value) return;
        if (!Array.isArray(dados[estado]) || !dados[estado].length) throw new Error("Cidades indisponíveis.");
        cidade.replaceChildren(new Option("Selecione a cidade", ""), ...dados[estado].map(nome => new Option(nome, nome)));
        cidade.value = dados[estado].find(nome => nome.localeCompare(selecionada, "pt-BR", { sensitivity: "base" }) === 0) || "";
        pronta = true;
      } catch {
        if (versao !== consulta || estado !== uf.value) return;
        cidade.replaceChildren(new Option("Cidades indisponíveis", ""));
        window.Dipsul.notificar("Não foi possível carregar as cidades. Tente atualizar a lista.", { tipo: "erro" });
      } finally {
        if (versao === consulta) sincronizar();
      }
    }
    function sincronizar() {
      const ocupada = prefixo === "perfil" ? salvandoPerfil : autenticando;
      cidade.disabled = !pronta || ocupada; atualizar.disabled = !uf.value || ocupada;
    }
    uf.addEventListener("change", () => carregar());
    atualizar.addEventListener("click", () => carregar(cidade.value));
    sincronizar();
    return { carregar, sincronizar };
  }

  function mensagem(id, texto, erro = false) {
    campo(id).textContent = erro ? "" : texto;
    if (erro) window.Dipsul.notificar(texto, { tipo: "erro" });
  }

  function elemento(tag, texto, classe) {
    const novo = document.createElement(tag);
    if (texto != null) novo.textContent = texto;
    if (classe) novo.className = classe;
    return novo;
  }

  function dataBrasil(data) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(data));
  }

  function limparSenhas() {
    document.querySelectorAll("[data-conta-senha]").forEach(botao => {
      campo(botao.getAttribute("aria-controls")).value = "";
      window.Dipsul.mostrarSenha(botao, false);
    });
  }

  const dialogoRecuperacao = campo("conta-recuperar-dialogo");
  campo("conta-esqueci-senha").addEventListener("click", () => {
    const identificacao = campo("conta-identificacao").value;
    campo("conta-recuperar-formulario").reset();
    campo("conta-recuperar-cnpj").value = tipoLogin === "cnpj" && cnpjValido(identificacao) ? formatarCnpj(identificacao) : "";
    dialogoRecuperacao.showModal();
    campo("conta-recuperar-cnpj").focus();
  });
  dialogoRecuperacao.querySelectorAll("[data-fechar-recuperacao]").forEach(botao => botao.addEventListener("click", () => dialogoRecuperacao.close()));
  dialogoRecuperacao.addEventListener("close", () => {
    campo("conta-recuperar-formulario").reset();
    campo("conta-recuperar-cnpj").removeAttribute("aria-invalid");
  });
  campo("conta-recuperar-cnpj").addEventListener("input", evento => {
    evento.target.value = formatarCnpj(evento.target.value);
    evento.target.removeAttribute("aria-invalid");
  });
  campo("conta-recuperar-formulario").addEventListener("submit", evento => {
    evento.preventDefault();
    const cnpj = campo("conta-recuperar-cnpj");
    if (!cnpjValido(cnpj.value)) {
      cnpj.setAttribute("aria-invalid", "true"); cnpj.focus();
      window.Dipsul.notificar("Informe um CNPJ válido para solicitar a redefinição de senha.", { tipo: "erro" });
      return;
    }
    const guia = window.open("about:blank", "_blank");
    if (!guia) {
      window.Dipsul.notificar("Permita abrir uma nova guia para solicitar a redefinição pelo WhatsApp.", { tipo: "erro" });
      return;
    }
    guia.opener = null;
    const texto = `Olá! Solicito a redefinição da senha da minha conta no site da Dipsul.\nCNPJ para identificação: ${formatarCnpj(cnpj.value)}.`;
    guia.location.replace(`https://wa.me/5555991434780?text=${encodeURIComponent(texto)}`);
    dialogoRecuperacao.close();
  });

  function limparSessao() {
    versao++; consulta++; detalhe++;
    usuario = null;
    perfil = perfilEditado = null;
    pedidoAberto = null;
    campo("conta-detalhes").close();
    campo("conta-perfil-dialogo").close();
    dialogoRecuperacao.close();
    campo("conta-perfil-dados").replaceChildren();
    mensagem("conta-perfil-mensagem", "");
    campo("conta-acesso").hidden = false;
    campo("conta-painel").hidden = campo("conta-sair").hidden = campo("conta-pedidos").hidden = true;
    for (const id of ["conta-lista", "conta-dados", "conta-itens", "conta-data", "conta-nome", "conta-pagina", "conta-situacao"]) campo(id).replaceChildren();
    campo("conta-cadastro").reset();
    cidadesCadastro.carregar();
    campo("conta-identificacao-resumo").replaceChildren();
    selecionarAcesso(false);
    limparSenhas();
  }

  async function carregarPedidos() {
    if (!usuario) return;
    const leitura = ++consulta, sessao = versao;
    campo("conta-lista").replaceChildren();
    campo("conta-anterior").disabled = campo("conta-proxima").disabled = true;
    campo("conta-pedidos").hidden = true;
    perfil = null;
    campo("conta-perfil-dados").replaceChildren();
    campo("conta-editar-perfil").disabled = true;
    mensagem("conta-perfil-mensagem", "Carregando cadastro...");
    mensagem("conta-situacao", "Carregando pedidos...");
    try {
      const cadastro = await cliente.from("catalogo_clientes").select("empresa,cnpj,telefone,email,cep,tipo_logradouro,logradouro,numero,complemento,bairro,cidade,uf,situacao,created_at,updated_at").eq("usuario_id", usuario.id).maybeSingle();
      if (sessao !== versao || leitura !== consulta) return;
      if (cadastro.error) throw new Error("Não foi possível carregar o cadastro. Tente novamente.");
      if (!cadastro.data) throw new Error("Perfil não encontrado. Entre em contato com o televendas para regularizar o cadastro.");
      perfil = cadastro.data;
      renderizarPerfil();
      campo("conta-nome").textContent = perfil.empresa;
      if (perfil.situacao !== "aprovado") {
        mensagem("conta-situacao", perfil.situacao === "pendente" ? "Cadastro aguardando aprovação." : "Cadastro bloqueado. Entre em contato com o televendas.");
        return true;
      }
      const resposta = await cliente.from("catalogo_pedidos_log").select("id,itens,situacao,created_at", { count: "exact" })
        .eq("usuario_id", usuario.id).order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(pagina * porPagina, (pagina + 1) * porPagina - 1);
      if (sessao !== versao || leitura !== consulta) return;
      if (resposta.error) throw new Error("Não foi possível carregar os pedidos.");
      const total = resposta.count || 0;
      if (pagina && pagina * porPagina >= total) { pagina = 0; return carregarPedidos(); }
      for (const pedido of resposta.data) {
        const linha = elemento("tr"), data = elemento("td", `#${pedido.id}`), situacao = elemento("td"), acao = elemento("td");
        data.append(elemento("small", dataBrasil(pedido.created_at)));
        situacao.append(elemento("span", nomes[pedido.situacao] || pedido.situacao, `admin-situacao ${pedido.situacao}`));
        const botao = elemento("button", null, "btn btn-outline-secondary botao-icone");
        botao.type = "button"; botao.title = `Ver pedido ${pedido.id}`; botao.setAttribute("aria-label", botao.title);
        const icone = elemento("i", null, "fa fa-eye"); icone.setAttribute("aria-hidden", "true"); botao.append(icone);
        botao.addEventListener("click", () => abrirPedido(pedido.id));
        const itens = elemento("td"), lista = elemento("ul", null, "conta-resumo-itens");
        for (const item of Array.isArray(pedido.itens) ? pedido.itens : []) {
          if (!item || typeof item !== "object") continue;
          const produto = elemento("li");
          produto.append(elemento("strong", `${item.quantidade ?? 0} × `), elemento("span", item.descricao || item.codigo || "Produto não informado"));
          lista.append(produto);
        }
        itens.append(lista.childElementCount ? lista : elemento("span", "Itens não informados"));
        acao.append(botao); linha.append(data, itens, situacao, acao);
        campo("conta-lista").append(linha);
      }
      campo("conta-pedidos").hidden = false;
      campo("conta-anterior").disabled = pagina === 0;
      campo("conta-proxima").disabled = (pagina + 1) * porPagina >= total;
      campo("conta-pagina").textContent = total ? `Página ${pagina + 1} de ${Math.ceil(total / porPagina)}` : "";
      mensagem("conta-situacao", total ? `${total} pedido(s) encontrado(s).` : "Nenhum pedido feito com esta conta.");
      return true;
    } catch (erro) {
      if (sessao === versao && leitura === consulta) {
        mensagem("conta-situacao", erro.message, true);
        if (!perfil) mensagem("conta-perfil-mensagem", "");
      }
      return false;
    }
  }

  function renderizarPerfil() {
    const nomesSituacao = { pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Bloqueado" };
    const dados = { ...window.Dipsul.dadosCliente(perfil), Situação: nomesSituacao[perfil.situacao],
      Cadastro: dataBrasil(perfil.created_at), Atualização: dataBrasil(perfil.updated_at) };
    campo("conta-perfil-dados").replaceChildren();
    for (const [nome, valor] of Object.entries(dados)) campo("conta-perfil-dados").append(elemento("dt", nome + ":"), elemento("dd", valor || "Não informado"));
    campo("conta-editar-perfil").disabled = false;
    mensagem("conta-perfil-mensagem", "");
  }

  function selecionarSecao(secao) {
    for (const nome of ["pedidos", "perfil"]) {
      const ativa = nome === secao;
      campo(`conta-secao-${nome}`).hidden = !ativa;
      campo(`conta-aba-${nome}`).classList.toggle("ativa", ativa);
      campo(`conta-aba-${nome}`).setAttribute("aria-pressed", String(ativa));
    }
  }

  for (const secao of ["pedidos", "perfil"]) campo(`conta-aba-${secao}`).addEventListener("click", () => {
    selecionarSecao(secao); history.replaceState(null, "", `#${secao}`);
  });

  campo("conta-editar-perfil").addEventListener("click", () => {
    if (!perfil || salvandoPerfil) return;
    perfilEditado = { ...perfil };
    for (const nome of camposPerfil) campo(`perfil-${nome}`).value = perfil[nome.replaceAll("-", "_")] || "";
    campo("perfil-cnpj").value = formatarCnpj(perfil.cnpj);
    campo("perfil-cep").value = formatarCep(perfil.cep);
    campo("perfil-telefone").value = formatarTelefone(perfil.telefone);
    campo("perfil-logradouro").value = window.Dipsul.logradouroCliente(perfil);
    cidadesPerfil.carregar(perfil.cidade);
    mensagem("conta-perfil-erro", ""); campo("conta-perfil-dialogo").showModal();
  });
  const dialogoPerfil = campo("conta-perfil-dialogo");
  dialogoPerfil.querySelectorAll("[data-fechar-perfil]").forEach(botao => botao.addEventListener("click", () => { if (!salvandoPerfil) dialogoPerfil.close(); }));
  dialogoPerfil.addEventListener("cancel", evento => { if (salvandoPerfil) evento.preventDefault(); });
  dialogoPerfil.addEventListener("close", () => {
    campo("conta-perfil-formulario").reset(); perfilEditado = null;
    cidadesPerfil.carregar(); mensagem("conta-perfil-erro", "");
  });
  campo("conta-perfil-formulario").addEventListener("submit", async evento => {
    evento.preventDefault();
    if (!usuario || !perfilEditado || salvandoPerfil) return;
    const sessao = versao, anterior = perfilEditado;
    let dadosGravados = false;
    salvandoPerfil = true;
    dialogoPerfil.querySelectorAll("input, select, button").forEach(controle => { controle.disabled = true; });
    mensagem("conta-perfil-erro", "Salvando...");
    try {
      const dados = {};
      for (const chave of camposPerfil) if (chave !== "telefone") dados[chave] = campo(`perfil-${chave}`).value.trim();
      const telefone = obterDigitos(campo("perfil-telefone").value);
      dados.cnpj = obterDigitos(dados.cnpj); dados.cep = obterDigitos(dados.cep); dados.email = dados.email.toLowerCase();
      if (!cnpjValido(dados.cnpj)) throw new Error("Informe um CNPJ válido.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) throw new Error("Informe um e-mail válido.");
      if (!/^[1-9]{2}\d{8,9}$/.test(telefone)) throw new Error("Informe um telefone com DDD.");
      if (dados.cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
      for (const chave of camposPerfil) {
        const controle = campo(`perfil-${chave}`), valor = controle.value.trim();
        if ((controle.required && !valor) || (controle.maxLength > 0 && valor.length > controle.maxLength)) throw new Error("Confira os campos obrigatórios e seus limites.");
      }
      if ([dados.empresa, dados.logradouro, dados.bairro, dados.cidade].some(valor => valor.length < 2)) throw new Error("Confira a razão social e o endereço completo.");
      const resposta = await cliente.rpc("catalogo_cliente_atualizar_perfil", { p_dados: dados, p_updated_at: anterior.updated_at });
      if (sessao !== versao) return;
      if (resposta.error) throw new Error(resposta.error.code === "PGRST202" ? "Edição de perfil indisponível. Entre em contato com o televendas." : resposta.error.message || "Não foi possível salvar o perfil.");
      dadosGravados = true;
      // O telefone de login é alterado pelo Auth, não por escrita direta no perfil.
      if (telefone !== anterior.telefone) {
        const alteracao = await cliente.auth.updateUser({ phone: "+55" + telefone });
        if (sessao !== versao) return;
        if (alteracao.error) throw new Error("Não foi possível alterar o telefone. Confira o número e tente novamente.");
        if (obterDigitos(alteracao.data.user.phone) !== "55" + telefone) throw new Error("O novo telefone aguarda confirmação. Entre em contato com o televendas.");
      }
      dialogoPerfil.close();
      const carregou = await carregarPedidos();
      if (sessao === versao && carregou) window.Dipsul.notificar(perfil?.situacao === "pendente" ? "Dados salvos. Cadastro aguardando aprovação." : "Dados salvos.");
    } catch (erro) {
      if (sessao !== versao) return;
      if (dadosGravados) {
        dialogoPerfil.close(); await carregarPedidos();
        if (sessao === versao) window.Dipsul.notificar(`Os demais dados foram salvos. ${erro.message}`, { tipo: "erro", duracao: 7000 });
      } else mensagem("conta-perfil-erro", erro.message, true);
    } finally {
      salvandoPerfil = false;
      dialogoPerfil.querySelectorAll("input, select, button").forEach(controle => { controle.disabled = false; });
      cidadesPerfil.sincronizar();
    }
  });

  async function lerPedido(id) {
    const resposta = await cliente.from("catalogo_pedidos_log")
      .select("id,cnpj,empresa,telefone,itens,situacao,created_at,televendas:catalogo_televendas(nome,telefone_whatsapp)")
      .eq("usuario_id", usuario.id).eq("id", id).single();
    if (resposta.error || !resposta.data) throw new Error("Pedido indisponível ou acesso não autorizado.");
    return resposta.data;
  }

  async function abrirPedido(id) {
    if (!usuario) return;
    const sessao = versao, leitura = ++detalhe;
    pedidoAberto = null;
    campo("conta-detalhes-conteudo").hidden = true;
    campo("conta-titulo-pedido").textContent = `Pedido #${id}:`;
    campo("conta-detalhes").showModal();
    mensagem("conta-detalhes-mensagem", "Carregando pedido...");
    try {
      const pedido = await lerPedido(id);
      if (sessao !== versao || leitura !== detalhe) return;
      pedidoAberto = pedido.id;
      campo("conta-dados").replaceChildren();
      for (const [nome, valor] of Object.entries({ Empresa: pedido.empresa, CNPJ: formatarCnpj(pedido.cnpj), Telefone: formatarTelefone(pedido.telefone) || "Não informado", Situação: nomes[pedido.situacao] || pedido.situacao, Televendas: window.Dipsul.identificarTelevendas(pedido.televendas) })) {
        campo("conta-dados").append(elemento("dt", nome + ":"), elemento("dd", valor));
      }
      campo("conta-itens").replaceChildren();
      for (const item of pedido.itens || []) {
        const linha = elemento("tr");
        linha.append(elemento("td", item.codigo), elemento("td", item.descricao), elemento("td", String(item.quantidade)));
        campo("conta-itens").append(linha);
      }
      campo("conta-data").textContent = `Pedido realizado no site em ${dataBrasil(pedido.created_at)}.`;
      campo("conta-reenviar").disabled = !pedido.itens?.length || !pedido.televendas?.telefone_whatsapp;
      campo("conta-detalhes-conteudo").hidden = false;
      mensagem("conta-detalhes-mensagem", "");
    } catch (erro) {
      if (sessao === versao && leitura === detalhe) mensagem("conta-detalhes-mensagem", erro.message, true);
    }
  }

  async function iniciarSessao(sessao) {
    if (!sessao) { limparSessao(); return; }
    versao++; usuario = sessao.user; pagina = 0;
    limparSenhas();
    campo("conta-acesso").hidden = true;
    campo("conta-painel").hidden = campo("conta-sair").hidden = false;
    selecionarSecao(location.hash === "#perfil" ? "perfil" : "pedidos");
    mensagem("conta-mensagem", "");
    const sessaoAtual = versao;
    await carregarPedidos();
    const endereco = new URL(location.href), idPedido = endereco.searchParams.get("pedido");
    if (sessaoAtual === versao && perfil?.situacao === "aprovado" && /^[1-9]\d*$/.test(idPedido || "")) {
      selecionarSecao("pedidos");
      await abrirPedido(idPedido);
      if (sessaoAtual === versao && String(pedidoAberto) === idPedido) {
        endereco.searchParams.delete("pedido"); endereco.hash = "pedidos";
        history.replaceState(null, "", endereco.href);
      }
    }
  }

  function selecionarAcesso(cadastro) {
    campo("conta-login").hidden = cadastro;
    campo("conta-cadastro").hidden = !cadastro;
    for (const [id, ativo] of [["conta-aba-entrar", !cadastro], ["conta-aba-cadastrar", cadastro]]) {
      campo(id).classList.toggle("ativa", ativo); campo(id).setAttribute("aria-pressed", String(ativo));
    }
    limparSenhas(); mensagem("conta-mensagem", "");
    definirEtapaCadastro(false);
  }

  function lerIdentificacao() {
    const cnpj = obterDigitos(campo("conta-cnpj").value), email = campo("conta-email").value.trim().toLowerCase();
    const telefone = obterDigitos(campo("conta-telefone").value);
    if (!cnpjValido(cnpj)) throw new Error("Informe um CNPJ válido.");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if (!/^[1-9]{2}\d{8,9}$/.test(telefone)) throw new Error("Informe um telefone com DDD.");
    return { cnpj, email, telefone };
  }

  function definirEtapaCadastro(completa) {
    campo("conta-cadastro-inicio").hidden = completa;
    campo("conta-cadastro-dados").hidden = !completa;
    campo("conta-acesso").classList.toggle("conta-cadastro-completo", completa);
  }

  function avancarCadastro() {
    try {
      const dados = lerIdentificacao();
      campo("conta-identificacao-resumo").replaceChildren();
      for (const [nome, valor] of Object.entries({ CNPJ: formatarCnpj(dados.cnpj), "E-mail": dados.email, Telefone: formatarTelefone(dados.telefone) })) {
        campo("conta-identificacao-resumo").append(elemento("dt", nome + ":"), elemento("dd", valor));
      }
      definirEtapaCadastro(true); mensagem("conta-mensagem", "");
      campo("conta-empresa").focus();
    } catch (erro) { mensagem("conta-mensagem", erro.message, true); }
  }

  campo("conta-aba-entrar").addEventListener("click", () => selecionarAcesso(false));
  campo("conta-aba-cadastrar").addEventListener("click", () => selecionarAcesso(true));
  campo("conta-cnpj").addEventListener("input", evento => { evento.target.value = formatarCnpj(evento.target.value); });
  campo("conta-cep").addEventListener("input", evento => { evento.target.value = formatarCep(evento.target.value); });
  campo("conta-avancar").addEventListener("click", avancarCadastro);
  campo("conta-voltar-cadastro").addEventListener("click", () => { definirEtapaCadastro(false); limparSenhas(); mensagem("conta-mensagem", ""); campo("conta-cnpj").focus(); });
  const tiposLogin = {
    telefone: { rotulo: "Telefone:", tipo: "tel", teclado: "tel", limite: 20, exemplo: "(00) 00000-0000" },
    email: { rotulo: "E-mail:", tipo: "email", teclado: "email", limite: 254, exemplo: "nome@gmail.com.br" },
    cnpj: { rotulo: "CNPJ:", tipo: "text", teclado: "numeric", limite: 18, exemplo: "00.000.000/0000-00" }
  };
  document.querySelectorAll("[data-tipo-login]").forEach(botao => botao.addEventListener("click", () => {
    if (autenticando || tipoLogin === botao.dataset.tipoLogin) return;
    tipoLogin = botao.dataset.tipoLogin;
    const dados = tiposLogin[tipoLogin], identificacao = campo("conta-identificacao");
    document.querySelectorAll("[data-tipo-login]").forEach(opcao => opcao.setAttribute("aria-pressed", String(opcao.dataset.tipoLogin === tipoLogin)));
    campo("conta-identificacao-rotulo").textContent = dados.rotulo;
    identificacao.type = dados.tipo; identificacao.inputMode = dados.teclado;
    identificacao.maxLength = dados.limite; identificacao.placeholder = dados.exemplo;
    identificacao.value = ""; identificacao.focus();
  }));
  campo("conta-identificacao").addEventListener("input", evento => {
    if (tipoLogin === "telefone") evento.target.value = formatarTelefone(evento.target.value);
    if (tipoLogin === "cnpj") evento.target.value = formatarCnpj(evento.target.value);
  });
  document.querySelectorAll("[data-conta-senha]").forEach(botao => botao.addEventListener("click", () => {
    window.Dipsul.mostrarSenha(botao, campo(botao.getAttribute("aria-controls")).type === "password");
  }));

  for (const id of ["conta-login", "conta-cadastro"]) campo(id).addEventListener("submit", async evento => {
    evento.preventDefault();
    if (autenticando) return;
    if (id === "conta-cadastro" && campo("conta-cadastro-dados").hidden) { avancarCadastro(); return; }
    autenticando = true;
    campo("conta-acesso").querySelectorAll("input, select, button").forEach(controle => { controle.disabled = true; });
    mensagem("conta-mensagem", "Aguarde...");
    try {
      let resposta;
      if (id === "conta-cadastro") {
        const dados = lerIdentificacao(), empresa = campo("conta-empresa").value.trim(), senha = campo("conta-nova-senha").value;
        if (empresa.length < 2 || empresa.length > 120) throw new Error("Informe o nome da empresa.");
        const endereco = {
          cep: obterDigitos(campo("conta-cep").value),
          logradouro: campo("conta-logradouro").value.trim(), numero: campo("conta-numero").value.trim(),
          complemento: campo("conta-complemento").value.trim(), bairro: campo("conta-bairro").value.trim(),
          cidade: campo("conta-cidade").value.trim(), uf: campo("conta-uf").value
        };
        if (endereco.cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
        if (endereco.logradouro.length < 2 || !endereco.numero || endereco.bairro.length < 2 || endereco.cidade.length < 2 || !endereco.uf) {
          throw new Error("Preencha o endereço completo.");
        }
        if (senha.length < 8 || senha.length > 15) throw new Error("A senha deve ter de 8 a 15 caracteres.");
        if (senha !== campo("conta-confirmar-senha").value) throw new Error("As senhas não coincidem.");
        resposta = await cliente.auth.signUp({ phone: "+55" + dados.telefone, password: senha, options: { data: { tipo_conta: "cliente", empresa, cnpj: dados.cnpj, email: dados.email, ...endereco } } });
        if (resposta.error) throw new Error("Não foi possível criar a conta. Confira os dados ou entre em contato com o televendas.");
        if (!resposta.data.session) throw new Error("Cadastro recebido. Entre em contato com o televendas para concluir o acesso.");
      } else {
        let identificacao = campo("conta-identificacao").value.trim();
        const senha = campo("conta-senha").value;
        if (!senha) throw new Error("Informe sua senha.");
        if (tipoLogin !== "telefone") {
          identificacao = tipoLogin === "email" ? identificacao.toLowerCase() : obterDigitos(identificacao);
          if (tipoLogin === "cnpj" && !cnpjValido(identificacao)) throw new Error("Informe um CNPJ válido.");
          if (tipoLogin === "email" && (identificacao.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identificacao))) throw new Error("Informe um e-mail válido.");
          const retorno = await fetch(`${configuracao.supabaseUrl}/functions/v1/cliente-entrar`, {
            method: "POST", headers: { apikey: configuracao.supabaseChavePublica, "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: tipoLogin, identificacao, senha })
          });
          if (!retorno.ok) throw new Error("Não foi possível entrar. Confira os dados e tente novamente.");
          const dados = await retorno.json();
          resposta = await cliente.auth.setSession({ access_token: dados.access_token, refresh_token: dados.refresh_token });
        } else {
          identificacao = obterDigitos(identificacao);
          if (identificacao.startsWith("55") && [12, 13].includes(identificacao.length)) identificacao = identificacao.slice(2);
          if (!/^[1-9]{2}\d{8,9}$/.test(identificacao)) throw new Error("Informe um telefone com DDD.");
          resposta = await cliente.auth.signInWithPassword({ phone: "+55" + identificacao, password: senha });
        }
        if (resposta.error || !resposta.data.session) throw new Error("Não foi possível entrar. Confira os dados e tente novamente.");
      }
      await iniciarSessao(resposta.data.session);
    } catch (erro) { mensagem("conta-mensagem", erro.message, true); }
    finally {
      autenticando = false;
      campo("conta-acesso").querySelectorAll("input, select, button").forEach(controle => { controle.disabled = false; });
      cidadesCadastro.sincronizar();
      limparSenhas();
    }
  });

  campo("conta-atualizar").addEventListener("click", carregarPedidos);
  campo("conta-atualizar-perfil").addEventListener("click", carregarPedidos);
  campo("conta-anterior").addEventListener("click", () => { pagina = Math.max(0, pagina - 1); carregarPedidos(); });
  campo("conta-proxima").addEventListener("click", () => { pagina++; carregarPedidos(); });
  campo("conta-sair").addEventListener("click", async () => {
    limparSessao(); window.Dipsul.notificar("Sessão encerrada.");
    await cliente.auth.signOut({ scope: "local" });
  });
  campo("conta-fechar").addEventListener("click", () => campo("conta-detalhes").close());
  campo("conta-detalhes").addEventListener("close", () => {
    detalhe++; pedidoAberto = null;
    for (const id of ["conta-dados", "conta-itens", "conta-data"]) campo(id).replaceChildren();
  });
  campo("conta-reenviar").addEventListener("click", async () => {
    if (!usuario || !pedidoAberto || campo("conta-reenviar").disabled) return;
    const sessao = versao, leitura = detalhe;
    const guia = window.open("about:blank", "_blank");
    if (!guia) { window.Dipsul.notificar("Permita abrir uma nova guia para reenviar o pedido.", { tipo: "erro" }); return; }
    guia.opener = null;
    campo("conta-reenviar").disabled = true;
    try {
      const pedido = await lerPedido(pedidoAberto);
      if (sessao !== versao || leitura !== detalhe) { guia.close(); return; }
      const numero = obterDigitos(pedido.televendas?.telefone_whatsapp);
      if (!pedido.itens?.length || !/^\d{10,15}$/.test(numero)) throw new Error("Pedido indisponível para reenvio.");
      const texto = window.Dipsul.montarMensagemPedido(pedido, pedido.itens);
      guia.location.replace(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`);
    } catch (erro) {
      guia.close();
      if (sessao === versao && leitura === detalhe) mensagem("conta-detalhes-mensagem", erro.message, true);
    } finally { if (sessao === versao && leitura === detalhe) campo("conta-reenviar").disabled = false; }
  });
  cliente.auth.onAuthStateChange(evento => { if (evento === "SIGNED_OUT") limparSessao(); });
  const versaoInicial = versao;
  cliente.auth.getSession().then(({ data, error }) => {
    if (versaoInicial !== versao || autenticando) return;
    if (error) throw error;
    return iniciarSessao(data.session);
  }).catch(() => mensagem("conta-mensagem", "Não foi possível verificar a sessão. Entre novamente.", true));
})();
