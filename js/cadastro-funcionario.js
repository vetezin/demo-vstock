const API_FUNCIONARIO = {
  LISTA: "http://localhost:8080/api/funcionarios/all",
  NOVO: "http://localhost:8080/api/funcionarios",
  ATUALIZAR: (id) => `http://localhost:8080/api/funcionarios/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/funcionarios/${id}/status?ativo=${ativo}`
};

const $funcionario = (sel) => document.querySelector(sel);
const msgFuncionario = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });

let funcionarioIdEditando = null;
let funcionariosCache = [];
let paginaAtualFuncionarios = 1;
const ITENS_POR_PAGINA_FUNCIONARIOS = 10;

function formFuncionario() {
  return $funcionario("#funcionarioForm");
}

function headersAdminJson() {
  const token = localStorage.getItem("authToken") || "";
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  };
}

function headersAdminSimples() {
  const token = localStorage.getItem("authToken") || "";
  return {
    "Authorization": token ? `Bearer ${token}` : ""
  };
}

function garantirAcessoAdmin() {
  const funcionario = window.vstockSession.getFuncionario();
  if (!window.vstockSession.isAdministrador(funcionario)) {
    window.location.href = funcionario ? "index.html" : "login.html";
    return false;
  }
  return true;
}

function limparCpf(valor) {
  return window.vstockMasks.onlyDigits(valor, 11);
}

function labelPerfil(tipoAcesso) {
  return Number(tipoAcesso) === 99 ? "Administrador" : "Operador";
}

function ehAdministradorProtegido(funcionario) {
  return Number(funcionario?.tipoAcesso) === 99
    && String(funcionario?.funcEmail || "").toLowerCase() === "admin@admin.login";
}

function atualizarModoFormulario() {
  const titulo = $funcionario("#tituloFormularioFuncionario");
  const botaoSalvar = $funcionario("#btnSalvarFuncionario");
  const botaoCancelar = $funcionario("#btnCancelarEdicaoFuncionario");
  const campoCpf = $funcionario("#funcCpf");
  const campoSenha = $funcionario("#funcSenha");
  const labelSenha = $funcionario("#labelSenhaFuncionario");

  if (funcionarioIdEditando) {
    titulo.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Funcionário`;
    botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar alterações`;
    botaoCancelar.classList.remove("d-none");
    campoCpf.removeAttribute("readonly");
    campoSenha?.removeAttribute("required");
    labelSenha?.classList.remove("required");
    return;
  }

  titulo.innerHTML = `<i class="bi bi-person-plus"></i> Novo Funcionário`;
  botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar funcionário`;
  botaoCancelar.classList.add("d-none");
  campoCpf.removeAttribute("readonly");
  campoSenha?.setAttribute("required", "required");
  labelSenha?.classList.add("required");
}

function limparFormularioFuncionario() {
  funcionarioIdEditando = null;
  window.vstockEditModal?.close();
  $funcionario("#funcCpf").value = "";
  $funcionario("#funcNome").value = "";
  $funcionario("#funcTelefone").value = "";
  $funcionario("#funcEmail").value = "";
  $funcionario("#funcUsername").value = "";
  $funcionario("#funcCargo").value = "";
  $funcionario("#funcTipoAcesso").value = "1";
  $funcionario("#funcSenha").value = "";
  formFuncionario()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

function preencherFormularioFuncionario(funcionario) {
  funcionarioIdEditando = funcionario.funcionarioId;
  $funcionario("#funcCpf").value = window.vstockMasks.cpf(funcionario.funcCpf);
  $funcionario("#funcNome").value = funcionario.funcNome ?? "";
  $funcionario("#funcTelefone").value = window.vstockMasks.phone(funcionario.funcTelefone ?? "");
  $funcionario("#funcEmail").value = funcionario.funcEmail ?? "";
  $funcionario("#funcUsername").value = funcionario.username ?? "";
  $funcionario("#funcCargo").value = funcionario.cargo ?? "";
  $funcionario("#funcTipoAcesso").value = String(funcionario.tipoAcesso ?? 1);
  $funcionario("#funcSenha").value = "";
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formFuncionario(), "#funcNome");
}

function obterFuncionariosFiltrados() {
  const filtro = $funcionario("#filtroNomeFuncionario")?.value?.trim().toLowerCase() || "";
  if (!filtro) return funcionariosCache;

  return funcionariosCache.filter((funcionario) =>
    String(funcionario.funcNome ?? "").toLowerCase().includes(filtro)
  );
}

function renderizarFuncionarios() {
  const tbody = $funcionario("#tabelaFuncionarios tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtrados = obterFuncionariosFiltrados();
  const paginacao = window.vstockPagination.paginate(
    filtrados,
    paginaAtualFuncionarios,
    ITENS_POR_PAGINA_FUNCIONARIOS
  );
  paginaAtualFuncionarios = paginacao.page;
  const pagina = paginacao.items;

  pagina.forEach((funcionario) => {
    const ativo = !funcionario.dataDemissao;
    const adminProtegido = ehAdministradorProtegido(funcionario);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${funcionario.funcNome ?? "-"}</td>
      <td>${funcionario.funcEmail ?? "-"}</td>
      <td>${funcionario.username ?? "-"}</td>
      <td>${funcionario.funcTelefone ?? "-"}</td>
      <td>${funcionario.cargo ?? "-"}</td>
      <td>${labelPerfil(funcionario.tipoAcesso)}</td>
      <td>${window.vstockUi.badgeStatus(ativo)}</td>
      <td class="text-center">
        ${adminProtegido
          ? '<span class="text-muted small">Administrador principal ativo</span>'
          : `
            <div class="d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" class="btn btn-sm btn-outline-primary" data-acao="editar" data-id="${funcionario.funcionarioId}">
                <i class="bi bi-pencil-square"></i> Editar
              </button>
              <button type="button" class="btn btn-sm ${ativo ? "btn-outline-warning" : "btn-outline-success"}" data-acao="status" data-id="${funcionario.funcionarioId}" data-ativo="${ativo}">
                <i class="bi ${ativo ? "bi-pause-circle" : "bi-arrow-clockwise"}"></i> ${ativo ? "Inativar" : "Reativar"}
              </button>
            </div>
          `}
      </td>
    `;
    tbody.appendChild(tr);
  });

  window.vstockPagination.render({
    container: "#paginacaoFuncionarios",
    variant: "cadastro",
    itemLabel: "funcionarios",
    page: paginaAtualFuncionarios,
    pageSize: ITENS_POR_PAGINA_FUNCIONARIOS,
    totalItems: filtrados.length,
    idPrefix: "Funcionario",
    onPageChange: (novaPagina) => {
      paginaAtualFuncionarios = novaPagina;
      renderizarFuncionarios();
    }
  });
}

