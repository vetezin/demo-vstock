const API = {
  ESTOQUE_RESUMO: "http://localhost:8080/api/estoque/resumo?ativosOnly=true",
  FUNCIONARIO_POR_EMAIL: (email) => `http://localhost:8080/api/funcionarios/buscaEmail?email=${encodeURIComponent(email)}`,
  SAIDAS: "http://localhost:8080/api/saida-estoque",
  SAIDAS_LISTA: "http://localhost:8080/api/saida-estoque/listar",
  SAIDA_ATUALIZAR: (id) => `http://localhost:8080/api/saida-estoque/${id}`,
  SAIDA_ITENS_POR_ID: (id) => `http://localhost:8080/api/saida-estoque/${id}/itens`
};

const el = (sel) => document.querySelector(sel);
const msg = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });

let itensDaSaida = [];
let indiceEditando = null;
let cacheProdutos = [];
let modalObservacao = null;
let observacaoTemporaria = "";
let debounceBuscaProduto = null;
let produtosVisiveis = [];
let todasSaidas = [];
let saidasRegistradas = [];
let paginaAtualSaidas = 1;
let totalPaginasSaidas = 1;
let totalSaidas = 0;
const ITENS_POR_PAGINA_SAIDAS = 10;

function motivoLabel(valor) {
  const mapa = {
    USO_INTERNO: "Uso interno",
    PERDA: "Perda",
    AVARIA: "Avaria"
  };
  return mapa[valor] || valor || "-";
}

function montarItensParaEnvio() {
  return itensDaSaida.map((item) => ({
    produtoProdCod: Number(item.prodCod),
    quantidade: Number(item.qtd),
    motivo: item.motivo,
    observacao: item.observacao || ""
  }));
}

function atualizarResumoObservacaoTemporaria() {
  const campoResumo = el("#observacaoResumo");
  if (!campoResumo) return;

  campoResumo.value = observacaoTemporaria || "";
}

function localizarProdutoSelecionado() {
  const select = el("#listaProdutos");
  if (!select?.value) return null;
  return cacheProdutos.find((produto) => String(produto.prod_cod) === String(select.value)) || null;
}

