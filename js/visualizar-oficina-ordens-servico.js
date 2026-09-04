const API_ORDENS_SERVICO = {
  LISTAR: "http://localhost:8080/api/oficina/ordens-servico",
  DETALHE: (id) => `http://localhost:8080/api/oficina/ordens-servico/${id}`,
  INICIAR: (id) => `http://localhost:8080/api/oficina/ordens-servico/${id}/iniciar`,
  ATUALIZAR: (id) => `http://localhost:8080/api/oficina/ordens-servico/${id}`,
  FINALIZAR: (id) => `http://localhost:8080/api/oficina/ordens-servico/${id}/finalizar`,
  CANCELAR: (id) => `http://localhost:8080/api/oficina/ordens-servico/${id}/cancelar`,
  FUNCIONARIOS: "http://localhost:8080/api/funcionarios/all?ativosOnly=true",
  FORMAS_PAGAMENTO: "http://localhost:8080/api/forma-pagamento/all?ativosOnly=true",
  CATALOGO: "http://localhost:8080/api/oficina/orcamentos/catalogo-itens"
};

const $os = (seletor) => document.querySelector(seletor);
const mensagemOs = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });
const ITENS_POR_PAGINA = 10;
const FORMA_PAGAMENTO_CREDITO_ID = 3;

const STATUS_OS = {
  ABERTA: { texto: "Aberta", classe: "aberta" },
  EM_ANDAMENTO: { texto: "Em andamento", classe: "andamento" },
  FINALIZADA: { texto: "Finalizada", classe: "finalizada" },
  CANCELADA: { texto: "Cancelada", classe: "cancelada" }
};

let ordensServico = [];
let funcionarios = [];
let formasPagamento = [];
let ordemDetalheAtual = null;
let itensEdicao = [];
let itensCatalogo = [];
let paginaAtual = 1;
let paginaCatalogo = 1;
let acaoConfirmacao = null;
let modalDetalhe;
let modalEditar;
let modalDiagnostico;
let modalFinalizar;
let modalConfirmar;
let timerBuscaCatalogo;
let timerMensagemExecucao;

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lerErro(resposta, padrao) {
  return resposta.text().then((texto) => texto.trim() || padrao);
}

function badgeStatus(status) {
  const info = STATUS_OS[String(status || "").toUpperCase()] || { texto: "Não informado", classe: "cancelada" };
  return `<span class="os-status ${info.classe}">${info.texto}</span>`;
}

function formatarData(data) {
  return window.vstockFormatters.date(data, { preserveInvalid: true }) || "-";
}

function formatarDataHora(data) {
  return window.vstockFormatters.dateTime(data, { preserveInvalid: true, options: {} }) || "-";
}

function moeda(valor) {
  return window.vstockCurrency.formatMoney(valor);
}

function mensagemExecucaoAtualizada() {
  const container = $os("#mensagemExecucaoOs");
  clearTimeout(timerMensagemExecucao);
  container.innerHTML = '<i class="bi bi-check2-circle"></i><span>Alterações salvas com sucesso.</span>';
  container.classList.remove("d-none");
  container.focus({ preventScroll: false });
  timerMensagemExecucao = setTimeout(() => container.classList.add("d-none"), 3500);
}

function subtotal(ordem) {
  return (ordem.itens || []).reduce((total, item) => total + Number(item.valor || 0) * (item.quantidade || 1), 0);
}

function filtrarOrdens() {
  const numero = String($os("#filtroOsNumero").value || "").trim();
  const cliente = String($os("#filtroOsCliente").value || "").trim().toLocaleLowerCase("pt-BR");
  const placa = String($os("#filtroOsPlaca").value || "").replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("pt-BR");
  const veiculo = String($os("#filtroOsVeiculo").value || "").trim().toLocaleLowerCase("pt-BR");
  const dataInicial = $os("#filtroOsDataInicial").value;
  const dataFinal = $os("#filtroOsDataFinal").value;
  const status = $os("#filtroOsStatus").value;

  return ordensServico.filter((ordem) => {
    const descricaoVeiculo = String(ordem.veiculoDescricao || "").toLocaleLowerCase("pt-BR");
    const placaOrdem = descricaoVeiculo.replace(/[^a-z0-9]/gi, "");
    const dataCriacao = String(ordem.createdAt || "").slice(0, 10);
    return (!numero || String(ordem.ordemServicoId).includes(numero))
      && (!cliente || String(ordem.clienteNome || "").toLocaleLowerCase("pt-BR").includes(cliente))
      && (!placa || placaOrdem.includes(placa))
      && (!veiculo || descricaoVeiculo.includes(veiculo))
      && (!dataInicial || dataCriacao >= dataInicial)
      && (!dataFinal || dataCriacao <= dataFinal)
      && (!status || ordem.status === status);
  });
}

