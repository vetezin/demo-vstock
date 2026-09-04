const API_SERVICOS = { LISTAR: "http://localhost:8080/api/oficina/servicos", CATEGORIAS: "http://localhost:8080/api/categorias-produto?ativosOnly=true", ATUALIZAR: (id) => `http://localhost:8080/api/oficina/servicos/${id}`, STATUS: (id, ativo) => `http://localhost:8080/api/oficina/servicos/${id}/status?ativo=${ativo}` };
const $servico = (seletor) => document.querySelector(seletor);
const mensagemServico = window.vstockUi.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 });
let servicoEditandoId = null, servicosCache = [], categoriasCache = [], paginaAtual = 1;
const ITENS_POR_PAGINA = 10;
function moeda(valor) { return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function escapar(valor) { return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function preencherCategorias(selecionada = "") { const filtro = $servico("#filtroCategoria"); filtro.innerHTML = '<option value="">Todas as categorias</option>'; categoriasCache.forEach((categoria) => { const opcao = document.createElement("option"); opcao.value = categoria.catCod; opcao.textContent = categoria.catDescr; filtro.appendChild(opcao); }); const categoria = categoriasCache.find((item) => String(item.catCod) === String(selecionada)); $servico("#categoriaId").value = categoria ? String(categoria.catCod) : ""; $servico("#categoriaDescricao").value = categoria?.catDescr || ""; }
function atualizarModo() { const editando = Boolean(servicoEditandoId); $servico("#tituloFormularioServico").innerHTML = editando ? '<i class="bi bi-pencil-square"></i> Editar serviço' : '<i class="bi bi-plus-circle"></i> Novo serviço'; $servico("#btnSalvarServico").innerHTML = editando ? '<i class="bi bi-check2-circle"></i> Salvar alterações' : '<i class="bi bi-check2-circle"></i> Salvar serviço'; $servico("#btnCancelarEdicao").classList.toggle("d-none", !editando); }
function limparFormulario() { servicoEditandoId = null; window.vstockEditModal?.close(); $servico("#servicoForm").reset(); preencherCategorias(); $servico("#servicoForm").classList.remove("validacao-tentada"); atualizarModo(); }
function editar(servico) { servicoEditandoId = Number(servico.servicoId); preencherCategorias(servico.categoriaId); $servico("#descricao").value = servico.descricao || ""; $servico("#detalhes").value = servico.detalhes || ""; $servico("#valorServico").value = window.vstockCurrency.formatNumber(servico.valorServico); atualizarModo(); window.destacarFormularioEdicao?.($servico("#servicoForm"), "#categoriaDescricao"); }
function renderizar() { const texto = String($servico("#filtroDescricao").value || "").toLowerCase(); const categoria = String($servico("#filtroCategoria").value || ""); const status = $servico("#filtroStatus").value; const filtrados = servicosCache.filter((item) => { const ativo = item.ativo !== false; return (!texto || `${item.descricao} ${item.detalhes || ""}`.toLowerCase().includes(texto)) && (!categoria || String(item.categoriaId) === categoria) && (status === "todos" || (status === "ativos" && ativo) || (status === "inativos" && !ativo)); }); const dados = window.vstockPagination.paginate(filtrados, paginaAtual, ITENS_POR_PAGINA); paginaAtual = dados.page; $servico("#tabelaServicos tbody").innerHTML = dados.items.length ? dados.items.map((item) => { const ativo = item.ativo !== false; return `<tr><td><strong>${escapar(item.descricao)}</strong></td><td>${escapar(item.categoriaDescricao || "-")}</td><td title="${escapar(item.detalhes || "")}">${escapar(item.detalhes || "-")}</td><td>${moeda(item.valorServico)}</td><td>${window.vstockUi.badgeStatus(ativo)}</td><td class="text-center"><div class="d-flex gap-2 justify-content-center flex-wrap"><button type="button" class="btn btn-sm btn-outline-primary" data-acao="editar" data-id="${item.servicoId}"><i class="bi bi-pencil-square"></i> Editar</button><button type="button" class="btn btn-sm ${ativo ? "btn-outline-warning" : "btn-outline-success"}" data-acao="status" data-id="${item.servicoId}" data-ativo="${ativo}"><i class="bi ${ativo ? "bi-pause-circle" : "bi-arrow-clockwise"}"></i> ${ativo ? "Inativar" : "Reativar"}</button></div></td></tr>`; }).join("") : '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum serviço encontrado.</td></tr>'; window.vstockPagination.render({ container: "#paginacaoServicos", variant: "cadastro", itemLabel: "serviços", page: paginaAtual, pageSize: ITENS_POR_PAGINA, totalItems: filtrados.length, idPrefix: "Servico", onPageChange: (novaPagina) => { paginaAtual = novaPagina; renderizar(); } }); }
async function erro(resposta, padrao) { return (await resposta.text()).trim() || padrao; }
async function carregar() { try { const [servicos, categorias] = await Promise.all([fetch(API_SERVICOS.LISTAR), fetch(API_SERVICOS.CATEGORIAS)]); if (!servicos.ok) throw new Error(await erro(servicos, "Não foi possível carregar os serviços.")); if (!categorias.ok) throw new Error(await erro(categorias, "Não foi possível carregar as categorias.")); servicosCache = await servicos.json(); categoriasCache = await categorias.json(); paginaAtual = 1; preencherCategorias($servico("#categoriaId").value); renderizar(); } catch (exception) { mensagemServico(exception.message || "Não foi possível carregar os dados.", "danger"); } }
async function salvar(event) { event.preventDefault(); const form = $servico("#servicoForm"); form.classList.add("validacao-tentada"); const body = { categoriaId: Number($servico("#categoriaId").value), descricao: $servico("#descricao").value.trim(), detalhes: $servico("#detalhes").value.trim() || null, valorServico: window.vstockCurrency.parse($servico("#valorServico").value) }; if (!body.categoriaId || !body.descricao || body.valorServico < 0) { mensagemServico("Selecione uma categoria e preencha os campos obrigatórios com dados válidos.", "danger"); return; } try { const editando = Boolean(servicoEditandoId); const resposta = await fetch(editando ? API_SERVICOS.ATUALIZAR(servicoEditandoId) : API_SERVICOS.LISTAR, { method: editando ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!resposta.ok) throw new Error(await erro(resposta, "Não foi possível salvar o serviço.")); limparFormulario(); await carregar(); mensagemServico(editando ? "Serviço atualizado com sucesso." : "Serviço cadastrado com sucesso.", "success"); } catch (exception) { mensagemServico(exception.message || "Não foi possível salvar o serviço.", "danger"); } }
async function trocarStatus(id, ativo) { if (!window.confirm(`Deseja ${ativo ? "inativar" : "reativar"} este serviço?`)) return; try { const resposta = await fetch(API_SERVICOS.STATUS(id, !ativo), { method: "PATCH" }); if (!resposta.ok) throw new Error(await erro(resposta, "Não foi possível atualizar o status.")); if (servicoEditandoId === id && ativo) limparFormulario(); await carregar(); mensagemServico(`Serviço ${ativo ? "inativado" : "reativado"} com sucesso.`, "success"); } catch (exception) { mensagemServico(exception.message || "Não foi possível atualizar o status.", "danger"); } }
document.addEventListener("DOMContentLoaded", async () => {
  $servico("#servicoForm").noValidate = true;
  window.vstockCurrency.attachMask($servico("#valorServico"));
  atualizarModo();
  await carregar();

  window.vstockFilterDropdown.attach({
    input: "#categoriaDescricao",
    quickCreate: { enabled: true, button: "#btnNovaCategoriaRapida" },
    optionValues: true,
    getOptions: () => categoriasCache.map((categoria) => ({
      label: categoria.catDescr,
      value: String(categoria.catCod),
      searchText: `${categoria.catDescr} ${categoria.catCod}`
    })),
    onInputValueChange: () => { $servico("#categoriaId").value = ""; },
    onOptionSelect: (descricao, categoriaId) => {
      $servico("#categoriaDescricao").value = descricao;
      $servico("#categoriaId").value = categoriaId;
    },
    emptyText: "Nenhuma categoria ativa encontrada"
  });

  $servico("#btnNovaCategoriaRapida").addEventListener("click", () => {
    window.vstockQuickCadastro.open({
      tipo: "categoria",
      valores: { catDescr: $servico("#categoriaDescricao").value.trim() },
      onSaved: (categoria) => {
        categoriasCache.push(categoria);
        preencherCategorias(categoria.catCod);
        mensagemServico("Categoria cadastrada e selecionada.", "success");
      }
    });
  });

  $servico("#servicoForm").addEventListener("submit", salvar);
  $servico("#btnLimpar").addEventListener("click", limparFormulario);
  $servico("#btnCancelarEdicao").addEventListener("click", limparFormulario);
  ["#filtroDescricao", "#filtroCategoria", "#filtroStatus"].forEach((seletor) => {
    $servico(seletor).addEventListener("input", () => { paginaAtual = 1; renderizar(); });
    $servico(seletor).addEventListener("change", () => { paginaAtual = 1; renderizar(); });
  });
  $servico("#tabelaServicos tbody").addEventListener("click", (event) => {
    const botao = event.target.closest("button");
    if (!botao) return;
    const item = servicosCache.find((servico) => Number(servico.servicoId) === Number(botao.dataset.id));
    if (!item) return;
    if (botao.dataset.acao === "editar") {
      editar(item);
      window.vstockEditModal?.open({ title: "Editar serviço", form: $servico("#servicoForm") });
    }
    if (botao.dataset.acao === "status") trocarStatus(Number(botao.dataset.id), botao.dataset.ativo === "true");
  });
});


