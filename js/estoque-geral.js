const API_ESTOQUE = {
  CONSULTA: "http://localhost:8080/api/estoque/consulta"
};

const $estoque = (sel) => document.querySelector(sel);
const ITENS_POR_PAGINA_ESTOQUE = 10;

let listaEstoque = [];
let paginaAtualEstoque = 1;
let totalItensEstoque = 0;
let totalPaginasEstoque = 1;

function msgEstoque(texto, tipo = "danger") {
  const box = $estoque("#mensagens");
  if (!box) return;

  box.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      ${texto}
      <button class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>
  `;
  window.destacarMensagens?.(box);
}

function fmtDataBr(valor) {
  if (!valor) return "-";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return valor;

  const apenasData = String(valor).split("T")[0];
  const partes = apenasData.split("-");
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo"
  }).format(data);
}

function badgeMovimentacao(tipo, data) {
  if (!tipo || tipo === "-") {
    return `<span class="movimentacao-badge sem"><i class="bi bi-dash-circle"></i> Sem movimentação</span>`;
  }

  const classe = tipo === "ENTRADA" ? "entrada" : "saida";
  const icone = tipo === "ENTRADA" ? "bi-box-arrow-in-down" : "bi-box-arrow-up";
  const texto = tipo === "ENTRADA" ? "Entrada" : "Saída";
  return `
    <div class="d-flex flex-column">
      <span class="movimentacao-badge ${classe}">
        <i class="bi ${icone}"></i> ${texto}
      </span>
      <small class="text-muted">${fmtDataBr(data)}</small>
    </div>
  `;
}

function aplicarFiltros() {
  const termo = ($estoque("#filtroProdutoEstoque")?.value || "").trim().toLowerCase();
  const categoria = ($estoque("#filtroCategoriaEstoque")?.value || "").trim().toLowerCase();
  const status = $estoque("#filtroStatusEstoque")?.value || "";
  const validadeAte = $estoque("#filtroValidadeEstoque")?.value || "";

  return listaEstoque.filter((item) => {
    const statusItem = window.calcularStatusEstoque(item);
    const matchTermo = !termo
      || String(item.prod_descr || "").toLowerCase().includes(termo);
    const matchCategoria = !categoria || String(item.categoria || "").toLowerCase().includes(categoria);
    const matchStatus = !status || statusItem.chave === status;
    const validadeItem = String(item.proxima_validade || "").split("T")[0];
    const matchValidade = !validadeAte || (!!validadeItem && validadeItem <= validadeAte);
    return matchTermo && matchCategoria && matchStatus && matchValidade;
  });
}

function atualizarKpis(lista) {
  const totalProdutos = lista.length;
  const totalUnidades = lista.reduce((acc, item) => acc + Number(item.saldo_atual || 0), 0);
  const baixoEstoque = lista.filter((item) => window.calcularStatusEstoque(item).chave === "BAIXO_ESTOQUE").length;
  const vencimento = lista.filter((item) => {
    const chave = window.calcularStatusEstoque(item).chave;
    return chave === "VENCENDO" || chave === "VENCIDO";
  }).length;

  $estoque("#kpiProdutos").textContent = totalProdutos;
  $estoque("#kpiUnidades").textContent = totalUnidades;
  $estoque("#kpiBaixoEstoque").textContent = baixoEstoque;
  $estoque("#kpiVencimento").textContent = vencimento;
}

function atualizarPaginacaoEstoque(lista, pagina = 1) {
  const paginacao = window.vstockPagination.paginate(lista, pagina, ITENS_POR_PAGINA_ESTOQUE);
  totalItensEstoque = paginacao.totalItems;
  totalPaginasEstoque = paginacao.totalPages;
  paginaAtualEstoque = paginacao.page;
  return paginacao.items;
}

function renderizarPaginacaoEstoque() {
  window.vstockPagination.render({
    container: "#paginacaoEstoque",
    variant: "listagem",
    itemLabel: "itens",
    page: paginaAtualEstoque,
    pageSize: ITENS_POR_PAGINA_ESTOQUE,
    totalItems: totalItensEstoque,
    idPrefix: "Estoque",
    onPageChange: (novaPagina) => {
      renderizarTudo(novaPagina);
    }
  });
}

function renderizarTabela(lista) {
  const tbody = $estoque("#tabelaEstoque tbody");
  const vazio = $estoque("#estadoVazioEstoque");
  const paginacao = $estoque("#paginacaoEstoque");
  if (!tbody || !vazio) return;

  if (!lista.length) {
    tbody.innerHTML = "";
    vazio.classList.remove("d-none");
    if (paginacao) paginacao.innerHTML = "";
    return;
  }

  vazio.classList.add("d-none");
  tbody.innerHTML = lista.map((item) => {
    const status = window.calcularStatusEstoque(item);
    const linkHistorico = `historico.html?produto=${encodeURIComponent(item.prod_descr || "")}`;

    return `
      <tr>
        <td>
          <div class="produto-info">
            <strong>${item.prod_descr || "-"}</strong>
            <small>Cadastro: ${fmtDataBr(item.data_cadastro)} | Min.: ${Number(item.qtd_min || 0)}</small>
          </div>
        </td>
        <td>${item.categoria || "-"}</td>
        <td class="text-end fw-semibold">${Number(item.saldo_atual || 0)}</td>
        <td>${fmtDataBr(item.proxima_validade)}</td>
        <td>${badgeMovimentacao(item.tipo_ultima_movimentacao, item.ultima_movimentacao)}</td>
        <td><span class="status-badge-estoque ${status.classe}">${status.label}</span></td>
        <td class="text-center">
          <a class="btn btn-sm btn-outline-secondary" href="${linkHistorico}">
            <i class="bi bi-clock-history"></i> Movimentações
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

function renderizarTudo(pagina = 1) {
  const filtrada = aplicarFiltros();
  const paginaAtual = atualizarPaginacaoEstoque(filtrada, pagina);
  atualizarKpis(filtrada);
  renderizarTabela(paginaAtual);
  renderizarPaginacaoEstoque();
}

function limparFiltros() {
  $estoque("#filtroProdutoEstoque").value = "";
  $estoque("#filtroCategoriaEstoque").value = "";
  $estoque("#filtroStatusEstoque").value = "";
  $estoque("#filtroValidadeEstoque").value = "";
}

function obterOpcoesProdutoEstoque() {
  return listaEstoque.map((item) => item.prod_descr);
}

function obterOpcoesCategoriaEstoque() {
  return listaEstoque.map((item) => item.categoria);
}

async function carregarEstoque() {
  try {
    const resp = await fetch(API_ESTOQUE.CONSULTA);
    if (!resp.ok) throw new Error("Falha ao carregar estoque.");

    listaEstoque = await resp.json();
    renderizarTudo();
  } catch (erro) {
    console.error(erro);
    msgEstoque("Não foi possível carregar a consulta geral de estoque.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await carregarEstoque();

  window.vstockFilterDropdown.attach({
    input: "#filtroProdutoEstoque",
    getOptions: obterOpcoesProdutoEstoque,
    onInputValueChange: () => renderizarTudo(1),
    onOptionSelect: () => renderizarTudo(1)
  });
  window.vstockFilterDropdown.attach({
    input: "#filtroCategoriaEstoque",
    getOptions: obterOpcoesCategoriaEstoque,
    onInputValueChange: () => renderizarTudo(1),
    onOptionSelect: () => renderizarTudo(1)
  });

  $estoque("#btnFiltrarEstoque")?.addEventListener("click", () => renderizarTudo(1));
  $estoque("#btnLimparEstoque")?.addEventListener("click", async () => {
    limparFiltros();
    renderizarTudo(1);
  });
});


