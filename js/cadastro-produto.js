const API_PRODUTO = {
  LISTA: "http://localhost:8080/api/produtos/lista",
  NOVO: "http://localhost:8080/api/produtos",
  ATUALIZAR: (id) => `http://localhost:8080/api/produtos/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/produtos/${id}/status?ativo=${ativo}`,
  CATEGORIAS_FORM: "http://localhost:8080/api/categorias-produto?ativosOnly=true"
};

const $produto = (selector) => document.querySelector(selector);
const msgProduto = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });

let produtoEditandoId = null;
let produtosCache = [];
let paginaAtualProdutos = 1;
const ITENS_POR_PAGINA_PRODUTOS = 10;

function formProduto() {
  return $produto("#produtoForm");
}

function atualizarModoFormulario() {
  const titulo = $produto("#tituloFormularioProduto");
  const botaoSalvar = $produto("#btnSalvarProduto");
  const botaoCancelar = $produto("#btnCancelarEdicao");

  if (produtoEditandoId) {
    titulo.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Produto`;
    botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar alterações`;
    botaoCancelar.classList.remove("d-none");
    return;
  }

  titulo.innerHTML = `<i class="bi bi-plus-square"></i> Novo Produto`;
  botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar produto`;
  botaoCancelar.classList.add("d-none");
}

function limparFormularioProduto() {
  produtoEditandoId = null;
  window.vstockEditModal?.close();
  $produto("#produtoDescricao").value = "";
  $produto("#produtoQtdMin").value = "";
  $produto("#produtoValorUnitario").value = "";
  $produto("#produtoCodigoBarras").value = "";
  $produto("#categoriaProduto").value = "";
  formProduto()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

async function carregarCategorias(categoriaSelecionada = null, textoCategoria = "") {
  try {
    const resp = await fetch(API_PRODUTO.CATEGORIAS_FORM);
    if (!resp.ok) throw new Error("Falha ao carregar categorias.");

    const categorias = await resp.json();
    const select = $produto("#categoriaProduto");
    select.innerHTML = `<option value="" selected disabled>Selecione...</option>`;

    categorias.forEach((categoria) => {
      const option = document.createElement("option");
      option.value = categoria.catCod;
      option.textContent = categoria.catDescr;
      select.appendChild(option);
    });

    if (categoriaSelecionada) {
      const existe = [...select.options].some((option) => String(option.value) === String(categoriaSelecionada));
      if (!existe) {
        const option = document.createElement("option");
        option.value = categoriaSelecionada;
        option.textContent = `${textoCategoria || "Categoria"} (Inativa)`;
        select.appendChild(option);
      }
      select.value = String(categoriaSelecionada);
    }
  } catch (erro) {
    console.error(erro);
    msgProduto("Não foi possível carregar as categorias.", "danger");
  }
}

function preencherFormularioProduto(produto) {
  produtoEditandoId = produto.prodCod ?? produto.prod_cod;
  $produto("#produtoDescricao").value = produto.prodDescr ?? produto.prod_descr ?? "";
  $produto("#produtoQtdMin").value = produto.qtdMin ?? produto.qtd_min ?? 0;
  $produto("#produtoValorUnitario").value = window.vstockCurrency.formatNumber(produto.valorUnitario ?? produto.valor_unitario ?? 0);
  $produto("#produtoCodigoBarras").value = produto.codigoBarras ?? produto.codigo_barras ?? "";
  carregarCategorias(
    produto.categoria?.catCod ?? produto.categoria?.cat_cod,
    produto.categoria?.catDescr ?? produto.categoria?.cat_descr ?? ""
  );
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formProduto(), "#produtoDescricao");
}

function obterProdutosFiltrados() {
  const filtroNome = $produto("#filtroNomeProduto")?.value?.trim().toLowerCase() || "";
  const filtroCategoria = $produto("#filtroCategoriaProduto")?.value?.trim().toLowerCase() || "";
  const filtroStatus = $produto("#filtroStatusProduto")?.value || "";

  return produtosCache.filter((produto) => {
    const nome = String(produto.prodDescr ?? produto.prod_descr ?? "").toLowerCase();
    const categoria = String(produto.categoria?.catDescr ?? produto.categoria?.cat_descr ?? "").toLowerCase();
    const ativo = produto.ativo !== false;
    const correspondeStatus = !filtroStatus || (filtroStatus === "ativo" ? ativo : !ativo);

    return nome.includes(filtroNome) && categoria.includes(filtroCategoria) && correspondeStatus;
  });
}

function obterOpcoesNomeProduto() {
  return produtosCache.map((produto) => produto.prodDescr ?? produto.prod_descr);
}

function obterOpcoesCategoriaProduto() {
  return [...new Set(produtosCache
    .map((produto) => produto.categoria?.catDescr ?? produto.categoria?.cat_descr)
    .filter(Boolean))];
}

function renderizarProdutos() {
  const tbody = $produto("#tabelaProdutos tbody");
  if (!tbody) return;

  const produtosFiltrados = obterProdutosFiltrados();
  const paginacao = window.vstockPagination.paginate(
    produtosFiltrados,
    paginaAtualProdutos,
    ITENS_POR_PAGINA_PRODUTOS
  );
  paginaAtualProdutos = paginacao.page;
  const produtosPagina = paginacao.items;

  tbody.innerHTML = produtosPagina.map((produto) => {
    const id = produto.prodCod ?? produto.prod_cod;
    const ativo = produto.ativo !== false;

    return `
      <tr>
        <td>${produto.prodDescr ?? produto.prod_descr ?? "-"}</td>
        <td>${produto.categoria?.catDescr ?? produto.categoria?.cat_descr ?? "-"}</td>
        <td>${produto.qtdMin ?? produto.qtd_min ?? 0}</td>
        <td>${window.vstockCurrency.formatMoney(produto.valorUnitario ?? produto.valor_unitario ?? 0)}</td>
        <td>${produto.codigoBarras ?? produto.codigo_barras ?? "-"}</td>
        <td>${window.vstockFormatters.date(produto.dataCadastro ?? produto.data_cadastro)}</td>
        <td>${window.vstockUi.badgeStatus(ativo)}</td>
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

  window.vstockPagination.render({
    container: "#paginacaoProdutos",
    variant: "cadastro",
    itemLabel: "produtos",
    page: paginaAtualProdutos,
    pageSize: ITENS_POR_PAGINA_PRODUTOS,
    totalItems: produtosFiltrados.length,
    idPrefix: "Produto",
    onPageChange: (novaPagina) => {
      paginaAtualProdutos = novaPagina;
      renderizarProdutos();
    }
  });
}

