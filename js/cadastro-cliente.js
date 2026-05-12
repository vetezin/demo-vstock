const API_CLIENTE = {
  LISTA: "http://localhost:8080/api/cliente/all",
  NOVO: "http://localhost:8080/api/cliente",
  ATUALIZAR: (id) => `http://localhost:8080/api/cliente/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/cliente/${id}/status?ativo=${ativo}`
};

const $cliente = (selector) => document.querySelector(selector);

let clienteEditandoId = null;
let clientesCache = [];
let paginaAtualClientes = 1;
const ITENS_POR_PAGINA_CLIENTES = 10;

function formCliente() {
  return $cliente("#clienteForm");
}

function msgCliente(texto, tipo = "danger") {
  const box = $cliente("#mensagens");
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

function formatarDataCliente(valor) {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}

function badgeStatus(ativo) {
  return ativo
    ? `<span class="badge text-bg-success">Ativo</span>`
    : `<span class="badge text-bg-secondary">Inativo</span>`;
}

function atualizarModoFormulario() {
  const titulo = $cliente("#tituloFormularioCliente");
  const botaoSalvar = $cliente("#btnSalvarCliente");
  const botaoCancelar = $cliente("#btnCancelarEdicao");

  if (clienteEditandoId) {
    titulo.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Cliente`;
    botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar alterações`;
    botaoCancelar.classList.remove("d-none");
    return;
  }

  titulo.innerHTML = `<i class="bi bi-person-plus"></i> Novo Cliente`;
  botaoSalvar.innerHTML = `<i class="bi bi-check2-circle"></i> Salvar cliente`;
  botaoCancelar.classList.add("d-none");
}

function limparFormularioCliente() {
  clienteEditandoId = null;
  $cliente("#nome").value = "";
  $cliente("#cpfCnpj").value = "";
  $cliente("#telefone").value = "";
  $cliente("#observacao").value = "";
  formCliente()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

function preencherFormularioCliente(cliente) {
  clienteEditandoId = cliente.clienteId ?? cliente.cliente_id;
  $cliente("#nome").value = cliente.nome ?? "";
  $cliente("#cpfCnpj").value = window.vstockMasks.cpfCnpj(cliente.cpfCnpj ?? cliente.cpf_cnpj ?? "");
  $cliente("#telefone").value = window.vstockMasks.phone(cliente.telefone ?? "");
  $cliente("#observacao").value = cliente.observacao ?? "";
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formCliente(), "#nome");
}

function obterClientesFiltrados() {
  const filtroNome = $cliente("#filtroNomeCliente")?.value?.trim().toLowerCase() || "";
  const filtroCpf = $cliente("#filtroCpfCliente")?.value?.trim().toLowerCase() || "";
  if (!filtroNome && !filtroCpf) return clientesCache;

  return clientesCache.filter((cliente) => {
    const nome = String(cliente.nome ?? "").toLowerCase();
    const cpfCnpj = String(window.vstockMasks.cpfCnpj(cliente.cpfCnpj ?? cliente.cpf_cnpj ?? "") || "").toLowerCase();
    const matchNome = !filtroNome || nome.includes(filtroNome);
    const matchCpf = !filtroCpf || cpfCnpj.includes(filtroCpf);
    return matchNome && matchCpf;
  });
}

function obterOpcoesNomeCliente() {
  return clientesCache.map((cliente) => cliente.nome);
}

function renderizarClientes() {
  const tbody = $cliente("#tabelaClientes tbody");
  if (!tbody) return;

  const clientesFiltrados = obterClientesFiltrados();
  const paginacao = window.vstockPagination.paginate(
    clientesFiltrados,
    paginaAtualClientes,
    ITENS_POR_PAGINA_CLIENTES
  );
  paginaAtualClientes = paginacao.page;
  const clientesPagina = paginacao.items;

  tbody.innerHTML = clientesPagina.map((cliente) => {
    const id = cliente.clienteId ?? cliente.cliente_id;
    const ativo = cliente.ativo !== false;
    const observacao = String(cliente.observacao ?? "").trim();

    return `
      <tr>
        <td>${cliente.nome ?? "-"}</td>
        <td>${window.vstockMasks.cpfCnpj(cliente.cpfCnpj ?? cliente.cpf_cnpj ?? "") || "-"}</td>
        <td>${window.vstockMasks.phone(cliente.telefone ?? "") || "-"}</td>
        <td title="${observacao || ""}">${observacao || "-"}</td>
        <td>${formatarDataCliente(cliente.createdAt ?? cliente.created_at)}</td>
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
    container: "#paginacaoClientes",
    variant: "cadastro",
    itemLabel: "clientes",
    page: paginaAtualClientes,
    pageSize: ITENS_POR_PAGINA_CLIENTES,
    totalItems: clientesFiltrados.length,
    idPrefix: "Cliente",
    onPageChange: (novaPagina) => {
      paginaAtualClientes = novaPagina;
      renderizarClientes();
    }
  });
}

async function carregarClientes() {
  try {
    const resp = await fetch(API_CLIENTE.LISTA);
    if (!resp.ok) throw new Error("Falha ao carregar clientes.");

    clientesCache = await resp.json();
    paginaAtualClientes = 1;
    renderizarClientes();
  } catch (erro) {
    console.error(erro);
    msgCliente("Não foi possível carregar os clientes.", "danger");
  }
}

async function salvarCliente(event) {
  event.preventDefault();
  const form = formCliente();
  form?.classList.add("validacao-tentada");

  if (form && !form.checkValidity()) {
    msgCliente("Preencha os campos obrigatórios do cliente.", "danger");
    return;
  }

  const body = {
    nome: $cliente("#nome").value.trim(),
    cpfCnpj: $cliente("#cpfCnpj").value.trim(),
    telefone: $cliente("#telefone").value.trim(),
    observacao: $cliente("#observacao").value.trim()
  };

  if (!body.nome) {
    msgCliente("Preencha o nome do cliente.", "danger");
    return;
  }

  try {
    const url = clienteEditandoId ? API_CLIENTE.ATUALIZAR(clienteEditandoId) : API_CLIENTE.NOVO;
    const method = clienteEditandoId ? "PUT" : "POST";
    const estavaEditando = Boolean(clienteEditandoId);

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao salvar cliente.");
    }

    limparFormularioCliente();
    await carregarClientes();
    msgCliente(estavaEditando ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgCliente(erro.message || "Não foi possível salvar o cliente.", "danger");
  }
}

async function alternarStatusCliente(id, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} este cliente?`)) return;

  try {
    const resp = await fetch(API_CLIENTE.STATUS(id, !ativoAtual), {
      method: "PATCH"
    });

    if (!resp.ok) throw new Error("Falha ao atualizar status do cliente.");

    if (clienteEditandoId === id && ativoAtual) {
      limparFormularioCliente();
    }

    await carregarClientes();
    msgCliente(`Cliente ${ativoAtual ? "inativado" : "reativado"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    msgCliente("Não foi possível atualizar o status do cliente.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (formCliente()) {
    formCliente().noValidate = true;
  }
  atualizarModoFormulario();
  await carregarClientes();

  $cliente("#clienteForm")?.addEventListener("submit", salvarCliente);
  $cliente("#btnLimpar")?.addEventListener("click", limparFormularioCliente);
  $cliente("#btnCancelarEdicao")?.addEventListener("click", limparFormularioCliente);
  $cliente("#telefone")?.addEventListener("input", (event) => {
    event.target.value = window.vstockMasks.phone(event.target.value);
  });
  $cliente("#cpfCnpj")?.addEventListener("input", (event) => {
    event.target.value = window.vstockMasks.cpfCnpj(event.target.value);
  });
  $cliente("#filtroCpfCliente")?.addEventListener("input", () => {
    paginaAtualClientes = 1;
    renderizarClientes();
  });
  window.vstockFilterDropdown.attach({
    input: "#filtroNomeCliente",
    getOptions: obterOpcoesNomeCliente,
    onInputValueChange: () => {
      paginaAtualClientes = 1;
      renderizarClientes();
    },
    onOptionSelect: () => {
      paginaAtualClientes = 1;
      renderizarClientes();
    }
  });

  $cliente("#tabelaClientes tbody")?.addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const cliente = clientesCache.find((item) => Number(item.clienteId ?? item.cliente_id) === id);
    if (!cliente) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioCliente(cliente);
    }

    if (botao.dataset.acao === "status") {
      alternarStatusCliente(id, botao.dataset.ativo === "true");
    }
  });
});
