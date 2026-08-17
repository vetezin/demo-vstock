const API_DASHBOARD = {
  PRODUTOS: "http://localhost:8080/api/produtos/lista?ativosOnly=true",
  ESTOQUE: "http://localhost:8080/api/estoque/consulta",
  HISTORICO: "http://localhost:8080/api/historico-movimentacoes"
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.body.classList.contains("dashboard-page")) {
    return;
  }

  try {
    const [produtos, estoque, historico] = await Promise.all([
      fetchJson(API_DASHBOARD.PRODUTOS),
      fetchJson(API_DASHBOARD.ESTOQUE),
      fetchJson(API_DASHBOARD.HISTORICO)
    ]);

    const produtosLista = Array.isArray(produtos) ? produtos : [];
    const estoqueLista = Array.isArray(estoque) ? estoque : [];
    const historicoLista = Array.isArray(historico) ? historico : [];

    renderizarKpis(produtosLista, estoqueLista, historicoLista);
    renderizarAlertas(estoqueLista);
    renderizarGraficoCategorias(estoqueLista);
    renderizarGraficoVendasSemana(historicoLista);
    renderizarMovimentacoesRecentes(historicoLista);
  } catch (erro) {
    console.error("Erro ao carregar dados do dashboard:", erro);
    renderizarEstadoFallback();
  }
});

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  }
  return response.json();
}

function renderizarKpis(produtos, estoque, historico) {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const mesPassadoInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  const produtosCadastrados = produtos.length;
  const produtosMesAtual = produtos.filter((item) => {
    const data = parseDate(item?.dataCadastro);
    return data && data >= inicioMes && data < proximoMes;
  }).length;

  const itensEmEstoque = estoque.reduce((acc, item) => acc + numero(item?.saldo_atual), 0);
  const baixoEstoque = estoque.filter((item) => {
    const saldo = numero(item?.saldo_atual);
    const minimo = numero(item?.qtd_min);
    return saldo > 0 && minimo > 0 && saldo <= minimo;
  }).length;
  const vencidos = estoque.filter((item) => {
    const validade = parseDate(item?.proxima_validade);
    return validade && validade < inicioHoje;
  }).length;

  const vendas = historico.filter((item) => String(item?.tipo || "").toUpperCase() === "VENDA");
  const vendasHoje = vendas.filter((item) => {
    const data = parseDate(item?.dataMovimentacao);
    return data && data.getTime() === inicioHoje.getTime();
  });
  const vendasMesAtual = vendas.filter((item) => {
    const data = parseDate(item?.dataMovimentacao);
    return data && data >= inicioMes && data < proximoMes;
  });
  const vendasMesAnterior = vendas.filter((item) => {
    const data = parseDate(item?.dataMovimentacao);
    return data && data >= mesPassadoInicio && data < inicioMes;
  });

  const faturamentoMes = vendasMesAtual.reduce((acc, item) => acc + numero(item?.valorTotal), 0);
  const faturamentoMesAnterior = vendasMesAnterior.reduce((acc, item) => acc + numero(item?.valorTotal), 0);
  const variacaoFaturamento = faturamentoMesAnterior > 0
    ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
    : null;

  setText("kpiProdutosCadastrados", window.vstockFormatters.integer(produtosCadastrados));
  setHtml("kpiProdutosCadastradosObs", `<i class="bi bi-arrow-up-right"></i> +${produtosMesAtual} este mês`);

  setText("kpiItensEstoque", window.vstockFormatters.integer(itensEmEstoque));
  setHtml("kpiItensEstoqueObs", `<i class="bi bi-boxes"></i> ${window.vstockFormatters.integer(estoque.length)} produtos com saldo`);

  setText("kpiBaixoEstoque", window.vstockFormatters.integer(baixoEstoque));
  setHtml("kpiBaixoEstoqueObs", `<i class="bi bi-exclamation-triangle"></i> ${window.vstockFormatters.integer(baixoEstoque)} itens em atenção`);

  setText("kpiVencidos", window.vstockFormatters.integer(vencidos));
  setHtml("kpiVencidosObs", `<i class="bi bi-clock-history"></i> ${window.vstockFormatters.integer(vencidos)} produtos vencidos`);

  setText("kpiVendasHoje", window.vstockFormatters.integer(vendasHoje.length));
  setHtml("kpiVendasHojeObs", `<i class="bi bi-arrow-up-right"></i> ${window.vstockCurrency.formatMoney(somarValores(vendasHoje, "valorTotal"))} hoje`);

  setText("kpiFaturamentoMes", window.vstockCurrency.formatMoney(faturamentoMes));
  setHtml(
    "kpiFaturamentoMesObs",
    variacaoFaturamento === null
      ? `<i class="bi bi-arrow-up-right"></i> Sem base no mês anterior`
      : `<i class="bi bi-arrow-up-right"></i> ${formatPercent(variacaoFaturamento)} vs. mês anterior`
  );
}

