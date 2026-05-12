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

  const funcionarioLogado = lerFuncionarioLogado();
  if (!funcionarioEhAdminMestre(funcionarioLogado)) {
    window.location.href = "index.html";
    return;
  }

  const campos = {
    razaoSocial: document.getElementById("razao_social"),
    nomeFantasia: document.getElementById("nome_fantasia"),
    telefone: document.getElementById("telefone"),
    email: document.getElementById("email"),
    site: document.getElementById("site"),
    rua: document.getElementById("rua"),
    bairro: document.getElementById("bairro"),
    cidade: document.getElementById("cidade"),
    uf: document.getElementById("uf"),
    cep: document.getElementById("cep"),
    logotipoSmall: document.getElementById("logotipo_small"),
    logotipoBig: document.getElementById("logotipo_big"),
    previewSmall: document.getElementById("logoPreviewSmall"),
    previewBig: document.getElementById("logoPreviewBig"),
    moduloEstoque: document.getElementById("modulo_estoque"),
    moduloAlertas: document.getElementById("modulo_alertas"),
    moduloVendas: document.getElementById("modulo_vendas"),
    moduloFinanceiro: document.getElementById("modulo_financeiro"),
    moduloContasPagar: document.getElementById("modulo_contas_pagar"),
    moduloContasReceber: document.getElementById("modulo_contas_receber"),
    moduloRelatorios: document.getElementById("modulo_relatorios")
  };

  if (window.IMask) {
    IMask(campos.telefone, { mask: "(00) 00000-0000" });
    IMask(campos.cep, { mask: "00000-000" });
  }

  campos.uf?.addEventListener("input", () => {
    campos.uf.value = String(campos.uf.value || "").toUpperCase();
  });

  campos.logotipoSmall?.addEventListener("change", () => previewFile(campos.logotipoSmall, campos.previewSmall));
  campos.logotipoBig?.addEventListener("change", () => previewFile(campos.logotipoBig, campos.previewBig));

  let empresaExistente = null;

  try {
    empresaExistente = await carregarEmpresaUnica();
    if (empresaExistente) {
      preencherFormulario(campos, empresaExistente);
    }
  } catch (erro) {
    exibirErro(mensagemErro, erro.message || "Não foi possível carregar a parametrização atual.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    limparMensagens(mensagemSucesso, mensagemErro);

    if (!validarFormulario(form, empresaExistente)) {
      exibirErro(mensagemErro, "Corrija os campos destacados.");
      return;
    }

    try {
      const payload = await montarPayload(campos, empresaExistente);
      const response = await fetch("http://localhost:8080/api/parametrizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const texto = await response.text();
      if (!response.ok) {
        throw new Error(texto || "Não foi possível salvar a parametrização.");
      }

      exibirSucesso(mensagemSucesso, texto || "Parametrização salva com sucesso.");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (erro) {
      exibirErro(mensagemErro, erro.message || "Não foi possível salvar a parametrização.");
    }
  });
});

function lerFuncionarioLogado() {
  try {
    return JSON.parse(localStorage.getItem("funcionarioLogado") || "null");
  } catch {
    return null;
  }
}

function funcionarioEhAdminMestre(funcionario) {
  const email = String(funcionario?.funcEmail || funcionario?.email || "").trim().toLowerCase();
  return Number(funcionario?.tipoAcesso) === 99 && (email === "admin@admin" || email === "admin@admin.login");
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
    throw new Error("Falha ao consultar a parametrização.");
  }

  return await response.json();
}

function preencherFormulario(campos, empresa) {
  campos.razaoSocial.value = empresa.razaoSocial || "";
  campos.nomeFantasia.value = empresa.nomeFantasia || "";
  campos.telefone.value = empresa.telefone || "";
  campos.email.value = empresa.email || "";
  campos.site.value = empresa.site || "";
  campos.rua.value = empresa.rua || "";
  campos.bairro.value = empresa.bairro || "";
  campos.cidade.value = empresa.cidade || "";
  campos.uf.value = String(empresa.uf || "").toUpperCase();
  campos.cep.value = empresa.cep || "";
  campos.moduloEstoque.checked = empresa.moduloEstoque !== false;
  campos.moduloAlertas.checked = empresa.moduloAlertas !== false;
  campos.moduloVendas.checked = empresa.moduloVendas === true;
  campos.moduloFinanceiro.checked = empresa.moduloFinanceiro === true;
  campos.moduloContasPagar.checked = empresa.moduloContasPagar === true;
  campos.moduloContasReceber.checked = empresa.moduloContasReceber === true;
  campos.moduloRelatorios.checked = empresa.moduloRelatorios === true;

  if (empresa.logotipoSmall) {
    campos.previewSmall.src = empresa.logotipoSmall;
  }

  if (empresa.logotipoBig) {
    campos.previewBig.src = empresa.logotipoBig;
  }
}

function validarFormulario(form, empresaExistente) {
  let primeiroInvalido = null;

  Array.from(form.elements).forEach((elemento) => {
    if (!(elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement || elemento instanceof HTMLSelectElement)) {
      return;
    }

    const valido = elemento.type === "file" ? true : elemento.checkValidity();
    elemento.classList.toggle("is-invalid", !valido);
    elemento.classList.toggle("is-valid", valido && !!(elemento.value || elemento.files?.length || elemento.checked));

    if (!valido && !primeiroInvalido) {
      primeiroInvalido = elemento;
    }
  });

  if (primeiroInvalido) {
    primeiroInvalido.focus();
    return false;
  }

  return true;
}

async function montarPayload(campos, empresaExistente) {
  return {
    razaoSocial: campos.razaoSocial.value.trim(),
    nomeFantasia: campos.nomeFantasia.value.trim(),
    telefone: campos.telefone.value.trim(),
    email: campos.email.value.trim(),
    site: campos.site.value.trim(),
    rua: campos.rua.value.trim(),
    bairro: campos.bairro.value.trim(),
    cidade: campos.cidade.value.trim(),
    uf: campos.uf.value.trim().toUpperCase(),
    cep: campos.cep.value.trim(),
    logotipoSmall: campos.logotipoSmall.files[0]
      ? await toDataURL(campos.logotipoSmall.files[0])
      : (empresaExistente?.logotipoSmall ?? null),
    logotipoBig: campos.logotipoBig.files[0]
      ? await toDataURL(campos.logotipoBig.files[0])
      : (empresaExistente?.logotipoBig ?? null),
    moduloEstoque: !!campos.moduloEstoque.checked,
    moduloAlertas: !!campos.moduloAlertas.checked,
    moduloVendas: !!campos.moduloVendas.checked,
    moduloFinanceiro: !!campos.moduloFinanceiro.checked,
    moduloContasPagar: !!campos.moduloContasPagar.checked,
    moduloContasReceber: !!campos.moduloContasReceber.checked,
    moduloRelatorios: !!campos.moduloRelatorios.checked
  };
}

function previewFile(input, imgEl) {
  const file = input?.files?.[0];
  if (!file || !imgEl) {
    return;
  }

  const fr = new FileReader();
  fr.onload = (event) => {
    imgEl.src = event.target?.result || "";
  };
  fr.readAsDataURL(file);
}

function toDataURL(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }

    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(file);
  });
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

