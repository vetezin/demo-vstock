// principal.js
// Responsabilidades:
// - carregar a identidade visual global da empresa
// - carregar o logotipo da empresa quando houver container na pagina
// - manter a navegacao principal coerente entre as telas

(function configurarSegurancaFrontend() {
  const originalFetch = window.fetch.bind(window);
  const publicApiPaths = new Set([
    '/api/funcionarios/login',
    '/api/funcionarios/licenca/status',
    '/api/parametrizacao/existeEmpresa',
    '/api/parametrizacao/unica'
  ]);

  function paginaAtualNome() {
    return (window.location.pathname.split('/').pop() || '').toLowerCase();
  }

  function paginaEhPublica() {
    return paginaAtualNome() === 'login.html';
  }

  function limparSessao() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('funcionarioLogado');
  }

  window.vstockFrontendSecurity = {
    limparSessao,
    paginaAtualNome,
    paginaEhPublica
  };

  function ehRequisicaoApi(url) {
    try {
      const resolved = new URL(url, window.location.origin);
      return resolved.pathname.startsWith('/api/');
    } catch (_) {
      return false;
    }
  }

  function caminhoApi(url) {
    return new URL(url, window.location.origin).pathname;
  }

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url;
    if (!url || !ehRequisicaoApi(url)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    const token = localStorage.getItem('authToken') || '';
    const path = caminhoApi(url);

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await originalFetch(input, {
      ...init,
      headers
    });

    return response;
  };
})();

window.destacarMensagens = function (elemento) {
  if (!elemento) {
    return;
  }

  requestAnimationFrame(function () {
    elemento.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  });
};

window.destacarFormularioEdicao = function (formularioOuContainer, primeiroCampo) {
  if (!formularioOuContainer) {
    return;
  }

  var container = formularioOuContainer.closest
    ? (formularioOuContainer.closest('.card, .simple-card, .page-header') || formularioOuContainer)
    : formularioOuContainer;

  requestAnimationFrame(function () {
    container.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    var campo = primeiroCampo;
    if (typeof primeiroCampo === 'string') {
      campo = document.querySelector(primeiroCampo);
    }

    if (campo && typeof campo.focus === 'function') {
      window.setTimeout(function () {
        campo.focus({ preventScroll: true });
        if (typeof campo.select === 'function' && !campo.hasAttribute('readonly')) {
          campo.select();
        }
      }, 220);
    }
  });
};

window.vstockMasks = {
  onlyDigits: function (valor, limite) {
    var digits = String(valor || '').replace(/\D/g, '');
    if (!limite || limite < 1) {
      return digits;
    }
    return digits.slice(0, limite);
  },

  cpf: function (valor) {
    var numeros = this.onlyDigits(valor, 11);
    if (numeros.length <= 3) {
      return numeros;
    }
    if (numeros.length <= 6) {
      return numeros.slice(0, 3) + '.' + numeros.slice(3);
    }
    if (numeros.length <= 9) {
      return numeros.slice(0, 3) + '.' + numeros.slice(3, 6) + '.' + numeros.slice(6);
    }
    return numeros.slice(0, 3) + '.' + numeros.slice(3, 6) + '.' + numeros.slice(6, 9) + '-' + numeros.slice(9);
  },

  cnpj: function (valor) {
    var numeros = this.onlyDigits(valor, 14);
    if (numeros.length <= 2) {
      return numeros;
    }
    if (numeros.length <= 5) {
      return numeros.slice(0, 2) + '.' + numeros.slice(2);
    }
    if (numeros.length <= 8) {
      return numeros.slice(0, 2) + '.' + numeros.slice(2, 5) + '.' + numeros.slice(5);
    }
    if (numeros.length <= 12) {
      return numeros.slice(0, 2) + '.' + numeros.slice(2, 5) + '.' + numeros.slice(5, 8) + '/' + numeros.slice(8);
    }
    return numeros.slice(0, 2) + '.' + numeros.slice(2, 5) + '.' + numeros.slice(5, 8) + '/' + numeros.slice(8, 12) + '-' + numeros.slice(12);
  },

  cpfCnpj: function (valor) {
    var numeros = this.onlyDigits(valor, 14);
    return numeros.length <= 11 ? this.cpf(numeros) : this.cnpj(numeros);
  },

  phone: function (valor) {
    var numeros = this.onlyDigits(valor, 11);
    if (numeros.length <= 2) {
      return numeros ? '(' + numeros : '';
    }
    if (numeros.length <= 6) {
      return '(' + numeros.slice(0, 2) + ')' + numeros.slice(2);
    }
    if (numeros.length <= 10) {
      return '(' + numeros.slice(0, 2) + ')' + numeros.slice(2, 6) + '-' + numeros.slice(6);
    }
    return '(' + numeros.slice(0, 2) + ')' + numeros.slice(2, 7) + '-' + numeros.slice(7);
  }
};

