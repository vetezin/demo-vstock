const API_VENDAS = {
  ESTOQUE_RESUMO: "http://localhost:8080/api/estoque/resumo?ativosOnly=true",
  PRODUTOS: "http://localhost:8080/api/produtos/lista?ativosOnly=true",
  CLIENTES: "http://localhost:8080/api/cliente/all?ativosOnly=true",
  CLIENTE_NOVO: "http://localhost:8080/api/cliente",
  FORMAS_PAGAMENTO: "http://localhost:8080/api/forma-pagamento/all",
  FORMA_PAGAMENTO_NOVO: "http://localhost:8080/api/forma-pagamento",
  FORMA_PAGAMENTO_ATUALIZAR: (id) => `http://localhost:8080/api/forma-pagamento/${id}`,
  FORMA_PAGAMENTO_STATUS: (id, ativo) => `http://localhost:8080/api/forma-pagamento/${id}/status?ativo=${ativo}`,
  VENDAS: "http://localhost:8080/api/vendas",
  VENDA_DIVIDIDA: "http://localhost:8080/api/vendas/dividida"
  };

const $venda = (selector) => document.querySelector(selector);
const msgVenda = window.vstockUi.createAlertHandler({ container: "#mensagens", clear: true, autoRemoveMs: 4500 });

let produtosVendaCache = [];
let clientesVendaCache = [];
let formasPagamentoCache = [];
let itensDaVenda = [];
let debounceBuscaProdutoVenda = null;
let produtosVisiveisVenda = [];
let modalFormaPagamento = null;
let modalClienteVenda = null;
let aoCadastrarCliente = null;
let modalConfirmarVenda = null;
let formaPagamentoEditandoId = null;
let pagamentosDivididosVenda = [];
let paginaAtualProdutos = 1;

const PRODUTOS_POR_PAGINA = 12;
const NOME_CLIENTE_NAO_IDENTIFICADO = "Consumidor não identificado";

function alternarModoVendas(modo) {
  const vendaRapida = document.getElementById("visaoVendaRapida");
  const mesas = document.getElementById("visaoMesas");
  const botoes = [document.getElementById("btnModoVendaRapida"), document.getElementById("btnModoMesas")];
  const mesasAtivas = modo === "mesas";

  vendaRapida?.classList.toggle("d-none", mesasAtivas);
  mesas?.classList.toggle("d-none", !mesasAtivas);
  botoes.forEach((botao, indice) => {
    const ativo = mesasAtivas ? indice === 1 : indice === 0;
    botao?.classList.toggle("is-active", ativo);
    botao?.setAttribute("aria-selected", String(ativo));
  });

  if (mesasAtivas) {
    window.vstockMesas?.carregar().catch((erro) => msgVenda(erro.message, "danger"));
  }
}

