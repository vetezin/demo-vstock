const API_HISTORICO = {
  LISTA: "http://localhost:8080/api/historico-movimentacoes"
};

const $historico = (sel) => document.querySelector(sel);

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

function renderizarHistorico(lista) {
  const container = $historico("#timelineHistorico");
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<div class="timeline-vazio">Nenhuma movimentação encontrada para os filtros informados.</div>`;
    return;
  }

  container.innerHTML = lista.map((item) => {
    const isEntrada = item.tipo === "ENTRADA";
    const classe = isEntrada ? "entrada" : "saida";
    const badge = isEntrada ? "badge-entrada" : "badge-saida";
    const fornecedor = item.fornecedor && item.fornecedor !== "-" ? item.fornecedor : "-";
    const saldoAntes = item.saldoAntes ?? 0;
    const saldoDepois = item.saldoDepois ?? item.saldoAtual ?? 0;
    const quantidadeMovimentada = Number(item.quantidade ?? 0);
    const valorUnitario = item.valorUnitario ?? null;
    const valorMovimentacao = item.valorTotal ?? null;
    const motivo = !isEntrada ? fmtMotivo(item.motivo) : null;

    return `
      <div class="timeline-item ${classe}">
        <div class="timeline-topo">
          <div class="timeline-titulo">${item.produto || "-"}</div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="badge-tipo ${badge}">${item.tipo || "-"}</span>
            <span class="text-muted fw-semibold">${fmtData(item.dataMovimentacao)}</span>
          </div>
        </div>

        <div class="timeline-meta">
          <div class="timeline-meta-bloco timeline-meta-bloco-destaque">
            <small>Quantidade Movimentada</small>
            <strong>${quantidadeMovimentada} ${quantidadeMovimentada === 1 ? "unidade" : "unidades"}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Saldo Antes</small>
            <strong>${fmtSaldo(saldoAntes)}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Saldo Após</small>
            <strong>${fmtSaldo(saldoDepois)}</strong>
          </div>
      
          <div class="timeline-meta-bloco">
            <small>Valor Unitário</small>
            <strong>${fmtValor(valorUnitario)}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Total</small>
            <strong>${fmtValor(valorMovimentacao)}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Fornecedor</small>
            <strong>${fornecedor}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Motivo</small>
            <strong>${motivo || "-"}</strong>
          </div>
          <div class="timeline-meta-bloco">
            <small>Funcionário</small>
            <strong>${item.funcionario || "-"}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function carregarHistorico() {
  const query = montarQuery();
  const url = query ? `${API_HISTORICO.LISTA}?${query}` : API_HISTORICO.LISTA;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Falha ao carregar historico.");

    const lista = await resp.json();
    renderizarHistorico(lista);
  } catch (erro) {
    console.error(erro);
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

document.addEventListener("DOMContentLoaded", async () => {
  aplicarFiltrosDaUrl();
  await carregarHistorico();

  $historico("#btnFiltrarHistorico")?.addEventListener("click", carregarHistorico);
  $historico("#btnLimparHistorico")?.addEventListener("click", async () => {
    limparFiltros();
    await carregarHistorico();
  });
});




