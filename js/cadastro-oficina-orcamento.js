const API_ORCAMENTO = {
  CLIENTES: "http://localhost:8080/api/cliente/all?ativosOnly=true",
  VEICULOS: "http://localhost:8080/api/oficina/veiculos?ativosOnly=true",
  FUNCIONARIOS: "http://localhost:8080/api/funcionarios/all?ativosOnly=true",
  CATEGORIAS: "http://localhost:8080/api/categorias-produto?ativosOnly=true",
  CATALOGO: "http://localhost:8080/api/oficina/orcamentos/catalogo-itens",
  ORCAMENTOS: "http://localhost:8080/api/oficina/orcamentos"
};

const $orcamento = (seletor) => document.querySelector(seletor);
const mensagemOrcamento = window.vstockUi.createAlertHandler({
  container: "#mensagens",
  autoRemoveMs: 4500
});

let clientes = [];
let veiculos = [];
let funcionarios = [];
let categorias = [];
let itens = [];
let itensCatalogoAtual = [];
let paginaCatalogo = 1;
let tipoCatalogo = null;
let buscaCatalogoTimer;

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function lerErro(resposta, padrao) {
  return (await resposta.text()).trim() || padrao;
}

function veiculosDoCliente() {
  const clienteId = Number($orcamento("#clienteId").value);
  return veiculos.filter((veiculo) => Number(veiculo.clienteId) === clienteId);
}

function limparVeiculo() {
  $orcamento("#veiculoId").value = "";
  $orcamento("#veiculoDescricao").value = "";
  $orcamento("#veiculoDescricao").disabled = !Number($orcamento("#clienteId").value);
}

function atualizarTotais() {
  const subtotal = itens.reduce((total, item) => total + Number(item.valor || 0) * (item.quantidade || 1), 0);
  const desconto = window.vstockCurrency.parse($orcamento("#valorDesconto").value);
  const total = Math.max(0, subtotal - desconto);
  $orcamento("#valorSubtotal").textContent = moeda(subtotal);
  $orcamento("#valorTotal").textContent = moeda(total);
}

function renderizarItens() {
  const vazio = $orcamento("#itensVazios");
  const areaTabela = $orcamento("#areaTabelaItens");
  const tbody = $orcamento("#tabelaItens tbody");
  vazio.classList.toggle("d-none", itens.length > 0);
  areaTabela.classList.toggle("d-none", itens.length === 0);

  tbody.innerHTML = itens.map((item, indice) => `
    <tr>
      <td><span class="badge ${item.tipo === "PRODUTO" ? "text-bg-primary" : "text-bg-danger"}">${item.tipo === "PRODUTO" ? "Produto" : "Serviço"}</span></td>
      <td><strong>${escaparHtml(item.descricao)}</strong>${item.tipo === "PRODUTO" ? `<small class="d-block text-muted mt-1">× ${item.quantidade || 1} unidade${(item.quantidade || 1) > 1 ? "s" : ""}</small>` : ""}</td>
      <td class="text-end">${moeda(Number(item.valor || 0) * (item.quantidade || 1))}</td>
      <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger" data-remover-item="${indice}" aria-label="Remover ${escaparHtml(item.descricao)}"><i class="bi bi-trash3"></i></button></td>
    </tr>`).join("");
  atualizarTotais();
}

function itemJaAdicionado(item) {
  return item.tipo !== "PRODUTO" && itens.some((atual) => atual.servicoId === item.servicoId);
}

function adicionarItem(item) {
  if (item.tipo === "PRODUTO") {
    const produtoExistente = itens.find((atual) => atual.produtoCod === item.produtoCod);
    if (produtoExistente) {
      produtoExistente.quantidade = (produtoExistente.quantidade || 1) + 1;
    } else {
      itens.push({ ...item, quantidade: 1 });
    }
    renderizarItens();
    return;
  }

  if (itemJaAdicionado(item)) {
    mensagemOrcamento("Esse item já foi adicionado ao orçamento.", "warning");
    return;
  }
  itens.push({ ...item, quantidade: 1 });
  renderizarItens();
}

function tipoSelecionado(botao) {
  document.querySelectorAll(".filtro-tipo").forEach((item) => {
    item.classList.remove("btn-dark", "ativo");
    if (item.dataset.tipo === "produto") item.classList.add("btn-outline-primary");
    if (item.dataset.tipo === "servico") item.classList.add("btn-outline-danger");
  });
  botao.classList.remove("btn-outline-primary", "btn-outline-danger");
  botao.classList.add("btn-dark", "ativo");
}