function renderizarGraficoCategorias(estoque) {
  const totaisPorCategoria = new Map();

  estoque.forEach((item) => {
    const categoria = String(item?.categoria || "Sem categoria").trim() || "Sem categoria";
    const saldo = numero(item?.saldo_atual);
    totaisPorCategoria.set(categoria, (totaisPorCategoria.get(categoria) || 0) + saldo);
  });

  const categorias = Array.from(totaisPorCategoria.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maiorValor = categorias.length ? categorias[0][1] : 0;

  for (let i = 0; i < 5; i += 1) {
    const item = categorias[i];
    const label = item ? item[0] : "-";
    const valor = item ? item[1] : 0;
    const percentual = maiorValor > 0 ? Math.max(8, Math.round((valor / maiorValor) * 100)) : 0;

    setText(`categoriaLabel${i}`, label);
    setText(`categoriaValor${i}`, window.vstockFormatters.integer(valor));

    const bar = document.getElementById(`categoriaBar${i}`);
    if (bar) {
      bar.style.width = `${percentual}%`;
    }
  }
}

function renderizarAlertas(estoque) {
  const card = document.getElementById("avisoAlertasDashboard");
  const badge = document.getElementById("badgeAlertasDashboard");
  const titulo = document.getElementById("textoAlertasDashboard");
  const lista = document.getElementById("dashboardAlertList");

  if (!card || !badge || !lista || typeof window.calcularStatusEstoque !== "function") {
    return;
  }

  const alertas = (estoque || [])
    .map((item) => ({
      item,
      status: window.calcularStatusEstoque(item)
    }))
    .filter((registro) => registro.status.chave !== "EM_ESTOQUE")
    .sort((a, b) => prioridadeStatus(a.status.chave) - prioridadeStatus(b.status.chave));

  if (!alertas.length) {
    card.classList.add("d-none");
    return;
  }

  badge.textContent = `${window.vstockFormatters.integer(alertas.length)} itens`;

  if (titulo) {
    titulo.textContent = `Existem ${window.vstockFormatters.integer(alertas.length)} produtos em atenção no estoque.`;
  }

  lista.innerHTML = alertas.slice(0, 2).map(({ item, status }) => {
    const descricao = montarDescricaoAlerta(item, status);
    return `
      <a class="alert-item" href="alertas.html">
        <span class="alert-item-icon"><i class="bi ${iconeStatus(status.chave)}"></i></span>
        <div>
          <strong>${escapeHtml(status.label)}</strong>
          <p>${escapeHtml(descricao)}</p>
        </div>
      </a>
    `;
  }).join("");

  card.classList.remove("d-none");
}

function renderizarGraficoVendasSemana(historico) {
  const vendas = historico.filter((item) => String(item?.tipo || "").toUpperCase() === "VENDA");
  const hoje = new Date();
  const dias = [];
  const totais = [];

  for (let i = 6; i >= 0; i -= 1) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
    dias.push(data);
    totais.push(0);
  }

  vendas.forEach((item) => {
    const data = parseDate(item?.dataMovimentacao);
    if (!data) {
      return;
    }

    const indice = dias.findIndex((dia) => dia.getTime() === data.getTime());
    if (indice >= 0) {
      totais[indice] += numero(item?.valorTotal);
    }
  });

  dias.forEach((dia, indice) => {
    setText(`salesChartLabel${indice}`, dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""));
  });

  const path = gerarPathLinha(totais, 600, 220, 20);
  const fill = `${path} L600,260 L0,260 Z`;

  const linePath = document.getElementById("salesChartLinePath");
  const fillPath = document.getElementById("salesChartAreaFill");
  if (linePath) {
    linePath.setAttribute("d", path);
  }
  if (fillPath) {
    fillPath.setAttribute("d", fill);
  }
}