function atualizarContadores() {
  $os("#contadorOsAbertas").textContent = String(ordensServico.filter((item) => item.status === "ABERTA").length).padStart(2, "0");
  $os("#contadorOsAndamento").textContent = String(ordensServico.filter((item) => item.status === "EM_ANDAMENTO").length).padStart(2, "0");
  $os("#contadorOsFinalizadas").textContent = String(ordensServico.filter((item) => item.status === "FINALIZADA").length).padStart(2, "0");
}

function renderizarLista() {
  const filtradas = filtrarOrdens();
  const dados = window.vstockPagination.paginate(filtradas, paginaAtual, ITENS_POR_PAGINA);
  paginaAtual = dados.page;

  $os("#resumoOs").textContent = `${filtradas.length} ${filtradas.length === 1 ? "ordem encontrada" : "ordens encontradas"}`;
  $os("#tabelaOsBody").innerHTML = dados.items.map((ordem) => `
    <tr>
      <td><span class="os-numero">OS #${ordem.ordemServicoId}</span><span class="os-orcamento">Orçamento #${ordem.orcamentoId}</span></td>
      <td><span class="os-cliente">${escaparHtml(ordem.clienteNome || "-")}</span><span class="os-veiculo">${escaparHtml(ordem.veiculoDescricao || "-")}</span></td>
      <td>${escaparHtml(ordem.funcionarioNome || "-")}</td>
      <td><span class="os-previsao"><i class="bi bi-calendar3"></i>${formatarData(ordem.dataPrevisaoEntrega)}</span></td>
      <td>${badgeStatus(ordem.status)}</td>
      <td class="text-center"><button class="btn btn-sm btn-outline-primary" type="button" data-ver-os="${ordem.ordemServicoId}"><i class="bi bi-eye"></i> Ver</button></td>
    </tr>
  `).join("");
  $os("#vazioOs").classList.toggle("d-none", filtradas.length > 0);
  window.vstockPagination.render({
    container: "#paginacaoOs",
    variant: "cadastro",
    itemLabel: "ordens",
    page: paginaAtual,
    pageSize: ITENS_POR_PAGINA,
    totalItems: filtradas.length,
    idPrefix: "OrdemServico",
    onPageChange: (pagina) => { paginaAtual = pagina; renderizarLista(); }
  });
  atualizarContadores();
}

async function carregarOrdens() {
  try {
    const resposta = await fetch(API_ORDENS_SERVICO.LISTAR);
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar as ordens de serviço."));
    ordensServico = await resposta.json();
    ordensServico.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderizarLista();
  } catch (erro) {
    mensagemOs(erro.message || "Não foi possível carregar as ordens de serviço.", "danger");
  }
}

