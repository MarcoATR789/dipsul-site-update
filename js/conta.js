(function () {
  "use strict";

  const configuracao = window.DipsulConfiguracao;
  const cliente = window.supabase.createClient(configuracao.supabaseUrl, configuracao.supabaseChavePublica, {
    auth: { storage: window.sessionStorage, storageKey: "dipsul_cliente_sessao", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  window.DipsulConta = cliente;
  if (!document.getElementById("conta")) return;

  const campo = id => document.getElementById(id);
  const { obterDigitos, formatarCnpj, formatarTelefone, cnpjValido } = window.Dipsul;
  const nomes = { novo: "Novo", em_atendimento: "Em atendimento", concluido: "Concluído", cancelado: "Cancelado" };
  const porPagina = 10;
  let usuario = null, versao = 0, consulta = 0, detalhe = 0, pagina = 0, pedidoAberto = null;
  let autenticando = false;

  function mensagem(id, texto, erro = false) {
    campo(id).textContent = texto;
    campo(id).classList.toggle("erro", erro);
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

  function limparSessao() {
    versao++; consulta++; detalhe++;
    usuario = null;
    pedidoAberto = null;
    campo("conta-detalhes").close();
    campo("conta-acesso").hidden = false;
    campo("conta-painel").hidden = campo("conta-sair").hidden = campo("conta-pedidos").hidden = true;
    for (const id of ["conta-lista", "conta-dados", "conta-itens", "conta-data", "conta-nome", "conta-pagina", "conta-situacao"]) campo(id).replaceChildren();
    campo("conta-cadastro").reset();
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
    mensagem("conta-situacao", "Carregando pedidos...");
    try {
      const perfil = await cliente.from("catalogo_clientes").select("empresa,situacao").eq("usuario_id", usuario.id).single();
      if (sessao !== versao || leitura !== consulta) return;
      if (perfil.error) throw new Error("Não foi possível carregar o cadastro. Tente novamente.");
      campo("conta-nome").textContent = perfil.data.empresa;
      if (perfil.data.situacao !== "aprovado") {
        mensagem("conta-situacao", perfil.data.situacao === "pendente" ? "Cadastro aguardando aprovação." : "Cadastro bloqueado. Entre em contato com o televendas.");
        return;
      }
      const resposta = await cliente.from("catalogo_pedidos_log").select("id,empresa,situacao,created_at", { count: "exact" })
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
        acao.append(botao); linha.append(data, elemento("td", pedido.empresa), situacao, acao);
        campo("conta-lista").append(linha);
      }
      campo("conta-pedidos").hidden = false;
      campo("conta-anterior").disabled = pagina === 0;
      campo("conta-proxima").disabled = (pagina + 1) * porPagina >= total;
      campo("conta-pagina").textContent = total ? `Página ${pagina + 1} de ${Math.ceil(total / porPagina)}` : "";
      mensagem("conta-situacao", total ? `${total} pedido(s) encontrado(s).` : "Nenhum pedido feito com esta conta.");
    } catch (erro) {
      if (sessao === versao && leitura === consulta) mensagem("conta-situacao", erro.message, true);
    }
  }

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
      for (const [nome, valor] of Object.entries({ Empresa: pedido.empresa, CNPJ: formatarCnpj(pedido.cnpj), Telefone: formatarTelefone(pedido.telefone) || "Não informado", Situação: nomes[pedido.situacao] || pedido.situacao, Televendas: pedido.televendas?.nome || "Não informado" })) {
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
    mensagem("conta-mensagem", "");
    await carregarPedidos();
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
  campo("conta-cep").addEventListener("input", evento => { evento.target.value = obterDigitos(evento.target.value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"); });
  campo("conta-avancar").addEventListener("click", avancarCadastro);
  campo("conta-voltar-cadastro").addEventListener("click", () => { definirEtapaCadastro(false); limparSenhas(); mensagem("conta-mensagem", ""); campo("conta-cnpj").focus(); });
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
          cep: obterDigitos(campo("conta-cep").value), tipo_logradouro: campo("conta-tipo-logradouro").value,
          logradouro: campo("conta-logradouro").value.trim(), numero: campo("conta-numero").value.trim(),
          complemento: campo("conta-complemento").value.trim(), bairro: campo("conta-bairro").value.trim(),
          cidade: campo("conta-cidade").value.trim(), uf: campo("conta-uf").value
        };
        if (endereco.cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
        if (!endereco.tipo_logradouro || endereco.logradouro.length < 2 || !endereco.numero || endereco.bairro.length < 2 || endereco.cidade.length < 2 || !endereco.uf) {
          throw new Error("Preencha o endereço completo.");
        }
        if (senha.length < 8 || senha.length > 15) throw new Error("A senha deve ter de 8 a 15 caracteres.");
        if (senha !== campo("conta-confirmar-senha").value) throw new Error("As senhas não coincidem.");
        resposta = await cliente.auth.signUp({ phone: "+55" + dados.telefone, password: senha, options: { data: { tipo_conta: "cliente", empresa, cnpj: dados.cnpj, email: dados.email, ...endereco } } });
        if (resposta.error) throw new Error("Não foi possível criar a conta. Confira os dados ou entre em contato com o televendas.");
        if (!resposta.data.session) throw new Error("Cadastro recebido. Entre em contato com o televendas para concluir o acesso.");
      } else {
        let identificacao = obterDigitos(campo("conta-identificacao").value);
        const senha = campo("conta-senha").value;
        if (!senha) throw new Error("Informe sua senha.");
        if (identificacao.length === 14) {
          if (!cnpjValido(identificacao)) throw new Error("Informe um CNPJ válido.");
          const retorno = await fetch(`${configuracao.supabaseUrl}/functions/v1/cliente-entrar`, {
            method: "POST", headers: { apikey: configuracao.supabaseChavePublica, "Content-Type": "application/json" },
            body: JSON.stringify({ cnpj: identificacao, senha })
          });
          if (!retorno.ok) throw new Error("Não foi possível entrar. Confira os dados e tente novamente.");
          const dados = await retorno.json();
          resposta = await cliente.auth.setSession({ access_token: dados.access_token, refresh_token: dados.refresh_token });
        } else {
          if (identificacao.startsWith("55") && [12, 13].includes(identificacao.length)) identificacao = identificacao.slice(2);
          if (!/^[1-9]{2}\d{8,9}$/.test(identificacao)) throw new Error("Informe CNPJ ou telefone com DDD.");
          resposta = await cliente.auth.signInWithPassword({ phone: "+55" + identificacao, password: senha });
        }
        if (resposta.error || !resposta.data.session) throw new Error("Não foi possível entrar. Confira os dados e tente novamente.");
      }
      await iniciarSessao(resposta.data.session);
    } catch (erro) { mensagem("conta-mensagem", erro.message, true); }
    finally {
      autenticando = false;
      campo("conta-acesso").querySelectorAll("input, select, button").forEach(controle => { controle.disabled = false; });
      limparSenhas();
    }
  });

  campo("conta-atualizar").addEventListener("click", carregarPedidos);
  campo("conta-anterior").addEventListener("click", () => { pagina = Math.max(0, pagina - 1); carregarPedidos(); });
  campo("conta-proxima").addEventListener("click", () => { pagina++; carregarPedidos(); });
  campo("conta-sair").addEventListener("click", async () => {
    limparSessao(); mensagem("conta-mensagem", "Sessão encerrada.");
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
    campo("conta-reenviar").disabled = true;
    try {
      const pedido = await lerPedido(pedidoAberto);
      if (sessao !== versao || leitura !== detalhe) return;
      const numero = obterDigitos(pedido.televendas?.telefone_whatsapp);
      if (!pedido.itens?.length || !/^\d{10,15}$/.test(numero)) throw new Error("Pedido indisponível para reenvio.");
      const texto = window.Dipsul.montarMensagemPedido(pedido, pedido.itens);
      window.location.assign(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`);
    } catch (erro) {
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
