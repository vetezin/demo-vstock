const API_HISTORICO = {
  LISTA: "http://localhost:8080/api/historico-movimentacoes"
};

const $historico = (sel) => document.querySelector(sel);

let todasMovimentacoes = [];
let cardsMovimentacao = [];
let movimentacoesPaginadas = [];
let paginaAtualHistorico = 1;
let totalPaginasHistorico = 1;
let totalMovimentacoes = 0;
const ITENS_POR_PAGINA_HISTORICO = 10;

function msgHistorico(texto, tipo = "danger") {
  const box = $historico("#mensagens");
  if (!box) return;

  const div = document.createElement("div");
  div.className = `alert alert-${tipo} alert-dismissible fade show`;
  div.role = "alert";
  div.innerHTML = `
    ${texto}
    <button class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
  `;

  box.innerHTML = "";
  box.appendChild(div);
  window.destacarMensagens?.(box);
}

function fmtData(valor) {
  if (!valor) return "-";
  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

function fmtValor(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function fmtSaldo(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "-";
  const quantidade = Number(valor || 0);
  return `${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}`;
}

function fmtQuantidade(valor) {
  const quantidade = Number(valor || 0);
  return `${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}`;
}

function fmtMotivo(valor) {
  const mapa = {
    USO_INTERNO: "Uso interno",
    PERDA: "Perda",
    AVARIA: "Avaria",
    VENDA: "Venda"
  };
  return mapa[String(valor || "").toUpperCase()] || valor || "-";
}

function fmtFormaPagamento(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "-";
  return texto.replace(/^forma\s+de\s+pagamento\s*:\s*/i, "").trim() || "-";
}

function toNumber(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function montarQuery() {
  const params = new URLSearchParams();

  const dataInicio = $historico("#filtroDataInicio")?.value || "";
  const dataFim = $historico("#filtroDataFim")?.value || "";
  const tipo = $historico("#filtroTipo")?.value || "";
  const produto = $historico("#filtroProduto")?.value?.trim() || "";
  const funcionario = $historico("#filtroFuncionario")?.value?.trim() || "";

  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);
  if (tipo) params.set("tipo", tipo);
  if (produto) params.set("produto", produto);
  if (funcionario) params.set("funcionario", funcionario);

  return params.toString();
}

function blocosComplementares(item, isEntrada, isVenda) {
  const blocos = [];

  if (isEntrada) {
    blocos.push({
      icon: "bi-truck",
      label: "Fornecedor",
      value: item.fornecedor || "-"
    });
    blocos.push({
      icon: "bi-receipt",
      label: "Observação",
      value: item.observacao || "-"
    });
  } else if (isVenda) {
    blocos.push({
      icon: "bi-person-vcard",
      label: "Cliente",
      value: item.cliente || "Venda sem cliente identificado"
    });
    blocos.push({
      icon: "bi-credit-card",
      label: "Forma de Pagamento",
      value: fmtFormaPagamento(item.observacao)
    });
  } else {
    blocos.push({
      icon: "bi-tag",
      label: "Motivo",
      value: fmtMotivo(item.motivo)
    });
    blocos.push({
      icon: "bi-chat-left-text",
      label: "Observação",
      value: item.observacao || "-"
    });
  }

  blocos.push({
    icon: "bi-person",
    label: "Funcionário",
    value: item.funcionario || "-"
  });

  return blocos.map((bloco) => `
    <div class="timeline-info-bloco">
      <i class="bi ${bloco.icon}"></i>
      <div>
        <small>${bloco.label}</small>
        <strong>${bloco.value}</strong>
      </div>
    </div>
  `).join("");
}

function agruparMovimentacoes(lista) {
  const grupos = new Map();

  lista.forEach((item, index) => {
    const possuiId = item.idMovimentacao !== null && item.idMovimentacao !== undefined;
    const chave = possuiId
      ? `${item.tipo}-${item.idMovimentacao}`
      : `${item.tipo}-${item.dataMovimentacao}-${item.produto}-${index}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        idMovimentacao: item.idMovimentacao ?? null,
        tipo: item.tipo,
        dataMovimentacao: item.dataMovimentacao,
        funcionario: item.funcionario,
        cliente: item.cliente,
        fornecedor: item.fornecedor,
        motivo: item.motivo,
        observacao: item.observacao,
        saldoAntes: item.saldoAntes ?? null,
        saldoAtual: item.saldoAtual ?? null,
        saldoDepois: item.saldoDepois ?? null,
        quantidadeTotal: 0,
        valorTotalGeral: 0,
        itens: []
      });
    }

    const grupo = grupos.get(chave);
    grupo.quantidadeTotal += toNumber(item.quantidade);
    grupo.valorTotalGeral += toNumber(item.valorTotal);
    grupo.itens.push({
      produto: item.produto,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
      motivo: item.motivo,
      observacao: item.observacao,
      saldoAntes: item.saldoAntes ?? null,
      saldoDepois: item.saldoDepois ?? item.saldoAtual ?? null
    });
  });

  return Array.from(grupos.values());
}

function renderizarResumoHistorico(lista) {
  const container = $historico("#resumoHistorico");
  if (!container) return;

  const totalGeral = lista.reduce((acc, item) => acc + toNumber(item.valorTotalGeral), 0);
  const quantidadeTotal = lista.reduce((acc, item) => acc + toNumber(item.quantidadeTotal), 0);

  container.innerHTML = `
    <div class="historico-resumo-card">
      <div>
        <small>Total de movimentações agrupadas</small>
        <strong>${lista.length}</strong>
      </div>
      <div>
        <small>Quantidade total de itens</small>
        <strong>${fmtQuantidade(quantidadeTotal)}</strong>
      </div>
      <div>
        <small>Total geral movimentado</small>
        <strong>${fmtValor(totalGeral)}</strong>
      </div>
    </div>
  `;
}

function renderizarItensDoGrupo(grupo) {
  if (grupo.tipo === "VENDA") {
    const linhas = grupo.itens.map((item) => `
      <div class="timeline-produto-tabela-linha">
        <div class="timeline-produto-coluna-produto">${item.produto || "-"}</div>
        <div class="timeline-produto-coluna-qtd">${fmtQuantidade(item.quantidade)}</div>
        <div class="timeline-produto-coluna-valor">${fmtValor(item.valorUnitario)}</div>
        <div class="timeline-produto-coluna-total">${fmtValor(item.valorTotal)}</div>
      </div>
    `).join("");

    return `
      <div class="timeline-produto-tabela">
        <div class="timeline-produto-tabela-cabecalho">
          <div class="timeline-produto-coluna-produto">Produto</div>
          <div class="timeline-produto-coluna-qtd">Qtd.</div>
          <div class="timeline-produto-coluna-valor">Valor unitário</div>
          <div class="timeline-produto-coluna-total">Total</div>
        </div>
        ${linhas}
        <div class="timeline-produto-tabela-total">
          <strong>TOTAL</strong>
          <strong class="timeline-produto-tabela-total-qtd">${fmtQuantidade(grupo.quantidadeTotal)}</strong>
          <span></span>
          <strong>${fmtValor(grupo.valorTotalGeral)}</strong>
        </div>
      </div>
    `;
  }

  return grupo.itens.map((item) => {
    return `
      <div class="timeline-produto-item">
        <div class="timeline-produto-item-topo">
          <strong>${item.produto || "-"}</strong>
        </div>
        <div class="timeline-produto-item-grid ${grupo.tipo === "ENTRADA" ? "entrada" : ""}">
          <div>
            <small>Quantidade</small>
            <strong>${fmtQuantidade(item.quantidade)}</strong>
          </div>
          <div>
            <small>Valor unitário</small>
            <strong>${fmtValor(item.valorUnitario)}</strong>
          </div>
          <div>
            <small>Total do item</small>
            <strong>${fmtValor(item.valorTotal)}</strong>
          </div>
          ${grupo.tipo === "ENTRADA" ? `
          <div>
            <small>Estoque antes</small>
            <strong>${fmtSaldo(item.saldoAntes)}</strong>
          </div>
          <div>
            <small>Estoque depois</small>
            <strong>${fmtSaldo(item.saldoDepois)}</strong>
          </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderizarHistorico(lista) {
  const container = $historico("#timelineHistorico");
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="timeline-vazio">Nenhuma movimentação encontrada para os filtros informados.</div>`;
    return;
  }

  container.innerHTML = lista.map((grupo) => {
    const isEntrada = grupo.tipo === "ENTRADA";
    const isVenda = grupo.tipo === "VENDA";
    const classe = isEntrada ? "entrada" : (isVenda ? "venda" : "saida");
    const badge = isEntrada ? "badge-entrada" : (isVenda ? "badge-venda" : "badge-saida");
    const icone = isEntrada ? "bi-arrow-down-left-circle" : (isVenda ? "bi-cart-check" : "bi-arrow-up-right-circle");
    const identificador = grupo.idMovimentacao ? `#${grupo.idMovimentacao}` : "Sem identificador";
    const topoApoio = grupo.itens.length === 1
      ? "1 item"
      : `${grupo.itens.length} itens`;

    return `
      <article class="timeline-item ${classe}">
        <div class="timeline-icone">
          <i class="bi ${icone}"></i>
        </div>

        <div class="timeline-card">
          <div class="timeline-topo">
            <div class="timeline-topo-principal">
              <div class="timeline-titulo">${grupo.tipo || "-"} ${identificador}</div>
              <span class="badge-tipo ${badge}">${grupo.tipo || "-"}</span>
              <div class="timeline-topo-meta">
                <span><i class="bi bi-calendar3"></i> ${fmtData(grupo.dataMovimentacao)}</span>
              </div>
            </div>
            <div class="timeline-topo-apoio">${topoApoio}</div>
          </div>

          <div class="timeline-grid">
            <div class="timeline-meta-bloco timeline-meta-bloco-destaque">
              <small>Quantidade total</small>
              <strong>${fmtQuantidade(grupo.quantidadeTotal)}</strong>
            </div>
            <div class="timeline-meta-bloco timeline-meta-bloco-valor">
              <small>Total geral</small>
              <strong>${fmtValor(grupo.valorTotalGeral)}</strong>
            </div>
          </div>

          <div class="timeline-info-grid timeline-detalhes">
            ${blocosComplementares(grupo, isEntrada, isVenda)}
          </div>

          <div class="timeline-produtos">
            <div class="timeline-produtos-titulo">Itens da movimentação</div>
            <div class="timeline-produtos-lista">
              ${renderizarItensDoGrupo(grupo)}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function atualizarPaginacaoHistorico(pagina = 1) {
  const paginacao = window.vstockPagination.paginate(cardsMovimentacao, pagina, ITENS_POR_PAGINA_HISTORICO);
  totalMovimentacoes = paginacao.totalItems;
  totalPaginasHistorico = paginacao.totalPages;
  paginaAtualHistorico = paginacao.page;
  movimentacoesPaginadas = paginacao.items;
  renderizarHistorico(movimentacoesPaginadas);
  renderizarControlesPaginacaoHistorico();
}

function renderizarControlesPaginacaoHistorico() {
  window.vstockPagination.render({
    container: "#paginacaoHistorico",
    variant: "listagem",
    itemLabel: "movimentações",
    page: paginaAtualHistorico,
    pageSize: ITENS_POR_PAGINA_HISTORICO,
    totalItems: totalMovimentacoes,
    idPrefix: "Historico",
    onPageChange: (novaPagina) => {
      atualizarPaginacaoHistorico(novaPagina);
    }
  });
}

async function carregarHistorico(pagina = 1) {
  const query = montarQuery();
  const url = query ? `${API_HISTORICO.LISTA}?${query}` : API_HISTORICO.LISTA;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Falha ao carregar historico.");

    todasMovimentacoes = await resp.json();
    cardsMovimentacao = agruparMovimentacoes(todasMovimentacoes);
    renderizarResumoHistorico(cardsMovimentacao);
    atualizarPaginacaoHistorico(pagina);
  } catch (erro) {
    console.error(erro);
    cardsMovimentacao = [];
    renderizarResumoHistorico(cardsMovimentacao);
    msgHistorico("Não foi possível carregar o histórico de movimentações.", "danger");
  }
}

function limparFiltros() {
  $historico("#filtroDataInicio").value = "";
  $historico("#filtroDataFim").value = "";
  $historico("#filtroTipo").value = "";
  $historico("#filtroProduto").value = "";
  $historico("#filtroFuncionario").value = "";
}

function aplicarFiltrosDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const produto = params.get("produto");
  if (produto) {
    $historico("#filtroProduto").value = produto;
  }
}

function obterOpcoesProdutoHistorico() {
  return todasMovimentacoes.map((item) => item.produto);
}

document.addEventListener("DOMContentLoaded", async () => {
  aplicarFiltrosDaUrl();
  await carregarHistorico();

  window.vstockFilterDropdown.attach({
    input: "#filtroProduto",
    getOptions: obterOpcoesProdutoHistorico
  });

  $historico("#btnFiltrarHistorico")?.addEventListener("click", () => carregarHistorico(1));
  $historico("#btnLimparHistorico")?.addEventListener("click", async () => {
    limparFiltros();
    await carregarHistorico(1);
  });
});