function fecharTodosCustomSelects(excetoId = "") {
  document.querySelectorAll(".pdv-custom-select").forEach((wrapper) => {
    const alvo = wrapper.getAttribute("data-custom-select") || "";
    if (excetoId && alvo === excetoId) return;
    wrapper.classList.remove("is-open");
    const toggle = wrapper.querySelector(".pdv-custom-select-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function sincronizarCustomSelect(selectId) {
  const select = $venda(`#${selectId}`);
  const wrapper = document.querySelector(`[data-custom-select="${selectId}"]`);
  const label = document.querySelector(`[data-custom-select-label="${selectId}"]`);
  const menu = document.querySelector(`[data-custom-select-menu="${selectId}"]`);
  if (!select || !wrapper || !label || !menu) return;

  const valorAtual = String(select.value || "");
  const opcaoAtual = select.selectedOptions?.[0];
  label.textContent = opcaoAtual?.textContent?.trim() || "Selecionar";

  if (selectId === "clienteVenda" && renderizarOpcoesClienteVenda(select, menu, valorAtual)) {
    return;
  }

  menu.innerHTML = Array.from(select.options).map((option) => {
    const ativo = String(option.value || "") === valorAtual ? " is-active" : "";
    return `
      <button type="button" class="pdv-custom-select-option${ativo}" data-custom-option="${selectId}" data-value="${option.value}">
        <span>${option.textContent}</span>
        <i class="bi bi-check-lg pdv-custom-select-option-check"></i>
      </button>
    `;
  }).join("");
}

function normalizarTextoBusca(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function obterClientePadraoVenda() {
  const nomePadrao = normalizarTextoBusca(NOME_CLIENTE_NAO_IDENTIFICADO);
  return clientesVendaCache.find((cliente) => normalizarTextoBusca(cliente.nome) === nomePadrao) || null;
}

function selecionarClientePadraoVenda() {
  const select = $venda("#clienteVenda");
  const clientePadrao = obterClientePadraoVenda();
  if (!select || !clientePadrao) return false;

  select.value = String(clientePadrao.clienteId ?? clientePadrao.cliente_id);
  sincronizarCustomSelect("clienteVenda");
  return true;
}

function renderizarOpcoesClienteVenda(select, menu, valorAtual) {
  const container = menu.querySelector('[data-custom-select-options="clienteVenda"]');
  if (!container) return false;

  const busca = normalizarTextoBusca(menu.querySelector("#buscaClienteVenda")?.value);
  const opcoes = Array.from(select.options).filter((option) =>
    normalizarTextoBusca(option.textContent).includes(busca)
  );
  container.replaceChildren();

  if (!opcoes.length) {
    const vazio = document.createElement("p");
    vazio.className = "pdv-client-select-empty";
    vazio.textContent = "Nenhum cliente encontrado.";
    container.appendChild(vazio);
    return true;
  }

  opcoes.forEach((option) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `pdv-custom-select-option${String(option.value || "") === valorAtual ? " is-active" : ""}`;
    botao.dataset.customOption = "clienteVenda";
    botao.dataset.value = option.value;

    const nome = document.createElement("span");
    nome.textContent = option.textContent || "Cliente";
    const icone = document.createElement("i");
    icone.className = "bi bi-check-lg pdv-custom-select-option-check";
    botao.append(nome, icone);
    container.appendChild(botao);
  });
  return true;
}

function registrarCustomSelect(selectId) {
  const select = $venda(`#${selectId}`);
  const wrapper = document.querySelector(`[data-custom-select="${selectId}"]`);
  const toggle = document.querySelector(`[data-custom-select-toggle="${selectId}"]`);
  const menu = document.querySelector(`[data-custom-select-menu="${selectId}"]`);
  if (!select || !wrapper || !toggle || !menu || wrapper.dataset.bound === "true") return;

  wrapper.dataset.bound = "true";

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const vaiAbrir = !wrapper.classList.contains("is-open");
    fecharTodosCustomSelects(vaiAbrir ? selectId : "");
    wrapper.classList.toggle("is-open", vaiAbrir);
    toggle.setAttribute("aria-expanded", vaiAbrir ? "true" : "false");
    if (vaiAbrir && selectId === "clienteVenda") {
      window.setTimeout(() => menu.querySelector("#buscaClienteVenda")?.focus(), 0);
    }
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest(`[data-custom-option="${selectId}"]`);
    if (!option) return;

    select.value = String(option.dataset.value || "");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (selectId === "clienteVenda") {
      const busca = menu.querySelector("#buscaClienteVenda");
      if (busca) busca.value = "";
    }
    sincronizarCustomSelect(selectId);
    fecharTodosCustomSelects();
  });

  select.addEventListener("change", () => {
    sincronizarCustomSelect(selectId);
  });

  if (selectId === "clienteVenda") {
    menu.querySelector("#buscaClienteVenda")?.addEventListener("input", () => {
      sincronizarCustomSelect(selectId);
    });
  }

  sincronizarCustomSelect(selectId);
}

function obterCategoriaProduto(produto) {
  const categoriaObj = produto?.categoria;
  const categoriaAninhada =
    categoriaObj?.catDescr ||
    categoriaObj?.cat_descr ||
    categoriaObj?.descricao ||
    categoriaObj?.nome;

  return String(
    categoriaAninhada ||
    produto?.categoria ||
    produto?.categoriaNome ||
    produto?.categoria_nome ||
    produto?.categoriaDescricao ||
    produto?.categoria_descricao ||
    produto?.nomeCategoria ||
    produto?.nome_categoria ||
    produto?.grupo ||
    produto?.grupoDescricao ||
    produto?.grupo_descricao ||
    "Sem categoria"
  ).trim() || "Sem categoria";
}

function obterCodigoProduto(produto) {
  return String(
    produto?.prod_cod ??
    produto?.prodCod ??
    ""
  ).trim();
}

function enriquecerProdutosComCategoria(estoqueResumo, produtosCompletos) {
  const produtosPorCodigo = new Map(
    (Array.isArray(produtosCompletos) ? produtosCompletos : []).map((produto) => [
      obterCodigoProduto(produto),
      produto
    ])
  );

  return (Array.isArray(estoqueResumo) ? estoqueResumo : []).map((produtoResumo) => {
    const produtoCompleto = produtosPorCodigo.get(obterCodigoProduto(produtoResumo));
    if (!produtoCompleto) {
      return produtoResumo;
    }

    return {
      ...produtoCompleto,
      ...produtoResumo,
      categoria: produtoCompleto.categoria ?? produtoResumo.categoria,
      categoriaNome:
        produtoCompleto.categoria?.catDescr ??
        produtoCompleto.categoria?.cat_descr ??
        produtoCompleto.categoriaNome ??
        produtoResumo.categoriaNome ??
        produtoResumo.categoria
    };
  });
}

function popularCategoriasVenda() {
  const select = $venda("#filtroCategoriaVenda");
  if (!select) return;

  const atual = select.value || "";
  const categorias = Array.from(new Set(
    produtosVendaCache.map((produto) => obterCategoriaProduto(produto))
  )).sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = `<option value="">Todas categorias</option>`;
  categorias.forEach((categoria) => {
    const option = document.createElement("option");
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  });

  if (atual && categorias.includes(atual)) {
    select.value = atual;
  }

  sincronizarCustomSelect("filtroCategoriaVenda");
}

function parseMoeda(valor) {
  return window.vstockCurrency.parse(valor || "");
}

function carregarFuncionarioLogado() {
  return window.vstockSession.getFuncionario();
}

function localizarProdutoPorCodigoBarras(codigo) {
  return window.vstockProducts.findByBarcode(produtosVendaCache, codigo, "codigo_barras");
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
  $venda("#formaPagamentoTaxa").value = "0";
  atualizarModoEdicaoFormaPagamento();
}

function preencherFormularioFormaPagamento(item) {
  formaPagamentoEditandoId = item.formaPagamentoId ?? item.forma_pagamento_id;
  $venda("#formaPagamentoIdEdicao").value = String(formaPagamentoEditandoId);
  $venda("#formaPagamentoNome").value = item.nome ?? "";
  $venda("#formaPagamentoTaxa").value = Number(item.taxaPercentual ?? item.taxa_percentual ?? 0).toFixed(2);
  atualizarModoEdicaoFormaPagamento();
  $venda("#formaPagamentoNome")?.focus();
}

function renderizarTabelaFormasPagamento() {
  const tbody = $venda("#tabelaFormasPagamento tbody");
  if (!tbody) return;

  tbody.innerHTML = formasPagamentoCache.map((item) => {
    const id = item.formaPagamentoId ?? item.forma_pagamento_id;
    const ativo = item.ativo !== false;
    const taxa = Number(item.taxaPercentual ?? item.taxa_percentual ?? 0);
    return `
      <tr>
        <td>${item.nome ?? "-"}</td>
        <td>${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
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

function iconeFormaPagamento(nome) {
  const normalizado = String(nome || "").trim().toLowerCase();
  if (normalizado.includes("pix")) return "bi-qr-code";
  if (normalizado.includes("cart")) return "bi-credit-card";
  if (normalizado.includes("dinheiro")) return "bi-cash";
  return "bi-wallet2";
}

function renderizarOpcoesPagamentoPdv() {
  const container = $venda("#pdvPaymentOptions");
  const select = $venda("#formaPagamentoVenda");
  if (!container || !select) return;

  const valorAtual = String(select.value || "");
  const opcoes = formasPagamentoCache.filter((item) => item.ativo !== false);
  container.innerHTML = opcoes.map((item) => {
    const id = String(item.formaPagamentoId ?? item.forma_pagamento_id);
    const ativo = id === valorAtual ? " is-active" : "";
    return `
      <button type="button" class="pdv-payment-option${ativo}" data-forma-pagamento="${id}">
        <i class="bi ${iconeFormaPagamento(item.nome)}"></i>
        <span>${item.nome}</span>
      </button>
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

  renderizarOpcoesPagamentoPdv();
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
  const taxaPercentual = Number($venda("#formaPagamentoTaxa")?.value ?? 0);
  if (!nome) {
    msgVenda("Informe o nome da forma de pagamento.", "danger");
    return;
  }
  if (!Number.isFinite(taxaPercentual) || taxaPercentual < 0 || taxaPercentual > 100) {
    msgVenda("Informe uma taxa entre 0 e 100%.", "danger");
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
      body: JSON.stringify({ nome, taxaPercentual: Number(taxaPercentual.toFixed(2)) })
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

    const clientePadrao = obterClientePadraoVenda();
    if (!clientePadrao) throw new Error("Cliente padrão 'Consumidor não identificado' não encontrado.");

    const valorSelecionado = String(select.value || "");
    const clientesOrdenados = [
      clientePadrao,
      ...clientesVendaCache.filter((cliente) =>
        String(cliente.clienteId ?? cliente.cliente_id) !== String(clientePadrao.clienteId ?? clientePadrao.cliente_id)
      )
    ];
    select.replaceChildren();
    clientesOrdenados.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = String(cliente.clienteId ?? cliente.cliente_id);
      option.textContent = cliente.nome ?? "Cliente";
      select.appendChild(option);
    });

    select.value = Array.from(select.options).some((option) => option.value === valorSelecionado)
      ? valorSelecionado
      : String(clientePadrao.clienteId ?? clientePadrao.cliente_id);
    sincronizarCustomSelect("clienteVenda");
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
      sincronizarCustomSelect("clienteVenda");
      aoCadastrarCliente?.(clienteSalvo);
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
    renderizarProdutosPdv([]);
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
  renderizarProdutosPdv(lista);
}

function renderizarProdutosPdv(lista) {
  const grid = $venda("#pdvProductGrid");
  const count = $venda("#pdvProductCount");
  const resumo = $venda("#pdvProductsSummary");
  const paginacao = $venda("#pdvPagination");
  if (!grid || !count) return;

  count.textContent = `${lista.length} item${lista.length === 1 ? "" : "s"}`;

  if (!lista.length) {
    grid.innerHTML = `
      <div class="pdv-empty-state">
        <i class="bi bi-search"></i>
        <strong>Nenhum produto encontrado</strong>
        <span>Ajuste a busca ou o filtro de categoria.</span>
      </div>
    `;
    if (resumo) resumo.textContent = "Mostrando 0-0 de 0 produtos";
    if (paginacao) paginacao.innerHTML = "";
    return;
  }

  const totalItens = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / PRODUTOS_POR_PAGINA));
  paginaAtualProdutos = Math.min(Math.max(1, paginaAtualProdutos), totalPaginas);

  const inicio = (paginaAtualProdutos - 1) * PRODUTOS_POR_PAGINA;
  const fim = Math.min(inicio + PRODUTOS_POR_PAGINA, totalItens);
  const paginaItens = lista.slice(inicio, fim);

  grid.innerHTML = paginaItens.map((produto) => {
    const saldo = Number(produto?.saldo || 0);
    const categoria = obterCategoriaProduto(produto);
    const classe = saldo <= 0 ? " pdv-product-card is-out" : " pdv-product-card";
    return `
      <button type="button" class="${classe.trim()}" data-produto-card="${produto.prod_cod}" aria-disabled="${saldo <= 0 ? "true" : "false"}">
        <div class="pdv-product-meta">
          <span class="pdv-category-pill">${categoria}</span>
          <span class="pdv-stock-inline">${saldo} un</span>
        </div>
        <div>
          <p class="pdv-product-name">${produto.prod_descr || "Produto"}</p>
        </div>
        <p class="pdv-product-price">${window.vstockCurrency.formatMoney(obterValorUnitarioProduto(produto))}</p>
      </button>
    `;
  }).join("");

  if (resumo) {
    resumo.textContent = `Mostrando ${inicio + 1}-${fim} de ${totalItens} produtos`;
  }

  renderizarPaginacaoProdutos(totalPaginas);
}

