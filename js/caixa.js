const API_CAIXA_SESSAO = "http://localhost:8080/api/caixa/sessao";
const API_CAIXA_MOVIMENTOS = "http://localhost:8080/api/caixa/movimentos";
const API_CAIXA_RESUMO = "http://localhost:8080/api/caixa/resumo";
const API_VENDA_DETALHE = (id) => `http://localhost:8080/api/vendas/${id}`;

const $caixa = (seletor) => document.querySelector(seletor);
const mensagemCaixa = window.vstockUi.createAlertHandler({
  container: "#mensagens",
  autoRemoveMs: 5000
});

let sessaoCaixaAtual = null;
let resumoCaixaAtual = null;
let tipoMovimentoAtual = "ENTRADA";
let intervaloDuracaoCaixa = null;

document.addEventListener("DOMContentLoaded", () => {
  const funcionario = window.vstockSession.getFuncionario();
  $caixa("#cashOpeningOperator").value = funcionario?.funcNome || funcionario?.username || "Usuário autenticado";
  $caixa("#cashOpeningDate").value = formatarDataHora(new Date());

  window.vstockCurrency.attachMask($caixa("#cashOpeningAmount"));
  window.vstockCurrency.attachMask($caixa("#cashClosingAmount"));
  window.vstockCurrency.attachMask($caixa("#cashMovementAmount"));

  $caixa("#cashOpeningForm").addEventListener("submit", abrirCaixa);
  $caixa("#cashClosingForm").addEventListener("submit", fecharCaixa);
  $caixa("#cashMovementForm").addEventListener("submit", registrarMovimentoCaixa);
  $caixa("#cashClosingAmount").addEventListener("input", atualizarDiferencaFechamento);
  document.querySelectorAll("[data-movement-type]").forEach((botao) => {
    botao.addEventListener("click", () => selecionarTipoMovimento(botao.dataset.movementType));
  });

  carregarSessaoAberta();
});

async function carregarSessaoAberta() {
  definirCarregandoCaixa(true);

  try {
    const response = await fetch(`${API_CAIXA_SESSAO}/aberta`, {
      headers: { Accept: "application/json" }
    });

    if (response.status === 204) {
      exibirCaixaFechado();
      return;
    }

    if (!response.ok) {
      throw new Error(await obterMensagemErro(response, "Não foi possível consultar o caixa."));
    }

    exibirSessaoAberta(await response.json());
  } catch (erro) {
    console.error("Erro ao consultar a sessão do caixa:", erro);
    mensagemCaixa(erro.message || "Não foi possível consultar o caixa.", "danger");
    exibirCaixaFechado();
  } finally {
    definirCarregandoCaixa(false);
  }
}

async function abrirCaixa(evento) {
  evento.preventDefault();

  const saldoInicialTexto = $caixa("#cashOpeningAmount").value.trim();
  if (!saldoInicialTexto) {
    mensagemCaixa("Informe o saldo inicial.", "warning");
    $caixa("#cashOpeningAmount").focus();
    return;
  }

  const saldoInicial = window.vstockCurrency.parse(saldoInicialTexto);
  if (saldoInicial < 0) {
    mensagemCaixa("O saldo inicial não pode ser negativo.", "warning");
    return;
  }

  const botao = $caixa("#cashOpenButton");
  definirBotaoCarregando(botao, true, "Abrindo...");

  try {
    const response = await fetch(`${API_CAIXA_SESSAO}/abertura`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        saldoInicial,
        observacaoAbertura: $caixa("#cashOpeningNote").value.trim() || null
      })
    });

    if (!response.ok) {
      throw new Error(await obterMensagemErro(response, "Não foi possível abrir o caixa."));
    }

    const sessao = await response.json();
    $caixa("#cashOpeningForm").reset();
    $caixa("#cashOpeningOperator").value = obterNomeFuncionarioLogado();
    $caixa("#cashOpeningDate").value = formatarDataHora(new Date());
    mensagemCaixa("Caixa aberto com sucesso.", "success");
    exibirSessaoAberta(sessao);
  } catch (erro) {
    console.error("Erro ao abrir o caixa:", erro);
    mensagemCaixa(erro.message || "Não foi possível abrir o caixa.", "danger");
  } finally {
    definirBotaoCarregando(botao, false);
  }
}

