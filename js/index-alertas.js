const API_INDEX_ALERTAS = {
  CONSULTA: "http://localhost:8080/api/estoque/consulta"
};

document.addEventListener("DOMContentLoaded", async () => {
  const card = document.getElementById("avisoAlertasDashboard");
  const texto = document.getElementById("textoAlertasDashboard");
  const badge = document.getElementById("badgeAlertasDashboard");
  if (!card || !texto || !badge || typeof window.calcularStatusEstoque !== "function") return;

  try {
    const resp = await fetch(API_INDEX_ALERTAS.CONSULTA);
    if (!resp.ok) return;

    const lista = await resp.json();
    const total = window.contarItensEmAtencao(lista);

    if (total <= 0) {
      card.classList.add("d-none");
      return;
    }

    badge.textContent = total;
    texto.textContent = `Existem ${total} produtos em atencao no estoque.`;
    card.classList.remove("d-none");
  } catch (erro) {
    console.error(erro);
  }
});