async function carregarProdutos() {
  try {
    const resp = await fetch(API_PRODUTO.LISTA);
    if (!resp.ok) throw new Error("Falha ao carregar produtos.");

    produtosCache = await resp.json();
    paginaAtualProdutos = 1;
    renderizarProdutos();
  } catch (erro) {
    console.error(erro);
    msgProduto("Não foi possível carregar os produtos.", "danger");
  }
}

async function salvarProduto(event) {
  event.preventDefault();
  const form = formProduto();
  form?.classList.add("validacao-tentada");

  if (form && !form.checkValidity()) {
    msgProduto("Preencha os campos obrigatórios do produto.", "danger");
    return;
  }

  const descricao = $produto("#produtoDescricao").value.trim();
  const qtdMin = Number($produto("#produtoQtdMin").value || 0);
  const valorUnitario = window.vstockCurrency.parse($produto("#produtoValorUnitario").value);
  const codigoBarras = $produto("#produtoCodigoBarras").value.trim();
  const categoriaSelect = $produto("#categoriaProduto");
  const categoriaId = Number(categoriaSelect.value || 0);
  const categoriaDescricao = categoriaSelect.selectedOptions?.[0]?.textContent || "";

  if (!descricao || !categoriaId || qtdMin < 0 || Number.isNaN(valorUnitario) || valorUnitario < 0) {
    msgProduto("Preencha os campos obrigatórios do produto.", "danger");
    return;
  }

  const body = {
    prodDescr: descricao,
    qtdMin,
    valorUnitario,
    codigoBarras,
    categoria: {
      catCod: categoriaId,
      catDescr: categoriaDescricao.replace(" (Inativa)", "")
    }
  };

  try {
    const url = produtoEditandoId ? API_PRODUTO.ATUALIZAR(produtoEditandoId) : API_PRODUTO.NOVO;
    const method = produtoEditandoId ? "PUT" : "POST";

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao salvar produto.");
    }

    const estavaEditando = Boolean(produtoEditandoId);
    limparFormularioProduto();
    await carregarCategorias();
    await carregarProdutos();
    msgProduto(estavaEditando ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgProduto(erro.message || "Não foi possível salvar o produto.", "danger");
  }
}

async function alternarStatusProduto(id, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} este produto?`)) return;

  try {
    const resp = await fetch(API_PRODUTO.STATUS(id, !ativoAtual), {
      method: "PATCH"
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao atualizar status do produto.");
    }

    if (produtoEditandoId === id && ativoAtual) {
      limparFormularioProduto();
    }

    await carregarProdutos();
    msgProduto(`Produto ${ativoAtual ? "inativado" : "reativado"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgProduto(erro.message || "Não foi possível atualizar o status do produto.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (formProduto()) {
    formProduto().noValidate = true;
  }
  window.vstockCurrency.attachMask($produto("#produtoValorUnitario"));
  atualizarModoFormulario();
  await carregarCategorias();
  await carregarProdutos();

  $produto("#produtoForm")?.addEventListener("submit", salvarProduto);
  $produto("#btnLimpar")?.addEventListener("click", limparFormularioProduto);
  $produto("#btnCancelarEdicao")?.addEventListener("click", limparFormularioProduto);
  window.vstockFilterDropdown.attach({
    input: "#filtroNomeProduto",
    getOptions: obterOpcoesNomeProduto,
    onInputValueChange: () => {
      paginaAtualProdutos = 1;
      renderizarProdutos();
    },
    onOptionSelect: () => {
      paginaAtualProdutos = 1;
      renderizarProdutos();
    }
  });
  window.vstockFilterDropdown.attach({
    input: "#filtroCategoriaProduto",
    getOptions: obterOpcoesCategoriaProduto,
    onInputValueChange: () => {
      paginaAtualProdutos = 1;
      renderizarProdutos();
    },
    onOptionSelect: () => {
      paginaAtualProdutos = 1;
      renderizarProdutos();
    }
  });
  $produto("#filtroStatusProduto")?.addEventListener("change", () => {
    paginaAtualProdutos = 1;
    renderizarProdutos();
  });

  $produto("#tabelaProdutos tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const produto = produtosCache.find((item) => Number(item.prodCod ?? item.prod_cod) === id);
    if (!produto) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioProduto(produto);
      window.vstockEditModal?.open({ title: "Editar Produto", form: formProduto() });
    }

    if (botao.dataset.acao === "status") {
      alternarStatusProduto(id, botao.dataset.ativo === "true");
    }
  });
});

