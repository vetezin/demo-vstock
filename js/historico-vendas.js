const API_HISTORICO_VENDAS = {
  LISTA: "http://localhost:8080/api/vendas",
  DETALHE: (id) => `http://localhost:8080/api/vendas/${id}`,
  APROVAR_CANCELAMENTO: (id) => `http://localhost:8080/api/vendas/${id}/cancelamento/aprovar-admin`,
  CANCELAR: (id) => `http://localhost:8080/api/vendas/${id}/cancelamento`,
  FORMAS_PAGAMENTO: "http://localhost:8080/api/forma-pagamento/all?ativosOnly=true"
};

const $historicoVendas = (selector) => document.querySelector(selector);
const msgHistoricoVendas = window.vstockUi.createAlertHandler({ container: "#mensagens", clear: true });
const msgModalCancelarVenda = window.vstockUi.createAlertHandler({ container: "#mensagensModalCancelarVenda", clear: true });

let vendasHistoricoCache = [];
let vendasPaginadas = [];
let paginaAtualHistoricoVendas = 1;
let totalPaginasHistoricoVendas = 1;
let totalItensHistoricoVendas = 0;
let modalDetalheVenda = null;
let modalCancelarVenda = null;
let vendaCancelamentoAtualId = null;
let aprovacaoAdminCancelamento = null;
let cancelamentoBloqueadoPrazo = false;
let limiteHorasCancelamento = 12;

const ITENS_POR_PAGINA_HISTORICO_VENDAS = 12;

function vendaEstaCancelada(venda) {
  return String(venda?.status || "").trim().toUpperCase() === "CANCELADA";
}

function badgeTipoVenda(venda) {
  const mesaNumero = Number(venda?.mesaNumero);
  if (String(venda?.tipo || "").toUpperCase() === "MESA" && Number.isInteger(mesaNumero)) {
    return '<span class="sales-type-badge mesa"><i class="bi bi-table"></i> Mesa ' + mesaNumero + '</span>';
  }
  return '<span class="sales-type-badge venda-rapida"><i class="bi bi-lightning-charge"></i> Venda rápida</span>';
}

function obterObservacaoValida(observacao) {
  const texto = typeof observacao === "string" ? observacao.trim() : "";
  if (!texto || texto === "-") {
    return null;
  }
  return texto;
}

function formatarDataHoraSemVirgula(valor) {
  return String(window.vstockFormatters.dateTime(valor) || "-").replace(", ", " ");
}

function podeCancelarPorPrazo(dataVenda) {
  if (!dataVenda) return false;
  const data = new Date(dataVenda);
  if (Number.isNaN(data.getTime())) return false;
  const limite = new Date(data.getTime() + limiteHorasCancelamento * 60 * 60 * 1000);
  return Date.now() <= limite.getTime();
}

