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

      // 1. Linha do tempo carrega (sem filtro de produto)
      await page.goto(`${origin}/historico.html`);
      await page.waitForSelector('#timelineHistorico .timeline-item', { timeout: 10000 });
      const initialItems = await page.locator('#timelineHistorico .timeline-item').count();
      assert(initialItems > 0, `Linha do tempo não carregou em ${width}px`);

      // Paginação: 10 por página
      assert(initialItems <= 10, `Primeira página exibe mais de 10 itens em ${width}px: ${initialItems}`);

      const firstPageFirstCard = (await page.locator('#timelineHistorico .timeline-item').first().textContent() || '').trim();

      // Avançar página
      await page.click('#btnPaginaProximaHistorico');
      await page.waitForTimeout(150);
      const secondPageSummary = (await page.locator('#paginacaoHistorico').textContent() || '').trim();
      assert(secondPageSummary.includes('Pagina 2'), `Paginação não avançou para página 2 em ${width}px: ${secondPageSummary}`);
      const secondPageFirstCard = (await page.locator('#timelineHistorico .timeline-item').first().textContent() || '').trim();
      assert(secondPageFirstCard !== firstPageFirstCard, `Conteúdo não mudou ao paginar em ${width}px`);

      // Voltar para página 1
      await page.click('#btnPaginaAnteriorHistorico');
      await page.waitForTimeout(150);

      // 2. Abrir com ?produto= preenche o filtro
      await page.goto(`${origin}/historico.html?produto=Produto%2001`);
      await page.waitForSelector('#timelineHistorico .timeline-item', { timeout: 10000 });
      const produtoFiltro = await page.inputValue('#filtroProduto');
      assert(produtoFiltro === 'Produto 01', `Filtro de produto não preenchido pela URL em ${width}px: "${produtoFiltro}"`);
      const produtoItems = await page.locator('#timelineHistorico .timeline-item').count();
      assert(produtoItems > 0 && produtoItems < initialItems, `Filtro por produto não aplicou à linha do tempo em ${width}px`);

      // 3. Alterar tipo preserva continuidade da consulta
      await page.selectOption('#filtroTipo', 'ENTRADA');
      await page.click('#btnFiltrarHistorico');
      await page.waitForTimeout(150);
      const produtoFiltroDepois = await page.inputValue('#filtroProduto');
      assert(produtoFiltroDepois === 'Produto 01', `Filtro de produto perdido ao alterar tipo em ${width}px: "${produtoFiltroDepois}"`);
      const tipoFiltroDepois = await page.inputValue('#filtroTipo');
      assert(tipoFiltroDepois === 'ENTRADA', `Tipo não mantido em ${width}px`);
      const tipoItems = await page.locator('#timelineHistorico .timeline-item').count();
      assert(tipoItems > 0 && tipoItems <= produtoItems, `Filtro por tipo não aplicou em ${width}px`);

      // 4. Layout e conformidade visual
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

        // Tabular numbers
        const valueEl = document.querySelector('.timeline-meta-bloco strong, .timeline-produto-coluna-total');
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
      evidence.push({ width, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual historico.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}