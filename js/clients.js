
    // 8 CLIENTES POR PÁGINA
    (function() {
      const slides = document.querySelectorAll('#clients-showcase .client-slide');
      const prevBtn = document.getElementById('clients-prev');
      const nextBtn = document.getElementById('clients-next');
      const perPage = 8;
      let page = 0;

      if (!slides.length || !prevBtn || !nextBtn) {
        return;
      }

      function showPage(p) {
        slides.forEach((el, i) => {
          el.classList.toggle('d-none', i < p * perPage || i >= (p + 1) * perPage);
        });
        prevBtn.disabled = p === 0;
        nextBtn.disabled = (p + 1) * perPage >= slides.length;
      }
      prevBtn.addEventListener('click', function() {
        if (page > 0) {
          page--;
          showPage(page);
        }
      });
      nextBtn.addEventListener('click', function() {
        if ((page + 1) * perPage < slides.length) {
          page++;
          showPage(page);
        }
      });
      // INICIALIZADOR
      showPage(page);
    })();