const API_VENDAS = {
  ESTOQUE_RESUMO: "http://localhost:8080/api/estoque/resumo?ativosOnly=true",
  CLIENTES: "http://localhost:8080/api/cliente/all?ativosOnly=true",
  CLIENTE_NOVO: "http://localhost:8080/api/cliente",
  FORMAS_PAGAMENTO: "http://localhost:8080/api/forma-pagamento/all",
  FORMA_PAGAMENTO_NOVO: "http://localhost:8080/api/forma-pagamento",
  FORMA_PAGAMENTO_ATUALIZAR: (id) => `http://localhost:8080/api/forma-pagamento/${id}`,
  FORMA_PAGAMENTO_STATUS: (id, ativo) => `http://localhost:8080/api/forma-pagamento/${id}/status?ativo=${ativo}`,
  VENDAS: "http://localhost:8080/api/vendas"
};

const $venda = (selector) => document.querySelector(selector);

let produtosVendaCache = [];
let clientesVendaCache = [];
let formasPagamentoCache = [];
let itensDaVenda = [];
let debounceBuscaProdutoVenda = null;
let produtosVisiveisVenda = [];
let modalFormaPagamento = null;
let modalClienteVenda = null;
let modalConfirmarVenda = null;
let formaPagamentoEditandoId = null;

function msgVenda(texto, tipo = "danger") {
  const box = $venda("#mensagens");
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
  setTimeout(() => div.remove(), 4500);
}

