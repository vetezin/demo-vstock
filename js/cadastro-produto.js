const API_PRODUTO = {
  LISTA: "http://localhost:8080/api/produtos/lista",
  NOVO: "http://localhost:8080/api/produtos",
  ATUALIZAR: (id) => `http://localhost:8080/api/produtos/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/produtos/${id}/status?ativo=${ativo}`,
  CATEGORIAS_FORM: "http://localhost:8080/api/categorias-produto?ativosOnly=true"
};

const $produto = (selector) => document.querySelector(selector);

let produtoEditandoId = null;
let produtosCache = [];
let paginaAtualProdutos = 1;
const ITENS_POR_PAGINA_PRODUTOS = 10;

function formProduto() {
  return $produto("#produtoForm");
}

function msgProduto(texto, tipo = "danger") {
  const box = $produto("#mensagens");
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

function formatarDataProduto(valor) {
  if (!valor) return "-";
  return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

function badgeStatus(ativo) {
  return ativo
    ? `<span class="badge text-bg-success">Ativo</span>`
    : `<span class="badge text-bg-secondary">Inativo</span>`;
}

function formatarMoedaProduto(valor) {
  return window.vstockCurrency.formatMoney(valor || 0);
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
  const filtro = $produto("#filtroNomeProduto")?.value?.trim().toLowerCase() || "";
  if (!filtro) return produtosCache;

  return produtosCache.filter((produto) =>
    String(produto.prodDescr ?? produto.prod_descr ?? "").toLowerCase().includes(filtro)
  );
}

function obterOpcoesNomeProduto() {
  return produtosCache.map((produto) => produto.prodDescr ?? produto.prod_descr);
}

function renderizarPaginacaoProdutos(totalItens) {
  const box = $produto("#paginacaoProdutos");
  if (!box) return;

  const totalPaginas = Math.max(1, Math.ceil(totalItens / ITENS_POR_PAGINA_PRODUTOS));
  paginaAtualProdutos = Math.min(paginaAtualProdutos, totalPaginas);
  const inicio = totalItens === 0 ? 0 : ((paginaAtualProdutos - 1) * ITENS_POR_PAGINA_PRODUTOS) + 1;
  const fim = Math.min(paginaAtualProdutos * ITENS_POR_PAGINA_PRODUTOS, totalItens);

  box.innerHTML = `
    <div class="paginacao-cadastro-resumo">
      Exibindo ${inicio}-${fim} de ${totalItens} produtos
    </div>
    <div class="paginacao-cadastro-botoes">
      <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaAnteriorProduto" ${paginaAtualProdutos === 1 ? "disabled" : ""}>
        <i class="bi bi-chevron-left"></i> Anterior
      </button>
      <span class="paginacao-cadastro-resumo">Página ${paginaAtualProdutos} de ${totalPaginas}</span>
      <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaProximaProduto" ${paginaAtualProdutos === totalPaginas || totalItens === 0 ? "disabled" : ""}>
        Próxima <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  `;

  $produto("#btnPaginaAnteriorProduto")?.addEventListener("click", () => {
    if (paginaAtualProdutos > 1) {
      paginaAtualProdutos -= 1;
      renderizarProdutos();
    }
  });

  $produto("#btnPaginaProximaProduto")?.addEventListener("click", () => {
    if (paginaAtualProdutos < totalPaginas) {
      paginaAtualProdutos += 1;
      renderizarProdutos();
    }
  });
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
        <td>${formatarMoedaProduto(produto.valorUnitario ?? produto.valor_unitario ?? 0)}</td>
        <td>${produto.codigoBarras ?? produto.codigo_barras ?? "-"}</td>
        <td>${formatarDataProduto(produto.dataCadastro ?? produto.data_cadastro)}</td>
        <td>${badgeStatus(ativo)}</td>
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

  $produto("#tabelaProdutos tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const produto = produtosCache.find((item) => Number(item.prodCod ?? item.prod_cod) === id);
    if (!produto) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioProduto(produto);
    }

    if (botao.dataset.acao === "status") {
      alternarStatusProduto(id, botao.dataset.ativo === "true");
    }
  });
});