function renderizarPaginacaoProdutos(totalPaginas) {
  const container = $venda("#pdvPagination");
  if (!container) return;

  if (totalPaginas <= 1) {
    container.innerHTML = "";
    return;
  }

  const paginas = [];
  const inicio = Math.max(1, paginaAtualProdutos - 1);
  const fim = Math.min(totalPaginas, inicio + 2);

  for (let pagina = inicio; pagina <= fim; pagina += 1) {
    const ativa = pagina === paginaAtualProdutos ? " is-active" : "";
    paginas.push(`
      <button type="button" class="pdv-pagination-page${ativa}" data-page="${pagina}">${pagina}</button>
    `);
  }

  container.innerHTML = `
    <button type="button" class="pdv-pagination-btn" data-page-nav="prev" ${paginaAtualProdutos === 1 ? "disabled" : ""}>Anterior</button>
    ${paginas.join("")}
    <button type="button" class="pdv-pagination-btn" data-page-nav="next" ${paginaAtualProdutos === totalPaginas ? "disabled" : ""}>Próxima</button>
  `;
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
  $venda("#valorUnitarioVenda").value = window.vstockCurrency.formatNumber(obterValorUnitarioProduto(produto));
  atualizarSubtotalItemAtual();
}

function atualizarSubtotalItemAtual() {
  const produto = localizarProdutoSelecionado();
  const quantidade = Number($venda("#quantidadeVenda")?.value || 0);
  if (!produto || quantidade <= 0) {
    $venda("#subtotalItemVenda").value = window.vstockCurrency.formatNumber(0);
    return;
  }

  const subtotal = quantidade * obterValorUnitarioProduto(produto);
  $venda("#subtotalItemVenda").value = window.vstockCurrency.formatNumber(subtotal);
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
      <td class="text-end">${window.vstockCurrency.formatMoney(item.valorUnitario)}</td>
      <td class="text-end">${window.vstockCurrency.formatMoney(item.valorSubtotal)}</td>
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

  renderizarCarrinhoPdv();
  atualizarResumoVenda();
}