async function registrarMovimentoCaixa(evento) {
  evento.preventDefault();

  if (!sessaoCaixaAtual) {
    mensagemCaixa("Abra o caixa antes de registrar movimentos.", "warning");
    return;
  }

  const valorTexto = $caixa("#cashMovementAmount").value.trim();
  const motivo = $caixa("#cashMovementReason").value.trim();
  const valor = window.vstockCurrency.parse(valorTexto);

  if (!valorTexto || valor <= 0) {
    mensagemCaixa("Informe um valor maior que zero.", "warning");
    $caixa("#cashMovementAmount").focus();
    return;
  }

  if (!motivo) {
    mensagemCaixa("Informe o motivo do movimento.", "warning");
    $caixa("#cashMovementReason").focus();
    return;
  }

  const descricaoTipo = tipoMovimentoAtual === "SANGRIA" ? "sangria" : "entrada";
  if (!window.confirm(`Confirma o registro desta ${descricaoTipo} no valor de ${window.vstockCurrency.formatMoney(valor)}?`)) {
    return;
  }

  const botao = $caixa("#cashMovementButton");
  definirBotaoCarregando(botao, true, "Registrando...");

  try {
    const response = await fetch(API_CAIXA_MOVIMENTOS, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tipo: tipoMovimentoAtual,
        valor,
        motivo,
        observacao: $caixa("#cashMovementNote").value.trim() || null
      })
    });

    if (!response.ok) {
      throw new Error(await obterMensagemErro(response, "Não foi possível registrar o movimento."));
    }

    await response.json();
    $caixa("#cashMovementForm").reset();
    selecionarTipoMovimento(tipoMovimentoAtual);
    mensagemCaixa(`${capitalizar(descricaoTipo)} registrada com sucesso.`, "success");
    await carregarDadosMovimentos();
  } catch (erro) {
    console.error("Erro ao registrar movimento do caixa:", erro);
    mensagemCaixa(erro.message || "Não foi possível registrar o movimento.", "danger");
  } finally {
    definirBotaoCarregando(botao, false);
    atualizarBotaoMovimento();
  }
}

async function fecharCaixa(evento) {
  evento.preventDefault();

  if (!sessaoCaixaAtual) {
    mensagemCaixa("Não existe caixa aberto.", "warning");
    return;
  }

  const valorContadoTexto = $caixa("#cashClosingAmount").value.trim();
  if (!valorContadoTexto) {
    mensagemCaixa("Informe o valor contado.", "warning");
    $caixa("#cashClosingAmount").focus();
    return;
  }

  const valorContado = window.vstockCurrency.parse(valorContadoTexto);
  if (valorContado < 0) {
    mensagemCaixa("O valor contado não pode ser negativo.", "warning");
    return;
  }

  if (!window.confirm("Confirma o fechamento do caixa? Esta sessão não poderá ser reaberta.")) {
    return;
  }

  const botao = $caixa("#cashCloseButton");
  definirBotaoCarregando(botao, true, "Fechando...");

  try {
    const response = await fetch(`${API_CAIXA_SESSAO}/fechamento`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        valorContado,
        observacaoFechamento: $caixa("#cashClosingNote").value.trim() || null
      })
    });

    if (!response.ok) {
      throw new Error(await obterMensagemErro(response, "Não foi possível fechar o caixa."));
    }

    const sessaoFechada = await response.json();
    const resumoFechamento = resumoCaixaAtual;
    $caixa("#cashClosingForm").reset();
    mensagemCaixa("Caixa fechado com sucesso.", "success");
    exibirCaixaFechado();
    window.vstockCashReceipt.imprimir({ sessao: sessaoFechada, resumo: resumoFechamento });
  } catch (erro) {
    console.error("Erro ao fechar o caixa:", erro);
    mensagemCaixa(erro.message || "Não foi possível fechar o caixa.", "danger");
  } finally {
    definirBotaoCarregando(botao, false);
  }
}

async function carregarDadosMovimentos() {
  if (!sessaoCaixaAtual) {
    return;
  }

  try {
    const [responseResumo, responseMovimentos] = await Promise.all([
      fetch(API_CAIXA_RESUMO, { headers: { Accept: "application/json" } }),
      fetch(API_CAIXA_MOVIMENTOS, { headers: { Accept: "application/json" } })
    ]);

    if (!responseResumo.ok || !responseMovimentos.ok) {
      const responseErro = !responseResumo.ok ? responseResumo : responseMovimentos;
      throw new Error(await obterMensagemErro(responseErro, "Não foi possível atualizar os movimentos do caixa."));
    }

    const [resumo, movimentos] = await Promise.all([
      responseResumo.json(),
      responseMovimentos.json()
    ]);

    const listaMovimentos = Array.isArray(movimentos) ? movimentos : [];
    await complementarOrigemDasVendas(listaMovimentos);

    resumoCaixaAtual = resumo;
    renderizarResumoCaixa(resumo);
    renderizarMovimentosCaixa(listaMovimentos);
  } catch (erro) {
    console.error("Erro ao carregar movimentos do caixa:", erro);
    mensagemCaixa(erro.message || "Não foi possível atualizar os movimentos do caixa.", "danger");
  }
}