window.vstockCurrency = {
  formatInputValue: function (valor) {
    var digits = String(valor || '').replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    var cents = digits.padStart(3, '0');
    var integerPart = cents.slice(0, -2).replace(/^0+(?=\d)/, '');
    var decimalPart = cents.slice(-2);
    var formattedInteger = (integerPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return formattedInteger + ',' + decimalPart;
  },

  formatNumber: function (valor) {
    var numero = Number(valor || 0);
    if (!Number.isFinite(numero)) {
      return '';
    }

    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatMoney: function (valor) {
    var numero = Number(valor || 0);
    if (!Number.isFinite(numero)) {
      return '';
    }

    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },

  parse: function (valor) {
    var texto = String(valor || '').trim();
    if (!texto) {
      return 0;
    }

    var normalizado = texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    var numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  },

  attachMask: function (elemento) {
    if (!elemento || elemento.dataset.currencyMaskBound === 'true') {
      return;
    }

    elemento.dataset.currencyMaskBound = 'true';
    elemento.setAttribute('inputmode', 'numeric');
    elemento.setAttribute('autocomplete', 'off');

    elemento.addEventListener('input', function () {
      this.value = window.vstockCurrency.formatInputValue(this.value);
    });

    elemento.addEventListener('blur', function () {
      this.value = window.vstockCurrency.formatInputValue(this.value);
    });

    if (elemento.value) {
      elemento.value = window.vstockCurrency.formatInputValue(elemento.value);
    }
  }
};

window.vstockSession = {
  getFuncionario: function () {
    try {
      var salvo = JSON.parse(localStorage.getItem('funcionarioLogado') || 'null');
      return salvo || {
        funcCpf: '11111111111',
        funcNome: 'Administrador Mestre',
        funcEmail: 'admin@admin.login',
        username: 'adminmaster',
        cargo: 'Administrador Geral',
        tipoAcesso: 99,
        dataDemissao: null
      };
    } catch (erro) {
      console.warn('Não foi possível ler o funcionário logado:', erro);
      return null;
    }
  },

  isAdministrador: function (funcionario) {
    return Number(funcionario?.tipoAcesso) === 99;
  },

  isAdministradorMestre: function (funcionario) {
    var email = String(funcionario?.funcEmail || funcionario?.email || '').trim().toLowerCase();
    return this.isAdministrador(funcionario) && (email === 'admin@admin' || email === 'admin@admin.login');
  }
};

window.vstockFormatters = {
  date: function (valor) {
    if (!valor) {
      return '-';
    }

    if (valor instanceof Date) {
      if (Number.isNaN(valor.getTime())) {
        return '-';
      }
      return valor.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
      });
    }

    var texto = String(valor).trim();
    if (!texto) {
      return '-';
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      return texto;
    }

    var apenasData = texto.split('T')[0];
    var partes = apenasData.split('-');
    if (partes.length === 3) {
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    var data = new Date(texto);
    if (Number.isNaN(data.getTime())) {
      return texto;
    }

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    }).format(data);
  },

  dateTime: function (valor, config) {
    if (!valor) {
      return '-';
    }

    var data = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(data.getTime())) {
      return config?.preserveInvalid ? String(valor) : '-';
    }

    var options = config?.options || {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return data.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      ...options
    });
  },

  integer: function (valor) {
    var numero = Number(valor || 0);
    if (!Number.isFinite(numero)) {
      numero = 0;
    }

    return numero.toLocaleString('pt-BR');
  },

  quantity: function (valor, singular, plural) {
    var quantidade = Number(valor || 0);
    if (!Number.isFinite(quantidade)) {
      quantidade = 0;
    }

    var singularLabel = singular || 'unidade';
    var pluralLabel = plural || 'unidades';
    return quantidade + ' ' + (quantidade === 1 ? singularLabel : pluralLabel);
  },

  todayIso: function () {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  },

  nowInputLocal: function () {
    var data = new Date();
    var ajustada = new Date(data.getTime() - (data.getTimezoneOffset() * 60000));
    return ajustada.toISOString().slice(0, 16);
  }
};

window.vstockText = {
  normalize: function (valor) {
    return String(valor || '').trim().toLowerCase();
  },

  normalizeCode: function (valor) {
    return String(valor || '').trim();
  }
};

window.vstockProducts = {
  summarizeItems: function (itens, campo) {
    if (!Array.isArray(itens) || !itens.length) {
      return '-';
    }

    var nomeCampo = campo || 'produto';
    var nomes = itens
      .map(function (item) {
        return item?.[nomeCampo] || '-';
      })
      .filter(Boolean);

    if (nomes.length === 1) {
      return nomes[0];
    }

    return nomes[0] + ' + ' + (nomes.length - 1) + ' item(ns)';
  },

  findByBarcode: function (lista, codigo, campo) {
    var codigoNormalizado = window.vstockText.normalizeCode(codigo);
    if (!codigoNormalizado) {
      return null;
    }

    var nomeCampo = campo || 'codigo_barras';
    return (Array.isArray(lista) ? lista : []).find(function (item) {
      return window.vstockText.normalizeCode(item?.[nomeCampo]) === codigoNormalizado;
    }) || null;
  }
};

window.vstockSales = {
  formatStatus: function (valor) {
    var status = String(valor || '').trim().toUpperCase();
    var mapa = {
      FINALIZADA: 'Finalizada',
      ABERTA: 'Aberta',
      CANCELADA: 'Cancelada',
      PARCIALMENTE_DEVOLVIDA: 'Parcialmente devolvida',
      DEVOLVIDA: 'Devolvida'
    };

    return mapa[status] || (valor || '-');
  },

  statusClass: function (valor) {
    var status = String(valor || '').trim().toUpperCase();
    if (status === 'PARCIALMENTE_DEVOLVIDA') {
      return 'parcialmente-devolvida';
    }

    return (status || 'finalizada').toLowerCase();
  }
};

window.vstockUi = {
  createAlertHandler: function (defaultConfig) {
    var baseConfig = defaultConfig || {};

    return function (message, type) {
      return window.vstockUi.showAlert({
        ...baseConfig,
        message: message,
        type: type || baseConfig.type || 'danger'
      });
    };
  },

  showAlert: function (config) {
    if (!config) {
      return null;
    }

    var container = typeof config.container === 'string'
      ? document.querySelector(config.container)
      : config.container;

    if (!container) {
      return null;
    }

    if (config.clear === true) {
      container.innerHTML = '';
    }

    var tipo = config.type || 'danger';
    var div = document.createElement('div');
    div.className = 'alert alert-' + tipo + ' alert-dismissible fade show';
    div.role = 'alert';
    div.innerHTML = '\n      ' + (config.message || '') + '\n      <button class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>\n    ';

    container.appendChild(div);

    if (config.scroll !== false) {
      window.destacarMensagens?.(container);
    }

    var autoRemoveMs = Number(config.autoRemoveMs || 0);
    if (autoRemoveMs > 0) {
      window.setTimeout(function () {
        div.remove();
      }, autoRemoveMs);
    }

    return div;
  },

  badgeStatus: function (ativo) {
    return ativo
      ? '<span class="badge text-bg-success">Ativo</span>'
      : '<span class="badge text-bg-secondary">Inativo</span>';
  }
};

