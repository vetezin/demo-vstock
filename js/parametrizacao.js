document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("paramForm");
  const mensagemSucesso = document.getElementById("msg");
  const mensagemErro = document.getElementById("error");
  const dateEl = document.getElementById("current-date");

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  if (!form) {
    return;
  }

  const ativarAbaParametrizacao = inicializarAbasParametrizacao();

  const funcionarioLogado = window.vstockSession.getFuncionario();
  if (!window.vstockSession.isAdministradorMestre(funcionarioLogado)) {
    window.location.href = "index.html";
    return;
  }

  const campos = {
    razaoSocial: document.getElementById("razao_social"),
    nomeFantasia: document.getElementById("nome_fantasia"),
    cnpj: document.getElementById("cnpj"),
    telefone: document.getElementById("telefone"),
    email: document.getElementById("email"),
    site: document.getElementById("site"),
    rua: document.getElementById("rua"),
    bairro: document.getElementById("bairro"),
    cidade: document.getElementById("cidade"),
    uf: document.getElementById("uf"),
    cep: document.getElementById("cep"),
    horasLimiteCancelamentoVenda: document.getElementById("horas_limite_cancelamento_venda"),
    moduloEstoque: document.getElementById("modulo_estoque"),
    moduloAlertas: document.getElementById("modulo_alertas"),
    moduloVendas: document.getElementById("modulo_vendas"),
    moduloFinanceiro: document.getElementById("modulo_financeiro"),
    moduloContasPagar: document.getElementById("modulo_contas_pagar"),
    moduloContasReceber: document.getElementById("modulo_contas_receber"),
    moduloRelatorios: document.getElementById("modulo_relatorios")
  };

  if (window.IMask) {
    IMask(campos.cnpj, { mask: "00.000.000/0000-00" });
    IMask(campos.telefone, { mask: "(00) 00000-0000" });
    IMask(campos.cep, { mask: "00000-000" });
  }

  campos.uf?.addEventListener("input", () => {
    campos.uf.value = String(campos.uf.value || "").toUpperCase();
  });

  let empresaExistente = null;
  let modulosExistentes = null;

  try {
    [empresaExistente, modulosExistentes] = await Promise.all([
      carregarEmpresaUnica(),
      carregarModulos()
    ]);

    if (empresaExistente) {
      preencherFormularioEmpresa(campos, empresaExistente);
    }

    preencherFormularioModulos(campos, modulosExistentes);
  } catch (erro) {
    exibirErro(mensagemErro, erro.message || "Nao foi possivel carregar a configuracao atual.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    limparMensagens(mensagemSucesso, mensagemErro);

    if (!validarFormulario(form, ativarAbaParametrizacao)) {
      exibirErro(mensagemErro, "Corrija os campos destacados.");
      return;
    }

    try {
      const payloadEmpresa = montarPayloadEmpresa(campos);
      const payloadModulos = montarPayloadModulos(campos);

      const [respostaEmpresa, respostaModulos] = await Promise.all([
        fetch("http://localhost:8080/api/parametrizacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadEmpresa)
        }),
        fetch("http://localhost:8080/api/modulos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadModulos)
        })
      ]);

      const textoEmpresa = await respostaEmpresa.text();
      if (!respostaEmpresa.ok) {
        throw new Error(textoEmpresa || "Nao foi possivel salvar a parametrizacao.");
      }

      const textoModulos = await respostaModulos.text();
      if (!respostaModulos.ok) {
        throw new Error(textoModulos || "Nao foi possivel salvar os modulos.");
      }

      exibirSucesso(mensagemSucesso, textoEmpresa || textoModulos || "Configuracao salva com sucesso.");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (erro) {
      exibirErro(mensagemErro, erro.message || "Nao foi possivel salvar a configuracao.");
    }
  });
});

function inicializarAbasParametrizacao() {
  const tabs = Array.from(document.querySelectorAll("[data-param-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-param-panel]"));
  if (!tabs.length || !panels.length) {
    return null;
  }

  const ativarAba = (tabId) => {
    tabs.forEach((tab) => {
      const ativa = tab.dataset.paramTab === tabId;
      tab.classList.toggle("is-active", ativa);
      tab.setAttribute("aria-selected", ativa ? "true" : "false");
    });

    panels.forEach((panel) => {
      const ativa = panel.dataset.paramPanel === tabId;
      panel.classList.toggle("is-active", ativa);
      panel.hidden = !ativa;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => ativarAba(tab.dataset.paramTab));
  });

  ativarAba("empresa");
  return ativarAba;
}