function renderizarResumoCaixa(resumo) {
  const saldoEsperado = numeroCaixa(resumo?.saldoEsperado);

  definirTexto("#cashInitialBalance", formatarDinheiro(resumo?.saldoInicial));
  definirTexto("#cashNetSales", formatarDinheiro(resumo?.vendasLiquidas));
  definirTexto("#cashEntries", formatarDinheiro(resumo?.entradas));
  definirTexto("#cashWithdrawals", formatarDinheiro(resumo?.sangrias));
  definirTexto("#cashExpectedBalance", formatarDinheiro(saldoEsperado));
  definirTexto("#cashClosingExpected", formatarDinheiro(saldoEsperado));
  definirTexto("#cashPaymentTotal", formatarDinheiro(resumo?.vendasLiquidas));

  $caixa("#cashClosingAmount").value = window.vstockCurrency.formatNumber(saldoEsperado);
  renderizarFormasPagamento(resumo?.formasPagamento || []);
  atualizarDiferencaFechamento();
}

function renderizarFormasPagamento(formasPagamento) {
  const container = $caixa("#cashPaymentList");
  if (!formasPagamento.length) {
    container.innerHTML = '<div class="cash-empty-state">Nenhuma venda registrada nesta sessão.</div>';
    return;
  }

  container.innerHTML = formasPagamento.map((forma) => `
    <div class="cash-payment-row">
      <span class="cash-payment-icon ${classeFormaPagamento(forma.nome)}">
        <i class="bi ${iconeFormaPagamento(forma.nome)}"></i>
      </span>
      <div>
        <strong>${escaparHtml(forma.nome || "Não informado")}</strong>
        <small>Valor líquido na sessão</small>
      </div>
      <strong>${formatarDinheiro(forma.valorLiquido)}</strong>
    </div>
  `).join("");
}

function renderizarMovimentosCaixa(movimentos) {
  const corpo = $caixa("#cashMovementTableBody");
  const listaMovimentos = $caixa(".cash-movement-list");
  const semMovimentos = !movimentos.length;
  listaMovimentos?.classList.toggle("is-empty", semMovimentos);

  definirTexto(
    "#cashMovementCount",
    `${movimentos.length} ${movimentos.length === 1 ? "movimento" : "movimentos"}`
  );

  if (semMovimentos) {
    corpo.innerHTML = `
      <tr>
        <td class="cash-table-empty" colspan="6">Nenhum movimento registrado nesta sessão.</td>
      </tr>
    `;
    return;
  }

  corpo.innerHTML = movimentos.map((movimento) => {
    const tipo = movimento.tipo || "";
    const tipoExibicao = obterTipoExibicaoMovimento(movimento);
    const negativo = tipo === "SANGRIA" || tipo === "ESTORNO";
    const valor = numeroCaixa(movimento.valor) * (negativo ? -1 : 1);
    const origem = movimento.vendaId
      ? `Venda #${movimento.vendaId}${movimento.clienteNome ? ` — ${movimento.clienteNome}` : ""}`
      : "Lançamento manual";
    const detalheMotivo = movimento.motivo || movimento.observacao || motivoPadraoMovimento(tipo);

    return `
      <tr>
        <td>${formatarDataHora(movimento.dataMovimento)}</td>
        <td>
          <span class="cash-movement-badge ${tipoExibicao.classe}">
            ${tipoExibicao.rotulo}
          </span>
        </td>
        <td>${escaparHtml(origem)}</td>
        <td>${escaparHtml(movimento.usuarioNome || "-")}</td>
        <td>${escaparHtml(detalheMotivo)}</td>
        <td class="text-end ${valor < 0 ? "cash-value-negative" : "cash-value-positive"}">
          ${formatarDinheiro(valor)}
        </td>
      </tr>
    `;
  }).join("");
}

function exibirCaixaFechado() {
  sessaoCaixaAtual = null;
  resumoCaixaAtual = null;
  encerrarAtualizacaoDuracao();

  $caixa("#cashOpeningSection").hidden = false;
  $caixa("#cashCurrentSession").hidden = true;
  window.dispatchEvent(new Event("vstock:cash-session-change"));
  $caixa("#cashOpeningDate").value = formatarDataHora(new Date());
  renderizarMovimentosCaixa([]);
}