function agoraInputLocal() {
  const data = new Date();
  const ajustada = new Date(data.getTime() - (data.getTimezoneOffset() * 60000));
  return ajustada.toISOString().slice(0, 16);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarMoedaCampo(valor) {
  return window.vstockCurrency.formatNumber(valor || 0);
}

function parseMoeda(valor) {
  return window.vstockCurrency.parse(valor || "");
}

function carregarFuncionarioLogado() {
  try {
    return JSON.parse(localStorage.getItem("funcionarioLogado") || "null");
  } catch {
    return null;
  }
}

function normalizarCodigoBarras(valor) {
  return String(valor || "").trim();
}

function localizarProdutoPorCodigoBarras(codigo) {
  const codigoNormalizado = normalizarCodigoBarras(codigo);
  if (!codigoNormalizado) return null;

  return produtosVendaCache.find((produto) =>
    normalizarCodigoBarras(produto.codigo_barras) === codigoNormalizado
  ) || null;
}

function localizarProdutoSelecionado() {
  const select = $venda("#listaProdutosVenda");
  if (!select?.value) return null;
  return produtosVendaCache.find((produto) => String(produto.prod_cod) === String(select.value)) || null;
}

function obterValorUnitarioProduto(produto) {
  return Number(produto?.valor_unitario || 0);
}

function atualizarModoEdicaoFormaPagamento() {
  const btnCancelar = $venda("#btnCancelarEdicaoFormaPagamento");
  btnCancelar?.classList.toggle("d-none", !formaPagamentoEditandoId);
}

function limparFormularioFormaPagamento() {
  formaPagamentoEditandoId = null;
  $venda("#formaPagamentoIdEdicao").value = "";
  $venda("#formaPagamentoNome").value = "";
  atualizarModoEdicaoFormaPagamento();
}

function preencherFormularioFormaPagamento(item) {
  formaPagamentoEditandoId = item.formaPagamentoId ?? item.forma_pagamento_id;
  $venda("#formaPagamentoIdEdicao").value = String(formaPagamentoEditandoId);
  $venda("#formaPagamentoNome").value = item.nome ?? "";
  atualizarModoEdicaoFormaPagamento();
  $venda("#formaPagamentoNome")?.focus();
}

function renderizarTabelaFormasPagamento() {
  const tbody = $venda("#tabelaFormasPagamento tbody");
  if (!tbody) return;

  tbody.innerHTML = formasPagamentoCache.map((item) => {
    const id = item.formaPagamentoId ?? item.forma_pagamento_id;
    const ativo = item.ativo !== false;
    return `
      <tr>
        <td>${item.nome ?? "-"}</td>
        <td>${ativo ? '<span class="badge text-bg-success">Ativa</span>' : '<span class="badge text-bg-secondary">Inativa</span>'}</td>
        <td class="text-center">
          <div class="d-flex gap-2 justify-content-center flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-primary" data-acao="editar" data-id="${id}">
              <i class="bi bi-pencil-square"></i> Editar
            </button>
            <button type="button" class="btn btn-sm ${ativo ? "btn-outline-warning" : "btn-outline-success"}" data-acao="status" data-id="${id}" data-ativo="${ativo}">
              <i class="bi ${ativo ? "bi-pause-circle" : "bi-arrow-clockwise"}"></i> ${ativo ? "Inativar" : "Reativar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderizarSelectFormasPagamento() {
  const select = $venda("#formaPagamentoVenda");
  if (!select) return;

  const valorAtual = select.value;
  const ativos = formasPagamentoCache.filter((item) => item.ativo !== false);
  select.innerHTML = `<option value="">Selecione...</option>`;

  ativos.forEach((item) => {
    const id = item.formaPagamentoId ?? item.forma_pagamento_id;
    const option = document.createElement("option");
    option.value = String(id);
    option.textContent = item.nome ?? "";
    option.dataset.nome = item.nome ?? "";
    select.appendChild(option);
  });

  if (valorAtual && ativos.some((item) => String(item.formaPagamentoId ?? item.forma_pagamento_id) === String(valorAtual))) {
    select.value = String(valorAtual);
  }
}

async function carregarFormasPagamento(ativosOnly = false) {
  try {
    const query = ativosOnly ? "?ativosOnly=true" : "";
    const resp = await fetch(`${API_VENDAS.FORMAS_PAGAMENTO}${query}`);
    if (!resp.ok) throw new Error("Falha ao carregar formas de pagamento.");
    formasPagamentoCache = await resp.json();
    renderizarTabelaFormasPagamento();
    renderizarSelectFormasPagamento();
    atualizarTroco();
  } catch (erro) {
    console.error(erro);
    msgVenda("Não foi possível carregar as formas de pagamento.", "danger");
  }
}

async function salvarFormaPagamento(event) {
  event.preventDefault();

  const nome = $venda("#formaPagamentoNome")?.value?.trim() || "";
  if (!nome) {
    msgVenda("Informe o nome da forma de pagamento.", "danger");
    return;
  }

  try {
    const url = formaPagamentoEditandoId
      ? API_VENDAS.FORMA_PAGAMENTO_ATUALIZAR(formaPagamentoEditandoId)
      : API_VENDAS.FORMA_PAGAMENTO_NOVO;
    const method = formaPagamentoEditandoId ? "PUT" : "POST";

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome })
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao salvar a forma de pagamento.");
    }

    limparFormularioFormaPagamento();
    await carregarFormasPagamento(false);
    msgVenda("Forma de pagamento salva com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgVenda(erro.message || "Não foi possível salvar a forma de pagamento.", "danger");
  }
}

async function alternarStatusFormaPagamento(id, ativoAtual) {
  try {
    const resp = await fetch(API_VENDAS.FORMA_PAGAMENTO_STATUS(id, !ativoAtual), {
      method: "PATCH"
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao atualizar a forma de pagamento.");
    }

    if (formaPagamentoEditandoId === id && ativoAtual) {
      limparFormularioFormaPagamento();
    }

    await carregarFormasPagamento(false);
    msgVenda(`Forma de pagamento ${ativoAtual ? "inativada" : "reativada"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgVenda(erro.message || "Não foi possível atualizar a forma de pagamento.", "danger");
  }
}

async function carregarClientes() {
  try {
    const resp = await fetch(API_VENDAS.CLIENTES);
    if (!resp.ok) throw new Error("Falha ao carregar clientes.");

    clientesVendaCache = await resp.json();
    const select = $venda("#clienteVenda");
    if (!select) return;

    select.innerHTML = `<option value="">Venda sem cliente identificado</option>`;
    clientesVendaCache.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = String(cliente.clienteId ?? cliente.cliente_id);
      option.textContent = cliente.nome ?? "Cliente";
      select.appendChild(option);
    });
  } catch (erro) {
    console.error(erro);
    msgVenda("Não foi possível carregar os clientes.", "danger");
  }
}

function limparFormularioClienteVenda() {
  $venda("#clienteVendaForm")?.reset();
}

async function salvarClienteVenda(event) {
  event.preventDefault();

  const nome = $venda("#clienteVendaNome")?.value?.trim() || "";
  const cpfCnpj = $venda("#clienteVendaCpfCnpj")?.value?.trim() || "";
  const telefone = $venda("#clienteVendaTelefone")?.value?.trim() || "";
  const observacao = $venda("#clienteVendaObservacao")?.value?.trim() || "";

  if (!nome) {
    msgVenda("Informe o nome do cliente.", "danger");
    return;
  }

  try {
    const resp = await fetch(API_VENDAS.CLIENTE_NOVO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cpfCnpj, telefone, observacao })
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao cadastrar cliente.");
    }

    const clienteSalvo = await resp.json();
    await carregarClientes();

    const idCliente = String(clienteSalvo.clienteId ?? clienteSalvo.cliente_id ?? "");
    if (idCliente) {
      $venda("#clienteVenda").value = idCliente;
    }

    limparFormularioClienteVenda();
    modalClienteVenda?.hide();
    msgVenda("Cliente cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgVenda(erro.message || "Não foi possível cadastrar o cliente.", "danger");
  }
}

