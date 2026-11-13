# jsPDF

Versão: **4.2.1**, licença MIT (arquivo `LICENSE`).

Origem: pacote npm `jspdf`, fixado no `package.json` e no `package-lock.json`.
`jspdf.umd.min.js` é uma cópia de `node_modules/jspdf/dist/jspdf.umd.min.js`.

Usado somente pela administração para gerar o PDF público no navegador, com
textos selecionáveis, links internos e validação do limite de 30 MB antes do
download. Não envia o catálogo a serviços externos. Não usamos `html()`,
`html2canvas`, carregamento por CDN nem o renderizador Node da biblioteca.

Documentação oficial: https://github.com/parallax/jsPDF
