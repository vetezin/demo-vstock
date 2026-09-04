
(function () {
  const DATA_FILES = {
    categorias: 'mock-data/categorias.json',
    fornecedores: 'mock-data/fornecedores.json',
    funcionarios: 'mock-data/funcionarios.json',
    produtos: 'mock-data/produtos.json',
    compras: 'mock-data/compras.json',
    compraItens: 'mock-data/compra-itens.json',
    saidas: 'mock-data/saidas.json',
    saidaItens: 'mock-data/saida-itens.json',
    logs: 'mock-data/logs.json',
    parametrizacao: 'mock-data/parametrizacao.json',
    clientes: 'mock-data/clientes.json',
    formasPagamento: 'mock-data/formas-pagamento.json',
    vendas: 'mock-data/vendas.json'
  };

  const DB_KEY = 'vstock_demo_db_v2';
  if (!localStorage.getItem('funcionarioLogado')) {
    localStorage.setItem('funcionarioLogado', JSON.stringify({
      funcCpf: '11111111111',
      funcNome: 'Administrador Mestre',
      funcEmail: 'admin@admin.login',
      username: 'adminmaster',
      cargo: 'Administrador Geral',
      tipoAcesso: 99,
      dataDemissao: null
    }));
  }
  if (!localStorage.getItem('authToken')) {
    localStorage.setItem('authToken', 'mock-token-demo');
  }
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  let db = null;
  let dbPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizarCliente(cliente) {
    return clone(cliente);
  }

  function sanitizarFormaPagamento(formaPagamento) {
    return clone(formaPagamento);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  async function loadSeed() {
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => {
      const response = await realFetch(path, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${path}`);
      }
      return [key, await response.json()];
    }));

    const state = Object.fromEntries(entries);
    state.meta = { lastResetAt: nowIso() };
    return state;
  }

  async function ensureDb() {
    if (db) return db;
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
      const persisted = localStorage.getItem(DB_KEY);
      if (persisted) {
        try {
          db = JSON.parse(persisted);
          garantirDadosCaixa();
          garantirDadosMesas();
          garantirDadosOficina();
          return db;
        } catch (_) {
          localStorage.removeItem(DB_KEY);
        }
      }

      db = await loadSeed();
      garantirDadosCaixa();
      garantirDadosMesas();
      garantirDadosOficina();
      persistDb();
      return db;
    })();

    return dbPromise;
  }

  function persistDb() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function garantirDadosCaixa() {
    if (Array.isArray(db.caixaSessoes) && Array.isArray(db.caixaMovimentos)) return;
    const hoje = new Date();
    const iso = (dias, horas, minutos) => {
      const data = new Date(hoje);
      data.setDate(data.getDate() - dias);
      data.setHours(horas, minutos, 0, 0);
      return data.toISOString();
    };
    db.caixaSessoes = [
      { caixaSessaoId: 1001, status: true, dataAbertura: iso(0, 8, 0), dataFechamento: null, usuarioAberturaNome: 'Administrador Mestre', usuarioFechamentoNome: null, saldoInicial: 350, valorContado: null, diferencaValor: null, observacaoAbertura: 'Fundo inicial para atendimento do dia.', observacaoFechamento: null },
      { caixaSessaoId: 1000, status: false, dataAbertura: iso(1, 8, 5), dataFechamento: iso(1, 18, 12), usuarioAberturaNome: 'Juliana Operadora', usuarioFechamentoNome: 'Juliana Operadora', saldoInicial: 300, valorContado: 1248.5, diferencaValor: 0, observacaoAbertura: 'Abertura da loja.', observacaoFechamento: 'Conferência realizada sem divergências.' }
    ];
    db.caixaMovimentos = [
      { movimentoId: 1, caixaSessaoId: 1001, tipo: 'VENDA', valor: 189.9, vendaId: 1008, dataMovimento: iso(0, 9, 15), usuarioNome: 'Administrador Mestre', motivo: 'Venda registrada' },
      { movimentoId: 2, caixaSessaoId: 1001, tipo: 'ENTRADA', valor: 100, dataMovimento: iso(0, 10, 30), usuarioNome: 'Administrador Mestre', motivo: 'Reforço de troco' },
      { movimentoId: 3, caixaSessaoId: 1001, tipo: 'VENDA', valor: 74.5, vendaId: 1009, dataMovimento: iso(0, 11, 5), usuarioNome: 'Administrador Mestre', motivo: 'Venda registrada' },
      { movimentoId: 4, caixaSessaoId: 1000, tipo: 'VENDA', valor: 948.5, vendaId: 1007, dataMovimento: iso(1, 14, 20), usuarioNome: 'Juliana Operadora', motivo: 'Venda registrada' }
    ];
    persistDb();
  }

  function garantirDadosMesas() {
    if (!db.clientes.some((cliente) => String(cliente.nome || '').trim().toLowerCase() === 'consumidor não identificado')) {
      db.clientes.unshift({ clienteId: nextNumericId(db.clientes, 'clienteId'), nome: 'Consumidor não identificado', cpfCnpj: '', telefone: '', observacao: '', ativo: true });
    }
    if (!Array.isArray(db.mesas) || !Array.isArray(db.atendimentosMesas)) {
      db.mesas = Array.from({ length: 10 }, (_, index) => ({
        mesaId: index + 1,
        numero: index + 1,
        titulo: `Mesa ${index + 1}`
      }));
      db.atendimentosMesas = [];
    }
    persistDb();
  }

  function garantirDadosOficina() {
    const cliente = db.clientes[0] || { clienteId: 1, nome: 'Cliente demonstração' };
    const funcionario = db.funcionarios[0] || { funcCpf: '11111111111', funcNome: 'Administrador Mestre' };
    const categoria = db.categorias[0] || { catId: 1, catDescr: 'Serviços gerais' };
    if (!Array.isArray(db.oficinaVeiculos)) db.oficinaVeiculos = [{ veiculoId: 1, clienteId: cliente.clienteId, placa: 'ABC1D23', marca: 'Honda', modelo: 'Civic', anoFabricacao: 2022, cor: 'Prata', observacao: 'Veículo de demonstração', clienteNome: cliente.nome, ativo: true }];
    if (!Array.isArray(db.oficinaServicos)) db.oficinaServicos = [{ servicoId: 1, categoriaId: categoria.catId || categoria.categoriaId || 1, descricao: 'Troca de óleo e filtros', detalhes: 'Óleo sintético e filtro de óleo', valorServico: 180, categoriaDescricao: categoria.catDescr || categoria.descricao || 'Serviços gerais', ativo: true }];
    if (!Array.isArray(db.oficinaOrcamentos)) db.oficinaOrcamentos = [{ orcamentoId: 1001, clienteId: cliente.clienteId, clienteNome: cliente.nome, veiculoId: 1, veiculoDescricao: 'Honda Civic • ABC1D23', funcionarioId: funcionario.funcCpf, funcionarioNome: funcionario.funcNome, diagnostico: 'Revisão preventiva', observacao: 'Demonstração VStock', valorDesconto: 0, valorTotal: 180, status: 'ABERTO', criadoEm: nowIso(), itens: [{ tipo: 'SERVICO', servicoId: 1, descricao: 'Troca de óleo e filtros', quantidade: 1, valorUnitario: 180, subtotal: 180 }] }];
    if (!Array.isArray(db.oficinaOrdensServico)) db.oficinaOrdensServico = [{ ordemServicoId: 2001, orcamentoId: 1001, clienteId: cliente.clienteId, clienteNome: cliente.nome, veiculoId: 1, veiculoDescricao: 'Honda Civic • ABC1D23', funcionarioId: funcionario.funcCpf, funcionarioNome: funcionario.funcNome, status: 'EM_ANDAMENTO', diagnostico: 'Revisão preventiva', observacao: 'OS demonstrativa', criadoEm: nowIso(), iniciadoEm: nowIso(), valorTotal: 180, itens: [{ tipo: 'SERVICO', servicoId: 1, descricao: 'Troca de óleo e filtros', quantidade: 1, valorUnitario: 180, subtotal: 180 }] }];
    persistDb();
  }

  function oficinaVeiculosList(url) {
    let lista = db.oficinaVeiculos.map(v => ({ ...v, clienteNome: db.clientes.find(c => Number(c.clienteId) === Number(v.clienteId))?.nome || v.clienteNome || '-' }));
    if (url.searchParams.get('ativosOnly') === 'true') lista = lista.filter(v => v.ativo !== false);
    const busca = url.searchParams.get('busca'); if (busca) lista = lista.filter(v => contains(`${v.placa} ${v.marca} ${v.modelo} ${v.clienteNome}`, busca));
    return lista;
  }

  function oficinaCatalogo(url) {
    const produtos = buildEstoqueResumo().map(p => ({ tipo: 'PRODUTO', produtoCod: p.prod_cod, descricao: p.prod_descr, valorUnitario: Number(p.valor_unitario || 0), categoriaId: null, categoriaDescricao: 'Produtos', ativo: p.ativo !== false }));
    const servicos = db.oficinaServicos.filter(s => s.ativo !== false).map(s => ({ tipo: 'SERVICO', servicoId: s.servicoId, descricao: s.descricao, detalhes: s.detalhes || '', valorUnitario: Number(s.valorServico || 0), categoriaId: s.categoriaId, categoriaDescricao: s.categoriaDescricao || 'Serviços' }));
    let itens = produtos.concat(servicos); const busca = url.searchParams.get('busca'); if (busca) itens = itens.filter(i => contains(`${i.descricao} ${i.detalhes || ''}`, busca));
    const pagina = Math.max(0, Number(url.searchParams.get('pagina') || 0)); const tamanho = Math.max(1, Number(url.searchParams.get('tamanho') || 20));
    return { itens: itens.slice(pagina * tamanho, (pagina + 1) * tamanho), pagina, tamanho, totalItens: itens.length, totalPaginas: Math.ceil(itens.length / tamanho) };
  }

  function produtoMesa(codigo) {
    return db.produtos.find((produto) => Number(produto.prodCod) === Number(codigo));
  }

  function visualizarAtendimentoMesa(atendimento) {
    const mesa = db.mesas.find((item) => Number(item.mesaId) === Number(atendimento.mesaId));
    return {
      atendimentoMesaId: atendimento.atendimentoMesaId,
      mesaId: atendimento.mesaId,
      numero: mesa?.numero || atendimento.mesaId,
      titulo: mesa?.titulo || `Mesa ${atendimento.mesaId}`,
      clienteId: atendimento.clienteId ?? null,
      abertaEm: atendimento.abertaEm,
      itens: clone(atendimento.itens || [])
    };
  }

  function listarMesasDemo() {
    return db.mesas.map((mesa) => {
      const atendimento = db.atendimentosMesas.find((item) => Number(item.mesaId) === Number(mesa.mesaId));
      const cliente = db.clientes.find((item) => Number(item.clienteId) === Number(atendimento?.clienteId));
      const possuiItens = Boolean(atendimento?.itens?.length);
      return {
        ...mesa,
        atendimentoMesaId: atendimento?.atendimentoMesaId || null,
        clienteId: atendimento?.clienteId ?? null,
        clienteNome: cliente?.nome || '',
        status: atendimento ? (possuiItens ? 'EM_CONSUMO' : 'ABERTA') : 'LIVRE'
      };
    });
  }

  function resumoCaixa(sessao) {
    const movimentos = db.caixaMovimentos.filter((item) => Number(item.caixaSessaoId) === Number(sessao.caixaSessaoId));
    const soma = (tipo) => movimentos.filter((item) => item.tipo === tipo).reduce((total, item) => total + Number(item.valor || 0), 0);
    const vendasLiquidas = soma('VENDA');
    const entradas = soma('ENTRADA');
    const sangrias = soma('SANGRIA');
    return { saldoInicial: Number(sessao.saldoInicial || 0), vendasLiquidas, entradas, sangrias, saldoEsperado: Number(sessao.saldoInicial || 0) + vendasLiquidas + entradas - sangrias, formasPagamento: [{ nome: 'Pix', valorLiquido: vendasLiquidas * 0.62 }, { nome: 'Cartão', valorLiquido: vendasLiquidas * 0.28 }, { nome: 'Dinheiro', valorLiquido: vendasLiquidas * 0.1 }] };
  }

  function parseJsonBody(init) {
    const body = init && typeof init.body === 'string' ? init.body : '';
    return body ? JSON.parse(body) : {};
  }

  function parseFormBody(init) {
    const body = init && typeof init.body === 'string' ? init.body : '';
    return Object.fromEntries(new URLSearchParams(body));
  }

  function getFuncionarioAtual() {
    try {
      return JSON.parse(localStorage.getItem('funcionarioLogado') || 'null');
    } catch (_) {
      return null;
    }
  }

  function funcionarioAtivo(funcionario) {
    return !funcionario.dataDemissao;
  }

  function sanitizarFuncionario(funcionario) {
    const copia = clone(funcionario);
    delete copia.funcSenha;
    return copia;
  }

  function addLog(operacao, mensagem) {
    const usuario = getFuncionarioAtual()?.funcEmail || 'demo@vstock.com';
    db.logs.unshift({ createdAt: nowIso(), usuario, operacao, mensagem });
    persistDb();
  }

  function nextNumericId(items, key) {
    return items.reduce((max, item) => Math.max(max, Number(item[key] || 0)), 0) + 1;
  }

  function contains(haystack, needle) {
    return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
  }

  function sortByDateDesc(items, key) {
    return [...items].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')));
  }

  function maps() {
    return {
      produtos: new Map(db.produtos.map((item) => [Number(item.prodCod), item])),
      fornecedores: new Map(db.fornecedores.map((item) => [Number(item.idFornecedor), item])),
      funcionarios: new Map(db.funcionarios.map((item) => [String(item.funcCpf), item]))
    };
  }

  function buildVendaDetalhe(vendaId) {
    const venda = db.vendas.find((item) => Number(item.vendaId) === Number(vendaId));
    if (!venda) return null;
    const cliente = db.clientes.find((item) => Number(item.clienteId) === Number(venda.clienteId));
    const forma = db.formasPagamento.find((item) => Number(item.formaPagamentoId) === Number(venda.formaPagamentoId));
    const funcionario = db.funcionarios.find((item) => String(item.funcCpf) === String(venda.funcionarioCpf));
    const itens = (venda.itens || []).map((item) => {
      const produto = db.produtos.find((produtoAtual) => Number(produtoAtual.prodCod) === Number(item.produtoCod));
      return { ...item, produtoNome: produto?.prodDescr || `Produto #${item.produtoCod}` };
    });
    return { ...clone(venda), clienteNome: cliente?.nome || 'Consumidor final', formaPagamentoNome: forma?.nome || 'Não informado', vendedorNome: funcionario?.funcNome || 'Equipe de vendas', itens };
  }

  function buildVendasList() {
    return sortByDateDesc(db.vendas.map((venda) => buildVendaDetalhe(venda.vendaId)), 'dataVenda');
  }

  function normalizarVendaStatus(status) {
    return String(status || 'FINALIZADA').trim().toUpperCase();
  }

  function localizarAdministrador(email, senha) {
    return db.funcionarios.find((item) => Number(item.tipoAcesso) === 99 && (String(item.funcEmail).toLowerCase() === String(email || '').toLowerCase() || (String(email || '').toLowerCase() === 'admin@admin' && String(item.funcEmail).toLowerCase() === 'admin@admin.login')) && String(item.funcSenha) === String(senha || ''));
  }

  function removerMovimentacaoVenda(saidaCod) {
    db.caixaMovimentos = (db.caixaMovimentos || []).filter((item) => Number(item.saidaCod) !== Number(saidaCod));
  }

  function buildEstoqueConsulta() {
    const movimentos = [];

    db.compraItens.forEach((item) => {
      const compra = db.compras.find((c) => Number(c.compra_cod) === Number(item.compraCompraCod));
      movimentos.push({
        tipo: 'ENTRADA',
        data: compra?.data_compra || '',
        produtoCod: Number(item.produtoProdCod),
        quantidade: Number(item.quantidade || 0),
        validade: item.validade || null
      });
    });

    db.saidaItens.forEach((item) => {
      const saida = db.saidas.find((s) => Number(s.saida_cod) === Number(item.saidaEstoqueSaidaCod));
      movimentos.push({
        tipo: 'SAIDA',
        data: saida?.data_saida || '',
        produtoCod: Number(item.produtoProdCod),
        quantidade: Number(item.quantidade || 0),
        validade: null
      });
    });

    movimentos.sort((a, b) => String(a.data).localeCompare(String(b.data)) || (a.tipo === 'ENTRADA' ? -1 : 1));

    const saldoPorProduto = new Map(db.produtos.map((produto) => [Number(produto.prodCod), 0]));
    const ultimaMovimentacao = new Map();
    const validadePorProduto = new Map();

    movimentos.forEach((mov) => {
      const saldoAtual = saldoPorProduto.get(mov.produtoCod) || 0;
      const novoSaldo = mov.tipo === 'ENTRADA' ? saldoAtual + mov.quantidade : saldoAtual - mov.quantidade;
      saldoPorProduto.set(mov.produtoCod, novoSaldo);
      ultimaMovimentacao.set(mov.produtoCod, { tipo: mov.tipo, data: mov.data });
      if (mov.tipo === 'ENTRADA' && mov.validade) {
        const atual = validadePorProduto.get(mov.produtoCod);
        if (!atual || String(mov.validade) < String(atual)) validadePorProduto.set(mov.produtoCod, mov.validade);
      }
    });

    return db.produtos.map((produto) => ({
      prod_cod: produto.prodCod,
      prod_descr: produto.prodDescr,
      categoria: produto.categoria?.catDescr || '-',
      saldo_atual: saldoPorProduto.get(Number(produto.prodCod)) || 0,
      proxima_validade: validadePorProduto.get(Number(produto.prodCod)) || null,
      tipo_ultima_movimentacao: ultimaMovimentacao.get(Number(produto.prodCod))?.tipo || '-',
      ultima_movimentacao: ultimaMovimentacao.get(Number(produto.prodCod))?.data || null,
      qtd_min: Number(produto.qtdMin || 0),
      data_cadastro: produto.dataCadastro,
      ativo: produto.ativo !== false,
      codigo_barras: produto.codigoBarras || '',
      valor_unitario: Number(produto.valorUnitario || 0)
    }));
  }

  function buildEstoqueResumo() {
    return buildEstoqueConsulta().map((item) => ({
      prod_cod: item.prod_cod,
      prod_descr: item.prod_descr,
      saldo: item.saldo_atual,
      codigo_barras: item.codigo_barras,
      valor_unitario: item.valor_unitario,
      ativo: item.ativo
    }));
  }

  function buildHistorico() {
    const ref = maps();
    const estoque = new Map(db.produtos.map((produto) => [Number(produto.prodCod), 0]));
    const eventos = [];

    db.compraItens.forEach((item) => {
      const compra = db.compras.find((c) => Number(c.compra_cod) === Number(item.compraCompraCod));
      const produto = ref.produtos.get(Number(item.produtoProdCod));
      const fornecedor = ref.fornecedores.get(Number(compra?.fornecedor_id));
      const funcionario = ref.funcionarios.get(String(compra?.funcionario_func_cpf));
      eventos.push({
        tipo: 'ENTRADA',
        dataMovimentacao: compra?.data_compra || '',
        produtoCod: Number(item.produtoProdCod),
        produto: produto?.prodDescr || '-',
        quantidade: Number(item.quantidade || 0),
        valorUnitario: Number(item.valor || 0),
        valorTotal: Number(item.valor || 0) * Number(item.quantidade || 0),
        fornecedor: fornecedor?.nome || '-',
        funcionario: funcionario?.funcNome || '-',
        motivo: null
      });
    });

    db.saidaItens.forEach((item) => {
      const saida = db.saidas.find((s) => Number(s.saida_cod) === Number(item.saidaEstoqueSaidaCod));
      const produto = ref.produtos.get(Number(item.produtoProdCod));
      const funcionario = ref.funcionarios.get(String(saida?.funcionario_func_cpf));
      eventos.push({
        tipo: 'SAIDA',
        dataMovimentacao: saida?.data_saida || '',
        produtoCod: Number(item.produtoProdCod),
        produto: produto?.prodDescr || '-',
        quantidade: Number(item.quantidade || 0),
        valorUnitario: item.valorUnitarioAplicado == null ? null : Number(item.valorUnitarioAplicado || 0),
        valorTotal: item.valorTotal == null ? null : Number(item.valorTotal || 0),
        fornecedor: '-',
        funcionario: funcionario?.funcNome || '-',
        motivo: item.motivo || ''
      });
    });

    eventos.sort((a, b) => String(a.dataMovimentacao).localeCompare(String(b.dataMovimentacao)) || (a.tipo === 'ENTRADA' ? -1 : 1));

    return eventos.map((evento) => {
      const saldoAntes = estoque.get(evento.produtoCod) || 0;
      const saldoDepois = evento.tipo === 'ENTRADA' ? saldoAntes + evento.quantidade : saldoAntes - evento.quantidade;
      estoque.set(evento.produtoCod, saldoDepois);
      return {
        tipo: evento.tipo,
        dataMovimentacao: evento.dataMovimentacao,
        produto: evento.produto,
        quantidade: evento.quantidade,
        saldoAntes,
        saldoDepois,
        saldoAtual: saldoDepois,
        valorUnitario: evento.valorUnitario,
        valorTotal: evento.valorTotal,
        fornecedor: evento.fornecedor,
        funcionario: evento.funcionario,
        motivo: evento.motivo
      };
    }).sort((a, b) => String(b.dataMovimentacao).localeCompare(String(a.dataMovimentacao)));
  }

  function buildComprasList() {
    const ref = maps();
    return sortByDateDesc(db.compras.map((compra) => {
      const itens = db.compraItens.filter((item) => Number(item.compraCompraCod) === Number(compra.compra_cod));
      const nomes = itens.map((item) => ref.produtos.get(Number(item.produtoProdCod))?.prodDescr || '-');
      return {
        compra_cod: compra.compra_cod,
        produtoResumo: nomes.length <= 1 ? (nomes[0] || '-') : `${nomes[0]} + ${nomes.length - 1} item(ns)`,
        compra_valor_tt: Number(compra.compra_valor_tt || itens.reduce((sum, item) => sum + (Number(item.valor || 0) * Number(item.quantidade || 0)), 0)),
        fornecedor: ref.fornecedores.get(Number(compra.fornecedor_id))?.nome || '-',
        data_compra: compra.data_compra,
        funcionario: ref.funcionarios.get(String(compra.funcionario_func_cpf))?.funcNome || '-',
        fornecedor_id: compra.fornecedor_id,
        funcionario_func_cpf: compra.funcionario_func_cpf
      };
    }), 'data_compra');
  }

  function buildCompraItens(id) {
    const ref = maps();
    const estoqueResumo = new Map(buildEstoqueResumo().map((item) => [Number(item.prod_cod), item.saldo]));
    return db.compraItens.filter((item) => Number(item.compraCompraCod) === Number(id)).map((item) => ({
      produto: ref.produtos.get(Number(item.produtoProdCod))?.prodDescr || '-',
      produto_cod: Number(item.produtoProdCod),
      quantidade: Number(item.quantidade || 0),
      subtotal: Number(item.valor || 0) * Number(item.quantidade || 0),
      estoque: estoqueResumo.get(Number(item.produtoProdCod)) || 0,
      validade: item.validade || null
    }));
  }

  function buildSaidasList() {
    const ref = maps();
    return sortByDateDesc(db.saidas.map((saida) => {
      const itens = db.saidaItens.filter((item) => Number(item.saidaEstoqueSaidaCod) === Number(saida.saida_cod));
      const nomes = itens.map((item) => ref.produtos.get(Number(item.produtoProdCod))?.prodDescr || '-');
      return {
        saida_cod: saida.saida_cod,
        produtoResumo: nomes.length <= 1 ? (nomes[0] || '-') : `${nomes[0]} + ${nomes.length - 1} item(ns)`,
        quantidade_total: itens.reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
        total_venda: itens.reduce((sum, item) => sum + Number(item.valorTotal || 0), 0),
        data_saida: saida.data_saida,
        funcionario: ref.funcionarios.get(String(saida.funcionario_func_cpf))?.funcNome || '-',
        funcionario_func_cpf: saida.funcionario_func_cpf
      };
    }), 'data_saida');
  }

  function buildSaidaItens(id) {
    const ref = maps();
    const estoqueAtual = new Map(buildEstoqueConsulta().map((item) => [Number(item.prod_cod), item.saldo_atual]));
    return db.saidaItens.filter((item) => Number(item.saidaEstoqueSaidaCod) === Number(id)).map((item) => ({
      produto: ref.produtos.get(Number(item.produtoProdCod))?.prodDescr || '-',
      produto_cod: Number(item.produtoProdCod),
      quantidade: Number(item.quantidade || 0),
      saldo_atual: estoqueAtual.get(Number(item.produtoProdCod)) || 0,
      motivo: item.motivo || '',
      valor_unitario_aplicado: item.valorUnitarioAplicado == null ? null : Number(item.valorUnitarioAplicado || 0),
      valor_total: item.valorTotal == null ? null : Number(item.valorTotal || 0),
      observacao: item.observacao || ''
    }));
  }

  function filterByDateRange(lista, campo, url) {
    const inicio = url.searchParams.get('dataInicio');
    const fim = url.searchParams.get('dataFim');
    return lista.filter((item) => {
      const valor = String(item[campo] || '').slice(0, 10);
      if (inicio && valor < inicio) return false;
      if (fim && valor > fim) return false;
      return true;
    });
  }

  function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
  }

  function text(body, status = 200, extraHeaders = {}) {
    return new Response(String(body), { status, headers: extraHeaders });
  }

  async function handleApi(url, init) {
    const method = String(init?.method || 'GET').toUpperCase();
    const path = url.pathname;

    if (path === '/api/funcionarios/licenca/status' && method === 'GET') return json({ licencaAtiva: true, chaveObrigatoria: false, motivo: 'Demonstração estática sem validação de licença.', expiraEm: '2027-12-31' });

    if (path === '/api/funcionarios/login' && method === 'POST') {
      const body = parseFormBody(init);
      const emailInformado = String(body.email || '').trim().toLowerCase();
      const senha = String(body.senha || '');
      const funcionario = db.funcionarios.find((item) => {
        const email = String(item.funcEmail || '').toLowerCase();
        return email === emailInformado || (emailInformado === 'admin@admin' && email === 'admin@admin.login');
      });
      if (!funcionario) return text('Funcionário não encontrado.', 404);
      if (funcionario.funcSenha !== senha) return text('Senha incorreta.', 401);
      if (!funcionarioAtivo(funcionario)) return text('Funcionário inativo na demonstração.', 403);
      addLog('LOGIN', `Acesso de demonstração para ${funcionario.funcNome}.`);
      return json({ token: `mock-token-${funcionario.funcCpf}`, funcionario: sanitizarFuncionario(funcionario) });
    }

    if (path === '/api/funcionarios/all' && method === 'GET') return json(db.funcionarios.map(sanitizarFuncionario));

    if (path === '/api/funcionarios/buscaEmail' && method === 'GET') {
      const email = String(url.searchParams.get('email') || '').toLowerCase();
      const funcionario = db.funcionarios.find((item) => String(item.funcEmail || '').toLowerCase() === email);
      return funcionario ? json(sanitizarFuncionario(funcionario)) : text('Não encontrado', 404);
    }

    const funcionarioStatusMatch = path.match(/^\/api\/funcionarios\/([^\/]+)\/status$/);
    if (funcionarioStatusMatch && method === 'PATCH') {
      const cpf = decodeURIComponent(funcionarioStatusMatch[1]);
      const ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      const funcionario = db.funcionarios.find((item) => String(item.funcCpf) === String(cpf));
      if (!funcionario) return text('Funcionário não encontrado.', 404);
      funcionario.dataDemissao = ativo ? null : todayIso();
      persistDb();
      addLog('FUNCIONARIO_STATUS', `Funcionário ${funcionario.funcNome} ${ativo ? 'reativado' : 'inativado'}.`);
      return text('OK');
    }

    const funcionarioMatch = path.match(/^\/api\/funcionarios\/([^\/]+)$/);
    if (funcionarioMatch && method === 'PUT') {
      const cpf = decodeURIComponent(funcionarioMatch[1]);
      const funcionario = db.funcionarios.find((item) => String(item.funcCpf) === String(cpf));
      if (!funcionario) return text('Funcionário não encontrado.', 404);
      const body = parseJsonBody(init);
      Object.assign(funcionario, {
        funcNome: body.funcNome,
        funcTelefone: body.funcTelefone,
        funcEmail: body.funcEmail,
        username: body.username,
        cargo: body.cargo,
        tipoAcesso: Number(body.tipoAcesso || 1)
      });
      if (body.funcSenha) funcionario.funcSenha = body.funcSenha;
      persistDb();
      addLog('FUNCIONARIO_UPDATE', `Funcionário ${funcionario.funcNome} atualizado.`);
      return text('OK');
    }

    if (path === '/api/funcionarios' && method === 'POST') {
      const body = parseJsonBody(init);
      const novo = {
        funcCpf: String(body.funcCpf || ''),
        funcNome: body.funcNome,
        funcTelefone: body.funcTelefone,
        funcEmail: body.funcEmail,
        username: body.username,
        cargo: body.cargo,
        tipoAcesso: Number(body.tipoAcesso || 1),
        funcSenha: body.funcSenha || '123456',
        dataDemissao: null
      };
      db.funcionarios.unshift(novo);
      persistDb();
      addLog('FUNCIONARIO_INSERT', `Funcionário ${novo.funcNome} cadastrado.`);
      return json(sanitizarFuncionario(novo), 201);
    }

    if (path === '/api/parametrizacao/existeEmpresa' && method === 'GET') return json(!!db.parametrizacao?.email);
    if (path === '/api/parametrizacao/unica' && method === 'GET') return db.parametrizacao ? json(db.parametrizacao) : text('Não encontrada', 404);
    if (path === '/api/parametrizacao' && method === 'GET') {
      const email = String(url.searchParams.get('email') || '').toLowerCase();
      if (!db.parametrizacao) return text('Não encontrada', 404);
      if (!email || String(db.parametrizacao.email || '').toLowerCase() === email) return json(db.parametrizacao);
      return text('Não encontrada', 404);
    }
    if (path === '/api/parametrizacao' && method === 'POST') {
      db.parametrizacao = parseJsonBody(init);
      persistDb();
      addLog('PARAMETRIZACAO_UPDATE', 'Parametrização da demonstração atualizada.');
      return text('Parametrização salva com sucesso.');
    }
    if (path === '/api/modulos/unica' && method === 'GET') {
      return json({
        ...(db.modulos || {}),
        moduloEstoque: true,
        moduloAlertas: true,
        moduloVendas: true,
        moduloFinanceiro: true,
        moduloContasPagar: false,
        moduloContasReceber: false,
      moduloRelatorios: false
      ,moduloOficina: true
      });
    }
    if (path === '/api/modulos' && method === 'POST') {
      db.modulos = { ...(db.modulos || {}), ...parseJsonBody(init) };
      persistDb();
      return json(db.modulos);
    }

    if (path === '/api/categorias-produto' && method === 'GET') {
      let lista = clone(db.categorias);
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') lista = lista.filter((item) => item.ativo !== false);
      return json(lista);
    }
    if (path === '/api/categorias-produto' && method === 'POST') {
      const body = parseJsonBody(init);
      const nova = { catCod: nextNumericId(db.categorias, 'catCod'), catDescr: body.catDescr, ativo: true };
      db.categorias.unshift(nova);
      persistDb();
      addLog('CATEGORIA_INSERT', `Categoria ${nova.catDescr} cadastrada.`);
      return json(nova, 201);
    }
    const categoriaMatch = path.match(/^\/api\/categorias-produto\/(\d+)(?:\/status)?$/);
    if (categoriaMatch && !path.endsWith('/status') && method === 'PUT') {
      const categoria = db.categorias.find((item) => Number(item.catCod) === Number(categoriaMatch[1]));
      if (!categoria) return text('Categoria não encontrada.', 404);
      categoria.catDescr = parseJsonBody(init).catDescr;
      persistDb();
      addLog('CATEGORIA_UPDATE', `Categoria ${categoria.catDescr} atualizada.`);
      return text('OK');
    }
    if (categoriaMatch && path.endsWith('/status') && method === 'PATCH') {
      const categoria = db.categorias.find((item) => Number(item.catCod) === Number(categoriaMatch[1]));
      if (!categoria) return text('Categoria não encontrada.', 404);
      categoria.ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      persistDb();
      addLog('CATEGORIA_STATUS', `Categoria ${categoria.catDescr} ${categoria.ativo ? 'reativada' : 'inativada'}.`);
      return text('OK');
    }

    if (path === '/api/fornecedor/all' && method === 'GET') {
      let lista = clone(db.fornecedores);
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') lista = lista.filter((item) => item.ativo !== false);
      return json(lista);
    }
    if (path === '/api/fornecedor' && method === 'POST') {
      const body = parseJsonBody(init);
      const novo = {
        idFornecedor: nextNumericId(db.fornecedores, 'idFornecedor'),
        nome: body.nome,
        contato: body.contato,
        email: body.email,
        telefone: body.telefone,
        cpfCnpj: body.cpfCnpj || '',
        descricao: body.descricao || '',
        dataCadastro: todayIso(),
        ativo: true
      };
      db.fornecedores.unshift(novo);
      persistDb();
      addLog('FORNECEDOR_INSERT', `Fornecedor ${novo.nome} cadastrado.`);
      return json(novo, 201);
    }
    const fornecedorMatch = path.match(/^\/api\/fornecedor\/(\d+)(?:\/status)?$/);
    if (fornecedorMatch && !path.endsWith('/status') && method === 'PUT') {
      const fornecedor = db.fornecedores.find((item) => Number(item.idFornecedor) === Number(fornecedorMatch[1]));
      if (!fornecedor) return text('Fornecedor não encontrado.', 404);
      Object.assign(fornecedor, parseJsonBody(init));
      persistDb();
      addLog('FORNECEDOR_UPDATE', `Fornecedor ${fornecedor.nome} atualizado.`);
      return text('OK');
    }
    if (fornecedorMatch && path.endsWith('/status') && method === 'PATCH') {
      const fornecedor = db.fornecedores.find((item) => Number(item.idFornecedor) === Number(fornecedorMatch[1]));
      if (!fornecedor) return text('Fornecedor não encontrado.', 404);
      fornecedor.ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      persistDb();
      addLog('FORNECEDOR_STATUS', `Fornecedor ${fornecedor.nome} ${fornecedor.ativo ? 'reativado' : 'inativado'}.`);
      return text('OK');
    }

    if (path === '/api/produtos/lista' && method === 'GET') {
      let lista = clone(db.produtos);
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') lista = lista.filter((item) => item.ativo !== false);
      return json(lista);
    }
    if (path === '/api/produtos' && method === 'POST') {
      const body = parseJsonBody(init);
      const novo = {
        prodCod: nextNumericId(db.produtos, 'prodCod'),
        prodDescr: body.prodDescr,
        qtdMin: Number(body.qtdMin || 0),
        valorUnitario: Number(body.valorUnitario || 0),
        codigoBarras: body.codigoBarras || '',
        dataCadastro: todayIso(),
        ativo: true,
        categoria: clone(body.categoria || { catCod: 0, catDescr: '-' })
      };
      db.produtos.unshift(novo);
      persistDb();
      addLog('PRODUTO_INSERT', `Produto ${novo.prodDescr} cadastrado.`);
      return json(novo, 201);
    }
    const produtoMatch = path.match(/^\/api\/produtos\/(\d+)(?:\/status)?$/);
    if (produtoMatch && !path.endsWith('/status') && method === 'PUT') {
      const produto = db.produtos.find((item) => Number(item.prodCod) === Number(produtoMatch[1]));
      if (!produto) return text('Produto não encontrado.', 404);
      const body = parseJsonBody(init);
      Object.assign(produto, {
        prodDescr: body.prodDescr,
        qtdMin: Number(body.qtdMin || 0),
        valorUnitario: Number(body.valorUnitario || 0),
        codigoBarras: body.codigoBarras || '',
        categoria: clone(body.categoria || produto.categoria)
      });
      persistDb();
      addLog('PRODUTO_UPDATE', `Produto ${produto.prodDescr} atualizado.`);
      return text('OK');
    }
    if (produtoMatch && path.endsWith('/status') && method === 'PATCH') {
      const produto = db.produtos.find((item) => Number(item.prodCod) === Number(produtoMatch[1]));
      if (!produto) return text('Produto não encontrado.', 404);
      produto.ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      persistDb();
      addLog('PRODUTO_STATUS', `Produto ${produto.prodDescr} ${produto.ativo ? 'reativado' : 'inativado'}.`);
      return text('OK');
    }

    if (path === '/api/cliente/all' && method === 'GET') {
      let lista = db.clientes.map(sanitizarCliente);
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') {
        lista = lista.filter((item) => item.ativo !== false);
      }
      return json(lista);
    }
    if (path === '/api/cliente' && method === 'POST') {
      const body = parseJsonBody(init);
      const novo = {
        clienteId: nextNumericId(db.clientes, 'clienteId'),
        nome: body.nome,
        cpfCnpj: body.cpfCnpj || '',
        telefone: body.telefone || '',
        observacao: body.observacao || '',
        createdAt: todayIso(),
        ativo: true
      };
      db.clientes.unshift(novo);
      persistDb();
      addLog('CLIENTE_INSERT', `Cliente ${novo.nome} cadastrado.`);
      return json(sanitizarCliente(novo), 201);
    }
    const clienteMatch = path.match(/^\/api\/cliente\/(\d+)(?:\/status)?$/);
    if (clienteMatch && !path.endsWith('/status') && method === 'PUT') {
      const cliente = db.clientes.find((item) => Number(item.clienteId) === Number(clienteMatch[1]));
      if (!cliente) return text('Cliente não encontrado.', 404);
      const body = parseJsonBody(init);
      Object.assign(cliente, {
        nome: body.nome,
        cpfCnpj: body.cpfCnpj || '',
        telefone: body.telefone || '',
        observacao: body.observacao || ''
      });
      persistDb();
      addLog('CLIENTE_UPDATE', `Cliente ${cliente.nome} atualizado.`);
      return text('OK');
    }
    if (clienteMatch && path.endsWith('/status') && method === 'PATCH') {
      const cliente = db.clientes.find((item) => Number(item.clienteId) === Number(clienteMatch[1]));
      if (!cliente) return text('Cliente não encontrado.', 404);
      cliente.ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      persistDb();
      addLog('CLIENTE_STATUS', `Cliente ${cliente.nome} ${cliente.ativo ? 'reativado' : 'inativado'}.`);
      return text('OK');
    }

    if (path === '/api/forma-pagamento/all' && method === 'GET') {
      let lista = db.formasPagamento.map(sanitizarFormaPagamento);
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') {
        lista = lista.filter((item) => item.ativo !== false);
      }
      return json(lista);
    }
    if (path === '/api/forma-pagamento' && method === 'POST') {
      const body = parseJsonBody(init);
      const novo = {
        formaPagamentoId: nextNumericId(db.formasPagamento, 'formaPagamentoId'),
        nome: body.nome,
        ativo: true
      };
      db.formasPagamento.unshift(novo);
      persistDb();
      addLog('FORMA_PAGAMENTO_INSERT', `Forma de pagamento ${novo.nome} cadastrada.`);
      return json(sanitizarFormaPagamento(novo), 201);
    }
    const formaPagamentoMatch = path.match(/^\/api\/forma-pagamento\/(\d+)(?:\/status)?$/);
    if (formaPagamentoMatch && !path.endsWith('/status') && method === 'PUT') {
      const formaPagamento = db.formasPagamento.find((item) => Number(item.formaPagamentoId) === Number(formaPagamentoMatch[1]));
      if (!formaPagamento) return text('Forma de pagamento não encontrada.', 404);
      formaPagamento.nome = parseJsonBody(init).nome;
      persistDb();
      addLog('FORMA_PAGAMENTO_UPDATE', `Forma de pagamento ${formaPagamento.nome} atualizada.`);
      return text('OK');
    }
    if (formaPagamentoMatch && path.endsWith('/status') && method === 'PATCH') {
      const formaPagamento = db.formasPagamento.find((item) => Number(item.formaPagamentoId) === Number(formaPagamentoMatch[1]));
      if (!formaPagamento) return text('Forma de pagamento não encontrada.', 404);
      formaPagamento.ativo = String(url.searchParams.get('ativo')).toLowerCase() === 'true';
      persistDb();
      addLog('FORMA_PAGAMENTO_STATUS', `Forma de pagamento ${formaPagamento.nome} ${formaPagamento.ativo ? 'reativada' : 'inativada'}.`);
      return text('OK');
    }

    if (path === '/api/vendas' && method === 'GET') {
      let lista = buildVendasList();
      lista = filterByDateRange(lista, 'dataVenda', url);
      const cliente = url.searchParams.get('cliente');
      const formaPagamento = url.searchParams.get('formaPagamento');
      const status = url.searchParams.get('status');
      const vendedor = url.searchParams.get('vendedor');
      if (cliente) lista = lista.filter((item) => contains(item.clienteNome, cliente));
      if (formaPagamento) lista = lista.filter((item) => contains(item.formaPagamentoNome, formaPagamento));
      if (status) lista = lista.filter((item) => normalizarVendaStatus(item.status) === normalizarVendaStatus(status));
      if (vendedor) lista = lista.filter((item) => contains(item.vendedorNome, vendedor));
      return json(lista);
    }

    const vendaMatch = path.match(/^\/api\/vendas\/(\d+)$/);
    if (vendaMatch && method === 'GET') {
      const detalhe = buildVendaDetalhe(Number(vendaMatch[1]));
      return detalhe ? json(detalhe) : text('Venda não encontrada.', 404);
    }

    const vendaAprovacaoMatch = path.match(/^\/api\/vendas\/(\d+)\/cancelamento\/aprovar-admin$/);
    if (vendaAprovacaoMatch && method === 'POST') {
      const venda = buildVendaDetalhe(Number(vendaAprovacaoMatch[1]));
      if (!venda) return text('Venda não encontrada.', 404);
      if (normalizarVendaStatus(venda.status) === 'CANCELADA') return text('Venda ja cancelada.', 400);
      const body = parseJsonBody(init);
      if (!String(body.motivo || '').trim()) return text('Motivo obrigatorio.', 400);
      const administrador = localizarAdministrador(body.email, body.senha);
      if (!administrador) return text('Administrador invalido.', 401);
      return json({ email: administrador.funcEmail, nome: administrador.funcNome });
    }

    const vendaCancelamentoMatch = path.match(/^\/api\/vendas\/(\d+)\/cancelamento$/);
    if (vendaCancelamentoMatch && method === 'POST') {
      const venda = db.vendas.find((item) => Number(item.vendaId) === Number(vendaCancelamentoMatch[1]));
      if (!venda) return text('Venda não encontrada.', 404);
      if (normalizarVendaStatus(venda.status) === 'CANCELADA') return text('Venda ja cancelada.', 400);
      const body = parseJsonBody(init);
      if (!String(body.motivo || '').trim()) return text('Motivo obrigatorio.', 400);
      const administrador = localizarAdministrador(body.email, body.senha);
      if (!administrador) return text('Administrador invalido.', 401);
      venda.status = 'CANCELADA';
      venda.dataCancelamento = nowIso();
      venda.motivoCancelamento = String(body.motivo || '').trim();
      venda.adminCancelamentoEmail = administrador.funcEmail;
      removerMovimentacaoVenda(venda.saidaCod);
      persistDb();
      addLog('VENDA_CANCELADA', `Venda #${venda.vendaId} cancelada por ${administrador.funcEmail}.`);
      return json(buildVendaDetalhe(venda.vendaId));
    }

    if (path === '/api/vendas' && method === 'POST') {
      const body = parseJsonBody(init);
      const itens = Array.isArray(body.itens) ? body.itens : [];
      if (!itens.length) return text('Venda sem itens.', 400);

      const estoqueAtual = new Map(buildEstoqueConsulta().map((item) => [Number(item.prod_cod), Number(item.saldo_atual || 0)]));
      for (const item of itens) {
        const saldo = estoqueAtual.get(Number(item.produtoCod)) || 0;
        if (Number(item.quantidade || 0) > saldo) {
          return text('Estoque insuficiente para concluir a venda.', 400);
        }
      }

      const vendaId = nextNumericId(db.vendas, 'vendaId');
      const saidaCod = nextNumericId(db.saidas, 'saida_cod');
      const venda = {
        vendaId,
        saidaCod,
        dataVenda: body.dataVenda,
        clienteId: body.clienteId == null || body.clienteId === '' ? null : Number(body.clienteId),
        formaPagamentoId: Number(body.formaPagamentoId || 0),
        valorSubtotal: Number(body.valorSubtotal || 0),
        tipoDesconto: body.tipoDesconto || 'NENHUM',
        valorDesconto: Number(body.valorDesconto || 0),
        valorTotal: Number(body.valorTotal || 0),
        valorRecebido: body.valorRecebido == null ? null : Number(body.valorRecebido || 0),
        troco: body.troco == null ? null : Number(body.troco || 0),
        status: normalizarVendaStatus(body.status),
        observacao: body.observacao || '',
        funcionarioCpf: String(body.codFuncionario || ''),
        dataCancelamento: null,
        motivoCancelamento: '',
        adminCancelamentoEmail: '',
        itens: itens.map((item) => ({
          produtoCod: Number(item.produtoCod),
          quantidade: Number(item.quantidade || 0),
          valorUnitario: Number(item.valorUnitario || 0),
          valorSubtotal: Number(item.valorSubtotal || 0)
        }))
      };

      db.vendas.unshift(venda);
      db.saidas.unshift({
        saida_cod: saidaCod,
        data_saida: String(body.dataVenda || '').slice(0, 10),
        funcionario_func_cpf: String(body.codFuncionario || '')
      });

      itens.forEach((item) => {
        db.saidaItens.push({
          saidaEstoqueSaidaCod: saidaCod,
          produtoProdCod: Number(item.produtoCod),
          quantidade: Number(item.quantidade || 0),
          motivo: 'VENDA',
          observacao: body.observacao || '',
          valorUnitarioAplicado: Number(item.valorUnitario || 0),
          valorTotal: Number(item.valorSubtotal || 0)
        });
      });

      persistDb();
      addLog('VENDA_INSERT', `Venda #${vendaId} registrada com ${itens.length} item(ns).`);
      return json(venda, 201);
    }

    if (path === '/api/vendas/dividida' && method === 'POST') {
      const body = parseJsonBody(init);
      const pagamentos = Array.isArray(body.pagamentos) ? body.pagamentos : [];
      if (!pagamentos.length) return text('Informe os pagamentos da venda.', 400);
      const valorTotal = pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0);
      return json({ vendaId: nextNumericId(db.vendas, 'vendaId'), status: 'FINALIZADA', valorTotal, pagamentos }, 201);
    }

    if (path === '/api/estoque/consulta' && method === 'GET') return json(buildEstoqueConsulta());
    if (path === '/api/estoque/resumo' && method === 'GET') {
      let lista = buildEstoqueResumo();
      if (String(url.searchParams.get('ativosOnly')).toLowerCase() === 'true') {
        lista = lista.filter((item) => db.produtos.find((p) => Number(p.prodCod) === Number(item.prod_cod))?.ativo !== false);
      }
      return json(lista);
    }

    if (path === '/api/historico-movimentacoes' && method === 'GET') {
      let lista = buildHistorico();
      lista = filterByDateRange(lista, 'dataMovimentacao', url);
      const tipo = url.searchParams.get('tipo');
      const produto = url.searchParams.get('produto');
      const funcionario = url.searchParams.get('funcionario');
      if (tipo) lista = lista.filter((item) => item.tipo === tipo);
      if (produto) lista = lista.filter((item) => contains(item.produto, produto));
      if (funcionario) lista = lista.filter((item) => contains(item.funcionario, funcionario));
      return json(lista);
    }

    if (path === '/api/compra/listar' && method === 'GET') {
      let lista = buildComprasList();
      lista = filterByDateRange(lista, 'data_compra', url);
      const produto = url.searchParams.get('produto');
      const funcionario = url.searchParams.get('funcionario');
      const valorMinimo = Number(url.searchParams.get('valorMinimo') || 0);
      if (produto) lista = lista.filter((item) => contains(item.produtoResumo, produto));
      if (funcionario) lista = lista.filter((item) => contains(item.funcionario, funcionario));
      if (valorMinimo > 0) lista = lista.filter((item) => Number(item.compra_valor_tt || 0) >= valorMinimo);
      return json(lista);
    }
    if (path === '/api/compra' && method === 'POST') {
      const body = parseJsonBody(init);
      const compraCod = nextNumericId(db.compras, 'compra_cod');
      db.compras.unshift({
        compra_cod: compraCod,
        data_compra: body.dataCompra,
        compra_valor_tt: Number(body.compraValorTt || 0),
        fornecedor_id: Number(body.fornecedorId || 0),
        funcionario_func_cpf: String(body.funcionarioFuncCpf || '')
      });
      persistDb();
      addLog('COMPRA_INSERT', `Entrada #${compraCod} cadastrada.`);
      return text(compraCod, 200, { 'Content-Type': 'text/plain' });
    }
    if (path === '/api/compra/itens' && method === 'POST') {
      const body = parseJsonBody(init);
      db.compraItens.push({
        compraCompraCod: Number(body.compraCompraCod),
        produtoProdCod: Number(body.produtoProdCod),
        valor: Number(body.valor || 0),
        quantidade: Number(body.quantidade || 0),
        validade: url.searchParams.get('validade') || null
      });
      persistDb();
      return text('OK');
    }
    const compraMatch = path.match(/^\/api\/compra\/(\d+)(?:\/itens)?$/);
    if (compraMatch && path.endsWith('/itens') && method === 'GET') return json(buildCompraItens(Number(compraMatch[1])));
    if (compraMatch && !path.endsWith('/itens') && method === 'PUT') {
      const id = Number(compraMatch[1]);
      const body = parseJsonBody(init);
      const compra = db.compras.find((item) => Number(item.compra_cod) === id);
      if (!compra) return text('Entrada não encontrada.', 404);
      Object.assign(compra, {
        data_compra: body.dataCompra,
        fornecedor_id: Number(body.fornecedorId || 0),
        funcionario_func_cpf: String(body.funcionarioFuncCpf || '')
      });
      db.compraItens = db.compraItens.filter((item) => Number(item.compraCompraCod) !== id);
      (body.itens || []).forEach((item) => db.compraItens.push({
        compraCompraCod: id,
        produtoProdCod: Number(item.produtoProdCod),
        valor: Number(item.valor || 0),
        quantidade: Number(item.quantidade || 0),
        validade: item.validade || null
      }));
      compra.compra_valor_tt = (body.itens || []).reduce((sum, item) => sum + (Number(item.valor || 0) * Number(item.quantidade || 0)), 0);
      persistDb();
      addLog('COMPRA_UPDATE', `Entrada #${id} atualizada.`);
      return text('OK');
    }

    if (path === '/api/saida-estoque/listar' && method === 'GET') {
      let lista = buildSaidasList();
      lista = filterByDateRange(lista, 'data_saida', url);
      const produto = url.searchParams.get('produto');
      const funcionario = url.searchParams.get('funcionario');
      if (produto) lista = lista.filter((item) => contains(item.produtoResumo, produto));
      if (funcionario) lista = lista.filter((item) => contains(item.funcionario, funcionario));
      return json(lista);
    }
    if (path === '/api/saida-estoque' && method === 'POST') {
      const body = parseJsonBody(init);
      const saidaCod = nextNumericId(db.saidas, 'saida_cod');
      db.saidas.unshift({
        saida_cod: saidaCod,
        data_saida: body.dataSaida,
        funcionario_func_cpf: String(body.funcionarioFuncCpf || '')
      });
      (body.itens || []).forEach((item) => db.saidaItens.push({
        saidaEstoqueSaidaCod: saidaCod,
        produtoProdCod: Number(item.produtoProdCod),
        quantidade: Number(item.quantidade || 0),
        motivo: item.motivo || '',
        observacao: item.observacao || '',
        valorUnitarioAplicado: item.valorUnitarioAplicado == null ? null : Number(item.valorUnitarioAplicado || 0),
        valorTotal: item.valorTotal == null ? null : Number(item.valorTotal || 0)
      }));
      persistDb();
      addLog('SAIDA_INSERT', `Saída #${saidaCod} cadastrada.`);
      return text('OK');
    }
    const saidaMatch = path.match(/^\/api\/saida-estoque\/(\d+)(?:\/itens)?$/);
    if (saidaMatch && path.endsWith('/itens') && method === 'GET') return json(buildSaidaItens(Number(saidaMatch[1])));
    if (saidaMatch && !path.endsWith('/itens') && method === 'PUT') {
      const id = Number(saidaMatch[1]);
      const body = parseJsonBody(init);
      const saida = db.saidas.find((item) => Number(item.saida_cod) === id);
      if (!saida) return text('Saída não encontrada.', 404);
      Object.assign(saida, {
        data_saida: body.dataSaida,
        funcionario_func_cpf: String(body.funcionarioFuncCpf || '')
      });
      db.saidaItens = db.saidaItens.filter((item) => Number(item.saidaEstoqueSaidaCod) !== id);
      (body.itens || []).forEach((item) => db.saidaItens.push({
        saidaEstoqueSaidaCod: id,
        produtoProdCod: Number(item.produtoProdCod),
        quantidade: Number(item.quantidade || 0),
        motivo: item.motivo || '',
        observacao: item.observacao || '',
        valorUnitarioAplicado: item.valorUnitarioAplicado == null ? null : Number(item.valorUnitarioAplicado || 0),
        valorTotal: item.valorTotal == null ? null : Number(item.valorTotal || 0)
      }));
      persistDb();
      addLog('SAIDA_UPDATE', `Saída #${id} atualizada.`);
      return text('OK');
    }

    if (path === '/api/oficina/veiculos' && method === 'GET') return json(oficinaVeiculosList(url));
    if (path === '/api/oficina/veiculos' && (method === 'POST' || method === 'PUT')) {
      const body = parseJsonBody(init); const id = body.veiculoId || nextNumericId(db.oficinaVeiculos, 'veiculoId');
      const item = { veiculoId: Number(id), clienteId: Number(body.clienteId), placa: String(body.placa || '').toUpperCase(), marca: body.marca || '', modelo: body.modelo || '', anoFabricacao: body.anoFabricacao || null, cor: body.cor || '', observacao: body.observacao || '', ativo: body.ativo !== false };
      const idx = db.oficinaVeiculos.findIndex(v => Number(v.veiculoId) === Number(id)); if (idx >= 0) db.oficinaVeiculos[idx] = { ...db.oficinaVeiculos[idx], ...item }; else db.oficinaVeiculos.unshift(item); persistDb(); return json(item, idx >= 0 ? 200 : 201);
    }
    const veiculoMatch = path.match(/^\/api\/oficina\/veiculos\/(\d+)$/); if (veiculoMatch && method === 'PATCH') { const v = db.oficinaVeiculos.find(x => Number(x.veiculoId) === Number(veiculoMatch[1])); if (!v) return text('Veículo não encontrado.', 404); v.ativo = parseJsonBody(init).ativo !== false; persistDb(); return json(v); }

    if (path === '/api/oficina/servicos' && method === 'GET') return json(db.oficinaServicos);
    if (path === '/api/oficina/servicos' && (method === 'POST' || method === 'PUT')) { const body = parseJsonBody(init); const id = body.servicoId || nextNumericId(db.oficinaServicos, 'servicoId'); const item = { servicoId: Number(id), categoriaId: Number(body.categoriaId || 1), descricao: body.descricao || '', detalhes: body.detalhes || '', valorServico: Number(body.valorServico || 0), categoriaDescricao: body.categoriaDescricao || 'Serviços gerais', ativo: body.ativo !== false }; const idx = db.oficinaServicos.findIndex(s => Number(s.servicoId) === Number(id)); if (idx >= 0) db.oficinaServicos[idx] = { ...db.oficinaServicos[idx], ...item }; else db.oficinaServicos.unshift(item); persistDb(); return json(item, idx >= 0 ? 200 : 201); }
    const servicoMatch = path.match(/^\/api\/oficina\/servicos\/(\d+)$/); if (servicoMatch && method === 'PATCH') { const s = db.oficinaServicos.find(x => Number(x.servicoId) === Number(servicoMatch[1])); if (!s) return text('Serviço não encontrado.', 404); s.ativo = parseJsonBody(init).ativo !== false; persistDb(); return json(s); }
    if (path === '/api/oficina/orcamentos/catalogo-itens' && method === 'GET') return json(oficinaCatalogo(url));
    if (path === '/api/oficina/orcamentos' && method === 'GET') return json(db.oficinaOrcamentos);
    if (path === '/api/oficina/orcamentos' && method === 'POST') { const body = parseJsonBody(init); const id = nextNumericId(db.oficinaOrcamentos, 'orcamentoId'); const itens = Array.isArray(body.itens) ? body.itens.map(i => ({ ...i, quantidade: Number(i.quantidade || 1), valorUnitario: Number(i.valorUnitario || 0), subtotal: Number(i.subtotal || i.valorUnitario || 0) })) : []; const item = { orcamentoId: id, ...body, clienteId: Number(body.clienteId), veiculoId: Number(body.veiculoId), valorTotal: itens.reduce((s, i) => s + Number(i.subtotal || 0), 0) - Number(body.valorDesconto || 0), status: 'ABERTO', criadoEm: nowIso(), itens }; db.oficinaOrcamentos.unshift(item); persistDb(); return json(item, 201); }
    const orcamentoMatch = path.match(/^\/api\/oficina\/orcamentos\/(\d+)(?:\/(aprovar|cancelar))?$/); if (orcamentoMatch) { const o = db.oficinaOrcamentos.find(x => Number(x.orcamentoId) === Number(orcamentoMatch[1])); if (!o) return text('Orçamento não encontrado.', 404); if (method === 'GET') return json(o); if (method === 'PATCH') { o.status = orcamentoMatch[2] === 'aprovar' ? 'APROVADO' : 'CANCELADO'; persistDb(); return json(o); } }
    if (path === '/api/oficina/ordens-servico' && method === 'GET') return json(db.oficinaOrdensServico);
    const osMatch = path.match(/^\/api\/oficina\/ordens-servico\/(\d+)(?:\/(iniciar|finalizar|cancelar))?$/); if (osMatch) { const os = db.oficinaOrdensServico.find(x => Number(x.ordemServicoId) === Number(osMatch[1])); if (!os) return text('Ordem de serviço não encontrada.', 404); if (method === 'GET') return json(os); if (method === 'PUT') { Object.assign(os, parseJsonBody(init)); persistDb(); return json(os); } if (method === 'PATCH') { os.status = ({ iniciar: 'EM_ANDAMENTO', finalizar: 'FINALIZADA', cancelar: 'CANCELADA' })[osMatch[2]] || os.status; persistDb(); return json(os); } }

    if (path === '/api/mesas' && method === 'GET') {
      return json(listarMesasDemo());
    }
    if (path === '/api/mesas/ativar-proxima' && method === 'POST') {
      const mesa = {
        mesaId: nextNumericId(db.mesas, 'mesaId'),
        numero: nextNumericId(db.mesas, 'numero'),
        titulo: `Mesa ${nextNumericId(db.mesas, 'numero')}`
      };
      db.mesas.push(mesa);
      persistDb();
      return json(mesa, 201);
    }
    if (path === '/api/mesas/ocultar-ultima' && method === 'POST') {
      const ultima = [...db.mesas].sort((a, b) => Number(b.numero) - Number(a.numero)).find((mesa) => Number(mesa.numero) > 10);
      if (!ultima) return text('Não há mesa adicional para ocultar.', 400);
      if (db.atendimentosMesas.some((item) => Number(item.mesaId) === Number(ultima.mesaId))) return text('A mesa precisa estar livre.', 409);
      db.mesas = db.mesas.filter((mesa) => Number(mesa.mesaId) !== Number(ultima.mesaId));
      persistDb();
      return json(ultima);
    }
    const abrirMesaMatch = path.match(/^\/api\/mesas\/(\d+)\/atendimento$/);
    if (abrirMesaMatch && method === 'POST') {
      const mesaId = Number(abrirMesaMatch[1]);
      if (!db.mesas.some((mesa) => Number(mesa.mesaId) === mesaId)) return text('Mesa não encontrada.', 404);
      if (db.atendimentosMesas.some((item) => Number(item.mesaId) === mesaId)) return text('Mesa já está aberta.', 409);
      const body = parseJsonBody(init);
      const itens = (body.itens || []).map((item, index) => {
        const produto = produtoMesa(item.produtoCod);
        const precoUnitario = Number(produto?.valorUnitario || 0);
        return {
          id: index + 1,
          produtoCod: Number(item.produtoCod),
          produtoNome: produto?.prodDescr || 'Produto',
          quantidade: Number(item.quantidade || 0),
          precoUnitario,
          subtotal: Number((precoUnitario * Number(item.quantidade || 0)).toFixed(2)),
          status: 'ATIVO'
        };
      });
      const atendimento = {
        atendimentoMesaId: nextNumericId(db.atendimentosMesas, 'atendimentoMesaId'),
        mesaId,
        clienteId: body.clienteId == null || body.clienteId === '' ? null : Number(body.clienteId),
        abertaEm: nowIso(),
        itens
      };
      db.atendimentosMesas.push(atendimento);
      persistDb();
      return json(visualizarAtendimentoMesa(atendimento), 201);
    }
    const atendimentoMesaMatch = path.match(/^\/api\/mesas\/atendimentos\/(\d+)(?:\/(fechar|cliente|itens))?$/);
    if (atendimentoMesaMatch) {
      const atendimento = db.atendimentosMesas.find((item) => Number(item.atendimentoMesaId) === Number(atendimentoMesaMatch[1]));
      if (!atendimento) return text('Atendimento não encontrado.', 404);
      const acao = atendimentoMesaMatch[2] || '';
      if (!acao && method === 'GET') return json(visualizarAtendimentoMesa(atendimento));
      if (!acao && method === 'PUT') {
        const body = parseJsonBody(init);
        atendimento.clienteId = body.clienteId == null || body.clienteId === '' ? null : Number(body.clienteId);
        atendimento.itens = (body.itens || []).map((item, index) => {
          const produto = produtoMesa(item.produtoCod);
          const precoUnitario = Number(item.precoUnitario ?? produto?.valorUnitario ?? 0);
          const quantidade = Number(item.quantidade || 0);
          return { id: item.id || index + 1, produtoCod: Number(item.produtoCod), produtoNome: produto?.prodDescr || item.produtoNome || 'Produto', quantidade, precoUnitario, subtotal: Number((precoUnitario * quantidade).toFixed(2)), status: 'ATIVO' };
        });
        persistDb();
        return json(visualizarAtendimentoMesa(atendimento));
      }
      if (!acao && method === 'DELETE') {
        db.atendimentosMesas = db.atendimentosMesas.filter((item) => Number(item.atendimentoMesaId) !== Number(atendimento.atendimentoMesaId));
        persistDb();
        return new Response(null, { status: 204 });
      }
      if (acao === 'fechar' && method === 'POST') {
        db.atendimentosMesas = db.atendimentosMesas.filter((item) => Number(item.atendimentoMesaId) !== Number(atendimento.atendimentoMesaId));
        persistDb();
        addLog('MESA_FECHADA', `Mesa ${atendimento.mesaId} fechada na demonstração.`);
        return json({ status: 'FINALIZADA' });
      }
    }

    if (path === '/api/caixa/sessao/aberta' && method === 'GET') {
      const sessao = db.caixaSessoes.find((item) => item.status);
      return sessao ? json(sessao) : new Response(null, { status: 204 });
    }
    if (path === '/api/caixa/sessao/historico' && method === 'GET') {
      let lista = sortByDateDesc(db.caixaSessoes, 'dataAbertura');
      const operador = url.searchParams.get('operador');
      const status = url.searchParams.get('situacao');
      if (operador) lista = lista.filter((item) => contains(item.usuarioAberturaNome, operador));
      if (status === 'aberta') lista = lista.filter((item) => item.status);
      if (status === 'fechada') lista = lista.filter((item) => !item.status);
      return json(lista);
    }
    const sessaoCaixaMatch = path.match(/^\/api\/caixa\/sessao\/(\d+)$/);
    if (sessaoCaixaMatch && method === 'GET') {
      const sessao = db.caixaSessoes.find((item) => Number(item.caixaSessaoId) === Number(sessaoCaixaMatch[1]));
      if (!sessao) return text('Sessão de caixa não encontrada.', 404);
      return json({ sessao, resumo: resumoCaixa(sessao), movimentos: db.caixaMovimentos.filter((item) => Number(item.caixaSessaoId) === Number(sessao.caixaSessaoId)) });
    }
    if (path === '/api/caixa/sessao/abertura' && method === 'POST') {
      if (db.caixaSessoes.some((item) => item.status)) return text('Já existe um caixa aberto.', 409);
      const body = parseJsonBody(init);
      const funcionario = getFuncionarioAtual();
      const sessao = { caixaSessaoId: nextNumericId(db.caixaSessoes, 'caixaSessaoId'), status: true, dataAbertura: nowIso(), dataFechamento: null, usuarioAberturaNome: funcionario?.funcNome || 'Administrador Mestre', usuarioFechamentoNome: null, saldoInicial: Number(body.saldoInicial || 0), valorContado: null, diferencaValor: null, observacaoAbertura: body.observacaoAbertura || null, observacaoFechamento: null };
      db.caixaSessoes.unshift(sessao); persistDb(); addLog('CAIXA_ABERTO', `Caixa #${sessao.caixaSessaoId} aberto.`); return json(sessao);
    }
    if (path === '/api/caixa/movimentos' && method === 'GET') {
      const sessao = db.caixaSessoes.find((item) => item.status);
      return json(sessao ? db.caixaMovimentos.filter((item) => Number(item.caixaSessaoId) === Number(sessao.caixaSessaoId)) : []);
    }
    if (path === '/api/caixa/movimentos' && method === 'POST') {
      const sessao = db.caixaSessoes.find((item) => item.status);
      if (!sessao) return text('Abra o caixa antes de registrar movimentos.', 409);
      const body = parseJsonBody(init); const funcionario = getFuncionarioAtual();
      const movimento = { movimentoId: nextNumericId(db.caixaMovimentos, 'movimentoId'), caixaSessaoId: sessao.caixaSessaoId, tipo: body.tipo || 'ENTRADA', valor: Number(body.valor || 0), vendaId: null, dataMovimento: nowIso(), usuarioNome: funcionario?.funcNome || 'Administrador Mestre', motivo: body.motivo || '', observacao: body.observacao || null };
      db.caixaMovimentos.unshift(movimento); persistDb(); addLog('CAIXA_MOVIMENTO', `Movimento de caixa registrado: ${movimento.tipo}.`); return json(movimento);
    }
    if (path === '/api/caixa/resumo' && method === 'GET') {
      const sessao = db.caixaSessoes.find((item) => item.status);
      return json(sessao ? resumoCaixa(sessao) : { saldoInicial: 0, vendasLiquidas: 0, entradas: 0, sangrias: 0, saldoEsperado: 0, formasPagamento: [] });
    }
    if (path === '/api/caixa/sessao/fechamento' && method === 'POST') {
      const sessao = db.caixaSessoes.find((item) => item.status);
      if (!sessao) return text('Nenhum caixa aberto.', 409);
      const body = parseJsonBody(init); const resumo = resumoCaixa(sessao); const contado = Number(body.valorContado || 0); const funcionario = getFuncionarioAtual();
      Object.assign(sessao, { status: false, dataFechamento: nowIso(), usuarioFechamentoNome: funcionario?.funcNome || 'Administrador Mestre', valorContado: contado, diferencaValor: contado - resumo.saldoEsperado, observacaoFechamento: body.observacaoFechamento || null });
      persistDb(); addLog('CAIXA_FECHADO', `Caixa #${sessao.caixaSessaoId} fechado.`); return json(sessao);
    }

    if (path === '/api/admin/logs' && method === 'GET') {
      let lista = sortByDateDesc(db.logs, 'createdAt');
      const usuario = url.searchParams.get('usuario');
      const operacao = url.searchParams.get('operacao');
      const limite = Number(url.searchParams.get('limite') || 50);
      const dataInicio = url.searchParams.get('dataInicio');
      const dataFim = url.searchParams.get('dataFim');
      if (usuario) lista = lista.filter((item) => contains(item.usuario, usuario));
      if (operacao) lista = lista.filter((item) => contains(item.operacao, operacao));
      if (dataInicio) lista = lista.filter((item) => String(item.createdAt).slice(0, 10) >= dataInicio);
      if (dataFim) lista = lista.filter((item) => String(item.createdAt).slice(0, 10) <= dataFim);
      return json(lista.slice(0, limite));
    }
    if (path === '/api/admin/backup/gerar-local' && method === 'POST') {
      const nome = `backup_demo_${nowIso().replace(/[:T]/g, '-').slice(0, 19)}.sql`;
      addLog('BACKUP_GERADO', `Backup demonstrativo gerado em C:/BackupEstoque/automaticos/${nome}.`);
      return json({ caminho: `C:/BackupEstoque/automaticos/${nome}` });
    }
    if (path === '/api/admin/logs/exportar' && method === 'GET') {
      const lista = sortByDateDesc(db.logs, 'createdAt');
      const linhas = ['createdAt;usuario;operacao;mensagem'].concat(lista.map((item) => [item.createdAt, item.usuario, item.operacao, String(item.mensagem || '').replace(/;/g, ',')].join(';')));
      return new Response(linhas.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="logs_vstock_demo.csv"'
        }
      });
    }

    return text(`Rota mock não implementada: ${method} ${path}`, 404);
  }

  window.fetch = async function (input, init) {
    const candidate = typeof input === 'string' ? input : input.url;
    const url = new URL(candidate, window.location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    await ensureDb();
    return handleApi(url, init || {});
  };

  window.VStockDemo = {
    async reset() {
      localStorage.removeItem(DB_KEY);
      db = null;
      dbPromise = null;
      await ensureDb();
      window.location.reload();
    }
  };
})();