async function carregarLimiteHorasCancelamento() {
  try {
    const response = await fetch("http://localhost:8080/api/parametrizacao/unica", {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      return;
    }

    const empresa = await response.json();
    const numero = Number.parseInt(String(empresa?.horasLimiteCancelamentoVenda ?? "").trim(), 10);
    if (Number.isInteger(numero) && numero > 0) {
      limiteHorasCancelamento = numero;
    }
  } catch (erro) {
    console.error(erro);
  }
}

function localizarVendaHistorico(vendaId) {
  return (Array.isArray(vendasHistoricoCache) ? vendasHistoricoCache : []).find((item) => Number(item?.vendaId || 0) === Number(vendaId || 0)) || null;
}

function montarQueryHistoricoVendas() {
  const dataInicio = $historicoVendas("#filtroVendaDataInicio")?.value || "";
  const dataFim = $historicoVendas("#filtroVendaDataFim")?.value || "";
  const cliente = $historicoVendas("#filtroVendaCliente")?.value?.trim() || "";
  const formaPagamento = $historicoVendas("#filtroVendaFormaPagamento")?.value?.trim() || "";
  const tipo = $historicoVendas("#filtroVendaTipo")?.value || "";
  const vendedor = $historicoVendas("#filtroVendaVendedor")?.value?.trim() || "";

  return window.vstockUi.toQueryString([
    ["dataInicio", dataInicio],
    ["dataFim", dataFim],
    ["cliente", cliente],
    ["formaPagamento", formaPagamento],
    ["tipo", tipo],
    ["vendedor", vendedor]
  ]);
}

function validarPeriodoHistoricoVendas() {
  const dataInicio = $historicoVendas("#filtroVendaDataInicio")?.value || "";
  const dataFim = $historicoVendas("#filtroVendaDataFim")?.value || "";

  if (dataInicio && dataFim && dataInicio > dataFim) {
    throw new Error("A data inicial não pode ser maior que a data final.");
  }
}

function renderizarResumoHistoricoVendas(lista) {
  const totalVendas = Array.isArray(lista) ? lista.length : 0;
  const vendasValidas = (Array.isArray(lista) ? lista : []).filter((item) => !vendaEstaCancelada(item));
  const totalItens = vendasValidas.reduce((acc, item) => acc + Number(item.quantidadeItens || 0), 0);
  const totalValor = vendasValidas.reduce((acc, item) => acc + Number(item.valorTotal || 0), 0);

  $historicoVendas("#resumoQuantidadeVendas").textContent = window.vstockFormatters.integer(totalVendas);
  $historicoVendas("#resumoQuantidadeItensVendas").textContent = window.vstockFormatters.integer(totalItens);
  $historicoVendas("#resumoValorTotalVendas").textContent = window.vstockCurrency.formatMoney(totalValor);
}

function renderizarTabelaHistoricoVendas(lista) {
  const tbody = $historicoVendas("#tabelaHistoricoVendasBody");
  const vazio = $historicoVendas("#vazioHistoricoVendas");
  if (!tbody || !vazio) return;

  function botaoCancelar(item) {
    const cancelada = vendaEstaCancelada(item);
    const disabled = cancelada ? "disabled" : "";
    const disabledClass = cancelada ? " is-disabled" : "";
    const title = cancelada ? "Venda já cancelada" : "Cancelar venda";

    return `
      <button type="button" class="btn btn-outline-danger btn-sm sales-action-btn${disabledClass}" data-acao="cancelar" data-venda-id="${item.vendaId}" title="${title}" aria-disabled="${cancelada ? "true" : "false"}" ${disabled}>
        <i class="bi bi-x-circle"></i>
      </button>
    `;
  }

  if (!lista.length) {
    tbody.innerHTML = "";
    vazio.classList.remove("d-none");
    return;
  }

  vazio.classList.add("d-none");
  tbody.innerHTML = lista.map((item) => `
    <tr>
      <td>
        <div class="sales-cell-main">
          <strong>#${item.vendaId}</strong>
          <small>Registro da venda</small>
        </div>
      </td>
      <td>${window.vstockFormatters.dateTime(item.dataVenda)}</td>
      <td>${item.clienteNome || "Venda sem cliente identificado"}</td>
      <td>${item.formaPagamentoNome || "-"}</td>
      <td>${badgeTipoVenda(item)}</td>
      <td>${item.vendedorNome || "-"}</td>
      <td class="text-end">${window.vstockFormatters.integer(item.quantidadeItens)}</td>
      <td class="text-end fw-semibold">${window.vstockCurrency.formatMoney(item.valorTotal)}</td>
      <td class="text-center">
        <div class="sales-actions">
          <button type="button" class="btn btn-outline-success btn-sm sales-action-btn" data-acao="ver" data-venda-id="${item.vendaId}" title="Ver detalhes">
            <i class="bi bi-eye"></i>
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm sales-action-btn" data-acao="reimprimir" data-venda-id="${item.vendaId}" title="Reimprimir comprovante">
            <i class="bi bi-printer"></i>
          </button>
          ${botaoCancelar(item)}
        </div>
      </td>
    </tr>
  `).join("");
}

function atualizarPaginacaoHistoricoVendas(pagina = 1) {
  const paginacao = window.vstockPagination.paginate(vendasHistoricoCache, pagina, ITENS_POR_PAGINA_HISTORICO_VENDAS);
  vendasPaginadas = paginacao.items;
  paginaAtualHistoricoVendas = paginacao.page;
  totalPaginasHistoricoVendas = paginacao.totalPages;
  totalItensHistoricoVendas = paginacao.totalItems;
  renderizarTabelaHistoricoVendas(vendasPaginadas);
  renderizarControlesPaginacaoHistoricoVendas();
}

function renderizarControlesPaginacaoHistoricoVendas() {
  window.vstockPagination.render({
    container: "#paginacaoHistoricoVendas",
    variant: "listagem",
    itemLabel: "vendas",
    page: paginaAtualHistoricoVendas,
    pageSize: ITENS_POR_PAGINA_HISTORICO_VENDAS,
    totalItems: totalItensHistoricoVendas,
    idPrefix: "HistoricoVendas",
    onPageChange: (novaPagina) => {
      atualizarPaginacaoHistoricoVendas(novaPagina);
    }
  });
}

async function carregarFormasPagamentoHistorico() {
  try {
    const response = await fetch(API_HISTORICO_VENDAS.FORMAS_PAGAMENTO);
    if (!response.ok) {
      throw new Error("Falha ao carregar formas de pagamento.");
    }

    const lista = await response.json();
    const select = $historicoVendas("#filtroVendaFormaPagamento");
    if (!select) return;

    select.innerHTML = `<option value="">Todas</option>`;
    lista.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.nome || "";
      option.textContent = item.nome || "Forma de pagamento";
      select.appendChild(option);
    });
  } catch (erro) {
    console.error(erro);
  }
}

