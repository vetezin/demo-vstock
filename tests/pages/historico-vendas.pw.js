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
      await page.goto(`${origin}/historico-vendas.html`);
      await page.waitForSelector('#tabelaHistoricoVendasBody tr', { timeout: 10000 });
      const initialRows = await page.locator('#tabelaHistoricoVendasBody tr').count();
      assert(initialRows > 0, `Nenhuma venda carregada em ${width}px`);

      // 1. Filtro por período
      await page.fill('#filtroVendaDataInicio', '2026-04-11');
      await page.fill('#filtroVendaDataFim', '2026-04-12');
      await page.click('#btnFiltrarHistoricoVendas');
      await page.waitForTimeout(200);
      const filteredRows = await page.locator('#tabelaHistoricoVendasBody tr').count();
      assert(filteredRows === 2, `Filtro por período não aplicou em ${width}px: esperado 2, obteve ${filteredRows}`);

      // 2. Abrir venda e conferir itens e totais
      await page.locator('#tabelaHistoricoVendasBody button[data-acao="ver"]').first().click();
      await page.waitForSelector('#modalDetalheVenda.show', { state: 'visible', timeout: 5000 });
      const modalVisible = await page.locator('#modalDetalheVenda').isVisible();
      assert(modalVisible, `Modal de detalhe não abriu em ${width}px`);
      const detailItems = await page.locator('#detalheVendaItensBody tr').count();
      assert(detailItems >= 1, `Detalhe sem itens em ${width}px`);
      const detailTotal = (await page.locator('#detalheVendaTotal').textContent() || '').trim();
      assert(detailTotal.length > 0 && detailTotal !== 'R$ 0,00', `Total do detalhe inválido em ${width}px: ${detailTotal}`);
      await page.locator('#modalDetalheVenda [data-bs-dismiss="modal"]').first().click();
      await page.locator('#modalDetalheVenda').waitFor({ state: 'hidden', timeout: 5000 });

      // 3. Cancelamento: passos originais preservados
      await page.locator('#tabelaHistoricoVendasBody button[data-acao="cancelar"]:not([disabled])').first().click().catch(async () => {
        await page.locator('#tabelaHistoricoVendasBody button[data-acao="cancelar"]').first().click();
      });
      await page.waitForSelector('#modalCancelarVenda.show', { state: 'visible', timeout: 5000 });
      const cancelModalVisible = await page.locator('#modalCancelarVenda').isVisible();
      assert(cancelModalVisible, `Modal de cancelamento não abriu em ${width}px`);
      await page.locator('#modalCancelarVenda [data-bs-dismiss="modal"]').first().click();
      await page.locator('#modalCancelarVenda').waitFor({ state: 'hidden', timeout: 5000 });

      // 4. Layout
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(
          topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span'
        );

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const valueEl = document.querySelector('#resumoValorTotalVendas, #detalheVendaTotal');
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

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          isTabular,
          overflow,
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.isTabular ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, filteredRows, detailItems, detailTotal });
    });
  }

  assert(!visualFailures.length, `Aceitação visual historico-vendas.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}