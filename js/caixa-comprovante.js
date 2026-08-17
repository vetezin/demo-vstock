(function () {
  const RECEIPT_ID = "cashPrintReceipt";

  function dinheiro(valor) {
    return window.vstockCurrency.formatMoney(Number(valor || 0));
  }

  function data(valor) {
    return valor ? window.vstockFormatters.dateTime(valor) : "-";
  }

  function texto(valor, padrao = "-") {
    const conteudo = String(valor || "").trim();
    return conteudo || padrao;
  }

  function escaparHtml(valor) {
    const elemento = document.createElement("span");
    elemento.textContent = texto(valor, "");
    return elemento.innerHTML;
  }

  function criarComprovante() {
    let comprovante = document.getElementById(RECEIPT_ID);
    if (comprovante) return comprovante;

    comprovante = document.createElement("article");
    comprovante.id = RECEIPT_ID;
    comprovante.className = "cash-print-receipt";
    comprovante.setAttribute("aria-hidden", "true");
    document.body.append(comprovante);
    return comprovante;
  }

  function blocoValor(rotulo, valor, destaque = false) {
    return `<div class="cash-print-row${destaque ? " is-emphasis" : ""}"><span>${rotulo}</span><strong>${valor}</strong></div>`;
  }

  function imprimir({ sessao, resumo }) {
    if (!sessao || !resumo) return;

    const comprovante = criarComprovante();
    const pagamentos = Array.isArray(resumo.formasPagamento) ? resumo.formasPagamento : [];
    const saldoEsperado = sessao.saldoEsperado ?? resumo.saldoEsperado;
    const observacaoAbertura = texto(sessao.observacaoAbertura, "");
    const observacaoFechamento = texto(sessao.observacaoFechamento, "");

    comprovante.innerHTML = `
      <header class="cash-print-header">
        <h1>RELATÓRIO FECHAMENTO DE CAIXA</h1>
        <p>Sessão #${escaparHtml(sessao.caixaSessaoId)}</p>
      </header>

      <section class="cash-print-section">
        <h2>Abertura</h2>
        ${blocoValor("Operador", escaparHtml(texto(sessao.usuarioAberturaNome)))}
        ${blocoValor("Data", escaparHtml(data(sessao.dataAbertura)))}
        ${blocoValor("Saldo inicial", dinheiro(resumo.saldoInicial ?? sessao.saldoInicial))}
      </section>

      <section class="cash-print-section">
        <h2>Fechamento</h2>
        ${blocoValor("Operador", escaparHtml(texto(sessao.usuarioFechamentoNome)))}
        ${blocoValor("Data", escaparHtml(data(sessao.dataFechamento)))}
      </section>

      <section class="cash-print-section">
        <h2>Movimentação</h2>
        ${blocoValor("Vendas líquidas", dinheiro(resumo.vendasLiquidas))}
        ${blocoValor("Entradas", dinheiro(resumo.entradas))}
        ${blocoValor("Sangrias", dinheiro(-Number(resumo.sangrias || 0)))}
      </section>

      <section class="cash-print-section">
        <h2>Formas de pagamento</h2>
        <div class="cash-print-payments">
          ${pagamentos.length ? pagamentos.map((pagamento) => blocoValor(escaparHtml(texto(pagamento.nome, "Não informado")), dinheiro(pagamento.valorLiquido))).join("") : '<p class="cash-print-empty">Nenhuma venda registrada na sessão.</p>'}
        </div>
      </section>

      <section class="cash-print-section cash-print-conference">
        <h2>Conferência</h2>
        ${blocoValor("Saldo esperado", dinheiro(saldoEsperado), true)}
        ${blocoValor("Valor contado", dinheiro(sessao.valorContado), true)}
        ${blocoValor("Diferença", dinheiro(sessao.diferencaValor), true)}
      </section>

      ${observacaoAbertura || observacaoFechamento ? `
        <section class="cash-print-section cash-print-notes">
          <h2>Observações</h2>
          ${observacaoAbertura ? `<p><strong>Abertura:</strong> ${escaparHtml(observacaoAbertura)}</p>` : ""}
          ${observacaoFechamento ? `<p><strong>Fechamento:</strong> ${escaparHtml(observacaoFechamento)}</p>` : ""}
        </section>` : ""}

      <footer class="cash-print-footer">Comprovante emitido em ${escaparHtml(data(new Date().toISOString()))}</footer>
    `;

    requestAnimationFrame(() => window.print());
  }

  window.vstockCashReceipt = { imprimir };
}());

