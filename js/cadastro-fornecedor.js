const API_FORNECEDOR = {
  LISTA: "http://localhost:8080/api/fornecedor/all",
  NOVO: "http://localhost:8080/api/fornecedor",
  ATUALIZAR: (id) => `http://localhost:8080/api/fornecedor/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/fornecedor/${id}/status?ativo=${ativo}`
};

const $fornecedor = (selector) => document.querySelector(selector);

let fornecedorEditandoId = null;
let fornecedoresCache = [];
let paginaAtualFornecedores = 1;
const ITENS_POR_PAGINA_FORNECEDORES = 10;

function formFornecedor() {
  return $fornecedor("#fornecedorForm");
}

function aplicarMascaraTelefone(valor) {
  const numeros = String(valor || "").replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 2) return numeros ? `(${numeros}` : "";
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)})${numeros.slice(2)}`;
  if (numeros.length <= 10) return `(${numeros.slice(0, 2)})${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  return `(${numeros.slice(0, 2)})${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

function aplicarMascaraCpfCnpj(valor) {
  const numeros = String(valor || "").replace(/\D/g, "").slice(0, 14);

  if (numeros.length <= 11) {
    if (numeros.length <= 3) return numeros;
    if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
    if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
  }

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 5) return `${numeros.slice(0, 2)}.${numeros.slice(2)}`;
  if (numeros.length <= 8) return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5)}`;
  if (numeros.length <= 12) return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5, 8)}/${numeros.slice(8)}`;
  return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5, 8)}/${numeros.slice(8, 12)}-${numeros.slice(12)}`;
}