function preencherDetalhe(ordem) {
  ordemDetalheAtual = ordem;
  const itens = ordem.itens || [];

  $os("#detalheOsTitulo").textContent = `OS #${ordem.ordemServicoId}`;
  $os("#detalheOsCriacao").textContent = `Criada em ${formatarDataHora(ordem.createdAt)} · Orçamento #${ordem.orcamentoId}`;
  $os("#detalheOsStatus").innerHTML = badgeStatus(ordem.status);
  $os("#detalheOsCliente").textContent = ordem.clienteNome || "-";
  $os("#detalheOsVeiculo").textContent = ordem.veiculoDescricao || "-";
  $os("#detalheOsFuncionario").textContent = ordem.funcionarioNome || "-";
  $os("#detalheOsPrevisao").textContent = ordem.status === "FINALIZADA"
    ? formatarData(ordem.dataEntrega)
    : ordem.dataPrevisaoEntrega
      ? formatarData(ordem.dataPrevisaoEntrega)
      : "Não informada";
  $os("#detalheOsDiagnostico").textContent = ordem.diagnostico || "-";
  $os("#detalheOsItens").innerHTML = itens.map((item) => `
    <tr><td><span class="badge ${item.produtoCod ? "text-bg-primary" : "text-bg-danger"}">${item.produtoCod ? "Produto" : "Serviço"}</span></td><td>${escaparHtml(item.descricao || "-")}</td><td class="text-end">${moeda(item.valor)}</td></tr>
  `).join("");
  $os("#detalheOsTotalItens").textContent = moeda(ordem.valorTotal);
  $os("#detalheOsSubtotal").textContent = moeda(subtotal(ordem));
  $os("#detalheOsDesconto").textContent = moeda(ordem.valorDesconto);
  $os("#detalheOsTotal").textContent = moeda(ordem.valorTotal);
  $os("#detalheOsPagamento").classList.toggle("d-none", !ordem.formaPagamentoId);
  $os("#detalheOsFormaPagamento").textContent = ordem.formaPagamentoNome || "-";

  const aberta = ordem.status === "ABERTA";
  const emAndamento = ordem.status === "EM_ANDAMENTO";
  const finalizada = ordem.status === "FINALIZADA";
  const parcelas = ordem.parcelas || [];
  $os("#blocoExecucaoOs").classList.toggle("d-none", !aberta && !emAndamento);
  $os("#detalheOsProximaAcao").textContent = aberta
    ? "Aguardando início do atendimento"
    : "Atendimento em execução";
  $os("#detalheOsTextoExecucao").textContent = aberta
    ? "Inicie a OS para registrar os itens realmente utilizados e ajustar a data estimada de conclusão."
    : "Mantenha os itens, o responsável e a data estimada atualizados durante o serviço.";
  $os("#passoOsAberta").classList.add("concluido");
  $os("#passoOsAndamento").classList.toggle("ativo", emAndamento);
  $os("#passoOsFinalizada").classList.remove("ativo", "concluido");
  $os("#btnGerenciarPrevisaoOs").classList.toggle("d-none", !emAndamento);
  $os("#btnGerenciarItensOs").classList.toggle("d-none", !emAndamento);
  $os("#detalheOsItensTitulo").textContent = emAndamento ? "Itens em execução" : "Itens da ordem";
  $os("#detalheOsItensAjuda").textContent = emAndamento
    ? "Registre os produtos e serviços realmente utilizados no atendimento."
    : "Itens aprovados para o atendimento.";
  $os("#blocoConclusaoOs").classList.toggle("d-none", !finalizada);
  $os("#totalFinalOs").classList.toggle("d-none", !finalizada);
  $os("#detalheOsDataEntrega").textContent = formatarData(ordem.dataEntrega);
  $os("#detalheOsDescontoConclusao").textContent = moeda(ordem.valorDesconto);
  $os("#blocoDetalheOsDescontoConclusao").classList.toggle("d-none", !Number(ordem.valorDesconto));
  $os("#detalheOsPagamentoConclusao").textContent = ordem.formaPagamentoNome || "-";
  $os("#detalheOsValorPago").textContent = moeda(ordem.valorTotal);
  $os("#detalheOsResumoPagamento").textContent = parcelas.length
    ? `${parcelas.length} ${parcelas.length === 1 ? "parcela registrada" : "parcelas registradas"}`
    : "Pagamento confirmado";
  $os("#blocoParcelasDetalheOs").classList.toggle("d-none", !finalizada || !parcelas.length);
  $os("#detalheOsQuantidadeParcelas").textContent = parcelas.length
    ? `${parcelas.length}x de ${moeda(parcelas[0].valor)}`
    : "";
  $os("#detalheOsParcelas").innerHTML = parcelas.map((parcela) => `
    <div class="os-parcela"><span>${parcela.numeroParcela}ª parcela</span><strong>${moeda(parcela.valor)}</strong></div>
  `).join("");

  $os("#acoesOs").innerHTML = aberta
    ? '<button type="button" class="btn btn-success" data-acao-os="INICIAR"><i class="bi bi-play-circle"></i> Iniciar atendimento</button><button type="button" class="btn btn-outline-danger" data-acao-os="CANCELAR"><i class="bi bi-x-circle"></i> Cancelar OS</button>'
    : emAndamento
      ? '<button type="button" class="btn btn-outline-primary" data-acao-os="EDITAR"><i class="bi bi-tools"></i> Gerenciar execução</button><button type="button" class="btn btn-success" data-acao-os="FINALIZAR"><i class="bi bi-check2-circle"></i> Finalizar OS</button><button type="button" class="btn btn-outline-danger" data-acao-os="CANCELAR"><i class="bi bi-x-circle"></i> Cancelar OS</button>'
      : finalizada
        ? '<button type="button" class="btn btn-outline-primary" data-acao-os="IMPRIMIR"><i class="bi bi-file-earmark-pdf"></i> Emitir PDF</button>'
        : "";

  preencherDocumentoImpressao(ordem);
}

function agruparItensParaDocumento(itens) {
  return itens.reduce((grupos, item) => {
    const chave = item.produtoCod
      ? `produto-${item.produtoCod}`
      : `servico-${item.servicoId || item.ordemServicoItemId}`;
    const grupo = grupos.get(chave) || {
      descricao: item.descricao || "-",
      produto: Boolean(item.produtoCod),
      quantidade: 0,
      valorUnitario: Number(item.valor || 0),
      total: 0
    };
    grupo.quantidade += 1;
    grupo.total += Number(item.valor || 0);
    grupos.set(chave, grupo);
    return grupos;
  }, new Map());
}