async function carregarHistoricoVendas(pagina = 1) {
  try {
    validarPeriodoHistoricoVendas();
    const query = montarQueryHistoricoVendas();
    const url = query ? `${API_HISTORICO_VENDAS.LISTA}?${query}` : API_HISTORICO_VENDAS.LISTA;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Falha ao carregar as vendas.");
    }

    vendasHistoricoCache = await response.json();
    renderizarResumoHistoricoVendas(vendasHistoricoCache);
    atualizarPaginacaoHistoricoVendas(pagina);
  } catch (erro) {
    console.error(erro);
    vendasHistoricoCache = [];
    renderizarResumoHistoricoVendas(vendasHistoricoCache);
    atualizarPaginacaoHistoricoVendas(1);
    msgHistoricoVendas("Não foi possível carregar o histórico de vendas.", "danger");
  }
}

function limparFiltrosHistoricoVendas() {
  $historicoVendas("#filtroVendaDataInicio").value = "";
  $historicoVendas("#filtroVendaDataFim").value = "";
  $historicoVendas("#filtroVendaCliente").value = "";
  $historicoVendas("#filtroVendaFormaPagamento").value = "";
  $historicoVendas("#filtroVendaTipo").value = "";
  $historicoVendas("#filtroVendaVendedor").value = "";
}

function resetarModalCancelarVenda() {
  vendaCancelamentoAtualId = null;
  aprovacaoAdminCancelamento = null;
  cancelamentoBloqueadoPrazo = false;
  $historicoVendas("#mensagensModalCancelarVenda").innerHTML = "";
  $historicoVendas("#cancelamentoAdminEmail").value = "";
  $historicoVendas("#cancelamentoAdminSenha").value = "";
  $historicoVendas("#cancelamentoMotivo").value = "";
  $historicoVendas("#cancelamentoAdminAprovador").textContent = "-";
  $historicoVendas("#cancelamentoVendaEtapaAprovacao").classList.remove("d-none");
  $historicoVendas("#cancelamentoVendaEtapaConfirmacao").classList.add("d-none");
  $historicoVendas("#btnAprovarCancelamentoVenda").classList.remove("d-none");
  $historicoVendas("#btnConfirmarCancelamentoVenda").classList.add("d-none");
}

