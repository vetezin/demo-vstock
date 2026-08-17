const API_ALERTAS = {
  CONSULTA: "http://localhost:8080/api/estoque/consulta"
};

const $alerta = (sel) => document.querySelector(sel);
let listaAlertas = [];
let alertasPaginados = [];
let paginaAtualAlertas = 1;
let totalAlertas = 0;
const ITENS_POR_PAGINA_ALERTAS = 10;

function renderizarPaginacaoAlertas() {
  window.vstockPagination.render({
    container: "#paginacaoAlertas",
    variant: "listagem",
    itemLabel: "alertas",
    page: paginaAtualAlertas,
    pageSize: ITENS_POR_PAGINA_ALERTAS,
    totalItems: totalAlertas,
    idPrefix: "Alertas",
    onPageChange: (novaPagina) => {
      atualizarPaginacaoAlertas(novaPagina);
    }
  });
}

function obterOpcoesProdutoAlerta() {
  return listaAlertas
    .filter((item) => window.calcularStatusEstoque(item).chave !== "EM_ESTOQUE")
    .map((item) => item.prod_descr);
}

function obterOpcoesCategoriaAlerta() {
  return listaAlertas
    .filter((item) => window.calcularStatusEstoque(item).chave !== "EM_ESTOQUE")
    .map((item) => item.categoria);
}

function aplicarFiltrosAlertas() {
  const produto = window.vstockText.normalize($alerta("#filtroProdutoAlerta")?.value);
  const categoria = window.vstockText.normalize($alerta("#filtroCategoriaAlerta")?.value);
  const status = $alerta("#filtroStatusAlerta")?.value || "";

  return listaAlertas.filter((item) => {
    const statusItem = window.calcularStatusEstoque(item);
    if (statusItem.chave === "EM_ESTOQUE") {
      return false;
    }

    const matchProduto = !produto || String(item.prod_descr || "").toLowerCase().includes(produto);
    const matchCategoria = !categoria || String(item.categoria || "").toLowerCase().includes(categoria);
    const matchStatus = !status || statusItem.chave === status;

    return matchProduto && matchCategoria && matchStatus;
  });
}

function limparFiltrosAlertas() {
  $alerta("#filtroProdutoAlerta").value = "";
  $alerta("#filtroCategoriaAlerta").value = "";
  $alerta("#filtroStatusAlerta").value = "";
}

function renderizarAlertas() {
  const tbody = $alerta("#tabelaAlertas tbody");
  const vazio = $alerta("#estadoVazioAlertas");
  const paginacao = $alerta("#paginacaoAlertas");
  if (!tbody || !vazio) return;

  $alerta("#qtdAlertasResumo").textContent = totalAlertas;

  if (!alertasPaginados.length && totalAlertas === 0) {
    tbody.innerHTML = "";
    vazio.classList.remove("d-none");
    if (paginacao) paginacao.innerHTML = "";
    return;
  }

  vazio.classList.add("d-none");
  tbody.innerHTML = alertasPaginados.map((item) => {
    const status = window.calcularStatusEstoque(item);
    return `
      <tr>
        <td>${item.prod_descr || "-"}</td>
        <td>${item.categoria || "-"}</td>
        <td class="text-end">${Number(item.saldo_atual || 0)}</td>
        <td>${window.vstockFormatters.date(item.proxima_validade)}</td>
        <td><span class="status-badge-estoque ${status.classe}">${status.label}</span></td>
        <td class="text-center">
          <a class="btn btn-sm btn-outline-secondary" href="historico.html?produto=${encodeURIComponent(item.prod_descr || "")}">
            <i class="bi bi-clock-history"></i> Movimentações
          </a>
        </td>
      </tr>
    `;
  }).join("");

  renderizarPaginacaoAlertas();
}

function atualizarPaginacaoAlertas(pagina = 1) {
  const listaFiltrada = aplicarFiltrosAlertas();
  const paginacao = window.vstockPagination.paginate(listaFiltrada, pagina, ITENS_POR_PAGINA_ALERTAS);
  totalAlertas = paginacao.totalItems;
  paginaAtualAlertas = paginacao.page;
  alertasPaginados = paginacao.items;
  renderizarAlertas();
}

async function carregarAlertas() {
  const resp = await fetch(API_ALERTAS.CONSULTA);
  if (!resp.ok) {
    throw new Error("Falha ao carregar alertas.");
  }

  listaAlertas = await resp.json();
  atualizarPaginacaoAlertas(1);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await carregarAlertas();
  } catch (erro) {
    console.error(erro);
  }

  $alerta("#btnFiltrarAlertas")?.addEventListener("click", () => atualizarPaginacaoAlertas(1));
  $alerta("#btnLimparAlertas")?.addEventListener("click", () => {
    limparFiltrosAlertas();
    atualizarPaginacaoAlertas(1);
  });
  $alerta("#filtroStatusAlerta")?.addEventListener("change", () => atualizarPaginacaoAlertas(1));
  window.vstockFilterDropdown.attach({
    input: "#filtroProdutoAlerta",
    getOptions: obterOpcoesProdutoAlerta,
    onInputValueChange: () => atualizarPaginacaoAlertas(1),
    onOptionSelect: () => atualizarPaginacaoAlertas(1)
  });
  window.vstockFilterDropdown.attach({
    input: "#filtroCategoriaAlerta",
    getOptions: obterOpcoesCategoriaAlerta,
    onInputValueChange: () => atualizarPaginacaoAlertas(1),
    onOptionSelect: () => atualizarPaginacaoAlertas(1)
  });
});