window.vstockFilterDropdown = (function () {
  var instances = [];
  var closeHandlerBound = false;

  function normalizarTexto(valor) {
    return String(valor || '').trim().toLowerCase();
  }

  function normalizarOpcoes(lista) {
    var vistos = new Set();
    return (Array.isArray(lista) ? lista : [])
      .map(function (item) {
        return String(item || '').trim();
      })
      .filter(function (item) {
        if (!item) {
          return false;
        }

        var chave = normalizarTexto(item);
        if (vistos.has(chave)) {
          return false;
        }

        vistos.add(chave);
        return true;
      })
      .sort(function (a, b) {
        return a.localeCompare(b, 'pt-BR');
      });
  }

  function garantirEstrutura(input) {
    var grupo = input.closest('.vstock-filter-dropdown-group');
    if (!grupo) {
      grupo = document.createElement('div');
      grupo.className = 'vstock-filter-dropdown-group';
      input.parentNode.insertBefore(grupo, input);
      grupo.appendChild(input);
    }

    var addon = grupo.querySelector('.vstock-filter-dropdown-addon');
    if (!addon) {
      addon = document.createElement('span');
      addon.className = 'vstock-filter-dropdown-addon';
      addon.innerHTML = '<i class="bi bi-search"></i>';
      grupo.appendChild(addon);
    }

    var dropdown = grupo.querySelector('.vstock-filter-dropdown-menu');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'vstock-filter-dropdown-menu';
      grupo.appendChild(dropdown);
    }

    input.setAttribute('autocomplete', 'off');
    input.classList.add('vstock-filter-dropdown-input');

    return {
      group: grupo,
      dropdown: dropdown
    };
  }

  function fecharTodos(exceto) {
    instances.forEach(function (instance) {
      if (instance !== exceto) {
        instance.dropdown.classList.remove('ativo');
      }
    });
  }

  function obterOpcoesFiltradas(instance) {
    var opcoes = normalizarOpcoes(instance.getOptions());
    var termo = normalizarTexto(instance.input.value);

    if (!termo) {
      return opcoes;
    }

    return opcoes.filter(function (item) {
      return normalizarTexto(item).includes(termo);
    });
  }

  function renderizar(instance, aberto) {
    var opcoes = obterOpcoesFiltradas(instance);
    instance.dropdown.innerHTML = '';

    if (!opcoes.length) {
      var vazio = document.createElement('button');
      vazio.type = 'button';
      vazio.disabled = true;
      vazio.className = 'vstock-filter-dropdown-item vazio';
      vazio.textContent = instance.emptyText || 'Nenhuma opção encontrada';
      instance.dropdown.appendChild(vazio);
      instance.dropdown.classList.toggle('ativo', aberto);
      return;
    }

    var selecionado = normalizarTexto(instance.input.value);

    opcoes.forEach(function (item) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'vstock-filter-dropdown-item';
      if (normalizarTexto(item) === selecionado) {
        botao.classList.add('ativo');
      }
      botao.dataset.value = item;
      botao.textContent = item;
      instance.dropdown.appendChild(botao);
    });

    instance.dropdown.classList.toggle('ativo', aberto);
  }

  function bindCloseHandler() {
    if (closeHandlerBound) {
      return;
    }

    closeHandlerBound = true;
    document.addEventListener('click', function (event) {
      var grupo = event.target.closest('.vstock-filter-dropdown-group');
      if (!grupo) {
        fecharTodos();
      }
    });
  }

  function attach(config) {
    if (!config) {
      return null;
    }

    var input = typeof config.input === 'string'
      ? document.querySelector(config.input)
      : config.input;

    if (!input || input.dataset.vstockFilterDropdownBound === 'true') {
      return input || null;
    }

    var estrutura = garantirEstrutura(input);
    var instance = {
      input: input,
      dropdown: estrutura.dropdown,
      getOptions: typeof config.getOptions === 'function' ? config.getOptions : function () { return []; },
      onInputValueChange: typeof config.onInputValueChange === 'function' ? config.onInputValueChange : null,
      onOptionSelect: typeof config.onOptionSelect === 'function' ? config.onOptionSelect : null,
      emptyText: config.emptyText || 'Nenhuma opção encontrada'
    };

    input.dataset.vstockFilterDropdownBound = 'true';
    instances.push(instance);
    bindCloseHandler();

    input.addEventListener('focus', function () {
      fecharTodos(instance);
      renderizar(instance, true);
    });

    input.addEventListener('input', function () {
      fecharTodos(instance);
      renderizar(instance, true);
      if (instance.onInputValueChange) {
        instance.onInputValueChange(input.value);
      }
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        instance.dropdown.classList.remove('ativo');
      }
    });

    instance.dropdown.addEventListener('click', function (event) {
      var botao = event.target.closest('[data-value]');
      if (!botao) {
        return;
      }

      input.value = botao.dataset.value || '';
      renderizar(instance, false);
      if (instance.onOptionSelect) {
        instance.onOptionSelect(input.value);
      } else if (instance.onInputValueChange) {
        instance.onInputValueChange(input.value);
      }
    });

    return instance;
  }

  return {
    attach: attach,
    closeAll: fecharTodos,
    normalizeOptions: normalizarOpcoes
  };
})();

