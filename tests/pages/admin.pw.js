async (initialPage) => {
  const browser = initialPage.context().browser();
  const origin = 'http://127.0.0.1:8765';
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const evidence = [];
  const visualFailures = [];

  async function withPage(viewport, run) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await run(page);
    } finally {
      await context.close();
    }
  }

  for (const width of [390, 1366]) {
    await withPage({ width, height: 844 }, async (page) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const downloads = [];
      page.on('download', (d) => downloads.push(d.suggestedFilename()));

      await page.goto(`${origin}/admin.html`);
      await page.waitForSelector('#tabelaLogsSistema tbody tr', { timeout: 10000 });

      // Backup separado visualmente da consulta de logs
      const separation = await page.evaluate(() => {
        const backupBtn = document.querySelector('#btnGerarBackupAdmin');
        const logsTable = document.querySelector('#tabelaLogsSistema');
        const filtroUsuario = document.querySelector('#filtroLogUsuario');
        const backupPanel = backupBtn?.closest('.vs-panel, .card, section, [data-region]');
        const logsPanel = logsTable?.closest('.vs-panel, .card, section, [data-region]');
        const filtroPanel = filtroUsuario?.closest('.vs-panel, .card, section, [data-region]');
        const samePanel = backupPanel && logsPanel && backupPanel === logsPanel;
        const filtersWithTable = Boolean(filtroPanel && logsPanel && filtroPanel === logsPanel);
        const backupRegion = backupPanel?.getAttribute('data-region') || backupPanel?.id || '';
        const logsRegion = logsPanel?.getAttribute('data-region') || logsPanel?.id || '';
        return {
          hasBackup: Boolean(backupBtn),
          hasLogs: Boolean(logsTable),
          hasFilters: Boolean(filtroUsuario),
          samePanel,
          filtersWithTable,
          backupRegion,
          logsRegion,
        };
      });
      assert(separation.hasBackup, `${width}px: botão de backup ausente`);
      assert(separation.hasLogs, `${width}px: tabela de logs ausente`);
      assert(separation.hasFilters, `${width}px: filtros de logs ausentes`);
      if (separation.samePanel) {
        visualFailures.push(`${width}px: backup e consulta de logs no mesmo painel`);
      }
      if (!separation.filtersWithTable) {
        visualFailures.push(`${width}px: filtros e tabela de auditoria não estão na mesma região`);
      }

      // Filtrar logs sem iniciar download nem limpeza
      await page.fill('#filtroLogUsuario', 'Administrador');
      await page.fill('#filtroLogOperacao', 'LOGIN');
      await page.selectOption('#filtroLogLimite', '100');
      const downloadsBefore = downloads.length;
      await page.click('#btnFiltrarLogs');
      await page.waitForTimeout(400);
      const afterFilter = await page.evaluate(() => ({
        usuario: document.querySelector('#filtroLogUsuario')?.value || '',
        operacao: document.querySelector('#filtroLogOperacao')?.value || '',
        limite: document.querySelector('#filtroLogLimite')?.value || '',
        downloads: 0,
      }));
      assert(afterFilter.usuario === 'Administrador', `${width}px: filtro usuário foi limpo ao filtrar`);
      assert(afterFilter.operacao === 'LOGIN', `${width}px: filtro operação foi limpo ao filtrar`);
      assert(afterFilter.limite === '100', `${width}px: filtro limite foi limpo ao filtrar`);
      assert(downloads.length === downloadsBefore, `${width}px: filtrar iniciou download (${downloads.slice(downloadsBefore).join(', ')})`);

      // Limpar restaura filtros (ação distinta)
      await page.click('#btnLimparLogs');
      await page.waitForTimeout(400);
      const afterClear = await page.evaluate(() => ({
        usuario: document.querySelector('#filtroLogUsuario')?.value || '',
        operacao: document.querySelector('#filtroLogOperacao')?.value || '',
        limite: document.querySelector('#filtroLogLimite')?.value || '',
      }));
      assert(afterClear.usuario === '', `${width}px: limpar não limpou usuário`);
      assert(afterClear.operacao === '', `${width}px: limpar não limpou operação`);
      assert(afterClear.limite === '50', `${width}px: limpar não restaurou limite`);

      // Layout / contrato visual
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh') && body.classList.contains('app-shell');
        const hasVisualCompletoCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some((l) => (l.getAttribute('href') || '').includes('visual-completo.css'));
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarContract = Boolean(
          topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span'
        );
        const h1s = Array.from(document.querySelectorAll('h1'));
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = h1s.length === 1 && Boolean(mainContent && h1s[0] && mainContent.contains(h1s[0])) && h1s[0].getBoundingClientRect().height > 0;
        const valueEl = document.querySelector('#tabelaLogsSistema td, #tabelaLogsSistema th, .admin-operacao-badge');
        const style = valueEl ? window.getComputedStyle(valueEl) : window.getComputedStyle(document.body);
        const bodyStyle = window.getComputedStyle(document.body);
        const isTabular = [style, bodyStyle].some((s) =>
          (s.fontVariantNumeric || '').includes('tabular-nums') || (s.fontFeatureSettings || '').includes('tnum')
        );
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarContract,
          h1Count: h1s.length,
          singleH1InContent,
          isTabular,
          overflow,
        };
      });

      if (!layout.hasVstockRefresh) visualFailures.push(`${width}px: body sem vstock-refresh/app-shell`);
      if (!layout.hasVisualCompletoCss) visualFailures.push(`${width}px: visual-completo.css ausente`);
      if (!layout.hasTopbarContract) visualFailures.push(`${width}px: topbar sem contrato span.app-topbar-title`);
      if (!layout.singleH1InContent) visualFailures.push(`${width}px: esperava 1 h1 no conteúdo, encontrou ${layout.h1Count}`);
      if (!layout.isTabular) visualFailures.push(`${width}px: números/dados sem tabular-nums`);
      if (layout.overflow > 1) visualFailures.push(`${width}px: overflow horizontal ${layout.overflow}px`);

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, separation, layout });
    });
  }

  // Acesso continua limitado (não-admin redireciona)
  await withPage({ width: 1366, height: 844 }, async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem('funcionarioLogado', JSON.stringify({
        funcCpf: '22222222222',
        funcNome: 'Operador Teste',
        funcEmail: 'operador@teste.local',
        cargo: 'Operador',
        tipoAcesso: 1,
        dataDemissao: null,
      }));
      localStorage.setItem('authToken', 'mock-token-operador');
    });
    await page.goto(`${origin}/admin.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => !url.pathname.endsWith('/admin.html'), { timeout: 8000 });
    const path = new URL(page.url()).pathname;
    assert(path.endsWith('/index.html') || path.endsWith('/login.html'), `Não-admin não foi redirecionado: ${path}`);
    evidence.push({ accessControl: `redirected to ${path}` });
  });

  assert(!visualFailures.length, `Aceitação visual admin.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
