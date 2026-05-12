const API = {
  PRODUTOS: "http://localhost:8080/api/produtos/lista?ativosOnly=true",
  PRODUTO_NOVO: "http://localhost:8080/api/produtos",
  CATEGORIAS: "http://localhost:8080/api/categorias-produto?ativosOnly=true",
  FORNECEDORES: "http://localhost:8080/api/fornecedor/all?ativosOnly=true",
  FORNECEDOR_NOVO: "http://localhost:8080/api/fornecedor",
  FUNCIONARIO_POR_EMAIL: (email) => `http://localhost:8080/api/funcionarios/buscaEmail?email=${encodeURIComponent(email)}`,
  COMPRAS: "http://localhost:8080/api/compra",
  COMPRA_ITENS: "http://localhost:8080/api/compra/itens",
  COMPRA_LISTA: "http://localhost:8080/api/compra/listar",
  COMPRA_ATUALIZAR: (id) => `http://localhost:8080/api/compra/${id}`,
  COMPRA_ITENS_POR_ID: (id) => `http://localhost:8080/api/compra/${id}/itens`
};

const el = (sel) => document.querySelector(sel);

let itensDaEntrada = [];
let indiceEditando = null;
let cacheProdutos = [];
let cacheFornecedores = [];
let cacheCategorias = [];
let modalNovoFornecedor = null;
let modalNovoProduto = null;
let debounceBuscaProduto = null;
let produtosVisiveis = [];
let todasCompras = [];
let comprasRegistradas = [];
let paginaAtualCompras = 1;
let totalPaginasCompras = 1;
let totalCompras = 0;
const ITENS_POR_PAGINA_COMPRAS = 10;

function hojeISO() {
  const agora = new Date();
  const saoPaulo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(agora);
  return saoPaulo;
}

function msg(texto, tipo = "danger") {
  const box = el("#mensagens");
  if (!box) return;

  const div = document.createElement("div");
  div.className = `alert alert-${tipo} alert-dismissible fade show`;
  div.role = "alert";
  div.innerHTML = `
    ${texto}
    <button class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
  `;

  box.appendChild(div);
  window.destacarMensagens?.(box);
  setTimeout(() => div.remove(), 4500);
}

function fmt(valor) {
  return window.vstockCurrency.formatNumber(valor || 0);
}

