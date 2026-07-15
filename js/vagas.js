    jQuery(function($) {
      // CONFIGURAÇÕES
      const CONFIG = {
        DEFAULT_LARGURA_IMAGEM: 1080,
        DEFAULT_ALTURA_IMAGEM: 1920,
        MODAL_PADDING: 60,
        MODAL_VERTICAL_OFFSET: 140,
        MARGEM_LATERAL: 60,
        IMAGE_EXTENSIONS: ['jpg', 'png']
      };

      const JOB_SLUG_MAP = {
        'Assistente de Faturamento - Tubarão': 'assistente-de-faturamento-tubarao',
        'Ajudante de Produção - Tubarão': 'ajudante-de-producao-tubarao',
        'Conferente de Mercadorias - Tubarão': 'conferente-de-mercadorias-tubarao',
        'Coordenador - Chapecó': 'coordenador-chapeco',
        'Coordenador - Montenegro': 'coordenador-montenegro',
        'Coordenador - Tubarão': 'coordenador-tubarao',
        'Motorista - Chapecó': 'motorista-chapeco',
        'Motorista - Montenegro': 'motorista-montenegro',
        'Menor Aprendiz - Matutino': 'menor-aprendiz-matutino',
        'Menor Aprendiz - Vespertino': 'menor-aprendiz-vespertino',
        'Promotor de Vendas - SC': 'promotor-vendas-sc',
        'Promotor de Vendas - RS': 'promotor-vendas-rs'
      };

      let currentImg = null;

      // FUNÇÕES UTILITÁRIAS
      function slugify(str) {
        let normalized = String(str || '');
        
        if (typeof normalized.normalize === 'function') {
          normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } else {
          normalized = normalized
            .replace(/[ÀÁÂÃÄÅàáâãäå]/g, 'a')
            .replace(/[Ææ]/g, 'ae')
            .replace(/[Çç]/g, 'c')
            .replace(/[ÈÉÊËèéêë]/g, 'e')
            .replace(/[ÌÍÎÏìíîï]/g, 'i')
            .replace(/[Ññ]/g, 'n')
            .replace(/[ÒÓÔÕÖØòóôõöø]/g, 'o')
            .replace(/[ÙÚÛÜùúûü]/g, 'u')
            .replace(/[Ýýÿ]/g, 'y');
        }
        
        return normalized
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      function getImageDimensions(imgEl) {
        const width = imgEl.naturalWidth || CONFIG.DEFAULT_LARGURA_IMAGEM;
        const height = imgEl.naturalHeight || CONFIG.DEFAULT_ALTURA_IMAGEM;
        
        return { width, height };
      }

      function calcularEscala(imgWidth, imgHeight, larguraMaxima, maxHeight) {
        return Math.min(1, larguraMaxima / imgWidth, maxHeight / imgHeight);
      }

      function getMaxDimensions() {
        const viewportWidth = $(window).width();
        const viewportHeight = $(window).height();
        
        return {
          larguraMaxima: Math.max(100, viewportWidth - CONFIG.MARGEM_LATERAL),
          maxHeight: Math.max(100, viewportHeight - CONFIG.MODAL_VERTICAL_OFFSET)
        };
      }

      function applyImageStyles(displayLargura, larguraMaxima, maxHeight) {
        $('#job-preview-image').css({
          width: displayLargura + 'px',
          height: 'auto',
          'max-width': larguraMaxima + 'px',
          'max-height': maxHeight + 'px',
          display: 'block',
          margin: '0 auto'
        });

        $('#job-preview-modal .modal-dialog').css({
          'max-width': (displayLargura + CONFIG.MODAL_PADDING) + 'px',
          'width': 'auto'
        });
      }

      function adjustModalToImage(imgEl) {
        if (!imgEl) return;

        const { width: imgWidth, height: imgHeight } = getImageDimensions(imgEl);
        const { larguraMaxima, maxHeight } = getMaxDimensions();
        const scale = calcularEscala(imgWidth, imgHeight, larguraMaxima, maxHeight);
        const displayLargura = Math.round(imgWidth * scale);

        applyImageStyles(displayLargura, larguraMaxima, maxHeight);
      }

      function resetModalStyles() {
        $('#job-preview-modal .modal-dialog').css({ 'max-width': '' });
        $('#job-preview-image').css({
          width: '',
          height: '',
          'max-width': '',
          'max-height': ''
        });
      }

      function bindWindowResize() {
        $(window).off('resize.jobPreview').on('resize.jobPreview', function() {
          if (currentImg) {
            adjustModalToImage(currentImg);
          }
        });
      }

      function bindModalClose() {
        $('#job-preview-modal').off('hidden.bs.modal.jobPreview').on('hidden.bs.modal.jobPreview', function() {
          $(window).off('resize.jobPreview');
          currentImg = null;
          resetModalStyles();
        });
      }

      function showModal() {
        bindWindowResize();
        bindModalClose();
        $('#job-preview-modal').modal('show');
      }

      function validateJobSelection() {
        const $select = $('#job');
        const value = $select.val();
        
        if (!value) {
          $select[0].classList.add('is-invalid');
          try { $select.focus(); } catch (e) {}
          return false;
        }
        
        $select[0].classList.remove('is-invalid');
        return true;
      }

      function getJobImagePath(jobTitle) {
        const slug = JOB_SLUG_MAP[jobTitle] || slugify(jobTitle);
        return 'img/vagas/' + slug;
      }

      // VISUALIZAR VAGA
      $('#view-job-btn').on('click', function() {
        if (!validateJobSelection()) return;

        const jobTitle = $('#job').val();
        const imagePath = getJobImagePath(jobTitle);
        const img = new Image();
        currentImg = img;
        let extensionIndex = 0;

        img.onload = function() {
          adjustModalToImage(this);
          $('#job-preview-image').attr('src', this.src);
          showModal();
        };

        img.onerror = function() {
          if (extensionIndex < CONFIG.IMAGE_EXTENSIONS.length - 1) {
            extensionIndex++;
            img.src = imagePath + '.' + CONFIG.IMAGE_EXTENSIONS[extensionIndex];
            return;
          }

          // Se nenhuma imagem carregar, tenta usar placeholder
          const $placeholder = $('#job-preview-image');
          if ($placeholder.length && $placeholder[0].complete) {
            adjustModalToImage($placeholder[0]);
          } else if ($placeholder.length) {
            $placeholder.off('load.jobPreview').on('load.jobPreview', function() {
              adjustModalToImage(this);
            });
          }

          showModal();
        };

        // Inicia tentativa com JPG
        img.src = imagePath + '.' + CONFIG.IMAGE_EXTENSIONS[0];
      });
    });
