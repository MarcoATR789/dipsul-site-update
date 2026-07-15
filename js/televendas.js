const infoVendedores = {
  cleber: {
    nome: "Cleber Martins",
    telefone: "(48) 3301-0726",
    email: "cleber.martins@dipsul.com.br",
    whatsapp: "https://wa.me/554833010726?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
  },
  rose: {
    nome: "Rose Leal",
    telefone: "(48) 3301-0737",
    email: "rosimeire.leal@dipsul.com.br",
    whatsapp: "https://wa.me/554833010737?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
  },
  luana: {
    nome: "Luana Sousa",
    telefone: "(48) 3301-0734",
    email: "luana.sousa@dipsul.com.br",
    whatsapp: "https://wa.me/554833010734?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
  },
  emily: {
    nome: "Emily Bittencourt",
    telefone: "(48) 3301-0735",
    email: "emily.bittencourt@dipsul.com.br",
    whatsapp: "https://wa.me/554833010735?text=Olá!%20Vim%20através%20do%20site%20da%20Dipsul.%20Gostaria%20de%20conversar%20sobre%20um%20pedido."
  }
};

function abrirInfoVendedor(vendedor) {
  const info = infoVendedores[vendedor];
  if (!info) return;

  const telefoneLimpo = info.telefone.replace(/[\s()-]/g, '');
  const emailCodificado = encodeURIComponent(
    "Olá! Vim através do site da Dipsul e gostaria de realizar um pedido com a empresa."
  );

  const modalDetalhes = document.getElementById("modalDetails");
  if (!modalDetalhes) return;

  modalDetalhes.innerHTML = `
    <div class="seller-modal-header">
      <span>Televendas Dipsul</span>
      <h2>${info.nome}</h2>
    </div>

    <div class="seller-contact-list">
      <div class="seller-contact-item">
        <span>Telefone:</span>
        <strong>${info.telefone}</strong>
      </div>
      <div class="seller-contact-item">
        <span>Email:</span>
        <strong>${info.email}</strong>
      </div>
    </div>

    <div class="seller-actions">
      <a href="${info.whatsapp}" target="_blank" rel="noopener noreferrer" class="seller-action seller-action--whatsapp">
        <i class="fa fa-whatsapp" aria-hidden="true"></i>
        <span>Conversar por WhatsApp</span>
      </a>
      <a href="mailto:${info.email}?subject=Site - Pedido com a Dipsul!&body=${emailCodificado}" target="_blank" rel="noopener noreferrer" class="seller-action seller-action--email">
        <i class="fa fa-envelope" aria-hidden="true"></i>
        <span>Enviar Email</span>
      </a>
      <a href="tel:${telefoneLimpo}" target="_blank" class="seller-action seller-action--phone">
        <i class="fa fa-phone" aria-hidden="true"></i>
        <span>Ligar Agora</span>
      </a>
    </div>
  `;

  const modal = document.getElementById("infoModal");
  if (modal) modal.style.display = "block";
}

function fecharInfoVendedor(event) {
  const modal = document.getElementById("infoModal");
  if (!modal) return;

  if (!event || event.target === modal) {
    modal.style.display = "none";
  }
}

function showInfo(member) {
  abrirInfoVendedor(member);
}

function closeInfo(event) {
  fecharInfoVendedor(event);
}