window.vstockPagination = {
  paginate: function (items, page, pageSize) {
    var lista = Array.isArray(items) ? items : [];
    var tamanho = Math.max(Number(pageSize) || 1, 1);
    var totalItems = lista.length;
    var totalPages = Math.max(Math.ceil(totalItems / tamanho), 1);
    var currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    var startIndex = (currentPage - 1) * tamanho;
    var endIndex = Math.min(startIndex + tamanho, totalItems);

    return {
      items: lista.slice(startIndex, endIndex),
      page: currentPage,
      pageSize: tamanho,
      totalItems: totalItems,
      totalPages: totalPages,
      startIndex: totalItems === 0 ? 0 : startIndex,
      endIndex: endIndex
    };
  },

  render: function (config) {
    if (!config) {
      return;
    }

    var container = typeof config.container === 'string'
      ? document.querySelector(config.container)
      : config.container;

    if (!container) {
      return;
    }

    var variant = config.variant === 'cadastro' ? 'cadastro' : 'listagem';
    var summaryClass = 'paginacao-' + variant + '-resumo';
    var buttonsClass = 'paginacao-' + variant + '-botoes';
    var totalItems = Math.max(Number(config.totalItems) || 0, 0);
    var pageSize = Math.max(Number(config.pageSize) || 1, 1);
    var totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
    var currentPage = Math.min(Math.max(Number(config.page) || 1, 1), totalPages);
    var start = totalItems === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
    var end = Math.min(currentPage * pageSize, totalItems);
    var itemLabel = config.itemLabel || 'itens';
    var prefix = config.idPrefix || 'Padrao';

    container.innerHTML = `
      <div class="${summaryClass}">
        Exibindo ${start}-${end} de ${totalItems} ${itemLabel}
      </div>
      <div class="${buttonsClass}">
        <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaAnterior${prefix}" ${currentPage === 1 ? 'disabled' : ''}>
          <i class="bi bi-chevron-left"></i> Anterior
        </button>
        <span class="${summaryClass}">Pagina ${currentPage} de ${totalPages}</span>
        <button type="button" class="btn btn-outline-secondary btn-sm" id="btnPaginaProxima${prefix}" ${currentPage === totalPages || totalItems === 0 ? 'disabled' : ''}>
          Proxima <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    `;

    var onPageChange = typeof config.onPageChange === 'function' ? config.onPageChange : null;
    if (!onPageChange) {
      return;
    }

    container.querySelector('#btnPaginaAnterior' + prefix)?.addEventListener('click', function () {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    });

    container.querySelector('#btnPaginaProxima' + prefix)?.addEventListener('click', function () {
      if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', async function () {
  var LOGO_PADRAO_SISTEMA = 'assets/branding/logo-sistema-vstock.png';
  var paginaAtual = window.vstockFrontendSecurity.paginaAtualNome();
  var LICENCA_STATUS_URL = 'http://localhost:8080/api/funcionarios/licenca/status';
  var SIDEBAR_SCROLL_KEY = 'vstockSidebarScrollTop';
  var SIDEBAR_GROUPS_KEY = 'vstockSidebarGroupsState';
  var statusLicencaAtual = null;

  if (paginaAtual === 'login.html') {
    window.location.href = 'index.html';
    return;
  }

  function redirecionarParaLoginPorLicenca(mensagem) {
    window.vstockFrontendSecurity.limparSessao();
    if (mensagem) {
      alert(mensagem);
    }
    window.location.href = 'login.html';
  }

  async function verificarLicencaDaPaginaAtual() {
    if (window.vstockFrontendSecurity.paginaEhPublica()) {
      return true;
    }

    try {
      const response = await fetch(LICENCA_STATUS_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Falha ao consultar status da licença.');
      }

      const status = await response.json();
      if (status && status.licencaAtiva === true) {
        statusLicencaAtual = status;
        return true;
      }

      const mensagem = (status && status.motivo)
        ? status.motivo
        : 'Sua licença não está ativa. Faça uma nova liberação para continuar.';
      redirecionarParaLoginPorLicenca(mensagem);
      return false;
    } catch (erro) {
      console.error('Erro ao verificar licença da página:', erro);
      redirecionarParaLoginPorLicenca('Não foi possível validar a licença desta sessão. Faça login novamente.');
      return false;
    }
  }

  if (!(await verificarLicencaDaPaginaAtual())) {
    return;
  }

  var currentDate = document.getElementById('current-date');
  if (currentDate) {
    currentDate.textContent = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
  }

  document.querySelectorAll('[data-alert-message]').forEach(function (element) {
    element.addEventListener('click', function () {
      alert(element.getAttribute('data-alert-message'));
    });
  });

  function normalizarHex(valor, fallback) {
    const base = (valor || '').trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(base) ? base : fallback;
  }

  function hexToRgb(hex) {
    const limpo = hex.replace('#', '');
    return {
      r: parseInt(limpo.substring(0, 2), 16),
      g: parseInt(limpo.substring(2, 4), 16),
      b: parseInt(limpo.substring(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const valor = [r, g, b]
      .map(function (item) {
        return Math.max(0, Math.min(255, item)).toString(16).padStart(2, '0');
      })
      .join('');
    return '#' + valor.toUpperCase();
  }

  function mixHex(hexA, hexB, ratio) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(
      Math.round(a.r + (b.r - a.r) * ratio),
      Math.round(a.g + (b.g - a.g) * ratio),
      Math.round(a.b + (b.b - a.b) * ratio)
    );
  }

  function aplicarTema(empresa) {
    if (!empresa) {
      return;
    }

    const primaria = normalizarHex(empresa.corPrimaria, '#0F6A73');
    const secundaria = normalizarHex(empresa.corSecundaria, '#094C55');
    const destaque = normalizarHex(empresa.corDestaque, '#74AED6');
    const primariaSoft = mixHex(primaria, '#FFFFFF', 0.76);
    const superficieAlt = mixHex(destaque, '#FFFFFF', 0.84);
    const linha = mixHex(primaria, '#FFFFFF', 0.80);
    const primariaRgb = hexToRgb(primaria);
    const secundariaRgb = hexToRgb(secundaria);
    const destaqueRgb = hexToRgb(destaque);

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', primaria);
    root.style.setProperty('--brand-primary-dark', secundaria);
    root.style.setProperty('--brand-primary-rgb', primariaRgb.r + ', ' + primariaRgb.g + ', ' + primariaRgb.b);
    root.style.setProperty('--brand-primary-dark-rgb', secundariaRgb.r + ', ' + secundariaRgb.g + ', ' + secundariaRgb.b);
    root.style.setProperty('--brand-primary-soft', primariaSoft);
    root.style.setProperty('--brand-accent', destaque);
    root.style.setProperty('--brand-accent-rgb', destaqueRgb.r + ', ' + destaqueRgb.g + ', ' + destaqueRgb.b);
    root.style.setProperty('--brand-surface-alt', superficieAlt);
    root.style.setProperty('--brand-line', linha);
  }

  async function carregarEmpresaUnica() {
    try {
      const response = await fetch('http://localhost:8080/api/parametrizacao/unica', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (err) {
      console.warn('Erro ao carregar a parametrização global:', err);
      return null;
    }
  }

  function normalizarModulos(empresa) {
      return {
        estoque: empresa ? empresa.moduloEstoque !== false : true,
        alertas: empresa ? empresa.moduloAlertas !== false : true,
        vendas: empresa ? empresa.moduloVendas === true : false
      };
    }

  function obterLogoSistema(empresa) {
    var logoBanco = empresa && (empresa.logotipoBig || empresa.logotipoSmall);
    return (typeof logoBanco === 'string' && logoBanco.trim()) ? logoBanco : LOGO_PADRAO_SISTEMA;
  }

  function aplicarLogoNavbar(srcLogo) {
    var logos = document.querySelectorAll('img.logo');
    for (var i = 0; i < logos.length; i++) {
      logos[i].src = srcLogo;
      logos[i].setAttribute('data-logo-dinamica', 'true');
      logos[i].addEventListener('error', function () {
        if (this.src.indexOf(LOGO_PADRAO_SISTEMA) === -1) {
          this.src = LOGO_PADRAO_SISTEMA;
        }
      }, { once: true });
    }
  }

  function simplificarBrandingNavbar() {
    var marcas = document.querySelectorAll('.navbar-brand');
    for (var i = 0; i < marcas.length; i++) {
      var marca = marcas[i];
      marca.classList.add('navbar-brand-minimal');
      marca.setAttribute('aria-label', 'VStock');
    }
  }

  function renderizarLogo(logoContainer, logoBig) {
    if (!logoContainer || typeof logoBig !== 'string' || !logoBig.trim()) {
      return;
    }

    var img = document.createElement('img');
    img.src = logoBig;
    img.alt = 'Logo da Empresa';
    img.classList.add('logo-dinamica');

    logoContainer.innerHTML = '';
    logoContainer.appendChild(img);
  }

  function obterTituloPaginaTopo() {
    var tituloPagina = document.querySelector('.page-header h1, .page-header h2, .page-title h1, .page-title h2');
    if (tituloPagina) {
      return tituloPagina.textContent.trim();
    }

    var base = String(document.title || '').split('|')[0].trim();
    return base || 'Painel operacional';
  }

  function obterDescricaoPaginaTopo() {
    var descricao = document.querySelector('.page-header p, .page-title p, .page-subtitle');
    return descricao ? descricao.textContent.trim() : '';
  }

  function normalizarLayoutAplicacao() {
    if (paginaAtual === 'login.html' || paginaAtual === 'index.html') {
      return;
    }

    document.body.classList.add('app-shell');

    var mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      mainContainer.classList.add('app-layout');
    }

    var content = document.querySelector('.content');
    if (content) {
      content.classList.add('page-content');
    }

    var navbar = document.querySelector('.brand-navbar');
    if (!navbar) {
      return;
    }

    navbar.classList.add('app-topbar');

    var container = navbar.querySelector('.container-fluid');
    if (!container) {
      return;
    }

    var brand = container.querySelector('.navbar-brand');
    if (!brand) {
      return;
    }

    var actions = null;
    for (var i = 0; i < container.children.length; i++) {
      if (container.children[i] !== brand) {
        actions = container.children[i];
        break;
      }
    }

    if (!actions) {
      actions = document.createElement('div');
      container.appendChild(actions);
    }

    actions.classList.add('app-topbar-actions');

    var main = container.querySelector('.app-topbar-main');
    if (!main) {
      main = document.createElement('div');
      main.className = 'app-topbar-main';
      container.appendChild(main);
    }

    var intro = main.querySelector('.app-topbar-page-intro');
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'app-topbar-page-intro';
      intro.innerHTML = '<h1 class="app-topbar-title"></h1><p class="app-topbar-subtitle"></p>';
      main.appendChild(intro);
    }

    var titulo = intro.querySelector('.app-topbar-title');
    if (titulo) {
      titulo.textContent = obterTituloPaginaTopo();
    }

    var subtitulo = intro.querySelector('.app-topbar-subtitle');
    if (subtitulo) {
      subtitulo.textContent = '';
      subtitulo.style.display = 'none';
    }

    if (actions.parentNode !== main) {
      main.appendChild(actions);
    }
  }

  const empresa = await carregarEmpresaUnica();
  const modulos = normalizarModulos(empresa);
  aplicarTema(empresa);
  aplicarLogoNavbar(obterLogoSistema(empresa));
  simplificarBrandingNavbar();
  normalizarLayoutAplicacao();

  var logoContainer = document.getElementById('logoEmpresa');
  if (empresa && logoContainer) {
    renderizarLogo(logoContainer, obterLogoSistema(empresa));
  }

  var funcionario = window.vstockSession.getFuncionario();
  var usuarioLogado = document.getElementById('usuario-logado');
  var usuarioCargo = document.getElementById('usuario-cargo');
  var btnSair = document.getElementById('btnSairSistema');
  var topoDireitaBase = document.querySelector('.app-topbar-actions') || document.querySelector('.navbar .text-end') || document.querySelector('.brand-navbar .text-end') || document.querySelector('.navbar .text-white');
  var blocoTopoSistema = null;

  function formatarDataLicenca(valor) {
    if (!valor) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      var partes = valor.split('-');
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    return valor;
  }

  function obterResumoLicenca(status) {
    if (!status || status.licencaAtiva !== true) {
      return 'Licença pendente';
    }

    var expiraEm = formatarDataLicenca(status.expiraEm);
    return expiraEm ? ('Licença válida até: ' + expiraEm) : 'Licença ativa';
  }

  function obterNomeFuncionario(item) {
    return item?.funcNome || item?.nome || 'Operador';
  }

  function obterCargoFuncionario(item) {
    var cargo = String(item?.cargo || item?.funcCargo || '').trim();
    if (cargo) {
      return cargo;
    }

    return Number(item?.tipoAcesso) === 99 ? 'Administrador' : 'Operador';
  }

  function obterIniciaisFuncionario(nome) {
    var base = String(nome || 'Operador').trim().split(/\s+/).filter(Boolean);
    if (!base.length) {
      return 'OP';
    }

    if (base.length === 1) {
      return base[0].slice(0, 2).toUpperCase();
    }

    return (base[0][0] + base[base.length - 1][0]).toUpperCase();
  }

  function atualizarResumoContaNavbar(item) {
    var nome = obterNomeFuncionario(item);
    var cargo = obterCargoFuncionario(item);
    var iniciais = obterIniciaisFuncionario(nome);

    var nomeEl = document.getElementById('usuario-logado');
    if (nomeEl) {
      nomeEl.textContent = nome;
    }

    var cargoEl = document.getElementById('usuario-cargo');
    if (cargoEl) {
      cargoEl.textContent = cargo;
    }

    var nomeMenuEl = document.getElementById('usuario-logado-menu');
    if (nomeMenuEl) {
      nomeMenuEl.textContent = nome;
    }

    var cargoMenuEl = document.getElementById('usuario-cargo-menu');
    if (cargoMenuEl) {
      cargoMenuEl.textContent = cargo;
    }

    var iniciaisEl = document.getElementById('navbarAccountInitials');
    if (iniciaisEl) {
      iniciaisEl.textContent = iniciais;
    }

    var iniciaisMenuEl = document.getElementById('navbarAccountInitialsMenu');
    if (iniciaisMenuEl) {
      iniciaisMenuEl.textContent = iniciais;
    }
  }

  function garantirEstruturaTopoSistema() {
    if (!topoDireitaBase || paginaAtual === 'login.html') {
      return null;
    }

    var existente = document.getElementById('navbar-system-meta');
    if (existente) {
      return existente;
    }

    var dataOriginal = document.querySelector('.navbar-date');

    var wrapper = document.createElement('div');
    wrapper.id = 'navbar-system-meta';
    wrapper.className = 'navbar-system-meta';
    wrapper.innerHTML = `
      <div class="navbar-account-menu" id="navbarAccountMenu">
        <button type="button" class="navbar-account-toggle" id="navbarAccountToggle" aria-expanded="false" aria-haspopup="true">
          <span class="navbar-account-avatar" id="navbarAccountInitials">OP</span>
          <span class="navbar-account-summary">
            <span class="navbar-account-name" id="usuario-logado">Operador</span>
            <span class="navbar-account-role" id="usuario-cargo">Operador</span>
          </span>
          <i class="bi bi-chevron-down navbar-account-chevron" aria-hidden="true"></i>
        </button>
        <div class="navbar-account-dropdown" id="navbarAccountDropdown" hidden>
          <div class="navbar-account-section">
            <span class="navbar-account-section-label">Minha conta</span>
            <div class="navbar-account-card">
              <span class="navbar-account-avatar navbar-account-avatar-static" id="navbarAccountInitialsMenu">OP</span>
              <div class="navbar-account-card-copy">
                <strong id="usuario-logado-menu">Operador</strong>
                <span id="usuario-cargo-menu">Operador</span>
              </div>
            </div>
          </div>
          <div class="navbar-account-section">
            <div id="navbarLicenseStatusSlot"></div>
          </div>
          <div class="navbar-account-section navbar-account-section-actions">
            <button type="button" class="btn navbar-logout-btn" id="btnSairSistema">
              <i class="bi bi-box-arrow-right"></i>
              Sair
            </button>
          </div>
        </div>
      </div>
    `;

    topoDireitaBase.innerHTML = '';
    topoDireitaBase.appendChild(wrapper);

    usuarioLogado = document.getElementById('usuario-logado');
    usuarioCargo = document.getElementById('usuario-cargo');
    btnSair = document.getElementById('btnSairSistema');
    atualizarResumoContaNavbar(funcionario);

    var toggle = document.getElementById('navbarAccountToggle');
    var dropdown = document.getElementById('navbarAccountDropdown');
    var menu = document.getElementById('navbarAccountMenu');

    function fecharMenuConta() {
      if (!menu || !dropdown || !toggle) {
        return;
      }

      menu.classList.remove('is-open');
      dropdown.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    function abrirMenuConta() {
      if (!menu || !dropdown || !toggle) {
        return;
      }

      menu.classList.add('is-open');
      dropdown.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }

    if (toggle && dropdown && menu) {
      toggle.addEventListener('click', function (event) {
        event.stopPropagation();
        if (menu.classList.contains('is-open')) {
          fecharMenuConta();
        } else {
          abrirMenuConta();
        }
      });

      document.addEventListener('click', function (event) {
        if (!menu.contains(event.target)) {
          fecharMenuConta();
        }
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          fecharMenuConta();
        }
      });
    }

    return wrapper;
  }

  function renderizarStatusLicencaNavbar() {
    blocoTopoSistema = garantirEstruturaTopoSistema();
    if (!blocoTopoSistema) {
      return;
    }

    var slot = document.getElementById('navbarLicenseStatusSlot');
    if (!slot) {
      return;
    }

    var existente = document.getElementById('navbar-license-status');
    if (!statusLicencaAtual || statusLicencaAtual.licencaAtiva !== true) {
      if (existente) {
        existente.remove();
      }
      return;
    }

    if (!existente) {
      existente = document.createElement('div');
      existente.id = 'navbar-license-status';
      existente.className = 'navbar-license-status';
      slot.appendChild(existente);
    }

    existente.innerHTML = '<i class="bi bi-patch-check"></i><span>' + obterResumoLicenca(statusLicencaAtual) + '</span>';
  }

  function fazerLogout() {
    window.vstockFrontendSecurity.limparSessao();
    window.location.href = 'index.html';
  }

  if (paginaAtual !== 'login.html') {
    blocoTopoSistema = garantirEstruturaTopoSistema();
  }

  atualizarResumoContaNavbar(funcionario);

  if (btnSair) {
    btnSair.addEventListener('click', fazerLogout);
  }

  renderizarStatusLicencaNavbar();

  function funcionarioEhAdmin(item) {
    return window.vstockSession.isAdministrador(item);
  }

  function funcionarioEhAdminMestre(item) {
    return window.vstockSession.isAdministradorMestre(item);
  }

  function classeLinkSidebar(href) {
    return paginaAtual === href ? 'nav-btn active' : 'nav-btn';
  }

  function paginaDesabilitadaPorModulo() {
    if (!modulos.estoque && ['cadastro-fornecedor.html', 'cadastro-cliente.html', 'cadastro-categoria.html', 'cadastro-produto.html', 'entrada-compra.html', 'saida-estoque.html', 'estoque.html', 'historico.html'].includes(paginaAtual)) {
      return true;
    }

    if (!modulos.alertas && paginaAtual === 'alertas.html') {
      return true;
    }

    return false;
  }

  function obterSidebarPrincipal() {
    return document.querySelector('.sidebar');
  }

  function salvarScrollSidebar(valor) {
    try {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(Math.max(0, Number(valor) || 0)));
    } catch (erro) {
      console.warn('Não foi possível salvar a posição do menu lateral:', erro);
    }
  }

  function lerScrollSidebarSalvo() {
    try {
      return Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
    } catch (erro) {
      console.warn('Não foi possível ler a posição do menu lateral:', erro);
      return 0;
    }
  }

  function lerEstadoGruposSidebar() {
    try {
      var bruto = sessionStorage.getItem(SIDEBAR_GROUPS_KEY);
      return bruto ? JSON.parse(bruto) : {};
    } catch (erro) {
      console.warn('Não foi possível ler o estado dos grupos do menu lateral:', erro);
      return {};
    }
  }

  function salvarEstadoGruposSidebar(estados) {
    try {
      sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(estados || {}));
    } catch (erro) {
      console.warn('Não foi possível salvar o estado dos grupos do menu lateral:', erro);
    }
  }

  function grupoSidebarEstaAberto(chave, possuiItemAtivo) {
    var estados = lerEstadoGruposSidebar();
    if (Object.prototype.hasOwnProperty.call(estados, chave)) {
      return estados[chave] !== false;
    }
    return possuiItemAtivo || true;
  }

  function montarGrupoSidebar(config) {
    if (!config || !config.conteudo || !config.conteudo.trim()) {
      return '';
    }

    var aberto = grupoSidebarEstaAberto(config.chave, !!config.ativo);
    var classeGrupo = aberto ? 'sidebar-group' : 'sidebar-group is-collapsed';
    var ariaExpanded = aberto ? 'true' : 'false';
    var hiddenAttr = aberto ? '' : ' hidden';
    var icone = config.icone ? `<i class="bi ${config.icone}" aria-hidden="true"></i>` : '';

    return `
      <section class="${classeGrupo}" data-sidebar-group="${config.chave}">
        <button class="sidebar-group-toggle" type="button" data-sidebar-group-toggle="${config.chave}" aria-expanded="${ariaExpanded}">
          <span class="sidebar-group-label">${icone}<small>${config.titulo}</small></span>
          <i class="bi bi-chevron-up sidebar-group-chevron" aria-hidden="true"></i>
        </button>
        <div class="sidebar-group-content"${hiddenAttr}>
          ${config.conteudo}
        </div>
      </section>
    `;
  }

  function itemAtivoEstaVisivel(sidebar, itemAtivo) {
    if (!sidebar || !itemAtivo) {
      return true;
    }

    var areaVisivelTopo = sidebar.scrollTop;
    var areaVisivelBase = areaVisivelTopo + sidebar.clientHeight;
    var itemTopo = itemAtivo.offsetTop;
    var itemBase = itemTopo + itemAtivo.offsetHeight;
    return itemTopo >= areaVisivelTopo && itemBase <= areaVisivelBase;
  }

  function restaurarScrollSidebar() {
    var sidebar = obterSidebarPrincipal();
    if (!sidebar) {
      return;
    }

    var scrollSalvo = lerScrollSidebarSalvo();
    sidebar.scrollTop = scrollSalvo;

    var itemAtivo = sidebar.querySelector('.nav-btn.active');
    if (itemAtivo && !itemAtivoEstaVisivel(sidebar, itemAtivo)) {
      itemAtivo.scrollIntoView({ block: 'nearest' });
    }
  }

  function registrarPersistenciaSidebar() {
    var sidebars = document.querySelectorAll('.sidebar');
    for (var i = 0; i < sidebars.length; i++) {
      sidebars[i].addEventListener('scroll', function () {
        salvarScrollSidebar(this.scrollTop);
      }, { passive: true });

      var links = sidebars[i].querySelectorAll('a.nav-btn[href]');
      for (var j = 0; j < links.length; j++) {
        links[j].addEventListener('click', function () {
          var sidebar = this.closest('.sidebar');
          if (sidebar) {
            salvarScrollSidebar(sidebar.scrollTop);
          }
        });
      }
    }
  }

  function registrarToggleGruposSidebar() {
    var toggles = document.querySelectorAll('.sidebar-group-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        var chave = this.getAttribute('data-sidebar-group-toggle');
        var grupo = this.closest('.sidebar-group');
        var conteudo = grupo ? grupo.querySelector('.sidebar-group-content') : null;
        if (!chave || !grupo || !conteudo) {
          return;
        }

        var estados = lerEstadoGruposSidebar();
        var seraFechado = !grupo.classList.contains('is-collapsed');

        grupo.classList.toggle('is-collapsed', seraFechado);
        conteudo.hidden = seraFechado;
        this.setAttribute('aria-expanded', seraFechado ? 'false' : 'true');

        estados[chave] = !seraFechado;
        salvarEstadoGruposSidebar(estados);
      });
    }
  }

  function registrarTransicaoSuaveEntrePaginas() {
    var conteudo = document.querySelector('.page-content');
    if (!conteudo) {
      return;
    }

    var linksInternos = document.querySelectorAll('a[href$=".html"]');
    for (var i = 0; i < linksInternos.length; i++) {
      linksInternos[i].addEventListener('click', function (event) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        var href = this.getAttribute('href');
        if (!href || href.charAt(0) === '#') {
          return;
        }

        conteudo.classList.add('is-loading');
      });
    }
  }

  function montarMenuSidebar() {
    var cadastroConteudo = modulos.estoque
      ? `
      <a class="${classeLinkSidebar('cadastro-fornecedor.html')}" href="cadastro-fornecedor.html">
        <i class="bi bi-truck"></i> Fornecedores
      </a>

      <a class="${classeLinkSidebar('cadastro-cliente.html')}" href="cadastro-cliente.html">
        <i class="bi bi-people"></i> Clientes
      </a>

      <a class="${classeLinkSidebar('cadastro-categoria.html')}" href="cadastro-categoria.html">
        <i class="bi bi-tags"></i> Categorias
      </a>

      <a class="${classeLinkSidebar('cadastro-produto.html')}" href="cadastro-produto.html">
        <i class="bi bi-box-seam"></i> Produtos
      </a>
      `
      : '';

    var vendasConteudo = `
      <a class="${classeLinkSidebar('vendas.html')}" href="vendas.html">
        <i class="bi bi-cart-check"></i> Vendas
      </a>

      <a class="${classeLinkSidebar('historico-vendas.html')}" href="historico-vendas.html">
        <i class="bi bi-receipt-cutoff"></i> Histórico de Vendas
      </a>
      <a class="${classeLinkSidebar('caixa.html')}" href="caixa.html">
        <i class="bi bi-cash-register"></i> Caixa
      </a>

      <a class="${classeLinkSidebar('historico-caixa.html')}" href="historico-caixa.html">
        <i class="bi bi-wallet2"></i> Histórico de Caixa
      </a>
    `;

    var estoqueConteudo = (modulos.estoque || modulos.alertas)
      ? `
      ${modulos.estoque ? `
      <a class="${classeLinkSidebar('entrada-compra.html')}" href="entrada-compra.html">
        <i class="bi bi-pencil-square"></i> Entrada de Estoque
      </a>
      ` : ''}

      ${modulos.estoque ? `
      <a class="${classeLinkSidebar('saida-estoque.html')}" href="saida-estoque.html">
        <i class="bi bi-box-arrow-up"></i> Saída de Estoque
      </a>
      ` : ''}

      ${modulos.estoque ? `
      <a class="${classeLinkSidebar('estoque.html')}" href="estoque.html">
        <i class="bi bi-archive"></i> Estoque
      </a>

      <a class="${classeLinkSidebar('historico.html')}" href="historico.html">
        <i class="bi bi-clock-history"></i> Movimentações
      </a>
      ` : ''}

      ${modulos.alertas ? `
      <a class="${classeLinkSidebar('alertas.html')}" href="alertas.html">
        <i class="bi bi-bell"></i> Alertas
      </a>
      ` : ''}
      `
      : '';

    var adminConteudo = funcionarioEhAdmin(funcionario)
      ? `
      <a class="${classeLinkSidebar('admin.html')}" href="admin.html">
        <i class="bi bi-sliders2-vertical"></i> Administração
      </a>
      <a class="${classeLinkSidebar('cadastro-funcionario.html')}" href="cadastro-funcionario.html">
        <i class="bi bi-person-gear"></i> Funcionários
      </a>
      `
      : '';

    var principalConteudo = `
      <a class="${classeLinkSidebar('index.html')}" href="index.html">
        <i class="bi bi-house-heart"></i> Dashboard
      </a>

      ${funcionarioEhAdminMestre(funcionario) ? `
      <a class="${classeLinkSidebar('parametrizacao.html')}" href="parametrizacao.html">
        <i class="bi bi-sliders"></i> Parametrização
      </a>
      ` : ''}
    `;

    var evolucoesConteudo = `
      <button class="nav-btn nav-btn-disabled" data-alert-message="Módulo em desenvolvimento" type="button">
        <i class="bi bi-speedometer2"></i> Dashboard Avançado
      </button>

      <button class="nav-btn nav-btn-disabled" data-alert-message="Módulo em desenvolvimento" type="button">
        <i class="bi bi-shield-lock"></i> Perfis e Permissões
      </button>
    `;

    return `
      <h5><i class="bi bi-grid-3x3-gap"></i> Módulos do Sistema</h5>

      ${montarGrupoSidebar({
        chave: 'principal',
        titulo: 'Principal',
        icone: 'bi-grid-3x3-gap',
        conteudo: principalConteudo,
        ativo: ['index.html', 'parametrizacao.html'].includes(paginaAtual)
      })}

      ${montarGrupoSidebar({
        chave: 'administracao',
        titulo: 'Administração',
        icone: 'bi-shield-lock',
        conteudo: adminConteudo,
        ativo: ['admin.html', 'cadastro-funcionario.html'].includes(paginaAtual)
      })}

      ${montarGrupoSidebar({
        chave: 'cadastros',
        titulo: 'Cadastros',
        icone: 'bi-journal-text',
        conteudo: cadastroConteudo,
        ativo: ['cadastro-fornecedor.html', 'cadastro-cliente.html', 'cadastro-categoria.html', 'cadastro-produto.html'].includes(paginaAtual)
      })}

      ${montarGrupoSidebar({
        chave: 'vendas',
        titulo: 'Vendas',
        icone: 'bi-cart-check',
        conteudo: vendasConteudo,
        ativo: ['vendas.html', 'historico-vendas.html', 'caixa.html', 'historico-caixa.html'].includes(paginaAtual)
      })}

      ${montarGrupoSidebar({
        chave: 'controle-estoque',
        titulo: 'Controle de Estoque',
        icone: 'bi-box',
        conteudo: estoqueConteudo,
        ativo: ['entrada-compra.html', 'saida-estoque.html', 'estoque.html', 'historico.html', 'alertas.html'].includes(paginaAtual)
      })}

      ${montarGrupoSidebar({
        chave: 'evolucoes',
        titulo: 'Evoluções',
        icone: 'bi-stars',
        conteudo: evolucoesConteudo,
        ativo: false
      })}
    `;
  }

  function renderizarSidebar() {
    var sidebars = document.querySelectorAll('.sidebar');
    for (var i = 0; i < sidebars.length; i++) {
      sidebars[i].innerHTML = montarMenuSidebar();
    }

    var cardsLegados = document.querySelectorAll('.sidebar .stats-card, .sidebar .brand-divider');
    for (var j = 0; j < cardsLegados.length; j++) {
      cardsLegados[j].remove();
    }

    registrarPersistenciaSidebar();
    registrarToggleGruposSidebar();
    requestAnimationFrame(restaurarScrollSidebar);
  }

  function validarAcessoAdmin() {
    var paginasAdmin = new Set(['cadastro-funcionario.html', 'admin.html']);
    if (paginaAtual === 'parametrizacao.html' && !funcionarioEhAdminMestre(funcionario)) {
      window.location.href = funcionario ? 'index.html' : 'login.html';
      return;
    }

    if (!funcionarioEhAdmin(funcionario)) {
      if (paginasAdmin.has(paginaAtual)) {
        window.location.href = funcionario ? 'index.html' : 'login.html';
      }
      return;
    }
  }

  function validarPrimeiraConfiguracao() {
    if (!empresa && funcionarioEhAdminMestre(funcionario) && paginaAtual !== 'parametrizacao.html') {
      window.location.href = 'parametrizacao.html';
      return false;
    }

    return true;
  }

  function validarAcessoModulos() {
    if (paginaDesabilitadaPorModulo()) {
      window.location.href = 'index.html';
      return false;
    }

    return true;
  }

  function ajustarDashboardParaPerfil() {
    if (paginaAtual !== 'index.html') {
      return;
    }

    var cardParametrizacao = document.getElementById('cardDashboardParametrizacao');
    if (cardParametrizacao && !funcionarioEhAdminMestre(funcionario)) {
      cardParametrizacao.remove();
    }

    ['cardDashboardEntrada', 'cardDashboardSaida', 'cardDashboardProduto', 'cardDashboardEstoque', 'cardDashboardHistorico']
      .forEach(function (id) {
        var card = document.getElementById(id);
        if (card && !modulos.estoque) {
          card.remove();
        }
      });

    var avisoAlertas = document.getElementById('avisoAlertasDashboard');
    if (avisoAlertas && !modulos.alertas) {
      avisoAlertas.remove();
    }
  }

  validarAcessoAdmin();
  if (!validarPrimeiraConfiguracao()) {
    return;
  }
  if (!validarAcessoModulos()) {
    return;
  }
  renderizarSidebar();
  ajustarDashboardParaPerfil();
  registrarTransicaoSuaveEntrePaginas();

  var btnMenuCompras = document.getElementById('btn-entrada-compra');
  if (btnMenuCompras) {
    btnMenuCompras.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'entrada-compra.html';
    });
  }

  window.mostrarAviso = function (msg) {
    alert(msg);
  };

  window.showTab = function (tabId) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove('active');
      tabs[i].classList.add('hidden');
    }

    var btns = document.querySelectorAll('.nav-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.remove('active');
    }

    var selectedTab = document.getElementById(tabId);
    if (selectedTab) {
      selectedTab.classList.remove('hidden');
      selectedTab.classList.add('active');
    }

    var correspondingBtn = document.getElementById('btn-' + tabId);
    if (correspondingBtn) {
      correspondingBtn.classList.add('active');
    }
  };
});




