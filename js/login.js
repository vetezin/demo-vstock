document.addEventListener("DOMContentLoaded", () => {
  window.location.replace("index.html");
  return;

  const form = document.getElementById("loginForm");
  const licencaFieldWrapper = document.getElementById("licencaFieldWrapper");
  const licencaInput = document.getElementById("licenca");
  const licencaHelper = document.getElementById("licencaHelper");

  if (!form) {
    console.error('Form "#loginForm" não encontrado no DOM.');
    return;
  }

  async function existeEmpresaCadastrada() {
    try {
      const response = await fetch("http://localhost:8080/api/parametrizacao/existeEmpresa", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        return false;
      }

      return !!(await response.json());
    } catch {
      return false;
    }
  }

  function atualizarCampoLicenca({ obrigatoria, mensagem }) {
    const visivel = !!obrigatoria;

    if (licencaFieldWrapper) {
      licencaFieldWrapper.style.display = visivel ? "" : "none";
    }

    if (licencaInput) {
      licencaInput.required = visivel;
      if (!visivel) {
        licencaInput.value = "";
      }
    }

    if (licencaHelper) {
      licencaHelper.textContent = mensagem || "";
    }
  }

  async function carregarStatusLicenca() {
    try {
      const response = await fetch("http://localhost:8080/api/funcionarios/licenca/status", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error("Não foi possível verificar o status da licença.");
      }

      const status = await response.json();
      atualizarCampoLicenca({
        obrigatoria: !!status.chaveObrigatoria,
        mensagem: status.motivo || ""
      });
    } catch (error) {
      atualizarCampoLicenca({
        obrigatoria: true,
        mensagem: error.message || "Não foi possível verificar a licença."
      });
    }
  }

  carregarStatusLicenca();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const acesso = document.getElementById("acesso")?.value?.trim() ?? "";
    const senha = document.getElementById("senha")?.value ?? "";
    const licenca = licencaInput?.value?.trim() ?? "";

    const msg = document.getElementById("msg");
    const err = document.getElementById("error");
    if (msg) msg.textContent = "";
    if (err) err.textContent = "";

    try {
      const loginResponse = await fetch("http://localhost:8080/api/funcionarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ acesso, senha, licenca }).toString()
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        const funcionario = loginData.funcionario;
        localStorage.setItem("funcionarioLogado", JSON.stringify(funcionario));
        localStorage.setItem("authToken", loginData.token || "");

        if (msg) {
          msg.textContent = `Bem-vindo, ${funcionario.funcNome || funcionario.nome || "usuario"}!`;
        }

        const empresaConfigurada = await existeEmpresaCadastrada();
        window.location.href = (!empresaConfigurada && window.vstockSession.isAdministradorMestre(funcionario))
          ? "parametrizacao.html"
          : "index.html";
        return;
      }

      if (loginResponse.status === 401) {
        if (err) err.textContent = "Senha incorreta.";
        return;
      }

      if (loginResponse.status === 403) {
        const errorText = await loginResponse.text();
        if (err) err.textContent = errorText || "Acesso negado.";
        await carregarStatusLicenca();
        return;
      }

      if (loginResponse.status === 404) {
        if (err) err.textContent = "Usuário ou e-mail não encontrado.";
        return;
      }

      const errorText = await loginResponse.text();
      if (err) err.textContent = errorText || "Erro no login.";
    } catch (error) {
      if (err) err.textContent = error.message || "Erro de conexao com o servidor.";
      console.error(error);
    }
  });
});
