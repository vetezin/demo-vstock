const API_MESAS = {
  LISTA: "http://localhost:8080/api/mesas",
  ATIVAR_PROXIMA: "http://localhost:8080/api/mesas/ativar-proxima",
  OCULTAR_ULTIMA: "http://localhost:8080/api/mesas/ocultar-ultima",
  ABRIR: (mesaId) => `http://localhost:8080/api/mesas/${mesaId}/atendimento`,
  ATENDIMENTO: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}`,
  ATUALIZAR: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}`,
  CLIENTE: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}/cliente`,
  ITENS: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}/itens`,
  LIMPAR: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}`,
  FECHAR: (atendimentoId) => `http://localhost:8080/api/mesas/atendimentos/${atendimentoId}/fechar`
};

(() => {
  let mesas = [];
  let atendimentoAtual = null;
  let modal = null;
  let modalConfirmarLimpeza = null;
  let modalConfirmarOcultacao = null;
  let reabrirMesaComoRascunhoAposLimpeza = false;
  let alteracaoClienteAtiva = false;
  let clienteIdAntesDaAlteracao = null;
  let rascunhoMesaSalva = null;
  let obterProdutos = () => [];
  let obterFormasPagamento = () => [];
  let obterClientes = () => [];
  let abrirCadastroCliente = () => {};
  let alertar = () => {};
  let pagamentosDivididosMesa = [];

  const porId = (id) => document.getElementById(id);

  function formatarErro(erro, fallback) {
    return erro?.message || fallback;
  }

  function renderizarMesas() {
    const grid = porId("mesasGrid");
    if (!grid) return;
    atualizarBotaoOcultarReserva();

    if (!mesas.length) {
      grid.innerHTML = '<div class="pdv-empty-state"><i class="bi bi-grid-3x3-gap"></i><strong>Nenhuma mesa cadastrada.</strong><span>Cadastre as mesas para iniciar os atendimentos.</span></div>';
      return;
    }

    grid.innerHTML = mesas.map((mesa) => {
      const classe = mesa.status === "EM_CONSUMO" ? "is-consumo" : mesa.status === "ABERTA" ? "is-aberta" : "is-livre";
      const status = mesa.status === "EM_CONSUMO" ? "Em consumo" : mesa.status === "ABERTA" ? "Aberta" : "Livre";
      const clienteNome = String(mesa.clienteNome || "").trim();
      const cliente = clienteNome
        ? `<span class="mesa-card-title">${escaparHtml(clienteNome)}</span>`
        : "";
      return `<button type="button" class="mesa-card ${classe}" data-mesa-id="${mesa.mesaId}" data-atendimento-id="${mesa.atendimentoMesaId || ""}">
        <span class="mesa-card-icon"><i class="bi bi-table"></i></span>
        <span class="mesa-card-number">Mesa ${mesa.numero}</span>
        ${cliente}
        <span class="mesa-card-footer"><span class="mesa-card-status">${status}</span><i class="bi bi-chevron-right mesa-card-arrow"></i></span>
      </button>`;
    }).join("");

    grid.querySelectorAll("[data-mesa-id]").forEach((card) => {
      card.addEventListener("click", () => abrirMesaOuAtendimento(card.dataset));
    });
  }

  function mesasEstaoVazias() {
    return mesas.every((mesa) => !mesa.atendimentoMesaId && !(mesa.clienteId ?? mesa.cliente_id));
  }

  function atualizarBotaoOcultarReserva() {
    const botao = porId("btnOcultarUltimaMesa");
    if (!botao) return;
    const haMesaAdicional = mesas.some((mesa) => Number(mesa.numero) > 10);
    botao.classList.toggle("d-none", !haMesaAdicional);
    botao.disabled = !mesasEstaoVazias();
    botao.title = botao.disabled ? "Todas as mesas precisam estar vazias para ocultar a ultima." : "Ocultar a ultima mesa adicional";
  }

  async function carregar() {
    const resposta = await fetch(API_MESAS.LISTA);
    if (!resposta.ok) throw new Error("Não foi possível carregar as mesas.");
    mesas = await resposta.json();
    renderizarMesas();
  }

  async function ativarProximaMesa() {
    try {
      const resposta = await fetch(API_MESAS.ATIVAR_PROXIMA, { method: "POST" });
      if (!resposta.ok) throw new Error(await resposta.text());
      const mesa = await resposta.json();
      await carregar();
      alertar(`Mesa ${mesa.numero} adicionada.`, "success");
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível adicionar uma nova mesa."), "danger");
    }
  }

  async function abrirMesaOuAtendimento({ mesaId, atendimentoId }) {
    try {
      if (!atendimentoId) {
        abrirPreviaMesa(mesaId);
        return;
      }
      await abrirDetalhe(atendimentoId);
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível abrir a mesa."), "danger");
    }
  }

  function abrirPreviaMesa(mesaId) {
    const mesa = mesas.find((item) => String(item.mesaId) === String(mesaId));
    if (!mesa) throw new Error("Mesa não encontrada.");

    atendimentoAtual = {
      mesaId: Number(mesa.mesaId),
      numero: mesa.numero,
      titulo: mesa.titulo,
      clienteId: null,
      abertaEm: null,
      itens: []
    };
    alteracaoClienteAtiva = false;
    clienteIdAntesDaAlteracao = null;
    porId("modalMesaTitulo").textContent = `Mesa ${atendimentoAtual.numero}`;
    porId("modalMesaAbertura").textContent = "Adicione itens e salve a mesa para iniciar o consumo.";
    popularSeletores();
    popularClientesMesa();
    renderizarItens();
    atualizarAcoesMesa();
    modal?.show();
  }

  function popularSeletores() {
    const produtos = obterProdutos();
    const formasPagamento = obterFormasPagamento().filter((forma) => forma.ativo !== false);
    porId("mesaProdutoSelecionado").innerHTML = '<option value=""></option>' + produtos.map((produto) => (
      `<option value="${produto.prod_cod}">${produto.prod_descr} — ${window.vstockCurrency.formatMoney(produto.valor_unitario)}</option>`
    )).join("");
    const busca = porId("mesaBuscaProduto");
    busca.value = "";
    filtrarProdutosMesa(false);
    porId("mesaFormaPagamento").innerHTML = formasPagamento.map((forma) => {
      const id = forma.formaPagamentoId ?? forma.forma_pagamento_id;
      return `<option value="${id}">${forma.nome}</option>`;
    }).join("");
  }

  function popularClientesMesa(clienteSelecionado = null) {
    const campo = porId("mesaCliente");
    if (!campo) return;
    const clienteAtual = clienteSelecionado || obterClientes().find((cliente) => String(cliente.clienteId ?? cliente.cliente_id) === String(atendimentoAtual?.clienteId || ""));
    campo.value = formatarClienteMesa(clienteAtual);
    const mesaSalva = mesaEstaSalva();
    const clienteEmEdicao = mesaSalva && alteracaoClienteAtiva;
    campo.disabled = mesaSalva && !clienteEmEdicao;
    porId("btnNovoClienteMesa")?.classList.toggle("d-none", mesaSalva && !clienteEmEdicao);
    const botaoAlterar = porId("btnAlterarClienteMesa");
    if (botaoAlterar) {
      botaoAlterar.classList.toggle("d-none", !mesaSalva || clienteEmEdicao);
      botaoAlterar.innerHTML = `<i class="bi bi-pencil-square"></i> ${atendimentoAtual?.clienteId ? "Alterar Cliente" : "Vincular Cliente"}`;
    }
  }

  function mesaEstaSalva() {
    return Boolean(atendimentoAtual?.atendimentoMesaId);
  }

  function atualizarAcoesMesa() {
    const salva = mesaEstaSalva();
    const clienteEmEdicao = salva && alteracaoClienteAtiva;
    const possuiAlteracoes = salva && (clienteEmEdicao || mesaPossuiAlteracoesPendentes());
    porId("btnSalvarMesa")?.classList.toggle("d-none", salva);
    porId("btnSalvarAlteracoesMesa")?.classList.toggle("d-none", !possuiAlteracoes);
    porId("btnCancelarAlteracoesMesa")?.classList.toggle("d-none", !possuiAlteracoes);
    porId("btnLimparMesa")?.classList.toggle("d-none", !salva || possuiAlteracoes);
    porId("btnFinalizarMesa")?.classList.toggle("d-none", !salva || possuiAlteracoes);
  }

  function itensAtivosDaMesa(itens = atendimentoAtual?.itens || []) {
    return itens
      .filter((item) => item.status === "ATIVO")
      .map((item) => ({ produtoCod: Number(item.produtoCod), quantidade: Number(item.quantidade) }))
      .sort((a, b) => a.produtoCod - b.produtoCod);
  }

  function criarRascunhoMesaSalva() {
    if (!mesaEstaSalva()) {
      rascunhoMesaSalva = null;
      return;
    }
    rascunhoMesaSalva = {
      clienteId: atendimentoAtual?.clienteId ?? null,
      itens: (atendimentoAtual?.itens || [])
        .filter((item) => item.status === "ATIVO")
        .map((item) => ({ ...item }))
    };
  }

  function mesaPossuiAlteracoesPendentes() {
    if (!mesaEstaSalva() || !rascunhoMesaSalva) return false;
    return Number(atendimentoAtual?.clienteId || 0) !== Number(rascunhoMesaSalva.clienteId || 0)
      || JSON.stringify(itensAtivosDaMesa()) !== JSON.stringify(itensAtivosDaMesa(rascunhoMesaSalva.itens));
  }

  function obterClienteSelecionadoMesa() {
    const clienteId = atendimentoAtual?.clienteId;
    return obterClientes().find((cliente) => String(cliente.clienteId ?? cliente.cliente_id) === String(clienteId || "")) || null;
  }

  function formatarClienteMesa(cliente) {
    if (!cliente) return "";
    const clienteId = cliente.clienteId ?? cliente.cliente_id;
    return `${cliente.nome || "Cliente"} · #${clienteId}`;
  }

  function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>'"]/g, (caractere) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
    }[caractere]));
  }

  function normalizarCodigo(valor) {
    return window.vstockText?.normalizeCode(valor) || String(valor || "").replace(/\D/g, "");
  }

  function renderizarResultadosProdutos(produtos, aberto) {
    const resultados = porId("mesaProdutosResultados");
    if (!resultados) return;

    resultados.innerHTML = produtos.length
      ? produtos.map((produto) => {
        const saldo = Math.max(0, Number(produto.saldo || 0));
        const estoque = `<small>Estoque: ${saldo} ${saldo === 1 ? "unidade" : "unidades"}</small>`;
        const indisponivel = saldo <= 0;
        return `<button type="button" class="mesa-product-result${indisponivel ? " is-out" : ""}" role="option" data-produto-cod="${produto.prod_cod}" ${indisponivel ? "disabled aria-disabled=\"true\"" : ""}><span>${escaparHtml(produto.prod_descr)}${estoque}</span><strong>${window.vstockCurrency.formatMoney(produto.valor_unitario)}</strong></button>`;
      }).join("")
      : '<span class="mesa-product-empty">Nenhum produto encontrado.</span>';
    resultados.classList.toggle("ativo", aberto);
    resultados.querySelectorAll("[data-produto-cod]").forEach((botao) => {
      botao.addEventListener("click", () => selecionarProdutoMesa(botao.dataset.produtoCod));
    });
  }

  function selecionarProdutoMesa(produtoCod) {
    const produto = obterProdutos().find((item) => String(item.prod_cod) === String(produtoCod));
    if (!produto) return;
    if (Number(produto.saldo || 0) <= 0) {
      alertar("Este produto está sem estoque.", "danger");
      return;
    }
    porId("mesaProdutoSelecionado").value = String(produto.prod_cod);
    porId("mesaBuscaProduto").value = produto.prod_descr || "";
    renderizarResultadosProdutos([], false);
  }

  function filtrarProdutosMesa(aberto = true) {
    const termo = String(porId("mesaBuscaProduto")?.value || "").trim().toLowerCase();
    const codigo = normalizarCodigo(termo);
    const produtos = obterProdutos().filter((produto) => {
      const descricao = String(produto.prod_descr || "").toLowerCase();
      const codigoBarras = normalizarCodigo(produto.codigo_barras);
      return !termo || descricao.includes(termo) || (codigo && codigoBarras.includes(codigo));
    }).slice(0, 8);
    renderizarResultadosProdutos(produtos, aberto && Boolean(termo));
    return produtos;
  }

  function buscarProdutoMesa(evento) {
    const select = porId("mesaProdutoSelecionado");
    if (evento.type === "input") select.value = "";
    const produtos = filtrarProdutosMesa();
    if (evento.key !== "Enter") return;

    evento.preventDefault();
    const produtoPorCodigo = window.vstockProducts?.findByBarcode(obterProdutos(), evento.currentTarget.value, "codigo_barras");
    if (produtoPorCodigo) {
      selecionarProdutoMesa(produtoPorCodigo.prod_cod);
    } else if (produtos.length === 1) {
      selecionarProdutoMesa(produtos[0].prod_cod);
    }
  }

  function renderizarItens() {
    const itens = (atendimentoAtual?.itens || []).filter((item) => item.status === "ATIVO");
    const lista = porId("modalMesaItens");
    lista.innerHTML = itens.length
      ? itens.map((item) => `<div class="mesas-modal-item"><span class="mesa-item-description"><span class="mesa-item-icon"><i class="bi bi-cup-straw"></i></span><span><strong>${item.produtoNome}</strong><small>${window.vstockCurrency.formatMoney(item.precoUnitario)} cada</small></span></span><span class="mesa-item-value"><span class="pdv-qty-controls"><button type="button" class="pdv-qty-btn" data-ajustar-item-mesa="${item.id}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span class="pdv-qty-value">${item.quantidade}</span><button type="button" class="pdv-qty-btn" data-ajustar-item-mesa="${item.id}" data-delta="1" aria-label="Aumentar quantidade">+</button></span><strong>${window.vstockCurrency.formatMoney(item.subtotal)}</strong><button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" data-remover-item-mesa="${item.id}" aria-label="Remover item"><i class="bi bi-trash"></i></button></span></div>`).join("")
      : '<div class="pdv-empty-state">Nenhum item consumido.</div>';
    lista.querySelectorAll("[data-remover-item-mesa]").forEach((botao) => {
      botao.addEventListener("click", () => removerItem(botao.dataset.removerItemMesa));
    });
    lista.querySelectorAll("[data-ajustar-item-mesa]").forEach((botao) => {
      botao.addEventListener("click", () => ajustarQuantidadeItem(
        botao.dataset.ajustarItemMesa,
        Number(botao.dataset.delta)
      ));
    });
    const total = itens.reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
    porId("modalMesaTotal").textContent = window.vstockCurrency.formatMoney(total);
    if (mesaPagamentoDivididoEstaAtivo()) distribuirPagamentosMesa();
  }

  function obterTotalMesa() {
    return (atendimentoAtual?.itens || [])
      .filter((item) => item.status === "ATIVO")
      .reduce((soma, item) => soma + Number(item.subtotal || 0), 0);
  }

  function mesaPagamentoDivididoEstaAtivo() {
    return Boolean(porId("mesaVendaDivididaAtiva")?.checked);
  }

  function nomeFormaPagamento(id) {
    return obterFormasPagamento().find((forma) => String(forma.formaPagamentoId ?? forma.forma_pagamento_id) === String(id))?.nome || "";
  }

  function formaPagamentoEhDinheiro(id) {
    return nomeFormaPagamento(id).trim().toLowerCase() === "dinheiro";
  }

  function opcoesFormasPagamento(selecionado) {
    return '<option value="">Selecione...</option>' + obterFormasPagamento()
      .filter((forma) => forma.ativo !== false)
      .map((forma) => {
        const id = String(forma.formaPagamentoId ?? forma.forma_pagamento_id);
        return `<option value="${id}" ${id === String(selecionado || "") ? "selected" : ""}>${escaparHtml(forma.nome || "-")}</option>`;
      }).join("");
  }

  function distribuirPagamentosMesa() {
    if (!mesaPagamentoDivididoEstaAtivo()) return;

    const quantidade = Math.max(2, Math.min(20, Number(porId("mesaQuantidadePagadores")?.value || 2)));
    const totalCentavos = Math.round(obterTotalMesa() * 100);
    const valorBase = Math.floor(totalCentavos / quantidade);
    const resto = totalCentavos - (valorBase * quantidade);
    pagamentosDivididosMesa = Array.from({ length: quantidade }, (_, indice) => {
      const valor = (valorBase + (indice === 0 ? resto : 0)) / 100;
      const formaPagamentoId = pagamentosDivididosMesa[indice]?.formaPagamentoId || "";
      return {
        formaPagamentoId,
        valor,
        valorRecebido: formaPagamentoEhDinheiro(formaPagamentoId)
          ? Math.max(Number(pagamentosDivididosMesa[indice]?.valorRecebido || 0), valor)
          : null
      };
    });
    renderizarPagamentosDivididosMesa();
  }

  function saldoPagamentosMesa() {
    const informado = pagamentosDivididosMesa.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0);
    return Number((obterTotalMesa() - informado).toFixed(2));
  }

  function atualizarSaldoPagamentosMesa() {
    const elemento = porId("mesaSaldoPagamentosDivididos");
    if (!elemento) return;
    const saldo = saldoPagamentosMesa();
    elemento.classList.toggle("is-complete", saldo === 0);
    elemento.classList.toggle("is-invalid", saldo < 0);
    elemento.querySelector("span").textContent = saldo < 0 ? "Valor excedente" : saldo === 0 ? "Total distribuído" : "Falta distribuir";
    elemento.querySelector("strong").textContent = window.vstockCurrency.formatMoney(Math.abs(saldo));
  }

  function renderizarPagamentosDivididosMesa() {
    const container = porId("mesaPagamentosDivididos");
    if (!container) return;

    container.innerHTML = pagamentosDivididosMesa.map((pagamento, indice) => {
      const dinheiro = formaPagamentoEhDinheiro(pagamento.formaPagamentoId);
      const troco = dinheiro ? Math.max(Number(pagamento.valorRecebido || 0) - Number(pagamento.valor || 0), 0) : 0;
      return `
        <div class="pdv-split-payment" data-mesa-pagamento-indice="${indice}">
          <div class="pdv-split-payment-header"><strong>Pessoa ${indice + 1}</strong><span>${window.vstockCurrency.formatMoney(pagamento.valor)}</span></div>
          <div class="pdv-split-payment-fields">
            <div class="pdv-field-group">
              <label class="pdv-field-label" for="mesaFormaPagamentoDiv-${indice}">Forma de pagamento</label>
              <select id="mesaFormaPagamentoDiv-${indice}" class="form-select" data-campo="forma">${opcoesFormasPagamento(pagamento.formaPagamentoId)}</select>
            </div>
            <div class="pdv-field-group">
              <label class="pdv-field-label" for="mesaValorPagamentoDiv-${indice}">Valor</label>
              <input id="mesaValorPagamentoDiv-${indice}" class="form-control" data-campo="valor" inputmode="decimal" value="${window.vstockCurrency.formatNumber(pagamento.valor)}">
            </div>
            <div class="pdv-split-cash-fields ${dinheiro ? "" : "d-none"}">
              <div class="pdv-field-group">
                <label class="pdv-field-label" for="mesaRecebidoPagamentoDiv-${indice}">Valor recebido</label>
                <input id="mesaRecebidoPagamentoDiv-${indice}" class="form-control" data-campo="recebido" inputmode="decimal" value="${window.vstockCurrency.formatNumber(pagamento.valorRecebido ?? pagamento.valor)}">
              </div>
              <div class="pdv-field-group">
                <label class="pdv-field-label">Troco</label>
                <input class="form-control" value="${window.vstockCurrency.formatNumber(troco)}" disabled>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
    atualizarSaldoPagamentosMesa();
  }

  function alternarPagamentoDivididoMesa() {
    const ativo = mesaPagamentoDivididoEstaAtivo();
    porId("mesaDividirPagamentoBloco")?.classList.toggle("is-active", ativo);
    porId("mesaBlocoFormaPagamento")?.classList.toggle("d-none", ativo);
    porId("mesaBlocoPagamentoDividido")?.classList.toggle("d-none", !ativo);
    if (ativo) distribuirPagamentosMesa();
    else pagamentosDivididosMesa = [];
  }

  function limparPagamentoMesa() {
    porId("mesaVendaDivididaAtiva").checked = false;
    porId("mesaQuantidadePagadores").value = "2";
    pagamentosDivididosMesa = [];
    alternarPagamentoDivididoMesa();
  }

  async function abrirDetalhe(atendimentoId) {
    const resposta = await fetch(API_MESAS.ATENDIMENTO(atendimentoId));
    if (!resposta.ok) throw new Error("Não foi possível carregar o atendimento.");
    atendimentoAtual = await resposta.json();
    criarRascunhoMesaSalva();
    alteracaoClienteAtiva = false;
    clienteIdAntesDaAlteracao = null;
    porId("modalMesaTitulo").textContent = `Mesa ${atendimentoAtual.numero}`;
    porId("modalMesaAbertura").textContent = `Aberta em ${window.vstockFormatters.dateTime(atendimentoAtual.abertaEm)}`;
    popularSeletores();
    popularClientesMesa();
    renderizarItens();
    atualizarAcoesMesa();
    modal?.show();
  }

  async function adicionarItem() {
    try {
      const produtoCod = Number(porId("mesaProdutoSelecionado").value);
      const quantidade = Number(porId("mesaQuantidade").value);
      if (!produtoCod) throw new Error("Busque e selecione um produto.");
      if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error("Informe uma quantidade válida.");
      const itemExistente = (atendimentoAtual.itens || []).find((item) => (
        item.status === "ATIVO" && Number(item.produtoCod) === produtoCod
      ));
      const produto = obterProdutos().find((item) => Number(item.prod_cod) === produtoCod);
      const saldo = Number(produto?.saldo || 0);
      if (saldo <= 0) throw new Error("Este produto está sem estoque.");
      const precoUnitario = Number(itemExistente?.precoUnitario ?? produto?.valor_unitario);
      const novaQuantidade = Number(itemExistente?.quantidade || 0) + quantidade;
      if (!Number.isFinite(precoUnitario)) throw new Error("Produto invÃ¡lido.");
      if (novaQuantidade > saldo) throw new Error("A quantidade informada ultrapassa o saldo disponível.");
      const novoSubtotal = Number((precoUnitario * novaQuantidade).toFixed(2));
      if (itemExistente) {
        itemExistente.quantidade = novaQuantidade;
        itemExistente.subtotal = novoSubtotal;
      } else {
        atendimentoAtual.itens.push({
          id: `rascunho-${produtoCod}`,
          produtoCod,
          produtoNome: produto?.prod_descr || "Produto",
          quantidade,
          precoUnitario,
          subtotal: Number((precoUnitario * quantidade).toFixed(2)),
          status: "ATIVO"
        });
      }
      porId("mesaBuscaProduto").value = "";
      porId("mesaProdutoSelecionado").value = "";
      porId("mesaQuantidade").value = "1";
      renderizarItens();
      atualizarAcoesMesa();
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível adicionar o item."), "danger");
    }
  }

  function ajustarQuantidadeItem(itemId, delta) {
    const item = (atendimentoAtual?.itens || []).find((atual) => String(atual.id) === String(itemId) && atual.status === "ATIVO");
    if (!item) return;
    const proximaQuantidade = Number(item.quantidade || 0) + Number(delta || 0);
    if (proximaQuantidade <= 0) {
      removerItem(itemId);
      return;
    }
    const produto = obterProdutos().find((atual) => Number(atual.prod_cod) === Number(item.produtoCod));
    if (proximaQuantidade > Number(produto?.saldo || 0)) {
      alertar("A quantidade informada ultrapassa o saldo disponível.", "danger");
      return;
    }
    item.quantidade = proximaQuantidade;
    item.subtotal = Number((Number(item.precoUnitario || 0) * proximaQuantidade).toFixed(2));
    renderizarItens();
    atualizarAcoesMesa();
  }

  function removerItem(itemId) {
    try {
      atendimentoAtual.itens = (atendimentoAtual.itens || []).filter((item) => String(item.id) !== String(itemId));
      renderizarItens();
      atualizarAcoesMesa();
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível remover o item."), "danger");
    }
  }

  async function salvarMesa() {
    try {
      if (mesaEstaSalva()) return;
      const cliente = obterClienteSelecionadoMesa();
      const itens = (atendimentoAtual?.itens || []).filter((item) => item.status === "ATIVO");
      if (!itens.length) throw new Error("Adicione pelo menos um item antes de salvar a mesa.");

      const clienteId = cliente?.clienteId ?? cliente?.cliente_id ?? null;
      const resposta = await fetch(API_MESAS.ABRIR(atendimentoAtual.mesaId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          itens: itens.map((item) => ({ produtoCod: item.produtoCod, quantidade: item.quantidade }))
        })
      });
      if (!resposta.ok) throw new Error(await resposta.text());
      const abertura = await resposta.json();
      await abrirDetalhe(abertura.atendimentoMesaId);
      await carregar();
      alertar("Mesa salva com sucesso.", "success");
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível salvar a mesa."), "danger");
    }
  }

  function iniciarAlteracaoCliente() {
    if (!mesaEstaSalva()) return;
    clienteIdAntesDaAlteracao = atendimentoAtual?.clienteId ?? null;
    alteracaoClienteAtiva = true;
    popularClientesMesa();
    atualizarAcoesMesa();
    window.setTimeout(() => porId("mesaCliente")?.focus(), 0);
  }

  function cancelarAlteracaoCliente() {
    if (!alteracaoClienteAtiva) return;
    atendimentoAtual.clienteId = clienteIdAntesDaAlteracao;
    alteracaoClienteAtiva = false;
    clienteIdAntesDaAlteracao = null;
    popularClientesMesa();
    atualizarAcoesMesa();
  }

  function cancelarAlteracoesMesa() {
    if (!mesaEstaSalva() || !rascunhoMesaSalva) return;
    atendimentoAtual.clienteId = rascunhoMesaSalva.clienteId;
    atendimentoAtual.itens = rascunhoMesaSalva.itens.map((item) => ({ ...item }));
    alteracaoClienteAtiva = false;
    clienteIdAntesDaAlteracao = null;
    popularClientesMesa();
    renderizarItens();
    atualizarAcoesMesa();
  }

  async function salvarAlteracoesMesa() {
    try {
      if (!mesaEstaSalva()) return;
      if (!mesaPossuiAlteracoesPendentes()) {
        cancelarAlteracoesMesa();
        return;
      }
      const campoCliente = porId("mesaCliente");
      const clienteId = atendimentoAtual?.clienteId ?? null;
      if (String(campoCliente?.value || "").trim() && !clienteId) {
        throw new Error("Selecione um cliente da lista ou limpe o campo para desvincular.");
      }
      const resposta = await fetch(API_MESAS.ATUALIZAR(atendimentoAtual.atendimentoMesaId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, itens: itensAtivosDaMesa() })
      });
      if (!resposta.ok) throw new Error(await resposta.text());
      alteracaoClienteAtiva = false;
      clienteIdAntesDaAlteracao = null;
      await abrirDetalhe(atendimentoAtual.atendimentoMesaId);
      await carregar();
      alertar("Mesa atualizada.", "success");
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível salvar as alterações da mesa."), "danger");
    }
  }

  function abrirConfirmacaoLimparMesa() {
    if (!mesaEstaSalva()) return;
    reabrirMesaComoRascunhoAposLimpeza = false;
    const elementoModalMesa = porId("modalMesa");
    if (elementoModalMesa?.classList.contains("show")) {
      elementoModalMesa.addEventListener("hidden.bs.modal", () => modalConfirmarLimpeza?.show(), { once: true });
      modal?.hide();
      return;
    }
    modalConfirmarLimpeza?.show();
  }

  async function limparMesa() {
    try {
      if (!mesaEstaSalva()) return;
      const resposta = await fetch(API_MESAS.LIMPAR(atendimentoAtual.atendimentoMesaId), { method: "DELETE" });
      if (!resposta.ok) throw new Error(await resposta.text());
      await carregar();
      reabrirMesaComoRascunhoAposLimpeza = true;
      modalConfirmarLimpeza?.hide();
      alertar("Mesa limpa e liberada.", "success");
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível limpar a mesa."), "danger");
    }
  }

  function abrirConfirmacaoOcultarMesa() {
    if (!mesasEstaoVazias()) return;
    modalConfirmarOcultacao?.show();
  }

  async function ocultarMesaReserva() {
    try {
      const resposta = await fetch(API_MESAS.OCULTAR_ULTIMA, { method: "POST" });
      if (!resposta.ok) throw new Error(await resposta.text());
      modalConfirmarOcultacao?.hide();
      await carregar();
      alertar("Mesa movida para a reserva.", "success");
    } catch (erro) {
      alertar(formatarErro(erro, "NÃ£o foi possÃ­vel ocultar a mesa."), "danger");
    }
  }

  async function fechar() {
    try {
      const dividida = mesaPagamentoDivididoEstaAtivo();
      const total = obterTotalMesa();
      if (total <= 0) throw new Error("Adicione pelo menos um item antes de fechar a mesa.");
      if (dividida && pagamentosDivididosMesa.length < 2) throw new Error("Informe pelo menos duas pessoas para dividir a conta.");
      if (dividida && pagamentosDivididosMesa.some((pagamento) => !pagamento.formaPagamentoId || Number(pagamento.valor || 0) <= 0)) {
        throw new Error("Preencha a forma e o valor de todos os pagamentos.");
      }
      if (dividida && saldoPagamentosMesa() !== 0) throw new Error("A soma dos pagamentos deve ser igual ao total da mesa.");
      if (dividida && pagamentosDivididosMesa.some((pagamento) => formaPagamentoEhDinheiro(pagamento.formaPagamentoId) && Number(pagamento.valorRecebido || 0) < Number(pagamento.valor || 0))) {
        throw new Error("O valor recebido em dinheiro deve cobrir a parcela informada.");
      }

      const formaPagamentoId = Number(porId("mesaFormaPagamento").value);
      if (!dividida && !formaPagamentoId) throw new Error("Selecione a forma de pagamento.");
      const dinheiro = formaPagamentoEhDinheiro(formaPagamentoId);
      const body = dividida
        ? {
          status: "FINALIZADA",
          pagamentos: pagamentosDivididosMesa.map((pagamento) => ({
            formaPagamentoId: Number(pagamento.formaPagamentoId),
            valor: Number(Number(pagamento.valor).toFixed(2)),
            valorRecebido: formaPagamentoEhDinheiro(pagamento.formaPagamentoId)
              ? Number(Number(pagamento.valorRecebido).toFixed(2))
              : null,
            troco: formaPagamentoEhDinheiro(pagamento.formaPagamentoId)
              ? Number(Math.max(Number(pagamento.valorRecebido || 0) - Number(pagamento.valor || 0), 0).toFixed(2))
              : null
          }))
        }
        : { formaPagamentoId, valorRecebido: dinheiro ? total : null, troco: dinheiro ? 0 : null, status: "FINALIZADA" };
      const resposta = await fetch(API_MESAS.FECHAR(atendimentoAtual.atendimentoMesaId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!resposta.ok) throw new Error(await resposta.text());
      modal?.hide();
      await carregar();
      alertar("Mesa fechada e venda registrada.", "success");
    } catch (erro) {
      alertar(formatarErro(erro, "Não foi possível fechar a mesa."), "danger");
    }
  }

  function inicializar(config) {
    obterProdutos = config.obterProdutos;
    obterFormasPagamento = config.obterFormasPagamento;
    obterClientes = config.obterClientes;
    abrirCadastroCliente = config.abrirCadastroCliente;
    alertar = config.alertar;
    modal = new bootstrap.Modal(porId("modalMesa"));
    modalConfirmarLimpeza = new bootstrap.Modal(porId("modalConfirmarLimpezaMesa"));
    modalConfirmarOcultacao = new bootstrap.Modal(porId("modalConfirmarOcultarMesa"));
    window.vstockFilterDropdown?.attach({
      input: "#mesaCliente",
      optionValues: true,
      getOptions: () => obterClientes().map((cliente) => {
        const clienteId = cliente.clienteId ?? cliente.cliente_id;
        return {
          label: formatarClienteMesa(cliente),
          value: String(clienteId),
          searchText: formatarClienteMesa(cliente)
        };
      }),
      onInputValueChange: () => {
        if (atendimentoAtual) atendimentoAtual.clienteId = null;
      },
      onOptionSelect: (_label, clienteId) => {
        if (atendimentoAtual) atendimentoAtual.clienteId = clienteId;
      },
      emptyText: "Nenhum cliente encontrado"
    });
    porId("modalMesa")?.addEventListener("hidden.bs.modal", limparPagamentoMesa);
    porId("modalConfirmarLimpezaMesa")?.addEventListener("hidden.bs.modal", () => {
      if (reabrirMesaComoRascunhoAposLimpeza && atendimentoAtual?.mesaId) {
        const mesaId = atendimentoAtual.mesaId;
        reabrirMesaComoRascunhoAposLimpeza = false;
        window.setTimeout(() => abrirPreviaMesa(mesaId), 0);
        return;
      }
      reabrirMesaComoRascunhoAposLimpeza = false;
    });
    porId("btnAtualizarMesas")?.addEventListener("click", () => carregar().catch((erro) => alertar(formatarErro(erro), "danger")));
    porId("btnNovaMesa")?.addEventListener("click", ativarProximaMesa);
    porId("mesaBuscaProduto")?.addEventListener("input", buscarProdutoMesa);
    porId("mesaBuscaProduto")?.addEventListener("keydown", buscarProdutoMesa);
    porId("btnAdicionarItemMesa")?.addEventListener("click", adicionarItem);
    porId("btnSalvarMesa")?.addEventListener("click", salvarMesa);
    porId("btnAlterarClienteMesa")?.addEventListener("click", iniciarAlteracaoCliente);
    porId("btnCancelarAlteracoesMesa")?.addEventListener("click", cancelarAlteracoesMesa);
    porId("btnSalvarAlteracoesMesa")?.addEventListener("click", salvarAlteracoesMesa);
    porId("btnLimparMesa")?.addEventListener("click", abrirConfirmacaoLimparMesa);
    porId("btnConfirmarLimparMesa")?.addEventListener("click", limparMesa);
    porId("btnOcultarUltimaMesa")?.addEventListener("click", abrirConfirmacaoOcultarMesa);
    porId("btnConfirmarOcultarMesa")?.addEventListener("click", ocultarMesaReserva);
    porId("btnNovoClienteMesa")?.addEventListener("click", () => {
      let clienteCriado = false;
      porId("modalClienteVenda")?.addEventListener("hidden.bs.modal", () => {
        if (!clienteCriado && atendimentoAtual) window.setTimeout(() => modal?.show(), 0);
      }, { once: true });
      modal?.hide();
      abrirCadastroCliente((cliente) => {
        clienteCriado = true;
        atendimentoAtual.clienteId = cliente?.clienteId ?? cliente?.cliente_id ?? null;
        popularClientesMesa(cliente);
        window.setTimeout(() => modal?.show(), 0);
      });
    });
    porId("btnFinalizarMesa")?.addEventListener("click", fechar);
    porId("mesaVendaDivididaAtiva")?.addEventListener("change", alternarPagamentoDivididoMesa);
    porId("mesaQuantidadePagadores")?.addEventListener("input", distribuirPagamentosMesa);
    porId("mesaPagamentosDivididos")?.addEventListener("change", (evento) => {
      const linha = evento.target.closest("[data-mesa-pagamento-indice]");
      if (!linha || evento.target.dataset.campo !== "forma") return;
      const indice = Number(linha.dataset.mesaPagamentoIndice);
      pagamentosDivididosMesa[indice].formaPagamentoId = evento.target.value;
      pagamentosDivididosMesa[indice].valorRecebido = formaPagamentoEhDinheiro(evento.target.value)
        ? pagamentosDivididosMesa[indice].valor
        : null;
      renderizarPagamentosDivididosMesa();
    });
    porId("mesaPagamentosDivididos")?.addEventListener("input", (evento) => {
      const linha = evento.target.closest("[data-mesa-pagamento-indice]");
      if (!linha) return;
      const indice = Number(linha.dataset.mesaPagamentoIndice);
      if (evento.target.dataset.campo === "valor") pagamentosDivididosMesa[indice].valor = window.vstockCurrency.parse(evento.target.value || "");
      if (evento.target.dataset.campo === "recebido") pagamentosDivididosMesa[indice].valorRecebido = window.vstockCurrency.parse(evento.target.value || "");
      const pagamento = pagamentosDivididosMesa[indice];
      linha.querySelector(".pdv-split-payment-header span").textContent = window.vstockCurrency.formatMoney(pagamento.valor);
      if (formaPagamentoEhDinheiro(pagamento.formaPagamentoId)) {
        const campoTroco = linha.querySelector(".pdv-split-cash-fields input[disabled]");
        const troco = Math.max(Number(pagamento.valorRecebido || 0) - Number(pagamento.valor || 0), 0);
        if (campoTroco) campoTroco.value = window.vstockCurrency.formatNumber(troco);
      }
      atualizarSaldoPagamentosMesa();
    });
  }

  window.vstockMesas = { carregar, inicializar };
})();