function preencherDocumentoImpressao(ordem) {
  const grupos = [...agruparItensParaDocumento(ordem.itens || []).values()];
  const parcelas = ordem.parcelas || [];

  $os("#documentoOsNumero").textContent = ordem.ordemServicoId || "-";
  $os("#documentoOsOrcamento").textContent = ordem.orcamentoId || "-";
  $os("#documentoOsCriacao").textContent = `Criada em ${formatarDataHora(ordem.createdAt)}`;
  $os("#documentoOsCliente").textContent = ordem.clienteNome || "-";
  $os("#documentoOsVeiculo").textContent = ordem.veiculoDescricao || "-";
  $os("#documentoOsFuncionario").textContent = ordem.funcionarioNome || "-";
  $os("#documentoOsDataConclusao").textContent = formatarData(ordem.dataEntrega);
  $os("#documentoOsDiagnostico").textContent = ordem.diagnostico || "-";
  $os("#documentoOsItens").innerHTML = grupos.map((item) => `
    <tr><td>${item.produto ? "Produto" : "Serviço"}</td><td>${escaparHtml(item.descricao)}</td><td class="os-documento-centro">${item.quantidade}</td><td class="os-documento-direita">${moeda(item.valorUnitario)}</td><td class="os-documento-direita">${moeda(item.total)}</td></tr>
  `).join("");
  $os("#documentoOsSubtotal").textContent = moeda(subtotal(ordem));
  $os("#documentoOsDesconto").textContent = moeda(ordem.valorDesconto);
  $os("#documentoOsPagamento").textContent = ordem.formaPagamentoNome || "-";
  $os("#documentoOsTotal").textContent = moeda(ordem.valorTotal);
  $os("#documentoOsParcelasBloco").classList.toggle("d-none", !parcelas.length);
  $os("#documentoOsParcelas").innerHTML = parcelas.map((parcela) => `
    <div><span>${parcela.numeroParcela}ª parcela</span><strong>${moeda(parcela.valor)}</strong></div>
  `).join("");
}

function emitirPdf() {
  $os("#documentoOsEmissao").textContent = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short"
  }).format(new Date());
  document.body.classList.add("os-imprimindo");
  window.addEventListener("afterprint", () => document.body.classList.remove("os-imprimindo"), { once: true });
  window.print();
}

async function abrirDetalhe(id) {
  try {
    const resposta = await fetch(API_ORDENS_SERVICO.DETALHE(id));
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar os detalhes da ordem."));
    const ordem = await resposta.json();
    if (ordem.status === "EM_ANDAMENTO") {
      abrirPainelExecucao(ordem);
      return;
    }
    preencherDetalhe(ordem);
    modalDetalhe.show();
  } catch (erro) {
    mensagemOs(erro.message || "Não foi possível carregar os detalhes da ordem.", "danger");
  }
}

function abrirConfirmacao(acao, modalOrigem = modalDetalhe) {
  if (!ordemDetalheAtual) return;
  acaoConfirmacao = acao;
  const iniciar = acao === "INICIAR";
  $os("#tituloConfirmarOs").innerHTML = iniciar
    ? '<i class="bi bi-play-circle text-success me-2"></i>Iniciar ordem de serviço'
    : '<i class="bi bi-x-circle text-danger me-2"></i>Cancelar ordem de serviço';
  $os("#mensagemConfirmarOs").textContent = iniciar
    ? `Deseja iniciar a OS #${ordemDetalheAtual.ordemServicoId}? Após iniciar, será possível alterar itens e dados da execução.`
    : `Deseja cancelar a OS #${ordemDetalheAtual.ordemServicoId}? Esta ação não poderá ser desfeita.`;
  const botao = $os("#btnConfirmarOs");
  botao.className = `btn ${iniciar ? "btn-success" : "btn-danger"}`;
  botao.innerHTML = iniciar ? '<i class="bi bi-play-circle"></i> Iniciar OS' : '<i class="bi bi-x-circle"></i> Cancelar OS';
  const elementoModalOrigem = modalOrigem === modalEditar
    ? $os("#modalEditarOs")
    : $os("#modalDetalheOs");
  modalOrigem.hide();
  elementoModalOrigem.addEventListener("hidden.bs.modal", () => modalConfirmar.show(), { once: true });
}