async function carregarEmpresaUnica() {
  const response = await fetch("http://localhost:8080/api/parametrizacao/unica", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Falha ao consultar a parametrizacao.");
  }

  return await response.json();
}

async function carregarModulos() {
  const response = await fetch("http://localhost:8080/api/modulos/unica", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Falha ao consultar os modulos.");
  }

  return await response.json();
}

function preencherFormularioEmpresa(campos, empresa) {
  campos.razaoSocial.value = empresa.razaoSocial || "";
  campos.nomeFantasia.value = empresa.nomeFantasia || "";
  campos.cnpj.value = empresa.cnpj || "";
  campos.telefone.value = empresa.telefone || "";
  campos.email.value = empresa.email || "";
  campos.site.value = empresa.site || "";
  campos.rua.value = empresa.rua || "";
  campos.bairro.value = empresa.bairro || "";
  campos.cidade.value = empresa.cidade || "";
  campos.uf.value = String(empresa.uf || "").toUpperCase();
  campos.cep.value = empresa.cep || "";
  if (campos.horasLimiteCancelamentoVenda) {
    campos.horasLimiteCancelamentoVenda.value = normalizarHorasLimiteCancelamento(
      empresa.horasLimiteCancelamentoVenda
    );
  }
}

function preencherFormularioModulos(campos, modulos) {
  campos.moduloEstoque.checked = modulos ? modulos.moduloEstoque !== false : true;
  campos.moduloAlertas.checked = modulos ? modulos.moduloAlertas !== false : true;
  campos.moduloVendas.checked = modulos ? modulos.moduloVendas === true : false;
  campos.moduloFinanceiro.checked = modulos ? modulos.moduloFinanceiro === true : false;
  campos.moduloContasPagar.checked = modulos ? modulos.moduloContasPagar === true : false;
  campos.moduloContasReceber.checked = modulos ? modulos.moduloContasReceber === true : false;
  campos.moduloRelatorios.checked = modulos ? modulos.moduloRelatorios === true : false;
}

function validarFormulario(form, ativarAba) {
  let primeiroInvalido = null;

  Array.from(form.elements).forEach((elemento) => {
    if (!(elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement || elemento instanceof HTMLSelectElement)) {
      return;
    }

    const valido = elemento.checkValidity();
    elemento.classList.toggle("is-invalid", !valido);
    elemento.classList.toggle("is-valid", valido && !!(elemento.value || elemento.checked));

    if (!valido && !primeiroInvalido) {
      primeiroInvalido = elemento;
    }
  });

  if (primeiroInvalido) {
    const painelComErro = primeiroInvalido.closest("[data-param-panel]");
    if (painelComErro && typeof ativarAba === "function") {
      ativarAba(painelComErro.dataset.paramPanel);
    }

    primeiroInvalido.focus();
    primeiroInvalido.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  return true;
}

function montarPayloadEmpresa(campos) {
  return {
    razaoSocial: campos.razaoSocial.value.trim(),
    nomeFantasia: campos.nomeFantasia.value.trim(),
    cnpj: campos.cnpj.value.trim(),
    telefone: campos.telefone.value.trim(),
    email: campos.email.value.trim(),
    site: campos.site.value.trim(),
    rua: campos.rua.value.trim(),
    bairro: campos.bairro.value.trim(),
    cidade: campos.cidade.value.trim(),
    uf: campos.uf.value.trim().toUpperCase(),
    cep: campos.cep.value.trim(),
    horasLimiteCancelamentoVenda: normalizarHorasLimiteCancelamento(campos.horasLimiteCancelamentoVenda?.value)
  };
}

function normalizarHorasLimiteCancelamento(valor) {
  const numero = Number.parseInt(String(valor ?? "").trim(), 10);
  return Number.isInteger(numero) && numero > 0 ? numero : 12;
}

function montarPayloadModulos(campos) {
  return {
    moduloEstoque: !!campos.moduloEstoque.checked,
    moduloAlertas: !!campos.moduloAlertas.checked,
    moduloVendas: !!campos.moduloVendas.checked,
    moduloFinanceiro: !!campos.moduloFinanceiro.checked,
    moduloContasPagar: !!campos.moduloContasPagar.checked,
    moduloContasReceber: !!campos.moduloContasReceber.checked,
    moduloRelatorios: !!campos.moduloRelatorios.checked
  };
}

function limparMensagens(msg, err) {
  if (msg) msg.textContent = "";
  if (err) err.textContent = "";
}

function exibirSucesso(msg, texto) {
  if (msg) {
    msg.textContent = texto;
  }
}

function exibirErro(err, texto) {
  if (err) {
    err.textContent = texto;
  }
}

