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

  function criarSessaoVisualPadrao() {
    return {
      funcCpf: '000.000.000-00',
      funcNome: 'Operador Local',
      funcEmail: 'admin@admin.login',
      funcTelefone: '',
      tipoAcesso: 99,
      username: 'operador.local',
      cargo: 'Administrador'
    };
  }

  function garantirSessaoVisual() {
    const funcionarioAtual = localStorage.getItem('funcionarioLogado');
    if ((funcionarioAtual || '').trim()) {
      return;
    }

    localStorage.setItem('funcionarioLogado', JSON.stringify(criarSessaoVisualPadrao()));
  }

  window.vstockFrontendSecurity = {
    criarSessaoVisualPadrao,
    garantirSessaoVisual,
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
  var statusLicencaAtual = null;

  if (paginaAtual !== 'login.html') {
    window.vstockFrontendSecurity.garantirSessaoVisual();
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

      statusLicencaAtual = status;
      return true;
    } catch (erro) {
      console.error('Erro ao verificar licença da página:', erro);
      return true;
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
      alertas: empresa ? empresa.moduloAlertas !== false : true
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

  const empresa = await carregarEmpresaUnica();
  const modulos = normalizarModulos(empresa);
  aplicarTema(empresa);
  aplicarLogoNavbar(obterLogoSistema(empresa));
  simplificarBrandingNavbar();

  var logoContainer = document.getElementById('logoEmpresa');
  if (empresa && logoContainer) {
    renderizarLogo(logoContainer, obterLogoSistema(empresa));
  }

  function carregarFuncionarioLogado() {
    try {
      return JSON.parse(localStorage.getItem('funcionarioLogado') || 'null');
    } catch (erro) {
      console.warn('Não foi possível ler o funcionário logado:', erro);
      return null;
    }
  }

  var funcionario = carregarFuncionarioLogado();
  var usuarioLogado = document.getElementById('usuario-logado');
  var btnSair = document.getElementById('btnSairSistema');
  var navbarUserExistente = document.querySelector('.navbar-user');
  var topoDireitaBase = document.querySelector('.navbar .text-end') || document.querySelector('.brand-navbar .text-end') || document.querySelector('.navbar .text-white');
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
      <div class="navbar-system-row" id="navbarSystemRowTop">
        <div class="navbar-user navbar-user-inline">
          <i class="bi bi-person-badge"></i>
          <span id="usuario-logado">Operador</span>
        </div>
      </div>
      <div class="navbar-system-row" id="navbarSystemRowBottom">
        <div id="navbarLicenseStatusSlot"></div>
      </div>
    `;

    topoDireitaBase.innerHTML = '';
    topoDireitaBase.appendChild(wrapper);

    var rowTop = document.getElementById('navbarSystemRowTop');
    if (dataOriginal) {
      rowTop.appendChild(dataOriginal);
    }

    var rowBottom = document.getElementById('navbarSystemRowBottom');
    var logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'btn btn-sm btn-outline-light navbar-logout-btn';
    logoutButton.id = 'btnSairSistema';
    logoutButton.innerHTML = '<i class="bi bi-box-arrow-right"></i> Sair';
    rowBottom.appendChild(logoutButton);

    usuarioLogado = document.getElementById('usuario-logado');
    btnSair = document.getElementById('btnSairSistema');
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

    existente.innerHTML = '<i class="bi bi-patch-check"></i> <span>' + obterResumoLicenca(statusLicencaAtual) + '</span>';
  }

  function fazerLogout() {
    window.vstockFrontendSecurity.limparSessao();
    window.vstockFrontendSecurity.garantirSessaoVisual();
    window.location.href = 'index.html';
  }

  if (paginaAtual !== 'login.html') {
    blocoTopoSistema = garantirEstruturaTopoSistema();
  }

  if (usuarioLogado && funcionario) {
    usuarioLogado.textContent = funcionario.funcNome || funcionario.nome || 'Operador';
  }

  if (btnSair) {
    btnSair.addEventListener('click', fazerLogout);
  }

  renderizarStatusLicencaNavbar();

  function funcionarioEhAdmin(item) {
    return Number(item?.tipoAcesso) === 99;
  }

  function funcionarioEhAdminMestre(item) {
    var email = String(item?.funcEmail || item?.email || '').trim().toLowerCase();
    return funcionarioEhAdmin(item) && (email === 'admin@admin' || email === 'admin@admin.login');
  }

  function classeLinkSidebar(href) {
    return paginaAtual === href ? 'nav-btn active' : 'nav-btn';
  }

  function paginaDesabilitadaPorModulo() {
    if (!modulos.estoque && ['cadastro-fornecedor.html', 'cadastro-categoria.html', 'cadastro-produto.html', 'entrada-compra.html', 'saida-estoque.html', 'estoque.html', 'historico.html'].includes(paginaAtual)) {
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

  function montarMenuSidebar() {
    var linksCadastro = modulos.estoque
      ? `
      <div class="module-divider">
        <small><i class="bi bi-journal-text"></i> CADASTROS</small>
      </div>

      <a class="${classeLinkSidebar('cadastro-fornecedor.html')}" href="cadastro-fornecedor.html">
        <i class="bi bi-truck"></i> Fornecedores
      </a>

      <a class="${classeLinkSidebar('cadastro-categoria.html')}" href="cadastro-categoria.html">
        <i class="bi bi-tags"></i> Categorias
      </a>

      <a class="${classeLinkSidebar('cadastro-produto.html')}" href="cadastro-produto.html">
        <i class="bi bi-box-seam"></i> Produtos
      </a>
      `
      : '';

    var linksControleEstoque = (modulos.estoque || modulos.alertas)
      ? `
      <div class="module-divider">
        <small><i class="bi bi-box"></i> CONTROLE DE ESTOQUE</small>
      </div>

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

    var blocoAdmin = funcionarioEhAdmin(funcionario)
      ? `
      <div class="module-divider">
        <small><i class="bi bi-shield-lock"></i> ADMINISTRAÇÃO</small>
      </div>
      <a class="${classeLinkSidebar('admin.html')}" href="admin.html">
        <i class="bi bi-sliders2-vertical"></i> Administração
      </a>
      <a class="${classeLinkSidebar('cadastro-funcionario.html')}" href="cadastro-funcionario.html">
        <i class="bi bi-person-gear"></i> Funcionários
      </a>
      `
      : '';

    return `
      <h5><i class="bi bi-grid-3x3-gap"></i> Módulos do Sistema</h5>

      <a class="${classeLinkSidebar('index.html')}" href="index.html">
        <i class="bi bi-house-heart"></i> Dashboard
      </a>

      ${funcionarioEhAdminMestre(funcionario) ? `
      <a class="${classeLinkSidebar('parametrizacao.html')}" href="parametrizacao.html">
        <i class="bi bi-sliders"></i> Parametrização
      </a>
      ` : ''}

      ${blocoAdmin}

      ${linksCadastro}

      ${linksControleEstoque}

      <div class="module-development">
        <small><i class="bi bi-stars"></i> EVOLUÇÕES</small>
      </div>

      <button class="nav-btn nav-btn-disabled" data-alert-message="Módulo em desenvolvimento" type="button">
        <i class="bi bi-speedometer2"></i> Dashboard Avançado
      </button>

      <button class="nav-btn nav-btn-disabled" data-alert-message="Módulo em desenvolvimento" type="button">
        <i class="bi bi-shield-lock"></i> Perfis e Permissões
      </button>
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