function exibirSessaoAberta(sessao) {
  sessaoCaixaAtual = sessao;
  const saldoInicial = numeroCaixa(sessao.saldoInicial);
  const dataAbertura = new Date(sessao.dataAbertura);
  resumoCaixaAtual = {
    saldoInicial,
    vendasLiquidas: 0,
    entradas: 0,
    sangrias: 0,
    saldoEsperado: saldoInicial,
    formasPagamento: []
  };

  $caixa("#cashOpeningSection").hidden = true;
  $caixa("#cashCurrentSession").hidden = false;
  window.dispatchEvent(new Event("vstock:cash-session-change"));

  definirTexto("#cashSessionId", `Caixa #${sessao.caixaSessaoId}`);
  definirTexto("#cashSessionOperator", sessao.usuarioAberturaNome || "-");
  definirTexto("#cashSessionOpenedAt", formatarDataHora(dataAbertura));
  definirTexto("#cashInitialBalance", window.vstockCurrency.formatMoney(saldoInicial));
  definirTexto("#cashExpectedBalance", window.vstockCurrency.formatMoney(saldoInicial));
  definirTexto("#cashClosingExpected", window.vstockCurrency.formatMoney(saldoInicial));
  definirTexto("#cashOpeningOperatorSummary", sessao.usuarioAberturaNome || "-");
  definirTexto("#cashOpeningDateSummary", formatarDataHora(dataAbertura));
  definirTexto("#cashOpeningAmountSummary", window.vstockCurrency.formatMoney(saldoInicial));
  definirTexto("#cashOpeningNoteSummary", sessao.observacaoAbertura || "Sem observação.");

  $caixa("#cashClosingAmount").value = window.vstockCurrency.formatNumber(saldoInicial);
  renderizarResumoCaixa(resumoCaixaAtual);
  renderizarMovimentosCaixa([]);
  atualizarDiferencaFechamento();
  iniciarAtualizacaoDuracao();
  carregarDadosMovimentos();
}

function atualizarDiferencaFechamento() {
  const esperado = numeroCaixa(resumoCaixaAtual?.saldoEsperado ?? sessaoCaixaAtual?.saldoInicial);
  const contado = window.vstockCurrency.parse($caixa("#cashClosingAmount")?.value || "");
  const diferenca = contado - esperado;
  const elemento = $caixa("#cashClosingDifference");

  elemento.textContent = window.vstockCurrency.formatMoney(diferenca);
  elemento.classList.toggle("is-positive", diferenca > 0);
  elemento.classList.toggle("is-negative", diferenca < 0);
}

function iniciarAtualizacaoDuracao() {
  encerrarAtualizacaoDuracao();
  atualizarDuracaoSessao();
  intervaloDuracaoCaixa = window.setInterval(atualizarDuracaoSessao, 60000);
}

function encerrarAtualizacaoDuracao() {
  if (intervaloDuracaoCaixa) {
    window.clearInterval(intervaloDuracaoCaixa);
    intervaloDuracaoCaixa = null;
  }
}

function atualizarDuracaoSessao() {
  if (!sessaoCaixaAtual?.dataAbertura) {
    return;
  }

  const inicio = new Date(sessaoCaixaAtual.dataAbertura).getTime();
  const minutos = Math.max(0, Math.floor((Date.now() - inicio) / 60000));
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;
  definirTexto(
    "#cashSessionDuration",
    horas > 0 ? `Em operação há ${horas}h ${restante}min` : `Em operação há ${restante}min`
  );
}

function definirCarregandoCaixa(carregando) {
  $caixa("#cashLoadingState").hidden = !carregando;
}