async function confirmarAcao() {
  if (!ordemDetalheAtual || !acaoConfirmacao) return;
  const iniciar = acaoConfirmacao === "INICIAR";
  const botao = $os("#btnConfirmarOs");
  botao.disabled = true;
  try {
    const resposta = await fetch(iniciar ? API_ORDENS_SERVICO.INICIAR(ordemDetalheAtual.ordemServicoId) : API_ORDENS_SERVICO.CANCELAR(ordemDetalheAtual.ordemServicoId), { method: "PATCH" });
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível atualizar a ordem de serviço."));
    const ordemAtualizada = await resposta.json();
    if (iniciar) {
      $os("#modalConfirmarOs").addEventListener("hidden.bs.modal", () => abrirPainelExecucao(ordemAtualizada), { once: true });
    }
    modalConfirmar.hide();
    mensagemOs(iniciar ? "Ordem de serviço iniciada." : "Ordem de serviço cancelada.", "success");
    await carregarOrdens();
  } catch (erro) {
    mensagemOs(erro.message || "Não foi possível atualizar a ordem de serviço.", "danger");
  } finally {
    botao.disabled = false;
  }
}

function preencherFuncionarios() {
  $os("#editarOsFuncionario").innerHTML = '<option value="">Selecione</option>' + funcionarios.map((funcionario) => `<option value="${funcionario.funcionarioId}">${escaparHtml(funcionario.funcNome || funcionario.username)}</option>`).join("");
}

function renderizarItensEdicao() {
  $os("#editarOsItens").innerHTML = itensEdicao.map((item, indice) => `
    <tr><td><span class="badge ${item.produtoCod ? "text-bg-primary" : "text-bg-danger"}">${item.produtoCod ? "Produto" : "Serviço"}</span></td><td>${escaparHtml(item.descricao || "-")}${item.produtoCod ? `<small class="d-block text-muted mt-1">× ${item.quantidade || 1} unidade${(item.quantidade || 1) > 1 ? "s" : ""}</small>` : ""}</td><td class="text-end">${moeda(Number(item.valor || 0) * (item.quantidade || 1))}</td><td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger" data-remover-item-os="${indice}" aria-label="Remover item"><i class="bi bi-trash3"></i></button></td></tr>
  `).join("");
  atualizarResumoEdicao();
}

function atualizarResumoEdicao() {
  const valorDesconto = window.vstockCurrency.parse($os("#editarOsDesconto").value) || 0;
  const valorSubtotal = subtotal({ itens: itensEdicao });
  const valorTotal = Math.max(0, valorSubtotal - valorDesconto);

  $os("#execucaoOsSubtotal").textContent = moeda(valorSubtotal);
  $os("#execucaoOsDesconto").textContent = moeda(valorDesconto);
  $os("#execucaoOsTotal").textContent = moeda(valorTotal);
}

function atualizarLeituraExecucao() {
  const funcionario = $os("#editarOsFuncionario");
  const nomeFuncionario = funcionario.options[funcionario.selectedIndex]?.text || "Não informado";
  const observacao = $os("#editarOsObservacao").value.trim();
  const previsao = $os("#editarOsPrevisao").value;

  $os("#execucaoOsFuncionario").textContent = funcionario.value ? nomeFuncionario : "Não informado";
  $os("#execucaoOsPrevisao").textContent = previsao ? formatarData(previsao) : "Não informada";
  $os("#execucaoOsObservacao").textContent = observacao || "Nenhuma observação da execução.";
}

function prepararEdicao() {
  if (!ordemDetalheAtual) return;
  $os("#catalogoInlineOs").classList.add("d-none");
  itensEdicao = agruparItensEdicao(ordemDetalheAtual.itens || []);
  $os("#execucaoOsNumero").textContent = ordemDetalheAtual.ordemServicoId || "-";
  $os("#execucaoOsOrcamento").textContent = ordemDetalheAtual.orcamentoId || "-";
  $os("#execucaoOsCliente").textContent = ordemDetalheAtual.clienteNome || "-";
  $os("#execucaoOsVeiculo").textContent = ordemDetalheAtual.veiculoDescricao || "-";
  const placa = ordemDetalheAtual.placa || ordemDetalheAtual.veiculoPlaca || "";
  $os("#blocoExecucaoOsPlaca").classList.toggle("d-none", !placa);
  $os("#execucaoOsPlaca").textContent = placa || "-";
  const diagnostico = ordemDetalheAtual.diagnostico || "Nenhum diagnóstico registrado.";
  $os("#execucaoOsDiagnostico").textContent = diagnostico;
  $os("#diagnosticoCompletoOs").textContent = diagnostico;
  $os("#editarOsFuncionario").value = String(ordemDetalheAtual.funcionarioId || "");
  $os("#editarOsPrevisao").value = ordemDetalheAtual.dataPrevisaoEntrega || "";
  $os("#editarOsDesconto").value = window.vstockCurrency.formatNumber(ordemDetalheAtual.valorDesconto || 0);
  $os("#editarOsObservacao").value = ordemDetalheAtual.observacao || "";
  atualizarLeituraExecucao();
  renderizarItensEdicao();
}

