const API_VEICULOS = {
  LISTAR: "http://localhost:8080/api/oficina/veiculos",
  CLIENTES_ATIVOS: "http://localhost:8080/api/cliente/all?ativosOnly=true",
  CRIAR: "http://localhost:8080/api/oficina/veiculos",
  ATUALIZAR: (id) => `http://localhost:8080/api/oficina/veiculos/${id}`,
  STATUS: (id, ativo) => `http://localhost:8080/api/oficina/veiculos/${id}/status?ativo=${ativo}`
};

const $veiculo = (selector) => document.querySelector(selector);
const mensagemVeiculo = window.vstockUi.createAlertHandler({
  container: "#mensagens",
  autoRemoveMs: 4500
});

let veiculoEditandoId = null;
let veiculosCache = [];
let clientesAtivosCache = [];
let paginaAtualVeiculos = 1;
const ITENS_POR_PAGINA = 10;

function formularioVeiculo() {
  return $veiculo("#veiculoForm");
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarPlaca(valor) {
  return String(valor ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

function placaValida(placa) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);
}

function atualizarModoFormulario() {
  const titulo = $veiculo("#tituloFormularioVeiculo");
  const botaoSalvar = $veiculo("#btnSalvarVeiculo");
  const botaoCancelar = $veiculo("#btnCancelarEdicao");

  if (veiculoEditandoId) {
    titulo.innerHTML = '<i class="bi bi-pencil-square"></i> Editar veículo';
    botaoSalvar.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar alterações';
    botaoCancelar.classList.remove("d-none");
    return;
  }

  titulo.innerHTML = '<i class="bi bi-plus-circle"></i> Novo veículo';
  botaoSalvar.innerHTML = '<i class="bi bi-check2-circle"></i> Salvar veículo';
  botaoCancelar.classList.add("d-none");
}

function preencherClientesAtivos(clienteSelecionadoId = "") {
  const cliente = clientesAtivosCache.find((item) =>
    String(item.clienteId ?? item.cliente_id) === String(clienteSelecionadoId ?? ""));
  $veiculo("#clienteId").value = cliente ? String(cliente.clienteId ?? cliente.cliente_id) : "";
  $veiculo("#clienteNome").value = cliente?.nome ?? "";
}

function limparFormularioVeiculo() {
  veiculoEditandoId = null;
  window.vstockEditModal?.close();
  formularioVeiculo()?.reset();
  preencherClientesAtivos();
  formularioVeiculo()?.classList.remove("validacao-tentada");
  atualizarModoFormulario();
}

function preencherFormularioVeiculo(veiculo) {
  veiculoEditandoId = Number(veiculo.veiculoId);
  preencherClientesAtivos(veiculo.clienteId);
  $veiculo("#placa").value = normalizarPlaca(veiculo.placa);
  $veiculo("#marca").value = veiculo.marca ?? "";
  $veiculo("#modelo").value = veiculo.modelo ?? "";
  $veiculo("#anoFabricacao").value = veiculo.anoFabricacao ?? "";
  $veiculo("#cor").value = veiculo.cor ?? "";
  $veiculo("#observacao").value = veiculo.observacao ?? "";
  atualizarModoFormulario();
  window.destacarFormularioEdicao?.(formularioVeiculo(), "#clienteId");
}

function veiculosFiltrados() {
  const filtroVeiculo = normalizarTexto($veiculo("#filtroVeiculo")?.value);
  const filtroCliente = normalizarTexto($veiculo("#filtroCliente")?.value);
  const status = $veiculo("#filtroStatus")?.value ?? "todos";

  return veiculosCache.filter((veiculo) => {
    const dadosVeiculo = normalizarTexto(`${veiculo.placa} ${veiculo.marca} ${veiculo.modelo}`);
    const cliente = normalizarTexto(veiculo.clienteNome);
    const ativo = veiculo.ativo !== false;
    const statusCorreto = status === "todos"
      || (status === "ativos" && ativo)
      || (status === "inativos" && !ativo);

    return (!filtroVeiculo || dadosVeiculo.includes(filtroVeiculo))
      && (!filtroCliente || cliente.includes(filtroCliente))
      && statusCorreto;
  });
}

function renderizarVeiculos() {
  const tbody = $veiculo("#tabelaVeiculos tbody");
  if (!tbody) return;

  const filtrados = veiculosFiltrados();
  const paginacao = window.vstockPagination.paginate(
    filtrados,
    paginaAtualVeiculos,
    ITENS_POR_PAGINA
  );
  paginaAtualVeiculos = paginacao.page;

  if (!paginacao.items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          Nenhum veículo encontrado.
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = paginacao.items.map((veiculo) => {
      const id = Number(veiculo.veiculoId);
      const ativo = veiculo.ativo !== false;
      const veiculoNome = [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ") || "-";

      return `
        <tr>
          <td><strong>${escaparHtml(veiculo.placa || "-")}</strong></td>
          <td>${escaparHtml(veiculoNome)}</td>
          <td>${escaparHtml(veiculo.clienteNome || "-")}</td>
          <td>${escaparHtml(veiculo.anoFabricacao || "-")}</td>
          <td>${escaparHtml(veiculo.cor || "-")}</td>
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
        </tr>`;
    }).join("");
  }

  window.vstockPagination.render({
    container: "#paginacaoVeiculos",
    variant: "cadastro",
    itemLabel: "veículos",
    page: paginaAtualVeiculos,
    pageSize: ITENS_POR_PAGINA,
    totalItems: filtrados.length,
    idPrefix: "Veiculo",
    onPageChange: (novaPagina) => {
      paginaAtualVeiculos = novaPagina;
      renderizarVeiculos();
    }
  });
}

async function lerErro(response, mensagemPadrao) {
  const texto = (await response.text()).trim();
  return texto || mensagemPadrao;
}

async function carregarDadosIniciais() {
  try {
    const [respostaVeiculos, respostaClientes] = await Promise.all([
      fetch(API_VEICULOS.LISTAR),
      fetch(API_VEICULOS.CLIENTES_ATIVOS)
    ]);

    if (!respostaVeiculos.ok) {
      throw new Error(await lerErro(respostaVeiculos, "Não foi possível carregar os veículos."));
    }
    if (!respostaClientes.ok) {
      throw new Error(await lerErro(respostaClientes, "Não foi possível carregar os clientes ativos."));
    }

    veiculosCache = await respostaVeiculos.json();
    clientesAtivosCache = await respostaClientes.json();
    paginaAtualVeiculos = 1;
    preencherClientesAtivos($veiculo("#clienteId")?.value);
    renderizarVeiculos();
  } catch (erro) {
    console.error(erro);
    mensagemVeiculo(erro.message || "Não foi possível carregar os dados da oficina.", "danger");
  }
}

function obterBodyVeiculo() {
  const ano = $veiculo("#anoFabricacao").value.trim();
  return {
    clienteId: Number($veiculo("#clienteId").value),
    placa: normalizarPlaca($veiculo("#placa").value),
    marca: $veiculo("#marca").value.trim(),
    modelo: $veiculo("#modelo").value.trim(),
    anoFabricacao: ano ? Number(ano) : null,
    cor: $veiculo("#cor").value.trim() || null,
    observacao: $veiculo("#observacao").value.trim() || null
  };
}

function validarVeiculo(body) {
  if (!body.clienteId) return "Selecione o cliente.";
  if (!placaValida(body.placa)) return "Informe uma placa válida.";
  if (!body.marca) return "Informe a marca do veículo.";
  if (!body.modelo) return "Informe o modelo do veículo.";
  if (body.anoFabricacao && (body.anoFabricacao < 1900 || body.anoFabricacao > 2100)) {
    return "Informe um ano de fabricação válido.";
  }
  return null;
}

async function salvarVeiculo(event) {
  event.preventDefault();
  const form = formularioVeiculo();
  form.classList.add("validacao-tentada");
  const body = obterBodyVeiculo();
  const erroValidacao = validarVeiculo(body);

  if (erroValidacao) {
    mensagemVeiculo(erroValidacao, "danger");
    return;
  }

  try {
    const editando = Boolean(veiculoEditandoId);
    const resposta = await fetch(editando ? API_VEICULOS.ATUALIZAR(veiculoEditandoId) : API_VEICULOS.CRIAR, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resposta.ok) {
      throw new Error(await lerErro(resposta, "Não foi possível salvar o veículo."));
    }

    limparFormularioVeiculo();
    await carregarDadosIniciais();
    mensagemVeiculo(editando ? "Veículo atualizado com sucesso." : "Veículo cadastrado com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    mensagemVeiculo(erro.message || "Não foi possível salvar o veículo.", "danger");
  }
}

async function alternarStatusVeiculo(id, ativoAtual) {
  const acao = ativoAtual ? "inativar" : "reativar";
  if (!window.confirm(`Deseja ${acao} este veículo?`)) return;

  try {
    const resposta = await fetch(API_VEICULOS.STATUS(id, !ativoAtual), { method: "PATCH" });
    if (!resposta.ok) {
      throw new Error(await lerErro(resposta, "Não foi possível atualizar o status do veículo."));
    }

    if (veiculoEditandoId === id && ativoAtual) {
      limparFormularioVeiculo();
    }

    await carregarDadosIniciais();
    mensagemVeiculo(`Veículo ${ativoAtual ? "inativado" : "reativado"} com sucesso.`, "success");
  } catch (erro) {
    console.error(erro);
    mensagemVeiculo(erro.message || "Não foi possível atualizar o status do veículo.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  formularioVeiculo().noValidate = true;
  atualizarModoFormulario();
  await carregarDadosIniciais();

  formularioVeiculo().addEventListener("submit", salvarVeiculo);
  $veiculo("#btnLimpar").addEventListener("click", limparFormularioVeiculo);
  $veiculo("#btnCancelarEdicao").addEventListener("click", limparFormularioVeiculo);
  $veiculo("#placa").addEventListener("input", (event) => {
    event.target.value = normalizarPlaca(event.target.value);
  });

  window.vstockFilterDropdown.attach({
    input: "#clienteNome",
    quickCreate: { enabled: true, button: "#btnNovoClienteRapido" },
    optionValues: true,
    getOptions: () => clientesAtivosCache.map((cliente) => ({
      label: cliente.nome ?? "Cliente sem nome",
      value: String(cliente.clienteId ?? cliente.cliente_id),
      searchText: `${cliente.nome ?? ""} ${cliente.clienteId ?? cliente.cliente_id ?? ""}`
    })),
    onInputValueChange: () => {
      $veiculo("#clienteId").value = "";
    },
    onOptionSelect: (nome, clienteId) => {
      $veiculo("#clienteNome").value = nome;
      $veiculo("#clienteId").value = clienteId;
    },
    emptyText: "Nenhum cliente ativo encontrado"
  });

  $veiculo("#btnNovoClienteRapido").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "cliente",
      valores: { nome: $veiculo("#clienteNome").value.trim() },
      onSaved: (cliente) => {
        clientesAtivosCache.push(cliente);
        $veiculo("#clienteNome").value = cliente.nome;
        $veiculo("#clienteId").value = cliente.clienteId;
        mensagemVeiculo("Cliente cadastrado e selecionado.", "success");
      }
    });
  });

  ["#filtroVeiculo", "#filtroCliente", "#filtroStatus"].forEach((selector) => {
    $veiculo(selector).addEventListener("input", () => {
      paginaAtualVeiculos = 1;
      renderizarVeiculos();
    });
    $veiculo(selector).addEventListener("change", () => {
      paginaAtualVeiculos = 1;
      renderizarVeiculos();
    });
  });

  $veiculo("#tabelaVeiculos tbody").addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    const veiculo = veiculosCache.find((item) => Number(item.veiculoId) === id);
    if (!veiculo) return;

    if (botao.dataset.acao === "editar") {
      preencherFormularioVeiculo(veiculo);
      window.vstockEditModal?.open({ title: "Editar veículo", form: formularioVeiculo() });
    }

    if (botao.dataset.acao === "status") {
      alternarStatusVeiculo(id, botao.dataset.ativo === "true");
    }
  });
});