function formatarDataBr(valor) {
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

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function normalizarCodigoBarras(valor) {
  return String(valor || "").trim();
}

function resumirProdutos(itens) {
  if (!Array.isArray(itens) || !itens.length) return "-";
  const nomes = itens.map((item) => item.produto || "-").filter(Boolean);
  if (nomes.length === 1) return nomes[0];
  return `${nomes[0]} + ${nomes.length - 1} item(ns)`;
}

function dataVencidaOuHoje(valor) {
  if (!valor) return false;
  return String(valor) <= hojeISO();
}

async function carregarProdutos() {
  try {
    const resp = await fetch(API.PRODUTOS);
    if (!resp.ok) throw new Error("Falha ao carregar produtos.");

    cacheProdutos = await resp.json();
    desenharSelectProdutos(cacheProdutos);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar os produtos.", "danger");
  }
}

async function carregarCategoriasProduto(categoriaSelecionada = null) {
  try {
    const resp = await fetch(API.CATEGORIAS);
    if (!resp.ok) throw new Error("Falha ao carregar categorias.");

    cacheCategorias = await resp.json();
    desenharSelectCategorias(categoriaSelecionada);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar as categorias de produto.", "danger");
  }
}

function desenharSelectProdutos(lista) {
  const select = el("#listaProdutos");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = "";
  produtosVisiveis = [...lista];

  if (!lista.length) {
    select.innerHTML = `<option value="" selected disabled>Nenhum produto encontrado</option>`;
    renderizarDropdownProdutos([]);
    return;
  }

  lista.forEach((produto) => {
    const opt = document.createElement("option");
    opt.value = produto.prodCod;
    opt.textContent = produto.prodDescr;
    opt.setAttribute("data-descr", produto.prodDescr);
    opt.setAttribute("data-categoria", produto.categoria?.catDescr || "");
    select.appendChild(opt);
  });

  if (valorAtual && lista.some((produto) => String(produto.prodCod) === String(valorAtual))) {
    select.value = String(valorAtual);
  } else {
    select.selectedIndex = 0;
  }
  renderizarDropdownProdutos(lista, false);
}

function renderizarDropdownProdutos(lista, aberto = true) {
  const dropdown = el("#dropdownProdutosCompra");
  const select = el("#listaProdutos");
  if (!dropdown || !select) return;

  if (!lista.length) {
    dropdown.innerHTML = `<button class="produto-dropdown-item vazio" type="button" disabled>Nenhum produto encontrado</button>`;
    dropdown.classList.toggle("ativo", aberto);
    return;
  }

  const valorSelecionado = select.value;
  dropdown.innerHTML = lista.map((produto) => {
    const ativo = String(produto.prodCod) === String(valorSelecionado) ? " ativo" : "";
    return `<button class="produto-dropdown-item${ativo}" type="button" data-value="${produto.prodCod}">${produto.prodDescr}</button>`;
  }).join("");
  dropdown.classList.toggle("ativo", aberto);
}

function fecharDropdownProdutos() {
  el("#dropdownProdutosCompra")?.classList.remove("ativo");
}

function selecionarProduto(produto) {
  const select = el("#listaProdutos");
  const input = el("#buscaProdutoCompra");
  const inputCodigo = el("#codigoBarrasCompra");
  if (!select || !input || !produto) return;

  select.value = String(produto.prodCod);
  input.value = produto.prodDescr || "";
  if (inputCodigo && produto.codigoBarras) {
    inputCodigo.value = produto.codigoBarras;
  }
  renderizarDropdownProdutos(produtosVisiveis, false);
  fecharDropdownProdutos();
  atualizarResumoFormularioEntrada();
}

function focarLeituraCodigoBarras() {
  el("#codigoBarrasCompra")?.focus();
}

function localizarProdutoPorCodigoBarras(codigoBarras) {
  const codigoNormalizado = normalizarCodigoBarras(codigoBarras);
  if (!codigoNormalizado) return null;

  return cacheProdutos.find((produto) =>
    normalizarCodigoBarras(produto.codigoBarras) === codigoNormalizado
  ) || null;
}

function processarLeituraCodigoBarras() {
  const inputCodigo = el("#codigoBarrasCompra");
  const select = el("#listaProdutos");
  const inputQuantidade = el("#quantidade");
  const codigo = normalizarCodigoBarras(inputCodigo?.value);

  if (!inputCodigo || !select || !inputQuantidade || !codigo) {
    return;
  }

  const produto = localizarProdutoPorCodigoBarras(codigo);
  if (!produto) {
    msg("Código de barras não cadastrado para nenhum produto.", "danger");
    inputCodigo.select();
    return;
  }

  const produtoJaSelecionado = String(select.value || "") === String(produto.prodCod);
  const quantidadeAtual = Number(inputQuantidade.value || 0);

  selecionarProduto(produto);
  inputQuantidade.value = String(produtoJaSelecionado && quantidadeAtual > 0 ? quantidadeAtual + 1 : 1);
  atualizarResumoFormularioEntrada();
  msg(`Produto ${produto.prodDescr} identificado pela leitura.`, "success");
  inputCodigo.select();
}

function desenharSelectCategorias(categoriaSelecionada = null) {
  const select = el("#novaCategoriaProduto");
  if (!select) return;

  select.innerHTML = `<option value="" selected disabled>Selecione...</option>`;

  cacheCategorias.forEach((categoria) => {
    const opt = document.createElement("option");
    opt.value = categoria.catCod;
    opt.textContent = categoria.catDescr;
    select.appendChild(opt);
  });

  if (categoriaSelecionada) {
    select.value = String(categoriaSelecionada);
  }
}

function filtrarProdutos() {
  const termo = (el("#buscaProdutoCompra")?.value || "").trim().toLowerCase();
  if (!termo) {
    desenharSelectProdutos(cacheProdutos);
    return;
  }

  const filtrados = cacheProdutos.filter((produto) =>
    String(produto.prodDescr || "").toLowerCase().includes(termo)
  );

  desenharSelectProdutos(filtrados);
}

function agendarFiltroProdutos() {
  if (debounceBuscaProduto) {
    clearTimeout(debounceBuscaProduto);
  }

  debounceBuscaProduto = setTimeout(() => {
    filtrarProdutos();
    renderizarDropdownProdutos(produtosVisiveis, true);
  }, 350);
}

async function carregarFornecedores(fornecedorSelecionado = null) {
  try {
    const resp = await fetch(API.FORNECEDORES);
    if (!resp.ok) throw new Error("Falha ao carregar fornecedores.");

    cacheFornecedores = await resp.json();
    desenharSelectFornecedores(fornecedorSelecionado);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar os fornecedores.", "danger");
  }
}

function desenharSelectFornecedores(fornecedorSelecionado = null) {
  const select = el("#fornecedorDireto");
  if (!select) return;

  select.innerHTML = `<option value="" selected disabled>Selecione...</option>`;

  cacheFornecedores.forEach((fornecedor) => {
    const opt = document.createElement("option");
    opt.value = fornecedor.idFornecedor ?? fornecedor.id_fornecedor ?? fornecedor.id;
    opt.textContent = fornecedor.nome ?? `Fornecedor ${opt.value}`;
    select.appendChild(opt);
  });

  if (fornecedorSelecionado) {
    select.value = String(fornecedorSelecionado);
  }
}

function carregarFuncionarioLogado() {
  try {
    return JSON.parse(localStorage.getItem("funcionarioLogado") || "null");
  } catch {
    return null;
  }
}

async function complementarFuncionarioPorEmail(funcionario) {
  const email = funcionario?.funcEmail || funcionario?.email || "";
  if (!email) {
    return funcionario;
  }

  const resp = await fetch(API.FUNCIONARIO_POR_EMAIL(email));
  if (!resp.ok) {
    return funcionario;
  }

  const atualizado = await resp.json();
  const combinado = { ...funcionario, ...atualizado };
  localStorage.setItem("funcionarioLogado", JSON.stringify(combinado));
  return combinado;
}

async function preencherFuncionarioLogado() {
  let funcionario = carregarFuncionarioLogado();
  if (!funcionario) {
    msg("Nenhum funcionário logado foi encontrado. Faça login novamente.", "danger");
    return null;
  }

  if (!(funcionario.funcCpf || funcionario.cpf)) {
    try {
      funcionario = await complementarFuncionarioPorEmail(funcionario);
    } catch (erro) {
      console.error(erro);
    }
  }

  el("#funcionarioCpf").value = funcionario.funcCpf || funcionario.cpf || "";
  el("#funcionarioNome").value = funcionario.funcNome || funcionario.nome || "";
  return funcionario;
}

function obterSaldoProdutoSelecionado(produto) {
  return Number(
    produto?.saldo
    ?? produto?.saldoAtual
    ?? produto?.estoqueAtual
    ?? produto?.quantidadeEstoque
    ?? 0
  );
}

function formatarMoedaCompleta(valor) {
  return `R$ ${fmt(valor)}`;
}

function localizarProdutoSelecionado() {
  const select = el("#listaProdutos");
  if (!select?.value) return null;
  return cacheProdutos.find((produto) => String(produto.prodCod) === String(select.value)) || null;
}

function atualizarResumoFormularioEntrada() {
  const quantidade = Number(el("#quantidade")?.value || 0);
  const valorTotalInformado = window.vstockCurrency.parse(el("#valorTotalItem")?.value || "");
  const valorTotal = Number.isFinite(valorTotalInformado) && valorTotalInformado > 0 ? valorTotalInformado : 0;
  const valorUnitario = quantidade > 0 && valorTotal > 0 ? valorTotal / quantidade : 0;
  const campoValorUnitario = el("#valorUnitarioItem");
  if (campoValorUnitario) campoValorUnitario.value = fmt(valorUnitario);
}

function atualizarTotal() {
  const total = itensDaEntrada.reduce((acc, item) => acc + item.valorTotal, 0);
  const totalItens = itensDaEntrada.length;
  const quantidadeTotal = itensDaEntrada.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

  const span = el("#totalGeralCompra");
  if (span) span.textContent = formatarMoedaCompleta(total);

  el("#resumoEntradaItens").textContent = String(totalItens);
  el("#resumoEntradaQuantidade").textContent = String(quantidadeTotal);
  el("#resumoEntradaValor").textContent = formatarMoedaCompleta(total);
}

function redesenharTabela() {
  const tbody = el("#tabelaItens tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!itensDaEntrada.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="saida-empty-state">
            <i class="bi bi-box-seam"></i>
            <strong>Nenhum item adicionado ainda.</strong>
            <span>Adicione produtos acima para começar a entrada.</span>
          </div>
        </td>
      </tr>
    `;
    atualizarTotal();
    return;
  }

  itensDaEntrada.forEach((item, indice) => {
    const emEdicao = indiceEditando === indice;
    const valorUnitario = item.qtd > 0 ? item.valorTotal / item.qtd : 0;

    if (!emEdicao) {
      tbody.innerHTML += `
        <tr>
          <td>${item.descrProduto}</td>
          <td class="text-end">${item.qtd}</td>
          <td class="text-end">${formatarMoedaCompleta(valorUnitario)}</td>
          <td class="text-end">${formatarMoedaCompleta(item.valorTotal)}</td>
          <td>${item.validade || "-"}</td>
          <td class="text-center d-flex flex-column flex-sm-row gap-1 justify-content-center">
            <button class="btn btn-sm btn-outline-primary" data-acao="editar" data-idx="${indice}">
              <i class="bi bi-pencil-square"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" data-acao="remover" data-idx="${indice}">
              <i class="bi bi-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML += `
        <tr class="table-warning">
          <td>${item.descrProduto}</td>
          <td class="text-end">
            <input type="number" min="1" step="1" class="form-control form-control-sm text-end" id="edit-qtd-${indice}" value="${item.qtd}">
          </td>
          <td class="text-end">${formatarMoedaCompleta(valorUnitario)}</td>
          <td class="text-end">
            <div class="campo-moeda">
              <span class="campo-moeda-prefixo">R$</span>
              <input type="text" class="form-control form-control-sm" id="edit-total-${indice}" value="${window.vstockCurrency.formatNumber(item.valorTotal)}">
            </div>
          </td>
          <td>
            <input type="date" class="form-control form-control-sm" id="edit-validade-${indice}" value="${item.validade || ""}">
          </td>
          <td class="text-center d-flex flex-column flex-sm-row gap-1 justify-content-center">
            <button class="btn btn-sm btn-success" data-acao="salvar-edicao" data-idx="${indice}">
              <i class="bi bi-check2-circle"></i> Salvar
            </button>
            <button class="btn btn-sm btn-secondary" data-acao="cancelar-edicao">
              <i class="bi bi-x-circle"></i> Cancelar
            </button>
          </td>
        </tr>
      `;
    }
  });

  atualizarTotal();
  for (let indice = 0; indice < itensDaEntrada.length; indice += 1) {
    window.vstockCurrency.attachMask(el(`#edit-total-${indice}`));
  }
}

function adicionarItem() {
  const select = el("#listaProdutos");
  const quantidade = Number(el("#quantidade")?.value || 0);
  const valorTotal = window.vstockCurrency.parse(el("#valorTotalItem")?.value);
  const validade = el("#validade")?.value || "";

  if (!select?.value) {
    msg("Selecione um produto.", "danger");
    return;
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    msg("Informe uma quantidade válida.", "danger");
    return;
  }

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    msg("Informe o valor total do item.", "danger");
    return;
  }

  if (dataVencidaOuHoje(validade)) {
    msg("Não é permitido inserir produto com validade vencida ou no dia atual.", "danger");
    return;
  }

  const item = {
    prodCod: Number(select.value),
    descrProduto: select.options[select.selectedIndex]?.getAttribute("data-descr") || select.options[select.selectedIndex]?.textContent || "",
    qtd: quantidade,
    valorTotal: Number(valorTotal.toFixed(2)),
    validade
  };

  itensDaEntrada.push(item);
  indiceEditando = null;
  redesenharTabela();

  select.value = "";
  el("#quantidade").value = "";
  el("#valorTotalItem").value = "";
  el("#validade").value = "";
  el("#codigoBarrasCompra").value = "";
  atualizarResumoFormularioEntrada();
  focarLeituraCodigoBarras();
}

