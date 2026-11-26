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
      await page.goto(`${origin}/alertas.html`);
      await page.waitForSelector('#tabelaAlertas tbody tr', { timeout: 10000 });

      // 1. Interação e dados iniciais
      const initialRowCount = await page.locator('#tabelaAlertas tbody tr').count();
      assert(initialRowCount > 0, `Nenhum alerta carregado em ${width}px`);

      const resumoText = (await page.locator('#qtdAlertasResumo').textContent() || '').trim();
      assert(Number(resumoText) > 0, `Contador de alertas resumo inválido: ${resumoText}`);

      // Verificar que itens possuem link de histórico com parâmetro de produto
      const firstHistoryLink = await page.locator('#tabelaAlertas tbody tr a[href*="historico.html?produto="]').first().getAttribute('href');
      assert(firstHistoryLink && firstHistoryLink.includes('historico.html?produto='), `Link de histórico inválido: ${firstHistoryLink}`);

      // Capturar classificações iniciais dos alertas exibidos
      const initialBadges = await page.locator('#tabelaAlertas tbody tr .status-badge-estoque').allTextContents();
      const initialLabels = initialBadges.map((b) => b.trim());
      assert(initialLabels.every((label) => ['Baixo estoque', 'Vencendo', 'Vencido', 'Sem estoque'].includes(label)),
        `Status com rótulo inesperado: ${JSON.stringify(initialLabels)}`);

      // 2. Situação filtrada: filtrar por status SEM_ESTOQUE
      await page.selectOption('#filtroStatusAlerta', 'SEM_ESTOQUE');
      await page.click('#btnFiltrarAlertas');
      await page.waitForTimeout(150);

      const filteredRowCount = await page.locator('#tabelaAlertas tbody tr').count();
      assert(filteredRowCount > 0 && filteredRowCount <= initialRowCount, `Filtro por status SEM_ESTOQUE falhou em ${width}px`);
      const filteredBadges = await page.locator('#tabelaAlertas tbody tr .status-badge-estoque').allTextContents();
      assert(filteredBadges.every((b) => b.trim() === 'Sem estoque'),
        `Item na lista filtrada possui classificação divergente: ${JSON.stringify(filteredBadges)}`);

      // 3. Estado vazio: buscar termo inexistente
      await page.fill('#filtroProdutoAlerta', 'ITEM_INEXISTENTE_BUSCA_99999');
      await page.click('#btnFiltrarAlertas');
      await page.waitForTimeout(150);

      const emptyVisible = await page.locator('#estadoVazioAlertas').isVisible();
      const emptyRowCount = await page.locator('#tabelaAlertas tbody tr').count();
      assert(emptyVisible, `Estado vazio (#estadoVazioAlertas) não exibido em ${width}px`);
      assert(emptyRowCount === 0, `Tabela ainda exibe linhas no estado vazio em ${width}px`);

      // 4. Limpar filtros: restaura listagem sem mudança de classificação
      await page.click('#btnLimparAlertas');
      await page.waitForTimeout(150);

      const restoredRowCount = await page.locator('#tabelaAlertas tbody tr').count();
      assert(restoredRowCount === initialRowCount,
        `Limpar filtros não restaurou listagem original (${restoredRowCount} vs ${initialRowCount}) em ${width}px`);
      const emptyHidden = !(await page.locator('#estadoVazioAlertas').isVisible());
      assert(emptyHidden, `Estado vazio continuou visível após limpar filtros em ${width}px`);

      const restoredBadges = (await page.locator('#tabelaAlertas tbody tr .status-badge-estoque').allTextContents()).map(b => b.trim());
      assert(JSON.stringify(restoredBadges) === JSON.stringify(initialLabels),
        'Classificação dos alertas foi alterada após limpar filtros');

      // 5. Layout, paleta e conformidade estrutural
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh') && body.classList.contains('app-shell');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        // Navbar topbar contract
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(
          topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span'
        );

        // Heading h1 único no conteúdo
        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        // Ocorrências primeiro: resumo/ocorrências precede a faixa de filtros no DOM e visualmente
        const occurrencesCard = document.querySelector('.alerta-resumo-card, .alerta-ocorrencias-card, [data-region="ocorrencias-resumo"]');
        const filtersToolbar = document.querySelector('.listagem-toolbar, .alerta-filtros-card, [data-region="filtros-alerta"]');
        const table = document.querySelector('#tabelaAlertas');

        const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null);
        const occurrencesTop = top(occurrencesCard);
        const filtersTop = top(filtersToolbar);
        const tableTop = top(table);

        const domOrder = Boolean(
          occurrencesCard && filtersToolbar &&
          (occurrencesCard.compareDocumentPosition(filtersToolbar) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
        const visualOrder = Boolean(
          occurrencesTop !== null && filtersTop !== null && tableTop !== null &&
          occurrencesTop < filtersTop && filtersTop < tableTop
        );

        // Severidade e badges: texto explícito e estilização de etiqueta de prateleira
        const badges = Array.from(document.querySelectorAll('.status-badge-estoque'));
        const badgesHaveText = badges.length > 0 && badges.every((b) => b.textContent.trim().length > 0);
        const firstBadgeStyle = badges[0] ? window.getComputedStyle(badges[0]) : null;
        const hasShelfTagStyle = firstBadgeStyle ? (
          parseFloat(firstBadgeStyle.borderLeftWidth) >= 2 || firstBadgeStyle.borderLeftStyle === 'solid'
        ) : false;

        // Não usar azul claro como texto em branco (#74aed6 / rgb(116, 174, 214))
        const badBlueOnLight = badges.some((b) => {
          const color = window.getComputedStyle(b).color;
          return color.includes('116, 174, 214') || color.includes('116,174,214');
        });

        // Tabular numbers
        const qtdCell = document.querySelector('#tabelaAlertas tbody td.text-end');
        const qtdStyle = qtdCell ? window.getComputedStyle(qtdCell) : null;
        const resumoEl = document.querySelector('#qtdAlertasResumo');
        const resumoStyle = resumoEl ? window.getComputedStyle(resumoEl) : null;
        const isTabular = Boolean(
          (qtdStyle && (qtdStyle.fontVariantNumeric.includes('tabular-nums') || qtdStyle.fontFeatureSettings.includes('tnum'))) ||
          (resumoStyle && (resumoStyle.fontVariantNumeric.includes('tabular-nums') || resumoStyle.fontFeatureSettings.includes('tnum')))
        );

        // Transbordo horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          singleH1InContent,
          h1Count,
          domOrder,
          visualOrder,
          occurrencesTop,
          filtersTop,
          tableTop,
          badgesHaveText,
          hasShelfTagStyle,
          badBlueOnLight,
          isTabular,
          overflow
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.domOrder ||
        !layout.visualOrder ||
        !layout.badgesHaveText ||
        !layout.hasShelfTagStyle ||
        layout.badBlueOnLight ||
        !layout.isTabular ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual alertas.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