function agruparItensEdicao(itens) {
  const produtos = new Map();
  const grupos = [];

  itens.forEach((item) => {
    if (!item.produtoCod) {
      grupos.push({ ...item, quantidade: 1 });
      return;
    }

    const existente = produtos.get(item.produtoCod);
    if (existente) {
      existente.quantidade += 1;
    } else {
      const produto = { ...item, quantidade: 1 };
      produtos.set(item.produtoCod, produto);
      grupos.push(produto);
    }
  });

  return grupos;
}

function abrirPainelExecucao(ordem) {
  ordemDetalheAtual = ordem;
  prepararEdicao();
  modalEditar.show();
}

function abrirEdicao() {
  prepararEdicao();
  modalDetalhe.hide();
  $os("#modalDetalheOs").addEventListener("hidden.bs.modal", () => modalEditar.show(), { once: true });
}

async function carregarCatalogo() {
  try {
    const parametros = new URLSearchParams({ pagina: String(paginaCatalogo), tamanho: "5" });
    const busca = $os("#buscaCatalogoOs").value.trim();
    if (busca) parametros.set("busca", busca);
    const resposta = await fetch(`${API_ORDENS_SERVICO.CATALOGO}?${parametros}`);
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar os itens."));
    const resultado = await resposta.json();
    itensCatalogo = resultado.itens || [];
    $os("#resultadosCatalogoOs").innerHTML = itensCatalogo.length ? itensCatalogo.map((item, indice) => {
      const produto = Boolean(item.produtoCod);
      const quantidade = produto ? (itensEdicao.find((atual) => atual.produtoCod === item.produtoCod)?.quantidade || 0) : 0;
      const servicoAdicionado = !produto && itensEdicao.some((atual) => atual.servicoId === item.servicoId);
      return `
        <div class="list-group-item d-flex align-items-center gap-3 py-3"><span class="${produto ? "text-primary" : "text-danger"} fs-5"><i class="bi ${produto ? "bi-box-seam" : "bi-tools"}"></i></span><div class="flex-grow-1">${produto ? `<div class="d-flex align-items-start gap-3"><div class="d-flex flex-column align-items-start gap-1"><span class="badge text-bg-primary-subtle text-primary-emphasis">Produto</span><small class="text-muted">Estoque: ${Number(item.estoqueDisponivel || 0)}</small></div><strong>${escaparHtml(item.descricao)}</strong></div>` : `<strong>${escaparHtml(item.descricao)}</strong><div class="mt-1"><span class="badge text-bg-danger-subtle text-danger-emphasis">Serviço</span></div>`}</div><strong>${moeda(item.valor)}</strong>${produto && quantidade ? `<span class="badge text-bg-primary">${quantidade}x</span>` : ""}<button type="button" class="btn btn-sm ${produto ? "btn-outline-success" : (servicoAdicionado ? "btn-outline-secondary" : "btn-outline-success")}" data-${produto ? "aumentar-produto-os" : "adicionar-item-os"}="${indice}" ${!produto && servicoAdicionado ? "disabled" : ""}><i class="bi ${!produto && servicoAdicionado ? "bi-check2" : "bi-plus-lg"}"></i></button></div>
      `;
    }).join("") : '<div class="text-center text-muted py-4">Nenhum item encontrado.</div>';
    window.vstockPagination.render({ container: "#paginacaoCatalogoOs", variant: "cadastro", itemLabel: "itens", page: resultado.pagina, pageSize: resultado.tamanho, totalItems: resultado.totalItens, idPrefix: "CatalogoOs", onPageChange: (pagina) => { paginaCatalogo = pagina; carregarCatalogo(); } });
  } catch (erro) {
    $os("#resultadosCatalogoOs").innerHTML = '<div class="text-center text-danger py-4">Não foi possível carregar os itens.</div>';
    mensagemOs(erro.message || "Não foi possível carregar os itens.", "danger");
  }
}

