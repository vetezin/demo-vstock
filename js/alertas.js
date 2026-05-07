const API_ALERTAS = {
  CONSULTA: "http://localhost:8080/api/estoque/consulta"
};

const $alerta = (sel) => document.querySelector(sel);
let listaAlertas = [];

function fmtDataAlerta(valor) {
  if (!valor) return "-";
  const apenasData = String(valor).split("T")[0];
  const partes = apenasData.split("-");
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }
  return valor;
}

function renderizarAlertas() {
  const tbody = $alerta("#tabelaAlertas tbody");
  const vazio = $alerta("#estadoVazioAlertas");
  if (!tbody || !vazio) return;

  const lista = listaAlertas.filter((item) => window.calcularStatusEstoque(item).chave !== "EM_ESTOQUE");
  $alerta("#qtdAlertasResumo").textContent = lista.length;

  if (!lista.length) {
    tbody.innerHTML = "";
    vazio.classList.remove("d-none");
    return;
  }

  vazio.classList.add("d-none");
  tbody.innerHTML = lista.map((item) => {
    const status = window.calcularStatusEstoque(item);
    return `
      <tr>
        <td>${item.prod_cod}</td>
        <td>${item.prod_descr || "-"}</td>
        <td>${item.categoria || "-"}</td>
        <td class="text-end">${Number(item.saldo_atual || 0)}</td>
        <td>${fmtDataAlerta(item.proxima_validade)}</td>
        <td><span class="status-badge-estoque ${status.classe}">${status.label}</span></td>
        <td class="text-center">
          <a class="btn btn-sm btn-outline-secondary" href="historico.html?produto=${encodeURIComponent(item.prod_descr || "")}">
            <i class="bi bi-clock-history"></i> Movimentações
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

async function carregarAlertas() {
  const resp = await fetch(API_ALERTAS.CONSULTA);
  if (!resp.ok) {
    throw new Error("Falha ao carregar alertas.");
  }

  listaAlertas = await resp.json();
  renderizarAlertas();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await carregarAlertas();
  } catch (erro) {
    console.error(erro);
  }
});

