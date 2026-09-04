(function () {
  const BASE_URL = "http://localhost:8080";
  let modal;
  let contextoAtual;
  let categorias = [];

  const campos = {
    cliente: [
      ["nome", "Nome", "text", true], ["cpfCnpj", "CPF/CNPJ", "text"],
      ["telefone", "Telefone", "text"], ["observacao", "Observação", "textarea"]
    ],
    categoria: [["catDescr", "Descrição da categoria", "text", true]],
    veiculo: [
      ["placa", "Placa", "text", true], ["marca", "Marca", "text", true], ["modelo", "Modelo", "text", true],
      ["anoFabricacao", "Ano de fabricação", "number"], ["cor", "Cor", "text"], ["observacao", "Observação", "textarea"]
    ],
    produto: [
      ["prodDescr", "Descrição do produto", "text", true], ["categoriaId", "Categoria", "categoria", true],
      ["qtdMin", "Estoque mínimo", "number", true], ["valorUnitario", "Valor unitário", "text", true],
      ["codigoBarras", "Código de barras", "text"]
    ],
    servico: [
      ["descricao", "Descrição do serviço", "text", true], ["categoriaId", "Categoria", "categoria", true],
      ["valorServico", "Valor do serviço", "text", true], ["detalhes", "Detalhes", "textarea"]
    ]
  };

  function escapar(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function titulo(tipo) {
    return { cliente: "Novo cliente", categoria: "Nova categoria", veiculo: "Novo veículo", produto: "Novo produto", servico: "Novo serviço" }[tipo];
  }

  function montarModal() {
    const elemento = document.createElement("div");
    elemento.innerHTML = `
      <div class="modal fade" id="modalCadastroRapido" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title" id="cadastroRapidoTitulo"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
          <form id="cadastroRapidoForm"><div class="modal-body"><div id="cadastroRapidoCampos" class="row g-3"></div></div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-success">Salvar</button></div></form>
        </div></div>
      </div>`;
    document.body.appendChild(elemento.firstElementChild);
    modal = new bootstrap.Modal(document.getElementById("modalCadastroRapido"));
    document.getElementById("cadastroRapidoForm").addEventListener("submit", salvar);
  }

  function renderizarCampos() {
    const container = document.getElementById("cadastroRapidoCampos");
    container.innerHTML = campos[contextoAtual.tipo].map(([nome, rotulo, tipo, obrigatorio]) => {
      if (tipo === "categoria") {
        const opcoes = categorias.map((categoria) => `<option value="${categoria.catCod}">${escapar(categoria.catDescr)}</option>`).join("");
        return `<div class="col-md-6"><label class="form-label required" for="cadastroRapido_${nome}">${rotulo}</label><select id="cadastroRapido_${nome}" class="form-select" required><option value="">Selecione uma categoria</option>${opcoes}</select></div>`;
      }
      const tag = tipo === "textarea" ? "textarea" : "input";
      const atributos = tipo === "textarea" ? "rows=\"3\"" : `type=\"${tipo}\"`;
      const valor = contextoAtual.valores?.[nome] ?? "";
      return `<div class="${nome === "observacao" ? "col-12" : "col-md-6"}"><label class="form-label${obrigatorio ? " required" : ""}" for="cadastroRapido_${nome}">${rotulo}</label><${tag} id="cadastroRapido_${nome}" class="form-control" ${atributos} ${obrigatorio ? "required" : ""}>${tipo === "textarea" ? escapar(valor) : ""}</${tag}></div>`;
    }).join("");
    campos[contextoAtual.tipo].filter(([, , tipo]) => tipo !== "textarea" && tipo !== "categoria").forEach(([nome]) => {
      document.getElementById(`cadastroRapido_${nome}`).value = contextoAtual.valores?.[nome] ?? "";
    });
    campos[contextoAtual.tipo].filter(([, , tipo]) => tipo === "categoria").forEach(([nome]) => {
      document.getElementById(`cadastroRapido_${nome}`).value = contextoAtual.valores?.[nome] ?? "";
    });
  }

  function valor(nome) {
    return document.getElementById(`cadastroRapido_${nome}`).value.trim();
  }

  function corpo() {
    if (contextoAtual.tipo === "cliente") return { nome: valor("nome"), cpfCnpj: valor("cpfCnpj") || null, telefone: valor("telefone") || null, observacao: valor("observacao") || null };
    if (contextoAtual.tipo === "categoria") return { catDescr: valor("catDescr") };
    if (contextoAtual.tipo === "produto") return { prodDescr: valor("prodDescr"), categoria: { catCod: Number(valor("categoriaId")) }, qtdMin: Number(valor("qtdMin")), codigoBarras: valor("codigoBarras") || null, valorUnitario: window.vstockCurrency.parse(valor("valorUnitario")) };
    if (contextoAtual.tipo === "servico") return { categoriaId: Number(valor("categoriaId")), descricao: valor("descricao"), detalhes: valor("detalhes") || null, valorServico: window.vstockCurrency.parse(valor("valorServico")) };
    return {
      clienteId: contextoAtual.clienteId,
      placa: valor("placa").toUpperCase().replace(/[^A-Z0-9]/g, ""), marca: valor("marca"), modelo: valor("modelo"),
      anoFabricacao: valor("anoFabricacao") ? Number(valor("anoFabricacao")) : null, cor: valor("cor") || null, observacao: valor("observacao") || null
    };
  }

  function endpoint() {
    return { cliente: "/api/cliente", categoria: "/api/categorias-produto", veiculo: "/api/oficina/veiculos", produto: "/api/produtos", servico: "/api/oficina/servicos" }[contextoAtual.tipo];
  }

  async function carregarCategorias() {
    const resposta = await fetch(`${BASE_URL}/api/categorias-produto?ativosOnly=true`);
    if (!resposta.ok) throw new Error("Não foi possível carregar as categorias.");
    categorias = await resposta.json();
  }

  async function salvar(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    try {
      const resposta = await fetch(BASE_URL + endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo()) });
      if (!resposta.ok) throw new Error((await resposta.text()).trim() || "Não foi possível concluir o cadastro.");
      const registro = await resposta.json();
      modal.hide();
      contextoAtual.onSaved?.(registro);
    } catch (erro) {
      window.vstockUi?.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 })(erro.message, "danger");
    }
  }

  window.vstockQuickCadastro = {
    async open(opcoes) {
      if (!campos[opcoes.tipo]) throw new Error("Tipo de cadastro rápido não suportado.");
      if (opcoes.tipo === "veiculo" && !opcoes.clienteId) {
        window.vstockUi?.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 })("Selecione o cliente antes de cadastrar um veículo.", "warning");
        return;
      }
      if (!modal) montarModal();
      try {
        if (opcoes.tipo === "produto" || opcoes.tipo === "servico") await carregarCategorias();
        contextoAtual = opcoes;
        document.getElementById("cadastroRapidoTitulo").textContent = titulo(opcoes.tipo);
        document.getElementById("cadastroRapidoForm").classList.remove("was-validated");
        renderizarCampos();
        modal.show();
      } catch (erro) {
        window.vstockUi?.createAlertHandler({ container: "#mensagens", autoRemoveMs: 4500 })(erro.message, "danger");
      }
    }
  };
}());


