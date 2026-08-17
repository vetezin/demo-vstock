const API_HISTORICO_CAIXA = {
  LISTA: "http://localhost:8080/api/caixa/sessao/historico",
  DETALHE: (id) => `http://localhost:8080/api/caixa/sessao/${id}`,
  VENDA_DETALHE: (id) => `http://localhost:8080/api/vendas/${id}`
};

const $historicoCaixa = (seletor) => document.querySelector(seletor);
const mensagemHistoricoCaixa = window.vstockUi.createAlertHandler({ container: "#mensagens", clear: true });
const ITENS_POR_PAGINA = 12;
let sessoes = [];
let modalDetalhe = null;
let detalheSessaoAtual = null;

function escaparHtml(valor) {
  const elemento = document.createElement("span");
  elemento.textContent = valor == null ? "" : String(valor);
  return elemento.innerHTML;
}

function numero(valor) {
  return Number(valor || 0);
}

function dinheiro(valor) {
  return window.vstockCurrency.formatMoney(numero(valor));
}

function dataHora(valor) {
  return valor ? String(window.vstockFormatters.dateTime(valor) || "-").replace(", ", " ") : "-";
}

function diferencaClasse(valor) {
  const numeroDiferenca = numero(valor);
  if (numeroDiferenca > 0) return "cash-value-positive";
  if (numeroDiferenca < 0) return "cash-value-negative";
  return "cash-difference-neutral";
}

function situacao(sessao) {
  if (sessao?.status) return { classe: "is-opening", icone: "bi-unlock", texto: "Aberto" };
  if (numero(sessao?.diferencaValor) === 0) return { classe: "is-ok", icone: "bi-check-circle", texto: "Sem diferença" };
  return { classe: "is-warning", icone: "bi-exclamation-circle", texto: "Com diferença" };
}

function montarQuery() {
  const inicio = $historicoCaixa("#cashHistoryStart").value;
  const fim = $historicoCaixa("#cashHistoryEnd").value;
  const operador = $historicoCaixa("#cashHistoryOperator").value.trim();
  const situacaoAtual = $historicoCaixa("#cashHistoryStatus").value;
  return window.vstockUi.toQueryString([
    ["dataInicio", inicio],
    ["dataFim", fim],
    ["operador", operador],
    ["situacao", situacaoAtual]
  ]);
}

function validarPeriodo() {
  const inicio = $historicoCaixa("#cashHistoryStart").value;
  const fim = $historicoCaixa("#cashHistoryEnd").value;
  if (inicio && fim && inicio > fim) throw new Error("A data inicial não pode ser maior que a data final.");
}

function renderizarResumo() {
  const fechadas = sessoes.filter((item) => !item.status);
  const semDiferenca = fechadas.filter((item) => numero(item.diferencaValor) === 0).length;
  const comDiferenca = fechadas.length - semDiferenca;
  $historicoCaixa("#cashHistoryCount").textContent = window.vstockFormatters.integer(sessoes.length);
  $historicoCaixa("#cashHistoryNetSales").textContent = dinheiro(sessoes.reduce((total, item) => total + numero(item.vendasLiquidas), 0));
  $historicoCaixa("#cashHistoryBalanced").textContent = window.vstockFormatters.integer(semDiferenca);
  $historicoCaixa("#cashHistoryDivergent").textContent = window.vstockFormatters.integer(comDiferenca);
}

function renderizarTabela(lista) {
  const corpo = $historicoCaixa("#cashHistoryTableBody");
  if (!lista.length) {
    corpo.innerHTML = '<tr><td class="cash-table-empty" colspan="6">Nenhuma sessão de caixa foi encontrada.</td></tr>';
    return;
  }

  corpo.innerHTML = lista.map((sessao) => {
    const estado = situacao(sessao);
    const fechamento = sessao.dataFechamento ? dataHora(sessao.dataFechamento) : "Em operação";
    return `<tr>
      <td><div class="cash-session-cell"><strong>#${sessao.caixaSessaoId}</strong><small>Sessão de caixa</small></div></td>
      <td><div class="cash-session-cell"><strong>${dataHora(sessao.dataAbertura)}</strong><small>${fechamento}</small></div></td>
      <td>${escaparHtml(sessao.usuarioAberturaNome || "-")}</td>
      <td><span class="cash-history-status ${estado.classe}"><i class="bi ${estado.icone}"></i>${estado.texto}</span></td>
      <td class="text-end ${diferencaClasse(sessao.diferencaValor)}">${sessao.status ? "-" : dinheiro(sessao.diferencaValor)}</td>
      <td class="text-center"><button class="cash-icon-button" type="button" data-sessao-id="${sessao.caixaSessaoId}" title="Ver detalhes" aria-label="Ver detalhes da sessão ${sessao.caixaSessaoId}"><i class="bi bi-eye"></i></button></td>
    </tr>`;
  }).join("");
}