function renderizarMovimentacoesRecentes(historico) {
  const lista = document.getElementById("dashboardMovementsList");
  if (!lista) {
    return;
  }

  const itens = historico.slice(0, 4);
  if (!itens.length) {
    lista.innerHTML = `
      <div class="movement-item">
        <div class="movement-copy">
          <strong>Sem movimentações recentes</strong>
          <small>Assim que houver entradas, saídas ou vendas elas aparecerão aqui.</small>
        </div>
      </div>
    `;
    return;
  }

  lista.innerHTML = itens.map((item) => {
    const tipo = String(item?.tipo || "").toUpperCase();
    const classe = tipo === "ENTRADA" ? "entrada" : (tipo === "VENDA" ? "venda" : "saida");
    const valorSinal = tipo === "ENTRADA" ? "+" : "-";
    const detalhe = obterDetalheMovimentacao(item);

    return `
      <div class="movement-item">
        <span class="movement-badge ${classe}">${escapeHtml(formatTipo(tipo))}</span>
        <div class="movement-copy">
          <strong>${escapeHtml(item?.produto || "Produto")}</strong>
          <small>${escapeHtml(detalhe)}</small>
        </div>
        <span class="movement-value ${tipo === "ENTRADA" ? "positive" : "negative"}">${valorSinal}${window.vstockFormatters.integer(numero(item?.quantidade))} un</span>
      </div>
    `;
  }).join("");
}

function montarDescricaoAlerta(item, status) {
  const nome = item?.prod_descr || "Produto";
  const saldo = numero(item?.saldo_atual);
  const minimo = numero(item?.qtd_min);
  const validade = parseDate(item?.proxima_validade);

  if (status.chave === "VENCIDO") {
    return `${nome} venceu em ${window.vstockFormatters.date(validade)} e requer conferência imediata.`;
  }

  if (status.chave === "VENCENDO") {
    return `${nome} vence em ${window.vstockFormatters.date(validade)} e precisa de prioridade no giro.`;
  }

  if (status.chave === "SEM_ESTOQUE") {
    return `${nome} está sem saldo disponível no estoque.`;
  }

  return `${nome} está com ${window.vstockFormatters.integer(saldo)} unidades para mínimo de ${window.vstockFormatters.integer(minimo)}.`;
}

function prioridadeStatus(chave) {
  switch (chave) {
    case "VENCIDO":
      return 0;
    case "VENCENDO":
      return 1;
    case "SEM_ESTOQUE":
      return 2;
    case "BAIXO_ESTOQUE":
      return 3;
    default:
      return 4;
  }
}

function iconeStatus(chave) {
  switch (chave) {
    case "VENCIDO":
      return "bi-calendar-x";
    case "VENCENDO":
      return "bi-clock-history";
    case "SEM_ESTOQUE":
      return "bi-box-seam";
    default:
      return "bi-exclamation-triangle";
  }
}

function obterDetalheMovimentacao(item) {
  const tipo = String(item?.tipo || "").toUpperCase();
  if (tipo === "ENTRADA") {
    return item?.fornecedor && item.fornecedor !== "-" ? `Fornecedor: ${item.fornecedor}` : "Entrada registrada no estoque";
  }
  if (tipo === "VENDA") {
    return item?.cliente && item.cliente !== "-" ? `Cliente: ${item.cliente}` : "Venda sem cliente identificado";
  }
  return item?.motivo && item.motivo !== "-" ? item.motivo : "Saída registrada no estoque";
}

function gerarPathLinha(valores, width, height, padding) {
  if (!valores.length) {
    return `M0,${height}`;
  }

  const maior = Math.max(...valores, 1);
  const passoX = valores.length > 1 ? width / (valores.length - 1) : width;

  return valores.map((valor, indice) => {
    const x = Number((indice * passoX).toFixed(2));
    const y = Number((height - ((valor / maior) * (height - padding * 2) + padding)).toFixed(2));
    return `${indice === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
}

function somarValores(lista, campo) {
  return lista.reduce((acc, item) => acc + numero(item?.[campo]), 0);
}

function parseDate(valor) {
  if (!valor) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function numero(valor) {
  const parsed = Number(valor || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(valor) {
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1)}%`;
}

function formatTipo(tipo) {
  if (tipo === "VENDA") {
    return "Venda";
  }
  if (tipo === "ENTRADA") {
    return "Entrada";
  }
  return "Saída";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = value;
  }
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderizarEstadoFallback() {
  setText("kpiProdutosCadastrados", "--");
  setText("kpiItensEstoque", "--");
  setText("kpiBaixoEstoque", "--");
  setText("kpiVencidos", "--");
  setText("kpiVendasHoje", "--");
  setText("kpiFaturamentoMes", "--");
  const card = document.getElementById("avisoAlertasDashboard");
  if (card) {
    card.classList.add("d-none");
  }
}