function montarUrlCatalogo() {
  const parametros = new URLSearchParams({ pagina: String(paginaCatalogo), tamanho: "5" });
  const busca = $orcamento("#buscaItem").value.trim();
  const categoriaId = $orcamento("#categoriaItem").value;
  if (busca) parametros.set("busca", busca);
  if (tipoCatalogo) parametros.set("tipo", tipoCatalogo);
  if (categoriaId) parametros.set("categoriaId", categoriaId);
  return `${API_ORCAMENTO.CATALOGO}?${parametros}`;
}

function renderizarResultadosCatalogo(resultado) {
  const container = $orcamento("#resultadosItens");
  itensCatalogoAtual = resultado.itens;
  if (!resultado.itens.length) {
    container.innerHTML = '<div class="text-center text-muted py-4">Nenhum produto ou serviço encontrado.</div>';
  } else {
    container.innerHTML = resultado.itens.map((item, indice) => {
      const produto = item.tipo === "PRODUTO";
      const quantidadeProduto = produto ? (itens.find((atual) => atual.produtoCod === item.produtoCod)?.quantidade || 0) : 0;
      const adicionado = produto ? quantidadeProduto > 0 : itemJaAdicionado(item);
      return `
        <div class="list-group-item d-flex align-items-center gap-3 py-3">
          <span class="${produto ? "text-primary" : "text-danger"} fs-5"><i class="bi ${produto ? "bi-box-seam" : "bi-tools"}"></i></span>
          <div class="flex-grow-1">
            ${produto
              ? `<div class="d-flex align-items-start gap-3"><div class="d-flex flex-column align-items-start gap-1"><span class="badge text-bg-primary-subtle text-primary-emphasis">Produto</span><small class="text-muted">Estoque: ${Number(item.estoqueDisponivel || 0)}</small></div><strong>${escaparHtml(item.descricao)}</strong></div>`
              : `<strong>${escaparHtml(item.descricao)}</strong><div class="mt-1"><span class="badge text-bg-danger-subtle text-danger-emphasis">Serviço</span></div>`}
          </div>
          <strong class="text-nowrap">${moeda(item.valor)}</strong>
          ${produto && quantidadeProduto ? `<span class="badge text-bg-primary">${quantidadeProduto}x</span>` : ""}
          <button type="button" class="btn btn-sm ${produto ? "btn-outline-success" : (adicionado ? "btn-outline-secondary" : "btn-outline-success")}" data-${produto ? "aumentar-produto" : "adicionar-item"}="${indice}" ${!produto && adicionado ? "disabled" : ""}>
            <i class="bi ${!produto && adicionado ? "bi-check2" : "bi-plus-lg"}"></i>${produto ? "" : (adicionado ? " Adicionado" : "")}
          </button>
        </div>`;
    }).join("");
  }

  window.vstockPagination.render({
    container: "#paginacaoItens",
    variant: "cadastro",
    itemLabel: "itens",
    page: resultado.pagina,
    pageSize: resultado.tamanho,
    totalItems: resultado.totalItens,
    idPrefix: "CatalogoOrcamento",
    onPageChange: (novaPagina) => {
      paginaCatalogo = novaPagina;
      carregarCatalogo();
    }
  });
}

async function carregarCatalogo() {
  try {
    const resposta = await fetch(montarUrlCatalogo());
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar o catálogo."));
    renderizarResultadosCatalogo(await resposta.json());
  } catch (erro) {
    $orcamento("#resultadosItens").innerHTML = '<div class="text-center text-danger py-4">Não foi possível carregar os itens.</div>';
    mensagemOrcamento(erro.message || "Não foi possível carregar o catálogo.", "danger");
  }
}

function preencherCategorias() {
  const select = $orcamento("#categoriaItem");
  select.innerHTML = '<option value="">Todas as categorias</option>';
  categorias.forEach((categoria) => {
    const option = document.createElement("option");
    option.value = categoria.catCod;
    option.textContent = categoria.catDescr;
    select.appendChild(option);
  });
}

async function carregarDadosIniciais() {
  const respostas = await Promise.all([
    fetch(API_ORCAMENTO.CLIENTES),
    fetch(API_ORCAMENTO.VEICULOS),
    fetch(API_ORCAMENTO.FUNCIONARIOS),
    fetch(API_ORCAMENTO.CATEGORIAS)
  ]);
  for (const resposta of respostas) {
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível carregar os dados do orçamento."));
  }
  [clientes, veiculos, funcionarios, categorias] = await Promise.all(respostas.map((resposta) => resposta.json()));
  preencherCategorias();
}