function removerItem(indice) {
  itensDaEntrada.splice(indice, 1);
  indiceEditando = null;
  redesenharTabela();
}

function entrarEdicao(indice) {
  indiceEditando = indice;
  redesenharTabela();
}

function cancelarEdicao() {
  indiceEditando = null;
  redesenharTabela();
}

function salvarEdicao(indice) {
  const qtd = Number(el(`#edit-qtd-${indice}`)?.value || 0);
  const valorTotal = window.vstockCurrency.parse(el(`#edit-total-${indice}`)?.value);
  const validade = el(`#edit-validade-${indice}`)?.value || "";

  if (!Number.isInteger(qtd) || qtd <= 0) {
    msg("Quantidade inválida.", "danger");
    return;
  }

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    msg("Valor total inválido.", "danger");
    return;
  }

  if (dataVencidaOuHoje(validade)) {
    msg("Não é permitido inserir produto com validade vencida ou no dia atual.", "danger");
    return;
  }

  itensDaEntrada[indice].qtd = qtd;
  itensDaEntrada[indice].valorTotal = Number(valorTotal.toFixed(2));
  itensDaEntrada[indice].validade = validade;

  indiceEditando = null;
  redesenharTabela();
}

function limparTudo() {
  itensDaEntrada = [];
  indiceEditando = null;
  const funcionario = carregarFuncionarioLogado();

  el("#dataCompra").value = hojeISO();
  el("#funcionarioCpf").value = funcionario?.funcCpf || funcionario?.cpf || "";
  el("#funcionarioNome").value = funcionario?.funcNome || funcionario?.nome || "";
  el("#fornecedorDireto").value = "";
  el("#buscaProdutoCompra").value = "";
  el("#listaProdutos").value = "";
  fecharDropdownProdutos();
  el("#quantidade").value = "";
  el("#valorTotalItem").value = "";
  el("#validade").value = "";
  el("#codigoBarrasCompra").value = "";
  atualizarResumoFormularioEntrada();

  redesenharTabela();
}