function msgFornecedor(texto, tipo = "danger") {
  const box = $fornecedor("#mensagens");
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

function formatarDataFornecedor(valor) {
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

function atualizarModoFormulario() {
  const titulo = $fornecedor("#tituloFormularioFornecedor");
  const botaoSalvar = $fornecedor("#btnSalvarFornecedor");
  const botaoCancelar = $fornecedor("#btnCancelarEdicao");

  if (fornecedorEditandoId) {
    titulo.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Fornecedor`;
    botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar alterações`;
    botaoCancelar.classList.remove("d-none");
    return;
  }

  titulo.innerHTML = `<i class="bi bi-person-plus"></i> Novo Fornecedor`;
  botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar fornecedor`;
  botaoCancelar.classList.add("d-none");
}

function limparFormularioFornecedor() {
  fornecedorEditandoId = null;
  $fornecedor("#nome").value = "";
  $fornecedor("#contato").value = "";
  $fornecedor("#email").value = "";
  $fornecedor("#telefone").value = "";
  $fornecedor("#cpfCnpj").value = "";
  $fornecedor("#descricao").value = "";
  formFornecedor()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

function preencherFormularioFornecedor(fornecedor) {
  fornecedorEditandoId = fornecedor.idFornecedor ?? fornecedor.id_fornecedor;
  $fornecedor("#nome").value = fornecedor.nome ?? "";
  $fornecedor("#contato").value = fornecedor.contato ?? "";
  $fornecedor("#email").value = fornecedor.email ?? "";
  $fornecedor("#telefone").value = fornecedor.telefone ?? "";
  $fornecedor("#cpfCnpj").value = aplicarMascaraCpfCnpj(fornecedor.cpfCnpj ?? fornecedor.cpf_cnpj ?? "");
  $fornecedor("#descricao").value = fornecedor.descricao ?? "";
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formFornecedor(), "#nome");
}

function obterFornecedoresFiltrados() {
  const filtroNome = $fornecedor("#filtroNomeFornecedor")?.value?.trim().toLowerCase() || "";
  const filtroContato = $fornecedor("#filtroContatoFornecedor")?.value?.trim().toLowerCase() || "";
  if (!filtroNome && !filtroContato) return fornecedoresCache;

  return fornecedoresCache.filter((fornecedor) => {
    const matchNome = !filtroNome || String(fornecedor.nome ?? "").toLowerCase().includes(filtroNome);
    const matchContato = !filtroContato || String(fornecedor.contato ?? "").toLowerCase().includes(filtroContato);
    return matchNome && matchContato;
  });
}

function renderizarPaginacaoFornecedores(totalItens) {
  const box = $fornecedor("#paginacaoFornecedores");
  if (!box) return;

  const totalPaginas = Math.max(1, Math.ceil(totalItens / ITENS_POR_PAGINA_FORNECEDORES));
  paginaAtualFornecedores = Math.min(paginaAtualFornecedores, totalPaginas);
  const inicio = totalItens === 0 ? 0 : ((paginaAtualFornecedores - 1) * ITENS_POR_PAGINA_FORNECEDORES) + 1;
  const fim = Math.min(paginaAtualFornecedores * ITENS_POR_PAGINA_FORNECEDORES, totalItens);

  box.innerHTML = `
    <div class="paginacao-cadastro-resumo">
      Exibindo ${inicio}-${fim} de ${totalItens} fornecedores
    </div>
    <div class="paginacao-cadastro-botoes">
      <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaAnteriorFornecedor" ${paginaAtualFornecedores === 1 ? "disabled" : ""}>
        <i class="bi bi-chevron-left"></i> Anterior
      </button>
      <span class="paginacao-cadastro-resumo">Página ${paginaAtualFornecedores} de ${totalPaginas}</span>
      <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaProximaFornecedor" ${paginaAtualFornecedores === totalPaginas || totalItens === 0 ? "disabled" : ""}>
        Próxima <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  `;

  $fornecedor("#btnPaginaAnteriorFornecedor")?.addEventListener("click", () => {
    if (paginaAtualFornecedores > 1) {
      paginaAtualFornecedores -= 1;
      renderizarFornecedores();
    }
  });

  $fornecedor("#btnPaginaProximaFornecedor")?.addEventListener("click", () => {
    if (paginaAtualFornecedores < totalPaginas) {
      paginaAtualFornecedores += 1;
      renderizarFornecedores();
    }
  });
}

function renderizarFornecedores() {
  const tbody = $fornecedor("#tabelaFornecedores tbody");
  if (!tbody) return;

  const fornecedoresFiltrados = obterFornecedoresFiltrados();
  const paginacao = window.vstockPagination.paginate(
    fornecedoresFiltrados,
    paginaAtualFornecedores,
    ITENS_POR_PAGINA_FORNECEDORES
  );
  paginaAtualFornecedores = paginacao.page;
  const fornecedoresPagina = paginacao.items;

  tbody.innerHTML = fornecedoresPagina.map((fornecedor) => {
    const id = fornecedor.idFornecedor ?? fornecedor.id_fornecedor;
    const ativo = fornecedor.ativo !== false;

    return `
      <tr>
        <td>${fornecedor.nome ?? "-"}</td>
        <td>${aplicarMascaraCpfCnpj(fornecedor.cpfCnpj ?? fornecedor.cpf_cnpj ?? "") || "-"}</td>
        <td>${fornecedor.telefone ?? "-"}</td>
        <td>${fornecedor.email ?? "-"}</td>
        <td>${fornecedor.contato ?? "-"}</td>
        <td>${formatarDataFornecedor(fornecedor.dataCadastro ?? fornecedor.data_cadastro)}</td>
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
    container: "#paginacaoFornecedores",
    variant: "cadastro",
    itemLabel: "fornecedores",
    page: paginaAtualFornecedores,
    pageSize: ITENS_POR_PAGINA_FORNECEDORES,
    totalItems: fornecedoresFiltrados.length,
    idPrefix: "Fornecedor",
    onPageChange: (novaPagina) => {
      paginaAtualFornecedores = novaPagina;
      renderizarFornecedores();
    }
  });
}

