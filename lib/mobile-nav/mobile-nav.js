(function ($) {
  "use strict";

  // Navegação mobile
  if ($('.main-nav').length) {
    var $navegacaoMobile = $('.main-nav').clone().prop({
      class: 'mobile-nav d-lg-none'
    });
    $('body').append($navegacaoMobile);
    $('body').prepend('<button type="button" class="mobile-nav-toggle d-lg-none"><i class="fa fa-bars"></i></button>');
    $('body').append('<div class="mobile-nav-overly"></div>');

    $(document).on('click', '.mobile-nav-toggle', function(evento) {
      $('body').toggleClass('menu-mobile-ativo');
      $('.mobile-nav-toggle i').toggleClass('fa-times fa-bars');
      $('.mobile-nav-overly').toggle();
    });
    
    $(document).on('click', '.mobile-nav .drop-down > a', function(evento) {
      evento.preventDefault();
      $(this).next().slideToggle(300);
      $(this).parent().toggleClass('active');
    });

    $(document).click(function(evento) {
      var menu = $(".mobile-nav, .mobile-nav-toggle");
      if (!menu.is(evento.target) && menu.has(evento.target).length === 0) {
        if ($('body').hasClass('menu-mobile-ativo')) {
          $('body').removeClass('menu-mobile-ativo');
          $('.mobile-nav-toggle i').toggleClass('fa-times fa-bars');
          $('.mobile-nav-overly').fadeOut();
        }
      }
    });
  } else if ($(".mobile-nav, .mobile-nav-toggle").length) {
    $(".mobile-nav, .mobile-nav-toggle").hide();
  }

})(jQuery);