async function salvarEdicao(event, abrirFinalizacaoDepois = false) {
  event?.preventDefault();
  const funcionarioId = Number($os("#editarOsFuncionario").value);
  if (!funcionarioId) return mensagemOs("Selecione o funcionário responsável.", "danger");
  if (!itensEdicao.length) return mensagemOs("Adicione ao menos um item à ordem.", "danger");
  const body = { funcionarioId, dataPrevisaoEntrega: $os("#editarOsPrevisao").value || null, valorDesconto: window.vstockCurrency.parse($os("#editarOsDesconto").value), observacao: $os("#editarOsObservacao").value.trim() || null, itens: itensEdicao.flatMap((item) => Array.from({ length: item.produtoCod ? (item.quantidade || 1) : 1 }, () => ({ produtoCod: item.produtoCod || null, servicoId: item.servicoId || null }))) };
  try {
    const resposta = await fetch(API_ORDENS_SERVICO.ATUALIZAR(ordemDetalheAtual.ordemServicoId), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível salvar a ordem de serviço."));
    const ordemAtualizada = await resposta.json();
    await carregarOrdens();
    if (abrirFinalizacaoDepois) {
      ordemDetalheAtual = ordemAtualizada;
      modalEditar.hide();
      $os("#modalEditarOs").addEventListener("hidden.bs.modal", () => abrirFormularioFinalizacao(), { once: true });
      return;
    }
    ordemDetalheAtual = ordemAtualizada;
    $os(".os-editar-execucao").removeAttribute("open");
    prepararEdicao();
    mensagemExecucaoAtualizada();
  } catch (erro) { mensagemOs(erro.message || "Não foi possível salvar a ordem de serviço.", "danger"); }
}

function preencherFormasPagamento() {
  $os("#finalizarOsFormaPagamento").innerHTML = '<option value="">Selecione</option>' + formasPagamento.map((forma) => `<option value="${forma.formaPagamentoId}">${escaparHtml(forma.nome)}</option>`).join("");
}

function abrirFormularioFinalizacao() {
  $os("#formFinalizarOs").reset();
  const hoje = new Date().toISOString().slice(0, 10);
  $os("#finalizarOsDataEntrega").value = hoje;
  $os("#finalizarOsTotal").textContent = moeda(ordemDetalheAtual?.valorTotal || 0);
  $os("#blocoParcelasOs").classList.add("d-none");
  modalFinalizar.show();
}

function abrirFinalizacao() {
  modalDetalhe.hide();
  $os("#modalDetalheOs").addEventListener("hidden.bs.modal", () => abrirFormularioFinalizacao(), { once: true });
}

async function finalizarOrdem(event) {
  event.preventDefault();
  const formaPagamentoId = Number($os("#finalizarOsFormaPagamento").value);
  const credito = formaPagamentoId === FORMA_PAGAMENTO_CREDITO_ID;
  const quantidadeParcelas = credito ? Number($os("#finalizarOsParcelas").value) : null;
  const dataEntrega = $os("#finalizarOsDataEntrega").value;
  if (!dataEntrega || !formaPagamentoId) return mensagemOs("Informe a data de conclusão e a forma de pagamento.", "danger");
  if (credito && quantidadeParcelas < 1) return mensagemOs("Informe a quantidade de parcelas.", "danger");
  try {
    const resposta = await fetch(API_ORDENS_SERVICO.FINALIZAR(ordemDetalheAtual.ordemServicoId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataEntrega, formaPagamentoId, quantidadeParcelas }) });
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível finalizar a ordem."));
    modalFinalizar.hide(); mensagemOs("Ordem de serviço finalizada.", "success"); await carregarOrdens();
  } catch (erro) { mensagemOs(erro.message || "Não foi possível finalizar a ordem.", "danger"); }
}

async function carregarDadosApoio() {
  const respostas = await Promise.all([fetch(API_ORDENS_SERVICO.FUNCIONARIOS), fetch(API_ORDENS_SERVICO.FORMAS_PAGAMENTO)]);
  for (const resposta of respostas) if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar dados de apoio."));
  [funcionarios, formasPagamento] = await Promise.all(respostas.map((resposta) => resposta.json()));
  preencherFuncionarios(); preencherFormasPagamento();
}

