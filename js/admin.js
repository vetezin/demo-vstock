const API_ADMIN = {
  LOGS: "http://localhost:8080/api/admin/logs",
  EXPORTAR_LOGS: "http://localhost:8080/api/admin/logs/exportar",
  GERAR_BACKUP: "http://localhost:8080/api/admin/backup/gerar-local"
};

const $admin = (sel) => document.querySelector(sel);

function lerFuncionarioAdmin() {
  try {
    return JSON.parse(localStorage.getItem("funcionarioLogado") || "null");
  } catch (_) {
    return null;
  }
}

function garantirAcessoAdminTela() {
  const funcionario = lerFuncionarioAdmin();
  if (!funcionario || Number(funcionario.tipoAcesso) !== 99) {
    window.location.href = funcionario ? "index.html" : "login.html";
    return false;
  }
  return true;
}

function msgAdmin(texto, tipo = "danger") {
  const box = $admin("#mensagens");
  if (!box) return;

  const div = document.createElement("div");
  div.className = `alert alert-${tipo} alert-dismissible fade show`;
  div.role = "alert";
  div.innerHTML = `
    ${texto}
    <button class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
  `;

  box.innerHTML = "";
  box.appendChild(div);
  window.destacarMensagens?.(box);
}

function formatarDataHoraLog(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function construirQueryLogs() {
  const params = new URLSearchParams();

  const usuario = $admin("#filtroLogUsuario")?.value?.trim() || "";
  const operacao = $admin("#filtroLogOperacao")?.value?.trim() || "";
  const dataInicio = $admin("#filtroLogDataInicio")?.value || "";
  const dataFim = $admin("#filtroLogDataFim")?.value || "";
  const limite = $admin("#filtroLogLimite")?.value || "50";

  if (usuario) params.set("usuario", usuario);
  if (operacao) params.set("operacao", operacao);
  if (dataInicio) params.set("dataInicio", dataInicio);
  if (dataFim) params.set("dataFim", dataFim);
  params.set("limite", limite);

  return params.toString();
}

function renderizarLogs(logs) {
  const tbody = $admin("#tabelaLogsSistema tbody");
  const resumo = $admin("#resumoLogsSistema");
  if (!tbody || !resumo) return;

  if (!Array.isArray(logs) || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">Nenhum log encontrado para os filtros informados.</td>
      </tr>
    `;
    resumo.innerHTML = `<div class="paginacao-cadastro-resumo">Exibindo 0 registros.</div>`;
    return;
  }

  tbody.innerHTML = logs.map((log) => `
    <tr>
      <td>${formatarDataHoraLog(log.createdAt)}</td>
      <td>${log.usuario || "-"}</td>
      <td><span class="admin-operacao-badge">${log.operacao || "-"}</span></td>
      <td class="admin-log-mensagem">${log.mensagem || "-"}</td>
    </tr>
  `).join("");

  resumo.innerHTML = `
    <div class="paginacao-cadastro-resumo">Exibindo ${logs.length} registros conforme os filtros atuais.</div>
  `;
}

async function carregarLogs() {
  try {
    const query = construirQueryLogs();
    const resp = await fetch(`${API_ADMIN.LOGS}?${query}`);
    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao carregar logs do sistema.");
    }

    const logs = await resp.json();
    renderizarLogs(logs);
  } catch (erro) {
    console.error(erro);
    msgAdmin(erro.message || "Nao foi possivel carregar os logs do sistema.", "danger");
  }
}

async function gerarBackupAdmin() {
  try {
    const resp = await fetch(API_ADMIN.GERAR_BACKUP, { method: "POST" });
    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao gerar backup.");
    }

    const resultado = await resp.json();
    msgAdmin(`Backup gerado com sucesso em: ${resultado.caminho}`, "success");
    await carregarLogs();
  } catch (erro) {
    console.error(erro);
    msgAdmin(erro.message || "Nao foi possivel gerar o backup local do banco.", "danger");
  }
}

async function exportarLogsCsv() {
  try {
    const query = construirQueryLogs();
    const resp = await fetch(`${API_ADMIN.EXPORTAR_LOGS}?${query}`);
    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error(erro || "Falha ao exportar logs.");
    }

    const blob = await resp.blob();
    const disposition = resp.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const nomeArquivo = match?.[1] || "logs_vstock.csv";
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    msgAdmin("Exportacao de logs concluida com sucesso.", "success");
  } catch (erro) {
    console.error(erro);
    msgAdmin(erro.message || "Nao foi possivel exportar os logs do sistema.", "danger");
  }
}

function limparFiltrosLogs() {
  $admin("#filtroLogUsuario").value = "";
  $admin("#filtroLogOperacao").value = "";
  $admin("#filtroLogDataInicio").value = "";
  $admin("#filtroLogDataFim").value = "";
  $admin("#filtroLogLimite").value = "50";
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!garantirAcessoAdminTela()) return;

  await carregarLogs();

  $admin("#btnGerarBackupAdmin")?.addEventListener("click", gerarBackupAdmin);
  $admin("#btnFiltrarLogs")?.addEventListener("click", carregarLogs);
  $admin("#btnExportarLogs")?.addEventListener("click", exportarLogsCsv);
  $admin("#btnLimparLogs")?.addEventListener("click", async () => {
    limparFiltrosLogs();
    await carregarLogs();
  });
  $admin("#filtroLogLimite")?.addEventListener("change", carregarLogs);
});