function atualizarPaginacao(pagina = 1) {
  const resultado = window.vstockPagination.paginate(sessoes, pagina, ITENS_POR_PAGINA);
  renderizarTabela(resultado.items);
  window.vstockPagination.render({
    container: "#cashHistoryPagination",
    variant: "listagem",
    itemLabel: "sessões",
    page: resultado.page,
    pageSize: ITENS_POR_PAGINA,
    totalItems: resultado.totalItems,
    idPrefix: "HistoricoCaixa",
    onPageChange: atualizarPaginacao
  });
}

async function carregarHistorico() {
  try {
    validarPeriodo();
    const query = montarQuery();
    const resposta = await fetch(query ? `${API_HISTORICO_CAIXA.LISTA}?${query}` : API_HISTORICO_CAIXA.LISTA, { headers: { Accept: "application/json" } });
    if (!resposta.ok) throw new Error(await resposta.text());
    sessoes = await resposta.json();
    renderizarResumo();
    atualizarPaginacao(1);
  } catch (erro) {
    console.error(erro);
    sessoes = [];
    renderizarResumo();
    atualizarPaginacao(1);
    mensagemHistoricoCaixa(erro.message || "Não foi possível carregar o histórico de caixa.", "danger");
  }
}

function tipoMovimento(movimento) {
  const tipo = movimento?.tipo;
  if (tipo === "VENDA") {
    const mesaNumero = Number(movimento?.mesaNumero);
    if (movimento?.vendaTipo === "MESA" && Number.isInteger(mesaNumero)) {
      return ["is-sale", `Mesa ${mesaNumero}`];
    }
    return ["is-sale", "Venda rápida"];
  }
  const mapa = { VENDA: ["is-sale", "Venda"], ENTRADA: ["is-entry", "Entrada"], SANGRIA: ["is-withdrawal", "Sangria"], ESTORNO: ["is-refund", "Estorno"], AJUSTE: ["is-adjustment", "Ajuste"] };
  return mapa[tipo] || ["is-adjustment", tipo || "Movimento"];
}

async function complementarOrigemDasVendas(movimentos) {
  const vendasSemOrigem = [...new Set(movimentos
    .filter((movimento) => movimento?.tipo === "VENDA" && movimento?.vendaId && !movimento?.vendaTipo)
    .map((movimento) => movimento.vendaId))];

  if (!vendasSemOrigem.length) return;

  const origens = await Promise.all(vendasSemOrigem.map(async (vendaId) => {
    try {
      const resposta = await fetch(API_HISTORICO_CAIXA.VENDA_DETALHE(vendaId), { headers: { Accept: "application/json" } });
      if (!resposta.ok) return [vendaId, null];
      const venda = await resposta.json();
      return [vendaId, { vendaTipo: venda.tipo, mesaNumero: venda.mesaNumero }];
    } catch {
      return [vendaId, null];
    }
  }));

  const origemPorVenda = new Map(origens);
  movimentos.forEach((movimento) => {
    const origem = origemPorVenda.get(movimento.vendaId);
    if (origem) Object.assign(movimento, origem);
  });
}