document.addEventListener("DOMContentLoaded", async () => {
  modalDetalhe = new bootstrap.Modal($os("#modalDetalheOs")); modalEditar = new bootstrap.Modal($os("#modalEditarOs")); modalDiagnostico = new bootstrap.Modal($os("#modalDiagnosticoOs")); modalFinalizar = new bootstrap.Modal($os("#modalFinalizarOs")); modalConfirmar = new bootstrap.Modal($os("#modalConfirmarOs"));
  window.vstockCurrency.attachMask($os("#editarOsDesconto"));
  ["#editarOsFuncionario", "#editarOsPrevisao", "#editarOsObservacao"].forEach((seletor) => {
    $os(seletor).addEventListener("input", atualizarLeituraExecucao);
    $os(seletor).addEventListener("change", atualizarLeituraExecucao);
  });
  $os("#editarOsDesconto").addEventListener("input", atualizarResumoEdicao);
  $os("#editarOsDesconto").addEventListener("change", atualizarResumoEdicao);
  $os("#finalizarOsDataEntrega").addEventListener("click", (event) => {
    event.currentTarget.showPicker?.();
  });
  await carregarOrdens();
  try { await carregarDadosApoio(); } catch (erro) { mensagemOs(erro.message || "Não foi possível carregar os dados de apoio.", "danger"); }
  ["#filtroOsNumero", "#filtroOsCliente", "#filtroOsPlaca", "#filtroOsVeiculo", "#filtroOsDataInicial", "#filtroOsDataFinal"].forEach((seletor) => {
    $os(seletor).addEventListener("input", () => { paginaAtual = 1; renderizarLista(); });
    $os(seletor).addEventListener("change", () => { paginaAtual = 1; renderizarLista(); });
  });
  $os("#filtroOsStatus").addEventListener("change", () => { paginaAtual = 1; renderizarLista(); });
  $os("#btnLimparFiltrosOs").addEventListener("click", () => {
    ["#filtroOsNumero", "#filtroOsCliente", "#filtroOsPlaca", "#filtroOsVeiculo", "#filtroOsDataInicial", "#filtroOsDataFinal", "#filtroOsStatus"].forEach((seletor) => { $os(seletor).value = ""; });
    paginaAtual = 1;
    renderizarLista();
  });
  $os("#tabelaOsBody").addEventListener("click", (event) => { const botao = event.target.closest("[data-ver-os]"); if (botao) abrirDetalhe(Number(botao.dataset.verOs)); });
  $os("#acoesOs").addEventListener("click", (event) => { const botao = event.target.closest("[data-acao-os]"); if (!botao) return; if (botao.dataset.acaoOs === "EDITAR") abrirEdicao(); else if (botao.dataset.acaoOs === "FINALIZAR") abrirFinalizacao(); else if (botao.dataset.acaoOs === "IMPRIMIR") emitirPdf(); else abrirConfirmacao(botao.dataset.acaoOs); });
  ["#btnGerenciarPrevisaoOs", "#btnGerenciarItensOs"].forEach((seletor) => {
    $os(seletor).addEventListener("click", abrirEdicao);
  });
  $os("#btnConfirmarOs").addEventListener("click", confirmarAcao);
  $os("#btnCancelarExecucao").addEventListener("click", () => abrirConfirmacao("CANCELAR", modalEditar));
  $os("#btnVerDiagnosticoOs").addEventListener("click", () => {
    modalEditar.hide();
    $os("#modalEditarOs").addEventListener("hidden.bs.modal", () => modalDiagnostico.show(), { once: true });
    $os("#modalDiagnosticoOs").addEventListener("hidden.bs.modal", () => modalEditar.show(), { once: true });
  });
  $os("#btnAbrirCatalogoOs").addEventListener("click", () => {
    paginaCatalogo = 1;
    $os("#buscaCatalogoOs").value = "";
    $os("#catalogoInlineOs").classList.remove("d-none");
    carregarCatalogo();
  });
  $os("#btnFecharCatalogoOs").addEventListener("click", () => $os("#catalogoInlineOs").classList.add("d-none"));
  $os("#buscaCatalogoOs").addEventListener("input", () => { clearTimeout(timerBuscaCatalogo); timerBuscaCatalogo = setTimeout(() => { paginaCatalogo = 1; carregarCatalogo(); }, 300); });
  $os("#resultadosCatalogoOs").addEventListener("click", (event) => { const botao = event.target.closest("[data-adicionar-item-os], [data-aumentar-produto-os]"); if (!botao) return; const item = itensCatalogo[Number(botao.dataset.adicionarItemOs ?? botao.dataset.aumentarProdutoOs)]; if (item.produtoCod) { const existente = itensEdicao.find((atual) => atual.produtoCod === item.produtoCod); if (existente) existente.quantidade = (existente.quantidade || 1) + 1; else itensEdicao.push({ ...item, quantidade: 1 }); } else { if (itensEdicao.some((atual) => atual.servicoId === item.servicoId)) return mensagemOs("Esse serviço já foi adicionado.", "warning"); itensEdicao.push({ ...item, quantidade: 1 }); } renderizarItensEdicao(); carregarCatalogo(); });
  $os("#editarOsItens").addEventListener("click", (event) => { const botao = event.target.closest("[data-remover-item-os]"); if (!botao) return; itensEdicao.splice(Number(botao.dataset.removerItemOs), 1); renderizarItensEdicao(); });
  $os("#formEditarOs").addEventListener("submit", salvarEdicao);
  $os("#btnFinalizarExecucao").addEventListener("click", (event) => salvarEdicao(event, true));
  $os("#finalizarOsFormaPagamento").addEventListener("change", () => { const credito = Number($os("#finalizarOsFormaPagamento").value) === FORMA_PAGAMENTO_CREDITO_ID; $os("#blocoParcelasOs").classList.toggle("d-none", !credito); $os("#finalizarOsParcelas").required = credito; });
  $os("#formFinalizarOs").addEventListener("submit", finalizarOrdem);
});