function abrirModalCancelarVenda(vendaId) {
  resetarModalCancelarVenda();
  vendaCancelamentoAtualId = vendaId;
  const venda = localizarVendaHistorico(vendaId);
  const podeCancelar = podeCancelarPorPrazo(venda?.dataVenda);
  if (!podeCancelar) {
    cancelamentoBloqueadoPrazo = true;
    $historicoVendas("#cancelamentoVendaEtapaAprovacao").classList.add("d-none");
    $historicoVendas("#btnAprovarCancelamentoVenda").classList.add("d-none");
    const dataVendaFormatada = formatarDataHoraSemVirgula(venda?.dataVenda);
    msgModalCancelarVenda(
      `Esta venda foi realizada em ${dataVendaFormatada} e so pode ser cancelada nas primeiras ${limiteHorasCancelamento} horas.`,
      "warning"
    );
  }
  modalCancelarVenda?.show();
}

function preencherModalDetalheVenda(detalhe) {
  const itens = Array.isArray(detalhe?.itens) ? detalhe.itens : [];
  const pagamentos = Array.isArray(detalhe?.pagamentos) ? detalhe.pagamentos : [];
  const observacaoValida = obterObservacaoValida(detalhe?.observacao);
  const motivoCancelamento = obterObservacaoValida(detalhe?.motivoCancelamento);
  const status = detalhe?.status || "";
  const troco = Number(detalhe?.troco || 0);
  const valorBruto = Number(detalhe?.valorTotal || 0);
  const valorLiquidoReceber = Number(detalhe?.valorLiquidoReceber ?? valorBruto);
  const valorTaxa = Math.max(valorBruto - valorLiquidoReceber, 0);
  const vendaCancelada = vendaEstaCancelada(detalhe);

  $historicoVendas("#detalheVendaId").textContent = detalhe?.vendaId ? `#${detalhe.vendaId}` : "-";
  $historicoVendas("#detalheVendaData").textContent = formatarDataHoraSemVirgula(detalhe?.dataVenda);
  $historicoVendas("#detalheVendaStatus").innerHTML = `
    <span class="sales-status-badge ${window.vstockSales.statusClass(status)}">
      ${window.vstockSales.formatStatus(status)}
    </span>
  `;
  $historicoVendas("#detalheVendaCliente").textContent = detalhe?.clienteNome || "Venda sem cliente identificado";
  $historicoVendas("#detalheVendaPagamento").textContent = detalhe?.formaPagamentoNome || "-";
  $historicoVendas("#detalheVendaVendedor").textContent = detalhe?.vendedorNome || "-";
  $historicoVendas("#detalheVendaTipo").innerHTML = badgeTipoVenda(detalhe);
  $historicoVendas("#detalheVendaSubtotal").textContent = window.vstockCurrency.formatMoney(detalhe?.valorSubtotal);
  $historicoVendas("#detalheVendaDesconto").textContent = window.vstockCurrency.formatMoney(detalhe?.valorDesconto);
  $historicoVendas("#detalheVendaTotal").textContent = window.vstockCurrency.formatMoney(detalhe?.valorTotal);
  $historicoVendas("#detalheVendaRecebido").textContent = detalhe?.valorRecebido == null ? "-" : window.vstockCurrency.formatMoney(detalhe.valorRecebido);
  $historicoVendas("#detalheVendaTroco").textContent = detalhe?.troco == null ? "-" : window.vstockCurrency.formatMoney(detalhe.troco);
  $historicoVendas("#detalheVendaValorBruto").textContent = window.vstockCurrency.formatMoney(valorBruto);
  $historicoVendas("#detalheVendaValorTaxa").textContent = window.vstockCurrency.formatMoney(valorTaxa);
  $historicoVendas("#detalheVendaValorLiquido").textContent = window.vstockCurrency.formatMoney(valorLiquidoReceber);
  $historicoVendas("#detalheVendaTaxaBloco").classList.toggle("d-none", valorTaxa <= 0);
  $historicoVendas("#detalheVendaObservacao").textContent = observacaoValida || "";
  $historicoVendas("#detalheVendaObservacaoBloco").classList.toggle("d-none", !observacaoValida);
  $historicoVendas("#detalheVendaTroco").closest(".sales-detail-summary-row")?.classList.toggle("is-positive", troco > 0);
  $historicoVendas("#detalheVendaDataCancelamento").textContent = detalhe?.dataCancelamento ? formatarDataHoraSemVirgula(detalhe.dataCancelamento) : "-";
  $historicoVendas("#detalheVendaAdminCancelamento").textContent = detalhe?.adminCancelamentoEmail || "-";
  $historicoVendas("#detalheVendaMotivoCancelamento").textContent = motivoCancelamento || "-";
  $historicoVendas("#detalheVendaCancelamentoBloco").classList.toggle("d-none", !vendaCancelada);

  $historicoVendas("#detalheVendaItensBody").innerHTML = itens.map((item) => `
    <tr>
      <td>${item.produtoNome || "Produto"}</td>
      <td>${window.vstockFormatters.integer(item.quantidade)}</td>
      <td class="text-end">${window.vstockCurrency.formatMoney(item.valorUnitario)}</td>
      <td class="text-end fw-semibold">${window.vstockCurrency.formatMoney(item.valorSubtotal)}</td>
    </tr>
  `).join("");

  const blocoPagamentos = $historicoVendas("#detalheVendaPagamentosDivididosBloco");
  const corpoPagamentos = $historicoVendas("#detalheVendaPagamentosDivididosBody");
  blocoPagamentos?.classList.toggle("d-none", !detalhe?.vendaDividida || !pagamentos.length);
  if (corpoPagamentos) {
    corpoPagamentos.innerHTML = pagamentos.map((pagamento, indice) => `
      <tr>
        <td>${pagamento.ordemPagamento || indice + 1}</td>
        <td>${pagamento.formaPagamentoNome || "-"}</td>
        <td class="text-end">${window.vstockCurrency.formatMoney(pagamento.valor)}</td>
        <td class="text-end">${window.vstockCurrency.formatMoney(Math.max(Number(pagamento.valor || 0) - Number(pagamento.valorLiquidoReceber || 0), 0))}</td>
        <td class="text-end fw-semibold">${window.vstockCurrency.formatMoney(pagamento.valorLiquidoReceber)}</td>
      </tr>
    `).join("");
  }
}