function definirBotaoCarregando(botao, carregando, textoCarregando = "") {
  if (!botao) {
    return;
  }

  if (carregando) {
    botao.dataset.textoOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>${textoCarregando}`;
    return;
  }

  botao.disabled = false;
  if (botao.dataset.textoOriginal) {
    botao.innerHTML = botao.dataset.textoOriginal;
  }
}

async function obterMensagemErro(response, fallback) {
  const texto = (await response.text()).trim();
  return texto || fallback;
}

function formatarDataHora(valor) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function numeroCaixa(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function obterNomeFuncionarioLogado() {
  const funcionario = window.vstockSession.getFuncionario();
  return funcionario?.funcNome || funcionario?.username || "Usuário autenticado";
}

function selecionarTipoMovimento(tipo) {
  tipoMovimentoAtual = tipo === "SANGRIA" ? "SANGRIA" : "ENTRADA";
  document.querySelectorAll("[data-movement-type]").forEach((botao) => {
    botao.classList.toggle("is-active", botao.dataset.movementType === tipoMovimentoAtual);
  });

  const motivo = $caixa("#cashMovementReason");
  motivo.placeholder = tipoMovimentoAtual === "SANGRIA"
    ? "Ex.: depósito no banco"
    : "Ex.: reforço de troco";
  atualizarBotaoMovimento();
}

function atualizarBotaoMovimento() {
  const botao = $caixa("#cashMovementButton");
  if (!botao || botao.disabled) {
    return;
  }

  const sangria = tipoMovimentoAtual === "SANGRIA";
  botao.innerHTML = `
    <i class="bi ${sangria ? "bi-dash-circle" : "bi-plus-circle"}"></i>
    Registrar ${sangria ? "sangria" : "entrada"}
  `;
  botao.classList.toggle("cash-danger-button", sangria);
  botao.classList.toggle("cash-primary-button", !sangria);
}

function obterTipoExibicaoMovimento(movimento) {
  const tipo = movimento?.tipo;
  if (tipo === "VENDA") {
    const mesaNumero = Number(movimento?.mesaNumero);
    if (movimento?.vendaTipo === "MESA" && Number.isInteger(mesaNumero)) {
      return { classe: "is-sale", rotulo: `Mesa ${mesaNumero}` };
    }
    return { classe: "is-sale", rotulo: "Venda rápida" };
  }

  return { classe: classeTipoMovimento(tipo), rotulo: rotuloTipoMovimento(tipo) };
}

async function complementarOrigemDasVendas(movimentos) {
  const vendasSemOrigem = [...new Set(movimentos
    .filter((movimento) => movimento?.tipo === "VENDA" && movimento?.vendaId && !movimento?.vendaTipo)
    .map((movimento) => movimento.vendaId))];

  if (!vendasSemOrigem.length) return;

  const origens = await Promise.all(vendasSemOrigem.map(async (vendaId) => {
    try {
      const resposta = await fetch(API_VENDA_DETALHE(vendaId), { headers: { Accept: "application/json" } });
      if (!resposta.ok) return [vendaId, null];

      const venda = await resposta.json();
      return [vendaId, { vendaTipo: venda.tipo, mesaNumero: venda.mesaNumero }];
    } catch {
      return [vendaId, null];
    }
  }));

  const origemPorVenda = new Map(origens);
  movimentos.forEach((movimento) => {
    const origem = origemPorVenda.get(movimento.vendaId);
    if (origem) Object.assign(movimento, origem);
  });
}

function rotuloTipoMovimento(tipo) {
  const rotulos = {
    VENDA: "Venda",
    ENTRADA: "Entrada",
    SANGRIA: "Sangria",
    ESTORNO: "Estorno",
    AJUSTE: "Ajuste"
  };
  return rotulos[tipo] || tipo || "-";
}

function classeTipoMovimento(tipo) {
  const classes = {
    VENDA: "is-sale",
    ENTRADA: "is-entry",
    SANGRIA: "is-withdrawal",
    ESTORNO: "is-refund",
    AJUSTE: "is-adjustment"
  };
  return classes[tipo] || "is-adjustment";
}

function motivoPadraoMovimento(tipo) {
  if (tipo === "VENDA") {
    return "Venda registrada automaticamente.";
  }
  if (tipo === "ESTORNO") {
    return "Estorno de venda.";
  }
  return "Sem motivo informado.";
}

function classeFormaPagamento(nome) {
  const normalizado = normalizarTextoComparacao(nome);
  if (normalizado === "dinheiro") {
    return "is-cash";
  }
  if (normalizado === "pix") {
    return "is-pix";
  }
  return "";
}

function iconeFormaPagamento(nome) {
  const normalizado = normalizarTextoComparacao(nome);
  if (normalizado === "dinheiro") {
    return "bi-cash-stack";
  }
  if (normalizado === "pix") {
    return "bi-qr-code";
  }
  return "bi-credit-card";
}

function normalizarTextoComparacao(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarDinheiro(valor) {
  return window.vstockCurrency.formatMoney(numeroCaixa(valor));
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function definirTexto(seletor, texto) {
  const elemento = $caixa(seletor);
  if (elemento) {
    elemento.textContent = texto;
  }
}