async function salvarEntrada() {
  const dataCompra = el("#dataCompra")?.value || "";
  const funcionarioCpf = el("#funcionarioCpf")?.value || "";
  const fornecedorId = Number(el("#fornecedorDireto")?.value || 0);

  if (!dataCompra) {
    msg("Informe a data da entrada.", "danger");
    return;
  }

  if (!funcionarioCpf) {
    msg("Informe o funcionário responsável.", "danger");
    return;
  }

  if (!fornecedorId) {
    msg("Selecione o fornecedor.", "danger");
    return;
  }

  if (itensDaEntrada.length === 0) {
    msg("Adicione pelo menos um item.", "danger");
    return;
  }

  const total = itensDaEntrada.reduce((acc, item) => acc + item.valorTotal, 0);
  const body = {
    dataCompra,
    compraValorTt: Number(total.toFixed(2)),
    fornecedorId,
    funcionarioFuncCpf: funcionarioCpf
  };

  try {
    const resp = await fetch(API.COMPRAS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error("Falha ao salvar cabeçalho da entrada.");

    const compraCod = Number(await resp.text());
    if (!compraCod) throw new Error("Não foi possível identificar a entrada salva.");

    for (const item of itensDaEntrada) {
      const valorUnitario = Number((item.valorTotal / item.qtd).toFixed(6));
      const payload = {
        produtoProdCod: Number(item.prodCod),
        compraCompraCod: compraCod,
        valor: valorUnitario,
        quantidade: Number(item.qtd)
      };

      const url = item.validade
        ? `${API.COMPRA_ITENS}?validade=${encodeURIComponent(item.validade)}`
        : API.COMPRA_ITENS;

      const respItem = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!respItem.ok) {
        const detalhe = await respItem.text();
        throw new Error(detalhe || `Falha ao salvar item ${item.descrProduto}.`);
      }
    }

    msg("Entrada registrada com sucesso!", "success");
    limparTudo();
    await carregarCompras(1);
  } catch (erro) {
    console.error(erro);
    msg(erro.message || "Erro ao salvar entrada.", "danger");
  }
}

