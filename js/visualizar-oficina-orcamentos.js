const API_ORCAMENTOS = {
  LISTAR: "http://localhost:8080/api/oficina/orcamentos",
  DETALHE: (id) => `http://localhost:8080/api/oficina/orcamentos/${id}`,
  APROVAR: (id) => `http://localhost:8080/api/oficina/orcamentos/${id}/aprovar`,
  CANCELAR: (id) => `http://localhost:8080/api/oficina/orcamentos/${id}/cancelar`
};

const $orcamentos = (seletor) => document.querySelector(seletor);
const mensagemOrcamentos = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });
const ITENS_POR_PAGINA_ORCAMENTOS = 10;
let orcamentos = [];
let paginaAtual = 1;
let modalDetalhe;
let modalConfirmacaoStatus;
let orcamentoDetalheAtual;
let acaoStatusPendente;

const STATUS = {
  PENDENTE: { texto: "Pendente", classe: "pendente" },
  APROVADO: { texto: "Aprovado", classe: "aprovado" },
  CANCELADO: { texto: "Cancelado", classe: "cancelado" }
};

function escaparHtml(valor) {
  return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function statusInfo(status) {
  return STATUS[String(status || "").toUpperCase()] || { texto: "Não informado", classe: "cancelado" };
}

function badgeStatus(status) {
  const info = statusInfo(status);
  return `<span class="orcamento-status ${info.classe}">${info.texto}</span>`;
}

function formatarData(data) {
  return window.vstockFormatters.dateTime(data, { preserveInvalid: true, options: {} }) || "-";
}

function formatarDataCriacao(data) {
  return window.vstockFormatters.date(data, { preserveInvalid: true }) || "-";
}

function filtrarOrcamentos() {
  const busca = String($orcamentos("#filtroOrcamentoBusca").value || "").trim().toLocaleLowerCase("pt-BR");
  const status = $orcamentos("#filtroOrcamentoStatus").value;

  return orcamentos.filter((orcamento) => {
    const texto = `${orcamento.orcamentoId} ${orcamento.clienteNome || ""} ${orcamento.veiculoDescricao || ""}`.toLocaleLowerCase("pt-BR");
    return (!busca || texto.includes(busca)) && (!status || orcamento.status === status);
  });
}

function renderizarLista() {
  const filtrados = filtrarOrcamentos();
  const dados = window.vstockPagination.paginate(filtrados, paginaAtual, ITENS_POR_PAGINA_ORCAMENTOS);
  paginaAtual = dados.page;

  $orcamentos("#resumoOrcamentos").textContent = `${filtrados.length} ${filtrados.length === 1 ? "orçamento encontrado" : "orçamentos encontrados"}`;
  $orcamentos("#tabelaOrcamentosBody").innerHTML = dados.items.map((orcamento) => `
    <tr>
      <td><span class="orcamento-numero">ID #${orcamento.orcamentoId}</span></td>
      <td><span class="orcamento-data"><i class="bi bi-calendar3"></i>${formatarDataCriacao(orcamento.createdAt)}</span></td>
      <td><span class="orcamento-cliente">${escaparHtml(orcamento.clienteNome || "-")}</span><span class="orcamento-veiculo">${escaparHtml(orcamento.veiculoDescricao || "-")}</span></td>
      <td>${badgeStatus(orcamento.status)}</td>
      <td class="text-center"><button type="button" class="btn btn-sm btn-outline-primary" data-ver-orcamento="${orcamento.orcamentoId}"><i class="bi bi-eye"></i> Ver</button></td>
    </tr>
  `).join("");

  $orcamentos("#vazioOrcamentos").classList.toggle("d-none", filtrados.length > 0);
  window.vstockPagination.render({
    container: "#paginacaoOrcamentos",
    variant: "cadastro",
    itemLabel: "orçamentos",
    page: paginaAtual,
    pageSize: ITENS_POR_PAGINA_ORCAMENTOS,
    totalItems: filtrados.length,
    idPrefix: "Orcamento",
    onPageChange: (pagina) => { paginaAtual = pagina; renderizarLista(); }
  });
}

async function carregarOrcamentos() {
  try {
    const resposta = await fetch(API_ORCAMENTOS.LISTAR);
    if (!resposta.ok) throw new Error((await resposta.text()).trim() || "Não foi possível carregar os orçamentos.");
    orcamentos = await resposta.json();
    orcamentos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderizarLista();
  } catch (erro) {
    mensagemOrcamentos(erro.message || "Não foi possível carregar os orçamentos.", "danger");
  }
}

function preencherModal(orcamento) {
  orcamentoDetalheAtual = orcamento;
  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : [];
  const subtotal = itens.reduce((total, item) => total + Number(item.valor || 0), 0);

  $orcamentos("#detalheOrcamentoTitulo").textContent = `Orçamento #${orcamento.orcamentoId}`;
  $orcamentos("#detalheOrcamentoData").textContent = `Criado em ${formatarData(orcamento.createdAt)}`;
  $orcamentos("#detalheOrcamentoStatus").innerHTML = badgeStatus(orcamento.status);
  $orcamentos("#detalheOrcamentoCliente").textContent = orcamento.clienteNome || "-";
  $orcamentos("#detalheOrcamentoVeiculo").textContent = orcamento.veiculoDescricao || "-";
  $orcamentos("#detalheOrcamentoFuncionario").textContent = orcamento.funcionarioNome || "-";
  $orcamentos("#detalheOrcamentoDiagnostico").textContent = orcamento.diagnostico || "-";
  $orcamentos("#detalheOrcamentoObservacao").textContent = orcamento.observacao || "";
  $orcamentos("#blocoObservacaoOrcamento").classList.toggle("d-none", !orcamento.observacao);
  $orcamentos("#detalheOrcamentoItens").innerHTML = itens.map((item) => `
    <tr><td><span class="badge ${item.produtoCod ? "text-bg-primary" : "text-bg-danger"}">${item.produtoCod ? "Produto" : "Serviço"}</span></td><td>${escaparHtml(item.descricao || "-")}</td><td class="text-end">${window.vstockCurrency.formatMoney(item.valor)}</td></tr>
  `).join("");
  $orcamentos("#detalheOrcamentoSubtotal").textContent = window.vstockCurrency.formatMoney(subtotal);
  $orcamentos("#detalheOrcamentoDesconto").textContent = window.vstockCurrency.formatMoney(orcamento.valorDesconto);
  $orcamentos("#detalheOrcamentoTotal").textContent = window.vstockCurrency.formatMoney(orcamento.valorTotal);
  $orcamentos("#acoesOrcamento").innerHTML = orcamento.status === "PENDENTE"
    ? '<button type="button" class="btn btn-success" data-acao-status="APROVAR"><i class="bi bi-check2-circle"></i> Aprovar</button><button type="button" class="btn btn-outline-danger" data-acao-status="CANCELAR"><i class="bi bi-x-circle"></i> Cancelar</button>'
    : "";
}

async function abrirDetalhe(id) {
  try {
    const resposta = await fetch(API_ORCAMENTOS.DETALHE(id));
    if (!resposta.ok) throw new Error("Não foi possível carregar os detalhes do orçamento.");
    preencherModal(await resposta.json());
    modalDetalhe.show();
  } catch (erro) {
    mensagemOrcamentos(erro.message || "Não foi possível carregar os detalhes do orçamento.", "danger");
  }
}

function abrirConfirmacaoStatus(acao) {
  if (!orcamentoDetalheAtual) return;
  acaoStatusPendente = acao;
  const aprovar = acao === "APROVAR";
  const numeroOrcamento = orcamentoDetalheAtual.orcamentoId;
  const botaoConfirmar = $orcamentos("#btnConfirmarStatusOrcamento");

  $orcamentos("#tituloConfirmarStatusOrcamento").innerHTML = aprovar
    ? '<i class="bi bi-check2-circle text-success me-2"></i>Aprovar orçamento'
    : '<i class="bi bi-x-circle text-danger me-2"></i>Cancelar orçamento';
  $orcamentos("#mensagemConfirmarStatusOrcamento").textContent = `Deseja ${aprovar ? "aprovar" : "cancelar"} o orçamento #${numeroOrcamento}?`;
  $orcamentos("#descricaoConfirmarStatusOrcamento").textContent = aprovar
    ? "Após a aprovação, o orçamento não poderá mais ser alterado nesta etapa."
    : "O orçamento ficará registrado como cancelado e não poderá mais ser alterado.";
  botaoConfirmar.className = `btn ${aprovar ? "btn-success" : "btn-danger"}`;
  botaoConfirmar.innerHTML = aprovar
    ? '<i class="bi bi-check2-circle"></i> Aprovar orçamento'
    : '<i class="bi bi-x-circle"></i> Cancelar orçamento';

  const elementoModalDetalhe = $orcamentos("#modalDetalheOrcamento");
  if (elementoModalDetalhe.classList.contains("show")) {
    elementoModalDetalhe.addEventListener("hidden.bs.modal", () => modalConfirmacaoStatus.show(), { once: true });
    modalDetalhe.hide();
    return;
  }
  modalConfirmacaoStatus.show();
}

async function confirmarAlteracaoStatus() {
  if (!orcamentoDetalheAtual || !acaoStatusPendente) return;
  const acao = acaoStatusPendente;
  const texto = acao === "APROVAR" ? "aprovar" : "cancelar";
  const botaoConfirmar = $orcamentos("#btnConfirmarStatusOrcamento");
  botaoConfirmar.disabled = true;

  try {
    const url = acao === "APROVAR" ? API_ORCAMENTOS.APROVAR(orcamentoDetalheAtual.orcamentoId) : API_ORCAMENTOS.CANCELAR(orcamentoDetalheAtual.orcamentoId);
    const resposta = await fetch(url, { method: "PATCH" });
    if (!resposta.ok) throw new Error((await resposta.text()).trim() || `Não foi possível ${texto} o orçamento.`);
    const atualizado = await resposta.json();
    preencherModal(atualizado);
    orcamentos = orcamentos.map((item) => item.orcamentoId === atualizado.orcamentoId ? atualizado : item);
    renderizarLista();
    modalConfirmacaoStatus.hide();
    mensagemOrcamentos(`Orçamento ${acao === "APROVAR" ? "aprovado" : "cancelado"} com sucesso.`, "success");
  } catch (erro) {
    mensagemOrcamentos(erro.message || `Não foi possível ${texto} o orçamento.`, "danger");
  } finally {
    botaoConfirmar.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  modalDetalhe = new bootstrap.Modal($orcamentos("#modalDetalheOrcamento"));
  modalConfirmacaoStatus = new bootstrap.Modal($orcamentos("#modalConfirmarStatusOrcamento"));
  $orcamentos("#modalConfirmarStatusOrcamento").addEventListener("hidden.bs.modal", () => {
    acaoStatusPendente = null;
    if (orcamentoDetalheAtual) modalDetalhe.show();
  });
  carregarOrcamentos();
  $orcamentos("#filtroOrcamentoBusca").addEventListener("input", () => { paginaAtual = 1; renderizarLista(); });
  $orcamentos("#filtroOrcamentoStatus").addEventListener("change", () => { paginaAtual = 1; renderizarLista(); });
  $orcamentos("#btnLimparFiltrosOrcamento").addEventListener("click", () => { $orcamentos("#filtroOrcamentoBusca").value = ""; $orcamentos("#filtroOrcamentoStatus").value = ""; paginaAtual = 1; renderizarLista(); });
  $orcamentos("#tabelaOrcamentosBody").addEventListener("click", (event) => { const botao = event.target.closest("[data-ver-orcamento]"); if (botao) abrirDetalhe(Number(botao.dataset.verOrcamento)); });
  $orcamentos("#acoesOrcamento").addEventListener("click", (event) => { const botao = event.target.closest("[data-acao-status]"); if (botao) abrirConfirmacaoStatus(botao.dataset.acaoStatus); });
  $orcamentos("#btnConfirmarStatusOrcamento").addEventListener("click", confirmarAlteracaoStatus);
});


