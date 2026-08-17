const API_CATEGORIA = {
  LISTA: "http://localhost:8080/api/categorias-produto",
  NOVA: "http://localhost:8080/api/categorias-produto",
  ATUALIZAR: (id) => `http://localhost:8080/api/categorias-produto/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/categorias-produto/${id}/status?ativo=${ativo}`
};

const $categoria = (sel) => document.querySelector(sel);
const msgCategoria = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });

let categoriaEditandoId = null;
let categoriasCache = [];
let paginaAtualCategorias = 1;
const ITENS_POR_PAGINA_CATEGORIAS = 10;

function formCategoria() {
  return $categoria("#categoriaForm");
}

function badgeStatus(ativo) {
  return ativo
    ? `<span class="badge text-bg-success">Ativa</span>`
    : `<span class="badge text-bg-secondary">Inativa</span>`;
}

function atualizarModoFormulario() {
  const titulo = $categoria("#tituloFormularioCategoria");
  const botaoSalvar = $categoria("#btnSalvarCategoria");
  const botaoCancelar = $categoria("#btnCancelarEdicao");

  if (categoriaEditandoId) {
    titulo.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Categoria`;
    botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar alterações`;
    botaoCancelar.classList.remove("d-none");
    return;
  }

  titulo.innerHTML = `<i class="bi bi-tag"></i> Nova Categoria`;
  botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar categoria`;
  botaoCancelar.classList.add("d-none");
}

function limparFormularioCategoria() {
  categoriaEditandoId = null;
  window.vstockEditModal?.close();
  $categoria("#categoriaDescricao").value = "";
  formCategoria()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

function preencherFormularioCategoria(categoria) {
  categoriaEditandoId = categoria.catCod ?? categoria.cat_cod;
  $categoria("#categoriaDescricao").value = categoria.catDescr ?? categoria.cat_descr ?? "";
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formCategoria(), "#categoriaDescricao");
}

function obterCategoriasFiltradas() {
  const filtro = $categoria("#filtroNomeCategoria")?.value?.trim().toLowerCase() || "";
  if (!filtro) return categoriasCache;

  return categoriasCache.filter((categoria) =>
    String(categoria.catDescr ?? categoria.cat_descr ?? "").toLowerCase().includes(filtro)
  );
}

function obterOpcoesNomeCategoria() {
  return categoriasCache.map((categoria) => categoria.catDescr ?? categoria.cat_descr);
}

function renderizarCategorias() {
  const tbody = $categoria("#tabelaCategorias tbody");
  if (!tbody) return;

  const categoriasFiltradas = obterCategoriasFiltradas();
  const paginacao = window.vstockPagination.paginate(
    categoriasFiltradas,
    paginaAtualCategorias,
    ITENS_POR_PAGINA_CATEGORIAS
  );
  paginaAtualCategorias = paginacao.page;
  const categoriasPagina = paginacao.items;

  tbody.innerHTML = categoriasPagina.map((categoria) => {
    const id = categoria.catCod ?? categoria.cat_cod;
    const ativo = categoria.ativo !== false;
    return `
      <tr>
        <td>${categoria.catDescr ?? categoria.cat_descr ?? "-"}</td>
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
    container: "#paginacaoCategorias",
    variant: "cadastro",
    itemLabel: "categorias",
    page: paginaAtualCategorias,
    pageSize: ITENS_POR_PAGINA_CATEGORIAS,
    totalItems: categoriasFiltradas.length,
    idPrefix: "Categoria",
    onPageChange: (novaPagina) => {
      paginaAtualCategorias = novaPagina;
      renderizarCategorias();
    }
  });
}

async function carregarCategorias() {
  try {
    const resp = await fetch(API_CATEGORIA.LISTA);
    if (!resp.ok) throw new Error("Falha ao carregar categorias.");

    categoriasCache = await resp.json();
    paginaAtualCategorias = 1;
    renderizarCategorias();
  } catch (erro) {
    console.error(erro);
    msgCategoria("Não foi possível carregar as categorias.", "danger");
  }
}

async function salvarCategoria(event) {
  event.preventDefault();
  const form = formCategoria();
  form?.classList.add("validacao-tentada");

  if (form && !form.checkValidity()) {
    msgCategoria("Informe a descrição da categoria.", "danger");
    return;
  }

  const descricao = $categoria("#categoriaDescricao").value.trim();

  try {
    const url = categoriaEditandoId ? API_CATEGORIA.ATUALIZAR(categoriaEditandoId) : API_CATEGORIA.NOVA;
    const method = categoriaEditandoId ? "PUT" : "POST";

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catDescr: descricao })
    });

    if (!resp.ok) throw new Error("Falha ao salvar categoria.");

    const estavaEditando = Boolean(categoriaEditandoId);
    limparFormularioCategoria();
    await carregarCategorias();
    msgCategoria(estavaEditando ? "Categoria atualizada com sucesso." : "Categoria cadastrada com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgCategoria("Não foi possível salvar a categoria.", "danger");
  }
}

async function alternarStatusCategoria(id, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} esta categoria?`)) return;

  try {
    const resp = await fetch(API_CATEGORIA.STATUS(id, !ativoAtual), {
      method: "PATCH"
    });

    if (!resp.ok) throw new Error("Falha ao atualizar status da categoria.");

    if (categoriaEditandoId === id && ativoAtual) {
      limparFormularioCategoria();
    }

    await carregarCategorias();
    msgCategoria(`Categoria ${ativoAtual ? "inativada" : "reativada"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgCategoria("Não foi possível atualizar o status da categoria.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (formCategoria()) {
    formCategoria().noValidate = true;
  }
  atualizarModoFormulario();
  await carregarCategorias();

  $categoria("#categoriaForm")?.addEventListener("submit", salvarCategoria);
  $categoria("#btnLimpar")?.addEventListener("click", limparFormularioCategoria);
  $categoria("#btnCancelarEdicao")?.addEventListener("click", limparFormularioCategoria);
  window.vstockFilterDropdown.attach({
    input: "#filtroNomeCategoria",
    getOptions: obterOpcoesNomeCategoria,
    onInputValueChange: () => {
      paginaAtualCategorias = 1;
      renderizarCategorias();
    },
    onOptionSelect: () => {
      paginaAtualCategorias = 1;
      renderizarCategorias();
    }
  });

  $categoria("#tabelaCategorias tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const categoria = categoriasCache.find((item) => Number(item.catCod ?? item.cat_cod) === id);
    if (!categoria) return;

    if (btn.dataset.acao === "editar") {
      preencherFormularioCategoria(categoria);
      window.vstockEditModal?.open({ title: "Editar Categoria", form: formCategoria() });
    }

    if (btn.dataset.acao === "status") {
      alternarStatusCategoria(id, btn.dataset.ativo === "true");
    }
  });
});



