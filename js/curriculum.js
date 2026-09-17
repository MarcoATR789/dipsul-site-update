// Campos usados pelo template do EmailJS:
// {{name}}, {{email}}, {{phone}}, {{phone_digits}}, {{job}}, {{message}}, {{filelink}}
(function () {
  "use strict";

  const EMAILJS_CHAVE_PUBLICA = "GahEzbZ9r5BpnbVTs";
  const EMAILJS_SERVICO_ID = "service_ko9hn4s";
  const EMAILJS_TEMPLATE_ID = "template_4ym9du8";
  const CLOUDINARY_UPLOAD_PRESET = "curriculos_upload";
  const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/dipsul/raw/upload";
  const TAMANHO_MAXIMO_CURRICULO = 5 * 1024 * 1024;

  const EXTENSOES_CURRICULO = ["pdf", "doc", "docx"];
  const TIPOS_CURRICULO = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  let emailJSInicializado = false;

  function avisar(mensagem, erro = false) {
    if (window.Dipsul && typeof window.Dipsul.notificar === "function") {
      window.Dipsul.notificar(mensagem, { tipo: erro ? "erro" : "status" });
      return;
    }

    console[erro ? "error" : "log"](mensagem);
  }

  function obterNumeros(valor, limite) {
    return String(valor || "").replace(/\D/g, "").slice(0, limite);
  }

  function formatarTelefone(valor) {
    const numeros = obterNumeros(valor, 11);

    if (numeros.length > 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
    }

    if (numeros.length > 6) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }

    if (numeros.length > 2) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    }

    return numeros ? `(${numeros}` : "";
  }

  function criarNumeroWhatsApp(telefone) {
    const numeros = obterNumeros(telefone, 13);
    return numeros && !numeros.startsWith("55") ? `55${numeros}` : numeros;
  }

  function iniciarEmailJS() {
    if (!window.emailjs) {
      throw new Error("Serviço de envio de e-mail não está disponível.");
    }

    if (!emailJSInicializado) {
      window.emailjs.init({ publicKey: EMAILJS_CHAVE_PUBLICA });
      emailJSInicializado = true;
    }
  }

  function normalizarNomeArquivo(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function validarCurriculo(arquivo) {
    if (!arquivo) {
      throw new Error("Selecione um currículo.");
    }

    const extensao = arquivo.name.split(".").pop().toLowerCase();

    if (!EXTENSOES_CURRICULO.includes(extensao)) {
      throw new Error("Envie somente arquivos PDF, DOC ou DOCX.");
    }

    if (arquivo.type && !TIPOS_CURRICULO.includes(arquivo.type)) {
      throw new Error("O formato do currículo não é permitido.");
    }

    if (arquivo.size > TAMANHO_MAXIMO_CURRICULO) {
      throw new Error("O currículo deve possuir no máximo 5 MB.");
    }
  }

  function criarNomeCurriculo(nome, vaga, arquivo) {
    const partes = arquivo.name.split(".");
    const extensao = partes.length > 1 ? partes.pop().toLowerCase() : "";
    const nomeBase = [
      normalizarNomeArquivo(nome),
      normalizarNomeArquivo(vaga)
    ].filter(Boolean).join("-");

    if (!nomeBase) {
      throw new Error("Não foi possível gerar o nome do currículo.");
    }

    return extensao ? `${nomeBase}.${extensao}` : nomeBase;
  }

  async function enviarCurriculoCloudinary(arquivoOriginal, nome, vaga) {
    validarCurriculo(arquivoOriginal);

    const nomeCurriculo = criarNomeCurriculo(nome, vaga, arquivoOriginal);
    const arquivoRenomeado = new File([arquivoOriginal], nomeCurriculo, {
      type: arquivoOriginal.type,
      lastModified: arquivoOriginal.lastModified
    });
    const dadosUpload = new FormData();

    dadosUpload.append("file", arquivoRenomeado);
    dadosUpload.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    let resposta;

    try {
      resposta = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: dadosUpload
      });
    } catch (erro) {
      console.error("Falha de conexão com o Cloudinary:", erro);
      throw new Error("Não foi possível enviar o currículo.");
    }

    let resultado;

    try {
      resultado = await resposta.json();
    } catch (erro) {
      console.error("Resposta inválida do Cloudinary:", erro);
      throw new Error("O serviço de upload retornou uma resposta inválida.");
    }

    if (!resposta.ok) {
      console.error("Erro retornado pelo Cloudinary:", resultado);
      throw new Error(resultado?.error?.message || "Não foi possível enviar o currículo.");
    }

    if (!resultado?.secure_url) {
      console.error("Resposta sem secure_url:", resultado);
      throw new Error("O Cloudinary não retornou o endereço do currículo.");
    }

    console.info("Currículo enviado ao Cloudinary:", {
      filelink: resultado.secure_url,
      publicId: resultado.public_id,
      nomeArquivo: nomeCurriculo
    });

    return resultado.secure_url;
  }

  function obterCamposFormulario(formulario) {
    return {
      nome: formulario.querySelector("#nome"),
      email: formulario.querySelector("#email"),
      telefone: formulario.querySelector("#telefone"),
      vaga: formulario.querySelector("#vaga-selecao"),
      mensagem: formulario.querySelector("#mensagem"),
      curriculo: formulario.querySelector("#curriculo")
    };
  }

  function validarTextoFormulario(campos) {
    const regexNome = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
    const regexEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    const regexTelefone = /^\(\d{2}\) \d{4,5}-\d{4}$/;

    if (campos.nome) {
      campos.nome.setCustomValidity(
        campos.nome.value && !regexNome.test(campos.nome.value)
          ? "Por favor, insira um nome válido."
          : ""
      );
    }

    if (campos.email) {
      campos.email.setCustomValidity(
        campos.email.value && !regexEmail.test(campos.email.value)
          ? "Por favor, insira um e-mail válido."
          : ""
      );
    }

    if (campos.telefone) {
      const telefoneFormatado = formatarTelefone(campos.telefone.value);

      if (telefoneFormatado) {
        campos.telefone.value = telefoneFormatado;
      }

      campos.telefone.setCustomValidity(
        campos.telefone.value && !regexTelefone.test(campos.telefone.value)
          ? "Por favor, insira um telefone válido no formato (XX) XXXXX-XXXX."
          : ""
      );
    }

    if (campos.vaga) {
      campos.vaga.setCustomValidity(campos.vaga.value ? "" : "Por favor, selecione uma vaga.");
    }
  }

  function configurarTelefone(campoTelefone) {
    if (!campoTelefone) return;

    campoTelefone.addEventListener("input", () => {
      campoTelefone.value = obterNumeros(campoTelefone.value, 11);
    });

    campoTelefone.addEventListener("blur", () => {
      campoTelefone.value = formatarTelefone(campoTelefone.value);
    });

    campoTelefone.addEventListener("focus", () => {
      campoTelefone.value = obterNumeros(campoTelefone.value, 11);
    });
  }

  function configurarCurriculo(campoCurriculo) {
    if (!campoCurriculo) return;

    campoCurriculo.addEventListener("change", () => {
      try {
        validarCurriculo(campoCurriculo.files[0]);
        campoCurriculo.setCustomValidity("");
      } catch (erro) {
        campoCurriculo.setCustomValidity(erro.message);
      }
    });
  }

  function obterDadosFormulario(campos) {
    return {
      nome: campos.nome ? campos.nome.value.trim() : "",
      email: campos.email ? campos.email.value.trim() : "",
      telefone: campos.telefone ? campos.telefone.value.trim() : "",
      vaga: campos.vaga ? campos.vaga.value : "",
      mensagem: campos.mensagem ? campos.mensagem.value.trim() : "",
      arquivo: campos.curriculo ? campos.curriculo.files[0] : null
    };
  }

  function definirEnvioAtivo(botao, ativo, textoOriginal) {
    if (!botao) return;

    botao.disabled = ativo;
    botao.innerHTML = ativo
      ? '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Enviando currículo...'
      : textoOriginal;
  }

  async function enviarEmailCurriculo(dados, linkCurriculo) {
    iniciarEmailJS();

    await window.emailjs.send(EMAILJS_SERVICO_ID, EMAILJS_TEMPLATE_ID, {
      name: dados.nome,
      email: dados.email,
      phone: dados.telefone,
      phone_digits: criarNumeroWhatsApp(dados.telefone),
      job: dados.vaga,
      message: dados.mensagem,
      filelink: linkCurriculo
    });
  }

  window.addEventListener("load", function () {
    const formulario = document.getElementById("curriculo-emailjs-form");
    if (!formulario) return;

    const campos = obterCamposFormulario(formulario);
    const botaoEnviar = formulario.querySelector('button[type="submit"]');
    let envioEmAndamento = false;

    configurarTelefone(campos.telefone);
    configurarCurriculo(campos.curriculo);

    formulario.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      if (envioEmAndamento) return;

      validarTextoFormulario(campos);
      const dados = obterDadosFormulario(campos);

      try {
        validarCurriculo(dados.arquivo);
        if (campos.curriculo) campos.curriculo.setCustomValidity("");
      } catch (erro) {
        if (campos.curriculo) campos.curriculo.setCustomValidity(erro.message);
      }

      if (!formulario.checkValidity()) {
        evento.stopPropagation();
        formulario.classList.add("was-validated");

        try {
          validarCurriculo(dados.arquivo);
          avisar("Preencha os campos obrigatórios.", true);
        } catch (erro) {
          avisar(erro.message, true);
        }

        return;
      }

      const textoOriginalBotao = botaoEnviar ? botaoEnviar.innerHTML : "";
      envioEmAndamento = true;
      definirEnvioAtivo(botaoEnviar, true, textoOriginalBotao);

      try {
        const linkCurriculo = await enviarCurriculoCloudinary(dados.arquivo, dados.nome, dados.vaga);
        await enviarEmailCurriculo(dados, linkCurriculo);

        avisar("Currículo enviado com sucesso!");
        formulario.reset();
        formulario.classList.remove("was-validated");
      } catch (erro) {
        console.error("Erro ao enviar currículo:", erro);
        avisar(erro.message || "Não foi possível enviar o currículo.", true);
      } finally {
        envioEmAndamento = false;
        definirEnvioAtivo(botaoEnviar, false, textoOriginalBotao);
      }
    });
  });
})();