async function abrirDetalheVenda(vendaId) {
  try {
    const response = await fetch(API_HISTORICO_VENDAS.DETALHE(vendaId));
    if (!response.ok) {
      throw new Error("Falha ao carregar o detalhe da venda.");
    }

    const detalhe = await response.json();
    preencherModalDetalheVenda(detalhe);
    modalDetalheVenda?.show();
  } catch (erro) {
    console.error(erro);
    msgHistoricoVendas("Não foi possível carregar os detalhes da venda.", "danger");
  }
}

async function aprovarCancelamentoVenda() {
  if (!vendaCancelamentoAtualId || cancelamentoBloqueadoPrazo) {
    return;
  }

  const email = $historicoVendas("#cancelamentoAdminEmail")?.value?.trim() || "";
  const senha = $historicoVendas("#cancelamentoAdminSenha")?.value || "";
  const motivo = $historicoVendas("#cancelamentoMotivo")?.value?.trim() || "";

  if (!motivo) {
    msgModalCancelarVenda("Informe o motivo do cancelamento.", "danger");
    return;
  }

  try {
    const response = await fetch(API_HISTORICO_VENDAS.APROVAR_CANCELAMENTO(vendaCancelamentoAtualId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha, motivo })
    });

    if (!response.ok) {
      const erro = await response.text();
      throw new Error(erro || "Falha ao validar administrador.");
    }

    const resultado = await response.json();
    aprovacaoAdminCancelamento = {
      email,
      senha,
      motivo,
      aprovadorEmail: resultado?.email || email
    };

    $historicoVendas("#cancelamentoAdminAprovador").textContent = aprovacaoAdminCancelamento.aprovadorEmail;
    $historicoVendas("#cancelamentoVendaEtapaAprovacao").classList.add("d-none");
    $historicoVendas("#cancelamentoVendaEtapaConfirmacao").classList.remove("d-none");
    $historicoVendas("#btnAprovarCancelamentoVenda").classList.add("d-none");
    $historicoVendas("#btnConfirmarCancelamentoVenda").classList.remove("d-none");
  } catch (erro) {
    console.error(erro);
    msgModalCancelarVenda(erro.message || "Não foi possível validar o administrador.", "danger");
  }
}