function construirQueryCompras() {
  const params = new URLSearchParams();

  const dataInicio = el("#filtroCompraDataInicio")?.value || "";
  const dataFim = el("#filtroCompraDataFim")?.value || "";
  const produto = (el("#filtroCompraProduto")?.value || "").trim();
  const valorMinimo = window.vstockCurrency.parse(el("#filtroCompraValor")?.value);
  const funcionario = (el("#filtroCompraFuncionario")?.value || "").trim();

  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);
  if (produto) params.set("produto", produto);
  if (valorMinimo > 0) params.set("valorMinimo", valorMinimo);
  if (funcionario) params.set("funcionario", funcionario);

  return params.toString();
}

function limparFiltrosCompras() {
  el("#filtroCompraDataInicio").value = "";
  el("#filtroCompraDataFim").value = "";
  el("#filtroCompraProduto").value = "";
  el("#filtroCompraValor").value = "";
  el("#filtroCompraFuncionario").value = "";
}

function obterOpcoesFiltroCompraProduto() {
  return todasCompras.map((entrada) => entrada.produtoResumo);
}

function atualizarPaginacaoCompras(pagina = 1) {
  const paginacao = window.vstockPagination.paginate(todasCompras, pagina, ITENS_POR_PAGINA_COMPRAS);
  totalCompras = paginacao.totalItems;
  totalPaginasCompras = paginacao.totalPages;
  paginaAtualCompras = paginacao.page;
  comprasRegistradas = paginacao.items;
  desenharTabelaCompras();
}

async function carregarCompras(pagina = 1) {
  try {
    const query = construirQueryCompras();
    const url = query ? `${API.COMPRA_LISTA}?${query}` : API.COMPRA_LISTA;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Falha ao listar entradas.");
    todasCompras = await resp.json();
    atualizarPaginacaoCompras(pagina);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar as entradas registradas.", "danger");
  }
}

function renderizarPaginacaoCompras() {
  window.vstockPagination.render({
    container: "#paginacaoCompras",
    variant: "listagem",
    itemLabel: "entradas",
    page: paginaAtualCompras,
    pageSize: ITENS_POR_PAGINA_COMPRAS,
    totalItems: totalCompras,
    idPrefix: "Compras",
    onPageChange: (novaPagina) => {
      atualizarPaginacaoCompras(novaPagina);
    }
  });
}