async function carregarFornecedores() {
  try {
    const resp = await fetch(API_FORNECEDOR.LISTA);
    if (!resp.ok) throw new Error("Falha ao carregar fornecedores.");

    fornecedoresCache = await resp.json();
    paginaAtualFornecedores = 1;
    renderizarFornecedores();
  } catch (erro) {
    console.error(erro);
    msgFornecedor("Não foi possível carregar os fornecedores.", "danger");
  }
}

async function salvarFornecedor(event) {
  event.preventDefault();
  const form = formFornecedor();
  form?.classList.add("validacao-tentada");

  if (form && !form.checkValidity()) {
    msgFornecedor("Preencha os campos obrigatórios do fornecedor.", "danger");
    return;
  }

  const body = {
    nome: $fornecedor("#nome").value.trim(),
    contato: $fornecedor("#contato").value.trim(),
    email: $fornecedor("#email").value.trim(),
    telefone: $fornecedor("#telefone").value.trim(),
    cpfCnpj: $fornecedor("#cpfCnpj").value.trim(),
    descricao: $fornecedor("#descricao").value.trim()
  };

  if (!body.nome || !body.contato || !body.email || !body.telefone) {
    msgFornecedor("Preencha os campos obrigatórios do fornecedor.", "danger");
    return;
  }

  try {
    const url = fornecedorEditandoId ? API_FORNECEDOR.ATUALIZAR(fornecedorEditandoId) : API_FORNECEDOR.NOVO;
    const method = fornecedorEditandoId ? "PUT" : "POST";
    const estavaEditando = Boolean(fornecedorEditandoId);

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao salvar fornecedor.");
    }

    limparFormularioFornecedor();
    await carregarFornecedores();
    msgFornecedor(estavaEditando ? "Fornecedor atualizado com sucesso." : "Fornecedor cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgFornecedor(erro.message || "Não foi possível salvar o fornecedor.", "danger");
  }
}

async function alternarStatusFornecedor(id, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} este fornecedor?`)) return;

  try {
    const resp = await fetch(API_FORNECEDOR.STATUS(id, !ativoAtual), {
      method: "PATCH"
    });

    if (!resp.ok) throw new Error("Falha ao atualizar status do fornecedor.");

    if (fornecedorEditandoId === id && ativoAtual) {
      limparFormularioFornecedor();
    }

    await carregarFornecedores();
    msgFornecedor(`Fornecedor ${ativoAtual ? "inativado" : "reativado"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgFornecedor("Não foi possível atualizar o status do fornecedor.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (formFornecedor()) {
    formFornecedor().noValidate = true;
  }
  atualizarModoFormulario();
  await carregarFornecedores();

  $fornecedor("#fornecedorForm")?.addEventListener("submit", salvarFornecedor);
  $fornecedor("#btnLimpar")?.addEventListener("click", limparFormularioFornecedor);
  $fornecedor("#btnCancelarEdicao")?.addEventListener("click", limparFormularioFornecedor);
  $fornecedor("#telefone")?.addEventListener("input", (event) => {
    event.target.value = aplicarMascaraTelefone(event.target.value);
  });
  $fornecedor("#cpfCnpj")?.addEventListener("input", (event) => {
    event.target.value = aplicarMascaraCpfCnpj(event.target.value);
  });
  $fornecedor("#filtroNomeFornecedor")?.addEventListener("input", () => {
    paginaAtualFornecedores = 1;
    renderizarFornecedores();
  });
  $fornecedor("#filtroContatoFornecedor")?.addEventListener("input", () => {
    paginaAtualFornecedores = 1;
    renderizarFornecedores();
  });

  $fornecedor("#tabelaFornecedores tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const fornecedor = fornecedoresCache.find((item) => Number(item.idFornecedor ?? item.id_fornecedor) === id);
    if (!fornecedor) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioFornecedor(fornecedor);
    }

    if (botao.dataset.acao === "status") {
      alternarStatusFornecedor(id, botao.dataset.ativo === "true");
    }
  });
});