async function confirmarCancelamentoVenda() {
  if (!vendaCancelamentoAtualId || !aprovacaoAdminCancelamento || cancelamentoBloqueadoPrazo) {
    return;
  }

  try {
    const response = await fetch(API_HISTORICO_VENDAS.CANCELAR(vendaCancelamentoAtualId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: aprovacaoAdminCancelamento.email,
        senha: aprovacaoAdminCancelamento.senha,
        motivo: aprovacaoAdminCancelamento.motivo
      })
    });

    if (!response.ok) {
      const erro = await response.text();
      throw new Error(erro || "Falha ao cancelar a venda.");
    }

    modalCancelarVenda?.hide();
    msgHistoricoVendas("Venda cancelada com sucesso.", "success");
    await carregarHistoricoVendas(paginaAtualHistoricoVendas);
  } catch (erro) {
    console.error(erro);
    msgModalCancelarVenda(erro.message || "Não foi possível cancelar a venda.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  modalDetalheVenda = new bootstrap.Modal(document.getElementById("modalDetalheVenda"));
  modalCancelarVenda = new bootstrap.Modal(document.getElementById("modalCancelarVenda"));

  await carregarLimiteHorasCancelamento();
  await carregarFormasPagamentoHistorico();
  await carregarHistoricoVendas(1);

  $historicoVendas("#btnFiltrarHistoricoVendas")?.addEventListener("click", () => carregarHistoricoVendas(1));
  $historicoVendas("#btnLimparHistoricoVendas")?.addEventListener("click", async () => {
    limparFiltrosHistoricoVendas();
    await carregarHistoricoVendas(1);
  });

  $historicoVendas("#tabelaHistoricoVendasBody")?.addEventListener("click", async (event) => {
    const botao = event.target.closest("button[data-acao]");
    if (!botao) return;
    if (botao.disabled || botao.getAttribute("aria-disabled") === "true") return;

    const acao = botao.dataset.acao || "";
    const vendaId = Number(botao.dataset.vendaId || 0);
    if (!vendaId) return;

    if (acao === "ver") {
      await abrirDetalheVenda(vendaId);
      return;
    }

    if (acao === "reimprimir") {
      msgHistoricoVendas("A reimpressão ainda não está disponível neste momento.", "info");
      return;
    }

    if (acao === "cancelar") {
      abrirModalCancelarVenda(vendaId);
    }
  });

  document.getElementById("modalCancelarVenda")?.addEventListener("hidden.bs.modal", resetarModalCancelarVenda);
  $historicoVendas("#btnAprovarCancelamentoVenda")?.addEventListener("click", aprovarCancelamentoVenda);
  $historicoVendas("#btnConfirmarCancelamentoVenda")?.addEventListener("click", confirmarCancelamentoVenda);
});