function desenharSelectProdutos(lista) {
  const select = $venda("#listaProdutosVenda");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = "";
  produtosVisiveisVenda = [...lista];

  if (!lista.length) {
    select.innerHTML = `<option value="" selected disabled>Nenhum produto encontrado</option>`;
    renderizarDropdownProdutos([]);
    atualizarProdutoSelecionado();
    return;
  }

  lista.forEach((produto) => {
    const opt = document.createElement("option");
    opt.value = produto.prod_cod;
    opt.textContent = `${produto.prod_descr} (${produto.saldo} em estoque)`;
    opt.setAttribute("data-descr", produto.prod_descr);
    opt.setAttribute("data-saldo", produto.saldo);
    select.appendChild(opt);
  });

  if (valorAtual && lista.some((produto) => String(produto.prod_cod) === String(valorAtual))) {
    select.value = String(valorAtual);
  } else {
    select.selectedIndex = 0;
  }

  renderizarDropdownProdutos(lista, false);
}

function renderizarDropdownProdutos(lista, aberto = true) {
  const dropdown = $venda("#dropdownProdutosVenda");
  const select = $venda("#listaProdutosVenda");
  if (!dropdown || !select) return;

  if (!lista.length) {
    dropdown.innerHTML = `<button class="produto-dropdown-item vazio" type="button" disabled>Nenhum produto encontrado</button>`;
    dropdown.classList.toggle("ativo", aberto);
    return;
  }

  const valorSelecionado = select.value;
  dropdown.innerHTML = lista.map((produto) => {
    const ativo = String(produto.prod_cod) === String(valorSelecionado) ? " ativo" : "";
    return `<button class="produto-dropdown-item${ativo}" type="button" data-value="${produto.prod_cod}">${produto.prod_descr} <span>(${produto.saldo} em estoque)</span></button>`;
  }).join("");
  dropdown.classList.toggle("ativo", aberto);
}

function fecharDropdownProdutos() {
  $venda("#dropdownProdutosVenda")?.classList.remove("ativo");
}

function selecionarProduto(produto) {
  const select = $venda("#listaProdutosVenda");
  const input = $venda("#buscaProdutoVenda");
  const inputCodigo = $venda("#codigoBarrasVenda");
  if (!select || !input || !produto) return;

  select.value = String(produto.prod_cod);
  input.value = produto.prod_descr || "";
  if (inputCodigo && produto.codigo_barras) {
    inputCodigo.value = produto.codigo_barras;
  }
  renderizarDropdownProdutos(produtosVisiveisVenda, false);
  atualizarProdutoSelecionado();
  fecharDropdownProdutos();
}

function atualizarProdutoSelecionado() {
  const select = $venda("#listaProdutosVenda");
  const saldo = select?.selectedOptions?.[0]?.getAttribute("data-saldo") || "0";
  $venda("#saldoProdutoVenda").value = saldo;
  const produto = localizarProdutoSelecionado();
  $venda("#valorUnitarioVenda").value = formatarMoedaCampo(obterValorUnitarioProduto(produto));
  atualizarSubtotalItemAtual();
}

function atualizarSubtotalItemAtual() {
  const produto = localizarProdutoSelecionado();
  const quantidade = Number($venda("#quantidadeVenda")?.value || 0);
  if (!produto || quantidade <= 0) {
    $venda("#subtotalItemVenda").value = formatarMoedaCampo(0);
    return;
  }

  const subtotal = quantidade * obterValorUnitarioProduto(produto);
  $venda("#subtotalItemVenda").value = formatarMoedaCampo(subtotal);
}

function quantidadeReservadaProduto(prodCod, ignorarIndice = null) {
  return itensDaVenda.reduce((acc, item, indice) => {
    if (ignorarIndice !== null && indice === ignorarIndice) return acc;
    if (Number(item.prodCod) !== Number(prodCod)) return acc;
    return acc + Number(item.qtd || 0);
  }, 0);
}

