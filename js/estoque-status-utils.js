(function () {
  function calcularStatusEstoque(item) {
    const saldo = Number(item.saldo_atual || 0);
    const qtdMin = Number(item.qtd_min || 0);
    const validade = item.proxima_validade ? new Date(`${String(item.proxima_validade).split("T")[0]}T00:00:00`) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (saldo <= 0) {
      return { chave: "SEM_ESTOQUE", label: "Sem estoque", classe: "status-sem" };
    }

    if (validade) {
      const diffDias = Math.floor((validade - hoje) / 86400000);
      if (diffDias < 0) {
        return { chave: "VENCIDO", label: "Vencido", classe: "status-vencido" };
      }
      if (diffDias <= 7) {
        return { chave: "VENCENDO", label: "Vencendo", classe: "status-vencendo" };
      }
    }

    if (saldo > 0 && saldo <= qtdMin) {
      return { chave: "BAIXO_ESTOQUE", label: "Baixo estoque", classe: "status-baixo" };
    }

    return { chave: "EM_ESTOQUE", label: "Em estoque", classe: "status-ok" };
  }

  function contarItensEmAtencao(lista) {
    return (lista || []).filter((item) => calcularStatusEstoque(item).chave !== "EM_ESTOQUE").length;
  }

  window.calcularStatusEstoque = calcularStatusEstoque;
  window.contarItensEmAtencao = contarItensEmAtencao;
})();
