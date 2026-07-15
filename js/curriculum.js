// {{name}}
// {{email}}
// {{phone}}
// {{phone_digits}}
// {{job}}
// {{message}}
// {{filelink}}

// TELEFONE 11 DÍGITOS
document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'phone') {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        e.target.value = value;
    }
});

/* INICIO SCRIPT ENVIO FORMS */
(function () {
    'use strict';

    const EMAILJS_PUBLIC_KEY = 'GahEzbZ9r5BpnbVTs';
    const EMAILJS_SERVICE_ID = 'service_ko9hn4s';
    const EMAILJS_TEMPLATE_ID = 'template_4ym9du8';

    const CLOUDINARY_UPLOAD_PRESET = 'curriculos_upload';
    const CLOUDINARY_UPLOAD_ENDPOINT = 'https://api.cloudinary.com/v1_1/dipsul/raw/upload';

    let emailJSInicializado = false;

    function exibirMensagem(mensagem, tipo = 'sucesso') {

        let msgAntiga = document.getElementById('form-message');
        if (msgAntiga) msgAntiga.remove();

        const divMensagem = document.createElement('div');
        divMensagem.id = 'form-message';
        divMensagem.textContent = mensagem;

        divMensagem.className = tipo === 'sucesso' ? 'form-message success' : 'form-message error';

        document.body.appendChild(divMensagem);

        setTimeout(() => {
            divMensagem.remove();
        }, 4000);
    }
    /* FIM SCRIPT ENVIO FORMS */

    function inicializarEmailJS() {
        if (!window.emailjs) {
            throw new Error('Serviço de envio de e-mail não está disponível.');
        }

        if (!emailJSInicializado) {
            window.emailjs.init({
                publicKey: EMAILJS_PUBLIC_KEY
            });
            emailJSInicializado = true;
        }
    }

    function formatarTelefone(valor) {
        var numeros = String(valor || '').replace(/\D/g, '').slice(0, 11);
        var valorFormatado = '';

        if (numeros.length > 10) {
            valorFormatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
        } else if (numeros.length > 6) {
            valorFormatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
        } else if (numeros.length > 2) {
            valorFormatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
        } else if (numeros.length > 0) {
            valorFormatado = `(${numeros}`;
        }

        return valorFormatado;
    }

    function criarNumeroWhatsApp(phone) {
        const numeros = String(phone || '').replace(/\D/g, '');

        if (!numeros || numeros.startsWith('55')) {
            return numeros;
        }

        return `55${numeros}`;
    }

    function validarCurriculo(arquivo) {
        if (!arquivo) {
            throw new Error('Selecione um currículo.');
        }

        const extensao = arquivo.name
            .split('.')
            .pop()
            .toLowerCase();

        const extensoesPermitidas = [
            'pdf',
            'doc',
            'docx'
        ];

        const mimeTypesPermitidos = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!extensoesPermitidas.includes(extensao)) {
            throw new Error('Envie somente arquivos PDF, DOC ou DOCX.');
        }

        if (
            arquivo.type &&
            !mimeTypesPermitidos.includes(arquivo.type)
        ) {
            throw new Error('O formato do currículo não é permitido.');
        }

        const tamanhoMaximo = 5 * 1024 * 1024;

        if (arquivo.size > tamanhoMaximo) {
            throw new Error('O currículo deve possuir no máximo 5 MB.');
        }

        return true;
    }

    function normalizarNomeArquivo(valor) {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function criarNomeArquivo(nome, vaga, arquivoOriginal) {
        const partesNome = arquivoOriginal.name.split('.');
        const extensao = partesNome.length > 1
            ? partesNome.pop().toLowerCase()
            : '';

        const nomeNormalizado = normalizarNomeArquivo(nome);
        const vagaNormalizada = normalizarNomeArquivo(vaga);

        const baseNome = [
            nomeNormalizado,
            vagaNormalizada
        ]
            .filter(Boolean)
            .join('-');

        if (!baseNome) {
            throw new Error('Não foi possível gerar o nome do currículo.');
        }

        return extensao
            ? `${baseNome}.${extensao}`
            : baseNome;
    }

    async function enviarCurriculoCloudinary(arquivoOriginal, nome, vaga) {
        validarCurriculo(arquivoOriginal);

        const novoNome = criarNomeArquivo(
            nome,
            vaga,
            arquivoOriginal
        );

        const arquivoRenomeado = new File(
            [arquivoOriginal],
            novoNome,
            {
                type: arquivoOriginal.type,
                lastModified: arquivoOriginal.lastModified
            }
        );

        const dadosUpload = new FormData();

        dadosUpload.append(
            'file',
            arquivoRenomeado
        );

        dadosUpload.append(
            'upload_preset',
            CLOUDINARY_UPLOAD_PRESET
        );

        let resposta;

        try {
            resposta = await fetch(
                CLOUDINARY_UPLOAD_ENDPOINT,
                {
                    method: 'POST',
                    body: dadosUpload
                }
            );
        } catch (erro) {
            console.error(
                'Falha de conexão com o Cloudinary:',
                erro
            );

            throw new Error('Não foi possível enviar o currículo.');
        }

        let resultado;

        try {
            resultado = await resposta.json();
        } catch (erro) {
            console.error(
                'Resposta inválida do Cloudinary:',
                erro
            );

            throw new Error('O serviço de upload retornou uma resposta inválida.');
        }

        if (!resposta.ok) {
            console.error(
                'Erro retornado pelo Cloudinary:',
                resultado
            );

            throw new Error(
                resultado?.error?.message ||
                'Não foi possível enviar o currículo.'
            );
        }

        if (!resultado?.secure_url) {
            console.error(
                'Resposta sem secure_url:',
                resultado
            );

            throw new Error('O Cloudinary não retornou o endereço do currículo.');
        }

        console.info('Currículo enviado ao Cloudinary:', {
            filelink: resultado.secure_url,
            publicId: resultado.public_id,
            nomeArquivo: novoNome
        });

        return {
            filelink: resultado.secure_url,
            publicId: resultado.public_id,
            nomeArquivo: novoNome
        };
    }

    function aplicarValidacoesFormulario(formulario) {
        var nome = formulario.querySelector('#name');
        var email = formulario.querySelector('#email');
        var telefone = formulario.querySelector('#phone');
        var vaga = formulario.querySelector('#job');

        var regexNome = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
        var regexEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
        var regexTelefone = /^\(\d{2}\) \d{4,5}-\d{4}$/;

        if (nome && nome.value && !regexNome.test(nome.value)) {
            nome.setCustomValidity('Por favor, insira um nome válido.');
        } else if (nome) {
            nome.setCustomValidity('');
        }

        if (email && email.value && !regexEmail.test(email.value)) {
            email.setCustomValidity('Por favor, insira um e-mail válido.');
        } else if (email) {
            email.setCustomValidity('');
        }

        var valorTelefone = telefone ? telefone.value : '';
        if (valorTelefone && !regexTelefone.test(valorTelefone)) {
            var formatado = formatarTelefone(valorTelefone);

            if (!regexTelefone.test(formatado)) {
                telefone.setCustomValidity('Por favor, insira um telefone válido no formato (XX) XXXXX-XXXX.');
            } else {
                telefone.setCustomValidity('');
                telefone.value = formatado;
            }
        } else if (telefone) {
            telefone.setCustomValidity('');
        }

        if (vaga && !vaga.value) {
            vaga.setCustomValidity('Por favor, selecione uma vaga.');
        } else if (vaga) {
            vaga.setCustomValidity('');
        }
    }

    function configurarCampoTelefone(formulario) {
        var campoTelefone = formulario.querySelector('#phone');

        if (!campoTelefone) return;

        campoTelefone.addEventListener('input', function () {
            var valor = campoTelefone.value.replace(/\D/g, '').slice(0, 11);
            campoTelefone.value = valor;
        });

        campoTelefone.addEventListener('blur', function () {
            var valorFormatado = formatarTelefone(campoTelefone.value);
            if (valorFormatado) campoTelefone.value = valorFormatado;
        });

        campoTelefone.addEventListener('focus', function () {
            campoTelefone.value = campoTelefone.value.replace(/\D/g, '');
        });
    }

    function configurarCampoCurriculo(campoCurriculo) {
        if (!campoCurriculo) return;

        campoCurriculo.addEventListener('change', function () {
            try {
                validarCurriculo(campoCurriculo.files[0]);
                campoCurriculo.setCustomValidity('');
            } catch (erro) {
                campoCurriculo.setCustomValidity(erro.message);
            }
        });
    }

    // AGUARDA O CARREGAMENTO DA PÁGINA
    window.addEventListener('load', function () {
        var formulario = document.getElementById('curriculum-emailjs-form');

        if (!formulario) {
            return;
        }

        var campoCurriculo = formulario.querySelector('#curriculo');
        var botaoEnviar = formulario.querySelector('button[type="submit"]');
        var envioEmAndamento = false;

        configurarCampoTelefone(formulario);
        configurarCampoCurriculo(campoCurriculo);

        // ENVIO DO FORMULÁRIO
        formulario.addEventListener('submit', async function (event) {
            event.preventDefault();

            if (envioEmAndamento) {
                return;
            }

            var nome = formulario.querySelector('#name');
            var email = formulario.querySelector('#email');
            var telefone = formulario.querySelector('#phone');
            var vaga = formulario.querySelector('#job');
            var mensagem = formulario.querySelector('#message');
            var arquivoOriginal = campoCurriculo ? campoCurriculo.files[0] : null;

            aplicarValidacoesFormulario(formulario);

            if (formulario.checkValidity() === false) {
                event.stopPropagation();
                formulario.classList.add('was-validated');

                try {
                    validarCurriculo(arquivoOriginal);
                } catch (erro) {
                    if (campoCurriculo) campoCurriculo.setCustomValidity(erro.message);
                    exibirMensagem(erro.message, 'erro');
                }

                return;
            }

            try {
                validarCurriculo(arquivoOriginal);
                if (campoCurriculo) campoCurriculo.setCustomValidity('');
            } catch (erro) {
                event.stopPropagation();
                if (campoCurriculo) campoCurriculo.setCustomValidity(erro.message);
                formulario.classList.add('was-validated');
                exibirMensagem(erro.message, 'erro');
                return;
            }

            var name = nome ? nome.value.trim() : '';
            var emailValue = email ? email.value.trim() : '';
            var phone = telefone ? telefone.value.trim() : '';
            var job = vaga ? vaga.value : '';
            var message = mensagem ? mensagem.value.trim() : '';
            var textoOriginalBotao = botaoEnviar ? botaoEnviar.innerHTML : '';

            envioEmAndamento = true;

            if (botaoEnviar) {
                botaoEnviar.disabled = true;
                botaoEnviar.innerHTML = `
                    <span
                        class="spinner-border spinner-border-sm mr-2"
                        role="status"
                        aria-hidden="true"
                    ></span>
                    Enviando currículo...
                `;
            }

            try {
                const resultadoUpload = await enviarCurriculoCloudinary(
                    arquivoOriginal,
                    name,
                    job
                );

                const parametrosEmail = {
                    name,
                    email: emailValue,
                    phone,
                    phone_digits: criarNumeroWhatsApp(phone),
                    job,
                    message,
                    filelink: resultadoUpload.filelink
                };

                inicializarEmailJS();

                try {
                    await window.emailjs.send(
                        EMAILJS_SERVICE_ID,
                        EMAILJS_TEMPLATE_ID,
                        parametrosEmail
                    );
                } catch (erroEmail) {
                    console.error(
                        'Erro retornado pelo EmailJS:',
                        erroEmail
                    );

                    throw new Error('Não foi possível enviar o e-mail.');
                }

                exibirMensagem('Currículo enviado com sucesso!', 'sucesso');
                formulario.reset();
                formulario.classList.remove('was-validated');
            } catch (erro) {
                console.error(
                    'Erro ao enviar currículo:',
                    erro
                );

                exibirMensagem(
                    erro.message ||
                    'Não foi possível enviar o currículo.',
                    'erro'
                );
            } finally {
                envioEmAndamento = false;

                if (botaoEnviar) {
                    botaoEnviar.disabled = false;
                    botaoEnviar.innerHTML = textoOriginalBotao;
                }
            }
        }, false);
    });
})();