function preencherDetalhe(detalhe) {
  const sessao = detalhe?.sessao || {};
  const resumo = detalhe?.resumo || {};
  const movimentos = Array.isArray(detalhe?.movimentos) ? detalhe.movimentos : [];
  const pagamentos = Array.isArray(resumo?.formasPagamento) ? resumo.formasPagamento : [];
  const diferenca = sessao?.diferencaValor;
  const textoObservacao = (valor) => String(valor || "").trim() || "Sem observação.";

  $historicoCaixa("#cashDetailSessionId").textContent = sessao.caixaSessaoId ? `#${sessao.caixaSessaoId}` : "";
  $historicoCaixa("#cashDetailInitialBalance").textContent = dinheiro(resumo.saldoInicial);
  $historicoCaixa("#cashDetailNetSales").textContent = dinheiro(resumo.vendasLiquidas);
  $historicoCaixa("#cashDetailExpectedBalance").textContent = dinheiro(sessao.saldoEsperado ?? resumo.saldoEsperado);
  $historicoCaixa("#cashDetailCountedAmount").textContent = sessao.valorContado == null ? "-" : dinheiro(sessao.valorContado);
  const diferencaElemento = $historicoCaixa("#cashDetailDifference");
  diferencaElemento.textContent = sessao.diferencaValor == null ? "-" : dinheiro(diferenca);
  diferencaElemento.className = diferencaClasse(diferenca);
  $historicoCaixa("#cashDetailOpenedAt").textContent = dataHora(sessao.dataAbertura);
  $historicoCaixa("#cashDetailOpeningOperator").textContent = sessao.usuarioAberturaNome || "-";
  $historicoCaixa("#cashDetailClosedAt").textContent = dataHora(sessao.dataFechamento);
  $historicoCaixa("#cashDetailClosingOperator").textContent = sessao.usuarioFechamentoNome || "-";
  $historicoCaixa("#cashDetailOpeningNote").textContent = textoObservacao(sessao.observacaoAbertura);
  $historicoCaixa("#cashDetailClosingNote").textContent = textoObservacao(sessao.observacaoFechamento);
  $historicoCaixa("#cashHistoryPrintReceipt").disabled = Boolean(sessao.status);

  $historicoCaixa("#cashDetailPaymentList").innerHTML = pagamentos.length ? pagamentos.map((pagamento) => `<div class="cash-payment-row"><span class="cash-payment-icon"><i class="bi bi-credit-card"></i></span><div><strong>${escaparHtml(pagamento.nome || "Não informado")}</strong><small>Valor líquido da sessão</small></div><strong>${dinheiro(pagamento.valorLiquido)}</strong></div>`).join("") : '<div class="cash-empty-state">Nenhuma venda registrada nesta sessão.</div>';
  const pagamentosComTaxa = pagamentos.filter((pagamento) => numero(pagamento.valorLiquido) > numero(pagamento.valorLiquidoReceber));
  $historicoCaixa("#cashDetailTaxaBloco").classList.toggle("d-none", !pagamentosComTaxa.length);
  $historicoCaixa("#cashDetailTaxaList").innerHTML = pagamentosComTaxa.map((pagamento) => {
    const bruto = numero(pagamento.valorLiquido);
    const liquido = numero(pagamento.valorLiquidoReceber);
    return `<div class="cash-payment-row"><span class="cash-payment-icon"><i class="bi bi-credit-card"></i></span><div><strong>${escaparHtml(pagamento.nome || "Não informado")}</strong><small>Bruto ${dinheiro(bruto)} · Taxa ${dinheiro(bruto - liquido)}</small></div><strong>${dinheiro(liquido)}</strong></div>`;
  }).join("");
  $historicoCaixa("#cashDetailMovementBody").innerHTML = movimentos.length ? movimentos.map((movimento) => {
    const [classe, texto] = tipoMovimento(movimento);
    const negativo = movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO";
    const origem = movimento.vendaId ? `Venda #${movimento.vendaId}` : "Lançamento manual";
    const motivo = movimento.motivo || movimento.observacao || "-";
    return `<tr><td>${dataHora(movimento.dataMovimento)}</td><td><span class="cash-movement-badge ${classe}">${texto}</span></td><td>${escaparHtml(origem)}</td><td>${escaparHtml(movimento.usuarioNome || "-")}</td><td>${escaparHtml(motivo)}</td><td class="text-end ${negativo ? "cash-value-negative" : "cash-value-positive"}">${dinheiro(negativo ? -numero(movimento.valor) : movimento.valor)}</td></tr>`;
  }).join("") : '<tr><td class="cash-table-empty" colspan="6">Nenhum movimento registrado nesta sessão.</td></tr>';
}

async function abrirDetalhe(sessaoId) {
  try {
    const resposta = await fetch(API_HISTORICO_CAIXA.DETALHE(sessaoId), { headers: { Accept: "application/json" } });
    if (!resposta.ok) throw new Error(await resposta.text());
    detalheSessaoAtual = await resposta.json();
    await complementarOrigemDasVendas(detalheSessaoAtual.movimentos || []);
    preencherDetalhe(detalheSessaoAtual);
    modalDetalhe.show();
  } catch (erro) {
    console.error(erro);
    mensagemHistoricoCaixa(erro.message || "Não foi possível carregar os detalhes da sessão.", "danger");
  }
}

function limparFiltros() {
  $historicoCaixa("#cashHistoryStart").value = "";
  $historicoCaixa("#cashHistoryEnd").value = "";
  $historicoCaixa("#cashHistoryOperator").value = "";
  $historicoCaixa("#cashHistoryStatus").value = "";
}

document.addEventListener("DOMContentLoaded", async () => {
  modalDetalhe = new bootstrap.Modal(document.getElementById("cashHistoryDetailModal"));
  await carregarHistorico();
  $historicoCaixa("#cashHistorySearch").addEventListener("click", carregarHistorico);
  $historicoCaixa("#cashHistoryClear").addEventListener("click", () => { limparFiltros(); carregarHistorico(); });
  $historicoCaixa("#cashHistoryPrintReceipt").addEventListener("click", () => {
    if (!detalheSessaoAtual || detalheSessaoAtual.sessao?.status) return;
    window.vstockCashReceipt.imprimir({
      sessao: detalheSessaoAtual.sessao,
      resumo: detalheSessaoAtual.resumo
    });
  });
  $historicoCaixa("#cashHistoryTableBody").addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-sessao-id]");
    if (botao) abrirDetalhe(Number(botao.dataset.sessaoId));
  });
});