async function carregarFuncionarios() {
  try {
    const resp = await fetch(API_FUNCIONARIO.LISTA, {
      headers: headersAdminSimples()
    });
    if (!resp.ok) throw new Error("Falha ao carregar funcionários.");

    funcionariosCache = await resp.json();
    paginaAtualFuncionarios = 1;
    renderizarFuncionarios();
  } catch (erro) {
    console.error(erro);
    msgFuncionario("Não foi possível carregar os funcionários.", "danger");
  }
}

async function salvarFuncionario(event) {
  event.preventDefault();
  const form = formFuncionario();
  form?.classList.add("validacao-tentada");

  if (form && !form.checkValidity()) {
    msgFuncionario("Preencha os campos obrigatórios do funcionário.", "danger");
    return;
  }

  const body = {
    funcCpf: limparCpf($funcionario("#funcCpf").value),
    funcNome: $funcionario("#funcNome").value.trim(),
    funcTelefone: $funcionario("#funcTelefone").value.trim(),
    funcEmail: $funcionario("#funcEmail").value.trim(),
    username: $funcionario("#funcUsername").value.trim(),
    cargo: $funcionario("#funcCargo").value.trim(),
    tipoAcesso: Number($funcionario("#funcTipoAcesso").value),
    funcSenha: $funcionario("#funcSenha").value
  };

  if (!body.funcCpf || !body.funcNome || !body.funcTelefone || !body.funcEmail || !body.username || !body.cargo) {
    msgFuncionario("Preencha os campos obrigatórios do funcionário.", "danger");
    return;
  }

  if (!funcionarioIdEditando && !body.funcSenha.trim()) {
    msgFuncionario("Informe a senha inicial do funcionário.", "danger");
    return;
  }

  try {
    const url = funcionarioIdEditando ? API_FUNCIONARIO.ATUALIZAR(funcionarioIdEditando) : API_FUNCIONARIO.NOVO;
    const method = funcionarioIdEditando ? "PUT" : "POST";
    const estavaEditando = Boolean(funcionarioIdEditando);

    const resp = await fetch(url, {
      method,
      headers: headersAdminJson(),
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao salvar funcionário.");
    }

    limparFormularioFuncionario();
    await carregarFuncionarios();
    msgFuncionario(estavaEditando ? "Funcionário atualizado com sucesso." : "Funcionário cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgFuncionario(erro.message || "Não foi possível salvar o funcionário.", "danger");
  }
}

async function alternarStatusFuncionario(funcionarioId, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} este funcionário?`)) return;

  try {
    const resp = await fetch(API_FUNCIONARIO.STATUS(funcionarioId, !ativoAtual), {
      method: "PATCH",
      headers: headersAdminSimples()
    });
    if (!resp.ok) throw new Error("Falha ao atualizar status do funcionário.");

    if (funcionarioIdEditando === funcionarioId && ativoAtual) {
      limparFormularioFuncionario();
    }

    await carregarFuncionarios();
    msgFuncionario(`Funcionário ${ativoAtual ? "inativado" : "reativado"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgFuncionario("Não foi possível atualizar o status do funcionário.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!garantirAcessoAdmin()) return;

  if (formFuncionario()) {
    formFuncionario().noValidate = true;
  }
  atualizarModoFormulario();
  await carregarFuncionarios();

  $funcionario("#funcionarioForm")?.addEventListener("submit", salvarFuncionario);
  $funcionario("#btnLimparFuncionario")?.addEventListener("click", limparFormularioFuncionario);
  $funcionario("#btnCancelarEdicaoFuncionario")?.addEventListener("click", limparFormularioFuncionario);
  $funcionario("#funcCpf")?.addEventListener("input", (e) => {
    e.target.value = window.vstockMasks.cpf(e.target.value);
  });
  $funcionario("#funcTelefone")?.addEventListener("input", (e) => {
    e.target.value = window.vstockMasks.phone(e.target.value);
  });
  $funcionario("#filtroNomeFuncionario")?.addEventListener("input", () => {
    paginaAtualFuncionarios = 1;
    renderizarFuncionarios();
  });

  $funcionario("#tabelaFuncionarios tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const funcionarioId = Number(btn.dataset.id);
    const funcionario = funcionariosCache.find((item) => item.funcionarioId === funcionarioId);
    if (!funcionario) return;
    if (ehAdministradorProtegido(funcionario)) return;

    if (btn.dataset.acao === "editar") {
      preencherFormularioFuncionario(funcionario);
      window.vstockEditModal?.open({ title: "Editar Funcionário", form: formFuncionario() });
    }

    if (btn.dataset.acao === "status") {
      alternarStatusFuncionario(funcionarioId, btn.dataset.ativo === "true");
    }
  });
});