function desenharTabelaCompras() {
  const tbody = el("#tabelaCompras tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  comprasRegistradas.forEach((entrada) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${entrada.produtoResumo || "-"}</td>
        <td>R$ ${fmt(entrada.compra_valor_tt)}</td>
        <td>${entrada.fornecedor || "-"}</td>
        <td>${formatarDataBr(entrada.data_compra)}</td>
        <td>${entrada.funcionario || "-"}</td>
        <td class="text-center">
          <div class="d-flex gap-2 justify-content-center flex-wrap">
            <button class="btn btn-sm btn-primary" data-acao="ver-compra" data-id="${entrada.compra_cod}" data-data="${entrada.data_compra || ""}">
            <i class="bi bi-eye"></i> Ver
          </button>
          <button class="btn btn-sm btn-outline-primary" data-acao="editar-compra" data-id="${entrada.compra_cod}">
            <i class="bi bi-pencil-square"></i> Editar
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderizarPaginacaoCompras();
}

async function abrirEdicaoCompra(compraCod) {
  const compra = todasCompras.find((item) => Number(item.compra_cod) === Number(compraCod));
  if (!compra) return;

  const antigo = document.getElementById("modalEditarCompra");
  if (antigo) antigo.remove();

  try {
    const resp = await fetch(API.COMPRA_ITENS_POR_ID(compraCod));
    if (!resp.ok) throw new Error("Falha ao buscar itens da entrada.");

    const itens = await resp.json();
    const linhas = itens.map((item, indice) => `
      <tr>
        <td>${item.produto || "-"}</td>
        <td>
          <input type="number" class="form-control form-control-sm text-end" min="1" step="1" data-campo="qtd" data-idx="${indice}" value="${item.quantidade || 0}">
        </td>
        <td>
          <div class="campo-moeda">
            <span class="campo-moeda-prefixo">R$</span>
            <input type="text" class="form-control form-control-sm" data-campo="total" data-idx="${indice}" value="${window.vstockCurrency.formatNumber(item.subtotal || 0)}">
          </div>
        </td>
        <td>
          <input type="date" class="form-control form-control-sm" data-campo="validade" data-idx="${indice}" value="${item.validade ? String(item.validade).split('T')[0] : ""}">
        </td>
      </tr>
    `).join("");

    const html = `
      <div class="modal fade" id="modalEditarCompra" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-detalhes">
          <div class="modal-content modal-surface">
            <div class="modal-header modal-brand-header">
              <h5 class="modal-title"><i class="bi bi-pencil-square"></i> Editar Entrada #${compraCod}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body modal-form-body">
              <div class="row g-3 mb-4">
                <div class="col-md-4">
                  <label class="form-label">Data da Entrada</label>
                  <input type="date" id="editCompraData" class="form-control" value="${String(compra.data_compra).split("T")[0]}">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Fornecedor</label>
                  <input type="text" class="form-control" value="${compra.fornecedor || "-"}" disabled>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Funcionário</label>
                  <input type="text" class="form-control" value="${compra.funcionario || "-"}" disabled>
                </div>
              </div>
              <div class="table-responsive modal-tabela-wrapper">
                <table class="table table-sm align-middle modal-tabela-detalhes">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th class="text-end">Qtd</th>
                      <th class="text-end">Valor Total</th>
                      <th>Validade</th>
                    </tr>
                  </thead>
                  <tbody>${linhas}</tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer modal-form-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancelar</button>
              <button class="btn btn-success" id="btnConfirmarEdicaoCompra" type="button">Salvar alterações</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    const modalEl = document.getElementById("modalEditarCompra");
    modalEl.querySelectorAll('[data-campo="total"]').forEach((input) => {
      window.vstockCurrency.attachMask(input);
    });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById("btnConfirmarEdicaoCompra")?.addEventListener("click", async () => {
      const itensPayload = itens.map((item, indice) => {
        const quantidade = Number(modalEl.querySelector(`[data-campo="qtd"][data-idx="${indice}"]`)?.value || 0);
        const total = window.vstockCurrency.parse(modalEl.querySelector(`[data-campo="total"][data-idx="${indice}"]`)?.value);
        const validade = modalEl.querySelector(`[data-campo="validade"][data-idx="${indice}"]`)?.value || null;

        if (!Number.isInteger(quantidade) || quantidade <= 0) {
          throw new Error("Quantidade inválida na entrada.");
        }
        if (!Number.isFinite(total) || total <= 0) {
          throw new Error("Valor total invalido na entrada.");
        }
        if (dataVencidaOuHoje(validade)) {
          throw new Error("Não é permitido inserir produto com validade vencida ou no dia atual.");
        }

        return {
          produtoProdCod: Number(item.produto_cod),
          quantidade,
          valor: Number((total / quantidade).toFixed(6)),
          validade
        };
      });

      const body = {
        dataCompra: modalEl.querySelector("#editCompraData")?.value || "",
        fornecedorId: compra.fornecedor_id || null,
        funcionarioFuncCpf: compra.funcionario_func_cpf,
        itens: itensPayload
      };

      try {
        const respSalvar = await fetch(API.COMPRA_ATUALIZAR(compraCod), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!respSalvar.ok) {
          const erro = await respSalvar.text();
          throw new Error(erro || "Falha ao atualizar entrada.");
        }

        modal.hide();
        await carregarCompras(paginaAtualCompras);
        await carregarProdutos();
        msg("Entrada atualizada com sucesso.", "success");
      } catch (erro) {
        console.error(erro);
        msg(erro.message || "Não foi possível atualizar a entrada.", "danger");
      }
    });
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível abrir a edição da entrada.", "danger");
  }
}

async function abrirDetalhesCompra(compraCod, dataEntrada = "") {
  if (!compraCod) return;

  const antigo = document.getElementById("modalDetalhesCompra");
  if (antigo) antigo.remove();

  try {
    const resp = await fetch(API.COMPRA_ITENS_POR_ID(compraCod));
    if (!resp.ok) throw new Error("Falha ao buscar detalhes da entrada.");

    const itens = await resp.json();
    let linhas = "";

    itens.forEach((item) => {
      const qtd = Number(item.quantidade || 0);
      const subtotal = Number(item.subtotal || 0);

      linhas += `
        <tr>
          <td>${item.produto || "-"}</td>
          <td class="text-end">${qtd}</td>
          <td class="text-end">R$ ${fmt(subtotal)}</td>
          <td class="text-end">${Number(item.estoque || 0)}</td>
          <td>${formatarDataBr(item.validade)}</td>
        </tr>
      `;
    });

    const produtoResumo = itens.length === 0
      ? "-"
      : itens.length === 1
        ? (itens[0].produto || "-")
        : `${itens[0].produto || "-"} + ${itens.length - 1} item(ns)`;

    const html = `
      <div class="modal fade" id="modalDetalhesCompra" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-detalhes">
          <div class="modal-content modal-surface">
            <div class="modal-header modal-brand-header">
              <h5 class="modal-title">
                <i class="bi bi-box-seam"></i> Detalhes da Entrada #${compraCod}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body modal-form-body">
              <div class="modal-intro">
                Consulte os produtos recebidos, os valores registrados e o saldo atual após esta entrada.
              </div>

              <div class="modal-resumo-grid">
                <div class="modal-resumo-card">
                  <span>Produto</span>
                  <strong>${produtoResumo}</strong>
                </div>
                <div class="modal-resumo-card">
                  <span>Data da Entrada</span>
                  <strong>${formatarDataBr(dataEntrada)}</strong>
                </div>
              </div>

              <div class="table-responsive modal-tabela-wrapper">
                <table class="table table-sm align-middle modal-tabela-detalhes">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th class="text-end">Qtd</th>
                      <th class="text-end">Valor Total</th>
                      <th class="text-end">Estoque Atual</th>
                      <th>Validade</th>
                    </tr>
                  </thead>
                  <tbody>${linhas}</tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer modal-form-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    const modal = new bootstrap.Modal(document.getElementById("modalDetalhesCompra"));
    modal.show();
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível abrir os detalhes da entrada.", "danger");
  }
}

async function salvarFornecedorRapido() {
  const body = {
    nome: el("#novoFornecedorNome")?.value?.trim() || "",
    email: el("#novoFornecedorEmail")?.value?.trim() || "",
    telefone: el("#novoFornecedorTelefone")?.value?.trim() || "",
    cpfCnpj: el("#novoFornecedorCpfCnpj")?.value?.trim() || "",
    contato: el("#novoFornecedorContato")?.value?.trim() || "",
    descricao: el("#novoFornecedorDescricao")?.value?.trim() || ""
  };

  if (!body.nome || !body.email || !body.telefone || !body.contato) {
    msg("Preencha os campos obrigatórios do fornecedor.", "danger");
    return;
  }

  try {
    const resp = await fetch(API.FORNECEDOR_NOVO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao cadastrar fornecedor.");
    }

    const fornecedor = await resp.json();
    await carregarFornecedores(fornecedor.idFornecedor || fornecedor.id_fornecedor || fornecedor.id);

    if (modalNovoFornecedor) modalNovoFornecedor.hide();

    el("#novoFornecedorNome").value = "";
    el("#novoFornecedorEmail").value = "";
    el("#novoFornecedorTelefone").value = "";
    el("#novoFornecedorCpfCnpj").value = "";
    el("#novoFornecedorContato").value = "";
    el("#novoFornecedorDescricao").value = "";

    msg("Fornecedor cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msg(erro.message || "Não foi possível salvar o fornecedor.", "danger");
  }
}

async function salvarProdutoRapido() {
  const selectCategoria = el("#novaCategoriaProduto");
  const descricao = el("#novoProdutoDescricao")?.value?.trim() || "";
  const qtdMin = Number(el("#novoProdutoQtdMin")?.value || 0);
  const valorUnitario = window.vstockCurrency.parse(el("#novoProdutoValorUnitario")?.value);
  const catCod = Number(selectCategoria?.value || 0);
  const catDescr = selectCategoria?.selectedOptions?.[0]?.textContent || "";

  if (!descricao || !catCod || qtdMin < 0 || Number.isNaN(valorUnitario) || valorUnitario < 0) {
    msg("Preencha os campos obrigatórios do produto.", "danger");
    return;
  }

  const body = {
    prodDescr: descricao,
    qtdMin,
    valorUnitario,
    codigoBarras: normalizarCodigoBarras(el("#novoProdutoCodigoBarras")?.value || ""),
    categoria: {
      catCod,
      catDescr
    }
  };

  try {
    const resp = await fetch(API.PRODUTO_NOVO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error("Falha ao cadastrar produto.");

    const produto = await resp.json();
    await carregarProdutos();

    el("#novoProdutoDescricao").value = "";
    el("#novoProdutoQtdMin").value = "";
    el("#novoProdutoValorUnitario").value = "";
    el("#novoProdutoCodigoBarras").value = "";
    el("#novaCategoriaProduto").value = "";
    el("#buscaProdutoCompra").value = produto.prodDescr || "";
    filtrarProdutos();
    selecionarProduto(produto);

    if (modalNovoProduto) modalNovoProduto.hide();

    msg("Produto cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível salvar o produto.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  modalNovoFornecedor = new bootstrap.Modal(document.getElementById("modalNovoFornecedor"));
  modalNovoProduto = new bootstrap.Modal(document.getElementById("modalNovoProduto"));

  window.vstockCurrency.attachMask(el("#valorTotalItem"));
  window.vstockCurrency.attachMask(el("#filtroCompraValor"));
  window.vstockCurrency.attachMask(el("#novoProdutoValorUnitario"));

  el("#dataCompra").value = hojeISO();
  await preencherFuncionarioLogado();

  await carregarProdutos();
  await carregarCategoriasProduto();
  await carregarFornecedores();
  await carregarCompras();
  atualizarResumoFormularioEntrada();
  redesenharTabela();
  focarLeituraCodigoBarras();

  el("#btnFiltrarCompras")?.addEventListener("click", () => {
    carregarCompras(1);
  });
  el("#btnLimparFiltroCompras")?.addEventListener("click", () => {
    limparFiltrosCompras();
    carregarCompras(1);
  });

  el("#buscaProdutoCompra")?.addEventListener("input", agendarFiltroProdutos);
  el("#buscaProdutoCompra")?.addEventListener("focus", () => renderizarDropdownProdutos(produtosVisiveis.length ? produtosVisiveis : cacheProdutos, true));
  window.vstockFilterDropdown.attach({
    input: "#filtroCompraProduto",
    getOptions: obterOpcoesFiltroCompraProduto
  });
  el("#listaProdutos")?.addEventListener("change", atualizarResumoFormularioEntrada);
  el("#quantidade")?.addEventListener("input", atualizarResumoFormularioEntrada);
  el("#valorTotalItem")?.addEventListener("input", atualizarResumoFormularioEntrada);
  el("#codigoBarrasCompra")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processarLeituraCodigoBarras();
    }
  });
  el("#btnAddItem")?.addEventListener("click", adicionarItem);
  el("#btnSalvar")?.addEventListener("click", salvarEntrada);
  el("#btnLimparTudo")?.addEventListener("click", limparTudo);
  el("#btnNovoFornecedor")?.addEventListener("click", () => modalNovoFornecedor.show());
  el("#btnSalvarFornecedor")?.addEventListener("click", salvarFornecedorRapido);
  el("#btnCadastroProduto")?.addEventListener("click", () => modalNovoProduto.show());
  el("#btnSalvarProduto")?.addEventListener("click", salvarProdutoRapido);
  el("#novoFornecedorTelefone")?.addEventListener("input", (e) => {
    e.target.value = window.vstockMasks.phone(e.target.value);
  });
  el("#novoFornecedorCpfCnpj")?.addEventListener("input", (e) => {
    e.target.value = window.vstockMasks.cpfCnpj(e.target.value);
  });

  el("#dropdownProdutosCompra")?.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-value]");
    if (!botao) return;
    const produto = cacheProdutos.find((item) => String(item.prodCod) === String(botao.dataset.value));
    selecionarProduto(produto);
  });

  document.addEventListener("click", (e) => {
    const grupo = e.target.closest(".produto-busca-grupo");
    if (!grupo) fecharDropdownProdutos();
  });

  el("#tabelaItens tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const acao = btn.getAttribute("data-acao");
    const idx = Number(btn.getAttribute("data-idx"));

    if (acao === "editar") entrarEdicao(idx);
    if (acao === "remover") removerItem(idx);
    if (acao === "salvar-edicao") salvarEdicao(idx);
    if (acao === "cancelar-edicao") cancelarEdicao();
  });

  el("#tabelaCompras")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.acao === "ver-compra") {
      abrirDetalhesCompra(btn.dataset.id, btn.dataset.data);
    }
    if (btn.dataset.acao === "editar-compra") {
      abrirEdicaoCompra(btn.dataset.id);
    }
  });
});