function renderizarItensVenda() {
  const tbody = $venda("#tabelaItensVenda tbody");
  if (!tbody) return;

  tbody.innerHTML = itensDaVenda.map((item, indice) => `
    <tr>
      <td>${item.descrProduto}</td>
      <td class="text-end">${item.saldo}</td>
      <td class="text-end">${item.qtd}</td>
      <td class="text-end">${formatarMoeda(item.valorUnitario)}</td>
      <td class="text-end">${formatarMoeda(item.valorSubtotal)}</td>
      <td class="text-center">
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <button type="button" class="btn btn-sm btn-outline-primary" data-acao="editar-item" data-idx="${indice}">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover-item" data-idx="${indice}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  atualizarResumoVenda();
}

function limparFormularioItem() {
  $venda("#buscaProdutoVenda").value = "";
  $venda("#codigoBarrasVenda").value = "";
  $venda("#listaProdutosVenda").value = "";
  $venda("#saldoProdutoVenda").value = "";
  $venda("#quantidadeVenda").value = "";
  $venda("#valorUnitarioVenda").value = formatarMoedaCampo(0);
  $venda("#subtotalItemVenda").value = formatarMoedaCampo(0);
  fecharDropdownProdutos();
}

function adicionarItemVenda() {
  const produto = localizarProdutoSelecionado();
  const quantidade = Number($venda("#quantidadeVenda")?.value || 0);

  if (!produto) {
    msgVenda("Selecione um produto.", "danger");
    return;
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    msgVenda("Informe uma quantidade válida.", "danger");
    return;
  }

  const saldo = Number(produto.saldo || 0);
  const reservado = quantidadeReservadaProduto(produto.prod_cod);
  if (quantidade + reservado > saldo) {
    msgVenda("A quantidade informada ultrapassa o saldo disponível.", "danger");
    return;
  }

  const valorUnitario = obterValorUnitarioProduto(produto);
  const valorSubtotal = Number((valorUnitario * quantidade).toFixed(2));

  itensDaVenda.push({
    prodCod: Number(produto.prod_cod),
    descrProduto: produto.prod_descr || "",
    saldo,
    qtd: quantidade,
    valorUnitario,
    valorSubtotal
  });

  limparFormularioItem();
  renderizarItensVenda();
}

function carregarItemParaEdicao(indice) {
  const item = itensDaVenda[indice];
  if (!item) return;

  const produto = produtosVendaCache.find((produtoItem) => Number(produtoItem.prod_cod) === Number(item.prodCod));
  if (!produto) return;

  selecionarProduto(produto);
  $venda("#quantidadeVenda").value = String(item.qtd);
  atualizarSubtotalItemAtual();
  itensDaVenda.splice(indice, 1);
  renderizarItensVenda();
}

function removerItemVenda(indice) {
  itensDaVenda.splice(indice, 1);
  renderizarItensVenda();
}

async function carregarProdutos() {
  try {
    const resp = await fetch(API_VENDAS.ESTOQUE_RESUMO);
    if (!resp.ok) throw new Error("Falha ao carregar estoque.");

    produtosVendaCache = await resp.json();
    desenharSelectProdutos(produtosVendaCache);
  } catch (erro) {
    console.error(erro);
    msgVenda("Não foi possível carregar os produtos disponíveis.", "danger");
  }
}

function filtrarProdutos() {
  const termo = ($venda("#buscaProdutoVenda")?.value || "").trim().toLowerCase();

  if (!termo) {
    desenharSelectProdutos(produtosVendaCache);
    atualizarProdutoSelecionado();
    return;
  }

  const filtrados = produtosVendaCache.filter((produto) =>
    String(produto.prod_descr || "").toLowerCase().includes(termo)
  );

  desenharSelectProdutos(filtrados);
  atualizarProdutoSelecionado();
}

function agendarFiltroProdutos() {
  if (debounceBuscaProdutoVenda) {
    clearTimeout(debounceBuscaProdutoVenda);
  }

  debounceBuscaProdutoVenda = setTimeout(() => {
    filtrarProdutos();
    renderizarDropdownProdutos(produtosVisiveisVenda, true);
  }, 250);
}

function processarLeituraCodigoBarras() {
  const inputCodigo = $venda("#codigoBarrasVenda");
  const inputQuantidade = $venda("#quantidadeVenda");
  const codigo = normalizarCodigoBarras(inputCodigo?.value);
  if (!inputCodigo || !inputQuantidade || !codigo) return;

  const produto = localizarProdutoPorCodigoBarras(codigo);
  if (!produto) {
    msgVenda("Código de barras não cadastrado para nenhum produto.", "danger");
    inputCodigo.select();
    return;
  }

  const produtoJaSelecionado = String($venda("#listaProdutosVenda")?.value || "") === String(produto.prod_cod);
  const quantidadeAtual = Number(inputQuantidade.value || 0);
  const proximaQuantidade = produtoJaSelecionado && quantidadeAtual > 0 ? quantidadeAtual + 1 : 1;
  const saldo = Number(produto.saldo || 0);
  const reservado = quantidadeReservadaProduto(produto.prod_cod);

  if (proximaQuantidade + reservado > saldo) {
    msgVenda("A leitura ultrapassa o saldo disponível para este produto.", "danger");
    inputCodigo.select();
    return;
  }

  selecionarProduto(produto);
  inputQuantidade.value = String(proximaQuantidade);
  atualizarSubtotalItemAtual();
  inputCodigo.select();
}

function obterSubtotalVenda() {
  return itensDaVenda.reduce((acc, item) => acc + Number(item.valorSubtotal || 0), 0);
}

function calcularDescontoAtual() {
  const subtotal = obterSubtotalVenda();
  const tipo = $venda("#tipoDescontoVenda")?.value || "NENHUM";
  const valorBruto = parseMoeda($venda("#valorDescontoVenda")?.value || "");

  if (tipo === "VALOR") {
    return Math.min(valorBruto, subtotal);
  }

  if (tipo === "PERCENTUAL") {
    const percentual = Math.min(Math.max(valorBruto, 0), 100);
    return subtotal * (percentual / 100);
  }

  return 0;
}

function obterTotalVenda() {
  const subtotal = obterSubtotalVenda();
  const desconto = calcularDescontoAtual();
  return Math.max(subtotal - desconto, 0);
}

function obterValorRecebidoAtual() {
  return parseMoeda($venda("#valorRecebidoVendaTela")?.value || "");
}

function obterTrocoAtual() {
  if (!formaPagamentoSelecionadaEhDinheiro()) {
    return 0;
  }

  return Math.max(obterValorRecebidoAtual() - obterTotalVenda(), 0);
}

function validarVendaAntesDeConfirmar() {
  const dataVenda = $venda("#dataVenda")?.value || "";
  const codFuncionario = $venda("#funcionarioCpfVenda")?.value || "";
  const formaPagamentoId = $venda("#formaPagamentoVenda")?.value || "";
  const valorRecebido = obterValorRecebidoAtual();

  if (!dataVenda) {
    throw new Error("Informe a data da venda.");
  }
  if (!codFuncionario) {
    throw new Error("Funcionário responsável não identificado.");
  }
  if (!itensDaVenda.length) {
    throw new Error("Adicione pelo menos um item à venda.");
  }
  if (!formaPagamentoId) {
    throw new Error("Selecione a forma de pagamento.");
  }
  if (formaPagamentoSelecionadaEhDinheiro() && valorRecebido < obterTotalVenda()) {
    throw new Error("O valor recebido deve ser maior ou igual ao total da venda.");
  }
}

function obterValorRecebidoAtual() {
  return parseMoeda($venda("#valorRecebidoVendaTela")?.value || "");
}

function obterTrocoAtual() {
  if (!formaPagamentoSelecionadaEhDinheiro()) {
    return null;
  }

  const troco = Math.max(obterValorRecebidoAtual() - obterTotalVenda(), 0);
  return Number(troco.toFixed(2));
}

function obterPayloadVenda() {
  const dataVenda = $venda("#dataVenda")?.value || "";
  const codFuncionario = $venda("#funcionarioCpfVenda")?.value || "";
  const clienteId = $venda("#clienteVenda")?.value || "";
  const formaPagamentoId = $venda("#formaPagamentoVenda")?.value || "";
  const tipoDesconto = $venda("#tipoDescontoVenda")?.value || "NENHUM";
  const valorDesconto = calcularDescontoAtual();
  const valorRecebido = obterValorRecebidoAtual();
  const total = obterTotalVenda();

  if (!dataVenda) {
    throw new Error("Informe a data da venda.");
  }
  if (!codFuncionario) {
    throw new Error("Funcionário responsável não identificado.");
  }
  if (!itensDaVenda.length) {
    throw new Error("Adicione pelo menos um item à venda.");
  }
  if (!formaPagamentoId) {
    throw new Error("Selecione a forma de pagamento.");
  }
  if (formaPagamentoSelecionadaEhDinheiro() && valorRecebido < total) {
    throw new Error("O valor recebido deve ser maior ou igual ao total da venda.");
  }

  return {
    dataVenda,
    codFuncionario,
    clienteId: clienteId ? Number(clienteId) : null,
    valorSubtotal: Number(obterSubtotalVenda().toFixed(2)),
    tipoDesconto,
    valorDesconto: Number(valorDesconto.toFixed(2)),
    valorTotal: Number(total.toFixed(2)),
    formaPagamentoId: Number(formaPagamentoId),
    valorRecebido: formaPagamentoSelecionadaEhDinheiro() ? Number(valorRecebido.toFixed(2)) : null,
    troco: obterTrocoAtual(),
    status: $venda("#statusVenda")?.value || "FINALIZADA",
    observacao: $venda("#observacaoVenda")?.value?.trim() || "",
    itens: itensDaVenda.map((item) => ({
      produtoCod: Number(item.prodCod),
      quantidade: Number(item.qtd),
      valorUnitario: Number(item.valorUnitario.toFixed(2)),
      valorSubtotal: Number(item.valorSubtotal.toFixed(2))
    }))
  };
}

function formaPagamentoSelecionadaEhDinheiro() {
  const select = $venda("#formaPagamentoVenda");
  const nome = select?.selectedOptions?.[0]?.dataset?.nome || "";
  return nome.trim().toLowerCase() === "dinheiro";
}

function atualizarVisibilidadePagamentoDinheiro() {
  const blocoValorRecebido = $venda("#blocoValorRecebidoVenda");
  const blocoTroco = $venda("#blocoTrocoVenda");
  const valorRecebidoInput = $venda("#valorRecebidoVendaTela");
  const trocoInput = $venda("#trocoVendaTela");
  const deveExibir = formaPagamentoSelecionadaEhDinheiro();

  blocoValorRecebido?.classList.toggle("d-none", !deveExibir);
  blocoTroco?.classList.toggle("d-none", !deveExibir);

  if (!deveExibir) {
    if (valorRecebidoInput) {
      valorRecebidoInput.value = "";
    }
    if (trocoInput) {
      trocoInput.value = formatarMoedaCampo(0);
    }
  }
}

function atualizarTroco() {
  const valorRecebidoInput = $venda("#valorRecebidoVendaTela");
  const trocoInput = $venda("#trocoVendaTela");
  if (!valorRecebidoInput || !trocoInput) return;

  const deveExibir = formaPagamentoSelecionadaEhDinheiro();
  atualizarVisibilidadePagamentoDinheiro();
  if (!deveExibir) {
    return;
  }

  const valorRecebido = parseMoeda(valorRecebidoInput.value || "");
  const total = obterTotalVenda();
  const troco = Math.max(valorRecebido - total, 0);
  trocoInput.value = formatarMoedaCampo(troco);
}

function atualizarResumoVenda() {
  atualizarTroco();
}

function limparVendaCompleta() {
  itensDaVenda = [];
  $venda("#dataVenda").value = agoraInputLocal();
  $venda("#clienteVenda").value = "";
  $venda("#statusVenda").value = "FINALIZADA";
  $venda("#tipoDescontoVenda").value = "NENHUM";
  $venda("#valorDescontoVenda").value = "";
  $venda("#observacaoVenda").value = "";
  $venda("#formaPagamentoVenda").value = "";
  $venda("#valorRecebidoVendaTela").value = "";
  $venda("#trocoVendaTela").value = formatarMoedaCampo(0);
  limparFormularioItem();
  renderizarItensVenda();
  atualizarVisibilidadePagamentoDinheiro();
}

function preencherModalConfirmacaoVenda() {
  const tbody = $venda("#resumoConfirmacaoVendaItens");
  const subtotal = obterSubtotalVenda();
  const desconto = calcularDescontoAtual();
  const total = obterTotalVenda();
  const valorRecebido = obterValorRecebidoAtual();
  const troco = obterTrocoAtual();
  const formaPagamentoNome = $venda("#formaPagamentoVenda")?.selectedOptions?.[0]?.dataset?.nome || "-";
  const linhaRecebido = $venda("#resumoConfirmacaoVendaLinhaRecebido");
  const linhaTroco = $venda("#resumoConfirmacaoVendaLinhaTroco");
  const exibeRecebido = formaPagamentoSelecionadaEhDinheiro();

  if (tbody) {
    tbody.innerHTML = itensDaVenda.map((item) => `
      <tr>
        <td>${item.descrProduto}</td>
        <td class="text-end">${item.qtd}</td>
        <td class="text-end">${formatarMoeda(item.valorUnitario)}</td>
        <td class="text-end">${formatarMoeda(item.valorSubtotal)}</td>
      </tr>
    `).join("");
  }

  $venda("#resumoConfirmacaoVendaSubtotal").textContent = formatarMoeda(subtotal);
  $venda("#resumoConfirmacaoVendaDesconto").textContent = formatarMoeda(desconto);
  $venda("#resumoConfirmacaoVendaTotal").textContent = formatarMoeda(total);
  $venda("#resumoConfirmacaoVendaFormaPagamento").textContent = formaPagamentoNome;

  linhaRecebido?.classList.toggle("d-none", !exibeRecebido);
  linhaTroco?.classList.toggle("d-none", !exibeRecebido);

  if (exibeRecebido) {
    $venda("#resumoConfirmacaoVendaRecebido").textContent = formatarMoeda(valorRecebido);
    $venda("#resumoConfirmacaoVendaTroco").textContent = formatarMoeda(troco);
  }
}

function abrirConfirmacaoVenda() {
  try {
    validarVendaAntesDeConfirmar();
    preencherModalConfirmacaoVenda();
    modalConfirmarVenda?.show();
  } catch (erro) {
    msgVenda(erro.message || "Não foi possível validar a venda.", "danger");
  }
}

async function salvarVenda() {
  const dataVenda = $venda("#dataVenda")?.value || "";
  const codFuncionario = $venda("#funcionarioCpfVenda")?.value || "";
  const clienteId = $venda("#clienteVenda")?.value || "";
  const formaPagamentoId = $venda("#formaPagamentoVenda")?.value || "";
  const tipoDesconto = $venda("#tipoDescontoVenda")?.value || "NENHUM";
  const valorDesconto = parseMoeda($venda("#valorDescontoVenda")?.value || "");
  const valorRecebido = parseMoeda($venda("#valorRecebidoVendaTela")?.value || "");

  if (!dataVenda) {
    msgVenda("Informe a data da venda.", "danger");
    return;
  }
  if (!codFuncionario) {
    msgVenda("Funcionário responsável não identificado.", "danger");
    return;
  }
  if (!itensDaVenda.length) {
    msgVenda("Adicione pelo menos um item à venda.", "danger");
    return;
  }
  if (!formaPagamentoId) {
    msgVenda("Selecione a forma de pagamento.", "danger");
    return;
  }
  if (formaPagamentoSelecionadaEhDinheiro() && valorRecebido < obterTotalVenda()) {
    msgVenda("O valor recebido deve ser maior ou igual ao total da venda.", "danger");
    return;
  }

  const body = {
    dataVenda,
    codFuncionario,
    clienteId: clienteId ? Number(clienteId) : null,
    valorSubtotal: Number(obterSubtotalVenda().toFixed(2)),
    tipoDesconto,
    valorDesconto: Number(valorDesconto.toFixed ? valorDesconto.toFixed(2) : valorDesconto),
    valorTotal: Number(obterTotalVenda().toFixed(2)),
    formaPagamentoId: Number(formaPagamentoId),
    valorRecebido: formaPagamentoSelecionadaEhDinheiro() ? Number(valorRecebido.toFixed(2)) : null,
    troco: formaPagamentoSelecionadaEhDinheiro() ? Number(Math.max(valorRecebido - obterTotalVenda(), 0).toFixed(2)) : null,
    status: $venda("#statusVenda")?.value || "FINALIZADA",
    observacao: $venda("#observacaoVenda")?.value?.trim() || "",
    itens: itensDaVenda.map((item) => ({
      produtoCod: Number(item.prodCod),
      quantidade: Number(item.qtd),
      valorUnitario: Number(item.valorUnitario.toFixed(2)),
      valorSubtotal: Number(item.valorSubtotal.toFixed(2))
    }))
  };

  try {
    const resp = await fetch(API_VENDAS.VENDAS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao registrar a venda.");
    }

    modalConfirmarVenda?.hide();
    msgVenda("Venda registrada com sucesso.", "success");
    limparVendaCompleta();
    await carregarProdutos();
  } catch (erro) {
    console.error(erro);
    msgVenda(erro.message || "Não foi possível registrar a venda.", "danger");
  }
}

function preencherFuncionarioVenda() {
  const funcionario = carregarFuncionarioLogado();
  if (!funcionario) {
    msgVenda("Nenhum funcionário logado foi encontrado. Faça login novamente.", "danger");
    return;
  }

  $venda("#funcionarioCpfVenda").value = funcionario.funcCpf || funcionario.cpf || "";
  $venda("#funcionarioNomeVenda").value = funcionario.funcNome || funcionario.nome || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  $venda("#dataVenda").value = agoraInputLocal();
  preencherFuncionarioVenda();
  modalFormaPagamento = new bootstrap.Modal(document.getElementById("modalFormaPagamento"));
  modalClienteVenda = new bootstrap.Modal(document.getElementById("modalClienteVenda"));
  modalConfirmarVenda = new bootstrap.Modal(document.getElementById("modalConfirmarVenda"));
  $venda("#trocoVendaTela").value = formatarMoedaCampo(0);
  atualizarVisibilidadePagamentoDinheiro();

  await Promise.all([
    carregarProdutos(),
    carregarClientes(),
    carregarFormasPagamento(false)
  ]);

  $venda("#btnAbrirModalClienteVenda")?.addEventListener("click", () => {
    limparFormularioClienteVenda();
    modalClienteVenda.show();
  });
  $venda("#clienteVendaForm")?.addEventListener("submit", salvarClienteVenda);
  $venda("#btnAbrirModalFormaPagamento")?.addEventListener("click", () => {
    limparFormularioFormaPagamento();
    renderizarTabelaFormasPagamento();
    modalFormaPagamento.show();
  });
  $venda("#formaPagamentoForm")?.addEventListener("submit", salvarFormaPagamento);
  $venda("#btnCancelarEdicaoFormaPagamento")?.addEventListener("click", limparFormularioFormaPagamento);
  $venda("#btnAddItemVenda")?.addEventListener("click", adicionarItemVenda);
  $venda("#btnSalvarVenda")?.addEventListener("click", abrirConfirmacaoVenda);
  $venda("#btnConfirmarVendaModal")?.addEventListener("click", salvarVenda);
  $venda("#btnLimparVenda")?.addEventListener("click", limparVendaCompleta);
  $venda("#listaProdutosVenda")?.addEventListener("change", atualizarProdutoSelecionado);
  $venda("#quantidadeVenda")?.addEventListener("input", atualizarSubtotalItemAtual);
  $venda("#buscaProdutoVenda")?.addEventListener("input", agendarFiltroProdutos);
  $venda("#buscaProdutoVenda")?.addEventListener("focus", () => renderizarDropdownProdutos(produtosVisiveisVenda, true));
  $venda("#tipoDescontoVenda")?.addEventListener("change", () => {
    $venda("#valorDescontoVenda").value = "";
    atualizarResumoVenda();
  });
  $venda("#valorDescontoVenda")?.addEventListener("input", () => {
    const tipo = $venda("#tipoDescontoVenda").value;
    if (tipo === "PERCENTUAL") {
      const valor = String($venda("#valorDescontoVenda").value || "").replace(/[^\d,]/g, "");
      $venda("#valorDescontoVenda").value = valor;
    } else {
      $venda("#valorDescontoVenda").value = window.vstockCurrency.formatInputValue($venda("#valorDescontoVenda").value);
    }
    atualizarResumoVenda();
  });
  $venda("#formaPagamentoVenda")?.addEventListener("change", atualizarTroco);
  $venda("#valorRecebidoVendaTela")?.addEventListener("input", () => {
    $venda("#valorRecebidoVendaTela").value = window.vstockCurrency.formatInputValue($venda("#valorRecebidoVendaTela").value);
    atualizarTroco();
  });
  $venda("#clienteVendaCpfCnpj")?.addEventListener("input", (event) => {
    event.target.value = window.vstockMasks.cpfCnpj(event.target.value);
  });
  $venda("#clienteVendaTelefone")?.addEventListener("input", (event) => {
    event.target.value = window.vstockMasks.phone(event.target.value);
  });
  $venda("#codigoBarrasVenda")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      processarLeituraCodigoBarras();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".produto-busca-grupo")) {
      fecharDropdownProdutos();
    }
  });

  $venda("#dropdownProdutosVenda")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button[data-value]");
    if (!botao) return;

    const produto = produtosVendaCache.find((item) => String(item.prod_cod) === String(botao.dataset.value));
    if (produto) selecionarProduto(produto);
  });

  $venda("#tabelaItensVenda tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const indice = Number(botao.dataset.idx);
    if (botao.dataset.acao === "editar-item") {
      carregarItemParaEdicao(indice);
    }
    if (botao.dataset.acao === "remover-item") {
      removerItemVenda(indice);
    }
  });

  $venda("#tabelaFormasPagamento tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const item = formasPagamentoCache.find((forma) => Number(forma.formaPagamentoId ?? forma.forma_pagamento_id) === id);
    if (!item) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioFormaPagamento(item);
    }
    if (botao.dataset.acao === "status") {
      alternarStatusFormaPagamento(id, botao.dataset.ativo === "true");
    }
  });
});