function limparFormularioItem() {
  $venda("#buscaProdutoVenda").value = "";
  $venda("#codigoBarrasVenda").value = "";
  $venda("#listaProdutosVenda").value = "";
  $venda("#saldoProdutoVenda").value = "";
  $venda("#quantidadeVenda").value = "";
  $venda("#valorUnitarioVenda").value = window.vstockCurrency.formatNumber(0);
  $venda("#subtotalItemVenda").value = window.vstockCurrency.formatNumber(0);
  fecharDropdownProdutos();
  filtrarProdutos(false);
}

function adicionarProdutoAoCarrinho(produto, quantidade) {
  const qtd = Number(quantidade || 0);

  if (!produto) {
    msgVenda("Selecione um produto.", "danger");
    return;
  }

  if (!Number.isInteger(qtd) || qtd <= 0) {
    msgVenda("Informe uma quantidade válida.", "danger");
    return;
  }

  const saldo = Number(produto.saldo || 0);
  const reservado = quantidadeReservadaProduto(produto.prod_cod);
  if (qtd + reservado > saldo) {
    msgVenda("A quantidade informada ultrapassa o saldo disponível.", "danger");
    return;
  }

  const valorUnitario = obterValorUnitarioProduto(produto);
  const itemExistente = itensDaVenda.find((item) => Number(item.prodCod) === Number(produto.prod_cod));

  if (itemExistente) {
    itemExistente.qtd += qtd;
    itemExistente.valorSubtotal = Number((Number(itemExistente.valorUnitario || valorUnitario) * itemExistente.qtd).toFixed(2));
  } else {
    const valorSubtotal = Number((valorUnitario * qtd).toFixed(2));

    itensDaVenda.push({
      prodCod: Number(produto.prod_cod),
      descrProduto: produto.prod_descr || "",
      saldo,
      qtd,
      valorUnitario,
      valorSubtotal
    });
  }

  limparFormularioItem();
  renderizarItensVenda();
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
  const itemExistente = itensDaVenda.find((item) => Number(item.prodCod) === Number(produto.prod_cod));

  if (itemExistente) {
    itemExistente.qtd += quantidade;
    itemExistente.valorSubtotal = Number((Number(itemExistente.valorUnitario || valorUnitario) * itemExistente.qtd).toFixed(2));
  } else {
    const valorSubtotal = Number((valorUnitario * quantidade).toFixed(2));

    itensDaVenda.push({
      prodCod: Number(produto.prod_cod),
      descrProduto: produto.prod_descr || "",
      saldo,
      qtd: quantidade,
      valorUnitario,
      valorSubtotal
    });
  }

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

function ajustarQuantidadeItem(indice, delta) {
  const item = itensDaVenda[indice];
  if (!item) return;

  const proximaQuantidade = Number(item.qtd || 0) + Number(delta || 0);
  if (proximaQuantidade <= 0) {
    removerItemVenda(indice);
    return;
  }

  const reservado = quantidadeReservadaProduto(item.prodCod, indice);
  if (proximaQuantidade + reservado > Number(item.saldo || 0)) {
    msgVenda("A quantidade informada ultrapassa o saldo disponível.", "danger");
    return;
  }

  item.qtd = proximaQuantidade;
  item.valorSubtotal = Number((Number(item.valorUnitario || 0) * proximaQuantidade).toFixed(2));
  renderizarItensVenda();
}

function renderizarCarrinhoPdv() {
  const lista = $venda("#pdvCartItems");
  const badge = $venda("#pdvCartCount");
  if (!lista || !badge) return;

  badge.textContent = String(itensDaVenda.reduce((total, item) => total + Number(item.qtd || 0), 0));

  if (!itensDaVenda.length) {
    lista.innerHTML = `
      <div class="pdv-empty-state">
        <i class="bi bi-cart-x"></i>
        <strong>Nenhum item no carrinho</strong>
        <span>Adicione produtos da lista para iniciar a venda.</span>
      </div>
    `;
    return;
  }

  lista.innerHTML = itensDaVenda.map((item, indice) => `
    <article class="pdv-cart-item">
      <div class="pdv-cart-copy">
        <strong>${item.descrProduto}</strong>
        <small>${window.vstockCurrency.formatMoney(item.valorUnitario)}</small>
      </div>
      <div class="pdv-qty-controls">
        <button type="button" class="pdv-qty-btn" data-acao="diminuir-item" data-idx="${indice}">−</button>
        <span class="pdv-qty-value">${item.qtd}</span>
        <button type="button" class="pdv-qty-btn" data-acao="aumentar-item" data-idx="${indice}">+</button>
      </div>
      <strong class="pdv-cart-total">${window.vstockCurrency.formatMoney(item.valorSubtotal)}</strong>
      <button type="button" class="pdv-cart-remove" data-acao="remover-item" data-idx="${indice}" aria-label="Remover item">
        <i class="bi bi-trash"></i>
      </button>
    </article>
  `).join("");
}

async function carregarProdutos() {
  try {
    const [respEstoque, respProdutos] = await Promise.all([
      fetch(API_VENDAS.ESTOQUE_RESUMO),
      fetch(API_VENDAS.PRODUTOS)
    ]);

    if (!respEstoque.ok) throw new Error("Falha ao carregar estoque.");
    if (!respProdutos.ok) throw new Error("Falha ao carregar produtos.");

    const [estoqueResumo, produtosCompletos] = await Promise.all([
      respEstoque.json(),
      respProdutos.json()
    ]);

    produtosVendaCache = enriquecerProdutosComCategoria(estoqueResumo, produtosCompletos);
    popularCategoriasVenda();
    desenharSelectProdutos(produtosVendaCache);
  } catch (erro) {
    console.error(erro);
    msgVenda("Não foi possível carregar os produtos disponíveis.", "danger");
  }
}

function filtrarProdutos(resetPage = true) {
  const termo = ($venda("#buscaProdutoVenda")?.value || "").trim().toLowerCase();
  const categoria = ($venda("#filtroCategoriaVenda")?.value || "").trim();
  if (resetPage) {
    paginaAtualProdutos = 1;
  }

  const filtrados = produtosVendaCache.filter((produto) => {
    const descricao = String(produto.prod_descr || "").toLowerCase();
    const codigo = String(produto.codigo_barras || "").toLowerCase();
    const categoriaProduto = obterCategoriaProduto(produto);
    const matchTermo = !termo || descricao.includes(termo) || codigo.includes(termo);
    const matchCategoria = !categoria || categoriaProduto === categoria;
    return matchTermo && matchCategoria;
  });

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
  const codigo = window.vstockText.normalizeCode(inputCodigo?.value);
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

function atualizarEstadoCampoDesconto() {
  const tipo = $venda("#tipoDescontoVenda")?.value || "NENHUM";
  const input = $venda("#valorDescontoVenda");
  const sufixo = $venda("#sufixoDescontoVenda");
  const caixa = input?.closest(".pdv-discount-box");
  if (!input || !sufixo) return;

  const descontoHabilitado = tipo !== "NENHUM";
  input.disabled = !descontoHabilitado;
  caixa?.classList.toggle("is-disabled", !descontoHabilitado);

  if (!descontoHabilitado) {
    input.value = "";
    input.placeholder = "0,00";
    sufixo.textContent = "R$";
    return;
  }

  if (tipo === "PERCENTUAL") {
    input.placeholder = "0";
    sufixo.textContent = "%";
    input.value = String(input.value || "").replace(/[^\d,]/g, "");
    return;
  }

  input.placeholder = "0,00";
  sufixo.textContent = "R$";
  input.value = window.vstockCurrency.formatInputValue(input.value);
}

function obterTotalVenda() {
  const subtotal = obterSubtotalVenda();
  const desconto = calcularDescontoAtual();
  return Math.max(subtotal - desconto, 0);
}

function vendaDivididaEstaAtiva() {
  return Boolean($venda("#vendaDivididaAtiva")?.checked);
}

function nomeFormaPagamentoPorId(id) {
  return formasPagamentoCache.find((item) => String(item.formaPagamentoId ?? item.forma_pagamento_id) === String(id))?.nome || "";
}

function formaPagamentoEhDinheiroPorId(id) {
  return nomeFormaPagamentoPorId(id).trim().toLowerCase() === "dinheiro";
}

function distribuirPagamentosIgualmente() {
  if (!vendaDivididaEstaAtiva()) return;
  const quantidade = Math.max(2, Math.min(20, Number($venda("#quantidadePagadoresVenda")?.value || 2)));
  const totalCentavos = Math.round(obterTotalVenda() * 100);
  const valorBase = Math.floor(totalCentavos / quantidade);
  const resto = totalCentavos - (valorBase * quantidade);

  pagamentosDivididosVenda = Array.from({ length: quantidade }, (_, indice) => ({
    formaPagamentoId: pagamentosDivididosVenda[indice]?.formaPagamentoId || "",
    valor: (valorBase + (indice === 0 ? resto : 0)) / 100,
    valorRecebido: formaPagamentoEhDinheiroPorId(pagamentosDivididosVenda[indice]?.formaPagamentoId)
      ? Math.max(Number(pagamentosDivididosVenda[indice]?.valorRecebido || 0), (valorBase + (indice === 0 ? resto : 0)) / 100)
      : null
  }));
  renderizarPagamentosDivididos();
}

function opcoesFormaPagamentoDividida(selecionado) {
  return `<option value="">Selecione...</option>` + formasPagamentoCache
    .filter((item) => item.ativo !== false)
    .map((item) => {
      const id = String(item.formaPagamentoId ?? item.forma_pagamento_id);
      return `<option value="${id}" ${id === String(selecionado || "") ? "selected" : ""}>${item.nome || "-"}</option>`;
    }).join("");
}

function obterSaldoPagamentosDivididos() {
  const informado = pagamentosDivididosVenda.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
  return Number((obterTotalVenda() - informado).toFixed(2));
}

function atualizarSaldoPagamentosDivididos() {
  const elemento = $venda("#saldoPagamentosDivididos");
  if (!elemento) return;
  const saldo = obterSaldoPagamentosDivididos();
  elemento.classList.toggle("is-complete", saldo === 0);
  elemento.classList.toggle("is-invalid", saldo < 0);
  elemento.querySelector("span").textContent = saldo < 0 ? "Valor excedente" : saldo === 0 ? "Total distribuído" : "Falta distribuir";
  elemento.querySelector("strong").textContent = window.vstockCurrency.formatMoney(Math.abs(saldo));
}

function renderizarPagamentosDivididos() {
  const container = $venda("#pagamentosDivididosVenda");
  if (!container) return;

  container.innerHTML = pagamentosDivididosVenda.map((pagamento, indice) => {
    const dinheiro = formaPagamentoEhDinheiroPorId(pagamento.formaPagamentoId);
    const troco = dinheiro ? Math.max(Number(pagamento.valorRecebido || 0) - Number(pagamento.valor || 0), 0) : 0;
    return `
      <div class="pdv-split-payment" data-pagamento-indice="${indice}">
        <div class="pdv-split-payment-header"><strong>Pessoa ${indice + 1}</strong><span>${window.vstockCurrency.formatMoney(pagamento.valor)}</span></div>
        <div class="pdv-split-payment-fields">
          <div class="pdv-field-group">
            <label class="pdv-field-label" for="formaPagamentoDiv-${indice}">Forma de pagamento</label>
            <select id="formaPagamentoDiv-${indice}" class="form-select" data-campo="forma">${opcoesFormaPagamentoDividida(pagamento.formaPagamentoId)}</select>
          </div>
          <div class="pdv-field-group">
            <label class="pdv-field-label" for="valorPagamentoDiv-${indice}">Valor</label>
            <input id="valorPagamentoDiv-${indice}" class="form-control" data-campo="valor" inputmode="decimal" value="${window.vstockCurrency.formatNumber(pagamento.valor)}"/>
          </div>
          <div class="pdv-split-cash-fields ${dinheiro ? "" : "d-none"}">
            <div class="pdv-field-group">
              <label class="pdv-field-label" for="recebidoPagamentoDiv-${indice}">Valor recebido</label>
              <input id="recebidoPagamentoDiv-${indice}" class="form-control" data-campo="recebido" inputmode="decimal" value="${window.vstockCurrency.formatNumber(pagamento.valorRecebido ?? pagamento.valor)}"/>
            </div>
            <div class="pdv-field-group">
              <label class="pdv-field-label">Troco</label>
              <input class="form-control" value="${window.vstockCurrency.formatNumber(troco)}" disabled/>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");
  atualizarSaldoPagamentosDivididos();
}

function alternarVendaDividida() {
  const ativa = vendaDivididaEstaAtiva();
  $venda(".pdv-split-toggle")?.classList.toggle("is-active", ativa);
  $venda("#blocoVendaDividida")?.classList.toggle("d-none", !ativa);
  $venda("#pdvPaymentOptions")?.classList.toggle("d-none", ativa);
  $venda("#blocoValorRecebidoVenda")?.classList.add("d-none");
  $venda("#blocoTrocoVenda")?.classList.add("d-none");
  if (ativa) distribuirPagamentosIgualmente();
  else {
    pagamentosDivididosVenda = [];
    atualizarVisibilidadePagamentoDinheiro();
  }
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
  const formaPagamentoId = $venda("#formaPagamentoVenda")?.value || "";
  const valorRecebido = obterValorRecebidoAtual();

  if (!dataVenda) {
    throw new Error("Informe a data da venda.");
  }
  if (!itensDaVenda.length) {
    throw new Error("Adicione pelo menos um item à venda.");
  }
  if (!vendaDivididaEstaAtiva() && !formaPagamentoId) {
    throw new Error("Selecione a forma de pagamento.");
  }
  if (!vendaDivididaEstaAtiva() && formaPagamentoSelecionadaEhDinheiro() && valorRecebido < obterTotalVenda()) {
    throw new Error("O valor recebido deve ser maior ou igual ao total da venda.");
  }
  if (vendaDivididaEstaAtiva()) {
    if (pagamentosDivididosVenda.length < 2) throw new Error("Informe pelo menos duas pessoas para dividir a venda.");
    if (pagamentosDivididosVenda.some((pagamento) => !pagamento.formaPagamentoId || Number(pagamento.valor || 0) <= 0)) {
      throw new Error("Preencha a forma e o valor de todos os pagamentos.");
    }
    if (obterSaldoPagamentosDivididos() !== 0) throw new Error("A soma dos pagamentos deve ser igual ao total da venda.");
    if (pagamentosDivididosVenda.some((pagamento) => formaPagamentoEhDinheiroPorId(pagamento.formaPagamentoId) && Number(pagamento.valorRecebido || 0) < Number(pagamento.valor || 0))) {
      throw new Error("O valor recebido em dinheiro deve cobrir a parte informada.");
    }
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
  const deveExibir = !vendaDivididaEstaAtiva() && formaPagamentoSelecionadaEhDinheiro();

  blocoValorRecebido?.classList.toggle("d-none", !deveExibir);
  blocoTroco?.classList.toggle("d-none", !deveExibir);

  if (!deveExibir) {
    if (valorRecebidoInput) {
      valorRecebidoInput.value = "";
    }
    if (trocoInput) {
      trocoInput.value = window.vstockCurrency.formatNumber(0);
    }
  }

  renderizarOpcoesPagamentoPdv();
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
  trocoInput.value = window.vstockCurrency.formatNumber(troco);
}

function atualizarResumoVenda() {
  atualizarTroco();
  const subtotal = obterSubtotalVenda();
  const desconto = calcularDescontoAtual();
  const total = obterTotalVenda();

  const subtotalEl = $venda("#pdvSubtotal");
  const descontoEl = $venda("#pdvDiscountSummary");
  const totalEl = $venda("#pdvTotal");

  if (subtotalEl) subtotalEl.textContent = window.vstockCurrency.formatMoney(subtotal);
  if (descontoEl) descontoEl.textContent = window.vstockCurrency.formatMoney(desconto);
  if (totalEl) totalEl.textContent = window.vstockCurrency.formatMoney(total);
  if (vendaDivididaEstaAtiva()) distribuirPagamentosIgualmente();
}

function limparVendaCompleta() {
  itensDaVenda = [];
  $venda("#dataVenda").value = window.vstockFormatters.nowInputLocal();
  selecionarClientePadraoVenda();
  $venda("#statusVenda").value = "FINALIZADA";
  $venda("#tipoDescontoVenda").value = "NENHUM";
  $venda("#valorDescontoVenda").value = "";
  atualizarEstadoCampoDesconto();
  $venda("#observacaoVenda").value = "";
  $venda("#formaPagamentoVenda").value = "";
  $venda("#valorRecebidoVendaTela").value = "";
  $venda("#trocoVendaTela").value = window.vstockCurrency.formatNumber(0);
  $venda("#vendaDivididaAtiva").checked = false;
  $venda("#quantidadePagadoresVenda").value = "2";
  pagamentosDivididosVenda = [];
  alternarVendaDividida();
  limparFormularioItem();
  renderizarItensVenda();
  atualizarVisibilidadePagamentoDinheiro();
  sincronizarCustomSelect("clienteVenda");
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
  const dividida = vendaDivididaEstaAtiva();
  const exibeRecebido = !dividida && formaPagamentoSelecionadaEhDinheiro();
  const listaDividida = $venda("#resumoConfirmacaoVendaPagamentosDivididos");

  if (tbody) {
    tbody.innerHTML = itensDaVenda.map((item) => `
      <tr>
        <td>${item.descrProduto}</td>
        <td class="text-end">${item.qtd}</td>
        <td class="text-end">${window.vstockCurrency.formatMoney(item.valorUnitario)}</td>
        <td class="text-end">${window.vstockCurrency.formatMoney(item.valorSubtotal)}</td>
      </tr>
    `).join("");
  }

  $venda("#resumoConfirmacaoVendaSubtotal").textContent = window.vstockCurrency.formatMoney(subtotal);
  $venda("#resumoConfirmacaoVendaDesconto").textContent = window.vstockCurrency.formatMoney(desconto);
  $venda("#resumoConfirmacaoVendaTotal").textContent = window.vstockCurrency.formatMoney(total);
  $venda("#resumoConfirmacaoVendaFormaPagamento").textContent = dividida ? "Pagamento dividido" : formaPagamentoNome;

  linhaRecebido?.classList.toggle("d-none", !exibeRecebido);
  linhaTroco?.classList.toggle("d-none", !exibeRecebido);

  if (exibeRecebido) {
    $venda("#resumoConfirmacaoVendaRecebido").textContent = window.vstockCurrency.formatMoney(valorRecebido);
    $venda("#resumoConfirmacaoVendaTroco").textContent = window.vstockCurrency.formatMoney(troco);
  }
  listaDividida?.classList.toggle("d-none", !dividida);
  if (dividida && listaDividida) {
    listaDividida.innerHTML = `<div class="venda-split-confirmation-list">${pagamentosDivididosVenda.map((pagamento, indice) => `
      <div class="venda-split-confirmation-item">
        <span>Pessoa ${indice + 1} · ${nomeFormaPagamentoPorId(pagamento.formaPagamentoId)}</span>
        <strong>${window.vstockCurrency.formatMoney(pagamento.valor)}</strong>
      </div>`).join("")}</div>`;
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
  const clienteId = $venda("#clienteVenda")?.value || "";
  const formaPagamentoId = $venda("#formaPagamentoVenda")?.value || "";
  const tipoDesconto = $venda("#tipoDescontoVenda")?.value || "NENHUM";
  const valorDesconto = parseMoeda($venda("#valorDescontoVenda")?.value || "");
  const valorRecebido = parseMoeda($venda("#valorRecebidoVendaTela")?.value || "");

  if (!dataVenda) {
    msgVenda("Informe a data da venda.", "danger");
    return;
  }
  if (!itensDaVenda.length) {
    msgVenda("Adicione pelo menos um item à venda.", "danger");
    return;
  }
  if (!vendaDivididaEstaAtiva() && !formaPagamentoId) {
    msgVenda("Selecione a forma de pagamento.", "danger");
    return;
  }
  if (!vendaDivididaEstaAtiva() && formaPagamentoSelecionadaEhDinheiro() && valorRecebido < obterTotalVenda()) {
    msgVenda("O valor recebido deve ser maior ou igual ao total da venda.", "danger");
    return;
  }

  const dividida = vendaDivididaEstaAtiva();
  const body = {
    dataVenda,
    clienteId: clienteId ? Number(clienteId) : null,
    valorSubtotal: Number(obterSubtotalVenda().toFixed(2)),
    tipoDesconto,
    valorDesconto: Number(valorDesconto.toFixed ? valorDesconto.toFixed(2) : valorDesconto),
    valorTotal: Number(obterTotalVenda().toFixed(2)),
    formaPagamentoId: dividida ? null : Number(formaPagamentoId),
    valorRecebido: !dividida && formaPagamentoSelecionadaEhDinheiro() ? Number(valorRecebido.toFixed(2)) : null,
    troco: !dividida && formaPagamentoSelecionadaEhDinheiro() ? Number(Math.max(valorRecebido - obterTotalVenda(), 0).toFixed(2)) : null,
    status: $venda("#statusVenda")?.value || "FINALIZADA",
    observacao: $venda("#observacaoVenda")?.value?.trim() || "",
    itens: itensDaVenda.map((item) => ({
      produtoCod: Number(item.prodCod),
      quantidade: Number(item.qtd),
      valorUnitario: Number(item.valorUnitario.toFixed(2)),
      valorSubtotal: Number(item.valorSubtotal.toFixed(2))
    })),
    pagamentos: dividida ? pagamentosDivididosVenda.map((pagamento) => ({
      formaPagamentoId: Number(pagamento.formaPagamentoId),
      valor: Number(Number(pagamento.valor).toFixed(2)),
      valorRecebido: formaPagamentoEhDinheiroPorId(pagamento.formaPagamentoId)
        ? Number(Number(pagamento.valorRecebido).toFixed(2))
        : null,
      troco: formaPagamentoEhDinheiroPorId(pagamento.formaPagamentoId)
        ? Number(Math.max(Number(pagamento.valorRecebido) - Number(pagamento.valor), 0).toFixed(2))
        : null
    })) : undefined
  };

  try {
    const resp = await fetch(dividida ? API_VENDAS.VENDA_DIVIDIDA : API_VENDAS.VENDAS, {
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

  $venda("#funcionarioNomeVenda").value = funcionario.funcNome || funcionario.nome || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  $venda("#btnModoVendaRapida")?.addEventListener("click", () => alternarModoVendas("rapida"));
  $venda("#btnModoMesas")?.addEventListener("click", () => alternarModoVendas("mesas"));
  alternarModoVendas("rapida");
  $venda("#dataVenda").value = window.vstockFormatters.nowInputLocal();
  preencherFuncionarioVenda();
  registrarCustomSelect("filtroCategoriaVenda");
  registrarCustomSelect("clienteVenda");
  modalFormaPagamento = new bootstrap.Modal(document.getElementById("modalFormaPagamento"));
  modalClienteVenda = new bootstrap.Modal(document.getElementById("modalClienteVenda"));
  modalConfirmarVenda = new bootstrap.Modal(document.getElementById("modalConfirmarVenda"));
  $venda("#trocoVendaTela").value = window.vstockCurrency.formatNumber(0);
  atualizarVisibilidadePagamentoDinheiro();

  await Promise.all([
    carregarProdutos(),
    carregarClientes(),
    carregarFormasPagamento(false)
  ]);

  window.vstockMesas?.inicializar({
    obterProdutos: () => produtosVendaCache,
    obterFormasPagamento: () => formasPagamentoCache,
    obterClientes: () => clientesVendaCache,
    abrirCadastroCliente: (callback) => {
      aoCadastrarCliente = callback;
      limparFormularioClienteVenda();
      modalClienteVenda.show();
    },
    alertar: msgVenda
  });

  $venda("#btnAbrirModalClienteVenda")?.addEventListener("click", () => {
    aoCadastrarCliente = null;
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
  $venda("#vendaDivididaAtiva")?.addEventListener("change", alternarVendaDividida);
  $venda("#quantidadePagadoresVenda")?.addEventListener("input", distribuirPagamentosIgualmente);
  $venda("#pagamentosDivididosVenda")?.addEventListener("change", (event) => {
    const linha = event.target.closest("[data-pagamento-indice]");
    if (!linha) return;
    const indice = Number(linha.dataset.pagamentoIndice);
    if (event.target.dataset.campo === "forma") {
      pagamentosDivididosVenda[indice].formaPagamentoId = event.target.value;
      pagamentosDivididosVenda[indice].valorRecebido = formaPagamentoEhDinheiroPorId(event.target.value)
        ? pagamentosDivididosVenda[indice].valor
        : null;
      renderizarPagamentosDivididos();
    }
  });
  $venda("#pagamentosDivididosVenda")?.addEventListener("input", (event) => {
    const linha = event.target.closest("[data-pagamento-indice]");
    if (!linha) return;
    const indice = Number(linha.dataset.pagamentoIndice);
    if (event.target.dataset.campo === "valor") pagamentosDivididosVenda[indice].valor = parseMoeda(event.target.value);
    if (event.target.dataset.campo === "recebido") pagamentosDivididosVenda[indice].valorRecebido = parseMoeda(event.target.value);
    const pagamento = pagamentosDivididosVenda[indice];
    const valorResumo = linha.querySelector(".pdv-split-payment-header span");
    if (valorResumo) valorResumo.textContent = window.vstockCurrency.formatMoney(pagamento.valor);
    if (formaPagamentoEhDinheiroPorId(pagamento.formaPagamentoId)) {
      const campoTroco = linha.querySelector(".pdv-split-cash-fields input[disabled]");
      const troco = Math.max(Number(pagamento.valorRecebido || 0) - Number(pagamento.valor || 0), 0);
      if (campoTroco) campoTroco.value = window.vstockCurrency.formatNumber(troco);
    }
    atualizarSaldoPagamentosDivididos();
  });
  $venda("#listaProdutosVenda")?.addEventListener("change", atualizarProdutoSelecionado);
  $venda("#quantidadeVenda")?.addEventListener("input", atualizarSubtotalItemAtual);
  $venda("#buscaProdutoVenda")?.addEventListener("input", agendarFiltroProdutos);
  $venda("#buscaProdutoVenda")?.addEventListener("focus", () => renderizarDropdownProdutos(produtosVisiveisVenda, true));
  $venda("#filtroCategoriaVenda")?.addEventListener("change", filtrarProdutos);
  $venda("#tipoDescontoVenda")?.addEventListener("change", () => {
    $venda("#valorDescontoVenda").value = "";
    atualizarEstadoCampoDesconto();
    atualizarResumoVenda();
  });
  $venda("#valorDescontoVenda")?.addEventListener("input", () => {
    if ($venda("#valorDescontoVenda").disabled) {
      return;
    }
    const tipo = $venda("#tipoDescontoVenda").value;
    if (tipo === "PERCENTUAL") {
      const valor = String($venda("#valorDescontoVenda").value || "").replace(/[^\d,]/g, "");
      $venda("#valorDescontoVenda").value = valor;
    } else {
      $venda("#valorDescontoVenda").value = window.vstockCurrency.formatInputValue($venda("#valorDescontoVenda").value);
    }
    atualizarResumoVenda();
  });
  atualizarEstadoCampoDesconto();
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
    if (!event.target.closest(".pdv-custom-select")) {
      fecharTodosCustomSelects();
    }

    if (!event.target.closest(".produto-busca-grupo")) {
      fecharDropdownProdutos();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      fecharTodosCustomSelects();
    }
  });

  $venda("#dropdownProdutosVenda")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button[data-value]");
    if (!botao) return;

    const produto = produtosVendaCache.find((item) => String(item.prod_cod) === String(botao.dataset.value));
    if (produto) selecionarProduto(produto);
  });

  $venda("#pdvProductGrid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-produto-card]");
    if (!card) return;

    const produto = produtosVendaCache.find((item) => String(item.prod_cod) === String(card.dataset.produtoCard));
    if (produto) {
      adicionarProdutoAoCarrinho(produto, 1);
    }
  });

  $venda("#pdvPaymentOptions")?.addEventListener("click", (event) => {
    const botao = event.target.closest("[data-forma-pagamento]");
    if (!botao) return;

    const select = $venda("#formaPagamentoVenda");
    if (!select) return;

    select.value = String(botao.dataset.formaPagamento || "");
    atualizarTroco();
    renderizarOpcoesPagamentoPdv();
  });

  $venda("#pdvPagination")?.addEventListener("click", (event) => {
    const botaoPagina = event.target.closest("[data-page]");
    if (botaoPagina) {
      paginaAtualProdutos = Number(botaoPagina.dataset.page || 1);
      desenharSelectProdutos(produtosVisiveisVenda);
      return;
    }

    const botaoNav = event.target.closest("[data-page-nav]");
    if (!botaoNav) return;

    if (botaoNav.dataset.pageNav === "prev") {
      paginaAtualProdutos = Math.max(1, paginaAtualProdutos - 1);
    }

    if (botaoNav.dataset.pageNav === "next") {
      paginaAtualProdutos += 1;
    }

    desenharSelectProdutos(produtosVisiveisVenda);
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

  $venda("#pdvCartItems")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const indice = Number(botao.dataset.idx);
    if (botao.dataset.acao === "aumentar-item") {
      ajustarQuantidadeItem(indice, 1);
    }
    if (botao.dataset.acao === "diminuir-item") {
      ajustarQuantidadeItem(indice, -1);
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

  renderizarCarrinhoPdv();
  atualizarResumoVenda();
});

