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
      await page.goto(`${origin}/estoque.html`);
      await page.waitForSelector('#tabelaEstoque tbody tr');

      // Interação: verificar dados carregados
      const initialRowCount = await page.locator('#tabelaEstoque tbody tr').count();
      assert(initialRowCount > 0, 'Tabela de estoque não renderizou linhas iniciais');

      // Verificar link para historico
      const firstHistoryLink = await page.locator('#tabelaEstoque tbody tr a[href*="historico.html?produto="]').first().getAttribute('href');
      assert(firstHistoryLink && firstHistoryLink.startsWith('historico.html?produto='), `Link de histórico inválido: ${firstHistoryLink}`);

      // Filtro e restauração
      await page.fill('#filtroProdutoEstoque', 'Açúcar');
      await page.click('#btnFiltrarEstoque');
      await page.waitForTimeout(100);
      const filteredCount = await page.locator('#tabelaEstoque tbody tr').count();
      assert(filteredCount <= initialRowCount, 'Filtro não alterou a listagem de estoque');

      await page.click('#btnLimparEstoque');
      await page.waitForTimeout(100);
      const restoredCount = await page.locator('#tabelaEstoque tbody tr').count();
      assert(restoredCount === initialRowCount, 'Limpar filtros não restaurou a listagem');

      // Layout: busca e filtros antes do resumo numérico
      const layout = await page.evaluate(() => {
        const filters = document.querySelector('.estoque-filtros-card, [aria-label="Filtros de estoque"], .estoque-filtros');
        const kpis = document.querySelector('.estoque-kpis');
        const heading = document.querySelector('h1');
        const content = document.querySelector('.content, main, .main-content');
        const top = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);

        // Status badges text
        const badges = Array.from(document.querySelectorAll('.status-badge-estoque'));
        const badgesHaveText = badges.length > 0 && badges.every((b) => b.textContent.trim().length > 0);

        // Tabular numbers
        const saldoCell = document.querySelector('#tabelaEstoque tbody td.text-end, #tabelaEstoque tbody td:nth-child(3)');
        const saldoStyle = saldoCell ? window.getComputedStyle(saldoCell) : null;
        const isTabular = saldoStyle ? (
          saldoStyle.fontVariantNumeric.includes('tabular-nums') ||
          window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum') ||
          saldoStyle.fontFeatureSettings.includes('tnum')
        ) : false;

        const domOrder = Boolean(filters && kpis && (filters.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING));
        const visualOrder = Boolean(filters && kpis && (top(filters) < top(kpis)));

        return {
          domOrder,
          visualOrder,
          filtersTop: filters ? top(filters) : null,
          kpisTop: kpis ? top(kpis) : null,
          contentTitle: document.querySelectorAll('h1').length === 1 &&
            Boolean(heading && content && content.contains(heading)) && heading.getBoundingClientRect().height > 0,
          badgesHaveText,
          isTabular,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      if (!layout.domOrder || !layout.visualOrder || !layout.contentTitle || !layout.isTabular || layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual estoque.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