function configurarDropdowns() {
  window.vstockFilterDropdown.attach({
    input: "#clienteNome",
    quickCreate: { enabled: true, button: "#btnNovoClienteRapido" },
    optionValues: true,
    getOptions: () => clientes.map((cliente) => ({ label: cliente.nome, value: String(cliente.clienteId), searchText: `${cliente.nome} ${cliente.cpfCnpj || ""}` })),
    onInputValueChange: () => { $orcamento("#clienteId").value = ""; limparVeiculo(); },
    onOptionSelect: (nome, clienteId) => {
      $orcamento("#clienteNome").value = nome;
      $orcamento("#clienteId").value = clienteId;
      limparVeiculo();
    },
    emptyText: "Nenhum cliente ativo encontrado"
  });

  window.vstockFilterDropdown.attach({
    input: "#veiculoDescricao",
    quickCreate: { enabled: true, button: "#btnNovoVeiculoRapido" },
    optionValues: true,
    getOptions: () => veiculosDoCliente().map((veiculo) => ({
      label: `${veiculo.placa} · ${veiculo.marca} ${veiculo.modelo}`,
      value: String(veiculo.veiculoId),
      searchText: `${veiculo.placa} ${veiculo.marca} ${veiculo.modelo}`
    })),
    onInputValueChange: () => { $orcamento("#veiculoId").value = ""; },
    onOptionSelect: (descricao, veiculoId) => { $orcamento("#veiculoDescricao").value = descricao; $orcamento("#veiculoId").value = veiculoId; },
    emptyText: "Nenhum veículo ativo para este cliente"
  });

  window.vstockFilterDropdown.attach({
    input: "#funcionarioNome",
    optionValues: true,
    getOptions: () => funcionarios.map((funcionario) => ({ label: funcionario.funcNome, value: String(funcionario.funcionarioId), searchText: `${funcionario.funcNome} ${funcionario.cargo || ""}` })),
    onInputValueChange: () => { $orcamento("#funcionarioId").value = ""; },
    onOptionSelect: (nome, funcionarioId) => { $orcamento("#funcionarioNome").value = nome; $orcamento("#funcionarioId").value = funcionarioId; },
    emptyText: "Nenhum funcionário ativo encontrado"
  });
}

function bodyOrcamento() {
  return {
    clienteId: Number($orcamento("#clienteId").value),
    veiculoId: Number($orcamento("#veiculoId").value),
    funcionarioId: Number($orcamento("#funcionarioId").value),
    diagnostico: $orcamento("#diagnostico").value.trim(),
    valorDesconto: window.vstockCurrency.parse($orcamento("#valorDesconto").value),
    observacao: $orcamento("#observacao").value.trim() || null,
    itens: itens.flatMap((item) => Array.from(
      { length: item.tipo === "PRODUTO" ? (item.quantidade || 1) : 1 },
      () => ({ produtoCod: item.produtoCod || null, servicoId: item.servicoId || null })
    ))
  };
}

function validarOrcamento(body) {
  if (!body.clienteId) return "Selecione o cliente.";
  if (!body.veiculoId) return "Selecione o veículo.";
  if (!body.funcionarioId) return "Selecione o funcionário responsável.";
  if (!body.diagnostico) return "Informe o diagnóstico.";
  if (!body.itens.length) return "Adicione ao menos um produto ou serviço.";
  if (body.valorDesconto < 0) return "O desconto não pode ser negativo.";
  const subtotal = itens.reduce((total, item) => total + Number(item.valor || 0) * (item.quantidade || 1), 0);
  if (body.valorDesconto > subtotal) return "O desconto não pode ser maior que o total dos itens.";
  return null;
}

function limparFormulario() {
  $orcamento("#orcamentoForm").reset();
  ["#clienteId", "#veiculoId", "#funcionarioId"].forEach((seletor) => { $orcamento(seletor).value = ""; });
  $orcamento("#veiculoDescricao").disabled = true;
  itens = [];
  renderizarItens();
}

