async (initialPage) => {
  const browser = initialPage.context().browser();
  const origin = 'http://127.0.0.1:8765';
  const normalizeSpace = (str) => (str || '').replace(/\s+/g, ' ').trim();
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

      await page.goto(`${origin}/historico-caixa.html`);
      await page.waitForSelector('#cashHistoryTableBody tr', { timeout: 10000 });
      const initialRows = await page.locator('#cashHistoryTableBody tr').count();
      assert(initialRows > 0, `Nenhuma sessão carregada em ${width}px`);

      // Busca por operador
      await page.fill('#cashHistoryOperator', 'Administrador');
      await page.click('#cashHistorySearch');
      await page.waitForTimeout(200);
      const filteredRows = await page.locator('#cashHistoryTableBody tr').count();
      assert(filteredRows > 0, `Busca não retornou sessões em ${width}px`);

      // Limpar
      await page.click('#cashHistoryClear');
      await page.click('#cashHistorySearch');
      await page.waitForTimeout(200);

      // Abrir detalhe
      await page.locator('#cashHistoryTableBody button[data-sessao-id]').first().click();
      await page.waitForSelector('#cashHistoryDetailModal.show, #cashHistoryDetailModal', { state: 'visible', timeout: 5000 });
      const modalVisible = await page.locator('#cashHistoryDetailModal').isVisible();
      assert(modalVisible, `Modal de detalhe não abriu em ${width}px`);

      const sessionId = normalizeSpace(await page.locator('#cashDetailSessionId').textContent());
      assert(sessionId.length > 0, `ID da sessão não exibido em ${width}px`);

      const netSales = normalizeSpace(await page.locator('#cashDetailNetSales').textContent());
      assert(netSales.length > 0, `Vendas líquidas não exibidas em ${width}px`);

      const difference = normalizeSpace(await page.locator('#cashDetailDifference').textContent());
      assert(difference.length > 0, `Diferença não exibida em ${width}px`);

      // Ação de impressão disponível para sessão fechada
      const printButton = page.locator('#cashHistoryPrintReceipt');
      const printVisible = await printButton.isVisible();
      assert(printVisible, `Botão de impressão não visível em ${width}px`);

      // Fechar modal
      await page.locator('#cashHistoryDetailModal [data-bs-dismiss="modal"]').first().click();
      await page.locator('#cashHistoryDetailModal').waitFor({ state: 'hidden', timeout: 5000 });

      // Layout
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh') && body.classList.contains('app-shell');
        const hasVisualCompletoCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some((link) => (link.getAttribute('href') || '').includes('visual-completo.css'));

        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarContract = Boolean(topbarMain && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span');

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const valueEl = document.querySelector('#cashDetailNetSales, #cashHistoryNetSales, #cashDetailDifference');
        const valueStyle = valueEl ? window.getComputedStyle(valueEl) : null;
        const isTabular = Boolean(
          valueStyle && (
            valueStyle.fontVariantNumeric.includes('tabular-nums') ||
            valueStyle.fontFeatureSettings.includes('tnum') ||
            window.getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums') ||
            window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum')
          )
        );

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        // Print: emulate print and check moldura hidden (receipt only)
        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarContract,
          h1Count,
          singleH1InContent,
          isTabular,
          overflow,
        };
      });

      if (!layout.hasVstockRefresh) visualFailures.push(`${width}px: body sem vstock-refresh/app-shell`);
      if (!layout.hasVisualCompletoCss) visualFailures.push(`${width}px: visual-completo.css ausente`);
      if (!layout.hasTopbarContract) visualFailures.push(`${width}px: topbar sem contrato span.app-topbar-title`);
      if (!layout.singleH1InContent) visualFailures.push(`${width}px: esperava 1 h1 no conteúdo, encontrou ${layout.h1Count}`);
      if (!layout.isTabular) visualFailures.push(`${width}px: valores sem tabular-nums`);
      if (layout.overflow > 1) visualFailures.push(`${width}px: overflow horizontal de ${layout.overflow}px`);

      await page.emulateMedia({ media: 'print' });
      const printState = await page.evaluate(() => {
        const seletores = ['.app-topbar', '.sidebar', '.cash-page-header', '.cash-card', '.cash-history-summary', '.cash-history-list'];
        return seletores.map((seletor) => {
          const elemento = document.querySelector(seletor);
          const estilo = elemento ? window.getComputedStyle(elemento) : null;
          return { seletor, display: estilo?.display || 'none', visibility: estilo?.visibility || 'hidden' };
        });
      });
      const molduraVisivel = printState.filter((item) => item.display !== 'none' && item.visibility !== 'hidden');
      if (molduraVisivel.length) {
        visualFailures.push(`${width}px: moldura visível em print: ${molduraVisivel.map((item) => item.seletor).join(', ')}`);
      }
      await page.emulateMedia({ media: 'screen' });

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, filteredRows });
    });
  }

  assert(!visualFailures.length, `Aceitação visual historico-caixa.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}