async function carregarProdutos() {
  try {
    const resp = await fetch(API.ESTOQUE_RESUMO);
    if (!resp.ok) throw new Error("Falha ao carregar estoque.");

    cacheProdutos = await resp.json();
    desenharSelectProdutos(cacheProdutos);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar o estoque.", "danger");
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
    atualizarSaldoProduto();
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
}

function renderizarDropdownProdutos(lista, aberto = true) {
  const dropdown = el("#dropdownProdutosSaida");
  const select = el("#listaProdutos");
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
  el("#dropdownProdutosSaida")?.classList.remove("ativo");
}

function selecionarProduto(produto) {
  const select = el("#listaProdutos");
  const input = el("#buscaProdutoSaida");
  const inputCodigo = el("#codigoBarrasSaida");
  if (!select || !input || !produto) return;

  select.value = String(produto.prod_cod);
  input.value = produto.prod_descr || "";
  if (inputCodigo && produto.codigo_barras) {
    inputCodigo.value = produto.codigo_barras;
  }
  renderizarDropdownProdutos(produtosVisiveis, false);
  atualizarSaldoProduto();
  fecharDropdownProdutos();
}

function focarLeituraCodigoBarras() {
  el("#codigoBarrasSaida")?.focus();
}

function localizarProdutoPorCodigoBarras(codigoBarras) {
  return window.vstockProducts.findByBarcode(cacheProdutos, codigoBarras, "codigo_barras");
}

function processarLeituraCodigoBarras() {
  const inputCodigo = el("#codigoBarrasSaida");
  const inputQuantidade = el("#quantidade");
  const codigo = window.vstockText.normalizeCode(inputCodigo?.value);

  if (!inputCodigo || !inputQuantidade || !codigo) {
    return;
  }

  const produto = localizarProdutoPorCodigoBarras(codigo);
  if (!produto) {
    msg("Código de barras não cadastrado para nenhum produto.", "danger");
    inputCodigo.select();
    return;
  }

  const produtoJaSelecionado = String(el("#listaProdutos")?.value || "") === String(produto.prod_cod);
  const quantidadeAtual = Number(inputQuantidade.value || 0);
  const proximaQuantidade = produtoJaSelecionado && quantidadeAtual > 0 ? quantidadeAtual + 1 : 1;
  const saldo = Number(produto.saldo || 0);

  if (proximaQuantidade > saldo) {
    msg("A leitura ultrapassa o saldo disponível para este produto.", "danger");
    inputCodigo.select();
    return;
  }

  selecionarProduto(produto);
  inputQuantidade.value = String(proximaQuantidade);
  atualizarResumoFinanceiroSaida();
  msg(`Produto ${produto.prod_descr} identificado pela leitura.`, "success");
  inputCodigo.select();
}

function filtrarProdutos() {
  const termo = (el("#buscaProdutoSaida")?.value || "").trim().toLowerCase();

  if (!termo) {
    desenharSelectProdutos(cacheProdutos);
    atualizarSaldoProduto();
    return;
  }

  const filtrados = cacheProdutos.filter((produto) =>
    String(produto.prod_descr || "").toLowerCase().includes(termo)
  );

  desenharSelectProdutos(filtrados);
  atualizarSaldoProduto();
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

function atualizarSaldoProduto() {
  const select = el("#listaProdutos");
  const saldo = select?.selectedOptions?.[0]?.getAttribute("data-saldo") || "0";
  el("#saldoProduto").value = saldo;
}

function atualizarResumoFinanceiroSaida() {
  const produtoSelecionado = localizarProdutoSelecionado();
  if (!produtoSelecionado) {
    return;
  }
}

function carregarFuncionarioLogado() {
  return window.vstockSession.getFuncionario();
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

  if (!funcionario.funcionarioId) {
    try {
      funcionario = await complementarFuncionarioPorEmail(funcionario);
    } catch (erro) {
      console.error(erro);
    }
  }

  el("#funcionarioId").value = funcionario.funcionarioId;
  el("#funcionarioNome").value = funcionario.funcNome || funcionario.nome || "";
  return funcionario;
}

function quantidadeReservadaProduto(prodCod, ignorarIndice = null) {
  return itensDaSaida.reduce((acc, item, indice) => {
    if (ignorarIndice !== null && indice === ignorarIndice) return acc;
    if (Number(item.prodCod) !== Number(prodCod)) return acc;
    return acc + Number(item.qtd || 0);
  }, 0);
}

function atualizarTotalItens() {
  const totalItensLista = itensDaSaida.length;
  const total = itensDaSaida.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
  el("#resumoSaidaItens").textContent = String(totalItensLista);
  el("#totalItensSaida").textContent = total;
}

function redesenharTabela() {
  const tbody = el("#tabelaItens tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!itensDaSaida.length) {
    const totalColunas = el("#tabelaItens thead tr")?.children?.length || 8;
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalColunas}">
          <div class="saida-empty-state">
            <i class="bi bi-box-seam"></i>
            <strong>Nenhum item adicionado ainda.</strong>
            <span>Adicione produtos acima para começar a saída.</span>
          </div>
        </td>
      </tr>
    `;
    atualizarTotalItens();
    return;
  }

  itensDaSaida.forEach((item, indice) => {
    const emEdicao = indiceEditando === indice;

    if (!emEdicao) {
      tbody.innerHTML += `
        <tr>
          <td>${item.descrProduto}</td>
          <td class="text-end">${item.saldo}</td>
          <td class="text-end">${item.qtd}</td>
          <td>${motivoLabel(item.motivo)}</td>
          <td>${item.observacao || "-"}</td>
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
          <td class="text-end">${item.saldo}</td>
          <td class="text-end">
            <input type="number" min="1" step="1" class="form-control form-control-sm text-end" id="edit-qtd-${indice}" value="${item.qtd}">
          </td>
          <td>
            <select class="form-select form-select-sm" id="edit-motivo-${indice}">
              <option value="USO_INTERNO" ${item.motivo === "USO_INTERNO" ? "selected" : ""}>Uso interno</option>
              <option value="PERDA" ${item.motivo === "PERDA" ? "selected" : ""}>Perda</option>
              <option value="AVARIA" ${item.motivo === "AVARIA" ? "selected" : ""}>Avaria</option>
            </select>
          </td>
          <td>
            <input type="text" class="form-control form-control-sm" id="edit-observacao-${indice}" value="${item.observacao || ""}">
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

  atualizarTotalItens();
}

function adicionarItem() {
  const select = el("#listaProdutos");
  const quantidade = Number(el("#quantidade")?.value || 0);
  const motivo = el("#motivo")?.value || "USO_INTERNO";
  const observacao = observacaoTemporaria.trim();

  if (!select?.value) {
    msg("Selecione um produto.", "danger");
    return;
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    msg("Informe uma quantidade válida.", "danger");
    return;
  }

  if (!motivo) {
    msg("Selecione o motivo da saída.", "danger");
    return;
  }

  const saldo = Number(select.selectedOptions[0]?.getAttribute("data-saldo") || 0);
  const reservado = quantidadeReservadaProduto(select.value);

  if (saldo <= 0) {
    msg("Este produto não possui saldo disponível.", "danger");
    return;
  }

  if (quantidade + reservado > saldo) {
    msg("A quantidade informada ultrapassa o saldo disponivel para este produto.", "danger");
    return;
  }

  itensDaSaida.push({
    prodCod: Number(select.value),
    descrProduto: select.selectedOptions[0]?.getAttribute("data-descr") || "",
    saldo,
    qtd: quantidade,
    motivo,
    observacao
  });

  indiceEditando = null;
  redesenharTabela();

  select.value = "";
  el("#saldoProduto").value = "";
  el("#quantidade").value = "";
  el("#motivo").value = "USO_INTERNO";
  el("#observacaoItem").value = "";
  observacaoTemporaria = "";
  atualizarResumoObservacaoTemporaria();
  atualizarResumoFinanceiroSaida();
}

function removerItem(indice) {
  itensDaSaida.splice(indice, 1);
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
  const motivo = el(`#edit-motivo-${indice}`)?.value || "USO_INTERNO";
  const observacao = el(`#edit-observacao-${indice}`)?.value?.trim() || "";
  const item = itensDaSaida[indice];
  const reservado = quantidadeReservadaProduto(item.prodCod, indice);

  if (!Number.isInteger(qtd) || qtd <= 0) {
    msg("Quantidade inválida.", "danger");
    return;
  }

  if (!motivo) {
    msg("Motivo inválido.", "danger");
    return;
  }

  if (qtd + reservado > Number(item.saldo || 0)) {
    msg("A quantidade editada ultrapassa o saldo disponivel.", "danger");
    return;
  }

  item.qtd = qtd;
  item.motivo = motivo;
  item.observacao = observacao;

  indiceEditando = null;
  redesenharTabela();
}

function limparTudo() {
  itensDaSaida = [];
  indiceEditando = null;
  observacaoTemporaria = "";
  const funcionario = carregarFuncionarioLogado();

  el("#dataSaida").value = window.vstockFormatters.todayIso();
  el("#funcionarioId").value = funcionario?.funcionarioId || "";
  el("#funcionarioNome").value = funcionario?.funcNome || funcionario?.nome || "";
  el("#buscaProdutoSaida").value = "";
  el("#listaProdutos").value = "";
  fecharDropdownProdutos();
  el("#saldoProduto").value = "";
  el("#quantidade").value = "";
  el("#motivo").value = "USO_INTERNO";
  el("#observacaoItem").value = "";
  el("#codigoBarrasSaida").value = "";
  atualizarResumoObservacaoTemporaria();
  focarLeituraCodigoBarras();

  redesenharTabela();
}

async function enviarSaida(itensPayload) {
  const dataSaida = el("#dataSaida")?.value || "";
  const funcionarioId = Number(el("#funcionarioId")?.value || 0);

  if (!dataSaida) {
    msg("Informe a data da saída.", "danger");
    return;
  }

  if (!funcionarioId) {
    msg("Informe o funcionário responsável.", "danger");
    return;
  }

  if (itensDaSaida.length === 0) {
    msg("Adicione pelo menos um item.", "danger");
    return;
  }

  const body = {
    dataSaida,
    funcionarioId,
    itens: itensPayload
  };

  try {
    const resp = await fetch(API.SAIDAS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao registrar a saída.");
    }

    msg("Saída registrada com sucesso!", "success");
    limparTudo();
    await carregarProdutos();
    await carregarSaidas(1);
  } catch (erro) {
    console.error(erro);
    msg(erro.message || "Erro ao salvar saída.", "danger");
  }
}

async function salvarSaida() {
  await enviarSaida(montarItensParaEnvio());
}

function construirQuerySaidas() {
  const params = new URLSearchParams();

  const dataInicio = el("#filtroSaidaDataInicio")?.value || "";
  const dataFim = el("#filtroSaidaDataFim")?.value || "";
  const produto = (el("#filtroSaidaProduto")?.value || "").trim();
  const funcionario = (el("#filtroSaidaFuncionario")?.value || "").trim();

  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);
  if (produto) params.set("produto", produto);
  if (funcionario) params.set("funcionario", funcionario);

  return params.toString();
}

function limparFiltrosSaidas() {
  el("#filtroSaidaDataInicio").value = "";
  el("#filtroSaidaDataFim").value = "";
  el("#filtroSaidaProduto").value = "";
  el("#filtroSaidaFuncionario").value = "";
}

function obterOpcoesFiltroSaidaProduto() {
  return todasSaidas.map((saida) => saida.produtoResumo);
}

function atualizarPaginacaoSaidas(pagina = 1) {
  const paginacao = window.vstockPagination.paginate(todasSaidas, pagina, ITENS_POR_PAGINA_SAIDAS);
  totalSaidas = paginacao.totalItems;
  totalPaginasSaidas = paginacao.totalPages;
  paginaAtualSaidas = paginacao.page;
  saidasRegistradas = paginacao.items;
  desenharTabelaSaidas();
}

async function carregarSaidas(pagina = 1) {
  try {
    const query = construirQuerySaidas();
    const url = query ? `${API.SAIDAS_LISTA}?${query}` : API.SAIDAS_LISTA;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Falha ao listar saídas.");
    todasSaidas = await resp.json();
    atualizarPaginacaoSaidas(pagina);
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível carregar as saídas registradas.", "danger");
  }
}

function renderizarPaginacaoSaidas() {
  window.vstockPagination.render({
    container: "#paginacaoSaidas",
    variant: "listagem",
    itemLabel: "saidas",
    page: paginaAtualSaidas,
    pageSize: ITENS_POR_PAGINA_SAIDAS,
    totalItems: totalSaidas,
    idPrefix: "Saidas",
    onPageChange: (novaPagina) => {
      atualizarPaginacaoSaidas(novaPagina);
    }
  });
}

function desenharTabelaSaidas() {
  const tbody = el("#tabelaSaidas tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  saidasRegistradas.forEach((saida) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${saida.produtoResumo || "-"}</td>
        <td class="text-end">${saida.quantidade_total || 0}</td>
        <td>${window.vstockFormatters.date(saida.data_saida)}</td>
        <td>${saida.funcionario || "-"}</td>
        <td class="text-center">
          <div class="d-flex gap-2 justify-content-center flex-wrap">
            <button class="btn btn-sm btn-primary" data-acao="ver-saida" data-id="${saida.saida_cod}" data-data="${saida.data_saida || ""}">
            <i class="bi bi-eye"></i> Ver
          </button>
          <button class="btn btn-sm btn-outline-primary" data-acao="editar-saida" data-id="${saida.saida_cod}">
            <i class="bi bi-pencil-square"></i> Editar
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderizarPaginacaoSaidas();
}

async function abrirEdicaoSaida(saidaCod) {
  const saida = todasSaidas.find((item) => Number(item.saida_cod) === Number(saidaCod));
  if (!saida) return;

  const antigo = document.getElementById("modalEditarSaida");
  if (antigo) antigo.remove();

  try {
    const resp = await fetch(API.SAIDA_ITENS_POR_ID(saidaCod));
    if (!resp.ok) throw new Error("Falha ao buscar itens da saída.");

    const itens = await resp.json();
    const linhas = itens.map((item, indice) => `
      <tr>
        <td>${item.produto || "-"}</td>
        <td><input type="number" class="form-control form-control-sm text-end" min="1" step="1" data-campo="qtd" data-idx="${indice}" value="${item.quantidade || 0}"></td>
        <td>
          <select class="form-select form-select-sm" data-campo="motivo" data-idx="${indice}">
            <option value="USO_INTERNO" ${item.motivo === "USO_INTERNO" ? "selected" : ""}>Uso interno</option>
            <option value="PERDA" ${item.motivo === "PERDA" ? "selected" : ""}>Perda</option>
            <option value="AVARIA" ${item.motivo === "AVARIA" ? "selected" : ""}>Avaria</option>
          </select>
        </td>
        <td><input type="text" class="form-control form-control-sm" data-campo="observacao" data-idx="${indice}" value="${item.observacao || ""}"></td>
      </tr>
    `).join("");

    const html = `
      <div class="modal fade" id="modalEditarSaida" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-detalhes modal-detalhes-saida">
          <div class="modal-content modal-surface">
            <div class="modal-header modal-brand-header">
              <h5 class="modal-title"><i class="bi bi-pencil-square"></i> Editar Saída #${saidaCod}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body modal-form-body">
              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label">Data da Saída</label>
                  <input type="date" id="editSaidaData" class="form-control" value="${String(saida.data_saida).split("T")[0]}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Funcionário</label>
                  <input type="text" class="form-control" value="${saida.funcionario || "-"}" disabled>
                </div>
              </div>
              <div class="table-responsive modal-tabela-wrapper">
                <table class="table table-sm align-middle modal-tabela-detalhes modal-tabela-saida">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th class="text-end">Qtd</th>
                      <th>Motivo</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>${linhas}</tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer modal-form-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancelar</button>
              <button class="btn btn-success" id="btnConfirmarEdicaoSaida" type="button">Salvar alterações</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    const modalEl = document.getElementById("modalEditarSaida");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById("btnConfirmarEdicaoSaida")?.addEventListener("click", async () => {
      const itensPayload = itens.map((item, indice) => {
        const quantidade = Number(modalEl.querySelector(`[data-campo="qtd"][data-idx="${indice}"]`)?.value || 0);
        const motivo = modalEl.querySelector(`[data-campo="motivo"][data-idx="${indice}"]`)?.value || "";
        const observacao = modalEl.querySelector(`[data-campo="observacao"][data-idx="${indice}"]`)?.value?.trim() || "";

        if (!Number.isInteger(quantidade) || quantidade <= 0) {
          throw new Error("Quantidade inválida na saída.");
        }
        if (!motivo) {
          throw new Error("Motivo inválido na saída.");
        }

        return {
          produtoProdCod: Number(item.produto_cod),
          quantidade,
          motivo,
          observacao
        };
      });

      const body = {
        dataSaida: modalEl.querySelector("#editSaidaData")?.value || "",
        funcionarioId: saida.funcionario_id,
        itens: itensPayload
      };

      try {
        const respSalvar = await fetch(API.SAIDA_ATUALIZAR(saidaCod), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!respSalvar.ok) {
          const erro = await respSalvar.text();
          throw new Error(erro || "Falha ao atualizar saída.");
        }

        modal.hide();
        await carregarSaidas(paginaAtualSaidas);
        await carregarProdutos();
        msg("Saída atualizada com sucesso.", "success");
      } catch (erro) {
        console.error(erro);
        msg(erro.message || "Não foi possível atualizar a saída.", "danger");
      }
    });
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível abrir a edição da saída.", "danger");
  }
}

async function abrirDetalhesSaida(saidaCod, dataSaida = "") {
  if (!saidaCod) return;

  const antigo = document.getElementById("modalDetalhesSaida");
  if (antigo) antigo.remove();

  try {
    const resp = await fetch(API.SAIDA_ITENS_POR_ID(saidaCod));
    if (!resp.ok) throw new Error("Falha ao buscar detalhes da saída.");

    const itens = await resp.json();
    let linhas = "";
    let totalQtd = 0;

    itens.forEach((item) => {
      const qtd = Number(item.quantidade || 0);
      totalQtd += qtd;

      linhas += `
        <tr>
          <td>${item.produto || "-"}</td>
          <td class="text-end">${qtd}</td>
          <td class="text-end">${Number(item.saldo_atual || 0)}</td>
          <td>${motivoLabel(item.motivo)}</td>
          <td>${item.observacao || "-"}</td>
        </tr>
      `;
    });

    const produtoResumo = window.vstockProducts.summarizeItems(itens);
    const html = `
      <div class="modal fade" id="modalDetalhesSaida" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-detalhes modal-detalhes-saida">
          <div class="modal-content modal-surface">
            <div class="modal-header modal-brand-header">
              <h5 class="modal-title">
                <i class="bi bi-box-arrow-up"></i> Detalhes da Saída #${saidaCod}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body modal-form-body">
              <div class="modal-intro">
                Consulte os produtos retirados, o motivo informado e como o saldo ficou após a saída.
              </div>

              <div class="modal-resumo-grid">
                <div class="modal-resumo-card">
                  <span>Produto</span>
                  <strong>${produtoResumo}</strong>
                </div>
                <div class="modal-resumo-card">
                  <span>Data da Saída</span>
                  <strong>${window.vstockFormatters.date(dataSaida)}</strong>
                </div>
              </div>

              <div class="table-responsive modal-tabela-wrapper">
                <table class="table table-sm align-middle modal-tabela-detalhes modal-tabela-saida">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th class="text-end">Qtd</th>
                      <th class="text-end">Estoque Atual</th>
                      <th>Motivo</th>
                      <th class="text-end">Valor</th>
                      <th class="text-end">Subtotal</th>
                      <th>Observação</th>
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
    const modal = new bootstrap.Modal(document.getElementById("modalDetalhesSaida"));
    modal.show();
  } catch (erro) {
    console.error(erro);
    msg("Não foi possível abrir os detalhes da saída.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  modalObservacao = new bootstrap.Modal(document.getElementById("modalObservacao"));

  el("#dataSaida").value = window.vstockFormatters.todayIso();
  el("#motivo").value = "USO_INTERNO";
  atualizarResumoObservacaoTemporaria();
  await preencherFuncionarioLogado();

  await carregarProdutos();
  await carregarSaidas();
  atualizarResumoFinanceiroSaida();
  focarLeituraCodigoBarras();

  el("#btnFiltrarSaidas")?.addEventListener("click", () => {
    carregarSaidas(1);
  });
  el("#quantidade")?.addEventListener("input", atualizarResumoFinanceiroSaida);
  el("#motivo")?.addEventListener("change", atualizarResumoFinanceiroSaida);
  el("#listaProdutos")?.addEventListener("change", atualizarSaldoProduto);
  el("#btnLimparFiltroSaidas")?.addEventListener("click", () => {
    limparFiltrosSaidas();
    carregarSaidas(1);
  });

  el("#buscaProdutoSaida")?.addEventListener("input", agendarFiltroProdutos);
  el("#buscaProdutoSaida")?.addEventListener("focus", () => renderizarDropdownProdutos(produtosVisiveis.length ? produtosVisiveis : cacheProdutos, true));
  window.vstockFilterDropdown.attach({
    input: "#filtroSaidaProduto",
    getOptions: obterOpcoesFiltroSaidaProduto
  });
  el("#codigoBarrasSaida")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processarLeituraCodigoBarras();
    }
  });
  el("#btnAddItem")?.addEventListener("click", adicionarItem);
  el("#btnSalvar")?.addEventListener("click", salvarSaida);
  el("#btnLimparTudo")?.addEventListener("click", limparTudo);
  el("#btnAbrirObservacao")?.addEventListener("click", () => {
    el("#observacaoItem").value = observacaoTemporaria;
    modalObservacao.show();
  });
  el("#btnSalvarObservacao")?.addEventListener("click", () => {
    observacaoTemporaria = el("#observacaoItem")?.value?.trim() || "";
    atualizarResumoObservacaoTemporaria();
    modalObservacao.hide();
  });
  el("#dropdownProdutosSaida")?.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-value]");
    if (!botao) return;
    const produto = cacheProdutos.find((item) => String(item.prod_cod) === String(botao.dataset.value));
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
    if (acao === "remover") {
      removerItem(idx);
    }
    if (acao === "salvar-edicao") salvarEdicao(idx);
    if (acao === "cancelar-edicao") cancelarEdicao();
  });

  el("#tabelaSaidas")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.acao === "ver-saida") {
      abrirDetalhesSaida(btn.dataset.id, btn.dataset.data);
    }
    if (btn.dataset.acao === "editar-saida") {
      abrirEdicaoSaida(btn.dataset.id);
    }
  });
});