async function salvarOrcamento(event) {
  event.preventDefault();
  const body = bodyOrcamento();
  const erro = validarOrcamento(body);
  if (erro) return mensagemOrcamento(erro, "danger");

  try {
    const resposta = await fetch(API_ORCAMENTO.ORCAMENTOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível salvar o orçamento."));
    limparFormulario();
    mensagemOrcamento("Orçamento salvo como pendente.", "success");
  } catch (erroSalvar) {
    mensagemOrcamento(erroSalvar.message || "Não foi possível salvar o orçamento.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $orcamento("#orcamentoForm").noValidate = true;
  window.vstockCurrency.attachMask($orcamento("#valorDesconto"));
  renderizarItens();

  try {
    await carregarDadosIniciais();
    configurarDropdowns();
  } catch (erro) {
    mensagemOrcamento(erro.message || "Não foi possível carregar os dados do orçamento.", "danger");
  }

  $orcamento("#btnNovoClienteRapido").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "cliente",
      valores: { nome: $orcamento("#clienteNome").value.trim() },
      onSaved: (cliente) => {
        clientes.push(cliente);
        $orcamento("#clienteNome").value = cliente.nome;
        $orcamento("#clienteId").value = cliente.clienteId;
        limparVeiculo();
        mensagemOrcamento("Cliente cadastrado e selecionado.", "success");
      }
    });
  });

  $orcamento("#btnNovoVeiculoRapido").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "veiculo",
      clienteId: Number($orcamento("#clienteId").value) || null,
      onSaved: (veiculo) => {
        veiculos.push(veiculo);
        $orcamento("#veiculoDescricao").value = `${veiculo.placa} · ${veiculo.marca} ${veiculo.modelo}`;
        $orcamento("#veiculoId").value = veiculo.veiculoId;
        mensagemOrcamento("Veículo cadastrado e selecionado.", "success");
      }
    });
  });

  $orcamento("#btnNovoProdutoRapido").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "produto",
      valores: { prodDescr: $orcamento("#buscaItem").value.trim(), qtdMin: 0, valorUnitario: "0,00" },
      onSaved: (produto) => {
        adicionarItem({ tipo: "PRODUTO", produtoCod: produto.prodCod, descricao: produto.prodDescr, valor: produto.valorUnitario, estoqueDisponivel: 0 });
        paginaCatalogo = 1;
        carregarCatalogo();
        mensagemOrcamento("Produto cadastrado e incluído no orçamento.", "success");
      }
    });
  });

  $orcamento("#btnNovoServicoRapido").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "servico",
      valores: { descricao: $orcamento("#buscaItem").value.trim(), valorServico: "0,00" },
      onSaved: (servico) => {
        adicionarItem({ tipo: "SERVICO", servicoId: servico.servicoId, descricao: servico.descricao, valor: servico.valorServico });
        paginaCatalogo = 1;
        carregarCatalogo();
        mensagemOrcamento("Serviço cadastrado e incluído no orçamento.", "success");
      }
    });
  });

  $orcamento("#btnAbrirItens").addEventListener("click", () => { paginaCatalogo = 1; carregarCatalogo(); });
  $orcamento("#modalAdicionarItem").addEventListener("shown.bs.modal", () => carregarCatalogo());
  $orcamento("#buscaItem").addEventListener("input", () => {
    clearTimeout(buscaCatalogoTimer);
    buscaCatalogoTimer = setTimeout(() => { paginaCatalogo = 1; carregarCatalogo(); }, 300);
  });
  $orcamento("#categoriaItem").addEventListener("change", () => { paginaCatalogo = 1; carregarCatalogo(); });
  document.querySelectorAll(".filtro-tipo").forEach((botao) => {
    botao.addEventListener("click", () => {
      tipoCatalogo = botao.dataset.tipo === "todos" ? null : botao.dataset.tipo.toUpperCase();
      tipoSelecionado(botao);
      paginaCatalogo = 1;
      carregarCatalogo();
    });
  });
  $orcamento("#resultadosItens").addEventListener("click", (event) => {
    const botao = event.target.closest("[data-adicionar-item], [data-aumentar-produto]");
    if (!botao) return;
    adicionarItem(itensCatalogoAtual[Number(botao.dataset.adicionarItem ?? botao.dataset.aumentarProduto)]);
    carregarCatalogo();
  });
  $orcamento("#tabelaItens tbody").addEventListener("click", (event) => {
    const botao = event.target.closest("[data-remover-item]");
    if (!botao) return;
    itens.splice(Number(botao.dataset.removerItem), 1);
    renderizarItens();
  });
  $orcamento("#valorDesconto").addEventListener("input", atualizarTotais);
  $orcamento("#btnLimpar").addEventListener("click", limparFormulario);
  $orcamento("#orcamentoForm").addEventListener("submit", salvarOrcamento);
});


